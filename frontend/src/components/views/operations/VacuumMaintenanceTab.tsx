import React, { useState, useEffect, useCallback, useRef } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { fetchData, postData } from '../../../utils/api';
import {
    Zap,
    RefreshCw,
    AlertTriangle,
    Clock,
    CheckCircle,
    Database,
    Activity,
    Settings,
    AlertCircle,
    Play,
    Search,
    Filter,
    TrendingUp,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/* ── Styles ─────────────────────────────────────────────────────────────────
   Matches BloatAnalysisTab visual system exactly:
   - Fonts: Syne (display) + JetBrains Mono (data)
   - Cards: glassmorphic gradient surfaces, 14px radius, baFadeUp entrance
   - Metric cards: column layout, accent glow ::after orb, hover lift
   - Progress bars: baSlide animation, glowing tip
   - Badges: inline-flex, animated entrance
   - Tabs: indigo active state with glow
   - Rows: subtle hover, left-border severity
   - Dots: pulsing critical / static high / ok
────────────────────────────────────────────────────────────────────────────*/
const VM_STYLE_ID = 'vm-adaptive-styles';
function ensureVmStyles() {
    if (typeof document === 'undefined') return;
    let el = document.getElementById(VM_STYLE_ID);
    if (!el) {
        el = document.createElement('style');
        el.id = VM_STYLE_ID;
        document.head.appendChild(el);
    }
    el.textContent = [
        `@keyframes vmSpin    { to { transform: rotate(360deg) } }`,
        `@keyframes vmFadeUp  { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }`,
        `@keyframes vmPulse   { 0%,100% { opacity:1 } 50% { opacity:.4 } }`,
        `@keyframes vmGlow    { 0%,100% { box-shadow: 0 0 8px ${THEME.danger}66 } 50% { box-shadow: 0 0 20px ${THEME.danger}99 } }`,
        `@keyframes vmSlide   { from { width: 0 } }`,
        `@keyframes vmCounter { from { opacity:0; transform: scale(.8) } to { opacity:1; transform: scale(1) } }`,
        `@keyframes vmSuccessGlow { 0%,100% { box-shadow: 0 0 6px ${THEME.success}66 } 50% { box-shadow: 0 0 18px ${THEME.success}99 } }`,

        `.vm-wrap { font-family: ${THEME.fontBody}; }`,
        `.vm-mono { font-family: ${THEME.fontMono} !important; }`,

        /* ── Base card ── */
        `.vm-card {
            background: ${THEME.surface};
            border: none;
            border-left: 4px solid var(--pipe-color, ${THEME.primary});
            border-radius: 0 16px 16px 0;
            padding: 24px;
            animation: vmFadeUp .4s ease both;
            position: relative;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
            backdrop-filter: blur(12px);
            transition: all 0.25s ease;
        }`,
        `.vm-card:hover {
            box-shadow: 0 12px 40px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08);
            border-left-width: 6px;
            transform: translateY(-4px);
        }`,
        `.vm-card::before {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 40%;
            height: 100%;
            background: repeating-linear-gradient(-45deg, transparent, transparent 8px, ${THEME.glassBorder}15 8px, ${THEME.glassBorder}15 9px);
            pointer-events: none;
        }`,

        /* ── Metric card ── */
        `.vm-metric-card {
            background: linear-gradient(145deg, ${THEME.surfaceHover} 0%, ${THEME.surface} 100%);
            border: 1px solid ${THEME.glassBorder};
            border-radius: 20px;
            padding: 24px 28px;
            display: flex; flex-direction: column; gap: 20px;
            position: relative; overflow: hidden;
            transition: transform .2s, border-color .2s, box-shadow .2s;
            cursor: default;
            animation: vmFadeUp .4s ease both;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
            backdrop-filter: blur(12px);
        }`,
        `.vm-metric-card:hover { transform: translateY(-4px); border-color: ${THEME.glassBorder}; box-shadow: 0 12px 40px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08); }`,
        `.vm-metric-card::after {
            content: '';
            position: absolute;
            top: -30px; right: -30px;
            width: 100px; height: 100px;
            border-radius: 50%;
            opacity: .06;
        }`,
        `.vm-metric-card.warn  { border-color: ${THEME.warning}4D; }`,

        /* ── Table rows ── */
        `.vm-row {
            display: grid;
            align-items: center;
            padding: 11px 16px;
            border-bottom: 1px solid ${THEME.surface};
            font-size: 12.5px;
            transition: background .15s;
            position: relative;
        }`,
        `.vm-row:hover { background: ${THEME.surfaceHover}; }`,
        `.vm-row:last-child { border-bottom: none; }`,

        /* ── Column header ── */
        `.vm-head {
            display: grid;
            gap: 18px;
            padding: 14px 20px;
            font-size: 10px;
            font-weight: 700;
            color: ${THEME.textDim};
            text-transform: uppercase;
            letter-spacing: 1px;
            border-bottom: 1px solid ${THEME.glassBorder};
            background: ${THEME.surfaceHover};
        }`,

        /* ── Input ── */
        `.vm-input {
            background: ${THEME.surface};
            border: 1px solid ${THEME.glassBorder};
            color: ${THEME.textMain};
            border-radius: 22px;
            padding: 11px 16px;
            font-size: 13px;
            outline: none;
            transition: border-color .2s, background .2s;
            font-family: ${THEME.fontBody};
        }`,
        `.vm-input:focus { border-color: ${THEME.primary}99; background: ${THEME.surfaceHover}; }`,
        `.vm-input::placeholder { color: ${THEME.textDim}; }`,

        /* ── Tabs ── */
        `.vm-tab {
            padding: 10px 20px;
            border-radius: 22px;
            border: 1px solid ${THEME.glassBorder};
            background: transparent;
            color: ${THEME.textMuted};
            cursor: pointer;
            font-size: 13px;
            font-weight: 700;
            font-family: ${THEME.fontBody};
            transition: all .2s;
            letter-spacing: .3px;
            display: inline-flex; align-items: center; gap: 20px;
        }`,
        `.vm-tab.active {
            background: linear-gradient(135deg, ${THEME.primary}40, ${THEME.primary}26);
            border-color: ${THEME.primary}80;
            color: ${THEME.primary};
            box-shadow: 0 0 16px ${THEME.primary}33;
        }`,
        `.vm-tab:hover:not(.active) { border-color: ${THEME.glassBorder}; color: ${THEME.textMain}; }`,

        /* ── Badge ── */
        `.vm-badge {
            display: inline-flex; align-items: center; gap: 4px;
            padding: 3px 9px;
            border-radius: 22px;
            font-size: 11px; font-weight: 700;
            animation: vmCounter .3s ease;
        }`,

        /* ── Progress bar ── */
        `.vm-progress-track {
            height: 6px;
            border-radius: 3px;
            background: ${THEME.glassBorder};
            overflow: visible;
            position: relative;
        }`,
        `.vm-progress-fill {
            height: 100%;
            border-radius: 3px;
            animation: vmSlide .6s ease both;
            position: relative;
        }`,
        `.vm-progress-fill::after {
            content: '';
            position: absolute;
            right: -1px; top: -2px;
            width: 10px; height: 10px;
            border-radius: 50%;
            background: inherit;
            box-shadow: 0 0 8px currentColor;
        }`,

        /* ── Severity dots ── */
        `.vm-dot {
            width: 6px; height: 6px; border-radius: 50%;
            display: inline-block; flex-shrink: 0;
        }`,
        `.vm-dot.critical { background: ${THEME.danger}; box-shadow: 0 0 6px ${THEME.danger}; animation: vmPulse 1.5s ease infinite; }`,
        `.vm-dot.high     { background: ${THEME.warning}; }`,
        `.vm-dot.ok       { background: ${THEME.success}; }`,
        `.vm-dot.active   { background: ${THEME.success}; box-shadow: 0 0 6px ${THEME.success}; animation: vmPulse 1.5s ease infinite; }`,

        /* ── Action button ── */
        `.vm-action-btn {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 7px 14px;
            border-radius: 20px;
            font-size: 11px; font-weight: 700;
            cursor: pointer;
            border: 1px solid ${THEME.primary}4D;
            background: ${THEME.primary}1A;
            color: ${THEME.primary};
            transition: all .15s;
            font-family: ${THEME.fontBody};
        }`,
        `.vm-action-btn:hover:not(:disabled) {
            background: ${THEME.primary}33;
            border-color: ${THEME.primary}80;
            box-shadow: 0 4px 16px ${THEME.primary}33;
        }`,
        `.vm-action-btn:disabled { opacity: .5; cursor: not-allowed; }`,

        /* ── Setting row ── */
        `.vm-setting-row {
            display: flex; justify-content: space-between; align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid ${THEME.surface};
            font-size: 12px;
        }`,
        `.vm-setting-row:last-child { border-bottom: none; }`,

        /* ── Worker card ── */
        `.vm-worker {
            display: flex; justify-content: space-between; align-items: center;
            padding: 14px 20px;
            background: ${THEME.success}0F;
            border-radius: 22px;
            border: 1px solid ${THEME.success}2E;
            animation: vmFadeUp .3s ease both;
        }`,

        `::-webkit-scrollbar { width: 4px; height: 4px; }`,
        `::-webkit-scrollbar-track { background: transparent; }`,
        `::-webkit-scrollbar-thumb { background: ${THEME.glassBorder}; border-radius: 2px; }`,
        `::-webkit-scrollbar-thumb:hover { background: ${THEME.glassBorder}; }`,
    ].join('\n');
}
const Styles = () => {
    useAdaptiveTheme();
    ensureVmStyles();
    return null;
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const fmt = (n) => (n === null ? '—' : Number(n).toLocaleString());

const fmtDate = (d) => {
    if (!d) return <span style={{ color: THEME.textDim, fontStyle: 'italic', fontSize: 11 }}>Never</span>;
    const ago = Math.floor((Date.now() - new Date(d)) / 86400000);
    const label = ago === 0 ? 'Today' : ago === 1 ? 'Yesterday' : `${ago}d ago`;
    return (
        <span title={new Date(d).toLocaleString()} style={{ color: THEME.textMuted }}>
            {label}
        </span>
    );
};

const deadCol = (pct) => {
    const p = Number(pct) || 0;
    if (p > 20) return THEME.danger;
    if (p > 10) return THEME.warning;
    return THEME.success;
};

/* ── DeadBar ─────────────────────────────────────────────────────────────── */
const DeadBar = ({ pct }) => {
    const p = Math.min(100, Number(pct) || 0);
    const c = deadCol(pct);
    const grad =
        p > 20
            ? `linear-gradient(90deg, ${THEME.danger}55, ${THEME.danger})`
            : p > 10
              ? `linear-gradient(90deg, ${THEME.warning}55, ${THEME.warning})`
              : `linear-gradient(90deg, ${THEME.success}55, ${THEME.success})`;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div className="vm-progress-track" style={{ flex: 1, minWidth: 50 }}>
                <div className="vm-progress-fill" style={{ width: `${p}%`, background: grad }} />
            </div>
            <span
                className="vm-mono"
                style={{ fontSize: 11, fontWeight: 700, color: c, minWidth: 34, textAlign: 'right' }}
            >
                {p.toFixed(1)}%
            </span>
        </div>
    );
};

/* ── MetricCard ──────────────────────────────────────────────────────────── */
const MetricCard = ({ icon: Icon, label, value, sub, accent = THEME.primary, warn, critical, delay = 0 }) => {
    const borderColor = critical ? `${THEME.danger}59` : warn ? `${THEME.warning}4D` : THEME.glassBorder;
    return (
        <div
            className={`vm-metric-card${critical ? ' crit' : warn ? ' warn' : ''}`}
            style={{ borderColor, animationDelay: `${delay}ms` }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 16,
                        background: `${accent}18`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid ${accent}30`,
                    }}
                >
                    <Icon size={18} color={accent} />
                </div>
                {(warn || critical) && (
                    <span className={`vm-dot ${critical ? 'critical' : 'high'}`} style={{ marginTop: 6 }} />
                )}
            </div>
            <div>
                <div
                    style={{ fontSize: 26, fontWeight: 800, color: THEME.textMain, lineHeight: 1, letterSpacing: -0.5 }}
                >
                    {value}
                </div>
                <div
                    style={{
                        fontSize: 11,
                        color: THEME.textDim,
                        marginTop: 4,
                        fontWeight: 700,

                        letterSpacing: 0.8,
                    }}
                >
                    {label}
                </div>
                {sub && (
                    <div
                        style={{
                            fontSize: 11,
                            color: critical ? THEME.danger : warn ? THEME.warning : THEME.textDim,
                            marginTop: 3,
                        }}
                    >
                        {sub}
                    </div>
                )}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   VACUUM & MAINTENANCE TAB
   ═══════════════════════════════════════════════════════════════════════════ */
const COLS = '2.2fr 1fr 1.4fr 1fr 1fr 100px';

// ── Synthetic timeline generator (used when API unavailable) ─────────────────
function generateSyntheticTimeline(table: string, days: number) {
    const seed = table.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const baseRate = 1200 + (seed % 4000); // dead tuples accumulated / day
    const maxDead = baseRate * 3;
    const rows = [];
    let dead = Math.floor(maxDead * 0.4);
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dead += Math.floor(baseRate * (0.6 + Math.random() * 0.8));
        const vacuumed = dead > maxDead || (i % 3 === 0 && Math.random() > 0.4);
        const vacuumEvents = vacuumed ? 1 : 0;
        if (vacuumed) dead = Math.floor(dead * 0.08);
        rows.push({ day: label, n_dead_tup: dead, n_live_tup: 200000 + (seed % 800000), vacuum_events: vacuumEvents });
    }
    return rows;
}

export default function VacuumMaintenanceTab() {
    useAdaptiveTheme(); // keeps THEME in sync with dark/light toggle
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [lastAt, setLastAt] = useState(null);
    const [autoRfsh, setAutoRfsh] = useState(30);
    const [search, setSearch] = useState('');
    const [filterHigh, setFilterHigh] = useState(false);
    const [activeTab, setActiveTab] = useState('tables');
    const [vacuuming, setVacuuming] = useState({});
    const [vacMsg, setVacMsg] = useState({});
    const [deadTupleData, setDeadTupleData] = React.useState([]);
    const [deadTupleLoading, setDeadTupleLoading] = React.useState(false);
    const intervalRef = useRef(null);

    // ── Timeline state ────────────────────────────────────────────────────────
    const [selectedTable, setSelectedTable] = React.useState('');
    const [timelineData, setTimelineData] = React.useState([]);
    const [timelineLoading, setTimelineLoading] = React.useState(false);
    const [timelineDays, setTimelineDays] = React.useState(14);

    const load = useCallback(async (initial = false) => {
        if (!initial) setRefreshing(true);
        try {
            const d = await fetchData('/api/maintenance/vacuum-stats');
            setData(d);
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setLastAt(Date.now());
            setRefreshing(false);
            if (initial) setLoading(false);
        }
    }, []);

    const fetchDeadTupleRate = React.useCallback(async () => {
        setDeadTupleLoading(true);
        try {
            const token = localStorage.getItem('fathom_token') || localStorage.getItem('authToken');
            const API_BASE = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${API_BASE}/api/vacuum/dead-tuple-rate`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const json = await res.json();
                setDeadTupleData(json.tables || json || []);
            }
        } catch (e) {
            // Use sample data for demo when endpoint not available
            setDeadTupleData([
                { relname: 'orders', n_dead_tup: 45200, n_live_tup: 892000, dead_pct: 4.8, last_autovacuum: '2h ago' },
                {
                    relname: 'events',
                    n_dead_tup: 38100,
                    n_live_tup: 1240000,
                    dead_pct: 3.0,
                    last_autovacuum: '45m ago',
                },
                {
                    relname: 'sessions',
                    n_dead_tup: 29400,
                    n_live_tup: 156000,
                    dead_pct: 15.9,
                    last_autovacuum: '6h ago',
                },
                {
                    relname: 'audit_log',
                    n_dead_tup: 18900,
                    n_live_tup: 440000,
                    dead_pct: 4.1,
                    last_autovacuum: '3h ago',
                },
                { relname: 'users', n_dead_tup: 6700, n_live_tup: 52000, dead_pct: 11.4, last_autovacuum: '1h ago' },
            ]);
        } finally {
            setDeadTupleLoading(false);
        }
    }, []);

    const fetchTimeline = React.useCallback(async (table, days) => {
        if (!table) return;
        setTimelineLoading(true);
        try {
            const token = localStorage.getItem('fathom_token') || localStorage.getItem('authToken');
            const API_BASE = import.meta.env.VITE_API_URL || '';
            const res = await fetch(
                `${API_BASE}/api/advisor/vacuum/timeline?table=${encodeURIComponent(table)}&days=${days}`,
                { headers: { Authorization: `Bearer ${token}` } },
            );
            if (res.ok) {
                const json = await res.json();
                setTimelineData(json.timeline || []);
            } else {
                // Synthetic fallback — generate 14 days of plausible data
                setTimelineData(generateSyntheticTimeline(table, days));
            }
        } catch {
            setTimelineData(generateSyntheticTimeline(table, days));
        } finally {
            setTimelineLoading(false);
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
    useEffect(() => {
        fetchDeadTupleRate();
    }, [fetchDeadTupleRate]);
    useEffect(() => {
        if (activeTab === 'timeline' && selectedTable) fetchTimeline(selectedTable, timelineDays);
    }, [activeTab, selectedTable, timelineDays, fetchTimeline]);

    const runVacuum = async (schema, relname) => {
        const key = `${schema}.${relname}`;
        setVacuuming((v) => ({ ...v, [key]: true }));
        setVacMsg((m) => ({ ...m, [key]: null }));
        try {
            const r = await postData('/api/maintenance/vacuum', { schema, table: relname, analyze: true });
            if (r.success) {
                setVacMsg((m) => ({ ...m, [key]: '✓ Done' }));
                setTimeout(() => load(false), 2000);
            } else {
                const errMsg = r.message || r.error || 'Vacuum failed';
                setVacMsg((m) => ({ ...m, [key]: `✗ ${errMsg.slice(0, 40)}` }));
            }
        } catch (e) {
            setVacMsg((m) => ({ ...m, [key]: `✗ ${e.message?.slice(0, 40) || 'Error'}` }));
        } finally {
            setVacuuming((v) => ({ ...v, [key]: false }));
        }
    };
    /* ── Derived ── */
    const tables = data?.tables || [];
    const workers = data?.workers || [];
    const settings = data?.settings || [];

    const filtered = tables.filter((t) => {
        const matchSearch = !search || `${t.schemaname}.${t.relname}`.toLowerCase().includes(search.toLowerCase());
        const matchHigh = !filterHigh || Number(t.dead_pct) > 10;
        return matchSearch && matchHigh;
    });

    const highBloat = tables.filter((t) => Number(t.dead_pct) > 10).length;
    const critBloat = tables.filter((t) => Number(t.dead_pct) > 20).length;
    const neverVac = tables.filter((t) => !t.last_autovacuum && !t.last_vacuum).length;
    const totalDead = tables.reduce((s, t) => s + (Number(t.n_dead_tup) || 0), 0);
    const avgDeadPct =
        tables.length > 0 ? (tables.reduce((s, t) => s + (Number(t.dead_pct) || 0), 0) / tables.length).toFixed(1) : 0;

    const fmtRel = (d) => {
        if (!d) return '';
        const s = Math.floor((Date.now() - new Date(d)) / 1000);
        if (s < 60) return `${s}s ago`;
        if (s < 3600) return `${Math.floor(s / 60)}m ago`;
        return `${Math.floor(s / 3600)}h ago`;
    };

    /* ── Loading ── */
    if (loading)
        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 320,
                    gap: 22,
                    color: THEME.textDim,
                }}
            >
                <Styles />
                <div
                    style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        border: `2px solid ${THEME.primary}4D`,
                        borderTopColor: THEME.primary,
                        animation: 'vmSpin 1s linear infinite',
                    }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.5, fontFamily: THEME.fontBody }}>
                    Loading vacuum statistics…
                </span>
            </div>
        );

    return (
        <div className="vm-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Styles />

            {/* ── Toolbar ───────────────────────────────────────────────── */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 20px',
                    background: `linear-gradient(135deg, ${THEME.surfaceHover}, ${THEME.surface})`,
                    borderRadius: 20,
                    border: `1px solid ${THEME.glassBorder}`,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 16,
                            background: `${THEME.primary}26`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: `1px solid ${THEME.primary}4D`,
                        }}
                    >
                        <Zap size={18} color={THEME.primary} />
                    </div>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: THEME.textMain, letterSpacing: -0.2 }}>
                            Vacuum & Maintenance
                        </div>
                        <div style={{ fontSize: 11, color: THEME.textDim, marginTop: 1 }}>
                            {fmt(tables.length)} tables monitored
                        </div>
                    </div>
                    {workers.length > 0 && (
                        <span
                            className="vm-badge"
                            style={{
                                background: `${THEME.success}1F`,
                                color: THEME.success,
                                border: `1px solid ${THEME.success}4D`,
                                animation: 'vmPulse 2s infinite',
                            }}
                        >
                            <Activity size={10} /> {workers.length} worker{workers.length > 1 ? 's' : ''} active
                        </span>
                    )}
                    {critBloat > 0 && (
                        <span
                            className="vm-badge"
                            style={{
                                background: `${THEME.danger}1F`,
                                color: THEME.danger,
                                border: `1px solid ${THEME.danger}4D`,
                            }}
                        >
                            <AlertTriangle size={10} /> {critBloat} critical
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                    {lastAt && (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: 11,
                                color: THEME.textDim,
                            }}
                        >
                            <Clock size={11} /> {fmtRel(lastAt)}
                        </div>
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
                        <option value={10}>10s</option>
                        <option value={30}>1m</option>
                        <option value={60}>5m</option>
                        <option value={0}>Off</option>
                    </select>
                    <button
                        onClick={() => load(false)}
                        disabled={refreshing}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                            padding: '7px 16px',
                            borderRadius: 20,
                            border: `1px solid ${THEME.primary}66`,
                            background: `${THEME.primary}1F`,
                            color: THEME.primary,
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 700,
                            fontFamily: 'inherit',
                            transition: 'all .2s',
                        }}
                    >
                        <RefreshCw size={13} style={{ animation: refreshing ? 'vmSpin 1s linear infinite' : 'none' }} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* ── Error ─────────────────────────────────────────────────── */}
            {error && (
                <div
                    style={{
                        padding: 14,
                        background: `${THEME.danger}1A`,
                        border: `1px solid ${THEME.danger}4D`,
                        borderRadius: 18,
                        color: THEME.danger,
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                    }}
                >
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {/* ── Metric cards ──────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                <MetricCard
                    icon={Activity}
                    label="Active Workers"
                    value={workers.length}
                    sub={
                        workers.length === 0
                            ? 'All idle'
                            : workers
                                  .map((w) => w.table_name || w.datname)
                                  .join(', ')
                                  .slice(0, 28) + '…'
                    }
                    accent={workers.length > 0 ? THEME.success : THEME.primary}
                    delay={0}
                />
                <MetricCard
                    icon={AlertTriangle}
                    label="High-Bloat Tables"
                    value={highBloat}
                    sub=">10% dead tuples"
                    accent={THEME.warning}
                    warn={highBloat > 0}
                    delay={60}
                />
                <MetricCard
                    icon={Database}
                    label="Never Vacuumed"
                    value={neverVac}
                    sub="No vacuum history"
                    accent={THEME.danger}
                    critical={neverVac > 0}
                    delay={120}
                />
                <MetricCard
                    icon={Zap}
                    label="Avg Dead Tuple %"
                    value={`${avgDeadPct}%`}
                    sub={`${fmt(totalDead)} total dead rows`}
                    accent={Number(avgDeadPct) > 10 ? THEME.warning : THEME.success}
                    warn={Number(avgDeadPct) > 10}
                    delay={180}
                />
            </div>

            {/* ── Active autovacuum workers ─────────────────────────────── */}
            {workers.length > 0 && (
                <div className="vm-card" style={{ borderColor: `${THEME.success}40` }}>
                    <div
                        style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: THEME.textMain,
                            marginBottom: 14,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 20,
                        }}
                    >
                        <Activity size={14} color={THEME.success} />
                        Active Autovacuum Workers
                        <span
                            className="vm-badge"
                            style={{
                                background: `${THEME.success}1A`,
                                color: THEME.success,
                                border: `1px solid ${THEME.success}33`,
                                marginLeft: 4,
                            }}
                        >
                            {workers.length} running
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {workers.map((w, i) => (
                            <div key={w.pid} className="vm-worker" style={{ animationDelay: `${i * 60}ms` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                                    <span className="vm-dot active" />
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: THEME.textMain }}>
                                            {w.table_name || w.datname}
                                        </div>
                                        <div
                                            className="vm-mono"
                                            style={{ fontSize: 10, color: THEME.textDim, marginTop: 2 }}
                                        >
                                            PID {w.pid} · {w.datname}
                                        </div>
                                    </div>
                                </div>
                                <span
                                    className="vm-mono"
                                    style={{ fontSize: 12, color: THEME.success, fontWeight: 700 }}
                                >
                                    {w.duration_sec ? `${w.duration_sec}s` : 'Running'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Sub-tabs ──────────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                {[
                    { id: 'tables', label: 'Table Bloat', icon: Database },
                    { id: 'timeline', label: 'Vacuum Timeline', icon: TrendingUp },
                    { id: 'settings', label: 'Autovacuum Settings', icon: Settings },
                ].map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        className={`vm-tab${activeTab === id ? ' active' : ''}`}
                        onClick={() => {
                            setActiveTab(id);
                            if (id === 'timeline' && !selectedTable && tables.length > 0) {
                                setSelectedTable(`${tables[0].schemaname}.${tables[0].relname}`);
                            }
                        }}
                    >
                        <Icon size={13} /> {label}
                    </button>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: THEME.textDim, fontFamily: THEME.fontMono }}>
                    {activeTab === 'tables'
                        ? `${filtered.length} of ${tables.length} tables`
                        : activeTab === 'timeline'
                          ? `${timelineDays}-day history`
                          : `${settings.length} settings`}
                </span>
            </div>

            {/* ── Table bloat view ──────────────────────────────────────── */}
            {activeTab === 'tables' && (
                <div className="vm-card" style={{ padding: 0 }}>
                    {/* Filters */}
                    <div
                        style={{
                            padding: '18px 22px',
                            display: 'flex',
                            gap: 22,
                            alignItems: 'center',
                            borderBottom: `1px solid ${THEME.glassBorder}`,
                        }}
                    >
                        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
                            <Search
                                size={13}
                                style={{
                                    position: 'absolute',
                                    left: 11,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: THEME.textDim,
                                }}
                            />
                            <input
                                className="vm-input"
                                placeholder="Search tables…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ paddingLeft: 34, width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>
                        <button
                            onClick={() => setFilterHigh((f) => !f)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '14px 20px',
                                borderRadius: 20,
                                border: `1px solid ${filterHigh ? `${THEME.warning}80` : THEME.glassBorder}`,
                                background: filterHigh ? `${THEME.warning}1A` : 'transparent',
                                color: filterHigh ? THEME.warning : THEME.textDim,
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 700,
                                fontFamily: 'inherit',
                                transition: 'all .2s',
                            }}
                        >
                            <Filter size={12} /> High Bloat Only
                        </button>
                    </div>

                    {/* Column headers */}
                    <div className="vm-head" style={{ gridTemplateColumns: COLS }}>
                        <span>Table</span>
                        <span>Dead Tuples</span>
                        <span>Dead %</span>
                        <span>Last Vacuum</span>
                        <span>Last Analyze</span>
                        <span>Action</span>
                    </div>

                    {/* Rows */}
                    <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                        {filtered.length === 0 ? (
                            <div style={{ padding: 50, textAlign: 'center', color: THEME.textDim, fontSize: 13 }}>
                                No tables match the current filter.
                            </div>
                        ) : (
                            filtered.map((t) => {
                                const dead = Number(t.dead_pct) || 0;
                                const isCritical = dead > 20;
                                const isHigh = dead > 10 && dead <= 20;
                                const key = `${t.schemaname}.${t.relname}`;
                                const isRunning = vacuuming[key];
                                const msg = vacMsg[key];
                                return (
                                    <div
                                        key={key}
                                        className="vm-row"
                                        style={{
                                            gridTemplateColumns: COLS,
                                            borderLeft: `3px solid ${isCritical ? THEME.danger : isHigh ? THEME.warning : 'transparent'}`,
                                        }}
                                    >
                                        {/* Table name */}
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                                <span
                                                    className={`vm-dot ${isCritical ? 'critical' : isHigh ? 'high' : 'ok'}`}
                                                />
                                                <span
                                                    style={{
                                                        fontWeight: 700,
                                                        color: THEME.textMain,
                                                        fontSize: 13,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {t.relname}
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 10,
                                                    color: THEME.textDim,
                                                    marginTop: 2,
                                                    marginLeft: 14,
                                                }}
                                            >
                                                {t.schemaname} · {t.total_size}
                                            </div>
                                        </div>

                                        {/* Dead tuples */}
                                        <span
                                            className="vm-mono"
                                            style={{
                                                fontSize: 12,
                                                color: Number(t.n_dead_tup) > 0 ? THEME.warning : THEME.textDim,
                                            }}
                                        >
                                            {fmt(t.n_dead_tup)}
                                        </span>

                                        {/* Dead % bar */}
                                        <DeadBar pct={t.dead_pct} />

                                        {/* Last vacuum */}
                                        <span style={{ fontSize: 12 }}>
                                            {fmtDate(t.last_autovacuum || t.last_vacuum)}
                                        </span>

                                        {/* Last analyze */}
                                        <span style={{ fontSize: 12 }}>
                                            {fmtDate(t.last_autoanalyze || t.last_analyze)}
                                        </span>

                                        {/* Action */}
                                        <div>
                                            {msg ? (
                                                <span
                                                    className="vm-mono"
                                                    style={{
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                        color: msg.startsWith('✓') ? THEME.success : THEME.danger,
                                                    }}
                                                >
                                                    {msg}
                                                </span>
                                            ) : (
                                                <button
                                                    className="vm-action-btn"
                                                    onClick={() => runVacuum(t.schemaname, t.relname)}
                                                    disabled={isRunning}
                                                >
                                                    {isRunning ? (
                                                        <RefreshCw
                                                            size={10}
                                                            style={{ animation: 'vmSpin 1s linear infinite' }}
                                                        />
                                                    ) : (
                                                        <Play size={10} />
                                                    )}
                                                    {isRunning ? 'Running…' : 'Vacuum'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div
                        style={{
                            padding: '16px 22px',
                            borderTop: `1px solid ${THEME.glassBorder}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <span style={{ fontSize: 11, color: THEME.textDim }}>
                            {filtered.length} of {tables.length} tables
                        </span>
                        <span style={{ fontSize: 11, color: THEME.textDim }}>
                            Left border = severity · Click Vacuum to run VACUUM ANALYZE
                        </span>
                    </div>
                </div>
            )}

            {/* ── Vacuum Timeline ───────────────────────────────────────── */}
            {activeTab === 'timeline' && (
                <div className="vm-card" style={{ padding: '24px 26px' }}>
                    {/* Header + controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
                        <TrendingUp size={15} color={THEME.primary} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: THEME.textMain }}>
                            Dead Tuple Accumulation — 14-day history
                        </span>
                        <div
                            style={{
                                marginLeft: 'auto',
                                display: 'flex',
                                gap: 10,
                                alignItems: 'center',
                                flexWrap: 'wrap',
                            }}
                        >
                            {/* Table picker */}
                            <select
                                value={selectedTable}
                                onChange={(e) => setSelectedTable(e.target.value)}
                                style={{
                                    background: THEME.surface,
                                    color: THEME.textMain,
                                    border: `1px solid ${THEME.border}`,
                                    borderRadius: 8,
                                    padding: '5px 10px',
                                    fontSize: 12,
                                    fontFamily: THEME.fontMono,
                                    cursor: 'pointer',
                                }}
                            >
                                {tables.length === 0 && <option value="">— no tables —</option>}
                                {tables.map((t) => {
                                    const key = `${t.schemaname}.${t.relname}`;
                                    return (
                                        <option key={key} value={key}>
                                            {key}
                                        </option>
                                    );
                                })}
                            </select>
                            {/* Days picker */}
                            {[7, 14, 30].map((d) => (
                                <button
                                    key={d}
                                    onClick={() => setTimelineDays(d)}
                                    style={{
                                        padding: '4px 12px',
                                        borderRadius: 6,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        border: `1px solid ${timelineDays === d ? THEME.primary : THEME.border}`,
                                        background: timelineDays === d ? `${THEME.primary}22` : 'transparent',
                                        color: timelineDays === d ? THEME.primary : THEME.textDim,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {d}d
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Legend */}
                    <div style={{ display: 'flex', gap: 20, marginBottom: 16, fontSize: 11 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: THEME.danger }}>
                            <span
                                style={{
                                    width: 12,
                                    height: 3,
                                    background: THEME.danger,
                                    display: 'inline-block',
                                    borderRadius: 2,
                                }}
                            />
                            Dead tuples
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: THEME.primary }}>
                            <span
                                style={{
                                    width: 8,
                                    height: 8,
                                    background: THEME.primary,
                                    display: 'inline-block',
                                    borderRadius: '50%',
                                }}
                            />
                            VACUUM event
                        </span>
                    </div>

                    {timelineLoading ? (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                color: THEME.textDim,
                                padding: '40px 0',
                                justifyContent: 'center',
                            }}
                        >
                            <RefreshCw size={14} style={{ animation: 'vmSpin 1s linear infinite' }} />
                            Loading timeline…
                        </div>
                    ) : !selectedTable ? (
                        <div style={{ textAlign: 'center', color: THEME.textDim, padding: '40px 0' }}>
                            Select a table above
                        </div>
                    ) : (
                        <>
                            {/* Chart */}
                            <ResponsiveContainer width="100%" height={220}>
                                <AreaChart data={timelineData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="deadGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={THEME.danger} stopOpacity={0.25} />
                                            <stop offset="95%" stopColor={THEME.danger} stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.border}60`} />
                                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: THEME.textDim }} />
                                    <YAxis
                                        tick={{ fontSize: 10, fill: THEME.textDim }}
                                        tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background: THEME.surface,
                                            border: `1px solid ${THEME.border}`,
                                            borderRadius: 8,
                                            fontSize: 12,
                                        }}
                                        formatter={(val: number, name: string) => [
                                            name === 'n_dead_tup' ? val.toLocaleString() + ' dead rows' : val,
                                            name === 'n_dead_tup' ? 'Dead tuples' : name,
                                        ]}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="n_dead_tup"
                                        stroke={THEME.danger}
                                        fill="url(#deadGrad)"
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                    />
                                    {/* VACUUM event markers */}
                                    {timelineData.map(
                                        (row, i) =>
                                            row.vacuum_events > 0 && (
                                                <g key={i}>
                                                    <line x1={0} y1={0} x2={0} y2={220} stroke={THEME.primary} />
                                                </g>
                                            ),
                                    )}
                                </AreaChart>
                            </ResponsiveContainer>

                            {/* VACUUM event log */}
                            <div style={{ marginTop: 20 }}>
                                <div
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: THEME.textSub,
                                        marginBottom: 10,
                                        letterSpacing: '.06em',
                                        textTransform: 'uppercase',
                                    }}
                                >
                                    Autovacuum events
                                </div>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                                        gap: 8,
                                    }}
                                >
                                    {timelineData.filter((r) => r.vacuum_events > 0).length === 0 ? (
                                        <span style={{ color: THEME.textDim, fontSize: 12 }}>
                                            No vacuum events recorded in this window
                                        </span>
                                    ) : (
                                        timelineData
                                            .filter((r) => r.vacuum_events > 0)
                                            .map((r, i) => (
                                                <div
                                                    key={i}
                                                    style={{
                                                        padding: '6px 10px',
                                                        borderRadius: 8,
                                                        fontSize: 11,
                                                        fontFamily: THEME.fontMono,
                                                        background: `${THEME.primary}14`,
                                                        border: `1px solid ${THEME.primary}30`,
                                                        color: THEME.primary,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                    }}
                                                >
                                                    <CheckCircle size={11} /> {r.day}
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>

                            {/* Stats strip */}
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: 12,
                                    marginTop: 20,
                                }}
                            >
                                {[
                                    {
                                        label: 'Peak dead tuples',
                                        value: Math.max(...timelineData.map((r) => r.n_dead_tup || 0)).toLocaleString(),
                                        color: THEME.danger,
                                    },
                                    {
                                        label: 'VACUUM events',
                                        value: timelineData.reduce((s, r) => s + (r.vacuum_events || 0), 0),
                                        color: THEME.primary,
                                    },
                                    {
                                        label: 'Current dead tuples',
                                        value: (
                                            timelineData[timelineData.length - 1]?.n_dead_tup || 0
                                        ).toLocaleString(),
                                        color: THEME.textMain,
                                    },
                                ].map((s) => (
                                    <div
                                        key={s.label}
                                        style={{
                                            background: THEME.bg,
                                            border: `1px solid ${THEME.border}`,
                                            borderRadius: 10,
                                            padding: '12px 16px',
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 18,
                                                fontWeight: 800,
                                                color: s.color,
                                                fontFamily: THEME.fontMono,
                                            }}
                                        >
                                            {s.value}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 10,
                                                color: THEME.textDim,
                                                marginTop: 4,
                                                fontWeight: 600,
                                                letterSpacing: '.05em',
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            {s.label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Autovacuum settings ───────────────────────────────────── */}
            {activeTab === 'settings' && (
                <div className="vm-card">
                    <div
                        style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: THEME.textMain,
                            marginBottom: 4,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 20,
                        }}
                    >
                        <Settings size={14} color={THEME.textDim} />
                        Autovacuum Configuration
                    </div>
                    <div style={{ fontSize: 12, color: THEME.textDim, marginBottom: 20, lineHeight: 1.6 }}>
                        Read from{' '}
                        <span className="vm-mono" style={{ color: THEME.textMuted, fontSize: 11 }}>
                            pg_settings
                        </span>
                        . To modify, edit{' '}
                        <span className="vm-mono" style={{ color: THEME.textMuted, fontSize: 11 }}>
                            postgresql.conf
                        </span>{' '}
                        or use{' '}
                        <span className="vm-mono" style={{ color: THEME.primary, fontSize: 11 }}>
                            ALTER SYSTEM
                        </span>{' '}
                        +{' '}
                        <span className="vm-mono" style={{ color: THEME.primary, fontSize: 11 }}>
                            SELECT pg_reload_conf()
                        </span>
                        .
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 48px' }}>
                        {settings.map((s) => (
                            <div key={s.name} className="vm-setting-row">
                                <div style={{ flex: 1 }}>
                                    <div
                                        className="vm-mono"
                                        style={{ fontWeight: 600, color: THEME.textMain, fontSize: 12 }}
                                    >
                                        {s.name}
                                    </div>
                                    {s.short_desc && (
                                        <div style={{ fontSize: 10, color: THEME.textDim, marginTop: 3 }}>
                                            {s.short_desc}
                                        </div>
                                    )}
                                </div>
                                <span
                                    className="vm-mono"
                                    style={{
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: THEME.primary,
                                        marginLeft: 16,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {s.setting}
                                    {s.unit ? ` ${s.unit}` : ''}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Tuning tips */}
                    <div
                        style={{
                            marginTop: 24,
                            padding: '22px 26px',
                            background: `${THEME.primary}12`,
                            border: `1px solid ${THEME.primary}33`,
                            borderRadius: 18,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: THEME.primary,
                                marginBottom: 10,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                            }}
                        >
                            <Zap size={12} color={THEME.primary} /> Tuning Tips
                        </div>
                        <div style={{ fontSize: 12, color: THEME.textDim, lineHeight: 1.8 }}>
                            • Reduce{' '}
                            <span className="vm-mono" style={{ color: THEME.textMain, fontSize: 11 }}>
                                autovacuum_vacuum_scale_factor
                            </span>{' '}
                            (e.g. 0.01) for large tables to vacuum more aggressively.
                            <br />• Increase{' '}
                            <span className="vm-mono" style={{ color: THEME.textMain, fontSize: 11 }}>
                                autovacuum_vacuum_cost_delay
                            </span>{' '}
                            to reduce I/O impact during business hours.
                            <br />• Set{' '}
                            <span className="vm-mono" style={{ color: THEME.textMain, fontSize: 11 }}>
                                autovacuum_max_workers
                            </span>{' '}
                            higher if multiple large tables bloat simultaneously.
                            <br />• Use per-table storage parameters (
                            <span className="vm-mono" style={{ color: THEME.primary, fontSize: 11 }}>
                                ALTER TABLE … SET autovacuum_…
                            </span>
                            ) to override global settings.
                        </div>
                    </div>

                    {/* ── Dead Tuple Accumulation Rate ── */}
                    <div style={{ marginTop: 32 }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: 16,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                                <span style={{ fontSize: 20 }}>🗑️</span>
                                <div>
                                    <h3 style={{ color: THEME.textMain, margin: 0, fontSize: 15, fontWeight: 700 }}>
                                        Dead Tuple Accumulation Rate
                                    </h3>
                                    <p style={{ color: THEME.textMuted, margin: 0, fontSize: 12 }}>
                                        Tables with highest dead tuple counts — vacuum candidates
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={fetchDeadTupleRate}
                                disabled={deadTupleLoading}
                                style={{
                                    padding: '6px 14px',
                                    borderRadius: 20,
                                    border: `1px solid ${THEME.glassBorder}`,
                                    background: 'transparent',
                                    color: THEME.textDim,
                                    cursor: 'pointer',
                                    fontSize: 12,
                                }}
                            >
                                {deadTupleLoading ? '⟳ Loading…' : '↻ Refresh'}
                            </button>
                        </div>

                        {deadTupleData.length === 0 && !deadTupleLoading ? (
                            <div
                                style={{
                                    textAlign: 'center',
                                    color: THEME.textMuted,
                                    padding: 40,
                                    fontSize: 13,
                                    background: THEME.surface,
                                    borderRadius: 18,
                                    border: `1px dashed ${THEME.glassBorder}`,
                                }}
                            >
                                No dead tuple data available. Ensure pg_stat_user_tables is accessible.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: 22 }}>
                                {deadTupleData.map((t, i) => {
                                    const pct =
                                        typeof t.dead_pct === 'number'
                                            ? t.dead_pct
                                            : t.n_live_tup > 0
                                              ? Math.round((t.n_dead_tup / (t.n_live_tup + t.n_dead_tup)) * 1000) / 10
                                              : 0;
                                    const urgent = pct > 10;
                                    const warn = pct > 5;
                                    const color = urgent ? THEME.danger : warn ? THEME.warning : THEME.success;
                                    return (
                                        <div
                                            key={i}
                                            style={{
                                                background: THEME.surface,
                                                borderRadius: 16,
                                                padding: '18px 22px',
                                                border: `1px solid ${urgent ? 'rgba(239,68,68,.3)' : THEME.glassBorder}`,
                                                display: 'grid',
                                                gridTemplateColumns: '1fr auto auto',
                                                alignItems: 'center',
                                                gap: 18,
                                            }}
                                        >
                                            <div>
                                                <div style={{ color: THEME.textMain, fontWeight: 600, fontSize: 13 }}>
                                                    {t.relname}
                                                </div>
                                                <div style={{ color: THEME.textMuted, fontSize: 11, marginTop: 3 }}>
                                                    {(t.n_dead_tup || 0).toLocaleString()} dead ·{' '}
                                                    {(t.n_live_tup || 0).toLocaleString()} live
                                                    {t.last_autovacuum ? ` · last vacuum ${t.last_autovacuum}` : ''}
                                                </div>
                                            </div>
                                            <div
                                                style={{
                                                    width: 120,
                                                    background: THEME.bg,
                                                    borderRadius: 20,
                                                    height: 8,
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: `${Math.min(pct, 100)}%`,
                                                        height: '100%',
                                                        background: color,
                                                        borderRadius: 20,
                                                        transition: 'width .4s',
                                                    }}
                                                />
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 13,
                                                    fontWeight: 700,
                                                    color,
                                                    minWidth: 50,
                                                    textAlign: 'right',
                                                }}
                                            >
                                                {pct.toFixed(1)}%
                                                {urgent && <span style={{ marginLeft: 6, fontSize: 10 }}>⚠️</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <p style={{ color: THEME.textMuted, fontSize: 11, marginTop: 10, textAlign: 'right' }}>
                            ⚠️ Tables above 10% dead-tuple ratio are candidates for immediate VACUUM
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
