import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import VacuumForecastPanel from './VacuumForecastPanel';
import StorageAdvisorPanel from './StorageAdvisorPanel';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { fetchData } from '../../../utils/api';
import {
    Layers,
    RefreshCw,
    AlertTriangle,
    Database,
    Activity,
    Search,
    TrendingUp,
    Zap,
    Clock,
    HardDrive,
    BarChart2,
    ChevronUp,
    ChevronDown,
    AlertCircle,
    Filter,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────
const fmtBytes = (b: any) => {
    const n = Number(b) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
    return `${(n / 1073741824).toFixed(2)} GB`;
};
const fmt = (n: any) => (n == null ? '—' : Number(n).toLocaleString());
const deadCol = (p: any) => {
    const v = Number(p) || 0;
    if (v > 20) return THEME.danger;
    if (v > 10) return THEME.warning;
    return THEME.success;
};
const healthScore = (avgDead: number, critCount: number, totalTables: number) => {
    if (!totalTables) return 100;
    return Math.max(0, Math.round(100 - avgDead * 1.5 - (critCount / totalTables) * 100 * 2));
};
const normaliseTable = (row: any) => ({
    ...row,
    tablename: row.tablename ?? row.relname ?? '',
    schemaname: row.schemaname ?? row.nspname ?? '',
});
const normaliseIndex = (row: any) => ({
    ...row,
    indexname: row.indexname ?? row.indexrelname ?? '',
    tablename: row.tablename ?? row.relname ?? '',
    schemaname: row.schemaname ?? row.nspname ?? '',
});

// ─── Styles ────────────────────────────────────────────────────────────────
const STYLE_ID = 'ba-v3-styles';
function ensureStyles() {
    if (typeof document === 'undefined') return;
    let el = document.getElementById(STYLE_ID);
    if (!el) {
        el = document.createElement('style');
        el.id = STYLE_ID;
        document.head.appendChild(el);
    }
    el.textContent = `
@keyframes baSpin   { to { transform: rotate(360deg) } }
@keyframes baFadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
@keyframes baPulse  { 0%,100%{opacity:1} 50%{opacity:.35} }
@keyframes baSlide  { from { width:0 } }

.ba3-wrap { font-family:${THEME.fontBody}; animation:baFadeUp .3s ease both; }

.ba3-card {
  background:${THEME.surface};
  border:1px solid ${THEME.glassBorder};
  border-radius:16px;
  overflow:hidden;
  transition:box-shadow .2s;
}
.ba3-card:hover { box-shadow:0 4px 20px rgba(0,0,0,.07); }

.ba3-kpi {
  background:${THEME.surface};
  border:1px solid ${THEME.glassBorder};
  border-radius:14px;
  padding:14px;
  display:flex; flex-direction:column; gap:8px;
  transition:box-shadow .18s, transform .18s;
}
.ba3-kpi:hover { box-shadow:0 4px 16px rgba(0,0,0,.07); transform:translateY(-2px); }

.ba3-row {
  padding:10px 16px;
  border-bottom:1px solid ${THEME.glassBorder}20;
  transition:background .12s;
  cursor:pointer;
}
.ba3-row:last-child { border-bottom:none; }
.ba3-row:hover { background:${THEME.primary}06 !important; }

.ba3-head {
  padding:8px 16px;
  font-size:10px; font-weight:700;
  text-transform:uppercase; letter-spacing:.06em;
  color:${THEME.textDim};
  border-bottom:1px solid ${THEME.glassBorder};
  background:${THEME.surfaceHover || THEME.surface};
}

.ba3-tab {
  padding:5px 14px; border-radius:20px;
  border:1px solid ${THEME.glassBorder};
  background:transparent; color:${THEME.textMuted};
  cursor:pointer; font-size:12px; font-weight:600;
  font-family:inherit; transition:all .16s;
  display:inline-flex; align-items:center; gap:5px;
}
.ba3-tab.active {
  background:${THEME.primary}18;
  border-color:${THEME.primary}50;
  color:${THEME.primary};
}
.ba3-tab:hover:not(.active) { color:${THEME.textMain}; border-color:${THEME.glassBorder}; }

.ba3-badge {
  display:inline-flex; align-items:center; gap:3px;
  font-size:10px; font-weight:700;
  padding:3px 9px; border-radius:20px; white-space:nowrap;
}

.ba3-bar-track { border-radius:3px; background:${THEME.grid}40; overflow:hidden; }
.ba3-bar-fill  { height:100%; border-radius:3px; animation:baSlide .5s ease both; }

.sev3-dot { width:7px; height:7px; border-radius:50%; display:inline-block; flex-shrink:0; }
.sev3-dot.crit { background:${THEME.danger}; animation:baPulse 1.4s infinite; }
.sev3-dot.high { background:${THEME.warning}; }
.sev3-dot.ok   { background:${THEME.success}; }

.ba3-input {
  background:${THEME.surfaceHover || THEME.surface};
  border:1px solid ${THEME.glassBorder};
  color:${THEME.textMain};
  border-radius:20px; padding:6px 14px 6px 32px;
  font-size:12px; outline:none;
  font-family:inherit; transition:border-color .2s;
  width:180px;
}
.ba3-input:focus { border-color:${THEME.primary}60; }
.ba3-input::placeholder { color:${THEME.textDim}; }

.ba3-vac {
  font-size:11px; padding:3px 10px; border-radius:12px;
  display:inline-flex; align-items:center; gap:3px;
  background:${THEME.warning}18; color:${THEME.warning};
  border:1px solid ${THEME.warning}40;
  cursor:pointer; font-family:inherit; font-weight:700;
  transition:all .16s; white-space:nowrap;
}
.ba3-vac:hover { background:${THEME.warning}30; }

.ba3-sort {
  background:none; border:none; cursor:pointer;
  color:${THEME.textDim}; padding:0;
  display:inline-flex; align-items:center; gap:2px;
  font-size:10px; font-weight:700; font-family:inherit;
  letter-spacing:.05em; text-transform:uppercase;
  transition:color .14s;
}
.ba3-sort.active, .ba3-sort:hover { color:${THEME.primary}; }

::-webkit-scrollbar { width:4px; height:4px; }
::-webkit-scrollbar-thumb { background:${THEME.glassBorder}; border-radius:2px; }
`;
}

const Styles = () => {
    useAdaptiveTheme();
    ensureStyles();
    return null;
};

// ─── Sub-components ────────────────────────────────────────────────────────
const HBar = ({ pct, color, height = 5 }: { pct: number; color: string; height?: number }) => (
    <div className="ba3-bar-track" style={{ height }}>
        <div className="ba3-bar-fill" style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color }} />
    </div>
);

const HealthRing = ({ score }: { score: number }) => {
    const r = 26;
    const circ = 2 * Math.PI * r;
    const dash = (score / 100) * circ;
    const color = score >= 80 ? THEME.success : score >= 60 ? THEME.warning : THEME.danger;
    const label = score >= 80 ? 'HEALTHY' : score >= 60 ? 'WARNING' : 'CRITICAL';
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <svg width="64" height="64" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r={r} fill="none" stroke={`${THEME.glassBorder}`} strokeWidth="5" />
                <circle
                    cx="32"
                    cy="32"
                    r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth="5"
                    strokeDasharray={`${dash} ${circ - dash}`}
                    strokeDashoffset={circ * 0.25}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray .6s ease' }}
                />
                <text x="32" y="28" textAnchor="middle" fontSize="14" fontWeight="700" fill={THEME.textMain}>
                    {score}
                </text>
                <text x="32" y="40" textAnchor="middle" fontSize="8" fontWeight="700" fill={color}>
                    {label}
                </text>
            </svg>
        </div>
    );
};

const SortBtn = ({ col, label, sortCol, sortDir, onSort }: any) => (
    <button className={`ba3-sort ${sortCol === col ? 'active' : ''}`} onClick={() => onSort(col)}>
        {label}
        {sortCol === col ? sortDir === 'asc' ? <ChevronUp size={9} /> : <ChevronDown size={9} /> : null}
    </button>
);

const COLS_TABLE = '2fr 0.7fr 0.7fr 0.7fr 1.4fr 1.5fr';
const COLS_INDEX = '2.4fr 1fr 0.9fr 1fr 1.3fr';

// ─── Main component ────────────────────────────────────────────────────────
export default function BloatAnalysisTab() {
    useAdaptiveTheme();
    const [tables, setTables] = useState<any[]>([]);
    const [indexes, setIndexes] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastAt, setLastAt] = useState<number | null>(null);
    const [autoRfsh, setAutoRfsh] = useState(60);
    const [activeTab, setActiveTab] = useState('tables');
    const [search, setSearch] = useState('');
    const [sortCol, setSortCol] = useState('dead_pct');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [filterHigh, setFilterHigh] = useState(false);
    const intervalRef = useRef<any>(null);

    const load = useCallback(async (initial = false) => {
        if (!initial) setRefreshing(true);
        try {
            const [tRes, iRes, sRes] = await Promise.allSettled([
                fetchData('/api/bloat/tables'),
                fetchData('/api/bloat/indexes'),
                fetchData('/api/bloat/summary'),
            ]);
            const val = (r: any) => (r.status === 'fulfilled' ? r.value : null);
            setTables((val(tRes) || []).map(normaliseTable));
            setIndexes((val(iRes) || []).map(normaliseIndex));
            setSummary(val(sRes) || {});
            const allFailed = !val(tRes) && !val(iRes) && !val(sRes);
            const rej = [tRes, iRes, sRes].find((r: any) => r.status === 'rejected') as any;
            setError(allFailed ? rej?.reason?.message || 'Failed to load bloat data' : null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLastAt(Date.now());
            setRefreshing(false);
            if (initial) setLoading(false);
        }
    }, []);

    useEffect(() => {
        load(true);
    }, [load]);
    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (autoRfsh > 0) intervalRef.current = setInterval(() => load(false), autoRfsh * 1000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [autoRfsh, load]);

    const fmtRel = (d: number | null) => {
        if (!d) return '';
        const s = Math.floor((Date.now() - d) / 1000);
        if (s < 60) return `${s}s ago`;
        if (s < 3600) return `${Math.floor(s / 60)}m ago`;
        return `${Math.floor(s / 3600)}h ago`;
    };

    const handleSort = (col: string) => {
        if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else {
            setSortCol(col);
            setSortDir('desc');
        }
    };

    const filteredTables = useMemo(
        () =>
            tables
                .filter((t) => {
                    const matchSearch =
                        !search || `${t.schemaname}.${t.tablename}`.toLowerCase().includes(search.toLowerCase());
                    const matchHigh = !filterHigh || Number(t.dead_pct) > 10;
                    return matchSearch && matchHigh;
                })
                .sort((a, b) => {
                    let va = 0,
                        vb = 0;
                    if (sortCol === 'dead_pct') {
                        va = Number(a.dead_pct);
                        vb = Number(b.dead_pct);
                    } else if (sortCol === 'total_bytes') {
                        va = Number(a.total_bytes);
                        vb = Number(b.total_bytes);
                    } else if (sortCol === 'n_dead_tup') {
                        va = Number(a.n_dead_tup);
                        vb = Number(b.n_dead_tup);
                    }
                    return sortDir === 'asc' ? va - vb : vb - va;
                }),
        [tables, search, filterHigh, sortCol, sortDir],
    );

    const filteredIndexes = useMemo(
        () =>
            indexes
                .filter((i) => !search || `${i.schemaname}.${i.indexname}`.toLowerCase().includes(search.toLowerCase()))
                .sort((a, b) => Number(b.index_bytes) - Number(a.index_bytes)),
        [indexes, search],
    );

    const chartDeadData = useMemo(
        () =>
            [...tables]
                .sort((a, b) => Number(b.dead_pct) - Number(a.dead_pct))
                .slice(0, 10)
                .map((t) => ({ name: t.tablename, dead: Math.round(Number(t.dead_pct) || 0) })),
        [tables],
    );

    const chartSizeData = useMemo(
        () =>
            [...tables]
                .sort((a, b) => Number(b.total_bytes) - Number(a.total_bytes))
                .slice(0, 10)
                .map((t) => ({ name: t.tablename, size: Number(t.total_bytes) || 0 })),
        [tables],
    );

    const score = useMemo(
        () =>
            healthScore(
                Number(summary?.avg_dead_pct) || 0,
                Number(summary?.critical_bloat_tables) || 0,
                Number(summary?.total_tables) || 1,
            ),
        [summary],
    );

    const maxIndexBytes = useMemo(
        () => (indexes.length > 0 ? Math.max(...indexes.map((i) => Number(i.index_bytes) || 0)) : 1),
        [indexes],
    );

    if (loading)
        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 320,
                    gap: 16,
                    color: THEME.textMuted,
                }}
            >
                <Styles />
                <div
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        border: `2px solid ${THEME.primary}30`,
                        borderTopColor: THEME.primary,
                        animation: 'baSpin 1s linear infinite',
                    }}
                />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Analysing bloat…</span>
            </div>
        );

    return (
        <div className="ba3-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Styles />

            {/* ── HEADER ── */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 10,
                    padding: '12px 18px',
                    background: THEME.surface,
                    borderRadius: 18,
                    border: `1px solid ${THEME.glassBorder}`,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
                    <div
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            background: `${THEME.primary}18`,
                            border: `1px solid ${THEME.primary}30`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <Layers size={18} color={THEME.primary} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: THEME.textMain }}>Bloat Analysis</div>
                        <div style={{ fontSize: 11, color: THEME.textDim, marginTop: 1 }}>
                            {fmt(summary?.total_tables)} tables monitored
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                        {Number(summary?.critical_bloat_tables) > 0 && (
                            <span
                                className="ba3-badge"
                                style={{
                                    background: `${THEME.danger}15`,
                                    color: THEME.danger,
                                    border: `1px solid ${THEME.danger}40`,
                                }}
                            >
                                <AlertTriangle size={10} />
                                {summary.critical_bloat_tables} critical
                            </span>
                        )}
                        {Number(summary?.high_bloat_tables) > 0 && (
                            <span
                                className="ba3-badge"
                                style={{
                                    background: `${THEME.warning}15`,
                                    color: THEME.warning,
                                    border: `1px solid ${THEME.warning}40`,
                                }}
                            >
                                {summary.high_bloat_tables} high bloat
                            </span>
                        )}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {lastAt && (
                        <span
                            style={{
                                fontSize: 11,
                                color: THEME.textDim,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            <Clock size={11} />
                            {fmtRel(lastAt)}
                        </span>
                    )}
                    <select
                        value={autoRfsh}
                        onChange={(e) => setAutoRfsh(+e.target.value)}
                        style={{
                            background: THEME.surface,
                            border: `1px solid ${THEME.glassBorder}`,
                            color: THEME.textMain,
                            borderRadius: 20,
                            padding: '5px 10px',
                            fontSize: 12,
                            outline: 'none',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                        }}
                    >
                        <option value={30}>30s</option>
                        <option value={60}>1m</option>
                        <option value={300}>5m</option>
                        <option value={0}>Off</option>
                    </select>
                    <button
                        onClick={() => load(false)}
                        disabled={refreshing}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 16px',
                            borderRadius: 20,
                            border: `1px solid ${THEME.primary}50`,
                            background: `${THEME.primary}15`,
                            color: THEME.primary,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 700,
                            fontFamily: 'inherit',
                        }}
                    >
                        <RefreshCw size={13} style={{ animation: refreshing ? 'baSpin 1s linear infinite' : 'none' }} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* ── ERROR ── */}
            {error && (
                <div
                    style={{
                        padding: '12px 16px',
                        background: `${THEME.danger}15`,
                        border: `1px solid ${THEME.danger}40`,
                        borderRadius: 14,
                        color: THEME.danger,
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}
                >
                    <AlertCircle size={15} />
                    {error}
                </div>
            )}

            {/* ── KPI CARDS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 12 }}>
                <div className="ba3-kpi" style={{ borderTop: `2px solid ${THEME.primary}` }}>
                    <div
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 9,
                            background: `${THEME.primary}18`,
                            border: `1px solid ${THEME.primary}30`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Database size={15} color={THEME.primary} />
                    </div>
                    <div
                        style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: THEME.textMuted,
                            textTransform: 'uppercase',
                            letterSpacing: '.05em',
                        }}
                    >
                        Total DB Size
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: THEME.textMain, lineHeight: 1 }}>
                        {summary?.total_db_size || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: THEME.textDim }}>{fmt(summary?.total_tables)} tables</div>
                </div>

                <div className="ba3-kpi" style={{ borderTop: `2px solid ${THEME.warning}` }}>
                    <div
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 9,
                            background: `${THEME.warning}18`,
                            border: `1px solid ${THEME.warning}30`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <AlertTriangle size={15} color={THEME.warning} />
                    </div>
                    <div
                        style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: THEME.textMuted,
                            textTransform: 'uppercase',
                            letterSpacing: '.05em',
                        }}
                    >
                        High Bloat
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: THEME.warning, lineHeight: 1 }}>
                        {fmt(summary?.high_bloat_tables)}
                    </div>
                    <div style={{ fontSize: 11, color: THEME.warning }}>&gt;10% dead tuples</div>
                </div>

                <div className="ba3-kpi" style={{ borderTop: `2px solid ${THEME.danger}` }}>
                    <div
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 9,
                            background: `${THEME.danger}18`,
                            border: `1px solid ${THEME.danger}30`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Zap size={15} color={THEME.danger} />
                    </div>
                    <div
                        style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: THEME.textMuted,
                            textTransform: 'uppercase',
                            letterSpacing: '.05em',
                        }}
                    >
                        Critical Bloat
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: THEME.danger, lineHeight: 1 }}>
                        {fmt(summary?.critical_bloat_tables)}
                    </div>
                    <div style={{ fontSize: 11, color: THEME.danger }}>&gt;20% dead tuples</div>
                </div>

                <div
                    className="ba3-kpi"
                    style={{
                        borderTop: `2px solid ${Number(summary?.avg_dead_pct) > 10 ? THEME.warning : THEME.success}`,
                    }}
                >
                    <div
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 9,
                            background: `${THEME.success}18`,
                            border: `1px solid ${THEME.success}30`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <TrendingUp size={15} color={THEME.success} />
                    </div>
                    <div
                        style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: THEME.textMuted,
                            textTransform: 'uppercase',
                            letterSpacing: '.05em',
                        }}
                    >
                        Avg Dead %
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: THEME.textMain, lineHeight: 1 }}>
                        {summary?.avg_dead_pct || 0}
                        <span style={{ fontSize: 12, color: THEME.textDim, fontWeight: 500 }}>%</span>
                    </div>
                    <div style={{ fontSize: 11, color: THEME.textDim }}>
                        {fmt(summary?.total_dead_tuples)} dead rows
                    </div>
                </div>

                <div className="ba3-kpi" style={{ alignItems: 'center', gap: 10 }}>
                    <HealthRing score={score} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                        {[
                            {
                                label: 'Critical',
                                color: THEME.danger,
                                cls: 'crit',
                                count: tables.filter((t) => Number(t.dead_pct) > 20).length,
                            },
                            {
                                label: 'High',
                                color: THEME.warning,
                                cls: 'high',
                                count: tables.filter((t) => Number(t.dead_pct) > 10 && Number(t.dead_pct) <= 20).length,
                            },
                            {
                                label: 'OK',
                                color: THEME.success,
                                cls: 'ok',
                                count: tables.filter((t) => Number(t.dead_pct) <= 10).length,
                            },
                        ].map(({ label, color, cls, count }) => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                                <span className={`sev3-dot ${cls}`} />
                                <span style={{ color: THEME.textMuted, flex: 1 }}>{label}</span>
                                <span style={{ fontWeight: 700, color }}>{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <VacuumForecastPanel />
            <StorageAdvisorPanel />

            {/* ── CHARTS ── */}
            {chartDeadData.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {/* Dead Tuple % */}
                    <div className="ba3-card">
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '11px 16px',
                                borderBottom: `1px solid ${THEME.glassBorder}`,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <Activity size={13} color={THEME.textMuted} />
                                <span style={{ fontSize: 13, fontWeight: 700, color: THEME.textMain }}>
                                    Top 10 — Dead Tuple %
                                </span>
                            </div>
                            <span
                                className="ba3-badge"
                                style={{
                                    background: `${THEME.danger}15`,
                                    color: THEME.danger,
                                    border: `1px solid ${THEME.danger}35`,
                                }}
                            >
                                live
                            </span>
                        </div>
                        <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {chartDeadData.map(({ name, dead }) => {
                                const color = dead > 20 ? THEME.danger : dead > 10 ? THEME.warning : THEME.success;
                                return (
                                    <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    color: THEME.textMuted,
                                                    fontFamily: THEME.fontMono,
                                                }}
                                            >
                                                {name}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    color,
                                                    fontWeight: 700,
                                                    flexShrink: 0,
                                                    marginLeft: 8,
                                                    fontVariantNumeric: 'tabular-nums',
                                                }}
                                            >
                                                {dead}%
                                            </span>
                                        </div>
                                        <HBar pct={dead} color={color} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Total Size */}
                    <div className="ba3-card">
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                padding: '11px 16px',
                                borderBottom: `1px solid ${THEME.glassBorder}`,
                            }}
                        >
                            <HardDrive size={13} color={THEME.textMuted} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: THEME.textMain }}>
                                Top 10 — Total Size
                            </span>
                        </div>
                        <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {chartSizeData.map(({ name, size }) => {
                                const maxSize = chartSizeData[0]?.size || 1;
                                return (
                                    <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    color: THEME.textMuted,
                                                    fontFamily: THEME.fontMono,
                                                }}
                                            >
                                                {name}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    color: THEME.textMuted,
                                                    flexShrink: 0,
                                                    marginLeft: 8,
                                                    fontVariantNumeric: 'tabular-nums',
                                                }}
                                            >
                                                {fmtBytes(size)}
                                            </span>
                                        </div>
                                        <HBar pct={(size / maxSize) * 100} color={THEME.primary} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ── TABLE / INDEX / PREDICTOR ── */}
            <div className="ba3-card">
                {/* Tab bar */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 16px',
                        borderBottom: `1px solid ${THEME.glassBorder}`,
                        gap: 10,
                        flexWrap: 'wrap',
                    }}
                >
                    <div style={{ display: 'flex', gap: 6 }}>
                        {[
                            { id: 'tables', label: 'Table Bloat', Icon: Database },
                            { id: 'indexes', label: 'Index Bloat', Icon: BarChart2 },
                            { id: 'predictor', label: 'Growth Predict', Icon: TrendingUp },
                        ].map(({ id, label, Icon }) => (
                            <button
                                key={id}
                                className={`ba3-tab ${activeTab === id ? 'active' : ''}`}
                                onClick={() => {
                                    setActiveTab(id);
                                    setSearch('');
                                }}
                            >
                                <Icon size={11} />
                                {label}
                            </button>
                        ))}
                    </div>
                    {activeTab !== 'predictor' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ position: 'relative' }}>
                                <Search
                                    size={12}
                                    style={{
                                        position: 'absolute',
                                        left: 10,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: THEME.textDim,
                                        pointerEvents: 'none',
                                    }}
                                />
                                <input
                                    className="ba3-input"
                                    placeholder="Search tables…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            {activeTab === 'tables' && (
                                <button
                                    onClick={() => setFilterHigh((f) => !f)}
                                    className="ba3-tab"
                                    style={{
                                        ...(filterHigh
                                            ? {
                                                  background: `${THEME.warning}18`,
                                                  borderColor: `${THEME.warning}50`,
                                                  color: THEME.warning,
                                              }
                                            : {}),
                                    }}
                                >
                                    <Filter size={11} />
                                    High only
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* TABLE BLOAT */}
                {activeTab === 'tables' && (
                    <div>
                        <div className="ba3-head" style={{ display: 'grid', gridTemplateColumns: COLS_TABLE }}>
                            <SortBtn col="n/a" label="Table" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                            <SortBtn
                                col="total_bytes"
                                label="Size"
                                sortCol={sortCol}
                                sortDir={sortDir}
                                onSort={handleSort}
                            />
                            <span
                                style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: THEME.textDim,
                                    textTransform: 'uppercase',
                                    letterSpacing: '.05em',
                                }}
                            >
                                Live Rows
                            </span>
                            <SortBtn
                                col="n_dead_tup"
                                label="Dead Rows"
                                sortCol={sortCol}
                                sortDir={sortDir}
                                onSort={handleSort}
                            />
                            <SortBtn
                                col="dead_pct"
                                label="Dead % Bar"
                                sortCol={sortCol}
                                sortDir={sortDir}
                                onSort={handleSort}
                            />
                            <span
                                style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: THEME.textDim,
                                    textTransform: 'uppercase',
                                    letterSpacing: '.05em',
                                    borderLeft: '2px solid ' + THEME.glassBorder,
                                    paddingLeft: 10,
                                }}
                            >
                                Dead % · Action
                            </span>
                        </div>
                        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                            {filteredTables.length === 0 ? (
                                <div
                                    style={{
                                        padding: '32px 16px',
                                        textAlign: 'center',
                                        color: THEME.textDim,
                                        fontSize: 13,
                                    }}
                                >
                                    No tables found
                                </div>
                            ) : (
                                filteredTables.map((t, i) => {
                                    const deadPct = Number(t.dead_pct) || 0;
                                    const color = deadCol(deadPct);
                                    const sevCls = deadPct > 20 ? 'crit' : deadPct > 10 ? 'high' : 'ok';
                                    const showVac = deadPct > 10;
                                    return (
                                        <div
                                            key={i}
                                            className="ba3-row"
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: COLS_TABLE,
                                                alignItems: 'center',
                                                background: i % 2 === 1 ? `${THEME.surface}` : undefined,
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                                <span className={`sev3-dot ${sevCls}`} />
                                                <div style={{ minWidth: 0 }}>
                                                    <div
                                                        style={{
                                                            fontWeight: 600,
                                                            color: THEME.textMain,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            fontSize: 12,
                                                        }}
                                                    >
                                                        {t.tablename}
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: 10,
                                                            color: THEME.textDim,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        {t.schemaname}
                                                    </div>
                                                </div>
                                            </div>
                                            <span style={{ fontSize: 11, color: THEME.textMuted }}>
                                                {fmtBytes(t.total_bytes)}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    color: THEME.textMuted,
                                                    fontVariantNumeric: 'tabular-nums',
                                                }}
                                            >
                                                {fmt(t.n_live_tup)}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    color: deadPct > 10 ? color : THEME.textMuted,
                                                    fontWeight: deadPct > 10 ? 700 : 400,
                                                    fontVariantNumeric: 'tabular-nums',
                                                }}
                                            >
                                                {fmt(t.n_dead_tup)}
                                            </span>
                                            <div style={{ paddingRight: 8 }}>
                                                <HBar pct={deadPct} color={color} />
                                            </div>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    borderLeft: '2px solid ' + THEME.glassBorder + '40',
                                                    paddingLeft: 10,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        color,
                                                        minWidth: 44,
                                                        fontVariantNumeric: 'tabular-nums',
                                                    }}
                                                >
                                                    {deadPct.toFixed(1)}%
                                                </span>
                                                {showVac ? (
                                                    <button className="ba3-vac">VACUUM</button>
                                                ) : (
                                                    <span style={{ fontSize: 11, color: THEME.textDim }}>—</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* INDEX BLOAT */}
                {activeTab === 'indexes' && (
                    <div>
                        <div className="ba3-head" style={{ display: 'grid', gridTemplateColumns: COLS_INDEX }}>
                            <span>Index</span>
                            <span>Table</span>
                            <span>Size</span>
                            <span>Bloat Est.</span>
                            <span>Bloat %</span>
                        </div>
                        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                            {filteredIndexes.length === 0 ? (
                                <div
                                    style={{
                                        padding: '32px 16px',
                                        textAlign: 'center',
                                        color: THEME.textDim,
                                        fontSize: 13,
                                    }}
                                >
                                    No indexes found
                                </div>
                            ) : (
                                filteredIndexes.map((ix, i) => {
                                    const bloatPct =
                                        maxIndexBytes > 0 ? (Number(ix.index_bytes) / maxIndexBytes) * 100 : 0;
                                    const neverUsed = ix.idx_scan === 0 || ix.idx_scan === '0';
                                    return (
                                        <div
                                            key={i}
                                            className="ba3-row"
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: COLS_INDEX,
                                                alignItems: 'center',
                                                background: i % 2 === 1 ? `${THEME.surface}` : undefined,
                                            }}
                                        >
                                            <div style={{ minWidth: 0 }}>
                                                <div
                                                    style={{
                                                        fontWeight: 600,
                                                        color: THEME.textMain,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        fontSize: 12,
                                                    }}
                                                >
                                                    {ix.indexname}
                                                </div>
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 5,
                                                        marginTop: 2,
                                                    }}
                                                >
                                                    <span style={{ fontSize: 10, color: THEME.textDim }}>
                                                        {ix.schemaname}
                                                    </span>
                                                    {neverUsed && (
                                                        <span
                                                            className="ba3-badge"
                                                            style={{
                                                                background: `${THEME.danger}15`,
                                                                color: THEME.danger,
                                                                border: `1px solid ${THEME.danger}30`,
                                                                fontSize: 9,
                                                                padding: '1px 6px',
                                                            }}
                                                        >
                                                            UNUSED
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    color: THEME.textMuted,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {ix.tablename}
                                            </span>
                                            <span style={{ fontSize: 11, color: THEME.textMuted }}>
                                                {fmtBytes(ix.index_bytes)}
                                            </span>
                                            <span style={{ fontSize: 11, color: THEME.textMuted }}>
                                                {fmtBytes(ix.bloat_bytes)}
                                            </span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <div style={{ flex: 1 }}>
                                                    <HBar pct={bloatPct} color={THEME.primary} />
                                                </div>
                                                <span
                                                    style={{
                                                        fontSize: 11,
                                                        color: THEME.textMuted,
                                                        minWidth: 32,
                                                        textAlign: 'right',
                                                        fontVariantNumeric: 'tabular-nums',
                                                    }}
                                                >
                                                    {bloatPct.toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* GROWTH PREDICTOR */}
                {activeTab === 'predictor' &&
                    (() => {
                        const horizons = [
                            { label: '7d', days: 7, color: THEME.warning },
                            { label: '30d', days: 30, color: THEME.danger },
                            { label: '90d', days: 90, color: THEME.aiDark },
                        ];
                        const project = (current: number, days: number) =>
                            Math.min(100, current + current * 0.05 * days);
                        const topTables = [...tables]
                            .sort((a, b) => Number(b.dead_pct) - Number(a.dead_pct))
                            .slice(0, 8);
                        return (
                            <>
                                <div
                                    className="ba3-head"
                                    style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.8fr 0.8fr 0.8fr' }}
                                >
                                    <span>Table</span>
                                    <span>Now</span>
                                    {horizons.map((h) => (
                                        <span key={h.label} style={{ color: h.color }}>
                                            {h.label}
                                        </span>
                                    ))}
                                </div>
                                <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                                    {topTables.map((t, i) => {
                                        const now = Number(t.dead_pct) || 0;
                                        return (
                                            <div
                                                key={i}
                                                className="ba3-row"
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: '2fr 0.8fr 0.8fr 0.8fr 0.8fr',
                                                    alignItems: 'center',
                                                    background: i % 2 === 1 ? THEME.surface : undefined,
                                                }}
                                            >
                                                <div>
                                                    <div
                                                        style={{
                                                            fontFamily: THEME.fontMono,
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                            color: THEME.textMain,
                                                        }}
                                                    >
                                                        {t.tablename}
                                                    </div>
                                                    <div style={{ fontSize: 10, color: THEME.textDim }}>
                                                        {t.schemaname}
                                                    </div>
                                                </div>
                                                <span
                                                    style={{
                                                        fontFamily: THEME.fontMono,
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        color: deadCol(now),
                                                    }}
                                                >
                                                    {now.toFixed(1)}%
                                                </span>
                                                {horizons.map((h) => {
                                                    const proj = project(now, h.days);
                                                    return (
                                                        <div key={h.label}>
                                                            <div
                                                                style={{
                                                                    fontFamily: THEME.fontMono,
                                                                    fontSize: 12,
                                                                    fontWeight: 700,
                                                                    color: h.color,
                                                                }}
                                                            >
                                                                {proj.toFixed(1)}%
                                                            </div>
                                                            <div style={{ fontSize: 10, color: THEME.textDim }}>
                                                                +{(proj - now).toFixed(1)}%
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div
                                    style={{
                                        padding: '10px 16px',
                                        borderTop: `1px solid ${THEME.glassBorder}`,
                                        fontSize: 11,
                                        color: THEME.textDim,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                    }}
                                >
                                    <span>Assumes constant accumulation rate with no intervening VACUUM</span>
                                    <span
                                        style={{ color: THEME.primary, cursor: 'pointer', fontWeight: 600 }}
                                        onClick={() => setActiveTab('tables')}
                                    >
                                        → View tables
                                    </span>
                                </div>
                            </>
                        );
                    })()}
            </div>
        </div>
    );
}
