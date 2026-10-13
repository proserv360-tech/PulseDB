// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * webhookNotifier.js
 * ────────────────────
 * Generic signed-webhook notifier. Posts JSON to the configured URL with an
 * HMAC-SHA256 signature header so the receiver can verify both origin and
 * integrity.
 *
 * Signature format:
 *   X-FATHOM-Signature: t=<unix-seconds>,v1=<hex(hmac-sha256(secret, t + '.' + body))>
 *
 * This matches the widely-adopted "Stripe-style" signing convention, chosen
 * for familiarity. The timestamp prevents replay; receivers reject signatures
 * older than `toleranceSeconds`.
 *
 * Exports also include `verifyWebhookSignature` for the receiver half.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { BaseNotifier, postJson } from './baseNotifier.js';

function computeSignature(secret, timestamp, body) {
  const payload = `${timestamp}.${body}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export class WebhookNotifier extends BaseNotifier {
  /**
   * @param {object} opts
   * @param {string} opts.url            — destination URL
   * @param {string} opts.secret         — HMAC signing secret
   * @param {object} [opts.extraHeaders] — additional static headers
   * @param {string} [opts.name='webhook']
   */
  constructor({ url, secret, extraHeaders = {}, name = 'webhook', ...rest } = {}) {
    super({ name, ...rest });
    if (!url) throw new Error('WebhookNotifier: url is required');
    if (!secret) throw new Error('WebhookNotifier: secret is required');
    this.url = url;
    this.secret = secret;
    this.extraHeaders = extraHeaders;
  }

  buildPayload(alert) {
    return {
      id: alert.id,
      title: alert.title,
      severity: alert.severity,
      source: alert.source,
      component: alert.component,
      message: alert.message,
      metadata: alert.metadata || {},
      timestamp: alert.timestamp || new Date().toISOString(),
      resolved: !!alert.resolved,
    };
  }

  async sendImpl(alert) {
    const body = JSON.stringify(this.buildPayload(alert));
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = computeSignature(this.secret, ts, body);
    const res = await this.http({
      url: this.url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'FATHOM/1.0',
        'X-FATHOM-Signature': `t=${ts},v1=${sig}`,
        ...this.extraHeaders,
      },
      body,
      timeoutMs: this.timeoutMs,
    });
    if (res.status >= 200 && res.status < 300) {
      return { ok: true, status: res.status, detail: 'webhook accepted' };
    }
    return {
      ok: false,
      status: res.status,
      detail: `webhook failed: HTTP ${res.status} — ${res.body?.slice?.(0, 200)}`,
    };
  }
}

/**
 * Receiver-side verifier. Pass the raw request body as a string, the value of
 * the X-FATHOM-Signature header, and the shared secret. Returns true iff the
 * signature is valid AND the timestamp is within tolerance.
 *
 * @param {object} params
 * @param {string} params.rawBody
 * @param {string} params.header               — value of X-FATHOM-Signature
 * @param {string} params.secret
 * @param {number} [params.toleranceSeconds=300]
 * @param {number} [params.nowSeconds]         — injectable clock (tests)
 */
export function verifyWebhookSignature({
  rawBody, header, secret, toleranceSeconds = 300, nowSeconds = Math.floor(Date.now() / 1000),
}) {
  if (!header || typeof header !== 'string') return false;
  const parts = Object.fromEntries(
    header.split(',').map((kv) => kv.split('=')).filter((p) => p.length === 2)
  );
  const ts = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(ts) || !v1) return false;
  if (Math.abs(nowSeconds - ts) > toleranceSeconds) return false;

  const expected = computeSignature(secret, String(ts), rawBody);
  if (expected.length !== v1.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'));
  } catch {
    return false;
  }
}
