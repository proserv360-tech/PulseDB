/**
 * tests/sqlIdent.test.ts — shared SQL identifier/literal quoting (audit 2026-07-24).
 * Consolidated from the two former copies in indexAdvisor.ts / schemaDiffService.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteIdent, quoteLit } from '../services/sqlIdent.js';

test('quoteIdent wraps a plain identifier in double quotes', () => {
    assert.equal(quoteIdent('users'), '"users"');
});

test('quoteIdent doubles embedded double quotes to neutralise injection', () => {
    assert.equal(quoteIdent('a"b'), '"a""b"');
    // The classic break-out attempt stays inside one quoted identifier.
    assert.equal(quoteIdent('x"; DROP TABLE users; --'), '"x""; DROP TABLE users; --"');
});

test('quoteIdent returns an empty quoted identifier for null/undefined/empty', () => {
    assert.equal(quoteIdent(''), '""');
    assert.equal(quoteIdent(null), '""');
    assert.equal(quoteIdent(undefined), '""');
});

test('quoteLit wraps a string literal in single quotes', () => {
    assert.equal(quoteLit('hello'), "'hello'");
});

test('quoteLit doubles embedded single quotes', () => {
    assert.equal(quoteLit("O'Brien"), "'O''Brien'");
    assert.equal(quoteLit("'; DROP TABLE users; --"), "'''; DROP TABLE users; --'");
});

test('quoteLit emits SQL NULL for null/undefined', () => {
    assert.equal(quoteLit(null), 'NULL');
    assert.equal(quoteLit(undefined), 'NULL');
});

test('quoteLit stringifies non-string values before quoting', () => {
    assert.equal(quoteLit(42), "'42'");
});
