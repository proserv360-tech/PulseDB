// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * teamsNotifier.js
 * ─────────────────
 * Microsoft Teams notifier using the MessageCard format.
 * Works with "Incoming Webhook" connectors that ship on every Teams channel.
 *
 * Docs: https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/
 *       how-to/connectors-using
 *
 * Note: Microsoft is migrating from MessageCard to Adaptive Cards via
 *       "Workflows" connectors. This notifier sends MessageCard because
 *       it is the format still accepted by the classic incoming-webhook
 *       endpoint today and is universally understood by Teams clients.
 */

import { BaseNotifier, postJson } from './baseNotifier.js';

const TEAMS_COLORS = {
  debug: '808080',
  info: '2E86C1',
  warning: 'F39C12',
  error: 'E67E22',
  critical: 'C0392B',
};

export class TeamsNotifier extends BaseNotifier {
  /**
   * @param {object} opts
   * @param {string} opts.webhookUrl   — the Teams channel incoming-webhook URL
   * @param {string} [opts.name='teams']
   */
  constructor({ webhookUrl, name = 'teams', ...rest } = {}) {
    super({ name, ...rest });
    if (!webhookUrl) throw new Error('TeamsNotifier: webhookUrl is required');
    this.webhookUrl = webhookUrl;
  }

  buildPayload(alert) {
    const themeColor = TEAMS_COLORS[alert.severity] || TEAMS_COLORS.warning;
    const facts = [];
    facts.push({ name: 'Severity', value: String(alert.severity || 'warning').toUpperCase() });
    if (alert.source) facts.push({ name: 'Source', value: alert.source });
    if (alert.component) facts.push({ name: 'Component', value: alert.component });
    if (alert.timestamp) facts.push({ name: 'Time', value: alert.timestamp });
    if (alert.metadata && typeof alert.metadata === 'object') {
      for (const [k, v] of Object.entries(alert.metadata)) {
        if (v === null || v === undefined) continue;
        facts.push({ name: k, value: String(v).slice(0, 200) });
      }
    }

    const card = {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      themeColor,
      summary: alert.title || alert.message || 'FATHOM alert',
      title: alert.title || 'FATHOM alert',
      sections: [
        {
          activityTitle: alert.title || 'FATHOM alert',
          activitySubtitle: alert.message || '',
          facts,
          markdown: true,
        },
      ],
    };

    if (alert.url) {
      card.potentialAction = [{
        '@type': 'OpenUri',
        name: 'Open in FATHOM',
        targets: [{ os: 'default', uri: alert.url }],
      }];
    }

    return card;
  }

  async sendImpl(alert) {
    const payload = this.buildPayload(alert);
    const res = await postJson(this.http, this.webhookUrl, payload, { timeoutMs: this.timeoutMs });
    // Teams returns either 200 with "1" (legacy) or 200 with body "1" / empty.
    if (res.status >= 200 && res.status < 300) {
      return { ok: true, status: res.status, detail: 'teams accepted' };
    }
    return {
      ok: false,
      status: res.status,
      detail: `teams failed: HTTP ${res.status} — ${res.body?.slice?.(0, 200)}`,
    };
  }
}
