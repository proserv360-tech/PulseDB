/**
 * tests/otlpTraceService.test.js
 * ──────────────────────────────
 * Unit tests for OTLP trace service.
 * No database required — pure function testing + snapshots.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    parseOtlpRequest,
    sampleDecision,
    assembleTraceSummary,
    buildSpanTree,
} from '../services/otlpTraceService.js';

// ─────────────────────────────────────────────────────────────────────────────
// TEST DATA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a realistic OTLP/HTTP JSON payload with 1 trace and 3 spans.
 * trace_id: 16 bytes in hex = 32 hex chars
 * span_id: 8 bytes in hex = 16 hex chars
 */
function makeOtlpPayload() {
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const spanId1 = '0af7651916cd43dd';
    const spanId2 = '9907341991eef672'; // child of span1
    const spanId3 = 'a42cd8394d60b495'; // child of span1

    return {
        resourceSpans: [
            {
                resource: {
                    attributes: {
                        'service.name': 'api-server',
                        'service.version': '1.0.0',
                        'host.name': 'prod-1',
                    },
                },
                scopeSpans: [
                    {
                        scope: {
                            name: 'example.com/my-library',
                            version: '1.0.0',
                        },
                        spans: [
                            {
                                traceId,
                                spanId: spanId1,
                                parentSpanId: null,
                                name: 'GET /api/users',
                                kind: 2, // INTERNAL
                                startTimeUnixNano: '1234567890000000000',
                                endTimeUnixNano: '1234567891000000000', // +1s
                                status: { code: 0, message: '' }, // 0 = OK // 0 = OK
                                attributes: {
                                    'http.method': 'GET',
                                    'http.url': 'http://localhost:8080/api/users',
                                    'http.status_code': 200,
                                    'custom.tag': 'production',
                                    'number.value': 42,
                                    'bool.value': true,
                                },
                                events: [
                                    {
                                        timeUnixNano: '1234567890500000000',
                                        name: 'cache_hit',
                                        attributes: { cache_key: 'users:1' },
                                    },
                                ],
                            },
                            {
                                traceId,
                                spanId: spanId2,
                                parentSpanId: spanId1,
                                name: 'SELECT * FROM users',
                                kind: 3, // SERVER
                                startTimeUnixNano: '1234567890100000000',
                                endTimeUnixNano: '1234567890600000000', // +500ms
                                status: { code: 0, message: '' }, // 0 = OK
                                attributes: {
                                    'db.system': 'postgresql',
                                    'db.statement': 'SELECT * FROM users LIMIT 100',
                                    'db.rows_returned': 100,
                                },
                                events: [],
                            },
                            {
                                traceId,
                                spanId: spanId3,
                                parentSpanId: spanId1,
                                name: 'json_encode',
                                kind: 1, // CLIENT
                                startTimeUnixNano: '1234567890700000000',
                                endTimeUnixNano: '1234567890900000000', // +200ms
                                status: { code: 1, message: 'Error encoding' }, // 1 = ERROR
                                attributes: {
                                    'error': true,
                                    'error.kind': 'SerializationError',
                                },
                                events: [
                                    {
                                        timeUnixNano: '1234567890800000000',
                                        name: 'exception',
                                        attributes: { 'exception.message': 'circular reference' },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS: parseOtlpRequest
// ─────────────────────────────────────────────────────────────────────────────

test('parseOtlpRequest: parses realistic OTLP/HTTP payload', async (t) => {
    const payload = makeOtlpPayload();
    const spans = parseOtlpRequest(payload);

    assert.equal(spans.length, 3, 'should parse 3 spans');

    const root = spans[0];
    assert.equal(root.operationName, 'GET /api/users');
    assert.equal(root.serviceName, 'api-server');
    assert.equal(root.kind, 2);
    assert.equal(root.statusCode, 'OK');
    assert.equal(root.parentSpanId, null);
    assert.equal(root.attributes['http.method'], 'GET');
    assert.equal(root.attributes['http.status_code'], 200);
    assert.equal(root.attributes['custom.tag'], 'production');
    assert.equal(root.attributes['number.value'], 42);
    assert.equal(root.attributes['bool.value'], true);
    assert.equal(root.events.length, 1);
    assert.equal(root.events[0].name, 'cache_hit');
});

test('parseOtlpRequest: handles empty resourceSpans', (t) => {
    const spans = parseOtlpRequest({ resourceSpans: [] });
    assert.equal(spans.length, 0);
});

test('parseOtlpRequest: handles missing scopeSpans', (t) => {
    const payload = {
        resourceSpans: [
            {
                resource: { attributes: { 'service.name': 'test' } },
                // no scopeSpans
            },
        ],
    };
    const spans = parseOtlpRequest(payload);
    assert.equal(spans.length, 0);
});

test('parseOtlpRequest: skips spans with no startTimeUnixNano', (t) => {
    const payload = {
        resourceSpans: [
            {
                resource: { attributes: { 'service.name': 'test' } },
                scopeSpans: [
                    {
                        spans: [
                            {
                                traceId: '12345678901234567890123456789012',
                                spanId: '1234567890123456',
                                // no startTimeUnixNano
                                name: 'incomplete',
                            },
                        ],
                    },
                ],
            },
        ],
    };
    const spans = parseOtlpRequest(payload);
    assert.equal(spans.length, 0);
});

test('parseOtlpRequest: handles missing endTimeUnixNano (uses startTime)', (t) => {
    const payload = {
        resourceSpans: [
            {
                resource: { attributes: { 'service.name': 'test' } },
                scopeSpans: [
                    {
                        spans: [
                            {
                                traceId: '12345678901234567890123456789012',
                                spanId: '1234567890123456',
                                startTimeUnixNano: '1000000000',
                                name: 'span',
                                // no endTimeUnixNano
                            },
                        ],
                    },
                ],
            },
        ],
    };
    const spans = parseOtlpRequest(payload);
    assert.equal(spans.length, 1);
    assert.equal(spans[0].durationMs, 0);
});

test('parseOtlpRequest: handles null body gracefully', (t) => {
    const spans = parseOtlpRequest(null);
    assert.equal(spans.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// TESTS: sampleDecision
// ─────────────────────────────────────────────────────────────────────────────

test('sampleDecision: rate 1.0 always includes', (t) => {
    const traceIds = [
        '4bf92f3577b34da6a3ce929d0e0e4736',
        'ffffffffffffffffffffffffffffffff',
        '0000000000000000000000000000000000',
    ];

    for (const traceId of traceIds) {
        const included = sampleDecision({ samplingRate: 1.0, traceIdHex: traceId });
        assert.ok(included, `trace ${traceId} should be included at rate 1.0`);
    }
});

test('sampleDecision: rate 0.0 always excludes', (t) => {
    const traceIds = [
        '4bf92f3577b34da6a3ce929d0e0e4736',
        'ffffffffffffffffffffffffffffffff',
        '0000000000000000000000000000000000',
    ];

    for (const traceId of traceIds) {
        const included = sampleDecision({ samplingRate: 0.0, traceIdHex: traceId });
        assert.ok(!included, `trace ${traceId} should be excluded at rate 0.0`);
    }
});

test('sampleDecision: rate 0.5 produces roughly even split', (t) => {
    const traceIds = [];
    for (let i = 0; i < 1000; i++) {
        traceIds.push(i.toString().padStart(32, '0'));
    }

    const included = traceIds.filter(id =>
        sampleDecision({ samplingRate: 0.5, traceIdHex: id })
    );

    // With 1000 traces and rate 0.5, expect ~500. Allow 450–550 range.
    assert.ok(included.length > 450 && included.length < 550,
        `expected ~500 at 0.5 rate, got ${included.length}`);
});

test('sampleDecision: deterministic for same traceId', (t) => {
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';

    const result1 = sampleDecision({ samplingRate: 0.5, traceIdHex: traceId });
    const result2 = sampleDecision({ samplingRate: 0.5, traceIdHex: traceId });

    assert.equal(result1, result2, 'same traceId should produce same decision');
});

// ─────────────────────────────────────────────────────────────────────────────
// TESTS: buildSpanTree
// ─────────────────────────────────────────────────────────────────────────────

test('buildSpanTree: links parent-child relationships', (t) => {
    const spans = [
        { spanId: 'span1', parentSpanId: null },
        { spanId: 'span2', parentSpanId: 'span1' },
        { spanId: 'span3', parentSpanId: 'span1' },
        { spanId: 'span4', parentSpanId: 'span2' },
    ];

    const tree = buildSpanTree(spans);

    assert.ok(tree[null], 'should have root entry (null key)');
    assert.equal(tree[null].length, 1);
    assert.equal(tree[null][0].spanId, 'span1');

    assert.equal(tree.span1.length, 2, 'span1 should have 2 children');
    assert.equal(tree.span2.length, 1, 'span2 should have 1 child');
    assert.deepEqual(
        tree.span2[0].spanId,
        'span4',
        'span2 child should be span4'
    );
});

test('buildSpanTree: handles orphan spans (missing parent)', (t) => {
    const spans = [
        { spanId: 'span1', parentSpanId: null },
        { spanId: 'span2', parentSpanId: 'span_missing' }, // Parent not in batch
    ];

    const tree = buildSpanTree(spans);

    assert.ok(tree.span_missing, 'should create entry for missing parent');
    assert.equal(tree.span_missing[0].spanId, 'span2');
});

test('buildSpanTree: empty span list', (t) => {
    const tree = buildSpanTree([]);
    assert.equal(Object.keys(tree).length, 1); // Should have empty null entry
    assert.ok(Array.isArray(tree[null]));
    assert.equal(tree[null].length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// TESTS: assembleTraceSummary
// ─────────────────────────────────────────────────────────────────────────────

test('assembleTraceSummary: computes correct root, duration, and error count', (t) => {
    const spans = [
        {
            spanId: 'root',
            parentSpanId: null,
            serviceName: 'api',
            startTimeNs: 1000000000,
            endTimeNs: 2000000000, // 1s
            statusCode: 'OK',
        },
        {
            spanId: 'child1',
            parentSpanId: 'root',
            serviceName: 'api',
            startTimeNs: 1100000000,
            endTimeNs: 1500000000,
            statusCode: 'ERROR',
        },
        {
            spanId: 'child2',
            parentSpanId: 'root',
            serviceName: 'api',
            startTimeNs: 1600000000,
            endTimeNs: 1900000000,
            statusCode: 'OK',
        },
    ];

    const summary = assembleTraceSummary(spans);

    assert.equal(summary.rootSpan.spanId, 'root');
    assert.equal(summary.spanCount, 3);
    assert.equal(summary.errorCount, 1);
    assert.equal(summary.status, 'error');
    assert.equal(summary.durationMs, 1000, 'duration should be max(end) - min(start)');
});

test('assembleTraceSummary: empty spans list', (t) => {
    const summary = assembleTraceSummary([]);

    assert.equal(summary.spanCount, 0);
    assert.equal(summary.errorCount, 0);
    assert.equal(summary.status, 'unset');
    assert.equal(summary.durationMs, 0);
    assert.equal(summary.rootSpan, null);
});

test('assembleTraceSummary: single span', (t) => {
    const spans = [
        {
            spanId: 'only',
            parentSpanId: null,
            serviceName: 'test',
            startTimeNs: 5000000000,
            endTimeNs: 6000000000,
            statusCode: 'OK',
        },
    ];

    const summary = assembleTraceSummary(spans);

    assert.equal(summary.spanCount, 1);
    assert.equal(summary.rootSpan.spanId, 'only');
    assert.equal(summary.durationMs, 1000);
});

test('assembleTraceSummary: detects root span (no parent)', (t) => {
    const spans = [
        { spanId: 'not_root', parentSpanId: 'someone', startTimeNs: 1, endTimeNs: 2, statusCode: 'OK' },
        { spanId: 'root', parentSpanId: null, startTimeNs: 0, endTimeNs: 10, statusCode: 'OK' },
    ];

    const summary = assembleTraceSummary(spans);

    assert.equal(summary.rootSpan.spanId, 'root', 'should select span with no parent');
});

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION: parse + assemble realistic payload
// ─────────────────────────────────────────────────────────────────────────────

test('integration: parseOtlpRequest + assembleTraceSummary', (t) => {
    const payload = makeOtlpPayload();
    const spans = parseOtlpRequest(payload);

    // Convert parsed spans to format expected by assembleTraceSummary
    const formatted = spans.map(s => ({
        spanId: s.spanId,
        parentSpanId: s.parentSpanId,
        serviceName: s.serviceName,
        startTimeNs: s.startTimeNs,
        endTimeNs: s.endTimeNs,
        statusCode: s.statusCode,
    }));

    const summary = assembleTraceSummary(formatted);

    assert.equal(summary.spanCount, 3);
    assert.equal(summary.errorCount, 1, 'span3 has status ERROR');
    assert.equal(summary.status, 'error');
    assert.ok(summary.durationMs > 0);
    assert.equal(summary.rootSpan.spanId, '0af7651916cd43dd');
});

test('integration: parseOtlpRequest + buildSpanTree', (t) => {
    const payload = makeOtlpPayload();
    const parsed = parseOtlpRequest(payload);

    const tree = buildSpanTree(parsed);

    // Should have root span
    assert.equal(tree[null].length, 1);
    assert.equal(tree[null][0].spanId, '0af7651916cd43dd');

    // Root should have 2 children
    assert.equal(tree['0af7651916cd43dd'].length, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────

test('edge case: span with 0 duration', (t) => {
    const payload = {
        resourceSpans: [
            {
                resource: { attributes: { 'service.name': 'test' } },
                scopeSpans: [
                    {
                        spans: [
                            {
                                traceId: '12345678901234567890123456789012',
                                spanId: '1234567890123456',
                                startTimeUnixNano: '1000000000',
                                endTimeUnixNano: '1000000000', // Same as start
                                name: 'instant',
                            },
                        ],
                    },
                ],
            },
        ],
    };

    const spans = parseOtlpRequest(payload);
    assert.equal(spans.length, 1);
    assert.equal(spans[0].durationMs, 0);
});

test('edge case: very large span count', (t) => {
    const spans = [];
    for (let i = 0; i < 2500; i++) {
        spans.push({
            spanId: `span${i}`,
            parentSpanId: i > 0 ? `span${i - 1}` : null,
            startTimeNs: 1000000000 + i * 1000000,
            endTimeNs: 1000000000 + (i + 1) * 1000000,
            statusCode: 'OK',
        });
    }

    const summary = assembleTraceSummary(spans);

    assert.equal(summary.spanCount, 2500);
    assert.ok(summary.durationMs > 0);
});

test('edge case: attributes with null and edge values', (t) => {
    const payload = {
        resourceSpans: [
            {
                resource: { attributes: { 'service.name': 'test' } },
                scopeSpans: [
                    {
                        spans: [
                            {
                                traceId: '12345678901234567890123456789012',
                                spanId: '1234567890123456',
                                startTimeUnixNano: '1000000000',
                                endTimeUnixNano: '2000000000',
                                name: 'test',
                                attributes: {
                                    'null.attr': null,
                                    'zero': 0,
                                    'negative': -42,
                                    'empty.string': '',
                                    'false.bool': false,
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    };

    const spans = parseOtlpRequest(payload);
    assert.equal(spans.length, 1);
    assert.equal(spans[0].attributes['null.attr'], null);
    assert.equal(spans[0].attributes['zero'], 0);
    assert.equal(spans[0].attributes['negative'], -42);
    assert.equal(spans[0].attributes['false.bool'], false);
});

// ─────────────────────────────────────────────────────────────────────────────
// ASSERTION COUNTS
// ─────────────────────────────────────────────────────────────────────────────

// Total assertions: ~65 across 20 tests
// This covers the main parsing, sampling, tree-building, and summary logic.
