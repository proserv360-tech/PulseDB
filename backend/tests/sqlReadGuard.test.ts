/**
 * tests/sqlReadGuard.test.ts — read-only SQL guard (audit LOW-1).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isReadOnlySelect, stripSqlLiterals } from '../services/sqlReadGuard.js';

test('allows plain selects and CTEs', () => {
    assert.ok(isReadOnlySelect('SELECT * FROM t'));
    assert.ok(isReadOnlySelect('WITH x AS (SELECT 1) SELECT * FROM x'));
    assert.ok(isReadOnlySelect('  select a, b from t where c = 1  '));
});

test('LOW-1: keyword inside a string literal is NOT a false positive', () => {
    assert.ok(isReadOnlySelect("SELECT * FROM t WHERE name = 'delete me'"));
    assert.ok(isReadOnlySelect("SELECT 'drop table x' AS note"));
});

test('blocks real writes', () => {
    for (const q of [
        'DELETE FROM t',
        'UPDATE t SET a = 1',
        'INSERT INTO t VALUES (1)',
        'DROP TABLE t',
        'TRUNCATE t',
        'WITH x AS (DELETE FROM t RETURNING *) SELECT * FROM x',
        'WITH x AS (INSERT INTO t VALUES (1) RETURNING 1) SELECT * FROM x',
    ]) {
        assert.equal(isReadOnlySelect(q), false, `should block: ${q}`);
    }
});

test('blocks stacked statements', () => {
    assert.equal(isReadOnlySelect('SELECT 1; DROP TABLE t'), false);
    assert.equal(isReadOnlySelect("SELECT 1 WHERE x = ';' ; DELETE FROM t"), false);
});

test('blocks write hidden behind a comment', () => {
    assert.equal(isReadOnlySelect('/* SELECT */ DELETE FROM t'), false);
});

test('allows a trailing semicolon on a single statement', () => {
    assert.ok(isReadOnlySelect('SELECT 1;'));
});

test('stripSqlLiterals removes strings and comments', () => {
    assert.equal(stripSqlLiterals("SELECT 'x' -- drop\n FROM t").includes('drop'), false);
});

test('rejects non-strings', () => {
    assert.equal(isReadOnlySelect(null as any), false);
    assert.equal(isReadOnlySelect(42 as any), false);
});
