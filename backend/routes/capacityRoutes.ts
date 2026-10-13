// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/capacityRoutes.js
 * ────────────────────────
 * Live capacity-planning endpoints backing CapacityPlanningTabV3.
 *
 * GET  {prefix}/capacity/stats?connectionId=&totalGB=
 * GET  {prefix}/capacity/tables?connectionId=&limit=8
 * GET  {prefix}/capacity/forecast?connectionId=&days=60&multiplier=1
 * GET  {prefix}/capacity/actions?connectionId=
 * POST {prefix}/capacity/snapshot   body: { connectionId }   (records a history point)
 *
 * Mounted under both /api and /api/v1 via the modularMounts loop:
 *   app.use(prefix, capacityRoutes(pool, authenticate, getPool));
 */

import { Router } from 'express';
import {
    getStats,
    getTableBreakdown,
    getForecast,
    getActions,
    captureSnapshot,
} from '../services/capacityService.js';

export default function capacityRoutes(pool, authenticate, getPool) {
    const router = Router();

    async function withClient(req, res, fn) {
        const connectionId = req.query?.connectionId || req.body?.connectionId;
        if (!connectionId) {
            res.status(400).json({ error: 'connectionId required' });
            return;
        }
        const pgPool = getPool ? await getPool(connectionId, req.user?.id) : null;
        if (!pgPool) {
            res.status(404).json({ error: 'connection not found' });
            return;
        }
        const client = await pgPool.connect();
        try {
            await fn(client, connectionId);
        } finally {
            client.release();
        }
    }

    router.get('/capacity/stats', authenticate, async (req, res, next) => {
        try {
            await withClient(req, res, async (client, connectionId) => {
                const totalGB = req.query.totalGB ? Number(req.query.totalGB) : undefined;
                const stats = await getStats(client, { appPool: pool, connectionId, totalGB });
                res.json(stats);
            });
        } catch (e) { next(e); }
    });

    router.get('/capacity/tables', authenticate, async (req, res, next) => {
        try {
            await withClient(req, res, async (client, connectionId) => {
                const limit = Math.min(Number(req.query.limit) || 8, 50);
                const tables = await getTableBreakdown(client, { appPool: pool, connectionId, limit });
                res.json({ tables });
            });
        } catch (e) { next(e); }
    });

    router.get('/capacity/forecast', authenticate, async (req, res, next) => {
        try {
            await withClient(req, res, async (client, connectionId) => {
                const days = Math.min(Number(req.query.days) || 60, 365);
                const multiplier = Number(req.query.multiplier) || 1;
                const forecast = await getForecast(client, { appPool: pool, connectionId, days, multiplier });
                res.json(forecast);
            });
        } catch (e) { next(e); }
    });

    router.get('/capacity/actions', authenticate, async (req, res, next) => {
        try {
            await withClient(req, res, async (client) => {
                const actions = await getActions(client);
                res.json({ actions });
            });
        } catch (e) { next(e); }
    });

    router.post('/capacity/snapshot', authenticate, async (req, res, next) => {
        try {
            await withClient(req, res, async (client, connectionId) => {
                const result = await captureSnapshot(pool, client, connectionId);
                res.json({ ok: true, ...result });
            });
        } catch (e) { next(e); }
    });

    return router;
}
