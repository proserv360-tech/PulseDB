// @ts-nocheck — legacy JS style to match sibling services; type later (see docs/TS_MIGRATION.md)
/**
 * services/waitEventsService.js
 * ─────────────────────────────
 * Engine-agnostic wait-event access. Every adapter exposes getWaitEvents()
 * (BaseAdapter provides a "not implemented" default; Postgres, Oracle, MSSQL,
 * the warehouses, etc. override it). This service is the single dispatch +
 * normalization point so one route can serve all engines, gated by the
 * adapter's declared capability.
 *
 * Pure + injectable: fetchWaitEvents takes an adapter object, so it is fully
 * unit-testable with fakes — no DB or driver required.
 */

/**
 * Normalize a single adapter event into a stable shape. Adapters report time
 * under different keys (ms / micros) or as a waiter count; we surface a
 * canonical `ms` (when derivable) while preserving the raw fields.
 */
export function normalizeEvent(e) {
    if (!e || typeof e !== 'object') return null;
    const out = { event: String(e.event ?? e.wait_type ?? e.name ?? 'unknown') };
    if (e.ms != null) out.ms = Number(e.ms) || 0;
    else if (e.micros != null) out.ms = Math.round(((Number(e.micros) || 0) / 1000) * 100) / 100;
    if (e.waiters != null) out.waiters = Number(e.waiters) || 0;
    // Pass through richer per-engine detail (Postgres) for the detailed UI.
    if (e.type != null) out.type = String(e.type);
    if (e.waitEvent != null) out.waitEvent = String(e.waitEvent);
    if (Array.isArray(e.sessions)) out.sessions = e.sessions;
    return out;
}

/**
 * Fetch + normalize wait events for an adapter.
 *
 * @param {object} adapter  must implement getCapabilities() and getWaitEvents()
 * @returns {Promise<{
 *   supported: boolean,
 *   engine: string,
 *   window: string|null,
 *   events: Array<{event, ms?, waiters?}>,
 *   note?: string
 * }>}
 */
export async function fetchWaitEvents(adapter) {
    if (!adapter || typeof adapter.getCapabilities !== 'function') {
        throw new Error('fetchWaitEvents requires an adapter with getCapabilities()');
    }
    const caps = adapter.getCapabilities() || {};
    const engine = adapter.dbType || 'unknown';

    if (!caps.waitEvents) {
        return {
            supported: false,
            engine,
            window: null,
            events: [],
            note: `Wait-event introspection is not supported for ${engine}.`,
        };
    }
    if (typeof adapter.getWaitEvents !== 'function') {
        return {
            supported: false,
            engine,
            window: null,
            events: [],
            note: `${engine} declares waitEvents but implements no getWaitEvents().`,
        };
    }

    const raw = await adapter.getWaitEvents();
    const events = Array.isArray(raw?.events) ? raw.events.map(normalizeEvent).filter(Boolean) : [];
    // Sort by ms desc when available so the worst waits surface first.
    events.sort((a, b) => (Number(b.ms) || 0) - (Number(a.ms) || 0));

    return {
        supported: true,
        engine,
        window: raw?.window ?? null,
        events,
        ...(raw?.note ? { note: raw.note } : {}),
    };
}
