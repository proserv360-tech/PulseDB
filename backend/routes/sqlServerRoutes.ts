// @ts-nocheck — legacy JS style to match sibling routes; type later (see docs/TS_MIGRATION.md)
/**
 * routes/sqlServerRoutes.js
 * ─────────────────────────
 * Read-only SQL Server monitoring views for the "SQL Server" UI section.
 *
 *   GET /api/connections/:id/sqlserver/:view
 *       view = overview | performance | querystore | sessions | storage | memory | io | backups | security | alwayson
 *     → { view, data, errors: { [panel]: message }, live, history?, collectedAt }
 *
 * Factory mirrors waitEventsRoutes:
 *   sqlServerRoutes(authenticate, resolveConnection, getAdapterForConnection)
 */
import crypto from 'node:crypto';
import { Router } from 'express';
import { collectSqlServerView, SQL_SERVER_VIEWS } from '../services/sqlServerMonitor.js';
import { QUERIES } from '../services/sqlServerQueries.js';

const MSSQL_TYPES = new Set(['mssql', 'sqlserver']);
const IDLE_CLOSE_MS = 2 * 60_000;

export default function sqlServerRoutes(authenticate, resolveConnection, getAdapterForConnection) {
    const router = Router();

    // The screens poll every 10–15 s; keep one pool per connection instead of
    // logging in again on every refresh. A changed connection (host, password…)
    // gets a fresh pool; idle pools are closed.
    const adapters = new Map(); // connectionId -> { key, adapter: Promise, lastUsed }
    const fingerprint = (c) =>
        crypto
            .createHash('sha256')
            .update(JSON.stringify([c.host, c.port, c.database, c.username, c.password, c.ssl, c.sshEnabled, c.sshHost]))
            .digest('hex');
    const drop = (id) => {
        const entry = adapters.get(id);
        adapters.delete(id);
        entry?.adapter.then((a) => a.disconnect?.()).catch(() => undefined);
    };
    const sweep = setInterval(() => {
        for (const [id, entry] of adapters) if (Date.now() - entry.lastUsed > IDLE_CLOSE_MS) drop(id);
    }, 30_000);
    sweep.unref?.();

    async function adapterFor(id, connection) {
        const key = fingerprint(connection);
        let entry = adapters.get(id);
        if (entry && entry.key !== key) {
            drop(id);
            entry = null;
        }
        if (!entry) {
            entry = { key, adapter: getAdapterForConnection(connection), lastUsed: Date.now() };
            adapters.set(id, entry);
            entry.adapter.catch(() => adapters.get(id) === entry && adapters.delete(id));
        }
        entry.lastUsed = Date.now();
        return entry.adapter;
    }

    router.get('/connections/:id/sqlserver/:view', authenticate, async (req, res, next) => {
        const { id, view } = req.params;
        if (!SQL_SERVER_VIEWS.includes(view)) return res.status(404).json({ error: `unknown view "${view}"` });

        try {
            const connection = await resolveConnection(req, id);
            if (!connection) return res.status(404).json({ error: 'connection not found' });
            if (!MSSQL_TYPES.has(connection.dbType)) {
                return res.status(400).json({ error: 'connection is not a SQL Server connection' });
            }

            let adapter;
            try {
                adapter = await adapterFor(id, connection);
            } catch (err) {
                return res.status(502).json({ error: err.message });
            }
            let result;
            try {
                result = await collectSqlServerView(adapter, view, id);
            } catch (err) {
                // A whole-screen failure is a connectivity problem (login failed,
                // agent offline…): report the database's own message, not a 500.
                drop(id);
                return res.status(err.status || 502).json({ error: err.message });
            }
            // Every panel failing usually means the pool itself is broken — start fresh next time.
            if (Object.keys(QUERIES[view]).every((panel) => result.errors[panel])) drop(id);
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    return router;
}
