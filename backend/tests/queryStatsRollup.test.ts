/**
 * tests/queryStatsRollup.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDeltas, topQueriesByLoad } from '../services/queryStatsRollup.js';

test('computeDeltas subtracts cumulative counters', () => {
    const early = [{ query_id: 'q1', calls: 100, total_exec_time: 1000 }];
    const late = [{ query_id: 'q1', calls: 160, total_exec_time: 4000 }];
    const out = computeDeltas(early, late);
    assert.equal(out[0].load_ms, 3000);
    assert.equal(out[0].calls_delta, 60);
});

test('computeDeltas handles new queries and sorts by load', () => {
    const late = [
        { query_id: 'small', calls: 5, total_exec_time: 50 },
        { query_id: 'big', calls: 2, total_exec_time: 9000 },
    ];
    const out = computeDeltas([], late);
    assert.equal(out[0].query_id, 'big');
});

test('computeDeltas survives counter resets', () => {
    const early = [{ query_id: 'q1', calls: 500, total_exec_time: 90000 }];
    const late = [{ query_id: 'q1', calls: 10, total_exec_time: 200 }];
    const out = computeDeltas(early, late);
    assert.equal(out[0].load_ms, 200);
    assert.equal(out[0].calls_delta, 10);
});

test('topQueriesByLoad returns empty cleanly without table', async () => {
    const pool = {
        query: async () => {
            const e: any = new Error('relation "x" does not exist');
            throw e;
        },
    };
    const out = await topQueriesByLoad({ controlPool: pool, connectionId: 'c1' });
    assert.deepEqual(out.queries, []);
});

test('topQueriesByLoad computes deltas across window', async () => {
    const snapA = JSON.stringify([{ query_id: 'q1', calls: 10, total_exec_time: 100, query: 'SELECT a' }]);
    const snapB = JSON.stringify([{ query_id: 'q1', calls: 50, total_exec_time: 2100, query: 'SELECT a' }]);
    const pool = {
        query: async () => ({
            rows: [
                { snapshot: snapA, captured_at: '2026-06-10T10:00:00Z' },
                { snapshot: snapB, captured_at: '2026-06-10T11:00:00Z' },
            ],
        }),
    };
    const out = await topQueriesByLoad({ controlPool: pool, connectionId: 'c1' });
    assert.equal(out.queries[0].loadMs, 2000);
    assert.equal(out.queries[0].calls, 40);
    assert.equal(out.queries[0].meanMs, 50);
});
