// @ts-nocheck — legacy JS style to match sibling routes; type later (see docs/TS_MIGRATION.md)
/**
 * routes/cloudInsightsRoutes.js
 * Per-tenant cloud-managed database insights (RDS/Aurora + MongoDB Atlas).
 *
 * Factory: app.use('/api', cloudInsightsRoutes(authenticate))
 *
 * Endpoints
 *   GET    /api/cloud/credentials              list (secrets never returned)
 *   POST   /api/cloud/credentials              upsert a credential   (admin)
 *   DELETE /api/cloud/credentials/:id          remove a credential   (admin)
 *   GET    /api/cloud/aws/status               resolver-aware CW status
 *   GET    /api/cloud/aws/metrics?metric=...   RDS/Aurora metric series
 *   GET    /api/cloud/atlas/status             Atlas config status
 *   GET    /api/cloud/atlas/measurements       Atlas process measurements
 *   GET    /api/cloud/atlas/processes          Atlas process discovery (host:port)
 *   GET    /api/cloud/atlas/clusters           Atlas cluster discovery
 */
import { Router } from 'express';
import {
    saveCredential,
    listCredentials,
    deleteCredential,
    getAwsMetric,
    getAwsStatus,
    getAtlasMeasurements,
    getAtlasStatus,
    listAtlasProcesses,
    listAtlasClusters,
    SUPPORTED_PROVIDERS,
} from '../services/cloudInsightsService.js';
import { resolveWorkspace, requireWorkspaceRole } from '../middleware/workspaceRbac.js';

export default function cloudInsightsRoutes(authenticate) {
    const router = Router();

    router.get(
        '/cloud/credentials',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                res.json({ credentials: await listCredentials(req.workspace?.id) });
            } catch (e) {
                next(e);
            }
        },
    );

    router.post(
        '/cloud/credentials',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('admin'),
        async (req, res, next) => {
            try {
                const { provider, label, region, resourceId, accessId, secret, extra } = req.body || {};
                if (!SUPPORTED_PROVIDERS.includes(provider)) {
                    return res
                        .status(400)
                        .json({ error: 'provider must be one of: ' + SUPPORTED_PROVIDERS.join(', ') });
                }
                const saved = await saveCredential({
                    workspaceId: req.workspace?.id,
                    provider,
                    label,
                    region,
                    resourceId,
                    accessId,
                    secret,
                    extra,
                });
                res.status(201).json(saved);
            } catch (e) {
                next(e);
            }
        },
    );

    router.delete(
        '/cloud/credentials/:id',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('admin'),
        async (req, res, next) => {
            try {
                const removed = await deleteCredential({ id: Number(req.params.id), workspaceId: req.workspace?.id });
                if (!removed) return res.status(404).json({ error: 'not found' });
                res.json({ deleted: removed });
            } catch (e) {
                next(e);
            }
        },
    );

    // AWS RDS/Aurora
    router.get(
        '/cloud/aws/status',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                res.json(await getAwsStatus(req.workspace?.id));
            } catch (e) {
                next(e);
            }
        },
    );

    router.get(
        '/cloud/aws/metrics',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const { metric, period, startTime, endTime } = req.query;
                if (!metric) return res.status(400).json({ error: 'metric query param required' });
                const datapoints = await getAwsMetric(req.workspace?.id, String(metric), Number(period) || 3600, {
                    startTime,
                    endTime,
                });
                res.json({ metric, datapoints });
            } catch (e) {
                next(e);
            }
        },
    );

    // MongoDB Atlas
    router.get(
        '/cloud/atlas/status',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                res.json(await getAtlasStatus(req.workspace?.id));
            } catch (e) {
                next(e);
            }
        },
    );

    router.get(
        '/cloud/atlas/measurements',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const metrics = req.query.m ? (Array.isArray(req.query.m) ? req.query.m : [req.query.m]) : undefined;
                res.json({ measurements: await getAtlasMeasurements(req.workspace?.id, { metrics }) });
            } catch (e) {
                next(e);
            }
        },
    );

    router.get(
        '/cloud/atlas/processes',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                res.json({ processes: await listAtlasProcesses(req.workspace?.id) });
            } catch (e) {
                next(e);
            }
        },
    );

    router.get(
        '/cloud/atlas/clusters',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                res.json({ clusters: await listAtlasClusters(req.workspace?.id) });
            } catch (e) {
                next(e);
            }
        },
    );

    return router;
}
