// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/workbookService.js
 *
 * B3 — Query-rewrite workbench. Capture EXPLAIN (ANALYZE, BUFFERS, FORMAT
 * JSON) for a baseline query and one or more rewrite variants, then store
 * them side-by-side so the operator can compare.
 *
 * Safety: every executed statement passes through copilotService.isSafeToRun
 * before reaching the monitored DB. Variants that mutate data are rejected.
 *
 * Public surface:
 *   createWorkbook({ workspaceId, userId, connectionId, baseQuery, description })
 *   addVariant({ workbookId, label, sql })
 *   runVariants({ workbookId, getPool, workspaceId })
 *   listWorkbooks({ workspaceId })
 *   getWorkbook({ workbookId, workspaceId })
 */

import { query } from '../db.js';
import { isSafeToRun } from './copilotService.js';

function log(level, msg, meta = {}) {
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg, component: 'workbookService', ...meta }));
}

export async function createWorkbook({ workspaceId, userId, connectionId, baseQuery, description }) {
    if (!workspaceId) throw new Error('workspaceId required');
    if (!connectionId) throw new Error('connectionId required');
    if (!baseQuery || typeof baseQuery !== 'string') throw new Error('baseQuery required');
    const safety = isSafeToRun(baseQuery);
    if (!safety.safe) {
        const err = new Error(`baseQuery rejected: ${safety.reason || 'unsafe'}`);
        err.code = 'UNSAFE_QUERY';
        throw err;
    }
    const { rows } = await query(
        `INSERT INTO pgmonitoringtool.workbooks
            (workspace_id, created_by, connection_id, description, base_query)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, created_at`,
        [workspaceId, userId ?? null, connectionId, description ?? null, baseQuery]
    );
    return rows[0];
}

export async function addVariant({ workbookId, label, sql }) {
    if (!workbookId) throw new Error('workbookId required');
    if (!label || !sql) throw new Error('label and sql required');
    const safety = isSafeToRun(sql);
    if (!safety.safe) {
        const err = new Error(`variant rejected: ${safety.reason || 'unsafe'}`);
        err.code = 'UNSAFE_QUERY';
        throw err;
    }
    const { rows } = await query(
        `INSERT INTO pgmonitoringtool.workbook_variants
            (workbook_id, label, sql)
         VALUES ($1, $2, $3) RETURNING id, created_at`,
        [workbookId, label, sql]
    );
    return rows[0];
}

export async function listWorkbooks({ workspaceId }) {
    const { rows } = await query(
        `SELECT id, connection_id, description, base_query, created_at
           FROM pgmonitoringtool.workbooks
          WHERE workspace_id = $1
          ORDER BY created_at DESC`,
        [workspaceId]
    );
    return rows;
}

export async function getWorkbook({ workbookId, workspaceId }) {
    const wb = await query(
        `SELECT id, workspace_id, connection_id, description, base_query, created_at
           FROM pgmonitoringtool.workbooks WHERE id = $1 AND workspace_id = $2`,
        [workbookId, workspaceId]
    );
    if (wb.rows.length === 0) return null;
    const variants = await query(
        `SELECT id, label, sql, created_at FROM pgmonitoringtool.workbook_variants
          WHERE workbook_id = $1 ORDER BY id ASC`, [workbookId]
    );
    const runs = await query(
        `SELECT id, variant_id, ran_at, duration_ms, plan_json, error
           FROM pgmonitoringtool.workbook_runs
          WHERE workbook_id = $1
          ORDER BY ran_at DESC LIMIT 200`, [workbookId]
    );
    return { ...wb.rows[0], variants: variants.rows, runs: runs.rows };
}

/**
 * Run baseline + every variant in sequence (not in parallel — we want
 * comparable wall-clock numbers without cache effects from concurrent
 * statements on the same backend).
 */
export async function runVariants({ workbookId, workspaceId, getPool }) {
    const wb = await getWorkbook({ workbookId, workspaceId });
    if (!wb) throw new Error('workbook not found');
    const pool = typeof getPool === 'function' ? await getPool(wb.connection_id) : null;
    if (!pool) throw new Error('connection pool unavailable');

    const runs = [];
    const all = [{ id: null, sql: wb.base_query, label: 'baseline' }, ...wb.variants];

    for (const v of all) {
        const safety = isSafeToRun(v.sql);
        if (!safety.safe) {
            runs.push({ variantId: v.id, error: safety.reason || 'unsafe' });
            continue;
        }
        const t0 = Date.now();
        try {
            const r = await pool.query({
                text: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${v.sql}`,
            });
            const duration = Date.now() - t0;
            const planJson = r.rows[0] && (r.rows[0]['QUERY PLAN'] || r.rows[0].query_plan || r.rows[0]);
            const ins = await query(
                `INSERT INTO pgmonitoringtool.workbook_runs
                    (workbook_id, variant_id, duration_ms, plan_json)
                 VALUES ($1, $2, $3, $4) RETURNING id, ran_at`,
                [workbookId, v.id, duration, planJson]
            );
            runs.push({ runId: ins.rows[0].id, variantId: v.id, durationMs: duration, plan: planJson });
        } catch (err) {
            const ins = await query(
                `INSERT INTO pgmonitoringtool.workbook_runs
                    (workbook_id, variant_id, error)
                 VALUES ($1, $2, $3) RETURNING id`,
                [workbookId, v.id, String(err.message).slice(0, 1000)]
            ).catch((e) => {
                log('WARN', 'Failed to persist variant-error row', {
                    workbookId, variantId: v.id, error: e?.message,
                });
                return null;
            });
            log('WARN', 'Variant failed', { workbookId, variantId: v.id, error: err.message });
            runs.push({ runId: ins?.rows[0]?.id, variantId: v.id, error: err.message });
        }
    }
    return { workbookId, runs };
}
