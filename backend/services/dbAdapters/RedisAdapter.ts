// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * RedisAdapter.js
 *
 * Redis-specific adapter using the ioredis driver (optional peer dependency).
 *
 * Monitoring surface:
 *   • INFO (server / clients / memory / stats / replication / keyspace) for overview.
 *   • CLIENT LIST for active connections.
 *   • SLOWLOG GET N for top slow commands.
 *   • LATENCY LATEST for p99-style latency events (best-effort; falls back silently).
 *   • CONFIG GET * for read-only configuration inspection.
 *
 * Redis has no tables/indexes/schemas in the relational sense. getTableStats()
 * returns per-database keyspace info (one row per non-empty logical DB); the
 * index/lock methods return an empty array because the concept does not apply.
 */

import { BaseAdapter } from './BaseAdapter.js';

let ioredis;
try {
    // Route through a string so tsc / bundlers do not statically resolve it.
    const moduleId = 'ioredis';
    ioredis = (await import(moduleId)).default || (await import(moduleId));
} catch {
    ioredis = null;
}

/**
 * Parse Redis INFO output into a nested object keyed by section.
 *   "# Server\nredis_version:7.2.0\n\n# Clients\nconnected_clients:3\n"
 *   → { server: { redis_version: '7.2.0' }, clients: { connected_clients: '3' } }
 */
export function parseRedisInfo(text) {
    const out = {};
    let section = 'default';
    const lines = String(text || '').split(/\r?\n/);
    for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        if (line.startsWith('#')) {
            section = line.slice(1).trim().toLowerCase() || 'default';
            if (!out[section]) out[section] = {};
            continue;
        }
        const idx = line.indexOf(':');
        if (idx === -1) continue;
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim();
        if (!out[section]) out[section] = {};
        out[section][key] = val;
    }
    return out;
}

/** Parse a keyspace value like "keys=120,expires=10,avg_ttl=0" → { keys:120, expires:10, avg_ttl:0 }. */
export function parseKeyspaceValue(v) {
    const out = {};
    if (!v) return out;
    for (const part of String(v).split(',')) {
        const [k, raw] = part.split('=');
        if (!k) continue;
        const num = Number(raw);
        out[k.trim()] = Number.isFinite(num) ? num : raw;
    }
    return out;
}

export class RedisAdapter extends BaseAdapter {
    constructor(config) {
        super(config);
        this.dbType = 'redis';
        this.client = null;
    }

    getDriverName() { return 'Redis'; }

    _checkDriver() {
        if (!ioredis) {
            throw new Error('Redis driver (ioredis) not installed. Install with: npm install ioredis');
        }
    }

    _buildConnectionOptions() {
        if (this.config.connectionString) return this.config.connectionString;
        return {
            host: this.config.host || 'localhost',
            port: Number(this.config.port) || 6379,
            username: this.config.user || undefined,
            password: this.config.password || undefined,
            db: Number(this.config.database ?? 0),
            tls: this.config.tls || this.config.ssl ? {} : undefined,
            connectTimeout: 5000,
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
            lazyConnect: true,
        };
    }

    async connect() {
        this._checkDriver();
        try {
            const Ctor = ioredis.Redis || ioredis.default || ioredis;
            this.client = new Ctor(this._buildConnectionOptions());
            await this.client.connect();
            this.connected = true;
        } catch (error) {
            throw new Error(`Redis connection failed: ${error.message}`);
        }
    }

    async disconnect() {
        if (this.client) {
            try { await this.client.quit(); } catch { /* ignore */ }
            this.client = null;
            this.connected = false;
        }
    }

    async _info(section) {
        const raw = section ? await this.client.info(section) : await this.client.info();
        return parseRedisInfo(raw);
    }

    async getServerVersion() {
        const info = await this._info('server');
        return {
            version: info.server?.redis_version || 'unknown',
            mode: info.server?.redis_mode || 'standalone',
            os: info.server?.os || null,
            uptime_sec: Number(info.server?.uptime_in_seconds || 0),
        };
    }

    async getOverviewStats() {
        const info = await this._info();
        const mem = info.memory || {};
        const stats = info.stats || {};
        const clients = info.clients || {};
        const repl = info.replication || {};
        return {
            version: info.server?.redis_version,
            uptime_sec: Number(info.server?.uptime_in_seconds || 0),
            connected_clients: Number(clients.connected_clients || 0),
            blocked_clients: Number(clients.blocked_clients || 0),
            used_memory_bytes: Number(mem.used_memory || 0),
            used_memory_peak_bytes: Number(mem.used_memory_peak || 0),
            mem_fragmentation_ratio: Number(mem.mem_fragmentation_ratio || 0),
            total_commands_processed: Number(stats.total_commands_processed || 0),
            instantaneous_ops_per_sec: Number(stats.instantaneous_ops_per_sec || 0),
            keyspace_hits: Number(stats.keyspace_hits || 0),
            keyspace_misses: Number(stats.keyspace_misses || 0),
            evicted_keys: Number(stats.evicted_keys || 0),
            expired_keys: Number(stats.expired_keys || 0),
            role: repl.role || 'unknown',
        };
    }

    async getPerformanceStats() {
        const info = await this._info();
        const stats = info.stats || {};
        const hits = Number(stats.keyspace_hits || 0);
        const misses = Number(stats.keyspace_misses || 0);
        const total = hits + misses;
        return {
            ops_per_sec: Number(stats.instantaneous_ops_per_sec || 0),
            input_kbps: Number(stats.instantaneous_input_kbps || 0),
            output_kbps: Number(stats.instantaneous_output_kbps || 0),
            keyspace_hit_rate: total > 0 ? this.round(hits / total, 4) : null,
            evicted_keys: Number(stats.evicted_keys || 0),
            rejected_connections: Number(stats.rejected_connections || 0),
            latest_fork_usec: Number(stats.latest_fork_usec || 0),
        };
    }

    async getKeyMetrics() {
        const info = await this._info();
        const mem = info.memory || {};
        const clients = info.clients || {};
        const stats = info.stats || {};
        const maxMem = Number(mem.maxmemory || 0);
        const usedMem = Number(mem.used_memory || 0);
        const memPct = maxMem > 0 ? this.round((usedMem / maxMem) * 100, 2) : null;
        const hits = Number(stats.keyspace_hits || 0);
        const misses = Number(stats.keyspace_misses || 0);
        const total = hits + misses;
        const hitRatePct = total > 0 ? this.round((hits / total) * 100, 2) : null;

        return [
            {
                id: 'connected_clients', label: 'Connected clients',
                value: Number(clients.connected_clients || 0), unit: 'clients',
                category: 'connections', severity: 'ok',
                thresholds: { warning: 5000, critical: 9000 },
                description: 'Active client connections.', dbSpecific: false,
            },
            {
                id: 'ops_per_sec', label: 'Operations / sec',
                value: Number(stats.instantaneous_ops_per_sec || 0), unit: 'ops/s',
                category: 'performance', severity: 'ok',
                thresholds: { warning: 50000, critical: 100000 },
                description: 'Current command throughput.', dbSpecific: true,
            },
            {
                id: 'memory_used_pct', label: 'Memory used (vs maxmemory)',
                value: memPct ?? 0, unit: '%',
                category: 'storage',
                severity: memPct === null ? 'ok' : memPct >= 90 ? 'critical' : memPct >= 75 ? 'warning' : 'ok',
                thresholds: { warning: 75, critical: 90 },
                description: 'Fraction of configured maxmemory in use. Null if maxmemory=0.',
                dbSpecific: true,
            },
            {
                id: 'keyspace_hit_rate', label: 'Keyspace hit rate',
                value: hitRatePct ?? 0, unit: '%',
                category: 'performance',
                severity: hitRatePct === null ? 'ok' : hitRatePct < 50 ? 'warning' : 'ok',
                thresholds: { warning: 50, critical: 25 },
                description: 'hits / (hits + misses) since server start.', dbSpecific: true,
            },
            {
                id: 'evicted_keys', label: 'Evicted keys',
                value: Number(stats.evicted_keys || 0), unit: 'keys',
                category: 'storage',
                severity: Number(stats.evicted_keys || 0) > 0 ? 'warning' : 'ok',
                thresholds: { warning: 1, critical: 1000 },
                description: 'Keys evicted due to maxmemory pressure.', dbSpecific: true,
            },
            {
                id: 'mem_fragmentation_ratio', label: 'Memory fragmentation ratio',
                value: Number(mem.mem_fragmentation_ratio || 0), unit: 'x',
                category: 'storage',
                severity: Number(mem.mem_fragmentation_ratio || 1) > 1.5 ? 'warning' : 'ok',
                thresholds: { warning: 1.5, critical: 2.0 },
                description: 'RSS / used_memory. > 1.5 suggests fragmentation.',
                dbSpecific: true,
            },
        ];
    }

    async getTableStats() {
        const info = await this._info('keyspace');
        const ks = info.keyspace || {};
        return Object.entries(ks).map(([dbKey, raw]) => {
            const parsed = parseKeyspaceValue(raw);
            return {
                name: dbKey, // e.g., "db0"
                type: 'logical-db',
                keys: parsed.keys || 0,
                expires: parsed.expires || 0,
                avg_ttl_ms: parsed.avg_ttl || 0,
            };
        });
    }

    async getIndexStats() { return []; }
    async getLockInfo() { return []; }

    async getActiveConnections() {
        const raw = await this.client.client('LIST');
        const lines = String(raw || '').split(/\r?\n/).filter(Boolean);
        return lines.map((line) => {
            const kv = {};
            for (const part of line.split(/\s+/)) {
                const eq = part.indexOf('=');
                if (eq === -1) continue;
                kv[part.slice(0, eq)] = part.slice(eq + 1);
            }
            return {
                id: kv.id,
                addr: kv.addr,
                name: kv.name || null,
                age_sec: Number(kv.age || 0),
                idle_sec: Number(kv.idle || 0),
                db: Number(kv.db || 0),
                last_cmd: kv.cmd || null,
            };
        });
    }

    async getReplicationStatus() {
        const info = await this._info('replication');
        const r = info.replication || {};
        const replicas = [];
        for (const [k, v] of Object.entries(r)) {
            if (/^slave\d+$/i.test(k) || /^replica\d+$/i.test(k)) {
                replicas.push({ slot: k, raw: v });
            }
        }
        return {
            role: r.role || 'unknown',
            connected_slaves: Number(r.connected_slaves || 0),
            master_replid: r.master_replid || null,
            master_repl_offset: Number(r.master_repl_offset || 0),
            slave_repl_offset: r.role === 'slave' ? Number(r.slave_repl_offset || 0) : null,
            master_link_status: r.master_link_status || null,
            replicas,
        };
    }

    async getDatabaseList() {
        const stats = await this.getTableStats();
        return stats.map((s) => ({ name: s.name, keys: s.keys }));
    }

    async executeQuery(command, args = []) {
        if (!command || typeof command !== 'string') {
            throw new Error('Redis executeQuery: command must be a non-empty string');
        }
        const start = Date.now();
        const result = await this.client.call(command, ...args);
        return {
            rows: Array.isArray(result) ? result : [result],
            fields: [],
            rowCount: Array.isArray(result) ? result.length : 1,
            duration: Date.now() - start,
        };
    }

    /** SLOWLOG GET N — top-N slow commands. */
    async getSlowLog(n = 50) {
        try {
            const raw = await this.client.slowlog('GET', n);
            return (raw || []).map(([id, ts, durationMicros, args, clientAddr, clientName]) => ({
                id, timestamp_sec: ts, duration_us: durationMicros,
                command: Array.isArray(args) ? args.join(' ') : String(args),
                client_addr: clientAddr || null, client_name: clientName || null,
            }));
        } catch (err) {
            return [{ error: err.message }];
        }
    }

    /** LATENCY LATEST — best-effort; silently returns [] if server has it disabled. */
    async getLatencyLatest() {
        try {
            const raw = await this.client.call('LATENCY', 'LATEST');
            return (raw || []).map(([event, ts, latest, max]) => ({
                event, timestamp_sec: ts, latest_ms: latest, max_ms: max,
            }));
        } catch {
            return [];
        }
    }

    getCapabilities() {
        return {
            replication: true,
            vacuum: false,
            indexes: false,
            locks: false,
            queryPlan: false,
            wal: false,
            schemas: false,
            storedProcedures: false,
            partitioning: false,
            sharding: false,
            // Redis-specific extras:
            slowlog: true,
            latencyMonitoring: true,
            pubsub: true,
        };
    }
}

export default RedisAdapter;
