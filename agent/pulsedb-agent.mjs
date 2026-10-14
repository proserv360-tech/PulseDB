#!/usr/bin/env node
/**
 * PulseDB Agent — lets a cloud PulseDB work with databases it cannot reach.
 *
 * Runs next to the database (same PC or LAN). It:
 *   1. registers its configured targets with PulseDB (they appear as
 *      connections in the PulseDB UI, owned by whoever created the agent key)
 *   2. long-polls PulseDB for jobs (connection tests, monitoring queries,
 *      console queries) and runs them against the local database
 *   3. posts the results back
 *
 * Everything is outbound HTTPS from this machine: no inbound ports, and the
 * database credentials never leave this machine (they live in agent.config.json).
 *
 *   node pulsedb-agent.mjs [--config path\to\agent.config.json]
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { assertReadOnly } from './readOnlyGuard.mjs';

const VERSION = '1.2.1';
const here = path.dirname(fileURLToPath(import.meta.url));

// ── config ──────────────────────────────────────────────────────────────────
function argValue(flag) {
    const i = process.argv.indexOf(flag);
    return i > -1 ? process.argv[i + 1] : undefined;
}
const configPath = path.resolve(argValue('--config') || path.join(here, 'agent.config.json'));

function log(level, msg, meta = {}) {
    const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...meta });
    (level === 'error' ? console.error : console.log)(line);
}

function loadConfig() {
    if (!fs.existsSync(configPath)) {
        log('error', `config not found: ${configPath} — copy agent.config.example.json to agent.config.json and fill it in`);
        process.exit(1);
    }
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    cfg.pulsedbUrl = String(process.env.PULSEDB_URL || cfg.pulsedbUrl || '').replace(/\/+$/, '');
    cfg.agentKey = process.env.PULSEDB_AGENT_KEY || cfg.agentKey;
    if (!/^https?:\/\//.test(cfg.pulsedbUrl)) throw new Error('pulsedbUrl must be the PulseDB address, e.g. https://pulsedb.example.com');
    if (!cfg.agentKey || /CHANGE-ME/.test(cfg.agentKey)) throw new Error('agentKey is required (create an SDK application in PulseDB and paste its key)');
    if (!Array.isArray(cfg.targets) || !cfg.targets.length) throw new Error('targets must list at least one database');
    for (const t of cfg.targets) {
        if (!t.name) throw new Error('every target needs a "name"');
        t.engine = String(t.engine || 'mssql').toLowerCase();
        if (t.engine !== 'mssql') throw new Error(`target "${t.name}": engine "${t.engine}" is not supported (supported: mssql)`);
    }
    cfg.allowWrites = cfg.allowWrites === true;
    cfg.maxRows = Number(cfg.maxRows) || 5000;
    cfg.concurrency = Math.min(Math.max(Number(cfg.concurrency) || 4, 1), 16);
    return cfg;
}

let cfg;
try {
    cfg = loadConfig();
} catch (e) {
    log('error', `invalid config (${configPath}): ${e.message}`);
    process.exit(1);
}
const targetsByName = new Map(cfg.targets.map((t) => [t.name, t]));

// ── PulseDB API ─────────────────────────────────────────────────────────────
async function api(pathname, body, timeoutMs = 30_000) {
    const res = await fetch(`${cfg.pulsedbUrl}/api${pathname}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-sdk-key': cfg.agentKey },
        body: JSON.stringify(body ?? {}),
        signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let json = {};
    try {
        json = text ? JSON.parse(text) : {};
    } catch {
        /* non-JSON error page */
    }
    if (!res.ok && res.status !== 410) {
        const err = new Error(`${pathname} -> HTTP ${res.status}: ${json.error || text.slice(0, 200)}`);
        err.status = res.status;
        throw err;
    }
    return json;
}

async function register() {
    // Only descriptive fields leave this machine — never user/password.
    const targets = cfg.targets.map((t) => ({
        name: t.name,
        engine: t.engine,
        host: t.host || 'localhost',
        port: t.port || 1433,
        database: t.database || '',
    }));
    // setup.mjs leaves this flag when the user (re)runs setup: databases they had
    // deleted in PulseDB come back once. Periodic re-registration keeps them deleted.
    const restoreFlag = path.join(here, 'restore-targets.flag');
    const restoreRemoved = fs.existsSync(restoreFlag);
    const r = await api('/agent/register', {
        agent: { version: VERSION, hostname: os.hostname(), capabilities: cfg.relayConnections === false ? ['batch'] : ['batch', 'relay'] },
        targets,
        restoreRemoved,
    });
    if (restoreRemoved) fs.rmSync(restoreFlag, { force: true });
    log('info', `registered with ${cfg.pulsedbUrl} as agent "${r.agent}"`, {
        connections: (r.registered || [])
            .filter((x) => x.connectionId)
            .map((x) => `${x.target} -> connection #${x.connectionId}`),
        removedInPulseDB: (r.registered || []).filter((x) => x.skipped).map((x) => x.target),
    });
}

// ── SQL Server ──────────────────────────────────────────────────────────────
let mssql;
async function mssqlDriver() {
    if (!mssql) {
        const m = await import('mssql');
        mssql = m.default ?? m;
    }
    return mssql;
}

/** HOST\INSTANCE: MSSQLSERVER is the default instance (uses the port); others resolve via SQL Browser. */
function sqlServerTarget(host, port) {
    const [server, instance] = String(host || 'localhost').split('\\');
    if (!instance || instance.toUpperCase() === 'MSSQLSERVER') return { server, port: Number(port) || 1433 };
    return { server, instanceName: instance };
}

/**
 * Windows authentication ("windowsAuth": true): connect as the Windows account
 * the agent runs under, through the ODBC driver (msnodesqlv8) — no SQL login or
 * password in the config. Tries ODBC Driver 18, then 17, unless "odbcDriver" is set.
 */
async function windowsAuthPool(target) {
    let v8;
    try {
        const m = await import('mssql/msnodesqlv8.js');
        v8 = m.default ?? m;
    } catch (e) {
        throw new Error(`Windows authentication needs the msnodesqlv8 driver (npm.cmd ci in the agent folder): ${e.message}`);
    }
    const [host, instance] = String(target.host || 'localhost').split('\\');
    // No port configured: let ODBC pick shared memory locally (works without SQL Browser).
    const server =
        instance && instance.toUpperCase() !== 'MSSQLSERVER'
            ? `${host}\\${instance}`
            : target.port
              ? `${host},${Number(target.port)}`
              : host;
    const drivers = target.odbcDriver ? [target.odbcDriver] : ['ODBC Driver 18 for SQL Server', 'ODBC Driver 17 for SQL Server'];
    let lastError;
    for (const driver of drivers) {
        const p = new v8.ConnectionPool({
            connectionString:
                `Driver={${driver}};Server=${server};Database=${target.database || 'master'};Trusted_Connection=yes;` +
                `Encrypt=${target.encrypt === true ? 'yes' : 'no'};TrustServerCertificate=${target.trustServerCertificate !== false ? 'yes' : 'no'};`,
            pool: { max: 4, min: 0, idleTimeoutMillis: 60_000 },
            requestTimeout: Number(target.requestTimeoutMs) || 25_000,
        });
        try {
            await p.connect();
            return p;
        } catch (e) {
            // msnodesqlv8 errors carry the ODBC message in originalError.
            const msg = e.originalError?.message || e.message;
            lastError = new Error(`Windows authentication via ${driver} failed: ${msg}`);
            if (!/IM002|data source name not found|not found/i.test(msg)) break; // driver present, real failure
        }
    }
    throw lastError;
}

const pools = new Map();
async function pool(target) {
    const existing = pools.get(target.name);
    if (existing?.connected) return existing;
    if (target.windowsAuth === true) {
        const p = await windowsAuthPool(target);
        p.on('error', (e) => log('error', `pool error on ${target.name}`, { error: e.message }));
        pools.set(target.name, p);
        return p;
    }
    const sql = await mssqlDriver();
    const dest = sqlServerTarget(target.host, target.port);
    const p = new sql.ConnectionPool({
        server: dest.server,
        ...(dest.port ? { port: dest.port } : {}),
        database: target.database || 'master',
        user: target.user,
        password: target.password,
        ...(target.domain ? { domain: target.domain } : {}),
        pool: { max: 4, min: 0, idleTimeoutMillis: 60_000 },
        options: {
            encrypt: target.encrypt === true,
            trustServerCertificate: target.trustServerCertificate !== false,
            connectionTimeout: 8_000,
            requestTimeout: Number(target.requestTimeoutMs) || 25_000,
            ...(dest.instanceName ? { instanceName: dest.instanceName } : {}),
        },
    });
    p.on('error', (e) => log('error', `pool error on ${target.name}`, { error: e.message }));
    await p.connect();
    pools.set(target.name, p);
    return p;
}

/** Readable error text (ODBC driver errors keep theirs in originalError). */
const errMsg = (e) => e?.originalError?.message || (typeof e?.message === 'string' ? e.message : String(e));

// JSON-safe values: Buffers -> base64, BigInt -> string (Dates serialise as ISO).
function plain(value) {
    if (Buffer.isBuffer(value)) return { $base64: value.toString('base64') };
    if (typeof value === 'bigint') return value.toString();
    return value;
}

const MAX_RESULT_BYTES = 3_500_000; // PulseDB accepts 4 MB; leave headroom
function shapeResult(recordset, duration) {
    let rows = (recordset || []).slice(0, cfg.maxRows).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, plain(v)])));
    let truncated = (recordset?.length || 0) > rows.length;
    const fields = recordset?.columns
        ? Object.values(recordset.columns).map((c) => ({ name: c.name, type: c.type?.declaration || typeof c.type }))
        : undefined;
    while (rows.length && Buffer.byteLength(JSON.stringify(rows)) > MAX_RESULT_BYTES) {
        rows = rows.slice(0, Math.floor(rows.length / 2));
        truncated = true;
    }
    return { rows, fields, rowCount: recordset?.length ?? rows.length, duration, truncated };
}

/**
 * A connection added in PulseDB the ordinary way (host + SQL login) whose host
 * only this network can reach: PulseDB sends its details with the job and the
 * agent dials it — still read-only unless allowWrites. Without a login the
 * agent signs in with Windows authentication. Disable with
 * "relayConnections": false.
 */
function relayTarget(c) {
    if (cfg.relayConnections === false) {
        throw new Error('This PulseDB Agent does not relay connections ("relayConnections": false in agent.config.json).');
    }
    if (!c?.host) throw new Error('relay job without a host');
    // Pool key changes with the login, so an edited password gets a fresh pool.
    const key = crypto.createHash('sha256').update(JSON.stringify([c.host, c.port, c.database, c.user, c.password])).digest('hex');
    return {
        name: `relay:${key.slice(0, 16)}`,
        engine: 'mssql',
        host: c.host,
        port: c.port || undefined,
        database: c.database || 'master',
        user: c.user || undefined,
        password: c.password || undefined,
        windowsAuth: !c.user,
        encrypt: c.encrypt === true,
        trustServerCertificate: true,
    };
}

async function runJob(job) {
    const target = job.payload?.connection ? relayTarget(job.payload.connection) : targetsByName.get(job.target);
    if (!target) throw new Error(`This agent has no target named "${job.target}". Check agent.config.json.`);
    if (job.op === 'ping') {
        const p = await pool(target);
        const r = await p.request().query('SELECT @@VERSION AS version, DB_NAME() AS db');
        return { version: r.recordset?.[0]?.version, database: r.recordset?.[0]?.db };
    }
    if (job.op === 'query') {
        const sqlText = job.payload?.sql;
        if (!sqlText) throw new Error('query job without sql');
        if (!cfg.allowWrites) assertReadOnly(sqlText); // before touching the database
        const p = await pool(target);
        const started = Date.now();
        const r = await p.request().query(sqlText);
        return shapeResult(r.recordset, Date.now() - started);
    }
    if (job.op === 'batch') {
        // Several named queries in one round trip (a whole monitoring screen).
        // Each succeeds or fails on its own, like separate query jobs would.
        const queries = Object.entries(job.payload?.queries || {});
        const p = await pool(target);
        const results = {};
        let next = 0;
        const worker = async () => {
            while (next < queries.length) {
                const [name, sqlText] = queries[next++];
                try {
                    if (!cfg.allowWrites) assertReadOnly(sqlText);
                    const started = Date.now();
                    const r = await p.request().query(sqlText);
                    const { rows, truncated, duration } = shapeResult(r.recordset, Date.now() - started);
                    results[name] = { rows, truncated, duration };
                } catch (e) {
                    results[name] = { error: errMsg(e) };
                }
            }
        };
        await Promise.all(Array.from({ length: Math.min(4, queries.length) }, worker));
        // Keep the combined result under the upload limit: halve the largest row sets.
        while (Buffer.byteLength(JSON.stringify(results)) > MAX_RESULT_BYTES) {
            const largest = Object.values(results)
                .filter((x) => x.rows?.length)
                .sort((a, b) => b.rows.length - a.rows.length)[0];
            if (!largest) break;
            largest.rows = largest.rows.slice(0, Math.floor(largest.rows.length / 2));
            largest.truncated = true;
        }
        return { results };
    }
    throw new Error(`unsupported operation "${job.op}" (agent ${VERSION})`);
}

// ── main loop ───────────────────────────────────────────────────────────────
let stopping = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Post a job result, retrying brief server-side failures (5xx / network). */
async function postResult(jobId, body) {
    for (let attempt = 1; ; attempt++) {
        try {
            return await api(`/agent/jobs/${jobId}/result`, body);
        } catch (e) {
            if (attempt >= 3 || (e.status && e.status < 500)) throw e;
            await sleep(700 * attempt);
        }
    }
}

async function handle(job) {
    const started = Date.now();
    try {
        const result = await runJob(job);
        await postResult(job.id, { ok: true, result });
        log('info', `${job.op} on ${job.target} ok`, { ms: Date.now() - started });
    } catch (e) {
        log('error', `${job.op} on ${job.target} failed`, { error: errMsg(e) });
        await postResult(job.id, { ok: false, error: errMsg(e) }).catch((err) =>
            log('error', 'could not report failure', { error: err.message }),
        );
    }
}

async function main() {
    log('info', `PulseDB Agent ${VERSION} starting`, {
        pulsedb: cfg.pulsedbUrl,
        targets: cfg.targets.map((t) => `${t.name} (${t.engine} ${t.host || 'localhost'}:${t.port || 1433}/${t.database || ''})`),
        mode: cfg.allowWrites ? 'read-write' : 'read-only',
    });

    let backoff = 2_000;
    let lastRegister = 0;
    while (!stopping) {
        try {
            if (Date.now() - lastRegister > 10 * 60_000) {
                await register();
                lastRegister = Date.now();
            }
            const { jobs = [] } = await api('/agent/jobs/claim', { max: cfg.concurrency * 2, waitMs: 8_000 }, 25_000);
            backoff = 2_000;
            for (let i = 0; i < jobs.length; i += cfg.concurrency) {
                await Promise.all(jobs.slice(i, i + cfg.concurrency).map(handle));
            }
        } catch (e) {
            if (e.status === 401) log('error', 'PulseDB rejected the agent key (401). Check agentKey in agent.config.json.');
            else log('error', 'PulseDB unreachable, retrying', { error: e.message, retryInSeconds: backoff / 1000 });
            await sleep(backoff);
            backoff = Math.min(backoff * 2, 60_000);
            if (e.status === 401) lastRegister = 0;
        }
    }
}

async function shutdown(signal) {
    if (stopping) return;
    stopping = true;
    log('info', `${signal} — stopping`);
    await Promise.allSettled([...pools.values()].map((p) => p.close()));
    process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main();
