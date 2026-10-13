/**
 * tests/scimFilter.test.js
 * ─────────────────────────
 * Unit tests for the SCIM 2.0 filter parser + evaluator (RFC 7644 §3.4.2.2).
 *
 * Run: node --test tests/scimFilter.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    parseFilter,
    evaluateFilter,
    ScimFilterError,
} from '../enterprise/scim/scimFilterParser.js';

const allowed = new Set([
    'userName', 'displayName', 'active',
    'name.givenName', 'emails.value',
    'loginCount',
]);

const user = {
    userName: 'alice',
    displayName: 'Alice Example',
    active: true,
    name: { givenName: 'Alice' },
    emails: [{ value: 'alice@example.com', primary: true }],
    loginCount: 42,
};

// ── parseFilter ───────────────────────────────────────────────────────────
describe('parseFilter', () => {
    it('parses a simple eq expression', () => {
        const ast = parseFilter('userName eq "alice"', { allowedAttributes: allowed });
        assert.equal(ast.op, 'eq');
        assert.equal(ast.attr, 'userName');
        assert.equal(ast.value, 'alice');
    });

    it('parses "pr" (present) — no value required', () => {
        const ast = parseFilter('displayName pr', { allowedAttributes: allowed });
        assert.deepEqual(ast, { op: 'pr', attr: 'displayName' });
    });

    it('parses AND with correct precedence (AND binds tighter than OR)', () => {
        const ast = parseFilter('userName eq "a" or userName eq "b" and active eq true', {
            allowedAttributes: allowed,
        });
        // Shape: or( eq(a), and( eq(b), eq(true) ) )
        assert.equal(ast.op, 'or');
        assert.equal(ast.right.op, 'and');
    });

    it('parses parentheses to override precedence', () => {
        const ast = parseFilter('(userName eq "a" or userName eq "b") and active eq true', {
            allowedAttributes: allowed,
        });
        assert.equal(ast.op, 'and');
        assert.equal(ast.left.op, 'or');
    });

    it('parses NOT', () => {
        const ast = parseFilter('not (active eq true)', { allowedAttributes: allowed });
        assert.equal(ast.op, 'not');
        assert.equal(ast.child.op, 'eq');
    });

    it('parses dotted attribute paths', () => {
        const ast = parseFilter('name.givenName eq "Alice"', { allowedAttributes: allowed });
        assert.equal(ast.attr, 'name.givenName');
    });

    it('parses numbers and booleans without quotes', () => {
        const a = parseFilter('loginCount gt 10', { allowedAttributes: allowed });
        assert.equal(a.value, 10);
        const b = parseFilter('active eq true', { allowedAttributes: allowed });
        assert.equal(b.value, true);
    });

    it('rejects attributes outside the allowlist', () => {
        assert.throws(
            () => parseFilter('password eq "x"', { allowedAttributes: allowed }),
            (err) => err instanceof ScimFilterError && err.scimType === 'invalidPath',
        );
    });

    it('rejects complex attribute filters rather than silently misparsing', () => {
        // Complex filters like emails[type eq "work"] are explicitly out of scope;
        // the parser surfaces a ScimFilterError (the exact message is an
        // implementation detail — we just verify the error type here).
        assert.throws(
            () => parseFilter('emails[type eq "work"].value eq "x"', { allowedAttributes: allowed }),
            ScimFilterError,
        );
    });

    it('rejects an unterminated string literal', () => {
        assert.throws(
            () => parseFilter('userName eq "unterminated', { allowedAttributes: allowed }),
            /unterminated string literal/,
        );
    });

    it('rejects trailing garbage tokens', () => {
        assert.throws(
            () => parseFilter('userName eq "a" trailing', { allowedAttributes: allowed }),
            ScimFilterError,
        );
    });

    it('rejects empty / non-string input', () => {
        assert.throws(() => parseFilter('', { allowedAttributes: allowed }), ScimFilterError);
        assert.throws(() => parseFilter(null, { allowedAttributes: allowed }), ScimFilterError);
    });
});

// ── evaluateFilter ────────────────────────────────────────────────────────
describe('evaluateFilter', () => {
    const ev = (f) => evaluateFilter(parseFilter(f, { allowedAttributes: allowed }), user);

    it('eq is case-insensitive for strings', () => {
        assert.equal(ev('userName eq "ALICE"'), true);
        assert.equal(ev('userName eq "bob"'), false);
    });

    it('ne inverts eq', () => {
        assert.equal(ev('userName ne "bob"'), true);
        assert.equal(ev('userName ne "alice"'), false);
    });

    it('co / sw / ew for substrings', () => {
        assert.equal(ev('displayName co "example"'), true);
        assert.equal(ev('displayName sw "Alice"'), true);
        assert.equal(ev('displayName ew "Example"'), true);
    });

    it('pr is true for present non-empty fields', () => {
        assert.equal(ev('displayName pr'), true);
    });

    it('pr is false for missing / empty fields', () => {
        const ast = parseFilter('displayName pr', { allowedAttributes: allowed });
        assert.equal(evaluateFilter(ast, {}), false);
        assert.equal(evaluateFilter(ast, { displayName: '' }), false);
    });

    it('gt / ge / lt / le on numbers', () => {
        assert.equal(ev('loginCount gt 10'), true);
        assert.equal(ev('loginCount ge 42'), true);
        assert.equal(ev('loginCount lt 1000'), true);
        assert.equal(ev('loginCount le 42'), true);
        assert.equal(ev('loginCount gt 100'), false);
    });

    it('dotted path navigation', () => {
        assert.equal(ev('name.givenName eq "Alice"'), true);
    });

    it('and / or / not composition', () => {
        assert.equal(ev('userName eq "alice" and active eq true'), true);
        assert.equal(ev('userName eq "bob" or active eq true'), true);
        assert.equal(ev('not (userName eq "bob")'), true);
    });
});
