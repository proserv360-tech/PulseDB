// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// SQL console execution against the active connection.
// Extracted from server.ts.

import { pool } from '../../core/adminPool.js';
import { authenticate } from '../../core/auth.js';
import { reqDbType, reqPool } from '../../core/connectionPools.js';
import { queryHistory } from '../../core/queryHistory.js';
import { validateConsoleQuery } from '../../core/sqlGuard.js';
import { requireRole } from '../../middleware/authenticate.js';
import { writeAudit } from '../../services/auditService.js';

export default function registerSqlConsoleRoutes(app) {
    // ─────────────────────────────────────────────────────────────────────────────
    // SQL CONSOLE
    // ─────────────────────────────────────────────────────────────────────────────
    app.post('/api/query', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
        const rawSql = req.body?.sql;
        const validationError = validateConsoleQuery(rawSql, req.user.role);
        if (validationError) return res.status(400).json({ error: validationError });

        const dbType = await reqDbType(req);

        // Engines without SQL surfaces get a structured 400 pointing at the
        // right console for that engine, rather than a cryptic pg error.
        const NON_SQL_ENGINES = {
            mongodb: { hint: 'Use the MongoDB Data Tools tab (db.collection.find(...)).' },
            redis: { hint: 'Redis has no SQL. Use the Redis Commands tab for GET/SET/SCAN/etc.' },
            dynamodb: { hint: 'DynamoDB uses PartiQL. Use the DynamoDB PartiQL tab instead.' },
            cassandra: { hint: 'Cassandra uses CQL. Use the Cassandra CQL tab instead.' },
        };
        if (NON_SQL_ENGINES[dbType]) {
            return res.status(400).json({
                error: `SQL console is not available for ${dbType} connections.`,
                code: 'SQL_NOT_SUPPORTED_FOR_ENGINE',
                hint: NON_SQL_ENGINES[dbType].hint,
            });
        }

        const safeSql = String(rawSql).slice(0, 50_000);
        try {
            const dynPool = await reqPool(req);
            if (dbType === 'mysql' || dbType === 'mariadb') {
                const [rows, fields] = await dynPool.query(safeSql);
                queryHistory.add({ sql: safeSql, success: true, by: req.user.username });
                await writeAudit(pool, {
                    actorId: req.user.id,
                    actorUsername: req.user.username,
                    action: 'SQL_CONSOLE_EXEC',
                    resourceType: 'sql_console',
                    level: 'warn',
                    detail: `Executed SQL (${safeSql.length} chars): ${safeSql.slice(0, 200)}${safeSql.length > 200 ? '…' : ''}`,
                    ip: req.ip,
                });
                res.json({
                    rows: Array.isArray(rows) ? rows : [],
                    rowCount: Array.isArray(rows) ? rows.length : 0,
                    fields: (fields || []).map((f) => ({ name: f.name })),
                });
            } else {
                const client = await dynPool.connect();
                const r = await client.query(safeSql);
                client.release();
                queryHistory.add({ sql: safeSql, success: true, by: req.user.username });
                await writeAudit(pool, {
                    actorId: req.user.id,
                    actorUsername: req.user.username,
                    action: 'SQL_CONSOLE_EXEC',
                    resourceType: 'sql_console',
                    level: 'warn',
                    detail: `Executed SQL (${safeSql.length} chars): ${safeSql.slice(0, 200)}${safeSql.length > 200 ? '…' : ''}`,
                    ip: req.ip,
                });
                res.json({ rows: r.rows, rowCount: r.rowCount, fields: r.fields.map((f) => ({ name: f.name })) });
            }
        } catch (e) {
            queryHistory.add({ sql: safeSql, success: false, error: e.message, by: req.user.username });
            res.status(400).json({ error: e.message });
        }
    });
}
