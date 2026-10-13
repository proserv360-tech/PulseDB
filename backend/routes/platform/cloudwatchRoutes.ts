// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// AWS CloudWatch status and metrics.
// Extracted from server.ts.

import { authenticate } from '../../core/auth.js';
import { getMetric, getStatus } from '../../services/cloudwatchService.js';
import { log } from '../../services/logger.js';

export default function registerCloudwatchRoutes(app) {
    // ─────────────────────────────────────────────────────────────────────────────
    // CLOUDWATCH ROUTES — powered by cloudwatchService.js (no AWS SDK required)
    // ─────────────────────────────────────────────────────────────────────────────
    app.get('/api/cloudwatch/status', authenticate, (req, res) => {
        try {
            const { accessKey, secretKey, region, db } = req.query;
            const overrides = accessKey ? { accessKey, secretKey, region, dbId: db } : {};
            res.json(getStatus(overrides));
        } catch (e) {
            res.json({});
        }
    });

    app.get('/api/cloudwatch/metrics', authenticate, async (req, res) => {
        const { metric, period, accessKey, secretKey, region, db } = req.query;
        if (!metric) return res.status(400).json({ error: 'metric query param required' });
        const periodSec = Number(period) || 3600;
        const overrides = accessKey ? { accessKey, secretKey, region, dbId: db } : {};
        try {
            const datapoints = await getMetric(metric, periodSec, overrides);
            res.json({ metric, datapoints });
        } catch (e) {
            log('ERROR', 'CloudWatch metric fetch failed', { metric, error: e.message });
            res.json({});
        }
    });
}
