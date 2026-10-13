/**
 * routes/schemaTrackingRoutes.ts
 * Schema drift timeline API (gap-analysis P1-2).
 *
 * Mount: app.use(prefix, schemaTrackingRoutes(pool, authenticate, reqPool, resolveConn));
 *
 * SECURITY (audit 2026-06-10, HIGH-1): the timeline read is scoped to a
 * connection the caller owns. resolveConn(connectionId, userId) throws if the
 * connection does not belong to the user, so a raw ?connectionId= can no
 * longer read another tenant's schema history. The capture path already binds
 * the target pool to the user via reqPool.
 */
import { Router } from 'express';
import { captureSnapshot, getTimeline } from '../services/schemaTrackingService.js';

export default function schemaTrackingRoutes(pool: any, authenticate: any, reqPool: any, resolveConn: any = null) {
    const router = Router();

    router.get('/schema/track/timeline', authenticate, async (req: any, res: any) => {
        try {
            const connectionId = req.query.connectionId;
            if (!connectionId) return res.status(400).json({ error: 'connectionId required' });
            if (resolveConn) {
                // Throws if the connection isn't owned by req.user — fail closed.
                await resolveConn(connectionId, req.user?.id ?? null);
            }
            const rows = await getTimeline({ controlPool: pool, connectionId, limit: req.query.limit });
            res.json({ changes: rows });
        } catch (e: any) {
            const code = /not found|No database connection/.test(e.message) ? 404 : 500;
            res.status(code).json({ error: e.message });
        }
    });

    router.post('/schema/track/capture', authenticate, async (req: any, res: any) => {
        try {
            const targetPool = await reqPool(req);
            const connectionId = req.query.connectionId || 'default';
            res.json(await captureSnapshot({ controlPool: pool, targetPool, connectionId }));
        } catch (e: any) {
            const code = /not found|No database connection/.test(e.message) ? 404 : 500;
            res.status(code).json({ error: e.message });
        }
    });

    return router;
}
