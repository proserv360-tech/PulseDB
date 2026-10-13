/**
 * tests/scimCrossTenant.test.js
 * ──────────────────────────────
 * Regression test suite for CRIT-1 and CRIT-2 from ROADMAP_CODE_AUDIT.md.
 *
 * CRIT-1: POST /scim/v2/Users with ON CONFLICT DO UPDATE would let a SCIM
 *         token for workspace A rewrite the status/username of a users
 *         row that belonged to workspace B.
 *
 * CRIT-2: PATCH /scim/v2/Users/:id did an UPDATE without workspace scoping,
 *         so a token for workspace A could suspend users who were only
 *         members of workspace B — the 404 came from a post-update SELECT
 *         by which time the damage was done.
 *
 * These tests drive the real Express router from backend/routes/scimRoutes.js
 * against a stubbed `pool.query` that records every SQL statement and its
 * params. They assert two things for each hardened path:
 *
 *   1. When the target user is NOT a member of the caller's workspace, the
 *      route returns 404 and does NOT issue any UPDATE that could touch
 *      the foreign users row.
 *   2. Every UPDATE that DOES run is scoped through workspace_members by
 *      the caller's workspace_id (the SQL contains the workspace_members
 *      join AND workspace_id is one of the bound parameters).
 *
 * Run: node --test backend/tests/scimCrossTenant.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import http from 'node:http';

import scimRoutes from '../routes/scimRoutes.js';
import { pool } from '../db.js';

// ── fake pool ────────────────────────────────────────────────────────────────
// We replace pool.query with a handler that pattern-matches on the SQL text
// and returns canned rowsets. Every call is also appended to `captured` so
// tests can make structural assertions afterwards.
//
// The fixture:
//   Workspace 1 token hash: "hash-ws1"
//   Workspace 2 owns user 99 (only); workspace 1 must not be able to touch it.

function installFakePool({ users, members, tokens }) {
    const captured = [];
    // Preserve the original so we can restore it after the test run.
    const originalQuery = pool.query.bind(pool);

    pool.query = async (text, params = []) => {
        captured.push({ text: text.replace(/\s+/g, ' ').trim(), params });
        const sql = text.replace(/\s+/g, ' ').trim().toLowerCase();

        // SCIM auth: token lookup
        if (sql.startsWith('select workspace_id, expires_at from pgmonitoringtool.scim_tokens')) {
            const [hash] = params;
            const row = tokens.find(t => t.hash === hash && !t.revoked);
            return { rows: row ? [{ workspace_id: row.workspace_id, expires_at: null }] : [] };
        }
        // SCIM auth: last_used_at bookkeeping
        if (sql.startsWith('update pgmonitoringtool.scim_tokens set last_used_at')) {
            return { rows: [] };
        }

        // POST /Users — INSERT users ON CONFLICT DO NOTHING
        if (sql.startsWith('insert into pgmonitoringtool.users')) {
            const [, email] = params;
            const existing = users.find(u => u.email === email);
            if (existing) return { rows: [] };             // conflict path
            const fresh = {
                id: Math.max(0, ...users.map(u => u.id)) + 1,
                email, username: email, status: params[3] || 'active',
                created_at: new Date(),
            };
            users.push(fresh);
            return { rows: [{ ...fresh }] };
        }

        // POST /Users fallback SELECT when conflict was hit
        if (sql.startsWith('select id, email, username, status, created_at from pgmonitoringtool.users where email = $1')) {
            const [email] = params;
            const u = users.find(x => x.email === email);
            return { rows: u ? [{ ...u }] : [] };
        }

        // INSERT workspace_members
        if (sql.startsWith('insert into pgmonitoringtool.workspace_members')) {
            const [workspace_id, user_id] = params;
            if (!members.find(m => m.workspace_id === workspace_id && m.user_id === user_id)) {
                members.push({ workspace_id, user_id, role: 'viewer' });
            }
            return { rows: [] };
        }

        // POST /Users — the scoped status UPDATE (joins through workspace_members)
        // PATCH /Users/:id — the scoped status UPDATE (also joins through workspace_members)
        if (sql.startsWith('update pgmonitoringtool.users u set status')) {
            // Accept the hardened shape only. The join through
            // workspace_members is the whole point of the CRIT-2 fix.
            if (!sql.includes('from pgmonitoringtool.workspace_members wm')) {
                throw new Error('CRIT-2 regression: UPDATE users.status without workspace_members scoping');
            }
            const [user_id, newStatus, ws_id] = params;
            const belongs = members.find(m => m.user_id === user_id && m.workspace_id === ws_id);
            if (!belongs) return { rows: [] }; // correctly no-op for cross-tenant
            const u = users.find(x => x.id === user_id);
            if (u) u.status = newStatus;
            return { rows: u ? [{ ...u, role: 'viewer' }] : [] };
        }

        // findUserInWorkspace — the pre-flight scoped SELECT
        if (sql.startsWith('select u.id, u.email, u.username, u.status, wm.role, u.created_at from pgmonitoringtool.workspace_members wm')) {
            const [workspace_id, user_id] = params;
            const belongs = members.find(m => m.workspace_id === workspace_id && m.user_id === user_id);
            if (!belongs) return { rows: [] };
            const u = users.find(x => x.id === user_id);
            return { rows: u ? [{ ...u, role: belongs.role }] : [] };
        }

        // Cross-tenant pre-flight: SELECT 1 FROM workspace_members WHERE (ws,user)
        if (sql.startsWith('select 1 from pgmonitoringtool.workspace_members where workspace_id = $1 and user_id = $2')) {
            const [workspace_id, user_id] = params;
            const belongs = members.find(m => m.workspace_id === workspace_id && m.user_id === user_id);
            return { rows: belongs ? [{ '?column?': 1 }] : [] };
        }

        throw new Error(`scimCrossTenant: unhandled SQL: ${sql.slice(0, 180)}`);
    };

    return {
        captured,
        restore() { pool.query = originalQuery; },
    };
}

function makeApp() {
    const app = express();
    app.use(express.json({ type: () => true }));
    app.use(scimRoutes(pool));
    return app;
}

async function withServer(fn) {
    const app = makeApp();
    const server = http.createServer(app);
    await new Promise(r => server.listen(0, r));
    const { port } = server.address();
    try { return await fn(`http://127.0.0.1:${port}`); }
    finally { await new Promise(r => server.close(r)); }
}

function sha256Hex(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

// ── test scaffolding ─────────────────────────────────────────────────────────

function seed() {
    // User 99 is a member of workspace 2 only; the CRIT tests hinge on the
    // fact that a workspace-1 token must not be able to touch user 99.
    return {
        users:   [{ id: 99, email: 'victim@example.com', username: 'victim', status: 'active', created_at: new Date() }],
        members: [{ workspace_id: 2, user_id: 99, role: 'viewer' }],
        tokens:  [
            { hash: sha256Hex('tok-ws1'), workspace_id: 1, revoked: false },
            { hash: sha256Hex('tok-ws2'), workspace_id: 2, revoked: false },
        ],
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// CRIT-1: POST /scim/v2/Users must not rewrite a cross-tenant user's status
// ─────────────────────────────────────────────────────────────────────────────

test('CRIT-1: workspace-1 SCIM token cannot suspend workspace-2 user via POST /Users', async () => {
    const fixture = seed();
    const fake = installFakePool(fixture);
    try {
        await withServer(async (base) => {
            const r = await fetch(`${base}/scim/v2/Users`, {
                method: 'POST',
                headers: {
                    authorization: 'Bearer tok-ws1',
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
                    userName: 'victim@example.com',
                    active: false, // attacker wants status=suspended
                }),
            });
            // CRIT-1 hardening: an existing user that is not already a member
            // of the caller's workspace must be rejected outright rather than
            // silently cross-linked. 409 Conflict is the RFC 7644 §3.3 shape.
            assert.equal(r.status, 409,
                `expected 409 for cross-tenant POST, got ${r.status}`);

            // Critical invariant: the victim user's status was NOT changed.
            const victim = fixture.users.find(u => u.id === 99);
            assert.equal(victim.status, 'active',
                'cross-tenant POST /Users rewrote victim status — CRIT-1 regressed');

            // And: no UPDATE was issued at all.
            const updates = fake.captured.filter(c =>
                c.text.toLowerCase().includes('update pgmonitoringtool.users u set status'));
            assert.equal(updates.length, 0,
                'no UPDATE on users.status should run for a cross-tenant POST');

            // And: the victim was NOT linked into workspace 1.
            const crosslink = fixture.members.find(m =>
                m.workspace_id === 1 && m.user_id === 99);
            assert.equal(crosslink, undefined,
                'CRIT-1 regression: victim user was auto-linked into attacker workspace');
        });
    } finally { fake.restore(); }
});

test('CRIT-1: POST /Users still works for a user already in the caller workspace', async () => {
    const fixture = seed();
    // Put user 99 in workspace 1 too, so the caller legitimately owns them.
    fixture.members.push({ workspace_id: 1, user_id: 99, role: 'viewer' });
    const fake = installFakePool(fixture);
    try {
        await withServer(async (base) => {
            const r = await fetch(`${base}/scim/v2/Users`, {
                method: 'POST',
                headers: {
                    authorization: 'Bearer tok-ws1',
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
                    userName: 'victim@example.com',
                    active: false,
                }),
            });
            assert.ok(r.status === 200 || r.status === 201);
            const victim = fixture.users.find(u => u.id === 99);
            assert.equal(victim.status, 'suspended',
                'same-workspace SCIM suspend should have applied');
        });
    } finally { fake.restore(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// CRIT-2: PATCH /scim/v2/Users/:id must 404 before any UPDATE for a non-member
// ─────────────────────────────────────────────────────────────────────────────

test('CRIT-2: workspace-1 SCIM token gets 404 on PATCH of workspace-2 user (and no UPDATE runs)', async () => {
    const fixture = seed();
    const fake = installFakePool(fixture);
    try {
        await withServer(async (base) => {
            const r = await fetch(`${base}/scim/v2/Users/99`, {
                method: 'PATCH',
                headers: {
                    authorization: 'Bearer tok-ws1',
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
                    Operations: [{ op: 'replace', path: 'active', value: false }],
                }),
            });
            assert.equal(r.status, 404, 'cross-tenant PATCH must 404 before any UPDATE');

            // No UPDATE on users.status should have been issued at all.
            const updates = fake.captured.filter(c =>
                c.text.toLowerCase().includes('update pgmonitoringtool.users u set status'));
            assert.equal(updates.length, 0,
                'CRIT-2 regression: PATCH issued UPDATE for cross-tenant user');

            const victim = fixture.users.find(u => u.id === 99);
            assert.equal(victim.status, 'active', 'victim status changed — CRIT-2 regressed');
        });
    } finally { fake.restore(); }
});

test('CRIT-2: PATCH succeeds when token and user share a workspace', async () => {
    const fixture = seed();
    fixture.members.push({ workspace_id: 1, user_id: 99, role: 'viewer' });
    const fake = installFakePool(fixture);
    try {
        await withServer(async (base) => {
            const r = await fetch(`${base}/scim/v2/Users/99`, {
                method: 'PATCH',
                headers: {
                    authorization: 'Bearer tok-ws1',
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
                    Operations: [{ op: 'replace', path: 'active', value: false }],
                }),
            });
            assert.equal(r.status, 200);
            const victim = fixture.users.find(u => u.id === 99);
            assert.equal(victim.status, 'suspended');
        });
    } finally { fake.restore(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// LOW-8: POST /Users returns 200 when re-attaching an existing users row
// (and 201 when creating a brand-new one).
// ─────────────────────────────────────────────────────────────────────────────

test('LOW-8: POST /Users returns 201 for a brand-new user, 200 for a same-workspace re-provision', async () => {
    const fixture = seed();
    // Put the existing user into workspace 1 so the second POST is a legit
    // same-workspace re-provisioning (the only re-provisioning shape we
    // allow after the CRIT-1 hardening).
    fixture.members.push({ workspace_id: 1, user_id: 99, role: 'viewer' });
    const fake = installFakePool(fixture);
    try {
        await withServer(async (base) => {
            // Fresh user — 201 Created
            const fresh = await fetch(`${base}/scim/v2/Users`, {
                method: 'POST',
                headers: {
                    authorization: 'Bearer tok-ws1',
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
                    userName: 'brand-new@example.com',
                    active: true,
                }),
            });
            assert.equal(fresh.status, 201);

            // Existing user, same workspace — 200 OK (idempotent re-provision)
            const existing = await fetch(`${base}/scim/v2/Users`, {
                method: 'POST',
                headers: {
                    authorization: 'Bearer tok-ws1',
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
                    userName: 'victim@example.com',
                    active: true,
                }),
            });
            assert.equal(existing.status, 200);
        });
    } finally { fake.restore(); }
});
