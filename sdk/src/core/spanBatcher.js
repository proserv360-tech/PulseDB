/**
 * Span Batcher for OTLP/HTTP ingest
 * Collects spans and flushes to /api/otlp/v1/traces
 */

// SDK version reported in OTLP resource/scope attributes. Kept in sync with
// SDK_VERSION in index.js and the package.json version.
const SDK_VERSION = '1.0.0';

const DEFAULT_MAX_SPAN_QUEUE_SIZE = 10000;

class SpanBatcher {
  constructor(client, batchSize = 100, flushIntervalMs = 10000, maxQueueSize = DEFAULT_MAX_SPAN_QUEUE_SIZE) {
    this.client = client;
    this.batchSize = batchSize;
    this.flushIntervalMs = flushIntervalMs;
    this.maxQueueSize = maxQueueSize || DEFAULT_MAX_SPAN_QUEUE_SIZE;
    this.queue = [];
    this.flushTimer = null;
    this.isShuttingDown = false;
    this.isFlushing = false;
  }

  /**
   * Add a span to the queue
   */
  enqueue(span) {
    if (this.isShuttingDown) {
      return;
    }

    this.queue.push(span);

    // Enforce the cap with oldest-drop to avoid unbounded growth during outages.
    if (this.queue.length > this.maxQueueSize) {
      const dropped = this.queue.splice(0, this.queue.length - this.maxQueueSize);
      this.client._log(`[WARN] Span queue full, dropped ${dropped.length} oldest span(s)`);
    }

    // Auto-flush if queue exceeds batchSize
    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Start background flush timer
   */
  start() {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setInterval(() => {
      if (this.queue.length > 0) {
        this.flush();
      }
    }, this.flushIntervalMs);
    // Don't keep the event loop alive solely for the flush timer —
    // callers that want the process to linger should use sdk.start()
    // + sdk.shutdown() explicitly. Mirrors the event batcher's behavior.
    if (typeof this.flushTimer?.unref === 'function') {
      this.flushTimer.unref();
    }
  }

  /**
   * Stop background flush timer
   */
  stop() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Flush all queued spans to OTLP endpoint
   */
  async flush() {
    // Re-entrancy guard: overflow + timer flushes can race on the same queue.
    if (this.isFlushing) {
      return;
    }

    if (this.queue.length === 0) {
      return;
    }

    this.isFlushing = true;
    const batch = this.queue.splice(0, this.batchSize);
    const payload = this._buildOtlpPayload(batch);

    try {
      const response = await fetch(`${this.client.endpoint}/api/otlp/v1/traces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SDK-Key': this.client.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }

      this.client._log(`[Span Flush] Success (${batch.length} spans)`);
    } catch (error) {
      this.client._log('[ERROR] Span flush failed:', error.message);
      // Re-queue spans on failure, then re-apply the cap (oldest-drop).
      this.queue.unshift(...batch);
      if (this.queue.length > this.maxQueueSize) {
        const dropped = this.queue.splice(0, this.queue.length - this.maxQueueSize);
        this.client._log(`[WARN] Span queue full after re-queue, dropped ${dropped.length} span(s)`);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Build OTLP/HTTP payload from spans
   */
  _buildOtlpPayload(spans) {
    const otlpSpans = spans.map(s => s.toOtlpSpan());

    return {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: this.client.appName } },
              { key: 'service.version', value: { stringValue: SDK_VERSION } },
            ],
          },
          scopeSpans: [
            {
              scope: {
                name: '@fathom/sdk',
                version: SDK_VERSION,
              },
              spans: otlpSpans,
            },
          ],
        },
      ],
    };
  }

  /**
   * Shutdown: flush remaining and stop timer
   */
  async shutdown() {
    this.isShuttingDown = true;
    this.stop();
    if (this.queue.length > 0) {
      await this.flush();
    }
  }
}

export { SpanBatcher };
