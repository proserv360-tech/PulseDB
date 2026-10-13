/**
 * services/incidentService.ts
 * ──────────────────────────
 * Incidents as work items: one per affected object, each with a priority, an
 * owner, an SLA target, a fix status and an audit trail.
 *
 * ── One per object ──────────────────────────────────────────────────────────
 * Four bloated tables might belong to three teams and be fixed at different
 * times. A single incident spanning them cannot carry "Fix Status: Applied",
 * because it is only true of one. So the fingerprint includes the object, and
 * a notification groups several incidents rather than being one.
 *
 * ── Two scales ──────────────────────────────────────────────────────────────
 * `priority` (critical/high/medium/low) is human triage and drives the SLA.
 * `severity` (info/warning/critical) is machine routing — notification
 * destinations filter on it. They are derived from one another here so they
 * can never disagree; nothing outside this module should set both.
 *
 * ── Recurrence ──────────────────────────────────────────────────────────────
 * The alert loop re-fires while a condition holds. A partial unique index on
 * fingerprint (where the incident is not closed) means a re-fire bumps
 * occurrences on the same row rather than minting a new number, so
 * INC-20260729-001 refers to one problem for its whole life.
 */

import { swallow } from './errorHandling.js';

const S = 'pgmonitoringtool';

export const INCIDENT_STATUS = {
    OPEN: 'open',
    INVESTIGATING: 'investigating',
    IDENTIFIED: 'identified',
    IN_PROGRESS: 'in_progress',
    MONITORING: 'monitoring',
    RESOLVED: 'resolved',
    CLOSED: 'closed',
};

export const FIX_STATUS = {
    PENDING: 'pending',
    APPLIED: 'applied',
    VERIFIED: 'verified',
    FAILED: 'failed',
};

export const PRIORITY = ['critical', 'high', 'medium', 'low'];

// Priority is what people triage on; severity is what machines route on.
// Medium maps to warning rather than info deliberately — an info-level alert is
// below the default min_severity of every destination, so mapping it there
// would mean medium incidents notify nobody.
const PRIORITY_TO_SEVERITY = {
    critical: 'critical',
    high: 'critical',
    medium: 'warning',
    low: 'info',
};

const PRIORITY_RANK = { low: 0, medium: 1, high: 2, critical: 3 };

/** Fallbacks used when the incident_sla table is unreachable. */
const DEFAULT_SLA_MINUTES = { critical: 240, high: 1440, medium: 4320, low: 10080 };

/**
 * Map a measurement to a priority.
 *
 * Thresholds are per-rule and inclusive-downward: a value at or above
 * `critical` is critical, at or above `high` is high, and so on. Anything below
 * the `medium` threshold is low. Works for any ascending metric — bloat ratio,
 * replication lag, connection saturation. For metrics where *lower* is worse
 * (cache hit ratio), pass the inverted value.
 *
 * @param {number} value
 * @param {{critical:number, high:number, medium:number}} thresholds
 */
export function mapPriority(value, thresholds = {}) {
    const { critical = Infinity, high = Infinity, medium = Infinity } = thresholds;
    if (value >= critical) return 'critical';
    if (value >= high) return 'high';
    if (value >= medium) return 'medium';
    return 'low';
}

export function severityForPriority(priority) {
    return PRIORITY_TO_SEVERITY[priority] || 'warning';
}

/** Highest of two priorities. Used so a grouped alert takes its worst member. */
export function maxPriority(a, b) {
    return (PRIORITY_RANK[b] ?? -1) > (PRIORITY_RANK[a] ?? -1) ? b : a;
}

/**
 * Stable identity for a recurring condition on one object.
 *
 * Includes connectionId — the same table name in two databases is two problems.
 * Includes objectKey — that is what makes incidents per-object. Excludes the
 * measured value, so an incident does not close and reopen as the number drifts.
 */
export function fingerprintFor({ category, ruleId, connectionId, objectKey }) {
    return [
        category || 'general',
        connectionId ?? 'local',
        ruleId || 'unknown',
        objectKey || '-',
    ].join(':');
}

export function objectKeyFor({ database, schema, object } = {}) {
    return [database || '-', schema || '-', object || '-'].join('.');
}

/**
 * Resolve the owning team for an object.
 *
 * Most specific rule wins: a rule naming the table beats one naming the schema,
 * which beats the catch-all. Category-scoped rules outrank object-scoped ones,
 * on the reasoning that "all replication alerts go to Infra Ops" is a
 * deliberate routing decision and shouldn't be overridden by a generic
 * per-schema default.
 *
 * Returns null when nothing matches — an unowned incident is honest, and better
 * than inventing an assignee.
 */
export async function resolveOwner(pool, { database, schema, object, category, orgId = null }) {
    try {
        const { rows } = await pool.query(
            `SELECT owner
               FROM ${S}.incident_ownership_rules
              WHERE enabled
                AND (org_id IS NULL OR org_id = $5)
                AND COALESCE($1, '') LIKE database_pattern
                AND COALESCE($2, '') LIKE schema_pattern
                AND COALESCE($3, '') LIKE object_pattern
                AND (category IS NULL OR category = $4)
              ORDER BY specificity DESC, id ASC
              LIMIT 1`,
            [database, schema, object, category, orgId],
        );
        return rows[0]?.owner ?? null;
    } catch (err) {
        swallow(err, { component: 'incidents', op: 'resolveOwner', database, schema, object });
        return null;
    }
}

async function slaMinutes(pool, priority, orgId = null) {
    try {
        const { rows } = await pool.query(
            `SELECT target_minutes, escalate_after_minutes
               FROM ${S}.incident_sla
              WHERE priority = $1 AND org_id IN (COALESCE($2, 0), 0)
              ORDER BY org_id DESC
              LIMIT 1`,
            [priority, orgId],
        );
        if (rows[0]) {
            return {
                target: Number(rows[0].target_minutes),
                escalateAfter: rows[0].escalate_after_minutes ? Number(rows[0].escalate_after_minutes) : null,
            };
        }
    } catch (err) {
        swallow(err, { component: 'incidents', op: 'slaMinutes', priority });
    }
    return { target: DEFAULT_SLA_MINUTES[priority] ?? DEFAULT_SLA_MINUTES.medium, escalateAfter: null };
}

/**
 * Open an incident for one affected object, or touch the existing open one.
 *
 * @returns {Promise<object|null>} the incident row, or null if the write failed
 *          — the caller must still send the notification.
 */
export async function openIncident(pool, {
    title,
    description = null,
    category = null,
    ruleId = null,
    connectionId = null,
    orgId = null,
    alertId = null,

    database = null,
    schema = null,
    object = null,
    objectType = 'table',

    metricValue = null,
    metricLabel = null,
    metricDisplay = null,

    priority = 'medium',
    owner = undefined,        // undefined = resolve from rules; null = leave unowned
    fixSuggestion = null,
    fixSql = null,
    findings = [],
    suggestions = [],
}) {
    const objectKey = objectKeyFor({ database, schema, object });
    const fingerprint = fingerprintFor({ category, ruleId, connectionId, objectKey });
    const severity = severityForPriority(priority);

    const resolvedOwner =
        owner === undefined
            ? await resolveOwner(pool, { database, schema, object, category, orgId })
            : owner;

    const { target } = await slaMinutes(pool, priority, orgId);

    try {
        const { rows } = await pool.query(
            `INSERT INTO ${S}.incidents
                 (title, description, severity, priority, status, fix_status, fingerprint,
                  category, connection_id, org_id, alert_id,
                  database_name, schema_name, object_name, object_type,
                  metric_value, metric_label, metric_display,
                  owner, detected_at, resolution_due_at,
                  fix_suggestion, fix_sql, findings, suggestions)
             VALUES ($1, $2, $3, $4, 'open', 'pending', $5,
                     $6, $7, $8, $9,
                     $10, $11, $12, $13,
                     $14, $15, $16,
                     $17, now(), now() + ($18 || ' minutes')::interval,
                     $19, $20, $21::jsonb, $22::jsonb)
             ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL
                                         AND status NOT IN ('resolved', 'closed')
             DO UPDATE SET
                 occurrences   = incidents.occurrences + 1,
                 last_seen_at  = now(),
                 -- Refresh the reading; the newest is the useful one and the
                 -- old one survives on the alert record.
                 metric_value  = EXCLUDED.metric_value,
                 metric_display = EXCLUDED.metric_display,
                 findings      = EXCLUDED.findings,
                 suggestions   = EXCLUDED.suggestions,
                 fix_suggestion = EXCLUDED.fix_suggestion,
                 fix_sql       = EXCLUDED.fix_sql,
                 -- Priority ratchets up but never down while open, and the due
                 -- date is only pulled forward. A condition that reached
                 -- critical stays a critical incident even if the next poll
                 -- reads lower; downgrading mid-incident hides that it ever got
                 -- that bad, and pushing the deadline out would let an
                 -- oscillating metric defer its SLA indefinitely.
                 priority      = CASE
                     WHEN $23 > COALESCE((SELECT rank FROM (VALUES
                         ('low',0),('medium',1),('high',2),('critical',3)
                     ) AS r(p, rank) WHERE p = incidents.priority), -1)
                     THEN EXCLUDED.priority ELSE incidents.priority END,
                 severity      = CASE
                     WHEN EXCLUDED.severity = 'critical' OR incidents.severity = 'critical' THEN 'critical'
                     WHEN EXCLUDED.severity = 'warning'  OR incidents.severity = 'warning'  THEN 'warning'
                     ELSE incidents.severity END,
                 resolution_due_at = LEAST(
                     incidents.resolution_due_at,
                     EXCLUDED.resolution_due_at
                 )
             RETURNING *, (xmax = 0) AS inserted`,
            [
                title, description, severity, priority, fingerprint,
                category, connectionId, orgId, alertId,
                database, schema, object, objectType,
                metricValue, metricLabel, metricDisplay,
                resolvedOwner, target,
                fixSuggestion, fixSql,
                JSON.stringify(findings ?? []), JSON.stringify(suggestions ?? []),
                PRIORITY_RANK[priority] ?? -1,
            ],
        );

        const row = rows[0];
        if (row?.inserted) {
            await appendAudit(pool, row.id, {
                action: 'opened',
                note: `Detected ${metricLabel || 'threshold breach'}${metricDisplay ? ` at ${metricDisplay}` : ''}` +
                      `${resolvedOwner ? `; assigned to ${resolvedOwner}` : '; unassigned'}`,
                metadata: { priority, severity, objectKey, ruleId },
            });
        }
        return row ?? null;
    } catch (err) {
        // An incident number is a nicety; the alert itself is the point. Never
        // let this failure suppress the notification.
        swallow(err, { component: 'incidents', op: 'openIncident', category, ruleId, objectKey });
        return null;
    }
}

/** Append-only history. Every state change should leave a line here. */
export async function appendAudit(pool, incidentId, { actor = 'system', action, note = null, sqlRun = null, metadata = {} } = {}) {
    if (!incidentId || !action) return;
    try {
        await pool.query(
            `INSERT INTO ${S}.incident_audit_trail (incident_id, actor, action, note, sql_run, metadata)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
            [incidentId, actor, action, note, sqlRun, JSON.stringify(metadata ?? {})],
        );
    } catch (err) {
        swallow(err, { component: 'incidents', op: 'appendAudit', incidentId, action });
    }
}

export async function getAuditTrail(pool, incidentId, limit = 100) {
    const { rows } = await pool.query(
        `SELECT id, at, actor, action, note, sql_run, metadata
           FROM ${S}.incident_audit_trail
          WHERE incident_id = $1
          ORDER BY at ASC, id ASC
          LIMIT $2`,
        [incidentId, Math.min(Number(limit) || 100, 1000)],
    );
    return rows;
}

/**
 * Acknowledge — "a human has seen this and owns it now".
 *
 * Distinct from resolving. The condition is still true; what has changed is
 * that someone is on it, which is the single most useful thing to know when
 * the same alert is sitting in a channel with six people looking at it.
 *
 * Idempotent by design: the first acknowledgement wins and later ones are
 * reported rather than overwriting. Two people clicking the button at the same
 * moment is the normal case, not an error, and silently reassigning to whoever
 * was slower would be worse than telling them.
 *
 * Acknowledging also claims ownership when nobody owned it — an unassigned
 * incident someone has picked up is theirs.
 *
 * @returns {{incident: object, alreadyAcknowledged: boolean, by: string}|null}
 */
export async function acknowledgeIncident(pool, incidentId, actor, { via = 'api', note = null } = {}) {
    if (!incidentId) throw new Error('incidentId is required');
    if (!actor) throw new Error('actor is required');

    try {
        const { rows } = await pool.query(
            `UPDATE ${S}.incidents
                SET acknowledged_by = COALESCE(acknowledged_by, $2),
                    acknowledged_at = COALESCE(acknowledged_at, now()),
                    owner  = COALESCE(owner, $2),
                    -- Only advance a fresh incident. Something already in
                    -- progress or being monitored must not be dragged back.
                    status = CASE WHEN status = 'open' THEN 'investigating' ELSE status END
              WHERE id = $1
          RETURNING *, (acknowledged_by IS DISTINCT FROM $2) AS taken_by_other`,
            [incidentId, actor],
        );

        const incident = rows[0];
        if (!incident) return null;

        const alreadyAcknowledged = incident.taken_by_other;
        if (!alreadyAcknowledged) {
            await appendAudit(pool, incidentId, {
                actor,
                action: 'acknowledged',
                note: note || `Acknowledged via ${via}`,
                metadata: { via },
            });
        }
        return { incident, alreadyAcknowledged, by: incident.acknowledged_by };
    } catch (err) {
        swallow(err, { component: 'incidents', op: 'acknowledgeIncident', incidentId, actor });
        return null;
    }
}

/** Fetch one incident. */
export async function getIncident(pool, incidentId) {
    const { rows } = await pool.query(`SELECT * FROM ${S}.incidents WHERE id = $1`, [incidentId]);
    return rows[0] ?? null;
}

/** Move an incident along its lifecycle. Terminal statuses stamp resolved_at. */
export async function transitionIncident(pool, incidentId, status, { actor = 'system', note = null } = {}) {
    if (!incidentId) throw new Error('incidentId is required');
    if (!Object.values(INCIDENT_STATUS).includes(status)) {
        throw new Error(`unknown incident status: ${status}`);
    }

    const { rows } = await pool.query(
        `UPDATE ${S}.incidents
            SET status      = $2,
                resolved_at = CASE WHEN $2 IN ('resolved', 'closed')
                                   THEN COALESCE(resolved_at, now()) ELSE NULL END,
                acknowledged_by = CASE WHEN $3 = 'system' THEN acknowledged_by
                                       ELSE COALESCE(acknowledged_by, $3) END,
                acknowledged_at = CASE WHEN $3 <> 'system' AND acknowledged_at IS NULL
                                       THEN now() ELSE acknowledged_at END
          WHERE id = $1
      RETURNING *`,
        [incidentId, status, actor],
    );
    if (rows[0]) await appendAudit(pool, incidentId, { actor, action: `status:${status}`, note });
    return rows[0] ?? null;
}

/**
 * Record what was actually done to the database.
 *
 * Separate from status on purpose: a VACUUM can be applied and not yet
 * verified while the incident is still in_progress. Marking a fix `verified`
 * resolves the incident, because that is the only signal that the underlying
 * condition is genuinely gone.
 */
export async function setFixStatus(pool, incidentId, fixStatus, { actor = 'system', note = null, sqlRun = null } = {}) {
    if (!Object.values(FIX_STATUS).includes(fixStatus)) {
        throw new Error(`unknown fix status: ${fixStatus}`);
    }
    const { rows } = await pool.query(
        // $2 is cast explicitly everywhere: without it Postgres deduces
        // varchar(16) from the assignment and text from the comparisons, and
        // refuses the statement with "inconsistent types deduced for $2".
        `UPDATE ${S}.incidents
            SET fix_status = $2::text,
                status = CASE
                    WHEN $2::text = 'verified' THEN 'resolved'
                    WHEN $2::text = 'applied' AND status IN ('open', 'investigating', 'identified') THEN 'monitoring'
                    ELSE status END,
                resolved_at = CASE WHEN $2::text = 'verified' THEN COALESCE(resolved_at, now()) ELSE resolved_at END
          WHERE id = $1
      RETURNING *`,
        [incidentId, fixStatus],
    );
    if (rows[0]) {
        await appendAudit(pool, incidentId, { actor, action: `fix:${fixStatus}`, note, sqlRun });
    }
    return rows[0] ?? null;
}

/** Attach the AI narrative once alertRcaService produces one. */
export async function attachAiAnalysis(pool, incidentId, analysis) {
    if (!incidentId || !analysis) return;
    try {
        await pool.query(`UPDATE ${S}.incidents SET ai_analysis = $2 WHERE id = $1`, [incidentId, analysis]);
        await appendAudit(pool, incidentId, { action: 'ai_analysis', note: 'Root-cause narrative attached' });
    } catch (err) {
        swallow(err, { component: 'incidents', op: 'attachAiAnalysis', incidentId });
    }
}

/** Record which channels the notification actually reached. */
export async function recordNotification(pool, incidentId, channels = []) {
    if (!incidentId || !channels.length) return;
    try {
        await pool.query(
            `UPDATE ${S}.incidents
                SET notified_channels = ARRAY(SELECT DISTINCT unnest(notified_channels || $2::text[]))
              WHERE id = $1`,
            [incidentId, channels],
        );
    } catch (err) {
        swallow(err, { component: 'incidents', op: 'recordNotification', incidentId });
    }
}

/**
 * Escalate incidents past their SLA target.
 *
 * Bumps escalation_level rather than priority: priority describes the problem,
 * escalation describes our failure to deal with it, and conflating them would
 * make a stale low-priority incident indistinguishable from a genuine critical.
 * Returns the escalated rows so the caller can re-notify.
 */
export async function escalateOverdue(pool, { maxLevel = 3 } = {}) {
    try {
        const { rows } = await pool.query(
            `UPDATE ${S}.incidents
                SET escalation_level = escalation_level + 1,
                    escalated_at = now()
              WHERE status NOT IN ('resolved', 'closed')
                AND resolution_due_at IS NOT NULL
                AND now() > resolution_due_at
                AND escalation_level < $1
                -- One escalation per SLA window, not one per sweep.
                AND (escalated_at IS NULL OR escalated_at < resolution_due_at)
          RETURNING *`,
            [maxLevel],
        );
        for (const row of rows) {
            await appendAudit(pool, row.id, {
                action: 'escalated',
                note: `Past SLA target (${row.priority}); escalation level ${row.escalation_level}`,
            });
        }
        return rows;
    } catch (err) {
        swallow(err, { component: 'incidents', op: 'escalateOverdue' });
        return [];
    }
}

/**
 * Close incidents whose condition has stopped firing.
 *
 * Nothing else notices that a VACUUM ran and the bloat is gone. `staleMinutes`
 * must be comfortably longer than the alert evaluation interval, or a slow
 * cycle would auto-close a live incident.
 */
export async function autoCloseStale(pool, { staleMinutes = 60, category = null } = {}) {
    try {
        const { rows } = await pool.query(
            `UPDATE ${S}.incidents
                SET status = 'resolved',
                    resolved_at = now(),
                    fix_status = CASE WHEN fix_status = 'applied' THEN 'verified' ELSE fix_status END
              WHERE status NOT IN ('resolved', 'closed')
                AND last_seen_at < now() - ($1 || ' minutes')::interval
                ${category ? 'AND category = $2' : ''}
          RETURNING *`,
            category ? [staleMinutes, category] : [staleMinutes],
        );
        for (const row of rows) {
            await appendAudit(pool, row.id, {
                action: 'auto_resolved',
                note: `Condition stopped firing for ${staleMinutes} minutes`,
            });
        }
        return rows;
    } catch (err) {
        swallow(err, { component: 'incidents', op: 'autoCloseStale' });
        return [];
    }
}

/** Recent incidents for the dashboard and for the alert table. */
export async function listIncidents(pool, { limit = 50, phase = null, priority = null, owner = null, overdueOnly = false } = {}) {
    const conditions = [];
    const params = [];
    const add = (sql, value) => { params.push(value); conditions.push(sql.replace('$?', `$${params.length}`)); };

    if (phase) add('status_phase = $?', phase);
    if (priority) add('priority = $?', priority);
    if (owner) add('owner = $?', owner);
    if (overdueOnly) conditions.push(`status NOT IN ('resolved','closed') AND resolution_due_at < now()`);

    params.push(Math.min(Number(limit) || 50, 500));

    const { rows } = await pool.query(
        `SELECT id, title, database_name, schema_name, object_name, object_type,
                metric_value, metric_label, metric_display,
                severity, priority, status, status_phase, fix_status,
                owner, acknowledged_by, acknowledged_at,
                category, connection_id, alert_id,
                fix_suggestion, fix_sql, ai_analysis, notified_channels,
                occurrences, escalation_level,
                detected_at, resolution_due_at, created_at, updated_at,
                last_seen_at, resolved_at
           FROM ${S}.incidents
          ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
          ORDER BY detected_at DESC
          LIMIT $${params.length}`,
        params,
    );
    return rows;
}

/**
 * Prior incidents for the same object — the trend view.
 * "This is the fourth time public.orders has bloated this quarter" is the
 * sentence that turns a recurring alert into a schema change.
 */
export async function objectHistory(pool, { database, schema, object, sinceDays = 90, limit = 50 }) {
    const { rows } = await pool.query(
        `SELECT id, priority, metric_value, metric_display, fix_status,
                detected_at, resolved_at,
                EXTRACT(EPOCH FROM (COALESCE(resolved_at, now()) - detected_at)) / 3600 AS hours_open
           FROM ${S}.incidents
          WHERE database_name IS NOT DISTINCT FROM $1
            AND schema_name   IS NOT DISTINCT FROM $2
            AND object_name   IS NOT DISTINCT FROM $3
            AND detected_at > now() - ($4 || ' days')::interval
          ORDER BY detected_at DESC
          LIMIT $5`,
        [database, schema, object, sinceDays, Math.min(Number(limit) || 50, 500)],
    );
    return rows;
}
