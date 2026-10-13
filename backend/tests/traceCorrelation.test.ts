import { test } from 'node:test';
import assert from 'node:assert/strict';
import { correlateSpansWithQueries } from '../services/trace/traceCorrelation.js';
const MS = 1_000_000;
const spans = [
    {
        spanId: 'aaaa000000000001',
        parentSpanId: null,
        name: 'GET /checkout',
        startTimeNs: 0,
        endTimeNs: 200 * MS,
        statusCode: 'OK',
    },
    {
        spanId: 'aaaa000000000002',
        parentSpanId: 'aaaa000000000001',
        name: 'db.query orders',
        startTimeNs: 10 * MS,
        endTimeNs: 90 * MS,
        statusCode: 'OK',
    },
    {
        spanId: 'aaaa000000000003',
        parentSpanId: 'aaaa000000000001',
        name: 'db.query users',
        startTimeNs: 95 * MS,
        endTimeNs: 110 * MS,
        statusCode: 'OK',
    },
];
const queries = [
    {
        id: 1,
        db: 'shop',
        statement: 'SELECT * FROM orders',
        duration_ms: 70,
        trace_id: 'f'.repeat(32),
        span_id: 'aaaa000000000002',
    },
    {
        id: 2,
        db: 'shop',
        statement: 'SELECT id FROM users',
        duration_ms: 12,
        trace_id: 'f'.repeat(32),
        span_id: 'aaaa000000000003',
    },
    { id: 3, db: 'shop', statement: 'SELECT 1', duration_ms: 3, trace_id: 'f'.repeat(32), span_id: 'bbbb999999999999' },
];
test('grafts queries onto spans by span_id', () => {
    const out = correlateSpansWithQueries(spans, queries);
    assert.equal(out.spans.find((s) => s.spanId === 'aaaa000000000002').queries[0].id, 1);
    assert.equal(out.spans.find((s) => s.spanId === 'aaaa000000000002').dbTimeMs, 70);
    assert.equal(out.spans.find((s) => s.parentSpanId === null).queries.length, 0);
});
test('collects orphan queries', () => {
    assert.equal(correlateSpansWithQueries(spans, queries).orphanQueries[0].id, 3);
});
test('computes totals + pct of trace', () => {
    const out = correlateSpansWithQueries(spans, queries);
    assert.equal(out.totals.dbTimeMs, 85);
    assert.equal(out.totals.queryTimePctOfTrace, 42.5);
});
test('identifies slowest query and DB span', () => {
    const out = correlateSpansWithQueries(spans, queries);
    assert.equal(out.slowestQuery.id, 1);
    assert.equal(out.slowestDbSpan.spanId, 'aaaa000000000002');
});
test('handles empty inputs', () => {
    const e = correlateSpansWithQueries([], []);
    assert.equal(e.totals.spanCount, 0);
    assert.equal(e.slowestQuery, null);
    assert.equal(e.slowestDbSpan, null);
});
test('case-insensitive span_id match', () => {
    const out = correlateSpansWithQueries(spans, [{ ...queries[0], span_id: 'AAAA000000000002' }]);
    assert.equal(out.spans.find((s) => s.spanId === 'aaaa000000000002').queries.length, 1);
    assert.equal(out.orphanQueries.length, 0);
});
