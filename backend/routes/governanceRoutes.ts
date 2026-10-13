// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/governanceRoutes.js
 * ──────────────────────────
 * IP allow-list CRUD, SCIM token management, audit export trigger.
 */

import crypto from 'node:crypto';
import { Router } from 'express';
import { query } from '../db.js';
import { runAuditExport } from '../services/auditExport.js';
import { resolveWorkspace, requireWorkspaceRole } from '../middleware/workspaceRbac.js';
import { writeAudit } from '../services/auditService.js';
import { invalidateIpAllowListCache } from '../middleware/ipAllowList.js';
import { swallowWith } from '../services/errorHandling.js';

export default function governanceRoutes(pool, authenticate) {
    const router = Router();

    // ── IP allow-list ────────────────────────────────────────────────────────
    router.get(
        '/governance/ip-allowlist',
        authenticate, resolveWorkspace,
        async (req, res, next) => {
            try {
                const { rows } = await query(
                    `SELECT id, cidr, label, created_at
                       FROM pgmonitoringtool.ip_allowlist
                      WHERE workspace_id = $1 ORDER BY created_at DESC`,
                    [req.workspace.id]
                );
                res.json({ entries: rows });
            } catch (err) { next(err); }
        }
    );

    router.post(
        '/governance/ip-allowlist',
        authenticate, resolveWorkspace, requireWorkspaceRole('admin'),
        async (req, res, next) => {
            try {
                const { cidr, label = null } = req.body || {};
                if (!cidr) return res.status(400).json({ error: 'cidr required' });
                const { rows } = await query(
                    `INSERT INTO pgmonitoringtool.ip_allowlist
                        (workspace_id, cidr, label, created_by)
                     VALUES ($1,$2,$3,$4) RETURNING id`,
                    [req.workspace.id, cidr, label, req.user?.id]
                );
                invalidateIpAllowListCache(req.workspace.id);
                await writeAudit({
                    actor_id: req.user?.id,
                    action: 'ip_allowlist.add',
                    target: `ws:${req.workspace.id}`,
                    details: { cidr, label },
                }).catch(swallowWith({ component: 'governance', op: 'writeAudit' }));
                res.status(201).json({ id: rows[0].id });
            } catch (err) { next(err); }
        }
    );

    router.delete(
        '/governance/ip-allowlist/:id',
        authenticate, resolveWorkspace, requireWorkspaceRole('admin'),
        async (req, res, next) => {
            try {
                await query(
                    `DELETE FROM pgmonitoringtool.ip_allowlist
                      WHERE id = $1 AND workspace_id = $2`,
                    [Number(req.params.id), req.workspace.id]
                );
                invalidateIpAllowListCache(req.workspace.id);
                await writeAudit({
                    actor_id: req.user?.id,
                    action: 'ip_allowlist.remove',
                    target: `rule:${req.params.id}`,
                }).catch(swallowWith({ component: 'governance', op: 'writeAudit' }));
                res.status(204).end();
            } catch (err) { next(err); }
        }
    );

    // ── SCIM tokens (issue / rotate / revoke) ────────────────────────────────
    //   MED-3 fix: tokens carry an explicit expires_at (default 365 days,
    //   client can request shorter via body.ttlDays). SCIM auth rejects
    //   expired tokens. See scimRoutes.js.
    router.post(
        '/governance/scim-tokens',
        authenticate, resolveWorkspace, requireWorkspaceRole('owner'),
        async (req, res, next) => {
            try {
                const ttlDays = Math.min(Math.max(Number(req.body?.ttlDays) || 365, 1), 3650);
                const token = `pulsedb_scim_${crypto.randomBytes(24).toString('base64url')}`;
                const hash = crypto.createHash('sha256').update(token).digest('hex');
                const prefix = token.slice(0, 16);
                const { rows } = await query(
                    `INSERT INTO pgmonitoringtool.scim_tokens
                        (workspace_id, token_hash, token_prefix, created_by,
                         expires_at)
                     VALUES ($1,$2,$3,$4, now() + ($5 || ' days')::interval)
                     RETURNING id, created_at, expires_at`,
                    [req.workspace.id, hash, prefix, req.user?.id, ttlDays]
                );
                await writeAudit({
                    actor_id: req.user?.id,
                    action: 'scim_token.create',
                    target: `ws:${req.workspace.id}`,
                    details: { ttlDays },
                }).catch(swallowWith({ component: 'governance', op: 'writeAudit' }));
                // Token is returned ONCE — never stored in plaintext.
                res.status(201).json({
                    id: rows[0].id,
                    token,
                    prefix,
                    created_at: rows[0].created_at,
                    expires_at: rows[0].expires_at,
                    warning: 'Store this token now — it will never be shown again.',
                });
            } catch (err) { next(err); }
        }
    );

    router.get(
        '/governance/scim-tokens',
        authenticate, resolveWorkspace, requireWorkspaceRole('admin'),
        async (req, res, next) => {
            try {
                const { rows } = await query(
                    `SELECT id, token_prefix, created_at, last_used_at,
                            revoked_at, expires_at
                       FROM pgmonitoringtool.scim_tokens
                      WHERE workspace_id = $1
                      ORDER BY created_at DESC`,
                    [req.workspace.id]
                );
                res.json({ tokens: rows });
            } catch (err) { next(err); }
        }
    );

    router.delete(
        '/governance/scim-tokens/:id',
        authenticate, resolveWorkspace, requireWorkspaceRole('owner'),
        async (req, res, next) => {
            try {
                await query(
                    `UPDATE pgmonitoringtool.scim_tokens
                        SET revoked_at = now()
                      WHERE id = $1 AND workspace_id = $2`,
                    [Number(req.params.id), req.workspace.id]
                );
                res.status(204).end();
            } catch (err) { next(err); }
        }
    );

    // ── A8: SCIM token rotation ──────────────────────────────────────────────
    // Atomically revoke the old token and mint a new one with the same TTL
    // (defaulting to 365d if the row didn't have one). The new token is
    // returned ONCE in the response body — same contract as the create
    // endpoint above.
    router.post(
        '/governance/scim-tokens/:id/rotate',
        authenticate, resolveWorkspace, requireWorkspaceRole('owner'),
        async (req, res, next) => {
            try {
                const id = Number(req.params.id);
                if (!Number.isInteger(id) || id <= 0) {
                    return res.status(400).json({ error: 'Invalid id' });
                }
                const { rows: existing } = await query(
                    `SELECT id, expires_at, revoked_at
                       FROM pgmonitoringtool.scim_tokens
                      WHERE id = $1 AND workspace_id = $2`,
                    [id, req.workspace.id]
                );
                if (existing.length === 0) return res.status(404).json({ error: 'Not found' });
                if (existing[0].revoked_at) {
                    return res.status(409).json({ error: 'Token already revoked' });
                }
                const now = Date.now();
                const oldExpires = existing[0].expires_at
                    ? new Date(existing[0].expires_at).getTime()
                    : null;
                const ttlDays = oldExpires
                    ? Math.max(1, Math.ceil((oldExpires - now) / 86400000))
                    : 365;
                const token  = `pulsedb_scim_${crypto.randomBytes(24).toString('base64url')}`;
                const hash   = crypto.createHash('sha256').update(token).digest('hex');
                const prefix = token.slice(0, 16);
                const { rows: created } = await query(
                    `INSERT INTO pgmonitoringtool.scim_tokens
                        (workspace_id, token_hash, token_prefix, created_by,
                         expires_at)
                     VALUES ($1,$2,$3,$4, now() + ($5 || ' days')::interval)
                     RETURNING id, created_at, expires_at`,
                    [req.workspace.id, hash, prefix, req.user?.id, ttlDays]
                );
                await query(
                    `UPDATE pgmonitoringtool.scim_tokens
                        SET revoked_at = now()
                      WHERE id = $1 AND workspace_id = $2`,
                    [id, req.workspace.id]
                );
                await writeAudit({
                    actor_id: req.user?.id,
                    action: 'scim_token.rotate',
                    target: `ws:${req.workspace.id}`,
                    details: { rotatedFromId: id, newId: created[0].id, ttlDays },
                }).catch(swallowWith({ component: 'governance', op: 'writeAudit' }));
                res.status(201).json({
                    id: created[0].id,
                    rotatedFromId: id,
                    token,
                    prefix,
                    created_at: created[0].created_at,
                    expires_at: created[0].expires_at,
                    warning: 'Store this token now — it will never be shown again.',
                });
            } catch (err) { next(err); }
        }
    );

    // ── A8: expiring-soon list for IdP cron / email reminders ────────────────
    router.get(
        '/governance/scim-tokens/expiring',
        authenticate, resolveWorkspace, requireWorkspaceRole('admin'),
        async (req, res, next) => {
            try {
                const withinDays = Math.min(Math.max(Number(req.query.withinDays) || 14, 1), 365);
                const { rows } = await query(
                    `SELECT id, token_prefix, created_at, expires_at, last_used_at
                       FROM pgmonitoringtool.scim_tokens
                      WHERE workspace_id = $1
                        AND revoked_at IS NULL
                        AND expires_at IS NOT NULL
                        AND expires_at < now() + ($2 || ' days')::interval
                      ORDER BY expires_at ASC`,
                    [req.workspace.id, withinDays]
                );
                res.json({ withinDays, tokens: rows });
            } catch (err) { next(err); }
        }
    );

    // ── Audit export: on-demand trigger (cron handles periodic) ──────────────
    //   HIGH-1 fix: resolveWorkspace must run before requireWorkspaceRole or
    //   the role check fails closed for everyone and the feature is dead.
    router.post(
        '/governance/audit-export/run',
        authenticate, resolveWorkspace, requireWorkspaceRole('owner'),
        async (req, res, next) => {
            try {
                const summary = await runAuditExport({
                    fromTs: req.body?.from ? new Date(req.body.from) : undefined,
                    toTs: req.body?.to ? new Date(req.body.to) : undefined,
                    // Names the S3 object; does not filter rows — audit_log has
                    // no workspace_id. See runAuditExport().
                    workspaceId: req.workspace?.id ?? 0,
                });
                res.json(summary);
            } catch (err) { next(err); }
        }
    );

    return router;
}
