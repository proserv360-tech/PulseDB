// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * worker.js
 *
 * B1 — Worker-tier entrypoint.
 *
 * Owns everything the web tier should not be doing inline:
 *   - Scheduled jobs (audit export, copilot purge, retention sweep, wait
 *     event rollups) gated by a Redis leader lock so only one replica
 *     fires each tick.
 *   - Queue consumers for OTLP ingest, alert dispatch, synthetic checks,
 *     wait-event polling.
 *
 * Boot: `node worker.js` (separate process from `node server.js`).
 * In dev with one process, server.js can keep doing this work — worker.js
 * is additive; nothing yet imports from it.
 *
 * Configure with the same env vars as server.js: REDIS_URL, DATABASE_URL,
 * etc. Skipped entirely when WORKER_DISABLED=1 (handy for CI smoke tests).
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { createWorker, acquireLeaderLock, QUEUE_NAMES } from './services/queue.js';
import { purgeOldConversations } from './services/copilotService.js';
import { runRetentionCleanup } from './services/retentionService.js';

function log(level, msg, meta = {}) {
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg, component: 'worker', ...meta }));
}

if (process.env.WORKER_DISABLED === '1') {
    log('INFO', 'WORKER_DISABLED=1 — exiting');
    process.exit(0);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Queue consumers ──────────────────────────────────────────────────────
// Each consumer is a thin wrapper over a service function. The handlers
// import lazily so the worker can boot even if one service has a bad
// import — the others stay up.

const consumers = [
    {
        name: QUEUE_NAMES.OTLP_INGEST,
        handler: async (job) => {
            const { ingestSpansBatch } = await import('./services/otlpTraceService.js');
            await ingestSpansBatch(job.data);
        },
    },
    {
        name: QUEUE_NAMES.ALERT_DISPATCH,
        handler: async (job) => {
            const { dispatchAlert } = await import('./services/alertNotifiers.js');
            if (typeof dispatchAlert === 'function') await dispatchAlert(job.data);
        },
    },
    {
        name: QUEUE_NAMES.SYNTHETIC_RUN,
        handler: async (job) => {
            const { runCheckById } = await import('./services/syntheticMonitor.js');
            if (typeof runCheckById === 'function') await runCheckById(job.data && job.data.checkId);
        },
    },
    {
        // C5: proactive AI-driven RCA. Fires after every alert (see
        // alertService.fire). Consumer assembles the context bundle and
        // persists the narrative.
        name: 'alerts.rca',
        handler: async (job) => {
            const { runRcaJob } = await import('./services/alertRcaService.js');
            await runRcaJob(job.data);
        },
    },
];

const workers = [];
for (const { name, handler } of consumers) {
    try {
        workers.push(createWorker(name, handler));
        log('INFO', `Consumer registered: ${name}`);
    } catch (err) {
        log('WARN', `Failed to register consumer ${name}`, { error: String(err && err.message) });
    }
}

// ── Scheduled jobs (leader-only) ─────────────────────────────────────────
// Each tick first tries to acquire the lock. If we are not the leader the
// tick is a no-op. The lock TTL is set just above the interval so the
// follower can take over within ~one cycle if the leader dies.

const ONE_DAY_MS = 24 * 60 * 60_000;

async function scheduledTick(jobName, lockMs, work) {
    const got = await acquireLeaderLock(`fathom:cron:${jobName}`, lockMs);
    if (!got) return;
    try { await work(); }
    catch (err) { log('WARN', `Scheduled job ${jobName} failed`, { error: String(err && err.message) }); }
}

const schedulers = [
    {
        name: 'copilot.purge',
        intervalMs: ONE_DAY_MS,
        work: async () => {
            const removed = await purgeOldConversations();
            if (removed > 0) log('INFO', `Copilot purge removed ${removed} turn(s)`);
        },
    },
    {
        name: 'retention.sweep',
        intervalMs: 6 * 60 * 60_000,
        work: async () => {
            // Org 1 is the default control-plane org; multi-tenant deploys
            // will want to enumerate orgs in B7+. Keeping this simple here
            // matches the existing retentionService surface.
            await runRetentionCleanup(pool, 1);
        },
    },
];

for (const s of schedulers) {
    // Fire once shortly after boot, then on its interval.
    setTimeout(() => { void scheduledTick(s.name, s.intervalMs + 30_000, s.work); }, 30_000)
        .unref?.();
    const h = setInterval(() => { void scheduledTick(s.name, s.intervalMs + 30_000, s.work); }, s.intervalMs);
    h.unref?.();
    log('INFO', `Scheduler registered: ${s.name} every ${s.intervalMs}ms`);
}

// ── Shutdown ─────────────────────────────────────────────────────────────
async function shutdown(reason) {
    log('INFO', `Worker shutting down (${reason})`);
    await Promise.allSettled(workers.map((w) => w.close && w.close()));
    await pool.end().catch(() => {});
    process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

log('INFO', 'Worker tier started', { consumers: consumers.length, schedulers: schedulers.length });
