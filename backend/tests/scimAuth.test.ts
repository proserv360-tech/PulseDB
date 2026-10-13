/**
 * tests/scimAuth.test.js
 * ───────────────────────
 * Unit tests for the SCIM bearer-token middleware and token helpers
 * (enterprise/scim/scimAuth.js).
 *
 * We mock `pg.Pool.query` so we don't need a live Postgres.
 *
 * Run: node --test tests/scimAuth.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
    issueScimToken,
    revokeScimToken,
    listScimTokens,
    createScimAuth,
} from '../enterprise/scim/scimAuth.js';

function sha256Hex(s) {
    return createHash('sha256').update(s).digest('hex');
}

function createMockPool(initial = []) {
    const tokens = [...initial];
    let idSeq = tokens.reduce((m, t) => Math.max(m, t.id), 0) + 1;
    const queries = [];

    return {
        query: (sql, params = []) => {
            queries.push({ sql, params });
            const s = sql.replace(/\s+/g, ' ').trim();

            if (s.startsWith('INSERT INTO') && s.includes('scim_tokens')) {
                const [tenant_id, token_hash, label] = params;
                const row = {
                    id: idSeq++, tenant_id, token_hash, label,
                    created_at: new Date(),
                    last_used_at: null, revoked_at: null,
                };
                tokens.push(row);
                return Promise.resolve({
                    rows: [{ id: row.id, created_at: row.created_at }],
                });
            }

            if (s.startsWith('UPDATE') && s.includes('revoked_at = now()')) {
                const [id] = params;
                const row = tokens.find((t) => t.id === id);
                if (row && !row.revoked_at) row.revoked_at = new Date();
                return Promise.resolve({ rows: [] });
            }

            if (s.startsWith('UPDATE') && s.includes('last_used_at = now()')) {
                const [id] = params;
                const row = tokens.find((t) => t.id === id);
                if (row) row.last_used_at = new Date();
                return Promise.resolve({ rows: [] });
            }

            if (s.startsWith('SELECT id, label, created_at, last_used_at')) {
                const [tenant_id] = params;
                const rows = tokens
                    .filter((t) => t.tenant_id === tenant_id && !t.revoked_at)
                    .map((t) => ({
                        id: t.id, label: t.label,
                        created_at: t.created_at,
                        last_used_at: t.last_used_at,
                        hash_prefix: t.token_hash.slice(0, 8),
                    }));
                return Promise.resolve({ rows });
            }

            if (s.startsWith('SELECT id, tenant_id, token_hash FROM')) {
                const [token_hash] = params;
                const row = tokens.find(
                    (t) => t.token_hash === token_hash && !t.revoked_at,
                );
                return Promise.resolve({ rows: row ? [row] : [] });
            }

            throw new Error(`mock pool: unhandled query: ${s}`);
        },
        _tokens: tokens,
        _queries: queries,
    };
}

function mockRes() {
    const res = {
        statusCode: null, headers: {}, body: null,
        status(code) { this.statusCode = code; return this; },
        type(t) { this.headers['content-type'] = t; return this; },
        send(b) { this.body = b; return this; },
    };
    return res;
}

// ── Token issuance ───────────────────────────────────────────────────────
describe('issueScimToken', () => {
    it('returns a fathom_scim_-prefixed plaintext', async () => {
        const pool = createMockPool();
        const r = await issueScimToken(pool, 'tenant-1', 'okta-prod');
        assert.match(r.plaintext, /^fathom_scim_[A-Za-z0-9_-]{40,}$/);
    });

    it('stores only the hash, never the plaintext', async () => {
        const pool = createMockPool();
        const r = await issueScimToken(pool, 'tenant-1', 'label');
        // Look at what went into the insert
        const insert = pool._queries.find((q) => q.sql.includes('INSERT INTO'));
        const [, storedHash] = insert.params;
        assert.match(storedHash, /^[0-9a-f]{64}$/);
        // The plaintext minus the prefix hashes to the stored value.
        const secret = r.plaintext.slice('fathom_scim_'.length);
        assert.equal(storedHash, sha256Hex(secret));
    });

    it('rejects empty tenantId', async () => {
        const pool = createMockPool();
        await assert.rejects(
            () => issueScimToken(pool, '', 'x'),
            /tenantId is required/,
        );
    });
});

// ── Revocation + listing ─────────────────────────────────────────────────
describe('revokeScimToken', () => {
    it('marks revoked_at on the row', async () => {
        const pool = createMockPool();
        const r = await issueScimToken(pool, 'tenant-1', 'a');
        await revokeScimToken(pool, r.id);
        const row = pool._tokens.find((t) => t.id === r.id);
        assert.ok(row.revoked_at);
    });

    it('is idempotent on already-revoked tokens', async () => {
        const pool = createMockPool();
        const r = await issueScimToken(pool, 'tenant-1', 'a');
        await revokeScimToken(pool, r.id);
        const first = pool._tokens.find((t) => t.id === r.id).revoked_at;
        await revokeScimToken(pool, r.id);
        const second = pool._tokens.find((t) => t.id === r.id).revoked_at;
        assert.equal(first.getTime(), second.getTime());
    });
});

describe('listScimTokens', () => {
    it('never returns plaintext or full hash', async () => {
        const pool = createMockPool();
        await issueScimToken(pool, 'tenant-1', 'a');
        const list = await listScimTokens(pool, 'tenant-1');
        assert.equal(list.length, 1);
        for (const row of list) {
            assert.ok(!('token_hash' in row));
            assert.ok(!('plaintext' in row));
            assert.match(row.hash_prefix, /^[0-9a-f]{8}$/);
        }
    });

    it('excludes revoked tokens', async () => {
        const pool = createMockPool();
        const live = await issueScimToken(pool, 'tenant-1', 'live');
        const dead = await issueScimToken(pool, 'tenant-1', 'dead');
        await revokeScimToken(pool, dead.id);
        const list = await listScimTokens(pool, 'tenant-1');
        assert.deepEqual(list.map((x) => x.id), [live.id]);
    });
});

// ── Middleware ───────────────────────────────────────────────────────────
describe('createScimAuth middleware', () => {
    it('rejects a request with no Authorization header', async () => {
        const pool = createMockPool();
        const mw = createScimAuth(pool);
        const res = mockRes();
        let called = false;
        await mw({ headers: {} }, res, () => { called = true; });
        assert.equal(called, false);
        assert.equal(res.statusCode, 401);
        assert.equal(res.headers['content-type'], 'application/scim+json');
        const body = JSON.parse(res.body);
        assert.deepEqual(body.schemas, ['urn:ietf:params:scim:api:messages:2.0:Error']);
        assert.equal(body.status, '401');
    });

    it('rejects a non-Bearer scheme', async () => {
        const pool = createMockPool();
        const mw = createScimAuth(pool);
        const res = mockRes();
        await mw({ headers: { authorization: 'Basic abc' } }, res, () => {});
        assert.equal(res.statusCode, 401);
    });

    it('rejects an unknown bearer token', async () => {
        const pool = createMockPool();
        const mw = createScimAuth(pool);
        const res = mockRes();
        await mw(
            { headers: { authorization: 'Bearer fathom_scim_deadbeef' } },
            res,
            () => {},
        );
        assert.equal(res.statusCode, 401);
    });

    it('accepts a valid token and attaches tenantId', async () => {
        const pool = createMockPool();
        const issued = await issueScimToken(pool, 'tenant-42', 'ok');
        const mw = createScimAuth(pool);
        const res = mockRes();
        const req = { headers: { authorization: `Bearer ${issued.plaintext}` } };
        let called = false;
        await mw(req, res, () => { called = true; });
        assert.equal(called, true);
        assert.equal(req.tenantId, 'tenant-42');
        assert.equal(req.scimTokenId, issued.id);
    });

    it('rejects a revoked token', async () => {
        const pool = createMockPool();
        const issued = await issueScimToken(pool, 'tenant-1', 'to-be-killed');
        await revokeScimToken(pool, issued.id);
        const mw = createScimAuth(pool);
        const res = mockRes();
        await mw(
            { headers: { authorization: `Bearer ${issued.plaintext}` } },
            res,
            () => { throw new Error('should not be called'); },
        );
        assert.equal(res.statusCode, 401);
    });

    it('tolerates tokens sent without the fathom_scim_ prefix', async () => {
        const pool = createMockPool();
        const issued = await issueScimToken(pool, 'tenant-1', 'ok');
        const raw = issued.plaintext.replace(/^fathom_scim_/, '');
        const mw = createScimAuth(pool);
        const res = mockRes();
        const req = { headers: { authorization: `Bearer ${raw}` } };
        let called = false;
        await mw(req, res, () => { called = true; });
        assert.equal(called, true);
        assert.equal(req.tenantId, 'tenant-1');
    });
});
