// @ts-nocheck
import { Router } from 'express';

export default function performanceRoutes(authenticate, reqPool, log, cached) {
    const router = Router();

    /* ── GET /api/performance/stats ─────────────────────────────────────────────
       Returns slow queries from pg_stat_statements + basic availability flag.
       Falls back gracefully when pg_stat_statements is not installed.
    ──────────────────────────────────────────────────────────────────────────── */
    router.get('/performance/stats', authenticate, async (req, res) => {
        try {
            const pool = await reqPool(req);

            // Check if pg_stat_statements is available
            const extCheck = await pool
                .query(
                    `
                SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements' LIMIT 1
            `,
                )
                .catch(() => ({ rows: [] }));

            if (extCheck.rows.length === 0) {
                return res.json({ available: false, slowQueries: [] });
            }

            const r = await pool.query(`
                SELECT
                    queryid::text            AS id,
                    LEFT(query, 500)         AS query,
                    calls,
                    round(mean_exec_time::numeric, 2)   AS mean_time_ms,
                    round(max_exec_time::numeric, 2)    AS max_time_ms,
                    round(total_exec_time::numeric, 2)  AS total_time_ms,
                    round(stddev_exec_time::numeric, 2) AS stddev_ms,
                    rows,
                    round(
                        CASE WHEN (shared_blks_hit + shared_blks_read) > 0
                             THEN 100.0 * shared_blks_hit / (shared_blks_hit + shared_blks_read)
                             ELSE 100 END
                    ::numeric, 1) AS cache_hit_pct,
                    temp_blks_read,
                    temp_blks_written,
                    shared_blks_hit,
                    shared_blks_read
                FROM pg_stat_statements
                WHERE query NOT LIKE '%pg_stat_statements%'
                  AND query NOT LIKE 'BEGIN%'
                  AND query NOT LIKE 'COMMIT%'
                  AND mean_exec_time > 0
                ORDER BY mean_exec_time DESC
                LIMIT 100
            `);

            res.json({ available: true, slowQueries: r.rows });
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({ available: false, slowQueries: [] });
        }
    });

    /* ── GET /api/performance/table-io ──────────────────────────────────────────
       Returns per-table I/O stats from pg_statio_user_tables.
    ──────────────────────────────────────────────────────────────────────────── */
    router.get('/performance/table-io', authenticate, async (req, res) => {
        try {
            const pool = await reqPool(req);
            const schema = req.query.schema ? String(req.query.schema) : null;
            const r = await pool.query(
                `
                SELECT
                    schemaname,
                    relname                             AS table_name,
                    heap_blks_read,
                    heap_blks_hit,
                    idx_blks_read,
                    idx_blks_hit,
                    seq_scan,
                    idx_scan,
                    n_live_tup,
                    CASE WHEN (heap_blks_hit + heap_blks_read) > 0
                         THEN round(100.0 * heap_blks_hit / (heap_blks_hit + heap_blks_read), 1)
                         ELSE NULL
                    END AS cache_hit_pct
                FROM pg_statio_user_tables
                WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                  ${schema ? 'AND schemaname = $1' : ''}
                ORDER BY (heap_blks_read + coalesce(idx_blks_read, 0)) DESC
                LIMIT 50
            `,
                schema ? [schema] : [],
            );
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    /* ── GET /api/performance/deep-stats ─────────────────────────────────────────
       Returns wait events, lock blocking tree, db-level stats, slow queries with
       plan info, pg_settings, and bgwriter stats — all in one call.
    ──────────────────────────────────────────────────────────────────────────── */
    router.get('/performance/deep-stats', authenticate, async (req, res) => {
        try {
            const pool = await reqPool(req);

            const [
                waitEventsRes,
                waitEventTypesRes,
                lockBlockingRes,
                dbStatsRes,
                slowQueriesRes,
                settingsRes,
                bgwriterRes,
            ] = await Promise.allSettled([
                // Wait events from pg_stat_activity
                pool.query(`
                    SELECT wait_event_type, wait_event, count(*) AS count
                    FROM pg_stat_activity
                    WHERE wait_event IS NOT NULL
                      AND pid <> pg_backend_pid()
                    GROUP BY wait_event_type, wait_event
                    ORDER BY count DESC
                    LIMIT 30
                `),
                // Wait event type rollup
                pool.query(`
                    SELECT wait_event_type, count(*) AS count
                    FROM pg_stat_activity
                    WHERE wait_event_type IS NOT NULL
                      AND pid <> pg_backend_pid()
                    GROUP BY wait_event_type
                    ORDER BY count DESC
                `),
                // Lock blocking tree
                pool.query(`
                    SELECT
                        bl.pid                    AS blocked_pid,
                        ba.query                  AS blocked_query,
                        ba.usename                AS blocked_user,
                        kl.pid                    AS blocking_pid,
                        ka.query                  AS blocking_query,
                        ka.usename                AS blocking_user,
                        now() - ba.query_start    AS blocked_duration
                    FROM  pg_locks bl
                    JOIN  pg_locks kl
                          ON  kl.locktype = bl.locktype
                          AND kl.database IS NOT DISTINCT FROM bl.database
                          AND kl.relation IS NOT DISTINCT FROM bl.relation
                          AND kl.page    IS NOT DISTINCT FROM bl.page
                          AND kl.tuple   IS NOT DISTINCT FROM bl.tuple
                          AND kl.pid    <> bl.pid
                    JOIN  pg_stat_activity ba ON ba.pid = bl.pid
                    JOIN  pg_stat_activity ka ON ka.pid = kl.pid
                    WHERE NOT bl.granted
                    LIMIT 20
                `),
                // DB-level stats
                pool.query(`
                    SELECT
                        d.datname,
                        s.numbackends,
                        s.xact_commit,
                        s.xact_rollback,
                        s.blks_read,
                        s.blks_hit,
                        s.tup_returned,
                        s.tup_fetched,
                        s.tup_inserted,
                        s.tup_updated,
                        s.tup_deleted,
                        s.deadlocks,
                        s.temp_files,
                        s.temp_bytes,
                        CASE WHEN (s.blks_hit + s.blks_read) > 0
                             THEN round(100.0 * s.blks_hit / (s.blks_hit + s.blks_read), 2)
                             ELSE 100
                        END AS cache_hit_pct,
                        pg_postmaster_start_time()::text AS startup_time,
                        date_trunc('second', now() - pg_postmaster_start_time())::text AS uptime
                    FROM pg_stat_database s
                    JOIN pg_database d ON d.oid = s.datid
                    WHERE d.datname = current_database()
                    LIMIT 1
                `),
                // Slow queries with JIT / parallel info from pg_stat_statements (if available)
                pool
                    .query(
                        `
                    SELECT
                        queryid::text             AS id,
                        LEFT(query, 1000)         AS query,
                        calls,
                        round(mean_exec_time::numeric, 2)   AS mean_time_ms,
                        round(max_exec_time::numeric, 2)    AS max_time_ms,
                        round(total_exec_time::numeric, 2)  AS total_time_ms,
                        rows,
                        temp_blks_read,
                        temp_blks_written,
                        shared_blks_hit,
                        shared_blks_read,
                        jit_functions,
                        jit_generation_time,
                        jit_inlining_time,
                        jit_optimization_time,
                        jit_emission_time
                    FROM pg_stat_statements
                    WHERE query NOT LIKE '%pg_stat_statements%'
                      AND mean_exec_time > 10
                    ORDER BY total_exec_time DESC
                    LIMIT 200
                `,
                    )
                    .catch(() => ({ rows: [] })),
                // Key pg_settings
                pool.query(`
                    SELECT name, setting, unit
                    FROM pg_settings
                    WHERE name IN (
                        'max_connections', 'shared_buffers', 'work_mem',
                        'effective_cache_size', 'maintenance_work_mem',
                        'wal_buffers', 'checkpoint_completion_target',
                        'random_page_cost', 'seq_page_cost',
                        'effective_io_concurrency', 'max_worker_processes',
                        'max_parallel_workers', 'max_parallel_workers_per_gather',
                        'jit', 'jit_above_cost', 'jit_inline_above_cost',
                        'jit_optimize_above_cost', 'log_min_duration_statement',
                        'track_activity_query_size', 'pg_stat_statements.max'
                    )
                `),
                // bgwriter stats
                pool.query(`
                    SELECT
                        buffers_checkpoint,
                        buffers_clean,
                        maxwritten_clean,
                        buffers_backend,
                        buffers_backend_fsync,
                        buffers_alloc,
                        stats_reset
                    FROM pg_stat_bgwriter
                    LIMIT 1
                `),
            ]);

            const ok = (r) => (r.status === 'fulfilled' ? r.value.rows : []);
            const ok1 = (r) => (r.status === 'fulfilled' ? r.value.rows[0] || {} : {});

            // Convert settings rows → flat object
            const settingsRows = ok(settingsRes);
            const settings: Record<string, string> = {};
            for (const row of settingsRows) {
                settings[row.name] = row.unit ? `${row.setting}${row.unit}` : row.setting;
            }

            res.json({
                waitEvents: ok(waitEventsRes),
                waitEventTypes: ok(waitEventTypesRes),
                lockBlocking: ok(lockBlockingRes),
                dbStats: ok1(dbStatsRes),
                slowQueries: ok(slowQueriesRes),
                settings,
                bgwriter: ok1(bgwriterRes),
            });
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({
                waitEvents: [],
                waitEventTypes: [],
                lockBlocking: [],
                dbStats: {},
                slowQueries: [],
                settings: {},
                bgwriter: {},
            });
        }
    });

    return router;
}
