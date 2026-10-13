// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/bloatRoutes.js
 * ─────────────────────
 * Postgres bloat and vacuum analysis endpoints.
 *
 * GET  /advisor/bloat/tables?connectionId=&schema=
 * GET  /advisor/bloat/indexes?connectionId=&schema=
 * GET  /advisor/bloat/autovacuum?connectionId=
 * POST /advisor/bloat/preview-vacuum body: { schema, table, full?, analyze? }
 *
 * Mount with:
 *   app.use(prefix, bloatRoutes(pool, authenticate, getPool, ...))
 */

import { Router } from 'express';
import {
    estimateTableBloat,
    estimateIndexBloat,
    getAutovacuumLag,
    recommendVacuum,
    generateVacuumDdl,
    formatBytes,
} from '../services/bloatWatcher.js';
import { resolveWorkspace, requireWorkspaceRole } from '../middleware/workspaceRbac.js';
import { getVacuumForecast } from '../services/vacuumForecastService.js';

export default function bloatRoutes(pool, authenticate, getPool) {
    const router = Router();

    // ── GET /advisor/bloat/tables ────────────────────────────────────────────
    router.get(
        '/advisor/bloat/tables',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const { connectionId, schema = 'public' } = req.query || {};
                if (!connectionId) {
                    return res.status(400).json({ error: 'connectionId required' });
                }

                const pgPool = getPool ? await getPool(connectionId, req.user?.id) : null;
                if (!pgPool) return res.status(404).json({ error: 'connection not found' });

                const client = await pgPool.connect();
                try {
                    const bloat = await estimateTableBloat(client, { schema });
                    res.json({
                        schema,
                        connectionId,
                        tables: bloat,
                        summary: {
                            totalTables: bloat.length,
                            totalBloatBytes: bloat.reduce((s, t) => s + t.bloatBytes, 0),
                            maxBloatRatio: bloat.length > 0 ? Math.max(...bloat.map((t) => t.bloatRatio)) : 0,
                        },
                    });
                } finally {
                    client.release();
                }
            } catch (err) {
                next(err);
            }
        },
    );

    // ── GET /advisor/bloat/indexes ───────────────────────────────────────────
    router.get(
        '/advisor/bloat/indexes',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const { connectionId, schema = 'public' } = req.query || {};
                if (!connectionId) {
                    return res.status(400).json({ error: 'connectionId required' });
                }

                const pgPool = getPool ? await getPool(connectionId, req.user?.id) : null;
                if (!pgPool) return res.status(404).json({ error: 'connection not found' });

                const client = await pgPool.connect();
                try {
                    const bloat = await estimateIndexBloat(client, { schema });
                    res.json({
                        schema,
                        connectionId,
                        indexes: bloat,
                        summary: {
                            totalIndexes: bloat.length,
                            totalBloatBytes: bloat.reduce((s, i) => s + i.bloatBytes, 0),
                            maxBloatRatio: bloat.length > 0 ? Math.max(...bloat.map((i) => i.bloatRatio)) : 0,
                        },
                    });
                } finally {
                    client.release();
                }
            } catch (err) {
                next(err);
            }
        },
    );

    // ── GET /advisor/bloat/autovacuum ────────────────────────────────────────
    router.get(
        '/advisor/bloat/autovacuum',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const { connectionId } = req.query || {};
                if (!connectionId) {
                    return res.status(400).json({ error: 'connectionId required' });
                }

                const pgPool = getPool ? await getPool(connectionId, req.user?.id) : null;
                if (!pgPool) return res.status(404).json({ error: 'connection not found' });

                const client = await pgPool.connect();
                try {
                    const lag = await getAutovacuumLag(client, req.query.schema ? String(req.query.schema) : null);

                    // Enrich with recommendations
                    const withRecs = lag.map((row) => {
                        const rec = recommendVacuum({
                            ...row,
                            sizeBytes: row.estimatedSizeBytes,
                        });
                        return { ...row, recommendation: rec };
                    });

                    res.json({
                        connectionId,
                        tables: withRecs,
                        summary: {
                            totalTables: withRecs.length,
                            totalDeadTups: withRecs.reduce((s, t) => s + t.nDeadTup, 0),
                            tablesNeedingVacuum: withRecs.filter((t) => t.recommendation.action !== 'none').length,
                        },
                    });
                } finally {
                    client.release();
                }
            } catch (err) {
                next(err);
            }
        },
    );

    // ── POST /advisor/bloat/preview-vacuum ───────────────────────────────────
    router.post(
        '/advisor/bloat/preview-vacuum',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('admin'),
        async (req, res, next) => {
            try {
                const { schema = 'public', table, full = false, analyze = true } = req.body || {};
                if (!table) {
                    return res.status(400).json({ error: 'table name required' });
                }

                try {
                    const ddl = generateVacuumDdl({ schema, table, full, analyze });
                    res.json({
                        schema,
                        table,
                        full,
                        analyze,
                        ddl,
                        warning: 'Preview only. DDL is NOT executed automatically.',
                    });
                } catch (err) {
                    return res.status(400).json({ error: err.message });
                }
            } catch (err) {
                next(err);
            }
        },
    );

    // ── GET /advisor/vacuum/timeline ─────────────────────────────────────────
    // Returns per-day dead-tuple counts + vacuum event counts for a given table
    // over the last N days, sampled from pg_stat_user_tables snapshots stored
    // in our own vacuum_snapshots table (if present) or synthesised from the
    // current pg_stat_user_tables row when no history is available yet.
    router.get(
        '/advisor/vacuum/timeline',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const { connectionId, table, days = '14' } = req.query || {};
                if (!connectionId) return res.status(400).json({ error: 'connectionId required' });
                if (!table) return res.status(400).json({ error: 'table required (schema.relname)' });

                const nDays = Math.min(Math.max(Number(days) || 14, 1), 90);
                const [schemaName, ...rest] = String(table).split('.');
                const relName = rest.join('.') || schemaName;
                const schema = rest.length ? schemaName : 'public';

                const pgPool = getPool ? await getPool(connectionId, req.user?.id) : null;
                if (!pgPool) return res.status(404).json({ error: 'connection not found' });

                const client = await pgPool.connect();
                try {
                    // Try our snapshot table first
                    let timeline = [];
                    try {
                        const snap = await client.query(
                            `SELECT
                                date_trunc('day', captured_at) AS day,
                                MAX(n_dead_tup)               AS n_dead_tup,
                                MAX(n_live_tup)               AS n_live_tup,
                                COUNT(*) FILTER (WHERE last_autovacuum > lag(last_autovacuum) OVER (ORDER BY captured_at))
                                                              AS vacuum_events
                             FROM pgmonitoringtool.vacuum_snapshots
                             WHERE schemaname = $1
                               AND relname    = $2
                               AND captured_at >= NOW() - ($3 || ' days')::interval
                             GROUP BY 1
                             ORDER BY 1`,
                            [schema, relName, nDays],
                        );
                        timeline = snap.rows.map((r) => ({
                            day: new Date(r.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                            n_dead_tup: Number(r.n_dead_tup),
                            n_live_tup: Number(r.n_live_tup),
                            vacuum_events: Number(r.vacuum_events),
                        }));
                    } catch {
                        // vacuum_snapshots table not yet created — fall through to current-row fallback
                    }

                    // Fallback: return the current snapshot as a single data point
                    if (timeline.length === 0) {
                        const cur = await client.query(
                            `SELECT schemaname, relname, n_dead_tup, n_live_tup,
                                    last_autovacuum, last_vacuum
                             FROM pg_stat_user_tables
                             WHERE schemaname = $1 AND relname = $2`,
                            [schema, relName],
                        );
                        if (cur.rows.length > 0) {
                            const row = cur.rows[0];
                            timeline = [
                                {
                                    day: 'Today',
                                    n_dead_tup: Number(row.n_dead_tup),
                                    n_live_tup: Number(row.n_live_tup),
                                    vacuum_events: 0,
                                },
                            ];
                        }
                    }

                    res.json({ table, days: nDays, timeline });
                } finally {
                    client.release();
                }
            } catch (err) {
                next(err);
            }
        },
    );

    // ── GET /advisor/bloat/forecast ──────────────────────────────────────────
    // Predictive VACUUM advisor (B-1): estimate when autovacuum will next fire on
    // each table and rank tables by urgency (overdue / soon / watch / ok).
    router.get(
        '/advisor/bloat/forecast',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const { connectionId, schema } = req.query || {};
                if (!connectionId) return res.status(400).json({ error: 'connectionId required' });
                const pgPool = getPool ? await getPool(connectionId, req.user?.id) : null;
                if (!pgPool) return res.status(404).json({ error: 'connection not found' });
                const forecast = await getVacuumForecast(pgPool, { schema: schema || null });
                res.json({ connectionId, ...forecast });
            } catch (err) {
                // Never 500 the panel — surface the reason and degrade to an
                // empty forecast so the dashboard stays usable on PG-compatible
                // engines / restricted roles.
                res.json({
                    connectionId: req.query.connectionId ?? null,
                    summary: { overdue: 0, soon: 0, watch: 0, ok: 0 },
                    tables: [],
                    error: err.message,
                });
            }
        },
    );

    return router;
}
