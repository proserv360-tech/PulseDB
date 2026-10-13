// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/schemaRoutes.js
 * ──────────────────────
 * Schema relationships, dependencies, and column details.
 * Provides data for the Table Dependencies tab.
 *
 * Mount with:
 *   app.use('/api', schemaRoutes(pool, authenticate, reqPool));
 */

import { Router } from 'express';

function log(level, message, meta = {}) {
    const fn = level === 'ERROR' ? console.error : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg: message, ...meta }));
}

/**
 * Sanitizes and validates pagination parameters.
 * Returns an object with { limit: number, offset: number, error?: string }
 * limit: integer, min 1, max 1000, default 100
 * offset: integer, min 0, default 0
 */
function sanitizePagination(limit, offset) {
    let cleanLimit = 100; // default
    let cleanOffset = 0; // default

    // Validate and parse limit
    if (limit !== undefined) {
        const parsedLimit = parseInt(limit, 10);
        if (isNaN(parsedLimit) || parsedLimit < 1) {
            return { valid: false, error: 'limit must be a positive integer (min 1)' };
        }
        if (parsedLimit > 1000) {
            return { valid: false, error: 'limit must not exceed 1000' };
        }
        cleanLimit = parsedLimit;
    }

    // Validate and parse offset
    if (offset !== undefined) {
        const parsedOffset = parseInt(offset, 10);
        if (isNaN(parsedOffset) || parsedOffset < 0) {
            return { valid: false, error: 'offset must be a non-negative integer' };
        }
        cleanOffset = parsedOffset;
    }

    return { valid: true, limit: cleanLimit, offset: cleanOffset };
}

export default function schemaRoutes(pool, authenticate, reqPool) {
    const router = Router();

    /**
     * Resolve the correct database pool for a request.
     * Uses the user's active connection if reqPool is provided.
     * Does NOT fall back to admin pool — schema routes must always
     * query the user's connected database, never the tool's internal DB.
     */
    async function resolvePool(req) {
        if (reqPool) {
            return await reqPool(req); // Let errors propagate — no silent fallback
        }
        return pool;
    }

    /**
     * GET /api/schema/relationships
     * Returns all foreign key relationships between tables (entities and edges)
     */
    router.get('/schema/relationships', authenticate, async (req, res) => {
        try {
            // Get all tables with metadata
            const tablesQuery = `
                SELECT
                    n.oid::regnamespace::text AS schema,
                    c.relname AS name,
                    c.oid::regclass::text AS id,
                    c.reltuples::bigint AS "rowCount",
                    pg_size_pretty(pg_total_relation_size(c.oid)) AS size
                FROM pg_class c
                JOIN pg_namespace n ON c.relnamespace = n.oid
                WHERE c.relkind = 'r'
                  AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_toast_temp_*', 'pgmonitoringtool')
                ORDER BY n.oid, c.relname;
            `;

            // Get foreign key relationships
            const relationshipsQuery = `
                SELECT
                    fk.conname AS "fkName",
                    fk.contype AS type,
                    fk.confdeltype AS "onDelete",
                    fk.confupdtype AS "onUpdate",
                    t1.relname AS "fromTable",
                    t2.relname AS "toTable",
                    ns1.nspname AS "fromSchema",
                    ns2.nspname AS "toSchema",
                    a1.attname AS "fromColumn",
                    a2.attname AS "toColumn"
                FROM pg_constraint fk
                JOIN pg_class t1 ON fk.conrelid = t1.oid
                JOIN pg_class t2 ON fk.confrelid = t2.oid
                JOIN pg_namespace ns1 ON t1.relnamespace = ns1.oid
                JOIN pg_namespace ns2 ON t2.relnamespace = ns2.oid
                JOIN pg_attribute a1 ON fk.conrelid = a1.attrelid
                    AND a1.attnum = ANY(fk.conkey)
                JOIN pg_attribute a2 ON fk.confrelid = a2.attrelid
                    AND a2.attnum = ANY(fk.confkey)
                WHERE fk.contype = 'f'
                  AND ns1.nspname NOT IN ('pg_catalog', 'information_schema', 'pgmonitoringtool')
                ORDER BY ns1.nspname, t1.relname, fk.conname;
            `;

            const connPool = await resolvePool(req);
            const [tablesResult, relationshipsResult] = await Promise.all([
                connPool.query(tablesQuery),
                connPool.query(relationshipsQuery),
            ]);

            const tables = tablesResult.rows.map((row) => ({
                id: `${row.schema}.${row.name}`,
                name: row.name,
                schema: row.schema,
                rowCount: row.rowCount || 0,
                size: row.size,
            }));

            const relationships = relationshipsResult.rows.map((row) => ({
                id: `${row.fromSchema}.${row.fromTable}\u2192${row.toSchema}.${row.toTable}`,
                from: `${row.fromSchema}.${row.fromTable}`,
                to: `${row.toSchema}.${row.toTable}`,
                fromColumn: row.fromColumn,
                toColumn: row.toColumn,
                type: 'fk',
                onDelete: row.onDelete,
                onUpdate: row.onUpdate,
                cardinality: '1:N',
            }));

            res.json({ tables, relationships });
        } catch (err) {
            log('ERROR', 'Failed to fetch schema relationships', { error: err.message });
            res.status(500).json({ error: err.message, tables: [], relationships: [] });
        }
    });

    /**
     * GET /api/schema/dependencies
     * Returns view and function dependencies on tables
     */
    router.get('/schema/dependencies', authenticate, async (req, res) => {
        try {
            const query = `
                SELECT
                    n1.nspname::text || '.' || c1.relname::text AS source,
                    n2.nspname::text || '.' || c2.relname::text AS target,
                    CASE
                        WHEN c1.relkind = 'v' THEN 'view'
                        WHEN c1.relkind = 'm' THEN 'materialized_view'
                        ELSE 'function'
                    END AS dependencyType
                FROM pg_depend d
                JOIN pg_class c1 ON d.objid = c1.oid
                JOIN pg_class c2 ON d.refobjid = c2.oid
                JOIN pg_namespace n1 ON c1.relnamespace = n1.oid
                JOIN pg_namespace n2 ON c2.relnamespace = n2.oid
                WHERE d.deptype IN ('n', 'a')
                  AND c1.relkind IN ('v', 'm')
                  AND c2.relkind = 'r'
                  AND n1.nspname NOT IN ('pg_catalog', 'information_schema', 'pgmonitoringtool')
                GROUP BY n1.nspname, c1.relname, c1.relkind, n2.nspname, c2.relname
                ORDER BY n1.nspname, c1.relname;
            `;

            const connPool = await resolvePool(req);
            const result = await connPool.query(query);
            const dependencies = result.rows.map((row) => ({
                id: `${row.source}\u2192${row.target}`,
                source: row.source,
                target: row.target,
                dependencyType: row.dependencyType,
            }));

            res.json({ dependencies });
        } catch (err) {
            log('ERROR', 'Failed to fetch schema dependencies', { error: err.message });
            res.status(500).json({ error: err.message, dependencies: [] });
        }
    });

    /**
     * GET /api/schema/tree
     * Returns a hierarchical tree of schemas, tables, views, functions, and sequences
     * Structure: { schemas: [{ name, tables: [...], views: [...], functions: [...], sequences: [...] }] }
     */
    router.get('/schema/tree', authenticate, async (req, res) => {
        try {
            // Get all user-defined schemas
            const schemasQuery = `
                SELECT n.nspname AS schema_name
                FROM pg_namespace n
                WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_toast_temp_*', 'pgmonitoringtool')
                ORDER BY n.nspname;
            `;

            // Get tables with column info
            const tablesQuery = `
                SELECT
                    t.table_schema,
                    t.table_name,
                    c.column_name,
                    c.data_type,
                    c.is_nullable,
                    tc.constraint_type
                FROM information_schema.tables t
                JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
                LEFT JOIN information_schema.table_constraints tc
                    ON c.table_name = tc.table_name
                    AND c.table_schema = tc.table_schema
                    AND c.column_name IN (SELECT column_name FROM information_schema.key_column_usage WHERE constraint_name = tc.constraint_name)
                WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pgmonitoringtool')
                AND t.table_type = 'BASE TABLE'
                ORDER BY t.table_schema, t.table_name, c.ordinal_position;
            `;

            // Get views
            const viewsQuery = `
                SELECT table_schema, table_name
                FROM information_schema.tables
                WHERE table_type = 'VIEW'
                AND table_schema NOT IN ('pg_catalog', 'information_schema', 'pgmonitoringtool')
                ORDER BY table_schema, table_name;
            `;

            // Get functions
            const functionsQuery = `
                SELECT n.nspname, p.proname
                FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pgmonitoringtool')
                AND p.prokind = 'f'
                ORDER BY n.nspname, p.proname;
            `;

            // Get sequences
            const sequencesQuery = `
                SELECT sequence_schema, sequence_name
                FROM information_schema.sequences
                WHERE sequence_schema NOT IN ('pg_catalog', 'information_schema', 'pgmonitoringtool')
                ORDER BY sequence_schema, sequence_name;
            `;

            const connPool = await resolvePool(req);
            const [schemasRes, tablesRes, viewsRes, functionsRes, sequencesRes] = await Promise.all([
                connPool.query(schemasQuery),
                connPool.query(tablesQuery),
                connPool.query(viewsQuery),
                connPool.query(functionsQuery),
                connPool.query(sequencesQuery),
            ]);

            // Build hierarchical structure
            const schemaMap = {};
            schemasRes.rows.forEach((row) => {
                schemaMap[row.schema_name] = {
                    name: row.schema_name,
                    tables: [],
                    views: [],
                    functions: [],
                    sequences: [],
                };
            });

            // Add tables with columns
            const tableMap = {};
            tablesRes.rows.forEach((row) => {
                const schemaKey = row.table_schema;
                if (!schemaMap[schemaKey]) return;

                const tableKey = `${schemaKey}.${row.table_name}`;
                if (!tableMap[tableKey]) {
                    tableMap[tableKey] = {
                        name: row.table_name,
                        schema: schemaKey,
                        columns: [],
                    };
                    schemaMap[schemaKey].tables.push(tableMap[tableKey]);
                }

                tableMap[tableKey].columns.push({
                    name: row.column_name,
                    type: row.data_type,
                    nullable: row.is_nullable === 'YES',
                    isPrimaryKey: row.constraint_type === 'PRIMARY KEY',
                    isForeignKey: row.constraint_type === 'FOREIGN KEY',
                });
            });

            // Add views
            viewsRes.rows.forEach((row) => {
                const schemaKey = row.table_schema;
                if (schemaMap[schemaKey]) {
                    schemaMap[schemaKey].views.push({ name: row.table_name });
                }
            });

            // Add functions
            functionsRes.rows.forEach((row) => {
                const schemaKey = row.nspname;
                if (schemaMap[schemaKey]) {
                    schemaMap[schemaKey].functions.push({ name: row.proname });
                }
            });

            // Add sequences
            sequencesRes.rows.forEach((row) => {
                const schemaKey = row.sequence_schema;
                if (schemaMap[schemaKey]) {
                    schemaMap[schemaKey].sequences.push({ name: row.sequence_name });
                }
            });

            const schemas = Object.values(schemaMap);
            res.json({ schemas });
        } catch (err) {
            log('ERROR', 'Failed to fetch schema tree', { error: err.message });
            res.status(500).json({ schemas: [] });
        }
    });

    /**
     * GET /api/schema/columns/:schema/:table
     * Returns detailed column information including statistics
     */
    router.get('/schema/columns/:schema/:table', authenticate, async (req, res) => {
        try {
            const { schema, table } = req.params;

            const columnsQuery = `
                SELECT
                    c.column_name AS name,
                    c.data_type AS type,
                    c.is_nullable = 'YES' AS nullable,
                    c.column_default AS default,
                    CASE
                        WHEN tc.constraint_type = 'PRIMARY KEY' THEN true
                        ELSE false
                    END AS isPrimaryKey,
                    CASE
                        WHEN kcu.column_name IS NOT NULL THEN true
                        ELSE false
                    END AS isForeignKey
                FROM information_schema.columns c
                LEFT JOIN information_schema.table_constraints tc
                    ON c.table_name = tc.table_name
                    AND c.table_schema = tc.table_schema
                    AND tc.constraint_type = 'PRIMARY KEY'
                LEFT JOIN information_schema.key_column_usage kcu
                    ON c.column_name = kcu.column_name
                    AND c.table_name = kcu.table_name
                    AND c.table_schema = kcu.table_schema
                    AND kcu.constraint_name LIKE '%fk%'
                WHERE c.table_schema = $1
                  AND c.table_name = $2
                ORDER BY c.ordinal_position;
            `;

            const statsQuery = `
                SELECT
                    attname AS name,
                    n_distinct AS distinctValues,
                    null_frac AS nullFraction,
                    avg_width AS avgWidth
                FROM pg_stats
                WHERE schemaname = $1
                  AND tablename = $2
                ORDER BY attnum;
            `;

            const connPool = await resolvePool(req);
            const [columnsResult, statsResult] = await Promise.all([
                connPool.query(columnsQuery, [schema, table]),
                connPool.query(statsQuery, [schema, table]),
            ]);

            const statsMap = {};
            statsResult.rows.forEach((row) => {
                statsMap[row.name] = {
                    distinctValues: row.distinctValues,
                    nullFraction: row.nullFraction,
                    avgWidth: row.avgWidth,
                };
            });

            const columns = columnsResult.rows.map((row) => ({
                name: row.name,
                type: row.type,
                nullable: row.nullable,
                default: row.default,
                isPrimaryKey: row.isPrimaryKey,
                isForeignKey: row.isForeignKey,
                ...statsMap[row.name],
            }));

            res.json({ columns });
        } catch (err) {
            log('ERROR', 'Failed to fetch column details', { error: err.message });
            res.status(500).json({ error: err.message, columns: [] });
        }
    });

    return router;
}
