/**
 * tests/envValidation.test.js
 * ────────────────────────────
 * Unit tests for the SQL validation guards used throughout the server.
 *
 * Uses Node's built-in test runner (node:test).
 * Run: node --test tests/envValidation.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─────────────────────────────────────────────────────────────────────────────
// We extract the validation logic inline since server.js isn't easily importable
// (it starts an Express server on import). These mirror the regexes in server.js.
// ─────────────────────────────────────────────────────────────────────────────
const DANGEROUS_SQL = /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|CREATE|ALTER|GRANT|REVOKE|COPY|EXECUTE|DO\b|CALL|NOTIFY|LISTEN|LOAD|LOCK\s+TABLE|CHECKPOINT|SECURITY\s+LABEL|SET\s+ROLE|RESET\s+ALL)\b/i;

function validateExplainQuery(sql) {
    if (!sql || typeof sql !== 'string') return 'Query must be a non-empty string';
    if (sql.length > 8_000) return 'Query too long (max 8,000 characters)';
    const stripped = sql
        .replace(/--[^\n]*/g, ' ')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .trim();
    if (!stripped) return 'Query is empty';
    if (/;/.test(stripped.replace(/;$/, ''))) return 'Multiple SQL statements are not allowed';
    if (DANGEROUS_SQL.test(stripped)) return 'Query contains disallowed SQL operations (only SELECT is allowed here)';
    return null;
}

describe('validateExplainQuery', () => {

    it('returns null for valid SELECT', () => {
        assert.equal(validateExplainQuery('SELECT 1'), null);
    });

    it('returns null for SELECT with trailing semicolon', () => {
        assert.equal(validateExplainQuery('SELECT * FROM users;'), null);
    });

    it('rejects empty string', () => {
        assert.ok(validateExplainQuery('') !== null);
    });

    it('rejects null', () => {
        assert.ok(validateExplainQuery(null) !== null);
    });

    it('rejects numeric input', () => {
        assert.ok(validateExplainQuery(123) !== null);
    });

    it('rejects DROP TABLE', () => {
        const err = validateExplainQuery('DROP TABLE users');
        assert.ok(err.includes('disallowed'));
    });

    it('rejects multiple statements', () => {
        const err = validateExplainQuery('SELECT 1; DROP TABLE users');
        assert.ok(err.includes('Multiple'));
    });

    it('rejects DELETE', () => {
        assert.ok(validateExplainQuery('DELETE FROM users') !== null);
    });

    it('rejects INSERT', () => {
        assert.ok(validateExplainQuery("INSERT INTO t VALUES (1)") !== null);
    });

    it('rejects UPDATE', () => {
        assert.ok(validateExplainQuery("UPDATE t SET x = 1") !== null);
    });

    it('rejects GRANT', () => {
        assert.ok(validateExplainQuery('GRANT ALL ON users TO public') !== null);
    });

    it('strips SQL comments before checking', () => {
        // DROP hidden in a comment should be stripped, leaving empty
        const err = validateExplainQuery('-- DROP TABLE users');
        assert.ok(err !== null); // empty after stripping
    });

    it('rejects queries over 8000 chars', () => {
        const longQuery = 'SELECT ' + 'a'.repeat(8001);
        assert.ok(validateExplainQuery(longQuery).includes('too long'));
    });

    it('allows WITH ... AS (CTE)', () => {
        assert.equal(
            validateExplainQuery('WITH cte AS (SELECT 1) SELECT * FROM cte'),
            null
        );
    });
});
