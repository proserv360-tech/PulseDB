/**
 * tests/aiQueryService.test.js
 * ─────────────────────────────
 * Unit tests for the AI query analysis service, focusing on SQL injection
 * prevention and query analysis logic.
 *
 * Uses Node's built-in test runner (node:test) — no external deps needed.
 * Run: node --test tests/aiQueryService.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    analyzeQuery,
    detectAntiPatterns,
    getQueryComplexityScore,
} from '../services/aiQueryService.js';

// ── Mock pool that records what was queried ─────────────────────────────────
function createMockPool(planResult = null) {
    const queries = [];
    return {
        queries,
        async query(text, params) {
            queries.push({ text, params });
            if (planResult) {
                return { rows: [{ 'QUERY PLAN': [planResult] }] };
            }
            // Default: return a simple seq scan plan
            return {
                rows: [{
                    'QUERY PLAN': [{
                        Plan: { 'Node Type': 'Seq Scan', 'Total Cost': 100 },
                    }],
                }],
            };
        },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// SQL Injection Prevention
// ─────────────────────────────────────────────────────────────────────────────
describe('analyzeQuery — SQL injection prevention', () => {

    it('rejects DROP TABLE attempts', async () => {
        const pool = createMockPool();
        const result = await analyzeQuery(pool, 'DROP TABLE users; --');
        assert.equal(result.plan, null);
        assert.ok(result.suggestions[0].suggestion.includes('Analysis error'));
        assert.equal(pool.queries.length, 0, 'Should NOT have executed any query');
    });

    it('rejects DELETE statements', async () => {
        const pool = createMockPool();
        const result = await analyzeQuery(pool, 'DELETE FROM users WHERE 1=1');
        assert.equal(result.plan, null);
        assert.equal(pool.queries.length, 0);
    });

    it('rejects INSERT statements', async () => {
        const pool = createMockPool();
        const result = await analyzeQuery(pool, "INSERT INTO users (name) VALUES ('hacker')");
        assert.equal(result.plan, null);
        assert.equal(pool.queries.length, 0);
    });

    it('rejects UPDATE statements', async () => {
        const pool = createMockPool();
        const result = await analyzeQuery(pool, "UPDATE users SET role='admin'");
        assert.equal(result.plan, null);
        assert.equal(pool.queries.length, 0);
    });

    it('rejects multiple statements separated by semicolons', async () => {
        const pool = createMockPool();
        const result = await analyzeQuery(pool, 'SELECT 1; DROP TABLE users');
        assert.equal(result.plan, null);
        assert.equal(pool.queries.length, 0);
    });

    it('rejects CREATE TABLE', async () => {
        const pool = createMockPool();
        const result = await analyzeQuery(pool, 'CREATE TABLE evil (id int)');
        assert.equal(result.plan, null);
        assert.equal(pool.queries.length, 0);
    });

    it('rejects ALTER TABLE hidden in comments', async () => {
        const pool = createMockPool();
        const result = await analyzeQuery(pool, '/* harmless */ ALTER TABLE users ADD COLUMN x int');
        assert.equal(result.plan, null);
        assert.equal(pool.queries.length, 0);
    });

    it('allows legitimate SELECT queries', async () => {
        const pool = createMockPool({
            Plan: { 'Node Type': 'Seq Scan', 'Total Cost': 50 },
        });
        const result = await analyzeQuery(pool, 'SELECT id, name FROM users WHERE active = true');
        assert.ok(pool.queries.length > 0, 'Should have executed the EXPLAIN query');
    });

    it('allows SELECT with CTE (WITH ... AS)', async () => {
        const pool = createMockPool({
            Plan: { 'Node Type': 'CTE Scan', 'Total Cost': 200 },
        });
        const result = await analyzeQuery(pool, 'WITH recent AS (SELECT * FROM orders WHERE created_at > now() - interval \'1 day\') SELECT * FROM recent');
        assert.ok(pool.queries.length > 0);
    });

    it('rejects empty query', async () => {
        const pool = createMockPool();
        await assert.rejects(
            () => analyzeQuery(pool, ''),
            { message: 'queryText is required' }
        );
    });

    it('rejects null query', async () => {
        const pool = createMockPool();
        await assert.rejects(
            () => analyzeQuery(pool, null),
            { message: 'queryText is required' }
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Anti-pattern detection
// ─────────────────────────────────────────────────────────────────────────────
describe('detectAntiPatterns', () => {

    it('detects SELECT *', async () => {
        const pool = createMockPool();
        const patterns = await detectAntiPatterns(pool, 'SELECT * FROM users');
        assert.ok(patterns.some(p => p.pattern === 'SELECT *'));
    });

    it('detects NOT IN', async () => {
        const pool = createMockPool();
        const patterns = await detectAntiPatterns(pool, 'SELECT id FROM users WHERE id NOT IN (SELECT user_id FROM banned)');
        assert.ok(patterns.some(p => p.pattern === 'NOT IN with potential NULL'));
    });

    it('returns empty for clean query', async () => {
        const pool = createMockPool();
        const patterns = await detectAntiPatterns(pool, 'SELECT id, name FROM users WHERE active = true LIMIT 100');
        assert.equal(patterns.length, 0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Complexity scoring
// ─────────────────────────────────────────────────────────────────────────────
describe('getQueryComplexityScore', () => {

    it('scores a simple SELECT as simple', async () => {
        const pool = createMockPool();
        const result = await getQueryComplexityScore(pool, 'SELECT id FROM users');
        assert.equal(result.level, 'simple');
        assert.ok(result.score <= 5);
    });

    it('scores a query with multiple JOINs as moderate or complex', async () => {
        const pool = createMockPool();
        const result = await getQueryComplexityScore(
            pool,
            'SELECT u.id FROM users u JOIN orders o ON u.id = o.user_id JOIN products p ON o.product_id = p.id GROUP BY u.id'
        );
        assert.ok(result.level === 'moderate' || result.level === 'complex');
        assert.ok(result.factors.length > 0);
    });

    it('detects window functions', async () => {
        const pool = createMockPool();
        const result = await getQueryComplexityScore(
            pool,
            'SELECT id, ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC) FROM employees'
        );
        assert.ok(result.factors.some(f => f.includes('Window')));
    });
});
