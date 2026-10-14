// @ts-nocheck — legacy JS style to match sibling routes; type later (see docs/TS_MIGRATION.md)
/**
 * routes/sqlServerRoutes.js
 * ─────────────────────────
 * Read-only SQL Server monitoring views for the "SQL Server" UI section.
 *
 *   GET /api/connections/:id/sqlserver/:view     view = overview | performance | sessions | storage
 *     → { view, data, errors: { [panel]: message }, collectedAt }
 *
 * Factory mirrors waitEventsRoutes:
 *   sqlServerRoutes(authenticate, resolveConnection, getAdapterForConnection)
 */
import { Router } from 'express';
import { collectSqlServerView, SQL_SERVER_VIEWS } from '../services/sqlServerMonitor.js';

const MSSQL_TYPES = new Set(['mssql', 'sqlserver']);

export default function sqlServerRoutes(authenticate, resolveConnection, getAdapterForConnection) {
    const router = Router();

    router.get('/connections/:id/sqlserver/:view', authenticate, async (req, res, next) => {
        const { id, view } = req.params;
        if (!SQL_SERVER_VIEWS.includes(view)) return res.status(404).json({ error: `unknown view "${view}"` });

        let adapter;
        try {
            const connection = await resolveConnection(req, id);
            if (!connection) return res.status(404).json({ error: 'connection not found' });
            if (!MSSQL_TYPES.has(connection.dbType)) {
                return res.status(400).json({ error: 'connection is not a SQL Server connection' });
            }

            try {
                adapter = await getAdapterForConnection(connection);
            } catch (err) {
                return res.status(502).json({ error: err.message });
            }
            res.json(await collectSqlServerView(adapter, view, id));
        } catch (err) {
            next(err);
        } finally {
            // The factory builds a fresh pool per call; close it so pools don't pile up.
            adapter?.disconnect?.().catch(() => undefined);
        }
    });

    return router;
}
