// ==========================================================================
//  FATHOM — ReliabilityTab  (v6 — Live API Integration)
// ==========================================================================
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fetchData, postData } from '../../../utils/api';
import { THEME, useAdaptiveTheme, useGlobalRefresh } from '../../../utils/theme';

import {
    AlertTriangle,
    AlertCircle,
    CheckCircle,
    Bell,
    BellRing,
    BellOff,
    Shield,
    ShieldCheck,
    ShieldAlert,
    ShieldX,
    Clock,
    Timer,
    TrendingUp,
    TrendingDown,
    Activity,
    Eye,
    EyeOff,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    Search,
    Filter,
    X,
    MoreHorizontal,
    Zap,
    Server,
    Database,
    HardDrive,
    Cpu,
    Network,
    ArrowUp,
    ArrowDown,
    ArrowUpRight,
    ArrowDownRight,
    Calendar,
    BarChart3,
    Radio,
    History,
    Settings,
    CheckCheck,
    XCircle,
    Info,
    Flame,
    Gauge,
    Wifi,
    WifiOff,
    Link2,
    Users,
    BookOpen,
    Layers,
    TrendingDown as TrendD,
    Snowflake,
    Target,
    Percent,
    AlertOctagon,
    Hash,
    LayoutGrid,
} from 'lucide-react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ReferenceLine,
} from 'recharts';

/** Human span between two timestamps; measures to now when still open. */
const formatSpan = (from, to) => {
    if (!from) return '—';
    const mins = Math.max(0, Math.round(((to ? new Date(to) : new Date()).getTime() - new Date(from).getTime()) / 60000));
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ${mins % 60}m`.replace(' 0m', '');
    return `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`.replace(' 0h', '');
};


/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const RelStyles = () => (
    <style>{`
        @keyframes relFadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes relPulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes relPulseRing { 0%{transform:scale(0.8);opacity:0.6} 100%{transform:scale(2.4);opacity:0} }
        @keyframes relBarGrow { from{transform:scaleX(0)} to{transform:scaleX(1)} }
        @keyframes relFlash { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes relSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes relFlashBg { 0%{background:transparent} 30%{background:${THEME.primary}10} 100%{background:transparent} }
        @keyframes relBurnPulse { 0%,100%{box-shadow:0 0 0 0 ${THEME.danger}40} 50%{box-shadow:0 0 0 6px ${THEME.danger}00} }
        @keyframes relSlideIn { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
        @keyframes relFrostIn { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
        .rel-stagger>*{animation:relFadeIn 0.4s ease-out both}
        .rel-stagger>*:nth-child(1){animation-delay:0.00s}
        .rel-stagger>*:nth-child(2){animation-delay:0.05s}
        .rel-stagger>*:nth-child(3){animation-delay:0.10s}
        .rel-stagger>*:nth-child(4){animation-delay:0.15s}
        .rel-stagger>*:nth-child(5){animation-delay:0.20s}
        .rel-stagger>*:nth-child(6){animation-delay:0.25s}
        .rel-stagger>*:nth-child(7){animation-delay:0.30s}
        .rel-stagger>*:nth-child(8){animation-delay:0.35s}
        .rel-row-hover{transition:background 0.15s}
        .rel-row-hover:hover{background:${THEME.primary}06!important}
        .rel-bar-animate{transform-origin:left;animation:relBarGrow 0.8s cubic-bezier(0.22,1,0.36,1) both}
        .rel-scrollbar::-webkit-scrollbar{width:4px}
        .rel-scrollbar::-webkit-scrollbar-track{background:transparent}
        .rel-scrollbar::-webkit-scrollbar-thumb{background:${THEME.grid};border-radius:2px}
        .rel-refresh-spin{animation:relSpin 0.8s linear infinite}
        .rel-metric-flash{animation:relFlashBg 1s ease-out}
        .rel-burn-critical{animation:relBurnPulse 2s ease-in-out infinite}
        .rel-slide-in{animation:relSlideIn 0.3s ease-out both}
        .rel-frost{animation:relFrostIn 0.25s ease-out both}
        .rel-link:hover{text-decoration:underline;opacity:0.9}
        .rel-tab-btn{transition:all 0.2s}
        .rel-tab-btn:hover{opacity:0.85}
        .rel-card{background:${THEME.surface};border:1px solid ${THEME.glassBorder};border-radius: 20px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);transition:all 0.3s ease}
        .rel-card:hover{box-shadow:0 0 0 3px rgba(99,102,241,0.08), 0 8px 24px rgba(0,0,0,0.06)}
        .rel-card-metric{padding:14px 18px 10px;background:radial-gradient(ellipse at 30% 50%, rgba(99,102,241,0.03) 0%, transparent 70%)}
        .rel-card-footer{padding:8px 18px 10px;border-top:1px solid ${THEME.glassBorder};font-size:12px;color:${THEME.textMuted}}
    `}</style>
);

/* ── Refresh intervals ── */
const REFRESH_INTERVALS = [
    { label: '10s', value: 10 },
    { label: '30s', value: 30 },
    { label: '1m', value: 60 },
    { label: '5m', value: 300 },
    { label: 'Off', value: 0 },
];

/* ─── Panel ─────────────────────────────────────────────────────────────── */
const Panel = ({ title, icon: TIcon, rightNode, noPad, children, style = {}, refreshing, accent }) => (
    <div
        style={{
            background: THEME.surface,
            border: `1px solid ${accent ? `${accent}25` : refreshing ? `${THEME.primary}35` : THEME.glassBorder}`,
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 6px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)',
            transition: 'border-color 0.3s',
            ...style,
        }}
    >
        {title && (
            <div
                style={{
                    padding: '13px 20px',
                    borderBottom: `1px solid ${THEME.glassBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                    minHeight: 46,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    {TIcon && (
                        <TIcon
                            size={13}
                            color={accent || (refreshing ? THEME.primary : THEME.textDim)}
                            style={{ transition: 'color 0.3s' }}
                        />
                    )}
                    <span style={{ fontSize: 11, fontWeight: 800, color: THEME.textMuted, letterSpacing: '0.02em' }}>
                        {title}
                    </span>
                    {refreshing && (
                        <span
                            style={{
                                fontSize: 9,
                                color: THEME.primary,
                                fontWeight: 700,
                                animation: 'relPulse 1s ease-in-out infinite',
                            }}
                        >
                            LIVE
                        </span>
                    )}
                </div>
                {rightNode}
            </div>
        )}
        <div style={{ flex: 1, minHeight: 0, padding: noPad ? 0 : '16px 20px', position: 'relative' }}>{children}</div>
    </div>
);

/* ─── Micro components ───────────────────────────────────────────────────── */
const StatusBadge = ({ label, color, pulse }) => (
    <span
        style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 10,
            fontWeight: 700,
            padding: '3px 9px',
            borderRadius: 16,
            background: `${color}12`,
            color,
            border: `1px solid ${color}22`,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
        }}
    >
        <span
            style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: color,
                flexShrink: 0,
                animation: pulse ? 'relFlash 1.5s ease-in-out infinite' : 'none',
            }}
        />
        {label}
    </span>
);

const LiveDot = ({ color = THEME.success, size = 7 }) => (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color }} />
        <div
            style={{
                position: 'absolute',
                inset: -2,
                borderRadius: '50%',
                border: `1px solid ${color}50`,
                animation: 'relPulseRing 2s ease-out infinite',
            }}
        />
    </div>
);

const ChartTooltip = ({ active, payload, label, unit = '' }) => {
    if (!active || !payload?.length) return null;
    return (
        <div
            style={{
                background: THEME.surfaceRaised,
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: 16,
                padding: '22px 28px',
                fontSize: 11,
            }}
        >
            <div style={{ fontWeight: 800, color: THEME.textMain, marginBottom: 6, fontFamily: THEME.fontMono }}>
                {label}
            </div>
            {payload.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ width: 8, height: 3, borderRadius: 1, background: p.color }} />
                    <span style={{ color: THEME.textMuted, flex: 1 }}>{p.name}:</span>
                    <span style={{ fontWeight: 700, color: p.color, fontFamily: THEME.fontMono }}>
                        {p.value}
                        {unit}
                    </span>
                </div>
            ))}
        </div>
    );
};

const SEV = {
    critical: {
        color: THEME.danger,
        icon: Flame,
        label: 'Critical',
        bg: `${THEME.danger}08`,
        border: `${THEME.danger}22`,
    },
    warning: {
        color: THEME.warning,
        icon: AlertTriangle,
        label: 'Warning',
        bg: `${THEME.warning}06`,
        border: `${THEME.warning}18`,
    },
    info: { color: THEME.info, icon: Info, label: 'Info', bg: `${THEME.info}05`, border: `${THEME.info}15` },
};
const getSev = (s) => SEV[s] || SEV.info;

const CATEGORY_ICONS = {
    cpu: Cpu,
    memory: Server,
    disk: HardDrive,
    connection: Network,
    replication: RefreshCw,
    query: Database,
    lock: ShieldAlert,
    vacuum: Activity,
};

const fmtTime = (ts) => {
    if (!ts) return '—';
    const diff = (new Date() - new Date(ts)) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
};
const fmtLastRefreshed = (ts) => {
    if (!ts) return 'Never';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 5) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    return `${Math.floor(diff / 60)}m ago`;
};

/* ═══════════════════════════════════════════════════════════════════════════
   SYNTHETIC DATA GENERATORS
   ═══════════════════════════════════════════════════════════════════════════ */
const genAlertTrend = () =>
    Array.from({ length: 24 }, (_, i) => ({
        h: `${String(i).padStart(2, '0')}:00`,
        critical: 0,
        warning: 0,
        info: 0,
    }));

const genUptimeDays = () =>
    Array.from({ length: 90 }, (_, idx) => {
        const d = new Date(Date.now() - (89 - idx) * 86400000);
        return {
            date: d.toISOString().split('T')[0],
            label: `${d.getMonth() + 1}/${d.getDate()}`,
            status: 'up',
            uptime: 0,
        };
    });

/* Weekly MTTR trend — last 12 weeks */
const genMttrTrend = () =>
    Array.from({ length: 12 }, (_, i) => {
        const wk = new Date(Date.now() - (11 - i) * 7 * 86400000);
        return {
            week: `W${String(wk.getMonth() + 1).padStart(2, '0')}/${String(wk.getDate()).padStart(2, '0')}`,
            mttr: 0,
            incidents: 0,
        };
    });

/* Alert fatigue — alerts fired per day last 30 days */
const genAlertFatigue = () =>
    Array.from({ length: 30 }, (_, i) => {
        const d = new Date(Date.now() - (29 - i) * 86400000);
        return {
            day: `${d.getMonth() + 1}/${d.getDate()}`,
            fired: 0,
            actionable: 0,
            noise: 0,
        };
    });

/* SLO burn-rate data — 30-day error budget consumption */
const genSloBurnRate = () =>
    Array.from({ length: 30 }, (_, i) => {
        const d = new Date(Date.now() - (29 - i) * 86400000);
        return {
            day: `${d.getMonth() + 1}/${d.getDate()}`,
            consumed: 0,
            budget: 100,
        };
    });

/* MOCK DATA */
const MOCK_ALERTS = [];

const MOCK_INCIDENTS = [];

const MOCK_ONCALL = [];

const MOCK_SLOs = [];

const MOCK_FREEZE_WINDOWS = [];

const RCA_TAGS = [
    { tag: 'resource-exhaustion', color: THEME.danger },
    { tag: 'vacuum-bloat', color: THEME.warning },
    { tag: 'connection-leak', color: THEME.danger },
    { tag: 'lock-contention', color: THEME.warning },
    { tag: 'connection-saturation', color: THEME.danger },
    { tag: 'query-perf', color: THEME.info },
    { tag: 'storage-pressure', color: THEME.warning },
    { tag: 'replication-health', color: THEME.danger },
    { tag: 'resource-pressure', color: THEME.info },
];

/* ═══════════════════════════════════════════════════════════════════════════
   COUNTDOWN BAR
   ═══════════════════════════════════════════════════════════════════════════ */
const CountdownBar = ({ intervalSec, lastRefreshed }) => {
    const [progress, setProgress] = useState(100);
    useEffect(() => {
        if (!intervalSec || !lastRefreshed) {
            setProgress(100);
            return;
        }
        const tick = () => {
            const elapsed = (Date.now() - lastRefreshed) / 1000;
            setProgress(Math.max(0, 100 - (elapsed / intervalSec) * 100));
        };
        tick();
        const id = setInterval(tick, 250);
        return () => clearInterval(id);
    }, [intervalSec, lastRefreshed]);
    if (!intervalSec) return null;
    return (
        <div style={{ height: 2, background: `${THEME.primary}15`, borderRadius: 1, overflow: 'hidden' }}>
            <div
                style={{
                    height: '100%',
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, ${THEME.primary}, ${THEME.secondary})`,
                    borderRadius: 1,
                    transition: 'width 0.25s linear',
                }}
            />
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   REFRESH BAR
   ═══════════════════════════════════════════════════════════════════════════ */
const RefreshBar = ({ lastRefreshed, isRefreshing, intervalSec, onIntervalChange, onRefresh, error }) => {
    const [, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, []);
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                padding: '9px 16px',
                borderRadius: 16,
                border: `1px solid ${error ? `${THEME.danger}30` : THEME.glassBorder}`,
                fontSize: 11,
                flexWrap: 'wrap',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {error ? <WifiOff size={11} color={THEME.danger} /> : <Wifi size={11} color={THEME.success} />}
                <span style={{ color: error ? THEME.danger : THEME.success, fontWeight: 700 }}>
                    {error ? 'Connection error' : 'Connected'}
                </span>
            </div>
            <div style={{ width: 1, height: 12, background: THEME.grid, flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: THEME.textDim }}>
                <Clock size={10} />
                <span>
                    Last updated: <strong style={{ color: THEME.textMuted }}>{fmtLastRefreshed(lastRefreshed)}</strong>
                </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: THEME.textDim }}>Auto-refresh:</span>
                <div style={{ display: 'flex', gap: 3 }}>
                    {REFRESH_INTERVALS.map((opt) => {
                        const active = intervalSec === opt.value;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => onIntervalChange(opt.value)}
                                style={{
                                    padding: '3px 8px',
                                    borderRadius: 16,
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 10,
                                    fontWeight: 700,
                                    transition: 'all 0.15s',
                                    background: active ? `${THEME.primary}20` : 'transparent',
                                    color: active ? THEME.primary : THEME.textDim,
                                    outline: active ? `1px solid ${THEME.primary}30` : 'none',
                                }}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div style={{ flex: 1 }} />
            <button
                onClick={onRefresh}
                disabled={isRefreshing}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 12px',
                    borderRadius: 18,
                    border: 'none',
                    cursor: isRefreshing ? 'default' : 'pointer',
                    fontWeight: 700,
                    fontSize: 11,
                    background: isRefreshing ? `${THEME.primary}10` : `${THEME.primary}18`,
                    color: THEME.primary,
                    opacity: isRefreshing ? 0.7 : 1,
                    transition: 'all 0.15s',
                }}
            >
                <RefreshCw size={11} className={isRefreshing ? 'rel-refresh-spin' : ''} />
                {isRefreshing ? 'Refreshing…' : 'Refresh Now'}
            </button>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   ALERT CARD  (with Runbook link)
   ═══════════════════════════════════════════════════════════════════════════ */
const AlertCard = ({ alert, onAcknowledge, expanded, onToggle, isNew }) => {
    const sev = getSev(alert.severity);
    const CatIcon = CATEGORY_ICONS[alert.category] || AlertCircle;
    const isCritical = alert.severity === 'critical';
    return (
        <div
            className={isNew ? 'rel-metric-flash' : ''}
            style={{
                borderRadius: 18,
                overflow: 'hidden',
                background: alert.acknowledged ? THEME.surface : sev.bg,
                border: `1px solid ${alert.acknowledged ? `${THEME.grid}55` : sev.border}`,
                transition: 'all 0.2s',
                opacity: alert.acknowledged ? 0.65 : 1,
            }}
        >
            <div
                onClick={onToggle}
                style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '13px 16px', cursor: 'pointer' }}
            >
                <div
                    style={{
                        width: 34,
                        height: 34,
                        borderRadius: 16,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: `${sev.color}12`,
                        border: `1px solid ${sev.color}20`,
                    }}
                >
                    <sev.icon
                        size={15}
                        color={sev.color}
                        style={{
                            animation:
                                isCritical && !alert.acknowledged ? 'relFlash 1.5s ease-in-out infinite' : 'none',
                        }}
                    />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 4 }}>
                        <span
                            style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: THEME.textMain,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {alert.title}
                        </span>
                        {isNew && (
                            <span
                                style={{
                                    fontSize: 9,
                                    fontWeight: 800,
                                    padding: '2px 6px',
                                    borderRadius: 20,
                                    background: `${THEME.primary}18`,
                                    color: THEME.primary,
                                    border: `1px solid ${THEME.primary}20`,
                                }}
                            >
                                NEW
                            </span>
                        )}
                        {alert.autoResolved && (
                            <span
                                style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: 20,
                                    background: `${THEME.success}12`,
                                    color: THEME.success,
                                }}
                            >
                                AUTO-RESOLVED
                            </span>
                        )}
                        {alert.runbook && (
                            <span
                                style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: 20,
                                    background: `${THEME.info}10`,
                                    color: THEME.info,
                                    border: `1px solid ${THEME.info}18`,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                }}
                            >
                                <BookOpen size={8} />
                                RUNBOOK
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
                        <StatusBadge label={sev.label} color={sev.color} pulse={isCritical && !alert.acknowledged} />
                        <span
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 10,
                                color: THEME.textDim,
                            }}
                        >
                            <CatIcon size={10} />
                            {alert.category}
                        </span>
                        <span
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 10,
                                color: THEME.textDim,
                            }}
                        >
                            <Clock size={10} />
                            {fmtTime(alert.created_at)}
                        </span>
                        {alert.acknowledged && (
                            <span
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 10,
                                    color: THEME.success,
                                }}
                            >
                                <CheckCheck size={10} />
                                Acknowledged
                            </span>
                        )}
                    </div>
                </div>
                {alert.metric_value && (
                    <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 8 }}>
                        <div
                            style={{
                                fontSize: 15,
                                fontWeight: 800,
                                color: sev.color,
                                fontFamily: THEME.fontMono,
                                lineHeight: 1,
                            }}
                        >
                            {alert.metric_value}
                        </div>
                        {alert.threshold && (
                            <div style={{ fontSize: 9, color: THEME.textDim, marginTop: 3 }}>
                                threshold {alert.threshold}
                            </div>
                        )}
                    </div>
                )}
                <ChevronDown
                    size={14}
                    color={THEME.textDim}
                    style={{
                        flexShrink: 0,
                        transition: 'transform 0.2s',
                        transform: expanded ? 'rotate(180deg)' : 'none',
                    }}
                />
            </div>
            {expanded && (
                <div
                    style={{
                        padding: '0 16px 14px 64px',
                        animation: 'relFadeIn 0.2s ease',
                        borderTop: `1px solid ${THEME.grid}28`,
                    }}
                >
                    <p style={{ fontSize: 12, color: THEME.textMuted, lineHeight: 1.6, margin: '12px 0 10px' }}>
                        {alert.message}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                        {alert.source && (
                            <span
                                className="mono"
                                style={{
                                    fontSize: 10,
                                    padding: '3px 9px',
                                    borderRadius: 16,
                                    background: `${THEME.primary}0a`,
                                    border: `1px solid ${THEME.primary}12`,
                                    color: THEME.primary,
                                }}
                            >
                                {alert.source}
                            </span>
                        )}
                        {alert.rootCauseGroup && (
                            <span
                                style={{
                                    fontSize: 10,
                                    padding: '3px 9px',
                                    borderRadius: 16,
                                    background: `${THEME.secondary}0a`,
                                    border: `1px solid ${THEME.secondary}15`,
                                    color: THEME.secondary,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                }}
                            >
                                <Layers size={9} />
                                group: {alert.rootCauseGroup}
                            </span>
                        )}
                        {alert.runbook && (
                            <a
                                href={alert.runbook}
                                target="_blank"
                                rel="noreferrer"
                                className="rel-link"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    fontSize: 10,
                                    padding: '3px 9px',
                                    borderRadius: 16,
                                    background: `${THEME.info}0a`,
                                    border: `1px solid ${THEME.info}15`,
                                    color: THEME.info,
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                }}
                            >
                                <Link2 size={9} />
                                Open Runbook
                            </a>
                        )}
                        {!alert.acknowledged && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAcknowledge(alert.id);
                                }}
                                style={{
                                    padding: '5px 14px',
                                    borderRadius: 18,
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    background: `${THEME.success}15`,
                                    color: THEME.success,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    transition: 'all 0.15s',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = `${THEME.success}25`)}
                                onMouseLeave={(e) => (e.currentTarget.style.background = `${THEME.success}15`)}
                            >
                                <CheckCheck size={12} />
                                Acknowledge
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   UPTIME HEATMAP
   ═══════════════════════════════════════════════════════════════════════════ */
const UptimeHeatmap = ({ days }) => {
    const [hoveredDay, setHoveredDay] = useState(null);
    const statusColor = (s) => (s === 'outage' ? THEME.danger : s === 'degraded' ? THEME.warning : THEME.success);
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
    return (
        <div>
            <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
                {weeks.map((week, wi) => (
                    <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {week.map((day, di) => (
                            <div
                                key={di}
                                onMouseEnter={() => setHoveredDay(day)}
                                onMouseLeave={() => setHoveredDay(null)}
                                style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: 2,
                                    background: statusColor(day.status),
                                    opacity: day.status === 'up' ? 0.55 : 0.9,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    transform: hoveredDay?.date === day.date ? 'scale(1.35)' : 'scale(1)',
                                }}
                            />
                        ))}
                    </div>
                ))}
            </div>
            {hoveredDay && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 18,
                        padding: '20px 24px',
                        borderRadius: 20,
                        background: THEME.surface,
                        border: `1px solid ${THEME.grid}55`,
                        fontSize: 11,
                    }}
                >
                    <span className="mono" style={{ color: THEME.textDim }}>
                        {hoveredDay.date}
                    </span>
                    <StatusBadge
                        label={
                            hoveredDay.status === 'up'
                                ? 'Operational'
                                : hoveredDay.status === 'degraded'
                                  ? 'Degraded'
                                  : 'Outage'
                        }
                        color={statusColor(hoveredDay.status)}
                    />
                    <span style={{ fontWeight: 800, color: THEME.textMain, fontFamily: THEME.fontMono }}>
                        {hoveredDay.uptime.toFixed(2)}%
                    </span>
                </div>
            )}
            <div
                style={{ display: 'flex', gap: 20, fontSize: 10, color: THEME.textDim, marginTop: hoveredDay ? 8 : 0 }}
            >
                {[
                    { l: 'Operational', c: THEME.success },
                    { l: 'Degraded', c: THEME.warning },
                    { l: 'Outage', c: THEME.danger },
                ].map((x) => (
                    <span key={x.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: x.c, opacity: 0.7 }} />
                        {x.l}
                    </span>
                ))}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   ON-CALL WIDGET
   ═══════════════════════════════════════════════════════════════════════════ */
const OnCallWidget = () => {
    const statusColor = (s) => (s === 'active' ? THEME.success : s === 'standby' ? THEME.warning : THEME.textDim);
    const statusLabel = (s) => (s === 'active' ? 'On duty' : s === 'standby' ? 'Standby' : 'Off shift');

    if (MOCK_ONCALL.length === 0) {
        return (
            <Panel title="On-Call Rotation" icon={Users} accent={THEME.primary}>
                <div
                    style={{
                        padding: '24px 16px',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 20,
                    }}
                >
                    <Users size={28} color={THEME.textDim} />
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textMain, marginBottom: 4 }}>
                            On-call rotation not configured
                        </div>
                        <div style={{ fontSize: 11, color: THEME.textDim }}>
                            Set up team schedules in Settings → Team Management.
                        </div>
                    </div>
                </div>
            </Panel>
        );
    }

    return (
        <Panel title="On-Call Rotation" icon={Users} accent={THEME.primary}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {MOCK_ONCALL.map((p, i) => (
                    <div
                        key={i}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 22,
                            padding: '20px 24px',
                            borderRadius: 16,
                            background: i === 0 ? `${THEME.success}06` : THEME.surface,
                            border: `1px solid ${i === 0 ? `${THEME.success}18` : `${THEME.grid}40`}`,
                        }}
                    >
                        <div
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                flexShrink: 0,
                                background: `linear-gradient(135deg, ${THEME.primary}30, ${THEME.secondary}20)`,
                                border: `1px solid ${THEME.primary}20`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 11,
                                fontWeight: 800,
                                color: THEME.primary,
                                fontFamily: THEME.fontMono,
                            }}
                        >
                            {p.avatar}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textMain, marginBottom: 2 }}>
                                {p.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 10, color: THEME.textDim }}>{p.role}</span>
                                <span style={{ fontSize: 9, color: THEME.textDim }}>·</span>
                                <span className="mono" style={{ fontSize: 9, color: THEME.textDim }}>
                                    {p.since}–{p.until} {p.tz}
                                </span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                            <StatusBadge
                                label={statusLabel(p.status)}
                                color={statusColor(p.status)}
                                pulse={p.status === 'active'}
                            />
                            <span className="mono" style={{ fontSize: 9, color: THEME.textDim }}>
                                {p.contact}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </Panel>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   NOISE REDUCTION SCORE
   ═══════════════════════════════════════════════════════════════════════════ */
const NoiseReductionPanel = ({ alerts }) => {
    const autoResolved = alerts.filter((a) => a.autoResolved).length;
    const total = alerts.length;
    const score = total > 0 ? Math.round((autoResolved / total) * 100) : 0;
    const scoreColor = score >= 60 ? THEME.success : score >= 35 ? THEME.warning : THEME.danger;
    return (
        <Panel title="Alert Noise Reduction" icon={Percent} accent={scoreColor}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
                    <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="36" cy="36" r="28" fill="none" stroke={`${scoreColor}15`} strokeWidth="6" />
                        <circle
                            cx="36"
                            cy="36"
                            r="28"
                            fill="none"
                            stroke={scoreColor}
                            strokeWidth="6"
                            strokeDasharray={`${2 * Math.PI * 28}`}
                            strokeDashoffset={`${2 * Math.PI * 28 * (1 - score / 100)}`}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dashoffset 1s ease' }}
                        />
                    </svg>
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <span style={{ fontSize: 16, fontWeight: 800, color: scoreColor, fontFamily: THEME.fontMono }}>
                            {score}%
                        </span>
                    </div>
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: THEME.textDim, marginBottom: 8 }}>
                        <strong style={{ color: scoreColor, fontFamily: THEME.fontMono }}>{autoResolved}</strong> of{' '}
                        <strong style={{ color: THEME.textMuted, fontFamily: THEME.fontMono }}>{total}</strong> alerts
                        auto-resolved
                    </div>
                    <div style={{ fontSize: 10, color: THEME.textDim, lineHeight: 1.5 }}>
                        {score >= 60
                            ? '✓ Automation handling noise well — team is focused on real issues.'
                            : score >= 35
                              ? '△ Some noise present — review auto-resolution rules.'
                              : '✗ High manual burden — tune alert thresholds.'}
                    </div>
                </div>
            </div>
        </Panel>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   ALERT FATIGUE CHART
   ═══════════════════════════════════════════════════════════════════════════ */
const AlertFatiguePanel = ({ data }) => (
    <Panel
        title="Alert Fatigue Score (30d)"
        icon={Activity}
        rightNode={
            <div style={{ display: 'flex', gap: 22, fontSize: 10, color: THEME.textDim }}>
                {[
                    { l: 'Actionable', c: THEME.success },
                    { l: 'Noise', c: THEME.danger },
                ].map((x) => (
                    <span key={x.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 3, borderRadius: 1, background: x.c }} />
                        {x.l}
                    </span>
                ))}
            </div>
        }
    >
        <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                        <linearGradient id="fatGN" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={THEME.danger} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={THEME.danger} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="fatGA" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={THEME.success} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={THEME.success} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid stroke={`${THEME.grid}35`} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                        dataKey="day"
                        tick={{ fontSize: 8, fill: THEME.textDim }}
                        axisLine={false}
                        tickLine={false}
                        interval={6}
                    />
                    <YAxis tick={{ fontSize: 8, fill: THEME.textDim }} axisLine={false} tickLine={false} width={24} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                        type="monotone"
                        dataKey="noise"
                        name="Noise"
                        stroke={THEME.danger}
                        strokeWidth={1.5}
                        fill="url(#fatGN)"
                    />
                    <Area
                        type="monotone"
                        dataKey="actionable"
                        name="Actionable"
                        stroke={THEME.success}
                        strokeWidth={1.5}
                        fill="url(#fatGA)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    </Panel>
);

/* ═══════════════════════════════════════════════════════════════════════════
   MTTR TREND CHART
   ═══════════════════════════════════════════════════════════════════════════ */
const MttrTrendPanel = ({ data }) => (
    <Panel
        title="MTTR Trend (12 Weeks)"
        icon={TrendingUp}
        rightNode={
            <span style={{ fontSize: 10, color: THEME.textDim, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Timer size={9} />
                avg time to resolve
            </span>
        }
    >
        <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
                    <defs>
                        <linearGradient id="mttrGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={THEME.primary} />
                            <stop offset="100%" stopColor={THEME.secondary} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid stroke={`${THEME.grid}35`} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                        dataKey="week"
                        tick={{ fontSize: 8, fill: THEME.textDim }}
                        axisLine={false}
                        tickLine={false}
                        interval={2}
                    />
                    <YAxis
                        tick={{ fontSize: 8, fill: THEME.textDim }}
                        axisLine={false}
                        tickLine={false}
                        width={28}
                        unit="m"
                    />
                    <ReferenceLine y={16} stroke={`${THEME.warning}50`} strokeDasharray="4 4" />
                    <Tooltip content={<ChartTooltip unit="m" />} />
                    <Line
                        type="monotone"
                        dataKey="mttr"
                        name="MTTR"
                        stroke={THEME.primary}
                        strokeWidth={2}
                        dot={{ fill: THEME.primary, r: 3, strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: THEME.primary }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
        <div
            style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 10, color: THEME.textDim, alignItems: 'center' }}
        >
            <span
                style={{
                    width: 20,
                    height: 1,
                    background: `${THEME.warning}60`,
                    borderTop: '1px dashed',
                    display: 'inline-block',
                }}
            />
            <span>SLA target (16m)</span>
        </div>
    </Panel>
);

/* ═══════════════════════════════════════════════════════════════════════════
   ALERT GROUPING VIEW
   ═══════════════════════════════════════════════════════════════════════════ */
const AlertGroupView = ({ alerts }) => {
    const [expandedGroup, setExpandedGroup] = useState(null);
    const groups = useMemo(() => {
        const map = {};
        alerts.forEach((a) => {
            const g = a.rootCauseGroup || 'uncategorized';
            if (!map[g]) map[g] = [];
            map[g].push(a);
        });
        return Object.entries(map)
            .map(([key, items]) => ({
                key,
                items,
                severity: items.some((i) => i.severity === 'critical')
                    ? 'critical'
                    : items.some((i) => i.severity === 'warning')
                      ? 'warning'
                      : 'info',
                active: items.filter((i) => !i.acknowledged).length,
            }))
            .sort((a, b) => {
                const o = { critical: 0, warning: 1, info: 2 };
                return (o[a.severity] ?? 3) - (o[b.severity] ?? 3);
            });
    }, [alerts]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {groups.map((g, idx) => {
                const sev = getSev(g.severity);
                const isExpanded = expandedGroup === g.key;
                return (
                    <div
                        key={g.key}
                        style={{
                            borderRadius: 18,
                            overflow: 'hidden',
                            border: `1px solid ${isExpanded ? sev.border : `${THEME.grid}45`}`,
                            transition: 'all 0.2s',
                        }}
                    >
                        <div
                            onClick={() => setExpandedGroup(isExpanded ? null : g.key)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 18,
                                padding: '18px 22px',
                                cursor: 'pointer',
                                background: isExpanded ? sev.bg : THEME.surface,
                            }}
                        >
                            <div
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 20,
                                    flexShrink: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: `${sev.color}12`,
                                }}
                            >
                                <Layers size={13} color={sev.color} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textMain, marginBottom: 2 }}>
                                    {g.key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                                </div>
                                <div style={{ fontSize: 10, color: THEME.textDim }}>
                                    {g.items.length} alerts · {g.active} active
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                {g.active > 0 && (
                                    <span
                                        style={{
                                            fontSize: 11,
                                            fontWeight: 800,
                                            color: sev.color,
                                            fontFamily: THEME.fontMono,
                                        }}
                                    >
                                        {g.active}
                                    </span>
                                )}
                                <StatusBadge label={sev.label} color={sev.color} />
                                <ChevronDown
                                    size={13}
                                    color={THEME.textDim}
                                    style={{
                                        transition: 'transform 0.2s',
                                        transform: isExpanded ? 'rotate(180deg)' : 'none',
                                    }}
                                />
                            </div>
                        </div>
                        {isExpanded && (
                            <div
                                style={{
                                    padding: '20px 24px',
                                    background: THEME.surface,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 4,
                                }}
                            >
                                {g.items.map((item) => {
                                    const is = getSev(item.severity);
                                    return (
                                        <div
                                            key={item.id}
                                            className="rel-slide-in"
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 22,
                                                padding: '8px 10px',
                                                borderRadius: 20,
                                                background: THEME.surface,
                                                border: `1px solid ${THEME.grid}35`,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    width: 6,
                                                    height: 6,
                                                    borderRadius: '50%',
                                                    background: is.color,
                                                    flexShrink: 0,
                                                }}
                                            />
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    color: THEME.textMuted,
                                                    flex: 1,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {item.title}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: 10,
                                                    color: THEME.textDim,
                                                    fontFamily: THEME.fontMono,
                                                }}
                                            >
                                                {fmtTime(item.created_at)}
                                            </span>
                                            {item.acknowledged && <CheckCheck size={10} color={THEME.success} />}
                                            {item.runbook && <Link2 size={10} color={THEME.info} />}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SLO BURN-RATE PANEL
   ═══════════════════════════════════════════════════════════════════════════ */
const SloBurnRatePanel = ({ burnData }) => {
    const [selectedSlo, setSelectedSlo] = useState(0);
    const slo = MOCK_SLOs[selectedSlo];
    const burnColor = slo?.burnRate6h > 3 ? THEME.danger : slo?.burnRate6h > 1.5 ? THEME.warning : THEME.success;

    if (MOCK_SLOs.length === 0) {
        return (
            <div
                style={{
                    padding: '40px 24px',
                    textAlign: 'center',
                    background: THEME.surface,
                    border: `1px solid ${THEME.grid}`,
                    borderRadius: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 18,
                }}
            >
                <Gauge size={32} color={THEME.textDim} />
                <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: THEME.textMain, marginBottom: 4 }}>
                        No Service Level Objectives
                    </div>
                    <div style={{ fontSize: 12, color: THEME.textDim, maxWidth: 360 }}>
                        No Service Level Objectives configured. Define SLOs in Settings to track uptime and latency
                        targets.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {/* SLO selector row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 22 }}>
                {MOCK_SLOs.map((s, i) => {
                    const bc = s.burnRate6h > 3 ? THEME.danger : s.burnRate6h > 1.5 ? THEME.warning : THEME.success;
                    return (
                        <div
                            key={i}
                            onClick={() => setSelectedSlo(i)}
                            style={{
                                padding: '22px 28px',
                                borderRadius: 18,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: selectedSlo === i ? `${bc}0a` : THEME.surface,
                                border: `1px solid ${selectedSlo === i ? `${bc}30` : `${THEME.grid}45`}`,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 10,
                                    color: THEME.textDim,
                                    fontWeight: 600,
                                    marginBottom: 6,
                                    lineHeight: 1.3,
                                }}
                            >
                                {s.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                                <span style={{ fontSize: 16, fontWeight: 800, color: bc, fontFamily: THEME.fontMono }}>
                                    {s.current.toFixed(2)}%
                                </span>
                            </div>
                            <div
                                style={{
                                    height: 3,
                                    borderRadius: 2,
                                    background: `${THEME.grid}40`,
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{
                                        width: `${s.budgetRemaining}%`,
                                        height: '100%',
                                        background: bc,
                                        borderRadius: 2,
                                        transition: 'width 0.5s ease',
                                    }}
                                />
                            </div>
                            <div style={{ fontSize: 9, color: THEME.textDim, marginTop: 4 }}>
                                Budget: {s.budgetRemaining}% left
                            </div>
                            {s.alert && (
                                <div style={{ marginTop: 4 }}>
                                    <StatusBadge label="Burning fast" color={THEME.danger} pulse />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Burn-rate detail */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
                <Panel title={`Error Budget — ${slo.name}`} icon={Gauge} accent={burnColor}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ display: 'flex', align: 'center', gap: 22 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span style={{ fontSize: 11, color: THEME.textDim }}>Budget Consumed</span>
                                    <span
                                        style={{
                                            fontSize: 11,
                                            fontWeight: 800,
                                            color: burnColor,
                                            fontFamily: THEME.fontMono,
                                        }}
                                    >
                                        {100 - slo.budgetRemaining}%
                                    </span>
                                </div>
                                <div
                                    style={{
                                        height: 8,
                                        borderRadius: 20,
                                        background: `${THEME.grid}40`,
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div
                                        className={slo.alert ? 'rel-burn-critical' : ''}
                                        style={{
                                            width: `${100 - slo.budgetRemaining}%`,
                                            height: '100%',
                                            borderRadius: 20,
                                            background: `linear-gradient(90deg, ${burnColor}, ${burnColor}cc)`,
                                            transition: 'width 0.6s ease',
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                        {[
                            { label: '1h burn rate', value: slo.burnRate1h, warn: 2 },
                            { label: '6h burn rate', value: slo.burnRate6h, warn: 1.5 },
                        ].map((r, i) => {
                            const rc =
                                r.value > r.warn * 2 ? THEME.danger : r.value > r.warn ? THEME.warning : THEME.success;
                            return (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '9px 12px',
                                        borderRadius: 20,
                                        background: THEME.surface,
                                        border: `1px solid ${THEME.grid}40`,
                                    }}
                                >
                                    <span style={{ fontSize: 11, color: THEME.textMuted }}>{r.label}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                        <span
                                            style={{
                                                fontSize: 14,
                                                fontWeight: 800,
                                                color: rc,
                                                fontFamily: THEME.fontMono,
                                            }}
                                        >
                                            {r.value}×
                                        </span>
                                        <StatusBadge
                                            label={
                                                r.value > r.warn * 2
                                                    ? 'Critical'
                                                    : r.value > r.warn
                                                      ? 'Elevated'
                                                      : 'Normal'
                                            }
                                            color={rc}
                                            pulse={r.value > r.warn * 2}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                        <div
                            style={{
                                padding: '20px 24px',
                                borderRadius: 20,
                                background: `${burnColor}06`,
                                border: `1px solid ${burnColor}15`,
                                fontSize: 11,
                                color: THEME.textMuted,
                                lineHeight: 1.5,
                            }}
                        >
                            {slo.alert
                                ? `⚠ At current burn rate, error budget will be exhausted in ${Math.round((slo.budgetRemaining / slo.burnRate6h) * 10)}h.`
                                : `✓ Error budget on track. ${slo.budgetRemaining}% remaining for the window.`}
                        </div>
                    </div>
                </Panel>

                <Panel title="30-Day Budget Consumption" icon={BarChart3} accent={burnColor}>
                    <div style={{ height: 180 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={burnData} margin={{ top: 8, right: 4, bottom: 0, left: -14 }}>
                                <defs>
                                    <linearGradient id="burnGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={burnColor} stopOpacity={0.4} />
                                        <stop offset="100%" stopColor={burnColor} stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke={`${THEME.grid}35`} strokeDasharray="3 3" vertical={false} />
                                <XAxis
                                    dataKey="day"
                                    tick={{ fontSize: 8, fill: THEME.textDim }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval={6}
                                />
                                <YAxis
                                    tick={{ fontSize: 8, fill: THEME.textDim }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={28}
                                    domain={[0, 100]}
                                    unit="%"
                                />
                                <ReferenceLine y={80} stroke={`${THEME.danger}45`} strokeDasharray="4 4" />
                                <Tooltip content={<ChartTooltip unit="%" />} />
                                <Area
                                    type="monotone"
                                    dataKey="consumed"
                                    name="Consumed"
                                    stroke={burnColor}
                                    strokeWidth={2}
                                    fill="url(#burnGrad)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            gap: 20,
                            fontSize: 10,
                            color: THEME.textDim,
                            alignItems: 'center',
                            marginTop: 4,
                        }}
                    >
                        <span
                            style={{
                                width: 20,
                                borderTop: '1px dashed',
                                borderColor: `${THEME.danger}45`,
                                display: 'inline-block',
                            }}
                        />
                        <span>80% budget threshold</span>
                    </div>
                </Panel>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   CHANGE FREEZE WINDOWS
   ═══════════════════════════════════════════════════════════════════════════ */
const ChangeFreezePanel = () => {
    const [showAdd, setShowAdd] = useState(false);

    if (MOCK_FREEZE_WINDOWS.length === 0 && !showAdd) {
        return (
            <Panel
                title="Change Freeze Windows"
                icon={Snowflake}
                accent={THEME.info}
                rightNode={
                    <button
                        onClick={() => setShowAdd(!showAdd)}
                        style={{
                            padding: '4px 10px',
                            borderRadius: 18,
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 10,
                            fontWeight: 700,
                            background: `${THEME.primary}15`,
                            color: THEME.primary,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                        }}
                    >
                        + Add Window
                    </button>
                }
            >
                <div
                    style={{
                        padding: '32px 24px',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 20,
                    }}
                >
                    <Snowflake size={28} color={THEME.textDim} />
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textMain, marginBottom: 4 }}>
                            No freeze windows scheduled
                        </div>
                        <div style={{ fontSize: 11, color: THEME.textDim }}>
                            Configure freeze windows for maintenance periods.
                        </div>
                    </div>
                </div>
            </Panel>
        );
    }

    return (
        <Panel
            title="Change Freeze Windows"
            icon={Snowflake}
            accent={THEME.info}
            rightNode={
                <button
                    onClick={() => setShowAdd(!showAdd)}
                    style={{
                        padding: '4px 10px',
                        borderRadius: 18,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 10,
                        fontWeight: 700,
                        background: `${THEME.primary}15`,
                        color: THEME.primary,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                    }}
                >
                    + Add Window
                </button>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {MOCK_FREEZE_WINDOWS.map((fw) => (
                    <div
                        key={fw.id}
                        style={{
                            padding: '22px 28px',
                            borderRadius: 16,
                            background: fw.active ? `${fw.color}08` : THEME.surface,
                            border: `1px solid ${fw.active ? `${fw.color}28` : `${THEME.grid}40`}`,
                            transition: 'all 0.2s',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                marginBottom: 6,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                <Snowflake size={12} color={fw.color} style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: 12, fontWeight: 700, color: THEME.textMain }}>{fw.label}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                {fw.active && <StatusBadge label="ACTIVE NOW" color={fw.color} pulse />}
                                {!fw.active && <StatusBadge label="Scheduled" color={THEME.textDim} />}
                            </div>
                        </div>
                        <div className="mono" style={{ fontSize: 10, color: THEME.textDim, marginBottom: 6 }}>
                            {new Date(fw.start).toLocaleString()} → {new Date(fw.end).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 11, color: THEME.textMuted, lineHeight: 1.5 }}>{fw.reason}</div>
                    </div>
                ))}
                {showAdd && (
                    <div
                        className="rel-frost"
                        style={{
                            padding: '22px 28px',
                            borderRadius: 16,
                            background: `${THEME.primary}06`,
                            border: `1px dashed ${THEME.primary}30`,
                        }}
                    >
                        <div style={{ fontSize: 11, color: THEME.textDim, textAlign: 'center', padding: '8px 0' }}>
                            Connect to your change management system to create freeze windows programmatically.
                        </div>
                    </div>
                )}
            </div>
        </Panel>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
const ReliabilityTab = () => {
    useAdaptiveTheme(); // keeps THEME in sync with dark/light toggle
    const [alerts, setAlerts] = useState([]);
    const [uptimeDays, setUptimeDays] = useState(() => genUptimeDays());
    const [alertTrend, setAlertTrend] = useState(() => genAlertTrend());
    const [incidents, setIncidents] = useState(MOCK_INCIDENTS);
    const [mttrData] = useState(() => genMttrTrend());
    const [fatigueData] = useState(() => genAlertFatigue());
    const [burnData] = useState(() => genSloBurnRate());

    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState(null);
    const [refreshInterval, setRefreshInterval] = useState(30);
    const [refreshError, setRefreshError] = useState(false);
    const [newAlertIds, setNewAlertIds] = useState(new Set());
    const [refreshingPanels, setRefreshingPanels] = useState(new Set());

    const [activeTab, setActiveTab] = useState('alerts');
    const [alertView, setAlertView] = useState('feed'); // 'feed' | 'grouped'
    const [filter, setFilter] = useState('all');
    const [showAcked, setShowAcked] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [sortBy, setSortBy] = useState('time');

    const intervalRef = useRef(null);
    const prevAlertIdsRef = useRef(new Set());

    const fetchAll = useCallback(async (isInitial = false) => {
        if (!isInitial) setIsRefreshing(true);
        setRefreshingPanels(new Set(['alerts', 'trend', 'uptime', 'incidents']));
        setRefreshError(false);
        try {
            // Fetch alerts, statistics and incidents in parallel
            const [alertsData, statsData, incidentsData] = await Promise.all([
                fetchData('/api/alerts?limit=50').catch(() => null),
                fetchData('/api/alerts/statistics?timeRange=24h').catch(() => null),
                fetchData('/api/incidents?phase=all&limit=100').catch(() => null),
            ]);

            // ── Incidents ────────────────────────────────────────────────
            // This tab used to keep its own incident list that nothing ever
            // filled, so the Incidents view read 0 while pgmonitoringtool.incidents
            // had rows. There is one incident concept now — the one with
            // numbers, owners and SLAs — and this renders it.
            const incidentRows = Array.isArray(incidentsData)
                ? incidentsData
                : (incidentsData?.incidents ?? null);
            if (Array.isArray(incidentRows)) {
                setIncidents(incidentRows.map((r) => ({
                    id: r.id,
                    // The timeline colours by alert severity, not by the
                    // four-level triage priority; map rather than show grey.
                    severity: r.severity ?? (r.priority === 'critical' || r.priority === 'high' ? 'critical' : 'warning'),
                    title: r.title,
                    rca_tag: r.category,
                    // Open incidents have no end yet — measure to now, so the
                    // duration counts up instead of reading "0m".
                    duration: formatSpan(r.detected_at, r.resolved_at),
                    impact: [r.database_name, r.schema_name, r.object_name].filter(Boolean).join('.') || '—',
                    root_cause: r.ai_analysis || r.fix_suggestion || r.description || 'Under investigation',
                    started: r.detected_at,
                    resolved: r.resolved_at,
                    runbook: null,
                })));
            }

            // Update alerts from real API
            // /api/alerts returns a bare array; this read `.alerts` off it and
            // silently kept the fallback data. Accept both shapes.
            const alertRows = Array.isArray(alertsData) ? alertsData : (alertsData?.alerts ?? null);
            if (Array.isArray(alertRows)) {
                const incoming = alertRows;
                // Detect new alert IDs for flash animation
                const currentIds = new Set(incoming.map((a) => String(a.id)));
                const newIds = new Set([...currentIds].filter((id) => !prevAlertIdsRef.current.has(id)));
                if (newIds.size > 0) setNewAlertIds(newIds);
                prevAlertIdsRef.current = currentIds;
                setAlerts(incoming);
            }

            // Build alert trend from statistics hourly breakdown if available
            if (statsData?.hourlyBreakdown) {
                setAlertTrend(statsData.hourlyBreakdown);
            } else if (statsData) {
                // Re-generate trend using real counts as rough guide
                setAlertTrend(genAlertTrend());
            }
        } catch (e) {
            setRefreshError(true);
            // Fall back to mock data so UI is never blank
            if (isInitial && alerts.length === 0) {
                setAlerts(MOCK_ALERTS);
                setAlertTrend(genAlertTrend());
            }
        } finally {
            setRefreshingPanels(new Set());
            setLastRefreshed(Date.now());
            setIsRefreshing(false);
            if (isInitial) setLoading(false);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        fetchAll(true);
    }, [fetchAll]);

    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (refreshInterval > 0) intervalRef.current = setInterval(() => fetchAll(false), refreshInterval * 1000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [refreshInterval, fetchAll]);

    useGlobalRefresh(React.useCallback(() => fetchAll(false), [fetchAll]));

    const handleAcknowledge = useCallback(async (id) => {
        // Optimistic update
        setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
        // Persist to backend
        try {
            await postData(`/api/alerts/${id}/acknowledge`, {});
        } catch {
            /* revert on error */ setAlerts((prev) =>
                prev.map((a) => (a.id === id ? { ...a, acknowledged: false } : a)),
            );
        }
    }, []);
    const handleAcknowledgeAll = useCallback(async () => {
        const unackedIds = alerts.filter((a) => !a.acknowledged).map((a) => a.id);
        if (unackedIds.length === 0) return;
        // Optimistic update
        setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })));
        // Persist to backend
        try {
            await postData('/api/alerts/bulk-acknowledge', { alertIds: unackedIds });
        } catch {
            /* refresh to restore correct state */ fetchAll(false);
        }
    }, [alerts, fetchAll]);

    const processedAlerts = useMemo(() => {
        let list = [...alerts];
        if (filter !== 'all') list = list.filter((a) => a.severity === filter);
        if (!showAcked) list = list.filter((a) => !a.acknowledged);
        if (sortBy === 'severity') {
            const order = { critical: 0, warning: 1, info: 2 };
            list.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
        } else list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return list;
    }, [alerts, filter, showAcked, sortBy]);

    const counts = useMemo(
        () => ({
            total: alerts.length,
            critical: alerts.filter((a) => a.severity === 'critical' && !a.acknowledged).length,
            warning: alerts.filter((a) => a.severity === 'warning' && !a.acknowledged).length,
            info: alerts.filter((a) => a.severity === 'info' && !a.acknowledged).length,
            active: alerts.filter((a) => !a.acknowledged).length,
            acknowledged: alerts.filter((a) => a.acknowledged).length,
        }),
        [alerts],
    );

    const uptimeStats = useMemo(
        () => ({
            avg: uptimeDays.length === 0 ? 0 : uptimeDays.reduce((s, d) => s + d.uptime, 0) / uptimeDays.length,
            outages: uptimeDays.filter((d) => d.status === 'outage').length,
            degraded: uptimeDays.filter((d) => d.status === 'degraded').length,
        }),
        [uptimeDays],
    );

    const TabBtn = ({ id, label, icon: Icon, count }) => {
        const active = activeTab === id;
        return (
            <button
                className="rel-tab-btn"
                onClick={() => setActiveTab(id)}
                style={{
                    padding: '9px 18px',
                    borderRadius: 20,
                    cursor: 'pointer',
                    border: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    fontWeight: 700,
                    fontSize: 12,
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    background: active
                        ? `linear-gradient(135deg, ${THEME.primary}, ${THEME.secondary})`
                        : THEME.surface,
                    color: active ? '#fff' : THEME.textMuted,
                    boxShadow: active ? `0 4px 16px ${THEME.primary}30` : 'none',
                    outline: active ? 'none' : `1px solid ${THEME.grid}60`,
                }}
            >
                <Icon size={13} />
                {label}
                {count != null && count > 0 && (
                    <span
                        style={{
                            fontSize: 9,
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 16,
                            background: active ? 'rgba(255,255,255,0.2)' : `${THEME.danger}20`,
                            color: active ? '#fff' : THEME.danger,
                        }}
                    >
                        {count}
                    </span>
                )}
            </button>
        );
    };

    const FilterPill = ({ id, label, color, count }) => {
        const active = filter === id;
        return (
            <button
                onClick={() => setFilter(id)}
                style={{
                    padding: '5px 12px',
                    borderRadius: 18,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                    transition: 'all 0.15s',
                    background: active ? `${color}18` : 'transparent',
                    color: active ? color : THEME.textDim,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                }}
            >
                {label}
                {count > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 800, fontFamily: THEME.fontMono, opacity: 0.8 }}>
                        {count}
                    </span>
                )}
            </button>
        );
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>
                <RelStyles />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 18 }}>
                    {[0, 1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            style={{
                                height: 96,
                                borderRadius: 16,
                                background: THEME.surface,
                                border: `1px solid ${THEME.glassBorder}`,
                                opacity: 0.4,
                                animation: 'relPulse 1.5s ease-in-out infinite',
                                animationDelay: `${i * 0.12}s`,
                            }}
                        />
                    ))}
                </div>
            </div>
        );
    }

    const metricCards = [
        {
            label: 'Active Alerts',
            value: String(counts.active),
            sub: `${counts.total} total`,
            color: counts.critical > 0 ? THEME.danger : THEME.success,
            icon: counts.critical > 0 ? BellRing : CheckCircle,
        },
        {
            label: 'Critical',
            value: String(counts.critical),
            sub: counts.critical > 0 ? 'Immediate attention' : 'All clear',
            color: counts.critical > 0 ? THEME.danger : THEME.success,
            icon: Flame,
        },
        {
            label: 'Uptime (90d)',
            value: `${uptimeStats.avg.toFixed(2)}%`,
            sub: `${uptimeStats.outages} outages`,
            color: uptimeStats.avg > 99.9 ? THEME.success : uptimeStats.avg > 99 ? THEME.warning : THEME.danger,
            icon: Shield,
        },
        { label: 'MTTR', value: '16m', sub: 'avg resolution', color: THEME.primary, icon: Timer },
        {
            label: 'Noise Ratio',
            value:
                alerts.length === 0
                    ? '0%'
                    : `${Math.round((alerts.filter((a) => a.autoResolved).length / alerts.length) * 100)}%`,
            sub: 'auto-resolved',
            color: THEME.info,
            icon: Activity,
        },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 40 }}>
            <RelStyles />

            {/* Tab row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 20 }}>
                    <TabBtn id="alerts" label="Alert Feed" icon={Bell} count={counts.active} />
                    <TabBtn id="uptime" label="Uptime & SLA" icon={Shield} />
                    <TabBtn
                        id="slo"
                        label="SLO Burn Rate"
                        icon={Gauge}
                        count={MOCK_SLOs.filter((s) => s.alert).length}
                    />
                    <TabBtn id="incidents" label="Incidents" icon={History} count={incidents.length} />
                    <TabBtn id="ops" label="Ops Center" icon={Settings} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 11, color: THEME.textDim }}>
                    <LiveDot color={counts.critical > 0 ? THEME.danger : THEME.success} size={6} />
                    <span>{counts.critical > 0 ? `${counts.critical} critical` : 'All clear'}</span>
                </div>
            </div>

            {/* Metric strip */}
            <div className="rel-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 18 }}>
                {metricCards.map((m, i) => (
                    <div key={i} className={`rel-card ${isRefreshing ? 'rel-metric-flash' : ''}`}>
                        <div className="rel-card-metric">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '6px 0' }}>
                                <div
                                    style={{
                                        width: 42,
                                        height: 42,
                                        borderRadius: 18,
                                        flexShrink: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: `${m.color}12`,
                                        border: `1px solid ${m.color}20`,
                                    }}
                                >
                                    <m.icon size={18} color={m.color} />
                                </div>
                                <div>
                                    <div
                                        style={{
                                            fontSize: 9,
                                            color: THEME.textDim,
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.04em',
                                            lineHeight: 1,
                                            marginBottom: 5,
                                        }}
                                    >
                                        {m.label}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 22,
                                            fontWeight: 800,
                                            color: m.color,
                                            fontFamily: THEME.fontMono,
                                            lineHeight: 1,
                                        }}
                                    >
                                        {m.value}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="rel-card-footer">
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>{m.sub}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ══════════════════ ALERTS ══════════════════ */}
            {activeTab === 'alerts' && (
                <div
                    className="rel-stagger"
                    style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 18, alignItems: 'start' }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        {/* Toolbar */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <FilterPill id="all" label="All" color={THEME.primary} count={counts.total} />
                                <FilterPill
                                    id="critical"
                                    label="Critical"
                                    color={THEME.danger}
                                    count={counts.critical}
                                />
                                <FilterPill id="warning" label="Warning" color={THEME.warning} count={counts.warning} />
                                <FilterPill id="info" label="Info" color={THEME.info} count={counts.info} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {/* View toggle */}
                                <div
                                    style={{
                                        display: 'flex',
                                        background: THEME.surface,
                                        borderRadius: 18,
                                        overflow: 'hidden',
                                        border: `1px solid ${THEME.grid}50`,
                                    }}
                                >
                                    {[
                                        { id: 'feed', icon: Bell, label: 'Feed' },
                                        { id: 'grouped', icon: LayoutGrid, label: 'Grouped' },
                                    ].map((v) => (
                                        <button
                                            key={v.id}
                                            onClick={() => setAlertView(v.id)}
                                            style={{
                                                padding: '4px 10px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontSize: 10,
                                                fontWeight: 700,
                                                background: alertView === v.id ? `${THEME.primary}20` : 'transparent',
                                                color: alertView === v.id ? THEME.primary : THEME.textDim,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            <v.icon size={10} />
                                            {v.label}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setShowAcked(!showAcked)}
                                    style={{
                                        padding: '4px 10px',
                                        borderRadius: 16,
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: 10,
                                        fontWeight: 600,
                                        background: showAcked ? `${THEME.textDim}15` : 'transparent',
                                        color: THEME.textDim,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                    }}
                                >
                                    {showAcked ? <Eye size={10} /> : <EyeOff size={10} />}Ack'd
                                </button>
                                <button
                                    onClick={() => setSortBy((s) => (s === 'time' ? 'severity' : 'time'))}
                                    style={{
                                        padding: '4px 10px',
                                        borderRadius: 16,
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: 10,
                                        fontWeight: 600,
                                        color: THEME.textDim,
                                        background: `${THEME.textDim}10`,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                    }}
                                >
                                    <ArrowDown size={10} />
                                    {sortBy === 'time' ? 'Time' : 'Severity'}
                                </button>
                                {counts.active > 0 && (
                                    <button
                                        onClick={handleAcknowledgeAll}
                                        style={{
                                            padding: '4px 10px',
                                            borderRadius: 16,
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: 10,
                                            fontWeight: 700,
                                            color: THEME.success,
                                            background: `${THEME.success}10`,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 4,
                                        }}
                                    >
                                        <CheckCheck size={10} />
                                        Ack All
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Feed or grouped */}
                        <div className="rel-scrollbar" style={{ maxHeight: 640, overflowY: 'auto', paddingRight: 2 }}>
                            {alertView === 'grouped' ? (
                                <AlertGroupView alerts={processedAlerts} />
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {processedAlerts.length === 0 ? (
                                        <div
                                            style={{
                                                padding: '60px 20px',
                                                textAlign: 'center',
                                                color: THEME.textDim,
                                                fontSize: 12,
                                            }}
                                        >
                                            No alerts match your filters.
                                        </div>
                                    ) : (
                                        processedAlerts.map((alert) => (
                                            <AlertCard
                                                key={alert.id}
                                                alert={alert}
                                                onAcknowledge={handleAcknowledge}
                                                expanded={expandedId === alert.id}
                                                onToggle={() =>
                                                    setExpandedId(expandedId === alert.id ? null : alert.id)
                                                }
                                                isNew={newAlertIds.has(alert.id)}
                                            />
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right sidebar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                        {/* Alert trend */}
                        <Panel
                            title="Alert Trend (24h)"
                            icon={BarChart3}
                            refreshing={refreshingPanels.has('trend')}
                            rightNode={
                                <div style={{ display: 'flex', gap: 22, fontSize: 10, color: THEME.textDim }}>
                                    {[
                                        { l: 'Critical', c: THEME.danger },
                                        { l: 'Warning', c: THEME.warning },
                                        { l: 'Info', c: THEME.info },
                                    ].map((x) => (
                                        <span
                                            key={x.l}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                        >
                                            <span style={{ width: 8, height: 3, borderRadius: 1, background: x.c }} />
                                            {x.l}
                                        </span>
                                    ))}
                                </div>
                            }
                        >
                            <div style={{ height: 150 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={alertTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                                        <defs>
                                            <linearGradient id="relGC" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={THEME.danger} stopOpacity={0.3} />
                                                <stop offset="100%" stopColor={THEME.danger} stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="relGW" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={THEME.warning} stopOpacity={0.2} />
                                                <stop offset="100%" stopColor={THEME.warning} stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="relGI" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={THEME.info} stopOpacity={0.15} />
                                                <stop offset="100%" stopColor={THEME.info} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid
                                            stroke={`${THEME.grid}35`}
                                            strokeDasharray="3 3"
                                            vertical={false}
                                        />
                                        <XAxis
                                            dataKey="h"
                                            tick={{ fontSize: 8, fill: THEME.textDim }}
                                            axisLine={false}
                                            tickLine={false}
                                            interval={4}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 8, fill: THEME.textDim }}
                                            axisLine={false}
                                            tickLine={false}
                                            width={24}
                                        />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Area
                                            type="monotone"
                                            dataKey="critical"
                                            name="Critical"
                                            stroke={THEME.danger}
                                            strokeWidth={1.5}
                                            fill="url(#relGC)"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="warning"
                                            name="Warning"
                                            stroke={THEME.warning}
                                            strokeWidth={1.5}
                                            fill="url(#relGW)"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="info"
                                            name="Info"
                                            stroke={THEME.info}
                                            strokeWidth={1}
                                            fill="url(#relGI)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Panel>

                        {/* Severity distribution */}
                        <Panel
                            title="Severity Distribution"
                            icon={BarChart3}
                            refreshing={refreshingPanels.has('severity')}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                {[
                                    {
                                        label: 'Critical',
                                        count: alerts.filter((a) => a.severity === 'critical').length,
                                        active: counts.critical,
                                        color: THEME.danger,
                                    },
                                    {
                                        label: 'Warning',
                                        count: alerts.filter((a) => a.severity === 'warning').length,
                                        active: counts.warning,
                                        color: THEME.warning,
                                    },
                                    {
                                        label: 'Info',
                                        count: alerts.filter((a) => a.severity === 'info').length,
                                        active: counts.info,
                                        color: THEME.info,
                                    },
                                ].map((s, i) => {
                                    const maxC = Math.max(
                                        alerts.filter((a) => a.severity === 'critical').length,
                                        alerts.filter((a) => a.severity === 'warning').length,
                                        alerts.filter((a) => a.severity === 'info').length,
                                        1,
                                    );
                                    return (
                                        <div key={i}>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    marginBottom: 5,
                                                }}
                                            >
                                                <span style={{ fontSize: 11, fontWeight: 700, color: THEME.textMuted }}>
                                                    {s.label}
                                                </span>
                                                <div style={{ display: 'flex', gap: 20, fontSize: 10 }}>
                                                    <span
                                                        style={{
                                                            color: s.color,
                                                            fontWeight: 800,
                                                            fontFamily: THEME.fontMono,
                                                        }}
                                                    >
                                                        {s.active} active
                                                    </span>
                                                    <span style={{ color: THEME.textDim }}>{s.count} total</span>
                                                </div>
                                            </div>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    gap: 2,
                                                    height: 5,
                                                    borderRadius: 16,
                                                    overflow: 'hidden',
                                                    background: `${THEME.grid}40`,
                                                }}
                                            >
                                                <div
                                                    className="rel-bar-animate"
                                                    style={{
                                                        width: `${(s.active / maxC) * 100}%`,
                                                        background: s.color,
                                                        borderRadius: 16,
                                                        animationDelay: `${i * 0.1}s`,
                                                    }}
                                                />
                                                <div
                                                    className="rel-bar-animate"
                                                    style={{
                                                        width: `${((s.count - s.active) / maxC) * 100}%`,
                                                        background: `${s.color}28`,
                                                        borderRadius: 16,
                                                        animationDelay: `${i * 0.1 + 0.1}s`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Panel>

                        {/* Response targets */}
                        <Panel title="Response Targets" icon={Timer}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                {[
                                    { sev: 'Critical', target: '5m', actual: '3m', met: true, color: THEME.danger },
                                    { sev: 'Warning', target: '30m', actual: '22m', met: true, color: THEME.warning },
                                    { sev: 'Info', target: '4h', actual: '1.5h', met: true, color: THEME.info },
                                ].map((r, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '9px 12px',
                                            borderRadius: 20,
                                            background: THEME.surface,
                                            border: `1px solid ${THEME.grid}40`,
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                            <span
                                                style={{
                                                    width: 5,
                                                    height: 5,
                                                    borderRadius: '50%',
                                                    background: r.color,
                                                    flexShrink: 0,
                                                }}
                                            />
                                            <span style={{ fontSize: 11, fontWeight: 700, color: THEME.textMain }}>
                                                {r.sev}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 22, fontSize: 11 }}>
                                            <span style={{ color: THEME.textDim }}>
                                                target:{' '}
                                                <strong style={{ color: THEME.textMuted, fontFamily: THEME.fontMono }}>
                                                    {r.target}
                                                </strong>
                                            </span>
                                            <span style={{ color: THEME.textDim }}>
                                                actual:{' '}
                                                <strong
                                                    style={{
                                                        color: r.met ? THEME.success : THEME.danger,
                                                        fontFamily: THEME.fontMono,
                                                    }}
                                                >
                                                    {r.actual}
                                                </strong>
                                            </span>
                                            {r.met ? (
                                                <CheckCircle size={11} color={THEME.success} />
                                            ) : (
                                                <XCircle size={11} color={THEME.danger} />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Panel>
                    </div>
                </div>
            )}

            {/* ══════════════════ UPTIME ══════════════════ */}
            {activeTab === 'uptime' && (
                <div className="rel-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
                        {[
                            {
                                label: '30-Day Uptime',
                                value: `${(uptimeDays.slice(-30).reduce((s, d) => s + d.uptime, 0) / 30).toFixed(3)}%`,
                                target: '99.95%',
                                icon: Shield,
                                color: THEME.success,
                            },
                            {
                                label: '90-Day Uptime',
                                value: `${uptimeStats.avg.toFixed(3)}%`,
                                target: '99.90%',
                                icon: ShieldCheck,
                                color: THEME.primary,
                            },
                            {
                                label: 'Error Budget',
                                value: '63%',
                                target: 'remaining this month',
                                icon: Gauge,
                                color: THEME.warning,
                            },
                        ].map((s, i) => (
                            <Panel key={i} refreshing={refreshingPanels.has('sla')}>
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 20,
                                        padding: '10px 0',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: 13,
                                            background: `${s.color}10`,
                                            border: `1px solid ${s.color}18`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <s.icon size={20} color={s.color} />
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 9,
                                            color: THEME.textDim,
                                            fontWeight: 700,
                                            letterSpacing: '0.02em',
                                        }}
                                    >
                                        {s.label}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 26,
                                            fontWeight: 800,
                                            color: s.color,
                                            fontFamily: THEME.fontMono,
                                            lineHeight: 1,
                                        }}
                                    >
                                        {s.value}
                                    </div>
                                    <div style={{ fontSize: 10, color: THEME.textDim }}>target: {s.target}</div>
                                </div>
                            </Panel>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18 }}>
                        <Panel
                            title="90-Day Uptime Heatmap"
                            icon={Calendar}
                            refreshing={refreshingPanels.has('uptime')}
                        >
                            <UptimeHeatmap days={uptimeDays} />
                        </Panel>
                        <Panel title="Downtime Events" icon={XCircle} noPad refreshing={refreshingPanels.has('uptime')}>
                            {(() => {
                                const downtimeDays = uptimeDays.filter((d) => d.status !== 'up');
                                if (!downtimeDays.length)
                                    return (
                                        <div style={{ padding: 40, textAlign: 'center' }}>
                                            <CheckCircle
                                                size={26}
                                                color={THEME.success}
                                                style={{ opacity: 0.5, marginBottom: 8 }}
                                            />
                                            <div style={{ fontSize: 12, color: THEME.textMuted }}>
                                                No downtime recorded
                                            </div>
                                        </div>
                                    );
                                return (
                                    <div className="rel-scrollbar" style={{ maxHeight: 280, overflowY: 'auto' }}>
                                        {downtimeDays.map((d, i) => {
                                            const c = d.status === 'outage' ? THEME.danger : THEME.warning;
                                            return (
                                                <div
                                                    key={i}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 18,
                                                        padding: '11px 18px',
                                                        borderBottom: `1px solid ${THEME.grid}22`,
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            width: 6,
                                                            height: 6,
                                                            borderRadius: '50%',
                                                            background: c,
                                                            flexShrink: 0,
                                                        }}
                                                    />
                                                    <span
                                                        className="mono"
                                                        style={{
                                                            fontSize: 10,
                                                            color: THEME.textDim,
                                                            width: 70,
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        {d.date}
                                                    </span>
                                                    <StatusBadge
                                                        label={d.status === 'outage' ? 'Outage' : 'Degraded'}
                                                        color={c}
                                                    />
                                                    <span
                                                        style={{
                                                            fontWeight: 800,
                                                            color: THEME.textMain,
                                                            fontFamily: THEME.fontMono,
                                                            marginLeft: 'auto',
                                                            fontSize: 12,
                                                        }}
                                                    >
                                                        {d.uptime.toFixed(2)}%
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </Panel>
                    </div>
                </div>
            )}

            {/* ══════════════════ SLO BURN RATE ══════════════════ */}
            {activeTab === 'slo' && (
                <div className="rel-stagger">
                    <SloBurnRatePanel burnData={burnData} />
                </div>
            )}

            {/* ══════════════════ INCIDENTS ══════════════════ */}
            {activeTab === 'incidents' && (
                <div className="rel-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Summary strip */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: 0,
                            borderRadius: 18,
                            background: THEME.surface,
                            overflow: 'hidden',
                            border: `1px solid ${THEME.glassBorder}`,
                        }}
                    >
                        {[
                            {
                                label: 'Total Incidents',
                                value: String(incidents.length),
                                color: THEME.primary,
                                icon: AlertCircle,
                            },
                            {
                                label: 'Critical',
                                value: String(incidents.filter((i) => i.severity === 'critical').length),
                                color: THEME.danger,
                                icon: Flame,
                            },
                            { label: 'Avg Duration', value: '16.8m', color: THEME.warning, icon: Timer },
                            {
                                label: 'Resolved',
                                value: String(incidents.length),
                                color: THEME.success,
                                icon: CheckCircle,
                            },
                        ].map((s, i) => (
                            <div
                                key={i}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 22,
                                    padding: '13px 18px',
                                    borderRight: i < 3 ? `1px solid ${THEME.glassBorder}` : 'none',
                                }}
                            >
                                <div
                                    style={{
                                        width: 26,
                                        height: 26,
                                        borderRadius: 20,
                                        flexShrink: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: `${s.color}10`,
                                    }}
                                >
                                    <s.icon size={12} color={s.color} />
                                </div>
                                <div>
                                    <div
                                        style={{
                                            fontSize: 9,
                                            color: THEME.textDim,
                                            fontWeight: 700,
                                            letterSpacing: '0.02em',
                                            marginBottom: 2,
                                        }}
                                    >
                                        {s.label}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 14,
                                            fontWeight: 800,
                                            color: s.color,
                                            fontFamily: THEME.fontMono,
                                        }}
                                    >
                                        {s.value}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Timeline */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {incidents.map((inc, i) => {
                            const sev = getSev(inc.severity);
                            const rcaTag = RCA_TAGS.find((t) => t.tag === inc.rca_tag);
                            return (
                                <div key={inc.id} style={{ display: 'flex', gap: 20, position: 'relative' }}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            width: 18,
                                            flexShrink: 0,
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 12,
                                                height: 12,
                                                borderRadius: '50%',
                                                background: sev.color,
                                                border: `2px solid ${THEME.bg}`,
                                                flexShrink: 0,
                                                zIndex: 1,
                                            }}
                                        />
                                        {i < incidents.length - 1 && (
                                            <div
                                                style={{
                                                    width: 2,
                                                    flex: 1,
                                                    background: `${THEME.grid}60`,
                                                    minHeight: 20,
                                                }}
                                            />
                                        )}
                                    </div>
                                    <div
                                        style={{
                                            flex: 1,
                                            marginBottom: 14,
                                            padding: '20px 24px',
                                            borderRadius: 18,
                                            background: THEME.surface,
                                            border: `1px solid ${THEME.glassBorder}`,
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                justifyContent: 'space-between',
                                                marginBottom: 10,
                                            }}
                                        >
                                            <div>
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 20,
                                                        marginBottom: 6,
                                                        flexWrap: 'wrap',
                                                    }}
                                                >
                                                    <span
                                                        className="mono"
                                                        style={{
                                                            fontSize: 10,
                                                            fontWeight: 700,
                                                            color: THEME.textDim,
                                                            background: `${THEME.primary}08`,
                                                            padding: '2px 8px',
                                                            borderRadius: 20,
                                                            border: `1px solid ${THEME.primary}12`,
                                                        }}
                                                    >
                                                        {inc.id}
                                                    </span>
                                                    <StatusBadge label={sev.label} color={sev.color} />
                                                    <StatusBadge label="Resolved" color={THEME.success} />
                                                    {rcaTag && (
                                                        <span
                                                            style={{
                                                                fontSize: 9,
                                                                padding: '2px 8px',
                                                                borderRadius: 20,
                                                                background: `${rcaTag.color}10`,
                                                                color: rcaTag.color,
                                                                border: `1px solid ${rcaTag.color}20`,
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: 3,
                                                            }}
                                                        >
                                                            <Hash size={8} />
                                                            {inc.rca_tag}
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: THEME.textMain }}>
                                                    {inc.title}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <div
                                                    style={{
                                                        fontSize: 17,
                                                        fontWeight: 800,
                                                        color: THEME.warning,
                                                        fontFamily: THEME.fontMono,
                                                        lineHeight: 1,
                                                    }}
                                                >
                                                    {inc.duration}
                                                </div>
                                                <div style={{ fontSize: 9, color: THEME.textDim, marginTop: 2 }}>
                                                    duration
                                                </div>
                                            </div>
                                        </div>
                                        <div
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 1fr',
                                                gap: 20,
                                                marginBottom: 10,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    padding: '9px 12px',
                                                    borderRadius: 20,
                                                    background: `${sev.color}06`,
                                                    border: `1px solid ${sev.color}12`,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontSize: 8,
                                                        fontWeight: 700,
                                                        color: THEME.textDim,
                                                        letterSpacing: '0.02em',
                                                        marginBottom: 4,
                                                    }}
                                                >
                                                    Impact
                                                </div>
                                                <div style={{ fontSize: 11, color: THEME.textMuted, lineHeight: 1.5 }}>
                                                    {inc.impact}
                                                </div>
                                            </div>
                                            <div
                                                style={{
                                                    padding: '9px 12px',
                                                    borderRadius: 20,
                                                    background: THEME.surface,
                                                    border: `1px solid ${THEME.grid}40`,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontSize: 8,
                                                        fontWeight: 700,
                                                        color: THEME.textDim,
                                                        letterSpacing: '0.02em',
                                                        marginBottom: 4,
                                                    }}
                                                >
                                                    Root Cause
                                                </div>
                                                <div style={{ fontSize: 11, color: THEME.textMuted, lineHeight: 1.5 }}>
                                                    {inc.root_cause}
                                                </div>
                                            </div>
                                        </div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                flexWrap: 'wrap',
                                                gap: 20,
                                            }}
                                        >
                                            <div
                                                style={{ display: 'flex', gap: 20, fontSize: 10, color: THEME.textDim }}
                                            >
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                    <AlertTriangle size={9} color={sev.color} />
                                                    Started: {new Date(inc.started).toLocaleString()}
                                                </span>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                    <CheckCircle size={9} color={THEME.success} />
                                                    Resolved: {new Date(inc.resolved).toLocaleString()}
                                                </span>
                                            </div>
                                            {inc.runbook && (
                                                <a
                                                    href={inc.runbook}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="rel-link"
                                                    style={{
                                                        fontSize: 10,
                                                        color: THEME.info,
                                                        textDecoration: 'none',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 4,
                                                    }}
                                                >
                                                    <BookOpen size={10} />
                                                    View Runbook
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ══════════════════ OPS CENTER ══════════════════ */}
            {activeTab === 'ops' && (
                <div
                    className="rel-stagger"
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <OnCallWidget />
                        <AlertFatiguePanel data={fatigueData} />
                        <MttrTrendPanel data={mttrData} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <ChangeFreezePanel />
                        <NoiseReductionPanel alerts={alerts} />
                        <Panel title="Alert Runbook Coverage" icon={BookOpen} accent={THEME.success}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                {alerts.map((a) => {
                                    const sev = getSev(a.severity);
                                    return (
                                        <div
                                            key={a.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 22,
                                                padding: '8px 10px',
                                                borderRadius: 20,
                                                background: THEME.surface,
                                                border: `1px solid ${THEME.grid}35`,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    width: 5,
                                                    height: 5,
                                                    borderRadius: '50%',
                                                    background: sev.color,
                                                    flexShrink: 0,
                                                }}
                                            />
                                            <span
                                                style={{
                                                    flex: 1,
                                                    fontSize: 11,
                                                    color: THEME.textMuted,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {a.title}
                                            </span>
                                            {a.runbook ? (
                                                <a
                                                    href={a.runbook}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    style={{
                                                        fontSize: 9,
                                                        color: THEME.success,
                                                        textDecoration: 'none',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 3,
                                                        background: `${THEME.success}10`,
                                                        padding: '2px 7px',
                                                        borderRadius: 16,
                                                    }}
                                                >
                                                    <Link2 size={8} />
                                                    Runbook
                                                </a>
                                            ) : (
                                                <span
                                                    style={{
                                                        fontSize: 9,
                                                        color: THEME.danger,
                                                        background: `${THEME.danger}10`,
                                                        padding: '2px 7px',
                                                        borderRadius: 20,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 3,
                                                    }}
                                                >
                                                    <AlertOctagon size={8} />
                                                    Missing
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </Panel>
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(ReliabilityTab);
