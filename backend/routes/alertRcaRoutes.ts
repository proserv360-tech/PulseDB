// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/alertRcaRoutes.js — C5 alert RCA read + feedback.
 *
 *   GET   /api/alerts/:alertId/rca
 *   POST  /api/alerts/rca/:rcaId/feedback   { feedback: 'up' | 'down' | null }
 *
 * Both gated by authenticate + viewer (read) / editor (feedback).
 */

import { Router } from 'express';
import { listForAlert, setFeedback } from '../services/alertRcaService.js';
import { resolveWorkspace, requireWorkspaceRole } from '../middleware/workspaceRbac.js';

export default function alertRcaRoutes(pool, authenticate) {
    const router = Router();

    router.get('/alerts/:alertId/rca',
        authenticate, resolveWorkspace, requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const rows = await listForAlert(req.params.alertId);
                res.json({ alertId: req.params.alertId, narratives: rows });
            } catch (err) { next(err); }
        }
    );

    router.post('/alerts/rca/:rcaId/feedback',
        authenticate, resolveWorkspace, requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const rcaId = Number(req.params.rcaId);
                if (!Number.isInteger(rcaId) || rcaId <= 0) return res.status(400).json({ error: 'Invalid rcaId' });
                const { feedback } = req.body || {};
                if (![null, 'up', 'down'].includes(feedback)) {
                    return res.status(400).json({ error: 'feedback must be up | down | null' });
                }
                const n = await setFeedback({ rcaId, feedback });
                if (n === 0) return res.status(404).json({ error: 'Not found' });
                res.json({ updated: n });
            } catch (err) { next(err); }
        }
    );

    return router;
}
