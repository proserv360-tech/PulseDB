// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Extracted from server.ts.

import { authenticate } from '../../core/auth.js';
import { CONFIG } from '../../core/config.js';
import { reqPool } from '../../core/connectionPools.js';
import { cache, cached } from '../../core/responseCache.js';
import { requireScreen } from '../../middleware/authenticate.js';
import { log } from '../../services/logger.js';

export default function registerMaintenanceRoutes(app) {
    // ─────────────────────────────────────────────────────────────────────────────
    // VACUUM & MAINTENANCE
    // ─────────────────────────────────────────────────────────────────────────────
    app.get(
        '/api/maintenance/vacuum-stats',
        authenticate,
        cached('maint:vacuum', CONFIG.CACHE_TTL.VACUUM),
        async (req, res) => {
            try {
                const _p = await reqPool(req);
                const [tables, workers, settings] = await Promise.all([
                    _p.query(`
                SELECT schemaname, relname,
                       n_dead_tup, n_live_tup,
                       CASE WHEN n_live_tup > 0
                                THEN round((n_dead_tup::numeric / NULLIF(n_live_tup,0)) * 100, 1)
                            ELSE 0 END AS dead_pct,
                       last_vacuum, last_autovacuum,
                       last_analyze, last_autoanalyze,
                       vacuum_count, autovacuum_count,
                       analyze_count, autoanalyze_count,
                       n_mod_since_analyze,
                       pg_size_pretty(pg_total_relation_size(quote_ident(schemaname)||'.'||quote_ident(relname))) AS total_size
                FROM pg_stat_user_tables
                ORDER BY n_dead_tup DESC
                    LIMIT 50
            `),
                    _p.query(`
                SELECT pid, datname,
                       regexp_replace(query, '^autovacuum: ', '') AS table_name,
                       state,
                       round(EXTRACT(EPOCH FROM (now() - query_start))::numeric, 0) AS duration_sec,
                       query_start::text AS started_at
                FROM pg_stat_activity
                WHERE query LIKE 'autovacuum:%'
                ORDER BY query_start ASC
            `),
                    _p.query(`
                SELECT name, setting, unit, short_desc
                FROM pg_settings
                WHERE name LIKE 'autovacuum%'
                ORDER BY name
            `),
                ]);
                res.json({ tables: tables.rows, workers: workers.rows, settings: settings.rows });
            } catch (e) {
                log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
                res.json({});
            }
        },
    );

    app.post('/api/maintenance/vacuum', authenticate, requireScreen('admin'), async (req, res) => {
        const { table, schema = 'public', analyze = true } = req.body;
        if (!table || !/^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(table))
            return res.status(400).json({ error: 'Invalid table name' });
        if (!schema || !/^[a-zA-Z_][a-zA-Z0-9_$-]*$/.test(schema))
            return res.status(400).json({ error: 'Invalid schema name' });
        try {
            const cmd = `VACUUM${analyze ? ' ANALYZE' : ''} "${schema}"."${table}"`;
            await (await reqPool(req)).query(cmd);
            cache.clear();
            log('INFO', 'Manual VACUUM executed', { schema, table, analyze });
            res.json({ success: true, command: cmd });
        } catch (e) {
            log('ERROR', 'VACUUM command error', { error: e.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });
}
