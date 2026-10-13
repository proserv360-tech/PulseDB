// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Pools and clients for user-added connections: creation, overrides, LRU/idle eviction, and request helpers.
// Extracted from server.ts.

import { Pool } from 'pg';
import { log } from '../services/logger.js';
import { getTunnelPort, openTunnel } from '../services/sshTunnel.js';
import { getUserActiveConnectionId, getUserActiveDatabaseId } from './activeSelection.js';
import { buildSslOption, STATEMENT_TIMEOUT_MS } from './adminPool.js';
import { IS_PROD } from './config.js';
import { ensureConnectionsTable, getConnections, syncConnectionsCache } from './connectionStore.js';

// ── Optional DB drivers (graceful fallback if not installed) ──
export let mysql2 = null;
export let mongodb = null;
try {
    mysql2 = await import('mysql2/promise');
} catch {
    /* mysql2 not installed */
}
try {
    mongodb = await import('mongodb');
} catch {
    /* mongodb not installed */
}

export const connectionPools = new Map();
// Map<connectionId, { client: MongoClient, db: Db }> — MongoDB clients
export const mongoClients = new Map();
// PRF-01 (audit): in-flight pool/client creations. Two concurrent callers for
// the same connectionId share a single pending Promise instead of racing and
// leaking a duplicate pool/client.
const poolInFlight = new Map(); // Map<connectionId, Promise<pool>>
const mongoInFlight = new Map(); // Map<connectionId, Promise<{client,db}>>
// PRF-02 (audit): per-pool lastUsed timestamps for idle eviction.
const poolLastUsed = new Map(); // Map<connectionId, ms epoch>
const mongoLastUsed = new Map(); // Map<connectionId, ms epoch>
const POOL_IDLE_EVICT_MS = Number(process.env.FATHOM_POOL_IDLE_EVICT_MS) || 30 * 60 * 1000; // 30 min
const POOL_EVICT_SWEEP_MS = Number(process.env.FATHOM_POOL_EVICT_SWEEP_MS) || 5 * 60 * 1000; // 5 min
// Hard cap on simultaneously-live connection pools / Mongo clients across the
// process. When we hit the cap we evict the least-recently-used entry instead
// of throwing — see evictLruPoolIfNeeded() below.
const MAX_LIVE_POOLS = Number(process.env.FATHOM_MAX_LIVE_POOLS) || 20;
const MAX_LIVE_MONGO_CLIENTS = Number(process.env.FATHOM_MAX_LIVE_MONGO_CLIENTS) || 20;

function touchPool(id) {
    poolLastUsed.set(id, Date.now());
}
function touchMongoClient(id) {
    mongoLastUsed.set(id, Date.now());
}

export const isPgLikeEngine = (dbType) => (dbType || 'postgresql').toLowerCase().includes('postgres');

// Engines whose connections are bound to a single database that we can re-target
// at runtime by opening another pool/handle.
const SWITCHABLE_DB_TYPES = new Set(['postgresql', 'postgres', 'mysql', 'mariadb', 'mongodb']);

/**
 * Decide whether a connection can switch databases, and why not if it can't.
 * The main real-world blocker is a transaction-mode pooler (Supabase 6543,
 * pgbouncer), which pins a client to one database and can't be re-targeted.
 */
export function isDatabaseSwitchable(conn) {
    const dbType = (conn.dbType || 'postgresql').toLowerCase();
    if (!SWITCHABLE_DB_TYPES.has(dbType)) {
        return { ok: false, reason: `${dbType} connections don't support switching databases in place.` };
    }
    const host = String(conn.host || '').toLowerCase();
    const port = Number(conn.port);
    if (/pooler\.supabase\.com/.test(host) && port === 6543) {
        return {
            ok: false,
            reason: 'This connection uses the Supabase transaction pooler (port 6543), which binds to one database. Add a direct connection (port 5432) to switch databases.',
        };
    }
    return { ok: true, reason: null };
}

// Override pools keyed by `${connectionId}::${database}`. Separate from the main
// connectionPools cache so the existing pool mechanics stay untouched. Capped +
// LRU-evicted so a user browsing many databases can't leak sockets forever.
const overridePools = new Map(); // key -> { pool, dbType, lastUsed }
const OVERRIDE_POOL_MAX = Number(process.env.FATHOM_OVERRIDE_POOL_MAX) || 8;

export async function getOverridePool(conn, database, schema = null) {
    // Only Postgres uses the schema part (search_path); ignore it elsewhere.
    const pgLike = isPgLikeEngine(conn.dbType);
    const effSchema = pgLike && schema ? schema : null;
    const key = `${conn.id}::${database}::${effSchema || ''}`;
    const hit = overridePools.get(key);
    if (hit) {
        hit.lastUsed = Date.now();
        return hit.pool;
    }
    if (overridePools.size >= OVERRIDE_POOL_MAX) {
        let victimKey = null;
        let oldest = Infinity;
        for (const [k, v] of overridePools) {
            if (v.lastUsed < oldest) {
                oldest = v.lastUsed;
                victimKey = k;
            }
        }
        if (victimKey) {
            const victim = overridePools.get(victimKey);
            overridePools.delete(victimKey);
            try {
                await victim.pool.end();
            } catch {
                /* ignore */
            }
        }
    }
    const cfg = await resolvePoolConfig(conn);
    const dbType = (conn.dbType || 'postgresql').toLowerCase();
    const isVercel = process.env.VERCEL === '1';
    let newPool;
    if (dbType === 'mysql' || dbType === 'mariadb') {
        newPool = mysql2.createPool({
            host: cfg.host,
            port: cfg.port,
            database,
            user: cfg.user,
            password: cfg.password,
            ssl: buildSslOption(conn.ssl) || undefined,
            waitForConnections: true,
            connectionLimit: isVercel ? 2 : 8,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 10000,
            connectTimeout: 8000,
            idleTimeout: 60000,
        });
    } else {
        newPool = new Pool({
            ...cfg,
            database,
            // Pin the SQL console's search_path to the selected schema (falls back
            // to public). Catalog panels filter by schemaname explicitly; this only
            // affects unqualified names in the console/workbench.
            ...(effSchema ? { options: `-c search_path="${effSchema.replace(/"/g, '')}",public` } : {}),
            max: isVercel ? 2 : 8,
            min: isVercel ? 0 : 1,
            idleTimeoutMillis: isVercel ? 5_000 : 60_000,
            connectionTimeoutMillis: 8_000,
            statement_timeout: STATEMENT_TIMEOUT_MS,
            keepAlive: true,
            keepAliveInitialDelayMillis: 10_000,
        });
        newPool.on('error', (err) => log('ERROR', `Override pool [${key}] background error`, { err: err.message }));
    }
    overridePools.set(key, { pool: newPool, dbType, lastUsed: Date.now() });
    log('INFO', `Created override pool ${key}`);
    return newPool;
}

/** Tear down any override pools belonging to a connection (on delete/update). */
async function destroyOverridePools(connectionId) {
    const prefix = `${parseInt(connectionId, 10)}::`;
    for (const [k, v] of [...overridePools]) {
        if (k.startsWith(prefix)) {
            overridePools.delete(k);
            try {
                await v.pool.end();
            } catch {
                /* ignore */
            }
        }
    }
}

/** Apply a Mongo database override without caching a second client. */
function applyMongoOverride(base, overrideDb) {
    if (!base || !overrideDb) return base;
    try {
        if (base.db && base.db.databaseName === overrideDb) return base;
        return { client: base.client, db: base.client.db(overrideDb) };
    } catch {
        return base;
    }
}

/**
 * Resolve a connection object from the cache (or DB refresh).
 * @param {number|string|null} connectionId - explicit connection ID
 * @param {number|null} userId - the authenticated user's ID (for per-user fallback)
 */
export async function resolveConnection(connectionId, userId) {
    if (!connectionId) {
        const userDefault = getUserActiveConnectionId(userId);
        if (userDefault) return resolveConnection(userDefault, userId);
        throw new Error('No database connection configured. Please add a connection in the Connection Pool settings.');
    }
    const id = parseInt(connectionId, 10);
    let conn = getConnections().find((c) => c.id === id);
    if (!conn) {
        await ensureConnectionsTable().catch((err) =>
            log('WARN', 'ensureConnectionsTable failed during resolveConnection', { error: err.message }),
        );
        await syncConnectionsCache().catch((err) =>
            log('WARN', 'syncConnectionsCache failed during resolveConnection', { error: err.message }),
        );
        conn = getConnections().find((c) => c.id === id);
    }
    if (!conn) throw new Error(`Connection ${id} not found`);
    return conn;
}

/**
 * Return the pool for a given connectionId.
 * Supports PostgreSQL (pg.Pool) and MySQL (mysql2 pool).
 * For MongoDB, use getMongoClient() instead.
 */
export async function getPool(connectionId, userId) {
    const conn = await resolveConnection(connectionId, userId);
    const id = conn.id;

    // Hot path: pool already exists.
    if (connectionPools.has(id)) {
        touchPool(id);
        return connectionPools.get(id);
    }

    // PRF-01 (audit): if another async caller is already creating this pool,
    // await their Promise instead of starting a second concurrent creation.
    if (poolInFlight.has(id)) return poolInFlight.get(id);

    // Cap total live pools across the process. When we hit the cap, evict the
    // least-recently-used pool (calling .end() on it) and continue, so a busy
    // tenant doesn't get rejected just because someone else opened a pool an
    // hour ago and never came back.
    await evictLruPoolIfNeeded();

    const dbType = (conn.dbType || 'postgresql').toLowerCase();
    if (dbType === 'mongodb') {
        throw new Error(
            'MongoDB connections must use getMongoClient() — pool-based access is not supported. Use /api/mongodb/* endpoints instead.',
        );
    }

    const creation = (async () => {
        if (dbType === 'mysql' || dbType === 'mariadb') {
            if (!mysql2) throw new Error('MySQL driver (mysql2) not installed on the server. Run: npm install mysql2');
            const cfg = await resolvePoolConfig(conn);
            const mysqlPool = mysql2.createPool({
                host: cfg.host,
                port: cfg.port,
                database: cfg.database,
                user: cfg.user,
                password: cfg.password,
                ssl: buildSslOption(conn.ssl) || undefined,
                waitForConnections: true,
                connectionLimit: 8,
                queueLimit: 0,
                enableKeepAlive: true,
                keepAliveInitialDelay: 10000, // align with PG keep-alive
                connectTimeout: 8000, // was 15s — match wizard
                idleTimeout: 60000, // keep sockets for 1 min idle
                // Cap server-side execution so a runaway monitoring query can't
                // pin a pool connection (audit 2026-06-12 follow-up). MySQL 5.7.8+.
                init: (conn) => conn.query(`SET SESSION max_execution_time = ${STATEMENT_TIMEOUT_MS}`, () => {}),
            });
            connectionPools.set(id, mysqlPool);
            touchPool(id);
            log('INFO', `Created MySQL pool for connection ${id} (${conn.name})`);
            return mysqlPool;
        }
        // PostgreSQL (default)
        // PERF tuning:
        //   max=8                       keep concurrency cap, avoid swamping
        //                               the monitored DB with parallel queries
        //                               from many dashboards.
        //   min=1                       NEW. Keep 1 socket warm so a 30s-cadence
        //                               dashboard never pays a cold reconnect.
        //   idleTimeoutMillis=60_000    NEW (was 10s). 10s was too aggressive
        //                               for an open dashboard that refreshes
        //                               every 30s.
        //   connectionTimeoutMillis=8000 NEW (was 15s). 8s aligns with the
        //                               wizard's test timeout; failing fast on
        //                               a wedged DB is a better UX than
        //                               waiting 15s.
        //   keepAlive=true              NEW. Avoid silent NAT drops that
        //                               manifest as inexplicably slow first
        //                               queries after idle.
        const cfg = await resolvePoolConfig(conn);
        // On Vercel keep this small: many serverless instances × this max can
        // exhaust a pooler's client cap (Supabase free tier = 15). Long-lived
        // single-instance hosts can use the larger pool. min=0 on Vercel so an
        // idle instance frees its sockets back to the pooler.
        const isVercel = process.env.VERCEL === '1';
        const newPool = new Pool({
            ...cfg,
            max: isVercel ? 2 : 8,
            min: isVercel ? 0 : 1,
            // Serverless: release sockets back to the pooler quickly so idle
            // instances don't sit on Supabase's limited client slots.
            idleTimeoutMillis: isVercel ? 5_000 : 60_000,
            connectionTimeoutMillis: 8_000,
            statement_timeout: STATEMENT_TIMEOUT_MS,
            keepAlive: true,
            keepAliveInitialDelayMillis: 10_000,
        });
        newPool.on('error', (err) => log('ERROR', `Pool [conn:${id}] background error`, { err: err.message }));
        connectionPools.set(id, newPool);
        touchPool(id);
        log('INFO', `Created PG pool for connection ${id} (${conn.name})`);
        return newPool;
    })();

    poolInFlight.set(id, creation);
    try {
        return await creation;
    } finally {
        poolInFlight.delete(id);
    }
}

/**
 * Return a MongoDB client + db for a given connectionId.
 */
export async function getMongoClient(connectionId, userId) {
    const conn = await resolveConnection(connectionId, userId);
    const id = conn.id;
    // A single Mongo client can serve many databases, so we cache one client per
    // connection and re-point it at the user's selected database on the way out.
    const overrideDb = getUserActiveDatabaseId(userId, id);

    if (mongoClients.has(id)) {
        touchMongoClient(id);
        return applyMongoOverride(mongoClients.get(id), overrideDb);
    }
    // PRF-01 (audit): share in-flight creations to avoid leaking duplicate clients.
    if (mongoInFlight.has(id)) return applyMongoOverride(await mongoInFlight.get(id), overrideDb);

    if (!mongodb) throw new Error('MongoDB driver not installed on the server. Run: npm install mongodb');

    // Cap total live Mongo clients across the process; evict LRU on overflow.
    await evictLruMongoClientIfNeeded();

    const creation = (async () => {
        const cfg = await resolvePoolConfig(conn);
        const userPart = cfg.user ? `${encodeURIComponent(cfg.user)}:${encodeURIComponent(cfg.password || '')}@` : '';
        // SEC: TLS certificate validation. Default to strict in production so
        // a MITM can't swap in a self-signed cert. Operators with self-signed
        // certs on internal Mongo clusters can opt back in via the same env
        // var used for Postgres (FATHOM_TLS_ALLOW_SELF_SIGNED=true). In dev,
        // unless FATHOM_TLS_STRICT=true, we keep the lax behavior so localhost
        // self-signed setups still work out of the box.
        let sslParam = '';
        if (conn.ssl) {
            const allowSelfSigned =
                process.env.FATHOM_TLS_ALLOW_SELF_SIGNED === 'true' ||
                (!IS_PROD && process.env.FATHOM_TLS_STRICT !== 'true');
            sslParam = allowSelfSigned ? '?tls=true&tlsAllowInvalidCertificates=true' : '?tls=true';
        }
        const connStr = `mongodb://${userPart}${cfg.host}:${cfg.port || 27017}/${cfg.database || 'admin'}${sslParam}`;

        const client = new mongodb.MongoClient(connStr, {
            serverSelectionTimeoutMS: 8000,
            connectTimeoutMS: 15000,
        });
        await client.connect();
        const db = client.db(cfg.database || 'admin');

        const entry = { client, db };
        mongoClients.set(id, entry);
        touchMongoClient(id);
        log('INFO', `Created MongoDB client for connection ${id} (${conn.name})`);
        return entry;
    })();

    mongoInFlight.set(id, creation);
    try {
        return applyMongoOverride(await creation, overrideDb);
    } finally {
        mongoInFlight.delete(id);
    }
}

/**
 * Destroy the cached pool/client for a connection (called on delete/update).
 */
export async function destroyPool(connectionId) {
    const id = parseInt(connectionId, 10);
    // PG / MySQL pool
    const p = connectionPools.get(id);
    if (p) {
        connectionPools.delete(id);
        poolLastUsed.delete(id);
        await p.end().catch((err) => log('WARN', `Pool end failed for connection ${id}`, { error: err.message }));
        log('INFO', `Destroyed pool for connection ${id}`);
    }
    // MongoDB client
    const m = mongoClients.get(id);
    if (m) {
        mongoClients.delete(id);
        mongoLastUsed.delete(id);
        await m.client
            .close()
            .catch((err) => log('WARN', `MongoDB close failed for connection ${id}`, { error: err.message }));
        log('INFO', `Destroyed MongoDB client for connection ${id}`);
    }
    // Any per-database override pools opened against this connection
    await destroyOverridePools(id);
}

/**
 * Find the connection id whose pool has been least-recently used, ignoring
 * any pool that is currently the in-flight creation target (we'd otherwise
 * evict the pool we're about to return). Returns undefined when the map is
 * empty or every entry is in flight.
 */
function _pickLruId(map, lastUsedMap, inFlightMap) {
    let oldestId;
    let oldestTs = Infinity;
    for (const [id] of map) {
        if (inFlightMap.has(id)) continue;
        const ts = lastUsedMap.get(id) ?? 0;
        if (ts < oldestTs) {
            oldestTs = ts;
            oldestId = id;
        }
    }
    return oldestId;
}

/**
 * If we're at or above the live-pool cap, evict the LRU SQL pool to make room.
 * No-op when under the cap. Safe to call before every pool creation.
 */
async function evictLruPoolIfNeeded() {
    if (connectionPools.size < MAX_LIVE_POOLS) return;
    const victim = _pickLruId(connectionPools, poolLastUsed, poolInFlight);
    if (victim === undefined) {
        // Every pool is being created right now; this should be vanishingly
        // rare. Don't throw — let the caller wait via the in-flight Promise.
        log('WARN', 'Pool cap reached but no eligible LRU victim found', {
            size: connectionPools.size,
            cap: MAX_LIVE_POOLS,
        });
        return;
    }
    const idle = Math.round((Date.now() - (poolLastUsed.get(victim) ?? 0)) / 1000);
    log('INFO', `Evicting LRU pool to make room for new connection`, {
        victimId: victim,
        idleSeconds: idle,
    });
    await destroyPool(victim);
}

/**
 * Same as evictLruPoolIfNeeded but for the Mongo client map.
 */
async function evictLruMongoClientIfNeeded() {
    if (mongoClients.size < MAX_LIVE_MONGO_CLIENTS) return;
    const victim = _pickLruId(mongoClients, mongoLastUsed, mongoInFlight);
    if (victim === undefined) {
        log('WARN', 'Mongo client cap reached but no eligible LRU victim found', {
            size: mongoClients.size,
            cap: MAX_LIVE_MONGO_CLIENTS,
        });
        return;
    }
    const idle = Math.round((Date.now() - (mongoLastUsed.get(victim) ?? 0)) / 1000);
    log('INFO', `Evicting LRU MongoDB client to make room for new connection`, {
        victimId: victim,
        idleSeconds: idle,
    });
    await destroyPool(victim);
}

// PRF-02 (audit): periodically evict pools that have not served a request in
// POOL_IDLE_EVICT_MS. Without this the connectionPools map grows monotonically
// to its 20-entry cap and never shrinks, eventually starving brand-new
// connections.
const _idleSweep = setInterval(async () => {
    const now = Date.now();
    for (const [id] of connectionPools) {
        const lastUsed = poolLastUsed.get(id) ?? 0;
        if (now - lastUsed > POOL_IDLE_EVICT_MS) {
            log('INFO', `Evicting idle pool for connection ${id} (idle for ${Math.round((now - lastUsed) / 1000)}s)`);
            await destroyPool(id);
        }
    }
    for (const [id] of mongoClients) {
        const lastUsed = mongoLastUsed.get(id) ?? 0;
        if (now - lastUsed > POOL_IDLE_EVICT_MS) {
            log(
                'INFO',
                `Evicting idle MongoDB client for connection ${id} (idle for ${Math.round((now - lastUsed) / 1000)}s)`,
            );
            await destroyPool(id);
        }
    }
}, POOL_EVICT_SWEEP_MS);
_idleSweep.unref?.();

/**
 * Shorthand: get the right pool for an Express request.
 * Reads connectionId from query param, falls back to user's active connection.
 */
export async function reqPool(req) {
    const userId = req.user?.id ?? null;
    const connId = req.query.connectionId || null;
    // Honor a per-request (?database=) or the user's stored active-database
    // override: if it differs from the connection's own database, serve from a
    // dedicated override pool so dashboards read the selected database.
    const conn = await resolveConnection(connId, userId);
    const dbOverride =
        (req.query.database ? String(req.query.database) : null) || getUserActiveDatabaseId(userId, conn.id);
    if (dbOverride && dbOverride !== conn.database && isDatabaseSwitchable(conn).ok) {
        return getOverridePool(conn, dbOverride);
    }
    return getPool(connId, userId);
}

/**
 * Resolve the dbType for the current request's active connection.
 * Returns 'postgresql', 'mysql', 'mariadb', or 'mongodb'.
 */
export async function reqDbType(req) {
    try {
        const userId = req.user?.id ?? null;
        const conn = await resolveConnection(req.query.connectionId || null, userId);
        return (conn.dbType || 'postgresql').toLowerCase();
    } catch {
        return 'postgresql'; // default if no connection
    }
}

/**
 * Execute a query that works for both PG and MySQL pools.
 * PG returns { rows }, MySQL returns [rows, fields].
 * This normalizes to always return { rows }.
 */
async function execQuery(poolOrResult, sql, params) {
    const result = await poolOrResult.query(sql, params);
    // MySQL returns [rows, fields] array; PG returns { rows }
    if (Array.isArray(result)) return { rows: result[0] };
    return result;
}

export async function resolvePoolConfig(c) {
    let host = c.host;
    let port = c.port;

    if (c.sshEnabled && c.sshHost) {
        let localPort = getTunnelPort(c.id);
        if (!localPort) {
            localPort = await openTunnel(c.id, {
                sshHost: c.sshHost,
                sshPort: c.sshPort || 22,
                sshUser: c.sshUser,
                sshAuthType: c.sshAuthType || 'key',
                sshPrivateKey: c.sshPrivateKey,
                sshPassphrase: c.sshPassphrase,
                sshPassword: c.sshPassword,
                dbHost: c.host,
                dbPort: c.port,
            });
        }
        host = '127.0.0.1';
        port = localPort;
    }

    return {
        host,
        port,
        database: c.database,
        user: c.username,
        password: c.password,
        ssl: buildSslOption(c.ssl),
    };
}
