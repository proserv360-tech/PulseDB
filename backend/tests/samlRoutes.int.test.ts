/**
 * tests/samlRoutes.int.test.ts
 * ────────────────────────────
 * Route-level tests for samlRoutes — flagged as untested by the audit
 * (2026-07-24). Mounts the real router with injected auth/role guards and
 * db.js's query stubbed via __setQueryForTests; no real database.
 *
 * Covers the RBAC boundary on the config endpoints (admin/owner/superadmin
 * only) and a positive read once the caller has an accepted role.
 *
 * Run: node --test tests/samlRoutes.int.test.ts   (or: npm test)
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

import { __setQueryForTests } from '../db.js';
import samlRoutes from '../routes/samlRoutes.js';

// Stub the control-plane query used by the config read.
const restore = __setQueryForTests(async (sql: string) => {
    if (sql.includes('FROM pgmonitoringtool.saml_configs')) {
        return { rows: [{ entity_id: 'urn:test', sso_url: 'https://idp/sso', enabled: true }] };
    }
    return { rows: [] };
});
after(() => restore());

const authAs = (user: any) => (req: any, _res: any, next: any) => { req.user = user; next(); };
const authReject = (_req: any, res: any, _next: any) => res.status(401).json({ error: 'Unauthorized' });
// Real usage is requireRole('admin','owner','superadmin') — variadic.
const requireRole = (...roles: string[]) => (req: any, res: any, next: any) =>
    roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'Forbidden' });
const signJwt = () => 'test.jwt.token';
const pool: any = { query: async () => ({ rows: [] }) };

const makeApp = (auth: any) => {
    const app = express();
    app.use(express.json());
    app.use('/api', samlRoutes(pool, auth, requireRole, signJwt));
    return app;
};

describe('samlRoutes — config RBAC', () => {
    it('rejects an unauthenticated config read (401)', async () => {
        const res = await request(makeApp(authReject)).get('/api/saml/1/config');
        assert.equal(res.status, 401);
    });

    it('rejects a viewer reading the config (403)', async () => {
        const res = await request(makeApp(authAs({ id: 2, role: 'viewer' }))).get('/api/saml/1/config');
        assert.equal(res.status, 403);
    });

    it('rejects a viewer updating the config (403)', async () => {
        const res = await request(makeApp(authAs({ id: 2, role: 'viewer' })))
            .put('/api/saml/1/config')
            .send({ enabled: true });
        assert.equal(res.status, 403);
    });

    it('allows an admin to read the config (200)', async () => {
        const res = await request(makeApp(authAs({ id: 1, role: 'admin' }))).get('/api/saml/1/config');
        assert.equal(res.status, 200);
        assert.equal(res.body.config.entity_id, 'urn:test');
    });
});
