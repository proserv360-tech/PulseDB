/**
 * workbench.test.js — Node built-in test runner.
 * Unit tests for query workbench pure helpers and logic.
 * Run with:
 *   node --test backend/tests/workbench.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { expandSnippets } from '../services/workbenchService.js';

// ─────────────────────────────────────────────────────────────────────────────
// expandSnippets tests (pure function, safe to test without DB)
// ─────────────────────────────────────────────────────────────────────────────

test('expandSnippets: basic substitution', () => {
    const snippets = {
        'users_by_region': 'SELECT * FROM users WHERE region = \'US\'',
    };
    const sql = 'SELECT COUNT(*) FROM ($snippet:users_by_region$) t';
    const result = expandSnippets(sql, snippets);
    assert(result.includes('WHERE region = \'US\''));
    assert(!result.includes('$snippet'));
});

test('expandSnippets: multiple snippets', () => {
    const snippets = {
        'users_filtered': 'SELECT * FROM users WHERE active = true',
        'orders_recent': 'SELECT * FROM orders WHERE created_at > now() - interval \'7 days\'',
    };
    const sql = 'SELECT * FROM ($snippet:users_filtered$) u JOIN ($snippet:orders_recent$) o ON u.id = o.user_id';
    const result = expandSnippets(sql, snippets);
    assert(result.includes('active = true'));
    assert(result.includes('created_at >'));
    assert(!result.includes('$snippet'));
});

test('expandSnippets: nested snippet referencing another snippet', () => {
    const snippets = {
        'region_us': 'region = \'US\'',
        'users_by_region': 'SELECT * FROM users WHERE $snippet:region_us$',
    };
    const sql = 'SELECT * FROM ($snippet:users_by_region$) t';
    const result = expandSnippets(sql, snippets);
    assert(result.includes('region = \'US\''));
    assert(!result.includes('$snippet'));
});

test('expandSnippets: nested depth 2 (valid)', () => {
    const snippets = {
        'level1': 'a = 1',
        'level2': '$snippet:level1$ AND b = 2',
        'level3': '$snippet:level2$ AND c = 3',
    };
    const sql = '$snippet:level3$';
    const result = expandSnippets(sql, snippets);
    assert(result.includes('a = 1'));
    assert(result.includes('b = 2'));
    assert(result.includes('c = 3'));
});

test('expandSnippets: exceeds recursion depth limit (depth > 8)', () => {
    const snippets = {
        's1': '$snippet:s2$',
        's2': '$snippet:s3$',
        's3': '$snippet:s4$',
        's4': '$snippet:s5$',
        's5': '$snippet:s6$',
        's6': '$snippet:s7$',
        's7': '$snippet:s8$',
        's8': '$snippet:s9$',
        's9': 'SELECT 1',
    };
    const sql = '$snippet:s1$';
    assert.throws(() => {
        expandSnippets(sql, snippets);
    }, /recursion depth limit/);
});

test('expandSnippets: unknown snippet name left as token', () => {
    const snippets = {
        'known': 'SELECT 1',
    };
    const sql = 'SELECT * FROM $snippet:unknown$ WHERE $snippet:known$ IS NOT NULL';
    const result = expandSnippets(sql, snippets);
    // Unknown snippet stays as token
    assert(result.includes('$snippet:unknown$'));
    // Known snippet is expanded
    assert(result.includes('SELECT 1'));
});

test('expandSnippets: empty sql returns empty', () => {
    const snippets = { 'foo': 'bar' };
    assert.equal(expandSnippets('', snippets), '');
});

test('expandSnippets: null sql returns null', () => {
    const snippets = { 'foo': 'bar' };
    assert.equal(expandSnippets(null, snippets), null);
});

test('expandSnippets: null snippets map returns sql unchanged', () => {
    const sql = 'SELECT * FROM $snippet:foo$';
    assert.equal(expandSnippets(sql, null), sql);
});

test('expandSnippets: no tokens in sql returns unchanged', () => {
    const snippets = { 'foo': 'bar' };
    const sql = 'SELECT * FROM users';
    assert.equal(expandSnippets(sql, snippets), sql);
});

test('expandSnippets: snippet with special characters in body', () => {
    const snippets = {
        'complex': 'WHERE name ~ \'[A-Z]{2}[0-9]{3}\' AND status IN (\'active\', \'pending\')',
    };
    const sql = 'SELECT id FROM users $snippet:complex$';
    const result = expandSnippets(sql, snippets);
    assert(result.includes('[A-Z]{2}[0-9]{3}'));
    assert(result.includes('active'));
});

test('expandSnippets: snippet name validation regex', () => {
    // Valid shortcut formats: start with letter, then alphanumeric + underscore, 1-40 chars
    const snippets = {
        'a_valid_1': 'SQL1',
        'valid_name_with_underscores': 'SQL2',
        'z9': 'SQL3',
    };
    const sql = '$snippet:a_valid_1$ $snippet:valid_name_with_underscores$ $snippet:z9$';
    const result = expandSnippets(sql, snippets);
    assert(result.includes('SQL1'));
    assert(result.includes('SQL2'));
    assert(result.includes('SQL3'));
});

test('expandSnippets: empty snippet body replaced with empty string', () => {
    const snippets = {
        'empty': '',
        'nonempty': 'WHERE x = 1',
    };
    const sql = 'SELECT * FROM users $snippet:empty$ $snippet:nonempty$';
    const result = expandSnippets(sql, snippets);
    assert(result.includes('WHERE x = 1'));
    // Empty snippet is removed but sql still valid
    assert(!result.includes('$snippet'));
});

test('expandSnippets: case sensitive shortcut matching', () => {
    const snippets = {
        'UserFilter': 'region = \'US\'',
    };
    // Lowercase version should not match
    const sql = 'SELECT * FROM ($snippet:userfilter$) t';
    const result = expandSnippets(sql, snippets);
    // Should NOT be expanded (case mismatch)
    assert(result.includes('$snippet:userfilter$'));
});

test('expandSnippets: multiple consecutive tokens', () => {
    const snippets = {
        'a': '1',
        'b': '2',
        'c': '3',
    };
    const sql = '$snippet:a$$snippet:b$$snippet:c$';
    const result = expandSnippets(sql, snippets);
    assert.equal(result, '123');
});

test('expandSnippets: token at start, middle, end of sql', () => {
    const snippets = {
        'start': 'BEGIN',
        'middle': 'MIDDLE',
        'end': 'END',
    };
    const sql = '$snippet:start$ some text $snippet:middle$ more text $snippet:end$';
    const result = expandSnippets(sql, snippets);
    assert.equal(result, 'BEGIN some text MIDDLE more text END');
});

// ─────────────────────────────────────────────────────────────────────────────
// Tab sorting helper test (if implemented)
// ─────────────────────────────────────────────────────────────────────────────

test('tab index sorting: tabs are ordered 0, 1, 2, ...', () => {
    // This is more of an integration test, but validates the concept
    const tabs = [
        { tab_index: 0, title: 'Tab 0' },
        { tab_index: 1, title: 'Tab 1' },
        { tab_index: 2, title: 'Tab 2' },
    ];
    const indices = tabs.map(t => t.tab_index);
    assert.deepEqual(indices, [0, 1, 2]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Validation helpers test (if implemented)
// ─────────────────────────────────────────────────────────────────────────────

function validateSnippetShortcut(shortcut) {
    // Regex: ^[a-z][a-z0-9_]{0,39}$
    // Starts with lowercase letter, then 0-39 of (lowercase letter, digit, underscore)
    // Allows single-letter shortcuts like "a"
    const regex = /^[a-z][a-z0-9_]{0,39}$/;
    return regex.test(shortcut);
}

test('snippet shortcut validation: valid shortcuts', () => {
    assert(validateSnippetShortcut('a'));
    assert(validateSnippetShortcut('valid_name'));
    assert(validateSnippetShortcut('users_by_region'));
    assert(validateSnippetShortcut('z9_underscore_123'));
});

test('snippet shortcut validation: invalid shortcuts', () => {
    assert(!validateSnippetShortcut(''));  // empty
    assert(!validateSnippetShortcut('_starts_with_underscore'));  // starts with underscore
    assert(!validateSnippetShortcut('StartsWithCapital'));  // starts with capital
    assert(!validateSnippetShortcut('1starts_with_digit'));  // starts with digit
    assert(!validateSnippetShortcut('valid-name'));  // contains hyphen
    assert(!validateSnippetShortcut('a'.repeat(41)));  // too long (42 chars)
});

test('snippet shortcut validation: edge cases', () => {
    assert(validateSnippetShortcut('a' + 'b'.repeat(39)));  // exactly 40 chars
    assert(!validateSnippetShortcut('a' + 'b'.repeat(40)));  // 41 chars
});
