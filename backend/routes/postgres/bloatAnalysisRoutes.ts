// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Extracted from server.ts.

import { authenticate } from '../../core/auth.js';
import { CONFIG } from '../../core/config.js';
import { reqPool } from '../../core/connectionPools.js';
import { cached } from '../../core/responseCache.js';
import { log } from '../../services/logger.js';

export default function registerBloatAnalysisRoutes(app) {
    // ─────────────────────────────────────────────────────────────────────────────
    // BLOAT ANALYSIS
    // ─────────────────────────────────────────────────────────────────────────────
    app.get('/api/bloat/tables', authenticate, cached('bloat:tables', CONFIG.CACHE_TTL.BLOAT), async (req, res) => {
        try {
            const r = await (
                await reqPool(req)
            ).query(`
            WITH stats AS (
                SELECT
                    schemaname,
                    relname                                                                              AS tablename,
                    pg_total_relation_size(relid)                                                       AS total_bytes,
                    pg_relation_size(relid)                                                             AS table_bytes,
                    pg_indexes_size(relid)                                                              AS index_bytes,
                    n_dead_tup,
                    n_live_tup,
                    CASE WHEN (n_live_tup + n_dead_tup) > 0
                             THEN round(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2)
                         ELSE 0
                        END                                                                                 AS dead_pct,
                    last_vacuum,
                    last_autovacuum,
                    n_mod_since_analyze
                FROM pg_stat_user_tables
            )
            SELECT
                schemaname,
                tablename,
                total_bytes,
                table_bytes,
                index_bytes,
                n_dead_tup,
                n_live_tup,
                dead_pct,
                last_vacuum,
                last_autovacuum,
                n_mod_since_analyze,
                pg_size_pretty(total_bytes)                                                             AS total_size,
                pg_size_pretty(table_bytes)                                                             AS table_size,
                pg_size_pretty(index_bytes)                                                             AS index_size,
                pg_size_pretty((dead_pct / 100.0 * table_bytes)::bigint)                               AS estimated_bloat_size
            FROM stats
            WHERE total_bytes > 8192
            ORDER BY dead_pct DESC, total_bytes DESC
                LIMIT 100
        `);
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    app.get('/api/bloat/indexes', authenticate, cached('bloat:indexes', CONFIG.CACHE_TTL.BLOAT), async (req, res) => {
        try {
            const r = await (
                await reqPool(req)
            ).query(`
            SELECT
                s.schemaname,
                s.relname                                                                               AS tablename,
                s.indexrelname                                                                          AS indexname,
                pg_size_pretty(pg_relation_size(s.indexrelid))                                         AS index_size,
                pg_relation_size(s.indexrelid)                                                         AS index_bytes,
                s.idx_scan,
                s.idx_tup_read,
                s.idx_tup_fetch,
                CASE
                    WHEN s.idx_scan    = 0 THEN 100
                    WHEN s.idx_tup_read = 0 THEN 0
                    ELSE round((1.0 - s.idx_tup_fetch::numeric / s.idx_tup_read) * 100, 1)
                    END                                                                                     AS inefficiency_pct,
                pg_get_indexdef(s.indexrelid)                                                           AS index_def
            FROM pg_stat_user_indexes s
                     JOIN pg_index i ON i.indexrelid = s.indexrelid
            WHERE NOT i.indisprimary
            ORDER BY pg_relation_size(s.indexrelid) DESC
                LIMIT 80
        `);
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    app.get('/api/bloat/summary', authenticate, cached('bloat:summary', CONFIG.CACHE_TTL.BLOAT), async (req, res) => {
        try {
            const r = await (
                await reqPool(req)
            ).query(`
            SELECT
                count(*)                                                                                AS total_tables,
                count(*) FILTER (WHERE
                    (n_live_tup + n_dead_tup) > 0
                    AND (100.0 * n_dead_tup / (n_live_tup + n_dead_tup)) > 10
                )                                                                                       AS high_bloat_tables,
                count(*) FILTER (WHERE
                    (n_live_tup + n_dead_tup) > 0
                    AND (100.0 * n_dead_tup / (n_live_tup + n_dead_tup)) > 20
                )                                                                                       AS critical_bloat_tables,
                pg_size_pretty(
                        sum(pg_total_relation_size(relid))
                )                                                                                       AS total_db_size,
                sum(pg_total_relation_size(relid))                                                      AS total_bytes,
                round(
                        avg(
                                CASE WHEN (n_live_tup + n_dead_tup) > 0
                                         THEN 100.0 * n_dead_tup / (n_live_tup + n_dead_tup)
                                     ELSE 0
                                    END
                        ), 2
                )                                                                                       AS avg_dead_pct,
                sum(n_dead_tup)                                                                         AS total_dead_tuples,
                sum(n_live_tup)                                                                         AS total_live_tuples
            FROM pg_stat_user_tables
        `);
            res.json(r.rows[0] || {});
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({});
        }
    });
}
