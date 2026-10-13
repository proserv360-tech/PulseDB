/**
 * tests/scimService.test.js
 * ──────────────────────────
 * End-to-end tests for ScimService against InMemoryScimStorage.
 *
 * Run: node --test tests/scimService.test.js
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { ScimService, ScimError } from '../enterprise/scim/scimService.js';
import { InMemoryScimStorage } from '../enterprise/scim/scimRoutes.js';

const TENANT = 'acme';

function mkService() {
    return new ScimService({ storage: new InMemoryScimStorage(), base: '/scim/v2' });
}

const USER_BODY = {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    userName: 'alice@example.com',
    externalId: 'ext-alice',
    name: { givenName: 'Alice', familyName: 'Example' },
    displayName: 'Alice Example',
    emails: [{ value: 'alice@example.com', primary: true }],
};

const GROUP_BODY = {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
    displayName: 'Engineers',
    externalId: 'ext-engs',
};

// ── Users ─────────────────────────────────────────────────────────────────
describe('ScimService — Users', () => {
    let svc;
    beforeEach(() => { svc = mkService(); });

    it('createUser returns SCIM-shaped user with meta.location', async () => {
        const u = await svc.createUser(TENANT, USER_BODY);
        assert.ok(u.schemas.includes('urn:ietf:params:scim:schemas:core:2.0:User'));
        assert.equal(u.userName, 'alice@example.com');
        assert.equal(u.meta.resourceType, 'User');
        assert.match(u.meta.location, /\/scim\/v2\/Users\/\d+$/);
    });

    it('createUser rejects missing userName', async () => {
        await assert.rejects(
            svc.createUser(TENANT, { ...USER_BODY, userName: undefined }),
            (e) => e instanceof ScimError && e.status === 400,
        );
    });

    it('createUser rejects a body missing the User schema', async () => {
        await assert.rejects(
            svc.createUser(TENANT, { ...USER_BODY, schemas: [] }),
            (e) => e instanceof ScimError && e.scimType === 'invalidSyntax',
        );
    });

    it('createUser rejects duplicate externalId with 409 uniqueness', async () => {
        await svc.createUser(TENANT, USER_BODY);
        await assert.rejects(
            svc.createUser(TENANT, USER_BODY),
            (e) => e instanceof ScimError && e.status === 409 && e.scimType === 'uniqueness',
        );
    });

    it('getUser returns null for an unknown id', async () => {
        const u = await svc.getUser(TENANT, 'nope');
        assert.equal(u, null);
    });

    it('listUsers returns a ListResponse envelope', async () => {
        await svc.createUser(TENANT, USER_BODY);
        await svc.createUser(TENANT, { ...USER_BODY, userName: 'bob', externalId: 'ext-bob' });
        const list = await svc.listUsers({ tenantId: TENANT });
        assert.ok(list.schemas.includes('urn:ietf:params:scim:api:messages:2.0:ListResponse'));
        assert.equal(list.totalResults, 2);
        assert.equal(list.Resources.length, 2);
    });

    it('listUsers filters by userName eq', async () => {
        await svc.createUser(TENANT, USER_BODY);
        await svc.createUser(TENANT, { ...USER_BODY, userName: 'bob', externalId: 'ext-bob' });
        const list = await svc.listUsers({ tenantId: TENANT, filter: 'userName eq "bob"' });
        assert.equal(list.totalResults, 1);
        assert.equal(list.Resources[0].userName, 'bob');
    });

    it('replaceUser overwrites the entity', async () => {
        const u = await svc.createUser(TENANT, USER_BODY);
        const replaced = await svc.replaceUser(TENANT, u.id, {
            schemas: USER_BODY.schemas,
            userName: 'alice2@example.com',
        });
        assert.equal(replaced.userName, 'alice2@example.com');
    });

    it('replaceUser throws 404 on unknown id', async () => {
        await assert.rejects(
            svc.replaceUser(TENANT, 'nope', USER_BODY),
            (e) => e instanceof ScimError && e.status === 404,
        );
    });

    it('patchUser supports path+value replace', async () => {
        const u = await svc.createUser(TENANT, USER_BODY);
        const patched = await svc.patchUser(TENANT, u.id, {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
            Operations: [{ op: 'replace', path: 'displayName', value: 'Alice Updated' }],
        });
        assert.equal(patched.displayName, 'Alice Updated');
    });

    it('patchUser supports path-less body merge', async () => {
        const u = await svc.createUser(TENANT, USER_BODY);
        const patched = await svc.patchUser(TENANT, u.id, {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
            Operations: [{ op: 'add', value: { displayName: 'From Merge' } }],
        });
        assert.equal(patched.displayName, 'From Merge');
    });

    it('patchUser rejects unsupported op names', async () => {
        const u = await svc.createUser(TENANT, USER_BODY);
        await assert.rejects(
            svc.patchUser(TENANT, u.id, {
                schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
                Operations: [{ op: 'move', path: 'displayName', value: 'X' }],
            }),
            (e) => e instanceof ScimError && e.scimType === 'invalidSyntax',
        );
    });

    it('deleteUser then getUser returns null', async () => {
        const u = await svc.createUser(TENANT, USER_BODY);
        await svc.deleteUser(TENANT, u.id);
        assert.equal(await svc.getUser(TENANT, u.id), null);
    });

    it('deleteUser throws 404 for unknown id', async () => {
        await assert.rejects(
            svc.deleteUser(TENANT, 'nope'),
            (e) => e instanceof ScimError && e.status === 404,
        );
    });
});

// ── Groups ────────────────────────────────────────────────────────────────
describe('ScimService — Groups', () => {
    let svc;
    beforeEach(() => { svc = mkService(); });

    it('createGroup returns SCIM-shaped group', async () => {
        const g = await svc.createGroup(TENANT, GROUP_BODY);
        assert.ok(g.schemas.includes('urn:ietf:params:scim:schemas:core:2.0:Group'));
        assert.equal(g.displayName, 'Engineers');
        assert.equal(g.meta.resourceType, 'Group');
    });

    it('createGroup requires displayName', async () => {
        await assert.rejects(
            svc.createGroup(TENANT, { ...GROUP_BODY, displayName: undefined }),
            (e) => e instanceof ScimError && e.status === 400,
        );
    });

    it('listGroups returns a ListResponse', async () => {
        await svc.createGroup(TENANT, GROUP_BODY);
        const list = await svc.listGroups({ tenantId: TENANT });
        assert.ok(list.schemas.includes('urn:ietf:params:scim:api:messages:2.0:ListResponse'));
        assert.equal(list.totalResults, 1);
    });

    it('patchGroup updates displayName', async () => {
        const g = await svc.createGroup(TENANT, GROUP_BODY);
        const patched = await svc.patchGroup(TENANT, g.id, {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
            Operations: [{ op: 'replace', path: 'displayName', value: 'Platform' }],
        });
        assert.equal(patched.displayName, 'Platform');
    });

    it('deleteGroup removes the group', async () => {
        const g = await svc.createGroup(TENANT, GROUP_BODY);
        await svc.deleteGroup(TENANT, g.id);
        assert.equal(await svc.getGroup(TENANT, g.id), null);
    });
});

// ── Discovery ─────────────────────────────────────────────────────────────
describe('ScimService — discovery', () => {
    const svc = mkService();

    it('serviceProviderConfig reports patch=supported, bulk=unsupported', () => {
        const cfg = svc.serviceProviderConfig();
        assert.equal(cfg.patch.supported, true);
        assert.equal(cfg.bulk.supported, false);
        assert.equal(cfg.filter.supported, true);
    });

    it('resourceTypes lists User and Group', () => {
        const rt = svc.resourceTypes();
        assert.equal(rt.totalResults, 2);
        const ids = rt.Resources.map((r) => r.id);
        assert.deepEqual(ids.sort(), ['Group', 'User']);
    });

    it('schemas lists core:2.0:User and core:2.0:Group', () => {
        const s = svc.schemas();
        assert.equal(s.totalResults, 2);
        const ids = s.Resources.map((r) => r.id);
        assert.ok(ids.includes('urn:ietf:params:scim:schemas:core:2.0:User'));
        assert.ok(ids.includes('urn:ietf:params:scim:schemas:core:2.0:Group'));
    });
});

// ── Tenant isolation ──────────────────────────────────────────────────────
describe('ScimService — tenant isolation', () => {
    it('users created under tenant A are invisible to tenant B', async () => {
        const svc = mkService();
        await svc.createUser('tenantA', USER_BODY);
        const listB = await svc.listUsers({ tenantId: 'tenantB' });
        assert.equal(listB.totalResults, 0);
    });
});

// ── ScimError shape ───────────────────────────────────────────────────────
describe('ScimError', () => {
    it('toResponseBody produces an RFC 7644 Error envelope', () => {
        const err = new ScimError('bad', { status: 400, scimType: 'invalidSyntax' });
        const body = err.toResponseBody();
        assert.deepEqual(body.schemas, ['urn:ietf:params:scim:api:messages:2.0:Error']);
        assert.equal(body.status, '400');
        assert.equal(body.scimType, 'invalidSyntax');
        assert.equal(body.detail, 'bad');
    });
});
