// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/alertNotifiers.js
 * ──────────────────────────
 * Notifier adapters for Slack (incoming webhooks) and PagerDuty (Events API v2).
 *
 * Both notifiers are best-effort: they log and swallow errors rather than
 * propagating them into the alert pipeline, because a misconfigured webhook
 * should not silence the entire alert loop.
 */

// Node 18+ has global fetch; no extra dependency.

export async function notifySlack(webhookUrl, alert) {
    if (!webhookUrl) return { skipped: true };
    const payload = {
        text: `:rotating_light: *${alert.severity.toUpperCase()}* — ${alert.ruleName}`,
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*${alert.ruleName}* · _${alert.severity}_\n${alert.message}`,
                },
            },
            {
                type: 'section',
                fields: [
                    { type: 'mrkdwn', text: `*Value*\n${formatValue(alert.value)}` },
                    { type: 'mrkdwn', text: `*Expression*\n\`${alert.expression || '—'}\`` },
                    { type: 'mrkdwn', text: `*Connection*\n${alert.connectionName || alert.connectionId}` },
                    { type: 'mrkdwn', text: `*Workspace*\n${alert.workspaceSlug || alert.workspaceId}` },
                ],
            },
            ...(alert.runbookUrl ? [{
                type: 'actions',
                elements: [
                    { type: 'button', text: { type: 'plain_text', text: 'Runbook' }, url: alert.runbookUrl },
                    ...(alert.dashboardUrl ? [{ type: 'button',
                        text: { type: 'plain_text', text: 'Open dashboard' },
                        url: alert.dashboardUrl }] : []),
                ],
            }] : []),
        ],
    };
    try {
        const r = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!r.ok) return { ok: false, status: r.status };
        return { ok: true };
    } catch (err) {
        console.warn('[notifySlack] failed:', err.message);
        return { ok: false, error: err.message };
    }
}

export async function notifyPagerDuty(routingKey, alert) {
    if (!routingKey) return { skipped: true };
    const action = alert.resolved ? 'resolve' : 'trigger';
    const payload = {
        routing_key: routingKey,
        event_action: action,
        dedup_key: `fathom:${alert.ruleId}:${alert.connectionId}`,
        payload: {
            summary: `[FATHOM] ${alert.ruleName}: ${alert.message}`.slice(0, 1024),
            severity: mapSeverity(alert.severity),
            source: alert.connectionName || `connection:${alert.connectionId}`,
            component: alert.metric || 'database',
            custom_details: {
                expression: alert.expression,
                value: alert.value,
                workspace: alert.workspaceSlug || alert.workspaceId,
                connectionId: alert.connectionId,
            },
        },
        links: [
            ...(alert.dashboardUrl ? [{ href: alert.dashboardUrl, text: 'FATHOM dashboard' }] : []),
            ...(alert.runbookUrl ? [{ href: alert.runbookUrl, text: 'Runbook' }] : []),
        ],
    };
    try {
        const r = await fetch('https://events.pagerduty.com/v2/enqueue', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!r.ok) {
            const body = await r.text();
            return { ok: false, status: r.status, body };
        }
        return { ok: true };
    } catch (err) {
        console.warn('[notifyPagerDuty] failed:', err.message);
        return { ok: false, error: err.message };
    }
}

function mapSeverity(s) {
    switch ((s || '').toLowerCase()) {
        case 'critical': return 'critical';
        case 'error':    return 'error';
        case 'warning':  return 'warning';
        default:         return 'info';
    }
}

function formatValue(v) {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'number') {
        if (Number.isInteger(v)) return v.toString();
        return v.toFixed(3);
    }
    return String(v);
}
