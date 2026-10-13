// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Extracted from server.ts.

import { authenticate } from '../../core/auth.js';
import { reqPool } from '../../core/connectionPools.js';
import { cached } from '../../core/responseCache.js';
import { log } from '../../services/logger.js';

export default function registerResourceRoutes(app) {
    // ─────────────────────────────────────────────────────────────────────────────
    // RESOURCES ROUTES
    // ─────────────────────────────────────────────────────────────────────────────

    app.get('/api/resources/growth', authenticate, cached('res:growth', 60_000), async (req, res) => {
        try {
            const _p = await reqPool(req);
            const r = await _p.query(`
            SELECT
                c.relname AS table_name,
                pg_total_relation_size(c.oid) / 1073741824.0 AS total_size_gb,
                pg_relation_size(c.oid) / 1073741824.0 AS table_size_gb,
                pg_indexes_size(c.oid) / 1073741824.0 AS index_size_gb,
                COALESCE(pg_total_relation_size(c.reltoastrelid) / 1073741824.0, 0) AS toast_size_gb,
                s.n_live_tup AS row_count,
                s.seq_scan,
                s.idx_scan,
                CASE WHEN s.n_live_tup > 0
                    THEN round(((s.n_ins_since_vacuum - s.n_tup_del)::numeric / NULLIF(s.n_live_tup, 0) * 100), 1)
                    ELSE 0 END AS growth_rate
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
            WHERE c.relkind = 'r'
              AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
            ORDER BY pg_total_relation_size(c.oid) DESC
            LIMIT 50
        `);
            res.json(
                r.rows.map((row) => ({
                    ...row,
                    total_size_gb: parseFloat(row.total_size_gb || 0).toFixed(3),
                    index_size_gb: parseFloat(row.index_size_gb || 0).toFixed(3),
                    toast_size_gb: parseFloat(row.toast_size_gb || 0).toFixed(3),
                    row_count: parseInt(row.row_count || 0),
                    seq_scan: parseInt(row.seq_scan || 0),
                    idx_scan: parseInt(row.idx_scan || 0),
                    growth_rate: parseFloat(row.growth_rate || 0).toFixed(1),
                })),
            );
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({});
        }
    });

    app.get('/api/resources/disk-io', authenticate, cached('res:diskio', 15_000), async (req, res) => {
        try {
            const _p = await reqPool(req);
            const r = await _p.query(`
            SELECT
                relname AS table_name,
                heap_blks_read,
                heap_blks_hit,
                idx_blks_read,
                idx_blks_hit,
                toast_blks_read,
                toast_blks_hit,
                tidx_blks_read,
                tidx_blks_hit,
                CASE WHEN (heap_blks_read + heap_blks_hit) > 0
                    THEN round(100.0 * heap_blks_hit / (heap_blks_read + heap_blks_hit), 1)
                    ELSE 100 END AS cache_hit_ratio
            FROM pg_statio_user_tables
            ORDER BY (heap_blks_read + idx_blks_read) DESC
            LIMIT 30
        `);
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    app.get('/api/resources/growth-trend', authenticate, cached('res:trend', 120_000), async (req, res) => {
        try {
            const _p = await reqPool(req);
            // Use pg_stat_user_tables for live trend approximation
            const r = await _p.query(`
            SELECT
                relname AS table_name,
                n_live_tup AS live_rows,
                n_dead_tup AS dead_rows,
                n_tup_ins AS total_inserts,
                n_tup_upd AS total_updates,
                n_tup_del AS total_deletes,
                n_ins_since_vacuum AS inserts_since_vacuum,
                last_autovacuum,
                last_autoanalyze,
                pg_total_relation_size(relid) / 1048576.0 AS size_mb
            FROM pg_stat_user_tables
            ORDER BY n_live_tup DESC
            LIMIT 20
        `);
            // Build a simulated time-series from current snapshot for each table
            const now = Date.now();
            const trend = r.rows.map((t) => ({
                table_name: t.table_name,
                size_mb: parseFloat(t.size_mb || 0).toFixed(2),
                live_rows: parseInt(t.live_rows || 0),
                dead_rows: parseInt(t.dead_rows || 0),
                total_inserts: parseInt(t.total_inserts || 0),
                total_updates: parseInt(t.total_updates || 0),
                total_deletes: parseInt(t.total_deletes || 0),
                inserts_since_vacuum: parseInt(t.inserts_since_vacuum || 0),
                last_autovacuum: t.last_autovacuum,
                last_autoanalyze: t.last_autoanalyze,
            }));
            res.json(trend);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({});
        }
    });

    app.get('/api/resources/vacuum-status', authenticate, cached('res:vacuum', 30_000), async (req, res) => {
        try {
            const _p = await reqPool(req);
            const r = await _p.query(`
            SELECT
                relname AS table_name,
                n_dead_tup,
                n_live_tup,
                CASE WHEN (n_live_tup + n_dead_tup) > 0
                    THEN round(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2)
                    ELSE 0 END AS bloat_ratio_pct,
                last_autovacuum,
                last_autoanalyze,
                last_vacuum,
                last_analyze,
                autovacuum_count,
                n_ins_since_vacuum
            FROM pg_stat_user_tables
            WHERE n_dead_tup > 0 OR last_autovacuum IS NOT NULL
            ORDER BY bloat_ratio_pct DESC NULLS LAST
            LIMIT 50
        `);
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    app.get('/api/resources/maintenance-logs', authenticate, cached('res:maint', 30_000), async (req, res) => {
        try {
            const _p = await reqPool(req);
            // Combine vacuum and analyze history from pg_stat_user_tables
            const r = await _p.query(`
            SELECT
                relname AS "table",
                'AUTOVACUUM' AS action,
                last_autovacuum AS date,
                n_dead_tup AS dead_rows_cleaned,
                autovacuum_count AS run_count
            FROM pg_stat_user_tables
            WHERE last_autovacuum IS NOT NULL
            UNION ALL
            SELECT
                relname AS "table",
                'AUTOANALYZE' AS action,
                last_autoanalyze AS date,
                0 AS dead_rows_cleaned,
                autoanalyze_count AS run_count
            FROM pg_stat_user_tables
            WHERE last_autoanalyze IS NOT NULL
            ORDER BY date DESC NULLS LAST
            LIMIT 50
        `);
            res.json(
                r.rows.map((row, i) => ({
                    id: i + 1,
                    table: row.table,
                    action: row.action,
                    date: row.date ? new Date(row.date).toISOString() : null,
                    dead_rows_cleaned: parseInt(row.dead_rows_cleaned || 0),
                    run_count: parseInt(row.run_count || 0),
                    status: 'completed',
                })),
            );
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({});
        }
    });
}
