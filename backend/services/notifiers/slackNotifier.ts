// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * slackNotifier.js
 * ─────────────────
 * Multi-tenant Slack notifier that plugs into the NotifierManager fan-out.
 *
 * Supports two delivery modes, chosen by which credentials are supplied:
 *
 *   1) Bot token + channel ID  (preferred — allows threaded replies, updates)
 *      - auth:  `botToken` (xoxb-…), `channel` (Cxxxx)
 *      - API:   POST https://slack.com/api/chat.postMessage
 *
 *   2) Incoming webhook URL    (simplest — legacy / quick setup)
 *      - auth:  `webhookUrl` (https://hooks.slack.com/services/T…/B…/…)
 *      - API:   POST <webhookUrl>
 *
 * Both paths produce the same Block Kit payload so the end-user experience
 * is identical. Credentials are passed in per instance — this notifier holds
 * NO environment-level secrets, which is what makes it safe for multi-tenant
 * per-organization destinations.
 *
 * Return shape mirrors the other notifiers: { ok, status, detail, ... }.
 */

import { BaseNotifier, postJson } from './baseNotifier.js';
import { renderSlackBlocks as renderStructuredSlack } from '../alertFormatter.js';

const SLACK_CHAT_POST = 'https://slack.com/api/chat.postMessage';

const SEVERITY_COLOR = {
    debug:    '#9CA3AF',
    info:     '#38BDF8',
    warning:  '#F59E0B',
    error:    '#F97316',
    critical: '#EF4444',
    resolved: '#22C55E',
};

const SEVERITY_EMOJI = {
    debug:    ':grey_question:',
    info:     ':large_blue_circle:',
    warning:  ':large_yellow_circle:',
    error:    ':large_orange_circle:',
    critical: ':red_circle:',
    resolved: ':white_check_mark:',
};

/* ── Message template ─────────────────────────────────────────────────────────
 * The Block Kit payload is assembled from a template so the wording, which
 * fields appear, and the severity colours can be changed per destination
 * without editing this file. Set `template` in a destination's config JSON:
 *
 *   {
 *     "webhookUrl": "https://hooks.slack.com/services/…",
 *     "template": {
 *       "header":   "{emoji}  {brand} — {severity}",
 *       "brand":    "PulseDB",
 *       "fields":   ["component", "source", "id", "when"],
 *       "showMetadata": true,
 *       "colors":   { "critical": "#B91C1C" }
 *     }
 *   }
 *
 * Placeholders: {emoji} {brand} {severity} {title} {message} {component}
 *               {source} {id} {when} {category}
 * Anything omitted falls back to DEFAULT_TEMPLATE, so a partial override is
 * fine — you can change only the colour for critical and leave the rest.
 * ──────────────────────────────────────────────────────────────────────────── */

export const DEFAULT_TEMPLATE = {
    brand: 'PulseDB',
    header: '{emoji}  {brand} — {severity}',
    title: '*{title}*',
    fallback: '{emoji} {brand} {severity}: {title}',
    fields: ['component', 'source', 'id', 'when'],
    fieldLabels: {
        component: 'Component',
        source: 'Source',
        id: 'Alert ID',
        when: 'When',
        category: 'Category',
    },
    showMetadata: true,
    metadataLabel: 'Details',
    colors: {},
    emoji: {},
};


/**
 * Render alert metadata as readable Slack markup rather than a JSON dump.
 *
 * A code block of raw JSON is fine for a machine and poor for the person on
 * call at 3am. Scalars become `key: value` lines; an array of flat objects
 * becomes a short list. Anything genuinely nested still falls back to JSON,
 * capped, because a wrong-looking alert is better than a dropped one — Slack
 * rejects any block over 3000 characters.
 */
function renderMetadata(meta, { maxItems = 5, maxChars = 2600 } = {}) {
    const lines = [];

    for (const [key, value] of Object.entries(meta || {})) {
        if (key === 'rule') continue; // shown as a field already

        if (value === null || value === undefined) continue;

        if (Array.isArray(value)) {
            if (value.length === 0) continue;
            const shown = value.slice(0, maxItems);
            const flat = shown.every(
                (v) => v && typeof v === 'object' && !Array.isArray(v)
                    && Object.values(v).every((x) => x === null || typeof x !== 'object'),
            );
            if (flat) {
                lines.push(`*${key}*`);
                for (const item of shown) {
                    lines.push(
                        '  • ' + Object.entries(item)
                            .map(([k, v]) => `${k}: ${typeof v === 'number' ? formatNumber(v) : v}`)
                            .join(', '),
                    );
                }
                if (value.length > shown.length) lines.push(`  …and ${value.length - shown.length} more`);
            } else {
                lines.push(`*${key}*: ${value.length} item${value.length === 1 ? '' : 's'}`);
            }
            continue;
        }

        if (typeof value === 'object') {
            const inner = Object.entries(value)
                .filter(([, v]) => v !== null && typeof v !== 'object')
                .map(([k, v]) => `${k}: ${typeof v === 'number' ? formatNumber(v) : v}`);
            if (inner.length) lines.push(`*${key}*: ${inner.join(', ')}`);
            continue;
        }

        lines.push(`*${key}*: ${typeof value === 'number' ? formatNumber(value) : value}`);
    }

    const text = lines.join('\n');
    return text.length > maxChars ? text.slice(0, maxChars) + '\n…truncated' : text;
}

/** Keep long decimals out of alerts — 1000.00 reads worse than 1,000. */
function formatNumber(n) {
    if (!Number.isFinite(n)) return String(n);
    return Number.isInteger(n) ? n.toLocaleString('en-US') : Number(n.toFixed(2)).toLocaleString('en-US');
}

/** Substitute {placeholders}; an unknown or empty token renders as ''. */
function fill(tpl, vars) {
    return String(tpl).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

/**
 * Build the Block Kit payload common to both delivery modes.
 * Exported for testing.
 *
 * @param {object} alert
 * @param {object} [template] — partial override, merged over DEFAULT_TEMPLATE
 */
export function buildSlackBlocks(alert, template = {}) {
    const t = {
        ...DEFAULT_TEMPLATE,
        ...template,
        fieldLabels: { ...DEFAULT_TEMPLATE.fieldLabels, ...(template.fieldLabels || {}) },
        colors: { ...SEVERITY_COLOR, ...(template.colors || {}) },
        emoji: { ...SEVERITY_EMOJI, ...(template.emoji || {}) },
    };

    // ── Structured alerts render their own blocks ────────────────────────────
    // An alert carrying findings and fixes has a table in it. Dropping that
    // text into a plain `section` puts it in Slack's proportional font, where
    // the columns do not line up — it only looks aligned in a monospace
    // terminal. alertFormatter emits the same content inside code blocks, with
    // a column set that fits a phone.
    //
    // Colour still comes from this template so a destination can restyle.
    if (alert.structured) {
        const payload = renderStructuredSlack(alert.structured);
        const severityKey = alert.resolved ? 'resolved' : alert.severity || 'info';
        payload.attachments[0].color = t.colors[severityKey] || payload.attachments[0].color;

        // The legacy layout carried Alert ID and When in its fields block.
        // Those are the only handles back to the alerts table, so they move to
        // the context line rather than disappearing — small, at the bottom,
        // and out of the way of the tables.
        const blocks = payload.attachments[0].blocks;
        const context = blocks[blocks.length - 1];
        if (context?.type === 'context') {
            const trail = [
                alert.id ? `alert \`${alert.id}\`` : null,
                alert.timestamp ? new Date(alert.timestamp).toUTCString() : null,
            ].filter(Boolean).join(' · ');
            if (trail) context.elements[0].text += ` · ${trail}`;
        }
        return payload;
    }

    const severity = (alert.resolved ? 'resolved' : alert.severity || 'info');
    const emoji = t.emoji[severity] || ':bell:';
    const color = t.colors[severity] || '#6B7280';
    const title = alert.title || alert.message || `${t.brand} alert`;

    const vars = {
        emoji,
        brand: t.brand,
        severity: String(severity).toUpperCase(),
        title,
        message: alert.message || '',
        component: alert.component || '',
        source: alert.source || '',
        category: alert.category || '',
        id: alert.id || '',
        when: alert.timestamp ? new Date(alert.timestamp).toUTCString() : '',
    };

    const headerText = fill(t.header, vars);

    // Only fields named in the template, and only those with a value.
    const fields = [];
    for (const key of t.fields) {
        const value = vars[key];
        if (!value) continue;
        const label = t.fieldLabels[key] || key;
        const text = key === 'id' ? `*${label}*\n\`${value}\`` : `*${label}*\n${value}`;
        fields.push({ type: 'mrkdwn', text });
    }

    const attachmentBlocks = [
        { type: 'header', text: { type: 'plain_text', text: headerText, emoji: true } },
        { type: 'section', text: { type: 'mrkdwn', text: fill(t.title, vars) } },
    ];
    if (alert.message && alert.message !== title) {
        attachmentBlocks.push({ type: 'section', text: { type: 'mrkdwn', text: alert.message } });
    }
    if (fields.length) {
        attachmentBlocks.push({ type: 'section', fields });
    }
    if (t.showMetadata && alert.metadata && Object.keys(alert.metadata).length > 0) {
        const rendered = renderMetadata(alert.metadata);
        if (rendered) {
            attachmentBlocks.push({
                type: 'section',
                text: { type: 'mrkdwn', text: `*${t.metadataLabel}*\n${rendered}` },
            });
        }
    }
    const actionElements = [];
    if (alert.dashboardUrl) actionElements.push({
        type: 'button', text: { type: 'plain_text', text: 'Dashboard' }, url: alert.dashboardUrl,
    });
    if (alert.runbookUrl) actionElements.push({
        type: 'button', text: { type: 'plain_text', text: 'Runbook' }, url: alert.runbookUrl,
    });
    if (actionElements.length) {
        attachmentBlocks.push({ type: 'actions', elements: actionElements });
    }

    return {
        // Fallback for notifications where blocks aren't rendered.
        text: fill(t.fallback, vars),
        attachments: [{ color, blocks: attachmentBlocks }],
    };
}

export class SlackNotifier extends BaseNotifier {
    /**
     * @param {object} opts
     * @param {string} [opts.webhookUrl]  — Slack incoming webhook URL
     * @param {string} [opts.botToken]    — Slack bot OAuth token (xoxb-…)
     * @param {string} [opts.channel]     — Slack channel ID (required with botToken)
     * @param {string} [opts.name='slack']
     * @param {string} [opts.threadTs]    — optional thread ts to reply into
     */
    constructor({
        webhookUrl,
        botToken,
        channel,
        threadTs,
        template,
        name = 'slack',
        ...rest
    } = {}) {
        super({ name, ...rest });
        if (!webhookUrl && !(botToken && channel)) {
            throw new Error(
                'SlackNotifier: supply either webhookUrl OR (botToken + channel).'
            );
        }
        if (botToken && !String(botToken).startsWith('xox')) {
            throw new Error('SlackNotifier: botToken must look like a Slack OAuth token (xox…)');
        }
        this.webhookUrl = webhookUrl || null;
        this.botToken = botToken || null;
        this.channel = channel || null;
        this.threadTs = threadTs || null;
        // Partial override merged over DEFAULT_TEMPLATE at render time, so a
        // destination can restyle its messages without a code change.
        this.template = template || {};
    }

    buildPayload(alert) {
        return buildSlackBlocks(alert, this.template);
    }

    async sendImpl(alert) {
        const body = this.buildPayload(alert);

        // Bot API path — preferred when configured.
        if (this.botToken) {
            const payload = {
                channel: this.channel,
                text: body.text,
                attachments: body.attachments,
                ...(this.threadTs ? { thread_ts: this.threadTs } : {}),
            };
            const res = await postJson(
                this.http,
                SLACK_CHAT_POST,
                payload,
                {
                    headers: { Authorization: `Bearer ${this.botToken}` },
                    timeoutMs: this.timeoutMs,
                }
            );
            // Slack Bot API always returns 200 for both success and app-level error;
            // success is signalled by the JSON body's `ok: true` field.
            let parsed = null;
            try { parsed = JSON.parse(res.body || '{}'); } catch { parsed = null; }
            if (res.status === 200 && parsed?.ok) {
                return {
                    ok: true,
                    status: res.status,
                    detail: 'slack chat.postMessage accepted',
                    ts: parsed.ts || null,
                    channel: parsed.channel || null,
                };
            }
            // Surface Slack's error code (e.g. `channel_not_found`, `invalid_auth`).
            const errCode = parsed?.error || `http_${res.status}`;
            return {
                ok: false,
                status: res.status === 200 ? 400 : res.status,
                detail: `slack chat.postMessage failed: ${errCode}`,
                slackError: errCode,
            };
        }

        // Incoming-webhook path.
        const res = await postJson(
            this.http,
            this.webhookUrl,
            body,
            { timeoutMs: this.timeoutMs }
        );
        if (res.status >= 200 && res.status < 300) {
            return { ok: true, status: res.status, detail: 'slack webhook accepted' };
        }
        return {
            ok: false,
            status: res.status,
            detail: `slack webhook failed: HTTP ${res.status} — ${res.body?.slice?.(0, 200)}`,
        };
    }
}
