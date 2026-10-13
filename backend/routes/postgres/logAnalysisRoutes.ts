// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Extracted from server.ts.

import { authenticate } from '../../core/auth.js';
import { CONFIG } from '../../core/config.js';
import { reqPool } from '../../core/connectionPools.js';
import { cached } from '../../core/responseCache.js';
import { log } from '../../services/logger.js';

export default function registerLogAnalysisRoutes(app) {
    // ─────────────────────────────────────────────────────────────────────────────
    // LOG ANALYSIS
    // ─────────────────────────────────────────────────────────────────────────────
    app.get(
        '/api/logs/slow-queries',
        authenticate,
        cached('logs:slow', CONFIG.CACHE_TTL.PERFORMANCE),
        async (req, res) => {
            try {
                const threshold = parseInt(req.query.min_ms, 10) || 1000;
                const r = await (
                    await reqPool(req)
                ).query(
                    `
            SELECT query,
                   calls,
                   round(mean_exec_time::numeric, 2)  AS mean_ms,
                   round(max_exec_time::numeric,  2)  AS max_ms,
                   round(total_exec_time::numeric, 2) AS total_ms,
                   round((shared_blks_hit::numeric / NULLIF(shared_blks_hit + shared_blks_read, 0))*100, 1) AS cache_hit_pct,
                rows
            FROM pg_stat_statements
            WHERE mean_exec_time > $1
            ORDER BY mean_exec_time DESC
                LIMIT 50
        `,
                    [threshold],
                );
                res.json(r.rows);
            } catch (e) {
                res.json([]);
            }
        },
    );

    app.get('/api/logs/error-events', authenticate, cached('logs:errors', 15_000), async (req, res) => {
        try {
            const r = await (
                await reqPool(req)
            ).query(`
            SELECT pid, usename, datname, application_name,
                   state, wait_event_type, wait_event,
                left(query, 200) AS query_preview,
                query_start::text,
                round(EXTRACT(EPOCH FROM (now() - query_start))::numeric, 1) AS duration_sec
            FROM pg_stat_activity
            WHERE state != 'idle'
              AND query NOT LIKE '%pg_stat_activity%'
              AND query_start IS NOT NULL
            ORDER BY query_start ASC
                LIMIT 40
        `);
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // LOG PATTERN ANALYSIS
    // ─────────────────────────────────────────────────────────────────────────────
    app.get('/api/log-patterns/summary', authenticate, cached('log:patterns', 30_000), async (req, res) => {
        try {
            const _p = await reqPool(req);
            const [waitEvents, lockWaits, slowQueries, errorStates, dbActivity, topQueries] = await Promise.all([
                _p.query(`
                SELECT wait_event_type, wait_event, COUNT(*) AS count
                FROM pg_stat_activity
                WHERE wait_event IS NOT NULL AND state != 'idle'
                GROUP BY wait_event_type, wait_event
                ORDER BY count DESC LIMIT 20
            `),
                _p.query(`
                SELECT
                    blocked.pid AS blocked_pid,
                    blocked.usename AS blocked_user,
                    left(blocked.query, 120) AS blocked_query,
                    blocking.pid AS blocking_pid,
                    blocking.usename AS blocking_user,
                    left(blocking.query, 120) AS blocking_query,
                    round(EXTRACT(EPOCH FROM (now() - blocked.query_start))::numeric, 1) AS wait_sec
                FROM pg_stat_activity blocked
                    JOIN pg_stat_activity blocking ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
                WHERE cardinality(pg_blocking_pids(blocked.pid)) > 0
                    LIMIT 20
            `),
                _p
                    .query(
                        `
                SELECT
                    left(query, 100) AS query_preview,
                    calls,
                    round(mean_exec_time::numeric, 2) AS mean_ms,
                    round(max_exec_time::numeric, 2) AS max_ms,
                    round(stddev_exec_time::numeric, 2) AS stddev_ms,
                    round(total_exec_time::numeric, 2) AS total_ms,
                    round((100 * total_exec_time / NULLIF(SUM(total_exec_time) OVER (), 0))::numeric, 2) AS pct_total
                FROM pg_stat_statements
                WHERE mean_exec_time > 100
                ORDER BY total_exec_time DESC
                    LIMIT 15
            `,
                    )
                    .catch(() => ({ rows: [] })),
                _p.query(`
                SELECT state, wait_event_type, COUNT(*) AS count,
                       AVG(EXTRACT(EPOCH FROM (now() - query_start)))::int AS avg_age_sec
                FROM pg_stat_activity
                WHERE state IS NOT NULL
                GROUP BY state, wait_event_type
                ORDER BY count DESC
            `),
                _p.query(`
                SELECT datname,
                       numbackends,
                       xact_commit,
                       xact_rollback,
                       round((100.0 * xact_rollback / NULLIF(xact_commit + xact_rollback, 0))::numeric, 2) AS rollback_pct,
                       blks_read,
                       blks_hit,
                       round((100.0 * blks_hit / NULLIF(blks_read + blks_hit, 0))::numeric, 2) AS cache_hit_pct,
                       deadlocks,
                       temp_files,
                       temp_bytes
                FROM pg_stat_database
                WHERE datname IS NOT NULL
                ORDER BY numbackends DESC
                    LIMIT 10
            `),
                _p
                    .query(
                        `
                SELECT left(query, 100) AS query_preview, calls, round(mean_exec_time::numeric,2) AS mean_ms, rows
                FROM pg_stat_statements
                ORDER BY calls DESC LIMIT 10
            `,
                    )
                    .catch(() => ({ rows: [] })),
            ]);

            res.json({
                waitEvents: waitEvents.rows,
                lockWaits: lockWaits.rows,
                slowQueries: slowQueries.rows,
                errorStates: errorStates.rows,
                dbActivity: dbActivity.rows,
                topQueries: topQueries.rows,
            });
        } catch (e) {
            res.json({});
        }
    });
}
