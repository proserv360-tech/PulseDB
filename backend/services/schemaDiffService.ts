// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/schemaDiffService.js
 * ────────────────────────────
 * Postgres schema comparison and migration SQL generation.
 * Works on any Postgres 12+ using information_schema + pg_catalog.
 *
 * Functions are split into:
 *   - DB functions (accept a pg client, caller manages acquisition)
 *   - Pure helpers (testable, deterministic)
 *   - Orchestrators (manage connection lifecycle)
 */

import { quoteIdent, quoteLit } from './sqlIdent.js';

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPERS (exported, testable without DB)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compare two snapshots and return a detailed diff.
 * PURE: no side effects, deterministic output (sorted keys).
 */
export function diffSchemas(left, right) {
    const result = {
        tablesAdded: [],
        tablesRemoved: [],
        tablesChanged: [],
        viewsAdded: [],
        viewsRemoved: [],
        viewsChanged: [],
        sequencesAdded: [],
        sequencesRemoved: [],
        sequencesChanged: [],
        enumsAdded: [],
        enumsRemoved: [],
        enumsChanged: [],
        totalChangeCount: 0,
    };

    // ── Tables ────────────────────────────────────────────────────────────
    const leftTableNames = new Set(Object.keys(left.tables || {}).sort());
    const rightTableNames = new Set(Object.keys(right.tables || {}).sort());

    // Tables added
    for (const name of rightTableNames) {
        if (!leftTableNames.has(name)) {
            result.tablesAdded.push({
                name,
                table: right.tables[name],
            });
            result.totalChangeCount++;
        }
    }

    // Tables removed
    for (const name of leftTableNames) {
        if (!rightTableNames.has(name)) {
            result.tablesRemoved.push({ name });
            result.totalChangeCount++;
        }
    }

    // Tables changed
    for (const name of leftTableNames) {
        if (!rightTableNames.has(name)) continue;

        const leftTable = left.tables[name];
        const rightTable = right.tables[name];
        const tableChange = {
            name,
            columnsAdded: [],
            columnsRemoved: [],
            columnsChanged: [],
            indexesAdded: [],
            indexesRemoved: [],
            indexesChanged: [],
            foreignKeysAdded: [],
            foreignKeysRemoved: [],
            primaryKeyChanged: null,
        };

        // ── Columns ─────────────────────────────────────────────────────
        const leftColNames = new Set(Object.keys(leftTable.columns || {}).sort());
        const rightColNames = new Set(Object.keys(rightTable.columns || {}).sort());

        for (const colName of rightColNames) {
            if (!leftColNames.has(colName)) {
                tableChange.columnsAdded.push({
                    name: colName,
                    ...rightTable.columns[colName],
                });
            }
        }

        for (const colName of leftColNames) {
            if (!rightColNames.has(colName)) {
                tableChange.columnsRemoved.push({ name: colName });
            }
        }

        for (const colName of leftColNames) {
            if (!rightColNames.has(colName)) continue;

            const leftCol = leftTable.columns[colName];
            const rightCol = rightTable.columns[colName];
            const changes = {};

            if (leftCol.dataType !== rightCol.dataType) {
                changes.dataType = [leftCol.dataType, rightCol.dataType];
            }
            if (leftCol.isNullable !== rightCol.isNullable) {
                changes.isNullable = [leftCol.isNullable, rightCol.isNullable];
            }
            if (leftCol.columnDefault !== rightCol.columnDefault) {
                changes.columnDefault = [leftCol.columnDefault, rightCol.columnDefault];
            }

            if (Object.keys(changes).length > 0) {
                tableChange.columnsChanged.push({
                    name: colName,
                    before: leftCol,
                    after: rightCol,
                    changes,
                });
            }
        }

        // ── Primary Key ─────────────────────────────────────────────────
        const leftPk = (leftTable.primaryKey || []).sort().join(',');
        const rightPk = (rightTable.primaryKey || []).sort().join(',');
        if (leftPk !== rightPk) {
            tableChange.primaryKeyChanged = {
                before: leftTable.primaryKey || [],
                after: rightTable.primaryKey || [],
            };
        }

        // ── Indexes ─────────────────────────────────────────────────────
        const leftIndexMap = new Map((leftTable.indexes || []).map(i => [i.name, i]));
        const rightIndexMap = new Map((rightTable.indexes || []).map(i => [i.name, i]));

        for (const [name, rightIdx] of rightIndexMap) {
            if (!leftIndexMap.has(name)) {
                tableChange.indexesAdded.push(rightIdx);
            }
        }

        for (const [name, leftIdx] of leftIndexMap) {
            if (!rightIndexMap.has(name)) {
                tableChange.indexesRemoved.push(leftIdx);
            } else {
                const rightIdx = rightIndexMap.get(name);
                const leftCols = (leftIdx.columns || []).sort().join(',');
                const rightCols = (rightIdx.columns || []).sort().join(',');
                if (leftCols !== rightCols) {
                    tableChange.indexesChanged.push({
                        name,
                        before: leftIdx,
                        after: rightIdx,
                    });
                }
            }
        }

        // ── Foreign Keys ────────────────────────────────────────────────
        const leftFkMap = new Map((leftTable.foreignKeys || []).map(fk => [fk.name, fk]));
        const rightFkMap = new Map((rightTable.foreignKeys || []).map(fk => [fk.name, fk]));

        for (const [name, rightFk] of rightFkMap) {
            if (!leftFkMap.has(name)) {
                tableChange.foreignKeysAdded.push(rightFk);
            }
        }

        for (const [name, leftFk] of leftFkMap) {
            if (!rightFkMap.has(name)) {
                tableChange.foreignKeysRemoved.push(leftFk);
            }
        }

        // Only record table change if there is one
        if (
            tableChange.columnsAdded.length > 0 ||
            tableChange.columnsRemoved.length > 0 ||
            tableChange.columnsChanged.length > 0 ||
            tableChange.indexesAdded.length > 0 ||
            tableChange.indexesRemoved.length > 0 ||
            tableChange.indexesChanged.length > 0 ||
            tableChange.foreignKeysAdded.length > 0 ||
            tableChange.foreignKeysRemoved.length > 0 ||
            tableChange.primaryKeyChanged !== null
        ) {
            result.tablesChanged.push(tableChange);
            result.totalChangeCount++;
        }
    }

    // ── Views ─────────────────────────────────────────────────────────────
    const leftViewNames = new Set(Object.keys(left.views || {}).sort());
    const rightViewNames = new Set(Object.keys(right.views || {}).sort());

    for (const name of rightViewNames) {
        if (!leftViewNames.has(name)) {
            result.viewsAdded.push({
                name,
                definition: right.views[name].definition,
            });
            result.totalChangeCount++;
        }
    }

    for (const name of leftViewNames) {
        if (!rightViewNames.has(name)) {
            result.viewsRemoved.push({ name });
            result.totalChangeCount++;
        }
    }

    for (const name of leftViewNames) {
        if (!rightViewNames.has(name)) continue;
        if (left.views[name].definition !== right.views[name].definition) {
            result.viewsChanged.push({
                name,
                before: left.views[name].definition,
                after: right.views[name].definition,
            });
            result.totalChangeCount++;
        }
    }

    // ── Sequences ─────────────────────────────────────────────────────────
    const leftSeqNames = new Set(Object.keys(left.sequences || {}).sort());
    const rightSeqNames = new Set(Object.keys(right.sequences || {}).sort());

    for (const name of rightSeqNames) {
        if (!leftSeqNames.has(name)) {
            result.sequencesAdded.push({
                name,
                ...right.sequences[name],
            });
            result.totalChangeCount++;
        }
    }

    for (const name of leftSeqNames) {
        if (!rightSeqNames.has(name)) {
            result.sequencesRemoved.push({ name });
            result.totalChangeCount++;
        }
    }

    // ── Enums ─────────────────────────────────────────────────────────────
    const leftEnumNames = new Set(Object.keys(left.enums || {}).sort());
    const rightEnumNames = new Set(Object.keys(right.enums || {}).sort());

    for (const name of rightEnumNames) {
        if (!leftEnumNames.has(name)) {
            result.enumsAdded.push({
                name,
                values: right.enums[name].values,
            });
            result.totalChangeCount++;
        }
    }

    for (const name of leftEnumNames) {
        if (!rightEnumNames.has(name)) {
            result.enumsRemoved.push({ name });
            result.totalChangeCount++;
        }
    }

    for (const name of leftEnumNames) {
        if (!rightEnumNames.has(name)) continue;
        const leftVals = (left.enums[name].values || []).sort().join(',');
        const rightVals = (right.enums[name].values || []).sort().join(',');
        if (leftVals !== rightVals) {
            result.enumsChanged.push({
                name,
                before: left.enums[name].values,
                after: right.enums[name].values,
            });
            result.totalChangeCount++;
        }
    }

    return result;
}

/**
 * Generate migration SQL from a diff.
 * PURE: deterministic SQL generation.
 */
export function generateMigrationSql(diff, { direction = 'left-to-right' } = {}) {
    const isReverse = direction === 'right-to-left';
    const lines = [];

    lines.push('-- Generated by PulseDB schema-diff at ' + new Date().toISOString());
    lines.push('-- REVIEW THIS SCRIPT CAREFULLY BEFORE RUNNING IN PRODUCTION');
    lines.push('-- This is a best-effort migration; complex type changes may require manual intervention');
    lines.push('');

    if (diff.totalChangeCount === 0) {
        lines.push('-- No schema changes detected');
        return lines.join('\n');
    }

    lines.push('BEGIN;');
    lines.push('');

    // ── Tables ────────────────────────────────────────────────────────────
    if (!isReverse) {
        // Add tables (left → right)
        for (const { name, table } of diff.tablesAdded) {
            lines.push(`CREATE TABLE ${quoteIdent(name)} (`);
            const colLines = [];
            const colNames = Object.keys(table.columns || {}).sort();

            for (const colName of colNames) {
                const col = table.columns[colName];
                let colDef = `    ${quoteIdent(colName)} ${col.dataType}`;
                if (!col.isNullable) colDef += ' NOT NULL';
                if (col.columnDefault) colDef += ` DEFAULT ${col.columnDefault}`;
                colLines.push(colDef);
            }

            if (table.primaryKey && table.primaryKey.length > 0) {
                const pkCols = table.primaryKey.map(quoteIdent).join(', ');
                colLines.push(`    PRIMARY KEY (${pkCols})`);
            }

            lines.push(colLines.join(',\n'));
            lines.push(');');
            lines.push('');
        }

        // Drop tables (right → left is drop; left → right is remove drops)
        // In left-to-right, we don't drop tables — that's handled by the reverse
    } else {
        // Reverse: drop tables
        for (const { name } of diff.tablesRemoved) {
            lines.push(`DROP TABLE IF EXISTS ${quoteIdent(name)} CASCADE;`);
        }
    }

    // ── Column modifications ──────────────────────────────────────────────
    for (const tblChange of diff.tablesChanged) {
        const tbl = quoteIdent(tblChange.name);

        // Add columns
        for (const col of tblChange.columnsAdded) {
            let colDef = `${col.dataType}`;
            if (!col.isNullable) colDef += ' NOT NULL';
            if (col.columnDefault) colDef += ` DEFAULT ${col.columnDefault}`;
            lines.push(`ALTER TABLE ${tbl} ADD COLUMN ${quoteIdent(col.name)} ${colDef};`);
        }

        // Drop columns
        for (const col of tblChange.columnsRemoved) {
            lines.push(`ALTER TABLE ${tbl} DROP COLUMN ${quoteIdent(col.name)};`);
        }

        // Alter columns
        for (const colChange of tblChange.columnsChanged) {
            const col = quoteIdent(colChange.name);
            if (colChange.changes.dataType) {
                lines.push(`-- WARNING: Type change from ${colChange.changes.dataType[0]} to ${colChange.changes.dataType[1]} requires data migration`);
                lines.push(`-- ALTER TABLE ${tbl} ALTER COLUMN ${col} TYPE ${colChange.changes.dataType[1]} USING ${col}::${colChange.changes.dataType[1]};`);
            }
            if (colChange.changes.isNullable) {
                const nullable = colChange.changes.isNullable[1];
                if (nullable) {
                    lines.push(`ALTER TABLE ${tbl} ALTER COLUMN ${col} DROP NOT NULL;`);
                } else {
                    lines.push(`ALTER TABLE ${tbl} ALTER COLUMN ${col} SET NOT NULL;`);
                }
            }
            if (colChange.changes.columnDefault) {
                const newDefault = colChange.changes.columnDefault[1];
                if (newDefault) {
                    lines.push(`ALTER TABLE ${tbl} ALTER COLUMN ${col} SET DEFAULT ${newDefault};`);
                } else {
                    lines.push(`ALTER TABLE ${tbl} ALTER COLUMN ${col} DROP DEFAULT;`);
                }
            }
        }

        // Primary key changes
        if (tblChange.primaryKeyChanged) {
            const before = tblChange.primaryKeyChanged.before;
            if (before && before.length > 0) {
                lines.push(`ALTER TABLE ${tbl} DROP CONSTRAINT ${quoteIdent(`${tblChange.name}_pkey`)};`);
            }
            const after = tblChange.primaryKeyChanged.after;
            if (after && after.length > 0) {
                const pkCols = after.map(quoteIdent).join(', ');
                lines.push(`ALTER TABLE ${tbl} ADD PRIMARY KEY (${pkCols});`);
            }
        }

        // Add indexes
        for (const idx of tblChange.indexesAdded) {
            const cols = (idx.columns || []).map(quoteIdent).join(', ');
            const unique = idx.isUnique ? 'UNIQUE ' : '';
            const method = idx.method && idx.method.toLowerCase() !== 'btree' ? ` USING ${idx.method}` : '';
            lines.push(`CREATE ${unique}INDEX CONCURRENTLY ${quoteIdent(idx.name)} ON ${tbl} (${cols})${method};`);
        }

        // Drop indexes
        for (const idx of tblChange.indexesRemoved) {
            lines.push(`DROP INDEX CONCURRENTLY IF EXISTS ${quoteIdent(idx.name)};`);
        }

        // Drop and recreate changed indexes
        for (const idxChange of tblChange.indexesChanged) {
            lines.push(`DROP INDEX CONCURRENTLY IF EXISTS ${quoteIdent(idxChange.name)};`);
            const cols = (idxChange.after.columns || []).map(quoteIdent).join(', ');
            const unique = idxChange.after.isUnique ? 'UNIQUE ' : '';
            const method = idxChange.after.method && idxChange.after.method.toLowerCase() !== 'btree' ? ` USING ${idxChange.after.method}` : '';
            lines.push(`CREATE ${unique}INDEX CONCURRENTLY ${quoteIdent(idxChange.name)} ON ${tbl} (${cols})${method};`);
        }

        // Add foreign keys
        for (const fk of tblChange.foreignKeysAdded) {
            const cols = fk.columns.map(quoteIdent).join(', ');
            const refCols = fk.references.columns.map(quoteIdent).join(', ');
            const refTbl = quoteIdent(fk.references.table);
            const onUpdate = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '';
            const onDelete = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
            lines.push(`ALTER TABLE ${tbl} ADD CONSTRAINT ${quoteIdent(fk.name)} FOREIGN KEY (${cols}) REFERENCES ${refTbl} (${refCols})${onUpdate}${onDelete};`);
        }

        // Drop foreign keys
        for (const fk of tblChange.foreignKeysRemoved) {
            lines.push(`ALTER TABLE ${tbl} DROP CONSTRAINT ${quoteIdent(fk.name)};`);
        }
    }

    // ── Views ─────────────────────────────────────────────────────────────
    if (!isReverse) {
        for (const view of diff.viewsAdded) {
            lines.push(`CREATE VIEW ${quoteIdent(view.name)} AS`);
            lines.push(view.definition + ';');
            lines.push('');
        }

        for (const view of diff.viewsChanged) {
            lines.push(`DROP VIEW IF EXISTS ${quoteIdent(view.name)} CASCADE;`);
            lines.push(`CREATE VIEW ${quoteIdent(view.name)} AS`);
            lines.push(view.after + ';');
            lines.push('');
        }
    } else {
        for (const view of diff.viewsRemoved) {
            lines.push(`DROP VIEW IF EXISTS ${quoteIdent(view.name)} CASCADE;`);
        }
    }

    // ── Sequences ─────────────────────────────────────────────────────────
    if (!isReverse) {
        for (const seq of diff.sequencesAdded) {
            lines.push(`CREATE SEQUENCE ${quoteIdent(seq.name)}`);
            if (seq.startValue) lines.push(`    START WITH ${seq.startValue}`);
            if (seq.increment) lines.push(`    INCREMENT BY ${seq.increment}`);
            if (seq.minValue) lines.push(`    MINVALUE ${seq.minValue}`);
            if (seq.maxValue) lines.push(`    MAXVALUE ${seq.maxValue}`);
            if (seq.cycle) lines.push(`    CYCLE`);
            lines.push(';');
        }
    } else {
        for (const seq of diff.sequencesRemoved) {
            lines.push(`DROP SEQUENCE IF EXISTS ${quoteIdent(seq.name)};`);
        }
    }

    // ── Enums ─────────────────────────────────────────────────────────────
    if (!isReverse) {
        for (const enumType of diff.enumsAdded) {
            const vals = enumType.values.map(quoteLit).join(', ');
            lines.push(`CREATE TYPE ${quoteIdent(enumType.name)} AS ENUM (${vals});`);
        }

        for (const enumChange of diff.enumsChanged) {
            const added = enumChange.after.filter(v => !enumChange.before.includes(v));
            const removed = enumChange.before.filter(v => !enumChange.after.includes(v));

            for (const val of added) {
                lines.push(`-- WARNING: ALTER TYPE for enum addition; Postgres requires a transaction for this`);
                lines.push(`ALTER TYPE ${quoteIdent(enumChange.name)} ADD VALUE ${quoteLit(val)};`);
            }

            if (removed.length > 0) {
                lines.push(`-- WARNING: Removing enum values is not directly supported in Postgres`);
                lines.push(`-- You may need to: CREATE TYPE new_type AS ENUM(...), ALTER TABLE ... ALTER COLUMN ... TYPE new_type, DROP TYPE old_type`);
                for (const val of removed) {
                    lines.push(`--   Removed value: ${val}`);
                }
            }
        }
    } else {
        for (const enumType of diff.enumsRemoved) {
            lines.push(`DROP TYPE IF EXISTS ${quoteIdent(enumType.name)} CASCADE;`);
        }
    }

    lines.push('');
    lines.push('COMMIT;');
    return lines.join('\n');
}

/**
 * Summarize a diff into a short text string.
 * PURE: deterministic summary.
 */
export function summarizeDiff(diff) {
    if (diff.totalChangeCount === 0) {
        return 'no changes';
    }

    const parts = [];

    if (diff.tablesAdded.length > 0) {
        parts.push(`${diff.tablesAdded.length} table${diff.tablesAdded.length === 1 ? '' : 's'} added`);
    }
    if (diff.tablesRemoved.length > 0) {
        parts.push(`${diff.tablesRemoved.length} table${diff.tablesRemoved.length === 1 ? '' : 's'} removed`);
    }
    if (diff.tablesChanged.length > 0) {
        const colChanges = diff.tablesChanged.reduce(
            (sum, t) => sum + t.columnsAdded.length + t.columnsRemoved.length + t.columnsChanged.length,
            0
        );
        parts.push(`${diff.tablesChanged.length} table${diff.tablesChanged.length === 1 ? '' : 's'} changed`);
        if (colChanges > 0) {
            parts.push(`(${colChanges} column${colChanges === 1 ? '' : 's'} modified)`);
        }
    }

    const indexChanges = diff.tablesChanged.reduce(
        (sum, t) => sum + t.indexesAdded.length + t.indexesRemoved.length,
        0
    );
    if (indexChanges > 0) {
        parts.push(`${indexChanges} index${indexChanges === 1 ? '' : 'es'} modified`);
    }

    if (diff.viewsAdded.length + diff.viewsRemoved.length + diff.viewsChanged.length > 0) {
        parts.push(`${diff.viewsAdded.length + diff.viewsRemoved.length + diff.viewsChanged.length} view${diff.viewsAdded.length + diff.viewsRemoved.length + diff.viewsChanged.length === 1 ? '' : 's'} changed`);
    }

    return parts.join(', ');
}

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE FUNCTIONS (accept a pg.PoolClient, caller manages lifecycle)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Capture a normalized snapshot of a schema.
 * Returns { schema, tables, views, sequences, enums }
 */
export async function snapshotSchema(client, { schema = 'public' } = {}) {
    const snapshot = {
        schema,
        tables: {},
        views: {},
        sequences: {},
        enums: {},
    };

    // ── Tables ────────────────────────────────────────────────────────────
    const { rows: tableRows } = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1 AND table_type = 'BASE TABLE'
        ORDER BY table_name
    `, [schema]);

    for (const { table_name } of tableRows) {
        const tableSnap = {
            columns: {},
            primaryKey: [],
            indexes: [],
            foreignKeys: [],
            checkConstraints: [],
        };

        // Columns
        const { rows: colRows } = await client.query(`
            SELECT
                column_name,
                data_type,
                is_nullable,
                column_default,
                ordinal_position,
                character_maximum_length,
                numeric_precision,
                numeric_scale
            FROM information_schema.columns
            WHERE table_schema = $1 AND table_name = $2
            ORDER BY ordinal_position
        `, [schema, table_name]);

        for (const col of colRows) {
            tableSnap.columns[col.column_name] = {
                dataType: col.data_type,
                isNullable: col.is_nullable === 'YES',
                columnDefault: col.column_default,
                ordinalPosition: col.ordinal_position,
                charMaxLength: col.character_maximum_length,
                numericPrecision: col.numeric_precision,
                numericScale: col.numeric_scale,
            };
        }

        // Primary key
        const { rows: pkRows } = await client.query(`
            SELECT a.attname
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            JOIN pg_class c ON c.oid = i.indrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = $1 AND c.relname = $2 AND i.indisprimary
            ORDER BY a.attnum
        `, [schema, table_name]);

        tableSnap.primaryKey = pkRows.map(r => r.attname);

        // Indexes
        const { rows: idxRows } = await client.query(`
            SELECT
                schemaname,
                tablename,
                indexname,
                indexdef
            FROM pg_indexes
            WHERE schemaname = $1 AND tablename = $2 AND indexname NOT LIKE '%_pkey'
            ORDER BY indexname
        `, [schema, table_name]);

        for (const idx of idxRows) {
            // Parse column names from indexdef
            const colMatch = idx.indexdef.match(/\(([^)]+)\)/);
            const columns = colMatch
                ? colMatch[1].split(',').map(c => c.trim().replace(/^"(.+)"$/, '$1'))
                : [];

            tableSnap.indexes.push({
                name: idx.indexname,
                columns,
                isUnique: idx.indexdef.includes('UNIQUE'),
                method: idx.indexdef.match(/USING (\w+)/)?.[1] || 'btree',
            });
        }

        // Foreign keys
        const { rows: fkRows } = await client.query(`
            SELECT
                constraint_name,
                column_name,
                referenced_table_name,
                referenced_column_name
            FROM information_schema.key_column_usage
            WHERE table_schema = $1
              AND table_name = $2
              AND referenced_table_name IS NOT NULL
            ORDER BY constraint_name, ordinal_position
        `, [schema, table_name]);

        const fkMap = new Map();
        for (const fk of fkRows) {
            if (!fkMap.has(fk.constraint_name)) {
                fkMap.set(fk.constraint_name, {
                    name: fk.constraint_name,
                    columns: [],
                    references: {
                        table: fk.referenced_table_name,
                        columns: [],
                    },
                    onUpdate: null,
                    onDelete: null,
                });
            }
            const entry = fkMap.get(fk.constraint_name);
            entry.columns.push(fk.column_name);
            entry.references.columns.push(fk.referenced_column_name);
        }

        tableSnap.foreignKeys = Array.from(fkMap.values());

        snapshot.tables[table_name] = tableSnap;
    }

    // ── Views ─────────────────────────────────────────────────────────────
    const { rows: viewRows } = await client.query(`
        SELECT
            table_name,
            view_definition
        FROM information_schema.views
        WHERE table_schema = $1
        ORDER BY table_name
    `, [schema]);

    for (const { table_name, view_definition } of viewRows) {
        snapshot.views[table_name] = {
            definition: view_definition,
        };
    }

    // ── Sequences ─────────────────────────────────────────────────────────
    const { rows: seqRows } = await client.query(`
        SELECT
            sequence_name,
            start_value,
            increment,
            minimum_value,
            maximum_value,
            cycle_option
        FROM information_schema.sequences
        WHERE sequence_schema = $1
        ORDER BY sequence_name
    `, [schema]);

    for (const seq of seqRows) {
        snapshot.sequences[seq.sequence_name] = {
            startValue: seq.start_value,
            increment: seq.increment,
            minValue: seq.minimum_value,
            maxValue: seq.maximum_value,
            cycle: seq.cycle_option === 'YES',
        };
    }

    // ── Enums (custom types) ──────────────────────────────────────────────
    const { rows: enumRows } = await client.query(`
        SELECT
            t.typname,
            e.enumlabel
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = $1
        ORDER BY t.typname, e.enumsortorder
    `, [schema]);

    const enumMap = new Map();
    for (const { typname, enumlabel } of enumRows) {
        if (!enumMap.has(typname)) {
            enumMap.set(typname, { values: [] });
        }
        enumMap.get(typname).values.push(enumlabel);
    }
    Object.entries(Object.fromEntries(enumMap)).forEach(([name, data]) => {
        snapshot.enums[name] = data;
    });

    return snapshot;
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATORS (manage pool lifecycle)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compare two Postgres connections (or two schemas in the same connection).
 * Acquires clients, snapshots both, diffs, and releases.
 * Returns { diff, summary, migrationSql }
 */
export async function compareConnections(
    getPool,
    { leftConnectionId, rightConnectionId, leftSchema = 'public', rightSchema = 'public' } = {}
) {
    const leftPool = getPool(leftConnectionId);
    const rightPool = getPool(rightConnectionId);

    if (!leftPool) throw new Error('Left connection not found');
    if (!rightPool) throw new Error('Right connection not found');

    const leftClient = await leftPool.connect();
    const rightClient = await rightPool.connect();

    try {
        const leftSnapshot = await snapshotSchema(leftClient, { schema: leftSchema });
        const rightSnapshot = await snapshotSchema(rightClient, { schema: rightSchema });

        const diff = diffSchemas(leftSnapshot, rightSnapshot);
        const summary = summarizeDiff(diff);
        const migrationSql = generateMigrationSql(diff);

        return { diff, summary, migrationSql };
    } finally {
        leftClient.release();
        rightClient.release();
    }
}
