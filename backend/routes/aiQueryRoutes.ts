// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/aiQueryRoutes.js
 * ──────────────────────
 * AI-powered query analysis and optimization endpoints.
 * Mount with:
 *   app.use('/api', aiQueryRoutes(pool, authenticate));
 */

import { Router } from 'express';
import {
    analyzeQuery,
    getSlowQuerySuggestions,
    suggestIndexes,
    detectAntiPatterns,
    getQueryComplexityScore,
    generateOptimizationReport,
} from '../services/aiQueryService.js';

function log(level, message, meta = {}) {
    const fn = level === 'ERROR' ? console.error : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg: message, ...meta }));
}

export default function aiQueryRoutes(pool, authenticate) {
    const router = Router();

    /* ── POST /api/ai-query/analyze ────────────────────────────────────────────
       Analyze a specific query and return optimization suggestions.
       Body: {query: string}                                                    */
    router.post('/ai-query/analyze', authenticate, async (req, res) => {
        try {
            const { query } = req.body;

            if (!query || typeof query !== 'string') {
                return res.status(400).json({ error: 'query is required and must be a string' });
            }

            const analysis = await analyzeQuery(pool, query);
            res.json(analysis);
        } catch (err) {
            log('ERROR', 'Failed to analyze query', { error: err.message });
            res.status(500).json({ error: err.message });
        }
    });

    /* ── GET /api/ai-query/suggestions ─────────────────────────────────────────
       Get slow query suggestions from pg_stat_statements.
       Query params: limit (default 10)                                         */
    router.get('/ai-query/suggestions', authenticate, async (req, res) => {
        try {
            const limit = Number(req.query.limit) || 10;
            const suggestions = await getSlowQuerySuggestions(pool, limit);

            res.json({
                count: suggestions.length,
                suggestions,
            });
        } catch (err) {
            log('ERROR', 'Failed to get slow query suggestions', { error: err.message });
            res.status(500).json({ error: err.message });
        }
    });

    /* ── GET /api/ai-query/indexes/:table ───────────────────────────────────────
       Get index suggestions for a specific table.                              */
    router.get('/ai-query/indexes/:table', authenticate, async (req, res) => {
        try {
            const { table } = req.params;

            if (!table || typeof table !== 'string') {
                return res.status(400).json({ error: 'table parameter is required' });
            }

            const suggestions = await suggestIndexes(pool, table);

            res.json({
                table,
                count: suggestions.length,
                suggestions,
            });
        } catch (err) {
            log('ERROR', 'Failed to get index suggestions', { error: err.message, table: req.params.table });
            res.status(500).json({ error: err.message });
        }
    });

    /* ── POST /api/ai-query/anti-patterns ───────────────────────────────────────
       Detect anti-patterns in a query.
       Body: {query: string}                                                    */
    router.post('/ai-query/anti-patterns', authenticate, async (req, res) => {
        try {
            const { query } = req.body;

            if (!query || typeof query !== 'string') {
                return res.status(400).json({ error: 'query is required and must be a string' });
            }

            const antiPatterns = await detectAntiPatterns(pool, query);
            const complexity = await getQueryComplexityScore(pool, query);

            res.json({
                query: query.substring(0, 200),
                complexity,
                antiPatterns,
            });
        } catch (err) {
            log('ERROR', 'Failed to detect anti-patterns', { error: err.message });
            res.status(500).json({ error: err.message });
        }
    });

    /* ── GET /api/ai-query/report ───────────────────────────────────────────────
       Get comprehensive optimization report.                                   */
    router.get('/ai-query/report', authenticate, async (req, res) => {
        try {
            const report = await generateOptimizationReport(pool);
            res.json(report);
        } catch (err) {
            log('ERROR', 'Failed to generate optimization report', { error: err.message });
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}
