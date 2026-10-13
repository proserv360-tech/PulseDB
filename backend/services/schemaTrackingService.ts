/**
 * services/schemaTrackingService.ts
 * ─────────────────────────────────
 * Continuous schema tracking + drift timeline (gap-analysis P1-2).
 *
 * Datadog DBM's Schema Explorer tracks schema changes over time and lets
 * operators correlate them with performance regressions. FATHOM had
 * on-demand schema diff only. This service captures canonical snapshots of
 * a monitored connection's schema (tables, columns, indexes), hashes them,
 * and when the hash changes computes a structured diff that is stored as
 * timeline events.
 *
 *   captureSnapshot({ controlPool, targetPool, connectionId })
 *   getTimeline({ controlPool, connectionId, limit })
 *   diffSchemas(before, after)  — exported for tests
 */

import crypto from 'node:crypto';
import { log } from './logger.js';

/** Canonical schema description of a Postgres database. */
export async function describeSchema(targetPool: any) {
    const tablesQ = targetPool.query(`
        SELECT table_schema, table_name
          FROM information_schema.tables
         WHERE table_type = 'BASE TABLE'
           AND table_schema NOT IN ('pg_catalog', 'information_schema')
         ORDER BY 1, 2`);
    const columnsQ = targetPool.query(`
        SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
         WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
         ORDER BY 1, 2, ordinal_position`);
    const indexesQ = targetPool.query(`
        SELECT schemaname AS table_schema, tablename AS table_name, indexname, indexdef
          FROM pg_indexes
         WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
         ORDER BY 1, 2, 3`);
    const [tables, columns, indexes] = await Promise.all([tablesQ, columnsQ, indexesQ]);

    const schema: Record<string, any> = {};
    for (const t of tables.rows) {
        schema[`${t.table_schema}.${t.table_name}`] = { columns: {}, indexes: {} };
    }
    for (const c of columns.rows) {
        const key = `${c.table_schema}.${c.table_name}`;
        if (!schema[key]) continue;
        schema[key].columns[c.column_name] = {
            type: c.data_type,
            nullable: c.is_nullable === 'YES',
            default: c.column_default ?? null,
        };
    }
    for (const i of indexes.rows) {
        const key = `${i.table_schema}.${i.table_name}`;
        if (!schema[key]) continue;
        schema[key].indexes[i.indexname] = i.indexdef;
    }
    return schema;
}

export function hashSchema(schema: any): string {
    return crypto.createHash('sha256').update(JSON.stringify(schema)).digest('hex');
}

/** Structured diff between two canonical schemas. */
export function diffSchemas(before: any, after: any) {
    const changes: Array<{ change_type: string; object_type: string; object_name: string; detail: any }> = [];
    const bTables = new Set(Object.keys(before || {}));
    const aTables = new Set(Object.keys(after || {}));

    for (const t of aTables) {
        if (!bTables.has(t)) {
            changes.push({
                change_type: 'added',
                object_type: 'table',
                object_name: t,
                detail: { columns: Object.keys(after[t].columns).length },
            });
        }
    }
    for (const t of bTables) {
        if (!aTables.has(t)) {
            changes.push({ change_type: 'removed', object_type: 'table', object_name: t, detail: {} });
        }
    }
    for (const t of aTables) {
        if (!bTables.has(t)) continue;
        const bCols = before[t].columns || {},
            aCols = after[t].columns || {};
        for (const c of Object.keys(aCols)) {
            if (!(c in bCols)) {
                changes.push({
                    change_type: 'added',
                    object_type: 'column',
                    object_name: `${t}.${c}`,
                    detail: aCols[c],
                });
            } else if (JSON.stringify(aCols[c]) !== JSON.stringify(bCols[c])) {
                changes.push({
                    change_type: 'modified',
                    object_type: 'column',
                    object_name: `${t}.${c}`,
                    detail: { before: bCols[c], after: aCols[c] },
                });
            }
        }
        for (const c of Object.keys(bCols)) {
            if (!(c in aCols)) {
                changes.push({
                    change_type: 'removed',
                    object_type: 'column',
                    object_name: `${t}.${c}`,
                    detail: bCols[c],
                });
            }
        }
        const bIdx = before[t].indexes || {},
            aIdx = after[t].indexes || {};
        for (const i of Object.keys(aIdx)) {
            if (!(i in bIdx)) {
                changes.push({
                    change_type: 'added',
                    object_type: 'index',
                    object_name: `${t}.${i}`,
                    detail: { def: aIdx[i] },
                });
            } else if (aIdx[i] !== bIdx[i]) {
                changes.push({
                    change_type: 'modified',
                    object_type: 'index',
                    object_name: `${t}.${i}`,
                    detail: { before: bIdx[i], after: aIdx[i] },
                });
            }
        }
        for (const i of Object.keys(bIdx)) {
            if (!(i in aIdx)) {
                changes.push({
                    change_type: 'removed',
                    object_type: 'index',
                    object_name: `${t}.${i}`,
                    detail: { def: bIdx[i] },
                });
            }
        }
    }
    return changes;
}

/**
 * Capture a snapshot for `connectionId`. If the schema changed since the
 * previous snapshot, store the new snapshot + one timeline row per change.
 * Returns { changed, changes } — `changed: false` costs one hash lookup.
 */
export async function captureSnapshot({ controlPool, targetPool, connectionId }: any) {
    const schema = await describeSchema(targetPool);
    const hash = hashSchema(schema);

    const prev = await controlPool.query(
        `SELECT id, hash, schema FROM fathom_schema_snapshots
          WHERE connection_id = $1 ORDER BY captured_at DESC LIMIT 1`,
        [String(connectionId)],
    );

    if (prev.rows.length && prev.rows[0].hash === hash) {
        return { changed: false, changes: [] };
    }

    const changes = prev.rows.length ? diffSchemas(prev.rows[0].schema, schema) : [];

    await controlPool.query(`INSERT INTO fathom_schema_snapshots (connection_id, hash, schema) VALUES ($1, $2, $3)`, [
        String(connectionId),
        hash,
        JSON.stringify(schema),
    ]);
    for (const ch of changes) {
        await controlPool.query(
            `INSERT INTO fathom_schema_changes (connection_id, change_type, object_type, object_name, detail)
             VALUES ($1, $2, $3, $4, $5)`,
            [String(connectionId), ch.change_type, ch.object_type, ch.object_name, JSON.stringify(ch.detail)],
        );
    }
    if (changes.length) {
        log('INFO', `schema tracking: ${changes.length} change(s) on connection ${connectionId}`);
    }
    return { changed: true, changes, initial: !prev.rows.length };
}

export async function getTimeline({ controlPool, connectionId, limit = 100 }: any) {
    const { rows } = await controlPool.query(
        `SELECT id, change_type, object_type, object_name, detail, detected_at
           FROM fathom_schema_changes
          WHERE connection_id = $1
          ORDER BY detected_at DESC
          LIMIT $2`,
        [String(connectionId), Math.min(Number(limit) || 100, 500)],
    );
    return rows;
}
