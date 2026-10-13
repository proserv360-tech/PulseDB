// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/advisorRoutes.js
 * ──────────────────────
 * Index advisor endpoints: unused indexes, redundant indexes, missing index suggestions.
 *
 * Mount with:
 *   app.use(prefix, advisorRoutes(pool, authenticate, getPool))
 *
 * Routes:
 *   GET  /advisor/indexes/unused       — list unused indexes
 *   GET  /advisor/indexes/redundant    — list redundant indexes
 *   GET  /advisor/indexes/suggestions  — suggest missing indexes
 *   POST /advisor/indexes/preview      — preview generated DDL
 */

import { Router } from 'express';
import {
    analyzeIndexUsage,
    suggestMissingIndexes,
    generateIndexDdl,
    dropRedundantIndexDdl,
} from '../services/indexAdvisor.js';
import { resolveWorkspace, requireWorkspaceRole } from '../middleware/workspaceRbac.js';

export default function advisorRoutes(pool, authenticate, getPool) {
    // ── What-if hypothetical index analysis (gap-analysis P1-3) ─────────────
    // POST /api/advisor/what-if  { query, candidates? }
    //   Evaluates candidate indexes against the query plan. Uses HypoPG when
    //   the extension is installed; otherwise returns unverified candidates.

    const router = Router();

    router.post('/advisor/what-if', authenticate, async (req, res) => {
        try {
            const { whatIfAnalysis } = await import('../services/whatIfIndexService.js');
            const userId = req.user?.id ?? null;
            const targetPool = await getPool(req.query.connectionId || null, userId);
            const { query, candidates } = req.body || {};
            res.json(await whatIfAnalysis({ targetPool, query, candidates: candidates || null }));
        } catch (e) {
            const code = /read-only SELECT/.test(e.message) ? 400 : 500;
            res.status(code).json({ error: e.message });
        }
    });

    // ── GET /advisor/indexes/unused ──────────────────────────────────────────
    router.get(
        '/advisor/indexes/unused',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const { connectionId } = req.query || {};
                if (!connectionId) {
                    return res.status(400).json({ error: 'connectionId required' });
                }

                const pgPool = getPool ? getPool(connectionId) : null;
                if (!pgPool) {
                    return res.status(404).json({ error: 'connection not found' });
                }

                const client = await pgPool.connect();
                try {
                    const { unused } = await analyzeIndexUsage(
                        client,
                        req.query.schema ? String(req.query.schema) : null,
                    );
                    const withDdl = unused.map((idx) => ({
                        ...idx,
                        dropStatement: dropRedundantIndexDdl(idx.name, idx.schema),
                    }));
                    res.json({ unused: withDdl });
                } finally {
                    client.release();
                }
            } catch (err) {
                next(err);
            }
        },
    );

    // ── GET /advisor/indexes/redundant ───────────────────────────────────────
    router.get(
        '/advisor/indexes/redundant',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const { connectionId } = req.query || {};
                if (!connectionId) {
                    return res.status(400).json({ error: 'connectionId required' });
                }

                const pgPool = getPool ? getPool(connectionId) : null;
                if (!pgPool) {
                    return res.status(404).json({ error: 'connection not found' });
                }

                const client = await pgPool.connect();
                try {
                    const { redundant } = await analyzeIndexUsage(
                        client,
                        req.query.schema ? String(req.query.schema) : null,
                    );
                    const withDdl = redundant.map((idx) => ({
                        ...idx,
                        dropStatement: dropRedundantIndexDdl(idx.name, idx.schema),
                    }));
                    res.json({ redundant: withDdl });
                } finally {
                    client.release();
                }
            } catch (err) {
                next(err);
            }
        },
    );

    // ── GET /advisor/indexes/suggestions ─────────────────────────────────────
    router.get(
        '/advisor/indexes/suggestions',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const { connectionId, minCalls = 50, minMeanMs = 100 } = req.query || {};
                if (!connectionId) {
                    return res.status(400).json({ error: 'connectionId required' });
                }

                const pgPool = getPool ? getPool(connectionId) : null;
                if (!pgPool) {
                    return res.status(404).json({ error: 'connection not found' });
                }

                const client = await pgPool.connect();
                try {
                    const { suggestions, advisory } = await suggestMissingIndexes(client, {
                        minCalls: Number(minCalls) || 50,
                        minMeanTimeMs: Number(minMeanMs) || 100,
                    });

                    // Add generated DDL to each suggestion
                    const withDdl = suggestions.map((sug) => ({
                        ...sug,
                        createStatement: generateIndexDdl({
                            table: sug.table,
                            columns: sug.columns,
                        }),
                    }));

                    res.json({
                        suggestions: withDdl,
                        advisory,
                    });
                } finally {
                    client.release();
                }
            } catch (err) {
                next(err);
            }
        },
    );

    // ── POST /advisor/indexes/preview ────────────────────────────────────────
    router.post(
        '/advisor/indexes/preview',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const { table, columns, unique = false, using = 'btree' } = req.body || {};

                if (!table || !columns || !Array.isArray(columns)) {
                    return res.status(400).json({
                        error: 'table (string) and columns (array) required',
                    });
                }

                if (columns.length === 0) {
                    return res.status(400).json({ error: 'columns array cannot be empty' });
                }

                const ddl = generateIndexDdl({ table, columns, unique, using });

                res.json({
                    table,
                    columns,
                    unique,
                    using,
                    createStatement: ddl,
                });
            } catch (err) {
                next(err);
            }
        },
    );

    return router;
}
