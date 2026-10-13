// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/anomalyRoutes.js
 * ───────────────────────
 * Expose anomaly detection to the UI. Pulls metric history from the existing
 * metrics registry and forwards to the Python anomaly worker.
 */

import { Router } from 'express';
import { detectAnomalies } from '../services/anomaly/anomalyClient.js';

export default function anomalyRoutes(pool, authenticate, metricsProviderFactory) {
    const router = Router();

    router.post('/anomaly/detect', authenticate, async (req, res, next) => {
        try {
            const { connectionId, metric, windowSeconds = 3600,
                    method = 'zscore', threshold = 3.0 } = req.body || {};
            if (!connectionId || !metric) {
                return res.status(400).json({ error: 'connectionId and metric required' });
            }
            const mp = metricsProviderFactory(connectionId);
            const points = mp.series(metric, windowSeconds).map(p => ({
                t: new Date(p.t).toISOString(),
                v: p.v,
            }));
            const result = await detectAnomalies({
                points, method, window: 60, threshold,
            });
            res.json({ metric, ...result });
        } catch (err) { next(err); }
    });

    return router;
}
