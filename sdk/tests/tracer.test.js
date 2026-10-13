/**
 * Unit tests for FATHOM SDK Tracer
 * Run with: node --test tests/tracer.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { FathomTracer, Span } from '../src/core/tracer.js';
import { SpanBatcher } from '../src/core/spanBatcher.js';

test('Tracer: startSpan creates valid span', () => {
  const mockClient = { endpoint: 'https://fathom.app', appName: 'test', _log: () => {} };
  const tracer = new FathomTracer(mockClient);

  const span = tracer.startSpan('test-operation', {
    attributes: { 'user.id': 'u123' },
    kind: 'internal',
  });

  assert.ok(span.traceId);
  assert.ok(span.spanId);
  assert.equal(span.name, 'test-operation');
  assert.equal(span.kind, 'internal');
  assert.equal(span.attributes['user.id'], 'u123');
  assert.equal(span.status, 'UNSET');
  assert.equal(span.ended, false);
});

test('Tracer: setAttribute updates span attributes', () => {
  const mockClient = { endpoint: 'https://fathom.app', appName: 'test', _log: () => {} };
  const tracer = new FathomTracer(mockClient);
  const span = tracer.startSpan('op');

  span.setAttribute('http.status_code', 200);
  span.setAttribute('http.method', 'GET');

  assert.equal(span.attributes['http.status_code'], 200);
  assert.equal(span.attributes['http.method'], 'GET');
});

test('Tracer: recordException captures error details', () => {
  const mockClient = { endpoint: 'https://fathom.app', appName: 'test', _log: () => {} };
  const tracer = new FathomTracer(mockClient);
  const span = tracer.startSpan('op');

  const error = new Error('Test error');
  span.recordException(error);

  assert.equal(span.exceptions.length, 1);
  assert.equal(span.exceptions[0].type, 'Error');
  assert.match(span.exceptions[0].message, /Test error/);
  assert.ok(span.exceptions[0].stacktrace);
});

test('Tracer: end() sets endTimeUnixNano and status', () => {
  const mockClient = { endpoint: 'https://fathom.app', appName: 'test', _log: () => {} };
  const tracer = new FathomTracer(mockClient);
  const span = tracer.startSpan('op');

  assert.equal(span.endTimeUnixNano, null);
  assert.equal(span.ended, false);

  span.end({ status: 'error' });

  assert.ok(span.endTimeUnixNano);
  assert.equal(span.ended, true);
  assert.equal(span.status, 'ERROR');
});

test('Tracer: injectHeaders adds W3C traceparent', () => {
  const mockClient = { endpoint: 'https://fathom.app', appName: 'test', _log: () => {} };
  const tracer = new FathomTracer(mockClient);
  const span = tracer.startSpan('op');

  const headers = {};
  tracer.injectHeaders(headers, span);

  assert.ok(headers['traceparent']);
  assert.match(headers['traceparent'], /^00-[a-f0-9]+-[a-f0-9]+-01$/);

  const parts = headers['traceparent'].split('-');
  assert.equal(parts[0], '00');
  assert.equal(parts[1], span.traceId);
  assert.equal(parts[2], span.spanId);
  assert.equal(parts[3], '01');
});

test('Tracer: extractContext parses W3C traceparent', () => {
  const mockClient = { endpoint: 'https://fathom.app', appName: 'test', _log: () => {} };
  const tracer = new FathomTracer(mockClient);

  const headers = {
    traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
  };

  const ctx = tracer.extractContext(headers);

  assert.ok(ctx);
  assert.equal(ctx.traceId, '4bf92f3577b34da6a3ce929d0e0e4736');
  assert.equal(ctx.spanId, '00f067aa0ba902b7');
  assert.equal(ctx.flags, '01');
});

test('Tracer: extractContext returns null for missing traceparent', () => {
  const mockClient = { endpoint: 'https://fathom.app', appName: 'test', _log: () => {} };
  const tracer = new FathomTracer(mockClient);

  const ctx = tracer.extractContext({});

  assert.equal(ctx, null);
});

test('SpanBatcher: enqueue adds span to queue', () => {
  const mockClient = { endpoint: 'https://fathom.app', apiKey: 'test', appName: 'test', _log: () => {} };
  const batcher = new SpanBatcher(mockClient, 100, 1000);

  const span = new Span('trace1', 'span1', 'op1');
  batcher.enqueue(span);

  assert.equal(batcher.queue.length, 1);
  assert.equal(batcher.queue[0], span);
});

test('SpanBatcher: buildOtlpPayload creates valid OTLP structure', () => {
  const mockClient = { endpoint: 'https://fathom.app', apiKey: 'test', appName: 'my-app', _log: () => {} };
  const batcher = new SpanBatcher(mockClient, 100, 1000);

  const span = new Span('trace1', 'span1', 'test-op');
  span.setAttribute('user.id', 'u123');
  span.end({ status: 'ok' });

  const payload = batcher._buildOtlpPayload([span]);

  assert.ok(payload.resourceSpans);
  assert.equal(payload.resourceSpans.length, 1);
  assert.ok(payload.resourceSpans[0].resource);
  assert.ok(payload.resourceSpans[0].scopeSpans);
  assert.equal(payload.resourceSpans[0].scopeSpans[0].scope.name, '@fathom/sdk');
  assert.ok(payload.resourceSpans[0].scopeSpans[0].spans.length > 0);
});

console.log('✓ All tracer tests passed');
