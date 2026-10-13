/**
 * FATHOM SDK — Lightweight JavaScript SDK for observability
 * Zero dependencies, built-in batching, auto-capture for Express
 */

import { FathomTracer } from './core/tracer.js';
import { SpanBatcher } from './core/spanBatcher.js';

// SDK version — keep in sync with package.json. Used for OTLP resource attributes.
export const SDK_VERSION = '1.0.0';

// Default cap on queued events before oldest-drop kicks in. Prevents unbounded
// memory growth when the ingest endpoint is unreachable for a long time.
const DEFAULT_MAX_QUEUE_SIZE = 10000;

// Inline EventEmitter for Node.js compatibility
class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, listener) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(listener);
    return this;
  }

  emit(event, ...args) {
    if (!this.events[event]) return false;
    this.events[event].forEach(listener => listener(...args));
    return true;
  }

  off(event, listener) {
    if (!this.events[event]) return this;
    this.events[event] = this.events[event].filter(l => l !== listener);
    return this;
  }

  once(event, listener) {
    const wrapper = (...args) => {
      listener(...args);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  removeAllListeners(event) {
    if (event) delete this.events[event];
    else this.events = {};
    return this;
  }
}

/**
 * FathomSDK class — Main entry point for observability
 */
class FathomSDK extends EventEmitter {
  constructor(options = {}) {
    super();

    // Required options
    if (!options.apiKey) {
      throw new Error('[FATHOM SDK] apiKey is required (e.g., sk_live_xxx)');
    }
    if (!options.endpoint) {
      throw new Error('[FATHOM SDK] endpoint is required (e.g., https://fathom.example.com)');
    }

    // Configuration
    this.apiKey = options.apiKey;
    this.endpoint = options.endpoint.replace(/\/$/, ''); // Remove trailing slash
    this.environment = options.environment || 'production';
    this.appName = options.appName || 'unnamed-app';
    this.batchSize = options.batchSize || 50;
    this.flushInterval = options.flushInterval || 10000; // 10 seconds
    this.debug = options.debug || false;
    this.maxQueueSize = options.maxQueueSize || DEFAULT_MAX_QUEUE_SIZE;
    this.maxRetries = options.maxRetries ?? 3;

    // Internal state
    this.queue = [];
    this.flushTimer = null;
    this.isShuttingDown = false;
    this.isFlushing = false;
    this.sessionId = this._generateId();

    // Initialize tracing
    this.tracing = new FathomTracer(this);
    this.spanBatcher = new SpanBatcher(this, 100, this.flushInterval, this.maxQueueSize);
    this.tracing.registerBatcher(this.spanBatcher);
    this.spanBatcher.start();

    // Start the event flush timer automatically. The timer is unref'd so it
    // never keeps the process alive on its own.
    this.start();

    this._log('[SDK initialized]', {
      endpoint: this.endpoint,
      appName: this.appName,
      environment: this.environment,
    });
  }

  /**
   * Track an API call
   */
  trackAPI({ method, endpoint, statusCode, durationMs, metadata = {} }) {
    this._enqueue({
      type: 'api',
      title: `${method} ${endpoint}`,
      severity: statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warning' : 'info',
      metadata: {
        method,
        endpoint,
        statusCode,
        durationMs,
        ...metadata,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track an error
   */
  trackError({ error, title, severity = 'error', metadata = {} }) {
    // Extract error details if error is an Error object
    let errorDetails = {};
    if (error instanceof Error) {
      errorDetails = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
      title = title || error.message || 'Unknown Error';
    } else if (typeof error === 'string') {
      errorDetails = { message: error };
      title = title || error;
    } else if (error && typeof error === 'object') {
      errorDetails = error;
      title = title || JSON.stringify(error);
    }

    this._enqueue({
      type: 'error',
      title: title || 'Error',
      severity,
      metadata: {
        ...errorDetails,
        ...metadata,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track an audit event
   */
  trackAudit({ title, message, metadata = {}, severity = 'info' }) {
    this._enqueue({
      type: 'audit',
      title: title || 'Audit Event',
      severity,
      metadata: {
        message,
        ...metadata,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track a custom metric
   */
  trackMetric({ title, value, unit = '', metadata = {} }) {
    this._enqueue({
      type: 'metric',
      title: title || 'Metric',
      severity: 'info',
      metadata: {
        value,
        unit,
        ...metadata,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track a custom event
   */
  track(eventType, { title, severity = 'info', message, metadata = {}, tags = [] } = {}) {
    this._enqueue({
      type: eventType,
      title: title || 'Custom Event',
      severity,
      metadata: {
        message,
        tags,
        ...metadata,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Express middleware — auto-track all HTTP requests
   */
  expressMiddleware() {
    return (req, res, next) => {
      const start = Date.now();

      // Use the standard 'finish' event instead of monkey-patching res.end.
      // This is robust across Express 4/5 and streaming responses, and avoids
      // interfering with other middleware that also wraps res.end.
      res.once('finish', () => {
        const duration = Date.now() - start;
        const endpoint = req.originalUrl || req.url;

        this.trackAPI({
          method: req.method,
          endpoint,
          statusCode: res.statusCode,
          durationMs: duration,
          metadata: {
            userAgent: req.headers?.['user-agent'] || 'unknown',
            ip: req.ip || req.connection?.remoteAddress || 'unknown',
            contentLength: res.getHeader?.('content-length') || 0,
          },
        });
      });

      next();
    };
  }

  /**
   * Capture uncaught exceptions and unhandled rejections (Node.js only)
   */
  captureUncaughtExceptions() {
    if (typeof process === 'undefined' || !process.on) {
      this._log('[captureUncaughtExceptions] Not in Node.js environment, skipping');
      return;
    }

    process.on('uncaughtException', (err) => {
      this.trackError({
        error: err,
        severity: 'critical',
        title: 'Uncaught Exception',
        metadata: { type: 'uncaughtException' },
      });
      this.flush(); // Flush immediately for critical errors
    });

    process.on('unhandledRejection', (reason) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.trackError({
        error,
        severity: 'error',
        title: 'Unhandled Rejection',
        metadata: { type: 'unhandledRejection' },
      });
    });

    this._log('[SDK] Uncaught exception handlers installed');
  }

  /**
   * Internal: enqueue an event
   */
  _enqueue(event) {
    if (this.isShuttingDown) {
      this._log('[WARN] SDK is shutting down, event dropped:', event.type);
      return;
    }

    this.queue.push({
      ...event,
      sessionId: this.sessionId,
      appName: this.appName,
      environment: this.environment,
    });

    // Enforce the queue cap. Drop the oldest events so the most recent
    // (usually most relevant) ones survive an extended outage.
    if (this.queue.length > this.maxQueueSize) {
      const dropped = this.queue.splice(0, this.queue.length - this.maxQueueSize);
      this._log(`[WARN] Queue full, dropped ${dropped.length} oldest event(s)`);
      this.emit('dropped', { count: dropped.length, reason: 'queue_full' });
    }

    this._log(`[Queue] Event added (${this.queue.length}/${this.batchSize}):`, event.type);

    // Auto-flush if queue exceeds batchSize
    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Flush all queued events to FATHOM
   */
  async flush() {
    // Re-entrancy guard: a batchSize-overflow flush and a timer flush can fire
    // concurrently. Without this, both could splice the same queue.
    if (this.isFlushing) {
      this._log('[Flush] Already flushing, skipping concurrent call');
      return;
    }

    if (this.queue.length === 0) {
      this._log('[Flush] Queue is empty, nothing to send');
      return;
    }

    this.isFlushing = true;
    const batch = this.queue.splice(0, this.batchSize);
    this._log(`[Flush] Sending ${batch.length} events to FATHOM`);

    try {
      await this._sendWithRetry(batch);
      this._log(`[Flush] Success (${batch.length} events)`);
      this.emit('flush', { count: batch.length, timestamp: new Date() });
    } catch (error) {
      this._log('[ERROR] Flush failed after retries:', error.message);
      // Re-queue events at the front so ordering is preserved, then re-apply
      // the queue cap (oldest-drop) so a persistent outage can't grow memory.
      this.queue.unshift(...batch);
      if (this.queue.length > this.maxQueueSize) {
        const dropped = this.queue.splice(0, this.queue.length - this.maxQueueSize);
        this._log(`[WARN] Queue full after re-queue, dropped ${dropped.length} event(s)`);
        this.emit('dropped', { count: dropped.length, reason: 'queue_full' });
      }
      this.emit('error', { error, batch });
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Internal: POST a batch with exponential backoff + jitter.
   * Retries on network errors, 5xx, and 429. Does not retry other 4xx.
   */
  async _sendWithRetry(batch) {
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.endpoint}/api/sdk/ingest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-SDK-Key': this.apiKey,
          },
          body: JSON.stringify({ events: batch }),
        });

        if (response.ok) {
          return;
        }

        const errorText = await response.text();
        const status = response.status;
        const retryable = status >= 500 || status === 429;

        if (retryable && attempt < this.maxRetries) {
          lastError = new Error(`HTTP ${status}: ${errorText}`);
          await this._backoff(attempt);
          continue;
        }

        // Non-retryable (other 4xx) or out of attempts.
        throw new Error(`HTTP ${status}: ${errorText}`);
      } catch (error) {
        lastError = error;
        // fetch() rejects on network/transport errors — those are retryable.
        const isHttpError = /^HTTP \d/.test(error.message || '');
        if (!isHttpError && attempt < this.maxRetries) {
          await this._backoff(attempt);
          continue;
        }
        if (isHttpError) {
          // Already classified above (non-retryable or exhausted).
          throw error;
        }
      }
    }

    throw lastError || new Error('Flush failed: max retries exhausted');
  }

  /**
   * Internal: sleep for an exponentially-growing delay with jitter.
   * 200ms * 2^attempt + up to 10% jitter — matches the Python/Go transports.
   */
  _backoff(attempt) {
    const base = 200 * Math.pow(2, attempt);
    const jitter = Math.random() * base * 0.1;
    const delay = base + jitter;
    this._log(`[Flush] Retrying in ${Math.round(delay)}ms (attempt ${attempt + 1})`);
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Send a heartbeat to FATHOM
   */
  async heartbeat(status = 'healthy', metadata = {}) {
    this._log('[Heartbeat] Sending heartbeat:', status);

    try {
      const response = await fetch(`${this.endpoint}/api/sdk/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SDK-Key': this.apiKey,
        },
        body: JSON.stringify({
          status,
          sessionId: this.sessionId,
          appName: this.appName,
          environment: this.environment,
          queueSize: this.queue.length,
          timestamp: new Date().toISOString(),
          metadata,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      this._log('[Heartbeat] Success');
      this.emit('heartbeat', { status, timestamp: new Date() });
    } catch (error) {
      this._log('[WARN] Heartbeat failed:', error.message);
    }
  }

  /**
   * Start the auto-flush timer
   */
  start() {
    if (this.flushTimer) {
      this._log('[WARN] Auto-flush already running');
      return;
    }

    this.flushTimer = setInterval(() => {
      if (this.queue.length > 0) {
        this.flush();
      }
    }, this.flushInterval);

    this._log(`[Start] Auto-flush enabled (interval: ${this.flushInterval}ms)`);
  }

  /**
   * Stop the auto-flush timer and flush remaining events
   */
  async shutdown() {
    this._log('[Shutdown] Initiating SDK shutdown...');
    this.isShuttingDown = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush any remaining events
    if (this.queue.length > 0) {
      await this.flush();
    }

    // Flush any remaining spans
    await this.spanBatcher.shutdown();

    this._log('[Shutdown] Complete');
    this.emit('shutdown', { timestamp: new Date() });
  }

  /**
   * Internal: generate a unique ID
   */
  _generateId() {
    // Prefer crypto.randomUUID() (Node 16.7+/modern browsers) for collision
    // resistance; fall back to a timestamp + random string elsewhere.
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === 'function') {
      return `${Date.now()}-${c.randomUUID()}`;
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Internal: debug logging
   */
  _log(...args) {
    if (this.debug) {
      console.log('[FATHOM]', ...args);
    }
  }
}

export default FathomSDK;
export { FathomSDK };
