// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/scimRoutes.js
 * ────────────────────
 * SCIM 2.0 (RFC 7644) Users + Groups endpoints for automated user
 * provisioning from identity providers (Okta, Entra ID, OneLogin, etc.).
 *
 * Auth: a dedicated Bearer token stored in `scim_tokens`. Every SCIM request
 * must authenticate with that token — JWT/session auth is NOT accepted, so
 * the blast radius of a compromised SCIM token is limited to the IdP surface.
 *
 * Mount with:
 *   app.use(prefix, scimRoutes(pool));
 *
 * Endpoints (mounted under /scim/v2):
 *   GET    /scim/v2/Users
 *   GET    /scim/v2/Users/:id
 *   POST   /scim/v2/Users
 *   PATCH  /scim/v2/Users/:id
 *   DELETE /scim/v2/Users/:id
 *   GET    /scim/v2/Groups
 *   POST   /scim/v2/Groups
 *   GET    /scim/v2/ServiceProviderConfig
 */

import crypto from 'node:crypto';
import { Router } from 'express';
import { query } from '../db.js';

const SCIM_USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
const SCIM_GROUP_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:Group';
const LIST_RESP = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
const ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';

export default function scimRoutes(pool) {
    const router = Router();

    router.use(async (req, res, next) => {
        // This router is mounted at the app root (see server.js) so it sees
        // every request in the app. Only enforce SCIM bearer-token auth on
        // actual SCIM endpoints — otherwise EVERY /api/* call would get a
        // "missing bearer token" 401 with a SCIM error schema, which is
        // exactly the outage this guard prevents. See history for the bug
        // where `GET /api/health` returned a SCIM 401.
        if (!req.path.startsWith('/scim/')) return next();
        try {
            const header = req.headers.authorization || '';
            const token = header.replace(/^Bearer\s+/i, '').trim();
            if (!token) return scimError(res, 401, 'missing bearer token');
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            const { rows } = await query(
                `SELECT workspace_id, expires_at
                   FROM pgmonitoringtool.scim_tokens
                  WHERE token_hash = $1
                    AND revoked_at IS NULL
                    AND (expires_at IS NULL OR expires_at > now())
                  LIMIT 1`,
                [tokenHash]
            );
            if (!rows[0]) return scimError(res, 401, 'invalid or expired SCIM token');
            req.workspaceId = rows[0].workspace_id;
            await query(
                `UPDATE pgmonitoringtool.scim_tokens
                    SET last_used_at = now() WHERE token_hash = $1`,
                [tokenHash]
            );
            next();
        } catch (err) { next(err); }
    });

    // ── Discovery ────────────────────────────────────────────────────────────
    router.get('/scim/v2/ServiceProviderConfig', (_req, res) => {
        res.json({
            schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
            documentationUri: 'https://docs.pulsedb.dev/scim',
            patch:            { supported: true },
            bulk:             { supported: false },
            filter:           { supported: true, maxResults: 200 },
            changePassword:   { supported: false },
            sort:             { supported: false },
            etag:             { supported: false },
            authenticationSchemes: [
                { name: 'OAuth Bearer Token', type: 'oauthbearertoken', primary: true },
            ],
        });
    });

    // ── Users ────────────────────────────────────────────────────────────────
    router.get('/scim/v2/Users', async (req, res, next) => {
        try {
            const count = Math.min(Number(req.query.count) || 100, 200);
            const startIndex = Math.max(Number(req.query.startIndex) || 1, 1);
            const filter = String(req.query.filter || '');
            const emailMatch = /userName eq "([^"]+)"/.exec(filter);
            const params = [req.workspaceId];
            let where = 'wm.workspace_id = $1';
            if (emailMatch) {
                params.push(emailMatch[1]);
                where += ` AND lower(u.email) = lower($${params.length})`;
            }
            params.push(count, startIndex - 1);
            const { rows } = await query(
                `SELECT u.id, u.email, u.username, u.status, wm.role, u.created_at
                   FROM pgmonitoringtool.workspace_members wm
                   JOIN pgmonitoringtool.users u ON u.id = wm.user_id
                  WHERE ${where}
                  ORDER BY u.id
                  LIMIT $${params.length - 1} OFFSET $${params.length}`,
                params
            );
            res.json({
                schemas: [LIST_RESP],
                totalResults: rows.length,
                startIndex,
                itemsPerPage: rows.length,
                Resources: rows.map(toScimUser),
            });
        } catch (err) { next(err); }
    });

    router.get('/scim/v2/Users/:id', async (req, res, next) => {
        try {
            const user = await findUserInWorkspace(req.workspaceId, req.params.id);
            if (!user) return scimError(res, 404, 'user not found');
            res.json(toScimUser(user));
        } catch (err) { next(err); }
    });

    router.post('/scim/v2/Users', async (req, res, next) => {
        try {
            const email = req.body.userName || req.body.emails?.[0]?.value;
            if (!email) return scimError(res, 400, 'userName is required');
            const active = req.body.active !== false;

            // CRIT-1 fix: the SCIM token is scoped to req.workspaceId. Never
            // let a token for workspace A mutate a users row that does not
            // belong (through workspace_members) to that workspace.
            //   1. INSERT-if-missing — no ON CONFLICT UPDATE so a cross-tenant
            //      email cannot have its status/username rewritten.
            //   2. Select the row back out when conflict hit.
            //   3. Add the caller's workspace membership.
            //   4. Only update status after the user is a member of this
            //      workspace, and constrain the UPDATE by workspace_members.
            const passwordHash = crypto.randomBytes(32).toString('hex');
            let user;
            // LOW-8: track whether this request actually created a new users
            // row vs. re-attached an existing user to a new workspace. RFC 7644
            // §3.3 says "If the service provider determines that the creation
            // of the requested resource conflicts with existing resources …
            // the service provider MAY return a 200 OK with the existing
            // resource." — some IdPs (Okta) treat a 201 for a pre-existing
            // user as a duplicate-provisioning warning, so returning 200 when
            // the users row already existed is the more conservative choice.
            let createdNew = false;
            {
                const ins = await query(
                    `INSERT INTO pgmonitoringtool.users
                        (username, email, password_hash, role, status, created_at)
                     VALUES ($1,$2,$3,'viewer',$4, now())
                     ON CONFLICT (email) DO NOTHING
                     RETURNING id, email, username, status, created_at`,
                    [email, email, passwordHash, active ? 'active' : 'suspended']
                );
                if (ins.rows[0]) {
                    user = ins.rows[0];
                    createdNew = true;
                } else {
                    const sel = await query(
                        `SELECT id, email, username, status, created_at
                           FROM pgmonitoringtool.users WHERE email = $1 LIMIT 1`,
                        [email]
                    );
                    user = sel.rows[0];
                    if (!user) return scimError(res, 500, 'user upsert failed');
                }
            }

            // CRIT-1 HARDENING (escalation path closed by the regression
            // test in scimCrossTenant.test.js): if a users row already exists
            // and is NOT already a member of the caller's workspace, a SCIM
            // token must NOT silently auto-link it. Doing so would allow a
            // workspace-A SCIM token to re-parent a victim user from
            // workspace B into workspace A and then mutate the GLOBAL
            // `status` column, effectively suspending them everywhere.
            //
            // For new (just-inserted) users and for re-issuing a PUT-like
            // SCIM create against a user already in this workspace, the
            // flow below is fine. For the cross-tenant case we return 409
            // Conflict — consistent with RFC 7644 §3.3's "resource already
            // exists" semantics — and require an explicit admin action to
            // add the user to another workspace.
            if (!createdNew) {
                const member = await query(
                    `SELECT 1 FROM pgmonitoringtool.workspace_members
                      WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
                    [req.workspaceId, user.id]
                );
                if (!member.rows[0]) {
                    return scimError(res, 409,
                        'user with this userName already exists in another workspace; ' +
                        'cross-workspace linking must be performed by an administrator');
                }
            }

            await query(
                `INSERT INTO pgmonitoringtool.workspace_members
                    (workspace_id, user_id, role)
                 VALUES ($1,$2,'viewer')
                 ON CONFLICT (workspace_id, user_id) DO NOTHING`,
                [req.workspaceId, user.id]
            );

            const desired = active ? 'active' : 'suspended';
            if (user.status !== desired) {
                const upd = await query(
                    `UPDATE pgmonitoringtool.users u
                        SET status = $2
                       FROM pgmonitoringtool.workspace_members wm
                      WHERE u.id = $1
                        AND wm.user_id = u.id
                        AND wm.workspace_id = $3
                      RETURNING u.id, u.email, u.username, u.status, u.created_at`,
                    [user.id, desired, req.workspaceId]
                );
                if (upd.rows[0]) user = upd.rows[0];
            }

            res.status(createdNew ? 201 : 200).json(toScimUser({ ...user, role: 'viewer' }));
        } catch (err) { next(err); }
    });

    router.patch('/scim/v2/Users/:id', async (req, res, next) => {
        try {
            // CRIT-2 fix: return 404 BEFORE any UPDATE if the target user is
            // not a member of the caller's workspace.
            const existing = await findUserInWorkspace(req.workspaceId, req.params.id);
            if (!existing) return scimError(res, 404, 'user not found');

            const ops = req.body.Operations || [];
            let active;
            for (const op of ops) {
                if (op.op?.toLowerCase() === 'replace' && op.path === 'active') {
                    active = !!op.value;
                }
                if (op.op?.toLowerCase() === 'replace' && op.value && typeof op.value === 'object') {
                    if ('active' in op.value) active = !!op.value.active;
                }
            }
            if (active !== undefined) {
                // Belt-and-braces: constrain UPDATE through workspace_members
                // join so a compromised SCIM token cannot fan out globally.
                await query(
                    `UPDATE pgmonitoringtool.users u
                        SET status = $2
                       FROM pgmonitoringtool.workspace_members wm
                      WHERE u.id = $1
                        AND wm.user_id = u.id
                        AND wm.workspace_id = $3`,
                    [Number(req.params.id), active ? 'active' : 'suspended', req.workspaceId]
                );
            }
            const user = await findUserInWorkspace(req.workspaceId, req.params.id);
            if (!user) return scimError(res, 404, 'user not found');
            res.json(toScimUser(user));
        } catch (err) { next(err); }
    });

    router.delete('/scim/v2/Users/:id', async (req, res, next) => {
        try {
            await query(
                `DELETE FROM pgmonitoringtool.workspace_members
                  WHERE workspace_id = $1 AND user_id = $2`,
                [req.workspaceId, Number(req.params.id)]
            );
            res.status(204).end();
        } catch (err) { next(err); }
    });

    // ── Groups (minimal — role-as-group model) ───────────────────────────────
    router.get('/scim/v2/Groups', async (req, res) => {
        const groups = ['owner', 'admin', 'editor', 'viewer'].map(role => ({
            id: role,
            schemas: [SCIM_GROUP_SCHEMA],
            displayName: `pulsedb-${role}`,
        }));
        res.json({
            schemas: [LIST_RESP],
            totalResults: groups.length,
            Resources: groups,
        });
    });

    return router;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
async function findUserInWorkspace(workspaceId, userId) {
    const { rows } = await query(
        `SELECT u.id, u.email, u.username, u.status, wm.role, u.created_at
           FROM pgmonitoringtool.workspace_members wm
           JOIN pgmonitoringtool.users u ON u.id = wm.user_id
          WHERE wm.workspace_id = $1 AND u.id = $2`,
        [workspaceId, Number(userId)]
    );
    return rows[0] || null;
}

function toScimUser(u) {
    return {
        schemas: [SCIM_USER_SCHEMA],
        id: String(u.id),
        userName: u.email,
        displayName: u.username || u.email,
        emails: [{ primary: true, value: u.email, type: 'work' }],
        active: u.status !== 'suspended',
        meta: {
            resourceType: 'User',
            created: u.created_at,
        },
    };
}

function scimError(res, status, detail) {
    res.status(status).json({
        schemas: [ERROR_SCHEMA],
        status: String(status),
        detail,
    });
}
