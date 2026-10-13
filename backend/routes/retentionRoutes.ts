// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/retentionRoutes.js
 * ─────────────────────────
 * Data retention management endpoints.
 * Mount with:
 *   app.use('/api', retentionRoutes(pool, authenticate, requireRole));
 */

import { Router } from 'express';
import {
    getRetentionPolicy,
    updateRetentionPolicy,
    getRetentionStats,
    runRetentionCleanup,
    getDataGrowthTrend,
} from '../services/retentionService.js';
import { runMetricRollups, pruneTiers, queryRolledMetrics } from '../services/metricRollupService.js';

function log(level, message, meta = {}) {
    const fn = level === 'ERROR' ? console.error : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg: message, ...meta }));
}

export default function retentionRoutes(pool, authenticate, requireRole) {
    const router = Router();
    const isAdmin = [authenticate, requireRole('admin')];

    /* ── GET /api/retention/policy ──────────────────────────────────────────────
       Get current retention policy for organization.                            */
    router.get('/retention/policy', authenticate, async (req, res) => {
        try {
            // For now, use org_id 1 as default; in multi-tenant system, extract from req.user
            const orgId = req.user?.orgId || 1;

            const policy = await getRetentionPolicy(pool, orgId);
            res.json(policy);
        } catch (err) {
            log('ERROR', 'Failed to get retention policy', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── PUT /api/retention/policy ──────────────────────────────────────────────
       Update retention policy (admin only).                                    */
    router.put('/retention/policy', ...isAdmin, async (req, res) => {
        try {
            const orgId = req.user?.orgId || 1;
            const policy = {
                metricsRetentionDays: req.body.metricsRetentionDays,
                logsRetentionDays: req.body.logsRetentionDays,
                alertsRetentionDays: req.body.alertsRetentionDays,
                auditRetentionDays: req.body.auditRetentionDays,
            };

            await updateRetentionPolicy(pool, orgId, policy);

            log('INFO', 'Retention policy updated', { orgId, ...policy });
            res.json({
                success: true,
                message: 'Retention policy updated',
                policy,
            });
        } catch (err) {
            log('ERROR', 'Failed to update retention policy', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── GET /api/retention/stats ───────────────────────────────────────────────
       Get data size and row count statistics.                                  */
    router.get('/retention/stats', authenticate, async (req, res) => {
        try {
            const stats = await getRetentionStats(pool);
            res.json({ stats });
        } catch (err) {
            log('ERROR', 'Failed to get retention stats', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── POST /api/retention/cleanup ────────────────────────────────────────────
       Trigger manual cleanup (admin only).                                     */
    router.post('/retention/cleanup', ...isAdmin, async (req, res) => {
        try {
            const orgId = req.user?.orgId || 1;

            const result = await runRetentionCleanup(pool, orgId);

            log('INFO', 'Manual retention cleanup executed', { orgId, ...result.deleted });
            res.json({
                success: true,
                message: 'Cleanup completed',
                ...result,
            });
        } catch (err) {
            log('ERROR', 'Failed to run retention cleanup', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── GET /api/retention/growth ──────────────────────────────────────────────
       Get data growth trend estimate.
       Query params: days (default 7)                                            */
    router.get('/retention/growth', authenticate, async (req, res) => {
        try {
            const days = Number(req.query.days) || 7;
            const trend = await getDataGrowthTrend(pool, days);

            res.json(trend);
        } catch (err) {
            log('ERROR', 'Failed to get growth trend', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── POST /api/retention/rollup ─────────────────────────────────────────────
       Roll raw metrics into hourly/daily tiers, then prune each tier to its
       retention window (admin only).                                            */
    router.post('/retention/rollup', ...isAdmin, async (req, res) => {
        try {
            const rolled = await runMetricRollups(pool);
            const pruned = await pruneTiers(pool);
            res.json({ success: true, rolled, pruned });
        } catch (err) {
            log('ERROR', 'Metric rollup failed', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── GET /api/retention/rollup/metrics ──────────────────────────────────────
       Read a metric series at the best resolution for the requested window.
       Query: name (required), from/to (ms epoch).                                */
    router.get('/retention/rollup/metrics', authenticate, async (req, res) => {
        try {
            const name = req.query.name;
            if (!name) return res.status(400).json({ error: 'name is required' });
            const toMs = Number(req.query.to) || Date.now();
            const fromMs = Number(req.query.from) || toMs - 24 * 3600 * 1000;
            const result = await queryRolledMetrics(pool, { name: String(name), fromMs, toMs });
            res.json(result);
        } catch (err) {
            log('ERROR', 'Rollup metric query failed', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    return router;
}
