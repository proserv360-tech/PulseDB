// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/sdkRoutes.js
 * ───────────────────
 * REST API routes for the FATHOM SDK integration.
 * Handles app registration, configuration, and event ingestion.
 * Mount with:
 *   app.use('/api', sdkRoutes(pool, authenticate, requireScreen));
 */

import { Router } from 'express';
import {
    registerApp,
    authenticateSdkKey,
    ingestEvents,
    listApps,
    getAppById,
    updateApp,
    deleteApp,
    listEvents,
    getEventStats,
    getAppDashboard,
    cleanupOldEvents,
} from '../services/sdkService.js';

function log(level, message, meta = {}) {
    const fn = level === 'ERROR' ? console.error : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg: message, ...meta }));
}

/**
 * Middleware to authenticate SDK requests via X-SDK-Key header
 */
function sdkAuthenticate(pool) {
    return async (req, res, next) => {
        try {
            const key = req.headers['x-sdk-key'] || req.headers['X-SDK-Key'];
            if (!key) {
                return res.status(401).json({ error: 'Missing X-SDK-Key header' });
            }

            const app = await authenticateSdkKey(pool, key);
            if (!app) {
                return res.status(401).json({ error: 'Invalid or expired SDK key' });
            }

            req.sdkApp = app;
            next();
        } catch (err) {
            log('ERROR', 'SDK authentication failed', { error: err.message });
            res.status(401).json({ error: 'Authentication failed' });
        }
    };
}

export default function sdkRoutes(pool, authenticate, requireScreen) {
    const router = Router();
    const isAuth = [authenticate];
    const sdkAuth = sdkAuthenticate(pool);

    /* ────────────────────────────────────────────────────────────────────────
       A) SDK Management Routes (require JWT auth + admin screen)
       ──────────────────────────────────────────────────────────────────────── */

    /**
     * POST /sdk/apps
     * Register new application
     * Body: { name, appType, environment, config }
     */
    router.post('/sdk/apps', ...isAuth, async (req, res) => {
        try {
            const { name, appType, environment, config } = req.body;

            if (!name || !appType || !environment) {
                return res.status(400).json({
                    error: 'Missing required fields: name, appType, environment',
                });
            }

            const result = await registerApp(pool, {
                name,
                appType,
                environment,
                config: config || {},
                createdBy: req.user.id,
            });

            log('INFO', 'SDK app registered', { appId: result.id, createdBy: req.user.id });
            res.status(201).json(result);
        } catch (err) {
            log('ERROR', 'Failed to register SDK app', { error: err.message });
            res.status(500).json({ error: 'Failed to register app', requestId: req.id });
        }
    });

    /**
     * GET /sdk/apps
     * List all registered apps
     * Query: status, page, limit
     */
    router.get('/sdk/apps', ...isAuth, async (req, res) => {
        try {
            const { status, page = 1, limit = 20 } = req.query;

            const result = await listApps(pool, {
                status,
                page: parseInt(page),
                limit: parseInt(limit),
            });

            res.json(result);
        } catch (err) {
            log('ERROR', 'Failed to list SDK apps', { error: err.message });
            res.status(500).json({ error: 'Failed to list apps', requestId: req.id });
        }
    });

    /**
     * GET /sdk/apps/:appId
     * Get app details + dashboard data
     */
    router.get('/sdk/apps/:appId', ...isAuth, async (req, res) => {
        try {
            const { appId } = req.params;

            const appDetails = await getAppById(pool, appId);
            if (!appDetails) {
                return res.status(404).json({ error: 'App not found' });
            }

            const dashboardData = await getAppDashboard(pool, appId);

            res.json({
                ...appDetails,
                dashboard: dashboardData,
            });
        } catch (err) {
            log('ERROR', 'Failed to get SDK app details', { error: err.message, appId: req.params.appId });
            res.status(500).json({ error: 'Failed to get app details', requestId: req.id });
        }
    });

    /**
     * PUT /sdk/apps/:appId
     * Update app settings
     * Body: { name, environment, status, config }
     */
    router.put('/sdk/apps/:appId', ...isAuth, async (req, res) => {
        try {
            const { appId } = req.params;
            const { name, environment, status, config } = req.body;

            const result = await updateApp(pool, appId, {
                name,
                environment,
                status,
                config,
            });

            if (!result) {
                return res.status(404).json({ error: 'App not found' });
            }

            log('INFO', 'SDK app updated', { appId, updatedBy: req.user.id });
            res.json(result);
        } catch (err) {
            log('ERROR', 'Failed to update SDK app', { error: err.message, appId: req.params.appId });
            res.status(500).json({ error: 'Failed to update app', requestId: req.id });
        }
    });

    /**
     * DELETE /sdk/apps/:appId
     * Disable (soft-delete) app
     */
    router.delete('/sdk/apps/:appId', ...isAuth, async (req, res) => {
        try {
            const { appId } = req.params;

            const result = await deleteApp(pool, appId);
            if (!result) {
                return res.status(404).json({ error: 'App not found' });
            }

            log('INFO', 'SDK app deleted', { appId, deletedBy: req.user.id });
            res.json({ message: 'App disabled successfully' });
        } catch (err) {
            log('ERROR', 'Failed to delete SDK app', { error: err.message, appId: req.params.appId });
            res.status(500).json({ error: 'Failed to delete app', requestId: req.id });
        }
    });

    /**
     * GET /sdk/apps/:appId/events
     * List events for an app
     * Query: eventType, severity, search, from, to, page, limit
     */
    router.get('/sdk/apps/:appId/events', ...isAuth, async (req, res) => {
        try {
            const { appId } = req.params;
            const { eventType, severity, search, from, to, page = 1, limit = 50 } = req.query;

            const result = await listEvents(pool, appId, {
                eventType,
                severity,
                search,
                from: from ? new Date(from) : undefined,
                to: to ? new Date(to) : undefined,
                page: parseInt(page),
                limit: Math.min(parseInt(limit), 100),
            });

            res.json(result);
        } catch (err) {
            log('ERROR', 'Failed to list SDK events', { error: err.message, appId: req.params.appId });
            res.status(500).json({ error: 'Failed to list events', requestId: req.id });
        }
    });

    /**
     * GET /sdk/apps/:appId/stats
     * Get aggregated stats
     * Query: from, to, groupBy (hour|day|minute)
     */
    router.get('/sdk/apps/:appId/stats', ...isAuth, async (req, res) => {
        try {
            const { appId } = req.params;
            const { from, to, groupBy = 'day' } = req.query;

            if (!['hour', 'day', 'minute'].includes(groupBy)) {
                return res.status(400).json({
                    error: 'Invalid groupBy value. Must be one of: hour, day, minute',
                });
            }

            const result = await getEventStats(pool, {
                appId,
                fromDate: from ? new Date(from) : undefined,
                toDate: to ? new Date(to) : undefined,
                groupBy,
            });

            res.json(result);
        } catch (err) {
            log('ERROR', 'Failed to get SDK stats', { error: err.message, appId: req.params.appId });
            res.status(500).json({ error: 'Failed to get stats', requestId: req.id });
        }
    });

    /**
     * POST /sdk/apps/:appId/regenerate-key
     * Generate new API key for an app
     */
    router.post('/sdk/apps/:appId/regenerate-key', ...isAuth, async (req, res) => {
        try {
            const { appId } = req.params;

            const app = await getAppById(pool, appId);
            if (!app) {
                return res.status(404).json({ error: 'App not found' });
            }

            // Re-register to generate a new key
            const result = await registerApp(pool, {
                id: appId,
                name: app.name,
                appType: app.app_type,
                environment: app.environment,
                config: app.config,
                createdBy: app.created_by,
            });

            log('INFO', 'SDK key regenerated', { appId, regeneratedBy: req.user.id });
            res.json({
                message: 'New SDK key generated',
                apiKey: result.apiKey,
                app: result,
            });
        } catch (err) {
            log('ERROR', 'Failed to regenerate SDK key', { error: err.message, appId: req.params.appId });
            res.status(500).json({ error: 'Failed to regenerate key', requestId: req.id });
        }
    });

    /* ────────────────────────────────────────────────────────────────────────
       B) SDK Ingestion Routes (authenticated via X-SDK-Key header)
       ──────────────────────────────────────────────────────────────────────── */

    /**
     * POST /sdk/ingest
     * Bulk event ingestion
     * Header: X-SDK-Key: sk_live_xxx
     * Body: { events: [{ eventType, severity, title, message, metadata, tags, durationMs, statusCode, endpoint, httpMethod, errorType, stackTrace }] }
     */
    router.post('/sdk/ingest', sdkAuth, async (req, res) => {
        try {
            const { events } = req.body;

            if (!Array.isArray(events)) {
                return res.status(400).json({
                    error: 'Body must contain "events" array',
                });
            }

            if (events.length === 0) {
                return res.status(400).json({
                    error: 'Events array cannot be empty',
                });
            }

            if (events.length > 100) {
                return res.status(400).json({
                    error: 'Maximum 100 events per request',
                });
            }

            // Validate each event has required fields
            for (const event of events) {
                if (!event.eventType || !event.severity || !event.title) {
                    return res.status(400).json({
                        error: 'Each event must have eventType, severity, and title',
                    });
                }
            }

            const result = await ingestEvents(pool, req.sdkApp.id, events);

            log('INFO', 'Events ingested', { appId: req.sdkApp.id, count: events.length });
            res.json({ ingested: result.count });
        } catch (err) {
            log('ERROR', 'Failed to ingest events', { error: err.message, appId: req.sdkApp?.id });
            res.status(500).json({ error: 'Failed to ingest events', requestId: req.id });
        }
    });

    /**
     * POST /sdk/heartbeat
     * Health check from SDK
     * Header: X-SDK-Key: sk_live_xxx
     * Body: { status, metadata }
     */
    router.post('/sdk/heartbeat', sdkAuth, async (req, res) => {
        try {
            const { status, metadata } = req.body;

            if (!status) {
                return res.status(400).json({
                    error: 'Missing required field: status',
                });
            }

            // Ingest a heartbeat event
            const heartbeatEvent = {
                eventType: 'heartbeat',
                severity: status === 'ok' ? 'info' : 'warning',
                title: 'SDK Heartbeat',
                message: `SDK heartbeat received with status: ${status}`,
                metadata: metadata || {},
                tags: ['heartbeat'],
            };

            await ingestEvents(pool, req.sdkApp.id, [heartbeatEvent]);

            log('INFO', 'Heartbeat received', { appId: req.sdkApp.id, status });
            res.json({ acknowledged: true });
        } catch (err) {
            log('ERROR', 'Failed to process heartbeat', { error: err.message, appId: req.sdkApp?.id });
            res.status(500).json({ error: 'Failed to process heartbeat', requestId: req.id });
        }
    });

    /**
     * GET /sdk/health
     * Public health check (no auth needed)
     */
    router.get('/sdk/health', async (req, res) => {
        try {
            res.json({
                status: 'ok',
                version: '1.0.0',
                timestamp: new Date().toISOString(),
            });
        } catch (err) {
            log('ERROR', 'Health check failed', { error: err.message });
            res.status(500).json({ error: 'Health check failed' });
        }
    });

    return router;
}
