/**
 * tests/gateRouter.test.js
 * ─────────────────────────
 * Unit tests for middleware/gateRouter.js.
 *
 * Strategy: stand up a tiny Express app, mount a gated inner router,
 * and assert the middleware either calls next() or sends 403 depending
 * on the feature-check result. We stub the downstream requireFeature
 * behaviour by intercepting the inner handler.
 *
 * We avoid booting a full license service by using a fake pool and the
 * real TIERS config — requireFeature falls back to checking 'community'
 * tier when no org context exists, so we can set req.user/req.orgId to
 * drive each branch.
 *
 * Run: node --test tests/gateRouter.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';

import { gateRouter, gateByPath } from '../middleware/gateRouter.js';

// ── Helpers ──────────────────────────────────────────────────────────────
function makeServer(app) {
    return new Promise((resolve) => {
        const server = app.listen(0, () => resolve(server));
    });
}

function get(server, path, headers = {}) {
    const { port } = server.address();
    return new Promise((resolve, reject) => {
        const req = http.request(
            { host: '127.0.0.1', port, path, method: 'GET', headers },
            (res) => {
                let body = '';
                res.on('data', (c) => (body += c));
                res.on('end', () =>
                    resolve({ status: res.statusCode, body, headers: res.headers }),
                );
            },
        );
        req.on('error', reject);
        req.end();
    });
}

// The license service gate uses req.user.role === 'super_admin' to bypass.
// We set that in a preceding middleware when simulating "admin".
function identity(role = 'viewer', orgId = null) {
    return (req, _res, next) => {
        req.user = { role, id: 'u1', email: 'u@example.com' };
        if (orgId) req.orgId = orgId;
        next();
    };
}

// ── gateRouter ───────────────────────────────────────────────────────────
describe('gateRouter', () => {
    it('super_admin bypasses the gate regardless of feature', async () => {
        const app = express();
        const inner = express.Router();
        inner.get('/ping', (_req, res) => res.json({ ok: true }));
        app.use(identity('super_admin'));
        app.use('/scim', gateRouter({ query: () => ({ rows: [] }) }, 'scim_provisioning', inner));

        const server = await makeServer(app);
        try {
            const r = await get(server, '/scim/ping');
            assert.equal(r.status, 200);
            assert.deepEqual(JSON.parse(r.body), { ok: true });
        } finally {
            server.close();
        }
    });

    it('non-admin without org context is gated to community features', async () => {
        const app = express();
        const inner = express.Router();
        inner.get('/ping', (_req, res) => res.json({ ok: true }));
        app.use(identity('viewer'));
        // scim_provisioning is Enterprise-only → community-tier fallback denies.
        app.use('/scim', gateRouter({ query: () => ({ rows: [] }) }, 'scim_provisioning', inner));

        const server = await makeServer(app);
        try {
            const r = await get(server, '/scim/ping');
            assert.equal(r.status, 403);
        } finally {
            server.close();
        }
    });

    it('community-tier features pass even without org context', async () => {
        const app = express();
        const inner = express.Router();
        inner.get('/ping', (_req, res) => res.json({ ok: true }));
        app.use(identity('viewer'));
        // 'overview' is in community tier.
        app.use('/x', gateRouter({ query: () => ({ rows: [] }) }, 'overview', inner));

        const server = await makeServer(app);
        try {
            const r = await get(server, '/x/ping');
            assert.equal(r.status, 200);
        } finally {
            server.close();
        }
    });
});

// ── gateByPath ───────────────────────────────────────────────────────────
describe('gateByPath', () => {
    it('applies different feature gates to different prefixes', async () => {
        const app = express();
        const inner = express.Router();
        inner.get('/public', (_req, res) => res.json({ area: 'public' }));
        inner.get('/secret', (_req, res) => res.json({ area: 'secret' }));

        app.use(identity('viewer'));
        app.use(
            '/',
            gateByPath(
                { query: () => ({ rows: [] }) },
                {
                    // '/public' gated behind a community feature → passes
                    '/public': 'overview',
                    // '/secret' gated behind an enterprise feature → blocked
                    '/secret': 'scim_provisioning',
                },
                inner,
            ),
        );

        const server = await makeServer(app);
        try {
            const ok = await get(server, '/public');
            assert.equal(ok.status, 200);

            const denied = await get(server, '/secret');
            assert.equal(denied.status, 403);
        } finally {
            server.close();
        }
    });

    it('passes through un-gated paths unmodified', async () => {
        const app = express();
        const inner = express.Router();
        inner.get('/free', (_req, res) => res.json({ ok: true }));

        app.use(identity('viewer'));
        app.use('/', gateByPath({ query: () => ({ rows: [] }) }, {}, inner));

        const server = await makeServer(app);
        try {
            const r = await get(server, '/free');
            assert.equal(r.status, 200);
        } finally {
            server.close();
        }
    });
});
