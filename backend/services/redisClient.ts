// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/redisClient.js
 * ───────────────────────
 * Lazy, shared ioredis client.
 *
 * Reasoning
 *   PulseDB is moving from a single-process Node runtime to a web + worker
 *   split. Cross-tier state (distributed rate-limit, BullMQ queues, cron
 *   leader election) lives in Redis. This module is the single place that
 *   knows how to construct the client.
 *
 * Behaviour
 *   • If REDIS_URL is unset, getRedis() returns null. Callers MUST handle
 *     null and fall back to per-process behaviour. This keeps local dev
 *     simple (no Redis required) and lets serverless invocations skip
 *     connection setup entirely.
 *   • If REDIS_URL is set, the first call constructs the client and
 *     subsequent calls return the same instance. Connection is lazy
 *     (ioredis dials on first command).
 *   • ioredis is an optional dependency in backend/package.json — if the
 *     module is not installed we warn once and treat Redis as unavailable.
 *   • One-time pid-tagged WARN if REDIS_URL is unset in production so
 *     misconfiguration is loud, not silent.
 *
 * Wave A task A1.
 */

import { createRequire } from 'node:module';
const _require = createRequire(import.meta.url);

let _redis = null;
let _attemptedLoad = false;
let _warnedMissingPkg = false;
let _warnedMissingUrl = false;

function log(level, message, meta = {}) {
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg: message, ...meta }));
}

/**
 * Get the shared ioredis client. Returns null if REDIS_URL is unset or
 * the ioredis package is not installed.
 *
 * @returns {import('ioredis').Redis | null}
 */
export function getRedis() {
    if (_redis) return _redis;
    if (_attemptedLoad) return null;
    _attemptedLoad = true;

    const url = process.env.REDIS_URL;
    if (!url) {
        if (process.env.NODE_ENV === 'production' && !_warnedMissingUrl) {
            _warnedMissingUrl = true;
            log('WARN', 'REDIS_URL not set in production. Rate limit, queue, and cron leader fall back to per-process behaviour.', {
                component: 'redisClient',
            });
        }
        return null;
    }

    let Redis;
    try {
        // ioredis is an optionalDependency — pulled in via createRequire so
        // this file stays ESM-clean and getRedis() stays synchronous.
        Redis = _require('ioredis');
        if (Redis && Redis.default) Redis = Redis.default;
    } catch (err) {
        if (!_warnedMissingPkg) {
            _warnedMissingPkg = true;
            log('WARN', 'ioredis package not installed; REDIS_URL is set but cannot connect.', {
                component: 'redisClient',
                error: String(err && err.message),
            });
        }
        return null;
    }

    // Default ioredis settings are sensible. We pin a few that matter for
    // rate-limit correctness and for surviving brief outages:
    //   • maxRetriesPerRequest: 3 — fail fast on commands rather than
    //     queuing forever; the rate limiter's open-circuit behaviour kicks
    //     in and lets traffic through rather than dropping everything.
    //   • enableOfflineQueue: false — commands issued while disconnected
    //     should error immediately, again so the limiter opens its circuit
    //     rather than silently building a queue that drains in a stampede.
    _redis = new Redis(url, {
        lazyConnect: false,
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
        reconnectOnError(err) {
            const msg = String(err && err.message || '');
            // Reconnect on transient errors. Don't reconnect on auth
            // failure because that just hammers the server.
            return /ECONNRESET|ETIMEDOUT|READONLY/i.test(msg);
        },
        retryStrategy(times) {
            // Exponential back-off capped at 5 s.
            return Math.min(times * 200, 5000);
        },
    });

    _redis.on('error', (err) => {
        log('WARN', 'Redis error', { component: 'redisClient', error: String(err && err.message) });
    });
    _redis.on('connect', () => {
        log('INFO', 'Redis connected', { component: 'redisClient' });
    });

    return _redis;
}

/**
 * Test-only / shutdown helper. Closes the client and clears the cache so
 * the next getRedis() will construct a fresh one. Safe to call when no
 * client has been created.
 */
export async function disconnectRedis() {
    if (_redis) {
        try {
            await _redis.quit();
        } catch {
            // ignore
        }
        _redis = null;
    }
    _attemptedLoad = false;
}
