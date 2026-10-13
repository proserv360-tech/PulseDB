// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * RedshiftAdapter.js
 *
 * AWS Redshift adapter. Redshift speaks the Postgres wire protocol, so we
 * reuse the `pg` driver — but override the performance and bloat queries
 * because Redshift's system catalogs (STV_/SVL_/SVV_) are a different shape
 * from Postgres' pg_stat_*.
 *
 * Monitoring surface:
 *   • SVV_TABLE_INFO          — per-table size, skew, stats-missing flag.
 *   • STL_QUERY / SVL_QLOG    — slow query sampling.
 *   • STV_SESSIONS            — active sessions.
 *   • STV_WLM_QUERY_STATE     — WLM queue + currently-running queries.
 */

import { BaseAdapter } from './BaseAdapter.js';

// Lazy driver load (was a top-level await — see MSSQLAdapter note).
let pg: any;
let _pgLoading: Promise<any> | null = null;
async function ensureDriver() {
    if (pg !== undefined) return pg;
    if (!_pgLoading) {
        _pgLoading = (async () => {
            try {
                const moduleId = 'pg';
                pg = (await import(moduleId)).default || (await import(moduleId));
            } catch {
                pg = null;
            }
        })();
    }
    await _pgLoading;
    return pg;
}

export class RedshiftAdapter extends BaseAdapter {
    constructor(config) {
        super(config);
        this.dbType = 'redshift';
        this.pool = null;
    }

    getDriverName() {
        return 'pg (Redshift mode)';
    }

    _checkDriver() {
        if (!pg) throw new Error('Postgres driver (pg) not installed. Install with: npm install pg');
    }

    async connect() {
        await ensureDriver();
        this._checkDriver();
        const cfg = this.config || {};
        this.pool = new pg.Pool({
            host: cfg.host,
            port: cfg.port || 5439, // default Redshift port
            user: cfg.user,
            password: cfg.password,
            database: cfg.database,
            ssl: cfg.ssl ?? { rejectUnauthorized: false },
            max: cfg.maxConnections || 5,
            connectionTimeoutMillis: 15_000,
            statement_timeout: 60_000,
        });
        // Probe.
        const c = await this.pool.connect();
        try {
            await c.query('SELECT 1');
        } finally {
            c.release();
        }
        this.connected = true;
    }

    async disconnect() {
        if (this.pool) await this.pool.end();
        this.pool = null;
        this.connected = false;
    }

    async executeQuery(sql, params = []) {
        this._checkDriver();
        return this.pool.query(sql, params);
    }

    async getServerVersion() {
        const { rows } = await this.executeQuery('SELECT version()');
        return { version: rows[0]?.version || 'unknown', engine: 'redshift' };
    }

    async getDatabaseList() {
        const { rows } = await this.executeQuery(`SELECT datname AS name FROM pg_database WHERE datistemplate = false`);
        return rows;
    }

    async getOverviewStats() {
        // Queries-in-last-hour + cluster name.
        const { rows: qrows } = await this.executeQuery(
            `SELECT COUNT(*) AS queries_1h
               FROM STL_QUERY
              WHERE starttime > GETDATE() - INTERVAL '1 hour'`,
        ).catch(() => ({ rows: [{ queries_1h: 0 }] }));
        return {
            queries_1h: Number(qrows[0]?.queries_1h) || 0,
            engine: 'redshift',
        };
    }

    async getPerformanceStats() {
        const { rows } = await this.executeQuery(
            `SELECT query, LEFT(querytxt, 500) AS sql,
                    DATEDIFF(milliseconds, starttime, endtime) AS elapsed_ms,
                    userid
               FROM STL_QUERY
              WHERE starttime > GETDATE() - INTERVAL '1 hour'
              ORDER BY elapsed_ms DESC NULLS LAST
              LIMIT 20`,
        ).catch(() => ({ rows: [] }));
        return { slow_queries: rows };
    }

    async getTableStats() {
        const { rows } = await this.executeQuery(
            `SELECT "schema", "table", size, tbl_rows, skew_rows, unsorted, stats_off
               FROM SVV_TABLE_INFO
              ORDER BY size DESC NULLS LAST
              LIMIT 200`,
        ).catch(() => ({ rows: [] }));
        return rows.map((r) => ({
            schema: r.schema,
            name: r.table,
            rows: Number(r.tbl_rows) || 0,
            size_mb: Number(r.size) || 0,
            skew_rows: Number(r.skew_rows) || 0,
            unsorted_pct: Number(r.unsorted) || 0,
            stats_stale: r.stats_off > 10,
        }));
    }

    /**
     * Reclaimable-space signal for the storage advisor. Redshift keeps deleted
     * rows and unsorted regions on disk until VACUUM runs, so the `unsorted`
     * percentage from SVV_TABLE_INFO approximates the on-disk region VACUUM
     * will reclaim/reorganize (size is in 1 MB blocks). Normalized to the
     * analyzeFragmentation shape.
     */
    async getFragmentation() {
        const { rows } = await this.executeQuery(
            `SELECT "schema", "table" AS name, size AS size_mb, tbl_rows, unsorted
               FROM SVV_TABLE_INFO
              WHERE unsorted IS NOT NULL AND unsorted > 0
              ORDER BY size DESC NULLS LAST
              LIMIT 500`,
        ).catch(() => ({ rows: [] }));
        return rows.map((r) => {
            const sizeBytes = (Number(r.size_mb) || 0) * 1024 * 1024;
            const unsortedPct = Math.min(100, Math.max(0, Number(r.unsorted) || 0));
            const dataFree = Math.round((sizeBytes * unsortedPct) / 100);
            return {
                schema: r.schema,
                name: r.name,
                rowEstimate: Number(r.tbl_rows) || 0,
                dataLengthBytes: Math.max(0, sizeBytes - dataFree),
                indexLengthBytes: 0,
                dataFreeBytes: dataFree,
            };
        });
    }

    // Redshift "indexes" = sort keys + dist keys. Surfaced so the UI's
    // Indexes tab shows the actual performance-relevant structures.
    async getIndexStats() {
        const { rows } = await this.executeQuery(
            `SELECT "schema", "table",
                    diststyle, sortkey1, sortkey_num, encoded,
                    tbl_rows, unsorted, stats_off
               FROM SVV_TABLE_INFO
              ORDER BY tbl_rows DESC NULLS LAST
              LIMIT 200`,
        ).catch(() => ({ rows: [] }));
        return rows.map((r) => ({
            schema: r.schema,
            table: r.table,
            kind: 'sort_dist_key',
            diststyle: r.diststyle,
            sortkey: r.sortkey1,
            sortkey_cols: Number(r.sortkey_num) || 0,
            encoded: r.encoded === true || r.encoded === 't',
            unsorted_pct: Number(r.unsorted) || 0,
            stats_stale: Number(r.stats_off) > 10,
            engine_native: 'redshift',
        }));
    }

    async getActiveConnections() {
        const { rows } = await this.executeQuery(
            `SELECT process, user_name, db_name, starttime FROM STV_SESSIONS`,
        ).catch(() => ({ rows: [] }));
        return rows.map((r) => ({
            session: String(r.process),
            user: r.user_name,
            db: r.db_name,
            started: r.starttime,
        }));
    }

    // STV_LOCKS requires the `pg_read_all_settings` role. We try it; if it
    // returns permission-denied, we surface the equivalent signal from
    // STV_WLM_QUERY_STATE (queries that are WAITING).
    async getLockInfo() {
        try {
            const { rows } = await this.executeQuery(
                `SELECT txn_owner, table_id, lock_mode, granted, relation, txn_start
                   FROM STV_LOCKS`,
            );
            return {
                kind: 'lock_table',
                locks: rows.map((r) => ({
                    owner: r.txn_owner,
                    relation: r.relation,
                    lock_mode: r.lock_mode,
                    granted: r.granted,
                    started: r.txn_start,
                })),
            };
        } catch {
            // Fallback: WLM waiters.
            const { rows } = await this.executeQuery(
                `SELECT query, userid, service_class, state, query_priority,
                        queue_start_time, queue_end_time,
                        DATEDIFF(seconds, queue_start_time, GETDATE()) AS queue_sec
                   FROM STV_WLM_QUERY_STATE
                  WHERE state IN ('Queued', 'Waiting')`,
            ).catch(() => ({ rows: [] }));
            return {
                kind: 'wlm_waiters',
                locks: rows.map((r) => ({
                    query_id: String(r.query),
                    user_id: r.userid,
                    queue: r.service_class,
                    state: r.state,
                    priority: r.query_priority,
                    queued_sec: Number(r.queue_sec) || 0,
                })),
                note: 'STV_LOCKS requires elevated role; showing WLM waiters as lock-equivalent.',
            };
        }
    }

    // Cluster topology + snapshot + cross-region replica info.
    async getReplicationStatus() {
        const [nodes, db] = await Promise.all([
            this.executeQuery('SELECT node, slice, used, capacity FROM STV_NODE_STORAGE_CAPACITY').catch(() => ({
                rows: [],
            })),
            this.executeQuery('SELECT current_database() AS db, version() AS ver'),
        ]);
        return {
            kind: 'cluster_topology',
            replicas: nodes.rows.map((n) => ({
                node: String(n.node),
                slice: String(n.slice),
                used_mb: Number(n.used) || 0,
                cap_mb: Number(n.capacity) || 0,
            })),
            database: db.rows[0]?.db,
            version: db.rows[0]?.ver,
            note: 'Cross-region snapshot replication is configured outside the cluster; check AWS console / CloudFormation.',
        };
    }

    // WLM queue + execution time breakdown for the last hour.
    async getWaitEvents() {
        const { rows } = await this.executeQuery(
            `SELECT service_class_name,
                    SUM(DATEDIFF(milliseconds, queue_start_time, queue_end_time)) AS queue_ms,
                    SUM(DATEDIFF(milliseconds, exec_start_time,  exec_end_time))  AS exec_ms,
                    COUNT(*) AS query_count
               FROM STL_WLM_QUERY
              WHERE queue_end_time > GETDATE() - INTERVAL '1 hour'
              GROUP BY service_class_name
              ORDER BY query_count DESC`,
        ).catch(() => ({ rows: [] }));
        return {
            window: '1h',
            events: rows.map((r) => ({
                queue: r.service_class_name,
                queue_ms: Number(r.queue_ms) || 0,
                exec_ms: Number(r.exec_ms) || 0,
                query_count: Number(r.query_count) || 0,
            })),
        };
    }

    // Bloat-equivalent = unsorted_pct + stats_off combined (already partial
    // in getTableStats; expose a dedicated view here for the bloat panel).
    async getBloatInfo() {
        const { rows } = await this.executeQuery(
            `SELECT "schema", "table", tbl_rows, size, unsorted, stats_off
               FROM SVV_TABLE_INFO
              WHERE unsorted > 10 OR stats_off > 10
              ORDER BY unsorted DESC NULLS LAST
              LIMIT 100`,
        ).catch(() => ({ rows: [] }));
        return rows.map((r) => ({
            schema: r.schema,
            table: r.table,
            rows: Number(r.tbl_rows) || 0,
            size_mb: Number(r.size) || 0,
            unsorted_pct: Number(r.unsorted) || 0,
            stats_off: Number(r.stats_off) || 0,
            action: (Number(r.unsorted) || 0) > 20 ? 'VACUUM needed' : 'ANALYZE needed',
        }));
    }

    // EXPLAIN via the pg wire protocol.
    async getPlanForQuery(sql) {
        const { rows } = await this.executeQuery(`EXPLAIN ${sql}`);
        return { engine: 'redshift', plan: rows.map((r) => r['QUERY PLAN'] ?? Object.values(r)[0]) };
    }

    async getKeyMetrics() {
        return await this.getOverviewStats();
    }

    /**
     * Redshift is a columnar MPP fork of PostgreSQL 8.0. It exposes rich
     * query introspection through STL/SVL/SVV system views but has no
     * PG-style VACUUM/WAL semantics, and uses sort/dist keys rather than
     * btree indexes. Locks are observable via STV_LOCKS.
     */
    getCapabilities() {
        return {
            ...super.getCapabilities(),
            replication: true,
            schemas: true,
            partitioning: true,
            sharding: false,
            vacuum: false,
            wal: false,
            queryPlan: true,
            explain: true,
            indexes: true,
            locks: true,
            waitEvents: true,
            queryHistory: true,
            slowQueryLog: true,
            storedProcedures: true,
            triggers: false,
            backup: true,
            restore: true,
        };
    }
}

export default RedshiftAdapter;
