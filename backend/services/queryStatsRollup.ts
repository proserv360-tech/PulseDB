/**
 * services/queryStatsRollup.ts
 * ────────────────────────────
 * "Top queries by load" rollup over collector-shipped pg_stat_statements
 * snapshots (closes the future-work note in agentIngestRoutes).
 *
 * Snapshots are cumulative counters, so load per window is the DELTA between
 * the first and last snapshot per query within the window. New queries
 * (no earlier snapshot) count from zero.
 *
 *   topQueriesByLoad({ controlPool, connectionId, hours, limit })
 *   computeDeltas(earliest, latest)  — pure; exported for tests
 */

export type StatRow = {
    query_id: string;
    calls: number;
    total_exec_time: number;
    mean_exec_time?: number;
    rows?: number;
    query?: string;
};

/** Delta of cumulative counters between two snapshots, keyed by query_id. */
export function computeDeltas(earliest: StatRow[], latest: StatRow[]) {
    const base = new Map<string, StatRow>();
    for (const r of earliest || []) if (r?.query_id) base.set(String(r.query_id), r);
    const out: Array<StatRow & { load_ms: number; calls_delta: number }> = [];
    for (const r of latest || []) {
        if (!r?.query_id) continue;
        const prev = base.get(String(r.query_id));
        const loadMs = Math.max(0, Number(r.total_exec_time || 0) - Number(prev?.total_exec_time || 0));
        const callsDelta = Math.max(0, Number(r.calls || 0) - Number(prev?.calls || 0));
        // Counter reset (stats reset / restart): fall back to absolute values.
        const reset = prev && Number(r.total_exec_time) < Number(prev.total_exec_time);
        out.push({
            ...r,
            load_ms: reset ? Number(r.total_exec_time || 0) : loadMs,
            calls_delta: reset ? Number(r.calls || 0) : callsDelta,
        });
    }
    return out.filter((r) => r.load_ms > 0 || r.calls_delta > 0).sort((a, b) => b.load_ms - a.load_ms);
}

export async function topQueriesByLoad({ controlPool, connectionId, hours = 1, limit = 25 }: any) {
    const { rows } = await controlPool
        .query(
            `(SELECT snapshot, captured_at FROM pgmonitoringtool.agent_query_stats
           WHERE connection_id = $1 AND captured_at > now() - ($2 || ' hours')::interval
           ORDER BY captured_at ASC LIMIT 1)
         UNION ALL
         (SELECT snapshot, captured_at FROM pgmonitoringtool.agent_query_stats
           WHERE connection_id = $1 AND captured_at > now() - ($2 || ' hours')::interval
           ORDER BY captured_at DESC LIMIT 1)`,
            [String(connectionId), String(hours)],
        )
        .catch((err: any) => {
            if (/relation .* does not exist/i.test(err.message)) return { rows: [] };
            throw err;
        });

    if (!rows.length) return { window_hours: hours, queries: [], snapshots: 0 };
    const parse = (s: any) => (typeof s === 'string' ? JSON.parse(s) : s) as StatRow[];
    const earliest = parse(rows[0].snapshot);
    const latest = parse(rows[rows.length - 1].snapshot);
    const single = rows.length < 2 || rows[0].captured_at === rows[rows.length - 1].captured_at;

    const deltas = single ? computeDeltas([], latest) : computeDeltas(earliest, latest);
    return {
        window_hours: hours,
        snapshots: single ? 1 : 2,
        from: rows[0].captured_at,
        to: rows[rows.length - 1].captured_at,
        queries: deltas.slice(0, Math.min(Number(limit) || 25, 100)).map((q) => ({
            queryId: q.query_id,
            query: String(q.query || '').slice(0, 500),
            loadMs: Math.round(q.load_ms),
            calls: q.calls_delta,
            meanMs: q.calls_delta > 0 ? Math.round((q.load_ms / q.calls_delta) * 100) / 100 : null,
            rows: q.rows ?? null,
        })),
    };
}
