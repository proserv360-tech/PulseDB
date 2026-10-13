// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/explainService.js
 * ──────────────────────────
 * Capture, normalize, store, and diff query plans for PostgreSQL,
 * MySQL, and MongoDB. Plans are stored as JSONB in the `query_plans`
 * table; SQL is fingerprinted so plans for semantically-equivalent
 * queries cluster together.
 *
 * Postgres:
 *   EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS, FORMAT JSON) <sql>
 *
 * MySQL:
 *   EXPLAIN FORMAT=JSON <sql>
 *
 * MongoDB:
 *   db.collection.explain('executionStats').find/aggregate(…)
 */

import crypto from 'node:crypto';
import { query as controlQuery } from '../db.js';

// ─────────────────────────────────────────────────────────────────────────────
// Safety: these prefixes must be rejected before we ANALYZE.
// EXPLAIN ANALYZE *executes* the query; we do not want to run mutations.
// Even a plain EXPLAIN (no ANALYZE) is not entirely safe — a malicious query
// can still trigger side effects via volatile functions, so we apply the
// same allowlist to both Postgres and MySQL EXPLAIN paths.
// ─────────────────────────────────────────────────────────────────────────────
const MUTATION_RE =
    /\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|CREATE|ALTER|GRANT|REVOKE|CALL|DO|COPY|EXECUTE|REPLACE|RENAME|LOAD|LOCK)\b/i;

const MAX_EXPLAIN_SQL = 16_000;

export function isSafeForAnalyze(sql) {
    return !MUTATION_RE.test(sql);
}

/**
 * Throw if the given SQL is unsuitable for EXPLAIN: empty, too long,
 * contains mutation keywords, or contains a semicolon (we don't allow
 * multi-statement EXPLAIN — the second statement would execute unchecked).
 * Caller is expected to be a request handler that translates the thrown
 * Error's `status` into an HTTP response.
 */
function assertExplainSafe(sql) {
    if (!sql || typeof sql !== 'string') {
        const err = new Error('sql is required');
        err.status = 400;
        throw err;
    }
    if (sql.length > MAX_EXPLAIN_SQL) {
        const err = new Error(`sql too long (max ${MAX_EXPLAIN_SQL} characters)`);
        err.status = 400;
        throw err;
    }
    // Strip comments first so they can't hide mutations or extra statements.
    const stripped = sql
        .replace(/--[^\n]*/g, ' ')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/#[^\n]*/g, ' ')
        .trim();
    if (!stripped) {
        const err = new Error('sql is empty after stripping comments');
        err.status = 400;
        throw err;
    }
    if (/;/.test(stripped.replace(/;$/, ''))) {
        const err = new Error('multi-statement EXPLAIN is not allowed');
        err.status = 400;
        throw err;
    }
    if (!isSafeForAnalyze(stripped)) {
        const err = new Error('Refusing to EXPLAIN a mutating statement');
        err.status = 400;
        throw err;
    }
}

/**
 * SHA-256 fingerprint of a SQL statement after normalizing whitespace, case,
 * and bind-value placeholders. Good enough to cluster plans across runs.
 */
export function fingerprintSql(sql) {
    const normalized = sql
        .replace(/\s+/g, ' ')
        .replace(/'[^']*'/g, '?')            // string literals
        .replace(/\b\d+\b/g, '?')            // numeric literals
        .replace(/\$\d+/g, '?')              // $1, $2 placeholders
        .trim()
        .toLowerCase();
    return crypto.createHash('sha256').update(normalized).digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// Capture
// ─────────────────────────────────────────────────────────────────────────────

export async function capturePostgresPlan({ client, sql, analyze = false }) {
    // Reject mutating/multi-statement SQL up front. EXPLAIN ANALYZE actually
    // executes the query, and even plain EXPLAIN can have side effects via
    // volatile functions, so we apply the allowlist to both.
    assertExplainSafe(sql);

    const prefix = analyze
        ? 'EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS, FORMAT JSON) '
        : 'EXPLAIN (VERBOSE, SETTINGS, FORMAT JSON) ';
    const started = Date.now();
    // Wrap in a READ ONLY transaction with a hard statement timeout so a
    // pathological query (e.g. EXPLAIN ANALYZE of a slow SELECT) cannot pin
    // the connection indefinitely. Postgres enforces READ ONLY even against
    // statements that slipped past the regex allowlist above.
    await client.query('BEGIN TRANSACTION READ ONLY');
    let result;
    try {
        await client.query('SET LOCAL statement_timeout = 15000');
        result = await client.query(prefix + sql);
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
    }
    const elapsed = Date.now() - started;
    const row = result.rows[0] || {};
    const plan = row['QUERY PLAN'] || row.query_plan || result.rows;
    return { plan: Array.isArray(plan) ? plan[0] : plan, elapsedMs: elapsed };
}

export async function captureMysqlPlan({ connection, sql }) {
    // Same allowlist as Postgres — MySQL EXPLAIN has historically run
    // subqueries in materialized form, so refusing mutations matters here too.
    assertExplainSafe(sql);

    // Per-statement timeout via MAX_EXECUTION_TIME hint (MySQL 5.7+, MariaDB
    // ignores the hint silently, which is fine — the worst case is the same
    // as before the fix).
    const wrapped = `EXPLAIN FORMAT=JSON /*+ MAX_EXECUTION_TIME(15000) */ ${sql}`;
    const [rows] = await connection.query(wrapped);
    const raw = rows?.[0]?.EXPLAIN || rows?.[0]?.explain || rows?.[0];
    const plan = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return { plan };
}

export async function captureMongoPlan({ db, collection, operation, pipelineOrFilter }) {
    const col = db.collection(collection);
    let plan;
    if (operation === 'aggregate') {
        plan = await col.aggregate(pipelineOrFilter).explain('executionStats');
    } else {
        plan = await col.find(pipelineOrFilter || {}).explain('executionStats');
    }
    return { plan };
}

// ─────────────────────────────────────────────────────────────────────────────
// Persist
// ─────────────────────────────────────────────────────────────────────────────

export async function storePlan({
    connectionId,
    workspaceId,
    engine,
    sql,
    plan,
    elapsedMs,
    rowsReturned,
    capturedBy,
}) {
    const fp = fingerprintSql(sql);
    const { rows } = await controlQuery(
        `INSERT INTO pgmonitoringtool.query_plans
            (connection_id, workspace_id, engine, sql_fingerprint, sql_text,
             plan_json, execution_ms, rows_returned, captured_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id, captured_at`,
        [
            connectionId,
            workspaceId || null,
            engine,
            fp,
            sql,
            plan,
            elapsedMs || null,
            rowsReturned || null,
            capturedBy || null,
        ]
    );
    return { id: rows[0].id, fingerprint: fp, capturedAt: rows[0].captured_at };
}

// ─────────────────────────────────────────────────────────────────────────────
// History + diff
// ─────────────────────────────────────────────────────────────────────────────

export async function listPlansForFingerprint(fingerprint, limit = 20) {
    const { rows } = await controlQuery(
        `SELECT id, connection_id, engine, execution_ms, rows_returned,
                captured_at, captured_by
           FROM pgmonitoringtool.query_plans
          WHERE sql_fingerprint = $1
          ORDER BY captured_at DESC
          LIMIT $2`,
        [fingerprint, limit]
    );
    return rows;
}

export async function getPlan(id) {
    const { rows } = await controlQuery(
        `SELECT id, connection_id, workspace_id, engine, sql_fingerprint,
                sql_text, plan_json, execution_ms, rows_returned, captured_at
           FROM pgmonitoringtool.query_plans
          WHERE id = $1`,
        [id]
    );
    return rows[0] || null;
}

/**
 * Walk a Postgres plan tree and produce a flat list of nodes with
 * { id, nodeType, relation, cost, rows, actualTime, loops }.
 * Used by the React visualizer for summary cards and diffing.
 */
export function flattenPostgresPlan(plan) {
    const root = plan?.Plan || plan;
    const out = [];
    function walk(node, depth = 0, id = '0') {
        if (!node) return;
        out.push({
            id,
            depth,
            nodeType: node['Node Type'],
            relation: node['Relation Name'] || node['Index Name'] || null,
            startupCost: node['Startup Cost'],
            totalCost: node['Total Cost'],
            planRows: node['Plan Rows'],
            actualRows: node['Actual Rows'],
            actualTotalTime: node['Actual Total Time'],
            loops: node['Actual Loops'],
            parallelAware: node['Parallel Aware'],
            sharedHit: node['Shared Hit Blocks'],
            sharedRead: node['Shared Read Blocks'],
        });
        (node.Plans || []).forEach((c, i) => walk(c, depth + 1, `${id}.${i}`));
    }
    walk(root);
    return out;
}

/**
 * Diff two plans node-by-node (by id path). Detects changes in nodeType,
 * rows, and total cost — the most actionable signals for regression.
 */
export function diffPostgresPlans(planA, planB) {
    const a = new Map(flattenPostgresPlan(planA).map(n => [n.id, n]));
    const b = new Map(flattenPostgresPlan(planB).map(n => [n.id, n]));
    const ids = new Set([...a.keys(), ...b.keys()]);
    const changes = [];
    for (const id of ids) {
        const x = a.get(id);
        const y = b.get(id);
        if (!x) { changes.push({ id, kind: 'added', node: y }); continue; }
        if (!y) { changes.push({ id, kind: 'removed', node: x }); continue; }
        const diffs = {};
        if (x.nodeType !== y.nodeType) diffs.nodeType = [x.nodeType, y.nodeType];
        if (pctChange(x.actualRows, y.actualRows) > 0.25) {
            diffs.actualRows = [x.actualRows, y.actualRows];
        }
        if (pctChange(x.totalCost, y.totalCost) > 0.25) {
            diffs.totalCost = [x.totalCost, y.totalCost];
        }
        if (pctChange(x.actualTotalTime, y.actualTotalTime) > 0.25) {
            diffs.actualTotalTime = [x.actualTotalTime, y.actualTotalTime];
        }
        if (Object.keys(diffs).length) {
            changes.push({ id, kind: 'changed', diffs });
        }
    }
    return changes;
}

function pctChange(a, b) {
    const na = Number(a) || 0;
    const nb = Number(b) || 0;
    if (na === 0 && nb === 0) return 0;
    const denom = Math.max(Math.abs(na), 1);
    return Math.abs(nb - na) / denom;
}
