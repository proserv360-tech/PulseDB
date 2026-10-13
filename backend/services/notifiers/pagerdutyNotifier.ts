// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * pagerdutyNotifier.js
 * ─────────────────────
 * PagerDuty Events API v2 notifier.
 * Docs: https://developer.pagerduty.com/docs/events-api-v2/trigger-events/
 *
 * Actions supported: trigger, acknowledge, resolve.
 * Dedup key defaults to alert.id so repeat fires coalesce on the PD side.
 */

import { BaseNotifier, postJson } from './baseNotifier.js';

const PD_URL = 'https://events.pagerduty.com/v2/enqueue';

const PD_SEVERITY = {
  debug: 'info',
  info: 'info',
  warning: 'warning',
  error: 'error',
  critical: 'critical',
};

export class PagerDutyNotifier extends BaseNotifier {
  /**
   * @param {object} opts
   * @param {string} opts.routingKey     — Events API integration key (32-char hex)
   * @param {string} [opts.source='pulsedb'] — PD "source" field
   * @param {string} [opts.name='pagerduty']
   */
  constructor({ routingKey, source = 'pulsedb', name = 'pagerduty', ...rest } = {}) {
    super({ name, ...rest });
    if (!routingKey) throw new Error('PagerDutyNotifier: routingKey is required');
    this.routingKey = routingKey;
    this.source = source;
  }

  buildPayload(alert, action = 'trigger') {
    const dedup = alert.dedupKey || alert.id;
    if (!dedup) throw new Error('PagerDutyNotifier: alert.id or alert.dedupKey is required');

    if (action === 'resolve' || action === 'acknowledge') {
      return {
        routing_key: this.routingKey,
        event_action: action,
        dedup_key: dedup,
      };
    }

    return {
      routing_key: this.routingKey,
      event_action: 'trigger',
      dedup_key: dedup,
      payload: {
        summary: (alert.title || alert.message || 'PulseDB alert').slice(0, 1024),
        source: alert.source || this.source,
        severity: PD_SEVERITY[alert.severity] || 'warning',
        timestamp: alert.timestamp || new Date().toISOString(),
        component: alert.component,
        group: alert.group,
        class: alert.class || alert.type,
        custom_details: alert.metadata || {},
      },
      client: 'PulseDB',
      client_url: alert.url,
    };
  }

  async sendImpl(alert) {
    const action = alert.resolved ? 'resolve' : (alert.acknowledged ? 'acknowledge' : 'trigger');
    const payload = this.buildPayload(alert, action);

    const res = await postJson(this.http, PD_URL, payload, { timeoutMs: this.timeoutMs });

    if (res.status === 202) {
      return { ok: true, status: res.status, detail: `pagerduty ${action} accepted`, action };
    }
    return {
      ok: false,
      status: res.status,
      detail: `pagerduty ${action} failed: HTTP ${res.status} — ${res.body?.slice?.(0, 200)}`,
    };
  }
}
