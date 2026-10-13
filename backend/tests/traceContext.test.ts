/**
 * tests/traceContext.test.js
 * ───────────────────────────
 * Unit tests for W3C trace-context parsing + sqlcommenter extraction.
 *
 * Run: node --test tests/traceContext.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    parseTraceparent,
    extractFromRequest,
    extractFromSql,
    extractFromApplicationName,
    formatTraceparent,
} from '../services/trace/traceContext.js';

import {
    resolveTraceContext,
    getQueriesForTrace,
    summariseTrace,
} from '../services/trace/traceCorrelation.js';

const GOOD = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
const GOOD_TRACE = '0af7651916cd43dd8448eb211c80319c';
const GOOD_SPAN = 'b7ad6b7169203331';

describe('parseTraceparent', () => {
    it('parses a well-formed W3C traceparent', () => {
        const ctx = parseTraceparent(GOOD);
        assert.deepEqual(ctx, { traceId: GOOD_TRACE, spanId: GOOD_SPAN, flags: '01' });
    });

    it('rejects the all-zero traceId (invalid per spec)', () => {
        const bad = '00-00000000000000000000000000000000-b7ad6b7169203331-01';
        assert.equal(parseTraceparent(bad), null);
    });

    it('rejects the all-zero spanId', () => {
        const bad = '00-0af7651916cd43dd8448eb211c80319c-0000000000000000-01';
        assert.equal(parseTraceparent(bad), null);
    });

    it('rejects malformed inputs', () => {
        assert.equal(parseTraceparent(''), null);
        assert.equal(parseTraceparent(null), null);
        assert.equal(parseTraceparent(undefined), null);
        assert.equal(parseTraceparent('not-a-traceparent'), null);
        assert.equal(parseTraceparent('00-TOOSHORT-b7ad6b7169203331-01'), null);
        assert.equal(parseTraceparent(42), null);
    });

    it('trims surrounding whitespace', () => {
        const ctx = parseTraceparent(`  ${GOOD}\n`);
        assert.equal(ctx.traceId, GOOD_TRACE);
    });
});

describe('extractFromRequest', () => {
    it('reads req.headers.traceparent', () => {
        const ctx = extractFromRequest({ headers: { traceparent: GOOD } });
        assert.equal(ctx.traceId, GOOD_TRACE);
    });

    it('returns null when no traceparent header present', () => {
        assert.equal(extractFromRequest({ headers: {} }), null);
    });

    it('handles array-valued headers (some frameworks)', () => {
        const ctx = extractFromRequest({ headers: { traceparent: [GOOD] } });
        assert.equal(ctx.traceId, GOOD_TRACE);
    });

    it('returns null on a nullish req or missing headers', () => {
        assert.equal(extractFromRequest(null), null);
        assert.equal(extractFromRequest({}), null);
    });
});

describe('extractFromSql (sqlcommenter)', () => {
    it('extracts traceparent from a sqlcommenter comment', () => {
        const sql = `/*traceparent='${GOOD}'*/ SELECT 1`;
        assert.equal(extractFromSql(sql).traceId, GOOD_TRACE);
    });

    it('tolerates whitespace inside the comment', () => {
        const sql = `/*  traceparent = '${GOOD}'  */ SELECT 1`;
        assert.equal(extractFromSql(sql).traceId, GOOD_TRACE);
    });

    it('ignores SQL without a traceparent comment', () => {
        assert.equal(extractFromSql('SELECT 1'), null);
    });

    it('ignores an unrelated comment', () => {
        assert.equal(extractFromSql('/* not a traceparent */ SELECT 1'), null);
    });
});

describe('extractFromApplicationName', () => {
    it('extracts from an application_name that is literally the traceparent', () => {
        assert.equal(extractFromApplicationName(GOOD).traceId, GOOD_TRACE);
    });

    it('returns null for unrelated strings', () => {
        assert.equal(extractFromApplicationName('myapp-prod'), null);
        assert.equal(extractFromApplicationName(''), null);
    });
});

describe('formatTraceparent', () => {
    it('round-trips with parseTraceparent', () => {
        const formatted = formatTraceparent({ traceId: GOOD_TRACE, spanId: GOOD_SPAN });
        const parsed = parseTraceparent(formatted);
        assert.equal(parsed.traceId, GOOD_TRACE);
        assert.equal(parsed.spanId, GOOD_SPAN);
        assert.equal(parsed.flags, '01');
    });

    it('uses explicit flags when provided', () => {
        const s = formatTraceparent({ traceId: GOOD_TRACE, spanId: GOOD_SPAN, flags: '00' });
        assert.ok(s.endsWith('-00'));
    });

    it('returns null on missing required parts', () => {
        assert.equal(formatTraceparent({ traceId: GOOD_TRACE }), null);
        assert.equal(formatTraceparent({}), null);
    });
});

describe('resolveTraceContext', () => {
    it('prefers explicit context over SQL or app-name', () => {
        const ctx = resolveTraceContext({
            event: { statement: `/*traceparent='${GOOD}'*/ SELECT 1` },
            explicit: { traceId: GOOD_TRACE, spanId: GOOD_SPAN },
            applicationName: GOOD,
        });
        assert.equal(ctx.source, 'explicit');
    });

    it('falls back to sqlcommenter when explicit missing', () => {
        const ctx = resolveTraceContext({
            event: { statement: `/*traceparent='${GOOD}'*/ SELECT 1` },
        });
        assert.equal(ctx.source, 'sql-comment');
        assert.equal(ctx.traceId, GOOD_TRACE);
    });

    it('falls back to application_name when SQL has nothing', () => {
        const ctx = resolveTraceContext({
            event: { statement: 'SELECT 1' },
            applicationName: GOOD,
        });
        assert.equal(ctx.source, 'application-name');
    });

    it('returns null source when no context anywhere', () => {
        const ctx = resolveTraceContext({ event: { statement: 'SELECT 1' } });
        assert.equal(ctx.source, null);
        assert.equal(ctx.traceId, null);
    });
});

// ── getQueriesForTrace / summariseTrace (mock queryFn) ────────────────────
function mockQueryFn(rows) {
    const calls = [];
    const fn = async (sql, params) => {
        calls.push({ sql, params });
        return { rows };
    };
    fn.calls = calls;
    return fn;
}

describe('getQueriesForTrace', () => {
    it('validates the traceId shape before querying', async () => {
        const qfn = mockQueryFn([]);
        await assert.rejects(
            () => getQueriesForTrace(qfn, 'not-a-trace-id'),
            /invalid traceId/,
        );
        assert.equal(qfn.calls.length, 0);
    });

    it('lower-cases the traceId for the query', async () => {
        const qfn = mockQueryFn([]);
        const upper = GOOD_TRACE.toUpperCase();
        await getQueriesForTrace(qfn, upper);
        assert.equal(qfn.calls[0].params[0], GOOD_TRACE);
    });

    it('passes the limit through', async () => {
        const qfn = mockQueryFn([]);
        await getQueriesForTrace(qfn, GOOD_TRACE, { limit: 42 });
        assert.equal(qfn.calls[0].params[1], 42);
    });
});

describe('summariseTrace', () => {
    it('reports found=false for an unknown trace', async () => {
        const qfn = mockQueryFn([]);
        const s = await summariseTrace(qfn, GOOD_TRACE);
        assert.equal(s.found, false);
    });

    it('aggregates count, totalDuration, and distinct dbs', async () => {
        const qfn = mockQueryFn([
            { ts: 1, db: 'pg', duration_ms: 10 },
            { ts: 2, db: 'pg', duration_ms: 20 },
            { ts: 3, db: 'redis', duration_ms: 5 },
        ]);
        const s = await summariseTrace(qfn, GOOD_TRACE);
        assert.equal(s.found, true);
        assert.equal(s.queryCount, 3);
        assert.equal(s.totalDurationMs, 35);
        assert.deepEqual([...s.databases].sort(), ['pg', 'redis']);
    });
});
