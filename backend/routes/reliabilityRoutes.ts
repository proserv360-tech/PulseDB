// @ts-nocheck
import { Router } from 'express';

export default function reliabilityRoutes(authenticate, reqPool, log, validateExplainQuery) {
    const router = Router();

    router.get('/reliability/active-connections', authenticate, async (req, res) => {
        try {
            const r = await (await reqPool(req)).query(`
                SELECT pid, usename, state, query,
                       extract(epoch FROM (now()-query_start))::int AS duration_sec,
                       (now()-query_start > interval '5 minutes') AS is_slow
                FROM pg_stat_activity WHERE pid<>pg_backend_pid() ORDER BY duration_sec DESC
            `);
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    router.get('/reliability/locks', authenticate, async (req, res) => {
        try {
            const r = await (await reqPool(req)).query(`
                SELECT bl.pid AS blocked_pid, kl.pid AS blocking_pid, ka.query AS blocking_query
                FROM   pg_locks bl
                JOIN   pg_locks kl ON kl.locktype=bl.locktype AND kl.pid<>bl.pid
                JOIN   pg_stat_activity ka ON ka.pid=kl.pid
                WHERE  NOT bl.granted
            `);
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    router.get('/reliability/replication', authenticate, async (req, res) => {
        try {
            const r = await (await reqPool(req)).query(
                'SELECT application_name, state, pg_wal_lsn_diff(sent_lsn, replay_lsn) AS replication_lag_bytes FROM pg_stat_replication',
            );
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    router.post('/optimizer/analyze', authenticate, async (req, res) => {
        try {
            const { query } = req.body;
            if (!query) return res.status(400).json({ error: 'Query is required' });
            const validationError = validateExplainQuery(query);
            if (validationError) return res.status(400).json({ error: validationError });
            const dbPool = await reqPool(req);
            await dbPool.query('BEGIN TRANSACTION READ ONLY');
            try {
                await dbPool.query('SET LOCAL statement_timeout = 5000');
                const result = await dbPool.query(`EXPLAIN (ANALYZE, COSTS, VERBOSE, BUFFERS, FORMAT JSON) ${query}`);
                await dbPool.query('COMMIT');
                res.json(result.rows[0]);
            } catch (error) {
                await dbPool.query('ROLLBACK');
                throw error;
            }
        } catch (e) {
            log('ERROR', 'Query parse error', { error: e.message });
            res.status(400).json({ error: 'Invalid query' });
        }
    });

    return router;
}
