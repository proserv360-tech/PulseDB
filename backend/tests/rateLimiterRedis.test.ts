/**
 * tests/rateLimiterRedis.test.js
 * A1 — distributed rate limiter regression tests.
 *
 * Approach: REDIS_URL is unset in the test environment so getRedis()
 * returns null and the limiter uses its in-memory fallback. That fallback
 * IS the per-process path that production hits when Redis is unreachable.
 * It also exercises every middleware code path except the Lua INCR — the
 * Lua script is one Redis EVAL call and is covered by manual smoke tests
 * documented in backend/docs/ARCHITECTURE.md.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rateLimiter, _resetForTests } from '../middleware/rateLimiter.js';

function mkReqRes(ip = '1.2.3.4') {
    const headers = {};
    const req = { ip };
    const res = {
        statusCode: 200,
        body: undefined,
        headers,
        setHeader(k, v) { headers[k] = String(v); },
        status(code) { this.statusCode = code; return this; },
        json(b) { this.body = b; return this; },
    };
    return { req, res };
}

async function runOnce(middleware, ip = '1.2.3.4', extra = {}) {
    const { req, res } = mkReqRes(ip);
    Object.assign(req, extra);
    let called = false;
    let nextResolve;
    const nextPromise = new Promise((r) => { nextResolve = r; });
    const next = () => { called = true; nextResolve(); };
    const mw = middleware(req, res, next);
    if (mw && typeof mw.then === 'function') {
        await Promise.race([nextPromise, mw]);
    } else {
        await nextPromise;
    }
    return { req, res, called };
}

test('A1: first N requests pass, N+1 returns 429 with correct shape', async () => {
    _resetForTests();
    const limit = rateLimiter({ windowMs: 60000, maxRequests: 3, prefix: 't1' });
    for (let i = 0; i < 3; i++) {
        const { res, called } = await runOnce(limit, '10.0.0.1');
        assert.equal(res.statusCode, 200, `request ${i + 1}`);
        assert.equal(called, true);
        assert.ok(res.headers['X-RateLimit-Limit']);
        assert.ok(res.headers['X-RateLimit-Remaining'] !== undefined);
        assert.ok(res.headers['X-RateLimit-Reset']);
    }
    const { res } = await runOnce(limit, '10.0.0.1');
    assert.equal(res.statusCode, 429);
    assert.equal(res.body.error, 'Rate limit exceeded');
    assert.ok(res.body.retryAfter > 0);
    assert.ok(res.headers['Retry-After']);
});

test('A1: separate keys do not share a budget', async () => {
    _resetForTests();
    const limit = rateLimiter({ windowMs: 60000, maxRequests: 2, prefix: 't2' });
    await runOnce(limit, '10.0.0.10');
    await runOnce(limit, '10.0.0.10');
    const blocked = await runOnce(limit, '10.0.0.10');
    assert.equal(blocked.res.statusCode, 429);
    const otherKey = await runOnce(limit, '10.0.0.11');
    assert.equal(otherKey.res.statusCode, 200, 'different IP gets its own budget');
});

test('A1: enterprise tier multiplies the budget ×5', async () => {
    _resetForTests();
    const limit = rateLimiter({ windowMs: 60000, maxRequests: 2, prefix: 't3' });
    const r3 = await runOnce(limit, '10.0.0.4');
    const r4 = await runOnce(limit, '10.0.0.4');
    const blocked = await runOnce(limit, '10.0.0.4');
    assert.equal(r3.res.statusCode, 200);
    assert.equal(r4.res.statusCode, 200);
    assert.equal(blocked.res.statusCode, 429);

    _resetForTests();
    const ent = rateLimiter({ windowMs: 60000, maxRequests: 2, prefix: 't3-ent' });
    for (let i = 0; i < 10; i++) {
        const { res, called } = await runOnce(ent, '10.0.0.5', { licenseTier: 'enterprise' });
        assert.equal(res.statusCode, 200, `enterprise req ${i + 1}`);
        assert.equal(called, true);
    }
});

test('A1: pro tier multiplies the budget ×2', async () => {
    _resetForTests();
    const limit = rateLimiter({ windowMs: 60000, maxRequests: 2, prefix: 't4-pro' });
    for (let i = 0; i < 4; i++) {
        const { res } = await runOnce(limit, '10.0.0.6', { licenseTier: 'pro' });
        assert.equal(res.statusCode, 200, `pro req ${i + 1}`);
    }
    const blocked = await runOnce(limit, '10.0.0.6', { licenseTier: 'pro' });
    assert.equal(blocked.res.statusCode, 429);
});

test('A1: 429 response sets Retry-After header in seconds', async () => {
    _resetForTests();
    const limit = rateLimiter({ windowMs: 60000, maxRequests: 1, prefix: 't5' });
    await runOnce(limit, '10.0.0.7');
    const { res } = await runOnce(limit, '10.0.0.7');
    assert.equal(res.statusCode, 429);
    const retryAfter = Number(res.headers['Retry-After']);
    assert.ok(retryAfter > 0 && retryAfter <= 60, `Retry-After ${retryAfter} should be 0<x<=60`);
});
