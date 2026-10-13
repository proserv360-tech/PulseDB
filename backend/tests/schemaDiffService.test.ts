/**
 * tests/schemaDiffService.test.js
 * ───────────────────────────────
 * Unit tests for pure schema diff functions.
 * Uses node:test + node:assert/strict
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    diffSchemas,
    generateMigrationSql,
    summarizeDiff,
} from '../services/schemaDiffService.js';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function emptySchema() {
    return {
        schema: 'public',
        tables: {},
        views: {},
        sequences: {},
        enums: {},
    };
}

function withTable(schema, name, table) {
    return {
        ...schema,
        tables: { ...schema.tables, [name]: table },
    };
}

function withView(schema, name, definition) {
    return {
        ...schema,
        views: { ...schema.views, [name]: { definition } },
    };
}

function withEnum(schema, name, values) {
    return {
        ...schema,
        enums: { ...schema.enums, [name]: { values } },
    };
}

function simpleTable() {
    return {
        columns: {
            id: {
                dataType: 'integer',
                isNullable: false,
                columnDefault: "nextval('id_seq'::regclass)",
                ordinalPosition: 1,
                charMaxLength: null,
                numericPrecision: 32,
                numericScale: 0,
            },
            name: {
                dataType: 'character varying',
                isNullable: false,
                columnDefault: null,
                ordinalPosition: 2,
                charMaxLength: 255,
                numericPrecision: null,
                numericScale: null,
            },
        },
        primaryKey: ['id'],
        indexes: [],
        foreignKeys: [],
        checkConstraints: [],
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS: diffSchemas
// ─────────────────────────────────────────────────────────────────────────────

test('diffSchemas: empty schemas = no changes', () => {
    const left = emptySchema();
    const right = emptySchema();
    const diff = diffSchemas(left, right);
    assert.equal(diff.totalChangeCount, 0);
    assert.equal(diff.tablesAdded.length, 0);
    assert.equal(diff.tablesRemoved.length, 0);
    assert.equal(diff.tablesChanged.length, 0);
});

test('diffSchemas: table added', () => {
    const left = emptySchema();
    const right = withTable(emptySchema(), 'users', simpleTable());
    const diff = diffSchemas(left, right);
    assert.equal(diff.totalChangeCount, 1);
    assert.equal(diff.tablesAdded.length, 1);
    assert.equal(diff.tablesAdded[0].name, 'users');
    assert.equal(diff.tablesRemoved.length, 0);
});

test('diffSchemas: table removed', () => {
    const left = withTable(emptySchema(), 'users', simpleTable());
    const right = emptySchema();
    const diff = diffSchemas(left, right);
    assert.equal(diff.totalChangeCount, 1);
    assert.equal(diff.tablesRemoved.length, 1);
    assert.equal(diff.tablesRemoved[0].name, 'users');
    assert.equal(diff.tablesAdded.length, 0);
});

test('diffSchemas: column added to table', () => {
    const left = withTable(emptySchema(), 'users', simpleTable());
    const tbl = simpleTable();
    tbl.columns.email = {
        dataType: 'character varying',
        isNullable: true,
        columnDefault: null,
        ordinalPosition: 3,
        charMaxLength: 255,
        numericPrecision: null,
        numericScale: null,
    };
    const right = withTable(emptySchema(), 'users', tbl);

    const diff = diffSchemas(left, right);
    assert.equal(diff.tablesChanged.length, 1);
    assert.equal(diff.tablesChanged[0].columnsAdded.length, 1);
    assert.equal(diff.tablesChanged[0].columnsAdded[0].name, 'email');
});

test('diffSchemas: column removed from table', () => {
    const tbl = simpleTable();
    tbl.columns.email = {
        dataType: 'character varying',
        isNullable: true,
        columnDefault: null,
        ordinalPosition: 3,
        charMaxLength: 255,
        numericPrecision: null,
        numericScale: null,
    };
    const left = withTable(emptySchema(), 'users', tbl);
    const right = withTable(emptySchema(), 'users', simpleTable());

    const diff = diffSchemas(left, right);
    assert.equal(diff.tablesChanged.length, 1);
    assert.equal(diff.tablesChanged[0].columnsRemoved.length, 1);
    assert.equal(diff.tablesChanged[0].columnsRemoved[0].name, 'email');
});

test('diffSchemas: column type changed', () => {
    const left = withTable(emptySchema(), 'users', simpleTable());
    const tbl = simpleTable();
    tbl.columns.id.dataType = 'bigint';
    const right = withTable(emptySchema(), 'users', tbl);

    const diff = diffSchemas(left, right);
    assert.equal(diff.tablesChanged.length, 1);
    const colChange = diff.tablesChanged[0].columnsChanged.find(c => c.name === 'id');
    assert(colChange);
    assert.deepEqual(colChange.changes.dataType, ['integer', 'bigint']);
});

test('diffSchemas: column nullability changed', () => {
    const left = withTable(emptySchema(), 'users', simpleTable());
    const tbl = simpleTable();
    tbl.columns.name.isNullable = true;
    const right = withTable(emptySchema(), 'users', tbl);

    const diff = diffSchemas(left, right);
    const colChange = diff.tablesChanged[0].columnsChanged.find(c => c.name === 'name');
    assert(colChange);
    assert.deepEqual(colChange.changes.isNullable, [false, true]);
});

test('diffSchemas: column default changed', () => {
    const left = withTable(emptySchema(), 'users', simpleTable());
    const tbl = simpleTable();
    tbl.columns.name.columnDefault = "'Unknown'";
    const right = withTable(emptySchema(), 'users', tbl);

    const diff = diffSchemas(left, right);
    const colChange = diff.tablesChanged[0].columnsChanged.find(c => c.name === 'name');
    assert(colChange);
    assert.deepEqual(colChange.changes.columnDefault, [null, "'Unknown'"]);
});

test('diffSchemas: primary key added', () => {
    const left = withTable(emptySchema(), 'users', {
        ...simpleTable(),
        primaryKey: [],
    });
    const right = withTable(emptySchema(), 'users', simpleTable());

    const diff = diffSchemas(left, right);
    assert(diff.tablesChanged[0].primaryKeyChanged);
    assert.deepEqual(diff.tablesChanged[0].primaryKeyChanged.before, []);
    assert.deepEqual(diff.tablesChanged[0].primaryKeyChanged.after, ['id']);
});

test('diffSchemas: primary key changed', () => {
    const tbl1 = simpleTable();
    tbl1.primaryKey = ['id'];
    const left = withTable(emptySchema(), 'users', tbl1);

    const tbl2 = simpleTable();
    tbl2.primaryKey = ['id', 'name'];
    const right = withTable(emptySchema(), 'users', tbl2);

    const diff = diffSchemas(left, right);
    assert(diff.tablesChanged[0].primaryKeyChanged);
    assert.deepEqual(diff.tablesChanged[0].primaryKeyChanged.before, ['id']);
    assert.deepEqual(diff.tablesChanged[0].primaryKeyChanged.after, ['id', 'name']);
});

test('diffSchemas: index added', () => {
    const left = withTable(emptySchema(), 'users', {
        ...simpleTable(),
        indexes: [],
    });
    const tbl = simpleTable();
    tbl.indexes = [
        {
            name: 'idx_users_name',
            columns: ['name'],
            isUnique: false,
            method: 'btree',
        },
    ];
    const right = withTable(emptySchema(), 'users', tbl);

    const diff = diffSchemas(left, right);
    assert.equal(diff.tablesChanged[0].indexesAdded.length, 1);
    assert.equal(diff.tablesChanged[0].indexesAdded[0].name, 'idx_users_name');
});

test('diffSchemas: index removed', () => {
    const tbl = simpleTable();
    tbl.indexes = [
        {
            name: 'idx_users_name',
            columns: ['name'],
            isUnique: false,
            method: 'btree',
        },
    ];
    const left = withTable(emptySchema(), 'users', tbl);
    const right = withTable(emptySchema(), 'users', {
        ...simpleTable(),
        indexes: [],
    });

    const diff = diffSchemas(left, right);
    assert.equal(diff.tablesChanged[0].indexesRemoved.length, 1);
    assert.equal(diff.tablesChanged[0].indexesRemoved[0].name, 'idx_users_name');
});

test('diffSchemas: index columns changed', () => {
    const tbl1 = simpleTable();
    tbl1.indexes = [
        {
            name: 'idx_users_id',
            columns: ['id'],
            isUnique: false,
            method: 'btree',
        },
    ];
    const left = withTable(emptySchema(), 'users', tbl1);

    const tbl2 = simpleTable();
    tbl2.indexes = [
        {
            name: 'idx_users_id',
            columns: ['id', 'name'],
            isUnique: false,
            method: 'btree',
        },
    ];
    const right = withTable(emptySchema(), 'users', tbl2);

    const diff = diffSchemas(left, right);
    assert.equal(diff.tablesChanged[0].indexesChanged.length, 1);
    assert.equal(diff.tablesChanged[0].indexesChanged[0].name, 'idx_users_id');
});

test('diffSchemas: foreign key added', () => {
    const left = withTable(emptySchema(), 'users', {
        ...simpleTable(),
        foreignKeys: [],
    });
    const tbl = simpleTable();
    tbl.foreignKeys = [
        {
            name: 'fk_users_org_id',
            columns: ['org_id'],
            references: {
                table: 'organizations',
                columns: ['id'],
            },
            onUpdate: null,
            onDelete: null,
        },
    ];
    const right = withTable(emptySchema(), 'users', tbl);

    const diff = diffSchemas(left, right);
    assert.equal(diff.tablesChanged[0].foreignKeysAdded.length, 1);
    assert.equal(diff.tablesChanged[0].foreignKeysAdded[0].name, 'fk_users_org_id');
});

test('diffSchemas: foreign key removed', () => {
    const tbl = simpleTable();
    tbl.foreignKeys = [
        {
            name: 'fk_users_org_id',
            columns: ['org_id'],
            references: {
                table: 'organizations',
                columns: ['id'],
            },
            onUpdate: null,
            onDelete: null,
        },
    ];
    const left = withTable(emptySchema(), 'users', tbl);
    const right = withTable(emptySchema(), 'users', {
        ...simpleTable(),
        foreignKeys: [],
    });

    const diff = diffSchemas(left, right);
    assert.equal(diff.tablesChanged[0].foreignKeysRemoved.length, 1);
    assert.equal(diff.tablesChanged[0].foreignKeysRemoved[0].name, 'fk_users_org_id');
});

test('diffSchemas: view added', () => {
    const left = emptySchema();
    const right = withView(emptySchema(), 'user_summary', 'SELECT id, name FROM users');

    const diff = diffSchemas(left, right);
    assert.equal(diff.viewsAdded.length, 1);
    assert.equal(diff.viewsAdded[0].name, 'user_summary');
    assert.equal(diff.totalChangeCount, 1);
});

test('diffSchemas: view removed', () => {
    const left = withView(emptySchema(), 'user_summary', 'SELECT id, name FROM users');
    const right = emptySchema();

    const diff = diffSchemas(left, right);
    assert.equal(diff.viewsRemoved.length, 1);
    assert.equal(diff.viewsRemoved[0].name, 'user_summary');
    assert.equal(diff.totalChangeCount, 1);
});

test('diffSchemas: view definition changed', () => {
    const left = withView(emptySchema(), 'user_summary', 'SELECT id, name FROM users');
    const right = withView(emptySchema(), 'user_summary', 'SELECT id, name, email FROM users');

    const diff = diffSchemas(left, right);
    assert.equal(diff.viewsChanged.length, 1);
    assert.equal(diff.viewsChanged[0].before, 'SELECT id, name FROM users');
    assert.equal(diff.viewsChanged[0].after, 'SELECT id, name, email FROM users');
    assert.equal(diff.totalChangeCount, 1);
});

test('diffSchemas: enum added', () => {
    const left = emptySchema();
    const right = withEnum(emptySchema(), 'status', ['active', 'inactive']);

    const diff = diffSchemas(left, right);
    assert.equal(diff.enumsAdded.length, 1);
    assert.equal(diff.enumsAdded[0].name, 'status');
    assert.deepEqual(diff.enumsAdded[0].values, ['active', 'inactive']);
    assert.equal(diff.totalChangeCount, 1);
});

test('diffSchemas: enum removed', () => {
    const left = withEnum(emptySchema(), 'status', ['active', 'inactive']);
    const right = emptySchema();

    const diff = diffSchemas(left, right);
    assert.equal(diff.enumsRemoved.length, 1);
    assert.equal(diff.enumsRemoved[0].name, 'status');
    assert.equal(diff.totalChangeCount, 1);
});

test('diffSchemas: enum values changed', () => {
    const left = withEnum(emptySchema(), 'status', ['active', 'inactive']);
    const right = withEnum(emptySchema(), 'status', ['active', 'inactive', 'pending']);

    const diff = diffSchemas(left, right);
    assert.equal(diff.enumsChanged.length, 1);
    assert.equal(diff.enumsChanged[0].name, 'status');
    assert.deepEqual(diff.enumsChanged[0].before, ['active', 'inactive']);
    assert.deepEqual(diff.enumsChanged[0].after, ['active', 'inactive', 'pending']);
    assert.equal(diff.totalChangeCount, 1);
});

test('diffSchemas: deterministic ordering (keys sorted)', () => {
    // Create two identical schemas with tables in different orders
    const schema1 = emptySchema();
    schema1.tables.zebra = simpleTable();
    schema1.tables.apple = simpleTable();

    const schema2 = emptySchema();
    schema2.tables.apple = simpleTable();
    schema2.tables.zebra = simpleTable();

    const diff1 = diffSchemas(schema1, schema2);
    const diff2 = diffSchemas(schema2, schema1);

    // Both should show no changes
    assert.equal(diff1.totalChangeCount, 0);
    assert.equal(diff2.totalChangeCount, 0);

    // Stringify and compare for determinism
    const str1 = JSON.stringify(diff1);
    const str2 = JSON.stringify(diff2);
    assert.equal(str1, str2);
});

// ─────────────────────────────────────────────────────────────────────────────
// TESTS: generateMigrationSql
// ─────────────────────────────────────────────────────────────────────────────

test('generateMigrationSql: empty diff', () => {
    const left = emptySchema();
    const right = emptySchema();
    const diff = diffSchemas(left, right);
    const sql = generateMigrationSql(diff);

    assert(sql.includes('No schema changes detected'));
});

test('generateMigrationSql: CREATE TABLE', () => {
    const left = emptySchema();
    const right = withTable(emptySchema(), 'users', simpleTable());
    const diff = diffSchemas(left, right);
    const sql = generateMigrationSql(diff);

    assert(sql.includes('CREATE TABLE'));
    assert(sql.includes('"users"'));
    assert(sql.includes('PRIMARY KEY'));
    assert(sql.includes('NOT NULL'));
    assert(sql.includes('BEGIN;'));
    assert(sql.includes('COMMIT;'));
});

test('generateMigrationSql: DROP TABLE', () => {
    const left = withTable(emptySchema(), 'users', simpleTable());
    const right = emptySchema();
    const diff = diffSchemas(left, right);
    const sql = generateMigrationSql(diff, { direction: 'left-to-right' });

    // left-to-right means we don't emit drop; right-to-left does
    assert(!sql.includes('DROP TABLE'));
});

test('generateMigrationSql: DROP TABLE (reverse direction)', () => {
    const left = withTable(emptySchema(), 'users', simpleTable());
    const right = emptySchema();
    const diff = diffSchemas(left, right);
    const sql = generateMigrationSql(diff, { direction: 'right-to-left' });

    assert(sql.includes('DROP TABLE'));
    assert(sql.includes('users'));
});

test('generateMigrationSql: ADD COLUMN', () => {
    const left = withTable(emptySchema(), 'users', simpleTable());
    const tbl = simpleTable();
    tbl.columns.email = {
        dataType: 'character varying',
        isNullable: true,
        columnDefault: null,
        ordinalPosition: 3,
        charMaxLength: 255,
        numericPrecision: null,
        numericScale: null,
    };
    const right = withTable(emptySchema(), 'users', tbl);

    const diff = diffSchemas(left, right);
    const sql = generateMigrationSql(diff);

    assert(sql.includes('ADD COLUMN'));
    assert(sql.includes('email'));
    assert(sql.includes('character varying'));
});

test('generateMigrationSql: DROP COLUMN', () => {
    const tbl = simpleTable();
    tbl.columns.email = {
        dataType: 'character varying',
        isNullable: true,
        columnDefault: null,
        ordinalPosition: 3,
        charMaxLength: 255,
        numericPrecision: null,
        numericScale: null,
    };
    const left = withTable(emptySchema(), 'users', tbl);
    const right = withTable(emptySchema(), 'users', simpleTable());

    const diff = diffSchemas(left, right);
    const sql = generateMigrationSql(diff);

    assert(sql.includes('DROP COLUMN'));
    assert(sql.includes('email'));
});

test('generateMigrationSql: ALTER COLUMN TYPE with USING stub', () => {
    const left = withTable(emptySchema(), 'users', simpleTable());
    const tbl = simpleTable();
    tbl.columns.id.dataType = 'bigint';
    const right = withTable(emptySchema(), 'users', tbl);

    const diff = diffSchemas(left, right);
    const sql = generateMigrationSql(diff);

    assert(sql.includes('-- WARNING'));
    assert(sql.includes('Type change from integer to bigint'));
    assert(sql.includes('USING'));
});

test('generateMigrationSql: SET NOT NULL', () => {
    const left = withTable(emptySchema(), 'users', simpleTable());
    const tbl = simpleTable();
    tbl.columns.name.isNullable = true;
    const right = withTable(emptySchema(), 'users', tbl);

    const diff = diffSchemas(left, right);
    const sql = generateMigrationSql(diff);

    // This is a reverse comparison; left says NOT NULL, right says nullable
    // So the diff should reflect that. Let's check for DROP NOT NULL.
    assert(sql.includes('DROP NOT NULL'));
});

test('generateMigrationSql: CREATE INDEX CONCURRENTLY', () => {
    const left = withTable(emptySchema(), 'users', {
        ...simpleTable(),
        indexes: [],
    });
    const tbl = simpleTable();
    tbl.indexes = [
        {
            name: 'idx_users_name',
            columns: ['name'],
            isUnique: false,
            method: 'btree',
        },
    ];
    const right = withTable(emptySchema(), 'users', tbl);

    const diff = diffSchemas(left, right);
    const sql = generateMigrationSql(diff);

    assert(sql.includes('CREATE INDEX CONCURRENTLY'));
    assert(sql.includes('idx_users_name'));
});

test('generateMigrationSql: DROP INDEX CONCURRENTLY', () => {
    const tbl = simpleTable();
    tbl.indexes = [
        {
            name: 'idx_users_name',
            columns: ['name'],
            isUnique: false,
            method: 'btree',
        },
    ];
    const left = withTable(emptySchema(), 'users', tbl);
    const right = withTable(emptySchema(), 'users', {
        ...simpleTable(),
        indexes: [],
    });

    const diff = diffSchemas(left, right);
    const sql = generateMigrationSql(diff);

    assert(sql.includes('DROP INDEX CONCURRENTLY'));
    assert(sql.includes('idx_users_name'));
});

test('generateMigrationSql: ADD FOREIGN KEY', () => {
    const left = withTable(emptySchema(), 'users', {
        ...simpleTable(),
        foreignKeys: [],
    });
    const tbl = simpleTable();
    tbl.foreignKeys = [
        {
            name: 'fk_users_org_id',
            columns: ['org_id'],
            references: {
                table: 'organizations',
                columns: ['id'],
            },
            onUpdate: null,
            onDelete: null,
        },
    ];
    const right = withTable(emptySchema(), 'users', tbl);

    const diff = diffSchemas(left, right);
    const sql = generateMigrationSql(diff);

    assert(sql.includes('ADD CONSTRAINT'));
    assert(sql.includes('FOREIGN KEY'));
    assert(sql.includes('fk_users_org_id'));
});

test('generateMigrationSql: DROP FOREIGN KEY', () => {
    const tbl = simpleTable();
    tbl.foreignKeys = [
        {
            name: 'fk_users_org_id',
            columns: ['org_id'],
            references: {
                table: 'organizations',
                columns: ['id'],
            },
            onUpdate: null,
            onDelete: null,
        },
    ];
    const left = withTable(emptySchema(), 'users', tbl);
    const right = withTable(emptySchema(), 'users', {
        ...simpleTable(),
        foreignKeys: [],
    });

    const diff = diffSchemas(left, right);
    const sql = generateMigrationSql(diff);

    assert(sql.includes('DROP CONSTRAINT'));
    assert(sql.includes('fk_users_org_id'));
});

test('generateMigrationSql: CREATE VIEW', () => {
    const left = emptySchema();
    const right = withView(emptySchema(), 'user_summary', 'SELECT id, name FROM users');

    const diff = diffSchemas(left, right);
    const sql = generateMigrationSql(diff);

    assert(sql.includes('CREATE VIEW'));
    assert(sql.includes('user_summary'));
    assert(sql.includes('SELECT'));
});

test('generateMigrationSql: CREATE SEQUENCE', () => {
    const left = emptySchema();
    const right = { ...emptySchema(), sequences: { id_seq: { startValue: 1, increment: 1, minValue: null, maxValue: null, cycle: false } } };

    const diff = diffSchemas(left, right);
    const sql = generateMigrationSql(diff);

    assert(sql.includes('CREATE SEQUENCE'));
    assert(sql.includes('id_seq'));
});

test('generateMigrationSql: CREATE TYPE (enum)', () => {
    const left = emptySchema();
    const right = withEnum(emptySchema(), 'status', ['active', 'inactive']);

    const diff = diffSchemas(left, right);
    const sql = generateMigrationSql(diff);

    assert(sql.includes('CREATE TYPE'));
    assert(sql.includes('status'));
    assert(sql.includes('ENUM'));
    assert(sql.includes('active'));
    assert(sql.includes('inactive'));
});

test('generateMigrationSql: ALTER TYPE ADD VALUE', () => {
    const left = withEnum(emptySchema(), 'status', ['active', 'inactive']);
    const right = withEnum(emptySchema(), 'status', ['active', 'inactive', 'pending']);

    const diff = diffSchemas(left, right);
    const sql = generateMigrationSql(diff);

    assert(sql.includes('ALTER TYPE'));
    assert(sql.includes('ADD VALUE'));
});

test('generateMigrationSql: wraps in BEGIN/COMMIT exactly once', () => {
    const left = emptySchema();
    const right = withTable(emptySchema(), 'users', simpleTable());

    const diff = diffSchemas(left, right);
    const sql = generateMigrationSql(diff);

    const beginCount = (sql.match(/BEGIN;/g) || []).length;
    const commitCount = (sql.match(/COMMIT;/g) || []).length;

    assert.equal(beginCount, 1);
    assert.equal(commitCount, 1);
    // BEGIN should come before COMMIT
    assert(sql.indexOf('BEGIN;') < sql.indexOf('COMMIT;'));
});

// ─────────────────────────────────────────────────────────────────────────────
// TESTS: summarizeDiff
// ─────────────────────────────────────────────────────────────────────────────

test('summarizeDiff: no changes', () => {
    const left = emptySchema();
    const right = emptySchema();
    const diff = diffSchemas(left, right);
    const summary = summarizeDiff(diff);

    assert.equal(summary, 'no changes');
});

test('summarizeDiff: tables added', () => {
    const left = emptySchema();
    const right = withTable(emptySchema(), 'users', simpleTable());
    const diff = diffSchemas(left, right);
    const summary = summarizeDiff(diff);

    assert(summary.includes('1 table added'));
});

test('summarizeDiff: multiple tables added', () => {
    const left = emptySchema();
    const right = emptySchema();
    right.tables.users = simpleTable();
    right.tables.posts = simpleTable();
    const diff = diffSchemas(left, right);
    const summary = summarizeDiff(diff);

    assert(summary.includes('2 tables added'));
});

test('summarizeDiff: column modifications', () => {
    const left = withTable(emptySchema(), 'users', simpleTable());
    const tbl = simpleTable();
    tbl.columns.email = {
        dataType: 'character varying',
        isNullable: true,
        columnDefault: null,
        ordinalPosition: 3,
        charMaxLength: 255,
        numericPrecision: null,
        numericScale: null,
    };
    const right = withTable(emptySchema(), 'users', tbl);

    const diff = diffSchemas(left, right);
    const summary = summarizeDiff(diff);

    assert(summary.includes('1 table changed'));
    assert(summary.includes('column'));
});

test('summarizeDiff: combined changes', () => {
    const left = withTable(emptySchema(), 'users', {
        ...simpleTable(),
        indexes: [
            {
                name: 'idx_users_name',
                columns: ['name'],
                isUnique: false,
                method: 'btree',
            },
        ],
    });
    const tbl = simpleTable();
    tbl.columns.email = {
        dataType: 'character varying',
        isNullable: true,
        columnDefault: null,
        ordinalPosition: 3,
        charMaxLength: 255,
        numericPrecision: null,
        numericScale: null,
    };
    tbl.indexes = [];
    const right = withTable(emptySchema(), 'users', tbl);

    const diff = diffSchemas(left, right);
    const summary = summarizeDiff(diff);

    assert(summary.includes('1 table changed'));
    assert(summary.includes('column'));
    assert(summary.includes('index'));
});
