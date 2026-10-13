// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * notifierManager.js
 * ───────────────────
 * Orchestrates fan-out to N notifiers per alert.
 *
 * Features:
 *   • Parallel delivery (Promise.all) across all registered notifiers.
 *   • Per-alert-id dedupe window — repeat fires within `dedupeWindowMs` are
 *     coalesced to a single downstream delivery per notifier.
 *   • Exponential-backoff retry for transient failures.
 *   • Severity filtering honoured per-notifier (via BaseNotifier.accepts).
 *   • Injectable clock/sleep for deterministic tests.
 *
 * Intentionally stateful (holds the dedupe map in memory). For HA, swap the
 * dedupeMap for a Redis-backed store.
 */

const DEFAULT_DEDUPE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_BACKOFF_MS = 300;

function isRetryable(status) {
  // 0 = network error (abort/DNS/etc.); 408, 429, 5xx are retryable.
  return status === 0 || status === 408 || status === 429 || (status >= 500 && status < 600);
}

export class NotifierManager {
  constructor({
    notifiers = [],
    dedupeWindowMs = DEFAULT_DEDUPE_WINDOW_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    baseBackoffMs = DEFAULT_BASE_BACKOFF_MS,
    now = () => Date.now(),
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    onDelivery = null, // optional hook: (alert, notifier, result) => void
  } = {}) {
    this.notifiers = notifiers.slice();
    this.dedupeWindowMs = dedupeWindowMs;
    this.maxRetries = maxRetries;
    this.baseBackoffMs = baseBackoffMs;
    this.now = now;
    this.sleep = sleep;
    this.onDelivery = onDelivery;
    // Map<`${notifierName}:${alertId}`, lastFiredTs>
    this.dedupe = new Map();
  }

  add(notifier) {
    this.notifiers.push(notifier);
  }

  remove(name) {
    this.notifiers = this.notifiers.filter((n) => n.name !== name);
  }

  /**
   * Clear dedupe entries older than 2× the window to keep memory bounded.
   */
  _gcDedupe() {
    const cutoff = this.now() - 2 * this.dedupeWindowMs;
    for (const [k, ts] of this.dedupe) {
      if (ts < cutoff) this.dedupe.delete(k);
    }
  }

  _dedupeKey(notifierName, alert) {
    return `${notifierName}:${alert.dedupKey || alert.id}`;
  }

  _shouldFire(notifierName, alert) {
    if (!alert.id && !alert.dedupKey) return true; // no id → can't dedupe, always fire
    const key = this._dedupeKey(notifierName, alert);
    const last = this.dedupe.get(key);
    const now = this.now();
    if (last !== undefined && now - last < this.dedupeWindowMs) return false;
    this.dedupe.set(key, now);
    return true;
  }

  async _sendWithRetry(notifier, alert) {
    let attempt = 0;
    let lastResult = null;
    while (attempt <= this.maxRetries) {
      const result = await notifier.send(alert);
      lastResult = result;
      if (result.ok || result.skipped || !isRetryable(result.status)) return result;
      attempt += 1;
      if (attempt > this.maxRetries) break;
      const backoff = this.baseBackoffMs * Math.pow(2, attempt - 1);
      await this.sleep(backoff);
    }
    return { ...lastResult, attempts: attempt + 1 };
  }

  /**
   * Send `alert` to all registered notifiers in parallel.
   * Returns an array of { notifier, result } objects — one per notifier.
   * Never throws; individual failures are captured in result.ok/result.detail.
   */
  async dispatch(alert) {
    this._gcDedupe();

    const jobs = this.notifiers.map(async (notifier) => {
      if (!this._shouldFire(notifier.name, alert)) {
        const result = { ok: true, status: 0, detail: 'deduped', deduped: true };
        this.onDelivery?.(alert, notifier, result);
        return { notifier: notifier.name, result };
      }
      const result = await this._sendWithRetry(notifier, alert);
      this.onDelivery?.(alert, notifier, result);
      return { notifier: notifier.name, result };
    });

    return Promise.all(jobs);
  }

  /**
   * Force-reset dedupe — useful when administrators want a repeated page now.
   */
  clearDedupe(alertId = null) {
    if (alertId === null) {
      this.dedupe.clear();
      return;
    }
    for (const key of this.dedupe.keys()) {
      if (key.endsWith(`:${alertId}`)) this.dedupe.delete(key);
    }
  }
}
