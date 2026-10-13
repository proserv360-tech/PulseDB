// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
// ═════════════════════════════════════════════════════════════════════════════
// METRICS ROUTES — API endpoints for dynamic metrics registry and data
// ═════════════════════════════════════════════════════════════════════════════

import express from 'express';
import {
    getMetricsForDbType,
    getAllCategories,
    getMetricById,
    getMetricsByCategory,
    evaluateMetricHealth,
} from '../services/metricsRegistry.js';

export default function metricsRoutes(pool, authenticate) {
    const router = express.Router();

    // ── GET /metrics/registry ─ Return metric definitions for active connection's DB type ───
    router.get('/metrics/registry', authenticate, async (req, res) => {
        try {
            // Default to PostgreSQL; in a full implementation, fetch from session context
            const dbType = req.query.dbType || 'postgresql';
            const metrics = getMetricsForDbType(dbType);

            if (!metrics || metrics.length === 0) {
                return res.status(404).json({ error: `No metrics defined for database type: ${dbType}` });
            }

            res.json({
                success: true,
                dbType,
                count: metrics.length,
                metrics: metrics.map(m => ({
                    id: m.id,
                    label: m.label,
                    unit: m.unit,
                    category: m.category,
                    description: m.description,
                    thresholds: m.thresholds,
                })),
            });
        } catch (error) {
            console.error('Error fetching metrics registry:', error);
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    // ── GET /metrics/registry/:dbType ─ Return metric definitions for specific DB type ───
    router.get('/metrics/registry/:dbType', authenticate, (req, res) => {
        try {
            const { dbType } = req.params;
            const metrics = getMetricsForDbType(dbType);

            if (!metrics || metrics.length === 0) {
                return res.status(404).json({ error: `No metrics defined for database type: ${dbType}` });
            }

            res.json({
                success: true,
                dbType,
                count: metrics.length,
                metrics: metrics.map(m => ({
                    id: m.id,
                    label: m.label,
                    unit: m.unit,
                    category: m.category,
                    description: m.description,
                    thresholds: m.thresholds,
                })),
            });
        } catch (error) {
            console.error('Error fetching metrics registry:', error);
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    // ── GET /metrics/categories ─ Return available metric categories ───────────────────
    router.get('/metrics/categories', authenticate, (req, res) => {
        try {
            const categories = getAllCategories();
            res.json({
                success: true,
                categories,
            });
        } catch (error) {
            console.error('Error fetching categories:', error);
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    // ── GET /metrics/current ─ Fetch current metric values (executes queries) ──────────
    router.get('/metrics/current', authenticate, async (req, res) => {
        try {
            const dbType = req.query.dbType || 'postgresql';
            const metrics = getMetricsForDbType(dbType);
            const current = {};

            if (!pool) {
                // Demo mode: return mock values
                metrics.forEach(m => {
                    const mockValue = Math.random() * 100;
                    const health = evaluateMetricHealth(m.id, mockValue, dbType);
                    current[m.id] = {
                        value: Math.round(mockValue * 100) / 100,
                        unit: m.unit,
                        label: m.label,
                        status: health.status,
                        timestamp: new Date().toISOString(),
                    };
                });
            } else {
                // Real mode: execute queries (for PostgreSQL)
                for (const metric of metrics) {
                    try {
                        const result = await pool.query(metric.query);
                        const value = result.rows[0] ? Object.values(result.rows[0])[0] : null;
                        const health = evaluateMetricHealth(metric.id, value, dbType);

                        current[metric.id] = {
                            value,
                            unit: metric.unit,
                            label: metric.label,
                            status: health.status,
                            timestamp: new Date().toISOString(),
                        };
                    } catch (queryError) {
                        // Log query error but continue processing other metrics
                        console.warn(`Failed to execute query for metric ${metric.id}:`, queryError.message);
                        current[metric.id] = {
                            value: null,
                            unit: metric.unit,
                            label: metric.label,
                            status: 'unknown',
                            error: queryError.message,
                            timestamp: new Date().toISOString(),
                        };
                    }
                }
            }

            res.json({
                success: true,
                dbType,
                current,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            console.error('Error fetching current metrics:', error);
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    // ── GET /metrics/history/:metricId ─ Return time-series data for a metric ─────────
    router.get('/metrics/history/:metricId', authenticate, async (req, res) => {
        try {
            const { metricId } = req.params;
            const dbType = req.query.dbType || 'postgresql';
            const hours = req.query.hours || 24;

            // Generate mock time-series data (24 hours)
            const now = new Date();
            const history = Array.from({ length: Math.min(parseInt(hours), 24) }, (_, i) => {
                const timestamp = new Date(now.getTime() - (hours - i - 1) * 3600000);
                const variance = Math.random() * 10 - 5; // ±5% variance
                const baseValue = 75 + variance;

                return {
                    timestamp: timestamp.toISOString(),
                    value: Math.round(baseValue * 100) / 100,
                };
            });

            const metric = getMetricById(metricId, dbType);
            if (!metric) {
                return res.status(404).json({ error: `Metric not found: ${metricId}` });
            }

            res.json({
                success: true,
                metricId,
                metric: {
                    label: metric.label,
                    unit: metric.unit,
                    category: metric.category,
                },
                history,
                range: `${hours}h`,
            });
        } catch (error) {
            console.error('Error fetching metric history:', error);
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    // ── GET /metrics/health ─ Get health summary for all metrics ──────────────────────
    router.get('/metrics/health', authenticate, async (req, res) => {
        try {
            const dbType = req.query.dbType || 'postgresql';
            const metrics = getMetricsForDbType(dbType);
            const health = { ok: 0, warning: 0, critical: 0, unknown: 0 };

            metrics.forEach(m => {
                const mockValue = Math.random() * 100;
                const h = evaluateMetricHealth(m.id, mockValue, dbType);
                health[h.status]++;
            });

            res.json({
                success: true,
                dbType,
                health,
                total: metrics.length,
            });
        } catch (error) {
            console.error('Error fetching health:', error);
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    // ── GET /metrics/by-category/:category ─ Return metrics for a specific category ────
    router.get('/metrics/by-category/:category', authenticate, (req, res) => {
        try {
            const { category } = req.params;
            const dbType = req.query.dbType || 'postgresql';
            const metrics = getMetricsByCategory(category, dbType);

            if (metrics.length === 0) {
                return res.status(404).json({ error: `No metrics found in category: ${category}` });
            }

            res.json({
                success: true,
                category,
                dbType,
                count: metrics.length,
                metrics: metrics.map(m => ({
                    id: m.id,
                    label: m.label,
                    unit: m.unit,
                    description: m.description,
                    thresholds: m.thresholds,
                })),
            });
        } catch (error) {
            console.error('Error fetching metrics by category:', error);
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    return router;
}
