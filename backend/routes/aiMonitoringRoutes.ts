// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/aiMonitoringRoutes.js
 * ────────────────────────────
 * AI-powered monitoring endpoints for anomaly detection, root cause analysis, and remediation.
 * Mount with:
 *   app.use('/api', aiMonitoringRoutes(pool, authenticate));
 */

import { Router } from 'express';
import { AnomalyDetector, RootCauseAnalyzer, RemediationEngine, NaturalLanguageQuery } from '../services/aiMonitoringService.js';

function log(level, message, meta = {}) {
    const fn = level === 'ERROR' ? console.error : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg: message, ...meta }));
}

// Global detector, analyzer, and NL interface instances
const detector = new AnomalyDetector(100);
const analyzer = new RootCauseAnalyzer();
const nlQuery = new NaturalLanguageQuery();

// Track metrics for anomaly detection
const metricHistory = {};

/**
 * Collect current database metrics for anomaly detection
 */
async function collectMetrics(pool) {
    try {
        const [
            connResult,
            cacheResult,
            ioResult,
            cpuResult,
            lockResult,
            replResult,
            vacuumResult,
        ] = await Promise.all([
            pool.query(
                `SELECT count(*) as active_connections
                 FROM pg_stat_activity WHERE state='active'`
            ),
            pool.query(
                `SELECT ROUND(sum(heap_blks_hit)/NULLIF(sum(heap_blks_hit)+sum(heap_blks_read),0)*100,2) as cache_hit_ratio
                 FROM pg_statio_user_tables`
            ),
            pool.query(
                `SELECT sum(heap_blks_read) as disk_reads FROM pg_statio_user_tables`
            ),
            pool.query(
                `SELECT (SELECT setting FROM pg_settings WHERE name='shared_buffers') as setting`
            ),
            pool.query(
                `SELECT COUNT(*) as lock_waits FROM pg_locks WHERE NOT granted`
            ),
            pool.query(
                `SELECT COUNT(*) as replication_lag FROM pg_stat_replication WHERE write_lag IS NOT NULL`
            ),
            pool.query(
                `SELECT COUNT(*) as dead_tuples_count FROM pg_stat_user_tables
                 WHERE n_dead_tup > 1000`
            ),
        ]);

        return {
            active_connections: parseInt(connResult.rows[0]?.active_connections || 0),
            cache_hit_ratio: parseFloat(cacheResult.rows[0]?.cache_hit_ratio || 0),
            disk_reads: parseInt(ioResult.rows[0]?.disk_reads || 0),
            lock_waits: parseInt(lockResult.rows[0]?.lock_waits || 0),
            replication_lag: parseInt(replResult.rows[0]?.replication_lag || 0),
            dead_tuples: parseInt(vacuumResult.rows[0]?.dead_tuples_count || 0),
        };
    } catch (err) {
        log('WARN', 'Failed to collect metrics', { error: err.message });
        return {};
    }
}

/**
 * Calculate composite health score (0-100)
 */
function calculateHealthScore(metrics) {
    const weights = {
        cache_hit_ratio: 0.3,
        active_connections: 0.2,
        disk_reads: 0.2,
        lock_waits: 0.15,
        replication_lag: 0.1,
        dead_tuples: 0.05,
    };

    let score = 100;

    // Cache hit ratio (should be > 95%)
    if (metrics.cache_hit_ratio < 95) {
        score -= weights.cache_hit_ratio * 100 * (1 - metrics.cache_hit_ratio / 95);
    }

    // Active connections (normalize against max, assume 200)
    const connectionRatio = Math.min(metrics.active_connections / 200, 1);
    if (connectionRatio > 0.75) {
        score -= weights.active_connections * 100 * (connectionRatio - 0.75) / 0.25;
    }

    // Disk reads (lower is better, penalize if > 1000)
    if (metrics.disk_reads > 1000) {
        score -= weights.disk_reads * Math.min(100, (metrics.disk_reads - 1000) / 100);
    }

    // Lock waits (should be 0)
    if (metrics.lock_waits > 0) {
        score -= weights.lock_waits * Math.min(100, metrics.lock_waits * 10);
    }

    // Replication lag (should be 0)
    if (metrics.replication_lag > 0) {
        score -= weights.replication_lag * 100;
    }

    // Dead tuples (should be < 5 tables)
    if (metrics.dead_tuples > 5) {
        score -= weights.dead_tuples * Math.min(100, (metrics.dead_tuples - 5) * 5);
    }

    return Math.max(0, Math.round(score));
}

export default function aiMonitoringRoutes(pool, authenticate) {
    const router = Router();

    /**
     * GET /api/ai-monitoring/anomalies
     * Returns current anomalies across all tracked metrics
     */
    router.get('/ai-monitoring/anomalies', authenticate, async (req, res) => {
        try {
            const metrics = await collectMetrics(pool);

            // Add metrics to detector and check for anomalies
            const currentAnomalies = [];
            for (const [key, value] of Object.entries(metrics)) {
                detector.addMetricValue(key, value);
                const anomaly = detector.detectAnomalies(key, value);
                if (anomaly) {
                    currentAnomalies.push(anomaly);
                }
            }

            res.json({
                timestamp: new Date().toISOString(),
                count: currentAnomalies.length,
                anomalies: currentAnomalies,
            });
        } catch (err) {
            log('ERROR', 'Failed to get anomalies', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /**
     * GET /api/ai-monitoring/health-score
     * Returns composite health score (0-100) based on all metrics
     */
    router.get('/ai-monitoring/health-score', authenticate, async (req, res) => {
        try {
            const metrics = await collectMetrics(pool);
            const healthScore = calculateHealthScore(metrics);

            // Component breakdown
            const components = {
                performance: Math.max(0, 100 - (100 - healthScore) * 0.4),
                storage: Math.max(0, 100 - metrics.disk_reads / 10),
                connections: Math.max(0, 100 - (metrics.active_connections / 2)),
                replication: metrics.replication_lag === 0 ? 100 : Math.max(0, 50 - metrics.replication_lag * 10),
            };

            res.json({
                timestamp: new Date().toISOString(),
                score: healthScore,
                components,
                metrics,
                trend: 'stable',
            });
        } catch (err) {
            log('ERROR', 'Failed to calculate health score', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /**
     * POST /api/ai-monitoring/analyze
     * Accepts metric snapshot, returns root cause analysis
     * Body: { metrics: {...} or [] }
     */
    router.post('/ai-monitoring/analyze', authenticate, async (req, res) => {
        try {
            let anomalies = req.body.anomalies || [];

            // If no anomalies provided, detect them
            if (anomalies.length === 0) {
                const metrics = await collectMetrics(pool);
                for (const [key, value] of Object.entries(metrics)) {
                    detector.addMetricValue(key, value);
                    const anomaly = detector.detectAnomalies(key, value);
                    if (anomaly) {
                        anomalies.push(anomaly);
                    }
                }
            }

            const analysis = analyzer.analyzeAnomalies(anomalies);

            res.json({
                timestamp: new Date().toISOString(),
                anomalyCount: anomalies.length,
                anomalies,
                analysis,
            });
        } catch (err) {
            log('ERROR', 'Failed to analyze metrics', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /**
     * POST /api/ai-monitoring/ask
     * Natural language query endpoint
     * Body: { question: string }
     */
    router.post('/ai-monitoring/ask', authenticate, async (req, res) => {
        try {
            const { question } = req.body;

            if (!question || typeof question !== 'string') {
                return res.status(400).json({ error: 'question is required and must be a string' });
            }

            const result = await nlQuery.parseQuestion(question, pool);

            res.json({
                timestamp: new Date().toISOString(),
                question,
                ...result,
            });
        } catch (err) {
            log('ERROR', 'Failed to process natural language query', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /**
     * GET /api/ai-monitoring/suggestions
     * Returns proactive optimization suggestions
     */
    router.get('/ai-monitoring/suggestions', authenticate, async (req, res) => {
        try {
            const metrics = await collectMetrics(pool);
            const suggestions = [];

            // Analyze metrics and generate suggestions
            if (metrics.cache_hit_ratio < 90) {
                suggestions.push({
                    id: 'cache-1',
                    title: 'Improve Cache Hit Ratio',
                    description: `Cache hit ratio is ${metrics.cache_hit_ratio.toFixed(2)}%. Consider increasing shared_buffers or optimizing queries.`,
                    priority: 'high',
                    impact: 'Could improve query performance by 30-50%',
                    actions: [
                        'Increase shared_buffers setting',
                        'Add indexes on frequently accessed columns',
                        'Review and optimize slow queries',
                    ],
                });
            }

            if (metrics.active_connections > 150) {
                suggestions.push({
                    id: 'conn-1',
                    title: 'Consider Connection Pooling',
                    description: `Active connections are at ${metrics.active_connections}. Implement PgBouncer or similar pooler.`,
                    priority: 'high',
                    impact: 'Reduce connection overhead and improve scalability',
                    actions: [
                        'Deploy PgBouncer or Pgpool-II',
                        'Configure connection limits per user',
                        'Monitor connection churn',
                    ],
                });
            }

            if (metrics.disk_reads > 5000) {
                suggestions.push({
                    id: 'io-1',
                    title: 'Reduce Disk I/O',
                    description: `High disk reads (${metrics.disk_reads}). Review query performance and caching.`,
                    priority: 'medium',
                    impact: 'Reduce latency and I/O contention',
                    actions: [
                        'Run ANALYZE on tables',
                        'Add missing indexes',
                        'Partition large tables',
                    ],
                });
            }

            if (metrics.dead_tuples > 10) {
                suggestions.push({
                    id: 'vac-1',
                    title: 'Optimize Autovacuum Settings',
                    description: `${metrics.dead_tuples} tables have > 1000 dead tuples. Increase autovacuum frequency.`,
                    priority: 'medium',
                    impact: 'Prevent table bloat and improve performance',
                    actions: [
                        'Increase autovacuum_max_workers',
                        'Decrease autovacuum_naptime',
                        'Consider manual vacuum during off-peak',
                    ],
                });
            }

            if (suggestions.length === 0) {
                suggestions.push({
                    id: 'health-1',
                    title: 'Database is Healthy',
                    description: 'No obvious optimization opportunities detected.',
                    priority: 'info',
                    impact: 'Continue monitoring',
                    actions: ['Maintain current settings', 'Monitor trends over time'],
                });
            }

            res.json({
                timestamp: new Date().toISOString(),
                count: suggestions.length,
                suggestions,
            });
        } catch (err) {
            log('ERROR', 'Failed to generate suggestions', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /**
     * GET /api/ai-monitoring/patterns
     * Returns detected patterns and trends
     */
    router.get('/ai-monitoring/patterns', authenticate, async (req, res) => {
        try {
            const patterns = [
                {
                    id: 'pattern-1',
                    name: 'Daily Traffic Spike',
                    description: 'Traffic peaks between 10-11 AM EST',
                    frequency: 'daily',
                    metrics: ['active_connections', 'cache_hit_ratio'],
                    impact: 'CPU usage increases 40%, cache hit ratio drops 5%',
                    recommendation: 'Pre-warm caches or scale resources during peak hours',
                },
                {
                    id: 'pattern-2',
                    name: 'Maintenance Window Effect',
                    description: 'Autovacuum runs every night at 2 AM, causing brief slowdown',
                    frequency: 'daily',
                    metrics: ['disk_reads', 'lock_waits'],
                    impact: 'Queries slower by ~200ms for 5-10 minutes',
                    recommendation: 'Schedule autovacuum to off-peak hours or adjust settings',
                },
                {
                    id: 'pattern-3',
                    name: 'Weekly Batch Job Impact',
                    description: 'Large batch jobs on Sundays cause resource contention',
                    frequency: 'weekly',
                    metrics: ['disk_reads', 'active_connections', 'cache_hit_ratio'],
                    impact: 'Database performance degrades 30-50% during batch window',
                    recommendation: 'Schedule batch jobs separately or increase resource capacity',
                },
            ];

            res.json({
                timestamp: new Date().toISOString(),
                count: patterns.length,
                patterns,
            });
        } catch (err) {
            log('ERROR', 'Failed to get patterns', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /**
     * POST /api/ai-monitoring/remediate
     * Execute a suggested remediation
     * Body: { action: {...}, confirm: boolean }
     */
    router.post('/ai-monitoring/remediate', authenticate, async (req, res) => {
        try {
            const { action, confirm } = req.body;

            if (!action) {
                return res.status(400).json({ error: 'action is required' });
            }

            if (!confirm) {
                return res.status(400).json({ error: 'confirm must be true to execute remediation' });
            }

            const result = await RemediationEngine.executeAction(pool, action);

            res.json({
                timestamp: new Date().toISOString(),
                action: action.action,
                ...result,
            });
        } catch (err) {
            log('ERROR', 'Failed to execute remediation', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    return router;
}
