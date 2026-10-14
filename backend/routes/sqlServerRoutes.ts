// @ts-nocheck — legacy JS style to match sibling routes; type later (see docs/TS_MIGRATION.md)
/**
 * routes/sqlServerRoutes.js
 * ─────────────────────────
 * Read-only SQL Server monitoring views for the "SQL Server" UI section.
 *
 *   GET /api/connections/:id/sqlserver/:view[?database=Name]   (database: Tables & Indexes, Query Store)
 *       view = overview | performance | querystore | sessions | storage | memory | io | backups | security | alwayson
 *     → { view, data, errors: { [panel]: message }, live, history?, collectedAt }
 *
 * Factory mirrors waitEventsRoutes:
 *   sqlServerRoutes(authenticate, resolveConnection, getAdapterForConnection)
 */
import crypto from 'node:crypto';
import { Router } from 'express';
import {
    collectSqlServerView,
    DATABASE_SCOPED_VIEWS,
    isSafeDatabaseName,
    SQL_SERVER_VIEWS,
} from '../services/sqlServerMonitor.js';
import { QUERIES } from '../services/sqlServerQueries.js';
import { adviseSqlServer } from '../services/sqlServerAiAdvisor.js';
import { getProvider } from '../services/copilotService.js';

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
            .update(
                JSON.stringify([c.host, c.port, c.database, c.username, c.password, c.ssl, c.sshEnabled, c.sshHost]),
            )
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

    /**
     * The per-database screens (Tables & Indexes, Query Store) can look at any
     * database on the instance: ?database=Name opens the connection in that
     * database instead (its own pool, so the server-wide screens keep theirs).
     * @returns {{ poolId, connection } | { error }}
     */
    function scoped(id, connection, view, database) {
        if (!database || !DATABASE_SCOPED_VIEWS.has(view) || database === connection.database)
            return { poolId: id, connection };
        if (!isSafeDatabaseName(database)) return { error: 'invalid database name' };
        return { poolId: `${id}@${database}`, connection: { ...connection, database } };
    }

    /** An agent older than 1.2.3 ignores the chosen database; say so instead of showing the wrong one. */
    function checkDatabase(result, requested) {
        const current = result.data.databaseList?.find((d) => Number(d.is_current))?.database_name;
        result.database = current || requested || null;
        if (requested && current && current.toLowerCase() !== requested.toLowerCase()) {
            result.errors.database =
                `Showing ${current}: the PulseDB Agent for this connection is too old to switch databases. ` +
                'Run setup.cmd again on that machine (download the agent again from Connections → Connect another PC).';
        }
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

            const requested = typeof req.query.database === 'string' ? req.query.database : '';
            const target = scoped(id, connection, view, requested);
            if (target.error) return res.status(400).json({ error: target.error });

            let adapter;
            try {
                adapter = await adapterFor(target.poolId, target.connection);
            } catch (err) {
                return res.status(502).json({ error: err.message });
            }
            let result;
            try {
                result = await collectSqlServerView(adapter, view, id);
            } catch (err) {
                // A whole-screen failure is a connectivity problem (login failed,
                // agent offline…): report the database's own message, not a 500.
                drop(target.poolId);
                return res.status(err.status || 502).json({ error: err.message });
            }
            // Every panel failing usually means the pool itself is broken — start fresh next time.
            if (Object.keys(QUERIES[view]).every((panel) => result.errors[panel])) drop(target.poolId);
            if (DATABASE_SCOPED_VIEWS.has(view)) checkDatabase(result, requested);
            const provider = getProvider();
            result.ai = { available: provider.name !== 'local', provider: provider.name };
            res.json(result);
        } catch (err) {
            next(err);
        }
    });

    /**
     * AI review of one screen, or tuning advice for one query.
     *   POST /api/connections/:id/sqlserver/:view/ai   { focus?: { kind: 'query', text, stats } }
     *   → { text, provider, model }
     * Collects the screen fresh (so the advice matches what is on it now) and
     * sends a compact, literal-masked summary to the configured AI provider.
     */
    router.post('/connections/:id/sqlserver/:view/ai', authenticate, async (req, res, next) => {
        const { id, view } = req.params;
        if (!SQL_SERVER_VIEWS.includes(view)) return res.status(404).json({ error: `unknown view "${view}"` });
        try {
            const connection = await resolveConnection(req, id);
            if (!connection) return res.status(404).json({ error: 'connection not found' });
            if (!MSSQL_TYPES.has(connection.dbType)) {
                return res.status(400).json({ error: 'connection is not a SQL Server connection' });
            }
            const target = scoped(
                id,
                connection,
                view,
                typeof req.query.database === 'string' ? req.query.database : '',
            );
            if (target.error) return res.status(400).json({ error: target.error });
            let snapshot;
            try {
                snapshot = await collectSqlServerView(await adapterFor(target.poolId, target.connection), view, id);
            } catch (err) {
                drop(target.poolId);
                return res.status(502).json({ error: err.message });
            }
            const focus =
                req.body?.focus?.kind === 'query'
                    ? { kind: 'query', text: String(req.body.focus.text || ''), stats: req.body.focus.stats || {} }
                    : null;
            try {
                res.json(await adviseSqlServer(view, snapshot, focus));
            } catch (err) {
                res.status(err.status || 502).json({ error: err.message, code: err.code });
            }
        } catch (err) {
            next(err);
        }
    });

    return router;
}
