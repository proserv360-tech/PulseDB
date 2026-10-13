// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * MySQLAdapter.js
 *
 * MySQL/MariaDB-specific adapter using the mysql2 driver.
 * Note: The mysql2 package should be added to dependencies.
 *
 * Metrics sourced from:
 * - SHOW GLOBAL STATUS for server stats
 * - information_schema for structural info
 * - performance_schema for advanced metrics
 * - SHOW PROCESSLIST for connections
 */

import { BaseAdapter } from './BaseAdapter.js';

// Lazy driver load (was a top-level await, which made importing this
// module — and therefore server boot — pay the driver's full load cost
// even when no mysql2 connection exists; brutal for serverless cold starts).
let mysql2: any;
let _mysql2Loading: Promise<any> | null = null;
async function ensureDriver() {
    if (mysql2 !== undefined) return mysql2;
    if (!_mysql2Loading) {
        _mysql2Loading = import('mysql2/promise').then(
            (m) => (mysql2 = m),
            () => (mysql2 = null),
        );
    }
    await _mysql2Loading;
    return mysql2;
}

export class MySQLAdapter extends BaseAdapter {
    constructor(config) {
        super(config);
        this.dbType = 'mysql';
        this.connection = null;
    }

    getDriverName() {
        return 'MySQL/MariaDB';
    }

    _checkDriver() {
        if (!mysql2) {
            throw new Error('MySQL driver (mysql2) not installed. Install with: npm install mysql2');
        }
    }

    async connect() {
        await ensureDriver();
        this._checkDriver();
        try {
            this.connection = await mysql2.createConnection({
                host: this.config.host,
                port: this.config.port || 3306,
                database: this.config.database || 'mysql',
                user: this.config.user || 'root',
                password: this.config.password,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
                enableKeepAlive: true,
                keepAliveInitialDelayMs: 0,
            });

            await this.connection.ping();
            this.connected = true;
        } catch (error) {
            throw new Error(`MySQL connection failed: ${error.message}`);
        }
    }

    async disconnect() {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
            this.connected = false;
        }
    }

    async query(sql) {
        if (!this.connection) {
            throw new Error('Not connected to MySQL');
        }
        const startTime = Date.now();
        const [rows] = await this.connection.query(sql);
        const duration = Date.now() - startTime;
        return { rows, duration };
    }

    async getOverviewStats() {
        const statusResult = await this.query(`SHOW GLOBAL STATUS`);
        const statusMap = {};
        statusResult.rows.forEach((row) => {
            statusMap[row.Variable_name] = row.Value;
        });

        const varResult = await this.query(`SHOW GLOBAL VARIABLES LIKE 'max_connections'`);
        const maxConn = varResult.rows[0]?.Value || 100;

        const dbResult = await this.query(`
            SELECT table_schema, SUM(data_length + index_length) as size_bytes
            FROM information_schema.tables
            GROUP BY table_schema
        `);

        let dbSize = 0;
        dbResult.rows.forEach((row) => {
            if (row.table_schema !== 'information_schema' && row.table_schema !== 'mysql') {
                dbSize += this.toNumber(row.size_bytes);
            }
        });

        const cacheRatio = this._calculateCacheHitRatio(statusMap);
        const txnRate = this._calculateTxnRate(statusMap);

        return {
            activeConnections: this.toNumber(statusMap.Threads_connected),
            totalConnections: this.toNumber(maxConn),
            dbSizeBytes: dbSize,
            uptimeSeconds: this.toNumber(statusMap.Uptime),
            version: statusMap.version || statusMap.version_comment || 'Unknown',
            cacheHitRatio: cacheRatio,
            transactionsPerSec: txnRate,
            tuplesInserted: this.toNumber(statusMap.Innodb_rows_inserted),
            tuplesUpdated: this.toNumber(statusMap.Innodb_rows_updated),
            tuplesDeleted: this.toNumber(statusMap.Innodb_rows_deleted),
            tuplesFetched: this.toNumber(statusMap.Innodb_rows_read),
        };
    }

    async getPerformanceStats() {
        const statusResult = await this.query(`SHOW GLOBAL STATUS`);
        const statusMap = {};
        statusResult.rows.forEach((row) => {
            statusMap[row.Variable_name] = row.Value;
        });

        const procResult = await this.query(`SHOW PROCESSLIST`);
        const activeQueries = procResult.rows.filter((p) => p.Command !== 'Sleep').length;
        const queriesWaiting = procResult.rows.filter((p) => p.State && p.State.includes('wait')).length;

        const cacheRatio = this._calculateCacheHitRatio(statusMap);
        const avgQueryTime = this.toNumber(statusMap.Slow_queries) > 0 ? 1000 : 10; // Approximate

        return {
            avgQueryTimeMs: avgQueryTime,
            activeQueries: activeQueries,
            queriesWaiting: queriesWaiting,
            cacheHitRatio: cacheRatio,
        };
    }

    async getTableStats() {
        const result = await this.query(`
            SELECT
                table_schema as \`schema\`,
                table_name as name,
                table_rows as row_estimate,
                (data_length + index_length) as total_size_bytes,
                data_length as table_size_bytes,
                index_length as index_size_bytes,
                0 as dead_tuples,
                update_time as last_update
            FROM information_schema.tables
            WHERE table_schema NOT IN ('information_schema', 'mysql', 'performance_schema')
            ORDER BY (data_length + index_length) DESC
        `);

        return result.rows.map((row) => ({
            schema: row.schema,
            name: row.name,
            rowEstimate: this.toNumber(row.row_estimate),
            totalSizeBytes: this.toNumber(row.total_size_bytes),
            tableSizeBytes: this.toNumber(row.table_size_bytes),
            indexSizeBytes: this.toNumber(row.index_size_bytes),
            deadTuples: 0,
            lastVacuum: null,
            lastAutovacuum: null,
            lastAnalyze: null,
            lastAutoanalyze: null,
        }));
    }

    /**
     * InnoDB reclaimable-space signal for the storage advisor. `data_free` is
     * space allocated to the tablespace but not used by rows; it is only
     * returned to the filesystem by a table rebuild (OPTIMIZE TABLE).
     */
    async getFragmentation() {
        const result = await this.query(`
            SELECT
                table_schema  AS \`schema\`,
                table_name    AS name,
                table_rows    AS row_estimate,
                data_length   AS data_length_bytes,
                index_length  AS index_length_bytes,
                data_free     AS data_free_bytes
            FROM information_schema.tables
            WHERE table_schema NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
              AND engine = 'InnoDB'
              AND data_free > 0
            ORDER BY data_free DESC
            LIMIT 500
        `);

        return result.rows.map((row) => ({
            schema: row.schema,
            name: row.name,
            rowEstimate: this.toNumber(row.row_estimate),
            dataLengthBytes: this.toNumber(row.data_length_bytes),
            indexLengthBytes: this.toNumber(row.index_length_bytes),
            dataFreeBytes: this.toNumber(row.data_free_bytes),
        }));
    }

    async getIndexStats() {
        const result = await this.query(`
            SELECT
                table_schema as \`schema\`,
                table_name as \`table\`,
                index_name as name,
                stat_value as size_bytes,
                0 as scans,
                0 as rows_read,
                0 as rows_fetched
            FROM information_schema.innodb_trx
            LIMIT 0
        `);

        // MySQL doesn't expose detailed index stats in information_schema like PostgreSQL
        // Return empty for now — could be enhanced with performance_schema queries
        return [];
    }

    async getActiveConnections() {
        const result = await this.query(`
            SELECT
                ID as pid,
                USER as user,
                DB as database,
                COMMAND as state,
                INFO as query,
                TIME as duration_seconds,
                HOST as client_addr
            FROM information_schema.processlist
            WHERE COMMAND != 'Sleep'
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
        try {
            const result = await this.query(`
                SELECT
                    waiting_trx_id as blocked_pid,
                    blocking_trx_id as blocking_pid,
                    'exclusive' as lock_mode
                FROM information_schema.innodb_locks
                LIMIT 0
            `);
            return [];
        } catch {
            // Lock info may not be available depending on MySQL version
            return [];
        }
    }

    async getReplicationStatus() {
        try {
            const result = await this.query(`SHOW SLAVE STATUS`);
            if (result.rows.length === 0) {
                return {
                    isReplica: false,
                    replicaAppName: null,
                    maxReplicationLagMb: 0,
                    replicaCount: 0,
                };
            }

            const row = result.rows[0];
            return {
                isReplica: true,
                replicaAppName: row.Master_User || 'unknown',
                maxReplicationLagMb: this.toNumber(row.Seconds_Behind_Master, 0),
                replicaCount: 0,
            };
        } catch {
            return {
                isReplica: false,
                replicaAppName: null,
                maxReplicationLagMb: 0,
                replicaCount: 0,
            };
        }
    }

    async getDatabaseList() {
        const result = await this.query(`
            SELECT
                table_schema as name,
                SUM(data_length + index_length) as size_bytes
            FROM information_schema.tables
            WHERE table_schema NOT IN ('information_schema', 'mysql', 'performance_schema')
            GROUP BY table_schema
        `);

        return result.rows.map((row) => ({
            name: row.name,
            sizeBytes: this.toNumber(row.size_bytes),
            isTemplate: false,
            connections: 0, // Would need to count from processlist per schema
        }));
    }

    async getServerVersion() {
        const result = await this.query(`SELECT VERSION() as version`);
        const versionStr = result.rows[0]?.version || 'Unknown';

        // Parse version string like "8.0.28-0ubuntu0.20.04.3"
        const parts = versionStr.split('.');
        const major = this.toNumber(parts[0], 0);
        const minor = this.toNumber(parts[1], 0);

        return {
            version: versionStr,
            versionNum: major * 10000 + minor * 100,
            major,
            minor,
            dbType: 'mysql',
        };
    }

    async executeQuery(sql) {
        const startTime = Date.now();
        const [rows] = await this.connection.query(sql);
        const duration = Date.now() - startTime;

        const fields =
            rows.length > 0 ? Object.keys(rows[0]).map((name) => ({ name, type: typeof rows[0][name] })) : [];

        return {
            rows,
            fields,
            rowCount: rows.length,
            duration,
        };
    }

    async getKeyMetrics() {
        const metrics = [];

        try {
            const statusResult = await this.query(`SHOW GLOBAL STATUS`);
            const statusMap = {};
            statusResult.rows.forEach((row) => {
                statusMap[row.Variable_name] = row.Value;
            });

            // 1. Buffer pool hit ratio
            const cacheRatio = this._calculateCacheHitRatio(statusMap);
            metrics.push({
                id: 'buffer_pool_hit_ratio',
                label: 'Buffer Pool Hit Ratio',
                value: cacheRatio,
                unit: '%',
                category: 'performance',
                severity: cacheRatio >= 99 ? 'ok' : cacheRatio >= 90 ? 'warning' : 'critical',
                thresholds: { warning: 90, critical: 80 },
                description: 'InnoDB buffer pool cache hit ratio',
                dbSpecific: false,
            });

            // 2. Active connections
            const activeConn = this.toNumber(statusMap.Threads_connected, 0);
            metrics.push({
                id: 'active_connections',
                label: 'Active Connections',
                value: activeConn,
                unit: 'count',
                category: 'connections',
                severity: activeConn > 100 ? 'warning' : activeConn > 200 ? 'critical' : 'ok',
                thresholds: { warning: 100, critical: 200 },
                description: 'Number of open connections',
                dbSpecific: false,
            });

            // 3. Threads running
            const threadsRunning = this.toNumber(statusMap.Threads_running, 0);
            metrics.push({
                id: 'threads_running',
                label: 'Threads Running',
                value: threadsRunning,
                unit: 'count',
                category: 'performance',
                severity: threadsRunning > 50 ? 'warning' : threadsRunning > 100 ? 'critical' : 'ok',
                thresholds: { warning: 50, critical: 100 },
                description: 'Number of currently executing threads',
                dbSpecific: true,
            });

            // 4. Threads cached
            const threadsCached = this.toNumber(statusMap.Threads_cached, 0);
            metrics.push({
                id: 'threads_cached',
                label: 'Threads Cached',
                value: threadsCached,
                unit: 'count',
                category: 'performance',
                severity: threadsCached > 0 ? 'ok' : 'warning',
                thresholds: { warning: 0, critical: -1 },
                description: 'Number of cached threads',
                dbSpecific: true,
            });

            // 5. Slow queries
            const slowQueries = this.toNumber(statusMap.Slow_queries, 0);
            metrics.push({
                id: 'slow_queries',
                label: 'Slow Queries',
                value: slowQueries,
                unit: 'count',
                category: 'performance',
                severity: slowQueries > 100 ? 'critical' : slowQueries > 10 ? 'warning' : 'ok',
                thresholds: { warning: 10, critical: 100 },
                description: 'Number of queries taking longer than long_query_time',
                dbSpecific: true,
            });

            // 6. InnoDB deadlocks
            const deadlocks = this.toNumber(statusMap.Innodb_deadlocks, 0);
            metrics.push({
                id: 'innodb_deadlocks',
                label: 'InnoDB Deadlocks',
                value: deadlocks,
                unit: 'count',
                category: 'locks',
                severity: deadlocks > 10 ? 'critical' : deadlocks > 0 ? 'warning' : 'ok',
                thresholds: { warning: 0, critical: 10 },
                description: 'Number of InnoDB deadlocks',
                dbSpecific: true,
            });

            // 7. InnoDB row lock waits
            const rowLockWaits = this.toNumber(statusMap.Innodb_row_lock_waits, 0);
            metrics.push({
                id: 'innodb_row_lock_waits',
                label: 'InnoDB Row Lock Waits',
                value: rowLockWaits,
                unit: 'count',
                category: 'locks',
                severity: rowLockWaits > 100 ? 'critical' : rowLockWaits > 10 ? 'warning' : 'ok',
                thresholds: { warning: 10, critical: 100 },
                description: 'Number of times row locks were waited for',
                dbSpecific: true,
            });

            // 8. InnoDB row lock time average
            const rowLockTimeAvg = this.toNumber(statusMap.Innodb_row_lock_time_avg, 0);
            metrics.push({
                id: 'innodb_row_lock_time_avg',
                label: 'InnoDB Row Lock Avg Time',
                value: rowLockTimeAvg,
                unit: 'ms',
                category: 'locks',
                severity: rowLockTimeAvg > 100 ? 'critical' : rowLockTimeAvg > 10 ? 'warning' : 'ok',
                thresholds: { warning: 10, critical: 100 },
                description: 'Average time (ms) for row locks',
                dbSpecific: true,
            });

            // 9. Bytes sent
            const bytesSent = this.toNumber(statusMap.Bytes_sent, 0);
            metrics.push({
                id: 'bytes_sent',
                label: 'Bytes Sent',
                value: bytesSent,
                unit: 'bytes',
                category: 'performance',
                severity: 'ok',
                thresholds: { warning: 1000000000, critical: 5000000000 },
                description: 'Total bytes sent to clients',
                dbSpecific: false,
            });

            // 10. Bytes received
            const bytesReceived = this.toNumber(statusMap.Bytes_received, 0);
            metrics.push({
                id: 'bytes_received',
                label: 'Bytes Received',
                value: bytesReceived,
                unit: 'bytes',
                category: 'performance',
                severity: 'ok',
                thresholds: { warning: 1000000000, critical: 5000000000 },
                description: 'Total bytes received from clients',
                dbSpecific: false,
            });

            // 11. Select rate
            const comSelect = this.toNumber(statusMap.Com_select, 0);
            const uptime = this.toNumber(statusMap.Uptime, 1);
            const selectRate = uptime > 0 ? this.round(comSelect / uptime, 2) : 0;
            metrics.push({
                id: 'select_rate',
                label: 'SELECT Rate',
                value: selectRate,
                unit: 'queries/sec',
                category: 'performance',
                severity: selectRate > 10000 ? 'critical' : selectRate > 1000 ? 'warning' : 'ok',
                thresholds: { warning: 1000, critical: 10000 },
                description: 'SELECT queries per second',
                dbSpecific: false,
            });

            // 12. Insert rate
            const comInsert = this.toNumber(statusMap.Com_insert, 0);
            const insertRate = uptime > 0 ? this.round(comInsert / uptime, 2) : 0;
            metrics.push({
                id: 'insert_rate',
                label: 'INSERT Rate',
                value: insertRate,
                unit: 'queries/sec',
                category: 'performance',
                severity: insertRate > 5000 ? 'critical' : insertRate > 500 ? 'warning' : 'ok',
                thresholds: { warning: 500, critical: 5000 },
                description: 'INSERT queries per second',
                dbSpecific: false,
            });

            // 13. Update rate
            const comUpdate = this.toNumber(statusMap.Com_update, 0);
            const updateRate = uptime > 0 ? this.round(comUpdate / uptime, 2) : 0;
            metrics.push({
                id: 'update_rate',
                label: 'UPDATE Rate',
                value: updateRate,
                unit: 'queries/sec',
                category: 'performance',
                severity: updateRate > 5000 ? 'critical' : updateRate > 500 ? 'warning' : 'ok',
                thresholds: { warning: 500, critical: 5000 },
                description: 'UPDATE queries per second',
                dbSpecific: false,
            });

            // 14. Delete rate
            const comDelete = this.toNumber(statusMap.Com_delete, 0);
            const deleteRate = uptime > 0 ? this.round(comDelete / uptime, 2) : 0;
            metrics.push({
                id: 'delete_rate',
                label: 'DELETE Rate',
                value: deleteRate,
                unit: 'queries/sec',
                category: 'performance',
                severity: deleteRate > 1000 ? 'critical' : deleteRate > 100 ? 'warning' : 'ok',
                thresholds: { warning: 100, critical: 1000 },
                description: 'DELETE queries per second',
                dbSpecific: false,
            });

            // 15. Open tables
            const openTables = this.toNumber(statusMap.Open_tables, 0);
            metrics.push({
                id: 'open_tables',
                label: 'Open Tables',
                value: openTables,
                unit: 'count',
                category: 'performance',
                severity: openTables > 1000 ? 'critical' : openTables > 500 ? 'warning' : 'ok',
                thresholds: { warning: 500, critical: 1000 },
                description: 'Number of currently open tables',
                dbSpecific: true,
            });

            // 16. Table locks waited
            const tableLockWaited = this.toNumber(statusMap.Table_locks_waited, 0);
            metrics.push({
                id: 'table_locks_waited',
                label: 'Table Locks Waited',
                value: tableLockWaited,
                unit: 'count',
                category: 'locks',
                severity: tableLockWaited > 100 ? 'critical' : tableLockWaited > 10 ? 'warning' : 'ok',
                thresholds: { warning: 10, critical: 100 },
                description: 'Number of table lock waits',
                dbSpecific: true,
            });

            // 17. Tmp disk tables
            const tmpDiskTables = this.toNumber(statusMap.Created_tmp_disk_tables, 0);
            metrics.push({
                id: 'tmp_disk_tables',
                label: 'Temporary Disk Tables',
                value: tmpDiskTables,
                unit: 'count',
                category: 'performance',
                severity: tmpDiskTables > 1000 ? 'critical' : tmpDiskTables > 100 ? 'warning' : 'ok',
                thresholds: { warning: 100, critical: 1000 },
                description: 'Number of temporary tables created on disk',
                dbSpecific: true,
            });

            // 18. Aborted connections
            const abortedConnections = this.toNumber(statusMap.Aborted_connects, 0);
            metrics.push({
                id: 'aborted_connections',
                label: 'Aborted Connections',
                value: abortedConnections,
                unit: 'count',
                category: 'connections',
                severity: abortedConnections > 100 ? 'critical' : abortedConnections > 10 ? 'warning' : 'ok',
                thresholds: { warning: 10, critical: 100 },
                description: 'Number of failed connection attempts',
                dbSpecific: true,
            });

            // 19. Sort merge passes
            const sortMergePasses = this.toNumber(statusMap.Sort_merge_passes, 0);
            metrics.push({
                id: 'sort_merge_passes',
                label: 'Sort Merge Passes',
                value: sortMergePasses,
                unit: 'count',
                category: 'performance',
                severity: sortMergePasses > 1000 ? 'critical' : sortMergePasses > 100 ? 'warning' : 'ok',
                thresholds: { warning: 100, critical: 1000 },
                description: 'Number of sort merge passes (disk-based sorts)',
                dbSpecific: true,
            });

            // 20. Select full join
            const selectFullJoin = this.toNumber(statusMap.Select_full_join, 0);
            metrics.push({
                id: 'select_full_join',
                label: 'SELECT Full Joins',
                value: selectFullJoin,
                unit: 'count',
                category: 'performance',
                severity: selectFullJoin > 100 ? 'critical' : selectFullJoin > 10 ? 'warning' : 'ok',
                thresholds: { warning: 10, critical: 100 },
                description: 'Number of joins without indexes',
                dbSpecific: true,
            });

            // 21. Transaction rate
            const txnRate = this._calculateTxnRate(statusMap);
            metrics.push({
                id: 'transaction_rate',
                label: 'Transaction Rate',
                value: txnRate,
                unit: 'tx/sec',
                category: 'performance',
                severity: 'ok',
                thresholds: { warning: 10000, critical: 50000 },
                description: 'Transactions per second',
                dbSpecific: false,
            });
        } catch (error) {
            console.error('Error getting MySQL metrics:', error.message);
        }

        return metrics;
    }

    getCapabilities() {
        return {
            ...super.getCapabilities(),
            replication: true,
            vacuum: false,
            indexes: true,
            locks: true,
            queryPlan: true,
            wal: false,
            schemas: true,
            storedProcedures: true,
            partitioning: true,
            sharding: false,
            explain: true,
            queryHistory: true,
            slowQueryLog: true,
            triggers: true,
        };
    }

    // Helper methods

    _calculateCacheHitRatio(statusMap) {
        const innodb_buffer_pool_reads = this.toNumber(statusMap.Innodb_buffer_pool_reads, 1);
        const innodb_buffer_pool_read_requests = this.toNumber(statusMap.Innodb_buffer_pool_read_requests, 1);

        if (innodb_buffer_pool_read_requests === 0) return 0;

        const hitRatio =
            ((innodb_buffer_pool_read_requests - innodb_buffer_pool_reads) / innodb_buffer_pool_read_requests) * 100;
        return this.round(Math.max(0, hitRatio), 2);
    }

    _calculateTxnRate(statusMap) {
        const uptime = this.toNumber(statusMap.Uptime, 1);
        const commits = this.toNumber(statusMap.Com_commit, 0);
        const rollbacks = this.toNumber(statusMap.Com_rollback, 0);

        if (uptime === 0) return 0;

        const txnRate = (commits + rollbacks) / uptime;
        return this.round(txnRate, 2);
    }
}

export default MySQLAdapter;
