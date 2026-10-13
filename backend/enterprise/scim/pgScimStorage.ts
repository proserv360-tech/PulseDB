// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * scim/pgScimStorage.js
 * ──────────────────────
 * Postgres-backed implementation of the SCIM storage interface.
 *
 * Matches the duck-typed interface consumed by ScimService (see scimService.js):
 *
 *   listUsers(tenantId, { start, count })
 *   getUser(tenantId, id)
 *   findUserByExternalId(tenantId, externalId)
 *   createUser(tenantId, payload)
 *   replaceUser(tenantId, id, payload)
 *   patchUser(tenantId, id, patchOps)
 *   deleteUser(tenantId, id)
 *   listGroups(...) / getGroup / createGroup / replaceGroup / patchGroup / deleteGroup
 *
 * Storage shape: two tables under the pgmonitoringtool schema, one for users
 * and one for groups, each scoped by tenant_id. JSON fields (name, emails,
 * members) are stored as JSONB so we can retain the SCIM-rich shape without
 * flattening into dozens of columns.
 *
 * Notes on design:
 *  • Every statement takes tenant_id in the WHERE clause. Cross-tenant reads
 *    are not reachable through this class.
 *  • UUIDs are used as ids so external IdPs can cache them without risk of
 *    serial collisions during tenant migration.
 *  • updated_at is touched on every write; it becomes the SCIM meta.lastModified.
 */

import { randomUUID } from 'node:crypto';

const S = 'pgmonitoringtool';

// ── DDL ──────────────────────────────────────────────────────────────────
export const SCIM_DDL = `
CREATE TABLE IF NOT EXISTS ${S}.scim_users (
    tenant_id     TEXT        NOT NULL,
    id            UUID        NOT NULL,
    external_id   TEXT,
    user_name     TEXT        NOT NULL,
    display_name  TEXT,
    active        BOOLEAN     NOT NULL DEFAULT TRUE,
    name          JSONB,
    emails        JSONB       NOT NULL DEFAULT '[]'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS scim_users_tenant_external_idx
    ON ${S}.scim_users (tenant_id, external_id)
    WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS scim_users_tenant_username_idx
    ON ${S}.scim_users (tenant_id, lower(user_name));

CREATE TABLE IF NOT EXISTS ${S}.scim_groups (
    tenant_id     TEXT        NOT NULL,
    id            UUID        NOT NULL,
    external_id   TEXT,
    display_name  TEXT        NOT NULL,
    members       JSONB       NOT NULL DEFAULT '[]'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS scim_groups_tenant_external_idx
    ON ${S}.scim_groups (tenant_id, external_id)
    WHERE external_id IS NOT NULL;
`;

// ── Helpers ──────────────────────────────────────────────────────────────
function rowToUser(r) {
    if (!r) return null;
    return {
        id: r.id,
        externalId: r.external_id || undefined,
        userName: r.user_name,
        displayName: r.display_name || undefined,
        active: r.active,
        name: r.name || null,
        emails: r.emails || [],
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}

function rowToGroup(r) {
    if (!r) return null;
    return {
        id: r.id,
        externalId: r.external_id || undefined,
        displayName: r.display_name,
        members: r.members || [],
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}

function applyPatchToUser(current, ops) {
    const next = { ...current };
    for (const op of ops) {
        const opName = String(op.op || '').toLowerCase();
        if ((opName === 'replace' || opName === 'add')) {
            if (op.path && typeof op.value !== 'undefined') {
                const key = String(op.path).split('.').slice(-1)[0];
                next[key] = op.value;
            } else if (op.value && typeof op.value === 'object') {
                Object.assign(next, op.value);
            }
        } else if (opName === 'remove' && op.path) {
            const key = String(op.path).split('.').slice(-1)[0];
            next[key] = null;
        }
    }
    return next;
}

// ── Class ────────────────────────────────────────────────────────────────
export class PgScimStorage {
    /**
     * @param {import('pg').Pool} pool
     */
    constructor(pool) {
        if (!pool) throw new Error('PgScimStorage: pool is required');
        this.pool = pool;
    }

    // ── Users ────────────────────────────────────────────────────────────
    async listUsers(tenantId, { start = 1, count = 20 } = {}) {
        const offset = Math.max(0, start - 1);
        const { rows: totals } = await this.pool.query(
            `SELECT COUNT(*)::int AS n FROM ${S}.scim_users WHERE tenant_id = $1`,
            [tenantId],
        );
        const { rows } = await this.pool.query(
            `SELECT * FROM ${S}.scim_users
              WHERE tenant_id = $1
              ORDER BY created_at
              LIMIT $2 OFFSET $3`,
            [tenantId, count, offset],
        );
        return { total: totals[0].n, items: rows.map(rowToUser) };
    }

    async getUser(tenantId, id) {
        const { rows } = await this.pool.query(
            `SELECT * FROM ${S}.scim_users WHERE tenant_id = $1 AND id = $2`,
            [tenantId, id],
        );
        return rowToUser(rows[0]);
    }

    async findUserByExternalId(tenantId, externalId) {
        if (!externalId) return null;
        const { rows } = await this.pool.query(
            `SELECT * FROM ${S}.scim_users WHERE tenant_id = $1 AND external_id = $2`,
            [tenantId, externalId],
        );
        return rowToUser(rows[0]);
    }

    async createUser(tenantId, payload) {
        const id = randomUUID();
        const { rows } = await this.pool.query(
            `INSERT INTO ${S}.scim_users
                (tenant_id, id, external_id, user_name, display_name, active, name, emails)
             VALUES ($1, $2, $3, $4, $5, COALESCE($6, TRUE), $7::jsonb, COALESCE($8::jsonb, '[]'::jsonb))
             RETURNING *`,
            [
                tenantId, id,
                payload.externalId || null,
                payload.userName,
                payload.displayName || null,
                payload.active,
                payload.name ? JSON.stringify(payload.name) : null,
                payload.emails ? JSON.stringify(payload.emails) : null,
            ],
        );
        return rowToUser(rows[0]);
    }

    async replaceUser(tenantId, id, payload) {
        const { rows } = await this.pool.query(
            `UPDATE ${S}.scim_users
                SET external_id  = $3,
                    user_name    = $4,
                    display_name = $5,
                    active       = COALESCE($6, TRUE),
                    name         = $7::jsonb,
                    emails       = COALESCE($8::jsonb, '[]'::jsonb),
                    updated_at   = now()
              WHERE tenant_id = $1 AND id = $2
              RETURNING *`,
            [
                tenantId, id,
                payload.externalId || null,
                payload.userName,
                payload.displayName || null,
                payload.active,
                payload.name ? JSON.stringify(payload.name) : null,
                payload.emails ? JSON.stringify(payload.emails) : null,
            ],
        );
        return rowToUser(rows[0]);
    }

    async patchUser(tenantId, id, ops) {
        const current = await this.getUser(tenantId, id);
        if (!current) return null;
        const next = applyPatchToUser(current, ops);
        return this.replaceUser(tenantId, id, next);
    }

    async deleteUser(tenantId, id) {
        const { rowCount } = await this.pool.query(
            `DELETE FROM ${S}.scim_users WHERE tenant_id = $1 AND id = $2`,
            [tenantId, id],
        );
        return rowCount > 0;
    }

    // ── Groups ───────────────────────────────────────────────────────────
    async listGroups(tenantId, { start = 1, count = 20 } = {}) {
        const offset = Math.max(0, start - 1);
        const { rows: totals } = await this.pool.query(
            `SELECT COUNT(*)::int AS n FROM ${S}.scim_groups WHERE tenant_id = $1`,
            [tenantId],
        );
        const { rows } = await this.pool.query(
            `SELECT * FROM ${S}.scim_groups
              WHERE tenant_id = $1
              ORDER BY created_at
              LIMIT $2 OFFSET $3`,
            [tenantId, count, offset],
        );
        return { total: totals[0].n, items: rows.map(rowToGroup) };
    }

    async getGroup(tenantId, id) {
        const { rows } = await this.pool.query(
            `SELECT * FROM ${S}.scim_groups WHERE tenant_id = $1 AND id = $2`,
            [tenantId, id],
        );
        return rowToGroup(rows[0]);
    }

    async createGroup(tenantId, payload) {
        const id = randomUUID();
        const { rows } = await this.pool.query(
            `INSERT INTO ${S}.scim_groups
                (tenant_id, id, external_id, display_name, members)
             VALUES ($1, $2, $3, $4, COALESCE($5::jsonb, '[]'::jsonb))
             RETURNING *`,
            [
                tenantId, id,
                payload.externalId || null,
                payload.displayName,
                payload.members ? JSON.stringify(payload.members) : null,
            ],
        );
        return rowToGroup(rows[0]);
    }

    async replaceGroup(tenantId, id, payload) {
        const { rows } = await this.pool.query(
            `UPDATE ${S}.scim_groups
                SET external_id  = $3,
                    display_name = $4,
                    members      = COALESCE($5::jsonb, '[]'::jsonb),
                    updated_at   = now()
              WHERE tenant_id = $1 AND id = $2
              RETURNING *`,
            [
                tenantId, id,
                payload.externalId || null,
                payload.displayName,
                payload.members ? JSON.stringify(payload.members) : null,
            ],
        );
        return rowToGroup(rows[0]);
    }

    async patchGroup(tenantId, id, ops) {
        const current = await this.getGroup(tenantId, id);
        if (!current) return null;
        const next = { ...current };
        for (const op of ops) {
            const opName = String(op.op || '').toLowerCase();
            if (opName === 'replace' || opName === 'add') {
                if (op.path && typeof op.value !== 'undefined') {
                    const key = String(op.path).split('.').slice(-1)[0];
                    next[key] = op.value;
                } else if (op.value && typeof op.value === 'object') {
                    Object.assign(next, op.value);
                }
            } else if (opName === 'remove' && op.path) {
                const key = String(op.path).split('.').slice(-1)[0];
                next[key] = null;
            }
        }
        return this.replaceGroup(tenantId, id, next);
    }

    async deleteGroup(tenantId, id) {
        const { rowCount } = await this.pool.query(
            `DELETE FROM ${S}.scim_groups WHERE tenant_id = $1 AND id = $2`,
            [tenantId, id],
        );
        return rowCount > 0;
    }
}

export default PgScimStorage;
