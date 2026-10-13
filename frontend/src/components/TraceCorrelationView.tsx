/**
 * TraceCorrelationView.tsx
 * ────────────────────────
 * Unified trace view (merges the former "Trace Detail"). Renders
 * GET /api/traces/:traceId/correlate — the OTLP span tree with the SQL each
 * span issued, slowest query/DB-span highlights, and DB-time % of the trace —
 * plus a flat "All queries in this trace" table. When the trace has no OTLP
 * spans it falls back to the query-tag source (/api/enterprise/trace/:id/*)
 * so query-only traces still resolve.
 *
 * Drop-in: <TraceCorrelationView traceId={id} />
 */
import { useEffect, useState } from 'react';
import { fetchDataFresh } from '../utils/api';
import { THEME, useAdaptiveTheme } from '../utils/theme';
import { AlertTriangle, Gauge, Database } from 'lucide-react';

type Query = { id: number; db?: string; statement: string; duration_ms: number; plan_hash?: string; span_id?: string };
type CSpan = {
    spanId: string;
    parentSpanId: string | null;
    name?: string;
    kind?: string;
    serviceName?: string;
    statusCode?: string;
    queries: Query[];
    dbTimeMs: number;
};
export type CorrelatedTrace = {
    traceId: string | null;
    spans: CSpan[];
    orphanQueries: Query[];
    totals: { spanCount: number; queryCount: number; dbTimeMs: number; queryTimePctOfTrace: number };
    slowestQuery: Query | null;
    slowestDbSpan: { spanId: string; name?: string; dbTimeMs: number; queryCount: number } | null;
};

/** Pure: order spans into a parent→child indented list with a `depth` field. */
export function flattenSpanTree(spans: CSpan[]): Array<CSpan & { depth: number }> {
    const byParent = new Map<string | null, CSpan[]>();
    for (const s of spans || []) {
        const p = s.parentSpanId || null;
        if (!byParent.has(p)) byParent.set(p, []);
        byParent.get(p)!.push(s);
    }
    const out: Array<CSpan & { depth: number }> = [];
    const seen = new Set<string>();
    function walk(parent: string | null, depth: number) {
        for (const s of byParent.get(parent) || []) {
            if (seen.has(s.spanId)) continue; // guard against cycles
            seen.add(s.spanId);
            out.push({ ...s, depth });
            walk(s.spanId, depth + 1);
        }
    }
    walk(null, 0);
    for (const s of spans || []) if (!seen.has(s.spanId)) out.push({ ...s, depth: 0 });
    return out;
}

/** Pure: flatten every query in the trace (per-span + orphan) sorted slowest-first. */
export function allTraceQueries(data: CorrelatedTrace | null): Array<Query & { spanName?: string }> {
    if (!data) return [];
    const out: Array<Query & { spanName?: string }> = [];
    for (const s of data.spans || [])
        for (const q of s.queries || []) out.push({ ...q, spanName: s.name || s.spanId?.slice(0, 8) });
    for (const q of data.orphanQueries || []) out.push({ ...q, spanName: '(no span)' });
    return out.sort((a, b) => (Number(b.duration_ms) || 0) - (Number(a.duration_ms) || 0));
}

function truncate(sql: string, n = 120) {
    return (sql || '').length > n ? sql.slice(0, n) + '…' : sql || '';
}

const chip = (text: string, color: string) => (
    <span
        style={{
            fontSize: 11,
            fontWeight: 600,
            color,
            background: `${color}18`,
            border: `1px solid ${color}44`,
            borderRadius: 6,
            padding: '1px 7px',
        }}
    >
        {text}
    </span>
);

export default function TraceCorrelationView({ traceId }: { traceId: string }) {
    useAdaptiveTheme();
    const [data, setData] = useState<CorrelatedTrace | null>(null);
    const [fallback, setFallback] = useState<{ queries: any[]; summary: any } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    async function load() {
        setLoading(true);
        setError(null);
        setFallback(null);
        try {
            const d = (await fetchDataFresh(`/api/traces/${traceId}/correlate`)) as CorrelatedTrace;
            setData(d);
            const total =
                (d?.spans || []).reduce((n, s) => n + (s.queries?.length || 0), 0) + (d?.orphanQueries?.length || 0);
            if (total === 0 && (d?.spans?.length || 0) === 0) {
                // No OTLP spans/queries — fall back to the query-tag source (former Trace Detail).
                const [q, s] = await Promise.all([
                    fetchDataFresh(`/api/enterprise/trace/${traceId}/queries`).catch(() => null),
                    fetchDataFresh(`/api/enterprise/trace/${traceId}/summary`).catch(() => null),
                ]);
                const queries = (q as any)?.queries || (Array.isArray(q) ? q : []);
                if (queries && queries.length) setFallback({ queries, summary: (s as any)?.summary || s });
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to load trace correlation');
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        if (traceId) load(); /* eslint-disable-next-line */
    }, [traceId]);

    const card = (children: React.ReactNode) => (
        <div
            style={{
                background: THEME.surface,
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: 14,
                padding: 20,
                fontFamily: THEME.fontBody,
            }}
        >
            {children}
        </div>
    );

    if (loading) {
        return card(
            <div style={{ padding: 20, textAlign: 'center', color: THEME.textMuted, fontSize: 13 }}>
                Loading trace…
            </div>,
        );
    }
    if (error) {
        return card(
            <div style={{ padding: 6, color: THEME.danger, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertTriangle size={15} /> {error}
                <button
                    onClick={load}
                    style={{
                        marginLeft: 8,
                        background: 'none',
                        border: `1px solid ${THEME.glassBorder}`,
                        borderRadius: 6,
                        padding: '2px 8px',
                        cursor: 'pointer',
                        color: THEME.textMuted,
                        fontSize: 12,
                    }}
                >
                    Retry
                </button>
            </div>,
        );
    }
    if (!data) return null;

    const rows = flattenSpanTree(data.spans);
    const flatQueries = allTraceQueries(data);
    const slowSpanId = data.slowestDbSpan?.spanId;
    const slowQueryId = data.slowestQuery?.id;
    const hasSpans = rows.length > 0;

    const queryTable = (header: string, cols: string[], body: React.ReactNode) => (
        <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Database size={15} color={THEME.primary} />
                <span style={{ fontSize: 13, fontWeight: 700, color: THEME.textMain }}>{header}</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                        <tr style={{ color: THEME.textMuted, textAlign: 'left' }}>
                            {cols.map((h) => (
                                <th
                                    key={h}
                                    style={{
                                        padding: '6px 8px',
                                        borderBottom: `1px solid ${THEME.glassBorder}`,
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>{body}</tbody>
                </table>
            </div>
        </div>
    );

    return card(
        <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Gauge size={17} color={THEME.primary} />
                <div style={{ fontSize: 15, fontWeight: 700, color: THEME.textMain }}>Trace correlation</div>
            </div>
            <div style={{ fontSize: 12.5, color: THEME.textMuted, marginBottom: 14 }}>
                {data.totals.spanCount} spans · {data.totals.queryCount} queries ·{' '}
                {data.totals.dbTimeMs.toLocaleString()} ms in DB ({data.totals.queryTimePctOfTrace}% of trace)
            </div>

            {data.slowestQuery && (
                <div
                    style={{
                        fontSize: 12.5,
                        color: THEME.textMain,
                        background: '#fbbf2414',
                        border: '1px solid #fbbf2444',
                        borderRadius: 8,
                        padding: '8px 12px',
                        marginBottom: 14,
                    }}
                >
                    Slowest query:{' '}
                    <code style={{ fontFamily: THEME.fontMono }}>{truncate(data.slowestQuery.statement, 80)}</code> —{' '}
                    <strong>{data.slowestQuery.duration_ms} ms</strong>
                </div>
            )}

            {hasSpans && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {rows.map((s) => (
                        <div
                            key={s.spanId}
                            style={{
                                paddingLeft: 6 + s.depth * 18,
                                borderLeft:
                                    s.spanId === slowSpanId ? '2px solid #fbbf24' : `2px solid ${THEME.glassBorder}`,
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    flexWrap: 'wrap',
                                    padding: '3px 0',
                                }}
                            >
                                <span style={{ fontSize: 13, fontWeight: 600, color: THEME.textMain }}>
                                    {s.name || s.spanId.slice(0, 8)}
                                </span>
                                {s.serviceName && (
                                    <span style={{ fontSize: 11.5, color: THEME.textMuted }}>{s.serviceName}</span>
                                )}
                                {s.dbTimeMs > 0 && chip(`${s.dbTimeMs} ms DB`, THEME.primary)}
                                {s.statusCode === 'ERROR' && chip('ERROR', THEME.danger)}
                            </div>
                            {s.queries.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 4 }}>
                                    {s.queries.map((q) => (
                                        <div
                                            key={q.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 10,
                                                fontSize: 12,
                                                paddingLeft: 14,
                                                color: q.id === slowQueryId ? THEME.warning : THEME.textMuted,
                                            }}
                                        >
                                            <code
                                                title={q.statement}
                                                style={{
                                                    fontFamily: THEME.fontMono,
                                                    flex: 1,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {truncate(q.statement)}
                                            </code>
                                            <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                {q.duration_ms} ms
                                            </span>
                                            {q.db && <span style={{ color: THEME.textMuted }}>{q.db}</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Flat all-queries table (folds in the former Trace Detail). */}
            {flatQueries.length > 0 &&
                queryTable(
                    'All queries in this trace',
                    ['Query', 'Duration', 'DB', 'Span'],
                    flatQueries.map((q, i) => (
                        <tr key={i} style={{ color: q.id === slowQueryId ? THEME.warning : THEME.textMain }}>
                            <td
                                style={{
                                    padding: '6px 8px',
                                    borderBottom: `1px solid ${THEME.glassBorder}`,
                                    fontFamily: THEME.fontMono,
                                    maxWidth: 520,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                                title={q.statement}
                            >
                                {truncate(q.statement, 140)}
                            </td>
                            <td
                                style={{
                                    padding: '6px 8px',
                                    borderBottom: `1px solid ${THEME.glassBorder}`,
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {q.duration_ms} ms
                            </td>
                            <td
                                style={{
                                    padding: '6px 8px',
                                    borderBottom: `1px solid ${THEME.glassBorder}`,
                                    color: THEME.textMuted,
                                }}
                            >
                                {q.db || '—'}
                            </td>
                            <td
                                style={{
                                    padding: '6px 8px',
                                    borderBottom: `1px solid ${THEME.glassBorder}`,
                                    color: THEME.textMuted,
                                }}
                            >
                                {q.spanName}
                            </td>
                        </tr>
                    )),
                )}

            {/* Query-tag fallback when the trace has no OTLP spans/queries. */}
            {!hasSpans &&
                flatQueries.length === 0 &&
                fallback &&
                fallback.queries.length > 0 &&
                queryTable(
                    'Queries matched by trace id (no OTLP spans)',
                    ['Query', 'Mean exec', 'Rows', 'When'],
                    fallback.queries.map((q: any, i: number) => (
                        <tr key={i} style={{ color: THEME.textMain }}>
                            <td
                                style={{
                                    padding: '6px 8px',
                                    borderBottom: `1px solid ${THEME.glassBorder}`,
                                    fontFamily: THEME.fontMono,
                                    maxWidth: 520,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                                title={q.sqlPreview || q.statement}
                            >
                                {truncate(q.sqlPreview || q.statement, 140)}
                            </td>
                            <td
                                style={{
                                    padding: '6px 8px',
                                    borderBottom: `1px solid ${THEME.glassBorder}`,
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {q.meanExecMs ?? q.duration_ms ?? '—'} ms
                            </td>
                            <td
                                style={{
                                    padding: '6px 8px',
                                    borderBottom: `1px solid ${THEME.glassBorder}`,
                                    color: THEME.textMuted,
                                }}
                            >
                                {q.rows ?? '—'}
                            </td>
                            <td
                                style={{
                                    padding: '6px 8px',
                                    borderBottom: `1px solid ${THEME.glassBorder}`,
                                    color: THEME.textMuted,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {q.ts ? new Date(q.ts).toLocaleString() : '—'}
                            </td>
                        </tr>
                    )),
                )}

            {!hasSpans && flatQueries.length === 0 && !fallback && (
                <div style={{ padding: 16, color: THEME.textMuted, fontSize: 13 }}>
                    No spans or queries found for this trace id.
                </div>
            )}
        </>,
    );
}
