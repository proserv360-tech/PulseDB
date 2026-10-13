/**
 * notifiers/index.js
 * ───────────────────
 * Barrel export for the notifier suite.
 *
 * Usage:
 *   import { NotifierManager, PagerDutyNotifier } from './notifiers/index.js';
 *   const mgr = new NotifierManager({ notifiers: [
 *     new PagerDutyNotifier({ routingKey: process.env.PD_KEY }),
 *   ]});
 *   await mgr.dispatch({ id: 'alert-1', severity: 'critical', title: 'DB down' });
 */

export { BaseNotifier, SEVERITY_RANK, defaultHttp, postJson } from './baseNotifier.js';
export { PagerDutyNotifier } from './pagerdutyNotifier.js';
export { OpsgenieNotifier } from './opsgenieNotifier.js';
export { TeamsNotifier } from './teamsNotifier.js';
export { WebhookNotifier, verifyWebhookSignature } from './webhookNotifier.js';
export { SlackNotifier, buildSlackBlocks } from './slackNotifier.js';
export { NotifierManager } from './notifierManager.js';
