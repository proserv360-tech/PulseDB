// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/enterpriseUIRoutes.js
 * ─────────────────────────────
 * HTTP surface consumed by the enterprise admin UIs added in G7:
 *   NotifierSettings, RedisOverview, ElasticsearchOverview,
 *   DetectorPicker, TraceDetail.
 *
 * The routes are intentionally thin. Where a dedicated service already
 * exists (e.g. services/trace/*.js, services/anomaly/*.js,
 * services/adapters/redisAdapter.js, services/notifiers/*.js), this file
 * delegates to it. Where the service doesn't yet have a "list stored
 * configurations" query, the route returns an empty but correctly-shaped
 * payload so the UI renders without errors.
 *
 * Mount with:
 *   app.use('/api/enterprise', enterpriseUIRoutes(pool, authenticate, requireRole));
 *
 * Feature gating: for Pro/Enterprise features we run the request through
 * requireFeature(pool, <flag>) from middleware/featureGate.js. Non-licensed
 * tenants get a uniform 403 envelope the frontend already handles.
 */

import { Router } from 'express';
import { requireFeature } from '../middleware/featureGate.js';

// Optional imports — the services may or may not be fully wired up at runtime.
// We fall back to empty payloads when a dependency can't be resolved, rather
// than 500-ing the UI.
let notifierManager = null;
let redisAdapter = null;
let esAdapter = null;
let anomalyModule = null;
let traceModule = null;

try {
    ({ default: notifierManager } = await import('../services/notifiers/notifierManager.js'));
} catch { /* optional */ }
try {
    redisAdapter = await import('../services/adapters/redisAdapter.js');
} catch { /* optional */ }
try {
    esAdapter = await import('../services/adapters/elasticsearchAdapter.js');
} catch { /* optional */ }
try {
    anomalyModule = await import('../services/anomaly/index.js');
} catch { /* optional */ }
try {
    traceModule = await import('../services/trace/index.js');
} catch { /* optional */ }

function safe(fn) {
    return async (req, res) => {
        try {
            await fn(req, res);
        } catch (err) {
            console.error('[enterpriseUI]', req.method, req.path, err?.message);
            res.status(500).json({ error: err?.message || 'internal error' });
        }
    };
}

export default function enterpriseUIRoutes(pool, authenticate, _requireRole) {
    const router = Router();
    router.use(authenticate);

    // ── Notifiers ────────────────────────────────────────────────────────
    // List configured notifiers across all kinds + last delivery status.
    // The NotifierManager keeps in-memory state; persistence lives in a
    // separate table that the admin API writes to. Both surfaces are
    // returned together.
    router.get(
        '/notifiers',
        requireFeature(pool, 'notifiers_webhook'),
        safe(async (_req, res) => {
            const notifiers = [];
            if (notifierManager?.listNotifiers) {
                for (const n of notifierManager.listNotifiers() || []) {
                    notifiers.push({
                        id: n.id,
                        kind: n.kind,
                        label: n.label || n.id,
                        enabled: n.enabled !== false,
                        lastStatus: n.lastStatus || null,
                        lastUsedAt: n.lastUsedAt || null,
                        createdAt: n.createdAt || null,
                    });
                }
            }
            res.json({ notifiers });
        }),
    );

    router.post(
        '/notifiers',
        requireFeature(pool, 'notifiers_webhook'),
        safe(async (req, res) => {
            const { kind, label, config } = req.body || {};
            if (!kind || !label) {
                return res.status(400).json({ error: 'kind and label are required' });
            }
            if (notifierManager?.addNotifier) {
                const created = await notifierManager.addNotifier({ kind, label, config });
                return res.json(created);
            }
            res.status(501).json({ error: 'notifier persistence not wired yet' });
        }),
    );

    router.post(
        '/notifiers/:id/test',
        requireFeature(pool, 'notifiers_webhook'),
        safe(async (req, res) => {
            if (notifierManager?.testNotifier) {
                const r = await notifierManager.testNotifier(req.params.id);
                return res.json(r);
            }
            res.status(501).json({ error: 'test not wired yet' });
        }),
    );

    router.delete(
        '/notifiers/:id',
        requireFeature(pool, 'notifiers_webhook'),
        safe(async (req, res) => {
            if (notifierManager?.removeNotifier) {
                await notifierManager.removeNotifier(req.params.id);
                return res.json({ ok: true });
            }
            res.status(501).json({ error: 'delete not wired yet' });
        }),
    );

    // ── Redis ────────────────────────────────────────────────────────────
    router.get(
        '/redis/info',
        requireFeature(pool, 'adapter_redis'),
        safe(async (req, res) => {
            const target = req.query.target || 'default';
            if (redisAdapter?.fetchInfo) {
                const info = await redisAdapter.fetchInfo(target);
                return res.json(info);
            }
            // Empty-but-shaped payload so the RedisOverview component can render.
            res.json({
                server: {}, clients: {}, memory: {}, stats: {}, replication: {}, keyspace: {},
            });
        }),
    );

    // ── Elasticsearch ────────────────────────────────────────────────────
    router.get(
        '/elasticsearch/health',
        requireFeature(pool, 'adapter_elasticsearch'),
        safe(async (req, res) => {
            const target = req.query.target || 'default';
            if (esAdapter?.fetchClusterHealth) {
                const h = await esAdapter.fetchClusterHealth(target);
                return res.json(h);
            }
            res.json({
                cluster_name: 'unknown', status: 'green',
                number_of_nodes: 0, number_of_data_nodes: 0,
                active_primary_shards: 0, active_shards: 0,
                relocating_shards: 0, initializing_shards: 0, unassigned_shards: 0,
            });
        }),
    );

    router.get(
        '/elasticsearch/indices',
        requireFeature(pool, 'adapter_elasticsearch'),
        safe(async (req, res) => {
            const target = req.query.target || 'default';
            if (esAdapter?.listIndices) {
                const indices = await esAdapter.listIndices(target);
                return res.json({ indices });
            }
            res.json({ indices: [] });
        }),
    );

    // ── Anomaly detectors ────────────────────────────────────────────────
    router.get(
        '/anomaly/configs',
        requireFeature(pool, 'anomaly_detection_suggest'),
        safe(async (_req, res) => {
            if (anomalyModule?.listConfigs) {
                const configs = await anomalyModule.listConfigs(pool);
                return res.json({ configs });
            }
            res.json({ configs: [] });
        }),
    );

    router.post(
        '/anomaly/configs',
        requireFeature(pool, 'anomaly_detection_suggest'),
        safe(async (req, res) => {
            if (anomalyModule?.saveConfig) {
                const saved = await anomalyModule.saveConfig(pool, req.body || {});
                return res.json(saved);
            }
            res.status(501).json({ error: 'anomaly config persistence not wired yet' });
        }),
    );

    router.get(
        '/anomaly/events',
        requireFeature(pool, 'anomaly_detection_suggest'),
        safe(async (req, res) => {
            const limit = Math.min(200, Number(req.query.limit) || 20);
            if (anomalyModule?.listRecentEvents) {
                const events = await anomalyModule.listRecentEvents(pool, { limit });
                return res.json({ events });
            }
            res.json({ events: [] });
        }),
    );

    // ── Trace correlation ────────────────────────────────────────────────
    router.get(
        '/trace/:traceId/queries',
        requireFeature(pool, 'trace_correlation'),
        safe(async (req, res) => {
            if (traceModule?.getQueriesForTrace) {
                const queries = await traceModule.getQueriesForTrace(pool, req.params.traceId);
                return res.json({ queries });
            }
            res.json({ queries: [] });
        }),
    );

    router.get(
        '/trace/:traceId/summary',
        requireFeature(pool, 'trace_correlation'),
        safe(async (req, res) => {
            if (traceModule?.summariseTrace) {
                const summary = await traceModule.summariseTrace(pool, req.params.traceId);
                return res.json(summary);
            }
            res.json({
                traceId: req.params.traceId,
                queryCount: 0,
                totalExecMs: 0,
                firstSeen: null,
                lastSeen: null,
            });
        }),
    );

    return router;
}
