/**
 * services/queryAdvisorService.ts
 * ───────────────────────────────
 * Continuous query advisor v1 (gap-analysis P1-1).
 *
 * pganalyze Query Advisor / Datadog DBM turn streams of EXPLAIN plans into
 * concrete optimization recommendations. PulseDB already ingests auto_explain
 * events with plan JSON (autoExplainService); this service walks those plans,
 * detects well-known anti-patterns, and maintains a deduplicated
 * recommendations queue. A benchmark endpoint compares a proposed rewrite
 * against the original via EXPLAIN inside a rolled-back transaction.
 *
 *   analyzePlan(planJson, durationMs)        — pure; exported for tests
 *   runAdvisorSweep({ controlPool, ... })    — analyze recent events
 *   benchmarkRewrite({ targetPool, ... })    — cost-compare two SELECTs
 */

import crypto from 'node:crypto';
import { log } from './logger.js';
import { isReadOnlySelect } from './sqlReadGuard.js';

type Issue = {
    code: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    detail: string;
    suggestion: string;
};

const ROW_MISMATCH_FACTOR = 10;
const SEQ_SCAN_MIN_ROWS = 50_000;
const NESTED_LOOP_MIN_LOOPS = 1_000;

function walkPlan(node: any, visit: (n: any) => void) {
    if (!node || typeof node !== 'object') return;
    visit(node);
    for (const child of node.Plans ?? node.plans ?? []) walkPlan(child, visit);
}

function rootPlanOf(planJson: any): any | null {
    if (!planJson) return null;
    let p = planJson;
    if (typeof p === 'string') {
        try {
            p = JSON.parse(p);
        } catch {
            return null;
        }
    }
    if (Array.isArray(p)) p = p[0];
    return p?.Plan ?? p?.plan ?? (p?.['Node Type'] ? p : null);
}

/** Detect anti-patterns in one Postgres EXPLAIN (FORMAT JSON) plan. */
export function analyzePlan(planJson: any, durationMs: number | null = null): Issue[] {
    const root = rootPlanOf(planJson);
    if (!root) return [];
    const issues: Issue[] = [];

    walkPlan(root, (n) => {
        const type = n['Node Type'] || '';
        const planRows = Number(n['Plan Rows'] ?? 0);
        const actualRows = n['Actual Rows'] != null ? Number(n['Actual Rows']) : null;
        const loops = n['Actual Loops'] != null ? Number(n['Actual Loops']) : null;
        const relation = n['Relation Name'] ? `"${n['Relation Name']}"` : 'the relation';

        if (type === 'Seq Scan' && (actualRows ?? planRows) >= SEQ_SCAN_MIN_ROWS && n['Filter']) {
            issues.push({
                code: 'SEQ_SCAN_FILTER',
                severity: 'warning',
                title: `Sequential scan with filter on ${relation}`,
                detail: `Seq Scan reads ~${(actualRows ?? planRows).toLocaleString()} rows then filters with ${n['Filter']}.`,
                suggestion: `Consider an index covering the filter predicate ${n['Filter']} on ${relation}.`,
            });
        }

        if (type === 'Nested Loop' && loops != null && loops >= NESTED_LOOP_MIN_LOOPS) {
            issues.push({
                code: 'HOT_NESTED_LOOP',
                severity: 'warning',
                title: `Nested loop executed ${loops.toLocaleString()} times`,
                detail: 'The inner side of this nested loop runs once per outer row.',
                suggestion:
                    'Check that the inner side uses an index; consider a hash join via work_mem or query restructuring.',
            });
        }

        if (actualRows != null && planRows > 0) {
            const ratio = Math.max(actualRows, 1) / planRows;
            if (ratio >= ROW_MISMATCH_FACTOR || ratio <= 1 / ROW_MISMATCH_FACTOR) {
                issues.push({
                    code: 'ESTIMATE_MISMATCH',
                    severity: 'info',
                    title: `Planner estimate off by ${ratio >= 1 ? Math.round(ratio) : Math.round(1 / ratio)}x at ${type}`,
                    detail: `Planned ${planRows.toLocaleString()} rows, got ${actualRows.toLocaleString()}.`,
                    suggestion: `Run ANALYZE on the involved tables; consider extended statistics for correlated columns.`,
                });
            }
        }

        if (type === 'Sort' && String(n['Sort Method'] || '').includes('external')) {
            issues.push({
                code: 'SORT_SPILL',
                severity: 'warning',
                title: 'Sort spilled to disk',
                detail: `Sort Method: ${n['Sort Method']}${n['Sort Space Used'] ? `, ${n['Sort Space Used']} kB` : ''}.`,
                suggestion:
                    'Increase work_mem for this workload or add an index matching the ORDER BY to avoid the sort.',
            });
        }

        if (
            (type === 'Index Scan' || type === 'Index Only Scan') &&
            n['Rows Removed by Filter'] > 0 &&
            actualRows != null
        ) {
            const removed = Number(n['Rows Removed by Filter']);
            if (removed > Math.max(actualRows, 1) * 10) {
                issues.push({
                    code: 'INDEX_FILTER_WASTE',
                    severity: 'info',
                    title: `Index scan on ${relation} discards ${removed.toLocaleString()} rows post-index`,
                    detail: `The index narrows poorly; ${removed.toLocaleString()} rows removed by filter ${n['Filter'] ?? ''}.`,
                    suggestion: `Consider a composite index that includes the filtered column(s).`,
                });
            }
        }
    });

    if (durationMs != null && durationMs > 10_000 && issues.length === 0) {
        issues.push({
            code: 'SLOW_NO_PATTERN',
            severity: 'info',
            title: `Query took ${(durationMs / 1000).toFixed(1)}s with no obvious plan anti-pattern`,
            detail: 'No structural issue detected in the plan.',
            suggestion:
                'Review locking/wait events for this window; the time may be spent waiting rather than executing.',
        });
    }
    return issues;
}

export function statementHash(statement: string): string {
    const normalized = String(statement).replace(/\s+/g, ' ').replace(/\d+/g, 'N').toLowerCase().trim();
    return crypto.createHash('sha1').update(normalized).digest('hex');
}

const worstSeverity = (issues: Issue[]) =>
    issues.some((i) => i.severity === 'critical')
        ? 'critical'
        : issues.some((i) => i.severity === 'warning')
          ? 'warning'
          : 'info';

/** Analyze recent auto_explain events and upsert recommendations. */
export async function runAdvisorSweep({ controlPool, workspaceId = 'default', connectionId = null, hours = 24 }: any) {
    const params: any[] = [workspaceId, String(hours)];
    let connFilter = '';
    if (connectionId) {
        params.push(String(connectionId));
        connFilter = `AND connection_id = $${params.length}`;
    }
    const { rows } = await controlPool.query(
        `SELECT id, statement, duration_ms, plan_json, connection_id
           FROM pgmonitoringtool.auto_explain_events
          WHERE workspace_id = $1
            AND captured_at > now() - ($2 || ' hours')::interval
            AND plan_json IS NOT NULL ${connFilter}
          ORDER BY captured_at DESC
          LIMIT 500`,
        params,
    );

    let created = 0,
        updated = 0;
    for (const ev of rows) {
        const issues = analyzePlan(ev.plan_json, ev.duration_ms == null ? null : Number(ev.duration_ms));
        if (!issues.length) continue;
        const qhash = statementHash(ev.statement);
        const res = await controlPool.query(
            `INSERT INTO pulsedb_query_recommendations
                (workspace_id, connection_id, query_hash, statement, issues, severity, occurrences)
             VALUES ($1, $2, $3, $4, $5, $6, 1)
             ON CONFLICT (workspace_id, query_hash)
             DO UPDATE SET occurrences = pulsedb_query_recommendations.occurrences + 1,
                           last_seen   = now(),
                           issues      = EXCLUDED.issues,
                           severity    = EXCLUDED.severity
             RETURNING (xmax = 0) AS inserted`,
            [
                workspaceId,
                ev.connection_id,
                qhash,
                String(ev.statement).slice(0, 10_000),
                JSON.stringify(issues),
                worstSeverity(issues),
            ],
        );
        if (res.rows[0]?.inserted) created += 1;
        else updated += 1;
    }
    if (created || updated) log('INFO', `query advisor sweep: ${created} new, ${updated} updated`);
    return { scanned: rows.length, created, updated };
}

export async function listRecommendations({ controlPool, workspaceId = 'default', status = 'open', limit = 50 }: any) {
    const { rows } = await controlPool.query(
        `SELECT id, connection_id, query_hash, statement, issues, severity, status,
                occurrences, first_seen, last_seen
           FROM pulsedb_query_recommendations
          WHERE workspace_id = $1 AND ($2::text IS NULL OR status = $2)
          ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
                   occurrences DESC
          LIMIT $3`,
        [workspaceId, status || null, Math.min(Number(limit) || 50, 200)],
    );
    return rows;
}

export async function setRecommendationStatus({ controlPool, id, status, workspaceId = 'default' }: any) {
    if (!['open', 'dismissed', 'applied'].includes(status)) throw new Error(`invalid status '${status}'`);
    // Scope by workspace so a user can't mutate another tenant's rows by id.
    const { rows } = await controlPool.query(
        `UPDATE pulsedb_query_recommendations SET status = $2
          WHERE id = $1 AND workspace_id = $3 RETURNING id, status`,
        [id, status, workspaceId],
    );
    if (!rows.length) throw new Error('recommendation not found');
    return rows[0];
}

/**
 * Cost-compare a proposed rewrite against the original statement.
 * SELECT-only; runs EXPLAIN (optionally ANALYZE) inside a transaction that
 * is always rolled back.
 */
export async function benchmarkRewrite({ targetPool, original, rewrite, analyze = false }: any) {
    for (const [name, sql] of [
        ['original', original],
        ['rewrite', rewrite],
    ] as const) {
        if (!isReadOnlySelect(sql)) {
            throw new Error(`${name} must be a single read-only SELECT statement`);
        }
    }
    const mode = analyze ? 'ANALYZE true, ' : '';
    const client = await targetPool.connect();
    try {
        await client.query('BEGIN');
        // Cap execution so a hostile/expensive query (e.g. pg_sleep, cartesian
        // join) can't pin a DB connection. Transaction-local; rolled back below.
        await client.query("SET LOCAL statement_timeout = '15s'");
        const a = await client.query(`EXPLAIN (${mode}FORMAT JSON) ${original}`);
        const b = await client.query(`EXPLAIN (${mode}FORMAT JSON) ${rewrite}`);
        await client.query('ROLLBACK');
        const cost = (r: any) => {
            const plan = rootPlanOf(r.rows?.[0]?.['QUERY PLAN']);
            return {
                totalCost: Number(plan?.['Total Cost'] ?? 0),
                actualMs: plan?.['Actual Total Time'] != null ? Number(plan['Actual Total Time']) : null,
            };
        };
        const orig = cost(a),
            rew = cost(b);
        const basis =
            orig.actualMs != null && rew.actualMs != null
                ? { metric: 'actual ms', before: orig.actualMs, after: rew.actualMs }
                : { metric: 'planner cost', before: orig.totalCost, after: rew.totalCost };
        return {
            original: orig,
            rewrite: rew,
            improvement: basis.before > 0 ? Math.round((1 - basis.after / basis.before) * 1000) / 10 : 0,
            basis: basis.metric,
        };
    } catch (e) {
        try {
            await client.query('ROLLBACK');
        } catch {
            /* already aborted */
        }
        throw e;
    } finally {
        client.release();
    }
}
