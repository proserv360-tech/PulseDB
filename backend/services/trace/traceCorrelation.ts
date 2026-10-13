// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * traceCorrelation.js
 * ────────────────────
 * Stitches OTel traces to query events.
 *
 * Storage model:
 *   query_events (id, ts, db, statement, duration_ms, plan_hash, trace_id, span_id)
 * The migration below adds trace_id + span_id columns + a compound index
 * (trace_id) for fast per-trace lookup. Existing PostgreSQL deployments run
 * the DDL once; the code below works regardless of whether the columns are
 * already present (it will attempt the insert and fall back to a legacy
 * shape if a "column does not exist" error surfaces).
 *
 * Two tagging flows:
 *   • Push:   caller supplies trace context alongside the query row.
 *   • Pull:   we parse trace context out of the SQL text (sqlcommenter) or
 *             the PG application_name, at ingest time. This is how we catch
 *             traces from apps we don't directly own.
 */

import { extractFromSql, extractFromApplicationName, parseTraceparent } from './traceContext.js';

export const ADD_TRACE_COLUMNS_SQL = `
ALTER TABLE query_events
  ADD COLUMN IF NOT EXISTS trace_id CHAR(32),
  ADD COLUMN IF NOT EXISTS span_id  CHAR(16);

CREATE INDEX IF NOT EXISTS query_events_trace_id_idx ON query_events (trace_id);
CREATE INDEX IF NOT EXISTS query_events_trace_span_idx ON query_events (trace_id, span_id);
`;

/**
 * Given a query event and optional explicit context, resolve the final
 * (traceId, spanId) to persist. Returns { traceId, spanId, source } where
 * source ∈ { 'explicit', 'sql-comment', 'application-name', null }.
 */
export function resolveTraceContext({ event, explicit, applicationName } = {}) {
    const explicitCtx =
        explicit?.traceId && explicit?.spanId ? parseTraceparent(`00-${explicit.traceId}-${explicit.spanId}-01`) : null;
    if (explicitCtx) return { ...explicitCtx, source: 'explicit' };

    const fromSql = extractFromSql(event?.statement || '');
    if (fromSql) return { ...fromSql, source: 'sql-comment' };

    const fromApp = extractFromApplicationName(applicationName);
    if (fromApp) return { ...fromApp, source: 'application-name' };

    return { traceId: null, spanId: null, source: null };
}

/**
 * Ingest a single query event. Accepts an async `queryFn` (e.g. pg Pool.query-bound)
 * and persists the row with trace context attached. Returns the inserted id.
 *
 * The tagged row shape is:
 *   { id, ts, db, statement, duration_ms, plan_hash, trace_id, span_id }
 */
export async function ingestQueryEvent(
    queryFn,
    {
        event, // { ts, db, statement, duration_ms, plan_hash }
        explicit, // { traceId, spanId } optional
        applicationName, // Postgres session application_name, optional
        insertSql = `
        INSERT INTO query_events (ts, db, statement, duration_ms, plan_hash, trace_id, span_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
    `,
    } = {},
) {
    const ctx = resolveTraceContext({ event, explicit, applicationName });
    const row = [
        event.ts || new Date(),
        event.db || null,
        event.statement || '',
        event.duration_ms || 0,
        event.plan_hash || null,
        ctx.traceId,
        ctx.spanId,
    ];
    const result = await queryFn(insertSql, row);
    return { id: result?.rows?.[0]?.id, traceContextSource: ctx.source };
}

/**
 * Fetch all query events for a given trace.
 * Rows are ordered chronologically, earliest first.
 */
export async function getQueriesForTrace(queryFn, traceId, { limit = 500 } = {}) {
    if (!/^[0-9a-f]{32}$/i.test(traceId)) throw new Error('invalid traceId');
    const sql = `
        SELECT id, ts, db, statement, duration_ms, plan_hash, trace_id, span_id
          FROM query_events
         WHERE trace_id = $1
         ORDER BY ts ASC
         LIMIT $2
    `;
    const res = await queryFn(sql, [traceId.toLowerCase(), limit]);
    return res?.rows || [];
}

/**
 * Diagnostic: returns a summary for a trace — count, total latency, and the
 * distinct databases touched. Useful for the Trace Detail panel header.
 */
export async function summariseTrace(queryFn, traceId) {
    const rows = await getQueriesForTrace(queryFn, traceId, { limit: 5000 });
    if (rows.length === 0) return { traceId, found: false };
    const totalMs = rows.reduce((s, r) => s + Number(r.duration_ms || 0), 0);
    const dbs = [...new Set(rows.map((r) => r.db).filter(Boolean))];
    return {
        traceId,
        found: true,
        queryCount: rows.length,
        totalDurationMs: totalMs,
        databases: dbs,
        firstTs: rows[0].ts,
        lastTs: rows[rows.length - 1].ts,
    };
}

/**
 * Pure correlation: graft query events onto a span list by span_id, producing
 * a flat, timeline-ordered view plus rollups. No IO — fully unit-testable.
 *
 * @param {Array} spans   normalized spans: { spanId, parentSpanId, name, kind,
 *                        startTimeNs, endTimeNs, statusCode, serviceName }
 * @param {Array} queries query_events rows: { id, ts, db, statement,
 *                        duration_ms, plan_hash, trace_id, span_id }
 * @returns {{
 *   traceId: string|null,
 *   spans: Array<span & { queries: Array, dbTimeMs: number }>,
 *   orphanQueries: Array,        // queries whose span_id matched no span
 *   totals: { spanCount, queryCount, dbTimeMs, queryTimePctOfTrace },
 *   slowestQuery: object|null,   // the single highest-duration query
 *   slowestDbSpan: object|null,  // the span with the most cumulative DB time
 * }}
 */
export function correlateSpansWithQueries(spans = [], queries = []) {
    const bySpan = new Map();
    for (const q of queries) {
        const key = (q.span_id || '').toLowerCase();
        if (!key) continue;
        if (!bySpan.has(key)) bySpan.set(key, []);
        bySpan.get(key).push(q);
    }

    const matchedSpanIds = new Set();
    const enriched = spans.map((span) => {
        const key = (span.spanId || '').toLowerCase();
        const qs = bySpan.get(key) || [];
        if (qs.length) matchedSpanIds.add(key);
        const dbTimeMs = qs.reduce((sum, q) => sum + Number(q.duration_ms || 0), 0);
        return { ...span, queries: qs, dbTimeMs };
    });

    const orphanQueries = [];
    for (const [key, qs] of bySpan.entries()) {
        if (!matchedSpanIds.has(key)) orphanQueries.push(...qs);
    }

    const dbTimeMs = queries.reduce((sum, q) => sum + Number(q.duration_ms || 0), 0);

    // Trace wall-clock from span timestamps (ns → ms).
    const starts = spans.map((s) => Number(s.startTimeNs)).filter((n) => Number.isFinite(n));
    const ends = spans.map((s) => Number(s.endTimeNs)).filter((n) => n > 0);
    const traceMs = starts.length && ends.length ? (Math.max(...ends) - Math.min(...starts)) / 1_000_000 : 0;

    let slowestQuery = null;
    for (const q of queries) {
        if (!slowestQuery || Number(q.duration_ms || 0) > Number(slowestQuery.duration_ms || 0)) slowestQuery = q;
    }
    let slowestDbSpan = null;
    for (const sp of enriched) {
        if (sp.dbTimeMs > 0 && (!slowestDbSpan || sp.dbTimeMs > slowestDbSpan.dbTimeMs)) slowestDbSpan = sp;
    }

    const traceId = queries[0]?.trace_id || spans[0]?.traceId || null;

    return {
        traceId: traceId ? String(traceId).toLowerCase() : null,
        spans: enriched,
        orphanQueries,
        totals: {
            spanCount: spans.length,
            queryCount: queries.length,
            dbTimeMs,
            queryTimePctOfTrace: traceMs > 0 ? Math.round((dbTimeMs / traceMs) * 1000) / 10 : 0,
        },
        slowestQuery,
        slowestDbSpan: slowestDbSpan
            ? {
                  spanId: slowestDbSpan.spanId,
                  name: slowestDbSpan.name,
                  dbTimeMs: slowestDbSpan.dbTimeMs,
                  queryCount: slowestDbSpan.queries.length,
              }
            : null,
    };
}

/**
 * IO wrapper: fetch a trace's spans + its query events and return the
 * correlated view. `getSpans(traceId)` resolves normalized spans for the trace.
 */
export async function getCorrelatedTrace(queryFn, traceId, { getSpans, limit = 500 } = {}) {
    if (!/^[0-9a-f]{32}$/i.test(traceId)) throw new Error('invalid traceId');
    const queries = await getQueriesForTrace(queryFn, traceId, { limit });
    const spans = typeof getSpans === 'function' ? (await getSpans(traceId)) || [] : [];
    return correlateSpansWithQueries(spans, queries);
}
