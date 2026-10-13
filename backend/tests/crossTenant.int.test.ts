/**
 * tests/crossTenant.int.test.ts
 * Defense-in-depth for audit HIGH-1 (cross-tenant IDOR).
 *
 *  (A) Real resolveWorkspace middleware exercised with db.js's query stubbed
 *      via __setQueryForTests: proves a non-member targeting a foreign
 *      workspace is rejected (403), and a member resolves to their OWN
 *      workspace regardless of any client-supplied id.
 *  (B) Real schemaTracking router: a foreign connectionId is rejected (404),
 *      an owned one passes (200), missing one is 400.
 *
 * No real database is touched.
 * Run: node --test tests/crossTenant.int.test.ts
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

import { __setQueryForTests } from '../db.js';
import { resolveWorkspace, requireWorkspaceRole } from '../middleware/workspaceRbac.js';
import schemaTrackingRoutes from '../routes/schemaTrackingRoutes.js';

// userA is a member of workspace 1 only.
const restore = __setQueryForTests(async (sql: string, params: any[] = []) => {
    if (sql.includes('FROM pgmonitoringtool.workspace_members')) {
        return params[0] === 'userA' ? { rows: [{ workspace_id: 1, role: 'owner' }] } : { rows: [] };
    }
    if (sql.includes('FROM pgmonitoringtool.workspaces')) return { rows: [{ id: params[0] }] };
    return { rows: [] };
});
after(() => restore());

const USER_A = { id: 'userA', role: 'member', username: 'a' };
const authA = (req: any, _res: any, next: any) => {
    req.user = USER_A;
    next();
};

describe('HIGH-1: resolveWorkspace membership enforcement', () => {
    it('member resolves to their own workspace (ignores client-supplied id)', async () => {
        const app = express();
        app.get('/t', authA, resolveWorkspace, requireWorkspaceRole('viewer'), (req: any, res: any) =>
            res.json({ ws: req.workspace.id }),
        );
        const ok = await request(app).get('/t');
        assert.equal(ok.status, 200);
        assert.equal(ok.body.ws, 1);
    });

    it('member targeting a foreign workspace via ?workspace is rejected (403)', async () => {
        const app = express();
        app.get('/t', authA, resolveWorkspace, requireWorkspaceRole('viewer'), (_req: any, res: any) =>
            res.json({ ok: true }),
        );
        const res = await request(app).get('/t?workspace=2');
        assert.equal(res.status, 403, `expected 403, got ${res.status} ${JSON.stringify(res.body)}`);
    });

    it('unauthenticated request is rejected (401)', async () => {
        const app = express();
        app.get('/t', resolveWorkspace, (_req: any, res: any) => res.json({ ok: true }));
        const res = await request(app).get('/t');
        assert.equal(res.status, 401);
    });
});

describe('HIGH-1: schema timeline connection ownership', () => {
    const reqPool = async (req: any) => {
        if (String(req.query.connectionId) !== '10') throw new Error(`Connection ${req.query.connectionId} not found`);
        return { connect: async () => ({ query: async () => ({ rows: [] }), release() {} }) };
    };
    const resolveConn = async (connectionId: any) => {
        if (String(connectionId) !== '10') throw new Error(`Connection ${connectionId} not found`);
        return { id: 10 };
    };
    const controlPool = { query: async () => ({ rows: [] }) };
    const makeApp = () => {
        const app = express();
        app.use(express.json());
        app.use('/api', schemaTrackingRoutes(controlPool, authA, reqPool, resolveConn));
        return app;
    };

    it('foreign connectionId is rejected (404)', async () => {
        assert.equal((await request(makeApp()).get('/api/schema/track/timeline?connectionId=20')).status, 404);
    });
    it('owned connectionId is allowed (200)', async () => {
        const res = await request(makeApp()).get('/api/schema/track/timeline?connectionId=10');
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.changes, []);
    });
    it('missing connectionId is a 400', async () => {
        assert.equal((await request(makeApp()).get('/api/schema/track/timeline')).status, 400);
    });
    it('capture against a foreign connectionId is rejected (404)', async () => {
        assert.equal((await request(makeApp()).post('/api/schema/track/capture?connectionId=20')).status, 404);
    });
});
