/**
 * test-alert.ts — fire an alert through the real pipeline, on demand.
 *
 *   npm run alert:test                       # dry run, every rule, nothing written
 *   npm run alert:test -- --rule high_bloat  # one rule
 *   npm run alert:test -- --slack            # also render what Slack would receive
 *   npm run alert:test -- --commit           # actually write incidents and notify
 *   npm run alert:test -- --commit --cleanup # write, show, then delete what it wrote
 *
 * Acknowledgement loop — create, look, acknowledge, look again:
 *
 *   npm run alert:test -- --rule high_bloat --commit
 *   npm run alert:test -- --list
 *   npm run alert:test -- --ack latest       (or a specific INC- id)
 *   npm run alert:test -- --resend all --slack --commit
 *
 * Why this exists: the alternative is waiting for a table to bloat past 60% and
 * hoping you're watching. This runs the same code path the monitoring loop
 * runs — the real rules, the real thresholds, the real incident writes, the
 * real renderers. Nothing here is a mock. The only thing supplied is the
 * metrics snapshot, which is exactly what collectMetrics() would have returned
 * from a database in trouble.
 *
 * Dry run is the default on purpose: --commit inserts rows into incidents and,
 * if a webhook is configured, posts to Slack.
 */

import 'dotenv/config';
import { pool } from '../db.js';
import { EnhancedAlertEngine } from '../services/alertService.js';
import { renderSlackBlocks, renderPlainText, buildIncidentAlert } from '../services/alertFormatter.js';
import { mapPriority, severityForPriority } from '../services/incidentService.js';

const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const OFF = '\x1b[0m';

const argv = process.argv.slice(2);
const has = (flag: string) => argv.includes(flag);
const valueOf = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : null;
};

const COMMIT = has('--commit');
const SHOW_SLACK = has('--slack');
const CLEANUP = has('--cleanup');
const ONLY_RULE = valueOf('--rule');
const LIST = has('--list');
const ACK_ID = valueOf('--ack');
const RESEND_ID = valueOf('--resend');

/**
 * A database in trouble in every way at once.
 *
 * Values are chosen to land in different priority bands so the output shows the
 * mapping working rather than a wall of criticals: orders is 62% bloated
 * (critical), customer_logs 38% (medium); one query at 412s (critical), one at
 * 44s (medium).
 */
const METRICS = {
    databaseName: process.env.PGDATABASE || 'TestDB',
    activeConnections: 97,
    maxConnections: 100,
    cacheHitRatio: '78.0',
    diskUsedGB: 240,
    blockingLocks: 14,
    replicationLag: 900 * 1024 * 1024,
    slowQueries: [
        { queryid: '4471', duration_sec: 412, query: 'SELECT * FROM orders WHERE created_at > $1' },
        { queryid: '9902', duration_sec: 44, query: 'UPDATE invoices SET status = $1 WHERE id = $2' },
    ],
    bloatedTables: [
        { schema_name: 'public', table_name: 'orders', bloat_ratio_pct: 62, dead_tuples: 8_200_000 },
        { schema_name: 'crm', table_name: 'customer_logs', bloat_ratio_pct: 38, dead_tuples: 640_000 },
    ],
    vacuumForecast: {
        summary: { overdue: 1, soon: 3 },
        tables: [
            { schema: 'audit', table: 'access_log', deadPct: 47, urgency: 'overdue' },
            { schema: 'public', table: 'sessions', deadPct: 5, urgency: 'soon' },
        ],
    },
    planRegressions: [{ queryId: 'q-17', slowdownPct: 320, connectionId: 3 }],
    pitrBreaches: [{ connectionId: 4, lagHours: null, reason: 'no base backup' }],
};

const CONFIG = {
    ALERT_THRESHOLDS: {
        CONNECTION_USAGE_PCT: Number(process.env.ALERT_CONNECTION_USAGE_PCT) || 80,
        LONG_QUERY_SEC: Number(process.env.ALERT_LONG_QUERY_SEC) || 30,
        CACHE_HIT_RATIO: Number(process.env.ALERT_CACHE_HIT_RATIO) || 95,
        REPLICATION_LAG_MB: Number(process.env.ALERT_REPLICATION_LAG_MB) || 100,
        LOCK_COUNT: Number(process.env.ALERT_LOCK_COUNT) || 5,
    },
    MONITORING_INTERVAL_MS: 60_000,
};

async function preflight() {
    const { rows } = await pool.query(
        `SELECT to_regclass('pgmonitoringtool.incidents')      AS incidents,
                to_regclass('pgmonitoringtool.incident_sla')   AS sla,
                to_regclass('pgmonitoringtool.alerts')         AS alerts,
                (SELECT count(*) FROM pgmonitoringtool.incident_ownership_rules
                  WHERE enabled)                               AS owner_rules`,
    );
    const r = rows[0];
    const missing: string[] = [];
    if (!r.incidents) missing.push('incidents (run migration 0031)');
    if (!r.sla) missing.push('incident_sla (run migration 0032)');
    if (!r.alerts) missing.push('alerts (run migration 0000/0026)');

    if (missing.length) {
        console.error(`${RED}Missing tables:${OFF}\n  ${missing.join('\n  ')}`);
        process.exit(1);
    }
    if (Number(r.owner_rules) === 0) {
        console.log(
            `${YELLOW}No ownership rules configured — every incident will show ` +
            `"Unassigned".${OFF}\n${DIM}  See docs/ALERT_FORMAT.md § Ownership.${OFF}\n`,
        );
    }
}

/** Current incidents, so the effect of an --ack is visible without psql. */
async function showIncidents() {
    const { listIncidents } = await import('../services/incidentService.js');
    const rows = await listIncidents(pool, { limit: 50 });
    if (!rows.length) {
        console.log(`${DIM}No incidents. Run with --commit to create some.${OFF}`);
        return rows;
    }
    const { toIncidentRow, renderTextTable, INCIDENT_COLUMNS_FULL } = await import('../services/alertFormatter.js');
    console.log(renderTextTable(INCIDENT_COLUMNS_FULL, rows.map((r) => toIncidentRow(r))));
    return rows;
}

async function main() {
    await preflight();

    if (LIST) {
        await showIncidents();
        await pool.end();
        return;
    }

    if (ACK_ID) {
        const { acknowledgeIncident, getAuditTrail, listIncidents } = await import('../services/incidentService.js');
        const actor = process.env.USER || 'cli';

        // "latest" saves copying an id back and forth while testing. Resolves
        // to the newest incident nobody has taken yet.
        let targetId = ACK_ID;
        if (ACK_ID === 'latest') {
            const open = (await listIncidents(pool, { phase: 'active', limit: 50 }))
                .filter((r: any) => !r.acknowledged_by);
            if (!open.length) {
                console.error(`${RED}Nothing open and unacknowledged.${OFF}`);
                process.exit(1);
            }
            targetId = open[0].id;
            console.log(`${DIM}latest → ${targetId}${OFF}`);
        }

        const result = await acknowledgeIncident(pool, targetId, actor, { via: 'cli' });

        if (!result) {
            // Incident numbers gap — ON CONFLICT consumes one per re-fire — so
            // a guessed id is usually just wrong rather than deleted. Show what
            // does exist instead of making them run --list.
            console.error(`${RED}No incident ${targetId}.${OFF}`);
            const open = await listIncidents(pool, { phase: 'active', limit: 20 });
            if (open.length) {
                console.error(`\n${BOLD}Open incidents${OFF}`);
                for (const r of open) {
                    console.error(
                        `  ${r.id}  ${DIM}${[r.schema_name, r.object_name].filter(Boolean).join('.')}` +
                        ` · ${r.priority}${r.acknowledged_by ? ` · acked by ${r.acknowledged_by}` : ''}${OFF}`,
                    );
                }
                console.error(`\n${DIM}Or: npm run alert:test -- --ack latest${OFF}`);
            } else {
                console.error(`${DIM}None exist. Create some: npm run alert:test -- --commit${OFF}`);
            }
            process.exit(1);
        }
        console.log(
            result.alreadyAcknowledged
                ? `${YELLOW}${targetId} was already acknowledged by ${result.by}.${OFF} ` +
                  `${DIM}First acknowledgement wins — it was not reassigned.${OFF}`
                : `${GREEN}${targetId} acknowledged by ${actor}.${OFF} ` +
                  `${DIM}status → ${result.incident.status}${OFF}`,
        );
        console.log(`\n${BOLD}Audit trail${OFF}`);
        for (const t of await getAuditTrail(pool, targetId)) {
            console.log(`  ${DIM}${new Date(t.at).toISOString()}${OFF}  ${t.action.padEnd(16)} ${String(t.actor).padEnd(10)} ${t.note || ''}`);
        }
        console.log(`\n${BOLD}Incidents now${OFF}`);
        await showIncidents();
        await pool.end();
        return;
    }

    if (RESEND_ID) {
        // Re-render and re-send an existing incident's alert without creating
        // anything — the way to see acknowledgement and SLA countdown reflected
        // in Slack after they have changed.
        const { listIncidents } = await import('../services/incidentService.js');
        const { buildIncidentAlert } = await import('../services/alertFormatter.js');
        const all = await listIncidents(pool, { limit: 200 });
        const rows = RESEND_ID === 'all' ? all.filter((r) => r.status_phase === 'active')
                                         : all.filter((r) => r.id === RESEND_ID);
        if (!rows.length) {
            console.error(`${RED}Nothing to resend for "${RESEND_ID}".${OFF}`);
            process.exit(1);
        }
        const engine = new EnhancedAlertEngine(pool, CONFIG);
        engine.broadcast = () => {};
        const structured = buildIncidentAlert({
            title: rows[0].title.replace(/ — .*$/, ''),
            severity: rows.some((r) => r.severity === 'critical') ? 'critical' : 'warning',
            category: rows[0].category,
            database: rows[0].database_name,
            incidents: rows,
            summary: `${rows.length} open incident(s), re-sent from the current state.`,
        });
        console.log(renderPlainText(structured));
        if (SHOW_SLACK) printSlack(structured);
        if (COMMIT) {
            await engine.fire(structured.severity, structured.category, renderPlainText(structured), {
                ruleId: `resend:${RESEND_ID}`, structured, database: rows[0].database_name,
            });
            console.log(`\n${GREEN}Sent.${OFF}`);
        } else {
            console.log(`\n${DIM}Dry run — add --commit to actually send it.${OFF}`);
        }
        await pool.end();
        return;
    }

    const engine = new EnhancedAlertEngine(pool, CONFIG);
    // The websocket broadcast has no subscribers in a script.
    engine.broadcast = () => {};

    const rules = engine.alertRules.filter((r: any) => !ONLY_RULE || r.id === ONLY_RULE);
    if (!rules.length) {
        console.error(`${RED}No rule matches --rule ${ONLY_RULE}${OFF}`);
        console.error(`Available: ${engine.alertRules.map((r: any) => r.id).join(', ')}`);
        process.exit(1);
    }

    console.log(
        `${BOLD}${COMMIT ? 'Firing' : 'Dry run'}${OFF} — ${rules.length} rule(s)` +
        `${COMMIT ? '' : `  ${DIM}(nothing will be written; add --commit to write)${OFF}`}\n`,
    );

    const written: string[] = [];

    for (const rule of rules as any[]) {
        if (!rule.condition(METRICS)) {
            console.log(`${DIM}· ${rule.id} — condition not met by the sample metrics${OFF}`);
            continue;
        }

        const thresholds = typeof rule.thresholds === 'function' ? rule.thresholds() : rule.thresholds;
        const objects = (rule.objects(METRICS) || []).filter(
            (o: any) => o && Number.isFinite(Number(o.metricValue)),
        );

        console.log(`\n${CYAN}${'═'.repeat(78)}${OFF}`);
        console.log(`${BOLD}${rule.id}${OFF}  ${DIM}${rule.category} · ${rule.metricLabel} · ` +
                    `thresholds ${JSON.stringify(thresholds)}${OFF}`);
        console.log(`${CYAN}${'═'.repeat(78)}${OFF}\n`);

        if (COMMIT) {
            const result = await engine.fireObjectAlert({
                title: rule.name,
                category: rule.category,
                ruleId: rule.id,
                metricLabel: rule.metricLabel,
                thresholds,
                objectType: rule.objectType,
                objects,
                summary: rule.message(METRICS),
                database: METRICS.databaseName,
                connectionId: null,
            });
            const incidents = result?.incidents ?? [];
            written.push(...incidents.map((i: any) => i.id));
            console.log(result?.alert?.message ?? '(no message)');
            if (SHOW_SLACK && result?.alert?.data?.structured) {
                printSlack(result.alert.data.structured);
            }
        } else {
            // Same rendering, incidents synthesised rather than inserted — so a
            // dry run shows the real layout without leaving rows behind. The
            // IDs are placeholders; everything else is what would be stored.
            const now = new Date();
            const stamp = now.toISOString().slice(0, 10).replace(/-/g, '');
            const incidents = objects.map((o: any, i: number) => {
                const priority = mapPriority(Number(o.metricValue), thresholds);
                return {
                    id: `INC-${stamp}-${String(i + 1).padStart(3, '0')}${DIM_MARK}`,
                    database_name: METRICS.databaseName,
                    schema_name: o.schema,
                    object_name: o.object,
                    metric_value: o.metricValue,
                    metric_label: rule.metricLabel,
                    metric_display: o.metricDisplay,
                    priority,
                    severity: severityForPriority(priority),
                    status: 'open',
                    fix_status: 'pending',
                    owner: null,
                    fix_suggestion: o.fixSuggestion,
                    fix_sql: o.fixSql,
                    detected_at: now.toISOString(),
                };
            });
            const structured = buildIncidentAlert({
                title: rule.name,
                severity: severityForPriority(
                    incidents.reduce((w: string, i: any) =>
                        (['low', 'medium', 'high', 'critical'].indexOf(i.priority) >
                         ['low', 'medium', 'high', 'critical'].indexOf(w) ? i.priority : w), 'low'),
                ),
                category: rule.category,
                incidents,
                summary: rule.message(METRICS),
                database: METRICS.databaseName,
            });
            console.log(renderPlainText(structured));
            if (SHOW_SLACK) printSlack(structured);
        }
    }

    if (COMMIT && written.length) {
        console.log(`\n${GREEN}Wrote ${written.length} incident(s):${OFF} ${written.join(', ')}`);
        console.log(`${DIM}  SELECT * FROM pgmonitoringtool.incidents WHERE id = ANY(ARRAY['${written.join("','")}']);${OFF}`);

        if (CLEANUP) {
            await pool.query(`DELETE FROM pgmonitoringtool.incidents WHERE id = ANY($1::text[])`, [written]);
            console.log(`${YELLOW}Cleaned up — ${written.length} incident(s) deleted.${OFF}`);
            console.log(`${DIM}  Alert rows in pgmonitoringtool.alerts were left in place.${OFF}`);
        } else {
            console.log(
                `\n${DIM}These are real open incidents and will escalate on their SLA. ` +
                `Remove them with:${OFF}\n` +
                `  DELETE FROM pgmonitoringtool.incidents WHERE id = ANY(ARRAY['${written.join("','")}']);`,
            );
        }
    }

    await pool.end();
}

// Marks placeholder IDs in dry-run output so nobody quotes one in a ticket.
const DIM_MARK = ' (dry)';

function printSlack(structured: any) {
    console.log(`\n${DIM}── as Slack would render it ──${OFF}\n`);
    const payload = renderSlackBlocks(structured);
    console.log(`${DIM}notification text:${OFF} ${payload.text}\n`);
    for (const block of payload.attachments[0].blocks) {
        if (block.type === 'header') console.log(`${BOLD}${block.text.text}${OFF}`);
        else if (block.fields) console.log(block.fields.map((f: any) => f.text.replace('\n', ': ')).join('   '));
        else if (block.type === 'divider') console.log(DIM + '─'.repeat(40) + OFF);
        else if (block.type === 'actions') {
            // Buttons: show the label and the action_id, since the action_id is
            // what the interactions endpoint dispatches on.
            console.log(
                `${CYAN}[ ${block.elements.map((e: any) => `${e.text.text}${DIM} → ${e.action_id}${OFF}${CYAN}`).join(' ] [ ')} ]${OFF}`,
            );
        }
        else if (block.text?.text) console.log(block.text.text);
        // A context block's elements are {type, text}; an actions block's are
        // buttons and were handled above.
        else if (block.elements) console.log(DIM + block.elements.map((e: any) => e.text).join('') + OFF);
    }
}

main().catch((err) => {
    console.error(`${RED}${err.stack || err.message}${OFF}`);
    process.exit(1);
});
