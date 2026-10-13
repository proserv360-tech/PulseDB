// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
// ==========================================================================
//  FATHOM — Enhanced Alert System Module
// ==========================================================================

import { v4 as uuid } from 'uuid';
import { sendSlackAlert, updateAlertMessage } from './slackService.js';
import { NotifierManager } from './notifiers/index.js';
import { buildNotifiersForOrg, recordDispatchResult } from './destinationService.js';
import { anomalyEvaluator } from './anomaly/index.js';
import { getVacuumForecast } from './vacuumForecastService.js';
import { getPlanRegressions } from './planInsightsService.js';
import { getRecoveryWindow } from './pitrService.js';
import { swallow, swallowWith } from './errorHandling.js';
import { buildStructuredAlert, buildIncidentAlert, renderPlainText } from './alertFormatter.js';
import {
    openIncident, mapPriority, severityForPriority, maxPriority, recordNotification,
    autoCloseStale, escalateOverdue,
} from './incidentService.js';

function log(level, message, meta = {}) {
    const entry = { ts: new Date().toISOString(), level, msg: message, ...meta };
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(JSON.stringify(entry));
}

// Below this many live rows, a dead-tuple ratio is noise rather than bloat.
const MIN_BLOAT_LIVE_TUPLES = Number(process.env.FATHOM_BLOAT_MIN_ROWS) || 1000;

/**
 * Pick the part of the metrics snapshot a given rule is actually about.
 *
 * fire() used to receive the whole snapshot, so every Slack alert carried the
 * full fleet state — connections, cache ratio, every bloated table and the
 * entire vacuum forecast — hundreds of lines of JSON in which the one relevant
 * number was buried. This keeps the payload to what explains the alert.
 */
const RULE_CONTEXT = {
    high_connections:     (m) => ({ active: m.activeConnections, max: m.maxConnections }),
    // critical_connections was merged into high_connections — one metric, one
    // rule, four priority bands. Entry kept so historical alerts still render.
    critical_connections: (m) => ({ active: m.activeConnections, max: m.maxConnections }),
    slow_queries:         (m) => ({
        count: m.slowQueries?.length,
        longest: m.slowQueries?.[0]
            ? { seconds: m.slowQueries[0].duration_sec,
                query: String(m.slowQueries[0].query || '').slice(0, 200) }
            : null,
    }),
    low_cache_hit:        (m) => ({ cacheHitRatio: m.cacheHitRatio }),
    high_bloat:           (m) => ({
        tables: (m.bloatedTables || []).slice(0, 5).map((t) => ({
            table: t.table_name,
            deadTuples: Number(t.dead_tuples),
            bloatPct: Number(t.bloat_ratio_pct),
        })),
    }),
    replication_lag:      (m) => ({ lagMb: m.replicationLag }),
    blocking_locks:       (m) => ({ blockingLocks: m.blockingLocks }),
    disk_space_warning:   (m) => ({ diskUsedGB: m.diskUsedGB }),
    vacuum_overdue:       (m) => ({
        overdue: m.vacuumForecast?.summary?.overdue,
        soon: m.vacuumForecast?.summary?.soon,
    }),
};

/** Fallback: scalars only, so an unmapped rule still sends something small. */
function scalarsOnly(metrics) {
    const out = {};
    for (const [k, v] of Object.entries(metrics || {})) {
        if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) out[k] = v;
    }
    return out;
}

function contextFor(ruleId, metrics) {
    try {
        return RULE_CONTEXT[ruleId] ? RULE_CONTEXT[ruleId](metrics) : scalarsOnly(metrics);
    } catch {
        return scalarsOnly(metrics);
    }
}

class EnhancedAlertEngine {
    constructor(pool, config, emailService = null, targetProvider = null) {
        // Yields the databases to monitor; see runMonitoring().
        this.targetProvider = targetProvider;
        this.pool = pool;
        this.config = config;
        this.emailService = emailService;
        this.subscribers = new Set();
        this.dedup = new Map();
        this.monitoringInterval = null;
        this.alertRules = this.initializeAlertRules();
    }

    /**
     * Alert rules.
     *
     * Every rule now supplies `objects(metrics)` in addition to the legacy
     * `condition`/`message` pair. `objects` returns one entry per thing that is
     * actually wrong — a table, a query, a replica, or the database itself when
     * the metric is instance-wide. Each entry carries the raw measurement and a
     * suggested fix; `_monitorTarget` turns them into per-object incidents.
     *
     * `message` is kept as the fallback for the case where every incident write
     * fails, and so a rule can be added without immediately modelling objects.
     *
     * ── Thresholds ──────────────────────────────────────────────────────────
     * Four bands per rule, matching the triage scale. The lowest band is the
     * existing configured threshold, so nothing starts alerting that wasn't
     * already; the higher bands only change how urgent it looks.
     */
    initializeAlertRules() {
        const T = () => this.config.ALERT_THRESHOLDS;

        // Instance-wide metrics have no schema or table. They still need an
        // object so they get an incident, an owner and an SLA like everything
        // else — the object is the database.
        const wholeDatabase = (metrics, extra) => [{
            schema: null,
            object: metrics.databaseName || metrics.database || 'database',
            ...extra,
        }];

        return [
            {
                id: 'high_connections',
                name: 'High Connection Usage',
                category: 'resources',
                severity: 'warning',
                objectType: 'database',
                metricLabel: 'Conn %',
                // Absorbs the old `critical_connections` rule. Two rules over
                // one metric meant a database at 96% opened two incidents for
                // the same problem, one of which would never be closed
                // separately. The 95% line survives as the critical band.
                thresholds: () => ({ critical: 95, high: 90, medium: T().CONNECTION_USAGE_PCT }),
                condition: (metrics) =>
                    (metrics.activeConnections / metrics.maxConnections) * 100 > T().CONNECTION_USAGE_PCT,
                objects: (metrics) => {
                    const usage = (metrics.activeConnections / metrics.maxConnections) * 100;
                    return wholeDatabase(metrics, {
                        metricValue: usage,
                        metricDisplay: `${usage.toFixed(1)}%`,
                        fixSuggestion: usage > 95 ? 'Add PgBouncer / raise max_connections' : 'Review connection pooling',
                        detail: `${metrics.activeConnections} of ${metrics.maxConnections} connections in use.`,
                    });
                },
                message: (metrics) => {
                    const usage = ((metrics.activeConnections / metrics.maxConnections) * 100).toFixed(1);
                    return `Connection usage at ${usage}% (${metrics.activeConnections}/${metrics.maxConnections})`;
                },
            },
            {
                id: 'slow_queries',
                name: 'Slow Queries Detected',
                category: 'performance',
                severity: 'warning',
                objectType: 'query',
                metricLabel: 'Seconds',
                thresholds: () => ({ critical: 300, high: 60, medium: T().LONG_QUERY_SEC }),
                condition: (metrics) => metrics.slowQueries && metrics.slowQueries.length > 0,
                objects: (metrics) =>
                    (metrics.slowQueries || []).map((q) => ({
                        schema: null,
                        // queryid is stable across executions; the text is not,
                        // so an incident keyed on the text would reopen on every
                        // parameter change.
                        object: q.queryid ? `query ${q.queryid}` : String(q.query || 'unknown').slice(0, 60),
                        metricValue: Number(q.duration_sec) || 0,
                        metricDisplay: `${(Number(q.duration_sec) || 0).toFixed(1)}s`,
                        fixSuggestion: 'EXPLAIN ANALYZE; check indexes',
                        detail: String(q.query || '').slice(0, 300),
                    })),
                message: (metrics) =>
                    `${metrics.slowQueries.length} slow queries detected (>${T().LONG_QUERY_SEC}s)`,
            },
            {
                id: 'low_cache_hit',
                name: 'Low Cache Hit Ratio',
                category: 'performance',
                severity: 'warning',
                objectType: 'database',
                // Stored and ranked as miss %, not hit %. mapPriority ranks
                // ascending — a metric where lower is worse has to be inverted
                // or every threshold comparison runs backwards.
                metricLabel: 'Cache miss %',
                thresholds: () => ({ critical: 20, high: 10, medium: 100 - T().CACHE_HIT_RATIO }),
                condition: (metrics) =>
                    metrics.cacheHitRatio != null && parseFloat(metrics.cacheHitRatio) < T().CACHE_HIT_RATIO,
                objects: (metrics) => {
                    const miss = 100 - parseFloat(metrics.cacheHitRatio);
                    return wholeDatabase(metrics, {
                        metricValue: miss,
                        metricDisplay: `${miss.toFixed(1)}%`,
                        fixSuggestion: 'Raise shared_buffers / review working set',
                        detail: `Cache hit ratio ${metrics.cacheHitRatio}% against a ${T().CACHE_HIT_RATIO}% target.`,
                    });
                },
                message: (metrics) =>
                    `Cache hit ratio is ${metrics.cacheHitRatio}% (threshold: ${T().CACHE_HIT_RATIO}%)`,
            },
            {
                id: 'high_bloat',
                name: 'High Table Bloat',
                category: 'maintenance',
                severity: 'warning',
                objectType: 'table',
                metricLabel: 'Bloat %',
                thresholds: () => ({ critical: 60, high: 40, medium: 20 }),
                condition: (metrics) => metrics.bloatedTables && metrics.bloatedTables.length > 0,
                objects: (metrics) =>
                    (metrics.bloatedTables || []).map((t) => {
                        const pct = Number(t.bloat_ratio_pct) || 0;
                        return {
                            schema: t.schema_name || t.schemaname || 'public',
                            object: t.table_name,
                            metricValue: pct,
                            metricDisplay: `${pct.toFixed(1)}%`,
                            // Same tiering recommendVacuum() uses, so the fix
                            // and the priority can never disagree.
                            fixSuggestion: pct >= 40 ? 'VACUUM (FULL, ANALYZE)' : 'VACUUM ANALYZE',
                            fixSql: `VACUUM (${pct >= 40 ? 'FULL, ' : ''}VERBOSE), ANALYZE ` +
                                    `"${t.schema_name || t.schemaname || 'public'}"."${String(t.table_name).replace(/"/g, '""')}";`,
                            detail: `${t.dead_tuples ?? 'unknown'} dead tuples.`,
                        };
                    }),
                message: (metrics) => {
                    const worst = metrics.bloatedTables[0];
                    return `${metrics.bloatedTables.length} tables with high bloat detected. ` +
                           `Worst: ${worst.table_name} (${worst.bloat_ratio_pct}%)`;
                },
            },
            {
                id: 'replication_lag',
                name: 'Replication Lag Detected',
                category: 'reliability',
                severity: 'critical',
                objectType: 'replica',
                metricLabel: 'Lag (MB)',
                thresholds: () => ({
                    critical: T().REPLICATION_LAG_MB * 10,
                    high: T().REPLICATION_LAG_MB * 4,
                    medium: T().REPLICATION_LAG_MB,
                }),
                condition: (metrics) =>
                    metrics.replicationLag != null &&
                    metrics.replicationLag > T().REPLICATION_LAG_MB * 1024 * 1024,
                objects: (metrics) => {
                    const lagMB = metrics.replicationLag / (1024 * 1024);
                    return wholeDatabase(metrics, {
                        metricValue: lagMB,
                        metricDisplay: `${lagMB.toFixed(2)} MB`,
                        fixSuggestion: 'Check replica I/O and network; review wal_keep_size',
                        detail: 'Standby is behind the primary.',
                    });
                },
                message: (metrics) => `Replication lag: ${(metrics.replicationLag / (1024 * 1024)).toFixed(2)} MB`,
            },
            {
                id: 'blocking_locks',
                name: 'Blocking Locks Detected',
                category: 'reliability',
                severity: 'critical',
                objectType: 'database',
                metricLabel: 'Locks',
                thresholds: () => ({ critical: T().LOCK_COUNT * 5, high: T().LOCK_COUNT * 2, medium: T().LOCK_COUNT }),
                condition: (metrics) => metrics.blockingLocks != null && metrics.blockingLocks >= T().LOCK_COUNT,
                objects: (metrics) =>
                    wholeDatabase(metrics, {
                        metricValue: Number(metrics.blockingLocks) || 0,
                        metricDisplay: String(metrics.blockingLocks),
                        fixSuggestion: 'Inspect pg_locks; terminate the blocker',
                        detail: 'Sessions are waiting on locks held by another session.',
                    }),
                message: (metrics) => `${metrics.blockingLocks} blocking locks detected`,
            },
            {
                id: 'disk_space_warning',
                name: 'High Disk Usage',
                category: 'resources',
                severity: 'warning',
                objectType: 'database',
                metricLabel: 'Size (GB)',
                thresholds: () => ({ critical: 500, high: 200, medium: 50 }),
                condition: (metrics) => metrics.diskUsedGB && metrics.diskUsedGB > 50,
                objects: (metrics) =>
                    wholeDatabase(metrics, {
                        metricValue: Number(metrics.diskUsedGB) || 0,
                        metricDisplay: `${metrics.diskUsedGB} GB`,
                        fixSuggestion: 'Review retention; archive or partition large tables',
                        detail: 'Database size past the configured watermark.',
                    }),
                message: (metrics) => `Database size: ${metrics.diskUsedGB} GB`,
            },
            {
                id: 'vacuum_overdue',
                name: 'VACUUM Overdue (predictive)',
                category: 'maintenance',
                severity: 'warning',
                objectType: 'table',
                metricLabel: 'Dead %',
                thresholds: () => ({ critical: 40, high: 25, medium: 10 }),
                condition: (metrics) => (metrics.vacuumForecast?.summary?.overdue ?? 0) > 0,
                objects: (metrics) =>
                    (metrics.vacuumForecast?.tables || [])
                        .filter((t) => t.urgency === 'overdue')
                        .map((t) => ({
                            schema: t.schema,
                            object: t.table,
                            metricValue: Number(t.deadPct) || 0,
                            metricDisplay: `${t.deadPct}%`,
                            fixSuggestion: 'VACUUM ANALYZE',
                            fixSql: `VACUUM (VERBOSE), ANALYZE "${t.schema}"."${String(t.table).replace(/"/g, '""')}";`,
                            detail: 'Autovacuum has not kept up.',
                        })),
                message: (metrics) => {
                    const worst = (metrics.vacuumForecast.tables || []).find((t) => t.urgency === 'overdue');
                    return `${metrics.vacuumForecast.summary.overdue} table(s) overdue for VACUUM` +
                           (worst ? ` — worst: ${worst.schema}.${worst.table} (${worst.deadPct}% dead)` : '');
                },
            },
            {
                id: 'plan_regression',
                name: 'Query Plan Regression',
                category: 'performance',
                severity: 'warning',
                objectType: 'query',
                metricLabel: 'Slower %',
                thresholds: () => ({ critical: 500, high: 200, medium: 50 }),
                condition: (metrics) => Array.isArray(metrics.planRegressions) && metrics.planRegressions.length > 0,
                objects: (metrics) =>
                    (metrics.planRegressions || []).map((r) => ({
                        schema: null,
                        object: `query ${r.queryId}`,
                        metricValue: Number(r.slowdownPct) || 0,
                        metricDisplay: `+${r.slowdownPct}%`,
                        fixSuggestion: 'Compare plans; ANALYZE or pin the plan',
                        detail: `Regressed on connection ${r.connectionId}.`,
                    })),
                message: (metrics) => {
                    const w = metrics.planRegressions[0];
                    return `${metrics.planRegressions.length} query plan regression(s) detected` +
                           (w ? ` — query ${w.queryId} +${w.slowdownPct}% slower (conn ${w.connectionId})` : '');
                },
            },
            {
                id: 'pitr_rpo_breach',
                name: 'PITR Window Below RPO Target',
                category: 'reliability',
                severity: 'critical',
                objectType: 'connection',
                metricLabel: 'Behind (h)',
                thresholds: () => ({ critical: 24, high: 6, medium: 1 }),
                condition: (metrics) => Array.isArray(metrics.pitrBreaches) && metrics.pitrBreaches.length > 0,
                objects: (metrics) =>
                    (metrics.pitrBreaches || []).map((b) => ({
                        schema: null,
                        object: `connection ${b.connectionId}`,
                        // A PITR that isn't feasible at all is worse than any
                        // measurable lag, so it takes the top band rather than
                        // falling to `low` on a missing number.
                        metricValue: b.lagHours != null ? Number(b.lagHours) : Number.MAX_SAFE_INTEGER,
                        metricDisplay: b.lagHours != null ? `${b.lagHours}h` : 'not feasible',
                        fixSuggestion: b.lagHours != null ? 'Investigate WAL archiving' : 'Restore backup chain',
                        detail: b.lagHours != null ? `RPO target ${b.rpoHours}h.` : String(b.reason || ''),
                    })),
                message: (metrics) => {
                    const b = metrics.pitrBreaches[0];
                    const more = metrics.pitrBreaches.length > 1 ? ` (+${metrics.pitrBreaches.length - 1} more)` : '';
                    return b.lagHours != null
                        ? `PITR window for connection ${b.connectionId} is ${b.lagHours}h behind (RPO ${b.rpoHours}h)${more}`
                        : `PITR not feasible for connection ${b.connectionId}: ${b.reason}${more}`;
                },
            },
        ];
    }

    /**
     * Fire an alert about a set of affected objects.
     *
     * This is the generic path every category should use. A rule supplies the
     * objects and their measurements; this opens one incident per object,
     * assigns priority from the rule's thresholds, resolves owners and SLA
     * dates, then sends a single grouped notification containing all of them.
     *
     * Nothing here knows what the metric means. Bloat, replication lag, lock
     * waits and cache hit ratio all fill in the same shape — the only
     * category-specific input is `thresholds` and how `metricDisplay` is
     * formatted.
     *
     * @param {object} spec
     * @param {string} spec.title
     * @param {string} spec.ruleId
     * @param {string} spec.metricLabel  — column header, e.g. 'Bloat %'
     * @param {{critical:number, high:number, medium:number}} spec.thresholds
     * @param {Array<{schema?, object?, metricValue, metricDisplay?, fixSuggestion?, fixSql?}>} spec.objects
     */
    async fireObjectAlert(spec = {}) {
        const {
            title, category = 'general', ruleId = null, metricLabel = null,
            thresholds = {}, objects = [], summary = null,
            connectionId = null, database = null, orgId = null,
            objectType = 'table',
        } = spec;

        if (!objects.length) return null;

        const incidents = [];
        let worstPriority = 'low';

        for (const o of objects) {
            const priority = o.priority || mapPriority(o.metricValue, thresholds);
            worstPriority = maxPriority(worstPriority, priority);

            const incident = await openIncident(this.pool, {
                title: `${title} — ${[o.schema, o.object].filter(Boolean).join('.')}`,
                description: o.detail ?? null,
                category, ruleId, connectionId, orgId,
                database, schema: o.schema, object: o.object, objectType,
                metricValue: o.metricValue,
                metricLabel,
                metricDisplay: o.metricDisplay ?? String(o.metricValue),
                priority,
                fixSuggestion: o.fixSuggestion ?? null,
                fixSql: o.fixSql ?? null,
            });
            if (incident) incidents.push(incident);
        }

        // Every incident write failed — the table is missing or the database is
        // down. Still send the alert: a notification without incident numbers
        // beats silence.
        if (!incidents.length) {
            return this.fire(severityForPriority(worstPriority), category,
                `${title} (${objects.length} object(s); incident records unavailable)`,
                { connectionId, orgId, database, ruleId });
        }

        const severity = severityForPriority(worstPriority);
        const structured = buildIncidentAlert({
            title, severity, category, incidents, summary, connectionId, database,
        });

        const alert = await this.fire(severity, category, renderPlainText(structured), {
            connectionId, orgId, database, ruleId,
            priority: worstPriority,
            incidentIds: incidents.map((i) => i.id),
            structured,
        });

        if (alert?.id) {
            await this.pool
                .query(
                    `UPDATE pgmonitoringtool.incidents SET alert_id = $1 WHERE id = ANY($2::text[])`,
                    [alert.id, incidents.map((i) => i.id)],
                )
                .catch((err) => swallow(err, { component: 'alerts', op: 'linkIncidentAlert' }));

            // Which channels were configured, recorded per incident so the
            // "Notification Channel" column reflects what was actually tried.
            const channels = ['in_app'];
            if (this.emailService) channels.push('email');
            if (process.env.SLACK_BOT_TOKEN || process.env.SLACK_WEBHOOK_URL) channels.push('slack');
            for (const i of incidents) await recordNotification(this.pool, i.id, channels);
        }

        return { alert, incidents };
    }

    /**
     * Fire an alert that carries a findings table and suggested fixes.
     *
     * Opens (or touches) an incident first so the notification can quote the
     * number, then hands off to fire(). The plain-text rendering becomes
     * `message`, which keeps every existing consumer working — the alerts list,
     * email, PagerDuty — while `data.structured` lets renderers that understand
     * the shape do better. Slack does.
     *
     * @param {object} spec — as produced by a builder such as buildBloatAlert()
     */
    async fireStructured(spec = {}) {
        const {
            title, severity = 'warning', category = 'general', ruleId = null,
            columns = [], rows = [], suggestions = [], summary = null,
            connectionId = null, database = null, orgId = null,
        } = spec;

        // The incident is opened before the alert exists, so alertId is filled
        // in afterwards. Worth the extra UPDATE: the number has to be in the
        // message, and the message is built here.
        const incident = await openIncident(this.pool, {
            title, description: summary, severity, category, ruleId,
            connectionId, orgId, findings: rows, suggestions,
        });

        const structured = buildStructuredAlert({
            title, severity, category, columns, rows, suggestions, summary,
            connectionId, database,
            incidentId: incident?.id ?? null,
        });

        const alert = await this.fire(severity, category, renderPlainText(structured), {
            connectionId, orgId, database, ruleId,
            incidentId: incident?.id ?? null,
            occurrences: incident?.occurrences ?? 1,
            structured,
        });

        if (incident?.id && alert?.id) {
            await this.pool
                .query(`UPDATE pgmonitoringtool.incidents SET alert_id = $1 WHERE id = $2`, [alert.id, incident.id])
                .catch((err) => swallow(err, { component: 'alerts', op: 'linkIncidentAlert' }));
        }

        return { alert, incident };
    }

    async fire(severity, category, message, data = {}) {
        // Scoped by connection: two databases hitting the same threshold are
        // two incidents, and must not suppress one another.
        //
        // Prefer ruleId over the message text when the caller supplies one.
        // Structured alerts embed live figures ("34.2%", "1.4 GiB") in the
        // message, so a message-keyed dedup would see a different string on
        // every poll and suppress nothing — the 5-minute window would be
        // silently inert for exactly the alerts most likely to repeat.
        const dedupSubject = data?.ruleId ?? message;
        const key = `${data?.connectionId ?? 'local'}:${category}:${severity}:${dedupSubject}`;

        if (this.dedup.get(key) && Date.now() - this.dedup.get(key) < 300_000) {
            return null;
        }
        this.dedup.set(key, Date.now());

        // `data.orgId` is the preferred carrier for per-tenant routing. Falls
        // back to data.organizationId, then to FATHOM_DEFAULT_ORG_ID.
        //
        // That last fallback matters: none of the three .fire() call sites —
        // the manual-alert route, anomaly detection, or threshold rules — pass
        // an orgId, so without it alert.orgId is always null and the per-org
        // fan-out in _fanOutToOrgIntegrations never runs. Slack, PagerDuty and
        // the rest would stay silent no matter how they were configured.
        //
        // On a single-tenant deployment set FATHOM_DEFAULT_ORG_ID to that org.
        // Leave it unset for multi-tenant, where an alert with no org genuinely
        // should not be routed to any tenant's destinations.
        const defaultOrgId = process.env.FATHOM_DEFAULT_ORG_ID
            ? Number(process.env.FATHOM_DEFAULT_ORG_ID)
            : null;
        const orgId =
            data?.orgId ?? data?.organizationId ?? (Number.isFinite(defaultOrgId) ? defaultOrgId : null);

        const alert = {
            id: uuid(),
            timestamp: new Date().toISOString(),
            severity,
            category,
            message,
            data,
            orgId,
            acknowledged: false,
            acknowledged_by: null,
            acknowledged_at: null,
        };

        try {
            await this.pool.query(
                `INSERT INTO pgmonitoringtool.alerts (id, timestamp, severity, category, message, data, acknowledged)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    alert.id,
                    alert.timestamp,
                    alert.severity,
                    alert.category,
                    alert.message,
                    JSON.stringify(alert.data),
                    alert.acknowledged,
                ],
            );

            // C5: proactive AI RCA — fire-and-forget. The worker tier
            // (or the in-process queue in dev) picks this up and assembles
            // the context bundle. Failure here must never block the
            // alert fan-out, so we swallow errors.
            try {
                const { enqueueRca } = await import('./alertRcaService.js');
                enqueueRca(alert).catch(swallowWith({ component: 'alerts', op: 'enqueueRca' }));
            } catch (err) {
                swallow(err, { component: 'alerts', op: 'importAlertRcaService' });
            }

            this.broadcast({ type: 'alert', payload: alert });

            if (this.emailService) {
                this.emailService
                    .sendAlert(alert)
                    .catch((err) => log('ERROR', 'Failed to send alert email', { error: err.message }));
            }

            // ── Slack notification ─────────────────────────────────────────
            // Two independent paths can deliver to Slack, and for a while both
            // were firing: the legacy global SLACK_WEBHOOK_URL below, and the
            // per-org fan-out further down. When an org has a Slack destination
            // configured and SLACK_WEBHOOK_URL is also set — the normal state
            // after following the setup docs — every alert arrived twice.
            //
            // The per-org destination wins. It is the multi-tenant path, its
            // secrets are encrypted at rest, and it honours per-destination
            // min_severity. The global webhook is a single-tenant fallback kept
            // for deployments that never migrated to destinations.
            //
            // The exception is a bot token: chat.postMessage returns a message
            // ts, which is what makes acknowledgement update the original
            // message instead of only replying in-thread. Incoming webhooks
            // return nothing, so that capability exists only on this path.
            // Where a bot token is configured we keep it and let the operator
            // disable the redundant destination rather than silently dropping
            // the better integration.
            const slackWebhook = process.env.SLACK_WEBHOOK_URL;
            const hasBotToken = Boolean(process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID);
            const orgHandlesSlack = alert.orgId ? await this._orgHasSlackDestination(alert.orgId) : false;

            if (hasBotToken || !orgHandlesSlack) {
                sendSlackAlert(alert, slackWebhook)
                    .then(async (slackTs) => {
                        if (slackTs) {
                            // Persist the Slack message ts so we can update/thread later
                            await this.pool
                                .query(`UPDATE pgmonitoringtool.alerts SET slack_ts = $1 WHERE id = $2`, [slackTs, alert.id])
                                .catch((err) => log('ERROR', 'Failed to store slack_ts', { error: err.message }));
                            alert.slack_ts = slackTs;
                        }
                    })
                    .catch((err) => log('ERROR', 'Failed to send Slack alert', { error: err.message }));
            } else if (slackWebhook) {
                log('DEBUG', 'Skipping legacy global Slack webhook — org has its own Slack destination', {
                    orgId: alert.orgId,
                    hint: 'Unset SLACK_WEBHOOK_URL to silence this, or disable the destination to use the global webhook instead.',
                });
            }

            // ── Per-org integration fan-out ────────────────────────────────
            // Loads every enabled destination the org has configured (Slack,
            // PagerDuty, Opsgenie, Teams, generic webhook) and dispatches in
            // parallel via NotifierManager. Best-effort — failures never
            // propagate to the caller or crash the alert loop.
            if (alert.orgId) {
                this._fanOutToOrgIntegrations(alert).catch((err) =>
                    log('ERROR', 'Per-org integration fan-out failed', { error: err.message }),
                );
            }

            return alert;
        } catch (error) {
            log('ERROR', 'Failed to save alert', { error: error.message });
            return alert; // still return so caller has the object
        }
    }

    /**
     * Does this org already receive Slack through its own destination?
     *
     * Used to decide whether the legacy global webhook should also fire. Called
     * on every alert, so the answer is cached briefly — destinations change at
     * human speed, and an extra round trip per alert on a serverless pool is
     * not worth the freshness.
     *
     * Never throws. On error it reports false, which prefers a possible
     * duplicate over a silently dropped alert: a message arriving twice is
     * annoying, one that never arrives is an outage nobody hears about.
     */
    async _orgHasSlackDestination(orgId) {
        const TTL_MS = 60_000;
        this._slackDestCache ??= new Map();

        const cached = this._slackDestCache.get(orgId);
        if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

        let value = false;
        try {
            const { rows } = await this.pool.query(
                `SELECT 1
                   FROM pgmonitoringtool.notification_destinations
                  WHERE org_id = $1 AND provider = 'slack' AND enabled = true
                  LIMIT 1`,
                [orgId],
            );
            value = rows.length > 0;
        } catch (error) {
            // The table is absent on databases that never ran migration 0025.
            // That is the single-tenant case the global webhook exists for, so
            // false is also the correct answer here, not just the safe one.
            log('DEBUG', 'Could not check org Slack destinations', { error: error.message });
        }

        this._slackDestCache.set(orgId, { value, at: Date.now() });
        return value;
    }

    /**
     * Dispatch an alert to every enabled destination the organisation has
     * configured. Never throws — all errors are captured and logged so the
     * alert loop stays live if one provider is misbehaving.
     *
     * Each destination is a row in pgmonitoringtool.notification_destinations.
     * The NotifierManager provides per-alert-id dedupe and exponential
     * backoff retry across the whole fan-out.
     */
    async _fanOutToOrgIntegrations(alert) {
        const entries = await buildNotifiersForOrg(this.pool, alert.orgId);
        if (entries.length === 0) return;

        const notifiers = entries.map((e) => e.notifier);
        const manager = new NotifierManager({ notifiers });

        // Adapt the internal alert shape to the notifier contract.
        const structured = alert.data?.structured || null;

        // `metadata` is rendered as a key/value block by several notifiers.
        // The structured payload is already the body of the message — echoing
        // it here produced a "structured: title: …, severity: …" line under
        // every alert, restating what the reader just read.
        const metadata = { ...(alert.data || {}) };
        delete metadata.structured;

        const dispatched = await manager.dispatch({
            id: alert.id,
            dedupKey: `${alert.orgId}:${alert.category}:${alert.severity}:${alert.id}`,
            severity: alert.severity,
            // With a structured payload the title is the headline alone; the
            // table lives in blocks. Without one, the message IS the title,
            // as before.
            title: structured ? structured.title : alert.message,
            message: alert.message,
            source: 'fathom',
            component: alert.category,
            timestamp: alert.timestamp,
            metadata,
            // Notifiers that understand the structured shape render the real
            // tables; the rest fall back to `message`, which is the same plain
            // text they got before. Adding a field is safe for all of them.
            structured,
            resolved: false,
        });

        // Record per-destination outcome so the UI can show "last status".
        // The notifier's name is prefixed `provider:name` by buildNotifierFromRow,
        // so we tie it back to the destination via index alignment (parallel
        // arrays — simpler than a reverse lookup).
        await Promise.all(
            dispatched.map((d, i) => {
                const destId = entries[i]?.destId;
                if (!destId) return Promise.resolve();
                return recordDispatchResult(this.pool, destId, d.result);
            }),
        );
    }

    /**
     * Escalate an existing alert to the organisation's on-call rotation.
     *
     * Triggered by the Slack `/escalate <alert-id>` command (and re-usable by
     * any future "page on-call" UI action). Loads the stored alert, then fans
     * out a forced *critical* PagerDuty/Opsgenie trigger through the same
     * NotifierManager pipeline used for normal alerts — so dedupe, retry and
     * per-destination status recording all apply.
     *
     * The escalation is given its own dedupKey (suffixed `:escalate`) so it
     * pages even if the underlying alert already deduped on its first fire.
     *
     * Never throws — returns a summary object the caller can surface to Slack.
     *
     * @param {string} alertId
     * @param {string} [username='unknown'] — who triggered the escalation
     * @returns {Promise<{ok:boolean, paged:number, alertId:string,
     *                     results?:Array, error?:string, reason?:string}>}
     */
    async escalate(alertId, username = 'unknown') {
        if (!alertId) return { ok: false, alertId, paged: 0, error: 'alertId is required' };
        if (!this.pool) {
            return { ok: false, alertId, paged: 0, error: 'No admin database configured' };
        }

        // 1. Load the stored alert.
        let alert;
        try {
            const { rows } = await this.pool.query(`SELECT * FROM pgmonitoringtool.alerts WHERE id = $1 LIMIT 1`, [alertId]);
            if (rows.length === 0) {
                return { ok: false, alertId, paged: 0, reason: 'alert_not_found' };
            }
            const row = rows[0];
            alert = {
                ...row,
                data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {},
            };
        } catch (error) {
            log('ERROR', 'Escalation: failed to load alert', { error: error.message, alertId });
            return { ok: false, alertId, paged: 0, error: error.message };
        }

        // 2. Resolve the org. orgId may live on the row or inside the data blob.
        const orgId = alert.org_id || alert.orgId || alert.data?.orgId || alert.data?.org_id;
        if (!orgId) {
            log('WARN', 'Escalation: alert has no orgId — cannot page on-call', { alertId });
            return { ok: false, alertId, paged: 0, reason: 'no_org' };
        }

        // 3. Build the org's notifiers and dispatch a forced critical trigger.
        try {
            const entries = await buildNotifiersForOrg(this.pool, orgId);
            if (entries.length === 0) {
                return { ok: false, alertId, paged: 0, reason: 'no_destinations' };
            }

            const notifiers = entries.map((e) => e.notifier);
            const manager = new NotifierManager({ notifiers });

            const dispatched = await manager.dispatch({
                id: alert.id,
                dedupKey: `${orgId}:escalate:${alert.id}`,
                severity: 'critical',
                title: `[ESCALATED] ${alert.message}`,
                message: `${alert.message}\n\nManually escalated to on-call by @${username}.`,
                source: 'fathom',
                component: alert.category,
                class: 'escalation',
                timestamp: new Date().toISOString(),
                metadata: {
                    ...(alert.data || {}),
                    escalatedBy: username,
                    escalatedAt: new Date().toISOString(),
                    originalSeverity: alert.severity,
                    alertId: alert.id,
                },
                resolved: false,
            });

            await Promise.all(
                dispatched.map((d, i) => {
                    const destId = entries[i]?.destId;
                    if (!destId) return Promise.resolve();
                    return recordDispatchResult(this.pool, destId, d.result);
                }),
            );

            const paged = dispatched.filter((d) => d.result?.ok && !d.result?.deduped).length;
            log('INFO', 'Alert escalated to on-call', { alertId, orgId, username, paged });

            this.broadcast({
                type: 'alert_escalated',
                payload: { alertId, escalatedBy: username, escalatedAt: new Date().toISOString(), paged },
            });

            return { ok: paged > 0, alertId, paged, results: dispatched };
        } catch (error) {
            log('ERROR', 'Escalation fan-out failed', { error: error.message, alertId });
            return { ok: false, alertId, paged: 0, error: error.message };
        }
    }

    async getRecent(limit = 50, includeAcknowledged = false) {
        try {
            const query = includeAcknowledged
                ? `SELECT * FROM pgmonitoringtool.alerts ORDER BY timestamp DESC LIMIT $1`
                : `SELECT * FROM pgmonitoringtool.alerts WHERE acknowledged = false ORDER BY timestamp DESC LIMIT $1`;

            const result = await this.pool.query(query, [limit]);
            return result.rows.map((row) => ({
                ...row,
                data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
            }));
        } catch (error) {
            log('ERROR', 'Failed to fetch alerts', { error: error.message });
            return [];
        }
    }

    async acknowledge(alertId, userId, username) {
        try {
            const result = await this.pool.query(
                `UPDATE pgmonitoringtool.alerts
                 SET acknowledged = true, acknowledged_by = $2, acknowledged_at = NOW()
                 WHERE id = $1
                 RETURNING *`,
                [alertId, username],
            );

            if (result.rows.length > 0) {
                const updatedAlert = result.rows[0];

                this.broadcast({
                    type: 'alert_acknowledged',
                    payload: {
                        alertId,
                        acknowledgedBy: username,
                        acknowledgedAt: new Date().toISOString(),
                    },
                });

                // ── Sync acknowledgement back to Slack message ──────────
                if (updatedAlert.slack_ts) {
                    updateAlertMessage(updatedAlert.slack_ts, updatedAlert).catch((err) =>
                        log('ERROR', 'Failed to update Slack message on acknowledge', { error: err.message }),
                    );
                }

                return updatedAlert;
            }
            return null;
        } catch (error) {
            log('ERROR', 'Failed to acknowledge alert', { error: error.message });
            throw error;
        }
    }

    async bulkAcknowledge(alertIds, userId, username) {
        try {
            const result = await this.pool.query(
                `UPDATE pgmonitoringtool.alerts
                 SET acknowledged = true, acknowledged_by = $2, acknowledged_at = NOW()
                 WHERE id = ANY($1)
                 RETURNING id`,
                [alertIds, username],
            );

            this.broadcast({
                type: 'alerts_acknowledged',
                payload: {
                    alertIds: result.rows.map((r) => r.id),
                    acknowledgedBy: username,
                    acknowledgedAt: new Date().toISOString(),
                },
            });

            return result.rows;
        } catch (error) {
            log('ERROR', 'Failed to bulk acknowledge alerts', { error: error.message });
            throw error;
        }
    }

    /**
     * Delete a single alert.
     *
     * Deliberately a hard delete rather than a soft `dismissed` flag: alerts
     * are derived state. The monitoring loop regenerates anything still true
     * on its next pass, so a deleted row that mattered comes back on its own,
     * and one that does not come back was noise. A tombstone column would
     * accumulate rows nobody ever queries.
     *
     * @returns the deleted row, or null if the id did not exist
     */
    async remove(alertId, username = 'unknown') {
        try {
            const result = await this.pool.query(
                `DELETE FROM pgmonitoringtool.alerts WHERE id = $1 RETURNING id, severity, category`,
                [alertId],
            );
            if (result.rows.length === 0) return null;

            // Other open dashboards are showing this alert. Without the
            // broadcast they keep it on screen until their next poll and then
            // silently drop it, which reads as a glitch.
            this.broadcast({
                type: 'alert_deleted',
                payload: { alertId, deletedBy: username, deletedAt: new Date().toISOString() },
            });

            return result.rows[0];
        } catch (error) {
            log('ERROR', 'Failed to delete alert', { error: error.message, alertId });
            throw error;
        }
    }

    /**
     * Delete several alerts in one statement.
     *
     * Returns the ids actually removed rather than the count requested — with
     * several people triaging the same list, some of the selection may already
     * be gone, and the caller needs to know which.
     */
    async bulkRemove(alertIds, username = 'unknown') {
        if (!Array.isArray(alertIds) || alertIds.length === 0) return [];
        try {
            const result = await this.pool.query(
                `DELETE FROM pgmonitoringtool.alerts WHERE id = ANY($1) RETURNING id`,
                [alertIds],
            );
            const deleted = result.rows.map((r) => r.id);

            if (deleted.length) {
                this.broadcast({
                    type: 'alerts_deleted',
                    payload: { alertIds: deleted, deletedBy: username, deletedAt: new Date().toISOString() },
                });
            }

            return deleted;
        } catch (error) {
            log('ERROR', 'Failed to bulk delete alerts', { error: error.message, count: alertIds.length });
            throw error;
        }
    }

    async getStatistics(timeRange = '24h') {
        // Whitelist timeRange — never interpolated from user input
        const timeConditions = {
            '1h': "timestamp > NOW() - INTERVAL '1 hour'",
            '24h': "timestamp > NOW() - INTERVAL '24 hours'",
            '7d': "timestamp > NOW() - INTERVAL '7 days'",
            '30d': "timestamp > NOW() - INTERVAL '30 days'",
        };
        const timeCondition = timeConditions[timeRange] ?? timeConditions['24h'];

        try {
            const [summary, categoryBreakdown] = await Promise.all([
                this.pool.query(`
                    SELECT
                        COUNT(*) AS total,
                        COUNT(*) FILTER (WHERE severity = 'critical')   AS critical,
                        COUNT(*) FILTER (WHERE severity = 'warning')    AS warning,
                        COUNT(*) FILTER (WHERE severity = 'info')       AS info,
                        COUNT(*) FILTER (WHERE acknowledged = false)    AS unacknowledged,
                        COUNT(DISTINCT category)                         AS categories_affected
                    FROM pgmonitoringtool.alerts WHERE ${timeCondition}
                `),
                this.pool.query(`
                    SELECT category, COUNT(*) AS count
                    FROM pgmonitoringtool.alerts WHERE ${timeCondition}
                    GROUP BY category ORDER BY count DESC
                `),
            ]);

            return { summary: summary.rows[0], byCategory: categoryBreakdown.rows, timeRange };
        } catch (error) {
            log('ERROR', 'Failed to get alert statistics', { error: error.message });
            return null;
        }
    }

    async cleanup(daysToKeep = 30) {
        // FIX: was template literal SQL injection — now fully parameterized
        try {
            const result = await this.pool.query(
                `DELETE FROM pgmonitoringtool.alerts WHERE timestamp < NOW() - ($1 * INTERVAL '1 day') RETURNING id`,
                [daysToKeep],
            );
            return result.rowCount;
        } catch (error) {
            log('ERROR', 'Failed to cleanup old alerts', { error: error.message });
            return 0;
        }
    }

    /**
     * Advisor signals that back the predictive alert rules (vacuum overdue,
     * plan regression, PITR/RPO breach). These are heavier than the base
     * metric queries, so they are throttled to FATHOM_ADVISOR_INTERVAL_MS
     * (default 5 min) and the last result is reused between runs; the fire()
     * dedup window keeps repeat evaluations from spamming integrations.
     * All queries degrade to empty when their tables are absent.
     */
    async collectAdvisorSignals() {
        const now = Date.now();
        const interval = Number(process.env.FATHOM_ADVISOR_INTERVAL_MS) || 300_000;
        if (this._advisorCache && now - (this._advisorAt || 0) < interval) return this._advisorCache;

        const signals = { vacuumForecast: null, planRegressions: [], pitrBreaches: [] };
        const missing = (e) => /relation .* does not exist/i.test(e.message);

        // 1) Predictive VACUUM — runs on the monitored pool.
        try {
            signals.vacuumForecast = await getVacuumForecast(this.pool, { limit: 200 });
        } catch (e) {
            if (!missing(e)) log('ERROR', 'vacuum forecast signal failed', { error: e.message });
        }

        // 2) Plan regressions — per (workspace, connection) with recent auto_explain events.
        try {
            const pairs = await this.pool.query(
                `SELECT workspace_id, connection_id, count(*) AS n
                   FROM pgmonitoringtool.auto_explain_events
                  WHERE captured_at > now() - interval '24 hours'
                    AND query_id IS NOT NULL AND plan_json IS NOT NULL
                  GROUP BY workspace_id, connection_id
                  HAVING count(*) >= 6
                  ORDER BY n DESC
                  LIMIT 25`,
            );
            for (const pr of pairs.rows) {
                try {
                    const { regressions } = await getPlanRegressions(this.pool, {
                        workspaceId: pr.workspace_id,
                        connectionId: pr.connection_id,
                    });
                    for (const r of regressions || [])
                        signals.planRegressions.push({
                            ...r,
                            workspaceId: pr.workspace_id,
                            connectionId: pr.connection_id,
                        });
                } catch (e) {
                    if (!missing(e)) log('ERROR', 'plan regression pair failed', { error: e.message });
                }
            }
            signals.planRegressions.sort((a, b) => (b.slowdownPct || 0) - (a.slowdownPct || 0));
        } catch (e) {
            if (!missing(e)) log('ERROR', 'plan regression signal failed', { error: e.message });
        }

        // 3) PITR window vs RPO target — per connection with a base backup.
        try {
            const rpoHours = Number(process.env.FATHOM_RPO_HOURS) || 24;
            const conns = await this.pool.query(
                `SELECT DISTINCT connection_id FROM pgmonitoringtool.base_backups
                  WHERE status = 'succeeded' LIMIT 100`,
            );
            for (const c of conns.rows) {
                try {
                    const win = await getRecoveryWindow(c.connection_id);
                    if (!win.feasible) {
                        signals.pitrBreaches.push({
                            connectionId: c.connection_id,
                            reason: win.reason || 'no recoverable window',
                            lagHours: null,
                            rpoHours,
                        });
                    } else {
                        const lagH = Math.round(((now - Date.parse(win.latest)) / 3_600_000) * 10) / 10;
                        if (lagH > rpoHours)
                            signals.pitrBreaches.push({
                                connectionId: c.connection_id,
                                latest: win.latest,
                                lagHours: lagH,
                                rpoHours,
                            });
                    }
                } catch (e) {
                    if (!missing(e)) log('ERROR', 'pitr window signal failed', { error: e.message });
                }
            }
        } catch (e) {
            if (!missing(e)) log('ERROR', 'pitr signal failed', { error: e.message });
        }

        this._advisorCache = signals;
        this._advisorAt = now;
        return signals;
    }

    async collectMetrics(db = this.pool) {
        // `db` is the database being monitored. It defaults to this.pool (the
        // control plane) only so existing callers and tests keep working — the
        // monitoring loop passes each connected database instead.
        try {
            const metrics = {};

            // Connection stats
            const connResult = await db.query(`
                SELECT
                    (SELECT count(*) FROM pg_stat_activity WHERE state='active') AS active,
                    (SELECT count(*) FROM pg_stat_activity)                      AS total_conn,
                    (SELECT setting::int FROM pg_settings WHERE name='max_connections') AS max_conn
            `);
            metrics.activeConnections = Number(connResult.rows[0].active);
            metrics.maxConnections = Number(connResult.rows[0].max_conn);

            // Slow queries — FIX: was template literal SQL injection — now parameterized
            const slowResult = await db.query(
                `SELECT pid, usename, query,
                        extract(epoch FROM (now()-query_start))::int AS duration_sec
                 FROM pg_stat_activity
                 WHERE state = 'active'
                   AND query NOT LIKE '%pg_stat_activity%'
                   AND (now()-query_start) > ($1 * INTERVAL '1 second')
                   AND pid <> pg_backend_pid()`,
                [this.config.ALERT_THRESHOLDS.LONG_QUERY_SEC],
            );
            metrics.slowQueries = slowResult.rows;

            // Cache hit ratio
            const cacheResult = await db.query(`
                SELECT round(
                    sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit)+sum(heap_blks_read), 0) * 100,
                    1
                ) AS hit_ratio
                FROM pg_statio_user_tables
            `);
            metrics.cacheHitRatio = cacheResult.rows[0]?.hit_ratio ?? 100;

            // Table bloat — FIX: was template literal SQL injection — now parameterized
            const bloatResult = await db.query(
                `SELECT relname AS table_name,
                        n_dead_tup AS dead_tuples,
                        CASE WHEN n_live_tup > 0
                             THEN round((n_dead_tup::numeric / n_live_tup) * 100, 2)
                             ELSE 0
                        END AS bloat_ratio_pct
                 FROM pg_stat_user_tables
                 -- A ratio is meaningless on a tiny table: 1 live row and 10
                 -- dead reads as 1000% bloat while wasting a few kilobytes.
                 WHERE n_live_tup >= $2
                   AND (n_dead_tup::numeric / n_live_tup) * 100 > $1
                 ORDER BY bloat_ratio_pct DESC
                 LIMIT 5`,
                [this.config.ALERT_THRESHOLDS.DEAD_TUPLE_RATIO, MIN_BLOAT_LIVE_TUPLES],
            );
            metrics.bloatedTables = bloatResult.rows;

            // Replication lag
            const replResult = await db.query(`
                SELECT MAX(pg_wal_lsn_diff(sent_lsn, replay_lsn)) AS max_lag
                FROM pg_stat_replication
            `);
            metrics.replicationLag = replResult.rows[0]?.max_lag ?? 0;

            // Blocking locks
            const lockResult = await db.query(`
                SELECT COUNT(*) AS count
                FROM pg_locks bl
                JOIN pg_locks kl ON kl.locktype = bl.locktype AND kl.pid <> bl.pid
                WHERE NOT bl.granted
            `);
            metrics.blockingLocks = Number(lockResult.rows[0].count);

            // Disk usage
            const diskResult = await db.query(`SELECT pg_database_size(current_database()) AS db_size_bytes`);
            metrics.diskUsedGB = parseFloat((diskResult.rows[0].db_size_bytes / 1024 ** 3).toFixed(2));
            // Predictive advisor signals (throttled internally).
            try {
                Object.assign(metrics, await this.collectAdvisorSignals());
            } catch (e) {
                log('WARN', 'advisor signals failed', { error: e.message });
            }

            return metrics;
        } catch (error) {
            log('ERROR', 'Failed to collect metrics', { error: error.message });
            return null;
        }
    }

    /**
     * Feed scalar metrics through the anomaly engine and fire alerts on
     * statistically anomalous values. This complements the static-threshold
     * rules above: a metric can be "within threshold" yet still anomalous
     * relative to its own recent baseline (the differentiator vs. fixed limits).
     *
     * Disabled by default. Enable with FATHOM_ANOMALY_MODE = 'suggest' | 'page'.
     *   • suggest → record a low-severity 'anomaly' alert (informational)
     *   • page    → fire a warning/critical alert that fans out to integrations
     *
     * Detector type/window are tunable via FATHOM_ANOMALY_TYPE (zscore|ewma|mad)
     * and FATHOM_ANOMALY_WINDOW. The evaluator keeps per-metric rolling state
     * across invocations via the shared anomalyEvaluator singleton.
     */
    async evaluateAnomalies(metrics) {
        const mode = (process.env.FATHOM_ANOMALY_MODE || 'off').toLowerCase();
        if (mode === 'off' || !metrics) return [];

        const rule = {
            mode,
            type: process.env.FATHOM_ANOMALY_TYPE || 'zscore',
            window: Number(process.env.FATHOM_ANOMALY_WINDOW) || 60,
        };

        // Only scalar, monotonic-ish gauges make sense for baseline detection.
        const scalarMetrics = {
            'db.active_connections': metrics.activeConnections,
            'db.cache_hit_ratio': metrics.cacheHitRatio != null ? parseFloat(metrics.cacheHitRatio) : undefined,
            'db.replication_lag_bytes': metrics.replicationLag,
            'db.blocking_locks': metrics.blockingLocks,
            'db.disk_used_gb': metrics.diskUsedGB,
            'db.slow_query_count': Array.isArray(metrics.slowQueries) ? metrics.slowQueries.length : undefined,
        };

        const results = [];
        for (const [metricKey, value] of Object.entries(scalarMetrics)) {
            if (value === undefined || value === null || Number.isNaN(Number(value))) continue;
            let decision;
            try {
                decision = anomalyEvaluator.evaluate(metricKey, Number(value), rule);
            } catch (err) {
                log('ERROR', `Anomaly evaluation failed for ${metricKey}`, { error: err.message });
                continue;
            }
            results.push(decision);
            if (!decision.anomaly) continue;

            const severity = decision.firing ? 'warning' : 'info';
            const msg =
                `Anomaly on ${metricKey}: value ${Number(value)} (score ${Number(decision.score).toFixed(2)}, ` +
                `${decision.detectorType}/${rule.window})`;
            try {
                await this.fire(severity, 'anomaly', msg, {
                    rule: 'anomaly_detection',
                    metricKey,
                    value: Number(value),
                    score: decision.score,
                    detector: decision.detectorType,
                    mode,
                    suggestionOnly: !decision.firing,
                });
            } catch (err) {
                log('ERROR', `Failed to fire anomaly alert for ${metricKey}`, { error: err.message });
            }
        }
        return results;
    }

    /**
     * Evaluate every rule against every database the user has connected.
     *
     * Previously this ran once against this.pool — the ADMIN pool — so all the
     * threshold rules were describing FATHOM's own control-plane database and
     * said nothing about the databases anyone actually cares about. That is why
     * "5 tables with high bloat" named fathom_connections and users.
     *
     * `targetProvider` is injected by server.ts and yields { id, name, pool }
     * per connected database. Without it we fall back to the old single-target
     * behaviour so tests and any admin-only deployment keep working.
     */
    async runMonitoring() {
        const targets = this.targetProvider
            ? await this.targetProvider().catch((err) => {
                  log('ERROR', 'Could not resolve monitoring targets', { error: err.message });
                  return [];
              })
            : [{ id: null, name: null, pool: this.pool }];

        for (const target of targets) {
            await this._monitorTarget(target);
        }

        // ── Incident housekeeping ───────────────────────────────────────────
        // Runs after every sweep, once, not per target: both operate on the
        // whole incident table.
        //
        // Order matters. Auto-close first, so an incident whose condition was
        // fixed during this cycle isn't escalated on its way out — being paged
        // about something already resolved is how people learn to ignore pages.
        await this._sweepIncidents();
    }

    /**
     * Resolve incidents whose condition stopped firing, then escalate what is
     * left past its SLA.
     *
     * The stale window must be comfortably longer than the monitoring interval
     * or a slow cycle would auto-close a live incident. Three intervals, floor
     * of 30 minutes.
     */
    async _sweepIncidents() {
        try {
            const intervalMs = this.config?.MONITORING_INTERVAL_MS || 60_000;
            const staleMinutes = Math.max(30, Math.ceil((intervalMs * 3) / 60_000));

            const closed = await autoCloseStale(this.pool, { staleMinutes });
            if (closed.length) {
                log('INFO', 'Auto-resolved incidents', { count: closed.length, ids: closed.map((r) => r.id) });
                this.broadcast({ type: 'incidents:resolved', payload: closed.map((r) => r.id) });
            }

            const escalated = await escalateOverdue(this.pool);
            for (const incident of escalated) {
                log('WARN', 'Incident past SLA', {
                    id: incident.id, priority: incident.priority, level: incident.escalation_level,
                });
                // Re-notify at critical so an ignored incident surfaces on the
                // destinations that filter out warnings.
                await this.fire('critical', incident.category || 'general',
                    `[ESCALATED L${incident.escalation_level}] ${incident.title} — ` +
                    `past its ${incident.priority} SLA, still ${incident.status}` +
                    `${incident.owner ? ` (owner: ${incident.owner})` : ' (unassigned)'}`,
                    {
                        ruleId: `escalation:${incident.id}`,
                        incidentId: incident.id,
                        connectionId: incident.connection_id,
                        orgId: incident.org_id,
                    });
            }
        } catch (error) {
            // Housekeeping must never take the monitoring loop down with it.
            log('ERROR', 'Incident sweep failed', { error: error.message });
        }
    }

    async _monitorTarget(target) {
        const metrics = await this.collectMetrics(target.pool);
        if (!metrics) return;

        // Identify which database an alert is about. Without this every alert
        // reads as if it came from one anonymous system.
        const origin = target.id
            ? { connectionId: target.id, connectionName: target.name }
            : {};

        for (const rule of this.alertRules) {
            try {
                if (!rule.condition(metrics)) continue;

                // Structured path: one incident per affected object, with
                // priority, owner, SLA and a fix suggestion.
                if (typeof rule.objects === 'function') {
                    const objects = (rule.objects(metrics) || []).filter(
                        (o) => o && o.metricValue != null && Number.isFinite(Number(o.metricValue)),
                    );
                    if (objects.length) {
                        await this.fireObjectAlert({
                            title: target.name ? `[${target.name}] ${rule.name}` : rule.name,
                            category: rule.category,
                            ruleId: rule.id,
                            metricLabel: rule.metricLabel,
                            thresholds: typeof rule.thresholds === 'function' ? rule.thresholds() : rule.thresholds,
                            objectType: rule.objectType,
                            objects,
                            summary: rule.message(metrics),
                            database: target.name || metrics.databaseName || null,
                            ...origin,
                        });
                        continue;
                    }
                    // The condition held but produced no usable objects — a
                    // shape mismatch in the metrics. Fall through to the plain
                    // alert rather than staying silent about a real breach.
                    log('WARN', `Rule ${rule.id} matched but yielded no objects; sending plain alert`, {
                        connection: target.name,
                    });
                }

                await this.fire(rule.severity, rule.category,
                    target.name ? `[${target.name}] ${rule.message(metrics)}` : rule.message(metrics), {
                    rule: rule.id,
                    ruleId: rule.id,
                    ...origin,
                    ...contextFor(rule.id, metrics),
                });
            } catch (error) {
                log('ERROR', `Failed to evaluate alert rule ${rule.id}`, {
                    error: error.message, connection: target.name,
                });
            }
        }

        // Statistical anomaly detection (env-gated; complements static rules).
        try {
            await this.evaluateAnomalies(metrics);
        } catch (error) {
            log('ERROR', 'Anomaly detection pass failed', { error: error.message });
        }
    }

    startMonitoring(intervalMs = 30_000) {
        if (this.monitoringInterval) clearInterval(this.monitoringInterval);
        log('INFO', 'Alert monitoring started', { intervalMs });
        this.runMonitoring();
        this.monitoringInterval = setInterval(() => this.runMonitoring(), intervalMs);
    }

    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            log('INFO', 'Alert monitoring stopped');
        }
    }

    broadcast(message) {
        const payload = JSON.stringify(message);
        this.subscribers.forEach((ws) => {
            if (ws.readyState === 1) ws.send(payload);
        });
    }

    addSubscriber(ws) {
        this.subscribers.add(ws);
    }
    removeSubscriber(ws) {
        this.subscribers.delete(ws);
    }

    async initializeDatabase() {
        try {
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS alerts (
                    id              VARCHAR(36) PRIMARY KEY,
                    timestamp       TIMESTAMP   NOT NULL,
                    severity        VARCHAR(20) NOT NULL,
                    category        VARCHAR(50) NOT NULL,
                    message         TEXT        NOT NULL,
                    data            JSONB,
                    acknowledged    BOOLEAN     DEFAULT false,
                    acknowledged_by VARCHAR(100),
                    acknowledged_at TIMESTAMP,
                    slack_ts        VARCHAR(50),
                    created_at      TIMESTAMP   DEFAULT NOW()
                );

                -- Add slack_ts to existing tables that were created before this column existed
                ALTER TABLE alerts ADD COLUMN IF NOT EXISTS slack_ts VARCHAR(50);

                CREATE INDEX IF NOT EXISTS idx_alerts_timestamp    ON alerts(timestamp DESC);
                CREATE INDEX IF NOT EXISTS idx_alerts_severity     ON alerts(severity);
                CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged);
                CREATE INDEX IF NOT EXISTS idx_alerts_category     ON alerts(category);
                CREATE INDEX IF NOT EXISTS idx_alerts_slack_ts     ON alerts(slack_ts);
            `);
            log('INFO', 'Alert database tables initialized');
        } catch (error) {
            log('ERROR', 'Failed to initialize alert database', { error: error.message });
            throw error;
        }
    }
}

// Named export so tests can construct the engine and inspect its rules without
// going through the default import and a running server.
export { EnhancedAlertEngine };
export default EnhancedAlertEngine;
