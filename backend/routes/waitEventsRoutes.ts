// @ts-nocheck — legacy JS style to match sibling routes; type later (see docs/TS_MIGRATION.md)
/**
 * routes/waitEventsRoutes.js
 * ──────────────────────────
 * Engine-agnostic wait-event endpoint. One route serves every engine; the
 * adapter's declared capability decides whether real data is returned.
 *
 *   GET /api/connections/:id/wait-events
 *     → { supported, engine, window, events: [{ event, ms?, waiters? }], note? }
 *
 * Factory mirrors engineConsoleRoutes:
 *   waitEventsRoutes(authenticate, resolveConnection, getAdapterForConnection)
 */
import { Router } from 'express';
import { fetchWaitEvents } from '../services/waitEventsService.js';

export default function waitEventsRoutes(authenticate, resolveConnection, getAdapterForConnection) {
    const router = Router();

    router.get('/connections/:id/wait-events', authenticate, async (req, res, next) => {
        try {
            const connectionId = req.params.id;
            const connection = await resolveConnection(req, connectionId);
            if (!connection) return res.status(404).json({ error: 'connection not found' });

            const adapter = await getAdapterForConnection(connection);
            const result = await fetchWaitEvents(adapter);

            // 200 with supported:false is intentional — the FE branches on the
            // flag to show a "not available for this engine" affordance rather
            // than treating it as an error.
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    return router;
}
