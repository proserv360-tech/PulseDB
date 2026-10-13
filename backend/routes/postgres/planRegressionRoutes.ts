// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Extracted from server.ts.

import { authenticate } from '../../core/auth.js';
import { reqPool } from '../../core/connectionPools.js';
import { validateExplainQuery } from '../../core/sqlGuard.js';
import { log } from '../../services/logger.js';

export default function registerPlanRegressionRoutes(app) {
    // ─────────────────────────────────────────────────────────────────────────────
    // QUERY PLAN REGRESSION
    // ─────────────────────────────────────────────────────────────────────────────
    const planBaselines = new Map();
    if (process.env.VERCEL !== '1')
        setInterval(() => {
            if (planBaselines.size > 500) planBaselines.clear();
        }, 600_000);

    app.post('/api/regression/capture', authenticate, async (req, res) => {
        try {
            const { query, label } = req.body;
            if (!query) return res.status(400).json({ error: 'query required' });
            const validationError = validateExplainQuery(query);
            if (validationError) return res.status(400).json({ error: validationError });
            const dbPool = await reqPool(req);
            // Execute EXPLAIN in a read-only transaction with timeout
            await dbPool.query('BEGIN TRANSACTION READ ONLY');
            try {
                await dbPool.query('SET LOCAL statement_timeout = 5000');
                const result = await dbPool.query(`EXPLAIN (COSTS, FORMAT JSON) ${query}`);
                await dbPool.query('COMMIT');
                const plan = result.rows[0]['QUERY PLAN'][0];
                const cost = plan['Plan']['Total Cost'];
                const fingerprint = Buffer.from(query.trim().toLowerCase()).toString('base64').slice(0, 32);
                const safeLabel = typeof label === 'string' ? label.slice(0, 120) : query.slice(0, 60);
                planBaselines.set(fingerprint, { plan, cost, ts: new Date().toISOString(), query, label: safeLabel });
                res.json({ fingerprint, cost, plan, message: 'Baseline captured' });
            } catch (error) {
                await dbPool.query('ROLLBACK');
                throw error;
            }
        } catch (e) {
            log('ERROR', 'Regression capture error', { error: e.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.post('/api/regression/compare', authenticate, async (req, res) => {
        try {
            const { query } = req.body;
            if (!query) return res.status(400).json({ error: 'query required' });
            const validationError = validateExplainQuery(query);
            if (validationError) return res.status(400).json({ error: validationError });
            const fingerprint = Buffer.from(query.trim().toLowerCase()).toString('base64').slice(0, 32);
            const baseline = planBaselines.get(fingerprint);

            const dbPool = await reqPool(req);
            // Execute EXPLAIN in a read-only transaction with timeout
            await dbPool.query('BEGIN TRANSACTION READ ONLY');
            try {
                await dbPool.query('SET LOCAL statement_timeout = 5000');
                const result = await dbPool.query(`EXPLAIN (COSTS, FORMAT JSON) ${query}`);
                await dbPool.query('COMMIT');
                const currentPlan = result.rows[0]['QUERY PLAN'][0];
                const currentCost = currentPlan['Plan']['Total Cost'];

                if (!baseline) {
                    return res.json({ status: 'no_baseline', currentCost, currentPlan, fingerprint });
                }

                const costChange = ((currentCost - baseline.cost) / Math.max(baseline.cost, 0.001)) * 100;
                const regression = costChange > 20;
                res.json({
                    status: regression ? 'regression' : 'ok',
                    fingerprint,
                    costChange: Math.round(costChange * 10) / 10,
                    baseline: { cost: baseline.cost, plan: baseline.plan, ts: baseline.ts, label: baseline.label },
                    current: { cost: currentCost, plan: currentPlan },
                    regression,
                });
            } catch (error) {
                await dbPool.query('ROLLBACK');
                throw error;
            }
        } catch (e) {
            log('ERROR', 'Regression compare error', { error: e.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.get('/api/regression/baselines', authenticate, (req, res) => {
        const list = Array.from(planBaselines.entries()).map(([fp, b]) => ({
            fingerprint: fp,
            label: b.label,
            cost: b.cost,
            ts: b.ts,
            queryPreview: b.query.slice(0, 120),
        }));
        res.json(list);
    });

    app.delete('/api/regression/baselines/:fp', authenticate, (req, res) => {
        planBaselines.delete(req.params.fp);
        res.json({ success: true });
    });
}
