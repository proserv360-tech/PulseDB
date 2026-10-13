// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Extracted from server.ts.

import { pool } from '../../core/adminPool.js';
import { authenticate } from '../../core/auth.js';
import { CONFIG } from '../../core/config.js';
import { reqPool } from '../../core/connectionPools.js';
import { cached } from '../../core/responseCache.js';
import { requireScreen } from '../../middleware/authenticate.js';
import { log } from '../../services/logger.js';

export default function registerSecurityRoutes(app) {
    // ─────────────────────────────────────────────────────────────────────────────
    // SECURITY ROUTES
    // ─────────────────────────────────────────────────────────────────────────────

    // Schema migrations endpoint
    // SEC-10 (audit): the table we read from is restricted to a closed allowlist
    // of well-known migration-tracking tables. This eliminates the case where a
    // user-created table whose name happens to contain "migration" gets selected.
    app.get(
        '/api/schema/migrations',
        authenticate,
        cached('schema:migrations', CONFIG.CACHE_TTL.SCHEMAS),
        async (req, res) => {
            try {
                const pool = await reqPool(req);
                // Closed allowlist of the migration-table names we know how to read.
                const ALLOWED_MIGRATION_TABLES = new Set([
                    'flyway_schema_history',
                    'schema_migrations',
                    'knex_migrations',
                    '_prisma_migrations',
                    'migrations',
                    'schema_version',
                ]);
                const { rows: tables } = await pool.query(
                    `
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = ANY($1::text[])
            LIMIT 1
        `,
                    [Array.from(ALLOWED_MIGRATION_TABLES)],
                );
                if (tables.length === 0) {
                    return res.json({
                        migrations: [],
                        pending: [],
                        message:
                            'No migration tracking table found. Schema versioning data will appear if you use a migration tool (Flyway, Knex, Prisma, etc.).',
                    });
                }
                const tableName = tables[0].table_name;
                // Defense in depth: re-validate against the allowlist AND the
                // identifier-shape regex, even though the SQL above already enforced it.
                if (!ALLOWED_MIGRATION_TABLES.has(tableName) || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
                    return res.json({ migrations: [], pending: [], message: 'Invalid table name' });
                }
                const { rows } = await pool.query(`SELECT * FROM "public"."${tableName}" ORDER BY 1 DESC LIMIT 50`);
                res.json({ migrations: rows, pending: [], tableName });
            } catch (e) {
                log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
                res.json({ migrations: [], pending: [], message: e.message });
            }
        },
    );

    // Schema browser endpoint
    // Schema change (DDL) history endpoint
    // Reads from a pgAudit-style DDL log table if one exists in the monitored DB.
    // Supported sources (closed allowlist): an event-trigger audit table named
    // `ddl_history` / `schema_change_log`, or an `audit.ddl_log` table.
    // Returns [] with a hint when no source is available (UI shows the pgAudit note).
    app.get(
        '/api/schema/ddl-history',
        authenticate,
        cached('schema:ddl-history', CONFIG.CACHE_TTL.SCHEMAS),
        async (req, res) => {
            try {
                const pool = await reqPool(req);
                const SOURCES = [
                    { schema: 'public', table: 'ddl_history' },
                    { schema: 'public', table: 'schema_change_log' },
                    { schema: 'audit', table: 'ddl_log' },
                ];
                let found = null;
                for (const s of SOURCES) {
                    const { rows } = await pool.query(
                        `
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = $1 AND table_name = $2 LIMIT 1
            `,
                        [s.schema, s.table],
                    );
                    if (rows.length) {
                        found = s;
                        break;
                    }
                }
                if (!found) {
                    return res.json({
                        events: [],
                        message:
                            'No DDL audit source found. Enable pgAudit or create a ddl_history event-trigger table to track schema changes.',
                    });
                }
                if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(found.schema) || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(found.table)) {
                    return res.json({ events: [], message: 'Invalid audit table name' });
                }
                const { rows } = await pool.query(`
            SELECT * FROM "${found.schema}"."${found.table}"
            ORDER BY 1 DESC LIMIT 100
        `);
                const events = rows.map((r) => ({
                    type: r.command_tag || r.type || r.action || r.event || 'DDL',
                    schema: r.schema_name || r.schema || 'public',
                    obj: r.object_name || r.obj || r.table_name || r.relation || '',
                    detail: r.statement || r.detail || r.query || r.command || '',
                    ts: r.event_time || r.ts || r.created_at || r.logged_at || '',
                    risk:
                        r.risk ||
                        (/(DROP|TRUNCATE|ALTER)/i.test(r.command_tag || r.type || '')
                            ? 'high'
                            : /CREATE/i.test(r.command_tag || r.type || '')
                              ? 'medium'
                              : 'low'),
                }));
                res.json({ events, source: `${found.schema}.${found.table}` });
            } catch (e) {
                log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
                res.json({ events: [], message: e.message });
            }
        },
    );

    app.get(
        '/api/schema/browser',
        authenticate,
        cached('schema:browser', CONFIG.CACHE_TTL.SCHEMAS),
        async (req, res) => {
            try {
                const pool = await reqPool(req);
                const { rows } = await pool.query(`
            SELECT t.table_schema, t.table_name, c.column_name, c.data_type, c.is_nullable,
                   c.column_default, c.character_maximum_length
            FROM information_schema.tables t
            JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
            WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema', 'pgmonitoringtool')
            AND t.table_type = 'BASE TABLE'
            ORDER BY t.table_schema, t.table_name, c.ordinal_position
        `);
                // Group by schema.table
                const schemas = {};
                rows.forEach((r) => {
                    const key = r.table_schema;
                    if (!schemas[key]) schemas[key] = {};
                    if (!schemas[key][r.table_name]) schemas[key][r.table_name] = [];
                    schemas[key][r.table_name].push({
                        name: r.column_name,
                        type: r.data_type,
                        nullable: r.is_nullable === 'YES',
                        default: r.column_default,
                    });
                });
                res.json(schemas);
            } catch (e) {
                log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
                res.json({});
            }
        },
    );

    // Threats endpoint
    app.get(
        '/api/security/threats',
        authenticate,
        cached('sec:threats', CONFIG.CACHE_TTL.SECURITY),
        async (req, res) => {
            try {
                const pool = await reqPool(req);
                const { rows } = await pool.query(`
            SELECT pid, usename as user, client_addr as source, query, state,
                   backend_start, query_start,
                   CASE
                       WHEN query ~* 'DROP|TRUNCATE|DELETE FROM.*WHERE 1|UPDATE pg_' THEN 'critical'
                       WHEN query ~* 'GRANT|ALTER ROLE|CREATE ROLE' THEN 'high'
                       WHEN query ~* 'COPY.*TO|pg_dump|information_schema' THEN 'medium'
                       ELSE 'low'
                   END as severity
            FROM pg_stat_activity
            WHERE state != 'idle' AND query != ''
            AND pid != pg_backend_pid()
            ORDER BY query_start DESC LIMIT 20
        `);
                res.json(rows);
            } catch (e) {
                log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
                res.json([]);
            }
        },
    );

    // Compliance checks endpoint
    app.get(
        '/api/security/compliance',
        authenticate,
        cached('sec:compliance', CONFIG.CACHE_TTL.SECURITY),
        async (req, res) => {
            try {
                const pool = await reqPool(req);
                const checks = [];
                // Check SSL
                const ssl = await pool.query("SELECT setting FROM pg_settings WHERE name = 'ssl'");
                checks.push({
                    id: 'ssl',
                    cat: 'Encryption',
                    label: 'SSL Enabled',
                    status: ssl.rows[0]?.setting === 'on' ? 'pass' : 'fail',
                    standard: 'SOC2',
                    score: ssl.rows[0]?.setting === 'on' ? 100 : 0,
                });
                // Check password encryption
                const enc = await pool.query("SELECT setting FROM pg_settings WHERE name = 'password_encryption'");
                checks.push({
                    id: 'enc',
                    cat: 'Encryption',
                    label: 'Password Encryption',
                    status: enc.rows[0]?.setting === 'scram-sha-256' ? 'pass' : 'warn',
                    standard: 'SOC2',
                    score: enc.rows[0]?.setting === 'scram-sha-256' ? 100 : 50,
                });
                // Check log connections
                const logConn = await pool.query("SELECT setting FROM pg_settings WHERE name = 'log_connections'");
                checks.push({
                    id: 'logc',
                    cat: 'Logging',
                    label: 'Connection Logging',
                    status: logConn.rows[0]?.setting === 'on' ? 'pass' : 'warn',
                    standard: 'SOC2',
                    score: logConn.rows[0]?.setting === 'on' ? 100 : 30,
                });
                // Check log disconnections
                const logDisc = await pool.query("SELECT setting FROM pg_settings WHERE name = 'log_disconnections'");
                checks.push({
                    id: 'logd',
                    cat: 'Logging',
                    label: 'Disconnection Logging',
                    status: logDisc.rows[0]?.setting === 'on' ? 'pass' : 'warn',
                    standard: 'SOC2',
                    score: logDisc.rows[0]?.setting === 'on' ? 100 : 30,
                });
                // Check row level security enabled tables
                const rls = await pool.query('SELECT count(*) as cnt FROM pg_class WHERE relrowsecurity = true');
                checks.push({
                    id: 'rls',
                    cat: 'Access Control',
                    label: 'Row Level Security',
                    status: parseInt(rls.rows[0]?.cnt) > 0 ? 'pass' : 'warn',
                    standard: 'GDPR',
                    score: parseInt(rls.rows[0]?.cnt) > 0 ? 100 : 0,
                });
                res.json(checks);
            } catch (e) {
                log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
                res.json([]);
            }
        },
    );

    // Audit events endpoint
    app.get(
        '/api/security/audit-events',
        authenticate,
        cached('sec:audit', CONFIG.CACHE_TTL.SECURITY),
        async (req, res) => {
            try {
                const pool = await reqPool(req);
                // Try to read from audit_log if it exists, or fallback to pg_stat_activity
                const { rows } = await pool.query(`
            SELECT pid, usename as user, application_name as app,
                   query as action, client_addr as source,
                   query_start as ts, state
            FROM pg_stat_activity
            WHERE query != '' AND pid != pg_backend_pid()
            ORDER BY query_start DESC LIMIT 30
        `);
                res.json(rows);
            } catch (e) {
                log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
                res.json([]);
            }
        },
    );

    app.get(
        '/api/security/superuser-activity',
        authenticate,
        requireScreen('security'),
        cached('sec:superuser', 15_000),
        async (req, res) => {
            try {
                const _p = await reqPool(req);
                const [active, roles] = await Promise.all([
                    _p.query(`
                SELECT
                    pid,
                    usename AS "user",
                    datname AS db,
                    left(query, 200) AS query,
                    round(EXTRACT(EPOCH FROM (now() - query_start))::numeric, 2) AS duration_sec,
                    state,
                    application_name AS app,
                    client_addr,
                    backend_start,
                    xact_start
                FROM pg_stat_activity
                WHERE usesysid IN (SELECT oid FROM pg_roles WHERE rolsuper = true)
                  AND state IS NOT NULL
                ORDER BY query_start DESC NULLS LAST
                LIMIT 50
            `),
                    _p.query(`
                SELECT rolname AS role_name, rolsuper, rolcreaterole, rolcreatedb,
                       rolcanlogin, rolreplication
                FROM pg_roles
                WHERE rolsuper = true
                ORDER BY rolname
            `),
                ]);
                const riskMap = (q) => {
                    if (!q) return 'low';
                    const upper = q.toUpperCase();
                    if (/DROP|TRUNCATE|DELETE\s+FROM|ALTER\s+ROLE|GRANT\s+SUPERUSER/i.test(upper)) return 'critical';
                    if (/ALTER|CREATE\s+ROLE|REVOKE|UPDATE\s+pg_|INSERT\s+INTO\s+pg_/i.test(upper)) return 'high';
                    if (/CREATE|COPY|IMPORT/i.test(upper)) return 'medium';
                    return 'low';
                };
                res.json({
                    active_sessions: active.rows.map((r) => ({
                        ...r,
                        risk: riskMap(r.query),
                        ts: r.xact_start ? new Date(r.xact_start).toISOString() : new Date().toISOString(),
                    })),
                    superuser_roles: roles.rows,
                });
            } catch (e) {
                log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
                res.json({});
            }
        },
    );
}
