// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Extracted from server.ts.

import { pool } from '../../core/adminPool.js';
import { authenticate } from '../../core/auth.js';
import { CONFIG } from '../../core/config.js';
import { reqPool } from '../../core/connectionPools.js';
import { cached } from '../../core/responseCache.js';
import { log } from '../../services/logger.js';

export default function registerIndexRoutes(app) {
    // ─────────────────────────────────────────────────────────────────────────────
    // INDEX INTELLIGENCE — live data for IndexesTab
    // ─────────────────────────────────────────────────────────────────────────────

    // Health summary: hit ratio, total count, wasted space, seq-scan rate, critical count
    app.get('/api/indexes/health', authenticate, cached('idx:health', CONFIG.CACHE_TTL.INDEXES), async (req, res) => {
        try {
            const pool = await reqPool(req);
            const [hitQ, cntQ, unusedQ, seqQ] = await Promise.all([
                // index hit ratio (buffer cache)
                pool.query(`
                SELECT round(
                    100.0 * sum(idx_blks_hit) / NULLIF(sum(idx_blks_hit) + sum(idx_blks_read), 0),
                2) AS hit_ratio
                FROM pg_statio_user_indexes
            `),
                // total index count + total index size
                pool.query(`
                SELECT count(*)::int AS total_indexes,
                       pg_size_pretty(sum(pg_relation_size(indexrelid))) AS total_size,
                       sum(pg_relation_size(indexrelid)) AS total_bytes
                FROM pg_stat_user_indexes
            `),
                // unused indexes → critical count (idx_scan = 0, non-PK)
                pool.query(`
                SELECT count(*)::int AS unused_count
                FROM pg_stat_user_indexes ui
                JOIN pg_index i ON i.indexrelid = ui.indexrelid
                WHERE ui.idx_scan = 0 AND NOT i.indisprimary
            `),
                // seq scan rate: % of total scans that are seq (not index)
                pool.query(`
                SELECT round(
                    100.0 * sum(seq_scan) / NULLIF(sum(seq_scan) + sum(idx_scan), 0),
                1) AS seq_scan_rate
                FROM pg_stat_user_tables
            `),
            ]);
            const h = hitQ.rows[0];
            const c = cntQ.rows[0];
            const u = unusedQ.rows[0];
            const s = seqQ.rows[0];
            res.json({
                hitRatio: parseFloat(h.hit_ratio || 0),
                totalIndexes: c.total_indexes,
                totalSize: c.total_size,
                totalBytes: parseInt(c.total_bytes || 0),
                criticalCount: u.unused_count,
                seqScanRate: parseFloat(s.seq_scan_rate || 0),
            });
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({ hitRatio: 0, totalIndexes: 0, totalSize: '—', totalBytes: 0, criticalCount: 0, seqScanRate: 0 });
        }
    });

    // Missing indexes: tables with high seq scans and no covering index
    app.get('/api/indexes/missing', authenticate, cached('idx:missing', CONFIG.CACHE_TTL.INDEXES), async (req, res) => {
        try {
            const pool = await reqPool(req);
            const r = await pool.query(
                `
            SELECT
                s.schemaname                                        AS schema,
                s.relname                                           AS "table",
                s.seq_scan,
                s.seq_tup_read,
                s.idx_scan,
                pg_size_pretty(pg_total_relation_size(s.relid))     AS "tableSize",
                pg_total_relation_size(s.relid)                     AS "tableSizeBytes",
                CASE
                    WHEN s.seq_scan > 100000 THEN 'critical'
                    WHEN s.seq_scan > 10000  THEN 'high'
                    WHEN s.seq_scan > 1000   THEN 'medium'
                    ELSE 'low'
                END                                                 AS severity
            FROM pg_stat_user_tables s
            WHERE s.seq_scan > 500
              AND s.schemaname NOT IN ('pg_catalog', 'information_schema')
              ${req.query.schema ? 'AND s.schemaname = $1' : ''}
            ORDER BY s.seq_scan DESC
            LIMIT 20
        `,
                req.query.schema ? [String(req.query.schema)] : [],
            );
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    // Unused indexes: never scanned since stats reset, non-primary
    app.get('/api/indexes/unused', authenticate, cached('idx:unused', CONFIG.CACHE_TTL.INDEXES), async (req, res) => {
        try {
            const pool = await reqPool(req);
            const r = await pool.query(
                `
            SELECT
                ui.schemaname                                           AS schema,
                ui.relname                                              AS "table",
                ui.indexrelname                                         AS "indexName",
                ui.idx_scan                                             AS scans,
                pg_size_pretty(pg_relation_size(ui.indexrelid))         AS size,
                pg_relation_size(ui.indexrelid)                         AS "sizeBytes",
                pg_get_indexdef(ui.indexrelid)                          AS definition,
                i.indisunique                                           AS "isUnique"
            FROM pg_stat_user_indexes ui
            JOIN pg_index i ON i.indexrelid = ui.indexrelid
            WHERE ui.idx_scan < 5
              AND NOT i.indisprimary
              AND pg_relation_size(ui.indexrelid) > 0
              AND ui.schemaname NOT IN ('pg_catalog', 'information_schema')
              ${req.query.schema ? 'AND ui.schemaname = $1' : ''}
            ORDER BY pg_relation_size(ui.indexrelid) DESC
            LIMIT 30
        `,
                req.query.schema ? [String(req.query.schema)] : [],
            );
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    // Duplicate / redundant indexes: indexes whose column sets are subsets of other indexes on the same table
    app.get(
        '/api/indexes/duplicates',
        authenticate,
        cached('idx:dupes', CONFIG.CACHE_TTL.INDEXES),
        async (req, res) => {
            try {
                const pool = await reqPool(req);
                const r = await pool.query(
                    `
            SELECT
                a.schemaname                                            AS schema,
                a.tablename                                             AS "table",
                a.indexname                                             AS "indexName",
                a.indexdef                                              AS definition,
                b.indexname                                             AS "shadowedBy",
                pg_size_pretty(pg_relation_size(ua.indexrelid))         AS "wastedSpace",
                pg_relation_size(ua.indexrelid)                         AS "wastedBytes",
                us.idx_scan                                             AS writes
            FROM pg_indexes a
            JOIN pg_indexes b
              ON  a.schemaname = b.schemaname
              AND a.tablename  = b.tablename
              AND a.indexname <> b.indexname
              AND position(regexp_replace(a.indexdef, '.* USING \\w+ ', '') IN
                           regexp_replace(b.indexdef, '.* USING \\w+ ', '')) > 0
            JOIN pg_stat_user_indexes ua ON ua.indexrelname = a.indexname AND ua.schemaname = a.schemaname
            JOIN pg_stat_user_indexes us ON us.indexrelname = a.indexname AND us.schemaname = a.schemaname
            WHERE a.schemaname NOT IN ('pg_catalog', 'information_schema')
              ${req.query.schema ? 'AND a.schemaname = $1' : ''}
            ORDER BY pg_relation_size(ua.indexrelid) DESC
            LIMIT 20
        `,
                    req.query.schema ? [String(req.query.schema)] : [],
                );
                res.json(r.rows);
            } catch (e) {
                log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
                res.json([]);
            }
        },
    );

    // Bloated indexes: high inefficiency + large size
    app.get('/api/indexes/bloat', authenticate, cached('idx:bloat', CONFIG.CACHE_TTL.BLOAT), async (req, res) => {
        try {
            const pool = await reqPool(req);
            const r = await pool.query(
                `
            SELECT
                s.schemaname                                            AS schema,
                s.relname                                               AS "table",
                s.indexrelname                                          AS "indexName",
                pg_size_pretty(pg_relation_size(s.indexrelid))          AS size,
                pg_relation_size(s.indexrelid)                          AS "sizeBytes",
                s.idx_scan,
                s.idx_tup_read,
                s.idx_tup_fetch,
                CASE
                    WHEN s.idx_scan = 0 THEN 100
                    WHEN s.idx_tup_read = 0 THEN 0
                    ELSE round((1.0 - s.idx_tup_fetch::numeric / NULLIF(s.idx_tup_read,0)) * 100, 1)
                END                                                     AS "bloatPct",
                CASE
                    WHEN s.idx_scan = 0 THEN 'critical'
                    WHEN round((1.0 - s.idx_tup_fetch::numeric / NULLIF(s.idx_tup_read,0)) * 100, 1) > 50 THEN 'high'
                    WHEN round((1.0 - s.idx_tup_fetch::numeric / NULLIF(s.idx_tup_read,0)) * 100, 1) > 20 THEN 'medium'
                    ELSE 'low'
                END                                                     AS severity,
                pg_get_indexdef(s.indexrelid)                           AS definition
            FROM pg_stat_user_indexes s
            JOIN pg_index i ON i.indexrelid = s.indexrelid
            WHERE NOT i.indisprimary
              AND pg_relation_size(s.indexrelid) > 1048576
              AND (
                  s.idx_scan = 0
                  OR (s.idx_tup_read > 0 AND
                      round((1.0 - s.idx_tup_fetch::numeric / NULLIF(s.idx_tup_read,0)) * 100, 1) > 20)
              )
              AND s.schemaname NOT IN ('pg_catalog', 'information_schema')
              ${req.query.schema ? 'AND s.schemaname = $1' : ''}
            ORDER BY pg_relation_size(s.indexrelid) DESC
            LIMIT 30
        `,
                req.query.schema ? [String(req.query.schema)] : [],
            );
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });
}
