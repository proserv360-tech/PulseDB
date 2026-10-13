// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * CassandraAdapter.js
 *
 * Apache Cassandra / ScyllaDB adapter using `cassandra-driver` as a peer
 * dependency.
 *
 * Monitoring surface:
 *   • system.local / system.peers      — cluster topology + version.
 *   • system_schema.keyspaces          — keyspaces list (maps to getDatabaseList).
 *   • system_schema.tables             — per-keyspace tables.
 *   • system_views.clients             — active connections (Cassandra 4.0+).
 *   • system_traces                    — best-effort slow query surface (off by default).
 *
 * Concepts that do not map to Cassandra (SQL-style indexes, row locks)
 * return structured "not applicable" shapes.
 */

import { BaseAdapter } from './BaseAdapter.js';

// Lazy driver load (was a top-level await — see MSSQLAdapter note).
let cassandra: any;
let _cassandraLoading: Promise<any> | null = null;
async function ensureDriver() {
    if (cassandra !== undefined) return cassandra;
    if (!_cassandraLoading) {
        _cassandraLoading = (async () => {
            try {
                const moduleId = 'cassandra-driver';
                cassandra = (await import(moduleId)).default || (await import(moduleId));
            } catch {
                cassandra = null;
            }
        })();
    }
    await _cassandraLoading;
    return cassandra;
}

export class CassandraAdapter extends BaseAdapter {
    constructor(config) {
        super(config);
        this.dbType = 'cassandra';
        this.client = null;
    }

    getDriverName() {
        return 'cassandra-driver';
    }

    _checkDriver() {
        if (!cassandra) {
            throw new Error(
                'Cassandra driver (cassandra-driver) not installed. Install with: npm install cassandra-driver',
            );
        }
    }

    async connect() {
        await ensureDriver();
        this._checkDriver();
        const cfg = this.config || {};
        this.client = new cassandra.Client({
            contactPoints: cfg.contactPoints || [cfg.host || 'localhost'],
            localDataCenter: cfg.localDataCenter || cfg.datacenter || 'datacenter1',
            keyspace: cfg.keyspace,
            credentials: cfg.username || cfg.password ? { username: cfg.username, password: cfg.password } : undefined,
        });
        await this.client.connect();
        this.connected = true;
    }

    async disconnect() {
        if (this.client) await this.client.shutdown();
        this.client = null;
        this.connected = false;
    }

    async executeQuery(cql, params = []) {
        this._checkDriver();
        const result = await this.client.execute(cql, params, { prepare: true });
        return { rows: result.rows || [] };
    }

    async getServerVersion() {
        const { rows } = await this.executeQuery('SELECT release_version, cluster_name FROM system.local');
        return {
            engine: 'cassandra',
            version: rows[0]?.release_version || 'unknown',
            cluster: rows[0]?.cluster_name || 'unknown',
        };
    }

    async getDatabaseList() {
        const { rows } = await this.executeQuery('SELECT keyspace_name FROM system_schema.keyspaces');
        return rows.map((r) => ({ name: r.keyspace_name }));
    }

    async getOverviewStats() {
        const { rows: peers } = await this.executeQuery('SELECT COUNT(*) AS peer_count FROM system.peers');
        return {
            node_count: Number(peers[0]?.peer_count || 0) + 1, // +1 for local node
            engine: 'cassandra',
        };
    }

    async getPerformanceStats() {
        // Slow queries aren't in Cassandra's default system views. Surface
        // what's available via system_traces (requires TRACING ON at session level).
        try {
            const { rows } = await this.executeQuery(
                `SELECT session_id, parameters, duration
                   FROM system_traces.sessions
                  LIMIT 20`,
            );
            return {
                slow_queries: rows.map((r) => ({
                    session_id: String(r.session_id),
                    params: r.parameters,
                    duration_us: Number(r.duration) || 0,
                })),
            };
        } catch {
            return { slow_queries: [], note: 'Enable TRACING to capture slow-query samples.' };
        }
    }

    // Cassandra doesn't maintain live row counts, but each replica keeps
    // `system.size_estimates` which gives an approximation per token range.
    // We aggregate by keyspace+table to produce a per-table estimate.
    async getTableStats() {
        const { rows: tables } = await this.executeQuery(
            'SELECT keyspace_name, table_name FROM system_schema.tables LIMIT 500',
        );
        const { rows: estimates } = await this.executeQuery(
            `SELECT keyspace_name, table_name,
                    SUM(mean_partition_size) AS mean_size,
                    SUM(partitions_count)    AS est_partitions
               FROM system.size_estimates
              GROUP BY keyspace_name, table_name`,
        ).catch(() => ({ rows: [] }));
        const byName = new Map(estimates.map((e) => [`${e.keyspace_name}.${e.table_name}`, e]));
        return tables.map((r) => {
            const est = byName.get(`${r.keyspace_name}.${r.table_name}`) || {};
            return {
                schema: r.keyspace_name,
                name: r.table_name,
                rows_estimate: Number(est.est_partitions) || 0, // one partition per "row" in typical modeling
                bytes_estimate: Number(est.mean_size) * Number(est.est_partitions || 0) || 0,
                note: 'Approximation via system.size_estimates (per-replica, token-range sampled).',
            };
        });
    }

    async getIndexStats() {
        const { rows } = await this.executeQuery(
            'SELECT keyspace_name, table_name, index_name FROM system_schema.indexes',
        ).catch(() => ({ rows: [] }));
        return rows;
    }

    async getActiveConnections() {
        try {
            const { rows } = await this.executeQuery(
                'SELECT address, username, driver_name, driver_version FROM system_views.clients',
            );
            return rows.map((r) => ({
                address: r.address?.toString(),
                user: r.username,
                driver: `${r.driver_name || ''} ${r.driver_version || ''}`.trim(),
            }));
        } catch {
            return []; // Older Cassandra versions lack system_views.
        }
    }

    // Lock equivalent: LWT (lightweight transactions) conflicts surface in
    // the driver's metrics. When JMX is available we'd pull `ReadRepair`
    // and `CasContentionHistogram`; without JMX we return the hot-keys
    // signal we CAN see — top partitions from system.size_estimates.
    async getLockInfo() {
        const { rows } = await this.executeQuery(
            `SELECT keyspace_name, table_name, mean_partition_size, partitions_count
               FROM system.size_estimates
              ORDER BY mean_partition_size DESC NULLS LAST
              LIMIT 20`,
        ).catch(() => ({ rows: [] }));
        return {
            kind: 'hot_partitions',
            locks: rows.map((r) => ({
                schema: r.keyspace_name,
                table: r.table_name,
                mean_size: Number(r.mean_partition_size) || 0,
                partitions: Number(r.partitions_count) || 0,
            })),
            note: 'Cassandra has no row locks. Hot partitions (large mean_partition_size) are the nearest actionable contention signal.',
        };
    }

    // Replication strategy per keyspace.
    async getReplicationStatus() {
        const { rows } = await this.executeQuery(
            'SELECT keyspace_name, replication, durable_writes FROM system_schema.keyspaces',
        );
        return {
            kind: 'keyspace_replication',
            replicas: rows.map((r) => ({
                keyspace: r.keyspace_name,
                strategy: r.replication?.class || null,
                replication: r.replication,
                durable_writes: r.durable_writes,
            })),
        };
    }

    // Wait events — without JMX we sample from system_traces (if TRACING
    // has been enabled upstream). Otherwise we return empty with guidance.
    async getWaitEvents() {
        try {
            const { rows } = await this.executeQuery(
                `SELECT activity, source, source_elapsed
                   FROM system_traces.events
                  LIMIT 200`,
            );
            const bucket = new Map();
            for (const r of rows) {
                const key = String(r.activity || 'unknown').slice(0, 60);
                bucket.set(key, (bucket.get(key) || 0) + Number(r.source_elapsed || 0));
            }
            return {
                window: 'since_last_trace_flush',
                events: [...bucket.entries()].map(([event, micros]) => ({ event, micros })),
            };
        } catch {
            return {
                events: [],
                note: 'Enable TRACING on the session + ALTER KEYSPACE system_traces REPLICATION to capture wait events.',
            };
        }
    }

    // Plan capture: Cassandra's equivalent is `TRACING ON` + re-run query,
    // then read session_id from system_traces.sessions.
    async getPlanForQuery(cql) {
        await this.executeQuery('TRACING ON').catch(() => undefined);
        try {
            await this.executeQuery(cql);
        } catch {
            /* swallow — we still want the trace if any */
        }
        const { rows } = await this.executeQuery(
            `SELECT session_id, request, coordinator, duration, parameters
               FROM system_traces.sessions
              ORDER BY started_at DESC LIMIT 1`,
        ).catch(() => ({ rows: [] }));
        await this.executeQuery('TRACING OFF').catch(() => undefined);
        return { engine: 'cassandra', plan: rows[0] || null };
    }

    async getKeyMetrics() {
        return await this.getOverviewStats();
    }

    /**
     * Cassandra is a wide-column store. Replication (per-keyspace strategy)
     * and partitioning (partition keys) are first-class. No joins, no
     * PG-style VACUUM/WAL (compaction + commitlog), no server-side row
     * locks. Plan capture via CQL TRACING. Secondary indexes via getIndexStats.
     */
    getCapabilities() {
        return {
            ...super.getCapabilities(),
            replication: true,
            schemas: true,
            partitioning: true,
            sharding: true,
            vacuum: false,
            wal: false,
            queryPlan: true,
            explain: false,
            indexes: true,
            locks: false,
            waitEvents: true,
            queryHistory: false,
            slowQueryLog: true,
            storedProcedures: false,
            triggers: true,
            backup: true,
            restore: true,
        };
    }
}

export default CassandraAdapter;
