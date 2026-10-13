/**
 * tests/alertFormatter.test.ts
 * ────────────────────────────
 * The structured alert format and the bloat builder that feeds it.
 *
 * No database and no Slack — buildStructuredAlert and the renderers are pure,
 * and buildBloatAlert takes rows rather than a client.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    buildStructuredAlert,
    buildIncidentAlert,
    renderTextTable,
    renderPlainText,
    renderSlackBlocks,
    escalateSeverity,
    formatSlaRemaining,
} from '../services/alertFormatter.js';
import { buildBloatAlert, BLOAT_THRESHOLDS } from '../services/bloatWatcher.js';
import {
    fingerprintFor, objectKeyFor, mapPriority, severityForPriority, maxPriority,
} from '../services/incidentService.js';

const COLUMNS = [
    { key: 'schema', label: 'Schema' },
    { key: 'table', label: 'Table' },
    { key: 'bloatPct', label: 'Bloat %', align: 'right' },
];

function bloatRow(name, ratio, sizeBytes = 2 * 1024 ** 3) {
    return {
        schema: 'public',
        table: name,
        sizeBytes,
        liveBytes: Math.round(sizeBytes * (1 - ratio)),
        deadBytes: Math.round(sizeBytes * ratio),
        bloatBytes: Math.round(sizeBytes * ratio),
        bloatRatio: ratio,
        bloatMethod: 'pgstattuple',
    };
}

/* ── Table rendering ─────────────────────────────────────────────────── */

describe('renderTextTable', () => {
    it('sizes each column to its widest cell, header included', () => {
        const out = renderTextTable(COLUMNS, [
            { schema: 'public', table: 'orders', bloatPct: '34.0%' },
        ]);
        const [header, rule, row] = out.split('\n');
        assert.equal(header.length, rule.length);
        assert.equal(header.length, row.length);
        assert.match(header, /^Schema/);
    });

    it('right-aligns the columns that ask for it', () => {
        const out = renderTextTable(COLUMNS, [
            { schema: 'public', table: 'a', bloatPct: '9.0%' },
            { schema: 'public', table: 'b', bloatPct: '12.5%' },
        ]);
        const lines = out.split('\n');
        // Both percentages must end at the same column.
        assert.equal(lines[2].length, lines[3].length);
        assert.ok(lines[2].endsWith(' 9.0%'));
    });

    it('renders a missing value as a dash rather than "undefined"', () => {
        const out = renderTextTable(COLUMNS, [{ schema: 'public', table: 'orders' }]);
        assert.ok(out.includes('—'));
        assert.equal(out.includes('undefined'), false);
    });

    it('returns empty string for no rows', () => {
        assert.equal(renderTextTable(COLUMNS, []), '');
    });
});

/* ── Structure ───────────────────────────────────────────────────────── */

describe('buildStructuredAlert', () => {
    it('caps displayed rows but reports the true total', () => {
        const rows = Array.from({ length: 40 }, (_, i) => ({ schema: 'public', table: `t${i}` }));
        const alert = buildStructuredAlert({ title: 'Bloat', columns: COLUMNS, rows });
        assert.ok(alert.rows.length < 40);
        assert.equal(alert.totalRows, 40);
        assert.equal(alert.truncated, true);
    });

    it('does not claim truncation when everything fits', () => {
        const alert = buildStructuredAlert({
            title: 'Bloat',
            columns: COLUMNS,
            rows: [{ schema: 'public', table: 'orders' }],
        });
        assert.equal(alert.truncated, false);
        assert.equal(alert.totalRows, 1);
    });

    it('requires a title', () => {
        assert.throws(() => buildStructuredAlert({}), /title is required/);
    });
});

describe('escalateSeverity', () => {
    it('ratchets up, never down', () => {
        assert.equal(escalateSeverity('warning', 'critical'), 'critical');
        assert.equal(escalateSeverity('critical', 'warning'), 'critical');
        assert.equal(escalateSeverity('info', 'warning'), 'warning');
    });
});

/* ── Plain text ──────────────────────────────────────────────────────── */

describe('renderPlainText', () => {
    it('leads with severity, title and incident number', () => {
        const text = renderPlainText(
            buildStructuredAlert({
                title: 'Table bloat is high on 2 tables',
                severity: 'critical',
                incidentId: 'INC-2026-00042',
                columns: COLUMNS,
                rows: [{ schema: 'public', table: 'orders', bloatPct: '44.0%' }],
            }),
        );
        assert.match(text, /^\[CRITICAL\] Table bloat is high on 2 tables/);
        assert.match(text, /Incident: INC-2026-00042/);
        assert.match(text, /orders/);
    });

    it('says how many rows were hidden', () => {
        const rows = Array.from({ length: 30 }, (_, i) => ({ schema: 'public', table: `t${i}` }));
        const text = renderPlainText(buildStructuredAlert({ title: 'Bloat', columns: COLUMNS, rows }));
        assert.match(text, /and \d+ more \(30 total\)/);
    });
});

/* ── Slack ───────────────────────────────────────────────────────────── */

describe('renderSlackBlocks', () => {
    const alert = buildStructuredAlert({
        title: 'Table bloat is high on 2 tables',
        severity: 'critical',
        category: 'maintenance',
        incidentId: 'INC-2026-00042',
        database: 'orders_prod',
        columns: COLUMNS,
        rows: [
            { schema: 'public', table: 'orders', bloatPct: '44.0%' },
            { schema: 'billing', table: 'invoices', bloatPct: '23.0%' },
        ],
        suggestions: [
            { target: 'public.orders', action: 'VACUUM (FULL, ANALYZE)', detail: 'Severe bloat', sql: 'VACUUM (FULL, VERBOSE), ANALYZE "public"."orders";' },
        ],
    });

    it('carries a text fallback for notifications and screen readers', () => {
        const payload = renderSlackBlocks(alert);
        assert.match(payload.text, /CRITICAL/);
        assert.match(payload.text, /Table bloat/);
    });

    it('renders the facts as a one-row table, not a wrapping fields grid', () => {
        // Slack `fields` wrap by count, not content — three facts strand the
        // third on its own row under a half-empty one.
        const payload = renderSlackBlocks(alert);
        assert.equal(payload.attachments[0].blocks.some((b) => b.fields), false);
        const facts = payload.attachments[0].blocks
            .map((b) => b.text?.text ?? '')
            .find((t) => t.includes('Severity'));
        assert.ok(facts.includes('```'), 'facts are not in a code block');
        assert.ok(facts.includes('INC-2026-00042'));
        assert.ok(facts.includes('maintenance'));
        assert.ok(facts.includes('orders_prod'));
        // Header, rule, one data row — everything on one line each.
        assert.equal(facts.replace(/```/g, '').trim().split('\n').length, 3);
    });

    it('renders the findings as a monospace table, not raw JSON', () => {
        const payload = renderSlackBlocks(alert);
        const texts = payload.attachments[0].blocks.map((b) => b.text?.text ?? '').join('\n');
        assert.match(texts, /```/);
        assert.match(texts, /orders/);
        assert.match(texts, /invoices/);
        assert.equal(texts.includes('"bloatRatio"'), false);
    });

    it('emits the SQL separately so it can be copied cleanly', () => {
        const payload = renderSlackBlocks(alert);
        const texts = payload.attachments[0].blocks.map((b) => b.text?.text ?? '');
        assert.ok(texts.some((t) => t.startsWith('*SQL*')));
    });

    it('keeps every block inside Slack limits', () => {
        const rows = Array.from({ length: 200 }, (_, i) => ({
            schema: 'public', table: `a_very_long_table_name_${i}`, bloatPct: '31.0%',
        }));
        const payload = renderSlackBlocks(
            buildStructuredAlert({ title: 'Bloat', columns: COLUMNS, rows }),
        );
        for (const block of payload.attachments[0].blocks) {
            if (block.type === 'header') assert.ok(block.text.text.length <= 150);
            if (block.text?.type === 'mrkdwn') assert.ok(block.text.text.length <= 3000);
        }
    });
});

/* ── Incident table ──────────────────────────────────────────────────── */

const INCIDENT_ROWS = [
    {
        id: 'INC-20260729-001', database_name: 'MarketTimeDB', schema_name: 'public',
        object_name: 'orders', metric_display: '45.0%', metric_value: 0.45,
        priority: 'high', severity: 'critical', status: 'open', fix_status: 'pending',
        owner: 'DBA Team', fix_suggestion: 'VACUUM (FULL, ANALYZE)',
        fix_sql: 'VACUUM (FULL, VERBOSE), ANALYZE "public"."orders";',
        detected_at: '2026-07-29T08:15:00.000Z',
    },
    {
        id: 'INC-20260729-002', database_name: 'MarketTimeDB', schema_name: 'sales',
        object_name: 'transactions', metric_display: '62.0%', metric_value: 0.62,
        priority: 'critical', severity: 'critical', status: 'in_progress', fix_status: 'applied',
        owner: null, fix_suggestion: 'VACUUM (FULL, ANALYZE)', fix_sql: null,
        detected_at: '2026-07-29T08:16:00.000Z',
    },
];

describe('buildIncidentAlert', () => {
    it('renders every requested column in the full table', () => {
        const alert = buildIncidentAlert({ title: 'Table bloat', incidents: INCIDENT_ROWS });
        const text = renderTextTable(alert.columns, alert.rows);
        for (const header of ['Incident ID', 'Database', 'Schema', 'Object', 'Metric',
                              'Priority', 'Owner', 'Status', 'AI Fix Suggestion', 'Detected At']) {
            assert.ok(text.includes(header), `missing column ${header}`);
        }
        assert.ok(text.includes('INC-20260729-001'));
        assert.ok(text.includes('DBA Team'));
    });

    it('says Unassigned rather than leaving an owner blank', () => {
        const alert = buildIncidentAlert({ title: 'Table bloat', incidents: INCIDENT_ROWS });
        assert.equal(alert.rows[1].owner, 'Unassigned');
    });

    it('formats Detected At in a fixed zone rather than the reader\'s guess', () => {
        const alert = buildIncidentAlert({
            title: 'Table bloat', incidents: INCIDENT_ROWS, timeZone: 'Asia/Kolkata',
        });
        // 08:15 UTC is 13:45 IST.
        assert.match(alert.rows[0].detected_at_display, /29\/07\/2026 13:45/);
    });

    it('puts a single incident number in the header, and none when grouped', () => {
        assert.equal(
            buildIncidentAlert({ title: 't', incidents: [INCIDENT_ROWS[0]] }).incidentId,
            'INC-20260729-001',
        );
        assert.equal(buildIncidentAlert({ title: 't', incidents: INCIDENT_ROWS }).incidentId, null);
    });

    it('keys each suggested fix to its incident number', () => {
        const alert = buildIncidentAlert({ title: 't', incidents: INCIDENT_ROWS });
        assert.match(alert.suggestions[0].target, /INC-20260729-001/);
        assert.match(alert.suggestions[0].target, /public\.orders/);
    });

    it('drops to the compact column set for Slack', () => {
        // Ten columns in a Slack code block wrap into noise on mobile.
        const alert = buildIncidentAlert({ title: 'Table bloat', incidents: INCIDENT_ROWS });
        const payload = renderSlackBlocks(alert);
        const table = payload.attachments[0].blocks
            .map((b) => b.text?.text ?? '')
            // The facts table also starts with a fence — pick the findings one.
            .find((t) => t.startsWith('```') && t.includes('Owner'));
        assert.ok(table.includes('Incident'));
        assert.ok(table.includes('Owner'));
        // Dropped: constant across the alert, or repeated in the fixes block.
        assert.equal(table.includes('Detected At'), false);
        assert.equal(table.includes('AI Fix Suggestion'), false);
        // Every retained line must fit a phone-width code block.
        for (const line of table.replace(/```/g, '').trim().split('\n')) {
            assert.ok(line.length <= 90, `compact row too wide (${line.length}): ${line}`);
        }
    });
});

/* ── SLA and acknowledgement ─────────────────────────────────────────── */

describe('formatSlaRemaining', () => {
    const now = Date.UTC(2026, 6, 29, 12, 0, 0);

    it('counts down in the largest useful unit', () => {
        assert.equal(formatSlaRemaining(new Date(now + 30 * 60_000), { now }), '30m left');
        assert.equal(formatSlaRemaining(new Date(now + 4 * 3600_000), { now }), '4h left');
        assert.equal(formatSlaRemaining(new Date(now + 3 * 86_400_000), { now }), '3d left');
    });

    it('states overdue plainly rather than as a negative duration', () => {
        const out = formatSlaRemaining(new Date(now - 90 * 60_000), { now });
        assert.match(out, /^OVERDUE/);
        assert.equal(out.includes('-'), false);
    });

    it('reports met once the incident is resolved', () => {
        assert.equal(formatSlaRemaining(new Date(now - 10_000), { now, resolved: true }), 'met');
    });

    it('handles a missing due date', () => {
        assert.equal(formatSlaRemaining(null), '—');
    });
});

describe('acknowledgement in the alert', () => {
    const now = Date.UTC(2026, 6, 29, 12, 0, 0);
    const rows = [
        { ...INCIDENT_ROWS[0], acknowledged_by: 'dilip', status: 'investigating',
          resolution_due_at: new Date(now + 4 * 3600_000).toISOString() },
        { ...INCIDENT_ROWS[1], acknowledged_by: null, status: 'open',
          resolution_due_at: new Date(now + 3 * 86_400_000).toISOString() },
    ];
    const alert = buildIncidentAlert({ title: 'Bloat', incidents: rows, timeZone: 'UTC' });

    it('names who acknowledged, rather than just that someone did', () => {
        const payload = renderSlackBlocks(alert);
        const texts = payload.attachments[0].blocks.map((b) => b.text?.text ?? '').join('\n');
        assert.match(texts, /acknowledged by \*dilip\*/);
    });

    it('counts only the unacknowledged as awaiting', () => {
        const payload = renderSlackBlocks(alert);
        const texts = payload.attachments[0].blocks.map((b) => b.text?.text ?? '').join('\n');
        assert.match(texts, /1 incident awaiting acknowledgement/);
    });

    it('offers a button only for incidents nobody has taken', () => {
        const payload = renderSlackBlocks(alert);
        const actions = payload.attachments[0].blocks.find((b) => b.type === 'actions');
        assert.equal(actions.elements.length, 1);
        assert.equal(actions.elements[0].action_id, 'ack_incident:INC-20260729-002');
        assert.equal(actions.elements[0].value, 'INC-20260729-002');
    });

    it('collapses to one bulk button past three, respecting Slack element limits', () => {
        const many = Array.from({ length: 7 }, (_, i) => ({
            ...INCIDENT_ROWS[1], id: `INC-20260729-1${i}0`, acknowledged_by: null, status: 'open',
        }));
        const payload = renderSlackBlocks(buildIncidentAlert({ title: 'Bloat', incidents: many }));
        const actions = payload.attachments[0].blocks.find((b) => b.type === 'actions');
        assert.equal(actions.elements.length, 1);
        assert.equal(actions.elements[0].action_id, 'ack_incidents_bulk');
        assert.equal(actions.elements[0].value.split(',').length, 7);
    });

    it('shows no acknowledgement section once everything is resolved', () => {
        const done = rows.map((r) => ({ ...r, status: 'resolved' }));
        const payload = renderSlackBlocks(buildIncidentAlert({ title: 'Bloat', incidents: done }));
        assert.equal(payload.attachments[0].blocks.some((b) => b.type === 'actions'), false);
        const texts = payload.attachments[0].blocks.map((b) => b.text?.text ?? '').join('\n');
        assert.equal(texts.includes('awaiting acknowledgement'), false);
    });

    it('surfaces the earliest SLA, not an arbitrary one', () => {
        const payload = renderSlackBlocks(alert);
        const texts = payload.attachments[0].blocks.map((b) => b.text?.text ?? '').join('\n');
        assert.match(texts, /Earliest SLA: `INC-20260729-001`/);
    });

    it('carries an SLA column in both the full and compact tables', () => {
        assert.ok(renderTextTable(alert.columns, alert.rows).includes('SLA Due'));
        const payload = renderSlackBlocks(alert);
        const table = payload.attachments[0].blocks
            .map((b) => b.text?.text ?? '')
            .find((t) => t.includes('Owner'));
        assert.ok(table.includes('SLA Due'));
    });
});

/* ── The per-org notifier path ───────────────────────────────────────── */

/**
 * Regression cover for a real miss: renderSlackBlocks was wired into
 * slackService (the legacy global-webhook path) but not into SlackNotifier,
 * which is what per-org destinations actually use. The result reached Slack
 * looking fine in a terminal and misaligned in the client, because the table
 * was in a proportional-font section rather than a code block.
 */
describe('SlackNotifier honours the structured payload', () => {
    const structured = buildIncidentAlert({
        title: 'High Table Bloat',
        severity: 'critical',
        category: 'maintenance',
        database: 'TestDB',
        summary: '2 tables with high bloat detected.',
        incidents: INCIDENT_ROWS,
    });

    async function capture(alert) {
        const { SlackNotifier } = await import('../services/notifiers/slackNotifier.js');
        let body;
        const realFetch = globalThis.fetch;
        globalThis.fetch = async (_url, init) => {
            body = JSON.parse(init.body);
            return { ok: true, status: 200, text: async () => 'ok', json: async () => ({ ok: true }) };
        };
        try {
            const n = new SlackNotifier({
                webhookUrl: 'https://hooks.slack.com/services/T/B/x',
                minSeverity: 'warning',
            });
            await n.send(alert);
        } finally {
            globalThis.fetch = realFetch;
        }
        return body;
    }

    const baseAlert = {
        id: 'a1', severity: 'critical', title: 'High Table Bloat', message: 'plain fallback',
        source: 'fathom', component: 'maintenance', timestamp: new Date().toISOString(),
        metadata: { ruleId: 'high_bloat' },
    };

    it('renders the tables inside code blocks, not proportional sections', async () => {
        const body = await capture({ ...baseAlert, structured });
        const texts = body.attachments[0].blocks.map((b) => b.text?.text ?? '');
        const fenced = texts.filter((t) => t.includes('```'));
        // facts, findings table, fixes table, SQL
        assert.equal(fenced.length, 4);
        assert.ok(fenced.some((t) => t.includes('INC-20260729-001')));
    });

    it('does not echo the structured payload back as metadata', async () => {
        // It is the body of the message; repeating it as key/value restates
        // what the reader just read.
        const body = await capture({ ...baseAlert, structured });
        assert.equal(JSON.stringify(body).includes('"structured"'), false);
    });

    it('keeps the notification text short rather than dumping the table', async () => {
        const body = await capture({ ...baseAlert, structured });
        assert.ok(body.text.length < 200, `notification text too long: ${body.text.length}`);
        assert.match(body.text, /CRITICAL/);
        assert.equal(body.text.includes('\n'), false);
    });

    it('falls back to the legacy layout when there is no structured payload', async () => {
        const body = await capture(baseAlert);
        const texts = body.attachments[0].blocks.map((b) => b.text?.text ?? '').join('\n');
        assert.equal(texts.includes('```'), false);
        assert.ok(texts.includes('plain fallback'));
    });
});

/* ── Bloat builder ───────────────────────────────────────────────────── */

describe('buildBloatAlert', () => {
    it('returns null when nothing crosses the threshold', () => {
        assert.equal(buildBloatAlert([bloatRow('orders', 0.05)]), null);
        assert.equal(buildBloatAlert([]), null);
    });

    it('emits the generic object-alert shape, not a bloat-specific one', () => {
        const spec = buildBloatAlert([bloatRow('orders', 0.5)]);
        // The contract fireObjectAlert() depends on. Anything category-specific
        // beyond these keys means the pipeline has learned about bloat.
        for (const key of ['title', 'category', 'ruleId', 'metricLabel', 'thresholds', 'objects']) {
            assert.ok(key in spec, `missing ${key}`);
        }
        assert.equal(spec.metricLabel, 'Bloat %');
        assert.deepEqual(spec.thresholds, BLOAT_THRESHOLDS);
    });

    it('carries the raw ratio so priority is mapped downstream, not here', () => {
        const spec = buildBloatAlert([bloatRow('orders', 0.62)]);
        assert.equal(spec.objects[0].metricValue, 0.62);
        assert.equal(spec.objects[0].metricDisplay, '62.0%');
        // The builder must NOT decide priority — that belongs to mapPriority so
        // every category ranks the same way.
        assert.equal(spec.objects[0].priority, undefined);
    });

    it('sorts worst-first so a truncated table shows what matters', () => {
        const spec = buildBloatAlert([bloatRow('small', 0.22), bloatRow('huge', 0.61)]);
        assert.equal(spec.objects[0].object, 'huge');
    });

    it('drops objects below the threshold', () => {
        const spec = buildBloatAlert([bloatRow('bad', 0.5), bloatRow('fine', 0.01)]);
        assert.equal(spec.objects.length, 1);
        assert.equal(spec.objects[0].object, 'bad');
    });

    it('recommends a full rewrite for severe bloat on a large table', () => {
        const spec = buildBloatAlert([bloatRow('orders', 0.55, 2 * 1024 ** 3)]);
        assert.match(spec.objects[0].fixSuggestion, /FULL/);
        assert.match(spec.objects[0].fixSql, /VACUUM \(FULL/);
        assert.match(spec.objects[0].fixSql, /"public"\."orders"/);
    });

    it('quotes identifiers so an odd table name cannot break the statement', () => {
        const spec = buildBloatAlert([bloatRow('weird"name', 0.5)]);
        assert.match(spec.objects[0].fixSql, /"weird""name"/);
    });

    it('says so when the numbers are heuristic estimates', () => {
        const spec = buildBloatAlert([{ ...bloatRow('orders', 0.5), bloatMethod: 'heuristic' }]);
        assert.match(spec.summary, /estimates/);
        assert.match(spec.summary, /pgstattuple is not installed/);
    });

    it('names the table when there is only one, and counts when there are many', () => {
        assert.match(buildBloatAlert([bloatRow('orders', 0.5)]).title, /public\.orders/);
        assert.match(buildBloatAlert([bloatRow('a', 0.5), bloatRow('b', 0.5)]).title, /2 tables/);
    });
});

/* ── Priority, severity, identity ────────────────────────────────────── */

describe('mapPriority', () => {
    it('applies the requested bloat mapping: >60% critical, 40–60% high', () => {
        assert.equal(mapPriority(0.62, BLOAT_THRESHOLDS), 'critical');
        assert.equal(mapPriority(0.45, BLOAT_THRESHOLDS), 'high');
        assert.equal(mapPriority(0.25, BLOAT_THRESHOLDS), 'medium');
        assert.equal(mapPriority(0.05, BLOAT_THRESHOLDS), 'low');
    });

    it('treats the threshold itself as belonging to the higher band', () => {
        assert.equal(mapPriority(0.6, BLOAT_THRESHOLDS), 'critical');
        assert.equal(mapPriority(0.4, BLOAT_THRESHOLDS), 'high');
    });

    it('works for any ascending metric, not just ratios', () => {
        const lagSeconds = { critical: 300, high: 60, medium: 10 };
        assert.equal(mapPriority(600, lagSeconds), 'critical');
        assert.equal(mapPriority(30, lagSeconds), 'medium');
    });
});

describe('severityForPriority', () => {
    it('never maps a real problem below warning', () => {
        // info is under the default min_severity of every destination, so
        // anything mapped there notifies nobody.
        assert.equal(severityForPriority('critical'), 'critical');
        assert.equal(severityForPriority('high'), 'critical');
        assert.equal(severityForPriority('medium'), 'warning');
    });
});

describe('maxPriority', () => {
    it('ranks correctly across the four levels', () => {
        assert.equal(maxPriority('low', 'medium'), 'medium');
        assert.equal(maxPriority('critical', 'high'), 'critical');
        assert.equal(maxPriority('high', 'critical'), 'critical');
    });
});

describe('fingerprintFor', () => {
    it('separates the same rule on different connections', () => {
        const base = { category: 'maintenance', ruleId: 'table_bloat_high', objectKey: 'db.public.orders' };
        assert.notEqual(
            fingerprintFor({ ...base, connectionId: 1 }),
            fingerprintFor({ ...base, connectionId: 2 }),
        );
    });

    it('separates two objects hit by the same rule', () => {
        // This is what makes incidents per-object: orders and invoices must get
        // their own numbers, owners and fix statuses.
        const base = { category: 'maintenance', ruleId: 'table_bloat_high', connectionId: 1 };
        assert.notEqual(
            fingerprintFor({ ...base, objectKey: objectKeyFor({ database: 'd', schema: 'public', object: 'orders' }) }),
            fingerprintFor({ ...base, objectKey: objectKeyFor({ database: 'd', schema: 'public', object: 'invoices' }) }),
        );
    });

    it('is stable as the measurement drifts', () => {
        const spec = { category: 'maintenance', ruleId: 'table_bloat_high', connectionId: 1, objectKey: 'd.public.orders' };
        assert.equal(fingerprintFor(spec), fingerprintFor({ ...spec }));
    });
});
