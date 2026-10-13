/**
 * tests/adminRoutes.int.test.ts
 * ─────────────────────────────
 * Route-level tests for adminRoutes — flagged as untested by the audit
 * (2026-07-24). Mounts the real router with injected dependencies; no DB.
 *
 * Covers the authenticate boundary (unauthenticated → 401) and the cache
 * admin endpoints (stats/clear) returning their expected shape once authed.
 *
 * Run: node --test tests/adminRoutes.int.test.ts   (or: npm test)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

import adminRoutes from '../routes/adminRoutes.js';

const authAs = (user: any) => (req: any, _res: any, next: any) => { req.user = user; next(); };
const authReject = (_req: any, res: any, _next: any) => res.status(401).json({ error: 'Unauthorized' });
// cached() is a caching middleware factory in the real app; a pass-through is
// the correct stub for behaviour tests.
const cached = () => (_req: any, _res: any, next: any) => next();
const CONFIG: any = { CACHE_TTL: { SETTINGS: 0, EXTENSIONS: 0 } };
const reqPool = async () => ({ query: async () => ({ rows: [] }) });
const cache: any = {
    _cleared: false,
    stats() { return { hits: 3, misses: 1, keys: 2 }; },
    clear() { this._cleared = true; },
};
const log = () => {};

const makeApp = (auth: any) => {
    const app = express();
    app.use(express.json());
    app.use('/api', adminRoutes(auth, cached, CONFIG, reqPool, cache, log));
    return app;
};

describe('adminRoutes — authn boundary', () => {
    it('rejects unauthenticated /admin/cache/stats (401)', async () => {
        const res = await request(makeApp(authReject)).get('/api/admin/cache/stats');
        assert.equal(res.status, 401);
    });

    it('rejects unauthenticated /admin/cache/clear (401)', async () => {
        const res = await request(makeApp(authReject)).post('/api/admin/cache/clear');
        assert.equal(res.status, 401);
    });
});

describe('adminRoutes — cache admin', () => {
    it('returns cache stats when authenticated (200)', async () => {
        const res = await request(makeApp(authAs({ id: 1, role: 'admin' }))).get('/api/admin/cache/stats');
        assert.equal(res.status, 200);
        assert.equal(res.body.hits, 3);
        assert.equal(res.body.keys, 2);
    });

    it('clears the cache when authenticated (200) and invokes cache.clear()', async () => {
        cache._cleared = false;
        const res = await request(makeApp(authAs({ id: 1, role: 'admin' }))).post('/api/admin/cache/clear');
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(cache._cleared, true);
    });
});
