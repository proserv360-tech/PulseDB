/**
 * tests/whatIfIndex.test.ts — hypothetical index analysis unit tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCandidates, whatIfAnalysis, checkHypopg } from '../services/whatIfIndexService.js';

test('generateCandidates builds singles and composites from WHERE clause', () => {
    const c = generateCandidates("SELECT * FROM orders o WHERE o.status = 'x' AND o.created_at > now()");
    assert.ok(c.length >= 2, `expected candidates, got ${c.length}`);
    assert.ok(c.every((x) => x.ddl.startsWith('CREATE INDEX CONCURRENTLY')));
    const composite = c.find((x) => x.columns.length === 2);
    assert.ok(composite, 'expected a composite candidate');
});

test('generateCandidates rejects writes', () => {
    assert.throws(() => generateCandidates('DELETE FROM t WHERE t.id = 1'), /read-only SELECT/);
});

test('checkHypopg returns false when extension query fails', async () => {
    const pool = {
        query: async () => {
            throw new Error('no db');
        },
    };
    assert.equal(await checkHypopg(pool), false);
});

test('whatIfAnalysis without hypopg returns unverified candidates', async () => {
    const client = {
        query: async (sql: string) => {
            if (sql.startsWith('EXPLAIN')) return { rows: [{ 'QUERY PLAN': [{ Plan: { 'Total Cost': 500 } }] }] };
            return { rows: [] };
        },
        release: () => {},
    };
    const pool = {
        query: async (sql: string) => {
            if (sql.includes('pg_extension')) return { rows: [] }; // hypopg absent
            return { rows: [] };
        },
        connect: async () => client,
    };
    const out = await whatIfAnalysis({ targetPool: pool, query: 'SELECT * FROM t WHERE t.a = 1 AND t.b = 2' });
    assert.equal(out.hypopg, false);
    assert.equal(out.baselineCost, 500);
    assert.ok(out.results.length > 0);
    assert.ok(out.results.every((r: any) => r.verified === false));
});

test('whatIfAnalysis with hypopg ranks by improvement and rolls back', async () => {
    const executed: string[] = [];
    let hypoActive = false;
    const client = {
        query: async (sql: string, params?: any[]) => {
            executed.push(sql);
            if (sql.includes('hypopg_create_index')) {
                hypoActive = true;
                return { rows: [] };
            }
            if (sql.includes('hypopg_reset')) {
                hypoActive = false;
                return { rows: [] };
            }
            if (sql.startsWith('EXPLAIN')) {
                return { rows: [{ 'QUERY PLAN': [{ Plan: { 'Total Cost': hypoActive ? 50 : 500 } }] }] };
            }
            return { rows: [] };
        },
        release: () => {},
    };
    const pool = {
        query: async (sql: string) => (sql.includes('pg_extension') ? { rows: [{ '?column?': 1 }] } : { rows: [] }),
        connect: async () => client,
    };
    const out = await whatIfAnalysis({ targetPool: pool, query: 'SELECT * FROM t WHERE t.a = 1' });
    assert.equal(out.hypopg, true);
    assert.ok(out.results[0].verified);
    assert.ok(out.results[0].improvement && out.results[0].improvement > 80);
    assert.ok(executed.includes('ROLLBACK'));
});
