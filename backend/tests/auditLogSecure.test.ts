/**
 * tests/auditLogSecure.test.js
 * ─────────────────────────────
 * Unit tests for the tamper-evident audit log (services/auditLogSecure.js).
 *
 * We don't depend on a live Postgres; instead we build a tiny in-memory
 * mock that implements just the subset of `pool.query` the module uses:
 *   - SELECT row_hash FROM audit_log_secure ORDER BY id DESC LIMIT 1
 *   - SELECT * FROM audit_log_secure WHERE id > $1 ORDER BY id LIMIT $2
 *   - INSERT INTO audit_log_secure ... VALUES ...
 *   - SELECT COUNT(*) ... WHERE ts < $1
 *   - DELETE FROM audit_log_secure WHERE ts < $1
 *
 * This lets us exercise the hash-chain construction, verification, and
 * tamper-detection paths without pg.
 *
 * Run: node --test tests/auditLogSecure.test.js
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
    canonicalJson,
    computeRowHash,
    appendAudit,
    verifyChain,
    enforceRetention,
} from '../services/auditLogSecure.js';

// ── In-memory mock pool ──────────────────────────────────────────────────
function createMockPool() {
    const table = []; // rows in insertion order
    let idSeq = 1;

    function query(sql, params = []) {
        // Normalise whitespace for matching
        const s = sql.replace(/\s+/g, ' ').trim();

        if (s.startsWith('SELECT row_hash FROM') && s.includes('ORDER BY id DESC LIMIT 1')) {
            if (table.length === 0) return Promise.resolve({ rows: [] });
            return Promise.resolve({ rows: [{ row_hash: table[table.length - 1].row_hash }] });
        }

        if (s.startsWith('SELECT id, ts, tenant_id')) {
            const afterId = params[0];
            const limit = params[1];
            const slice = table.filter((r) => r.id > afterId).slice(0, limit);
            return Promise.resolve({ rows: slice });
        }

        if (s.startsWith('INSERT INTO') && s.includes('audit_log_secure')) {
            // Two insertion shapes — 9 params (normal append) or 3 params (retention sweep).
            if (params.length === 9) {
                const [ts, tenant_id, actor_id, actor_name, action, resource, detail,
                       prev_hash, row_hash] = params;
                const row = {
                    id: idSeq++,
                    ts: ts instanceof Date ? ts : new Date(ts),
                    tenant_id, actor_id, actor_name, action, resource,
                    detail: detail ? JSON.parse(detail) : null,
                    prev_hash, row_hash,
                };
                table.push(row);
                return Promise.resolve({ rows: [{ id: row.id }] });
            } else {
                // Retention sweep insert: VALUES (now(), 'RETENTION_SWEEP', ..., $1, $2, $3)
                const [detail, prev_hash, row_hash] = params;
                const row = {
                    id: idSeq++,
                    ts: new Date(),
                    tenant_id: null, actor_id: null, actor_name: null,
                    action: 'RETENTION_SWEEP',
                    resource: 'audit_log_secure',
                    detail: JSON.parse(detail),
                    prev_hash, row_hash,
                };
                table.push(row);
                return Promise.resolve({ rows: [{ id: row.id }] });
            }
        }

        if (s.startsWith('SELECT COUNT(*)::int AS n FROM') && s.includes('WHERE ts < $1')) {
            const floor = params[0];
            const n = table.filter((r) => r.ts < floor).length;
            return Promise.resolve({ rows: [{ n }] });
        }

        if (s.startsWith('DELETE FROM') && s.includes('audit_log_secure WHERE ts < $1')) {
            const floor = params[0];
            for (let i = table.length - 1; i >= 0; i--) {
                if (table[i].ts < floor) table.splice(i, 1);
            }
            return Promise.resolve({ rowCount: 0 });
        }

        throw new Error(`mock pool: unhandled query: ${s}`);
    }

    return { query, _table: table };
}

// ── canonicalJson ────────────────────────────────────────────────────────
describe('canonicalJson', () => {
    it('stringifies primitives the same as JSON.stringify', () => {
        assert.equal(canonicalJson(null), 'null');
        assert.equal(canonicalJson(42), '42');
        assert.equal(canonicalJson('hi'), '"hi"');
        assert.equal(canonicalJson(true), 'true');
    });

    it('sorts object keys alphabetically at every depth', () => {
        const v = { b: 1, a: 2, nested: { z: 9, y: 8 } };
        assert.equal(canonicalJson(v), '{"a":2,"b":1,"nested":{"y":8,"z":9}}');
    });

    it('preserves array order', () => {
        assert.equal(canonicalJson([3, 1, 2]), '[3,1,2]');
    });

    it('is round-trip stable — two objects with the same shape hash identically', () => {
        const a = { b: 1, a: { x: 1, y: 2 } };
        const b = { a: { y: 2, x: 1 }, b: 1 };
        assert.equal(canonicalJson(a), canonicalJson(b));
    });
});

// ── computeRowHash ───────────────────────────────────────────────────────
describe('computeRowHash', () => {
    it('is deterministic for the same input', () => {
        const h1 = computeRowHash('a'.repeat(64), { action: 'LOGIN' });
        const h2 = computeRowHash('a'.repeat(64), { action: 'LOGIN' });
        assert.equal(h1, h2);
    });

    it('differs when prev_hash changes', () => {
        const h1 = computeRowHash('a'.repeat(64), { action: 'LOGIN' });
        const h2 = computeRowHash('b'.repeat(64), { action: 'LOGIN' });
        assert.notEqual(h1, h2);
    });

    it('returns a 64-character hex string', () => {
        const h = computeRowHash('0'.repeat(64), { a: 1 });
        assert.match(h, /^[0-9a-f]{64}$/);
    });
});

// ── appendAudit + verifyChain ────────────────────────────────────────────
describe('appendAudit + verifyChain', () => {
    let pool;
    beforeEach(() => { pool = createMockPool(); });

    it('first row uses GENESIS_HASH as prev_hash', async () => {
        const r = await appendAudit(pool, {
            action: 'LOGIN', actorId: 'u1', tenantId: 't1',
        });
        assert.equal(r.prevHash, '0'.repeat(64));
        assert.match(r.rowHash, /^[0-9a-f]{64}$/);
    });

    it('chains subsequent rows through prev_hash', async () => {
        const r1 = await appendAudit(pool, { action: 'A' });
        const r2 = await appendAudit(pool, { action: 'B' });
        const r3 = await appendAudit(pool, { action: 'C' });
        assert.equal(r2.prevHash, r1.rowHash);
        assert.equal(r3.prevHash, r2.rowHash);
    });

    it('requires an action', async () => {
        await assert.rejects(
            () => appendAudit(pool, {}),
            /action is required/,
        );
    });

    it('verifyChain returns ok for an untampered chain', async () => {
        for (const a of ['LOGIN', 'CONFIG_CHANGE', 'LOGOUT']) {
            await appendAudit(pool, { action: a });
        }
        const res = await verifyChain(pool, { batchSize: 2 });
        assert.equal(res.ok, true);
        assert.equal(res.rowsChecked, 3);
        assert.match(res.headHash, /^[0-9a-f]{64}$/);
    });

    it('verifyChain detects row_hash tampering', async () => {
        await appendAudit(pool, { action: 'A' });
        await appendAudit(pool, { action: 'B' });
        // Mutate the action of row 2 — row_hash stays the same, payload changes.
        pool._table[1].action = 'EVIL';
        const res = await verifyChain(pool);
        assert.equal(res.ok, false);
        assert.equal(res.brokenAt, 2);
        assert.equal(res.reason, 'row_hash_mismatch');
    });

    it('verifyChain detects prev_hash corruption', async () => {
        await appendAudit(pool, { action: 'A' });
        await appendAudit(pool, { action: 'B' });
        // Corrupt the prev_hash pointer on row 2.
        pool._table[1].prev_hash = 'f'.repeat(64);
        const res = await verifyChain(pool);
        assert.equal(res.ok, false);
        assert.equal(res.brokenAt, 2);
        assert.equal(res.reason, 'prev_hash_mismatch');
    });

    it('verifyChain walks in batches correctly', async () => {
        for (let i = 0; i < 25; i++) await appendAudit(pool, { action: `A${i}` });
        const res = await verifyChain(pool, { batchSize: 3 });
        assert.equal(res.ok, true);
        assert.equal(res.rowsChecked, 25);
    });

    it('stored detail JSON round-trips through the hash', async () => {
        const detail = { ip: '10.0.0.1', changed: ['name', 'email'] };
        await appendAudit(pool, { action: 'UPDATE', detail });
        const res = await verifyChain(pool);
        assert.equal(res.ok, true);
    });
});

// ── enforceRetention ─────────────────────────────────────────────────────
describe('enforceRetention', () => {
    it('is a no-op when nothing is older than the floor', async () => {
        const pool = createMockPool();
        await appendAudit(pool, { action: 'A' });
        const r = await enforceRetention(pool, { days: 7 });
        assert.equal(r.removed, 0);
    });

    it('rejects non-positive day counts', async () => {
        const pool = createMockPool();
        await assert.rejects(
            () => enforceRetention(pool, { days: 0 }),
            /days must be a positive/,
        );
        await assert.rejects(
            () => enforceRetention(pool, { days: -1 }),
            /days must be a positive/,
        );
    });

    it('deletes old rows and appends a RETENTION_SWEEP event', async () => {
        const pool = createMockPool();
        // Insert 3 rows "8 days ago" and 2 rows at "now"
        const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
        await appendAudit(pool, { action: 'OLD1', ts: eightDaysAgo });
        await appendAudit(pool, { action: 'OLD2', ts: eightDaysAgo });
        await appendAudit(pool, { action: 'OLD3', ts: eightDaysAgo });
        await appendAudit(pool, { action: 'NEW1' });
        await appendAudit(pool, { action: 'NEW2' });

        const r = await enforceRetention(pool, { days: 7 });
        assert.equal(r.removed, 3);
        // After the sweep, there are 2 original "new" rows + 1 sweep event.
        const actions = pool._table.map((x) => x.action);
        assert.deepEqual(actions, ['NEW1', 'NEW2', 'RETENTION_SWEEP']);
    });
});
