// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/observabilityRoutes.js
 * ─────────────────────────────
 * Unified observability endpoints: API metrics, exceptions, uptime, audit logs, job monitoring.
 * Mount with:
 *   app.use('/api', observabilityRoutes(pool, authenticate, requireScreen));
 */

import { Router } from 'express';
import { listAuditEvents } from '../services/auditService.js';

function log(level, message, meta = {}) {
    const fn = level === 'ERROR' ? console.error : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg: message, ...meta }));
}

// Helper: Generate mock data for demo/testing
function generateMockApiMetrics() {
    const now = Date.now();
    const endpoints = [
        '/api/users',
        '/api/connections',
        '/api/audit',
        '/api/metrics',
        '/api/status',
        '/api/overview/stats',
        '/api/performance/queries',
        '/api/resources/cache-hit',
    ];

    const hours = 24;
    const data = [];
    for (let i = hours - 1; i >= 0; i--) {
        const ts = new Date(now - i * 3600000);
        data.push({
            timestamp: ts.toISOString(),
            endpoints: endpoints.map(endpoint => ({
                endpoint,
                responseTime: Math.floor(Math.random() * 500 + 50),
                errorRate: Math.floor(Math.random() * 5),
                requestCount: Math.floor(Math.random() * 1000 + 100),
            })),
        });
    }
    return data;
}

function generateMockExceptions() {
    const exceptions = [
        { message: 'Connection timeout', stack: 'at pool.query (/backend/services/db.js:45)', count: 12 },
        { message: 'Invalid SQL syntax', stack: 'at parser.parse (/backend/utils/sql.js:120)', count: 8 },
        { message: 'Authentication failed', stack: 'at middleware.authenticate (/backend/middleware/auth.js:30)', count: 5 },
        { message: 'Resource not found', stack: 'at router.get (/backend/routes/api.js:180)', count: 23 },
        { message: 'Rate limit exceeded', stack: 'at rateLimiter (/backend/server.js:288)', count: 3 },
    ];

    const heatmapData = [];
    for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
            heatmapData.push({
                day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][day],
                hour,
                count: Math.floor(Math.random() * 10),
            });
        }
    }

    return {
        recentExceptions: exceptions.map((e, i) => ({
            id: i,
            ...e,
            timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
            affectedEndpoints: ['/api/users', '/api/metrics'].slice(0, Math.floor(Math.random() * 2) + 1),
        })),
        frequencyHeatmap: heatmapData,
        topRecurring: exceptions.sort((a, b) => b.count - a.count).slice(0, 5),
        trend: {
            last7days: Array.from({ length: 7 }, (_, i) => ({
                date: new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString(),
                count: Math.floor(Math.random() * 50),
            })),
        },
    };
}

function generateMockUptimeData() {
    const now = Date.now();
    const days = 30;
    const uptimeData = [];
    let totalUptime = 0;
    let totalDowntime = 0;

    for (let i = 0; i < days; i++) {
        const uptime = Math.random() > 0.05 ? 100 : Math.floor(Math.random() * 90);
        uptimeData.push({
            date: new Date(now - (days - i) * 86400000).toLocaleDateString(),
            uptime,
            downtime: 100 - uptime,
        });
        totalUptime += uptime;
        totalDowntime += 100 - uptime;
    }

    const downtimeIncidents = [
        {
            id: 1,
            start: new Date(now - 5 * 86400000).toISOString(),
            end: new Date(now - 5 * 86400000 + 1800000).toISOString(),
            duration: 30,
            cause: 'Database maintenance',
        },
        {
            id: 2,
            start: new Date(now - 12 * 86400000).toISOString(),
            end: new Date(now - 12 * 86400000 + 600000).toISOString(),
            duration: 10,
            cause: 'Network connectivity issue',
        },
        {
            id: 3,
            start: new Date(now - 20 * 86400000).toISOString(),
            end: new Date(now - 20 * 86400000 + 1200000).toISOString(),
            duration: 20,
            cause: 'API server restart',
        },
    ];

    const avgUptimePercent = (totalUptime / days).toFixed(2);
    const mttr = downtimeIncidents.length
        ? Math.floor(downtimeIncidents.reduce((sum, inc) => sum + inc.duration, 0) / downtimeIncidents.length)
        : 0;

    return {
        uptimePercentage: parseFloat(avgUptimePercent),
        uptimeTimeline: uptimeData,
        downtimeIncidents,
        mttr,
        slaCompliance: 99.5,
    };
}

function generateMockJobsData() {
    const jobTypes = [
        'Database Backup',
        'Index Maintenance',
        'Vacuum Analysis',
        'Replication Sync',
        'Log Rotation',
        'Cache Cleanup',
    ];

    const jobs = jobTypes.map((type, i) => ({
        id: i + 1,
        name: type,
        status: ['completed', 'active', 'scheduled', 'failed'][Math.floor(Math.random() * 4)],
        nextRun: new Date(Date.now() + Math.random() * 86400000).toISOString(),
        lastRun: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        duration: Math.floor(Math.random() * 3600),
        successRate: Math.floor(Math.random() * 30 + 70),
    }));

    const timeline = jobs.flatMap(job =>
        Array.from({ length: 5 }, (_, i) => ({
            jobId: job.id,
            jobName: job.name,
            startTime: new Date(Date.now() - (4 - i) * 86400000).toISOString(),
            duration: Math.floor(Math.random() * 3600),
            status: ['success', 'success', 'success', 'failed'][Math.floor(Math.random() * 4)],
        }))
    );

    return {
        activeJobs: jobs.filter(j => j.status === 'active'),
        scheduledJobs: jobs.filter(j => j.status === 'scheduled'),
        completedJobs: jobs.filter(j => j.status === 'completed'),
        allJobs: jobs,
        executionTimeline: timeline,
        averageExecutionTime: 45 * 60,
    };
}

export default function observabilityRoutes(pool, authenticate, requireScreen) {
    const router = Router();
    const isAdmin = [authenticate, requireScreen('admin')];
    const isViewer = [authenticate];

    /* ── GET /api/observability/api-metrics ────────────────────────────────
       API endpoint performance metrics (response times, error rates, request volume)
    */
    router.get('/observability/api-metrics', ...isViewer, async (req, res) => {
        try {
            const data = generateMockApiMetrics();
            const topSlowest = [];

            // Calculate slowest endpoints
            data.forEach(hour => {
                hour.endpoints.forEach(ep => {
                    const existing = topSlowest.find(e => e.endpoint === ep.endpoint);
                    if (existing) {
                        existing.totalTime += ep.responseTime;
                        existing.count += 1;
                    } else {
                        topSlowest.push({
                            endpoint: ep.endpoint,
                            totalTime: ep.responseTime,
                            count: 1,
                        });
                    }
                });
            });

            const slowest = topSlowest
                .map(e => ({
                    endpoint: e.endpoint,
                    avgResponseTime: (e.totalTime / e.count).toFixed(2),
                }))
                .sort((a, b) => parseFloat(b.avgResponseTime) - parseFloat(a.avgResponseTime))
                .slice(0, 10);

            // Status code breakdown
            const statusCodes = [
                { status: 200, count: 8500, label: 'Success' },
                { status: 201, count: 1200, label: 'Created' },
                { status: 400, count: 150, label: 'Bad Request' },
                { status: 401, count: 80, label: 'Unauthorized' },
                { status: 404, count: 320, label: 'Not Found' },
                { status: 500, count: 45, label: 'Server Error' },
            ];

            res.json({
                timeSeriesData: data,
                topSlowestEndpoints: slowest,
                statusCodeBreakdown: statusCodes,
                totalRequests: statusCodes.reduce((sum, sc) => sum + sc.count, 0),
                averageResponseTime: 145,
                errorRate: 0.95,
            });
        } catch (err) {
            log('ERROR', 'Failed to fetch API metrics', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── GET /api/observability/exceptions ────────────────────────────────
       Exception tracking with frequency heatmap and trends
    */
    router.get('/observability/exceptions', ...isViewer, async (req, res) => {
        try {
            const data = generateMockExceptions();
            res.json(data);
        } catch (err) {
            log('ERROR', 'Failed to fetch exceptions', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── GET /api/observability/uptime ────────────────────────────────────
       Uptime/downtime monitoring with SLA compliance
    */
    router.get('/observability/uptime', ...isViewer, async (req, res) => {
        try {
            const data = generateMockUptimeData();
            res.json(data);
        } catch (err) {
            log('ERROR', 'Failed to fetch uptime data', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── GET /api/observability/audit-log ───────────────────────────────
       Filterable audit log with pagination
       Query params: level, action, username, limit, offset
    */
    router.get('/observability/audit-log', ...isAdmin, async (req, res) => {
        try {
            const result = await listAuditEvents(pool, {
                level: req.query.level,
                action: req.query.action,
                username: req.query.username,
                limit: Math.min(Number(req.query.limit) || 50, 200),
                offset: Math.max(Number(req.query.offset) || 0, 0),
            });

            // Add action type breakdown
            const allEvents = result.events || [];
            const actionBreakdown = {};
            allEvents.forEach(evt => {
                actionBreakdown[evt.action] = (actionBreakdown[evt.action] || 0) + 1;
            });

            const actionPie = Object.entries(actionBreakdown).map(([action, count]) => ({
                name: action,
                value: count,
            }));

            res.json({
                ...result,
                actionBreakdown: actionPie,
            });
        } catch (err) {
            log('ERROR', 'Failed to fetch audit log', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── GET /api/observability/jobs ───────────────────────────────────
       Job monitoring: active, scheduled, completed jobs with execution timeline
    */
    router.get('/observability/jobs', ...isViewer, async (req, res) => {
        try {
            const data = generateMockJobsData();
            res.json(data);
        } catch (err) {
            log('ERROR', 'Failed to fetch job data', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    // ── A3: Wait events ─────────────────────────────────────────────────────
    // GET /observability/wait-events?connectionId&from&to&bucket=5m|raw
    router.get('/observability/wait-events', ...isViewer, async (req, res) => {
        try {
            const { connectionId } = req.query;
            if (!connectionId) {
                return res.status(400).json({ error: 'connectionId required' });
            }
            const now = Date.now();
            const fromTs = req.query.from ? new Date(String(req.query.from)) : new Date(now - 60 * 60000);
            const toTs   = req.query.to   ? new Date(String(req.query.to))   : new Date(now);
            const bucket = String(req.query.bucket || '5m');

            const { getRollups, getRecentSamples } = await import('../services/waitEventSampler.js');
            if (bucket === 'raw') {
                const limit = Math.min(Number(req.query.limit) || 1000, 10000);
                const samples = await getRecentSamples(connectionId, fromTs, toTs, limit);
                return res.json({ bucket: 'raw', from: fromTs, to: toTs, samples });
            }
            const rollups = await getRollups(connectionId, fromTs, toTs);
            res.json({ bucket: '5m', from: fromTs, to: toTs, rollups });
        } catch (err) {
            if (/relation .* does not exist/i.test(err.message)) {
                return res.json({ bucket: req.query.bucket || '5m', rollups: [], samples: [] });
            }
            log('ERROR', 'Failed to fetch wait events', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    return router;
}
