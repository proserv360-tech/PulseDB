/**
 * utils/shape.ts
 * Runtime shape guards for API responses.
 *
 * Three production section-crashes (June 2026) traced to components trusting
 * API payload shapes: a pg interval object rendered as JSX, a stats payload
 * missing `cpu`, and duration fields that were sometimes objects. These
 * helpers make the "merge payload over a known-good default" pattern cheap
 * so a malformed or partial payload can never take down a section.
 *
 *   const stats = withDefaults(payload, DEFAULT_SERVER_STATS);
 *   const rows  = asArray<TxnRow>(payload?.longTransactions);
 *   const pct   = asNumber(row.pct, 0);
 *   const label = asText(row.duration, '—');   // objects become '—', never JSX
 */

/** Deep-merge `data` over `defaults`. Arrays and primitives replace; plain
 *  objects merge recursively. Anything missing or of the wrong type keeps
 *  the default, so the result always has the default's full shape. */
export function withDefaults<T>(data: unknown, defaults: T): T {
    if (data == null || typeof data !== 'object' || Array.isArray(data)) return defaults;
    if (defaults == null || typeof defaults !== 'object' || Array.isArray(defaults)) {
        return (data as T) ?? defaults;
    }
    const out: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };
    const src = data as Record<string, unknown>;
    for (const key of Object.keys(src)) {
        const d = (defaults as Record<string, unknown>)[key];
        const v = src[key];
        if (v == null) continue;
        if (d != null && typeof d === 'object' && !Array.isArray(d)) {
            out[key] = withDefaults(v, d);
        } else if (d === undefined || typeof v === typeof d || d === null) {
            out[key] = v;
        }
        // wrong primitive type for a typed default -> keep default
    }
    return out as T;
}

/** Always returns an array (the payload's array, or `fallback`/empty). */
export function asArray<T = unknown>(v: unknown, fallback: T[] = []): T[] {
    return Array.isArray(v) ? (v as T[]) : fallback;
}

/** Coerces to a finite number or returns `fallback`. Accepts numeric strings. */
export function asNumber(v: unknown, fallback = 0): number {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && isFinite(Number(v))) return Number(v);
    return fallback;
}

/** Safe for JSX: strings/numbers pass through, everything else (objects,
 *  arrays, null) becomes `fallback`. Prevents React error #31. */
export function asText(v: unknown, fallback = ''): string {
    if (typeof v === 'string') return v;
    if (typeof v === 'number' && isFinite(v)) return String(v);
    if (typeof v === 'boolean') return String(v);
    return fallback;
}

/** Postgres `interval` columns arrive as objects like
 *  {days, hours, minutes, seconds, milliseconds}. Returns total seconds. */
export function intervalToSeconds(v: unknown): number {
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        return (
            asNumber(o.days) * 86400 +
            asNumber(o.hours) * 3600 +
            asNumber(o.minutes) * 60 +
            Math.floor(asNumber(o.seconds))
        );
    }
    return 0;
}

export default { withDefaults, asArray, asNumber, asText, intervalToSeconds };
