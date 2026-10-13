// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * ElasticsearchAdapter.js
 *
 * Elasticsearch adapter using @elastic/elasticsearch (optional peer dep).
 * Also compatible with OpenSearch 2.x — the cluster/ indices / _cat APIs used
 * here exist identically on both.
 *
 * Monitoring surface:
 *   • GET /             → server version
 *   • GET /_cluster/health
 *   • GET /_nodes/stats (nodes, JVM, OS, FS)
 *   • GET /_cluster/stats (total docs, indices, shards)
 *   • GET /_cat/indices?v&format=json (per-index sizes, doc counts)
 *   • GET /_nodes/hot_threads (text, trimmed)
 *   • GET /_cluster/pending_tasks
 *   • _search for arbitrary query execution
 */

import { BaseAdapter } from './BaseAdapter.js';

// Lazy driver load (was a top-level await — see MSSQLAdapter note).
let esClient: any;
let _esClientLoading: Promise<any> | null = null;
async function ensureDriver() {
    if (esClient !== undefined) return esClient;
    if (!_esClientLoading) {
        _esClientLoading = (async () => {
            try {
                const moduleId = '@elastic/elasticsearch';
                esClient = await import(moduleId);
            } catch {
                esClient = null;
            }
        })();
    }
    await _esClientLoading;
    return esClient;
}

export class ElasticsearchAdapter extends BaseAdapter {
    constructor(config) {
        super(config);
        this.dbType = 'elasticsearch';
        this.client = null;
    }

    getDriverName() {
        return 'Elasticsearch';
    }

    _checkDriver() {
        if (!esClient) {
            throw new Error(
                'Elasticsearch driver (@elastic/elasticsearch) not installed. Install with: npm install @elastic/elasticsearch',
            );
        }
    }

    _buildClientOptions() {
        const node =
            this.config.connectionString ||
            this.config.node ||
            `http${this.config.tls || this.config.ssl ? 's' : ''}://${this.config.host || 'localhost'}:${this.config.port || 9200}`;
        const auth = this.config.apiKey
            ? { apiKey: this.config.apiKey }
            : this.config.user
              ? { username: this.config.user, password: this.config.password || '' }
              : undefined;
        const tls = this.config.tls || this.config.ssl ? { rejectUnauthorized: !this.config.insecure } : undefined;
        return { node, auth, tls, requestTimeout: 10000 };
    }

    async connect() {
        await ensureDriver();
        this._checkDriver();
        try {
            const ClientCtor = esClient.Client || esClient.default?.Client;
            if (!ClientCtor) throw new Error('Elasticsearch client constructor not found on driver module');
            this.client = new ClientCtor(this._buildClientOptions());
            // Ping to confirm reachability.
            await this.client.ping();
            this.connected = true;
        } catch (error) {
            throw new Error(`Elasticsearch connection failed: ${error.message}`);
        }
    }

    async disconnect() {
        if (this.client) {
            try {
                await this.client.close();
            } catch {
                /* ignore */
            }
            this.client = null;
            this.connected = false;
        }
    }

    async getServerVersion() {
        const info = await this.client.info();
        const version = info?.version?.number || info?.body?.version?.number || 'unknown';
        const clusterName = info?.cluster_name || info?.body?.cluster_name || 'unknown';
        const flavor = info?.version?.distribution || info?.body?.version?.distribution || 'elasticsearch';
        return { version, clusterName, flavor };
    }

    async getOverviewStats() {
        const [health, stats] = await Promise.all([this.client.cluster.health(), this.client.cluster.stats()]);
        const h = health?.body || health;
        const s = stats?.body || stats;
        return {
            cluster_name: h.cluster_name,
            status: h.status, // green / yellow / red
            number_of_nodes: h.number_of_nodes,
            number_of_data_nodes: h.number_of_data_nodes,
            active_primary_shards: h.active_primary_shards,
            active_shards: h.active_shards,
            relocating_shards: h.relocating_shards,
            initializing_shards: h.initializing_shards,
            unassigned_shards: h.unassigned_shards,
            delayed_unassigned_shards: h.delayed_unassigned_shards,
            indices_count: s?.indices?.count,
            docs_count: s?.indices?.docs?.count,
            store_size_bytes: s?.indices?.store?.size_in_bytes,
        };
    }

    async getPerformanceStats() {
        const nodes = await this.client.nodes.stats({ metric: ['indices', 'jvm', 'os', 'thread_pool'] });
        const n = nodes?.body || nodes;
        const aggregated = { search_query_total: 0, search_fetch_total: 0, indexing_index_total: 0, get_total: 0 };
        const heapUsedPct = [];
        for (const node of Object.values(n?.nodes || {})) {
            aggregated.search_query_total += Number(node?.indices?.search?.query_total || 0);
            aggregated.search_fetch_total += Number(node?.indices?.search?.fetch_total || 0);
            aggregated.indexing_index_total += Number(node?.indices?.indexing?.index_total || 0);
            aggregated.get_total += Number(node?.indices?.get?.total || 0);
            const pct = Number(node?.jvm?.mem?.heap_used_percent);
            if (Number.isFinite(pct)) heapUsedPct.push(pct);
        }
        return {
            ...aggregated,
            heap_used_pct_max: heapUsedPct.length ? Math.max(...heapUsedPct) : null,
            heap_used_pct_avg: heapUsedPct.length
                ? this.round(heapUsedPct.reduce((a, b) => a + b, 0) / heapUsedPct.length, 2)
                : null,
        };
    }

    async getKeyMetrics() {
        const [health, nodes] = await Promise.all([
            this.client.cluster.health(),
            this.client.nodes.stats({ metric: ['jvm', 'fs'] }),
        ]);
        const h = health?.body || health;
        const n = nodes?.body || nodes;
        const statusSeverity = h.status === 'red' ? 'critical' : h.status === 'yellow' ? 'warning' : 'ok';

        let heapPctMax = 0;
        let fsUsedPctMax = 0;
        for (const node of Object.values(n?.nodes || {})) {
            const pct = Number(node?.jvm?.mem?.heap_used_percent || 0);
            if (pct > heapPctMax) heapPctMax = pct;
            const total = Number(node?.fs?.total?.total_in_bytes || 0);
            const free = Number(node?.fs?.total?.free_in_bytes || 0);
            if (total > 0) {
                const used = total - free;
                const pctFs = (used / total) * 100;
                if (pctFs > fsUsedPctMax) fsUsedPctMax = pctFs;
            }
        }

        return [
            {
                id: 'cluster_status',
                label: 'Cluster status',
                value: h.status || 'unknown',
                unit: '',
                category: 'replication',
                severity: statusSeverity,
                thresholds: { warning: 0, critical: 0 },
                description: 'green / yellow / red cluster health.',
                dbSpecific: true,
            },
            {
                id: 'unassigned_shards',
                label: 'Unassigned shards',
                value: Number(h.unassigned_shards || 0),
                unit: 'shards',
                category: 'replication',
                severity: h.unassigned_shards > 0 ? 'warning' : 'ok',
                thresholds: { warning: 1, critical: 10 },
                description: 'Shards not yet allocated to a node.',
                dbSpecific: true,
            },
            {
                id: 'jvm_heap_used_pct_max',
                label: 'JVM heap used (max across nodes)',
                value: this.round(heapPctMax, 2),
                unit: '%',
                category: 'performance',
                severity: heapPctMax >= 85 ? 'critical' : heapPctMax >= 75 ? 'warning' : 'ok',
                thresholds: { warning: 75, critical: 85 },
                description: 'Highest JVM heap utilisation observed across data nodes.',
                dbSpecific: true,
            },
            {
                id: 'fs_used_pct_max',
                label: 'Filesystem used (max across nodes)',
                value: this.round(fsUsedPctMax, 2),
                unit: '%',
                category: 'storage',
                severity: fsUsedPctMax >= 90 ? 'critical' : fsUsedPctMax >= 80 ? 'warning' : 'ok',
                thresholds: { warning: 80, critical: 90 },
                description: 'Highest data-path disk usage across nodes.',
                dbSpecific: true,
            },
        ];
    }

    async getTableStats() {
        // _cat/indices is the simplest per-index view; format: json.
        const res = await this.client.cat.indices({ format: 'json', bytes: 'b' });
        const rows = res?.body || res || [];
        return (Array.isArray(rows) ? rows : []).map((r) => ({
            name: r.index,
            health: r.health,
            status: r.status,
            uuid: r.uuid,
            primaries: Number(r.pri || 0),
            replicas: Number(r.rep || 0),
            docs_count: Number(r['docs.count'] || 0),
            docs_deleted: Number(r['docs.deleted'] || 0),
            store_size_bytes: Number(r['store.size'] || 0),
        }));
    }

    async getIndexStats() {
        return this.getTableStats();
    }

    async getLockInfo() {
        return [];
    }

    async getActiveConnections() {
        // Elasticsearch does not expose "client connections" in the SQL sense.
        // The closest useful signal is thread pool queues + pending tasks.
        try {
            const pending = await this.client.cluster.pendingTasks();
            const p = pending?.body || pending;
            return (p?.tasks || []).map((t) => ({
                id: t.insert_order,
                priority: t.priority,
                source: t.source,
                executing: t.executing,
                time_in_queue_ms: t.time_in_queue_millis,
            }));
        } catch {
            return [];
        }
    }

    async getReplicationStatus() {
        const health = await this.client.cluster.health();
        const h = health?.body || health;
        return {
            role: 'cluster',
            status: h.status,
            active_primary_shards: h.active_primary_shards,
            active_shards: h.active_shards,
            relocating_shards: h.relocating_shards,
            unassigned_shards: h.unassigned_shards,
            number_of_data_nodes: h.number_of_data_nodes,
        };
    }

    async getDatabaseList() {
        const stats = await this.getTableStats();
        return stats.map((s) => ({ name: s.name, docs: s.docs_count, size: s.store_size_bytes }));
    }

    /** Execute an Elasticsearch query DSL against an index.
     *  `sql` here carries a JSON body string (since ES uses DSL, not SQL).
     *  Pass params as { index: string } or let it default to _all.
     */
    async executeQuery(dslJson, params = {}) {
        const index = params.index || '_all';
        const body = typeof dslJson === 'string' ? JSON.parse(dslJson) : dslJson || { query: { match_all: {} } };
        const start = Date.now();
        const res = await this.client.search({ index, body });
        const hits = res?.body?.hits?.hits || res?.hits?.hits || [];
        return {
            rows: hits.map((h) => ({ _id: h._id, _score: h._score, ...h._source })),
            fields: [],
            rowCount: hits.length,
            duration: Date.now() - start,
        };
    }

    /** Snapshot /_nodes/hot_threads for a given duration.
     *  Returns the raw text trimmed to `maxBytes`.
     */
    async getHotThreads({ threads = 3, interval = '500ms', maxBytes = 20000 } = {}) {
        try {
            const res = await this.client.nodes.hotThreads({ threads, interval });
            const text = typeof res === 'string' ? res : res?.body || '';
            return String(text).slice(0, maxBytes);
        } catch (err) {
            return `hot_threads unavailable: ${err.message}`;
        }
    }

    getCapabilities() {
        return {
            replication: true,
            vacuum: false,
            indexes: true,
            locks: false,
            queryPlan: false,
            wal: false,
            schemas: false,
            storedProcedures: false,
            partitioning: false,
            sharding: true,
            // Elasticsearch-specific:
            fullTextSearch: true,
            hotThreads: true,
        };
    }
}

export default ElasticsearchAdapter;
