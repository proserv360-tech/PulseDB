/**
 * tests/pgScimStorage.test.js
 * ────────────────────────────
 * Unit tests for scim/pgScimStorage.js.
 *
 * We drive a stub pg.Pool whose query() pattern-matches on SQL fragments
 * and returns deterministic rows. This lets us verify the storage-layer
 * tenant scoping and shape translation without a live DB.
 *
 * Run: node --test tests/pgScimStorage.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { PgScimStorage } from '../enterprise/scim/pgScimStorage.js';

// ── Minimal mock pool ────────────────────────────────────────────────────
function createMockPool() {
    const users = [];   // { tenant_id, id, external_id, user_name, ... }
    const groups = [];
    const queries = [];

    function query(sql, params = []) {
        queries.push({ sql, params });
        const s = sql.replace(/\s+/g, ' ').trim();

        // ── Users ───────────────────────────────────────────────────────
        if (s.startsWith('SELECT COUNT(*)::int AS n FROM') && s.includes('scim_users')) {
            const [tenant_id] = params;
            return Promise.resolve({
                rows: [{ n: users.filter((u) => u.tenant_id === tenant_id).length }],
            });
        }
        if (s.startsWith('SELECT * FROM') && s.includes('scim_users WHERE tenant_id = $1 ORDER BY created_at')) {
            const [tenant_id, limit, offset] = params;
            const rows = users
                .filter((u) => u.tenant_id === tenant_id)
                .slice(offset, offset + limit);
            return Promise.resolve({ rows });
        }
        if (s.startsWith('SELECT * FROM') && s.includes('scim_users WHERE tenant_id = $1 AND id = $2')) {
            const [tenant_id, id] = params;
            const row = users.find((u) => u.tenant_id === tenant_id && u.id === id);
            return Promise.resolve({ rows: row ? [row] : [] });
        }
        if (s.startsWith('SELECT * FROM') && s.includes('scim_users WHERE tenant_id = $1 AND external_id = $2')) {
            const [tenant_id, external_id] = params;
            const row = users.find((u) => u.tenant_id === tenant_id && u.external_id === external_id);
            return Promise.resolve({ rows: row ? [row] : [] });
        }
        if (s.startsWith('INSERT INTO') && s.includes('scim_users')) {
            const [tenant_id, id, external_id, user_name, display_name, active, name, emails] = params;
            const row = {
                tenant_id, id, external_id,
                user_name, display_name,
                active: active === null ? true : active,
                name: name ? JSON.parse(name) : null,
                emails: emails ? JSON.parse(emails) : [],
                created_at: new Date(), updated_at: new Date(),
            };
            users.push(row);
            return Promise.resolve({ rows: [row] });
        }
        if (s.startsWith('UPDATE') && s.includes('scim_users')) {
            const [tenant_id, id, external_id, user_name, display_name, active, name, emails] = params;
            const row = users.find((u) => u.tenant_id === tenant_id && u.id === id);
            if (!row) return Promise.resolve({ rows: [] });
            row.external_id = external_id;
            row.user_name = user_name;
            row.display_name = display_name;
            row.active = active === null ? true : active;
            row.name = name ? JSON.parse(name) : null;
            row.emails = emails ? JSON.parse(emails) : [];
            row.updated_at = new Date();
            return Promise.resolve({ rows: [row] });
        }
        if (s.startsWith('DELETE FROM') && s.includes('scim_users')) {
            const [tenant_id, id] = params;
            const before = users.length;
            for (let i = users.length - 1; i >= 0; i--) {
                if (users[i].tenant_id === tenant_id && users[i].id === id) users.splice(i, 1);
            }
            return Promise.resolve({ rowCount: before - users.length });
        }

        // ── Groups ──────────────────────────────────────────────────────
        if (s.startsWith('SELECT COUNT(*)::int AS n FROM') && s.includes('scim_groups')) {
            const [tenant_id] = params;
            return Promise.resolve({
                rows: [{ n: groups.filter((g) => g.tenant_id === tenant_id).length }],
            });
        }
        if (s.startsWith('SELECT * FROM') && s.includes('scim_groups WHERE tenant_id = $1 ORDER BY created_at')) {
            const [tenant_id, limit, offset] = params;
            const rows = groups
                .filter((g) => g.tenant_id === tenant_id)
                .slice(offset, offset + limit);
            return Promise.resolve({ rows });
        }
        if (s.startsWith('SELECT * FROM') && s.includes('scim_groups WHERE tenant_id = $1 AND id = $2')) {
            const [tenant_id, id] = params;
            const row = groups.find((g) => g.tenant_id === tenant_id && g.id === id);
            return Promise.resolve({ rows: row ? [row] : [] });
        }
        if (s.startsWith('INSERT INTO') && s.includes('scim_groups')) {
            const [tenant_id, id, external_id, display_name, members] = params;
            const row = {
                tenant_id, id, external_id,
                display_name,
                members: members ? JSON.parse(members) : [],
                created_at: new Date(), updated_at: new Date(),
            };
            groups.push(row);
            return Promise.resolve({ rows: [row] });
        }
        if (s.startsWith('UPDATE') && s.includes('scim_groups')) {
            const [tenant_id, id, external_id, display_name, members] = params;
            const row = groups.find((g) => g.tenant_id === tenant_id && g.id === id);
            if (!row) return Promise.resolve({ rows: [] });
            row.external_id = external_id;
            row.display_name = display_name;
            row.members = members ? JSON.parse(members) : [];
            row.updated_at = new Date();
            return Promise.resolve({ rows: [row] });
        }
        if (s.startsWith('DELETE FROM') && s.includes('scim_groups')) {
            const [tenant_id, id] = params;
            const before = groups.length;
            for (let i = groups.length - 1; i >= 0; i--) {
                if (groups[i].tenant_id === tenant_id && groups[i].id === id) groups.splice(i, 1);
            }
            return Promise.resolve({ rowCount: before - groups.length });
        }

        throw new Error(`mock pool: unhandled query: ${s}`);
    }

    return { query, _users: users, _groups: groups, _queries: queries };
}

// ── Users ────────────────────────────────────────────────────────────────
describe('PgScimStorage users', () => {
    it('creates and reads back a user', async () => {
        const pool = createMockPool();
        const store = new PgScimStorage(pool);
        const created = await store.createUser('tenant-1', {
            userName: 'alice',
            displayName: 'Alice',
            active: true,
            emails: [{ value: 'a@x.co', primary: true }],
            name: { givenName: 'Alice' },
            externalId: 'ext-1',
        });
        assert.equal(created.userName, 'alice');
        assert.equal(created.externalId, 'ext-1');

        const again = await store.getUser('tenant-1', created.id);
        assert.equal(again.userName, 'alice');
        assert.deepEqual(again.emails, [{ value: 'a@x.co', primary: true }]);
    });

    it('scopes reads by tenantId (no cross-tenant reads)', async () => {
        const pool = createMockPool();
        const store = new PgScimStorage(pool);
        const a = await store.createUser('tenant-a', { userName: 'a' });
        await store.createUser('tenant-b', { userName: 'b' });

        const hit = await store.getUser('tenant-a', a.id);
        assert.ok(hit);
        const miss = await store.getUser('tenant-b', a.id);
        assert.equal(miss, null);
    });

    it('findUserByExternalId returns null for missing external id', async () => {
        const pool = createMockPool();
        const store = new PgScimStorage(pool);
        const r = await store.findUserByExternalId('tenant-1', null);
        assert.equal(r, null);
        const r2 = await store.findUserByExternalId('tenant-1', 'nope');
        assert.equal(r2, null);
    });

    it('listUsers paginates via start/count', async () => {
        const pool = createMockPool();
        const store = new PgScimStorage(pool);
        for (let i = 0; i < 5; i++) {
            await store.createUser('t', { userName: `u${i}` });
        }
        const page1 = await store.listUsers('t', { start: 1, count: 2 });
        assert.equal(page1.total, 5);
        assert.equal(page1.items.length, 2);
        const page2 = await store.listUsers('t', { start: 3, count: 2 });
        assert.equal(page2.items.length, 2);
    });

    it('replaceUser updates fields in place', async () => {
        const pool = createMockPool();
        const store = new PgScimStorage(pool);
        const u = await store.createUser('t', { userName: 'a' });
        const updated = await store.replaceUser('t', u.id, {
            userName: 'a',
            displayName: 'A new name',
            active: false,
        });
        assert.equal(updated.displayName, 'A new name');
        assert.equal(updated.active, false);
    });

    it('patchUser applies replace ops by last path segment', async () => {
        const pool = createMockPool();
        const store = new PgScimStorage(pool);
        const u = await store.createUser('t', { userName: 'a', active: true });
        const patched = await store.patchUser('t', u.id, [
            { op: 'replace', path: 'active', value: false },
        ]);
        assert.equal(patched.active, false);
    });

    it('patchUser merges path-less value object', async () => {
        const pool = createMockPool();
        const store = new PgScimStorage(pool);
        const u = await store.createUser('t', { userName: 'a' });
        const patched = await store.patchUser('t', u.id, [
            { op: 'replace', value: { displayName: 'merged' } },
        ]);
        assert.equal(patched.displayName, 'merged');
    });

    it('deleteUser returns false when the user does not exist', async () => {
        const pool = createMockPool();
        const store = new PgScimStorage(pool);
        const ok = await store.deleteUser('t', 'no-such-id');
        assert.equal(ok, false);
    });

    it('deleteUser does not delete across tenants', async () => {
        const pool = createMockPool();
        const store = new PgScimStorage(pool);
        const u = await store.createUser('tenant-a', { userName: 'a' });
        const wrong = await store.deleteUser('tenant-b', u.id);
        assert.equal(wrong, false);
        const still = await store.getUser('tenant-a', u.id);
        assert.ok(still);
    });
});

// ── Groups ───────────────────────────────────────────────────────────────
describe('PgScimStorage groups', () => {
    it('creates and reads a group with members', async () => {
        const pool = createMockPool();
        const store = new PgScimStorage(pool);
        const g = await store.createGroup('t', {
            displayName: 'admins',
            members: [{ value: 'user-1' }],
        });
        assert.equal(g.displayName, 'admins');
        assert.equal(g.members.length, 1);
    });

    it('replaceGroup overwrites members', async () => {
        const pool = createMockPool();
        const store = new PgScimStorage(pool);
        const g = await store.createGroup('t', { displayName: 'g', members: [{ value: 'u1' }] });
        const r = await store.replaceGroup('t', g.id, {
            displayName: 'g',
            members: [{ value: 'u2' }, { value: 'u3' }],
        });
        assert.equal(r.members.length, 2);
    });

    it('patchGroup updates displayName via replace op', async () => {
        const pool = createMockPool();
        const store = new PgScimStorage(pool);
        const g = await store.createGroup('t', { displayName: 'old' });
        const p = await store.patchGroup('t', g.id, [
            { op: 'replace', path: 'displayName', value: 'new' },
        ]);
        assert.equal(p.displayName, 'new');
    });

    it('listGroups paginates', async () => {
        const pool = createMockPool();
        const store = new PgScimStorage(pool);
        for (let i = 0; i < 4; i++) await store.createGroup('t', { displayName: `g${i}` });
        const page = await store.listGroups('t', { start: 1, count: 3 });
        assert.equal(page.total, 4);
        assert.equal(page.items.length, 3);
    });

    it('constructor rejects missing pool', () => {
        assert.throws(() => new PgScimStorage(null), /pool is required/);
    });
});
