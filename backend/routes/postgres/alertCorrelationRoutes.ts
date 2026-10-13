// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Extracted from server.ts.

import { pool } from '../../core/adminPool.js';
import { authenticate } from '../../core/auth.js';
import { reqPool } from '../../core/connectionPools.js';
import { cached } from '../../core/responseCache.js';

export default function registerAlertCorrelationRoutes(app) {
    // ─────────────────────────────────────────────────────────────────────────────
    // ALERT CORRELATION
    // ─────────────────────────────────────────────────────────────────────────────
    const alertEventStore = [];
    const MAX_ALERT_EVENTS = 500;

    async function captureAlertSnapshot() {
        if (!pool) return;
        try {
            const [conns, locks, waits, repl, bgwriter] = await Promise.all([
                pool.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER(WHERE state='active') AS active,
                            COUNT(*) FILTER(WHERE wait_event IS NOT NULL) AS waiting
                        FROM pg_stat_activity`),
                pool.query(`SELECT COUNT(*) AS lock_count FROM pg_locks WHERE NOT granted`),
                pool.query(`SELECT wait_event_type, COUNT(*) AS cnt FROM pg_stat_activity
                        WHERE wait_event IS NOT NULL AND state!='idle' GROUP BY wait_event_type`),
                pool
                    .query(`SELECT COUNT(*) AS replica_count FROM pg_stat_replication`)
                    .catch(() => ({ rows: [{ replica_count: 0 }] })),
                pool
                    .query(
                        `
                SELECT
                    COALESCE(
                        (SELECT num_requested  FROM pg_stat_checkpointer LIMIT 1),
                        (SELECT checkpoints_req FROM pg_stat_bgwriter    LIMIT 1),
                        0
                    ) AS checkpoints_req,
                    COALESCE(
                        (SELECT num_timed      FROM pg_stat_checkpointer LIMIT 1),
                        (SELECT checkpoints_timed FROM pg_stat_bgwriter  LIMIT 1),
                        0
                    ) AS checkpoints_timed
            `,
                    )
                    .catch(() => ({ rows: [{ checkpoints_req: 0, checkpoints_timed: 0 }] })),
            ]);

            const c = conns.rows[0];
            const locks_waiting = Number(locks.rows[0]?.lock_count || 0);
            const waitMap = Object.fromEntries(waits.rows.map((r) => [r.wait_event_type, Number(r.cnt)]));

            const now = new Date().toISOString();
            const events = [];

            if (Number(c.waiting) > 5)
                events.push({
                    ts: now,
                    type: 'connection',
                    severity: Number(c.waiting) > 15 ? 'critical' : 'warning',
                    message: `${c.waiting} sessions waiting`,
                    metric: 'waiting_sessions',
                    value: Number(c.waiting),
                });
            if (locks_waiting > 0)
                events.push({
                    ts: now,
                    type: 'lock',
                    severity: locks_waiting > 3 ? 'critical' : 'warning',
                    message: `${locks_waiting} ungranted lock(s)`,
                    metric: 'lock_waits',
                    value: locks_waiting,
                });
            if (Number(c.total) > 80)
                events.push({
                    ts: now,
                    type: 'connection',
                    severity: 'warning',
                    message: `High connection count: ${c.total}`,
                    metric: 'total_connections',
                    value: Number(c.total),
                });
            if (waitMap['Lock'] > 0)
                events.push({
                    ts: now,
                    type: 'lock',
                    severity: 'warning',
                    message: `${waitMap['Lock']} lock-wait sessions`,
                    metric: 'lock_wait_sessions',
                    value: waitMap['Lock'],
                });
            if (waitMap['IO'] > 3)
                events.push({
                    ts: now,
                    type: 'io',
                    severity: 'warning',
                    message: `${waitMap['IO']} IO-wait sessions`,
                    metric: 'io_wait_sessions',
                    value: waitMap['IO'],
                });

            if (events.length > 0) {
                alertEventStore.push(...events);
                if (alertEventStore.length > MAX_ALERT_EVENTS)
                    alertEventStore.splice(0, alertEventStore.length - MAX_ALERT_EVENTS);
            }
        } catch (_) {
            /* silent */
        }
    }

    // Alert snapshot capture — only on long-lived processes (not Vercel serverless)
    if (process.env.VERCEL !== '1') setInterval(captureAlertSnapshot, 30_000);

    app.get('/api/alerts/correlation', authenticate, cached('alerts:corr', 15_000), async (req, res) => {
        try {
            const _p = await reqPool(req);
            const [conns, locks, waits, tables, txAge] = await Promise.all([
                _p.query(`
                SELECT state, wait_event_type, wait_event, COUNT(*) AS cnt,
                       MAX(EXTRACT(EPOCH FROM (now()-query_start)))::int AS max_age_sec
                FROM pg_stat_activity WHERE state IS NOT NULL
                GROUP BY state, wait_event_type, wait_event ORDER BY cnt DESC
            `),
                _p.query(
                    `SELECT locktype, mode, granted, COUNT(*) AS cnt FROM pg_locks GROUP BY locktype,mode,granted ORDER BY cnt DESC LIMIT 20`,
                ),
                _p.query(`
                SELECT pid, usename, datname, state, wait_event_type, wait_event,
                    left(query,120) AS query, round(EXTRACT(EPOCH FROM (now()-query_start))::numeric,1) AS age_sec
                FROM pg_stat_activity
                WHERE state != 'idle' AND query NOT LIKE '%pg_stat_activity%'
                ORDER BY age_sec DESC NULLS LAST LIMIT 25
            `),
                _p.query(`
                SELECT relname AS table_name,
                       n_dead_tup, n_live_tup,
                       round((n_dead_tup::numeric/NULLIF(n_live_tup+n_dead_tup,0)*100),1) AS dead_pct,
                       last_autovacuum, last_autoanalyze
                FROM pg_stat_user_tables
                WHERE n_dead_tup > 1000
                ORDER BY dead_pct DESC NULLS LAST LIMIT 10
            `),
                _p.query(`
                SELECT pid, usename, datname,
                       age(backend_xid)  AS xid_age,
                       age(backend_xmin) AS xmin_age,
                    left(query,120) AS query,
                    round(EXTRACT(EPOCH FROM (now()-xact_start))::numeric,1) AS xact_age_sec
                FROM pg_stat_activity
                WHERE xact_start IS NOT NULL
                  AND state != 'idle'
                ORDER BY xact_age_sec DESC NULLS LAST LIMIT 10
            `),
            ]);

            const WINDOW_MS = 5 * 60 * 1000;
            const groups = [];
            let remaining = [...alertEventStore];

            while (remaining.length > 0) {
                const anchor = remaining.shift();
                const anchorTs = new Date(anchor.ts).getTime();
                const cluster = [anchor];
                const survivors = [];
                for (const ev of remaining) {
                    if (Math.abs(new Date(ev.ts).getTime() - anchorTs) <= WINDOW_MS) {
                        cluster.push(ev);
                    } else {
                        survivors.push(ev);
                    }
                }
                remaining = survivors;
                groups.push({
                    id: `grp-${anchorTs}`,
                    startTs: anchor.ts,
                    endTs: cluster[cluster.length - 1].ts,
                    events: cluster,
                    types: [...new Set(cluster.map((e) => e.type))],
                    severity: cluster.some((e) => e.severity === 'critical') ? 'critical' : 'warning',
                    rootCause: guessRootCause(cluster),
                });
            }

            res.json({
                correlationGroups: groups.slice(-20),
                recentEvents: alertEventStore.slice(-50),
                liveSessions: waits.rows,
                lockSummary: locks.rows,
                sessionStates: conns.rows,
                bloatedTables: tables.rows,
                longTransactions: txAge.rows,
            });
        } catch (e) {
            res.json({});
        }
    });

    function guessRootCause(events) {
        const types = events.map((e) => e.type);
        const hasLock = types.includes('lock');
        const hasConn = types.includes('connection');
        const hasIO = types.includes('io');
        if (hasLock && hasConn)
            return 'Lock contention causing connection pile-up — identify and terminate blocking query';
        if (hasLock) return 'Lock contention — a long-running transaction may be blocking others';
        if (hasConn && hasIO) return 'High IO causing slow queries, leading to connection accumulation';
        if (hasConn) return 'Connection spike — check for connection leaks or missing pooler';
        if (hasIO) return 'IO saturation — consider increasing shared_buffers or adding indexes';
        return 'Multiple concurrent anomalies detected — review pg_stat_activity';
    }
}
