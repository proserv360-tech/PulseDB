// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * scimService.js
 * ───────────────
 * Pure, storage-agnostic service layer for SCIM 2.0 operations.
 *
 * The ScimService takes a storage backend (an object with Promise-returning
 * CRUD methods) and exposes the SCIM operations needed by the HTTP router.
 * This lets the router be thin and lets us unit-test the service with an
 * in-memory fake.
 *
 * Storage interface (users):
 *   listUsers(tenantId, { start, count })  → Promise<{ total, items }>
 *   getUser(tenantId, id)                  → Promise<User|null>
 *   findUserByExternalId(tenantId, extId)  → Promise<User|null>
 *   createUser(tenantId, user)             → Promise<User>
 *   replaceUser(tenantId, id, user)        → Promise<User|null>
 *   patchUser(tenantId, id, patchOps)      → Promise<User|null>
 *   deleteUser(tenantId, id)               → Promise<boolean>
 *
 * Groups (analogous):
 *   listGroups, getGroup, createGroup, replaceGroup, patchGroup, deleteGroup
 *
 * Users are stored as SCIM Core Schema 2.0 users (RFC 7643).
 * IDs are opaque strings; implementations commonly use UUIDs.
 */

import { parseFilter, evaluateFilter, ScimFilterError } from './scimFilterParser.js';

const ALLOWED_USER_ATTRS = new Set([
    'id', 'externalId', 'userName', 'displayName', 'active',
    'name.givenName', 'name.familyName',
    'emails.value',
]);

const ALLOWED_GROUP_ATTRS = new Set([
    'id', 'externalId', 'displayName',
]);

function toScimUser(raw, { base }) {
    if (!raw) return null;
    return {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        id: raw.id,
        externalId: raw.externalId,
        userName: raw.userName,
        name: raw.name || { givenName: raw.givenName, familyName: raw.familyName },
        displayName: raw.displayName,
        active: raw.active !== false,
        emails: raw.emails || (raw.email ? [{ value: raw.email, primary: true }] : []),
        meta: {
            resourceType: 'User',
            created: raw.createdAt,
            lastModified: raw.updatedAt,
            location: `${base}/Users/${raw.id}`,
            version: raw.version ? `W/"${raw.version}"` : undefined,
        },
    };
}

function toScimGroup(raw, { base }) {
    if (!raw) return null;
    return {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
        id: raw.id,
        externalId: raw.externalId,
        displayName: raw.displayName,
        members: raw.members || [],
        meta: {
            resourceType: 'Group',
            created: raw.createdAt,
            lastModified: raw.updatedAt,
            location: `${base}/Groups/${raw.id}`,
            version: raw.version ? `W/"${raw.version}"` : undefined,
        },
    };
}

export class ScimService {
    constructor({ storage, base = '/scim/v2' } = {}) {
        if (!storage) throw new Error('ScimService: storage is required');
        this.storage = storage;
        this.base = base.replace(/\/$/, '');
    }

    // ── Users ─────────────────────────────────────────────────────────────
    async listUsers({ tenantId, filter, startIndex = 1, count = 20 }) {
        const start = Math.max(1, Number(startIndex) || 1);
        const pageSize = Math.min(Math.max(0, Number(count) || 20), 200);
        const { total, items } = await this.storage.listUsers(tenantId, { start, count: pageSize });
        let rows = items;
        if (filter) {
            const ast = parseFilter(filter, { allowedAttributes: ALLOWED_USER_ATTRS });
            rows = rows.filter((u) => evaluateFilter(ast, u));
        }
        return {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
            totalResults: filter ? rows.length : total,
            startIndex: start,
            itemsPerPage: rows.length,
            Resources: rows.map((r) => toScimUser(r, { base: this.base })),
        };
    }

    async getUser(tenantId, id) {
        const raw = await this.storage.getUser(tenantId, id);
        return toScimUser(raw, { base: this.base });
    }

    async createUser(tenantId, body) {
        this._requireSchema(body, 'urn:ietf:params:scim:schemas:core:2.0:User');
        if (!body.userName) throw new ScimError('userName is required', { status: 400, scimType: 'invalidValue' });

        // Conflict detection.
        const existing = await this.storage.findUserByExternalId?.(tenantId, body.externalId);
        if (existing) throw new ScimError('externalId already exists', { status: 409, scimType: 'uniqueness' });

        const raw = await this.storage.createUser(tenantId, {
            externalId: body.externalId,
            userName: body.userName,
            name: body.name || null,
            displayName: body.displayName || null,
            active: body.active !== false,
            emails: Array.isArray(body.emails) ? body.emails : [],
        });
        return toScimUser(raw, { base: this.base });
    }

    async replaceUser(tenantId, id, body) {
        this._requireSchema(body, 'urn:ietf:params:scim:schemas:core:2.0:User');
        const raw = await this.storage.replaceUser(tenantId, id, {
            externalId: body.externalId,
            userName: body.userName,
            name: body.name || null,
            displayName: body.displayName || null,
            active: body.active !== false,
            emails: Array.isArray(body.emails) ? body.emails : [],
        });
        if (!raw) throw new ScimError('user not found', { status: 404 });
        return toScimUser(raw, { base: this.base });
    }

    async patchUser(tenantId, id, patchBody) {
        this._requireSchema(patchBody, 'urn:ietf:params:scim:api:messages:2.0:PatchOp');
        const ops = Array.isArray(patchBody.Operations) ? patchBody.Operations : [];
        this._validatePatchOps(ops);
        const raw = await this.storage.patchUser(tenantId, id, ops);
        if (!raw) throw new ScimError('user not found', { status: 404 });
        return toScimUser(raw, { base: this.base });
    }

    async deleteUser(tenantId, id) {
        const ok = await this.storage.deleteUser(tenantId, id);
        if (!ok) throw new ScimError('user not found', { status: 404 });
    }

    // ── Groups ────────────────────────────────────────────────────────────
    async listGroups({ tenantId, filter, startIndex = 1, count = 20 }) {
        const start = Math.max(1, Number(startIndex) || 1);
        const pageSize = Math.min(Math.max(0, Number(count) || 20), 200);
        const { total, items } = await this.storage.listGroups(tenantId, { start, count: pageSize });
        let rows = items;
        if (filter) {
            const ast = parseFilter(filter, { allowedAttributes: ALLOWED_GROUP_ATTRS });
            rows = rows.filter((g) => evaluateFilter(ast, g));
        }
        return {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
            totalResults: filter ? rows.length : total,
            startIndex: start,
            itemsPerPage: rows.length,
            Resources: rows.map((r) => toScimGroup(r, { base: this.base })),
        };
    }

    async getGroup(tenantId, id) {
        const raw = await this.storage.getGroup(tenantId, id);
        return toScimGroup(raw, { base: this.base });
    }

    async createGroup(tenantId, body) {
        this._requireSchema(body, 'urn:ietf:params:scim:schemas:core:2.0:Group');
        if (!body.displayName) throw new ScimError('displayName is required', { status: 400, scimType: 'invalidValue' });
        const raw = await this.storage.createGroup(tenantId, {
            externalId: body.externalId,
            displayName: body.displayName,
            members: Array.isArray(body.members) ? body.members : [],
        });
        return toScimGroup(raw, { base: this.base });
    }

    async replaceGroup(tenantId, id, body) {
        this._requireSchema(body, 'urn:ietf:params:scim:schemas:core:2.0:Group');
        const raw = await this.storage.replaceGroup(tenantId, id, {
            externalId: body.externalId,
            displayName: body.displayName,
            members: Array.isArray(body.members) ? body.members : [],
        });
        if (!raw) throw new ScimError('group not found', { status: 404 });
        return toScimGroup(raw, { base: this.base });
    }

    async patchGroup(tenantId, id, patchBody) {
        this._requireSchema(patchBody, 'urn:ietf:params:scim:api:messages:2.0:PatchOp');
        const ops = Array.isArray(patchBody.Operations) ? patchBody.Operations : [];
        this._validatePatchOps(ops);
        const raw = await this.storage.patchGroup(tenantId, id, ops);
        if (!raw) throw new ScimError('group not found', { status: 404 });
        return toScimGroup(raw, { base: this.base });
    }

    async deleteGroup(tenantId, id) {
        const ok = await this.storage.deleteGroup(tenantId, id);
        if (!ok) throw new ScimError('group not found', { status: 404 });
    }

    // ── Discovery ─────────────────────────────────────────────────────────
    serviceProviderConfig() {
        return {
            schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
            documentationUri: 'https://docs.fathom.example.com/scim',
            patch: { supported: true },
            bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
            filter: { supported: true, maxResults: 200 },
            changePassword: { supported: false },
            sort: { supported: false },
            etag: { supported: false },
            authenticationSchemes: [
                { name: 'OAuth Bearer Token', description: 'Bearer token per tenant', type: 'oauthbearertoken' },
            ],
            meta: { resourceType: 'ServiceProviderConfig', location: `${this.base}/ServiceProviderConfig` },
        };
    }

    resourceTypes() {
        return {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
            totalResults: 2,
            Resources: [
                { schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'], id: 'User',  name: 'User',  endpoint: '/Users',  schema: 'urn:ietf:params:scim:schemas:core:2.0:User' },
                { schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'], id: 'Group', name: 'Group', endpoint: '/Groups', schema: 'urn:ietf:params:scim:schemas:core:2.0:Group' },
            ],
        };
    }

    schemas() {
        // Minimal Core Schema surface; Okta / Entra accept this as sufficient.
        return {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
            totalResults: 2,
            Resources: [
                { id: 'urn:ietf:params:scim:schemas:core:2.0:User',  name: 'User',  description: 'User Account' },
                { id: 'urn:ietf:params:scim:schemas:core:2.0:Group', name: 'Group', description: 'Group' },
            ],
        };
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    _requireSchema(body, expected) {
        if (!body || typeof body !== 'object') throw new ScimError('missing body', { status: 400 });
        const schemas = Array.isArray(body.schemas) ? body.schemas : [];
        if (!schemas.includes(expected)) {
            throw new ScimError(`body must include schema ${expected}`, { status: 400, scimType: 'invalidSyntax' });
        }
    }

    _validatePatchOps(ops) {
        for (const op of ops) {
            const name = String(op.op || '').toLowerCase();
            if (name !== 'add' && name !== 'replace' && name !== 'remove') {
                throw new ScimError(`unsupported patch op: ${op.op}`, { status: 400, scimType: 'invalidSyntax' });
            }
        }
    }
}

export class ScimError extends Error {
    constructor(message, { status = 400, scimType = null } = {}) {
        super(message);
        this.status = status;
        this.scimType = scimType;
    }

    toResponseBody() {
        const body = {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
            status: String(this.status),
            detail: this.message,
        };
        if (this.scimType) body.scimType = this.scimType;
        return body;
    }
}

export { ScimFilterError };
export default ScimService;
