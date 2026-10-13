// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/alertRcaService.js
 *
 * C5 — Proactive AI-driven RCA pipeline.
 *
 * Flow:
 *   1. fire(alert) writes the alert row (existing alertService path).
 *   2. enqueueRca(alert) drops a job on QUEUE_NAMES.ALERT_DISPATCH-companion
 *      'alerts.rca' queue. In single-process mode this runs inline (the
 *      in-process queue fan-out delivers to runRcaJob synchronously).
 *   3. runRcaJob assembles a context bundle from:
 *        - wait_event_rollups_5m  (5-minute window around the fire time)
 *        - copilot_turns          (recent queries the operator was looking at)
 *        - otlp_traces            (recent traces for affected resources)
 *        - audit_log              (recent deploys / config changes)
 *      hashes it to a signature, and short-circuits if (alert_id, signature)
 *      already has an RCA row — that's the cost cap.
 *   4. Calls draftIncidentRca() and persists the narrative.
 *   5. listForAlert / setFeedback expose the result and a thumbs-up/down
 *      affordance.
 *
 * If the copilot provider is configured 'local' (no LLM key set), the
 * pipeline still runs and persists the deterministic stub narrative — the
 * value of a recorded context bundle is real even without an LLM.
 */

import crypto from 'node:crypto';
import { query } from '../db.js';
import { draftIncidentRca, getProvider } from './copilotService.js';

const RCA_QUEUE = 'alerts.rca';
const WINDOW_MIN = 10;     // ± minutes around the alert timestamp
const CONTEXT_CAP_PER_KIND = 25;

function log(level, msg, meta = {}) {
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg, component: 'alertRca', ...meta }));
}

function stableStringify(v) {
    // Deterministic JSON serialisation that walks the whole tree and
    // sorts object keys at every depth. Unlike JSON.stringify's array
    // replacer, this preserves nested values.
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
    const keys = Object.keys(v).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}

function signatureOf(ctx) {
    // Hash the deterministic serialisation so the same context bundle
    // always maps to the same signature, regardless of key insertion order.
    const s = stableStringify(ctx);
    return crypto.createHash('sha256').update(s).digest('hex').slice(0, 32);
}

/**
 * Assemble the context bundle. All gathers are bounded and tolerant of
 * missing tables (returns []), so this never throws on a fresh DB.
 */
export async function assembleContext({ alertId, workspaceId, alertTimestamp, connectionId = null }) {
    const t0 = new Date(alertTimestamp).getTime();
    const from = new Date(t0 - WINDOW_MIN * 60_000).toISOString();
    const to   = new Date(t0 + WINDOW_MIN * 60_000).toISOString();

    async function safe(sql, params, label) {
        try {
            const r = await query(sql, params);
            return r.rows;
        } catch (err) {
            if (/relation .* does not exist/i.test(err.message)) return [];
            log('WARN', `RCA gather failed: ${label}`, { error: err.message });
            return [];
        }
    }

    const waitEvents = connectionId ? await safe(
        `SELECT bucket_start, wait_class, sample_count
           FROM pgmonitoringtool.wait_event_rollups_5m
          WHERE connection_id = $1::text::uuid
            AND bucket_start >= $2 AND bucket_start <= $3
          ORDER BY sample_count DESC LIMIT $4`,
        [connectionId, from, to, CONTEXT_CAP_PER_KIND], 'waitEvents'
    ) : [];

    const recentTraces = await safe(
        `SELECT trace_id, root_span_name, root_span_status, total_spans, total_duration_ms
           FROM pgmonitoringtool.otlp_traces
          WHERE org_id = $1
            AND created_at >= $2 AND created_at <= $3
          ORDER BY total_duration_ms DESC NULLS LAST LIMIT $4`,
        [workspaceId, from, to, CONTEXT_CAP_PER_KIND], 'traces'
    );

    const recentAudit = await safe(
        `SELECT actor_id, action, target, details, created_at
           FROM pgmonitoringtool.audit_log
          WHERE workspace_id = $1
            AND created_at >= $2 AND created_at <= $3
          ORDER BY created_at DESC LIMIT $4`,
        [workspaceId, from, to, CONTEXT_CAP_PER_KIND], 'audit'
    );

    const recentCopilot = await safe(
        `SELECT kind, input, output, created_at
           FROM pgmonitoringtool.copilot_turns
          WHERE workspace_id = $1
            AND created_at >= $2 AND created_at <= $3
          ORDER BY created_at DESC LIMIT $4`,
        [workspaceId, from, to, CONTEXT_CAP_PER_KIND], 'copilot'
    );

    return {
        alertId,
        windowFrom: from,
        windowTo: to,
        connectionId,
        waitEvents,
        recentTraces,
        recentAudit,
        recentCopilot,
    };
}

/**
 * Run RCA for an alert. Idempotent on (alertId, signature) — duplicate
 * runs return the cached row.
 */
export async function runRcaJob({ alertId, workspaceId, alertTimestamp, connectionId = null }) {
    if (!alertId)         throw new Error('alertId required');
    if (!alertTimestamp)  throw new Error('alertTimestamp required');

    const ctx = await assembleContext({ alertId, workspaceId, alertTimestamp, connectionId });
    const signature = signatureOf(ctx);

    // Short-circuit if we already wrote a narrative for this exact context.
    try {
        const existing = await query(
            `SELECT id, narrative FROM pgmonitoringtool.alert_rca
              WHERE alert_id = $1 AND signature = $2`,
            [alertId, signature]
        );
        if (existing.rows.length > 0) return { ...existing.rows[0], cached: true };
    } catch (err) {
        if (!/relation .* does not exist/i.test(err.message)) throw err;
    }

    // Build the prompt input for draftIncidentRca.
    const incident = {
        trigger: { alertId, time: alertTimestamp, connectionId },
        topWaitClasses: ctx.waitEvents.slice(0, 8),
        topTraces: ctx.recentTraces.slice(0, 8).map(t => ({
            id: t.trace_id, name: t.root_span_name,
            status: t.root_span_status, durationMs: t.total_duration_ms,
        })),
        recentDeploys: ctx.recentAudit
            .filter(a => /deploy|release|rollout|migration/i.test(String(a.action)))
            .slice(0, 5),
        operatorQueries: ctx.recentCopilot.slice(0, 5).map(c => ({ kind: c.kind, input: c.input })),
    };

    let narrative = null;
    let provider = 'local';
    let model    = 'stub';
    try {
        const r = await draftIncidentRca(null, { incident });
        narrative = r.rca;
        provider = r.provider || provider;
        model = r.model || model;
    } catch (err) {
        log('WARN', 'draftIncidentRca failed; persisting context-only', { alertId, error: err.message });
        narrative = `(LLM unavailable — see assembled context for the operator)`;
    }

    try {
        const { rows } = await query(
            `INSERT INTO pgmonitoringtool.alert_rca
                (alert_id, signature, workspace_id, context, narrative, provider, model)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (alert_id, signature) DO UPDATE
                SET narrative = EXCLUDED.narrative,
                    provider  = EXCLUDED.provider,
                    model     = EXCLUDED.model
             RETURNING id, created_at`,
            [alertId, signature, workspaceId ?? null, JSON.stringify(ctx), narrative, provider, model]
        );
        return { id: rows[0].id, narrative, signature, provider, model, cached: false };
    } catch (err) {
        if (/relation .* does not exist/i.test(err.message)) {
            log('WARN', 'alert_rca table missing — narrative not persisted');
            return { id: null, narrative, signature, provider, model, cached: false, persisted: false };
        }
        throw err;
    }
}

/**
 * Enqueue the RCA job. Web tier calls this after fire(); worker tier
 * consumes the queue and runs runRcaJob. In single-process mode the
 * in-process queue delivers synchronously.
 */
export async function enqueueRca(alert) {
    try {
        const { createQueue } = await import('./queue.js');
        const q = createQueue(RCA_QUEUE);
        await q.add('rca', {
            alertId: alert.id,
            workspaceId: alert.orgId ?? alert.workspace_id ?? null,
            alertTimestamp: alert.timestamp,
            connectionId: alert.data?.connectionId ?? alert.connection_id ?? null,
        });
        return true;
    } catch (err) {
        log('WARN', 'enqueueRca failed', { error: err.message });
        return false;
    }
}

/**
 * Read endpoint — most recent RCA narrative for an alert. The alert
 * detail page calls this.
 */
export async function listForAlert(alertId) {
    try {
        const { rows } = await query(
            `SELECT id, alert_id, signature, created_at, narrative,
                    provider, model, feedback
               FROM pgmonitoringtool.alert_rca
              WHERE alert_id = $1
              ORDER BY created_at DESC LIMIT 10`,
            [alertId]
        );
        return rows;
    } catch (err) {
        if (/relation .* does not exist/i.test(err.message)) return [];
        throw err;
    }
}

export async function setFeedback({ rcaId, feedback }) {
    if (!['up', 'down', null].includes(feedback)) throw new Error('feedback must be up | down | null');
    const r = await query(
        `UPDATE pgmonitoringtool.alert_rca SET feedback = $1 WHERE id = $2`,
        [feedback, rcaId]
    );
    return r.rowCount;
}

// Test seam — internal helpers exposed for tests.
export const _internal = { signatureOf, RCA_QUEUE, WINDOW_MIN };
