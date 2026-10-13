// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/autoExplainService.js
 *
 * C6 — auto_explain log ingest + read API.
 *
 * Shape expected from log shippers (one event per HTTP POST):
 *   {
 *     connectionId: number,
 *     capturedAt:   ISO timestamp,
 *     durationMs:   number,
 *     statement:    string,
 *     queryId:      number | null,
 *     databaseName: string,
 *     userName:     string,
 *     application:  string,
 *     planJson:     object,
 *     source:       { host, file, line, ... }
 *   }
 *
 * Belt-and-braces redaction: the statement is passed through copilot's
 * redact() before insert, so the secrets matrix (OpenAI / Anthropic /
 * Slack / GitHub / GitLab / AWS / password=…) is enforced even if the
 * log shipper missed something.
 *
 * Retention is wired into retentionService — events older than the
 * configured TTL (default 14 days) are pruned on the regular sweep.
 */

import { query } from '../db.js';
import { redact } from './copilotService.js';

function log(level, msg, meta = {}) {
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg, component: 'autoExplain', ...meta }));
}

export const AUTO_EXPLAIN_RETENTION_DAYS = Math.max(
    1,
    Number(process.env.PULSEDB_AUTO_EXPLAIN_DAYS) || 14
);

/**
 * Ingest a single auto_explain event. Returns the inserted row id.
 */
export async function ingestEvent({ workspaceId, connectionId, capturedAt, durationMs, statement,
    queryId = null, databaseName = null, userName = null, application = null, planJson = null, source = null }) {
    if (!workspaceId)  throw new Error('workspaceId required');
    if (!connectionId) throw new Error('connectionId required');
    if (typeof statement !== 'string') throw new Error('statement required');

    const safeStatement = redact(statement).slice(0, 50_000);
    const captured = capturedAt ? new Date(capturedAt) : new Date();
    if (isNaN(captured.getTime())) throw new Error('invalid capturedAt');

    const { rows } = await query(
        `INSERT INTO pgmonitoringtool.auto_explain_events
            (workspace_id, connection_id, captured_at, duration_ms,
             statement, query_id, database_name, user_name, application,
             plan_json, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id, captured_at`,
        [
            workspaceId, connectionId, captured, durationMs ?? null,
            safeStatement, queryId, databaseName, userName, application,
            planJson, source,
        ]
    );
    return rows[0];
}

/**
 * Batch ingest. Stops on the first failure but reports per-row outcome.
 */
export async function ingestBatch({ workspaceId, connectionId, events }) {
    if (!Array.isArray(events)) throw new Error('events must be an array');
    const accepted = [];
    const errors = [];
    for (let i = 0; i < events.length; i++) {
        try {
            const row = await ingestEvent({ workspaceId, connectionId, ...events[i] });
            accepted.push(row);
        } catch (err) {
            errors.push({ index: i, error: err.message });
        }
    }
    return { accepted: accepted.length, errors };
}

/**
 * Read endpoint — most recent N events for a connection inside a window.
 */
export async function listRecent({ workspaceId, connectionId, fromTs, toTs, limit = 200 }) {
    const { rows } = await query(
        `SELECT id, captured_at, duration_ms, statement, query_id,
                database_name, user_name, application, plan_json, source
           FROM pgmonitoringtool.auto_explain_events
          WHERE workspace_id = $1
            AND connection_id = $2
            AND captured_at >= $3
            AND captured_at <= $4
          ORDER BY captured_at DESC
          LIMIT $5`,
        [workspaceId, connectionId, fromTs, toTs, Math.min(limit, 1000)]
    );
    return rows;
}

/**
 * Group by query_id over a window. Used by the "plans in production"
 * tab next to the live EXPLAIN output.
 */
export async function summariseByQuery({ workspaceId, connectionId, fromTs, toTs }) {
    const { rows } = await query(
        `SELECT query_id,
                count(*)                       AS executions,
                avg(duration_ms)::numeric(10,2) AS avg_ms,
                max(duration_ms)::numeric(10,2) AS max_ms,
                min(duration_ms)::numeric(10,2) AS min_ms
           FROM pgmonitoringtool.auto_explain_events
          WHERE workspace_id = $1
            AND connection_id = $2
            AND captured_at >= $3
            AND captured_at <= $4
            AND query_id IS NOT NULL
          GROUP BY query_id
          ORDER BY executions DESC
          LIMIT 100`,
        [workspaceId, connectionId, fromTs, toTs]
    );
    return rows;
}

/**
 * Retention sweep helper — called from retentionService.
 */
export async function purgeOldEvents(maxAgeDays = AUTO_EXPLAIN_RETENTION_DAYS) {
    try {
        const r = await query(
            `DELETE FROM pgmonitoringtool.auto_explain_events
              WHERE captured_at < now() - ($1 || ' days')::interval`,
            [String(Math.max(1, maxAgeDays))]
        );
        return r && typeof r.rowCount === 'number' ? r.rowCount : 0;
    } catch (err) {
        if (/relation .* does not exist/i.test(err.message)) return 0;
        log('WARN', 'purgeOldEvents failed', { error: err.message });
        return 0;
    }
}
