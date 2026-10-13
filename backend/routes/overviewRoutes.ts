// @ts-nocheck
import { Router } from 'express';

export default function overviewRoutes(pool, authenticate, cached, CONFIG, reqPool, log) {
    const router = Router();

    router.get('/overview/stats', authenticate, cached('ov:stats', CONFIG.CACHE_TTL.STATS), async (req, res) => {
        try {
            const {
                rows: [d],
            } = await (
                await reqPool(req)
            ).query(`
                SELECT
                    (SELECT count(*) FROM pg_stat_activity WHERE state='active') AS active,
                    (SELECT count(*) FROM pg_stat_activity) AS total_conn,
                    (SELECT setting::int FROM pg_settings WHERE name='max_connections') AS max_conn,
                    (SELECT pg_database_size(current_database())) AS db_size_bytes,
                    (SELECT date_part('epoch', now() - pg_postmaster_start_time())) AS uptime_seconds,
                    (SELECT sum(heap_blks_hit)/NULLIF(sum(heap_blks_hit)+sum(heap_blks_read),0)*100 FROM pg_statio_user_tables) AS hit_ratio
            `);
            res.json({
                activeConnections: Number(d.active),
                maxConnections: Number(d.max_conn),
                uptimeSeconds: Number(d.uptime_seconds),
                diskUsedGB: parseFloat((d.db_size_bytes / 1024 ** 3).toFixed(2)),
                indexHitRatio: parseFloat(d.hit_ratio || 0).toFixed(1),
            });
        } catch (e) {
            res.json({
                activeConnections: 0,
                maxConnections: 0,
                uptimeSeconds: 0,
                diskUsedGB: 0,
                indexHitRatio: '0.0',
                error: e.message,
            });
        }
    });

    router.get('/overview/traffic', authenticate, cached('ov:traffic', CONFIG.CACHE_TTL.TRAFFIC), async (req, res) => {
        try {
            const r = await (
                await reqPool(req)
            ).query(
                'SELECT tup_fetched, tup_inserted, tup_updated, tup_deleted FROM pg_stat_database WHERE datname=current_database()',
            );
            res.json(r.rows[0] || { tup_fetched: 0, tup_inserted: 0, tup_updated: 0, tup_deleted: 0 });
        } catch (e) {
            res.json({ tup_fetched: 0, tup_inserted: 0, tup_updated: 0, tup_deleted: 0 });
        }
    });

    router.get('/overview/long-transactions', authenticate, cached('ov:longtxn', 15000), async (req, res) => {
        try {
            const r = await (
                await reqPool(req)
            ).query(`
                SELECT pid, usename, application_name, state, query,
                       now() - xact_start AS duration,
                       extract(epoch FROM now() - xact_start) AS duration_sec
                FROM pg_stat_activity
                WHERE state <> 'idle' AND xact_start IS NOT NULL
                  AND extract(epoch FROM now() - xact_start) > 60
                ORDER BY xact_start ASC LIMIT 20
            `);
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    router.get('/overview/vacuum', authenticate, cached('ov:vacuum', 30000), async (req, res) => {
        try {
            const schema = req.query.schema ? String(req.query.schema) : null;
            const r = await (
                await reqPool(req)
            ).query(
                `
                SELECT relname AS table_name,
                       last_vacuum, last_autovacuum, last_analyze, last_autoanalyze,
                       n_dead_tup, n_live_tup,
                       CASE WHEN n_live_tup > 0 THEN round(n_dead_tup::numeric/n_live_tup*100,1) ELSE 0 END AS dead_pct
                FROM pg_stat_user_tables
                WHERE n_dead_tup > 1000 ${schema ? 'AND schemaname = $1' : ''}
                ORDER BY n_dead_tup DESC LIMIT 20
            `,
                schema ? [schema] : [],
            );
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    router.get('/overview/backup', authenticate, cached('ov:backup', 60000), async (req, res) => {
        try {
            const r = await (
                await reqPool(req)
            ).query(
                'SELECT pg_walfile_name(pg_current_wal_lsn()) AS current_wal, pg_postmaster_start_time() AS last_start',
            );
            res.json(r.rows[0] || {});
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({});
        }
    });

    router.get('/overview/replication', authenticate, cached('ov:repl', 15000), async (req, res) => {
        try {
            const r = await (
                await reqPool(req)
            ).query(
                'SELECT application_name, state, pg_wal_lsn_diff(sent_lsn,replay_lsn) AS lag_bytes FROM pg_stat_replication',
            );
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    router.get('/overview/top-tables', authenticate, cached('ov:toptbl', 60000), async (req, res) => {
        try {
            const schema = req.query.schema ? String(req.query.schema) : null;
            const r = await (
                await reqPool(req)
            ).query(
                `
                SELECT relname AS table_name,
                       pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
                       pg_total_relation_size(relid) AS total_bytes,
                       n_live_tup AS row_count
                FROM pg_stat_user_tables ${schema ? 'WHERE schemaname = $1' : ''} ORDER BY total_bytes DESC LIMIT 20
            `,
                schema ? [schema] : [],
            );
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    router.get('/overview/alerts', authenticate, cached('ov:alerts', 15000), async (req, res) => {
        try {
            const r = await pool.query(
                "SELECT id, severity, category, message, created_at FROM pgmonitoringtool.alerts WHERE created_at > now()-interval '24 hours' ORDER BY created_at DESC LIMIT 10",
            );
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    router.get('/overview/all', authenticate, cached('ov:all', CONFIG.CACHE_TTL.STATS), async (req, res) => {
        try {
            const _p = await reqPool(req);
            // Postgres schema scope for the per-table panels (vacuum + top tables).
            const schema = req.query.schema ? String(req.query.schema) : null;
            const [stats, traffic, longtxn, vacuum, repl, toptbl, locks, blocked, recovery] = await Promise.allSettled([
                _p.query(
                    `SELECT (SELECT count(*) FROM pg_stat_activity WHERE state='active') AS active, (SELECT count(*) FROM pg_stat_activity) AS total_conn, (SELECT setting::int FROM pg_settings WHERE name='max_connections') AS max_conn, (SELECT pg_database_size(current_database())) AS db_size_bytes, (SELECT date_part('epoch', now() - pg_postmaster_start_time())) AS uptime_seconds, (SELECT sum(heap_blks_hit)/NULLIF(sum(heap_blks_hit)+sum(heap_blks_read),0)*100 FROM pg_statio_user_tables) AS hit_ratio`,
                ),
                _p.query(
                    'SELECT tup_fetched, tup_inserted, tup_updated, tup_deleted, xact_commit, xact_rollback, deadlocks FROM pg_stat_database WHERE datname=current_database()',
                ),
                _p.query(
                    `SELECT pid, usename, state, query, extract(epoch FROM now()-xact_start) AS duration_sec FROM pg_stat_activity WHERE state<>'idle' AND xact_start IS NOT NULL AND extract(epoch FROM now()-xact_start)>60 ORDER BY xact_start ASC LIMIT 5`,
                ),
                _p.query(
                    `SELECT relname, n_dead_tup, n_live_tup FROM pg_stat_user_tables WHERE n_dead_tup>1000 ${schema ? 'AND schemaname = $1' : ''} ORDER BY n_dead_tup DESC LIMIT 5`,
                    schema ? [schema] : [],
                ),
                _p.query(
                    `SELECT application_name, client_addr::text AS client_addr, state, sync_state, EXTRACT(EPOCH FROM replay_lag)*1000 AS replay_lag_ms, pg_wal_lsn_diff(sent_lsn, replay_lsn) AS byte_lag FROM pg_stat_replication ORDER BY application_name`,
                ),
                // PERF: this aggregate runs on every dashboard load. The old
                // version called pg_total_relation_size() per table, which does
                // a filesystem stat per relation and can take many seconds on a
                // DB with lots of tables — the main cause of the slow Overview.
                // The panel only needs reads/writes here, so we drop the size
                // lookup; exact sizes stay available via the dedicated, lazily
                // loaded /overview/top-tables endpoint.
                _p.query(
                    `SELECT schemaname, relname AS table_name, seq_scan, seq_tup_read, n_tup_ins, n_tup_upd, n_tup_del, (seq_tup_read) AS reads, (n_tup_ins + n_tup_upd + n_tup_del) AS writes, n_live_tup AS row_count FROM pg_stat_user_tables ${schema ? 'WHERE schemaname = $1' : ''} ORDER BY (seq_tup_read + n_tup_ins + n_tup_upd + n_tup_del) DESC LIMIT 20`,
                    schema ? [schema] : [],
                ),
                _p.query(
                    `SELECT count(*) FILTER (WHERE NOT granted) AS waiting, count(*) AS total FROM pg_locks WHERE relation IS NOT NULL`,
                ),
                _p.query(
                    `SELECT count(*) AS blocked FROM pg_stat_activity WHERE wait_event_type='Lock' AND state='active'`,
                ),
                _p.query(`SELECT pg_is_in_recovery() AS is_replica`),
            ]);
            const d = stats.status === 'fulfilled' ? stats.value.rows[0] : {};
            const t = traffic.status === 'fulfilled' ? traffic.value.rows[0] || {} : {};
            const replicaRows = repl.status === 'fulfilled' ? repl.value.rows : [];
            const lockRow = locks.status === 'fulfilled' ? locks.value.rows[0] || {} : {};
            const blockedRow = blocked.status === 'fulfilled' ? blocked.value.rows[0] || {} : {};
            const isStandby = recovery.status === 'fulfilled' ? !!recovery.value.rows[0]?.is_replica : false;
            const waiting = Number(lockRow.waiting || 0);
            const totalLocks = Number(lockRow.total || 0);
            const replayLag = replicaRows.reduce((m, r) => Math.max(m, Number(r.replay_lag_ms || 0)), 0);
            res.json({
                stats: {
                    activeConnections: Number(d.active || 0),
                    maxConnections: Number(d.max_conn || 0),
                    uptimeSeconds: Number(d.uptime_seconds || 0),
                    diskUsedGB: parseFloat(((d.db_size_bytes || 0) / 1024 ** 3).toFixed(2)),
                    indexHitRatio: parseFloat(d.hit_ratio || 0).toFixed(1),
                },
                traffic: {
                    tup_fetched: Number(t.tup_fetched || 0),
                    tup_inserted: Number(t.tup_inserted || 0),
                    tup_updated: Number(t.tup_updated || 0),
                    tup_deleted: Number(t.tup_deleted || 0),
                    xact_commit: Number(t.xact_commit || 0),
                    xact_rollback: Number(t.xact_rollback || 0),
                    deadlocks: Number(t.deadlocks || 0),
                },
                longTransactions: longtxn.status === 'fulfilled' ? longtxn.value.rows : [],
                vacuum: vacuum.status === 'fulfilled' ? vacuum.value.rows : [],
                replication: {
                    isStandby,
                    replayLag: Math.round(replayLag),
                    replicas: replicaRows.map((r) => ({
                        name: r.application_name,
                        clientAddr: r.client_addr,
                        state: r.state,
                        syncState: r.sync_state,
                        lagMs: Math.round(Number(r.replay_lag_ms || 0)),
                        byteLag: Number(r.byte_lag || 0),
                    })),
                    blockedQueries: Number(blockedRow.blocked || 0),
                    waitingQueries: waiting,
                    lockContention: totalLocks > 0 ? Math.round((waiting / totalLocks) * 100) : 0,
                    deadlocks: Number(t.deadlocks || 0),
                },
                topTables: toptbl.status === 'fulfilled' ? toptbl.value.rows : [],
            });
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}
