// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/integrationsRoutes.js
 * ─────────────────────────────
 * CRUD + test endpoints for per-organization notification destinations.
 *
 * Mount with:
 *   app.use(prefix, integrationsRoutes(pool, authenticate, requireRole, tenantIsolationMw));
 *
 * All routes require authentication AND the caller's active organization
 * (via the x-org-id header enforced by tenantIsolation). Write operations
 * additionally require an admin-or-above role within the organization
 * (owner/admin) — viewers and members can read but not mutate.
 *
 * Endpoints:
 *   GET    /api/integrations                 — list all destinations for current org
 *   POST   /api/integrations                 — create a destination (admin+)
 *   GET    /api/integrations/:id             — get one destination
 *   PATCH  /api/integrations/:id             — partial update (admin+)
 *   DELETE /api/integrations/:id             — delete (admin+)
 *   POST   /api/integrations/:id/test        — send a test alert (admin+)
 *
 * Secrets (bot tokens, routing keys, HMAC keys) are write-only: the response
 * always reports `hasSecret: boolean`, never the plaintext or ciphertext.
 */

import { Router } from 'express';
import { NotifierManager } from '../services/notifiers/index.js';
import {
    createDestination,
    listDestinations,
    getDestination,
    updateDestination,
    deleteDestination,
    recordDispatchResult,
    buildNotifierFromRow,
} from '../services/destinationService.js';
import { writeAudit } from '../services/auditService.js';
import { swallowWith } from '../services/errorHandling.js';

const TABLE = 'pgmonitoringtool.notification_destinations';

function log(level, message, meta = {}) {
    const fn = level === 'ERROR' ? console.error : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg: message, ...meta }));
}

/**
 * Guard: require a non-null req.orgId. Every integrations call is scoped
 * to an organization; calls without one are rejected with 400 so admins
 * can't accidentally leak cross-tenant.
 */
function requireOrg(req, res, next) {
    if (!req.orgId) {
        return res.status(400).json({
            error: 'x-org-id header required for integrations API',
        });
    }
    next();
}

/**
 * Guard: org-level role gate. `tenantIsolation` sets req.orgRole for normal
 * users; super_admins have no orgRole but are always permitted.
 */
function requireOrgWriteRole(req, res, next) {
    if (req.user?.role === 'super_admin') return next();
    const role = req.orgRole;
    if (role === 'owner' || role === 'admin') return next();
    return res.status(403).json({ error: 'admin or owner role required' });
}

export default function integrationsRoutes(pool, authenticate, tenantIsolationMw) {
    const router = Router();
    const guards = [authenticate, tenantIsolationMw, requireOrg];
    const writeGuards = [...guards, requireOrgWriteRole];

    /* ── GET /api/integrations ──────────────────────────────────────────── */
    router.get('/integrations', ...guards, async (req, res) => {
        try {
            const rows = await listDestinations(pool, req.orgId);
            res.json({ destinations: rows, total: rows.length });
        } catch (err) {
            log('ERROR', 'list integrations failed', { error: err.message });
            res.status(500).json({ error: err.message });
        }
    });

    /* ── POST /api/integrations ─────────────────────────────────────────── */
    router.post('/integrations', ...writeGuards, async (req, res) => {
        try {
            const created = await createDestination(
                pool,
                req.orgId,
                req.body || {},
                req.user?.id ?? null
            );
            writeAudit(pool, {
                actorId: req.user?.id,
                actorUsername: req.user?.username,
                action: 'integration.create',
                resourceType: 'integration',
                resourceId: created.id,
                level: 'info',
                detail: `created ${created.provider} destination "${created.name}"`,
                metadata: { orgId: req.orgId, provider: created.provider },
                ip: req.ip,
            }).catch(swallowWith({ component: 'integrations', op: 'writeAudit' }));
            res.status(201).json({ destination: created });
        } catch (err) {
            const status = err.status || 500;
            res.status(status).json({ error: err.message, validation: err.validation });
        }
    });

    /* ── GET /api/integrations/:id ──────────────────────────────────────── */
    router.get('/integrations/:id', ...guards, async (req, res) => {
        try {
            const dest = await getDestination(pool, req.orgId, Number(req.params.id));
            if (!dest) return res.status(404).json({ error: 'not found' });
            res.json({ destination: dest });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    /* ── PATCH /api/integrations/:id ────────────────────────────────────── */
    router.patch('/integrations/:id', ...writeGuards, async (req, res) => {
        try {
            const updated = await updateDestination(
                pool,
                req.orgId,
                Number(req.params.id),
                req.body || {}
            );
            if (!updated) return res.status(404).json({ error: 'not found' });
            writeAudit(pool, {
                actorId: req.user?.id,
                actorUsername: req.user?.username,
                action: 'integration.update',
                resourceType: 'integration',
                resourceId: updated.id,
                level: 'info',
                detail: `updated ${updated.provider} destination "${updated.name}"`,
                metadata: {
                    orgId: req.orgId,
                    changed: Object.keys(req.body || {}),
                    secretRotated: Object.prototype.hasOwnProperty.call(req.body || {}, 'secret'),
                },
                ip: req.ip,
            }).catch(swallowWith({ component: 'integrations', op: 'writeAudit' }));
            res.json({ destination: updated });
        } catch (err) {
            const status = err.status || 500;
            res.status(status).json({ error: err.message, validation: err.validation });
        }
    });

    /* ── DELETE /api/integrations/:id ───────────────────────────────────── */
    router.delete('/integrations/:id', ...writeGuards, async (req, res) => {
        try {
            const existing = await getDestination(pool, req.orgId, Number(req.params.id));
            if (!existing) return res.status(404).json({ error: 'not found' });
            const ok = await deleteDestination(pool, req.orgId, Number(req.params.id));
            if (!ok) return res.status(404).json({ error: 'not found' });
            writeAudit(pool, {
                actorId: req.user?.id,
                actorUsername: req.user?.username,
                action: 'integration.delete',
                resourceType: 'integration',
                resourceId: existing.id,
                level: 'warn',
                detail: `deleted ${existing.provider} destination "${existing.name}"`,
                metadata: { orgId: req.orgId, provider: existing.provider },
                ip: req.ip,
            }).catch(swallowWith({ component: 'integrations', op: 'writeAudit' }));
            res.status(204).send();
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    /* ── POST /api/integrations/:id/test ───────────────────────────────────
       Send a canned test alert to exactly one destination, returning the
       result shape produced by NotifierManager. Doesn't touch real alerts
       or write to the alerts table.                                     */
    router.post('/integrations/:id/test', ...writeGuards, async (req, res) => {
        try {
            // Pull the raw row (we need the encrypted secret for decryption).
            const { rows } = await pool.query(
                `SELECT * FROM ${TABLE} WHERE id = $1 AND org_id = $2`,
                [Number(req.params.id), req.orgId]
            );
            if (!rows[0]) return res.status(404).json({ error: 'not found' });

            const notifier = buildNotifierFromRow(rows[0]);
            const manager = new NotifierManager({ notifiers: [notifier] });
            const testAlert = {
                id: `test-${Date.now()}`,
                severity: req.body?.severity || 'warning',
                title: 'FATHOM integration test',
                message: 'This is a test alert. If you see it, your destination is wired up.',
                source: 'fathom',
                component: 'integration-test',
                timestamp: new Date().toISOString(),
                metadata: { test: true, actor: req.user?.username || 'unknown' },
            };
            const [dispatchResult] = await manager.dispatch(testAlert);

            // Best-effort status update so the UI shows "last test: ok/failed".
            await recordDispatchResult(pool, Number(req.params.id), dispatchResult?.result || {});

            writeAudit(pool, {
                actorId: req.user?.id,
                actorUsername: req.user?.username,
                action: 'integration.test',
                resourceType: 'integration',
                resourceId: Number(req.params.id),
                level: dispatchResult?.result?.ok ? 'info' : 'warn',
                detail: `test fired; status=${dispatchResult?.result?.status}`,
                metadata: { orgId: req.orgId, provider: rows[0].provider },
                ip: req.ip,
            }).catch(swallowWith({ component: 'integrations', op: 'writeAudit' }));

            res.json({
                ok: !!dispatchResult?.result?.ok,
                result: dispatchResult?.result,
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}
