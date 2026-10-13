/**
 * tests/queryAdvisor.test.ts — plan anti-pattern detection unit tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePlan, statementHash, benchmarkRewrite } from '../services/queryAdvisorService.js';

const seqScanPlan = {
    Plan: {
        'Node Type': 'Seq Scan',
        'Relation Name': 'orders',
        'Plan Rows': 80000,
        'Actual Rows': 120000,
        'Actual Loops': 1,
        Filter: "(status = 'pending')",
    },
};

test('detects seq scan with filter on large table', () => {
    const issues = analyzePlan(seqScanPlan);
    assert.ok(issues.some((i) => i.code === 'SEQ_SCAN_FILTER'));
});

test('detects hot nested loop', () => {
    const plan = { Plan: { 'Node Type': 'Nested Loop', 'Actual Loops': 5000, 'Plan Rows': 1, Plans: [] } };
    const issues = analyzePlan(plan);
    assert.ok(issues.some((i) => i.code === 'HOT_NESTED_LOOP'));
});

test('detects planner estimate mismatch', () => {
    const plan = { Plan: { 'Node Type': 'Index Scan', 'Plan Rows': 10, 'Actual Rows': 5000 } };
    const issues = analyzePlan(plan);
    assert.ok(issues.some((i) => i.code === 'ESTIMATE_MISMATCH'));
});

test('detects external sort spill', () => {
    const plan = { Plan: { 'Node Type': 'Sort', 'Sort Method': 'external merge', 'Sort Space Used': 81920 } };
    const issues = analyzePlan(plan);
    assert.ok(issues.some((i) => i.code === 'SORT_SPILL'));
});

test('clean plan yields no issues', () => {
    const plan = { Plan: { 'Node Type': 'Index Only Scan', 'Plan Rows': 100, 'Actual Rows': 110 } };
    assert.deepEqual(analyzePlan(plan), []);
});

test('handles stringified and array-wrapped plans', () => {
    const wrapped = JSON.stringify([seqScanPlan]);
    assert.ok(analyzePlan(wrapped).length > 0);
});

test('statementHash normalizes literals and whitespace', () => {
    assert.equal(statementHash('SELECT * FROM t WHERE id = 42'), statementHash('select *  from t where id = 7'));
});

test('benchmarkRewrite rejects non-SELECT statements', async () => {
    await assert.rejects(
        () => benchmarkRewrite({ targetPool: {}, original: 'DELETE FROM t', rewrite: 'SELECT 1' }),
        /read-only SELECT/,
    );
    await assert.rejects(
        () => benchmarkRewrite({ targetPool: {}, original: 'SELECT 1', rewrite: 'SELECT 1; DROP TABLE t' }),
        /read-only SELECT/,
    );
});

test('benchmarkRewrite compares planner cost and rolls back', async () => {
    const queries: string[] = [];
    const client = {
        query: async (sql: string) => {
            queries.push(sql);
            if (sql.startsWith('EXPLAIN')) {
                const cost = sql.includes('slow') ? 1000 : 100;
                return { rows: [{ 'QUERY PLAN': [{ Plan: { 'Node Type': 'Seq Scan', 'Total Cost': cost } }] }] };
            }
            return { rows: [] };
        },
        release: () => {},
    };
    const targetPool = { connect: async () => client };
    const out = await benchmarkRewrite({
        targetPool,
        original: 'SELECT * FROM slow_table',
        rewrite: 'SELECT * FROM fast_table',
    });
    assert.equal(out.basis, 'planner cost');
    assert.ok(out.improvement > 0, `expected improvement, got ${out.improvement}`);
    assert.ok(queries.includes('BEGIN') && queries.includes('ROLLBACK'), 'must wrap in rolled-back txn');
});
