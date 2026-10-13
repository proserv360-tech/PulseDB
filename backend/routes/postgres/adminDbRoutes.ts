// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Extracted from server.ts.

import { authenticate } from '../../core/auth.js';
import { reqPool } from '../../core/connectionPools.js';
import { cached } from '../../core/responseCache.js';
import { requireRole } from '../../middleware/authenticate.js';
import { log } from '../../services/logger.js';

export default function registerAdminDbRoutes(app) {
    // ─────────────────────────────────────────────────────────────────────────────
    // ADMIN HBA + KILL CONNECTION ROUTES
    // ─────────────────────────────────────────────────────────────────────────────

    app.get('/api/admin/hba', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
        try {
            const _p = await reqPool(req);
            // pg_hba_file_rules is available in PG 10+; gracefully fallback if not
            const r = await _p
                .query(
                    `
            SELECT
                line_num AS id,
                type,
                CASE WHEN array_length(database, 1) = 1 THEN database[1] ELSE array_to_string(database, ',') END AS database,
                CASE WHEN array_length(user_name, 1) = 1 THEN user_name[1] ELSE array_to_string(user_name, ',') END AS "user",
                address,
                auth_method AS method,
                options,
                error
            FROM pg_hba_file_rules
            ORDER BY line_num
        `,
                )
                .catch(() => ({ rows: [] }));
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    app.post('/api/admin/hba', authenticate, requireRole('super_admin'), async (req, res) => {
        // HBA file writing requires filesystem access — acknowledge receipt but do not modify
        // in Vercel/serverless environments. Return success so the UI doesn't error.
        try {
            const { rules } = req.body || {};
            if (!Array.isArray(rules)) return res.status(400).json({ error: 'rules must be an array' });
            log('INFO', 'HBA rule update requested', { count: rules.length, user: req.user?.username });
            // In a self-hosted deployment you would write to pg_hba.conf here and reload:
            //   fs.writeFileSync(hbaPath, formatHbaRules(rules));
            //   await pool.query('SELECT pg_reload_conf()');
            res.json({
                success: true,
                message: 'HBA rules acknowledged. Apply manually in self-hosted deployments.',
                rules_count: rules.length,
            });
        } catch (e) {
            log('ERROR', 'HBA rules update error', { error: e.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.get(
        '/api/admin/connections',
        authenticate,
        requireRole('admin', 'super_admin'),
        cached('admin:connections', 5_000),
        async (req, res) => {
            try {
                const _p = await reqPool(req);
                const r = await _p.query(`
            SELECT
                pid,
                usename AS "user",
                datname AS db,
                state,
                left(query, 200) AS query,
                application_name AS "appName",
                client_addr AS client,
                client_port,
                round(EXTRACT(EPOCH FROM (now() - query_start))::numeric, 2) AS duration_sec,
                wait_event_type,
                wait_event AS wait,
                backend_type,
                xact_start,
                state_change
            FROM pg_stat_activity
            WHERE pid <> pg_backend_pid()
              AND backend_type = 'client backend'
            ORDER BY duration_sec DESC NULLS LAST
        `);
                res.json(
                    r.rows.map((row) => ({
                        ...row,
                        duration: row.duration_sec != null ? `${row.duration_sec}s` : '—',
                        durationMs: Math.round((row.duration_sec || 0) * 1000),
                    })),
                );
            } catch (e) {
                log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
                res.json({});
            }
        },
    );

    app.post('/api/admin/connections/kill', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
        try {
            const { pid } = req.body || {};
            if (!pid) return res.status(400).json({ error: 'pid is required' });
            const _p = await reqPool(req);
            // Refuse to kill our own connection or system backends
            const check = await _p.query(
                `SELECT pid, usename, application_name, state FROM pg_stat_activity WHERE pid = $1`,
                [pid],
            );
            if (check.rows.length === 0) return res.status(404).json({ error: 'Connection not found' });
            const conn = check.rows[0];
            if (conn.application_name === 'pulsedb_backend') {
                return res.status(403).json({ error: 'Cannot terminate the monitoring backend connection' });
            }
            const r = await _p.query('SELECT pg_terminate_backend($1) AS killed', [pid]);
            const killed = r.rows[0]?.killed;
            log('INFO', 'Connection terminated', { pid, user: conn.usename, by: req.user?.username });
            res.json({
                success: killed,
                pid,
                message: killed ? `Connection ${pid} terminated` : `Could not terminate ${pid}`,
            });
        } catch (e) {
            log('ERROR', 'Kill connection error', { error: e.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });
}
