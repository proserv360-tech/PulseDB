/**
 * services/alertFormatter.ts
 * ─────────────────────────
 * Turns an alert from one line of prose into something a DBA can act on
 * without opening the dashboard.
 *
 * The old shape was `"3 table(s) overdue for VACUUM — worst: public.orders
 * (34% dead)"`. That tells you something is wrong and nothing about what to do,
 * and the other two tables are invisible. This module builds a structured alert
 * instead: a title, a table of every affected object, a table of suggested
 * fixes, and an incident number to refer to it by.
 *
 * ── Deliberately not tied to bloat ──────────────────────────────────────────
 * `findings` is just rows plus column definitions. Bloat is the first adopter;
 * a lock-contention or replication-lag alert fills in the same structure with
 * different columns and gets the same rendering for free. The only thing a new
 * category has to supply is a builder that produces { columns, rows, suggestions }.
 *
 * ── Rendering ───────────────────────────────────────────────────────────────
 * Slack has no table primitive. Every real option is a compromise:
 *   - `fields` blocks wrap unpredictably and cap at 10
 *   - one section per row is accurate but unreadable past three rows
 *   - a monospace code block is what every ops tool actually ships
 * We use the code block, and cap the row count so a 200-table finding doesn't
 * produce a message Slack truncates mid-row.
 */

// Slack rejects messages over 3000 chars in a single text block. Rows are
// capped well below that so the truncation notice itself always fits.
const MAX_TABLE_ROWS = 12;
const MAX_SUGGESTIONS = 8;

const SEVERITY_RANK = { info: 0, warning: 1, critical: 2 };

/**
 * @typedef {object} Column
 * @property {string} key    — property name on each row
 * @property {string} label  — header text
 * @property {'left'|'right'} [align] — numbers right-align, names left
 */

/**
 * Build the structured alert. Pure — no I/O, no clock beyond `now`, so it can
 * be asserted on directly.
 *
 * @param {object} spec
 * @param {string} spec.title       — one line, no severity prefix (added at render)
 * @param {'info'|'warning'|'critical'} spec.severity
 * @param {string} spec.category
 * @param {Column[]} spec.columns
 * @param {object[]} spec.rows      — the affected objects
 * @param {Array<{action: string, target?: string, detail?: string, sql?: string}>} [spec.suggestions]
 * @param {string} [spec.incidentId]
 * @param {string} [spec.summary]   — optional sentence between title and table
 */
export function buildStructuredAlert({
    title,
    severity = 'warning',
    category = 'general',
    columns = [],
    rows = [],
    suggestions = [],
    incidentId = null,
    summary = null,
    connectionId = null,
    database = null,
} = {}) {
    if (!title) throw new Error('title is required');

    const shown = rows.slice(0, MAX_TABLE_ROWS);
    return {
        title,
        severity,
        category,
        summary,
        incidentId,
        connectionId,
        database,
        columns,
        rows: shown,
        // Report the true total, not the shown count. An alert that says
        // "12 tables" when there are 97 is worse than no number.
        totalRows: rows.length,
        truncated: rows.length > shown.length,
        suggestions: suggestions.slice(0, MAX_SUGGESTIONS),
    };
}

/**
 * Render rows as a fixed-width text table. Widths come from the content, so a
 * table of short names doesn't get padded out to nothing.
 */
export function renderTextTable(columns, rows) {
    if (!columns.length || !rows.length) return '';

    const cell = (row, col) => {
        const v = row[col.key];
        if (v === null || v === undefined) return '—';
        return String(v);
    };

    const widths = columns.map((col) =>
        Math.max(col.label.length, ...rows.map((r) => cell(r, col).length)),
    );

    const pad = (text, width, align) =>
        align === 'right' ? text.padStart(width) : text.padEnd(width);

    const header = columns.map((c, i) => pad(c.label, widths[i], c.align)).join('  ');
    const rule = widths.map((w) => '─'.repeat(w)).join('  ');
    const body = rows.map((r) =>
        columns.map((c, i) => pad(cell(r, c), widths[i], c.align)).join('  '),
    );

    return [header, rule, ...body].join('\n');
}

/**
 * Plain-text rendering — email fallback, logs, and the `text` field Slack uses
 * for notifications and screen readers.
 */
export function renderPlainText(alert) {
    const parts = [];
    const sev = String(alert.severity || 'info').toUpperCase();

    parts.push(`[${sev}] ${alert.title}`);
    if (alert.incidentId) parts.push(`Incident: ${alert.incidentId}`);
    if (alert.summary) parts.push('', alert.summary);

    if (alert.rows?.length) {
        parts.push('', renderTextTable(alert.columns, alert.rows));
        if (alert.truncated) {
            parts.push(`… and ${alert.totalRows - alert.rows.length} more (${alert.totalRows} total)`);
        }
    }

    if (alert.suggestions?.length) {
        parts.push('', 'Suggested fixes:');
        parts.push(
            renderTextTable(
                [
                    { key: 'target', label: 'Target' },
                    { key: 'action', label: 'Action' },
                    { key: 'detail', label: 'Why' },
                ],
                alert.suggestions,
            ),
        );
    }

    return parts.join('\n');
}

const SEVERITY_EMOJI = { info: ':information_source:', warning: ':warning:', critical: ':rotating_light:' };
const SEVERITY_COLOR = { info: '#3B82F6', warning: '#F59E0B', critical: '#EF4444' };

/**
 * Render as Slack Block Kit.
 *
 * Returns the full chat.postMessage body minus `channel`, so both the Bot API
 * path and the webhook path in slackService can use it.
 */
export function renderSlackBlocks(alert) {
    const sev = String(alert.severity || 'info').toLowerCase();
    const emoji = SEVERITY_EMOJI[sev] || ':bell:';
    const label = sev.toUpperCase();

    const blocks = [
        {
            type: 'header',
            // Slack header blocks are plain_text and hard-truncate at 150
            // chars with no ellipsis, so trim deliberately rather than let
            // the title lose its last words silently.
            text: { type: 'plain_text', text: truncate(`${emoji}  ${alert.title}`, 150), emoji: true },
        },
    ];

    // Slack `fields` lay out in a rigid two-column grid that wraps by count,
    // not by content — three facts leave the third stranded on its own row
    // under a half-empty one. A one-row monospace table keeps them on a single
    // line and matches the tables below, so the whole message reads as one
    // object rather than a form followed by a report.
    const factColumns = [
        alert.incidentId && { key: 'incident', label: 'Incident' },
        { key: 'severity', label: 'Severity' },
        alert.category && { key: 'category', label: 'Category' },
        alert.database && { key: 'database', label: 'Database' },
    ].filter(Boolean);

    if (factColumns.length) {
        const factRow = {
            incident: alert.incidentId,
            severity: label,
            category: alert.category,
            database: alert.database,
        };
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: truncate('```\n' + renderTextTable(factColumns, [factRow]) + '\n```', 3000),
            },
        });
    }

    if (alert.summary) {
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: alert.summary } });
    }

    if (alert.rows?.length) {
        // Ten columns wrap into noise in a Slack code block — roughly 40 chars
        // wide on mobile. Drop to the compact set when the rows are incidents;
        // the owner and status stay because they are what a reader triages on,
        // and the dropped columns (database, exact timestamp, fix text) are
        // either constant across the alert or repeated in the fixes block.
        const isIncidentTable = alert.columns === INCIDENT_COLUMNS_FULL;
        const columns = isIncidentTable ? INCIDENT_COLUMNS_COMPACT : alert.columns;
        const table = renderTextTable(columns, alert.rows);
        const note = alert.truncated
            ? `\n… and ${alert.totalRows - alert.rows.length} more (${alert.totalRows} total)`
            : '';
        blocks.push({
            type: 'section',
            text: { type: 'mrkdwn', text: truncate('```\n' + table + note + '\n```', 3000) },
        });
    }

    if (alert.suggestions?.length) {
        blocks.push({ type: 'divider' });
        blocks.push({
            type: 'section',
            text: { type: 'mrkdwn', text: '*Suggested fixes*' },
        });
        const fixTable = renderTextTable(
            [
                { key: 'target', label: 'Target' },
                { key: 'action', label: 'Action' },
                { key: 'detail', label: 'Why' },
            ],
            alert.suggestions,
        );
        blocks.push({
            type: 'section',
            text: { type: 'mrkdwn', text: truncate('```\n' + fixTable + '\n```', 3000) },
        });

        // The exact statements, separately, so they can be copied without the
        // surrounding table's padding coming along.
        const sql = alert.suggestions.map((s) => s.sql).filter(Boolean);
        if (sql.length) {
            blocks.push({
                type: 'section',
                text: { type: 'mrkdwn', text: truncate('*SQL*\n```\n' + sql.join('\n') + '\n```', 3000) },
            });
        }
    }

    // ── Acknowledgement ─────────────────────────────────────────────────────
    // The single most useful thing to know about an open incident in a channel
    // with six people in it is whether anyone has picked it up. Stated in
    // words, not just as a column, because the column is easy to skim past.
    // Only incident rows. A findings-only alert built with buildStructuredAlert
    // has rows with no id, nothing to acknowledge, and no SLA — offering a
    // button there would produce an action carrying `undefined`.
    const open = (alert.rows || []).filter(
        (r) => r.id && !['resolved', 'closed'].includes(r.status),
    );
    const unacked = open.filter((r) => !r.acknowledged);

    if (open.length) {
        blocks.push({ type: 'divider' });

        const acked = open.filter((r) => r.acknowledged);
        const lines = [];
        if (unacked.length) {
            lines.push(
                `:eyes: *${unacked.length} incident${unacked.length === 1 ? '' : 's'} ` +
                `awaiting acknowledgement.*`,
            );
        }
        for (const r of acked) {
            lines.push(`:white_check_mark: \`${r.id}\` acknowledged by *${r.acknowledged_by}*`);
        }
        const soonest = open
            .filter((r) => r.resolution_due_at)
            .sort((a, b) => new Date(a.resolution_due_at) - new Date(b.resolution_due_at))[0];
        if (soonest) {
            lines.push(`:stopwatch: Earliest SLA: \`${soonest.id}\` — ${soonest.sla_display}`);
        }
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } });

        // One button per incident is unreadable past a handful, and Slack caps
        // an actions block at 5 elements. Beyond three, offer the bulk action
        // only — anyone wanting to take a single incident can use /ack.
        if (unacked.length) {
            const elements =
                unacked.length <= 3
                    ? unacked.map((r) => ({
                          type: 'button',
                          text: { type: 'plain_text', text: `Ack ${r.id.replace(/^INC-\d{8}-/, '#')}` },
                          value: r.id,
                          action_id: `ack_incident:${r.id}`,
                      }))
                    : [{
                          type: 'button',
                          text: { type: 'plain_text', text: `Acknowledge all ${unacked.length}` },
                          style: 'primary',
                          value: unacked.map((r) => r.id).join(','),
                          action_id: 'ack_incidents_bulk',
                      }];
            blocks.push({ type: 'actions', elements });
        }
    }

    blocks.push({
        type: 'context',
        elements: [
            {
                type: 'mrkdwn',
                text:
                    ':bar_chart: Sent by *PulseDB*' +
                    (unacked.length ? ' · or `/ack <incident-id>`' : ''),
            },
        ],
    });

    return {
        text: `${emoji} ${label}: ${alert.title}`, // notification + a11y fallback
        attachments: [{ color: SEVERITY_COLOR[sev] || '#6B7280', blocks }],
    };
}

function truncate(text, max) {
    if (text.length <= max) return text;
    return text.slice(0, max - 1) + '…';
}

/**
 * Highest severity among a set of rows, given a threshold map. Used so an alert
 * about twelve tables takes the severity of the worst one rather than the first.
 */
export function escalateSeverity(current, candidate) {
    return (SEVERITY_RANK[candidate] ?? -1) > (SEVERITY_RANK[current] ?? -1) ? candidate : current;
}

/* ─── Incident tables ────────────────────────────────────────────────────── */

/**
 * The full column set — incident number through to detection time.
 *
 * Ten columns is a lot of horizontal space. Fine in email, a web table, or a
 * terminal; in Slack it wraps and becomes unreadable, especially on mobile
 * where a code block is roughly 40 characters wide. Hence the compact set
 * below, which Slack uses while the detail moves into per-incident lines.
 */
export const INCIDENT_COLUMNS_FULL = [
    { key: 'id', label: 'Incident ID' },
    { key: 'database_name', label: 'Database' },
    { key: 'schema_name', label: 'Schema' },
    { key: 'object_name', label: 'Object' },
    { key: 'metric_display', label: 'Metric', align: 'right' },
    { key: 'priority', label: 'Priority' },
    { key: 'owner', label: 'Owner' },
    { key: 'status', label: 'Status' },
    { key: 'ack_display', label: 'Ack' },
    { key: 'sla_display', label: 'SLA Due' },
    { key: 'fix_suggestion', label: 'AI Fix Suggestion' },
    { key: 'detected_at_display', label: 'Detected At' },
];

export const INCIDENT_COLUMNS_COMPACT = [
    { key: 'id', label: 'Incident' },
    { key: 'object_path', label: 'Object' },
    { key: 'metric_display', label: 'Metric', align: 'right' },
    { key: 'priority', label: 'Priority' },
    { key: 'owner', label: 'Owner' },
    { key: 'status', label: 'Status' },
    { key: 'sla_display', label: 'SLA Due' },
];

/**
 * Time remaining against the SLA, as something you can read at a glance.
 *
 * Relative, not absolute: "2h left" answers the question people actually ask
 * during an incident. An absolute timestamp makes every reader do arithmetic,
 * and do it wrong if they're in a different timezone from the server.
 *
 * Overdue is stated plainly rather than as a negative duration.
 */
export function formatSlaRemaining(dueAt, { now = Date.now(), resolved = false } = {}) {
    if (!dueAt) return '—';
    if (resolved) return 'met';

    const ms = new Date(dueAt).getTime() - now;
    const overdue = ms < 0;
    const mins = Math.round(Math.abs(ms) / 60_000);

    let span;
    if (mins < 60) span = `${mins}m`;
    else if (mins < 60 * 24) span = `${Math.floor(mins / 60)}h ${mins % 60}m`.replace(' 0m', '');
    else span = `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`.replace(' 0h', '');

    return overdue ? `OVERDUE ${span}` : `${span} left`;
}

/**
 * Format an incident row for display. Derives the columns that are
 * presentation-only (a joined object path, a formatted timestamp) so the
 * renderers stay dumb and the database keeps storing structured values.
 *
 * @param {object} row      — as returned by incidentService
 * @param {string} timeZone — IANA zone for Detected At. Defaults to the host's.
 */
export function toIncidentRow(row, { timeZone = process.env.PULSEDB_DISPLAY_TZ || undefined, now = Date.now() } = {}) {
    const detected = row.detected_at ? new Date(row.detected_at) : null;
    const resolved = ['resolved', 'closed'].includes(row.status);
    return {
        ...row,
        owner: row.owner || 'Unassigned',
        // Who has it, not just that someone does — "acknowledged" without a
        // name still leaves everyone wondering whether to pick it up.
        ack_display: row.acknowledged_by || 'No',
        acknowledged: Boolean(row.acknowledged_by),
        sla_display: formatSlaRemaining(row.resolution_due_at, { now, resolved }),
        object_path: [row.schema_name, row.object_name].filter(Boolean).join('.') || '—',
        metric_display: row.metric_display ?? (row.metric_value != null ? String(row.metric_value) : '—'),
        fix_suggestion: row.fix_suggestion || '—',
        // Explicit zone, because an alert timestamp read in the wrong zone
        // during an incident call is worse than no timestamp.
        detected_at_display: detected
            ? detected.toLocaleString('en-GB', {
                  timeZone,
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit', hour12: false,
              }).replace(',', '')
            : '—',
    };
}

/**
 * Build the alert that groups a set of per-object incidents.
 *
 * This is the generic entry point — bloat, replication lag, lock contention and
 * anything else produce the same shape. The only category-specific thing left
 * is which metric goes in the Metric column, and that travels on the rows.
 */
export function buildIncidentAlert({
    title,
    severity = 'warning',
    category = 'general',
    incidents = [],
    summary = null,
    connectionId = null,
    database = null,
    timeZone = undefined,
} = {}) {
    const rows = incidents.map((r) => toIncidentRow(r, { timeZone }));

    // The suggestion table is keyed by incident so a reader can match a fix to
    // the row above it without re-deriving the object path.
    const suggestions = rows
        .filter((r) => r.fix_sql || (r.fix_suggestion && r.fix_suggestion !== '—'))
        .map((r) => ({
            target: `${r.id}  ${r.object_path}`,
            action: r.fix_suggestion,
            detail: r.priority,
            sql: r.fix_sql || null,
        }));

    return buildStructuredAlert({
        title, severity, category, summary, connectionId, database,
        columns: INCIDENT_COLUMNS_FULL,
        rows,
        suggestions,
        // A grouped alert has no single incident number. The numbers are in the
        // table; putting one of them in the header would imply the others are
        // subordinate to it.
        incidentId: rows.length === 1 ? rows[0].id : null,
    });
}
