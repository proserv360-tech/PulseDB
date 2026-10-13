// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * traceContext.js
 * ────────────────
 * W3C Trace Context parsing + extraction helpers.
 *
 * W3C traceparent format:
 *   traceparent: 00-<trace-id 32 hex>-<span-id 16 hex>-<flags 2 hex>
 * tracestate is ignored here — we just carry through the two IDs.
 *
 * Three extraction paths:
 *   • HTTP headers on the incoming Express request.
 *   • SQL comment of the form `/*traceparent='00-…-…-…' *​/`
 *     — this is the sqlcommenter / Google Cloud SQL tagging convention; a
 *     number of instrumentation libraries embed it automatically.
 *   • PG application_name setting, when the app puts the traceparent there.
 */

const TRACEPARENT_RE = /^(?<version>[0-9a-f]{2})-(?<traceId>[0-9a-f]{32})-(?<spanId>[0-9a-f]{16})-(?<flags>[0-9a-f]{2})$/;
const SQLCOMMENT_RE = /\/\*\s*traceparent\s*=\s*'([^']+)'\s*\*\//i;

/**
 * Parse a raw traceparent string.
 * @returns {{traceId:string, spanId:string, flags:string}|null}
 */
export function parseTraceparent(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const m = TRACEPARENT_RE.exec(raw.trim());
    if (!m || !m.groups) return null;
    // Reject all-zero IDs — W3C spec treats them as invalid.
    if (/^0+$/.test(m.groups.traceId) || /^0+$/.test(m.groups.spanId)) return null;
    return { traceId: m.groups.traceId, spanId: m.groups.spanId, flags: m.groups.flags };
}

/** Extract trace context from an Express-style request. */
export function extractFromRequest(req) {
    if (!req || !req.headers) return null;
    const header = req.headers.traceparent || req.headers['traceparent'];
    return parseTraceparent(Array.isArray(header) ? header[0] : header);
}

/** Extract trace context from a SQL statement with a sqlcommenter comment. */
export function extractFromSql(sql) {
    if (!sql || typeof sql !== 'string') return null;
    const m = SQLCOMMENT_RE.exec(sql);
    if (!m) return null;
    return parseTraceparent(m[1]);
}

/** Extract trace context from a Postgres application_name string. */
export function extractFromApplicationName(appName) {
    return parseTraceparent(appName);
}

/** Serialise a context back to a W3C traceparent string (version 00). */
export function formatTraceparent({ traceId, spanId, flags = '01' } = {}) {
    if (!traceId || !spanId) return null;
    return `00-${traceId}-${spanId}-${flags}`;
}
