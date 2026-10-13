// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/k8sService.js
 * ──────────────────────
 * Kubernetes/container monitoring via PostgreSQL metrics.
 * Detects container environment and monitors resource usage.
 */

const S = 'pgmonitoringtool';

function log(level, message, meta = {}) {
    const entry = { ts: new Date().toISOString(), level, msg: message, ...meta };
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(JSON.stringify(entry));
}

/**
 * Detect if PostgreSQL is running in a container.
 * @param {import('pg').Pool} pool
 * @returns {Promise<{
 *   isContainer: boolean,
 *   cgroupPath?: string,
 *   containerRuntime?: string
 * }>}
 */
export async function getContainerMetrics(pool) {
    try {
        const res = await pool.query(
            `SELECT
                (current_setting('data_directory') LIKE '/var/lib/postgresql/data%') as likely_container,
                pg_ls_dir('/proc/self/cgroup') as cgroup_available`
        );

        // In a real scenario, we'd read /proc/self/cgroup to detect container
        // For now, we infer from environment and data directory
        const isContainer = res.rows[0]?.likely_container || false;

        return {
            isContainer,
            cgroupPath: '/proc/self/cgroup',
            containerRuntime: 'docker', // Default assumption
        };
    } catch (err) {
        log('WARN', 'Failed to detect container environment', { error: err.message });
        return {
            isContainer: false,
        };
    }
}

/**
 * Get pod/container metadata from environment variables.
 * @param {import('pg').Pool} pool
 * @returns {Promise<{
 *   podName?: string,
 *   namespace?: string,
 *   hostname: string,
 *   nodeId?: string
 * }>}
 */
export async function getPodInfo(pool) {
    try {
        // PostgreSQL doesn't have direct env var access, but we can use system info
        const res = await pool.query(
            `SELECT
                current_setting('server_version') as version,
                inet_server_addr()::text as server_addr,
                current_database() as db_name,
                pg_postmaster_start_time() as start_time`
        );

        const row = res.rows[0];

        // Parse pod name from hostname or use default
        const podName = process.env.POD_NAME || process.env.HOSTNAME || 'unknown';
        const namespace = process.env.NAMESPACE || 'default';
        const nodeId = process.env.NODE_ID || 'unknown';

        return {
            podName,
            namespace,
            hostname: podName,
            nodeId,
            postgresVersion: row.version,
            startTime: row.start_time,
        };
    } catch (err) {
        log('WARN', 'Failed to get pod info', { error: err.message });
        return {
            hostname: process.env.HOSTNAME || 'unknown',
            namespace: process.env.NAMESPACE || 'default',
        };
    }
}

/**
 * Check memory/CPU limits vs actual usage.
 * @param {import('pg').Pool} pool
 * @returns {Promise<{
 *   memoryLimitMb?: number,
 *   memoryUsedMb: number,
 *   memoryUtilization: number,
 *   cpuLimitMillis?: number,
 *   cpuUsedMillis: number
 * }>}
 */
export async function getResourceLimits(pool) {
    try {
        const res = await pool.query(
            `SELECT
                pg_database_size(current_database()) / 1024 / 1024 as db_size_mb,
                count(*) as connection_count
             FROM pg_stat_activity`
        );

        const dbSizeMb = parseFloat(res.rows[0].db_size_mb);
        const connectionCount = parseInt(res.rows[0].connection_count);

        // Estimate memory usage (rough approximation)
        const estimatedMemoryMb = dbSizeMb * 0.3 + (connectionCount * 5); // ~5MB per connection + 30% shared

        // In a container, get limits from environment or cgroups
        const memoryLimitMb = process.env.MEMORY_LIMIT_MB ? parseInt(process.env.MEMORY_LIMIT_MB) : undefined;
        const cpuLimitMillis = process.env.CPU_LIMIT_MILLIS ? parseInt(process.env.CPU_LIMIT_MILLIS) : undefined;

        return {
            memoryLimitMb,
            memoryUsedMb: Math.round(estimatedMemoryMb),
            memoryUtilization: memoryLimitMb ? Math.round((estimatedMemoryMb / memoryLimitMb) * 100) : 0,
            cpuLimitMillis,
            cpuUsedMillis: 0, // Would need system call to get actual CPU usage
            connectionCount,
        };
    } catch (err) {
        log('WARN', 'Failed to get resource limits', { error: err.message });
        return {
            memoryUsedMb: 0,
            memoryUtilization: 0,
            cpuUsedMillis: 0,
        };
    }
}

/**
 * Group active connections by client hostname (pod names).
 * @param {import('pg').Pool} pool
 * @returns {Promise<Array<{
 *   podName: string,
 *   connectionCount: number,
 *   databases: string[],
 *   idle: number,
 *   active: number
 * }>>}
 */
export async function getConnectionsByPod(pool) {
    try {
        const res = await pool.query(
            `SELECT
                COALESCE(client_addr::text, 'local') as pod_name,
                COUNT(*) as conn_count,
                COUNT(CASE WHEN state = 'idle' THEN 1 END) as idle_count,
                COUNT(CASE WHEN state = 'active' THEN 1 END) as active_count,
                array_agg(DISTINCT datname) as databases
             FROM   pg_stat_activity
             GROUP  BY client_addr
             ORDER  BY conn_count DESC`
        );

        return res.rows.map(row => ({
            podName: row.pod_name,
            connectionCount: row.conn_count,
            databases: row.databases || [],
            idle: row.idle_count,
            active: row.active_count,
        }));
    } catch (err) {
        log('WARN', 'Failed to get connections by pod', { error: err.message });
        return [];
    }
}

/**
 * Map primary/replica topology with container info.
 * @param {import('pg').Pool} pool
 * @returns {Promise<{
 *   isPrimary: boolean,
 *   replicaCount: number,
 *   replicas: Array<{hostname: string, lag?: string}>,
 *   slotInfo: any[]
 * }>}
 */
export async function getReplicaTopology(pool) {
    try {
        // Check if this is a primary
        const isPrimaryRes = await pool.query(
            `SELECT NOT pg_is_in_recovery() as is_primary`
        );
        const isPrimary = isPrimaryRes.rows[0].is_primary;

        let replicas = [];
        let slotInfo = [];

        if (isPrimary) {
            // Get replication slots
            const slotsRes = await pool.query(
                `SELECT slot_name, slot_type, active, restart_lsn
                 FROM   pg_replication_slots`
            );
            slotInfo = slotsRes.rows;

            // Get connected standbys
            const standbyRes = await pool.query(
                `SELECT client_addr::text as hostname, state, sync_state
                 FROM   pg_stat_replication
                 ORDER  BY client_addr`
            );
            replicas = standbyRes.rows.map(row => ({
                hostname: row.client_addr || 'unknown',
                state: row.state,
                syncState: row.sync_state,
            }));
        }

        return {
            isPrimary,
            replicaCount: replicas.length,
            replicas,
            slotInfo,
        };
    } catch (err) {
        log('WARN', 'Failed to get replica topology', { error: err.message });
        return {
            isPrimary: false,
            replicaCount: 0,
            replicas: [],
            slotInfo: [],
        };
    }
}

/**
 * Get readiness/liveness probe data for Kubernetes health checks.
 * @param {import('pg').Pool} pool
 * @returns {Promise<{
 *   ready: boolean,
 *   alive: boolean,
 *   acceptingConnections: boolean,
 *   uptime: number,
 *   lastCheckTime: Date
 * }>}
 */
export async function getK8sHealthCheck(pool) {
    try {
        const res = await pool.query(
            `SELECT
                NOT pg_is_in_recovery() OR pg_last_xact_replay_timestamp() IS NOT NULL as ready,
                EXTRACT(EPOCH FROM (NOW() - pg_postmaster_start_time())) as uptime_sec`
        );

        const row = res.rows[0];

        // Try a simple query to check accepting connections
        let acceptingConnections = false;
        try {
            await pool.query('SELECT 1');
            acceptingConnections = true;
        } catch (err) {
            acceptingConnections = false;
        }

        return {
            ready: row.ready,
            alive: true, // If we got a result, server is alive
            acceptingConnections,
            uptime: Math.round(row.uptime_sec),
            lastCheckTime: new Date(),
        };
    } catch (err) {
        log('WARN', 'Failed to get K8s health check', { error: err.message });
        return {
            ready: false,
            alive: false,
            acceptingConnections: false,
            uptime: 0,
            lastCheckTime: new Date(),
        };
    }
}

/**
 * Get resource usage over time from timeseries data.
 * @param {import('pg').Pool} pool
 * @param {number} hours
 * @returns {Promise<Array<{
 *   timestamp: Date,
 *   memoryUsageMb: number,
 *   cpuUsagePercent: number,
 *   diskUsageMb: number,
 *   activeConnections: number
 * }>>}
 */
export async function getContainerResourceHistory(pool, hours = 24) {
    if (hours <= 0) {
        throw new Error('hours must be positive');
    }

    try {
        const res = await pool.query(
            `SELECT
                created_at,
                ROUND(CAST(data->>'memory_usage_mb' AS numeric), 2) as memory_usage_mb,
                ROUND(CAST(data->>'cpu_usage_percent' AS numeric), 2) as cpu_usage_percent,
                ROUND(CAST(data->>'disk_usage_mb' AS numeric), 2) as disk_usage_mb,
                CAST(data->>'active_connections' AS integer) as active_connections
             FROM   ${S}.timeseries
             WHERE  metric_name = 'container_resources'
                AND created_at >= NOW() - INTERVAL '1 hour' * $1
             ORDER  BY created_at DESC`,
            [hours]
        );

        return res.rows.map(row => ({
            timestamp: row.created_at,
            memoryUsageMb: row.memory_usage_mb || 0,
            cpuUsagePercent: row.cpu_usage_percent || 0,
            diskUsageMb: row.disk_usage_mb || 0,
            activeConnections: row.active_connections || 0,
        }));
    } catch (err) {
        log('WARN', 'Failed to get container resource history', { error: err.message });
        return [];
    }
}
