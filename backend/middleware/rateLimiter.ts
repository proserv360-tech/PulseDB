/**
 * middleware/rateLimiter.js
 * Distributed sliding-window rate limiter (Wave A task A1).
 *
 * Replaces the prior in-memory implementation. Behaviour preserved on the
 * wire (X-RateLimit-* headers, 429 + retryAfter body).
 *
 * Two backends:
 *   - Redis (preferred in production). Lua atomic INCR + PEXPIRE on first
 *     hit. Multiple Node replicas pointed at the same Redis share one
 *     budget per key.
 *   - In-memory fallback. Used when REDIS_URL is unset, when ioredis is
 *     not installed, or when Redis is unreachable (open-circuit). The
 *     fallback is per-process, identical to the prior behaviour.
 *
 * Open-circuit: after errorBudget Redis failures the limiter stops calling
 * Redis for cooldownMs and uses in-memory instead so the API keeps serving.
 *
 * Backward compatibility: rateLimiter(opts) still returns an Express
 * middleware. New optional opts: prefix, errorBudget, cooldownMs.
 */

import { getRedis } from '../services/redisClient.js';

function log(level: any, message: any, meta = {}) {
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg: message, ...meta }));
}

const _memBuckets = new Map();
const MAX_BUCKETS = 100000;

function memTake(key: any, windowMs: any, max: any, now: any) {
    let bucket = _memBuckets.get(key);
    if (!bucket || now - bucket.windowStart > windowMs) {
        bucket = { windowStart: now, count: 0 };
        _memBuckets.set(key, bucket);
    }
    bucket.count += 1;

    if (_memBuckets.size > MAX_BUCKETS) {
        const drop = Math.floor(MAX_BUCKETS * 0.2);
        const entries = Array.from(_memBuckets.entries())
            .sort((a, b) => a[1].windowStart - b[1].windowStart)
            .slice(0, drop);
        for (const [k] of entries) _memBuckets.delete(k);
    }
    return {
        count: bucket.count,
        remaining: Math.max(0, max - bucket.count),
        resetMs: bucket.windowStart + windowMs - now,
    };
}

if (process.env.VERCEL !== '1') {
    const sweep = setInterval(() => {
        const now = Date.now();
        for (const [k, v] of _memBuckets) {
            if (now - v.windowStart > 10 * 60000) _memBuckets.delete(k);
        }
    }, 5 * 60000);
    if (typeof sweep.unref === 'function') sweep.unref();
}

const LIMIT_SCRIPT = [
    "local n = redis.call('INCR', KEYS[1])",
    "if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
    "local ttl = redis.call('PTTL', KEYS[1])",
    'return { n, ttl }',
].join('\n');

async function redisTake(redis: any, key: any, windowMs: any, prefix: any) {
    const fullKey = prefix + ':' + key + ':' + Math.floor(Date.now() / windowMs);
    const result = await redis.eval(LIMIT_SCRIPT, 1, fullKey, String(windowMs));
    const count = Array.isArray(result) ? Number(result[0]) : Number(result);
    const ttl = Array.isArray(result) ? Number(result[1]) : windowMs;
    return { count, ttlMs: ttl };
}

export function rateLimiter(opts: Record<string, any> = {}) {
    const windowMs = opts.windowMs || 60000;
    const maxDefault = opts.maxRequests || 300;
    const keyFn = opts.keyFn || ((req: any) => (req.user && req.user.id) || req.ip || 'anonymous');
    const prefix = opts.prefix || 'pulsedb:rl';
    const errorBudget = opts.errorBudget || 5;
    const cooldownMs = opts.cooldownMs || 30000;

    let consecutiveErrors = 0;
    let circuitOpenUntil = 0;

    return async function rateLimitMiddleware(req: any, res: any, next: any) {
        const now = Date.now();
        const key = keyFn(req);

        let max = maxDefault;
        if (req.licenseTier === 'enterprise') max *= 5;
        else if (req.licenseTier === 'pro') max *= 2;

        const redis = circuitOpenUntil > now ? null : getRedis();
        let count;
        let resetMs;

        if (redis) {
            try {
                const r = await redisTake(redis, key, windowMs, prefix);
                count = r.count;
                resetMs = r.ttlMs > 0 ? r.ttlMs : windowMs;
                consecutiveErrors = 0;
            } catch (err: any) {
                consecutiveErrors += 1;
                if (consecutiveErrors >= errorBudget) {
                    circuitOpenUntil = now + cooldownMs;
                    log('WARN', 'Rate limiter Redis circuit opened — falling back to in-memory', {
                        component: 'rateLimiter',
                        cooldownMs,
                        error: String(err && err.message),
                    });
                }
                const r = memTake(key, windowMs, max, now);
                count = r.count;
                resetMs = r.resetMs;
            }
        } else {
            const r = memTake(key, windowMs, max, now);
            count = r.count;
            resetMs = r.resetMs;
        }

        const remaining = Math.max(0, max - count);
        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', String(remaining));
        res.setHeader('X-RateLimit-Reset', new Date(now + Math.max(0, resetMs)).toISOString());

        if (count > max) {
            const retryAfter = Math.max(1, Math.ceil(resetMs / 1000));
            res.setHeader('Retry-After', String(retryAfter));
            return res.status(429).json({
                error: 'Rate limit exceeded',
                retryAfter,
            });
        }
        return next();
    };
}

export function _resetForTests() {
    _memBuckets.clear();
}
