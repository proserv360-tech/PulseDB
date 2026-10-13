/**
 * routes/agentFindingsRoutes.ts
 * Autonomous-agent findings API (gap-analysis P1-4).
 *
 * Mount: app.use(prefix, agentFindingsRoutes(pool, authenticate));
 */
import { Router } from 'express';
import { runAgentSweep, listFindings, setFindingStatus } from '../services/agentLoopService.js';

export default function agentFindingsRoutes(pool: any, authenticate: any) {
    const router = Router();

    router.get('/agent/findings', authenticate, async (req: any, res: any) => {
        try {
            const rows = await listFindings({
                pool,
                status: req.query.status || null,
                limit: req.query.limit,
            });
            res.json({ findings: rows });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/agent/findings/:id/status', authenticate, async (req: any, res: any) => {
        try {
            const updated = await setFindingStatus({
                pool,
                id: Number(req.params.id),
                status: String(req.body?.status || ''),
            });
            res.json(updated);
        } catch (e: any) {
            const code = /not found/.test(e.message) ? 404 : /invalid/.test(e.message) ? 400 : 500;
            res.status(code).json({ error: e.message });
        }
    });

    // ── Top queries by load (collector-shipped pg_stat_statements deltas) ──
    router.get('/agent/top-queries', authenticate, async (req: any, res: any) => {
        try {
            const { topQueriesByLoad } = await import('../services/queryStatsRollup.js');
            res.json(
                await topQueriesByLoad({
                    controlPool: pool,
                    connectionId: req.query.connectionId || 'default',
                    hours: Number(req.query.hours) || 1,
                    limit: req.query.limit,
                }),
            );
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/agent/sweep', authenticate, async (_req: any, res: any) => {
        try {
            res.json(await runAgentSweep({ pool }));
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}
