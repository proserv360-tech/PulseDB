// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/otlpTraceRoutes.js
 * ────────────────────────
 * OpenTelemetry trace ingest and query endpoints.
 *
 * Mount with:
 *   app.use(prefix, otlpTraceRoutes(pool, authenticate, sdkService));
 *
 * Endpoints:
 *   POST   /api/otlp/v1/traces         — OTLP/HTTP ingest
 *   GET    /api/traces                 — list traces
 *   GET    /api/traces/:traceId        — get span tree
 *   GET    /api/traces/:traceId/pivot  — correlate with queries
 *   GET    /api/traces/settings        — get org settings
 *   PUT    /api/traces/settings        — update org settings (admin)
 */

import { Router } from 'express';
import {
    parseOtlpRequest,
    sampleDecision,
    ingestSpans,
    listTraces,
    getSpanTree,
    pivotToQueries,
    getOrgTraceSettings,
    updateOrgTraceSettings,
} from '../services/otlpTraceService.js';
import { getCorrelatedTrace } from '../services/trace/traceCorrelation.js';
import { authenticateSdkKey } from '../services/sdkService.js';
import { resolveWorkspace, requireWorkspaceRole } from '../middleware/workspaceRbac.js';

const TRACE_ID_RE = /^[0-9a-f]{32}$/i;

export default function otlpTraceRoutes(pool, authenticate, sdkService) {
    const router = Router();

    // ── OTLP/HTTP v1 ingest ─────────────────────────────────────────────────

    router.post('/otlp/v1/traces', async (req, res, next) => {
        try {
            // Resolve orgId via SDK key or workspace auth
            let orgId = null;

            const sdkKey = req.headers['x-sdk-key'];
            if (sdkKey) {
                // SDK key authentication
                const app = await authenticateSdkKey(pool, sdkKey);
                if (!app) {
                    return res.status(401).json({ error: 'invalid_sdk_key' });
                }
                // Extract org_id from app; assumes app record has org_id field
                // If app doesn't have org_id, fall back to a lookup or default
                if (app.org_id) {
                    orgId = app.org_id;
                } else {
                    // Fallback: use first org associated with the app
                    orgId = app.created_by ? 1 : null; // Simplified; improve if needed
                }
            } else if (req.user) {
                // Workspace authentication
                if (!req.workspace) {
                    // Try to resolve workspace if authenticate already ran
                    await new Promise((resolve, reject) => {
                        resolveWorkspace(req, res, (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                }
                orgId = req.workspace?.id;
            }

            if (!orgId) {
                return res.status(401).json({ error: 'authentication_required' });
            }

            // Parse OTLP request
            const normalized = parseOtlpRequest(req.body || {});
            if (normalized.length === 0) {
                return res.json({ accepted: 0, dropped: 0 });
            }

            // Get org settings
            const settings = await getOrgTraceSettings(pool, orgId);
            const { sampling_rate, max_spans_per_trace } = settings;

            // Apply sampling and limits
            const sampledSpans = [];
            let dropped = 0;

            for (const span of normalized) {
                // Sample decision (per trace, not per span)
                if (!sampleDecision({ samplingRate: sampling_rate, traceIdHex: span.traceId })) {
                    dropped++;
                    continue;
                }

                sampledSpans.push(span);
            }

            // Respect max spans per trace
            const groupedByTrace = new Map();
            for (const span of sampledSpans) {
                if (!groupedByTrace.has(span.traceId)) {
                    groupedByTrace.set(span.traceId, []);
                }
                groupedByTrace.get(span.traceId).push(span);
            }

            const finalSpans = [];
            for (const [_traceId, traceSpans] of groupedByTrace.entries()) {
                const kept = traceSpans.slice(0, max_spans_per_trace);
                const excess = traceSpans.length - kept.length;
                if (excess > 0) dropped += excess;
                finalSpans.push(...kept);
            }

            // B9 — When Redis + queue are available, enqueue and respond 202.
            // Worker tier consumes 'otlp.ingest' and runs ingestSpansBatch().
            // When Redis is missing, fall back to synchronous insert so the
            // dev / Vercel path still works.
            try {
                const queueMod = await import('../services/queue.js');
                const redisMod = await import('../services/redisClient.js');
                const haveRedis = !!redisMod.getRedis();
                if (haveRedis) {
                    const q = queueMod.createQueue(queueMod.QUEUE_NAMES.OTLP_INGEST);
                    await q.add('spans', { orgId, spans: finalSpans, dropped });
                    return res.status(202).json({ accepted: finalSpans.length, dropped, queued: true });
                }
            } catch (e) {
                // Queue setup failed — fall through to direct insert below.
            }

            const { inserted } = await ingestSpans(pool, { orgId, spans: finalSpans });
            res.json({ accepted: inserted, dropped });
        } catch (err) {
            next(err);
        }
    });

    // ── List traces with filters ─────────────────────────────────────────────

    router.get('/traces', authenticate, resolveWorkspace, requireWorkspaceRole('viewer'), async (req, res, next) => {
        try {
            const orgId = req.workspace?.id;
            if (!orgId) {
                return res.status(403).json({ error: 'no_workspace' });
            }

            const serviceName = req.query.service || null;
            const minDurationMs = req.query.minDurationMs ? Number(req.query.minDurationMs) : null;
            const limit = Math.min(Number(req.query.limit) || 50, 1000);
            const beforeStartTime = req.query.before || null;
            const status = req.query.status || null;

            const traces = await listTraces(pool, {
                orgId,
                serviceName,
                minDurationMs,
                limit,
                beforeStartTime,
                status,
            });

            res.json({ traces, limit, count: traces.length });
        } catch (err) {
            next(err);
        }
    });

    // ── Get span tree for a trace ────────────────────────────────────────────

    router.get(
        '/traces/:traceId',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const { traceId } = req.params;
                if (!TRACE_ID_RE.test(traceId)) {
                    return res.status(400).json({ error: 'invalid_trace_id' });
                }

                const orgId = req.workspace?.id;
                if (!orgId) {
                    return res.status(403).json({ error: 'no_workspace' });
                }

                const result = await getSpanTree(pool, { orgId, traceId });
                if (!result.spans || result.spans.length === 0) {
                    return res.status(404).json({ error: 'trace_not_found' });
                }

                res.json(result);
            } catch (err) {
                next(err);
            }
        },
    );

    // ── Pivot trace to queries ───────────────────────────────────────────────

    router.get(
        '/traces/:traceId/pivot',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const { traceId } = req.params;
                if (!TRACE_ID_RE.test(traceId)) {
                    return res.status(400).json({ error: 'invalid_trace_id' });
                }

                const orgId = req.workspace?.id;
                if (!orgId) {
                    return res.status(403).json({ error: 'no_workspace' });
                }

                const result = await pivotToQueries(pool, { orgId, traceId });
                res.json(result);
            } catch (err) {
                next(err);
            }
        },
    );

    // ── Unified APM view: span tree grafted with the SQL each span issued ──────
    // Answers "trace this slow request down to the exact query/plan" by joining
    // OTLP spans with query_events on span_id and rolling up DB time, the
    // slowest query, and the slowest DB span.
    router.get(
        '/traces/:traceId/correlate',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const { traceId } = req.params;
                if (!TRACE_ID_RE.test(traceId)) {
                    return res.status(400).json({ error: 'invalid_trace_id' });
                }
                const orgId = req.workspace?.id;
                if (!orgId) {
                    return res.status(403).json({ error: 'no_workspace' });
                }

                const getSpans = async (tid) => {
                    const { spans } = await getSpanTree(pool, { orgId, traceId: tid });
                    // Normalize otlp_spans rows into the shape correlateSpansWithQueries expects.
                    return (spans || []).map((sp) => ({
                        spanId: sp.span_id,
                        parentSpanId: sp.parent_span_id,
                        traceId: sp.trace_id,
                        name: sp.operation_name,
                        kind: sp.span_kind,
                        serviceName: sp.service_name,
                        statusCode: sp.status_code,
                        startTimeNs: sp.start_time ? new Date(sp.start_time).getTime() * 1_000_000 : 0,
                        endTimeNs: sp.end_time
                            ? new Date(sp.end_time).getTime() * 1_000_000
                            : sp.start_time
                              ? new Date(sp.start_time).getTime() * 1_000_000 + Number(sp.duration_ms || 0) * 1_000_000
                              : 0,
                    }));
                };

                const result = await getCorrelatedTrace(pool.query.bind(pool), traceId, { getSpans });
                res.json(result);
            } catch (err) {
                next(err);
            }
        },
    );

    // ── Get trace settings ───────────────────────────────────────────────────

    router.get(
        '/traces/settings',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const orgId = req.workspace?.id;
                if (!orgId) {
                    return res.status(403).json({ error: 'no_workspace' });
                }

                const settings = await getOrgTraceSettings(pool, orgId);
                res.json(settings);
            } catch (err) {
                next(err);
            }
        },
    );

    // ── Update trace settings (admin only) ────────────────────────────────────

    router.put(
        '/traces/settings',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('admin'),
        async (req, res, next) => {
            try {
                const orgId = req.workspace?.id;
                if (!orgId) {
                    return res.status(403).json({ error: 'no_workspace' });
                }

                const { samplingRate, retentionDays, maxSpansPerTrace } = req.body || {};

                // Validation
                if (samplingRate !== undefined && (samplingRate < 0 || samplingRate > 1)) {
                    return res.status(400).json({ error: 'sampling_rate must be between 0 and 1' });
                }

                if (retentionDays !== undefined && (retentionDays < 1 || retentionDays > 90)) {
                    return res.status(400).json({ error: 'retention_days must be between 1 and 90' });
                }

                if (maxSpansPerTrace !== undefined && maxSpansPerTrace < 1) {
                    return res.status(400).json({ error: 'max_spans_per_trace must be >= 1' });
                }

                const updated = await updateOrgTraceSettings(pool, orgId, {
                    samplingRate,
                    retentionDays,
                    maxSpansPerTrace,
                });

                res.json(updated);
            } catch (err) {
                next(err);
            }
        },
    );

    return router;
}
