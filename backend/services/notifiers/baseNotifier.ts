// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * baseNotifier.js
 * ────────────────
 * Abstract base for all alert notifiers (PagerDuty, Opsgenie, Teams, webhook).
 *
 * Responsibilities:
 *   • Severity filter (minSeverity gate).
 *   • HTTP timeout via AbortController.
 *   • Injectable HttpFn seam so tests can stub transport without touching fetch.
 *   • Standard return shape { ok, status, detail } across all notifiers.
 *
 * Notifiers subclass this and implement `sendImpl(alert)`.
 */

export const SEVERITY_RANK = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3,
  critical: 4,
};

/**
 * Default HttpFn: a thin wrapper over fetch with timeout + JSON parsing.
 * Tests inject their own function with the same signature.
 *
 * @param {object} req
 * @param {string} req.url
 * @param {string} [req.method='POST']
 * @param {object} [req.headers]
 * @param {string|Buffer} [req.body]
 * @param {number} [req.timeoutMs=10000]
 * @returns {Promise<{status:number, headers:object, body:string}>}
 */
export async function defaultHttp({ url, method = 'POST', headers = {}, body, timeoutMs = 10000 }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method, headers, body, signal: ctrl.signal });
    const text = await res.text();
    const outHeaders = {};
    res.headers?.forEach?.((v, k) => { outHeaders[k] = v; });
    return { status: res.status, headers: outHeaders, body: text };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Post JSON body via the supplied http fn. Adds Content-Type.
 */
export async function postJson(http, url, payload, { headers = {}, timeoutMs = 10000 } = {}) {
  return http({
    url,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
    timeoutMs,
  });
}

export class BaseNotifier {
  /**
   * @param {object} opts
   * @param {string} opts.name                    — display name (e.g. 'pagerduty-primary')
   * @param {string} [opts.minSeverity='warning'] — drop alerts below this severity
   * @param {Function} [opts.http=defaultHttp]    — HttpFn seam for tests
   * @param {number} [opts.timeoutMs=10000]
   */
  constructor({ name, minSeverity = 'warning', http = defaultHttp, timeoutMs = 10000 } = {}) {
    if (!name) throw new Error('BaseNotifier: name is required');
    this.name = name;
    this.minSeverity = minSeverity;
    this.http = http;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Returns true if this alert passes the severity gate.
   */
  accepts(alert) {
    const a = SEVERITY_RANK[alert?.severity] ?? SEVERITY_RANK.info;
    const m = SEVERITY_RANK[this.minSeverity] ?? SEVERITY_RANK.warning;
    return a >= m;
  }

  /**
   * Top-level send; wraps sendImpl in an error shield so a single notifier
   * failure never takes down the NotifierManager fan-out.
   */
  async send(alert) {
    if (!this.accepts(alert)) {
      return { ok: true, status: 0, detail: 'skipped (severity below threshold)', skipped: true };
    }
    try {
      return await this.sendImpl(alert);
    } catch (err) {
      return { ok: false, status: 0, detail: err?.message || String(err), error: true };
    }
  }

  /**
   * Subclasses MUST override. Return { ok, status, detail }.
   */
  async sendImpl(_alert) {
    throw new Error(`${this.name}: sendImpl not implemented`);
  }
}
