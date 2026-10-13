/**
 * tests/ipAllowListEnforcement.test.js
 * ─────────────────────────────────────
 * Regression tests for CRIT-3 + LOW-10 from ROADMAP_CODE_AUDIT.md.
 *
 * CRIT-3: the IP allow-list middleware previously read req.workspace (set
 *         by a DIFFERENT middleware that ran LATER in the chain), so the
 *         workspace ID was always undefined by the time the allow-list was
 *         consulted and every request silently fail-opened. The fix moved
 *         workspace resolution inline (header / query / default).
 *
 * LOW-10: the 30s in-memory CIDR cache leaked access after a rule was
 *         removed. `invalidateIpAllowListCache(wsId)` must clear the
 *         per-workspace entry.
 *
 * Run: node --test backend/tests/ipAllowListEnforcement.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';

import { pool } from '../db.js';
import {
    ipAllowListMiddleware,
    invalidateIpAllowListCache,
} from '../middleware/ipAllowList.js';

// ── pool stub ────────────────────────────────────────────────────────────────
// The only SQL the middleware runs is a lookup against ip_allowlist.
// We pattern-match on that one shape and return whatever the test set.

function installFakePool() {
    const byWs = new Map(); // workspace_id -> [{ cidr }]
    let callCount = 0;
    const originalQuery = pool.query.bind(pool);

    pool.query = async (text, params = []) => {
        callCount++;
        const sql = text.replace(/\s+/g, ' ').trim().toLowerCase();
        if (sql.startsWith('select cidr from pgmonitoringtool.ip_allowlist')) {
            const [ws] = params;
            const rows = (byWs.get(ws) || []).map(c => ({ cidr: c }));
            return { rows };
        }
        throw new Error(`ipAllowList test: unexpected SQL: ${sql}`);
    };
    return {
        setRules(wsId, cidrs) { byWs.set(wsId, cidrs); },
        callCount: () => callCount,
        restore() { pool.query = originalQuery; },
    };
}

function makeApp(opts = {}) {
    const app = express();
    // Express 5 — mark behind-proxy so req.ip is honored from X-Forwarded-For.
    app.set('trust proxy', true);
    // Simulate "user already authenticated" by stamping req.user if test supplies it.
    if (opts.user) app.use((req, _res, next) => { req.user = opts.user; next(); });
    app.use(ipAllowListMiddleware());
    app.get('/health', (_req, res) => res.json({ ok: true }));
    app.post('/api/login', (_req, res) => res.json({ bypassed: true }));
    app.get('/api/saml/acme/metadata', (_req, res) => res.json({ bypassed: true }));
    app.get('/api/v1/auth/logout', (_req, res) => res.json({ bypassed: true }));
    return app;
}

async function withServer(app, fn) {
    const server = http.createServer(app);
    await new Promise(r => server.listen(0, r));
    const { port } = server.address();
    try { return await fn(`http://127.0.0.1:${port}`); }
    finally { await new Promise(r => server.close(r)); }
}

// Force req.ip / socket.remoteAddress to a known value by sending from
// localhost and using X-Forwarded-For (trust proxy is on).
function headers(workspaceId, forwardedIp) {
    const h = {};
    if (workspaceId) h['x-workspace-id'] = String(workspaceId);
    if (forwardedIp) h['x-forwarded-for'] = forwardedIp;
    return h;
}

// ─────────────────────────────────────────────────────────────────────────────
// CRIT-3 proof: the middleware resolves workspace on its own
// ─────────────────────────────────────────────────────────────────────────────

test('CRIT-3: allow-list fails CLOSED when a rule exists and client IP does not match', async () => {
    const fake = installFakePool();
    fake.setRules(7, ['10.0.0.0/24']);
    // Different workspace so the cache doesn't collide.
    invalidateIpAllowListCache();
    try {
        await withServer(makeApp(), async (base) => {
            const r = await fetch(`${base}/health`, {
                headers: headers(7, '8.8.8.8'),
            });
            assert.equal(r.status, 403, 'request from blocked IP must be rejected');
            const j = await r.json();
            assert.equal(j.error, 'ip_not_allowed');
            assert.equal(j.workspace, 7);
        });
    } finally { fake.restore(); invalidateIpAllowListCache(); }
});

test('CRIT-3: allow-list permits a matching IP within the configured CIDR', async () => {
    const fake = installFakePool();
    fake.setRules(8, ['10.0.0.0/24']);
    invalidateIpAllowListCache();
    try {
        await withServer(makeApp(), async (base) => {
            const r = await fetch(`${base}/health`, {
                headers: headers(8, '10.0.0.42'),
            });
            assert.equal(r.status, 200);
        });
    } finally { fake.restore(); invalidateIpAllowListCache(); }
});

test('CRIT-3: allow-list fails OPEN only when a workspace has zero rules', async () => {
    const fake = installFakePool();
    fake.setRules(9, []); // explicit: no rules
    invalidateIpAllowListCache();
    try {
        await withServer(makeApp(), async (base) => {
            const r = await fetch(`${base}/health`, {
                headers: headers(9, '8.8.8.8'),
            });
            assert.equal(r.status, 200, 'no rules => open');
        });
    } finally { fake.restore(); invalidateIpAllowListCache(); }
});

test('CRIT-3: workspace ID comes from ?workspace query param when header is absent', async () => {
    const fake = installFakePool();
    fake.setRules(11, ['203.0.113.0/24']);
    invalidateIpAllowListCache();
    try {
        await withServer(makeApp(), async (base) => {
            const r = await fetch(`${base}/health?workspace=11`, {
                headers: headers(null, '198.51.100.4'),
            });
            assert.equal(r.status, 403);
        });
    } finally { fake.restore(); invalidateIpAllowListCache(); }
});

test('CRIT-3: workspace ID falls back to req.user.defaultWorkspaceId', async () => {
    const fake = installFakePool();
    fake.setRules(21, ['10.0.0.0/8']);
    invalidateIpAllowListCache();
    try {
        const app = makeApp({ user: { id: 1, defaultWorkspaceId: 21 } });
        await withServer(app, async (base) => {
            const r = await fetch(`${base}/health`, {
                headers: headers(null, '172.16.0.1'),
            });
            assert.equal(r.status, 403);
        });
    } finally { fake.restore(); invalidateIpAllowListCache(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Bypass paths (login, auth, SAML) must never be blocked
// ─────────────────────────────────────────────────────────────────────────────

test('bypass: /api/login always reaches handler regardless of IP rules', async () => {
    const fake = installFakePool();
    fake.setRules(1, ['10.0.0.0/8']);
    invalidateIpAllowListCache();
    try {
        await withServer(makeApp(), async (base) => {
            const r = await fetch(`${base}/api/login`, {
                method: 'POST',
                headers: { ...headers(1, '8.8.8.8'), 'content-type': 'application/json' },
                body: '{}',
            });
            assert.equal(r.status, 200);
            const j = await r.json();
            assert.equal(j.bypassed, true);
        });
    } finally { fake.restore(); invalidateIpAllowListCache(); }
});

test('bypass: /api/saml/<tenant>/metadata always reaches handler', async () => {
    const fake = installFakePool();
    fake.setRules(1, ['10.0.0.0/8']);
    invalidateIpAllowListCache();
    try {
        await withServer(makeApp(), async (base) => {
            const r = await fetch(`${base}/api/saml/acme/metadata`, {
                headers: headers(1, '8.8.8.8'),
            });
            assert.equal(r.status, 200);
        });
    } finally { fake.restore(); invalidateIpAllowListCache(); }
});

test('bypass: /api/v1/auth/* always reaches handler', async () => {
    const fake = installFakePool();
    fake.setRules(1, ['10.0.0.0/8']);
    invalidateIpAllowListCache();
    try {
        await withServer(makeApp(), async (base) => {
            const r = await fetch(`${base}/api/v1/auth/logout`, {
                headers: headers(1, '8.8.8.8'),
            });
            assert.equal(r.status, 200);
        });
    } finally { fake.restore(); invalidateIpAllowListCache(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// LOW-10 proof: the 30s cache is invalidated when rules change
// ─────────────────────────────────────────────────────────────────────────────

test('LOW-10: invalidateIpAllowListCache(wsId) forces a reload after rule change', async () => {
    const fake = installFakePool();
    // Workspace 33 starts with a single permissive rule that matches the
    // test client's IP. The next tick the operator removes the rule; without
    // cache invalidation, the middleware would still let the client in for
    // up to 30s.
    fake.setRules(33, ['198.51.100.0/24']);
    invalidateIpAllowListCache();

    try {
        await withServer(makeApp(), async (base) => {
            // Prime the cache — request succeeds.
            let r = await fetch(`${base}/health`, {
                headers: headers(33, '198.51.100.5'),
            });
            assert.equal(r.status, 200);
            const callsBefore = fake.callCount();

            // Operator removes the rule; without the LOW-10 fix, the next
            // request would still succeed because of the cached rule list.
            fake.setRules(33, []);
            invalidateIpAllowListCache(33);

            r = await fetch(`${base}/health`, {
                headers: headers(33, '198.51.100.5'),
            });
            // Rules are now empty → fail-open (no rules means open), so we
            // expect 200 — but the key assertion is that the DB was
            // reconsulted rather than the middleware serving from cache.
            assert.equal(r.status, 200);
            const callsAfter = fake.callCount();
            assert.ok(callsAfter > callsBefore,
                'expected a fresh DB query after invalidateIpAllowListCache');

            // Symmetric: put a blocking rule back, invalidate, request must 403.
            fake.setRules(33, ['10.0.0.0/8']); // does not match 198.51.100.5
            invalidateIpAllowListCache(33);
            r = await fetch(`${base}/health`, {
                headers: headers(33, '198.51.100.5'),
            });
            assert.equal(r.status, 403,
                'post-invalidation, a newly-installed blocking rule must take effect');
        });
    } finally { fake.restore(); invalidateIpAllowListCache(); }
});
