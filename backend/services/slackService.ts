// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
// ==========================================================================
//  FATHOM — Slack Bot API Service (two-way sync)
//  Replaces the legacy incoming-webhook-only approach.
//
//  Required env vars:
//    SLACK_BOT_TOKEN      xoxb-… OAuth Bot Token (server-side only)
//    SLACK_SIGNING_SECRET From Basic Information page in api.slack.com/apps
//    SLACK_CHANNEL_ID     Target #alerts channel ID (e.g. C0123456789)
//
//  Fallback: if SLACK_BOT_TOKEN is absent but SLACK_WEBHOOK_URL is set,
//  sendSlackAlert() falls back to the legacy webhook for backwards compat.
// ==========================================================================

import crypto from 'crypto';

// ── Helpers ────────────────────────────────────────────────────────────────

const SEVERITY_COLOR = {
    critical: '#ff3b5c',
    warning:  '#ffaa00',
    info:     '#38bdf8',
    resolved: '#22d3a5',
};

const SEVERITY_EMOJI = {
    critical: ':red_circle:',
    warning:  ':large_yellow_circle:',
    info:     ':large_blue_circle:',
    resolved: ':white_check_mark:',
};

function botHeaders() {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    };
}

async function slackCall(method, body) {
    const res = await fetch(`https://slack.com/api/${method}`, {
        method:  'POST',
        headers: botHeaders(),
        body:    JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(`Slack ${method} failed: ${data.error}`);
    return data;
}

// ── Signature Verification ─────────────────────────────────────────────────

/**
 * Verify that an incoming request is genuinely from Slack.
 * Must be called BEFORE JSON parsing — req.rawBody must be set.
 *
 * In Express, add this middleware on Slack routes:
 *   app.use('/api/slack', express.raw({ type: 'application/json' }))
 * Then set req.rawBody = req.body.toString() before passing to JSON middleware.
 *
 * @param {object} req - Express request with headers and rawBody string
 * @returns {boolean}
 */
export function verifySlackSignature(req) {
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (!signingSecret) return false;

    const timestamp = req.headers['x-slack-request-timestamp'];
    const slackSig  = req.headers['x-slack-signature'];
    if (!timestamp || !slackSig) return false;

    // Reject requests older than 5 minutes (replay attack prevention)
    if (Math.floor(Date.now() / 1000) - parseInt(timestamp, 10) > 300) return false;

    const rawBody   = req.rawBody || JSON.stringify(req.body);
    const baseString = `v0:${timestamp}:${rawBody}`;
    const mySignature = 'v0=' + crypto
        .createHmac('sha256', signingSecret)
        .update(baseString)
        .digest('hex');

    try {
        return crypto.timingSafeEqual(
            Buffer.from(mySignature),
            Buffer.from(slackSig),
        );
    } catch {
        return false;
    }
}

// ── Core Bot API Functions ─────────────────────────────────────────────────

/**
 * Post a new alert to the #alerts Slack channel.
 * Returns the Slack message timestamp (ts) — store this on the alert
 * so you can update or thread-reply to it later.
 *
 * Falls back to legacy webhook if SLACK_BOT_TOKEN is not configured.
 *
 * @param {object} alert
 * @param {string} [webhookUrl] - Legacy fallback webhook URL
 * @returns {Promise<string|null>} Slack message ts, or null on fallback/skip
 */
export async function sendSlackAlert(alert, webhookUrl) {
    // ── Bot API path ────────────────────────────────────────────────────
    if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID) {
        const ts = await postAlertToSlack(alert);
        return ts;
    }

    // ── Legacy webhook fallback ─────────────────────────────────────────
    if (!webhookUrl) return null;

    // Structured alerts carry their own findings and fix tables — render those
    // rather than the generic dump. Falls through to the legacy layout for
    // every alert category that hasn't been migrated yet.
    if (alert.data?.structured) {
        const { renderSlackBlocks } = await import('./alertFormatter.js');
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(renderSlackBlocks(alert.data.structured)),
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Slack webhook failed: ${response.status} — ${text}`);
        }
        return null;
    }

    const emoji    = SEVERITY_EMOJI[alert.severity] || ':bell:';
    const color    = SEVERITY_COLOR[alert.severity] || '#6B7280';
    const severity = (alert.severity || 'info').toUpperCase();
    const time     = new Date(alert.timestamp || Date.now()).toUTCString();

    const payload = {
        text: `${emoji} *Fathom Alert — ${severity}*: ${alert.message}`,
        attachments: [{
            color,
            blocks: [
                { type: 'header', text: { type: 'plain_text', text: `${emoji}  Fathom Alert — ${severity}`, emoji: true } },
                { type: 'section', text: { type: 'mrkdwn', text: `*${alert.message}*` } },
                {
                    type: 'section',
                    fields: [
                        { type: 'mrkdwn', text: `*Category*\n${alert.category || 'general'}` },
                        { type: 'mrkdwn', text: `*Severity*\n${severity}` },
                        { type: 'mrkdwn', text: `*Time*\n${time}` },
                        { type: 'mrkdwn', text: `*Alert ID*\n${alert.id || 'N/A'}` },
                    ],
                },
                ...(alert.data && Object.keys(alert.data).length > 0
                    ? [{ type: 'section', text: { type: 'mrkdwn', text: `*Details*\n\`\`\`${JSON.stringify(alert.data, null, 2)}\`\`\`` } }]
                    : []),
                { type: 'context', elements: [{ type: 'mrkdwn', text: ':bar_chart: Sent by *Fathom* — PostgreSQL Monitoring Platform' }] },
            ],
        }],
    };

    const response = await fetch(webhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Slack webhook failed: ${response.status} — ${text}`);
    }
    return null;
}

/**
 * Post a new alert via Bot API (chat.postMessage).
 * Stores Source, Category, Rule, and Alert ID as attachment fields.
 *
 * @param {object} alert
 * @returns {Promise<string>} Slack message ts
 */
export async function postAlertToSlack(alert) {
    const emoji    = SEVERITY_EMOJI[alert.severity] || ':bell:';
    const color    = SEVERITY_COLOR[alert.severity] || '#888';
    const severity = (alert.severity || 'info').toUpperCase();

    // See sendSlackAlert: structured alerts render their own blocks.
    if (alert.data?.structured) {
        const { renderSlackBlocks } = await import('./alertFormatter.js');
        const posted = await slackCall('chat.postMessage', {
            channel: process.env.SLACK_CHANNEL_ID,
            ...renderSlackBlocks(alert.data.structured),
        });
        return posted.ts;
    }

    const data = await slackCall('chat.postMessage', {
        channel: process.env.SLACK_CHANNEL_ID,
        text:    `${emoji} [${severity}] ${alert.message}`,
        attachments: [{
            color,
            fields: [
                { title: 'Source',   value: alert.source   || alert.category || 'fathom', short: true },
                { title: 'Category', value: alert.category || 'general',                 short: true },
                { title: 'Rule',     value: alert.rule     || alert.id       || 'N/A',   short: true },
                { title: 'Alert ID', value: alert.id       || 'N/A',                     short: true },
            ],
            footer: `FATHOM · ${new Date(alert.timestamp || Date.now()).toLocaleString()}`,
        }],
    });

    // Return the ts so caller can persist it on the alert record
    return data.ts;
}

/**
 * Update the original Slack message when an alert is acknowledged or resolved.
 * Requires the slack_ts stored when the alert was first posted.
 *
 * @param {string} slackTs - The ts returned by postAlertToSlack
 * @param {object} alert   - The updated alert object
 */
export async function updateAlertMessage(slackTs, alert) {
    if (!slackTs || !process.env.SLACK_BOT_TOKEN) return;

    await slackCall('chat.update', {
        channel:     process.env.SLACK_CHANNEL_ID,
        ts:          slackTs,
        text:        `:white_check_mark: RESOLVED: ${alert.message}`,
        attachments: [{
            color: SEVERITY_COLOR.resolved,
            text:  `Acknowledged by ${alert.acknowledged_by || 'unknown'}`,
        }],
    });
}

/**
 * Mirror a FATHOM comment to the corresponding Slack thread.
 *
 * @param {string} slackTs  - The ts of the parent alert message
 * @param {object} comment  - { author, text }
 */
export async function postThreadComment(slackTs, comment) {
    if (!slackTs || !process.env.SLACK_BOT_TOKEN) return;

    await slackCall('chat.postMessage', {
        channel:   process.env.SLACK_CHANNEL_ID,
        thread_ts: slackTs,
        text:      `*${comment.author}*: ${comment.text}`,
    });
}

/**
 * Resolve a Slack user ID to a display name using the users:read scope.
 *
 * @param {string} userId - Slack user ID (e.g. U0123456)
 * @returns {Promise<string>} Display name, or userId as fallback
 */
export async function resolveSlackUser(userId) {
    if (!process.env.SLACK_BOT_TOKEN) return userId;
    try {
        const res = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
            headers: botHeaders(),
        });
        const data = await res.json();
        return data.user?.real_name || userId;
    } catch {
        return userId;
    }
}

/**
 * Send a plain text message (useful for test pings or digests).
 * Uses Bot API if token is available, otherwise falls back to webhook.
 *
 * @param {string} message
 * @param {string} [webhookUrl] - Legacy fallback
 */
export async function sendSlackMessage(message, webhookUrl) {
    if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID) {
        await slackCall('chat.postMessage', {
            channel: process.env.SLACK_CHANNEL_ID,
            text:    message,
        });
        return;
    }

    if (!webhookUrl) return;
    const response = await fetch(webhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: message }),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Slack webhook failed: ${response.status} — ${text}`);
    }
}
