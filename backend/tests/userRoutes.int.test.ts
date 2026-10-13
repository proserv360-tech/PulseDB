/**
 * tests/userRoutes.int.test.ts
 * ────────────────────────────
 * Route-level tests for userRoutes — one of the untested auth-sensitive routers
 * flagged by the audit (2026-07-24). The real router is mounted on a minimal
 * Express app with a stubbed pool and injectable auth/role guards; no real
 * database is touched.
 *
 * Covers:
 *   - authn: unauthenticated writes are rejected (401)
 *   - authz: a non-super_admin is rejected before reaching the handler (403)
 *   - validation: the validate({ body }) wiring added in this pass rejects
 *     malformed bodies with 400 "Validation failed" (bad role, short password,
 *     missing fields) — and accepts a well-formed body past the validator.
 *
 * Run: node --test tests/userRoutes.int.test.ts   (or: npm test)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

import userRoutes from '../routes/userRoutes.js';

// ── Injectable guards ────────────────────────────────────────────────────────
const authAs = (user: any) => (req: any, _res: any, next: any) => {
    req.user = user;
    next();
};
const authReject = (_req: any, res: any, _next: any) => res.status(401).json({ error: 'Unauthorized' });
const requireScreen = () => (_req: any, _res: any, next: any) => next();
const requireRole = (role: string) => (req: any, res: any, next: any) =>
    req.user?.role === role ? next() : res.status(403).json({ error: 'Forbidden' });

// Pool stub — enough for the uniqueness lookups on the create path to resolve
// to "no existing row" without a database.
const pool: any = { query: async () => ({ rows: [], rowCount: 0 }) };

const SUPER = { id: 1, username: 'root', role: 'super_admin' };
const VIEWER = { id: 2, username: 'v', role: 'viewer' };

const makeApp = (auth: any) => {
    const app = express();
    app.use(express.json());
    // Give every request a correlation id like the real server middleware does,
    // so handlers that read req.id don't blow up in isolation.
    app.use((req: any, _res, next) => { req.id = 'test-req'; next(); });
    app.use('/api', userRoutes(pool, auth, requireScreen, requireRole));
    return app;
};

const validUser = {
    username: 'newuser',
    password: 'Sup3rStrong!pw',
    name: 'New User',
    email: 'new@example.com',
    role: 'analyst',
};

describe('userRoutes — authn/authz', () => {
    it('rejects an unauthenticated create (401)', async () => {
        const res = await request(makeApp(authReject)).post('/api/users').send(validUser);
        assert.equal(res.status, 401);
    });

    it('rejects a non-super_admin create (403)', async () => {
        const res = await request(makeApp(authAs(VIEWER))).post('/api/users').send(validUser);
        assert.equal(res.status, 403);
    });
});

describe('userRoutes — input validation (validate() wiring)', () => {
    it('rejects an unknown role with 400 Validation failed', async () => {
        const res = await request(makeApp(authAs(SUPER)))
            .post('/api/users')
            .send({ ...validUser, role: 'wizard' });
        assert.equal(res.status, 400);
        assert.equal(res.body.error, 'Validation failed');
    });

    it('accepts the "developer" role that the schema previously omitted', async () => {
        // Reconciled with the backend VALID_ROLES this pass. It must get PAST the
        // validator — i.e. not a 400 "Validation failed" (downstream may vary).
        const res = await request(makeApp(authAs(SUPER)))
            .post('/api/users')
            .send({ ...validUser, role: 'developer' });
        assert.notEqual(res.body?.error, 'Validation failed');
    });

    it('rejects a too-short password with 400 Validation failed', async () => {
        const res = await request(makeApp(authAs(SUPER)))
            .post('/api/users')
            .send({ ...validUser, password: 'short' });
        assert.equal(res.status, 400);
        assert.equal(res.body.error, 'Validation failed');
    });

    it('rejects a missing required field (email) with 400 Validation failed', async () => {
        const { email: _drop, ...noEmail } = validUser;
        const res = await request(makeApp(authAs(SUPER))).post('/api/users').send(noEmail);
        assert.equal(res.status, 400);
        assert.equal(res.body.error, 'Validation failed');
    });

    it('rejects a reset-password with a too-short newPassword (400)', async () => {
        const res = await request(makeApp(authAs(SUPER)))
            .post('/api/users/5/reset-password')
            .send({ newPassword: 'x' });
        assert.equal(res.status, 400);
        assert.equal(res.body.error, 'Validation failed');
    });

    it('rejects an update with an invalid role (400)', async () => {
        const res = await request(makeApp(authAs(SUPER)))
            .put('/api/users/5')
            .send({ role: 'wizard' });
        assert.equal(res.status, 400);
        assert.equal(res.body.error, 'Validation failed');
    });
});
