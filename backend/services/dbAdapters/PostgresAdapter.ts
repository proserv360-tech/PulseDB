// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * PostgresAdapter.js
 *
 * PostgreSQL-specific adapter using the pg driver.
 * This is the most feature-complete adapter since PostgreSQL has extensive monitoring views.
 */

import { Pool } from 'pg';
import { BaseAdapter } from './BaseAdapter.js';

export class PostgresAdapter extends BaseAdapter {
    constructor(config) {
        super(config);
        this.dbType = 'postgresql';
        this.pool = null;
    }

    getDriverName() {
        return 'PostgreSQL';
    }

    async connect() {
        try {
            // Build connection config from this.config
            const poolConfig = {
                host: this.config.host,
                port: this.config.port || 5432,
                database: this.config.database || 'postgres',
                user: this.config.user || 'postgres',
                password: this.config.password,
                connectionTimeoutMillis: 5000,
                idleTimeoutMillis: 30000,
                max: 10,
            };

            // Filter out undefined values
            Object.keys(poolConfig).forEach((key) => poolConfig[key] === undefined && delete poolConfig[key]);

            this.pool = new Pool(poolConfig);
            await this.pool.query('SELECT 1');
            this.connected = true;
        } catch (error) {
            throw new Error(`PostgreSQL connection failed: ${error.message}`);
        }
    }

    async disconnect() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            this.connected = false;
        }
    }

    async query(sql, params = []) {
        if (!this.pool) {
            throw new Error('Not connected to PostgreSQL');
        }
        const startTime = Date.now();
        const result = await this.pool.query(sql, params);
        const duration = Date.now() - startTime;
        return { ...result, duration };
    }

    async getOverviewStats() {
        const result = await this.query(`
            SELECT
                (SELECT count(*) FROM pg_stat_activity WHERE state='active')        AS active_connections,
                (SELECT count(*) FROM pg_stat_activity)                             AS total_connections,
                (SELECT pg_database_size(current_database()))                       AS db_size_bytes,
                (SELECT EXTRACT(EPOCH FROM now() - pg_postmaster_start_time()))     AS uptime_seconds,
                (SELECT version())                                                   AS version,
                ROUND((SELECT COALESCE(sum(heap_blks_hit)::numeric / NULLIF(sum(heap_blks_hit + heap_blks_read), 0), 0) * 100, 2))
                    FROM pg_statio_user_tables                                      AS cache_hit_ratio,
                COALESCE((SELECT sum(xact_commit + xact_rollback) FROM pg_stat_database WHERE datname = current_database()), 0) /
                    GREATEST(EXTRACT(EPOCH FROM now() - pg_postmaster_start_time()), 1)  AS transactions_per_sec,
                (SELECT sum(tup_inserted) FROM pg_stat_database WHERE datname = current_database())  AS tuples_inserted,
                (SELECT sum(tup_updated) FROM pg_stat_database WHERE datname = current_database())   AS tuples_updated,
                (SELECT sum(tup_deleted) FROM pg_stat_database WHERE datname = current_database())   AS tuples_deleted,
                (SELECT sum(tup_fetched) FROM pg_stat_database WHERE datname = current_database())   AS tuples_fetched
        `);

        const row = result.rows[0];
        return {
            activeConnections: this.toNumber(row.active_connections),
            totalConnections: this.toNumber(row.total_connections),
            dbSizeBytes: this.toNumber(row.db_size_bytes),
            uptimeSeconds: this.toNumber(row.uptime_seconds),
            version: row.version,
            cacheHitRatio: this.round(row.cache_hit_ratio),
            transactionsPerSec: this.round(row.transactions_per_sec),
            tuplesInserted: this.toNumber(row.tuples_inserted),
            tuplesUpdated: this.toNumber(row.tuples_updated),
            tuplesDeleted: this.toNumber(row.tuples_deleted),
            tuplesFetched: this.toNumber(row.tuples_fetched),
        };
    }

    async getPerformanceStats() {
        const result = await this.query(`
            SELECT
                COALESCE((SELECT round(avg(mean_exec_time), 2) FROM pg_stat_statements), 0)  AS avg_query_time_ms,
                (SELECT count(*) FROM pg_stat_activity WHERE state='active')                  AS active_queries,
                (SELECT count(*) FROM pg_stat_activity WHERE wait_event IS NOT NULL)          AS queries_waiting,
                ROUND((SELECT COALESCE(sum(heap_blks_hit)::numeric / NULLIF(sum(heap_blks_hit + heap_blks_read), 0), 0) * 100, 2))
                    FROM pg_statio_user_tables                                                 AS cache_hit_ratio
        `);

        const row = result.rows[0];
        return {
            avgQueryTimeMs: this.round(row.avg_query_time_ms),
            activeQueries: this.toNumber(row.active_queries),
            queriesWaiting: this.toNumber(row.queries_waiting),
            cacheHitRatio: this.round(row.cache_hit_ratio),
        };
    }

    async getTableStats() {
        const result = await this.query(`
            SELECT
                schemaname AS schema,
                tablename AS name,
                n_live_tup AS row_estimate,
                pg_total_relation_size(schemaname || '.' || tablename)::bigint AS total_size_bytes,
                pg_relation_size(schemaname || '.' || tablename, 'main')::bigint AS table_size_bytes,
                (SELECT sum(pg_relation_size(indexrelname, 'main')::bigint)
                 FROM pg_indexes WHERE schemaname = pg_stat_user_tables.schemaname
                   AND tablename = pg_stat_user_tables.tablename)  AS index_size_bytes,
                n_dead_tup AS dead_tuples,
                last_vacuum,
                last_autovacuum,
                last_analyze,
                last_autoanalyze
            FROM pg_stat_user_tables
            ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
        `);

        return result.rows.map((row) => ({
            schema: row.schema,
            name: row.name,
            rowEstimate: this.toNumber(row.row_estimate),
            totalSizeBytes: this.toNumber(row.total_size_bytes),
            tableSizeBytes: this.toNumber(row.table_size_bytes),
            indexSizeBytes: this.toNumber(row.index_size_bytes),
            deadTuples: this.toNumber(row.dead_tuples),
            lastVacuum: this.formatTimestamp(row.last_vacuum),
            lastAutovacuum: this.formatTimestamp(row.last_autovacuum),
            lastAnalyze: this.formatTimestamp(row.last_analyze),
            lastAutoanalyze: this.formatTimestamp(row.last_autoanalyze),
        }));
    }

    async getIndexStats() {
        const result = await this.query(`
            SELECT
                schemaname AS schema,
                tablename AS table,
                indexname AS name,
                pg_relation_size(indexrelname)::bigint AS size_bytes,
                idx_scan AS scans,
                idx_tup_read AS rows_read,
                idx_tup_fetch AS rows_fetched
            FROM pg_stat_user_indexes
            ORDER BY pg_relation_size(indexrelname) DESC
        `);

        return result.rows.map((row) => ({
            schema: row.schema,
            table: row.table,
            name: row.name,
            sizeBytes: this.toNumber(row.size_bytes),
            scans: this.toNumber(row.scans),
            rowsRead: this.toNumber(row.rows_read),
            rowsFetched: this.toNumber(row.rows_fetched),
        }));
    }

    async getActiveConnections() {
        const result = await this.query(`
            SELECT
                pid,
                usename AS user,
                datname AS database,
                state,
                query,
                EXTRACT(EPOCH FROM (now() - query_start))::integer AS duration_seconds,
                client_addr::text AS client_addr
            FROM pg_stat_activity
            WHERE pid != pg_backend_pid()
            ORDER BY query_start DESC
        `);

        return result.rows.map((row) => ({
            pid: this.toNumber(row.pid),
            user: row.user,
            database: row.database,
            state: row.state,
            query: row.query,
            durationSeconds: this.toNumber(row.duration_seconds),
            clientAddr: row.client_addr,
        }));
    }

    async getLockInfo() {
        const result = await this.query(`
            SELECT DISTINCT ON (blocked.pid)
                blocked.pid AS blocked_pid,
                blocking.pid AS blocking_pid,
                blocking.usename AS blocking_user,
                blocked.query AS blocked_query,
                blocking.query AS blocking_query,
                'exclusive' AS lock_mode
            FROM pg_stat_activity blocked
            JOIN pg_stat_activity blocking ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
            ORDER BY blocked.pid
        `);

        return result.rows.map((row) => ({
            blockedPid: this.toNumber(row.blocked_pid),
            blockingPid: this.toNumber(row.blocking_pid),
            blockingUser: row.blocking_user,
            blockedQuery: row.blocked_query,
            blockingQuery: row.blocking_query,
            lockMode: row.lock_mode,
        }));
    }

    async getReplicationStatus() {
        const result = await this.query(`
            SELECT
                (SELECT count(*) FROM pg_stat_replication) > 0  AS is_replica,
                (SELECT application_name FROM pg_stat_replication LIMIT 1)  AS replica_app_name,
                (SELECT COALESCE(max(pg_wal_lsn_diff(sent_lsn, replay_lsn) / 1024.0 / 1024.0), 0)
                 FROM pg_stat_replication)  AS max_replication_lag_mb,
                (SELECT count(*) FROM pg_stat_replication)  AS replica_count
        `);

        const row = result.rows[0];
        return {
            isReplica: row.is_replica,
            replicaAppName: row.replica_app_name,
            maxReplicationLagMb: this.round(row.max_replication_lag_mb),
            replicaCount: this.toNumber(row.replica_count),
        };
    }

    async getDatabaseList() {
        const result = await this.query(`
            SELECT
                datname AS name,
                pg_database_size(datname)::bigint AS size_bytes,
                datistemplate AS is_template,
                (SELECT count(*) FROM pg_stat_activity WHERE datname = pg_database.datname) AS connections
            FROM pg_database
            WHERE NOT datistemplate
            ORDER BY pg_database_size(datname) DESC
        `);

        return result.rows.map((row) => ({
            name: row.name,
            sizeBytes: this.toNumber(row.size_bytes),
            isTemplate: row.is_template,
            connections: this.toNumber(row.connections),
        }));
    }

    async getServerVersion() {
        const result = await this.query(`
            SELECT version() AS version, current_setting('server_version_num')::integer AS version_num
        `);

        const row = result.rows[0];
        const versionNum = this.toNumber(row.version_num);
        const major = Math.floor(versionNum / 10000);
        const minor = Math.floor((versionNum % 10000) / 100);

        return {
            version: row.version,
            versionNum,
            major,
            minor,
            dbType: 'postgresql',
        };
    }

    async executeQuery(sql, params = []) {
        const startTime = Date.now();
        const result = await this.query(sql, params);
        const duration = Date.now() - startTime;

        return {
            rows: result.rows,
            fields: result.fields?.map((f) => ({ name: f.name, type: f.dataTypeID })) || [],
            rowCount: result.rowCount,
            duration,
        };
    }

    async getKeyMetrics() {
        const metrics = [];

        // Cache hit ratio
        try {
            const cacheResult = await this.query(`
                SELECT round((sum(heap_blks_hit)::numeric / NULLIF(sum(heap_blks_hit + heap_blks_read), 0)) * 100, 2) AS ratio
                FROM pg_statio_user_tables
            `);
            const cacheRatio = this.toNumber(cacheResult.rows[0]?.ratio, 0);
            metrics.push({
                id: 'cache_hit_ratio',
                label: 'Cache Hit Ratio',
                value: cacheRatio,
                unit: '%',
                category: 'performance',
                severity: cacheRatio >= 99 ? 'ok' : cacheRatio >= 90 ? 'warning' : 'critical',
                thresholds: { warning: 90, critical: 80 },
                description: 'Percentage of buffer cache hits for user tables',
                dbSpecific: false,
            });
        } catch {
            /* pg_statio_user_tables may not exist */
        }

        // Active connections
        try {
            const connResult = await this.query(`
                SELECT count(*) AS active FROM pg_stat_activity WHERE state = 'active'
            `);
            const activeConn = this.toNumber(connResult.rows[0]?.active, 0);
            metrics.push({
                id: 'active_connections',
                label: 'Active Connections',
                value: activeConn,
                unit: 'count',
                category: 'connections',
                severity: activeConn > 100 ? 'warning' : activeConn > 200 ? 'critical' : 'ok',
                thresholds: { warning: 100, critical: 200 },
                description: 'Number of active database connections',
                dbSpecific: false,
            });
        } catch {
            /* */
        }

        // Database size
        try {
            const sizeResult = await this.query(`
                SELECT pg_database_size(current_database()) AS size_bytes
            `);
            const sizeBytes = this.toNumber(sizeResult.rows[0]?.size_bytes, 0);
            const sizeGb = this.round(sizeBytes / 1024 / 1024 / 1024, 2);
            metrics.push({
                id: 'database_size',
                label: 'Database Size',
                value: sizeGb,
                unit: 'GB',
                category: 'storage',
                severity: sizeGb > 500 ? 'warning' : sizeGb > 1000 ? 'critical' : 'ok',
                thresholds: { warning: 500, critical: 1000 },
                description: 'Total size of the current database',
                dbSpecific: false,
            });
        } catch {
            /* */
        }

        // Replication lag
        try {
            const repResult = await this.query(`
                SELECT COALESCE(max(pg_wal_lsn_diff(sent_lsn, replay_lsn) / 1024.0 / 1024.0), 0) AS lag_mb
                FROM pg_stat_replication
            `);
            const lagMb = this.round(repResult.rows[0]?.lag_mb, 2);
            metrics.push({
                id: 'replication_lag_mb',
                label: 'Replication Lag',
                value: lagMb,
                unit: 'MB',
                category: 'replication',
                severity: lagMb > 500 ? 'critical' : lagMb > 100 ? 'warning' : 'ok',
                thresholds: { warning: 100, critical: 500 },
                description: 'Maximum WAL replication lag across all replicas',
                dbSpecific: true,
            });
        } catch {
            /* No replicas or feature not available */
        }

        // Transaction rate
        try {
            const txnResult = await this.query(`
                SELECT (sum(xact_commit + xact_rollback) /
                    GREATEST(EXTRACT(EPOCH FROM now() - pg_postmaster_start_time()), 1))::numeric(10, 2) AS txn_per_sec
                FROM pg_stat_database WHERE datname = current_database()
            `);
            const txnRate = this.toNumber(txnResult.rows[0]?.txn_per_sec, 0);
            metrics.push({
                id: 'transaction_rate',
                label: 'Transaction Rate',
                value: txnRate,
                unit: 'tx/sec',
                category: 'performance',
                severity: 'ok',
                thresholds: { warning: 10000, critical: 50000 },
                description: 'Transactions per second (commits + rollbacks)',
                dbSpecific: false,
            });
        } catch {
            /* */
        }

        return metrics;
    }

    /**
     * Live wait-event snapshot from pg_stat_activity. Postgres does not track
     * cumulative wait time without an extension (pg_wait_sampling), so this
     * reports the number of backends currently blocked on each wait event —
     * the same signal every extension-free PG monitor uses. Shape matches
     * waitEventsService (events: [{ event, waiters }]).
     */
    async getWaitEvents() {
        const result = await this.query(`
            SELECT pid, wait_event_type, wait_event, state,
                   usename AS username, application_name,
                   left(query, 180) AS query,
                   GREATEST(0, extract(epoch FROM (now() - state_change)))::int AS wait_seconds
              FROM pg_stat_activity
             WHERE wait_event IS NOT NULL
               AND pid <> pg_backend_pid()
             ORDER BY (now() - state_change) DESC NULLS LAST
             LIMIT 500
        `);
        const groups = new Map();
        for (const r of result.rows) {
            const type = r.wait_event_type || 'Other';
            const waitEvent = r.wait_event || 'unknown';
            const key = `${type}: ${waitEvent}`;
            if (!groups.has(key)) groups.set(key, { event: key, type, waitEvent, waiters: 0, sessions: [] });
            const g = groups.get(key);
            g.waiters += 1;
            if (g.sessions.length < 8) {
                g.sessions.push({
                    pid: this.toNumber(r.pid),
                    state: r.state || null,
                    user: r.username || null,
                    application: r.application_name || null,
                    query: (r.query || '').trim() || null,
                    waitSeconds: this.toNumber(r.wait_seconds),
                });
            }
        }
        const events = [...groups.values()].sort((a, b) => b.waiters - a.waiters);
        return {
            window: 'now',
            events,
            note: 'Live snapshot of backends currently waiting (pg_stat_activity). Install pg_wait_sampling for cumulative wait time.',
        };
    }

    getCapabilities() {
        return {
            ...super.getCapabilities(),
            replication: true,
            vacuum: true,
            indexes: true,
            locks: true,
            queryPlan: true,
            explain: true,
            wal: true,
            schemas: true,
            storedProcedures: true,
            triggers: true,
            partitioning: true,
            sharding: false,
            waitEvents: true,
            queryHistory: true, // pg_stat_statements (if installed)
            slowQueryLog: true,
            backup: false, // wired in B8
            restore: false,
        };
    }
}

export default PostgresAdapter;
