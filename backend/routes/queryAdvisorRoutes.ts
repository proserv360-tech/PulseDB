/**
 * routes/queryAdvisorRoutes.ts
 * Continuous query advisor API (gap-analysis P1-1).
 *
 * Mount: app.use(prefix, queryAdvisorRoutes(pool, authenticate, reqPool));
 *
 * SECURITY (audit 2026-06-10, HIGH-1): workspace is derived from the
 * authenticated user's membership via resolveWorkspace — never from a
 * client-supplied workspaceId query param, which previously allowed
 * cross-tenant reads/writes.
 */
import { Router } from 'express';
import {
    runAdvisorSweep,
    listRecommendations,
    setRecommendationStatus,
    benchmarkRewrite,
} from '../services/queryAdvisorService.js';
import { resolveWorkspace, requireWorkspaceRole } from '../middleware/workspaceRbac.js';

export default function queryAdvisorRoutes(pool: any, authenticate: any, reqPool: any) {
    const router = Router();

    router.get(
        '/query-advisor/recommendations',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req: any, res: any) => {
            try {
                const rows = await listRecommendations({
                    controlPool: pool,
                    workspaceId: req.workspace.id,
                    status: req.query.status === 'all' ? null : req.query.status || 'open',
                    limit: req.query.limit,
                });
                res.json({ recommendations: rows });
            } catch (e: any) {
                res.status(500).json({ error: e.message });
            }
        },
    );

    router.post(
        '/query-advisor/sweep',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req: any, res: any) => {
            try {
                res.json(
                    await runAdvisorSweep({
                        controlPool: pool,
                        workspaceId: req.workspace.id,
                        connectionId: req.query.connectionId || null,
                    }),
                );
            } catch (e: any) {
                res.status(500).json({ error: e.message });
            }
        },
    );

    router.post(
        '/query-advisor/recommendations/:id/status',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req: any, res: any) => {
            try {
                res.json(
                    await setRecommendationStatus({
                        controlPool: pool,
                        id: Number(req.params.id),
                        workspaceId: req.workspace.id,
                        status: String(req.body?.status || ''),
                    }),
                );
            } catch (e: any) {
                const code = /not found/.test(e.message) ? 404 : /invalid/.test(e.message) ? 400 : 500;
                res.status(code).json({ error: e.message });
            }
        },
    );

    router.post('/query-advisor/benchmark', authenticate, async (req: any, res: any) => {
        try {
            const targetPool = await reqPool(req);
            const { original, rewrite, analyze } = req.body || {};
            res.json(await benchmarkRewrite({ targetPool, original, rewrite, analyze: !!analyze }));
        } catch (e: any) {
            const code = /read-only SELECT/.test(e.message) ? 400 : 500;
            res.status(code).json({ error: e.message });
        }
    });

    return router;
}
