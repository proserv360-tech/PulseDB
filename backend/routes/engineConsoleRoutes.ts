// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/engineConsoleRoutes.js
 *
 * Unified command console for non-SQL engines (Redis, Cassandra, DynamoDB)
 * and a thin pass-through for SQL engines that don't have their own console.
 *
 *   POST /api/engine-console
 *     body: { connectionId: string, command: string, options?: object }
 *     → { rows: [...], columns: [...], meta: {...}, elapsed_ms: number }
 *
 *   GET  /api/engine-console/help?dbType=<t>
 *     → { prompt, examples, docs_url, syntax }
 *
 * Dispatch:
 *   • Redis          — split command string into args, call redis.sendCommand()
 *   • Cassandra      — adapter.executeQuery(cql)
 *   • DynamoDB       — PartiQL via ExecuteStatementCommand
 *   • MSSQL / Oracle / Snowflake / BigQuery / Redshift — adapter.executeQuery(sql)
 *   • Everything else returns a 400 with a pointer to the native surface.
 *
 * Every call is audit-logged (action = 'ENGINE_CONSOLE_EXEC', level = 'warn').
 */

import { Router } from 'express';
import { writeAudit } from '../services/auditService.js';

const ENGINE_HELP = {
    redis: {
        prompt: 'redis>',
        docs_url: 'https://redis.io/docs/latest/commands/',
        syntax: 'space-separated command + args, e.g. `GET mykey` or `SET user:42 "{\\"name\\":\\"Alice\\"}" EX 3600`',
        examples: [
            'PING',
            'INFO memory',
            'DBSIZE',
            'SCAN 0 MATCH user:* COUNT 100',
            'GET user:42',
            'SET user:42 "hello" EX 60',
            'TTL user:42',
            'CLIENT LIST',
            'SLOWLOG GET 10',
            'LATENCY LATEST',
            'MEMORY USAGE user:42',
        ],
    },
    cassandra: {
        prompt: 'cqlsh>',
        docs_url: 'https://cassandra.apache.org/doc/latest/cassandra/cql/',
        syntax: 'CQL. Use fully-qualified table names (keyspace.table). Terminate statements with `;`.',
        examples: [
            'SELECT release_version, cluster_name FROM system.local;',
            'SELECT keyspace_name FROM system_schema.keyspaces;',
            "SELECT table_name FROM system_schema.tables WHERE keyspace_name = 'fathom_app';",
            'SELECT * FROM fathom_app.events WHERE partition_id = 42 AND ts > now() - 1h LIMIT 10;',
            "INSERT INTO fathom_app.audit (id, ts, actor, event) VALUES (uuid(), now(), 'alice', 'login');",
            'SELECT peer, data_center, rack FROM system.peers;',
        ],
    },
    dynamodb: {
        prompt: 'partiql>',
        docs_url: 'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ql-reference.html',
        syntax: 'PartiQL. DynamoDB supports SELECT / INSERT / UPDATE / DELETE over a single table at a time.',
        examples: [
            'SELECT * FROM "Events" WHERE pk = \'user#42\' LIMIT 10',
            'SELECT COUNT(*) FROM "Users"',
            "INSERT INTO \"Events\" VALUE {'pk':'user#42','sk':'e#2026-04-23','data':'login'}",
            "UPDATE \"Users\" SET last_seen = '2026-04-23' WHERE pk = 'user#42'",
            "DELETE FROM \"Events\" WHERE pk = 'user#42' AND sk = 'e#2026-04-23'",
        ],
    },
    mssql: {
        prompt: 'T-SQL>',
        docs_url: 'https://learn.microsoft.com/sql/t-sql/',
        syntax: 'T-SQL. Multi-statement batches supported; separate with `GO` in scripts.',
        examples: [
            'SELECT @@VERSION;',
            'SELECT name FROM sys.databases;',
            'SELECT TOP 10 * FROM sys.dm_exec_requests;',
        ],
    },
    oracle: {
        prompt: 'SQL>',
        docs_url: 'https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/',
        syntax: 'SQL*Plus-style. Queries can be terminated with `;` or `/`.',
        examples: [
            'SELECT banner FROM v$version;',
            "SELECT username FROM dba_users WHERE account_status = 'OPEN';",
            'SELECT sql_id, elapsed_time, executions FROM v$sql ORDER BY elapsed_time DESC FETCH FIRST 20 ROWS ONLY;',
        ],
    },
    snowflake: {
        prompt: 'SNOWFLAKE>',
        docs_url: 'https://docs.snowflake.com/en/sql-reference/',
        syntax: 'ANSI SQL + Snowflake-specific DDL.',
        examples: [
            'SELECT CURRENT_VERSION();',
            'SHOW WAREHOUSES;',
            "SELECT * FROM TABLE(INFORMATION_SCHEMA.QUERY_HISTORY(DATEADD('hour', -1, CURRENT_TIMESTAMP()), CURRENT_TIMESTAMP())) LIMIT 20;",
        ],
    },
    bigquery: {
        prompt: 'BigQuery>',
        docs_url: 'https://cloud.google.com/bigquery/docs/reference/standard-sql/',
        syntax: 'GoogleSQL. Fully-qualified table names in backticks: `project.dataset.table`.',
        examples: [
            'SELECT @@version;',
            'SELECT table_schema, table_name FROM `acme-analytics`.prod.INFORMATION_SCHEMA.TABLES LIMIT 20;',
            'SELECT COUNT(*) FROM `acme-analytics.prod.events` WHERE dt = CURRENT_DATE();',
        ],
    },
    redshift: {
        prompt: 'redshift>',
        docs_url: 'https://docs.aws.amazon.com/redshift/latest/dg/',
        syntax: 'Postgres-compatible SQL with Redshift-specific system views (SVV_, STV_, STL_).',
        examples: [
            'SELECT version();',
            'SELECT * FROM SVV_TABLE_INFO ORDER BY size DESC LIMIT 10;',
            "SELECT * FROM STL_QUERY WHERE starttime > GETDATE() - INTERVAL '1 hour' ORDER BY endtime DESC LIMIT 20;",
        ],
    },
};

/**
 * Given an adapter and a raw command string, dispatch it the right way.
 * Returns `{ rows, columns, meta }`.
 */
async function runOnAdapter(dbType, adapter, command, options = {}) {
    const db = String(dbType).toLowerCase();

    // Redis — command is a space-separated string; split on whitespace,
    // respecting simple double-quoted args so `SET foo "hello world"` works.
    if (db === 'redis') {
        const args = parseShellish(command);
        if (!args.length) throw new Error('empty command');
        // ioredis exposes sendCommand which takes the verb + args and
        // returns the raw reply. We wrap with adapter.client for the test path.
        const [verb, ...rest] = args;
        const client = adapter.client;
        if (!client || typeof client.call !== 'function') {
            throw new Error('Redis client is not connected');
        }
        const reply = await client.call(verb, ...rest);
        return shapeRedisReply(verb, reply);
    }

    // Cassandra / DynamoDB / SQL engines all route through executeQuery;
    // BaseAdapter-conforming adapters accept (sql, params).
    const { rows } = await adapter.executeQuery(command, options.params || []);
    if (!rows || rows.length === 0) {
        return { rows: [], columns: [], meta: { row_count: 0 } };
    }
    const columns = Object.keys(rows[0] || {});
    return { rows, columns, meta: { row_count: rows.length } };
}

/** Convert Redis reply (scalar, array, map) into a tabular shape. */
function shapeRedisReply(verb, reply) {
    if (reply == null) {
        return { rows: [{ result: '(nil)' }], columns: ['result'], meta: { row_count: 0 } };
    }
    if (typeof reply === 'string' || typeof reply === 'number' || typeof reply === 'boolean') {
        return { rows: [{ result: String(reply) }], columns: ['result'], meta: { row_count: 1 } };
    }
    if (Array.isArray(reply)) {
        // KEYS, SCAN, HGETALL-style replies.
        if (verb.toUpperCase() === 'SCAN' && reply.length === 2) {
            const [cursor, keys] = reply;
            return {
                rows: [
                    { cursor: String(cursor), key_count: (keys || []).length },
                    ...(keys || []).map((k) => ({ cursor: '', key_count: '', key: k })),
                ],
                columns: ['cursor', 'key_count', 'key'],
                meta: { next_cursor: String(cursor) },
            };
        }
        const rows = reply.map((v, i) => ({ '#': i, value: typeof v === 'object' ? JSON.stringify(v) : String(v) }));
        return { rows, columns: ['#', 'value'], meta: { row_count: rows.length } };
    }
    // Object/map reply — e.g. INFO parsed.
    const rows = Object.entries(reply).map(([k, v]) => ({
        key: k,
        value: typeof v === 'object' ? JSON.stringify(v) : String(v),
    }));
    return { rows, columns: ['key', 'value'], meta: { row_count: rows.length } };
}

/** Tiny shellish parser: splits "a b \"c d\" e" → ["a", "b", "c d", "e"]. */
function parseShellish(s) {
    const out = [];
    let buf = '';
    let quote = null;
    for (const ch of String(s || '').trim()) {
        if (quote) {
            if (ch === quote) {
                quote = null;
                continue;
            }
            buf += ch;
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (/\s/.test(ch)) {
            if (buf) {
                out.push(buf);
                buf = '';
            }
            continue;
        }
        buf += ch;
    }
    if (buf) out.push(buf);
    return out;
}

export default function engineConsoleRoutes(
    pool,
    authenticate,
    requireRole,
    resolveConnection, // fn(req, connectionId) → connection row
    getAdapterForConnection, // fn(connection) → adapter instance (connected)
    getActiveSchema, // optional fn(req, connectionId) → schema name | null
) {
    const router = Router();
    const gate = requireRole ? requireRole('admin', 'super_admin') : (_req, _res, next) => next();

    router.get('/api/engine-console/help', authenticate, (req, res) => {
        const db = String(req.query.dbType || '').toLowerCase();
        const help = ENGINE_HELP[db];
        if (!help) return res.status(404).json({ error: `No console help for engine: ${db}` });
        res.json(help);
    });

    router.post('/api/engine-console', authenticate, gate, async (req, res) => {
        const { connectionId, command, options } = req.body || {};
        if (!connectionId || !command) {
            return res.status(400).json({ error: 'connectionId and command are required' });
        }
        if (String(command).length > 50_000) {
            return res.status(413).json({ error: 'command too large (max 50KB)' });
        }
        const started = Date.now();
        let connection, adapter;
        try {
            connection = await resolveConnection(req, connectionId);
            if (!connection) return res.status(404).json({ error: 'connection not found' });
            adapter = await getAdapterForConnection(connection);
            // Apply the user's selected schema to this console session so
            // unqualified names resolve to it (Snowflake USE SCHEMA; MSSQL is a
            // documented no-op). Best-effort — never fail the query over it.
            try {
                const schema = getActiveSchema ? await getActiveSchema(req, connectionId) : null;
                if (schema && typeof adapter.useSchema === 'function') await adapter.useSchema(schema);
            } catch {
                /* schema hint is best-effort */
            }
            const result = await runOnAdapter(connection.dbType, adapter, command, options || {});
            const elapsed_ms = Date.now() - started;

            await writeAudit(pool, {
                actorId: req.user?.id,
                actorUsername: req.user?.username,
                action: 'ENGINE_CONSOLE_EXEC',
                resourceType: 'engine_console',
                resourceId: String(connectionId),
                level: 'warn',
                detail: `${connection.dbType} · ${String(command).slice(0, 200)}${command.length > 200 ? '…' : ''}`,
                ip: req.ip,
            }).catch(() => undefined);

            res.json({ ...result, elapsed_ms, dbType: connection.dbType });
        } catch (err) {
            await writeAudit(pool, {
                actorId: req.user?.id,
                actorUsername: req.user?.username,
                action: 'ENGINE_CONSOLE_FAIL',
                resourceType: 'engine_console',
                resourceId: String(connectionId),
                level: 'warn',
                detail: `error: ${err.message}`,
                ip: req.ip,
            }).catch(() => undefined);
            res.status(400).json({ error: err.message, elapsed_ms: Date.now() - started });
        } finally {
            // Intentionally don't disconnect the adapter — getAdapterForConnection
            // may return a pooled/cached instance. Its lifecycle is owned by the caller.
        }
    });

    return router;
}
