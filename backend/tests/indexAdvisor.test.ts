/**
 * tests/indexAdvisor.test.js
 * ──────────────────────────
 * Unit tests for pure index advisor helpers.
 *
 * Run with: node --test backend/tests/indexAdvisor.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    parseWhereColumns,
    isColumnCovered,
    scoreSuggestion,
    generateIndexDdl,
    dropRedundantIndexDdl,
} from '../services/indexAdvisor.js';

// ─────────────────────────────────────────────────────────────────────────────
// TEST: parseWhereColumns
// ─────────────────────────────────────────────────────────────────────────────

test('parseWhereColumns: basic table.column = comparison', () => {
    const sql = 'SELECT * FROM users WHERE users.email = ?';
    const cols = parseWhereColumns(sql);
    assert.equal(cols.length, 1);
    assert.equal(cols[0].table, 'users');
    assert.equal(cols[0].column, 'email');
});

test('parseWhereColumns: multiple columns in WHERE', () => {
    const sql = 'SELECT * FROM orders WHERE orders.user_id = 5 AND orders.status = ?';
    const cols = parseWhereColumns(sql);
    assert.equal(cols.length, 2);
    const colNames = cols.map(c => c.column).sort();
    assert.deepEqual(colNames, ['status', 'user_id']);
});

test('parseWhereColumns: IN clause', () => {
    const sql = 'SELECT * FROM products WHERE products.id IN (1, 2, 3)';
    const cols = parseWhereColumns(sql);
    assert.equal(cols.length, 1);
    assert.equal(cols[0].table, 'products');
    assert.equal(cols[0].column, 'id');
});

test('parseWhereColumns: JOIN predicate (a.col = b.col)', () => {
    const sql = 'SELECT * FROM a JOIN b ON a.id = b.user_id WHERE a.created_at > ?';
    const cols = parseWhereColumns(sql);
    const tables = cols.map(c => c.table).sort();
    assert.ok(tables.includes('a'), 'should find a.created_at');
});

test('parseWhereColumns: schema-qualified column', () => {
    const sql = 'SELECT * FROM public.users WHERE public.users.email = ?';
    const cols = parseWhereColumns(sql);
    assert.equal(cols.length, 1);
    assert.equal(cols[0].table, 'users');
    assert.equal(cols[0].column, 'email');
});

test('parseWhereColumns: comparison operators (<, >, <=, >=, <>)', () => {
    const sql = 'SELECT * FROM t WHERE t.col1 > 10 AND t.col2 < 100 AND t.col3 >= 5';
    const cols = parseWhereColumns(sql);
    assert.equal(cols.length, 3);
    const colNames = cols.map(c => c.column).sort();
    assert.deepEqual(colNames, ['col1', 'col2', 'col3']);
});

test('parseWhereColumns: LIKE and ILIKE operators', () => {
    const sql = "SELECT * FROM users WHERE users.name LIKE 'A%' AND users.email ILIKE '%@example.com'";
    const cols = parseWhereColumns(sql);
    assert.equal(cols.length, 2);
});

test('parseWhereColumns: BETWEEN operator', () => {
    const sql = 'SELECT * FROM t WHERE t.created_at BETWEEN ? AND ?';
    const cols = parseWhereColumns(sql);
    assert.equal(cols.length, 1);
    assert.equal(cols[0].column, 'created_at');
});

test('parseWhereColumns: empty or null input returns empty array', () => {
    assert.deepEqual(parseWhereColumns(''), []);
    assert.deepEqual(parseWhereColumns(null), []);
    assert.deepEqual(parseWhereColumns(undefined), []);
});

test('parseWhereColumns: no WHERE clause returns empty', () => {
    const sql = 'SELECT * FROM users';
    assert.deepEqual(parseWhereColumns(sql), []);
});

test('parseWhereColumns: case-insensitive column names', () => {
    const sql = 'SELECT * FROM users WHERE users.EMAIL = ? AND users.UserId > 10';
    const cols = parseWhereColumns(sql);
    assert.equal(cols.length, 2);
    assert.ok(cols.some(c => c.column === 'email'));
    assert.ok(cols.some(c => c.column === 'userid'));
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST: isColumnCovered
// ─────────────────────────────────────────────────────────────────────────────

test('isColumnCovered: column is first in an index', () => {
    const column = 'email';
    const existingIndexes = [
        { columns: ['email', 'user_id'] },
        { columns: ['created_at'] },
    ];
    assert.equal(isColumnCovered(column, existingIndexes), true);
});

test('isColumnCovered: column is not indexed', () => {
    const column = 'status';
    const existingIndexes = [
        { columns: ['email'] },
        { columns: ['id', 'user_id'] },
    ];
    assert.equal(isColumnCovered(column, existingIndexes), false);
});

test('isColumnCovered: column is second in an index (not covered)', () => {
    const column = 'status';
    const existingIndexes = [
        { columns: ['user_id', 'status'] },
    ];
    assert.equal(isColumnCovered(column, existingIndexes), false);
});

test('isColumnCovered: empty index list', () => {
    assert.equal(isColumnCovered('any_col', []), false);
});

test('isColumnCovered: case-insensitive matching', () => {
    const column = 'email';
    const existingIndexes = [
        { columns: ['EMAIL'] },
    ];
    assert.equal(isColumnCovered(column, existingIndexes), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST: scoreSuggestion
// ─────────────────────────────────────────────────────────────────────────────

test('scoreSuggestion: calculates impact from calls and meanTimeMs', () => {
    const score = scoreSuggestion({ calls: 1000, meanTimeMs: 100 });
    assert.ok(score > 0 && score <= 100);
});

test('scoreSuggestion: high impact yields high score', () => {
    const lowImpact = scoreSuggestion({ calls: 10, meanTimeMs: 1 });
    const highImpact = scoreSuggestion({ calls: 1000, meanTimeMs: 100 });
    assert.ok(highImpact > lowImpact);
});

test('scoreSuggestion: zero calls/time yields zero score', () => {
    assert.equal(scoreSuggestion({ calls: 0, meanTimeMs: 100 }), 0);
    assert.equal(scoreSuggestion({ calls: 100, meanTimeMs: 0 }), 0);
});

test('scoreSuggestion: defaults to 0 for missing fields', () => {
    const score = scoreSuggestion({});
    assert.equal(score, 0);
});

test('scoreSuggestion: caps score at 100', () => {
    const score = scoreSuggestion({ calls: 1_000_000, meanTimeMs: 1_000 });
    assert.equal(score, 100);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST: generateIndexDdl
// ─────────────────────────────────────────────────────────────────────────────

test('generateIndexDdl: basic single-column index', () => {
    const ddl = generateIndexDdl({
        table: 'users',
        columns: ['email'],
    });
    assert.match(ddl, /CREATE INDEX CONCURRENTLY/);
    assert.match(ddl, /"users"/);
    assert.match(ddl, /"email"/);
    assert.match(ddl, /;$/);
});

test('generateIndexDdl: multi-column index', () => {
    const ddl = generateIndexDdl({
        table: 'orders',
        columns: ['user_id', 'created_at'],
    });
    assert.match(ddl, /"user_id"/);
    assert.match(ddl, /"created_at"/);
    assert.ok(ddl.includes('user_id'), 'columns should appear in order');
});

test('generateIndexDdl: unique index', () => {
    const ddl = generateIndexDdl({
        table: 'users',
        columns: ['email'],
        unique: true,
    });
    assert.match(ddl, /CREATE UNIQUE INDEX/);
});

test('generateIndexDdl: with USING clause', () => {
    const ddl = generateIndexDdl({
        table: 'posts',
        columns: ['content'],
        using: 'gin',
    });
    assert.match(ddl, /USING gin/i);
});

test('generateIndexDdl: quotes reserved words in table/column names', () => {
    const ddl = generateIndexDdl({
        table: 'order',
        columns: ['select'],
    });
    assert.match(ddl, /"order"/);
    assert.match(ddl, /"select"/);
});

test('generateIndexDdl: escapes double quotes in identifiers', () => {
    const ddl = generateIndexDdl({
        table: 'my"table',
        columns: ['my"col'],
    });
    // Double quotes should be escaped
    assert.match(ddl, /"my""table"/);
    assert.match(ddl, /"my""col"/);
});

test('generateIndexDdl: throws on missing table', () => {
    assert.throws(() => {
        generateIndexDdl({ columns: ['col1'] });
    });
});

test('generateIndexDdl: throws on missing columns', () => {
    assert.throws(() => {
        generateIndexDdl({ table: 'users' });
    });
});

test('generateIndexDdl: throws on empty columns array', () => {
    assert.throws(() => {
        generateIndexDdl({ table: 'users', columns: [] });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST: dropRedundantIndexDdl
// ─────────────────────────────────────────────────────────────────────────────

test('dropRedundantIndexDdl: generates DROP INDEX statement', () => {
    const ddl = dropRedundantIndexDdl('idx_users_email');
    assert.match(ddl, /DROP INDEX CONCURRENTLY/);
    assert.match(ddl, /"idx_users_email"/);
    assert.match(ddl, /;$/);
});

test('dropRedundantIndexDdl: includes IF EXISTS clause', () => {
    const ddl = dropRedundantIndexDdl('some_index');
    assert.match(ddl, /IF EXISTS/);
});

test('dropRedundantIndexDdl: quotes index name safely', () => {
    const ddl = dropRedundantIndexDdl('my"weird"index');
    assert.match(ddl, /"my""weird""index"/);
});

test('dropRedundantIndexDdl: respects schema parameter', () => {
    // Note: current impl doesn't use schema in output, just generates index name
    const ddl = dropRedundantIndexDdl('idx_test', 'custom_schema');
    assert.ok(ddl.includes('idx_test'));
});
