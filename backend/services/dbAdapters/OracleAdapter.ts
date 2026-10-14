// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * OracleAdapter.js
 *
 * Oracle Database-specific adapter using the oracledb driver.
 * Note: The oracledb package should be added to dependencies.
 *
 * Metrics sourced from:
 * - V$SESSION for connections and sessions
 * - V$SYSSTAT for server statistics
 * - DBA_TABLES for table information
 * - DBA_INDEXES for index information
 * - V$LOCK for lock information
 */

import { BaseAdapter } from './BaseAdapter.js';

// Lazy driver load (was a top-level await, which made importing this
// module — and therefore server boot — pay the driver's full load cost
// even when no oracledb connection exists; brutal for serverless cold starts).
let oracledb: any;
let _oracledbLoading: Promise<any> | null = null;
async function ensureDriver() {
    if (oracledb !== undefined) return oracledb;
    if (!_oracledbLoading) {
        _oracledbLoading = import('oracledb').then(
            // oracledb is CommonJS; under import() its API is on `default`.
            (m) => (oracledb = m.default ?? m),
            () => (oracledb = null),
        );
    }
    await _oracledbLoading;
    return oracledb;
}

export class OracleAdapter extends BaseAdapter {
    constructor(config) {
        super(config);
        this.dbType = 'oracle';
        this.connection = null;
    }

    getDriverName() {
        return 'Oracle Database';
    }

    _checkDriver() {
        if (!oracledb) {
            throw new Error('Oracle driver (oracledb) not installed. Install with: npm install oracledb');
        }
    }

    async connect() {
        await ensureDriver();
        this._checkDriver();
        try {
            this.connection = await oracledb.getConnection({
                user: this.config.user,
                password: this.config.password,
                connectString: `${this.config.host}:${this.config.port || 1521}/${this.config.database || 'ORCL'}`,
            });
            this.connected = true;
        } catch (error) {
            throw new Error(`Oracle connection failed: ${error.message}`);
        }
    }

    async disconnect() {
        if (this.connection) {
            await this.connection.close();
            this.connection = null;
            this.connected = false;
        }
    }

    async query(sql) {
        if (!this.connection) {
            throw new Error('Not connected to Oracle');
        }
        const startTime = Date.now();
        const result = await this.connection.execute(sql);
        const duration = Date.now() - startTime;

        // Convert Oracle result to standard format
        const rows = (result.rows || []).map((row) => {
            const obj = {};
            if (result.metaData) {
                result.metaData.forEach((col, idx) => {
                    obj[col.name] = row[idx];
                });
            }
            return obj;
        });

        return { rows, duration };
    }

    async getOverviewStats() {
        const result = await this.query(`
            SELECT
                (SELECT count(*) FROM v$session WHERE type != 'BACKGROUND') AS active_connections,
                (SELECT count(*) FROM v$session) AS total_connections,
                (SELECT sum(bytes) FROM dba_data_files) AS db_size_bytes,
                (SELECT trunc((sysdate - startup_time) * 86400) FROM v$instance) AS uptime_seconds,
                (SELECT banner FROM v$version WHERE rownum = 1) AS version,
                (SELECT round((1 - (sum(decode(name, 'physical reads', value, 0)) /
                    (sum(decode(name, 'db block gets', value, 0)) + sum(decode(name, 'consistent gets', value, 0))))) * 100, 2)
                 FROM v$sysstat) AS cache_hit_ratio,
                (SELECT round(value / 3600, 2) FROM v$sysstat WHERE name = 'user commits') AS transactions_per_sec,
                (SELECT value FROM v$sysstat WHERE name = 'rows inserted') AS tuples_inserted,
                (SELECT value FROM v$sysstat WHERE name = 'rows updated') AS tuples_updated,
                (SELECT value FROM v$sysstat WHERE name = 'rows deleted') AS tuples_deleted,
                (SELECT value FROM v$sysstat WHERE name = 'table fetch by rowid') AS tuples_fetched
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
                (SELECT round(avg(elapsed_time / executions / 1000), 2) FROM v$sql WHERE executions > 0) AS avg_query_time_ms,
                (SELECT count(*) FROM v$session WHERE state = 'ACTIVE' AND type != 'BACKGROUND') AS active_queries,
                (SELECT count(*) FROM v$session WHERE event LIKE '%wait%') AS queries_waiting,
                (SELECT round((1 - (sum(decode(name, 'physical reads', value, 0)) /
                    (sum(decode(name, 'db block gets', value, 0)) + sum(decode(name, 'consistent gets', value, 0))))) * 100, 2)
                 FROM v$sysstat) AS cache_hit_ratio
        `);

        const row = result.rows[0];
        return {
            avgQueryTimeMs: this.toNumber(row.avg_query_time_ms),
            activeQueries: this.toNumber(row.active_queries),
            queriesWaiting: this.toNumber(row.queries_waiting),
            cacheHitRatio: this.round(row.cache_hit_ratio),
        };
    }

    async getTableStats() {
        const result = await this.query(`
            SELECT
                owner AS schema,
                table_name AS name,
                num_rows AS row_estimate,
                (SELECT sum(bytes) FROM dba_segments WHERE segment_name = table_name AND owner = dba_tables.owner) AS total_size_bytes,
                (SELECT sum(bytes) FROM dba_segments WHERE segment_name = table_name AND owner = dba_tables.owner AND segment_type = 'TABLE') AS table_size_bytes,
                (SELECT sum(bytes) FROM dba_segments WHERE segment_name = table_name AND owner = dba_tables.owner AND segment_type = 'INDEX') AS index_size_bytes,
                0 AS dead_tuples,
                last_analyzed AS last_analyze,
                NULL AS last_vacuum,
                NULL AS last_autovacuum,
                NULL AS last_autoanalyze
            FROM dba_tables
            WHERE owner NOT IN ('SYS', 'SYSTEM')
            ORDER BY total_size_bytes DESC
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
            lastAnalyze: this.formatTimestamp(row.last_analyze),
            lastAutoanalyze: null,
        }));
    }

    /**
     * Reclaimable-space signal for the storage advisor. Oracle has no data_free
     * column, so reclaimable space is estimated as allocated segment bytes
     * (dba_segments) minus the optimizer's estimate of live data
     * (num_rows * avg_row_len). Below the high-water mark this is freed with
     * ALTER TABLE ... SHRINK SPACE (needs row movement). Approximate — depends
     * on fresh stats. Normalized to the analyzeFragmentation shape.
     */
    async getFragmentation() {
        const result = await this.query(`
            SELECT t.owner AS schema,
                   t.table_name AS name,
                   t.num_rows AS row_estimate,
                   (SELECT SUM(s.bytes) FROM dba_segments s
                     WHERE s.segment_name = t.table_name AND s.owner = t.owner
                       AND s.segment_type = 'TABLE') AS allocated_bytes,
                   NVL(t.num_rows, 0) * NVL(t.avg_row_len, 0) AS used_bytes_est
            FROM dba_tables t
            WHERE t.owner NOT IN ('SYS', 'SYSTEM')
        `);

        return result.rows.map((row) => {
            const allocated = this.toNumber(row.allocated_bytes);
            const usedEst = this.toNumber(row.used_bytes_est);
            return {
                schema: row.schema,
                name: row.name,
                rowEstimate: this.toNumber(row.row_estimate),
                dataLengthBytes: usedEst,
                indexLengthBytes: 0,
                dataFreeBytes: Math.max(0, allocated - usedEst),
            };
        });
    }

    async getIndexStats() {
        const result = await this.query(`
            SELECT
                owner AS schema,
                table_name AS table,
                index_name AS name,
                (SELECT sum(bytes) FROM dba_segments WHERE segment_name = index_name AND owner = dba_indexes.owner) AS size_bytes,
                0 AS scans,
                0 AS rows_read,
                0 AS rows_fetched
            FROM dba_indexes
            WHERE owner NOT IN ('SYS', 'SYSTEM')
            ORDER BY size_bytes DESC
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
                sid AS pid,
                username AS user,
                null AS database,
                status AS state,
                (SELECT sql_text FROM v$sql WHERE hash_value = v$session.sql_hash_value AND address = v$session.sql_address) AS query,
                trunc((sysdate - logon_time) * 86400) AS duration_seconds,
                machine AS client_addr
            FROM v$session
            WHERE type != 'BACKGROUND' AND status = 'ACTIVE'
            ORDER BY logon_time DESC
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
                    l.sid AS blocked_pid,
                    (SELECT sid FROM v$lock WHERE id1 = l.id1 AND id2 = l.id2 AND block = 0) AS blocking_pid,
                    l.type AS lock_mode
                FROM v$lock l
                WHERE l.block = 1
            `);

            return result.rows.map((row) => ({
                blockedPid: this.toNumber(row.blocked_pid),
                blockingPid: this.toNumber(row.blocking_pid),
                blockingUser: null,
                blockedQuery: null,
                blockingQuery: null,
                lockMode: row.lock_mode,
            }));
        } catch {
            return [];
        }
    }

    async getReplicationStatus() {
        return {
            isReplica: false,
            replicaAppName: null,
            maxReplicationLagMb: 0,
            replicaCount: 0,
        };
    }

    async getDatabaseList() {
        const result = await this.query(`
            SELECT
                name AS name,
                (SELECT sum(bytes) FROM dba_data_files WHERE tablespace_name = (SELECT default_tablespace FROM dba_users WHERE username = name)) AS size_bytes,
                0 AS is_template
            FROM dba_users
            WHERE username NOT IN ('SYS', 'SYSTEM')
        `);

        return result.rows.map((row) => ({
            name: row.name,
            sizeBytes: this.toNumber(row.size_bytes),
            isTemplate: row.is_template,
            connections: 0,
        }));
    }

    async getServerVersion() {
        const result = await this.query(`SELECT banner FROM v$version WHERE rownum = 1`);

        const versionStr = result.rows[0]?.banner || 'Unknown';
        const parts = versionStr.split(' ');
        const major = parseInt(parts[2]?.split('.')[0], 10) || 0;
        const minor = parseInt(parts[2]?.split('.')[1], 10) || 0;

        return {
            version: versionStr,
            versionNum: major * 10000 + minor * 100,
            major,
            minor,
            dbType: 'oracle',
        };
    }

    async executeQuery(sql) {
        const startTime = Date.now();
        const result = await this.query(sql);
        const duration = Date.now() - startTime;

        const fields =
            result.rows.length > 0
                ? Object.keys(result.rows[0]).map((name) => ({ name, type: typeof result.rows[0][name] }))
                : [];

        return {
            rows: result.rows,
            fields,
            rowCount: result.rows.length,
            duration,
        };
    }

    async getKeyMetrics() {
        const metrics = [];

        try {
            // Batch query for multiple v$sysstat metrics
            const statResult = await this.query(`
                SELECT
                    round((1 - (sum(decode(name, 'physical reads', value, 0)) /
                        (sum(decode(name, 'db block gets', value, 0)) + sum(decode(name, 'consistent gets', value, 0))))) * 100, 2) AS sga_hit_ratio,
                    round(sum(decode(name, 'physical reads', value, 0)) / (
                        select (sysdate - startup_time) * 24 * 3600 from v$instance), 2) AS physical_reads_sec,
                    round(sum(decode(name, 'user commits', value, 0)) / (
                        select (sysdate - startup_time) * 24 * 3600 from v$instance), 2) AS user_commits_sec,
                    round(sum(decode(name, 'sorts (disk)', value, 0)) / (
                        select (sysdate - startup_time) * 24 * 3600 from v$instance), 2) AS sorts_disk_sec
                FROM v$sysstat
            `);

            const statRow = statResult.rows[0] || {};

            // 1. SGA hit ratio
            const sgaHitRatio = this.toNumber(statRow.sga_hit_ratio, 0);
            metrics.push({
                id: 'sga_hit_ratio',
                label: 'SGA Cache Hit Ratio',
                value: sgaHitRatio,
                unit: '%',
                category: 'performance',
                severity: sgaHitRatio >= 99 ? 'ok' : sgaHitRatio >= 90 ? 'warning' : 'critical',
                thresholds: { warning: 90, critical: 80 },
                description: 'System Global Area cache hit ratio',
                dbSpecific: true,
            });

            // 2. Active connections
            const connResult = await this.query(`
                SELECT count(*) AS active_conn FROM v$session WHERE type != 'BACKGROUND'
            `);
            const activeConn = this.toNumber(connResult.rows[0]?.active_conn, 0);
            metrics.push({
                id: 'active_connections',
                label: 'Active Connections',
                value: activeConn,
                unit: 'count',
                category: 'connections',
                severity: activeConn > 100 ? 'warning' : activeConn > 200 ? 'critical' : 'ok',
                thresholds: { warning: 100, critical: 200 },
                description: 'Number of active user sessions',
                dbSpecific: false,
            });

            // 3. Redo log switches per hour
            const redoResult = await this.query(`
                SELECT count(*) AS switches FROM v$log_history WHERE first_time > sysdate - 1/24
            `);
            const redoSwitches = this.toNumber(redoResult.rows[0]?.switches, 0);
            metrics.push({
                id: 'redo_log_switches',
                label: 'Redo Log Switches/Hour',
                value: redoSwitches,
                unit: 'count',
                category: 'performance',
                severity: redoSwitches > 10 ? 'warning' : redoSwitches > 50 ? 'critical' : 'ok',
                thresholds: { warning: 10, critical: 50 },
                description: 'Number of redo log switches in the last hour',
                dbSpecific: true,
            });

            // 4. Physical reads per second
            const physicalReadsSec = this.toNumber(statRow.physical_reads_sec, 0);
            metrics.push({
                id: 'physical_reads_per_sec',
                label: 'Physical Reads/sec',
                value: physicalReadsSec,
                unit: 'reads/sec',
                category: 'performance',
                severity: physicalReadsSec > 1000 ? 'critical' : physicalReadsSec > 100 ? 'warning' : 'ok',
                thresholds: { warning: 100, critical: 1000 },
                description: 'Physical disk reads per second',
                dbSpecific: false,
            });

            // 5. User commits per second
            const userCommitsSec = this.toNumber(statRow.user_commits_sec, 0);
            metrics.push({
                id: 'user_commits_per_sec',
                label: 'User Commits/sec',
                value: userCommitsSec,
                unit: 'commits/sec',
                category: 'performance',
                severity: 'ok',
                thresholds: { warning: 10000, critical: 50000 },
                description: 'User commits per second',
                dbSpecific: true,
            });

            // 6. Sorts to disk per second
            const sortsDiskSec = this.toNumber(statRow.sorts_disk_sec, 0);
            metrics.push({
                id: 'sorts_disk_per_sec',
                label: 'Disk Sorts/sec',
                value: sortsDiskSec,
                unit: 'sorts/sec',
                category: 'performance',
                severity: sortsDiskSec > 10 ? 'critical' : sortsDiskSec > 1 ? 'warning' : 'ok',
                thresholds: { warning: 1, critical: 10 },
                description: 'Sorts performed on disk per second',
                dbSpecific: true,
            });

            // 7. Library cache hit ratio
            const libraryCacheResult = await this.query(`
                SELECT
                    round((sum(decode(namespace, 'SQL AREA', pins, 0)) - sum(decode(namespace, 'SQL AREA', reloads, 0))) /
                        sum(decode(namespace, 'SQL AREA', pins, 0)) * 100, 2) AS lib_cache_ratio
                FROM v$librarycache
                WHERE sum(decode(namespace, 'SQL AREA', pins, 0)) > 0
            `);
            const libraryCacheRatio = this.toNumber((libraryCacheResult.rows[0] || {}).lib_cache_ratio, 0);
            metrics.push({
                id: 'library_cache_hit_ratio',
                label: 'Library Cache Hit Ratio',
                value: libraryCacheRatio,
                unit: '%',
                category: 'performance',
                severity: libraryCacheRatio >= 99 ? 'ok' : libraryCacheRatio >= 90 ? 'warning' : 'critical',
                thresholds: { warning: 90, critical: 80 },
                description: 'SQL library cache hit ratio',
                dbSpecific: true,
            });

            // 8. Dictionary cache hit ratio
            const dictCacheResult = await this.query(`
                SELECT
                    round((sum(decode(namespace, 'ROWCACHE', pins, 0)) - sum(decode(namespace, 'ROWCACHE', reloads, 0))) /
                        sum(decode(namespace, 'ROWCACHE', pins, 0)) * 100, 2) AS dict_cache_ratio
                FROM v$librarycache
                WHERE sum(decode(namespace, 'ROWCACHE', pins, 0)) > 0
            `);
            const dictCacheRatio = this.toNumber((dictCacheResult.rows[0] || {}).dict_cache_ratio, 0);
            metrics.push({
                id: 'dictionary_cache_hit_ratio',
                label: 'Dictionary Cache Hit Ratio',
                value: dictCacheRatio,
                unit: '%',
                category: 'performance',
                severity: dictCacheRatio >= 99 ? 'ok' : dictCacheRatio >= 90 ? 'warning' : 'critical',
                thresholds: { warning: 90, critical: 80 },
                description: 'Row cache hit ratio',
                dbSpecific: true,
            });

            // 9. Active sessions
            const activeSessResult = await this.query(`
                SELECT count(*) AS active_sess FROM v$session WHERE type != 'BACKGROUND' AND state = 'ACTIVE'
            `);
            const activeSessions = this.toNumber((activeSessResult.rows[0] || {}).active_sess, 0);
            metrics.push({
                id: 'active_sessions',
                label: 'Active Sessions',
                value: activeSessions,
                unit: 'count',
                category: 'performance',
                severity: activeSessions > 50 ? 'warning' : activeSessions > 100 ? 'critical' : 'ok',
                thresholds: { warning: 50, critical: 100 },
                description: 'Currently active sessions',
                dbSpecific: false,
            });

            // 10. Enqueue waits
            const enqueueResult = await this.query(`
                SELECT round(sum(total_wait#) / (select (sysdate - startup_time) * 24 * 3600 from v$instance), 2) AS enq_waits_sec
                FROM v$enqueue_stat
            `);
            const enqueueWaits = this.toNumber((enqueueResult.rows[0] || {}).enq_waits_sec, 0);
            metrics.push({
                id: 'enqueue_waits_per_sec',
                label: 'Enqueue Waits/sec',
                value: enqueueWaits,
                unit: 'waits/sec',
                category: 'locks',
                severity: enqueueWaits > 100 ? 'critical' : enqueueWaits > 10 ? 'warning' : 'ok',
                thresholds: { warning: 10, critical: 100 },
                description: 'Enqueue (lock) waits per second',
                dbSpecific: true,
            });

            // 11. Open cursors current
            const cursorResult = await this.query(`
                SELECT max(value) AS open_cursors FROM v$sysstat WHERE name = 'opened cursors current'
            `);
            const openCursors = this.toNumber((cursorResult.rows[0] || {}).open_cursors, 0);
            metrics.push({
                id: 'open_cursors_current',
                label: 'Open Cursors',
                value: openCursors,
                unit: 'count',
                category: 'performance',
                severity: openCursors > 1000 ? 'critical' : openCursors > 500 ? 'warning' : 'ok',
                thresholds: { warning: 500, critical: 1000 },
                description: 'Currently open cursors',
                dbSpecific: true,
            });

            // 12. PGA usage
            const pgaResult = await this.query(`
                SELECT round(sum(pga_alloc_mem) / 1024 / 1024 / 1024, 2) AS pga_usage_gb FROM v$process
            `);
            const pgaUsageGb = this.toNumber((pgaResult.rows[0] || {}).pga_usage_gb, 0);
            metrics.push({
                id: 'pga_usage_gb',
                label: 'PGA Usage',
                value: pgaUsageGb,
                unit: 'GB',
                category: 'performance',
                severity: pgaUsageGb > 10 ? 'critical' : pgaUsageGb > 5 ? 'warning' : 'ok',
                thresholds: { warning: 5, critical: 10 },
                description: 'Program Global Area usage',
                dbSpecific: true,
            });

            // 13. Tablespace usage percent
            const tablespaceResult = await this.query(`
                SELECT
                    round(sum(used_space) / sum(tablespace_size) * 100, 2) AS tbsp_used_pct
                FROM dba_tablespace_usage_metrics
            `);
            const tablespaceUsed = this.toNumber((tablespaceResult.rows[0] || {}).tbsp_used_pct, 0);
            metrics.push({
                id: 'tablespace_usage_pct',
                label: 'Tablespace Usage',
                value: tablespaceUsed,
                unit: '%',
                category: 'performance',
                severity: tablespaceUsed > 90 ? 'critical' : tablespaceUsed > 80 ? 'warning' : 'ok',
                thresholds: { warning: 80, critical: 90 },
                description: 'Percentage of tablespace used',
                dbSpecific: true,
            });

            // 14. Shared pool free percent
            const poolResult = await this.query(`
                SELECT round((1 - (select sum(bytes) from v$sgastat where pool = 'shared pool' and name != 'free memory') /
                    (select sum(bytes) from v$sgastat where pool = 'shared pool')) * 100, 2) AS pool_free_pct
                FROM dual
            `);
            const poolFree = this.toNumber((poolResult.rows[0] || {}).pool_free_pct, 0);
            metrics.push({
                id: 'shared_pool_free_pct',
                label: 'Shared Pool Free %',
                value: poolFree,
                unit: '%',
                category: 'performance',
                severity: poolFree < 10 ? 'critical' : poolFree < 20 ? 'warning' : 'ok',
                thresholds: { warning: 20, critical: 10 },
                description: 'Percentage of shared pool free',
                dbSpecific: true,
            });

            // 15. Buffer cache usage
            const bufferCacheResult = await this.query(`
                SELECT round((1 - (select count(*) from v$bh where state = 'free') / count(*)) * 100, 2) AS buffer_cache_pct
                FROM v$bh
            `);
            const bufferCacheUsed = this.toNumber((bufferCacheResult.rows[0] || {}).buffer_cache_pct, 0);
            metrics.push({
                id: 'buffer_cache_usage_pct',
                label: 'Buffer Cache Usage',
                value: bufferCacheUsed,
                unit: '%',
                category: 'performance',
                severity: 'ok',
                thresholds: { warning: 80, critical: 95 },
                description: 'Percentage of buffer cache in use',
                dbSpecific: true,
            });

            // 16. Redo log buffer waits
            const redoBufferResult = await this.query(`
                SELECT round(sum(value), 2) AS redo_buf_waits FROM v$sysstat WHERE name LIKE '%redo%buffer%'
            `);
            const redoBufferWaits = this.toNumber((redoBufferResult.rows[0] || {}).redo_buf_waits, 0);
            metrics.push({
                id: 'redo_buffer_waits',
                label: 'Redo Buffer Waits',
                value: redoBufferWaits,
                unit: 'count',
                category: 'performance',
                severity: redoBufferWaits > 100 ? 'critical' : redoBufferWaits > 10 ? 'warning' : 'ok',
                thresholds: { warning: 10, critical: 100 },
                description: 'Number of redo log buffer waits',
                dbSpecific: true,
            });

            // 17. DB CPU usage
            const cpuResult = await this.query(`
                SELECT round(sum(value) / 1000000 / (select (sysdate - startup_time) * 24 * 3600 from v$instance), 2) AS cpu_sec_per_sec
                FROM v$sysstat WHERE name LIKE '%DB CPU%'
            `);
            const cpuUsage = this.toNumber((cpuResult.rows[0] || {}).cpu_sec_per_sec, 0);
            metrics.push({
                id: 'db_cpu_usage',
                label: 'DB CPU Usage',
                value: cpuUsage,
                unit: 'cpu_sec/sec',
                category: 'performance',
                severity: cpuUsage > 0.8 ? 'critical' : cpuUsage > 0.5 ? 'warning' : 'ok',
                thresholds: { warning: 0.5, critical: 0.8 },
                description: 'Database CPU usage per second',
                dbSpecific: true,
            });
        } catch (error) {
            console.error('Error getting Oracle metrics:', error.message);
        }

        return metrics;
    }

    /**
     * Wait-event breakdown via Active Session History (v$active_session_history)
     * with a fallback to v$session_wait. Requires the Diagnostics Pack for ASH;
     * the v$session_wait fallback works on any edition. Aggregates the last hour.
     */
    async getWaitEvents() {
        try {
            const { rows } = await this.query(`
                SELECT event AS event, ROUND(SUM(time_waited) / 1000, 2) AS ms
                  FROM v$active_session_history
                 WHERE sample_time > SYSTIMESTAMP - INTERVAL '60' MINUTE
                   AND event IS NOT NULL
                 GROUP BY event
                 ORDER BY ms DESC
                 FETCH FIRST 20 ROWS ONLY
            `);
            return {
                window: '1h',
                events: rows.map((r) => ({ event: r.EVENT, ms: Number(r.MS) || 0 })),
            };
        } catch (ashErr) {
            try {
                const { rows } = await this.query(`
                    SELECT event AS event, COUNT(*) AS waiters
                      FROM v$session_wait
                     WHERE wait_class != 'Idle'
                     GROUP BY event
                     ORDER BY waiters DESC
                     FETCH FIRST 20 ROWS ONLY
                `);
                return {
                    window: 'instant',
                    events: rows.map((r) => ({ event: r.EVENT, waiters: Number(r.WAITERS) || 0 })),
                    note: 'ASH unavailable; showing live v$session_wait snapshot.',
                };
            } catch (e) {
                return { window: '1h', events: [], note: `Wait-event capture failed: ${e.message}` };
            }
        }
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
            triggers: true,
            waitEvents: true, // v$active_session_history / v$session_wait
            slowQueryLog: true, // v$sql ordered by elapsed_time
            backup: true, // RMAN / data pump
            restore: true,
        };
    }
}

export default OracleAdapter;
