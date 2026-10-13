// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * opsgenieNotifier.js
 * ────────────────────
 * Opsgenie "Create alert" API notifier.
 * Docs: https://docs.opsgenie.com/docs/alert-api
 *
 * Auth: GenieKey <api-key> via Authorization header.
 * Alias defaults to alert.id for dedupe.
 */

import { BaseNotifier, postJson } from './baseNotifier.js';

const OG_URL_BASE = 'https://api.opsgenie.com/v2/alerts';
const OG_EU_URL_BASE = 'https://api.eu.opsgenie.com/v2/alerts';

const OG_PRIORITY = {
  debug: 'P5',
  info: 'P4',
  warning: 'P3',
  error: 'P2',
  critical: 'P1',
};

export class OpsgenieNotifier extends BaseNotifier {
  /**
   * @param {object} opts
   * @param {string} opts.apiKey        — Opsgenie API integration key
   * @param {boolean} [opts.euRegion]   — true for EU Opsgenie tenants
   * @param {string}  [opts.source='pulsedb']
   * @param {string[]} [opts.responderTeams=[]] — list of team names
   * @param {string[]} [opts.tags=[]]
   * @param {string} [opts.name='opsgenie']
   */
  constructor({
    apiKey, euRegion = false, source = 'pulsedb',
    responderTeams = [], tags = [], name = 'opsgenie', ...rest
  } = {}) {
    super({ name, ...rest });
    if (!apiKey) throw new Error('OpsgenieNotifier: apiKey is required');
    this.apiKey = apiKey;
    this.urlBase = euRegion ? OG_EU_URL_BASE : OG_URL_BASE;
    this.source = source;
    this.responderTeams = responderTeams;
    this.tags = tags;
  }

  buildPayload(alert) {
    return {
      message: (alert.title || alert.message || 'PulseDB alert').slice(0, 130),
      alias: alert.dedupKey || alert.id,
      description: alert.message || alert.title || '',
      priority: OG_PRIORITY[alert.severity] || 'P3',
      source: alert.source || this.source,
      tags: [...this.tags, ...(alert.tags || [])],
      entity: alert.component,
      responders: this.responderTeams.map((team) => ({ name: team, type: 'team' })),
      details: alert.metadata || {},
    };
  }

  async sendImpl(alert) {
    // Resolved alerts: close the alert instead of creating a new one.
    if (alert.resolved) {
      return this.closeAlert(alert);
    }
    const payload = this.buildPayload(alert);
    const res = await postJson(this.http, this.urlBase, payload, {
      headers: { Authorization: `GenieKey ${this.apiKey}` },
      timeoutMs: this.timeoutMs,
    });
    // Opsgenie returns 202 with a requestId on success.
    if (res.status === 202) {
      return { ok: true, status: res.status, detail: 'opsgenie create accepted' };
    }
    return {
      ok: false,
      status: res.status,
      detail: `opsgenie create failed: HTTP ${res.status} — ${res.body?.slice?.(0, 200)}`,
    };
  }

  async closeAlert(alert) {
    const alias = encodeURIComponent(alert.dedupKey || alert.id);
    const url = `${this.urlBase}/${alias}/close?identifierType=alias`;
    const res = await postJson(this.http, url, { note: 'Resolved by PulseDB' }, {
      headers: { Authorization: `GenieKey ${this.apiKey}` },
      timeoutMs: this.timeoutMs,
    });
    if (res.status === 202) {
      return { ok: true, status: res.status, detail: 'opsgenie close accepted' };
    }
    return {
      ok: false,
      status: res.status,
      detail: `opsgenie close failed: HTTP ${res.status}`,
    };
  }
}
