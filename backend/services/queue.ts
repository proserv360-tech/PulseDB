// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/queue.js
 *
 * B1 — Thin abstraction over BullMQ with an in-process fallback for dev /
 * Vercel / single-process deployments.
 *
 * Production (REDIS_URL + bullmq installed):
 *   - createQueue(name) → BullMQ Queue
 *   - createWorker(name, handler, opts) → BullMQ Worker
 * Dev / fallback:
 *   - createQueue(name) → in-process EventEmitter; .add() invokes registered
 *     workers in this process synchronously next tick.
 *
 * Two callers:
 *   1. Web tier: only enqueues. Never consumes. Loses no work when the
 *      worker tier is missing — jobs simply sit in Redis until a worker
 *      starts.
 *   2. Worker tier (backend/worker.js): registers handlers via
 *      createWorker(). One leader per cluster runs scheduled jobs.
 *
 * Backward compatibility: the queue defaults to in-process so existing
 * single-process deployments keep working without REDIS_URL.
 */

import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { getRedis } from './redisClient.js';

const _require = createRequire(import.meta.url);

function log(level, msg, meta = {}) {
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg, component: 'queue', ...meta }));
}

let _bullmq = null;
let _bullmqAttempted = false;

function loadBullMQ() {
    if (_bullmq || _bullmqAttempted) return _bullmq;
    _bullmqAttempted = true;
    try {
        _bullmq = _require('bullmq');
    } catch {
        _bullmq = null;
        log('INFO', 'bullmq not installed — queue falls back to in-process EventEmitter');
    }
    return _bullmq;
}

function redisAvailable() {
    return !!getRedis();
}

// ── In-process backend ───────────────────────────────────────────────────
// One emitter per queue name; .emit('job', { id, data }) fans out to all
// listeners (workers) registered in this process.
const _inProcQueues = new Map();
function getInProcQueue(name) {
    if (!_inProcQueues.has(name)) _inProcQueues.set(name, new EventEmitter().setMaxListeners(0));
    return _inProcQueues.get(name);
}

class InProcessQueue {
    constructor(name) { this.name = name; this.emitter = getInProcQueue(name); this._seq = 0; }
    async add(jobName, data, opts = {}) {
        const id = `${this.name}:${++this._seq}:${Date.now()}`;
        const job = { id, name: jobName, data, opts, queueName: this.name };
        const delay = opts && opts.delay ? Number(opts.delay) : 0;
        setTimeout(() => this.emitter.emit('job', job), delay);
        return { id };
    }
    async close() { /* no-op */ }
}

class InProcessWorker {
    constructor(name, handler) {
        this.name = name;
        this.emitter = getInProcQueue(name);
        this._handler = handler;
        this._listener = async (job) => {
            try { await handler(job); }
            catch (err) { log('ERROR', 'Worker handler threw', { queue: name, jobId: job.id, error: String(err && err.message) }); }
        };
        this.emitter.on('job', this._listener);
    }
    async close() { this.emitter.removeListener('job', this._listener); }
}

// ── BullMQ-backed backend ────────────────────────────────────────────────
function makeBullQueue(name) {
    const { Queue } = loadBullMQ();
    const redis = getRedis();
    return new Queue(name, { connection: redis });
}
function makeBullWorker(name, handler, opts = {}) {
    const { Worker } = loadBullMQ();
    const redis = getRedis();
    const w = new Worker(name, async (job) => handler({
        id: String(job.id), name: job.name, data: job.data, opts: job.opts, queueName: name,
    }), { connection: redis, concurrency: opts.concurrency || 4 });
    w.on('failed', (job, err) => {
        log('WARN', 'Job failed', { queue: name, jobId: job && job.id, error: String(err && err.message) });
    });
    return w;
}

// ── Public API ───────────────────────────────────────────────────────────
export function createQueue(name) {
    if (redisAvailable() && loadBullMQ()) return makeBullQueue(name);
    return new InProcessQueue(name);
}

export function createWorker(name, handler, opts = {}) {
    if (redisAvailable() && loadBullMQ()) return makeBullWorker(name, handler, opts);
    return new InProcessWorker(name, handler);
}

/**
 * Cron leader election for the worker tier. Redis-backed when possible.
 * Returns true if THIS process holds the lock for `lockKey` for `ttlMs`.
 * Use case: only one worker replica should fire each scheduled job.
 */
export async function acquireLeaderLock(lockKey, ttlMs = 60_000) {
    const redis = getRedis();
    if (!redis) return true; // single-process: always leader
    try {
        // SET NX EX style: SET key value NX PX ttl
        const res = await redis.set(lockKey, String(process.pid), 'PX', ttlMs, 'NX');
        return res === 'OK';
    } catch (err) {
        log('WARN', 'acquireLeaderLock failed — treating as leader to avoid stalling cron', { error: String(err && err.message) });
        return true;
    }
}

// Queue names used across the codebase — central registry so a typo here
// shows up as a missing handler at boot rather than a silent dropped job.
export const QUEUE_NAMES = Object.freeze({
    OTLP_INGEST:     'otlp.ingest',
    ALERT_DISPATCH:  'alerts.dispatch',
    SYNTHETIC_RUN:   'synthetic.run',
    WAIT_EVENT_POLL: 'wait-events.sample',
    AUDIT_EXPORT:    'audit.export',
    COPILOT_PURGE:   'copilot.purge',
});
