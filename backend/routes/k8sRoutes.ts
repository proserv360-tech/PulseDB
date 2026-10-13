// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/k8sRoutes.js
 * ──────────────────
 * Kubernetes/container monitoring endpoints.
 * Mount with:
 *   app.use('/api', k8sRoutes(pool, authenticate));
 */

import { Router } from 'express';
import {
    getContainerMetrics,
    getPodInfo,
    getResourceLimits,
    getConnectionsByPod,
    getReplicaTopology,
    getK8sHealthCheck,
    getContainerResourceHistory,
} from '../services/k8sService.js';

function log(level, message, meta = {}) {
    const fn = level === 'ERROR' ? console.error : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg: message, ...meta }));
}

export default function k8sRoutes(pool, authenticate) {
    const router = Router();

    /* ── GET /api/k8s/metrics ───────────────────────────────────────────────────
       Get container metrics (CPU, memory, etc).                                */
    router.get('/k8s/metrics', authenticate, async (req, res) => {
        try {
            const metrics = await getContainerMetrics(pool);
            res.json(metrics);
        } catch (err) {
            log('ERROR', 'Failed to get container metrics', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── GET /api/k8s/pod-info ──────────────────────────────────────────────────
       Get pod/container metadata.                                              */
    router.get('/k8s/pod-info', authenticate, async (req, res) => {
        try {
            const podInfo = await getPodInfo(pool);
            res.json(podInfo);
        } catch (err) {
            log('ERROR', 'Failed to get pod info', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── GET /api/k8s/resources ────────────────────────────────────────────────
       Get resource limits vs actual usage.                                     */
    router.get('/k8s/resources', authenticate, async (req, res) => {
        try {
            const resources = await getResourceLimits(pool);
            res.json(resources);
        } catch (err) {
            log('ERROR', 'Failed to get resource limits', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── GET /api/k8s/connections ───────────────────────────────────────────────
       Get connections grouped by pod.                                          */
    router.get('/k8s/connections', authenticate, async (req, res) => {
        try {
            const connections = await getConnectionsByPod(pool);
            res.json({
                podCount: connections.length,
                pods: connections,
            });
        } catch (err) {
            log('ERROR', 'Failed to get connections by pod', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── GET /api/k8s/topology ──────────────────────────────────────────────────
       Get replica topology.                                                    */
    router.get('/k8s/topology', authenticate, async (req, res) => {
        try {
            const topology = await getReplicaTopology(pool);
            res.json(topology);
        } catch (err) {
            log('ERROR', 'Failed to get replica topology', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── GET /api/k8s/health ────────────────────────────────────────────────────
       Get Kubernetes liveness/readiness probe status.                          */
    router.get('/k8s/health', authenticate, async (req, res) => {
        try {
            const health = await getK8sHealthCheck(pool);
            res.json(health);
        } catch (err) {
            log('ERROR', 'Failed to get K8s health check', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── GET /api/k8s/history ───────────────────────────────────────────────────
       Get resource usage history.
       Query params: hours (default 24)                                         */
    router.get('/k8s/history', authenticate, async (req, res) => {
        try {
            const hours = Number(req.query.hours) || 24;
            const history = await getContainerResourceHistory(pool, hours);

            res.json({
                hours,
                count: history.length,
                data: history,
            });
        } catch (err) {
            log('ERROR', 'Failed to get container resource history', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    return router;
}
