/**
 * FATHOM SDK — Distributed Tracing (OTLP/HTTP)
 * Zero dependencies, context propagation, W3C traceparent support
 */

import { randomBytes } from 'crypto';

/**
 * Active span context using async local storage (emulated with WeakMap for Node.js)
 * In real production, use AsyncLocalStorage for full context isolation.
 */
class AsyncContextManager {
  constructor() {
    this.context = null;
  }

  set(span) {
    this.context = span;
  }

  get() {
    return this.context;
  }

  clear() {
    this.context = null;
  }
}

const asyncContext = new AsyncContextManager();

/**
 * Represents a single span in a trace
 */
class Span {
  constructor(traceId, spanId, name, kind = 'internal', parentSpanId = null) {
    this.traceId = traceId;
    this.spanId = spanId;
    this.parentSpanId = parentSpanId;
    this.name = name;
    this.kind = kind;
    this.attributes = {};
    this.exceptions = [];
    this.startTimeUnixNano = BigInt(Date.now()) * BigInt(1_000_000);
    this.endTimeUnixNano = null;
    this.status = 'UNSET';
    this.ended = false;
  }

  /**
   * Set a span attribute
   */
  setAttribute(key, value) {
    if (!this.ended) {
      this.attributes[key] = value;
    }
  }

  /**
   * Record an exception
   */
  recordException(error) {
    if (!this.ended) {
      const exc = {
        type: error.name || 'Error',
        message: error.message || String(error),
        stacktrace: error.stack || '',
      };
      this.exceptions.push(exc);
    }
  }

  /**
   * End the span with optional status
   */
  end(opts = {}) {
    if (this.ended) return;
    this.ended = true;
    this.endTimeUnixNano = BigInt(Date.now()) * BigInt(1_000_000);
    if (opts.status) {
      this.status = opts.status.toUpperCase() === 'ERROR' ? 'ERROR' : 'OK';
    }
  }

  /**
   * Convert span to OTLP format
   */
  toOtlpSpan() {
    const attributes = Object.entries(this.attributes).map(([key, value]) => ({
      key,
      value: this._attributeValue(value),
    }));

    // Add exception attributes if any
    if (this.exceptions.length > 0) {
      const exc = this.exceptions[0]; // Record first exception
      attributes.push({ key: 'exception.type', value: { stringValue: exc.type } });
      attributes.push({ key: 'exception.message', value: { stringValue: exc.message } });
      if (exc.stacktrace) {
        attributes.push({ key: 'exception.stacktrace', value: { stringValue: exc.stacktrace } });
      }
    }

    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId || undefined,
      name: this.name,
      kind: this._kindToOtlp(this.kind),
      startTimeUnixNano: this.startTimeUnixNano.toString(),
      endTimeUnixNano: this.endTimeUnixNano ? this.endTimeUnixNano.toString() : undefined,
      attributes: attributes.length > 0 ? attributes : undefined,
      status: {
        code: this.status === 'ERROR' ? 2 : this.status === 'OK' ? 1 : 0,
        message: this.status === 'ERROR' ? 'Error' : '',
      },
    };
  }

  /**
   * Convert attribute value to OTLP format
   */
  _attributeValue(value) {
    if (typeof value === 'string') {
      return { stringValue: value };
    }
    if (typeof value === 'number') {
      return Number.isInteger(value)
        ? { intValue: String(value) }
        : { doubleValue: value };
    }
    if (typeof value === 'boolean') {
      return { boolValue: value };
    }
    return { stringValue: String(value) };
  }

  /**
   * Convert span kind to OTLP format
   */
  _kindToOtlp(kind) {
    const kindMap = {
      internal: 1,
      server: 2,
      client: 3,
      producer: 4,
      consumer: 5,
    };
    return kindMap[kind] || 1;
  }
}

/**
 * FathomTracer — Main tracer interface
 */
class FathomTracer {
  constructor(client) {
    this.client = client;
    this.spanBatcher = null;
  }

  /**
   * Start a new span (with automatic parent context detection)
   */
  startSpan(name, options = {}) {
    const { attributes = {}, kind = 'internal' } = options;

    // Generate IDs (16 bytes for traceId, 8 bytes for spanId)
    const traceId = randomBytes(16).toString('hex');
    const spanId = randomBytes(8).toString('hex');

    // Detect parent span from context
    const parentSpan = asyncContext.get();
    const parentSpanId = parentSpan ? parentSpan.spanId : null;

    // Create span
    const span = new Span(traceId, spanId, name, kind, parentSpanId);
    for (const [key, value] of Object.entries(attributes)) {
      span.setAttribute(key, value);
    }

    return span;
  }

  /**
   * Execute callback with span as active context
   */
  async withSpan(span, callback) {
    const prevSpan = asyncContext.get();
    asyncContext.set(span);
    try {
      return await callback();
    } finally {
      asyncContext.set(prevSpan);
      span.end();
    }
  }

  /**
   * Inject W3C traceparent header into headers object
   */
  injectHeaders(headers, span) {
    if (!span) {
      return; // No active span to inject
    }
    // Format: 00-<trace>-<span>-01
    const traceparent = `00-${span.traceId}-${span.spanId}-01`;
    headers['traceparent'] = traceparent;
  }

  /**
   * Extract trace context from W3C traceparent header
   */
  extractContext(headers) {
    const traceparent = headers['traceparent'] || headers['Traceparent'];
    if (!traceparent) {
      return null;
    }

    const parts = traceparent.split('-');
    if (parts.length !== 4 || parts[0] !== '00') {
      return null;
    }

    return {
      traceId: parts[1],
      spanId: parts[2],
      flags: parts[3],
    };
  }

  /**
   * Register span batcher (called by client)
   */
  registerBatcher(batcher) {
    this.spanBatcher = batcher;
  }

  /**
   * Flush all pending spans
   */
  async flush() {
    if (this.spanBatcher) {
      return this.spanBatcher.flush();
    }
  }
}

export { FathomTracer, Span, AsyncContextManager };
