// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Unauthenticated liveness probe.
// Extracted from server.ts.

import { alerts } from '../../core/alerting.js';

export default function registerHealthRoutes(app) {
    // ─────────────────────────────────────────────────────────────────────────────
    // HEALTH
    // ─────────────────────────────────────────────────────────────────────────────
    app.get('/health', (_req, res) =>
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: '3.0.0',
            alerts: { monitoring: alerts.monitoringInterval !== null },
        }),
    );
}
