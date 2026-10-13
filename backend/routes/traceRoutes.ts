// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * traceRoutes.js
 * ───────────────
 * HTTP surface for the trace-to-query correlation feature.
 *
 *   GET  /api/traces/:traceId/queries   → list query events for a trace
 *   GET  /api/traces/:traceId/summary   → aggregated trace summary
 *   POST /api/traces/diagnose           → echo what trace context we would
 *                                          extract from a given SQL + app name
 *                                          (support tool for customers who
 *                                           don't see their trace_ids linked).
 *
 * Routes expect `req.pool` or `req.queryFn` to be attached by upstream
 * middleware; if you have a different conventions, wire accordingly.
 */

import express from 'express';
import {
    getQueriesForTrace,
    summariseTrace,
    resolveTraceContext,
} from '../services/trace/index.js';

const TRACE_ID_RE = /^[0-9a-f]{32}$/i;

export function createTraceRouter({ getQueryFn } = {}) {
    const router = express.Router();

    // Resolve the pg query function for a request. Callers can either
    // (a) pass a `getQueryFn(req)` resolver at router construction, or
    // (b) attach req.pool with a standard pg.Pool .query method.
    const resolveQueryFn = (req) => {
        if (typeof getQueryFn === 'function') return getQueryFn(req);
        if (req.queryFn) return req.queryFn;
        if (req.pool?.query) return req.pool.query.bind(req.pool);
        throw new Error('traceRoutes: no query function attached (req.pool, req.queryFn, or getQueryFn option required)');
    };

    router.get('/api/traces/:traceId/queries', async (req, res) => {
        const { traceId } = req.params;
        if (!TRACE_ID_RE.test(traceId)) {
            return res.status(400).json({ error: 'invalid traceId (must be 32 hex chars)' });
        }
        const limit = Math.min(Number(req.query.limit) || 500, 5000);
        try {
            const qfn = resolveQueryFn(req);
            const rows = await getQueriesForTrace(qfn, traceId, { limit });
            res.json({ traceId, count: rows.length, queries: rows });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/api/traces/:traceId/summary', async (req, res) => {
        const { traceId } = req.params;
        if (!TRACE_ID_RE.test(traceId)) {
            return res.status(400).json({ error: 'invalid traceId (must be 32 hex chars)' });
        }
        try {
            const qfn = resolveQueryFn(req);
            const summary = await summariseTrace(qfn, traceId);
            res.json(summary);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    /**
     * POST /api/traces/diagnose
     * Body: { statement?: string, applicationName?: string, explicit?: { traceId, spanId } }
     * Response: the resolved context or a clear null result with the fields inspected.
     * Useful for customers who cannot see trace_ids and need to verify
     * their instrumentation is propagating context to the DB driver.
     */
    router.post('/api/traces/diagnose', express.json(), (req, res) => {
        const { statement, applicationName, explicit } = req.body || {};
        const ctx = resolveTraceContext({
            event: { statement },
            explicit,
            applicationName,
        });
        res.json({
            resolved: ctx,
            inspected: {
                statement_preview: typeof statement === 'string' ? statement.slice(0, 200) : null,
                application_name: applicationName || null,
                explicit: explicit || null,
            },
            hint: ctx.traceId
                ? `Context resolved via ${ctx.source}.`
                : 'No trace context found. Instrument your app to emit a sqlcommenter /*traceparent=...*/ prefix on queries, or set application_name to the traceparent.',
        });
    });

    return router;
}

export default createTraceRouter;
