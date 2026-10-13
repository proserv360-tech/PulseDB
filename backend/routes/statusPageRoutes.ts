// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/statusPageRoutes.js
 * ──────────────────────────
 * Public status page endpoints.
 * Mount with:
 *   app.use('/api', statusPageRoutes(pool, authenticate, requireRole));
 */

import { Router } from 'express';
import {
    getPublicStatus,
    getUptimeHistory,
    getIncidents,
    createIncident,
    updateIncident,
    resolveIncident,
    getStatusSummary,
} from '../services/statusPageService.js';

function log(level, message, meta = {}) {
    const fn = level === 'ERROR' ? console.error : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg: message, ...meta }));
}

export default function statusPageRoutes(pool, authenticate, requireRole) {
    const router = Router();
    const isAdmin = [authenticate, requireRole('admin')];

    /* ── GET /api/status/public ────────────────────────────────────────────────
       Public endpoint (NO auth required).
       Returns sanitized health status.                                        */
    router.get('/status/public', async (req, res) => {
        try {
            const status = await getPublicStatus(pool);
            res.json(status);
        } catch (err) {
            log('ERROR', 'Failed to get public status', { error: err.message });
            res.status(500).json({
                status: 'down',
                statusColor: 'red',
                responseTimeMs: 0,
                uptime: 0,
                lastChecked: new Date(),
            });
        }
    });

    /* ── GET /api/status/uptime ────────────────────────────────────────────────
       Public uptime history.
       Query params: days (default 30)                                         */
    router.get('/status/uptime', async (req, res) => {
        try {
            const days = Number(req.query.days) || 30;
            const history = await getUptimeHistory(pool, days);

            res.json({
                days,
                count: history.length,
                history,
            });
        } catch (err) {
            log('ERROR', 'Failed to get uptime history', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── GET /api/status/incidents ─────────────────────────────────────────────
       Public incident list.
       Query params: limit (default 10)                                        */
    router.get('/status/incidents', async (req, res) => {
        try {
            const limit = Number(req.query.limit) || 10;
            const incidents = await getIncidents(pool, limit);

            res.json({
                count: incidents.length,
                incidents,
            });
        } catch (err) {
            log('ERROR', 'Failed to get incidents', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── POST /api/status/incidents ────────────────────────────────────────────
       Create incident (admin, authenticated).
       Body: {title, description, severity, status?}                           */
    router.post('/status/incidents', ...isAdmin, async (req, res) => {
        try {
            const { title, description, severity, status } = req.body;

            if (!title || !description || !severity) {
                return res.status(400).json({
                    error: 'title, description, and severity are required',
                });
            }

            const incidentId = await createIncident(pool, {
                title,
                description,
                severity,
                status,
            });

            log('INFO', 'Incident created', { incidentId, severity, createdBy: req.user?.username });

            res.status(201).json({
                success: true,
                incidentId,
                message: 'Incident created',
            });
        } catch (err) {
            log('ERROR', 'Failed to create incident', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── PUT /api/status/incidents/:id ─────────────────────────────────────────
       Update incident (admin, authenticated).
       Body: {title?, description?, status?}                                   */
    router.put('/status/incidents/:id', ...isAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { title, description, status } = req.body;

            await updateIncident(pool, id, { title, description, status });

            log('INFO', 'Incident updated', { incidentId: id, updatedBy: req.user?.username });

            res.json({
                success: true,
                message: 'Incident updated',
                incidentId: id,
            });
        } catch (err) {
            log('ERROR', 'Failed to update incident', { error: err.message, incidentId: req.params.id });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── POST /api/status/incidents/:id/resolve ────────────────────────────────
       Resolve incident (admin, authenticated).                                */
    router.post('/status/incidents/:id/resolve', ...isAdmin, async (req, res) => {
        try {
            const { id } = req.params;

            await resolveIncident(pool, id);

            log('INFO', 'Incident resolved', { incidentId: id, resolvedBy: req.user?.username });

            res.json({
                success: true,
                message: 'Incident resolved',
                incidentId: id,
            });
        } catch (err) {
            log('ERROR', 'Failed to resolve incident', { error: err.message, incidentId: req.params.id });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── GET /api/status/summary ───────────────────────────────────────────────
       Get overall status summary (public).                                    */
    router.get('/status/summary', async (req, res) => {
        try {
            const summary = await getStatusSummary(pool);
            res.json(summary);
        } catch (err) {
            log('ERROR', 'Failed to get status summary', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    return router;
}
