// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/otlpTraceService.js
 * ────────────────────────────
 * OpenTelemetry span and trace storage, sampling, and querying.
 *
 * Pure helpers:
 *   - parseOtlpRequest(body)
 *   - sampleDecision(samplingRate, traceIdHex)
 *   - assembleTraceSummary(spans)
 *   - buildSpanTree(spans)
 *
 * Database operations:
 *   - ingestSpans(pool, { orgId, spans })
 *   - listTraces(pool, { orgId, serviceName, minDurationMs, limit, beforeStartTime, status })
 *   - getSpanTree(pool, { orgId, traceId })
 *   - pivotToQueries(pool, { orgId, traceId })
 *   - getOrgTraceSettings(pool, orgId)
 *   - updateOrgTraceSettings(pool, orgId, { samplingRate, retentionDays, maxSpansPerTrace })
 *   - purgeExpiredTraces(pool, { nowTs })
 */

import crypto from 'node:crypto';

const S = 'pgmonitoringtool';

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse OTLP/HTTP JSON batch into normalized spans.
 * OTLP format: { resourceSpans: [ { resource: {...}, scopeSpans: [ { scope: {...}, spans: [...] } ] } ] }
 *
 * Returns array of normalized spans:
 *   { traceId, spanId, parentSpanId, serviceName, operationName, kind,
 *     startTimeNs, endTimeNs, durationMs, statusCode, statusMessage,
 *     attributes, resourceAttributes, events }
 */
export function parseOtlpRequest(body) {
    const normalized = [];

    if (!body || !Array.isArray(body.resourceSpans)) {
        return normalized;
    }

    for (const resourceSpan of body.resourceSpans) {
        const resourceAttrs = resourceSpan.resource?.attributes || {};
        const serviceName = resourceAttrs['service.name'] || 'unknown';

        if (!Array.isArray(resourceSpan.scopeSpans)) {
            continue;
        }

        for (const scopeSpan of resourceSpan.scopeSpans) {
            if (!Array.isArray(scopeSpan.spans)) {
                continue;
            }

            for (const span of scopeSpan.spans) {
                // Skip spans with no startTimeUnixNano (incomplete)
                if (!span.startTimeUnixNano) {
                    continue;
                }

                const traceId = span.traceId ? bytesToHex(span.traceId) : null;
                const spanId = span.spanId ? bytesToHex(span.spanId) : null;
                const parentSpanId = span.parentSpanId ? bytesToHex(span.parentSpanId) : null;

                if (!traceId || !spanId) {
                    continue;
                }

                const startNs = Number(span.startTimeUnixNano) || 0;
                const endNs = Number(span.endTimeUnixNano) || startNs;
                const durationMs = (endNs - startNs) / 1_000_000;

                // Map numeric status codes to strings (0=OK, 1=ERROR, 2=UNSET, etc.)
                const statusCodeMap = { 0: 'OK', 1: 'ERROR', 2: 'UNSET' };
                const statusCode = span.status?.code;
                const statusCodeStr = typeof statusCode === 'number'
                    ? statusCodeMap[statusCode] || 'UNSET'
                    : (statusCode || 'UNSET');

                normalized.push({
                    traceId,
                    spanId,
                    parentSpanId,
                    serviceName,
                    operationName: span.name || 'unknown',
                    kind: span.kind || 'INTERNAL',
                    startTimeNs: startNs,
                    endTimeNs: endNs,
                    durationMs: Math.max(0, durationMs),
                    statusCode: statusCodeStr,
                    statusMessage: span.status?.message || '',
                    attributes: span.attributes || {},
                    resourceAttributes: resourceAttrs,
                    events: span.events || [],
                });
            }
        }
    }

    return normalized;
}

/**
 * Deterministic sampling decision based on traceId.
 * Hash traceId hex to [0, 1] and compare to samplingRate.
 * Pure function; no IO.
 */
export function sampleDecision({ samplingRate, traceIdHex }) {
    if (samplingRate >= 1.0) return true;
    if (samplingRate <= 0.0) return false;

    // Hash traceIdHex to a value in [0, 1]
    const hash = crypto.createHash('sha256').update(traceIdHex).digest();
    const hashInt = hash.readUInt32BE(0);
    const normalizedHash = (hashInt >>> 0) / 0xffffffff;

    return normalizedHash < samplingRate;
}

/**
 * Build a parent→children tree from a flat span list.
 * Returns { [parentSpanId]: [child1, child2, ...], ... }
 * Pure helper; no IO.
 */
export function buildSpanTree(spans) {
    const tree = {};

    // Initialize null key for root spans
    tree[null] = [];

    if (!spans || spans.length === 0) {
        return tree;
    }

    // Index spans by spanId
    for (const span of spans) {
        const parentId = span.parentSpanId || null;
        if (!tree[parentId]) {
            tree[parentId] = [];
        }
    }

    // Build parent→children map
    for (const span of spans) {
        const parentId = span.parentSpanId || null;
        if (!tree[parentId]) {
            tree[parentId] = [];
        }
        tree[parentId].push(span);
    }

    return tree;
}

/**
 * Assemble a trace summary from all its spans.
 * Computes: root span, total duration, status, span_count, error_count.
 * Pure function; no IO.
 */
export function assembleTraceSummary(spans) {
    if (!spans || spans.length === 0) {
        return {
            rootSpan: null,
            spanCount: 0,
            errorCount: 0,
            status: 'unset',
            durationMs: 0,
        };
    }

    // Find root span (no parent_span_id)
    const rootSpans = spans.filter(s => !s.parentSpanId);
    const rootSpan = rootSpans.length > 0 ? rootSpans[0] : spans[0];

    // Calculate duration: max(endTimeNs) - min(startTimeNs)
    const startTimes = spans.map(s => s.startTimeNs).filter(t => t > 0);
    const endTimes = spans.map(s => s.endTimeNs).filter(t => t > 0);
    const minStart = Math.min(...startTimes);
    const maxEnd = Math.max(...endTimes);
    const durationMs = (maxEnd - minStart) / 1_000_000;

    // Count errors (statusCode == 'ERROR')
    const errorCount = spans.filter(s => s.statusCode === 'ERROR').length;

    // Overall status: if any error, mark as error; else ok
    const status = errorCount > 0 ? 'error' : (rootSpan?.statusCode === 'ERROR' ? 'error' : 'ok');

    return {
        rootSpan,
        spanCount: spans.length,
        errorCount,
        status,
        durationMs: Math.max(0, durationMs),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function bytesToHex(bytes) {
    if (typeof bytes === 'string') return bytes;
    if (bytes instanceof Uint8Array || Buffer.isBuffer(bytes)) {
        return Buffer.from(bytes).toString('hex');
    }
    return '';
}

function hexToBytes(hex) {
    return Buffer.from(hex, 'hex');
}

function nsToTimestamptz(ns) {
    return new Date(Number(ns) / 1_000_000).toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ingest normalized spans into otlp_spans and upsert otlp_traces.
 * Batched INSERT with ON CONFLICT DO NOTHING.
 */
export async function ingestSpans(pool, { orgId, spans }) {
    if (!spans || spans.length === 0) {
        return { inserted: 0, updated: 0 };
    }

    // Group spans by traceId to batch upserts
    const spansByTrace = new Map();
    for (const span of spans) {
        if (!spansByTrace.has(span.traceId)) {
            spansByTrace.set(span.traceId, []);
        }
        spansByTrace.get(span.traceId).push(span);
    }

    let inserted = 0;
    let updated = 0;

    // Ingest all spans in one batch
    if (spans.length > 0) {
        const placeholders = [];
        const params = [];
        let paramIdx = 1;

        for (const span of spans) {
            placeholders.push(
                `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, ` +
                `$${paramIdx + 5}, $${paramIdx + 6}, $${paramIdx + 7}, $${paramIdx + 8}, $${paramIdx + 9}, ` +
                `$${paramIdx + 10}, $${paramIdx + 11}, $${paramIdx + 12}, $${paramIdx + 13}, $${paramIdx + 14})`
            );

            params.push(
                hexToBytes(span.spanId),
                hexToBytes(span.traceId),
                span.parentSpanId ? hexToBytes(span.parentSpanId) : null,
                orgId,
                span.serviceName,
                span.operationName,
                span.kind,
                nsToTimestamptz(span.startTimeNs),
                nsToTimestamptz(span.endTimeNs),
                span.durationMs,
                span.statusCode,
                span.statusMessage,
                JSON.stringify(span.attributes),
                JSON.stringify(span.resourceAttributes),
                JSON.stringify(span.events)
            );

            paramIdx += 15;
        }

        const spanInsertSql = `
            INSERT INTO ${S}.otlp_spans
                (span_id, trace_id, parent_span_id, org_id, service_name, operation_name,
                 span_kind, start_time, end_time, duration_ms, status_code, status_message,
                 attributes, resource_attributes, events)
            VALUES ${placeholders.join(', ')}
            ON CONFLICT DO NOTHING
        `;

        const spanRes = await pool.query(spanInsertSql, params);
        inserted = spanRes.rowCount || 0;
    }

    // Upsert otlp_traces for each traceId
    for (const [traceId, traceSpans] of spansByTrace.entries()) {
        const summary = assembleTraceSummary(traceSpans);
        const rootSpanId = summary.rootSpan?.spanId || null;

        const traceInsertSql = `
            INSERT INTO ${S}.otlp_traces
                (trace_id, org_id, root_span_id, service_name, start_time, end_time,
                 duration_ms, span_count, error_count, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (trace_id) DO UPDATE
            SET span_count = EXCLUDED.span_count,
                error_count = EXCLUDED.error_count,
                status = EXCLUDED.status,
                end_time = EXCLUDED.end_time,
                duration_ms = EXCLUDED.duration_ms
        `;

        const traceParams = [
            hexToBytes(traceId),
            orgId,
            rootSpanId ? hexToBytes(rootSpanId) : null,
            summary.rootSpan?.serviceName || 'unknown',
            nsToTimestamptz(summary.rootSpan?.startTimeNs || 0),
            nsToTimestamptz(summary.rootSpan?.endTimeNs || 0),
            summary.durationMs,
            summary.spanCount,
            summary.errorCount,
            summary.status,
        ];

        const traceRes = await pool.query(traceInsertSql, traceParams);
        if (traceRes.rowCount > 0) updated++;
    }

    return { inserted, updated };
}

/**
 * List traces with optional filters.
 * Keyset pagination on start_time DESC.
 */
export async function listTraces(pool, {
    orgId,
    serviceName,
    minDurationMs,
    limit = 50,
    beforeStartTime,
    status,
}) {
    const conditions = ['org_id = $1'];
    const params = [orgId];
    let paramIdx = 2;

    if (serviceName) {
        conditions.push(`service_name = $${paramIdx}`);
        params.push(serviceName);
        paramIdx++;
    }

    if (minDurationMs !== undefined && minDurationMs > 0) {
        conditions.push(`duration_ms >= $${paramIdx}`);
        params.push(minDurationMs);
        paramIdx++;
    }

    if (status) {
        conditions.push(`status = $${paramIdx}`);
        params.push(status);
        paramIdx++;
    }

    if (beforeStartTime) {
        conditions.push(`start_time < $${paramIdx}`);
        params.push(beforeStartTime);
        paramIdx++;
    }

    const where = conditions.join(' AND ');
    const sql = `
        SELECT trace_id, org_id, service_name, start_time, end_time,
               duration_ms, span_count, error_count, status, created_at
        FROM ${S}.otlp_traces
        WHERE ${where}
        ORDER BY start_time DESC
        LIMIT $${paramIdx}
    `;

    params.push(Math.min(limit, 1000));

    const { rows } = await pool.query(sql, params);
    return rows.map(row => ({
        ...row,
        trace_id: row.trace_id ? Buffer.from(row.trace_id).toString('hex') : null,
    }));
}

/**
 * Get all spans for a trace and build a parent→children tree.
 */
export async function getSpanTree(pool, { orgId, traceId }) {
    const traceIdBytes = hexToBytes(traceId);

    const spansSql = `
        SELECT span_id, trace_id, parent_span_id, org_id, service_name,
               operation_name, span_kind, start_time, end_time, duration_ms,
               status_code, status_message, attributes, resource_attributes, events
        FROM ${S}.otlp_spans
        WHERE org_id = $1 AND trace_id = $2
        ORDER BY start_time ASC
    `;

    const { rows } = await pool.query(spansSql, [orgId, traceIdBytes]);

    const spans = rows.map(row => ({
        ...row,
        span_id: Buffer.from(row.span_id).toString('hex'),
        trace_id: Buffer.from(row.trace_id).toString('hex'),
        parent_span_id: row.parent_span_id ? Buffer.from(row.parent_span_id).toString('hex') : null,
        attributes: row.attributes || {},
        resource_attributes: row.resource_attributes || {},
        events: row.events || [],
    }));

    const tree = buildSpanTree(spans);

    return {
        traceId,
        rootSpan: spans.find(s => !s.parent_span_id) || spans[0] || null,
        spans,
        tree,
    };
}

/**
 * Get queries correlated to a trace via trace ID linkage.
 * Calls getQueriesForTrace from trace/traceCorrelation.js if available.
 */
export async function pivotToQueries(pool, { orgId, traceId }) {
    try {
        // Attempt to import and call the existing trace correlation function
        const { getQueriesForTrace } = await import('./trace/traceCorrelation.js');

        if (typeof getQueriesForTrace === 'function') {
            const queries = await getQueriesForTrace(pool.query.bind(pool), traceId);
            return {
                traceId,
                queries: queries || [],
            };
        }
    } catch (err) {
        // Function not available or import failed; return empty list
    }

    return {
        traceId,
        queries: [],
    };
}

/**
 * Get per-org trace settings (sampling, retention, limits).
 * Fills with defaults if not found.
 */
export async function getOrgTraceSettings(pool, orgId) {
    const sql = `
        SELECT org_id, sampling_rate, retention_days, max_spans_per_trace, updated_at
        FROM ${S}.otlp_trace_settings
        WHERE org_id = $1
    `;

    const { rows } = await pool.query(sql, [orgId]);

    if (rows[0]) {
        return rows[0];
    }

    // Return defaults
    return {
        org_id: orgId,
        sampling_rate: 1.0,
        retention_days: 7,
        max_spans_per_trace: 2000,
        updated_at: new Date(),
    };
}

/**
 * Update per-org trace settings.
 */
export async function updateOrgTraceSettings(
    pool,
    orgId,
    { samplingRate, retentionDays, maxSpansPerTrace }
) {
    const fields = [];
    const params = [orgId];
    let paramIdx = 2;

    if (samplingRate !== undefined) {
        fields.push(`sampling_rate = $${paramIdx}`);
        params.push(Math.max(0, Math.min(1, samplingRate)));
        paramIdx++;
    }

    if (retentionDays !== undefined) {
        fields.push(`retention_days = $${paramIdx}`);
        params.push(Math.max(1, Math.min(90, retentionDays)));
        paramIdx++;
    }

    if (maxSpansPerTrace !== undefined) {
        fields.push(`max_spans_per_trace = $${paramIdx}`);
        params.push(Math.max(1, maxSpansPerTrace));
        paramIdx++;
    }

    fields.push(`updated_at = now()`);

    const sql = `
        INSERT INTO ${S}.otlp_trace_settings
            (org_id, sampling_rate, retention_days, max_spans_per_trace, updated_at)
        VALUES ($1, $2, $3, $4, now())
        ON CONFLICT (org_id) DO UPDATE SET
            ${fields.join(', ')}
        RETURNING org_id, sampling_rate, retention_days, max_spans_per_trace, updated_at
    `;

    if (fields.length === 1) {
        // Only updated_at changed; use simple INSERT
        const insertSql = `
            INSERT INTO ${S}.otlp_trace_settings (org_id)
            VALUES ($1)
            ON CONFLICT (org_id) DO NOTHING
            RETURNING org_id, sampling_rate, retention_days, max_spans_per_trace, updated_at
        `;
        const { rows } = await pool.query(insertSql, [orgId]);
        return rows[0] || (await getOrgTraceSettings(pool, orgId));
    }

    const { rows } = await pool.query(sql, params);
    return rows[0];
}

/**
 * Delete traces older than retention period.
 * Returns count of deleted traces and spans.
 */
export async function purgeExpiredTraces(pool, { nowTs = new Date() } = {}) {
    // Get all orgs' retention days
    const settingsSql = `
        SELECT org_id, retention_days
        FROM ${S}.otlp_trace_settings
        UNION ALL
        SELECT id as org_id, 7 as retention_days
        FROM ${S}.organizations
        WHERE id NOT IN (SELECT org_id FROM ${S}.otlp_trace_settings)
    `;

    const { rows: settings } = await pool.query(settingsSql);

    let totalDeletedTraces = 0;
    let totalDeletedSpans = 0;

    for (const { org_id, retention_days } of settings) {
        const cutoffDate = new Date(nowTs);
        cutoffDate.setDate(cutoffDate.getDate() - retention_days);

        // Delete spans first (cascades from traces would handle this)
        const spanDeleteSql = `
            DELETE FROM ${S}.otlp_spans
            WHERE org_id = $1 AND start_time < $2
        `;
        const spanRes = await pool.query(spanDeleteSql, [org_id, cutoffDate]);
        totalDeletedSpans += spanRes.rowCount || 0;

        // Then delete traces
        const traceDeleteSql = `
            DELETE FROM ${S}.otlp_traces
            WHERE org_id = $1 AND start_time < $2
        `;
        const traceRes = await pool.query(traceDeleteSql, [org_id, cutoffDate]);
        totalDeletedTraces += traceRes.rowCount || 0;
    }

    return {
        deletedTraces: totalDeletedTraces,
        deletedSpans: totalDeletedSpans,
    };
}

// B9 — Worker-tier entry point. The web tier enqueues a payload of the
// shape { orgId, spans, dropped } and the worker calls ingestSpansBatch.
// Kept as a thin wrapper around ingestSpans() so the existing direct path
// stays usable in dev / single-process mode.
export async function ingestSpansBatch(payload) {
    const { pool: poolArg, orgId, spans, dropped = 0 } = payload || {};
    // Lazy-require pg pool if the worker did not pass one (it will).
    let pool = poolArg;
    if (!pool) {
        const dbMod = await import('../db.js');
        pool = dbMod.pool || dbMod.default || null;
        if (!pool) throw new Error('ingestSpansBatch: no pool available');
    }
    const r = await ingestSpans(pool, { orgId, spans });
    return { accepted: r.inserted, dropped };
}

