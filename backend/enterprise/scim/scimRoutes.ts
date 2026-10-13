// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * scimRoutes.js
 * ──────────────
 * HTTP surface for SCIM 2.0.
 *
 * Mount:
 *   app.use('/scim/v2', createScimRouter({ scimService, authenticate }));
 *
 * `authenticate` is a middleware that validates the tenant bearer token and
 * attaches req.tenantId. We keep it injectable so tests can pass a trivial
 * stub; in production, wire it to your existing auth middleware.
 *
 * Error handling: every route catches and converts to the SCIM error shape
 * (Error schema per RFC 7644 §3.12) rather than the default Express 500.
 */

import express from 'express';
import { ScimError, ScimFilterError } from './scimService.js';

const SCIM_CONTENT_TYPE = 'application/scim+json';

function sendScim(res, status, body) {
    res.status(status).type(SCIM_CONTENT_TYPE).send(JSON.stringify(body));
}

function errorHandler(res, err) {
    if (err instanceof ScimError || err instanceof ScimFilterError) {
        const status = err.status || 400;
        const body = {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
            status: String(status),
            detail: err.message,
        };
        if (err.scimType) body.scimType = err.scimType;
        return sendScim(res, status, body);
    }
    sendScim(res, 500, {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '500',
        detail: err?.message || 'internal error',
    });
}

export function createScimRouter({ scimService, authenticate }) {
    if (!scimService) throw new Error('createScimRouter: scimService is required');
    const auth = authenticate || ((req, _res, next) => {
        // Default no-op so the router is runnable; production MUST inject real auth.
        if (!req.tenantId) req.tenantId = 'default';
        next();
    });

    const router = express.Router();
    router.use(auth);
    router.use(express.json({ type: ['application/json', 'application/scim+json'], limit: '1mb' }));

    // ── Discovery endpoints (RFC 7644 §4) ─────────────────────────────────
    router.get('/ServiceProviderConfig', (_req, res) => sendScim(res, 200, scimService.serviceProviderConfig()));
    router.get('/ResourceTypes',          (_req, res) => sendScim(res, 200, scimService.resourceTypes()));
    router.get('/Schemas',                (_req, res) => sendScim(res, 200, scimService.schemas()));

    // ── Users ─────────────────────────────────────────────────────────────
    router.get('/Users', async (req, res) => {
        try {
            const out = await scimService.listUsers({
                tenantId: req.tenantId,
                filter: req.query.filter,
                startIndex: Number(req.query.startIndex),
                count: Number(req.query.count),
            });
            sendScim(res, 200, out);
        } catch (err) { errorHandler(res, err); }
    });

    router.get('/Users/:id', async (req, res) => {
        try {
            const user = await scimService.getUser(req.tenantId, req.params.id);
            if (!user) return errorHandler(res, new ScimError('user not found', { status: 404 }));
            sendScim(res, 200, user);
        } catch (err) { errorHandler(res, err); }
    });

    router.post('/Users', async (req, res) => {
        try {
            const user = await scimService.createUser(req.tenantId, req.body || {});
            res.setHeader('Location', user.meta?.location || '');
            sendScim(res, 201, user);
        } catch (err) { errorHandler(res, err); }
    });

    router.put('/Users/:id', async (req, res) => {
        try {
            const user = await scimService.replaceUser(req.tenantId, req.params.id, req.body || {});
            sendScim(res, 200, user);
        } catch (err) { errorHandler(res, err); }
    });

    router.patch('/Users/:id', async (req, res) => {
        try {
            const user = await scimService.patchUser(req.tenantId, req.params.id, req.body || {});
            sendScim(res, 200, user);
        } catch (err) { errorHandler(res, err); }
    });

    router.delete('/Users/:id', async (req, res) => {
        try {
            await scimService.deleteUser(req.tenantId, req.params.id);
            res.status(204).end();
        } catch (err) { errorHandler(res, err); }
    });

    // ── Groups ────────────────────────────────────────────────────────────
    router.get('/Groups', async (req, res) => {
        try {
            const out = await scimService.listGroups({
                tenantId: req.tenantId,
                filter: req.query.filter,
                startIndex: Number(req.query.startIndex),
                count: Number(req.query.count),
            });
            sendScim(res, 200, out);
        } catch (err) { errorHandler(res, err); }
    });

    router.get('/Groups/:id', async (req, res) => {
        try {
            const g = await scimService.getGroup(req.tenantId, req.params.id);
            if (!g) return errorHandler(res, new ScimError('group not found', { status: 404 }));
            sendScim(res, 200, g);
        } catch (err) { errorHandler(res, err); }
    });

    router.post('/Groups', async (req, res) => {
        try {
            const g = await scimService.createGroup(req.tenantId, req.body || {});
            res.setHeader('Location', g.meta?.location || '');
            sendScim(res, 201, g);
        } catch (err) { errorHandler(res, err); }
    });

    router.put('/Groups/:id', async (req, res) => {
        try {
            const g = await scimService.replaceGroup(req.tenantId, req.params.id, req.body || {});
            sendScim(res, 200, g);
        } catch (err) { errorHandler(res, err); }
    });

    router.patch('/Groups/:id', async (req, res) => {
        try {
            const g = await scimService.patchGroup(req.tenantId, req.params.id, req.body || {});
            sendScim(res, 200, g);
        } catch (err) { errorHandler(res, err); }
    });

    router.delete('/Groups/:id', async (req, res) => {
        try {
            await scimService.deleteGroup(req.tenantId, req.params.id);
            res.status(204).end();
        } catch (err) { errorHandler(res, err); }
    });

    return router;
}

/**
 * Trivial reference storage: in-memory Map-backed. Useful for tests and for
 * teams that want to wire SCIM against an external directory they'll back-fill.
 * Production code should implement the storage interface against the actual
 * users + organization tables.
 */
export class InMemoryScimStorage {
    constructor() {
        this.users = new Map();  // key: tenantId + ':' + id
        this.groups = new Map();
        this._id = 0;
    }
    _key(t, id) { return `${t}:${id}`; }
    _newId() { this._id += 1; return String(this._id); }
    _all(tenantId, map) {
        const prefix = `${tenantId}:`;
        const out = [];
        for (const [k, v] of map) if (k.startsWith(prefix)) out.push(v);
        return out;
    }
    _paginate(items, start, count) {
        const sliced = items.slice(start - 1, start - 1 + count);
        return { total: items.length, items: sliced };
    }

    async listUsers(tenantId, { start, count }) { return this._paginate(this._all(tenantId, this.users), start, count); }
    async getUser(tenantId, id) { return this.users.get(this._key(tenantId, id)) || null; }
    async findUserByExternalId(tenantId, extId) {
        if (!extId) return null;
        return this._all(tenantId, this.users).find((u) => u.externalId === extId) || null;
    }
    async createUser(tenantId, payload) {
        const now = new Date().toISOString();
        const user = { id: this._newId(), createdAt: now, updatedAt: now, ...payload };
        this.users.set(this._key(tenantId, user.id), user);
        return user;
    }
    async replaceUser(tenantId, id, payload) {
        const k = this._key(tenantId, id);
        const prev = this.users.get(k);
        if (!prev) return null;
        const next = { ...prev, ...payload, id, updatedAt: new Date().toISOString() };
        this.users.set(k, next);
        return next;
    }
    async patchUser(tenantId, id, ops) {
        const k = this._key(tenantId, id);
        const prev = this.users.get(k);
        if (!prev) return null;
        const next = { ...prev };
        for (const op of ops) {
            const opName = String(op.op).toLowerCase();
            if (opName === 'replace' || opName === 'add') {
                // Support either path-less body object or simple path+value
                if (op.path && typeof op.value !== 'undefined') {
                    const key = String(op.path).split('.').slice(-1)[0];
                    next[key] = op.value;
                } else if (op.value && typeof op.value === 'object') {
                    Object.assign(next, op.value);
                }
            } else if (opName === 'remove' && op.path) {
                const key = String(op.path).split('.').slice(-1)[0];
                delete next[key];
            }
        }
        next.updatedAt = new Date().toISOString();
        this.users.set(k, next);
        return next;
    }
    async deleteUser(tenantId, id) { return this.users.delete(this._key(tenantId, id)); }

    async listGroups(tenantId, { start, count }) { return this._paginate(this._all(tenantId, this.groups), start, count); }
    async getGroup(tenantId, id) { return this.groups.get(this._key(tenantId, id)) || null; }
    async createGroup(tenantId, payload) {
        const now = new Date().toISOString();
        const g = { id: this._newId(), createdAt: now, updatedAt: now, ...payload };
        this.groups.set(this._key(tenantId, g.id), g);
        return g;
    }
    async replaceGroup(tenantId, id, payload) {
        const k = this._key(tenantId, id);
        const prev = this.groups.get(k);
        if (!prev) return null;
        const next = { ...prev, ...payload, id, updatedAt: new Date().toISOString() };
        this.groups.set(k, next);
        return next;
    }
    async patchGroup(tenantId, id, ops) {
        const k = this._key(tenantId, id);
        const prev = this.groups.get(k);
        if (!prev) return null;
        const next = { ...prev };
        for (const op of ops) {
            const opName = String(op.op).toLowerCase();
            if (opName === 'replace' || opName === 'add') {
                if (op.path && typeof op.value !== 'undefined') {
                    const key = String(op.path).split('.').slice(-1)[0];
                    next[key] = op.value;
                } else if (op.value && typeof op.value === 'object') {
                    Object.assign(next, op.value);
                }
            } else if (opName === 'remove' && op.path) {
                const key = String(op.path).split('.').slice(-1)[0];
                delete next[key];
            }
        }
        next.updatedAt = new Date().toISOString();
        this.groups.set(k, next);
        return next;
    }
    async deleteGroup(tenantId, id) { return this.groups.delete(this._key(tenantId, id)); }
}

export default createScimRouter;
