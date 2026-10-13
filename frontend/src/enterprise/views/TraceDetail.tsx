// ==========================================================================
//  FATHOM — Trace Detail View
// ==========================================================================
//  Given a W3C traceparent (or just a trace id), show all Postgres queries
//  correlated to it. Backed by services/traceContext.js →
//  getQueriesForTrace() + summariseTrace().
// ==========================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { Link as LinkIcon, ExternalLink } from 'lucide-react';
import { fetchData } from '../../utils/api';
import { THEME } from '../../utils/theme';
import {
    Page, PageHeader, Card, KVGrid, Muted, Alert, Button, Input, Table,
} from './_viewKit';

interface TraceQuery {
    traceId: string;
    spanId: string;
    queryId: string;
    sqlPreview: string;
    meanExecMs: number;
    rows: number;
    ts: string;
}

interface TraceSummary {
    traceId: string;
    queryCount: number;
    totalExecMs: number;
    slowestQueryId?: string;
    firstSeen: string;
    lastSeen: string;
}

// Accept either a raw 32-hex trace id or a full W3C traceparent
// (00-<trace>-<span>-<flags>). Returns just the trace id.
export const normaliseTraceInput = (raw: string): string => {
    const trimmed = (raw || '').trim();
    if (!trimmed) return '';
    return trimmed.includes('-') ? trimmed.split('-')[1] ?? '' : trimmed;
};

const TraceDetailInner: React.FC<{ initialTraceId?: string }> = ({ initialTraceId = '' }) => {
    const [traceInput, setTraceInput] = useState(initialTraceId);
    const [queries, setQueries] = useState<TraceQuery[]>([]);
    const [summary, setSummary] = useState<TraceSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (traceId: string) => {
        if (!traceId) return;
        setLoading(true);
        setError(null);
        try {
            const [q, s] = await Promise.all([
                fetchData(`/api/enterprise/trace/${traceId}/queries`),
                fetchData(`/api/enterprise/trace/${traceId}/summary`),
            ]);
            setQueries(q?.queries ?? []);
            setSummary(s ?? null);
        } catch (err: any) {
            setError(err?.message || 'Failed to load trace');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (initialTraceId) load(normaliseTraceInput(initialTraceId));
    }, [initialTraceId, load]);

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        load(normaliseTraceInput(traceInput));
    };

    return (
        <Page>
            <PageHeader
                icon={<LinkIcon size={18} />}
                title="Trace detail"
                subtitle="Postgres queries correlated to a W3C trace id"
                accent={THEME.secondary}
                onRefresh={
                    summary?.traceId
                        ? () => load(normaliseTraceInput(summary.traceId))
                        : undefined
                }
                refreshing={loading}
            />

            <Card>
                <form
                    onSubmit={onSubmit}
                    style={{ display: 'flex', gap: 8, alignItems: 'center' }}
                    aria-label="Load trace"
                >
                    <label htmlFor="trace-input" style={{ position: 'absolute', left: -9999 }}>
                        Traceparent or trace id
                    </label>
                    <Input
                        id="trace-input"
                        mono
                        value={traceInput}
                        onChange={(e) => setTraceInput(e.target.value)}
                        placeholder="traceparent or 32-char trace id"
                        style={{ flex: 1 }}
                    />
                    <Button type="submit" variant="primary" disabled={!traceInput.trim() || loading}>
                        Load
                    </Button>
                </form>
            </Card>

            {error && <Alert>{error}</Alert>}
            {loading && !summary && <Muted>Loading…</Muted>}

            {summary && (
                <Card title="Trace summary">
                    <KVGrid
                        columns={2}
                        items={[
                            { label: 'Trace id', value: summary.traceId, mono: true },
                            { label: 'Queries', value: summary.queryCount, mono: true },
                            { label: 'Total exec (ms)', value: summary.totalExecMs.toFixed(1), mono: true },
                            { label: 'First seen', value: summary.firstSeen },
                            { label: 'Last seen', value: summary.lastSeen },
                            ...(summary.slowestQueryId
                                ? [{ label: 'Slowest query', value: summary.slowestQueryId, mono: true }]
                                : []),
                        ]}
                    />
                </Card>
            )}

            {queries.length > 0 && (
                <Card title="Correlated queries">
                    <Table
                        columns={[
                            { key: 'ts', label: 'Time' },
                            { key: 'spanId', label: 'Span', mono: true },
                            { key: 'sqlPreview', label: 'SQL', mono: true },
                            { key: 'meanExecMs', label: 'Mean (ms)', align: 'right', mono: true },
                            { key: 'rows', label: 'Rows', align: 'right', mono: true },
                            { key: 'actions', label: '', align: 'right' },
                        ]}
                        rows={queries.map((q) => ({
                            ts: q.ts,
                            spanId: q.spanId.slice(0, 8),
                            sqlPreview: (
                                <span
                                    style={{
                                        display: 'inline-block',
                                        maxWidth: 360,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        verticalAlign: 'bottom',
                                    }}
                                    title={q.sqlPreview}
                                >
                                    {q.sqlPreview}
                                </span>
                            ),
                            meanExecMs: q.meanExecMs.toFixed(1),
                            rows: q.rows,
                            actions: (
                                <a
                                    href={`#/queries/${q.queryId}`}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        color: THEME.primary,
                                        fontSize: 12,
                                        textDecoration: 'none',
                                        fontWeight: 600,
                                    }}
                                >
                                    View <ExternalLink size={11} />
                                </a>
                            ),
                        }))}
                        rowKey={(_r: any, idx: number) =>
                            `${queries[idx]?.spanId}-${queries[idx]?.queryId}`
                        }
                    />
                </Card>
            )}

            {summary && queries.length === 0 && !loading && (
                <Muted>No correlated queries found for this trace.</Muted>
            )}
        </Page>
    );
};

const TraceDetail: React.FC<{ initialTraceId?: string }> = (props) => (
    <TraceDetailInner {...props} />
);

export default TraceDetail;
