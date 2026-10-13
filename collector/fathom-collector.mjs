#!/usr/bin/env node
/**
 * fathom-collector — packaged monitoring agent (gap-analysis P0-2).
 *
 * Single-file collector, one runtime dependency (pg). Install once per host:
 *
 *   npm install -g pg            # or: npm install in this directory
 *   FATHOM_URL=https://your-fathom.example \
 *   FATHOM_SDK_KEY=sk_...        \
 *   node fathom-collector.mjs
 *
 * What it does, every INTERVAL (default 10s):
 *   1. Auto-discovers Postgres targets: --dsn flags, FATHOM_TARGETS
 *      (comma-separated DSNs), DATABASE_URL, or localhost:5432 defaults.
 *   2. Samples pg_stat_activity (wait events) on each target.
 *   3. Snapshots pg_stat_statements when the extension is available.
 *   4. POSTs batches to the FATHOM ingest API (/api/agent/*) with x-sdk-key.
 *
 * Resilient by design: per-target failures are logged and retried next
 * tick; the process never exits on a collection error. SIGTERM/SIGINT
 * flush and stop cleanly.
 */

import process from 'node:process';

const FATHOM_URL = (process.env.FATHOM_URL || '').replace(/\/+$/, '');
const SDK_KEY = process.env.FATHOM_SDK_KEY || '';
const INTERVAL_MS = Math.max(2000, Number(process.env.FATHOM_INTERVAL_MS) || 10_000);
const STATS_EVERY_TICKS = Math.max(1, Number(process.env.FATHOM_STATS_EVERY) || 6); // query-stats each minute by default

function log(level, msg, meta = {}) {
    console[level === 'error' ? 'error' : 'log'](
        JSON.stringify({ ts: new Date().toISOString(), level, msg, component: 'fathom-collector', ...meta }),
    );
}

if (!FATHOM_URL || !SDK_KEY) {
    log('error', 'FATHOM_URL and FATHOM_SDK_KEY are required');
    process.exit(1);
}

// Drivers load lazily per engine so a Postgres-only host needs only `pg`.
const drivers = {
    async pg() {
        const m = await import('pg');
        return m.default ?? m;
    },
    async mysql() {
        const m = await import('mysql2/promise');
        return m.default ?? m;
    },
    async mongodb() {
        const m = await import('mongodb');
        return m.default ?? m;
    },
};

function engineOf(dsn) {
    if (/^mysql(2)?:\/\//i.test(dsn)) return 'mysql';
    if (/^mongodb(\+srv)?:\/\//i.test(dsn)) return 'mongodb';
    return 'pg';
}

// ── target discovery ────────────────────────────────────────────────────────
function discoverTargets(argv) {
    const dsns = [];
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--dsn' && argv[i + 1]) dsns.push(argv[++i]);
    }
    if (process.env.FATHOM_TARGETS) {
        dsns.push(...process.env.FATHOM_TARGETS.split(',').map((s) => s.trim()).filter(Boolean));
    }
    if (!dsns.length && process.env.DATABASE_URL) dsns.push(process.env.DATABASE_URL);
    if (!dsns.length) {
        const user = process.env.PGUSER || 'postgres';
        const host = process.env.PGHOST || 'localhost';
        const port = process.env.PGPORT || '5432';
        const db = process.env.PGDATABASE || 'postgres';
        const pass = process.env.PGPASSWORD ? `:${encodeURIComponent(process.env.PGPASSWORD)}` : '';
        dsns.push(`postgres://${user}${pass}@${host}:${port}/${db}`);
        log('log', `no targets configured — defaulting to ${host}:${port}/${db}`);
    }
    return [...new Set(dsns)].map((dsn, i) => ({
        dsn,
        engine: engineOf(dsn),
        connectionId: process.env[`FATHOM_CONNECTION_ID_${i}`] || process.env.FATHOM_CONNECTION_ID || hostLabel(dsn),
        pool: null, // created lazily per engine
        hasStatStatements: null, // probed lazily (pg only)
    }));
}

async function ensurePool(target) {
    if (target.pool) return target.pool;
    if (target.engine === 'mysql') {
        const mysql = await drivers.mysql().catch(() => {
            throw new Error("the 'mysql2' package is required for MySQL targets: npm install mysql2");
        });
        target.pool = mysql.createPool(target.dsn);
    } else if (target.engine === 'mongodb') {
        const { MongoClient } = await drivers.mongodb().catch(() => {
            throw new Error("the 'mongodb' package is required for MongoDB targets: npm install mongodb");
        });
        const client = new MongoClient(target.dsn, { serverSelectionTimeoutMS: 5000 });
        await client.connect();
        target.pool = client;
    } else {
        const pg = await drivers.pg().catch(() => {
            throw new Error("the 'pg' package is required for Postgres targets: npm install pg");
        });
        target.pool = new pg.Pool({ connectionString: target.dsn, max: 2, connectionTimeoutMillis: 5000 });
    }
    return target.pool;
}

function hostLabel(dsn) {
    try {
        const u = new URL(dsn);
        return `${u.hostname}:${u.port || 5432}/${u.pathname.slice(1) || 'postgres'}`;
    } catch {
        return 'unknown';
    }
}

// ── collection ──────────────────────────────────────────────────────────────
async function sampleWaitEvents(target) {
    await ensurePool(target);
    if (target.engine === 'mysql') return sampleMysqlProcesslist(target);
    if (target.engine === 'mongodb') return sampleMongoOps(target);
    const { rows } = await target.pool.query(`
        SELECT now() AS sampled_at, pid, state, wait_event_type, wait_event,
               query_id::text AS query_id, backend_type, application_name
          FROM pg_stat_activity
         WHERE backend_type = 'client backend' AND pid <> pg_backend_pid()`);
    return rows;
}

// MySQL: PROCESSLIST mapped onto the wait-event sample shape.
async function sampleMysqlProcesslist(target) {
    const [rows] = await target.pool.query(
        `SELECT id, state, command, time, info, user, db
           FROM information_schema.processlist
          WHERE command <> 'Sleep' AND id <> CONNECTION_ID()`,
    );
    const now = new Date();
    return rows.map((r) => ({
        sampled_at: now, pid: r.id, state: r.command?.toLowerCase() || 'active',
        wait_event_type: r.state ? 'MySQL' : null, wait_event: r.state || null,
        query_id: null, backend_type: 'client backend', application_name: r.user || null,
    }));
}

// MongoDB: currentOp mapped onto the wait-event sample shape.
async function sampleMongoOps(target) {
    const admin = target.pool.db('admin');
    const result = await admin.command({ currentOp: 1, active: true });
    const now = new Date();
    return (result.inprog || []).map((op) => ({
        sampled_at: now, pid: Number(String(op.opid).replace(/\D/g, '')) || 0,
        state: op.op || 'active',
        wait_event_type: op.waitingForLock ? 'Lock' : null,
        wait_event: op.waitingForLock ? (op.lockType || 'lock') : null,
        query_id: null, backend_type: 'client backend',
        application_name: op.appName || op.clientMetadata?.application?.name || null,
    }));
}

// MySQL: statement digests mapped onto the pg_stat_statements stat shape.
async function snapshotMysqlDigests(target) {
    const [rows] = await target.pool.query(
        `SELECT digest AS query_id, count_star AS calls,
                sum_timer_wait / 1e9 AS total_exec_time,
                avg_timer_wait / 1e9 AS mean_exec_time,
                sum_rows_sent AS rows, digest_text AS query
           FROM performance_schema.events_statements_summary_by_digest
          WHERE digest IS NOT NULL
          ORDER BY sum_timer_wait DESC LIMIT 100`,
    );
    return rows;
}

async function snapshotQueryStats(target) {
    await ensurePool(target);
    if (target.engine === 'mysql') {
        try { return await snapshotMysqlDigests(target); }
        catch { return null; /* performance_schema disabled */ }
    }
    if (target.engine === 'mongodb') return null; // profiler integration: future work
    if (target.hasStatStatements === null) {
        try {
            const r = await target.pool.query(`SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'`);
            target.hasStatStatements = r.rows.length > 0;
            if (!target.hasStatStatements) log('log', `pg_stat_statements not installed on ${target.connectionId}`);
        } catch {
            target.hasStatStatements = false;
        }
    }
    if (!target.hasStatStatements) return null;
    const { rows } = await target.pool.query(`
        SELECT queryid::text AS query_id, calls, total_exec_time, mean_exec_time,
               rows, shared_blks_hit, shared_blks_read, left(query, 2000) AS query
          FROM pg_stat_statements
         ORDER BY total_exec_time DESC
         LIMIT 100`);
    return rows;
}

// ── shipping ────────────────────────────────────────────────────────────────
async function post(path, body) {
    const res = await fetch(`${FATHOM_URL}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-sdk-key': SDK_KEY },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok && res.status !== 202) {
        const text = await res.text().catch(() => '');
        throw new Error(`${path} -> ${res.status} ${text.slice(0, 200)}`);
    }
}

// ── main loop ───────────────────────────────────────────────────────────────
const targets = discoverTargets(process.argv.slice(2));
log('log', `collector starting: ${targets.length} target(s), interval ${INTERVAL_MS}ms`, {
    targets: targets.map((t) => `${t.connectionId} (${t.engine})`),
});

let tick = 0;
let stopped = false;

async function runTick() {
    tick += 1;
    for (const t of targets) {
        try {
            const samples = await sampleWaitEvents(t);
            if (samples.length) {
                await post('/api/agent/wait-events', { connectionId: t.connectionId, samples });
            }
            if (tick % STATS_EVERY_TICKS === 0) {
                const stats = await snapshotQueryStats(t);
                if (stats?.length) {
                    await post('/api/agent/query-stats', { connectionId: t.connectionId, stats });
                }
            }
        } catch (e) {
            log('error', `collection failed for ${t.connectionId}`, { error: e.message });
        }
    }
}

const timer = setInterval(() => { if (!stopped) runTick(); }, INTERVAL_MS);
runTick();

async function shutdown(signal) {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    log('log', `${signal} received — flushing and stopping`);
    await Promise.allSettled(targets.map((t) => (t.pool?.end ? t.pool.end() : t.pool?.close?.())));
    process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
