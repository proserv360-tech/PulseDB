// @ts-nocheck — legacy JS style to match sibling routes; type later (see docs/TS_MIGRATION.md)
/**
 * routes/storageAdvisorRoutes.js
 * ──────────────────────────────
 * Engine-agnostic reclaimable-storage advisor. Mirrors waitEventsRoutes: one
 * route serves every engine; the adapter's capability decides whether real
 * data comes back (MySQL/MariaDB InnoDB data_free today; supported:false
 * otherwise — the PostgreSQL analogue is the VACUUM forecast).
 *
 *   GET /api/connections/:id/storage-advisor
 *     → { supported, engine, summary, tables: [{ schema, table, reclaimableMb,
 *         fragmentationPct, urgency, recommendation }], note? }
 *
 * Factory mirrors engineConsoleRoutes / waitEventsRoutes:
 *   storageAdvisorRoutes(authenticate, resolveConnection, getAdapterForConnection)
 */
import { Router } from 'express';
import { fetchStorageAdvisor } from '../services/storageAdvisorService.js';

export default function storageAdvisorRoutes(authenticate, resolveConnection, getAdapterForConnection) {
    const router = Router();

    router.get('/connections/:id/storage-advisor', authenticate, async (req, res, next) => {
        try {
            const connectionId = req.params.id;
            const connection = await resolveConnection(req, connectionId);
            if (!connection) return res.status(404).json({ error: 'connection not found' });

            const adapter = await getAdapterForConnection(connection);
            const result = await fetchStorageAdvisor(adapter);

            // 200 with supported:false is intentional — the FE branches on the
            // flag to show a "not applicable for this engine" affordance.
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    return router;
}
