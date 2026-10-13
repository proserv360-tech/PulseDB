// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/erdRoutes.js
 *
 * Returns a full schema graph — tables, columns, foreign-key edges — in a
 * shape the frontend ERD viewer can lay out with dagre/cytoscape.
 *
 * GET /api/schema/erd?connection=<uuid>&schema=<name>
 *    → { nodes: [{ id, table, schema, columns: [...] }],
 *        edges: [{ from, to, from_col, to_col, fk_name }] }
 *
 * The service purposefully caps the graph to 200 tables so the browser
 * doesn't choke. Larger schemas get a 413 and a hint to filter by schema.
 */

import { Router } from 'express';

export default function erdRoutes(pool, authenticate, reqPool) {
    const router = Router();

    router.get('/api/schema/erd', authenticate, async (req, res) => {
        try {
            const targetSchema = String(req.query.schema || 'public');
            const connPool = reqPool ? await reqPool(req) : pool;

            // Pull tables + columns + FK edges. One round-trip each; the SQL is
            // standard information_schema so works on any Postgres 10+.
            const [tables, columns, fks] = await Promise.all([
                connPool.query(
                    `SELECT table_schema, table_name
                       FROM information_schema.tables
                      WHERE table_schema = $1
                        AND table_type = 'BASE TABLE'
                      ORDER BY table_name
                      LIMIT 201`,   // +1 to detect overflow
                    [targetSchema],
                ),
                connPool.query(
                    `SELECT table_schema, table_name, column_name, data_type,
                            is_nullable, column_default, ordinal_position
                       FROM information_schema.columns
                      WHERE table_schema = $1
                      ORDER BY table_name, ordinal_position`,
                    [targetSchema],
                ),
                connPool.query(
                    `SELECT
                         tc.constraint_name        AS fk_name,
                         tc.table_schema           AS from_schema,
                         tc.table_name             AS from_table,
                         kcu.column_name           AS from_col,
                         ccu.table_schema          AS to_schema,
                         ccu.table_name            AS to_table,
                         ccu.column_name           AS to_col
                       FROM information_schema.table_constraints tc
                       JOIN information_schema.key_column_usage kcu
                         ON tc.constraint_name = kcu.constraint_name
                        AND tc.table_schema    = kcu.table_schema
                       JOIN information_schema.constraint_column_usage ccu
                         ON tc.constraint_name = ccu.constraint_name
                        AND tc.table_schema    = ccu.table_schema
                      WHERE tc.constraint_type = 'FOREIGN KEY'
                        AND tc.table_schema    = $1`,
                    [targetSchema],
                ),
            ]);

            if (tables.rows.length > 200) {
                return res.status(413).json({
                    error: 'Schema too large for interactive ERD (>200 tables). Filter by schema=<name>.',
                    count: tables.rows.length,
                });
            }

            // Build nodes: one per table; attach its columns.
            const nodeMap = new Map();
            for (const t of tables.rows) {
                const id = `${t.table_schema}.${t.table_name}`;
                nodeMap.set(id, {
                    id,
                    schema: t.table_schema,
                    table:  t.table_name,
                    columns: [],
                });
            }
            for (const c of columns.rows) {
                const id = `${c.table_schema}.${c.table_name}`;
                const n = nodeMap.get(id);
                if (!n) continue;
                n.columns.push({
                    name:       c.column_name,
                    type:       c.data_type,
                    nullable:   c.is_nullable === 'YES',
                    has_default: c.column_default != null,
                });
            }

            const edges = fks.rows.map(f => ({
                fk_name:  f.fk_name,
                from:     `${f.from_schema}.${f.from_table}`,
                from_col: f.from_col,
                to:       `${f.to_schema}.${f.to_table}`,
                to_col:   f.to_col,
            })).filter(e => nodeMap.has(e.from) && nodeMap.has(e.to));

            res.json({
                schema: targetSchema,
                nodes:  [...nodeMap.values()],
                edges,
                counts: { tables: nodeMap.size, edges: edges.length },
            });
        } catch (err) {
            res.status(500).json({ error: 'Failed to build ERD', details: err.message });
        }
    });

    return router;
}
