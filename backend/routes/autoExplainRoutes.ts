// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/autoExplainRoutes.js — C6 auto_explain ingest + read.
 *
 *   POST /api/auto-explain/ingest    — log shipper writes a batch
 *   GET  /api/auto-explain/recent    — operator views recent events
 *   GET  /api/auto-explain/summary   — group by query_id
 *
 * Ingest auth: x-sdk-key header (same envelope as the OTLP route).
 *   We resolve the API key to a workspace + connection, then call
 *   ingestBatch with workspace-scoped credentials.
 * Read auth: standard authenticate + resolveWorkspace + viewer role.
 */

import { Router } from 'express';
import { ingestBatch, listRecent, summariseByQuery } from '../services/autoExplainService.js';
import { getPlanRegressions } from '../services/planInsightsService.js';
import { resolveWorkspace, requireWorkspaceRole } from '../middleware/workspaceRbac.js';

export default function autoExplainRoutes(pool, authenticate, authenticateSdkKey) {
    const router = Router();

    router.post('/auto-explain/ingest', async (req, res, next) => {
        try {
            const sdkKey = req.headers['x-sdk-key'];
            if (!sdkKey) return res.status(401).json({ error: 'x-sdk-key required' });
            const app = typeof authenticateSdkKey === 'function' ? await authenticateSdkKey(pool, sdkKey) : null;
            if (!app) return res.status(401).json({ error: 'invalid_sdk_key' });

            const workspaceId = app.org_id || app.workspace_id || null;
            if (!workspaceId) return res.status(401).json({ error: 'workspace unresolved' });

            const { connectionId, events } = req.body || {};
            if (!connectionId) return res.status(400).json({ error: 'connectionId required' });
            if (!Array.isArray(events) || events.length === 0) {
                return res.status(400).json({ error: 'events array required' });
            }
            if (events.length > 500) {
                return res.status(413).json({ error: 'batch_too_large', limit: 500 });
            }
            const result = await ingestBatch({ workspaceId, connectionId, events });
            res.status(202).json(result);
        } catch (err) {
            next(err);
        }
    });

    router.get(
        '/auto-explain/recent',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const connectionId = Number(req.query.connectionId);
                if (!Number.isInteger(connectionId) || connectionId <= 0) {
                    return res.status(400).json({ error: 'connectionId required' });
                }
                const now = Date.now();
                const fromTs = req.query.from ? new Date(String(req.query.from)) : new Date(now - 6 * 3600_000);
                const toTs = req.query.to ? new Date(String(req.query.to)) : new Date(now);
                const limit = Math.min(Number(req.query.limit) || 200, 1000);
                const rows = await listRecent({
                    workspaceId: req.workspace.id,
                    connectionId,
                    fromTs,
                    toTs,
                    limit,
                });
                res.json({ from: fromTs, to: toTs, events: rows });
            } catch (err) {
                if (/relation .* does not exist/i.test(err.message)) return res.json({ events: [] });
                next(err);
            }
        },
    );

    router.get(
        '/auto-explain/summary',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const connectionId = Number(req.query.connectionId);
                if (!Number.isInteger(connectionId) || connectionId <= 0) {
                    return res.status(400).json({ error: 'connectionId required' });
                }
                const now = Date.now();
                const fromTs = req.query.from ? new Date(String(req.query.from)) : new Date(now - 24 * 3600_000);
                const toTs = req.query.to ? new Date(String(req.query.to)) : new Date(now);
                const rows = await summariseByQuery({
                    workspaceId: req.workspace.id,
                    connectionId,
                    fromTs,
                    toTs,
                });
                res.json({ from: fromTs, to: toTs, queries: rows });
            } catch (err) {
                if (/relation .* does not exist/i.test(err.message)) return res.json({ queries: [] });
                next(err);
            }
        },
    );

    router.get(
        '/auto-explain/regressions',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const connectionId = Number(req.query.connectionId);
                if (!Number.isInteger(connectionId) || connectionId <= 0) {
                    return res.status(400).json({ error: 'connectionId required' });
                }
                const now = Date.now();
                const fromTs = req.query.from ? new Date(String(req.query.from)) : new Date(now - 24 * 3600_000);
                const toTs = req.query.to ? new Date(String(req.query.to)) : new Date(now);
                const minSlowdownPct = Number(req.query.minSlowdownPct) || 30;
                const minSamples = Number(req.query.minSamples) || 3;
                const result = await getPlanRegressions(pool, {
                    workspaceId: req.workspace.id,
                    connectionId,
                    fromTs,
                    toTs,
                    minSlowdownPct,
                    minSamples,
                });
                res.json(result);
            } catch (err) {
                if (/relation .* does not exist/i.test(err.message)) return res.json({ regressions: [] });
                next(err);
            }
        },
    );

    return router;
}
