// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/terraformRoutes.js
 * ────────────────────────
 * Terraform/IaC export endpoints.
 * Mount with:
 *   app.use('/api', terraformRoutes(pool, authenticate, requireRole));
 */

import { Router } from 'express';
import {
    exportAlertRules,
    exportConnectionConfigs,
    exportRetentionPolicies,
    exportUserRoles,
    generateTerraformBundle,
    exportAsJSON,
} from '../services/terraformService.js';

function log(level, message, meta = {}) {
    const fn = level === 'ERROR' ? console.error : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg: message, ...meta }));
}

export default function terraformRoutes(pool, authenticate, requireRole) {
    const router = Router();
    const isAdmin = [authenticate, requireRole('admin')];

    /* ── GET /api/terraform/export ─────────────────────────────────────────────
       Download complete Terraform bundle as .tf content.                      */
    router.get('/terraform/export', ...isAdmin, async (req, res) => {
        try {
            const tfContent = await generateTerraformBundle(pool);

            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Content-Disposition', 'attachment; filename="fathom-config.tf"');
            res.send(tfContent);

            log('INFO', 'Terraform bundle exported', { exportedBy: req.user?.username });
        } catch (err) {
            log('ERROR', 'Failed to export Terraform bundle', { error: err.message });
            res.status(500).json({ error: err.message });
        }
    });

    /* ── GET /api/terraform/export/alerts ──────────────────────────────────────
       Export alert rules only as .tf content.                                */
    router.get('/terraform/export/alerts', ...isAdmin, async (req, res) => {
        try {
            const alertRules = await exportAlertRules(pool);

            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Content-Disposition', 'attachment; filename="fathom-alerts.tf"');
            res.send(alertRules);

            log('INFO', 'Alert rules exported as Terraform', { exportedBy: req.user?.username });
        } catch (err) {
            log('ERROR', 'Failed to export alert rules', { error: err.message });
            res.status(500).json({ error: err.message });
        }
    });

    /* ── GET /api/terraform/export/connections ─────────────────────────────────
       Export connection configurations only.                                 */
    router.get('/terraform/export/connections', ...isAdmin, async (req, res) => {
        try {
            const connections = await exportConnectionConfigs(pool);

            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Content-Disposition', 'attachment; filename="fathom-connections.tf"');
            res.send(connections);

            log('INFO', 'Connections exported as Terraform', { exportedBy: req.user?.username });
        } catch (err) {
            log('ERROR', 'Failed to export connections', { error: err.message });
            res.status(500).json({ error: err.message });
        }
    });

    /* ── GET /api/terraform/export/json ────────────────────────────────────────
       Export all configurations as JSON.                                      */
    router.get('/terraform/export/json', ...isAdmin, async (req, res) => {
        try {
            const jsonExport = await exportAsJSON(pool);

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename="fathom-config.json"');
            res.json(jsonExport);

            log('INFO', 'Configuration exported as JSON', { exportedBy: req.user?.username });
        } catch (err) {
            log('ERROR', 'Failed to export as JSON', { error: err.message });
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}
