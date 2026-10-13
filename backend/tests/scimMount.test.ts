/**
 * tests/scimMount.test.js
 * ────────────────────────
 * Regression test for the SCIM router's mount behaviour.
 *
 * The SCIM router is mounted at the app root (see server.js):
 *     app.use(scimRoutes(pool));
 *
 * so its middleware sees every request in the app. The bearer-token
 * middleware MUST therefore short-circuit on non-/scim/* paths —
 * otherwise every /api/* call returns a "missing bearer token" 401
 * with a SCIM error schema, which was the original production outage.
 *
 * These tests stand up a throw-away Express app, mount scimRoutes at
 * the root, and verify:
 *   1. A non-SCIM path falls through to the next handler.
 *   2. A SCIM path with no Authorization header returns the SCIM 401.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import scimRoutes from '../routes/scimRoutes.js';

function mkServer() {
    const app = express();
    // Match server.js: mount SCIM router at the app root.
    app.use(scimRoutes(/* pool */ null));
    // Put a canary behind it so we can detect pass-through.
    app.get('/api/health', (_req, res) => res.status(200).json({ ok: true, canary: true }));
    app.use((_req, res) => res.status(404).json({ error: 'not found' }));
    return new Promise(resolve => {
        const server = http.createServer(app).listen(0, () => {
            const { port } = server.address();
            resolve({ server, port });
        });
    });
}

async function get(port, path, headers = {}) {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
}

describe('scimRoutes mount behaviour', () => {
    it('GET /api/health passes through the SCIM auth guard', async () => {
        const { server, port } = await mkServer();
        try {
            const { status, body } = await get(port, '/api/health');
            assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(body)}`);
            assert.equal(body.canary, true);
            assert.equal(body.ok, true);
            // Must NOT be a SCIM error shape.
            assert.ok(
                !body.schemas?.some?.(s => String(s).includes('scim')),
                'response should not carry SCIM schemas',
            );
        } finally {
            server.close();
        }
    });

    it('GET /scim/v2/Users without Authorization returns SCIM 401', async () => {
        const { server, port } = await mkServer();
        try {
            const { status, body } = await get(port, '/scim/v2/Users');
            assert.equal(status, 401);
            assert.equal(body.detail, 'missing bearer token');
            assert.ok(
                Array.isArray(body.schemas) &&
                body.schemas.includes('urn:ietf:params:scim:api:messages:2.0:Error'),
                'response should carry the SCIM error schema',
            );
        } finally {
            server.close();
        }
    });

    it('GET /api/alerts/recent without Authorization is NOT intercepted by SCIM', async () => {
        const { server, port } = await mkServer();
        try {
            const { status, body } = await get(port, '/api/alerts/recent');
            // No /api/alerts/recent route exists on this throw-away app, so we
            // expect the fall-through 404 — NOT a SCIM 401. The point is that
            // SCIM auth did not intercept the request.
            assert.equal(status, 404, `expected 404 fall-through, got ${status}: ${JSON.stringify(body)}`);
            assert.ok(
                !body.schemas?.some?.(s => String(s).includes('scim')),
                'response should not carry SCIM schemas',
            );
        } finally {
            server.close();
        }
    });
});
