// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Extracted from server.ts.

import { authenticate } from '../../core/auth.js';
import { CONFIG } from '../../core/config.js';
import { reqPool } from '../../core/connectionPools.js';
import { cached } from '../../core/responseCache.js';
import { log } from '../../services/logger.js';

export default function registerTableRoutes(app) {
    // ─────────────────────────────────────────────────────────────────────────────
    // TABLE ANALYTICS
    // ─────────────────────────────────────────────────────────────────────────────
    app.get('/api/tables/stats', authenticate, cached('tables:stats', 30_000), async (req, res) => {
        try {
            const r = await (
                await reqPool(req)
            ).query(`
            SELECT
                schemaname AS schema, 
                relname AS name,
                pg_size_pretty(pg_total_relation_size(relid)) AS size,
                pg_total_relation_size(relid) AS total_bytes,
                seq_scan AS "seqScans", 
                idx_scan AS "idxScans",
                n_tup_ins AS inserts, 
                n_tup_upd AS updates, 
                n_tup_del AS deletes,
                n_tup_hot_upd AS "hotUpdates",
                n_live_tup AS "liveTuples", 
                n_dead_tup AS "deadTuples",
                CASE WHEN (n_live_tup + n_dead_tup) > 0 
                     THEN round((n_dead_tup::numeric / (n_live_tup + n_dead_tup)) * 100, 1) 
                     ELSE 0 END AS "deadPct",
                CASE WHEN n_tup_upd > 0 
                     THEN round((n_tup_hot_upd::numeric / n_tup_upd) * 100, 1) 
                     ELSE 0 END AS "hotPct",
                COALESCE(to_char(last_vacuum, 'YYYY-MM-DD HH24:MI'), 'Never') AS "lastVacuum",
                COALESCE(to_char(last_analyze, 'YYYY-MM-DD HH24:MI'), 'Never') AS "lastAnalyze"
            FROM pg_stat_user_tables
            ORDER BY total_bytes DESC NULLS LAST
            LIMIT 100
        `);
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    app.get('/api/tables/columns', authenticate, cached('tables:columns', 60_000), async (req, res) => {
        try {
            const r = await (
                await reqPool(req)
            ).query(`
            SELECT
                schemaname,
                tablename,
                attname                              AS name,
                null_frac * 100                      AS "nullPct",
                n_distinct                           AS distinct,
                CASE
                    WHEN most_common_vals IS NULL THEN ''
                    ELSE trim(both '{}' FROM most_common_vals::text)
            END                                  AS "topValues"
            FROM pg_stats
            WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
            ORDER BY schemaname, tablename, attname
        `);
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    app.get('/api/tables/dependencies', authenticate, cached('tables:deps', 60_000), async (req, res) => {
        try {
            const r = await (
                await reqPool(req)
            ).query(`
            SELECT
                cl1.relname::text AS table_name,
                COALESCE(
                        array_agg(DISTINCT cl2.relname::text) FILTER (WHERE cl2.relname IS NOT NULL),
                        ARRAY[]::text[]
                ) AS refs_to
            FROM pg_class cl1
                     LEFT JOIN pg_constraint c ON c.conrelid = cl1.oid AND c.contype = 'f'
                     LEFT JOIN pg_class cl2 ON c.confrelid = cl2.oid
            WHERE cl1.relnamespace::regnamespace::text NOT IN ('pg_catalog', 'information_schema')
              AND cl1.relkind = 'r'
            GROUP BY cl1.relname
        `);

            const tables = r.rows.map((row) => ({
                name: row.table_name,
                refsTo: Array.isArray(row.refs_to) ? row.refs_to.filter(Boolean) : [],
                refsBy: [],
            }));

            tables.forEach((t) => {
                t.refsTo.forEach((targetName) => {
                    const target = tables.find((x) => x.name === targetName);
                    if (target) target.refsBy.push(t.name);
                });
            });

            res.json(tables);
        } catch (e) {
            console.error('Dependencies error:', e);
            res.json({});
        }
    });

    app.get('/api/tables/toast', authenticate, cached('tables:toast', 60_000), async (req, res) => {
        try {
            const r = await (
                await reqPool(req)
            ).query(`
            SELECT
                n.nspname AS schema,
                c.relname AS table,
                c.reltoastrelid::regclass::text AS "toastTable",
                pg_size_pretty(pg_relation_size(c.reltoastrelid)) AS "toastSize",
                pg_relation_size(c.reltoastrelid) AS "toastBytes",
                t_stat.n_dead_tup AS "deadChunks",
                CASE WHEN (t_stat.n_live_tup + t_stat.n_dead_tup) > 0 
                     THEN round((t_stat.n_dead_tup::numeric / (t_stat.n_live_tup + t_stat.n_dead_tup)) * 100, 1) 
                     ELSE 0 END AS "deadPct"
            FROM pg_class c
            JOIN pg_namespace n ON c.relnamespace = n.oid
            LEFT JOIN pg_stat_user_tables t_stat ON c.reltoastrelid = t_stat.relid
            WHERE c.relkind = 'r' AND c.reltoastrelid != 0
              AND n.nspname NOT IN ('pg_catalog', 'information_schema')
            ORDER BY "toastBytes" DESC
            LIMIT 50
        `);
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    app.get('/api/tables/temp', authenticate, cached('tables:temp', CONFIG.CACHE_TTL.TABLE_STATS), async (req, res) => {
        try {
            const r = await (
                await reqPool(req)
            ).query(`
            SELECT
                n.nspname AS schema_name,
                c.relname AS table_name,
                pg_size_pretty(pg_total_relation_size(c.oid)) AS size,
                pg_total_relation_size(c.oid) AS size_bytes,
                a.pid,
                a.usename AS user,
                a.application_name AS app,
                extract(epoch from (now() - a.backend_start))::int as age_sec
            FROM pg_class c
                JOIN pg_namespace n ON c.relnamespace = n.oid
                LEFT JOIN pg_stat_activity a ON strpos(n.nspname, a.pid::text) > 0
            WHERE c.relpersistence = 't'
        `);
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    app.get(
        '/api/tables/indexes',
        authenticate,
        cached('tables:indexes', CONFIG.CACHE_TTL.INDEXES),
        async (req, res) => {
            try {
                const r = await (
                    await reqPool(req)
                ).query(`
            SELECT
                ui.schemaname                                           AS schema,
                ui.relname                                              AS "tableName",
                ui.indexrelname                                         AS name,
                ui.idx_scan                                             AS scans,
                ui.idx_tup_read                                         AS "tupRead",
                ui.idx_tup_fetch                                        AS "tupFetch",
                pg_relation_size(ui.indexrelid)                         AS "sizeBytes",
                pg_size_pretty(pg_relation_size(ui.indexrelid))         AS size,
                am.amname                                               AS type,
                ix.indexdef                                             AS definition,
                i.indisunique                                           AS "isUnique",
                i.indisprimary                                          AS "isPrimary",
                CASE
                    WHEN ui.idx_scan     = 0 THEN 100
                    WHEN ui.idx_tup_read = 0 THEN 0
                    ELSE round(
                        (1.0 - ui.idx_tup_fetch::numeric / NULLIF(ui.idx_tup_read, 0)) * 100,
                        1
                    )
            END                                                     AS "inefficiencyPct"
            FROM pg_stat_user_indexes ui
            JOIN pg_indexes ix
              ON  ix.schemaname = ui.schemaname
              AND ix.tablename  = ui.relname
              AND ix.indexname  = ui.indexrelname
            JOIN pg_class c  ON c.oid  = ui.indexrelid
            JOIN pg_am    am ON am.oid = c.relam
            JOIN pg_index  i ON i.indexrelid = ui.indexrelid
            ORDER BY ui.schemaname, ui.relname, ui.idx_scan DESC
        `);
                res.json(r.rows);
            } catch (e) {
                log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
                res.json([]);
            }
        },
    );

    app.get(
        '/api/tables/sizes',
        authenticate,
        cached('tables:sizes', CONFIG.CACHE_TTL.TABLE_STATS),
        async (req, res) => {
            try {
                const r = await (
                    await reqPool(req)
                ).query(`
            SELECT
                n.nspname                                                   AS schema,
                c.relname                                                   AS name,
                pg_table_size(c.oid)                                        AS "heapBytes",
                pg_indexes_size(c.oid)                                      AS "indexBytes",
                COALESCE(pg_relation_size(ct.oid), 0)                       AS "toastBytes",
                pg_total_relation_size(c.oid)                               AS "totalBytes",
                pg_size_pretty(pg_table_size(c.oid))                        AS "heapSize",
                pg_size_pretty(pg_indexes_size(c.oid))                      AS "indexSize",
                pg_size_pretty(COALESCE(pg_relation_size(ct.oid), 0))       AS "toastSize",
                pg_size_pretty(pg_total_relation_size(c.oid))               AS "totalSize",
                CASE
                    WHEN (s.n_live_tup + s.n_dead_tup) > 0
                    THEN ROUND(
                        (s.n_dead_tup::numeric / (s.n_live_tup + s.n_dead_tup)) * 100,
                        1
                    )
                    ELSE 0
            END                                                         AS "bloatPct"
            FROM pg_class c
            JOIN pg_namespace n   ON n.oid = c.relnamespace
            LEFT JOIN pg_class ct  ON ct.oid = c.reltoastrelid
            LEFT JOIN pg_stat_user_tables s
              ON s.schemaname = n.nspname AND s.relname = c.relname
            WHERE c.relkind = 'r'
              AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
            ORDER BY pg_total_relation_size(c.oid) DESC
        `);
                res.json(r.rows);
            } catch (e) {
                log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
                res.json([]);
            }
        },
    );

    // ── /api/tables/queries ── pg_stat_statements: slow query analysis ────────────
    app.get(
        '/api/tables/queries',
        authenticate,
        cached('tables:queries', CONFIG.CACHE_TTL.PERFORMANCE),
        async (req, res) => {
            try {
                const _p = await reqPool(req);
                // Gracefully return [] when pg_stat_statements is not installed
                const extCheck = await _p.query(
                    `SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON e.extnamespace = n.oid WHERE e.extname = 'pg_stat_statements'`,
                );
                if (extCheck.rowCount === 0) return res.json([]);
                const schema = extCheck.rows[0].nspname;
                const r = await _p.query(`
            SELECT
                queryid                                                                         AS "queryId",
                LEFT(query, 500)                                                                AS "query",
                calls                                                                           AS "calls",
                ROUND(mean_exec_time::numeric, 2)                                               AS "meanMs",
                ROUND(max_exec_time::numeric, 2)                                                AS "maxMs",
                ROUND(total_exec_time::numeric, 2)                                              AS "totalMs",
                rows                                                                            AS "rows",
                ROUND(stddev_exec_time::numeric, 2)                                             AS "stddevMs",
                shared_blks_hit                                                                 AS "cacheHits",
                shared_blks_read                                                                AS "diskReads",
                CASE
                    WHEN shared_blks_hit + shared_blks_read = 0 THEN 0
                    ELSE ROUND(
                        100.0 * shared_blks_hit /
                        NULLIF(shared_blks_hit + shared_blks_read, 0),
                    1)
                END                                                                             AS "cacheHitPct"
            FROM "${schema}".pg_stat_statements
            WHERE query NOT LIKE '%pg_stat%'
              AND query NOT LIKE '%pg_catalog%'
              AND calls > 0
            ORDER BY total_exec_time DESC
            LIMIT 50
        `);
                res.json(r.rows);
            } catch (e) {
                if (e.message.includes('pg_stat_statements')) return res.json([]);
                res.json([]);
            }
        },
    );

    // ── /api/tables/locks ── active locks & blocking chains from pg_locks ─────────
    app.get('/api/tables/locks', authenticate, cached('tables:locks', CONFIG.CACHE_TTL.STATS), async (req, res) => {
        try {
            const r = await (
                await reqPool(req)
            ).query(`
            SELECT
                l.pid                                                                           AS "pid",
                c.relname                                                                       AS "relation",
                l.locktype                                                                      AS "lockType",
                l.mode                                                                          AS "mode",
                l.granted                                                                       AS "granted",
                NOT l.granted                                                                   AS "blocked",
                NOT l.granted                                                                   AS "waiting",
                a.state                                                                         AS "state",
                a.application_name                                                              AS "appName",
                a.usename                                                                       AS "userName",
                a.wait_event_type                                                               AS "waitEventType",
                a.wait_event                                                                    AS "waitEvent",
                EXTRACT(EPOCH FROM (NOW() - a.query_start))::INT                               AS "queryAgeSec",
                LEFT(a.query, 200)                                                              AS "currentQuery"
            FROM pg_locks l
            LEFT JOIN pg_class         c ON c.oid = l.relation
            LEFT JOIN pg_stat_activity a ON a.pid = l.pid
            WHERE l.pid <> pg_backend_pid()
            ORDER BY l.granted ASC, l.pid ASC
            LIMIT 100
        `);
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    // ── /api/tables/autovacuum ── per-table daemon run history & timestamps ────────
    app.get(
        '/api/tables/autovacuum',
        authenticate,
        cached('tables:autovacuum', CONFIG.CACHE_TTL.VACUUM),
        async (req, res) => {
            try {
                const r = await (
                    await reqPool(req)
                ).query(`
            SELECT
                schemaname                                                                      AS "schema",
                relname                                                                         AS "name",
                last_vacuum                                                                     AS "lastVacuum",
                last_autovacuum                                                                 AS "lastAutovacuum",
                last_analyze                                                                    AS "lastAnalyze",
                last_autoanalyze                                                                AS "lastAutoanalyze",
                vacuum_count                                                                    AS "vacuumCount",
                autovacuum_count                                                                AS "autovacuumCount",
                analyze_count                                                                   AS "analyzeCount",
                autoanalyze_count                                                               AS "autoanalyzeCount",
                n_live_tup                                                                      AS "liveRows",
                n_dead_tup                                                                      AS "deadRows",
                CASE
                    WHEN n_live_tup + n_dead_tup = 0 THEN 0
                    ELSE ROUND(
                        100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0),
                    1)
                END                                                                             AS "deadPct",
                EXTRACT(EPOCH FROM (NOW() - COALESCE(last_autovacuum, last_vacuum)))::INT       AS "secsSinceVacuum",
                EXTRACT(EPOCH FROM (NOW() - COALESCE(last_autoanalyze, last_analyze)))::INT     AS "secsSinceAnalyze"
            FROM pg_stat_user_tables
            ORDER BY
                COALESCE(last_autovacuum, last_vacuum) ASC NULLS FIRST,
                n_dead_tup DESC
        `);
                res.json(r.rows);
            } catch (e) {
                log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
                res.json([]);
            }
        },
    );

    // ── /api/tables/connections ── pg_stat_activity grouped by state/app/user ─────
    app.get(
        '/api/tables/connections',
        authenticate,
        cached('tables:connections', CONFIG.CACHE_TTL.STATS),
        async (req, res) => {
            try {
                const r = await (
                    await reqPool(req)
                ).query(`
            SELECT
                COALESCE(application_name, 'unknown')                                           AS "appName",
                COALESCE(usename, 'unknown')                                                    AS "useName",
                COALESCE(datname, 'unknown')                                                    AS "datName",
                COALESCE(state, 'unknown')                                                      AS "state",
                wait_event_type                                                                  AS "waitEventType",
                wait_event                                                                       AS "waitEvent",
                COUNT(*)::INT                                                                    AS "count",
                MAX(EXTRACT(EPOCH FROM (NOW() - backend_start))::INT)                           AS "maxAgeSec",
                MAX(EXTRACT(EPOCH FROM (NOW() - state_change))::INT)                            AS "maxStateAgeSec"
            FROM pg_stat_activity
            WHERE pid <> pg_backend_pid()
            GROUP BY
                application_name, usename, datname,
                state, wait_event_type, wait_event
            ORDER BY COUNT(*) DESC
            LIMIT 50
        `);
                res.json(r.rows);
            } catch (e) {
                log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
                res.json([]);
            }
        },
    );
}
