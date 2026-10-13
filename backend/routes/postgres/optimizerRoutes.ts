// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Extracted from server.ts.

import { pool } from '../../core/adminPool.js';
import { authenticate } from '../../core/auth.js';
import { reqPool } from '../../core/connectionPools.js';
import { log } from '../../services/logger.js';

export default function registerOptimizerRoutes(app) {
    // ─────────────────────────────────────────────────────────────────────────────
    // QUERY OPTIMIZER ENDPOINTS
    // ─────────────────────────────────────────────────────────────────────────────

    app.get('/api/optimizer/indexes', authenticate, async (req, res) => {
        try {
            const pool = await reqPool(req);
            const { rows } = await pool.query(`
            SELECT schemaname, tablename, indexname,
                   pg_size_pretty(pg_relation_size(indexrelid)) as size,
                   idx_scan, idx_tup_read, idx_tup_fetch
            FROM pg_stat_user_indexes
            JOIN pg_index ON pg_stat_user_indexes.indexrelid = pg_index.indexrelid
            ORDER BY idx_scan ASC LIMIT 50
        `);
            // Normalize to shape frontend expects: { table, column, indexName, type, size, scans, status, impact }
            const normalized = rows.map((r) => ({
                table: `${r.schemaname}.${r.tablename}`,
                column: r.indexname.replace(`${r.tablename}_`, '').replace('_idx', '').replace('_index', ''),
                indexName: r.indexname,
                type: 'btree',
                size: r.size,
                scans: parseInt(r.idx_scan) || 0,
                reads: parseInt(r.idx_tup_read) || 0,
                fetches: parseInt(r.idx_tup_fetch) || 0,
                status: parseInt(r.idx_scan) === 0 ? 'unused' : parseInt(r.idx_scan) < 10 ? 'low-usage' : 'active',
                impact: parseInt(r.idx_scan) === 0 ? 'high' : parseInt(r.idx_scan) < 10 ? 'medium' : 'low',
            }));
            res.json(normalized);
        } catch (e) {
            log('ERROR', `[/api/optimizer/indexes] ${e.message}`);
            res.json([]);
        }
    });

    app.get('/api/optimizer/table-stats', authenticate, async (req, res) => {
        try {
            const pool = await reqPool(req);
            const { rows } = await pool.query(`
            SELECT schemaname, relname as table_name,
                   n_live_tup, n_dead_tup,
                   seq_scan, seq_tup_read, idx_scan, idx_tup_fetch,
                   n_tup_ins, n_tup_upd, n_tup_del,
                   last_vacuum, last_autovacuum, last_analyze, last_autoanalyze,
                   pg_size_pretty(pg_total_relation_size(relid)) as total_size
            FROM pg_stat_user_tables
            ORDER BY n_dead_tup DESC LIMIT 50
        `);
            // Normalize: frontend expects { table, rows, size, dead_tuples, last_vacuum, seq_scans, idx_scans }
            const fmtAgo = (ts) => {
                if (!ts) return 'never';
                const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
                if (mins < 60) return `${mins}m ago`;
                if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
                return `${Math.round(mins / 1440)}d ago`;
            };
            const normalized = rows.map((r) => ({
                table: `${r.schemaname}.${r.table_name}`,
                rows: parseInt(r.n_live_tup) || 0,
                size: r.total_size || '0 bytes',
                dead_tuples: parseInt(r.n_dead_tup) || 0,
                last_vacuum: fmtAgo(r.last_vacuum || r.last_autovacuum),
                seq_scans: parseInt(r.seq_scan) || 0,
                idx_scans: parseInt(r.idx_scan) || 0,
            }));
            res.json(normalized);
        } catch (e) {
            log('ERROR', `[/api/optimizer/table-stats] ${e.message}`);
            res.json([]);
        }
    });

    app.get('/api/optimizer/slow-queries', authenticate, async (req, res) => {
        try {
            const pool = await reqPool(req);
            // Check if pg_stat_statements extension exists
            const ext = await pool.query(
                "SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON e.extnamespace=n.oid WHERE e.extname='pg_stat_statements'",
            );
            if (ext.rowCount === 0) {
                return res.json([]);
            }
            const schema = ext.rows[0].nspname;
            const { rows } = await pool.query(`
            SELECT queryid, query, calls, total_exec_time, mean_exec_time,
                   min_exec_time, max_exec_time, stddev_exec_time,
                   rows, shared_blks_hit, shared_blks_read
            FROM "${schema}".pg_stat_statements
            WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
            ORDER BY mean_exec_time DESC LIMIT 30
        `);
            // Normalize: frontend expects { id, query, tags[], db, mean_time, p95_time, p99_time, total_time, calls }
            const inferTags = (q) => {
                const tags = [];
                const ql = (q || '').toLowerCase();
                if (/seq scan|sequential/.test(ql)) tags.push('seq-scan');
                if (/delete\s+from/i.test(ql)) tags.push('bulk-delete');
                if (/group\s+by|sum\(|avg\(|count\(/i.test(ql)) tags.push('aggregation');
                if (/select\s+\*/i.test(ql)) tags.push('wide-select');
                if (tags.length === 0) tags.push('general');
                return tags;
            };
            const dbName = (await pool.query('SELECT current_database() as db')).rows[0]?.db || 'postgres';
            const normalized = rows.map((r) => ({
                id: String(r.queryid),
                query: r.query,
                tags: inferTags(r.query),
                db: dbName,
                mean_time: parseFloat(r.mean_exec_time) || 0,
                p95_time: (parseFloat(r.mean_exec_time) || 0) * 1.8,
                p99_time: parseFloat(r.max_exec_time) || 0,
                total_time: parseFloat(r.total_exec_time) || 0,
                calls: parseInt(r.calls) || 0,
                rows_per_call: parseInt(r.rows) || 0,
            }));
            res.json(normalized);
        } catch (e) {
            log('ERROR', `[/api/optimizer/slow-queries] ${e.message}`);
            res.json([]);
        }
    });

    app.get('/api/optimizer/locks', authenticate, async (req, res) => {
        try {
            const pool = await reqPool(req);
            const { rows } = await pool.query(`
            SELECT l.pid, l.locktype, l.mode, l.granted, l.waitstart,
                   a.usename, a.application_name, a.client_addr,
                   a.query, a.state, a.wait_event_type, a.wait_event,
                   l.relation::regclass as table_name
            FROM pg_locks l
            JOIN pg_stat_activity a ON l.pid = a.pid
            WHERE NOT l.granted OR l.mode LIKE '%Exclusive%'
            ORDER BY l.waitstart NULLS LAST LIMIT 30
        `);
            // Normalize: frontend expects { pid, locktype, mode, granted, query, state, table_name, blocked_by, blocking[] }
            const waitingPids = rows.filter((r) => !r.granted).map((r) => r.pid);
            const blockingPids = rows.filter((r) => r.granted).map((r) => r.pid);
            const normalized = rows.map((r) => ({
                pid: r.pid,
                locktype: r.locktype,
                mode: r.mode,
                granted: r.granted,
                query: r.query,
                state: r.state,
                table_name: r.table_name,
                usename: r.usename,
                application_name: r.application_name,
                client_addr: r.client_addr,
                wait_event: r.wait_event,
                blocked_by: !r.granted ? blockingPids.find((p) => p !== r.pid) || null : null,
                blocking: r.granted ? waitingPids.filter((p) => p !== r.pid) : [],
            }));
            res.json(normalized);
        } catch (e) {
            log('ERROR', `[/api/optimizer/locks] ${e.message}`);
            res.json([]);
        }
    });

    app.get('/api/optimizer/maintenance', authenticate, async (req, res) => {
        try {
            const pool = await reqPool(req);
            const { rows } = await pool.query(`
            SELECT schemaname, relname as table_name,
                   n_dead_tup, n_live_tup,
                   CASE WHEN n_live_tup > 0
                        THEN round(100.0 * n_dead_tup / n_live_tup, 1)
                        ELSE 0 END as bloat_pct,
                   last_vacuum, last_autovacuum, last_analyze, last_autoanalyze,
                   vacuum_count, autovacuum_count,
                   pg_size_pretty(pg_total_relation_size(relid)) as size
            FROM pg_stat_user_tables
            WHERE n_dead_tup > 0
            ORDER BY n_dead_tup DESC LIMIT 30
        `);
            // Normalize: frontend expects { table, size, live_tuples, dead_tuples, bloat_pct, last_vacuum, last_analyze, vacuum_count }
            const fmtAgo = (ts) => {
                if (!ts) return 'never';
                const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
                if (mins < 60) return `${mins}m ago`;
                if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
                return `${Math.round(mins / 1440)}d ago`;
            };
            const normalized = rows.map((r) => ({
                table: `${r.schemaname}.${r.table_name}`,
                size: r.size,
                live_tuples: parseInt(r.n_live_tup) || 0,
                dead_tuples: parseInt(r.n_dead_tup) || 0,
                bloat_pct: parseFloat(r.bloat_pct) || 0,
                last_vacuum: fmtAgo(r.last_vacuum || r.last_autovacuum),
                last_analyze: fmtAgo(r.last_analyze || r.last_autoanalyze),
                vacuum_count: (parseInt(r.vacuum_count) || 0) + (parseInt(r.autovacuum_count) || 0),
            }));
            res.json(normalized);
        } catch (e) {
            log('ERROR', `[/api/optimizer/maintenance] ${e.message}`);
            res.json([]);
        }
    });

    app.get('/api/optimizer/config', authenticate, async (req, res) => {
        try {
            const pool = await reqPool(req);
            const { rows } = await pool.query(`
            SELECT name, setting, unit, category, short_desc,
                   min_val, max_val, boot_val, reset_val, source
            FROM pg_settings
            WHERE category IN (
                'Autovacuum', 'Resource Usage / Memory',
                'Write-Ahead Log', 'Query Tuning / Planner Cost Constants',
                'Query Tuning / Planner Method Configuration',
                'Resource Usage / Disk', 'Connections and Authentication / Connection Settings'
            )
            ORDER BY category, name
        `);
            res.json(rows);
        } catch (e) {
            log('ERROR', `[/api/optimizer/config] ${e.message}`);
            res.json([]);
        }
    });

    app.get('/api/optimizer/service-attribution', authenticate, async (req, res) => {
        try {
            const pool = await reqPool(req);
            const { rows } = await pool.query(`
            SELECT
                application_name,
                count(*) as call_count,
                round(avg(total_time)::numeric, 2) as avg_time,
                round(max(total_time)::numeric, 2) as max_time,
                round(sum(total_time)::numeric, 2) as total_time,
                round(avg(total_time) * count(*)::numeric, 2) as total_time_ms
            FROM pg_stat_activity
            WHERE state = 'active' OR state = 'idle in transaction'
            GROUP BY application_name
            ORDER BY total_time_ms DESC LIMIT 20
        `);
            res.json(rows);
        } catch (e) {
            log('ERROR', `[/api/optimizer/service-attribution] ${e.message}`);
            res.json([]);
        }
    });

    app.get('/api/optimizer/param-issues', authenticate, async (req, res) => {
        try {
            const pool = await reqPool(req);
            // Check if pg_stat_statements extension exists
            const ext = await pool.query(
                "SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON e.extnamespace=n.oid WHERE e.extname='pg_stat_statements'",
            );
            if (ext.rowCount === 0) {
                return res.json([]);
            }
            const schema = ext.rows[0].nspname;
            const { rows } = await pool.query(`
            SELECT
                queryid,
                query,
                calls,
                mean_exec_time,
                CASE
                    WHEN query LIKE '%\$%' THEN 'parameterized'
                    WHEN calls > 10 AND mean_exec_time > 100 THEN 'CRITICAL'
                    WHEN calls > 5 THEN 'HIGH'
                    ELSE 'MEDIUM'
                END as risk
            FROM "${schema}".pg_stat_statements
            WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
            AND query NOT LIKE 'SELECT%pg_stat_statements%'
            AND calls > 2
            ORDER BY calls DESC LIMIT 30
        `);
            res.json(rows);
        } catch (e) {
            log('ERROR', `[/api/optimizer/param-issues] ${e.message}`);
            res.json([]);
        }
    });
}
