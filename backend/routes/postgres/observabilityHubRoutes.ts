// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Extracted from server.ts.

import { pool } from '../../core/adminPool.js';
import { authenticate } from '../../core/auth.js';
import { CONFIG } from '../../core/config.js';
import { reqPool } from '../../core/connectionPools.js';
import { cached } from '../../core/responseCache.js';
import { log } from '../../services/logger.js';

export default function registerObservabilityHubRoutes(app) {
    /* ── Pool Metrics ─────────────────────────────────────────────────────────── */
    app.get('/api/pool/metrics', authenticate, cached('pool:metrics', CONFIG.CACHE_TTL.POOL), async (req, res) => {
        try {
            const p = await reqPool(req);
            const [connStats, poolConf] = await Promise.all([
                p.query(`
                SELECT state, count(*) AS cnt, avg(extract(epoch FROM (now() - state_change)))::numeric(10,2) AS avg_duration
                FROM pg_stat_activity
                WHERE backend_type = 'client backend'
                GROUP BY state
            `),
                p.query(
                    `SELECT name, setting FROM pg_settings WHERE name IN ('max_connections','superuser_reserved_connections','idle_in_transaction_session_timeout')`,
                ),
            ]);
            const stateMap = {};
            connStats.rows.forEach((r) => {
                stateMap[r.state || 'null'] = { count: Number(r.cnt), avgDuration: Number(r.avg_duration) };
            });
            const settings = {};
            poolConf.rows.forEach((r) => {
                settings[r.name] = r.setting;
            });
            res.json({
                states: stateMap,
                settings,
                totalConnections: Object.values(stateMap).reduce((a, b) => a + b.count, 0),
                maxConnections: Number(settings.max_connections || 100),
            });
        } catch (e) {
            log('ERROR', `[/api/pool/metrics] ${e.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    /* ── Schema routes are provided by schemaRoutes module ──────────────────────
   Endpoints: /api/schema/relationships, /api/schema/dependencies,
   /api/schema/columns/:schema/:table, /api/schema/tree
   ──────────────────────────────────────────────────────────────────────── */

    /* ── Observability Hub ────────────────────────────────────────────────────── */
    app.get('/api/observability/api-metrics', authenticate, async (req, res) => {
        try {
            const p = await reqPool(req);
            const { rows } = await p.query(`
            SELECT query, calls, mean_exec_time AS avg_ms, total_exec_time AS total_ms
            FROM pg_stat_statements
            ORDER BY total_exec_time DESC LIMIT 20
        `);
            res.json(rows);
        } catch (e) {
            // pg_stat_statements may not be installed
            res.json([]);
        }
    });

    app.get('/api/observability/exceptions', authenticate, async (req, res) => {
        try {
            const p = await reqPool(req);
            const { rows } = await p.query(`
            SELECT datname, xact_rollback AS rollbacks, conflicts, deadlocks, temp_files
            FROM pg_stat_database WHERE datname = current_database()
        `);
            res.json(rows[0] || {});
        } catch (e) {
            res.json({});
        }
    });

    app.get('/api/observability/uptime', authenticate, async (req, res) => {
        try {
            const p = await reqPool(req);
            const { rows } = await p.query(`
            SELECT pg_postmaster_start_time() AS start_time,
                   extract(epoch FROM (now() - pg_postmaster_start_time())) AS uptime_seconds
        `);
            res.json(rows[0] || {});
        } catch (e) {
            res.json({});
        }
    });

    app.get('/api/observability/audit-log', authenticate, async (req, res) => {
        try {
            const { rows } = await pool.query(`
            SELECT a.id, COALESCE(u.username, 'system') AS actor_username, a.action,
                   a.details AS raw_details,
                   a.created_at AS timestamp
            FROM pgmonitoringtool.audit_log a
            LEFT JOIN pgmonitoringtool.users u ON u.id = a.user_id
            ORDER BY a.created_at DESC LIMIT 50
        `);
            // Normalize: extract resource_type/level from details if it's JSON
            const normalized = rows.map((r) => {
                let parsed = {};
                try {
                    parsed = typeof r.raw_details === 'object' ? r.raw_details : JSON.parse(r.raw_details || '{}');
                } catch {}
                return {
                    id: r.id,
                    actor_username: r.actor_username,
                    action: r.action,
                    resource_type: parsed.resource_type || r.action,
                    resource_id: parsed.resource_id || null,
                    level: parsed.level || 'info',
                    timestamp: r.timestamp,
                };
            });
            res.json(normalized);
        } catch (e) {
            res.json([]);
        }
    });

    app.get('/api/observability/jobs', authenticate, async (_req, res) => {
        // Jobs/scheduled tasks are in-memory — return current task list
        res.json([]);
    });

    /* ── OpenTelemetry ────────────────────────────────────────────────────────── */
    app.get('/api/otel/services', authenticate, async (req, res) => {
        try {
            const p = await reqPool(req);
            const { rows } = await p.query(`
            SELECT application_name AS service, count(*) AS connections
            FROM pg_stat_activity
            WHERE application_name != ''
            GROUP BY application_name
            ORDER BY connections DESC
        `);
            res.json(rows);
        } catch (e) {
            res.json([]);
        }
    });

    app.get('/api/otel/metrics/names', authenticate, async (req, res) => {
        try {
            const p = await reqPool(req);
            // Return available metric categories from pg_stat views
            const metrics = [
                'pg_stat_activity.connections',
                'pg_stat_database.transactions',
                'pg_stat_database.cache_hit_ratio',
                'pg_stat_user_tables.seq_scans',
                'pg_stat_user_tables.idx_scans',
                'pg_stat_bgwriter.checkpoints',
            ];
            res.json(metrics.map((m) => ({ name: m })));
        } catch (e) {
            res.json([]);
        }
    });

    app.get('/api/otel/metrics/data', authenticate, async (req, res) => {
        try {
            const p = await reqPool(req);
            const metric = req.query.metric || 'pg_stat_activity.connections';
            let rows = [];
            if (metric.includes('connections')) {
                const r = await p.query(`SELECT state, count(*) AS value FROM pg_stat_activity GROUP BY state`);
                rows = r.rows;
            } else if (metric.includes('transactions')) {
                const r = await p.query(
                    `SELECT xact_commit AS commits, xact_rollback AS rollbacks FROM pg_stat_database WHERE datname = current_database()`,
                );
                rows = r.rows;
            } else {
                const r = await p.query(`SELECT 'no_data' AS label, 0 AS value`);
                rows = r.rows;
            }
            res.json(rows);
        } catch (e) {
            res.json([]);
        }
    });

    /* ── Data Retention ───────────────────────────────────────────────────────── */
    app.get('/api/retention/policy', authenticate, async (_req, res) => {
        // Return default retention settings (no table needed)
        res.json({
            metrics_retention_days: 30,
            logs_retention_days: 7,
            alerts_retention_days: 90,
            audit_retention_days: 365,
        });
    });

    app.get('/api/retention/stats', authenticate, async (_req, res) => {
        try {
            const alertCount = await pool.query(`SELECT count(*) AS cnt FROM pgmonitoringtool.alerts`);
            const auditCount = await pool.query(`SELECT count(*) AS cnt FROM pgmonitoringtool.audit_log`);
            res.json({
                alerts_count: Number(alertCount.rows[0]?.cnt || 0),
                audit_count: Number(auditCount.rows[0]?.cnt || 0),
            });
        } catch (e) {
            res.json({ alerts_count: 0, audit_count: 0 });
        }
    });

    app.get('/api/retention/growth', authenticate, async (_req, res) => {
        try {
            const { rows } = await pool.query(`
            SELECT pg_database_size(current_database()) AS db_size
        `);
            res.json({ db_size_bytes: Number(rows[0]?.db_size || 0) });
        } catch (e) {
            res.json({ db_size_bytes: 0 });
        }
    });

    app.post('/api/retention/cleanup', authenticate, async (_req, res) => {
        try {
            const r1 = await pool.query(
                `DELETE FROM pgmonitoringtool.alerts WHERE created_at < now() - interval '90 days'`,
            );
            const r2 = await pool.query(
                `DELETE FROM pgmonitoringtool.audit_log WHERE created_at < now() - interval '365 days'`,
            );
            res.json({
                success: true,
                deleted: { alerts: r1.rowCount, audit_logs: r2.rowCount },
            });
        } catch (e) {
            log('ERROR', `[/api/retention/cleanup] ${e.message}`);
            res.json({ success: false, deleted: { alerts: 0, audit_logs: 0 }, error: e.message });
        }
    });

    // Note: PUT /api/retention/policy is handled by retentionRoutes middleware
    // This endpoint persists to the retention_policies table in the database
}
