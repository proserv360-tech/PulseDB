import React, { useCallback, useEffect, useRef, useState } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { fetchDataFresh } from '../../../utils/api';
import { useConnection } from '../../../context/ConnectionContext';
import { AlertCircle, RefreshCw, Server } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────── */
/* SQL Server screens — one data hook + one layout per backend view:           */
/*   GET /api/connections/:id/sqlserver/{overview|performance|sessions|storage} */
/* ─────────────────────────────────────────────────────────────────────────── */

type Row = Record<string, any>;
type Column = { key: string; label: string; fmt?: (v: any, row: Row) => React.ReactNode; num?: boolean; code?: boolean };
type ViewResult = { view: string; data: any; errors: Record<string, string>; collectedAt: string };

const nf = new Intl.NumberFormat();
const n = (v: any) => (v === null || v === undefined || v === '' ? '—' : nf.format(Number(v)));
const fixed = (d: number) => (v: any) => (v === null || v === undefined ? '—' : Number(v).toFixed(d));
const kb = (v: any) => {
    if (v === null || v === undefined) return '—';
    const x = Number(v);
    if (x >= 1024 * 1024) return `${(x / 1024 / 1024).toFixed(1)} GB`;
    if (x >= 1024) return `${(x / 1024).toFixed(1)} MB`;
    return `${nf.format(x)} KB`;
};
const mb = (v: any) => (v === null || v === undefined ? '—' : kb(Number(v) * 1024));
const ms = (v: any) => {
    if (v === null || v === undefined) return '—';
    const x = Number(v);
    if (x >= 60_000) return `${(x / 60_000).toFixed(1)} min`;
    if (x >= 1000) return `${(x / 1000).toFixed(1)} s`;
    return `${nf.format(Math.round(x))} ms`;
};
const when = (v: any) => (v ? new Date(v).toLocaleString() : '—');
const duration = (secs: any) => {
    if (secs === null || secs === undefined) return '—';
    const s = Number(secs);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

const Styles = () => (
    <style>{`
        .mss-wrap { display:flex; flex-direction:column; gap:16px; }
        .mss-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .mss-title { font-size:18px; font-weight:700; color:${THEME.textMain}; display:flex; align-items:center; gap:8px; }
        .mss-sub { font-size:12px; color:${THEME.textMuted}; }
        .mss-btn { margin-left:auto; display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:8px;
                   border:1px solid ${THEME.grid}; background:${THEME.surface}; color:${THEME.textMain}; cursor:pointer; font-size:12px; }
        .mss-btn:disabled { opacity:.6; cursor:default; }
        .mss-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(170px, 1fr)); gap:12px; }
        .mss-metric { background:${THEME.surface}; border:1px solid ${THEME.grid}; border-radius:12px; padding:14px 16px; }
        .mss-metric-label { font-size:11px; color:${THEME.textMuted}; text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px; }
        .mss-metric-value { font-size:20px; font-weight:700; color:${THEME.textMain}; word-break:break-word; }
        .mss-metric-hint { font-size:11px; color:${THEME.textMuted}; margin-top:4px; }
        .mss-card { background:${THEME.surface}; border:1px solid ${THEME.grid}; border-radius:12px; overflow:hidden; }
        .mss-card-head { padding:12px 16px; border-bottom:1px solid ${THEME.grid}; font-weight:700; color:${THEME.textMain};
                         display:flex; align-items:center; gap:8px; font-size:14px; }
        .mss-count { font-weight:500; font-size:12px; color:${THEME.textMuted}; }
        .mss-scroll { overflow:auto; max-height:480px; }
        .mss-table { width:100%; border-collapse:collapse; font-size:12px; color:${THEME.textMain}; }
        .mss-table th { position:sticky; top:0; background:${THEME.surface}; text-align:left; font-weight:600; color:${THEME.textMuted};
                        padding:8px 12px; border-bottom:1px solid ${THEME.grid}; white-space:nowrap; }
        .mss-table td { padding:7px 12px; border-bottom:1px solid ${THEME.grid}; vertical-align:top; }
        .mss-table td.num, .mss-table th.num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
        .mss-code { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:11px; max-width:560px;
                    white-space:pre-wrap; word-break:break-word; display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden; }
        .mss-empty { padding:16px; color:${THEME.textMuted}; font-size:12px; }
        .mss-error { display:flex; gap:8px; align-items:flex-start; padding:12px 16px; border-radius:10px; font-size:12px;
                     background:${THEME.danger}14; border:1px solid ${THEME.danger}55; color:${THEME.textMain}; }
        .mss-bar { height:6px; border-radius:3px; background:${THEME.primary}; }
    `}</style>
);

/* ── data ─────────────────────────────────────────────────────────────────── */
function useSqlServerView(view: string, refreshMs: number | null) {
    const { activeConnectionId } = useConnection();
    const [result, setResult] = useState<ViewResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const seq = useRef(0);

    const load = useCallback(async () => {
        if (!activeConnectionId) return;
        const mine = ++seq.current;
        setLoading(true);
        try {
            const r = await fetchDataFresh(`/api/connections/${activeConnectionId}/sqlserver/${view}`);
            if (mine === seq.current) {
                setResult(r);
                setError(null);
            }
        } catch (e: any) {
            if (mine === seq.current) setError(e.message || 'Request failed');
        } finally {
            if (mine === seq.current) setLoading(false);
        }
    }, [activeConnectionId, view]);

    useEffect(() => {
        setResult(null);
        load();
        if (!refreshMs) return undefined;
        const t = setInterval(load, refreshMs);
        return () => clearInterval(t);
    }, [load, refreshMs]);

    return { result, error, loading, reload: load };
}

/* ── building blocks ──────────────────────────────────────────────────────── */
const Metric = ({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: string }) => (
    <div className="mss-metric">
        <div className="mss-metric-label">{label}</div>
        <div className="mss-metric-value" style={tone ? { color: tone } : undefined}>
            {value}
        </div>
        {hint && <div className="mss-metric-hint">{hint}</div>}
    </div>
);

const PanelError = ({ message }: { message?: string }) =>
    message ? (
        <div className="mss-error" style={{ margin: 12 }}>
            <AlertCircle size={14} color={THEME.danger} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{message}</span>
        </div>
    ) : null;

function Table({ title, rows, columns, error, empty }: {
    title: string; rows: Row[] | null | undefined; columns: Column[]; error?: string; empty?: string;
}) {
    return (
        <div className="mss-card">
            <div className="mss-card-head">
                {title}
                {Array.isArray(rows) && <span className="mss-count">({rows.length})</span>}
            </div>
            <PanelError message={error} />
            {!error && (!rows || rows.length === 0) ? (
                <div className="mss-empty">{empty || 'Nothing to show.'}</div>
            ) : !error ? (
                <div className="mss-scroll">
                    <table className="mss-table">
                        <thead>
                            <tr>
                                {columns.map((c) => (
                                    <th key={c.key} className={c.num ? 'num' : undefined}>{c.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows!.map((r, i) => (
                                <tr key={i}>
                                    {columns.map((c) => (
                                        <td key={c.key} className={c.num ? 'num' : undefined}>
                                            {c.code ? (
                                                <div className="mss-code" title={r[c.key] || ''}>{r[c.key] || '—'}</div>
                                            ) : c.fmt ? (
                                                c.fmt(r[c.key], r)
                                            ) : c.num ? (
                                                n(r[c.key])
                                            ) : (
                                                r[c.key] ?? '—'
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </div>
    );
}

function Shell({ title, view, refreshMs, children }: {
    title: string; view: string; refreshMs: number | null; children: (r: ViewResult) => React.ReactNode;
}) {
    useAdaptiveTheme();
    const { activeConnection } = useConnection();
    const { result, error, loading, reload } = useSqlServerView(view, refreshMs);
    const dbType = activeConnection?.dbType;
    const isMssql = dbType === 'mssql' || dbType === 'sqlserver';

    return (
        <div className="mss-wrap">
            <Styles />
            <div className="mss-head">
                <div className="mss-title">
                    <Server size={18} color={THEME.primary} /> {title}
                </div>
                <span className="mss-sub">
                    {activeConnection?.name}
                    {result?.collectedAt && ` · updated ${new Date(result.collectedAt).toLocaleTimeString()}`}
                    {refreshMs && ` · auto-refresh ${refreshMs / 1000}s`}
                </span>
                <button className="mss-btn" onClick={reload} disabled={loading || !isMssql}>
                    <RefreshCw size={13} className={loading ? 'animate-spin' : undefined} /> Refresh
                </button>
            </div>
            {!isMssql ? (
                <div className="mss-error">
                    <AlertCircle size={14} color={THEME.danger} />
                    Select a SQL Server connection to use this screen.
                </div>
            ) : error ? (
                <div className="mss-error">
                    <AlertCircle size={14} color={THEME.danger} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>Could not load data from SQL Server: {error}</span>
                </div>
            ) : !result ? (
                <div className="mss-empty">Loading…</div>
            ) : (
                children(result)
            )}
        </div>
    );
}

/* ── Overview ─────────────────────────────────────────────────────────────── */
export function SqlServerOverviewTab() {
    return (
        <Shell title="SQL Server Overview" view="overview" refreshMs={15_000}>
            {({ data, errors }) => {
                const s = data.server || {};
                const m = data.metrics || {};
                const hit = m.bufferCacheHitPct;
                const ple = m.pageLifeExpectancySec;
                return (
                    <>
                        <PanelError message={errors.server} />
                        <div className="mss-grid">
                            <Metric label="Version" value={s.product_version || '—'} hint={[s.edition, s.product_level].filter(Boolean).join(' · ')} />
                            <Metric label="Server" value={s.server_name || '—'} hint={s.start_time ? `started ${when(s.start_time)}` : undefined} />
                            <Metric label="Uptime" value={duration(s.uptime_seconds)} />
                            <Metric
                                label="SQL CPU"
                                value={data.cpu?.sql_cpu_pct !== null && data.cpu?.sql_cpu_pct !== undefined ? `${data.cpu.sql_cpu_pct}%` : '—'}
                                hint={data.cpu ? `system idle ${data.cpu.system_idle_pct}% · ${s.cpu_count ?? '?'} CPUs` : errors.cpu}
                                tone={data.cpu?.sql_cpu_pct >= 85 ? THEME.danger : data.cpu?.sql_cpu_pct >= 60 ? THEME.warning : undefined}
                            />
                            <Metric
                                label="SQL memory"
                                value={kb(m.totalServerMemoryKb ?? s.committed_kb)}
                                hint={`target ${kb(m.targetServerMemoryKb ?? s.committed_target_kb)} · host ${kb(s.physical_memory_kb)}`}
                            />
                            <Metric label="User sessions" value={n(s.user_sessions)} />
                            <Metric label="Active requests" value={n(s.active_requests)} />
                            <Metric
                                label="Blocked requests"
                                value={n(s.blocked_requests)}
                                tone={Number(s.blocked_requests) > 0 ? THEME.danger : undefined}
                            />
                            <Metric
                                label="Buffer cache hit"
                                value={hit === null || hit === undefined ? '—' : `${hit.toFixed(2)}%`}
                                tone={hit !== null && hit !== undefined && hit < 95 ? THEME.warning : undefined}
                            />
                            <Metric
                                label="Page life expectancy"
                                value={ple === null || ple === undefined ? '—' : `${n(ple)} s`}
                                tone={ple !== null && ple !== undefined && ple < 300 ? THEME.warning : undefined}
                            />
                            <Metric
                                label="Batch requests/s"
                                value={m.batchRequestsPerSec == null ? '…' : m.batchRequestsPerSec.toFixed(1)}
                                hint={m.batchRequestsPerSec == null ? 'needs a second sample' : `compilations/s ${m.compilationsPerSec?.toFixed(1)}`}
                            />
                            <Metric
                                label="Memory grants pending"
                                value={n(m.memoryGrantsPending)}
                                tone={Number(m.memoryGrantsPending) > 0 ? THEME.warning : undefined}
                            />
                        </div>
                        <Table
                            title="Databases"
                            rows={data.databases}
                            error={errors.databases}
                            columns={[
                                { key: 'name', label: 'Database' },
                                { key: 'state_desc', label: 'State', fmt: (v) => <span style={{ color: v === 'ONLINE' ? undefined : THEME.danger }}>{v}</span> },
                                { key: 'recovery_model_desc', label: 'Recovery' },
                                { key: 'compatibility_level', label: 'Compat', num: true },
                                { key: 'data_mb', label: 'Data', num: true, fmt: mb },
                                { key: 'log_mb', label: 'Log', num: true, fmt: mb },
                                { key: 'create_date', label: 'Created', fmt: when },
                            ]}
                        />
                    </>
                );
            }}
        </Shell>
    );
}

/* ── Performance ──────────────────────────────────────────────────────────── */
export function SqlServerPerformanceTab() {
    return (
        <Shell title="SQL Server Performance" view="performance" refreshMs={null}>
            {({ data, errors }) => {
                const maxPct = Math.max(1, ...(data.waits || []).map((w: Row) => Number(w.pct) || 0));
                return (
                    <>
                        <Table
                            title="Top waits since restart"
                            rows={data.waits}
                            error={errors.waits}
                            empty="No significant waits recorded."
                            columns={[
                                { key: 'wait_type', label: 'Wait type' },
                                {
                                    key: 'pct',
                                    label: 'Share',
                                    fmt: (v) => (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
                                            <div className="mss-bar" style={{ width: `${(Number(v) / maxPct) * 100}px` }} />
                                            <span>{fixed(1)(v)}%</span>
                                        </div>
                                    ),
                                },
                                { key: 'wait_time_ms', label: 'Total wait', num: true, fmt: ms },
                                { key: 'signal_wait_time_ms', label: 'Signal wait', num: true, fmt: ms },
                                { key: 'waiting_tasks_count', label: 'Waits', num: true },
                            ]}
                        />
                        <Table
                            title="Top queries by CPU (plan cache)"
                            rows={data.topQueries}
                            error={errors.topQueries}
                            empty="The plan cache is empty."
                            columns={[
                                { key: 'query_text', label: 'Statement', code: true },
                                { key: 'database_name', label: 'Database' },
                                { key: 'execution_count', label: 'Execs', num: true },
                                { key: 'total_cpu_ms', label: 'Total CPU', num: true, fmt: ms },
                                { key: 'avg_cpu_ms', label: 'Avg CPU', num: true, fmt: ms },
                                { key: 'avg_elapsed_ms', label: 'Avg duration', num: true, fmt: ms },
                                { key: 'total_logical_reads', label: 'Logical reads', num: true },
                                { key: 'last_execution_time', label: 'Last run', fmt: when },
                            ]}
                        />
                    </>
                );
            }}
        </Shell>
    );
}

/* ── Sessions & locks ─────────────────────────────────────────────────────── */
export function SqlServerSessionsTab() {
    return (
        <Shell title="Sessions & Blocking" view="sessions" refreshMs={10_000}>
            {({ data, errors }) => (
                <>
                    <Table
                        title="Blocking"
                        rows={data.blocking}
                        error={errors.blocking}
                        empty="No blocked requests right now."
                        columns={[
                            { key: 'blocked_session', label: 'Blocked', num: true },
                            { key: 'blocking_session', label: 'Blocked by', num: true },
                            { key: 'wait_type', label: 'Wait' },
                            { key: 'wait_ms', label: 'Waiting', num: true, fmt: ms },
                            { key: 'database_name', label: 'Database' },
                            { key: 'wait_resource', label: 'Resource' },
                            { key: 'blocked_statement', label: 'Blocked statement', code: true },
                            { key: 'blocking_statement', label: 'Blocker’s last statement', code: true },
                        ]}
                    />
                    <Table
                        title="User sessions"
                        rows={data.sessions}
                        error={errors.sessions}
                        empty="No other user sessions."
                        columns={[
                            { key: 'session_id', label: 'SPID', num: true },
                            { key: 'login_name', label: 'Login' },
                            { key: 'host_name', label: 'Host' },
                            { key: 'program_name', label: 'Program' },
                            { key: 'database_name', label: 'Database' },
                            {
                                key: 'request_status',
                                label: 'Status',
                                fmt: (v, r) => (
                                    <span style={{ color: r.blocking_session_id ? THEME.danger : undefined }}>
                                        {v || r.session_status}
                                        {r.blocking_session_id ? ` (blocked by ${r.blocking_session_id})` : ''}
                                    </span>
                                ),
                            },
                            { key: 'wait_type', label: 'Wait' },
                            { key: 'elapsed_ms', label: 'Elapsed', num: true, fmt: ms },
                            { key: 'cpu_ms', label: 'CPU', num: true, fmt: ms },
                            { key: 'current_statement', label: 'Current statement', code: true },
                        ]}
                    />
                </>
            )}
        </Shell>
    );
}

/* ── Tables & indexes ─────────────────────────────────────────────────────── */
export function SqlServerStorageTab() {
    return (
        <Shell title="Tables & Indexes" view="storage" refreshMs={null}>
            {({ data, errors }) => (
                <>
                    <Table
                        title="Largest tables"
                        rows={data.tables}
                        error={errors.tables}
                        empty="No user tables in this database."
                        columns={[
                            { key: 'schema_name', label: 'Schema' },
                            { key: 'table_name', label: 'Table' },
                            { key: 'row_count', label: 'Rows', num: true },
                            { key: 'reserved_kb', label: 'Reserved', num: true, fmt: kb },
                            { key: 'data_kb', label: 'Data', num: true, fmt: kb },
                            { key: 'index_kb', label: 'Indexes', num: true, fmt: kb },
                        ]}
                    />
                    <Table
                        title="Missing index suggestions"
                        rows={data.missingIndexes}
                        error={errors.missingIndexes}
                        empty="SQL Server has no missing-index suggestions for this database."
                        columns={[
                            { key: 'table_name', label: 'Table' },
                            { key: 'equality_columns', label: 'Equality' },
                            { key: 'inequality_columns', label: 'Inequality' },
                            { key: 'included_columns', label: 'Include' },
                            { key: 'user_seeks', label: 'Seeks', num: true },
                            { key: 'avg_user_impact', label: 'Impact %', num: true, fmt: fixed(1) },
                            { key: 'improvement_score', label: 'Score', num: true },
                        ]}
                    />
                    <Table
                        title="Index usage"
                        rows={data.indexUsage}
                        error={errors.indexUsage}
                        empty="No indexes on user tables."
                        columns={[
                            { key: 'table_name', label: 'Table', fmt: (v, r) => `${r.schema_name}.${v}` },
                            { key: 'index_name', label: 'Index' },
                            { key: 'type_desc', label: 'Type' },
                            { key: 'seeks', label: 'Seeks', num: true },
                            { key: 'scans', label: 'Scans', num: true },
                            { key: 'lookups', label: 'Lookups', num: true },
                            {
                                key: 'updates',
                                label: 'Writes',
                                num: true,
                                fmt: (v, r) => (
                                    <span
                                        style={{ color: Number(v) > 0 && !Number(r.seeks) && !Number(r.scans) && !Number(r.lookups) ? THEME.warning : undefined }}
                                        title={Number(v) > 0 && !Number(r.seeks) && !Number(r.scans) && !Number(r.lookups) ? 'Written but never read since restart' : undefined}
                                    >
                                        {n(v)}
                                    </span>
                                ),
                            },
                            { key: 'size_kb', label: 'Size', num: true, fmt: kb },
                        ]}
                    />
                    <Table
                        title="Fragmentation (indexes ≥ 100 pages)"
                        rows={data.fragmentation}
                        error={errors.fragmentation}
                        empty="No indexes of 100+ pages."
                        columns={[
                            { key: 'table_name', label: 'Table', fmt: (v, r) => `${r.schema_name}.${v}` },
                            { key: 'index_name', label: 'Index' },
                            { key: 'index_type_desc', label: 'Type' },
                            {
                                key: 'fragmentation_pct',
                                label: 'Fragmentation',
                                num: true,
                                fmt: (v) => (
                                    <span style={{ color: Number(v) >= 30 ? THEME.danger : Number(v) >= 10 ? THEME.warning : undefined }}>
                                        {fixed(1)(v)}%
                                    </span>
                                ),
                            },
                            { key: 'page_count', label: 'Pages', num: true },
                        ]}
                    />
                </>
            )}
        </Shell>
    );
}
