import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { AlertCircle, AlertTriangle, ChevronDown, ChevronUp, Info, Pause, Play, RefreshCw, XCircle } from 'lucide-react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { fetchDataFresh } from '../../../utils/api';
import { useConnection } from '../../../context/ConnectionContext';

/* ─────────────────────────────────────────────────────────────────────────── */
/* Shared pieces for the SQL Server screens. Data comes from                   */
/*   GET /api/connections/:id/sqlserver/:view → { data, errors, live, history } */
/* ─────────────────────────────────────────────────────────────────────────── */

export type Row = Record<string, any>;
export type ViewResult = {
    view: string;
    data: Record<string, any>;
    errors: Record<string, string>;
    live: Row | null;
    history?: Row[];
    collectedAt: string;
};

// SQL Server brand-adjacent palette (readable on light and dark surfaces).
export const C = {
    red: '#CC2927',
    blue: '#0078D4',
    amber: '#D29200',
    green: '#107C10',
    purple: '#5C2D91',
    teal: '#008B94',
    orange: '#D83B01',
    magenta: '#B4009E',
    slate: '#64748B',
    brown: '#8D6E63',
};
export const SERIES = [C.blue, C.red, C.amber, C.green, C.purple, C.teal, C.orange, C.magenta, C.slate, C.brown];
export const WAIT_COLORS: Record<string, string> = {
    'Disk I/O': C.red,
    Lock: C.orange,
    Latch: C.amber,
    'Log write': C.purple,
    Parallelism: C.teal,
    CPU: C.blue,
    Network: C.slate,
    Memory: C.magenta,
    'Preemptive (OS)': C.brown,
    'Always On': C.green,
    Other: '#94A3B8',
};

/* ── formatting ─────────────────────────────────────────────────────────── */
const nf = new Intl.NumberFormat();
export const isNum = (v: any) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
export const n = (v: any) => (isNum(v) ? nf.format(Number(v)) : '—');
export const fixed = (d: number) => (v: any) => (isNum(v) ? Number(v).toFixed(d) : '—');
export const compact = (v: any) => {
    if (!isNum(v)) return '—';
    const x = Number(v);
    if (Math.abs(x) >= 1e9) return `${(x / 1e9).toFixed(1)}B`;
    if (Math.abs(x) >= 1e6) return `${(x / 1e6).toFixed(1)}M`;
    if (Math.abs(x) >= 1e4) return `${(x / 1e3).toFixed(1)}K`;
    return Number.isInteger(x) ? nf.format(x) : x.toFixed(x < 10 ? 2 : 1);
};
export const kb = (v: any) => {
    if (!isNum(v)) return '—';
    const x = Number(v);
    if (x >= 1024 * 1024) return `${(x / 1024 / 1024).toFixed(1)} GB`;
    if (x >= 1024) return `${(x / 1024).toFixed(1)} MB`;
    return `${nf.format(Math.round(x))} KB`;
};
export const mb = (v: any) => (isNum(v) ? kb(Number(v) * 1024) : '—');
export const ms = (v: any) => {
    if (!isNum(v)) return '—';
    const x = Number(v);
    if (x >= 3_600_000) return `${(x / 3_600_000).toFixed(1)} h`;
    if (x >= 60_000) return `${(x / 60_000).toFixed(1)} min`;
    if (x >= 1000) return `${(x / 1000).toFixed(1)} s`;
    return `${x < 10 ? x.toFixed(2) : nf.format(Math.round(x))} ms`;
};
export const secs = (v: any) => (isNum(v) ? ms(Number(v) * 1000) : '—');
export const duration = (s: any) => {
    if (!isNum(s)) return '—';
    const x = Number(s);
    const d = Math.floor(x / 86400);
    const h = Math.floor((x % 86400) / 3600);
    const m = Math.floor((x % 3600) / 60);
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};
export const when = (v: any) => (v ? new Date(v).toLocaleString() : '—');
export const ago = (v: any) => {
    if (!v) return 'never';
    const diff = (Date.now() - new Date(v).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
    return `${Math.floor(diff / 86400)} d ago`;
};
export const pct = (v: any, d = 1) => (isNum(v) ? `${Number(v).toFixed(d)}%` : '—');
const clock = (t: any) => {
    const d = new Date(t);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const clockSec = (t: any) => `${clock(t)}:${String(new Date(t).getSeconds()).padStart(2, '0')}`;

/* ── data hook ──────────────────────────────────────────────────────────── */
const lastResults = new Map<string, ViewResult>(); // `${connectionId}:${view}` — instant paint when switching tabs

export function useSqlServerView(view: string, refreshMs: number | null) {
    const { activeConnectionId } = useConnection();
    const cacheKey = `${activeConnectionId}:${view}`;
    // Results are stored per connection+view so switching tabs or connections
    // paints the last known data immediately instead of an empty screen.
    const [stored, setStored] = useState<{ key: string; value: ViewResult } | null>(null);
    const result = stored?.key === cacheKey ? stored.value : lastResults.get(cacheKey) || null;
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [paused, setPaused] = useState(false);
    const seq = useRef(0);

    const load = useCallback(async () => {
        if (!activeConnectionId) return;
        const mine = ++seq.current;
        setLoading(true);
        try {
            const r = await fetchDataFresh(`/api/connections/${activeConnectionId}/sqlserver/${view}`);
            if (mine === seq.current) {
                lastResults.set(cacheKey, r);
                setStored({ key: cacheKey, value: r });
                setError(null);
            }
        } catch (e: any) {
            if (mine === seq.current) setError(e.message || 'Request failed');
        } finally {
            if (mine === seq.current) setLoading(false);
        }
    }, [activeConnectionId, view, cacheKey]);

    useEffect(() => {
        const t = setTimeout(load, 0); // first fetch for this connection+view
        return () => clearTimeout(t);
    }, [load]);

    useEffect(() => {
        if (!refreshMs || paused) return undefined;
        const t = setInterval(load, refreshMs);
        return () => clearInterval(t);
    }, [load, refreshMs, paused]);

    return { result, error, loading, reload: load, paused, setPaused };
}

/* ── styles ─────────────────────────────────────────────────────────────── */
const Styles = () => (
    <style>{`
        @keyframes mss-spin { to { transform: rotate(360deg) } }
        @keyframes mss-fade { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }
        .mss-wrap { display:flex; flex-direction:column; gap:16px; animation: mss-fade .25s ease; }
        .mss-head { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
        .mss-title { font-size:20px; font-weight:700; color:${THEME.textMain}; display:flex; align-items:center; gap:10px; }
        .mss-title-icon { width:34px; height:34px; border-radius:10px; display:flex; align-items:center; justify-content:center;
                          background:${C.red}18; color:${C.red}; }
        .mss-sub { font-size:12px; color:${THEME.textMuted}; }
        .mss-actions { margin-left:auto; display:flex; gap:8px; }
        .mss-btn { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:8px; font-size:12px;
                   border:1px solid ${THEME.glassBorder}; background:${THEME.surface}; color:${THEME.textMain}; cursor:pointer; }
        .mss-btn:hover { background:${THEME.surfaceHover}; }
        .mss-btn:disabled { opacity:.6; cursor:default; }
        .mss-spin { animation: mss-spin 1s linear infinite; }
        .mss-kpis { display:grid; grid-template-columns:repeat(auto-fill, minmax(190px, 1fr)); gap:12px; }
        .mss-kpi { position:relative; overflow:hidden; background:${THEME.surface}; border:1px solid ${THEME.glassBorder};
                   border-radius:12px; padding:14px 16px 12px; box-shadow:0 1px 3px rgba(0,0,0,.05); }
        .mss-kpi-label { display:flex; align-items:center; gap:7px; font-size:12px; color:${THEME.textMuted}; }
        .mss-kpi-value { font-size:24px; font-weight:700; color:${THEME.textMain}; margin-top:4px; line-height:1.2; word-break:break-word; }
        .mss-kpi-unit { font-size:12px; font-weight:500; color:${THEME.textDim}; margin-left:4px; }
        .mss-kpi-hint { font-size:11px; color:${THEME.textMuted}; margin-top:3px; min-height:14px; }
        .mss-kpi-spark { height:30px; margin:6px -4px -4px; }
        .mss-row { display:grid; gap:16px; grid-template-columns:repeat(auto-fit, minmax(360px, 1fr)); }
        .mss-panel { background:${THEME.surface}; border:1px solid ${THEME.glassBorder}; border-radius:12px; overflow:hidden;
                     box-shadow:0 1px 3px rgba(0,0,0,.05); min-width:0; }
        .mss-panel-head { padding:11px 16px; border-bottom:1px solid ${THEME.glassBorder}; font-weight:700; font-size:14px;
                          color:${THEME.textMain}; display:flex; align-items:center; gap:8px; }
        .mss-panel-right { margin-left:auto; font-weight:500; font-size:12px; color:${THEME.textMuted}; display:flex; gap:8px; align-items:center; }
        .mss-panel-body { padding:14px 16px; }
        .mss-count { font-weight:500; font-size:12px; color:${THEME.textMuted}; }
        .mss-scroll { overflow:auto; }
        .mss-table { width:100%; border-collapse:collapse; font-size:12px; color:${THEME.textMain}; }
        .mss-table th { position:sticky; top:0; z-index:1; background:${THEME.surfaceHover}; text-align:left; font-weight:600;
                        color:${THEME.textMuted}; padding:8px 12px; border-bottom:1px solid ${THEME.glassBorder}; white-space:nowrap;
                        cursor:pointer; user-select:none; }
        .mss-table td { padding:7px 12px; border-bottom:1px solid ${THEME.glassBorder}; vertical-align:top; }
        .mss-table tr:hover td { background:${THEME.surfaceHover}; }
        .mss-table .num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
        .mss-code { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:11px; max-width:620px; min-width:260px;
                    white-space:pre-wrap; word-break:break-word; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;
                    overflow:hidden; cursor:pointer; }
        .mss-code.open { -webkit-line-clamp:unset; display:block; }
        .mss-empty { padding:18px 16px; color:${THEME.textMuted}; font-size:12px; }
        .mss-error { display:flex; gap:8px; align-items:flex-start; padding:10px 14px; border-radius:10px; font-size:12px;
                     background:${THEME.danger}12; border:1px solid ${THEME.danger}44; color:${THEME.textMain}; }
        .mss-badge { display:inline-block; padding:1px 8px; border-radius:999px; font-size:11px; font-weight:600; white-space:nowrap; }
        .mss-prog { height:6px; border-radius:3px; background:${THEME.glassBorder}; overflow:hidden; min-width:60px; }
        .mss-prog > div { height:100%; border-radius:3px; }
        .mss-facts { display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:10px; }
        .mss-fact { padding:10px 12px; border-radius:8px; background:${THEME.surfaceHover}; border-left:3px solid ${C.red}; }
        .mss-fact-k { font-size:10px; text-transform:uppercase; letter-spacing:.5px; color:${THEME.textDim}; }
        .mss-fact-v { font-size:13px; font-weight:600; color:${THEME.textMain}; margin-top:3px; word-break:break-word; }
        .mss-alert { display:flex; gap:10px; padding:10px 16px; border-bottom:1px solid ${THEME.glassBorder}; font-size:13px; color:${THEME.textMain}; }
        .mss-alert:last-child { border-bottom:none; }
        .mss-alert-detail { font-size:12px; color:${THEME.textMuted}; margin-top:2px; }
        .mss-note { font-size:11px; color:${THEME.textDim}; padding:0 16px 12px; }
    `}</style>
);

/* ── shell ──────────────────────────────────────────────────────────────── */
export function Shell({
    title,
    icon: Icon,
    view,
    refreshMs,
    children,
}: {
    title: string;
    icon: any;
    view: string;
    refreshMs: number | null;
    children: (r: ViewResult) => React.ReactNode;
}) {
    useAdaptiveTheme();
    const { activeConnection } = useConnection();
    const { result, error, loading, reload, paused, setPaused } = useSqlServerView(view, refreshMs);
    const dbType = activeConnection?.dbType;
    const isMssql = dbType === 'mssql' || dbType === 'sqlserver';

    return (
        <div className="mss-wrap">
            <Styles />
            <div className="mss-head">
                <div className="mss-title">
                    <span className="mss-title-icon">
                        <Icon size={18} />
                    </span>
                    <div>
                        <div>{title}</div>
                        <div className="mss-sub" style={{ fontWeight: 400 }}>
                            {activeConnection?.name}
                            {activeConnection?.host ? ` · ${activeConnection.host}` : ''}
                            {activeConnection?.database ? ` · ${activeConnection.database}` : ''}
                            {result?.collectedAt && ` · updated ${new Date(result.collectedAt).toLocaleTimeString()}`}
                        </div>
                    </div>
                </div>
                <div className="mss-actions">
                    {refreshMs && (
                        <button className="mss-btn" onClick={() => setPaused(!paused)} disabled={!isMssql} title="Auto-refresh">
                            {paused ? <Play size={13} /> : <Pause size={13} />}
                            {paused ? 'Resume' : `Live · ${refreshMs / 1000}s`}
                        </button>
                    )}
                    <button className="mss-btn" onClick={reload} disabled={loading || !isMssql}>
                        <RefreshCw size={13} className={loading ? 'mss-spin' : undefined} /> Refresh
                    </button>
                </div>
            </div>
            {!isMssql ? (
                <div className="mss-error">
                    <AlertCircle size={14} color={THEME.danger} />
                    Select a SQL Server connection to use this screen.
                </div>
            ) : error && !result ? (
                <div className="mss-error">
                    <AlertCircle size={14} color={THEME.danger} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>Could not load data from SQL Server: {error}</span>
                </div>
            ) : !result ? (
                <div className="mss-empty">Loading…</div>
            ) : (
                <>
                    {error && (
                        <div className="mss-error">
                            <AlertCircle size={14} color={THEME.danger} style={{ flexShrink: 0, marginTop: 1 }} />
                            <span>Last refresh failed ({error}) — showing the previous data.</span>
                        </div>
                    )}
                    {children(result)}
                </>
            )}
        </div>
    );
}

/* ── building blocks ────────────────────────────────────────────────────── */
export const PanelError = ({ message }: { message?: string }) =>
    message ? (
        <div className="mss-error" style={{ margin: 12 }}>
            <AlertCircle size={14} color={THEME.danger} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{message}</span>
        </div>
    ) : null;

export function Panel({
    title,
    icon: Icon,
    color = C.red,
    right,
    error,
    children,
    pad = true,
    style,
}: {
    title: React.ReactNode;
    icon?: any;
    color?: string;
    right?: React.ReactNode;
    error?: string;
    children?: React.ReactNode;
    pad?: boolean;
    style?: React.CSSProperties;
}) {
    return (
        <div className="mss-panel" style={{ borderTop: `3px solid ${color}`, ...style }}>
            <div className="mss-panel-head">
                {Icon && <Icon size={15} color={color} />}
                {title}
                {right && <span className="mss-panel-right">{right}</span>}
            </div>
            {error ? <PanelError message={error} /> : pad ? <div className="mss-panel-body">{children}</div> : children}
        </div>
    );
}

export function Kpi({
    label,
    value,
    unit,
    hint,
    icon: Icon,
    color = C.blue,
    tone,
    spark,
}: {
    label: string;
    value: React.ReactNode;
    unit?: string;
    hint?: React.ReactNode;
    icon?: any;
    color?: string;
    tone?: 'danger' | 'warning' | 'success' | null;
    spark?: (number | null)[];
}) {
    const toneColor = tone === 'danger' ? THEME.danger : tone === 'warning' ? THEME.warning : tone === 'success' ? THEME.success : null;
    const sparkData = useMemo(() => (spark || []).map((v, i) => ({ i, v })), [spark]);
    const hasSpark = sparkData.filter((p) => p.v !== null && p.v !== undefined).length > 1;
    return (
        <div className="mss-kpi" style={{ borderTop: `3px solid ${toneColor || color}` }}>
            <div className="mss-kpi-label">
                {Icon && <Icon size={14} color={toneColor || color} />}
                <span>{label}</span>
            </div>
            <div className="mss-kpi-value" style={toneColor ? { color: toneColor } : undefined}>
                {value}
                {unit && <span className="mss-kpi-unit">{unit}</span>}
            </div>
            <div className="mss-kpi-hint">{hint}</div>
            {spark && (
                <div className="mss-kpi-spark">
                    {hasSpark && (
                        <ResponsiveContainer>
                            <AreaChart data={sparkData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                                <defs>
                                    <linearGradient id={`spark-${label.replace(/\W/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={toneColor || color} stopOpacity={0.35} />
                                        <stop offset="100%" stopColor={toneColor || color} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area
                                    type="monotone"
                                    dataKey="v"
                                    stroke={toneColor || color}
                                    strokeWidth={1.5}
                                    fill={`url(#spark-${label.replace(/\W/g, '')})`}
                                    isAnimationActive={false}
                                    connectNulls
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            )}
        </div>
    );
}

export const Badge = ({ color, children }: { color: string; children: React.ReactNode }) => (
    <span className="mss-badge" style={{ background: `${color}1c`, color }}>
        {children}
    </span>
);

export const stateColor = (s: any) => {
    const v = String(s || '').toUpperCase();
    if (['ONLINE', 'HEALTHY', 'SYNCHRONIZED', 'RUNNING', 'SUCCEEDED', 'CONNECTED', 'ENCRYPTED', 'PRIMARY', 'STARTED'].includes(v)) return C.green;
    if (['SYNCHRONIZING', 'PARTIALLY_HEALTHY', 'RESTORING', 'RECOVERING', 'IN PROGRESS', 'RETRY', 'SECONDARY', 'PAUSED', 'START PENDING'].includes(v)) return C.amber;
    if (!v) return C.slate;
    if (['STOPPED', 'FAILED', 'NOT_HEALTHY', 'SUSPECT', 'OFFLINE', 'EMERGENCY', 'DISCONNECTED', 'NOT SYNCHRONIZING', 'CANCELED'].includes(v)) return C.red;
    return C.slate;
};

export const Progress = ({ value, max = 100, color }: { value: number; max?: number; color?: string }) => {
    const p = Math.max(0, Math.min(100, (Number(value) / (max || 1)) * 100));
    const c = color || (p >= 90 ? THEME.danger : p >= 75 ? THEME.warning : C.blue);
    return (
        <div className="mss-prog">
            <div style={{ width: `${p}%`, background: c }} />
        </div>
    );
};

export function Code({ text }: { text?: string | null }) {
    const [open, setOpen] = useState(false);
    if (!text) return <span style={{ color: THEME.textDim }}>—</span>;
    return (
        <div className={`mss-code${open ? ' open' : ''}`} onClick={() => setOpen(!open)} title={open ? 'Click to collapse' : 'Click to expand'}>
            {text}
        </div>
    );
}

export function Facts({ items }: { items: [string, React.ReactNode][] }) {
    return (
        <div className="mss-facts">
            {items.map(([k, v]) => (
                <div key={k} className="mss-fact">
                    <div className="mss-fact-k">{k}</div>
                    <div className="mss-fact-v">{v ?? '—'}</div>
                </div>
            ))}
        </div>
    );
}

export function AlertList({ alerts }: { alerts: { severity: string; title: string; detail?: string | null }[] }) {
    if (!alerts?.length) {
        return <div className="mss-empty">No health issues detected.</div>;
    }
    return (
        <div>
            {alerts.map((a, i) => {
                const [Icon, color] =
                    a.severity === 'critical'
                        ? [XCircle, THEME.danger]
                        : a.severity === 'warning'
                          ? [AlertTriangle, THEME.warning]
                          : [Info, C.blue];
                return (
                    <div key={i} className="mss-alert">
                        <Icon size={16} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
                        <div>
                            <div style={{ fontWeight: 600 }}>{a.title}</div>
                            {a.detail && <div className="mss-alert-detail">{a.detail}</div>}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/* ── table ──────────────────────────────────────────────────────────────── */
export type Column = {
    key: string;
    label: string;
    num?: boolean;
    code?: boolean;
    fmt?: (v: any, row: Row) => React.ReactNode;
    sortValue?: (row: Row) => any;
};

export function DataTable({
    rows,
    columns,
    empty = 'Nothing to show.',
    maxHeight = 460,
    initialSort,
}: {
    rows: Row[] | null | undefined;
    columns: Column[];
    empty?: string;
    maxHeight?: number;
    initialSort?: { key: string; dir: 'asc' | 'desc' };
}) {
    const [sort, setSort] = useState(initialSort || null);
    const sorted = useMemo(() => {
        if (!rows || !sort) return rows || [];
        const col = columns.find((c) => c.key === sort.key);
        const val = (r: Row) => (col?.sortValue ? col.sortValue(r) : r[sort.key]);
        return [...rows].sort((a, b) => {
            const x = val(a);
            const y = val(b);
            if (x === y) return 0;
            if (x === null || x === undefined) return 1;
            if (y === null || y === undefined) return -1;
            const cmp = isNum(x) && isNum(y) ? Number(x) - Number(y) : String(x).localeCompare(String(y));
            return sort.dir === 'asc' ? cmp : -cmp;
        });
    }, [rows, sort, columns]);

    if (!rows || rows.length === 0) return <div className="mss-empty">{empty}</div>;
    const toggle = (key: string) =>
        setSort((s) => (s?.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }));

    return (
        <div className="mss-scroll" style={{ maxHeight }}>
            <table className="mss-table">
                <thead>
                    <tr>
                        {columns.map((c) => (
                            <th key={c.key} className={c.num ? 'num' : undefined} onClick={() => toggle(c.key)}>
                                {c.label}
                                {sort?.key === c.key &&
                                    (sort.dir === 'desc' ? (
                                        <ChevronDown size={11} style={{ verticalAlign: 'middle' }} />
                                    ) : (
                                        <ChevronUp size={11} style={{ verticalAlign: 'middle' }} />
                                    ))}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((r, i) => (
                        <tr key={i}>
                            {columns.map((c) => (
                                <td key={c.key} className={c.num ? 'num' : undefined}>
                                    {c.code ? <Code text={r[c.key]} /> : c.fmt ? c.fmt(r[c.key], r) : c.num ? n(r[c.key]) : (r[c.key] ?? '—')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/* ── charts ─────────────────────────────────────────────────────────────── */
const axisStyle = () => ({ fontSize: 11, fill: THEME.textMuted });
const tooltipStyle = () => ({
    contentStyle: {
        background: THEME.surface,
        border: `1px solid ${THEME.glassBorder}`,
        borderRadius: 8,
        fontSize: 12,
        color: THEME.textMain,
    },
    labelStyle: { color: THEME.textMuted },
});

export type Series = { key: string; label: string; color: string; type?: 'area' | 'line'; axis?: 'left' | 'right'; stack?: boolean };

export function TrendChart({
    data,
    series,
    height = 240,
    yFmt = compact,
    xKey = 't',
    seconds = true,
    empty = 'Collecting samples — the trend fills in as this screen refreshes.',
    yDomain,
}: {
    data: Row[];
    series: Series[];
    height?: number;
    yFmt?: (v: any) => string;
    xKey?: string;
    seconds?: boolean;
    empty?: string;
    yDomain?: [any, any];
}) {
    if (!data || data.length < 2) return <div className="mss-empty" style={{ height: height - 20 }}>{empty}</div>;
    const hasRight = series.some((s) => s.axis === 'right');
    const stacked = series.some((s) => s.stack);
    const Chart: any = series.every((s) => s.type === 'line') ? LineChart : AreaChart;
    return (
        <div style={{ height }}>
            <ResponsiveContainer>
                <Chart data={data} margin={{ top: 8, right: hasRight ? 0 : 12, bottom: 0, left: 0 }}>
                    <defs>
                        {series.map((s) => (
                            <linearGradient key={s.key} id={`g-${s.key.replace(/\W/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={s.color} stopOpacity={stacked ? 0.7 : 0.3} />
                                <stop offset="100%" stopColor={s.color} stopOpacity={stacked ? 0.35 : 0.02} />
                            </linearGradient>
                        ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={THEME.glassBorder} vertical={false} />
                    <XAxis dataKey={xKey} tickFormatter={seconds ? clockSec : clock} tick={axisStyle()} minTickGap={40} stroke={THEME.glassBorder} />
                    <YAxis yAxisId="left" tickFormatter={yFmt} tick={axisStyle()} width={52} stroke={THEME.glassBorder} domain={yDomain} />
                    {hasRight && <YAxis yAxisId="right" orientation="right" tickFormatter={compact} tick={axisStyle()} width={44} stroke={THEME.glassBorder} />}
                    <Tooltip
                        {...tooltipStyle()}
                        labelFormatter={(t: any) => new Date(t).toLocaleTimeString()}
                        formatter={(v: any, name: any) => [isNum(v) ? compact(v) : '—', name]}
                    />
                    {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />}
                    {series.map((s) =>
                        s.type === 'line' ? (
                            <Line
                                key={s.key}
                                yAxisId={s.axis || 'left'}
                                type="monotone"
                                dataKey={s.key}
                                name={s.label}
                                stroke={s.color}
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                                connectNulls
                            />
                        ) : (
                            <Area
                                key={s.key}
                                yAxisId={s.axis || 'left'}
                                type="monotone"
                                dataKey={s.key}
                                name={s.label}
                                stroke={s.color}
                                strokeWidth={2}
                                fill={`url(#g-${s.key.replace(/\W/g, '')})`}
                                stackId={s.stack ? 'stack' : undefined}
                                isAnimationActive={false}
                                connectNulls
                            />
                        ),
                    )}
                </Chart>
            </ResponsiveContainer>
        </div>
    );
}

export function Donut({
    data,
    height = 260,
    fmt = compact,
    center,
}: {
    data: { name: string; value: number; color: string }[];
    height?: number;
    fmt?: (v: any) => string;
    center?: { value: string; label: string };
}) {
    const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);
    if (!data.length || !total) return <div className="mss-empty">No data yet.</div>;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ height, flex: '1 1 220px', minWidth: 200, position: 'relative' }}>
                <ResponsiveContainer>
                    <PieChart>
                        <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="88%" paddingAngle={1.5} isAnimationActive={false}>
                            {data.map((d) => (
                                <Cell key={d.name} fill={d.color} stroke={THEME.surface} />
                            ))}
                        </Pie>
                        <Tooltip {...tooltipStyle()} formatter={(v: any, name: any) => [`${fmt(v)} (${((100 * v) / total).toFixed(1)}%)`, name]} />
                    </PieChart>
                </ResponsiveContainer>
                {center && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain }}>{center.value}</div>
                        <div style={{ fontSize: 11, color: THEME.textMuted }}>{center.label}</div>
                    </div>
                )}
            </div>
            <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.map((d) => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: THEME.textMain }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.name}>
                            {d.name}
                        </span>
                        <span style={{ color: THEME.textMuted, fontVariantNumeric: 'tabular-nums' }}>{((100 * d.value) / total).toFixed(1)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function HBars({
    data,
    labelKey,
    bars,
    height,
    fmt = compact,
}: {
    data: Row[];
    labelKey: string;
    bars: { key: string; label: string; color: string; stack?: boolean }[];
    height?: number;
    fmt?: (v: any) => string;
}) {
    if (!data?.length) return <div className="mss-empty">No data.</div>;
    const h = height || Math.max(140, data.length * 30 + 40);
    return (
        <div style={{ height: h }}>
            <ResponsiveContainer>
                <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={THEME.glassBorder} horizontal={false} />
                    <XAxis type="number" tickFormatter={fmt} tick={axisStyle()} stroke={THEME.glassBorder} />
                    <YAxis type="category" dataKey={labelKey} width={170} tick={<BarLabel />} stroke={THEME.glassBorder} interval={0} />
                    <Tooltip {...tooltipStyle()} formatter={(v: any, name: any) => [fmt(v), name]} cursor={{ fill: THEME.surfaceHover }} />
                    {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />}
                    {bars.map((b) => (
                        <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color} stackId={b.stack ? 's' : undefined} radius={b.stack ? 0 : [0, 4, 4, 0]} isAnimationActive={false} />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// Single-line, truncated category label (recharts' default tick wraps long text).
function BarLabel({ x, y, payload }: any) {
    const v = String(payload?.value ?? '');
    return (
        <text x={x - 6} y={y} dy={4} textAnchor="end" fontSize={11} fill={THEME.textMuted}>
            <title>{v}</title>
            {v.length > 26 ? `${v.slice(0, 25)}…` : v}
        </text>
    );
}

/** Pull one numeric series out of the pulse history for a KPI sparkline. */
export const sparkOf = (history: Row[] | undefined, key: string) => (history || []).slice(-40).map((p) => (isNum(p[key]) ? Number(p[key]) : null));
