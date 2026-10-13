import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { THEME, useAdaptiveTheme, useGlobalRefresh } from '../../../utils/theme';
import { fetchData } from '../../../utils/api';
import { useConnection } from '../../../context/ConnectionContext';
import { useNavigation } from '../../../context/NavigationContext';
import { fmtNum, fmtRelTime } from '../../../lib/utils';

// Dropped imports: GlassCard / LiveStatusBadge (never used in this file), plus
// ArrowUpRight, ArrowDownRight, TrendingDown, ShieldCheck, GitCommit,
// ToggleLeft, ToggleRight, Package, CheckSquare, Sparkles, FlaskConical,
// Terminal, Globe — all imported but never rendered. Kept everything that's
// actually referenced downstream.
import {
    Zap,
    Clock,
    Database,
    Activity,
    Server,
    HardDrive,
    TrendingUp,
    Shield,
    Cpu,
    Network,
    RefreshCw,
    Eye,
    BarChart3,
    Layers,
    Radio,
    Timer,
    CheckCircle,
    AlertTriangle,
    GitBranch,
    Gauge,
    Lock,
    Unlock,
    ArrowUp,
    ArrowDown,
    ChevronRight,
    MemoryStick,
    Bell,
    BellRing,
    ChevronDown,
    Play,
    Pause,
    HardDriveDownload,
    Leaf,
    Hourglass,
    AlertCircle,
    Info,
    X,
    Boxes,
} from 'lucide-react';

import {
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    LineChart,
    Line,
    ReferenceLine,
} from 'recharts';

import {
    PanelCard,
    KpiCard,
    RingGauge,
    StatusBadge,
    LiveDot,
    Divider,
    ChartTooltip,
    ProgressBar,
    StatStrip,
    MiniStat,
    TremorStyles,
} from '../../ui/tremor';

/* ═══════════════════════════════════════════════════════════════════════════
   MICRO-COMPONENTS (MiniSparkline stays inline since it's not extracted)
   ═══════════════════════════════════════════════════════════════════════════ */

const MiniSparkline = React.memo(({ data = [], color = THEME.primary, width = 64, height = 20, filled = true }) => {
    if (!data || data.length < 2) return <div style={{ width, height }} />;
    const min = Math.min(...data),
        max = Math.max(...data),
        range = max - min || 1;
    const pts = data
        .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 2) - 1}`)
        .join(' ');
    const uid = `sp-${color.replace(/[^a-z0-9]/gi, '')}-${width}`;
    return (
        <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
            <defs>
                <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            </defs>
            {filled && <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${uid})`} />}
            <polyline
                points={pts}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
});
MiniSparkline.displayName = 'MiniSparkline';

/* ─ Helpers ─ */
const ENVIRONMENTS = [];

const EnvSwitcher = ({ currentEnv, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const env = ENVIRONMENTS.find((e) => e.id === currentEnv) || ENVIRONMENTS[0];

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen((o) => !o)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 14px',
                    borderRadius: 12,
                    background: `${env.color}12`,
                    border: `1px solid ${env.color}28`,
                    cursor: 'pointer',
                    color: env.color,
                    transition: 'all 0.18s ease',
                }}
            >
                <env.icon size={12} />
                <span className="ov-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.03em' }}>
                    {env.label}
                </span>
                <ChevronDown
                    size={10}
                    style={{ transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : 'none' }}
                />
            </button>

            {open && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        zIndex: 200,
                        background: THEME.surfaceRaised,
                        border: `1px solid ${THEME.glassBorder}`,
                        borderRadius: 12,
                        overflow: 'hidden',
                        minWidth: 240,
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                    }}
                >
                    <div style={{ padding: '8px 12px 6px', borderBottom: `1px solid ${THEME.glassBorder}` }}>
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: THEME.textDim, letterSpacing: '0.02em' }}>
                            Switch Environment
                        </span>
                    </div>
                    {ENVIRONMENTS.map((e) => (
                        <button
                            key={e.id}
                            onClick={() => {
                                onChange(e.id);
                                setOpen(false);
                            }}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '11px 14px',
                                background: e.id === currentEnv ? `${e.color}10` : 'transparent',
                                border: 'none',
                                borderBottom: `1px solid ${THEME.glassBorder}20`,
                                cursor: 'pointer',
                                transition: 'background 0.15s',
                            }}
                            onMouseEnter={(ev) => {
                                ev.currentTarget.style.background = `${e.color}08`;
                            }}
                            onMouseLeave={(ev) => {
                                ev.currentTarget.style.background =
                                    e.id === currentEnv ? `${e.color}10` : 'transparent';
                            }}
                        >
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 10,
                                    background: `${e.color}16`,
                                    border: `1px solid ${e.color}28`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                <e.icon size={14} color={e.color} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                                <div
                                    style={{
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: e.id === currentEnv ? e.color : THEME.textMain,
                                    }}
                                >
                                    {e.label}
                                </div>
                                <div className="ov-mono" style={{ fontSize: 9.5, color: THEME.textDim, marginTop: 1 }}>
                                    {e.host}
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                <StatusBadge label={`PG ${e.pg}`} color={e.color} />
                                {e.id === currentEnv && (
                                    <span style={{ fontSize: 8.5, color: e.color, fontWeight: 700 }}>ACTIVE</span>
                                )}
                            </div>
                        </button>
                    ))}
                    <div style={{ padding: '6px 12px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Boxes size={10} color={THEME.textDim} />
                        <span style={{ fontSize: 9.5, color: THEME.textDim }}>
                            {ENVIRONMENTS.length > 0
                                ? `${ENVIRONMENTS.length} environments configured`
                                : 'No environments'}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

const SEVERITY_COLOR = { critical: THEME.danger, warning: THEME.warning, info: THEME.primary };
const SEVERITY_ICON = { critical: AlertCircle, warning: AlertTriangle, info: Info };

const NotificationBell = React.memo(() => {
    const [open, setOpen] = useState(false);
    const [alerts, setAlerts] = useState([]);
    const [bellAnim, setBellAnim] = useState(false);
    const ref = useRef(null);
    const unread = alerts.filter((a) => !a.read).length;

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (unread > 0) {
            const t = setInterval(() => {
                setBellAnim(true);
                setTimeout(() => setBellAnim(false), 1300);
            }, 6000);
            return () => clearInterval(t);
        }
    }, [unread]);

    const markAllRead = () => setAlerts((al) => al.map((a) => ({ ...a, read: true })));
    const dismiss = (id) => setAlerts((al) => al.filter((a) => a.id !== id));

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen((o) => !o)}
                aria-label="Notifications"
                title="Notifications"
                style={{
                    position: 'relative',
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    background: open ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${unread > 0 ? `${SEVERITY_COLOR.critical}40` : THEME.glassBorder}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                }}
            >
                {unread > 0 ? (
                    <BellRing
                        size={15}
                        color={SEVERITY_COLOR.critical}
                        style={{ animation: bellAnim ? 'tremorBell 1.2s ease-in-out' : 'none' }}
                    />
                ) : (
                    <Bell size={15} color={THEME.textMuted} />
                )}
                {unread > 0 && (
                    <span
                        style={{
                            position: 'absolute',
                            top: -4,
                            right: -4,
                            minWidth: 16,
                            height: 16,
                            borderRadius: 8,
                            padding: '0 4px',
                            background: SEVERITY_COLOR.critical,
                            color: '#fff',
                            fontSize: 9,
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: THEME.fontMono,
                            animation: 'tremorPulse 2s ease-in-out infinite',
                        }}
                    >
                        {unread}
                    </span>
                )}
            </button>

            {open && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 0,
                        zIndex: 200,
                        background: THEME.surfaceRaised,
                        border: `1px solid ${THEME.glassBorder}`,
                        borderRadius: 12,
                        overflow: 'hidden',
                        width: 320,
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                    }}
                >
                    <div
                        style={{
                            padding: '10px 14px',
                            borderBottom: `1px solid ${THEME.glassBorder}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <BellRing size={13} color={unread > 0 ? SEVERITY_COLOR.critical : THEME.textMuted} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: THEME.textMain }}>Alerts</span>
                            {unread > 0 && <StatusBadge label={`${unread} unread`} color={SEVERITY_COLOR.critical} />}
                        </div>
                        {unread > 0 && (
                            <button
                                onClick={markAllRead}
                                style={{
                                    fontSize: 10,
                                    color: THEME.primary,
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                }}
                            >
                                Mark all read
                            </button>
                        )}
                    </div>
                    <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                        {alerts.length === 0 && (
                            <div style={{ padding: 24, textAlign: 'center', color: THEME.textDim, fontSize: 12 }}>
                                <CheckCircle
                                    size={20}
                                    color={THEME.success}
                                    style={{ marginBottom: 8, opacity: 0.7 }}
                                />
                                <div>All clear — no active alerts.</div>
                            </div>
                        )}
                        {alerts.map((a, i) => {
                            const SIcon = SEVERITY_ICON[a.severity];
                            const sc = SEVERITY_COLOR[a.severity];
                            return (
                                <div
                                    key={a.id}
                                    className="ov-notif-item"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 10,
                                        padding: '11px 14px',
                                        background: a.read ? 'transparent' : `${sc}06`,
                                        borderBottom: `1px solid ${THEME.glassBorder}20`,
                                        borderLeft: a.read ? '2px solid transparent' : `2px solid ${sc}`,
                                    }}
                                >
                                    <SIcon size={13} color={sc} style={{ marginTop: 1, flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                            style={{
                                                fontSize: 11.5,
                                                color: a.read ? THEME.textMuted : THEME.textMain,
                                                fontWeight: a.read ? 400 : 600,
                                                lineHeight: 1.35,
                                            }}
                                        >
                                            {a.title}
                                        </div>
                                        <div
                                            className="ov-mono"
                                            style={{ fontSize: 9.5, color: THEME.textDim, marginTop: 3 }}
                                        >
                                            {a.time}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => dismiss(a.id)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: THEME.textDim,
                                            padding: 0,
                                            opacity: 0.6,
                                        }}
                                    >
                                        <X size={11} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    <div
                        style={{
                            padding: '8px 14px',
                            borderTop: `1px solid ${THEME.glassBorder}`,
                            display: 'flex',
                            justifyContent: 'center',
                        }}
                    >
                        <span style={{ fontSize: 10.5, color: THEME.primary, fontWeight: 600, cursor: 'pointer' }}>
                            View all alerts →
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
});
NotificationBell.displayName = 'NotificationBell';

const REFRESH_OPTIONS = [
    { label: '5s', value: 5000 },
    { label: '15s', value: 15000 },
    { label: '30s', value: 30000 },
    { label: '60s', value: 60000 },
    { label: 'Off', value: 0 },
];

const RefreshControl = ({ interval, setInterval: setIv, onManualRefresh, loading }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const cur = REFRESH_OPTIONS.find((o) => o.value === interval) || REFRESH_OPTIONS[0];

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
                onClick={onManualRefresh}
                disabled={loading}
                aria-label="Refresh data"
                title="Refresh"
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${THEME.glassBorder}`,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s',
                    opacity: loading ? 0.5 : 1,
                }}
            >
                <RefreshCw
                    size={13}
                    color={THEME.textMuted}
                    style={{ animation: loading ? 'ovRotate 0.8s linear infinite' : 'none' }}
                />
            </button>

            <button
                onClick={() => setOpen((o) => !o)}
                aria-label={interval === 0 ? 'Resume auto-refresh' : 'Pause auto-refresh'}
                title="Toggle auto-refresh"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 12px',
                    borderRadius: 10,
                    height: 32,
                    background: interval === 0 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${interval === 0 ? '#fb718540' : THEME.glassBorder}`,
                    cursor: 'pointer',
                    color: interval === 0 ? THEME.danger : THEME.textMuted,
                    transition: 'all 0.15s',
                    boxShadow: interval === 0 ? '0 0 8px #fb718530' : 'none',
                }}
            >
                {interval === 0 ? <Pause size={11} /> : <Play size={11} />}
                <span className="ov-mono" style={{ fontSize: 10.5, fontWeight: 700 }}>
                    {cur.label}
                </span>
                <ChevronDown
                    size={9}
                    style={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}
                />
            </button>

            {open && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        right: 0,
                        zIndex: 200,
                        background: THEME.surfaceRaised,
                        border: `1px solid ${THEME.glassBorder}`,
                        borderRadius: 12,
                        overflow: 'hidden',
                        minWidth: 140,
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                    }}
                >
                    <div style={{ padding: '7px 11px 5px', borderBottom: `1px solid ${THEME.glassBorder}` }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: THEME.textDim, letterSpacing: '0.02em' }}>
                            Refresh interval
                        </span>
                    </div>
                    {REFRESH_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => {
                                setIv(opt.value);
                                setOpen(false);
                            }}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '9px 12px',
                                background: opt.value === interval ? `${THEME.primary}12` : 'transparent',
                                border: 'none',
                                borderBottom: `1px solid ${THEME.glassBorder}15`,
                                cursor: 'pointer',
                                transition: 'background 0.12s',
                            }}
                            onMouseEnter={(ev) => {
                                if (opt.value !== interval)
                                    ev.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                            }}
                            onMouseLeave={(ev) => {
                                if (opt.value !== interval) ev.currentTarget.style.background = 'transparent';
                            }}
                        >
                            <span
                                className="ov-mono"
                                style={{
                                    fontSize: 11.5,
                                    color: opt.value === interval ? THEME.primary : THEME.textMuted,
                                    fontWeight: opt.value === interval ? 700 : 400,
                                }}
                            >
                                {opt.label}
                            </span>
                            {opt.value === interval && <CheckCircle size={11} color={THEME.primary} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// PgVersionBadge / EnvSwitcher were defined here previously but never rendered
// — and would have crashed because ENVIRONMENTS = []. Removed in the Overview
// redesign. If you want a version chip back, surface stats.pgVersion in the
// header next to the connection name instead of recreating the standalone
// component.

/**
 * NavCTA — the "open the relevant deep-dive tab" footer button shared by
 * BackupStatusCard, LongTxnCard, and VacuumHealthCard. Each card previously
 * inlined its own copy (3× near-identical 14-line blocks with hand-rolled
 * hover handlers); extracting it removes the duplication and gives us one
 * place to tune the visual.
 */
const NavCTA = React.memo(({ label, onClick }: { label: string; onClick: () => void }) => (
    <button
        onClick={onClick}
        style={{
            marginTop: 12,
            width: '100%',
            padding: '8px 0',
            borderRadius: 8,
            border: `1px solid ${THEME.primary}25`,
            background: `${THEME.primary}08`,
            color: THEME.primary,
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
            e.currentTarget.style.background = `${THEME.primary}18`;
            e.currentTarget.style.borderColor = `${THEME.primary}40`;
        }}
        onMouseLeave={(e) => {
            e.currentTarget.style.background = `${THEME.primary}08`;
            e.currentTarget.style.borderColor = `${THEME.primary}25`;
        }}
    >
        {label} <span style={{ fontSize: 13 }}>→</span>
    </button>
));
NavCTA.displayName = 'NavCTA';

/**
 * AlertsBanner — surfaces /api/overview/alerts at the top of the dashboard.
 *
 * Before this redesign, `alertsData` was being fetched every refresh cycle
 * and silently dropped — the standalone `NotificationBell` component kept
 * its own empty local state that nothing populated, so the user never saw
 * any of these alerts. We now render the highest-severity ones inline with
 * a "View all" affordance routing to the dedicated alerts tab.
 */
const AlertsBanner = React.memo(
    ({ alerts, onViewAll, onDismiss }: { alerts: any[]; onViewAll?: () => void; onDismiss?: () => void }) => {
        if (!alerts || alerts.length === 0) return null;

        const order: Record<string, number> = { critical: 0, error: 0, warning: 1, warn: 1, info: 2 };
        const sorted = [...alerts].sort(
            (a, b) => (order[(a.severity || '').toLowerCase()] ?? 3) - (order[(b.severity || '').toLowerCase()] ?? 3),
        );
        const top = sorted[0];
        const topSev = (top.severity || 'info').toLowerCase();
        const isCritical = topSev === 'critical' || topSev === 'error';
        const isWarning = topSev === 'warning' || topSev === 'warn';
        const accent = isCritical ? THEME.danger : isWarning ? THEME.warning : THEME.primary;
        const Icon = isCritical ? AlertCircle : isWarning ? AlertTriangle : Info;

        const summary =
            sorted.length === 1
                ? top.message || top.title || 'Active alert'
                : `${sorted.length} active alerts · ${top.message || top.title || 'see details'}`;

        return (
            <div
                role="status"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: `${accent}10`,
                    border: `1px solid ${accent}30`,
                    animation: 'tremorCountUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                }}
            >
                <Icon size={16} color={accent} style={{ flexShrink: 0 }} />
                <span
                    style={{
                        fontSize: 12,
                        color: accent,
                        fontWeight: 600,
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {summary}
                </span>
                {onViewAll && (
                    <button
                        onClick={onViewAll}
                        style={{
                            fontSize: 11,
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: `1px solid ${accent}40`,
                            background: `${accent}15`,
                            color: accent,
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        View all
                    </button>
                )}
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        aria-label="Dismiss alerts banner"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            border: 'none',
                            background: 'transparent',
                            color: accent,
                            cursor: 'pointer',
                            flexShrink: 0,
                        }}
                    >
                        <X size={13} />
                    </button>
                )}
            </div>
        );
    },
);
AlertsBanner.displayName = 'AlertsBanner';

// React.memo'd so the 30s auto-refresh tick doesn't re-render this card when
// its `lastBackup` prop reference hasn't changed.
const BackupStatusCard = React.memo(({ lastBackup }: any) => {
    const backup = lastBackup || {
        timestamp: null,
        sizeGB: 0,
        type: 'N/A',
        status: 'unknown',
        duration: 'N/A',
        nextScheduled: 'N/A',
    };
    const isOld = backup.timestamp ? Date.now() - new Date(backup.timestamp).getTime() > 26 * 3600 * 1000 : false;
    const statusColor =
        backup.status === 'success' ? THEME.success : backup.status === 'unknown' ? THEME.textDim : THEME.danger;

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: '16px 18px',
                borderRadius: 12,
                background: THEME.surface,
                border: `1px solid ${isOld ? `${THEME.warning}30` : THEME.glassBorder}`,
                position: 'relative',
                overflow: 'hidden',
                boxShadow: THEME.shadowSm,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            background: `${statusColor}14`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <HardDriveDownload size={15} color={statusColor} />
                    </div>
                    <div>
                        <div
                            style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: THEME.textMuted,
                                letterSpacing: '0.02em',
                                lineHeight: 1,
                            }}
                        >
                            Last Backup
                        </div>
                        <div className="ov-mono" style={{ fontSize: 9, color: THEME.textDim, marginTop: 2 }}>
                            {backup.type} backup
                        </div>
                    </div>
                </div>
                <StatusBadge
                    label={
                        backup.status === 'success' ? 'Verified' : backup.status === 'unknown' ? 'No data' : 'FAILED'
                    }
                    color={statusColor}
                />
            </div>

            <div>
                {/* Explicit empty state when /api/overview/backup has no record
                    or times out — previously this rendered "0 GB compressed ·
                    took N/A" which read like a real failed backup. */}
                {backup.timestamp ? (
                    <>
                        <div
                            className="ov-mono"
                            style={{
                                fontSize: 20,
                                fontWeight: 700,
                                color: isOld ? THEME.warning : THEME.textMain,
                                lineHeight: 1,
                                letterSpacing: '-0.01em',
                            }}
                        >
                            {fmtRelTime(backup.timestamp)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                            <span style={{ fontSize: 11, color: THEME.textDim }}>
                                <strong style={{ color: THEME.textMuted }}>{backup.sizeGB} GB</strong> compressed
                            </span>
                            <span style={{ fontSize: 11, color: THEME.textDim }}>
                                took <strong style={{ color: THEME.textMuted }}>{backup.duration}</strong>
                            </span>
                        </div>
                    </>
                ) : (
                    <div
                        style={{
                            fontSize: 13,
                            color: THEME.textDim,
                            fontWeight: 500,
                            padding: '4px 0',
                        }}
                    >
                        No backup data available
                        <div
                            style={{ fontSize: 10, color: THEME.textDim, opacity: 0.7, marginTop: 2, fontWeight: 400 }}
                        >
                            Endpoint returned no record or timed out
                        </div>
                    </div>
                )}
            </div>

            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    paddingTop: 8,
                    borderTop: `1px solid ${THEME.glassBorder}`,
                }}
            >
                <Clock size={9} color={THEME.textDim} />
                <span style={{ fontSize: 10, color: THEME.textDim }}>
                    Next scheduled: <strong style={{ color: THEME.textMuted }}>{backup.nextScheduled}</strong>
                </span>
                {isOld && (
                    <span style={{ marginLeft: 'auto' }}>
                        <StatusBadge label="OVERDUE" color={THEME.warning} />
                    </span>
                )}
            </div>
        </div>
    );
});
BackupStatusCard.displayName = 'BackupStatusCard';

const formatDuration = (totalSec) => {
    const sec = Math.round(Number(totalSec) || 0);
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
};

const LongTxnCard = React.memo(({ data, onNavigate }: any) => {
    // pg can serialize `now() - xact_start` intervals as OBJECTS
    // ({days, hours, minutes, seconds, milliseconds}); rendering one directly
    // crashes React (#31). Coerce every shape to a display string.
    const coerceDuration = (t: any): string => {
        const d = t.duration;
        if (typeof d === 'string' && d) return d;
        if (d && typeof d === 'object') {
            const total =
                (Number(d.days) || 0) * 86400 +
                (Number(d.hours) || 0) * 3600 +
                (Number(d.minutes) || 0) * 60 +
                Math.floor(Number(d.seconds) || 0);
            return formatDuration(total);
        }
        return formatDuration(t.durationSec || t.duration_sec || t.txn_duration_sec || t.query_duration_sec || 0);
    };
    const txns = (Array.isArray(data) ? data : []).map((t) => ({
        pid: t.pid,
        duration: coerceDuration(t),
        query: t.query || 'Unknown query',
        state: t.state || 'unknown',
        waitEvent: t.waitEvent || t.wait_event || null,
    }));

    if (txns.length === 0) {
        return (
            <div
                style={{
                    padding: '16px 18px',
                    borderRadius: 12,
                    background: THEME.surface,
                    border: `1px solid ${THEME.glassBorder}`,
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.08)',
                }}
            >
                <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 10,
                                background: `${THEME.success}14`,
                                border: `1px solid ${THEME.success}28`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Hourglass size={15} color={THEME.success} />
                        </div>
                        <div>
                            <div
                                style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: THEME.textMuted,
                                    letterSpacing: '0.02em',
                                    lineHeight: 1,
                                }}
                            >
                                Long-Running Txns
                            </div>
                            <div className="ov-mono" style={{ fontSize: 9, color: THEME.textDim, marginTop: 2 }}>
                                threshold: &gt; 1m
                            </div>
                        </div>
                    </div>
                    <div
                        className="ov-mono"
                        style={{
                            fontSize: 24,
                            fontWeight: 800,
                            color: THEME.success,
                            lineHeight: 1,
                        }}
                    >
                        0
                    </div>
                </div>
                <div style={{ fontSize: 10.5, color: THEME.textDim, textAlign: 'center', padding: '12px 0' }}>
                    No long-running transactions detected
                </div>
                {onNavigate && <NavCTA label="Performance & Queries" onClick={onNavigate} />}
            </div>
        );
    }

    // Safe duration parser — /api/overview/long-transactions can return
    // durations as strings ("4m 12s"), numeric seconds, or null. The previous
    // implementation called .replace() directly on t.duration which crashed
    // the whole dashboard with a TypeError when the field was anything other
    // than the expected string shape.
    const parseDurationToMs = (raw: any): number => {
        if (raw == null) return 0;
        if (typeof raw === 'number') return raw * 1000; // assume seconds
        if (typeof raw !== 'string') return 0;
        const m = /(\d+)\s*m/.exec(raw);
        const s = /(\d+)\s*s/.exec(raw);
        const mins = m ? Number(m[1]) : 0;
        const secs = s ? Number(s[1]) : 0;
        return (mins * 60 + secs) * 1000;
    };

    const maxDurMs = Math.max(
        ...txns.map((t) => parseDurationToMs(t.duration)),
        1, // guard against Math.max returning -Infinity on an all-zero array
    );

    return (
        <div
            style={{
                padding: '16px 18px',
                borderRadius: 12,
                background: THEME.surface,
                border: `1px solid ${THEME.glassBorder}`,
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.08)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            background: `${THEME.warning}14`,
                            border: `1px solid ${THEME.warning}28`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Hourglass size={15} color={THEME.warning} />
                    </div>
                    <div>
                        <div
                            style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: THEME.textMuted,
                                letterSpacing: '0.02em',
                                lineHeight: 1,
                            }}
                        >
                            Long-Running Txns
                        </div>
                        <div className="ov-mono" style={{ fontSize: 9, color: THEME.textDim, marginTop: 2 }}>
                            threshold: &gt; 1m
                        </div>
                    </div>
                </div>
                <div
                    className="ov-mono"
                    style={{
                        fontSize: 24,
                        fontWeight: 800,
                        color: txns.length > 0 ? THEME.warning : THEME.success,
                        lineHeight: 1,
                    }}
                >
                    {txns.length}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {txns.slice(0, 3).map((t, i) => {
                    // Same safe parser as above — handles missing / numeric /
                    // null `duration` fields without crashing.
                    const durMs = parseDurationToMs(t.duration);
                    const durSec = durMs / 1000;
                    const pct = maxDurMs > 0 ? Math.min((durSec / (maxDurMs / 1000)) * 100, 100) : 0;
                    const isIdle = typeof t.state === 'string' && t.state.includes('idle');
                    return (
                        <div key={t.pid} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <span className="ov-mono" style={{ fontSize: 9.5, color: THEME.textDim }}>
                                        PID {t.pid}
                                    </span>
                                    {t.waitEvent && <StatusBadge label={`Wait: ${t.waitEvent}`} color={THEME.danger} />}
                                    {isIdle && <StatusBadge label="Idle in Txn" color={THEME.warning} />}
                                </div>
                                <span
                                    className="ov-mono"
                                    style={{
                                        fontSize: 10.5,
                                        fontWeight: 700,
                                        color: i === 0 ? THEME.danger : THEME.warning,
                                    }}
                                >
                                    {t.duration}
                                </span>
                            </div>
                            <div
                                style={{
                                    fontSize: 10,
                                    color: THEME.textDim,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: '100%',
                                }}
                            >
                                {t.query}
                            </div>
                            <div
                                style={{
                                    height: 4,
                                    borderRadius: 10,
                                    background: `${THEME.grid}50`,
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    className="ov-bar-animate"
                                    style={{
                                        width: `${pct}%`,
                                        height: '100%',
                                        borderRadius: 10,
                                        background:
                                            i === 0
                                                ? `linear-gradient(90deg, ${THEME.danger}70, ${THEME.danger})`
                                                : `linear-gradient(90deg, ${THEME.warning}70, ${THEME.warning})`,
                                        animationDelay: `${i * 0.1}s`,
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
            {onNavigate && <NavCTA label="Performance & Queries" onClick={onNavigate} />}
        </div>
    );
});
LongTxnCard.displayName = 'LongTxnCard';

const VacuumHealthCard = React.memo(({ data, onNavigate }: any) => {
    const raw = data || {};
    const summary = raw.summary || raw;
    const vacuum = {
        urgentCount: summary.urgentCount || summary.urgent || 0,
        warnCount: summary.warnCount || summary.warn || 0,
        healthyCount: summary.healthyCount || summary.healthy || 0,
        lastRunTable:
            summary.lastRunTable ||
            (Array.isArray(raw.tables) && raw.tables.length > 0
                ? `${raw.tables[0].schemaname || 'public'}.${raw.tables[0].relname || ''}`
                : 'N/A'),
        lastRunAgo: summary.lastRunAgo || 'N/A',
        bloatPct: Number(summary.bloatPct || summary.avgBloatPct || 0),
        deadTuples: Number(summary.deadTuples || summary.totalDeadTuples || 0),
    };
    const total = vacuum.urgentCount + vacuum.warnCount + vacuum.healthyCount;
    const urgentPct = Math.round((vacuum.urgentCount / total) * 100);
    const warnPct = Math.round((vacuum.warnCount / total) * 100);
    const healthPct = 100 - urgentPct - warnPct;

    const urgentColor = vacuum.urgentCount > 3 ? THEME.danger : THEME.warning;

    return (
        <div
            style={{
                padding: '16px 18px',
                borderRadius: 12,
                background: THEME.surface,
                border: `1px solid ${vacuum.urgentCount > 3 ? `${THEME.danger}28` : THEME.glassBorder}`,
                position: 'relative',
                overflow: 'hidden',
                boxShadow:
                    vacuum.urgentCount > 3
                        ? `0 0 0 1px ${THEME.danger}12, 0 4px 12px rgba(0,0,0,0.12)`
                        : `0 0 0 1px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.08)`,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            background: `${urgentColor}14`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                        className={vacuum.urgentCount > 3 ? 'ov-vacuum-urgent' : ''}
                    >
                        <Leaf size={15} color={urgentColor} />
                    </div>
                    <div>
                        <div
                            style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: THEME.textMuted,
                                letterSpacing: '0.02em',
                                lineHeight: 1,
                            }}
                        >
                            Vacuum Health
                        </div>
                        <div className="ov-mono" style={{ fontSize: 9, color: THEME.textDim, marginTop: 2 }}>
                            {total} tables tracked
                        </div>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div
                        className="ov-mono"
                        style={{
                            fontSize: 22,
                            fontWeight: 800,
                            color: urgentColor,
                            lineHeight: 1,
                        }}
                    >
                        {vacuum.urgentCount}
                    </div>
                    <div
                        style={{
                            fontSize: 9,
                            color: THEME.textDim,
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                        }}
                    >
                        urgent
                    </div>
                </div>
            </div>

            <div
                style={{
                    height: 7,
                    borderRadius: 14,
                    background: `${THEME.grid}50`,
                    overflow: 'hidden',
                    display: 'flex',
                    marginBottom: 8,
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
                }}
            >
                <div
                    style={{
                        width: `${urgentPct}%`,
                        height: '100%',
                        background: THEME.danger,
                        transition: 'width 0.9s ease',
                    }}
                />
                <div
                    style={{
                        width: `${warnPct}%`,
                        height: '100%',
                        background: THEME.warning,
                        transition: 'width 0.9s ease 0.05s',
                    }}
                />
                <div
                    style={{
                        flex: 1,
                        minWidth: 0,
                        height: '100%',
                        background: `${THEME.success}60`,
                        transition: 'width 0.9s ease 0.1s',
                    }}
                />
            </div>

            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 10,
                    color: THEME.textDim,
                    marginBottom: 10,
                }}
            >
                <span style={{ color: THEME.danger }}>{vacuum.urgentCount} urgent</span>
                <span style={{ color: THEME.warning }}>{vacuum.warnCount} soon</span>
                <span style={{ color: THEME.success }}>{vacuum.healthyCount} healthy</span>
            </div>

            <Divider />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <div style={{ fontSize: 10, color: THEME.textDim }}>
                    Dead tuples:{' '}
                    <strong className="ov-mono" style={{ color: THEME.textMuted }}>
                        {fmtNum(vacuum.deadTuples)}
                    </strong>
                </div>
                <div style={{ fontSize: 10, color: THEME.textDim }}>
                    Bloat:{' '}
                    <strong
                        className="ov-mono"
                        style={{
                            color: vacuum.bloatPct > 10 ? THEME.danger : THEME.warning,
                        }}
                    >
                        {vacuum.bloatPct}%
                    </strong>
                </div>
            </div>
            <div style={{ fontSize: 10, color: THEME.textDim, marginTop: 4 }}>
                Last run: <strong style={{ color: THEME.textMuted }}>{vacuum.lastRunTable}</strong>{' '}
                <span className="ov-mono">{vacuum.lastRunAgo}</span>
            </div>

            {onNavigate && <NavCTA label="Vacuum & Maintenance" onClick={onNavigate} />}
        </div>
    );
});
VacuumHealthCard.displayName = 'VacuumHealthCard';

const ConnectionStatusBanner = () => {
    const { connections, activeConnection, activeConnectionId, loading, switchConnection } = useConnection();
    const nav = useNavigation();
    const [switching, setSwitching] = useState(null);
    const [dismissed, setDismissed] = useState(false);

    const goToPool = () => nav?.goToTab('connections');

    if (!loading && connections.length === 0) {
        return (
            <div
                style={{
                    borderRadius: 16,
                    background: `linear-gradient(135deg, ${THEME.primary}10, ${THEME.secondary || THEME.primary}08)`,
                    border: `1px dashed ${THEME.primary}50`,
                    padding: '28px 32px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 24,
                }}
            >
                <div
                    style={{
                        width: 64,
                        height: 64,
                        borderRadius: 16,
                        flexShrink: 0,
                        background: `${THEME.primary}15`,
                        border: `1px solid ${THEME.primary}30`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Database size={28} color={THEME.primary} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: THEME.textMain, marginBottom: 6 }}>
                        Connect your first database
                    </div>
                    <div style={{ fontSize: 13, color: THEME.textMuted, lineHeight: 1.6, maxWidth: 520 }}>
                        FATHOM needs a PostgreSQL connection to show live metrics. Add your host, port, database name
                        and credentials to get started.
                    </div>
                    <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {[
                            { icon: Server, label: 'Host & Port' },
                            { icon: Database, label: 'Database name' },
                            { icon: Shield, label: 'Credentials' },
                            { icon: Lock, label: 'SSL / SSH optional' },
                        ].map(({ icon: Icon, label }) => (
                            <span
                                key={label}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    fontSize: 11,
                                    color: THEME.textMuted,
                                    fontFamily: 'monospace',
                                    padding: '3px 10px',
                                    borderRadius: 20,
                                    background: `${THEME.primary}10`,
                                    border: `1px solid ${THEME.primary}25`,
                                }}
                            >
                                <Icon size={10} color={THEME.primary} /> {label}
                            </span>
                        ))}
                    </div>
                </div>
                <button
                    onClick={goToPool}
                    style={{
                        flexShrink: 0,
                        padding: '11px 22px',
                        background: `linear-gradient(135deg, ${THEME.primary}, ${THEME.secondary || THEME.primary})`,
                        border: 'none',
                        borderRadius: 10,
                        cursor: 'pointer',
                        color: '#fff',
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: '0.02em',
                        boxShadow: `0 4px 18px ${THEME.primary}40`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'transform 0.12s, box-shadow 0.12s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = `0 6px 24px ${THEME.primary}55`;
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = `0 4px 18px ${THEME.primary}40`;
                    }}
                >
                    <Network size={14} /> Add Connection
                </button>
            </div>
        );
    }

    if (!activeConnection || dismissed) return null;

    const statusColor =
        activeConnection.status === 'success'
            ? THEME.success
            : activeConnection.status === 'failed'
              ? THEME.danger
              : THEME.warning;
    const connStr = `${activeConnection.host}:${activeConnection.port}/${activeConnection.database}`;
    const hasMultiple = connections.length > 1;

    return (
        <div
            style={{
                borderRadius: 14,
                background: THEME.surface,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                flexWrap: 'wrap',
            }}
        >
            <span
                style={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: statusColor,
                    animation: activeConnection.status === 'success' ? 'dotBlink 2.5s ease-in-out infinite' : 'none',
                }}
            />

            <Database size={14} color={THEME.primary} style={{ flexShrink: 0 }} />

            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: THEME.textMain }}>
                        {activeConnection.name}
                    </span>
                    <span
                        style={{
                            fontSize: 10,
                            color: statusColor,
                            fontWeight: 600,
                            letterSpacing: '0.02em',
                        }}
                    >
                        ● {activeConnection.status || 'untested'}
                    </span>
                    {activeConnection.ssl && (
                        <span
                            style={{
                                fontSize: 10,
                                color: THEME.success,
                                background: `${THEME.success}18`,
                                padding: '1px 7px',
                                borderRadius: 20,
                                fontFamily: 'monospace',
                            }}
                        >
                            SSL
                        </span>
                    )}
                    {activeConnection.sshEnabled && (
                        <span
                            style={{
                                fontSize: 10,
                                color: THEME.primaryLight,
                                background: '#60a5fa18',
                                padding: '1px 7px',
                                borderRadius: 20,
                                fontFamily: 'monospace',
                            }}
                        >
                            SSH
                        </span>
                    )}
                </div>
                <span style={{ fontSize: 11, color: THEME.textMuted, fontFamily: 'monospace', marginTop: 2 }}>
                    {activeConnection.username}@{connStr}
                </span>
            </div>

            {hasMultiple && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: THEME.textDim, marginRight: 2 }}>Switch:</span>
                    {connections
                        .filter((c) => c.id !== activeConnectionId)
                        .slice(0, 3)
                        .map((c) => (
                            <button
                                key={c.id}
                                onClick={async () => {
                                    setSwitching(c.id);
                                    try {
                                        await switchConnection(c.id);
                                    } finally {
                                        setSwitching(null);
                                    }
                                }}
                                disabled={switching === c.id}
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    background: switching === c.id ? `${THEME.primary}20` : `${THEME.primary}12`,
                                    border: `1px solid ${THEME.primary}30`,
                                    color: THEME.primary,
                                    fontWeight: 500,
                                    transition: 'all 0.15s',
                                    opacity: switching && switching !== c.id ? 0.5 : 1,
                                }}
                            >
                                {switching === c.id ? '…' : c.name}
                            </button>
                        ))}
                    {connections.length > 4 && (
                        <span style={{ fontSize: 11, color: THEME.textDim }}>+{connections.length - 4} more</span>
                    )}
                </div>
            )}

            <button
                onClick={goToPool}
                style={{
                    flexShrink: 0,
                    padding: '5px 12px',
                    borderRadius: 7,
                    cursor: 'pointer',
                    background: 'transparent',
                    border: `1px solid ${THEME.glassBorder}`,
                    color: THEME.textMuted,
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = THEME.primary;
                    e.currentTarget.style.color = THEME.primary;
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = THEME.glassBorder;
                    e.currentTarget.style.color = THEME.textMuted;
                }}
            >
                <Network size={11} /> Manage
            </button>

            <button
                onClick={() => setDismissed(true)}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: THEME.textDim,
                    padding: 2,
                    flexShrink: 0,
                }}
                title="Dismiss"
            >
                <X size={13} />
            </button>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

const OV_CACHE_KEY = 'fathom_overview_cache';
function readOverviewCache() {
    try {
        const raw = localStorage.getItem(OV_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed._ts && Date.now() - parsed._ts > 120_000) return null;
        return parsed;
    } catch {
        return null;
    }
}
function writeOverviewCache(obj) {
    try {
        localStorage.setItem(OV_CACHE_KEY, JSON.stringify({ ...obj, _ts: Date.now() }));
    } catch {}
}

const OverviewTab = () => {
    useAdaptiveTheme();
    const { activeConnection, loading: connectionsLoading } = useConnection();
    const nav = useNavigation();

    const cachedOv = useMemo(() => readOverviewCache(), []);
    const [data, setData] = useState(cachedOv?.data ?? null);
    const [loading, setLoading] = useState(!cachedOv?.data);
    const [refreshing, setRefreshing] = useState(false);
    const [tick, setTick] = useState(0);
    const [refreshInterval, setRefreshInterval] = useState(30000);
    const intervalRef = useRef(null);
    const [longTxns, setLongTxns] = useState(cachedOv?.longTxns ?? []);
    const [vacuumData, setVacuumData] = useState(cachedOv?.vacuumData ?? null);
    const [backupData, setBackupData] = useState(cachedOv?.backupData ?? null);
    const [replicationData, setReplicationData] = useState(cachedOv?.replicationData ?? null);
    const [topTables, setTopTables] = useState(cachedOv?.topTables ?? []);
    const [timeseriesData, setTimeseriesData] = useState(cachedOv?.timeseriesData ?? null);
    const [alertsData, setAlertsData] = useState(cachedOv?.alertsData ?? []);
    // Track dismissed-count rather than the dismissed list — that way if 2
    // alerts are dismissed and a 3rd new alert arrives, the banner reappears.
    const [dismissedAlertCount, setDismissedAlertCount] = useState(0);

    const velocityData = useMemo(() => {
        if (timeseriesData?.velocity && Array.isArray(timeseriesData.velocity) && timeseriesData.velocity.length > 0) {
            return timeseriesData.velocity.map((v) => ({
                time: v.time || v.t || '',
                qps: Number(v.qps || 0),
                tps: Number(v.tps || 0),
            }));
        }
        const baseQps =
            Number(data?.traffic?.tup_fetched || 0) > 0
                ? Math.round(
                      Number(data?.traffic?.tup_fetched || 0) / Math.max(Number(data?.stats?.uptimeSeconds || 3600), 1),
                  )
                : 0;
        const baseTps =
            Number(data?.traffic?.xact_commit || 0) > 0
                ? Math.round(
                      Number(data?.traffic?.xact_commit || 0) / Math.max(Number(data?.stats?.uptimeSeconds || 3600), 1),
                  )
                : 0;
        const now = new Date();
        return [
            {
                time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
                qps: baseQps,
                tps: baseTps,
            },
        ];
    }, [timeseriesData, data]);

    const opsPerSec = useMemo(() => {
        if (
            timeseriesData?.opsPerSec &&
            Array.isArray(timeseriesData.opsPerSec) &&
            timeseriesData.opsPerSec.length > 0
        ) {
            return timeseriesData.opsPerSec;
        }
        return [
            {
                t: 'Now',
                reads: Number(data?.traffic?.tup_fetched || 0),
                writes:
                    Number(data?.traffic?.tup_inserted || 0) +
                    Number(data?.traffic?.tup_updated || 0) +
                    Number(data?.traffic?.tup_deleted || 0),
                commits: 0,
            },
        ];
    }, [timeseriesData, data]);

    const txnLatencyData = useMemo(() => {
        if (timeseriesData?.latency && Array.isArray(timeseriesData.latency) && timeseriesData.latency.length > 0) {
            return timeseriesData.latency.map((v, i) => ({
                i,
                p50: Number(v.p50 || 0),
                p95: Number(v.p95 || 0),
                p99: Number(v.p99 || 0),
            }));
        }
        return [];
    }, [timeseriesData]);

    const load = useCallback(
        async (isManual = false) => {
            if (!activeConnection) {
                setLoading(false);
                return;
            }
            if (isManual) setRefreshing(true);
            try {
                const withTimeout = (p, ms = 5000) =>
                    Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
                // PERF: prefer the aggregated /api/overview/all endpoint which
                // runs every sub-query on a single pooled checkout, halving DB
                // round-trips. Fall back to the individual endpoints on any
                // failure so older backends keep working.
                let allRes;
                try {
                    allRes = await withTimeout(fetchData('/api/overview/all'), 8000);
                    if (allRes?.error) allRes = null;
                } catch {
                    allRes = null;
                }

                // backup / timeseries / alerts are still fetched separately —
                // they're not in the aggregated endpoint because each has its
                // own optimisation profile (backup uses pg_stat_archiver, alerts
                // gets recomputed from thresholds, timeseries is a longer range).
                const [
                    statsRes,
                    trafficRes,
                    longTxnRes,
                    vacuumRes,
                    backupRes,
                    replicationRes,
                    topTablesRes,
                    timeseriesRes,
                    alertsRes,
                ] = await Promise.allSettled([
                    allRes ? Promise.resolve({ ...allRes.stats }) : withTimeout(fetchData('/api/overview/stats')),
                    allRes ? Promise.resolve(allRes.traffic) : withTimeout(fetchData('/api/overview/traffic')),
                    allRes
                        ? Promise.resolve(allRes.longTransactions)
                        : withTimeout(fetchData('/api/overview/long-transactions')),
                    allRes ? Promise.resolve(allRes.vacuum) : withTimeout(fetchData('/api/overview/vacuum')),
                    withTimeout(fetchData('/api/overview/backup')),
                    allRes ? Promise.resolve(allRes.replication) : withTimeout(fetchData('/api/overview/replication')),
                    allRes ? Promise.resolve(allRes.topTables) : withTimeout(fetchData('/api/overview/top-tables')),
                    withTimeout(fetchData('/api/overview/timeseries')),
                    withTimeout(fetchData('/api/overview/alerts')),
                ]);
                const val = (r) => (r.status === 'fulfilled' && !r.value?.error ? r.value : null);
                const newData = {
                    stats: val(statsRes) || {
                        activeConnections: 0,
                        maxConnections: 0,
                        uptimeSeconds: 0,
                        diskUsedGB: 0,
                        indexHitRatio: '0.0',
                    },
                    traffic: val(trafficRes) || { tup_fetched: 0, tup_inserted: 0, tup_updated: 0, tup_deleted: 0 },
                };
                setData(newData);

                const longTxnData = val(longTxnRes);
                const newLongTxns = Array.isArray(longTxnData) ? longTxnData : longTxnData?.transactions || [];
                setLongTxns(newLongTxns);

                const newVacuumData = val(vacuumRes);
                const newBackupData = val(backupRes);
                const newReplicationData = val(replicationRes);
                setVacuumData(newVacuumData);
                setBackupData(newBackupData);
                setReplicationData(newReplicationData);

                const ttData = val(topTablesRes);
                const newTopTables = Array.isArray(ttData) ? ttData : ttData?.tables || [];
                setTopTables(newTopTables);

                const newTimeseriesData = val(timeseriesRes);
                setTimeseriesData(newTimeseriesData);

                const aData = val(alertsRes);
                const newAlertsData = Array.isArray(aData) ? aData : aData?.alerts || [];
                setAlertsData(newAlertsData);

                writeOverviewCache({
                    data: newData,
                    longTxns: newLongTxns,
                    vacuumData: newVacuumData,
                    backupData: newBackupData,
                    replicationData: newReplicationData,
                    topTables: newTopTables,
                    timeseriesData: newTimeseriesData,
                    alertsData: newAlertsData,
                });
            } catch (e) {
                console.error('Overview load failed', e);
                setData({
                    stats: {
                        activeConnections: 0,
                        maxConnections: 0,
                        uptimeSeconds: 0,
                        diskUsedGB: 0,
                        indexHitRatio: '0.0',
                    },
                    traffic: { tup_fetched: 0, tup_inserted: 0, tup_updated: 0, tup_deleted: 0 },
                });
            } finally {
                setLoading(false);
                setRefreshing(false);
                setTick((t) => t + 1);
            }
        },
        [activeConnection],
    );

    useGlobalRefresh(React.useCallback(() => load(true), [load]));

    useEffect(() => {
        if (activeConnection) {
            load();
        } else {
            setLoading(false);
        }
    }, [activeConnection]);

    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (activeConnection && refreshInterval > 0) {
            intervalRef.current = setInterval(() => load(), refreshInterval);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [refreshInterval, load, activeConnection]);

    // ── Derived KPIs ────────────────────────────────────────────────────────
    // IMPORTANT: All useMemo hooks MUST be declared here, before any early
    // returns, to satisfy React's Rules of Hooks. They safely handle null
    // data by using optional chaining and fallback values.
    const stats = data?.stats;
    const traffic = data?.traffic;

    const kpis = useMemo(() => {
        const activeConns = Number(stats?.activeConnections || 0);
        const maxConns = Number(stats?.maxConnections || 100);
        const connPct = Math.round((activeConns / maxConns) * 100);
        const cacheHit = Number(stats?.indexHitRatio || 0);
        const diskGB = Number(stats?.diskUsedGB || 0);
        const uptimeHrs = (Number(stats?.uptimeSeconds || 0) / 3600).toFixed(1);

        const fetched = Number(traffic?.tup_fetched || 0);
        const inserted = Number(traffic?.tup_inserted || 0);
        const updated = Number(traffic?.tup_updated || 0);
        const deleted = Number(traffic?.tup_deleted || 0);
        const totalOps = fetched + inserted + updated + deleted;
        const readPct = totalOps > 0 ? Math.round((fetched / totalOps) * 100) : 75;
        const writePct = 100 - readPct;

        const connColor = connPct > 85 ? THEME.danger : connPct > 65 ? THEME.warning : THEME.success;
        const cacheColor = cacheHit > 98 ? THEME.success : cacheHit > 95 ? THEME.warning : THEME.danger;

        // Health-score weighting kept identical to pre-redesign behaviour.
        // The constant +20 floor is intentional historical baseline; if the
        // formula needs to change, revisit separately.
        const healthScore = Math.round(
            (cacheHit > 99 ? 30 : cacheHit > 95 ? 20 : 10) +
                (connPct < 70 ? 30 : connPct < 85 ? 20 : 10) +
                (diskGB < 150 ? 20 : diskGB < 180 ? 12 : 5) +
                20,
        );
        const healthColor = healthScore >= 80 ? THEME.success : healthScore >= 60 ? THEME.warning : THEME.danger;

        return {
            activeConns,
            maxConns,
            connPct,
            cacheHit,
            diskGB,
            uptimeHrs,
            fetched,
            inserted,
            updated,
            deleted,
            totalOps,
            readPct,
            writePct,
            connColor,
            cacheColor,
            healthScore,
            healthColor,
        };
    }, [stats, traffic]);

    const {
        activeConns,
        maxConns,
        connPct,
        cacheHit,
        diskGB,
        uptimeHrs,
        fetched,
        inserted,
        updated,
        deleted,
        totalOps,
        readPct,
        writePct,
        connColor,
        cacheColor,
        healthScore,
        healthColor,
    } = kpis;

    const throughputRows = useMemo(
        () => [
            { label: 'Tuples Fetched', raw: fetched, color: THEME.primary, icon: Eye },
            { label: 'Tuples Inserted', raw: inserted, color: THEME.success, icon: ArrowUp },
            { label: 'Tuples Updated', raw: updated, color: THEME.warning, icon: RefreshCw },
            { label: 'Tuples Deleted', raw: deleted, color: THEME.danger, icon: ArrowDown },
        ],
        [fetched, inserted, updated, deleted],
    );
    const maxThroughput = useMemo(() => Math.max(...throughputRows.map((r) => r.raw), 1), [throughputRows]);

    const workloadData = useMemo(
        () => [
            { name: 'Reads', value: readPct, color: THEME.primary },
            { name: 'Writes', value: writePct > 0 ? writePct : 1, color: THEME.secondary },
        ],
        [readPct, writePct],
    );

    const metricCards = useMemo(
        () => [
            {
                label: 'Active Sessions',
                value: `${activeConns}`,
                sub: `of ${maxConns}`,
                color: connColor,
                icon: Activity,
                delta: `${connPct.toFixed(0)}%`,
                deltaType: connPct > 85 ? ('increase' as const) : ('unchanged' as const),
                detail: connPct > 85 ? 'High utilization' : connPct > 65 ? 'Moderate' : 'Healthy',
                healthy: connPct < 70,
            },
            {
                label: 'Cache Hit Ratio',
                value: `${cacheHit}%`,
                sub: '',
                color: cacheColor,
                icon: Zap,
                delta: cacheHit >= 99 ? 'Excellent' : cacheHit >= 95 ? 'Good' : 'Below target',
                deltaType: cacheHit >= 95 ? ('increase' as const) : ('decrease' as const),
                detail: cacheHit >= 95 ? 'On target' : 'Needs tuning',
                healthy: cacheHit >= 95,
            },
            {
                label: 'Database Size',
                value: `${diskGB} GB`,
                sub: '',
                color: THEME.textMain,
                icon: Database,
                delta: undefined,
                deltaType: 'unchanged' as const,
                detail: 'On disk',
                healthy: true,
            },
            {
                label: 'Uptime',
                value: `${uptimeHrs}h`,
                sub: '',
                color: THEME.textMain,
                icon: Clock,
                delta: undefined,
                deltaType: 'unchanged' as const,
                detail: Number(uptimeHrs) > 24 ? 'Stable' : 'Recently restarted',
                healthy: Number(uptimeHrs) > 24,
            },
        ],
        [activeConns, maxConns, connPct, cacheHit, diskGB, uptimeHrs, connColor, cacheColor],
    );

    // ── Early returns (AFTER all hooks) ─────────────────────────────────────
    if (!activeConnection && !connectionsLoading) {
        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 80,
                    minHeight: 400,
                }}
            >
                <div style={{ textAlign: 'center', maxWidth: 480 }}>
                    <Database size={48} color={THEME.primary} style={{ marginBottom: 16, opacity: 0.7 }} />
                    <div style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, marginBottom: 8 }}>
                        Welcome to FATHOM
                    </div>
                    <div style={{ fontSize: 13, color: THEME.textMuted, marginBottom: 24 }}>
                        Connect a database to monitor it, or explore the interactive demos from the sidebar.
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '0 0 40px' }}>
                <TremorStyles />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                        <div
                            key={i}
                            style={{
                                height: 110,
                                borderRadius: 14,
                                background: THEME.surface,
                                border: `1px solid ${THEME.glassBorder}`,
                                opacity: 0.4,
                                animation: `tremorPulse 1.5s ease-in-out infinite`,
                                animationDelay: `${i * 0.1}s`,
                            }}
                        />
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
                    <div
                        style={{
                            height: 320,
                            borderRadius: 16,
                            background: THEME.surface,
                            border: `1px solid ${THEME.glassBorder}`,
                            opacity: 0.2,
                            animation: 'tremorPulse 1.5s ease-in-out infinite 0.5s',
                        }}
                    />
                    <div
                        style={{
                            height: 320,
                            borderRadius: 16,
                            background: THEME.surface,
                            border: `1px solid ${THEME.glassBorder}`,
                            opacity: 0.2,
                            animation: 'tremorPulse 1.5s ease-in-out infinite 0.65s',
                        }}
                    />
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div style={{ padding: 40, textAlign: 'center' }}>
                <AlertTriangle size={32} color={THEME.warning} style={{ opacity: 0.5, marginBottom: 12 }} />
                <div style={{ fontSize: 14, color: THEME.textMuted, marginBottom: 16 }}>
                    Unable to load dashboard data.
                </div>
                <button
                    onClick={() => load(true)}
                    style={{
                        padding: '8px 20px',
                        borderRadius: 8,
                        border: `1px solid ${THEME.glassBorder}`,
                        background: THEME.surface,
                        color: THEME.textMain,
                        cursor: 'pointer',
                        fontSize: 13,
                    }}
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, padding: '12px 0 48px 0' }}>
            <TremorStyles />
            <ConnectionStatusBanner />

            {alertsData && alertsData.length > dismissedAlertCount && (
                <AlertsBanner
                    alerts={alertsData}
                    onViewAll={() => nav?.goToTab('alerts')}
                    onDismiss={() => setDismissedAlertCount(alertsData.length)}
                />
            )}

            {/* ── Row 1: Hero KPI Cards ─────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${metricCards.length}, 1fr)`, gap: 14 }}>
                {metricCards.map((m, i) => (
                    <div
                        key={i}
                        style={{
                            position: 'relative',
                            borderRadius: 16,
                            overflow: 'hidden',
                            background: THEME.surface,
                            border: `1px solid ${THEME.glassBorder}`,
                            borderTop: `2px solid ${m.color}`,
                            boxShadow: THEME.shadowSm,
                            padding: '18px 20px 16px',
                            transition: 'box-shadow 0.2s, transform 0.15s',
                            cursor: 'default',
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.boxShadow =
                                `${THEME.shadowSm}, 0 4px 24px ${m.color}20`;
                            (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.boxShadow = THEME.shadowSm;
                            (e.currentTarget as HTMLElement).style.transform = 'none';
                        }}
                    >
                        <div
                            style={{
                                position: 'absolute',
                                top: -20,
                                right: -20,
                                width: 80,
                                height: 80,
                                borderRadius: '50%',
                                background: `${m.color}10`,
                                pointerEvents: 'none',
                            }}
                        />
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                marginBottom: 12,
                            }}
                        >
                            <div
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 10,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: `linear-gradient(135deg, ${m.color}22, ${m.color}08)`,
                                    border: `1px solid ${m.color}28`,
                                }}
                            >
                                <m.icon size={17} color={m.color} strokeWidth={2} />
                            </div>
                            <span
                                style={{
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    color: m.healthy ? THEME.success : THEME.warning,
                                    background: m.healthy ? `${THEME.success}12` : `${THEME.warning}12`,
                                    padding: '3px 8px',
                                    borderRadius: 20,
                                    fontFamily: THEME.fontMono,
                                }}
                            >
                                {m.detail}
                            </span>
                        </div>
                        <div
                            style={{
                                fontSize: 10,
                                fontWeight: 600,
                                color: THEME.textMuted,
                                letterSpacing: '0.05em',
                                textTransform: 'uppercase',
                                marginBottom: 4,
                            }}
                        >
                            {m.label}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                            <span
                                className="ov-mono"
                                style={{
                                    fontSize: 28,
                                    fontWeight: 800,
                                    color: THEME.textMain,
                                    lineHeight: 1,
                                    letterSpacing: '-0.03em',
                                }}
                            >
                                {m.value}
                            </span>
                            {m.sub && <span style={{ fontSize: 11, color: THEME.textDim }}>{m.sub}</span>}
                        </div>
                        {m.delta && (
                            <div
                                style={{
                                    marginTop: 7,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 10,
                                    color: m.deltaType === 'increase' ? THEME.danger : THEME.success,
                                    fontWeight: 600,
                                }}
                            >
                                <span>{m.deltaType === 'increase' ? '▲' : '▼'}</span>
                                <span className="ov-mono">{m.delta}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* ── Row 2: Status Cards ───────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <BackupStatusCard lastBackup={backupData} />
                <LongTxnCard
                    data={longTxns.length > 0 ? longTxns : null}
                    onNavigate={() => nav?.goToTab('performance')}
                />
                <VacuumHealthCard data={vacuumData} onNavigate={() => nav?.goToTab('maintenance')} />
            </div>

            {/* ── Row 3: Velocity Chart · Health · Connection Pool ─────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.75fr 1fr', gap: 18 }}>
                <PanelCard
                    title="Cluster Velocity"
                    icon={Activity}
                    accentColor={THEME.primary}
                    rightNode={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ display: 'flex', gap: 12, fontSize: 9.5, color: THEME.textDim }}>
                                {[
                                    ['QPS', THEME.primary],
                                    ['TPS', THEME.secondary],
                                ].map(([l, c]) => (
                                    <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                        <span
                                            style={{
                                                width: 12,
                                                height: 3,
                                                borderRadius: 3,
                                                background: c,
                                                boxShadow: `0 0 6px ${c}60`,
                                            }}
                                        />
                                        <span style={{ fontWeight: 600 }}>{l}</span>
                                    </span>
                                ))}
                            </div>
                            <StatusBadge label="LIVE" color={THEME.success} pulse />
                        </div>
                    }
                >
                    <div style={{ height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={velocityData} margin={{ top: 6, right: 8, bottom: 0, left: -16 }}>
                                <defs>
                                    <linearGradient id="ovGradQps" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={THEME.primary} stopOpacity={0.4} />
                                        <stop offset="100%" stopColor={THEME.primary} stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="ovGradTps" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={THEME.secondary} stopOpacity={0.28} />
                                        <stop offset="100%" stopColor={THEME.secondary} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke={`${THEME.grid}28`} strokeDasharray="3 3" vertical={false} />
                                <XAxis
                                    dataKey="time"
                                    tick={{ fontSize: 9, fill: THEME.textDim, fontFamily: THEME.fontMono }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval={4}
                                />
                                <YAxis
                                    tick={{ fontSize: 9, fill: THEME.textDim, fontFamily: THEME.fontMono }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={34}
                                />
                                <Tooltip content={<ChartTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="qps"
                                    name="Queries/sec"
                                    stroke={THEME.primary}
                                    strokeWidth={2.5}
                                    fill="url(#ovGradQps)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="tps"
                                    name="Txns/sec"
                                    stroke={THEME.secondary}
                                    strokeWidth={2}
                                    fill="url(#ovGradTps)"
                                    strokeDasharray="5 3"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4,1fr)',
                            marginTop: 14,
                            borderTop: `1px solid ${THEME.glassBorder}`,
                            paddingTop: 14,
                        }}
                    >
                        {[
                            {
                                label: 'Peak QPS',
                                value: (velocityData.length
                                    ? Math.max(...velocityData.map((d: any) => d.qps))
                                    : 0
                                ).toLocaleString(),
                                color: THEME.primary,
                            },
                            {
                                label: 'Avg QPS',
                                value: (velocityData.length
                                    ? Math.round(
                                          velocityData.reduce((s: number, d: any) => s + d.qps, 0) /
                                              velocityData.length,
                                      )
                                    : 0
                                ).toLocaleString(),
                                color: THEME.primary,
                            },
                            {
                                label: 'Peak TPS',
                                value: (velocityData.length
                                    ? Math.max(...velocityData.map((d: any) => d.tps))
                                    : 0
                                ).toLocaleString(),
                                color: THEME.secondary,
                            },
                            {
                                label: 'Avg TPS',
                                value: (velocityData.length
                                    ? Math.round(
                                          velocityData.reduce((s: number, d: any) => s + d.tps, 0) /
                                              velocityData.length,
                                      )
                                    : 0
                                ).toLocaleString(),
                                color: THEME.secondary,
                            },
                        ].map((s, i) => (
                            <div
                                key={i}
                                style={{
                                    paddingLeft: i > 0 ? 14 : 0,
                                    borderLeft: i > 0 ? `1px solid ${THEME.glassBorder}` : 'none',
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 9,
                                        color: THEME.textDim,
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        marginBottom: 3,
                                    }}
                                >
                                    {s.label}
                                </div>
                                <div className="ov-mono" style={{ fontSize: 16, fontWeight: 800, color: s.color }}>
                                    {s.value}
                                </div>
                            </div>
                        ))}
                    </div>
                </PanelCard>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <PanelCard title="Database Health" icon={Shield} accentColor={healthColor}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ flexShrink: 0, textAlign: 'center' }}>
                                <RingGauge
                                    value={healthScore}
                                    color={healthColor}
                                    size={90}
                                    strokeWidth={7}
                                    label="HEALTH"
                                    secondaryValue={cacheHit}
                                    secondaryColor={cacheColor}
                                />
                                <div
                                    style={{
                                        marginTop: 4,
                                        fontSize: 9,
                                        fontWeight: 700,
                                        color: healthColor,
                                        letterSpacing: '0.04em',
                                    }}
                                >
                                    {healthScore >= 80 ? 'EXCELLENT' : healthScore >= 60 ? 'GOOD' : 'NEEDS ATTENTION'}
                                </div>
                            </div>
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {[
                                    { label: 'Cache Hit', value: `${cacheHit}%`, pct: cacheHit, color: cacheColor },
                                    { label: 'Conn Usage', value: `${connPct}%`, pct: connPct, color: connColor },
                                    {
                                        label: 'Disk Usage',
                                        value: `${Math.round((diskGB / 200) * 100)}%`,
                                        pct: Math.round((diskGB / 200) * 100),
                                        color:
                                            diskGB > 160 ? THEME.danger : diskGB > 120 ? THEME.warning : THEME.success,
                                    },
                                ].map((item, idx) => (
                                    <div key={idx}>
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                marginBottom: 4,
                                            }}
                                        >
                                            <span style={{ fontSize: 10.5, color: THEME.textMuted, fontWeight: 600 }}>
                                                {item.label}
                                            </span>
                                            <span
                                                className="ov-mono"
                                                style={{ fontSize: 10.5, fontWeight: 800, color: item.color }}
                                            >
                                                {item.value}
                                            </span>
                                        </div>
                                        <div
                                            style={{
                                                height: 6,
                                                borderRadius: 10,
                                                background: `${THEME.grid}45`,
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    height: '100%',
                                                    width: `${Math.min(item.pct, 100)}%`,
                                                    background: `linear-gradient(90deg, ${item.color}80, ${item.color})`,
                                                    borderRadius: 10,
                                                    transition: 'width 1s ease',
                                                    boxShadow: `0 0 8px ${item.color}40`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </PanelCard>

                    <PanelCard title="Connection Pool" icon={Network} accentColor={connColor}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <RingGauge value={connPct} color={connColor} size={72} strokeWidth={6} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    {[
                                        { label: 'Active', value: activeConns, color: THEME.primary },
                                        {
                                            label: 'Idle',
                                            value: Math.max(0, maxConns - activeConns - 5),
                                            color: THEME.textDim,
                                        },
                                        {
                                            label: 'Waiting',
                                            value: Number(data?.stats?.waitingConnections || 0),
                                            color: THEME.warning,
                                        },
                                        { label: 'Max', value: maxConns, color: THEME.textMuted },
                                    ].map((s, idx) => (
                                        <div
                                            key={idx}
                                            style={{
                                                padding: '7px 10px',
                                                borderRadius: 9,
                                                background: `${s.color}08`,
                                                border: `1px solid ${s.color}18`,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize: 9,
                                                    color: THEME.textDim,
                                                    fontWeight: 700,
                                                    textTransform: 'uppercase',
                                                    marginBottom: 2,
                                                }}
                                            >
                                                {s.label}
                                            </div>
                                            <div
                                                className="ov-mono"
                                                style={{ fontSize: 17, fontWeight: 800, color: s.color, lineHeight: 1 }}
                                            >
                                                {s.value}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </PanelCard>
                </div>
            </div>

            {/* ── Row 4: Txn Latency Percentiles ───────────────────────────────── */}
            <PanelCard
                title="Transaction Latency Percentiles"
                icon={Gauge}
                accentColor={THEME.secondary}
                rightNode={
                    <div style={{ display: 'flex', gap: 14, fontSize: 9.5 }}>
                        {[
                            ['P50', THEME.secondaryDark],
                            ['P95', THEME.warning],
                            ['P99', THEME.danger],
                        ].map(([l, c]) => (
                            <span
                                key={l}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    color: c as string,
                                    fontWeight: 600,
                                }}
                            >
                                <span
                                    style={{
                                        width: 12,
                                        height: 3,
                                        borderRadius: 3,
                                        background: c as string,
                                        boxShadow: `0 0 6px ${c}60`,
                                    }}
                                />
                                <span className="ov-mono">{l}</span>
                            </span>
                        ))}
                    </div>
                }
            >
                <div style={{ height: 155 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={txnLatencyData} margin={{ top: 6, right: 10, bottom: 0, left: -16 }}>
                            <CartesianGrid stroke={`${THEME.grid}28`} strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="i" hide />
                            <YAxis
                                tick={{ fontSize: 9, fill: THEME.textDim, fontFamily: THEME.fontMono }}
                                axisLine={false}
                                tickLine={false}
                                width={28}
                                unit="ms"
                            />
                            <Tooltip content={<ChartTooltip />} />
                            <ReferenceLine
                                y={10}
                                stroke={`${THEME.warning}45`}
                                strokeDasharray="4 4"
                                label={{ value: 'SLA', fontSize: 9, fill: THEME.warning, position: 'right' }}
                            />
                            <Line
                                type="monotone"
                                dataKey="p50"
                                name="P50"
                                stroke={THEME.secondaryDark}
                                strokeWidth={2.5}
                                dot={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="p95"
                                name="P95"
                                stroke={THEME.warning}
                                strokeWidth={2}
                                dot={false}
                                strokeDasharray="5 3"
                            />
                            <Line
                                type="monotone"
                                dataKey="p99"
                                name="P99"
                                stroke={THEME.danger}
                                strokeWidth={2}
                                dot={false}
                                strokeDasharray="3 3"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5,1fr)',
                        marginTop: 14,
                        paddingTop: 14,
                        borderTop: `1px solid ${THEME.glassBorder}`,
                    }}
                >
                    {[
                        {
                            label: 'P50 avg',
                            value: data?.stats?.p50 ? `${Number(data.stats.p50).toFixed(1)} ms` : 'N/A',
                            color: THEME.secondaryDark,
                        },
                        {
                            label: 'P95 avg',
                            value: data?.stats?.p95 ? `${Number(data.stats.p95).toFixed(1)} ms` : 'N/A',
                            color: THEME.warning,
                        },
                        {
                            label: 'P99 avg',
                            value: data?.stats?.p99 ? `${Number(data.stats.p99).toFixed(1)} ms` : 'N/A',
                            color: THEME.danger,
                        },
                        {
                            label: 'Deadlocks',
                            value: String(data?.traffic?.deadlocks || 0),
                            color: Number(data?.traffic?.deadlocks || 0) > 0 ? THEME.danger : THEME.success,
                        },
                        {
                            label: 'Rollbacks',
                            value: String(data?.traffic?.xact_rollback || 0),
                            color: Number(data?.traffic?.xact_rollback || 0) > 0 ? THEME.warning : THEME.success,
                        },
                    ].map((s, i) => (
                        <div
                            key={i}
                            style={{
                                paddingLeft: i > 0 ? 16 : 0,
                                borderLeft: i > 0 ? `1px solid ${THEME.glassBorder}` : 'none',
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 9,
                                    color: THEME.textDim,
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    marginBottom: 3,
                                }}
                            >
                                {s.label}
                            </div>
                            <div className="ov-mono" style={{ fontSize: 15, fontWeight: 800, color: s.color }}>
                                {s.value}
                            </div>
                        </div>
                    ))}
                </div>
            </PanelCard>

            {/* ── Row 5: Workload · Throughput · Ops/sec ───────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1.3fr', gap: 18 }}>
                <PanelCard title="Workload Split" icon={BarChart3} accentColor={THEME.primary}>
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 12,
                            justifyContent: 'center',
                        }}
                    >
                        <div style={{ position: 'relative', width: 140, height: 140 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={workloadData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={46}
                                        outerRadius={62}
                                        paddingAngle={4}
                                        dataKey="value"
                                        strokeWidth={0}
                                    >
                                        {workloadData.map((d, i) => (
                                            <Cell key={i} fill={d.color} opacity={0.9} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<ChartTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    pointerEvents: 'none',
                                }}
                            >
                                <span
                                    className="ov-mono"
                                    style={{ fontSize: 22, fontWeight: 800, color: THEME.textMain, lineHeight: 1 }}
                                >
                                    {readPct}%
                                </span>
                                <span
                                    style={{
                                        fontSize: 8.5,
                                        color: THEME.textDim,
                                        fontWeight: 700,
                                        letterSpacing: '0.05em',
                                        marginTop: 3,
                                        textTransform: 'uppercase',
                                    }}
                                >
                                    reads
                                </span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 20 }}>
                            {workloadData.map((d, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span
                                        style={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: 3,
                                            background: d.color,
                                            boxShadow: `0 0 6px ${d.color}50`,
                                        }}
                                    />
                                    <span style={{ fontSize: 11, color: THEME.textMuted }}>{d.name}</span>
                                    <span className="ov-mono" style={{ fontSize: 12, fontWeight: 800, color: d.color }}>
                                        {d.value}%
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div
                            style={{
                                fontSize: 10.5,
                                color: THEME.textDim,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '5px 14px',
                                borderRadius: 20,
                                background: `${THEME.primary}08`,
                                border: `1px solid ${THEME.glassBorder}`,
                            }}
                        >
                            <Layers size={11} color={THEME.textDim} />
                            <span>Total:</span>
                            <strong className="ov-mono" style={{ color: THEME.textMain }}>
                                {fmtNum(totalOps)}
                            </strong>
                        </div>
                    </div>
                </PanelCard>

                <PanelCard title="Throughput Breakdown" icon={TrendingUp} noPadding>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {throughputRows.map((row, i) => {
                            const pct = maxThroughput > 0 ? (row.raw / maxThroughput) * 100 : 0;
                            return (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 14,
                                        padding: '13px 18px',
                                        borderBottom:
                                            i < throughputRows.length - 1 ? `1px solid ${THEME.grid}20` : 'none',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={(e) => {
                                        (e.currentTarget as HTMLElement).style.background = `${row.color}06`;
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 34,
                                            height: 34,
                                            borderRadius: 10,
                                            flexShrink: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: `linear-gradient(135deg, ${row.color}18, ${row.color}08)`,
                                            border: `1px solid ${row.color}22`,
                                        }}
                                    >
                                        <row.icon size={15} color={row.color} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'baseline',
                                                marginBottom: 7,
                                            }}
                                        >
                                            <span style={{ fontSize: 11.5, fontWeight: 600, color: THEME.textMuted }}>
                                                {row.label}
                                            </span>
                                            <span
                                                className="ov-mono"
                                                style={{ fontSize: 12, fontWeight: 800, color: row.color }}
                                            >
                                                {fmtNum(row.raw)}
                                            </span>
                                        </div>
                                        <div
                                            style={{
                                                height: 5,
                                                borderRadius: 10,
                                                background: `${THEME.grid}45`,
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: `${pct}%`,
                                                    height: '100%',
                                                    borderRadius: 10,
                                                    background: `linear-gradient(90deg, ${row.color}70, ${row.color})`,
                                                    transition: 'width 1s ease',
                                                    boxShadow: `0 0 8px ${row.color}35`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '12px 18px',
                            borderTop: `1px solid ${THEME.glassBorder}`,
                            background: `${THEME.primary}04`,
                        }}
                    >
                        <Layers size={12} color={THEME.textDim} />
                        <span
                            style={{
                                fontSize: 10.5,
                                color: THEME.textDim,
                                fontWeight: 600,
                                textTransform: 'uppercase',
                            }}
                        >
                            Total Ops
                        </span>
                        <span
                            className="ov-mono"
                            style={{ fontSize: 16, fontWeight: 900, color: THEME.textMain, marginLeft: 'auto' }}
                        >
                            {fmtNum(totalOps)}
                        </span>
                    </div>
                </PanelCard>

                <PanelCard
                    title="Ops / Second"
                    icon={Gauge}
                    accentColor={THEME.success}
                    rightNode={
                        <div style={{ display: 'flex', gap: 10, fontSize: 9.5 }}>
                            {[
                                ['Reads', THEME.primary],
                                ['Writes', THEME.success],
                                ['Commits', THEME.secondary],
                            ].map(([l, c]) => (
                                <span
                                    key={l}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 5,
                                        color: c as string,
                                        fontWeight: 600,
                                    }}
                                >
                                    <span
                                        style={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: 3,
                                            background: c as string,
                                            opacity: 0.85,
                                        }}
                                    />{' '}
                                    {l}
                                </span>
                            ))}
                        </div>
                    }
                >
                    <div style={{ height: 190 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={opsPerSec}
                                margin={{ top: 6, right: 4, bottom: 0, left: -20 }}
                                barCategoryGap="30%"
                            >
                                <CartesianGrid stroke={`${THEME.grid}28`} strokeDasharray="3 3" vertical={false} />
                                <XAxis
                                    dataKey="t"
                                    tick={{ fontSize: 9, fill: THEME.textDim, fontFamily: THEME.fontMono }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 9, fill: THEME.textDim, fontFamily: THEME.fontMono }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={30}
                                />
                                <Tooltip content={<ChartTooltip />} />
                                <Bar
                                    dataKey="reads"
                                    name="Reads"
                                    fill={THEME.primary}
                                    radius={[3, 3, 0, 0]}
                                    opacity={0.88}
                                />
                                <Bar
                                    dataKey="writes"
                                    name="Writes"
                                    fill={THEME.success}
                                    radius={[3, 3, 0, 0]}
                                    opacity={0.88}
                                />
                                <Bar
                                    dataKey="commits"
                                    name="Commits"
                                    fill={THEME.secondary}
                                    radius={[3, 3, 0, 0]}
                                    opacity={0.88}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </PanelCard>
            </div>

            {/* ── Row 6: System Resources ───────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
                {[
                    {
                        label: 'CPU Load',
                        value: Math.round(Number(data?.stats?.cpuUsage || 0)),
                        color: THEME.primary,
                        icon: Cpu,
                        detail: data?.stats?.cpuDetail || 'N/A',
                        secondary: Math.round(Number(data?.stats?.ioWait || 0)),
                        secondaryLabel: 'I/O Wait',
                    },
                    {
                        label: 'Memory Usage',
                        value: Math.round(Number(data?.stats?.memoryUsagePct || 0)),
                        color: THEME.secondary,
                        icon: Server,
                        detail:
                            data?.stats?.memoryDetail ||
                            (data?.stats?.sharedBuffersMB
                                ? `${Math.round((data.stats.sharedBuffersMB / 1024) * 10) / 10} GB shared`
                                : 'N/A'),
                        secondary: Math.round(Number(data?.stats?.sharedBuffersPct || 0)),
                        secondaryLabel: 'Shared Buf',
                    },
                    {
                        label: 'Disk I/O',
                        value: Math.round((diskGB / 200) * 100),
                        color: THEME.warning,
                        icon: HardDrive,
                        detail: `${diskGB} GB used`,
                        secondary: 0,
                        secondaryLabel: 'Write Amp',
                    },
                ].map((r, i) => {
                    const statusColor = r.value > 80 ? THEME.danger : r.value > 50 ? THEME.warning : THEME.success;
                    const statusText = r.value > 80 ? 'High' : r.value > 50 ? 'Moderate' : 'Normal';
                    return (
                        <div
                            key={i}
                            style={{
                                borderRadius: 16,
                                background: THEME.surface,
                                border: `1px solid ${THEME.glassBorder}`,
                                borderTop: `2px solid ${r.color}`,
                                boxShadow: THEME.shadowSm,
                                padding: '18px 20px',
                                position: 'relative',
                                overflow: 'hidden',
                                transition: 'box-shadow 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.boxShadow =
                                    `${THEME.shadowSm}, 0 4px 20px ${r.color}15`;
                            }}
                            onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.boxShadow = THEME.shadowSm;
                            }}
                        >
                            <div
                                style={{
                                    position: 'absolute',
                                    bottom: -16,
                                    right: -16,
                                    width: 72,
                                    height: 72,
                                    borderRadius: '50%',
                                    background: `${r.color}08`,
                                    pointerEvents: 'none',
                                }}
                            />
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: 14,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div
                                        style={{
                                            width: 34,
                                            height: 34,
                                            borderRadius: 10,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: `linear-gradient(135deg, ${r.color}20, ${r.color}08)`,
                                            border: `1px solid ${r.color}25`,
                                        }}
                                    >
                                        <r.icon size={16} color={r.color} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textMain }}>
                                            {r.label}
                                        </div>
                                        <div style={{ fontSize: 10, color: THEME.textDim }}>{r.detail}</div>
                                    </div>
                                </div>
                                <StatusBadge label={statusText} color={statusColor} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 10 }}>
                                <span
                                    className="ov-mono"
                                    style={{
                                        fontSize: 36,
                                        fontWeight: 900,
                                        color: r.color,
                                        lineHeight: 1,
                                        letterSpacing: '-0.04em',
                                    }}
                                >
                                    {r.value}
                                </span>
                                <span style={{ fontSize: 14, color: THEME.textMuted, fontWeight: 600 }}>%</span>
                            </div>
                            <div
                                style={{
                                    height: 7,
                                    borderRadius: 10,
                                    background: `${THEME.grid}40`,
                                    overflow: 'hidden',
                                    marginBottom: 8,
                                }}
                            >
                                <div
                                    style={{
                                        height: '100%',
                                        width: `${Math.min(r.value, 100)}%`,
                                        background: `linear-gradient(90deg, ${r.color}70, ${r.color})`,
                                        borderRadius: 10,
                                        transition: 'width 1s ease',
                                        boxShadow: `0 0 10px ${r.color}40`,
                                    }}
                                />
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: 10,
                                    color: THEME.textDim,
                                }}
                            >
                                <span className="ov-mono">
                                    {r.secondaryLabel}: <strong style={{ color: r.color }}>{r.secondary}%</strong>
                                </span>
                                <span className="ov-mono" style={{ color: statusColor }}>
                                    {r.value > 80 ? '⚠ High load' : r.value > 50 ? '~ Moderate' : '✓ Healthy'}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Row 7: Replication · Top Tables · WAL ────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 1.2fr', gap: 18 }}>
                <PanelCard
                    title="Replication & Locks"
                    icon={GitBranch}
                    accentColor={THEME.secondary}
                    rightNode={
                        <div style={{ display: 'flex', gap: 10, fontSize: 9.5 }}>
                            {[
                                ['Primary', THEME.success],
                                ['Replicas', THEME.secondary],
                            ].map(([l, c]) => (
                                <span
                                    key={l}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 5,
                                        color: c as string,
                                        fontWeight: 600,
                                    }}
                                >
                                    <Radio size={9} color={c as string} /> {l}
                                </span>
                            ))}
                        </div>
                    }
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                                style={{
                                    padding: '9px 13px',
                                    borderRadius: 11,
                                    background: `${THEME.primary}0a`,
                                    border: `1px solid ${THEME.primary}28`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    minWidth: 110,
                                }}
                            >
                                <Server size={13} color={THEME.primary} />
                                <div>
                                    <span
                                        className="ov-mono"
                                        style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: THEME.textMain,
                                            display: 'block',
                                        }}
                                    >
                                        {replicationData?.isStandby ? 'standby' : 'primary'}
                                    </span>
                                    <span className="ov-mono" style={{ fontSize: 9, color: THEME.textDim }}>
                                        lag:{' '}
                                        {replicationData?.isStandby ? `${replicationData?.replayLag || 0} ms` : '0 ms'}
                                    </span>
                                </div>
                            </div>
                            <ChevronRight size={14} color={THEME.textDim} />
                            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', flex: 1 }}>
                                {(replicationData?.replicas || []).length > 0 ? (
                                    (replicationData.replicas || []).map((r: any, i: number) => (
                                        <div
                                            key={i}
                                            style={{
                                                padding: '9px 13px',
                                                borderRadius: 11,
                                                background: `${THEME.secondary}08`,
                                                border: `1px solid ${(r.replay_lag_ms || r.lagMs || 0) > 300 ? `${THEME.warning}45` : `${THEME.secondary}25`}`,
                                                minWidth: 108,
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                <Server size={12} color={THEME.secondary} />
                                                <div>
                                                    <span
                                                        className="ov-mono"
                                                        style={{
                                                            fontSize: 11,
                                                            fontWeight: 700,
                                                            color: THEME.textMain,
                                                            display: 'block',
                                                        }}
                                                    >
                                                        {r.application_name || r.name}
                                                    </span>
                                                    <span
                                                        className="ov-mono"
                                                        style={{
                                                            fontSize: 9,
                                                            color:
                                                                (r.replay_lag_ms || r.lagMs || 0) > 300
                                                                    ? THEME.warning
                                                                    : THEME.textDim,
                                                        }}
                                                    >
                                                        lag: {r.replay_lag_ms || r.lagMs || 0} ms
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <span style={{ fontSize: 11, color: THEME.textDim, fontStyle: 'italic' }}>
                                        No replicas detected
                                    </span>
                                )}
                            </div>
                        </div>
                        <Divider />
                        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 14 }}>
                            <div>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: 6,
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 10,
                                            color: THEME.textDim,
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                        }}
                                    >
                                        Blocked
                                    </span>
                                    <span
                                        className="ov-mono"
                                        style={{ fontSize: 18, fontWeight: 800, color: THEME.danger }}
                                    >
                                        {String(replicationData?.blockedQueries || 0)}
                                    </span>
                                </div>
                                <div
                                    style={{
                                        height: 6,
                                        borderRadius: 10,
                                        background: `${THEME.grid}45`,
                                        overflow: 'hidden',
                                        marginBottom: 5,
                                    }}
                                >
                                    <div
                                        style={{
                                            height: '100%',
                                            width: `${Math.min(replicationData?.lockContention || 0, 100)}%`,
                                            background: `linear-gradient(90deg, ${THEME.danger}70, ${THEME.danger})`,
                                            borderRadius: 10,
                                            transition: 'width 1s ease',
                                        }}
                                    />
                                </div>
                                <div style={{ fontSize: 9.5, color: THEME.textDim }}>
                                    {String(replicationData?.blockedQueries || 0)} blocked
                                    {replicationData?.waitingQueries
                                        ? `, ${replicationData.waitingQueries} waiting`
                                        : ''}{' '}
                                    on locks.
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '7px 10px',
                                        borderRadius: 8,
                                        background: `${replicationData?.lockContention > 50 ? THEME.warning : THEME.success}08`,
                                        border: `1px solid ${replicationData?.lockContention > 50 ? THEME.warning : THEME.success}20`,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <Lock
                                            size={10}
                                            color={replicationData?.lockContention > 50 ? THEME.warning : THEME.success}
                                        />
                                        <span style={{ fontSize: 10, color: THEME.textMuted }}>Contention</span>
                                    </div>
                                    <StatusBadge
                                        label={replicationData?.lockContention > 50 ? 'Elevated' : 'Normal'}
                                        color={replicationData?.lockContention > 50 ? THEME.warning : THEME.success}
                                    />
                                </div>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '7px 10px',
                                        borderRadius: 8,
                                        background: `${THEME.glassBorder}`,
                                        border: `1px solid ${THEME.glassBorder}`,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <Unlock size={10} color={THEME.textMuted} />
                                        <span style={{ fontSize: 10, color: THEME.textMuted }}>Deadlocks (5m)</span>
                                    </div>
                                    <span
                                        className="ov-mono"
                                        style={{
                                            fontSize: 13,
                                            fontWeight: 800,
                                            color:
                                                Number(replicationData?.deadlocks || data?.traffic?.deadlocks || 0) > 0
                                                    ? THEME.danger
                                                    : THEME.success,
                                        }}
                                    >
                                        {String(replicationData?.deadlocks || data?.traffic?.deadlocks || 0)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </PanelCard>

                <PanelCard title="Top Impacted Tables" icon={BarChart3} noPadding>
                    {topTables.length === 0 ? (
                        <div style={{ padding: '32px 18px', textAlign: 'center', color: THEME.textDim, fontSize: 12 }}>
                            <Database size={22} color={THEME.textDim} style={{ opacity: 0.4, marginBottom: 8 }} />
                            <div>No table data available</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {topTables.map((t: any, i: number, arr: any[]) => {
                                const name = t.table_name
                                    ? `${t.schemaname || 'public'}.${t.table_name}`
                                    : t.name || 'unknown';
                                const reads = Number(t.reads || t.seq_tup_read || t.seq_scan || 0);
                                const writes =
                                    Number(t.writes || t.n_tup_ins || 0) +
                                    Number(t.n_tup_upd || 0) +
                                    Number(t.n_tup_del || 0);
                                const total = reads + writes;
                                const rp = total > 0 ? Math.round((reads / total) * 100) : 50;
                                return (
                                    <div
                                        key={t.table_name || t.name || i}
                                        style={{
                                            padding: '11px 18px',
                                            borderBottom: i < arr.length - 1 ? `1px solid ${THEME.grid}20` : 'none',
                                            transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={(e) => {
                                            (e.currentTarget as HTMLElement).style.background = `${THEME.primary}05`;
                                        }}
                                        onMouseLeave={(e) => {
                                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: 5,
                                            }}
                                        >
                                            <span
                                                className="ov-mono"
                                                style={{
                                                    fontSize: 11,
                                                    color: THEME.textMuted,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    maxWidth: '62%',
                                                    fontWeight: 600,
                                                }}
                                                title={name}
                                            >
                                                {name}
                                            </span>
                                            <span className="ov-mono" style={{ fontSize: 10.5, color: THEME.textDim }}>
                                                {fmtNum(total)} ops
                                            </span>
                                        </div>
                                        <div
                                            style={{
                                                height: 7,
                                                borderRadius: 14,
                                                background: `${THEME.grid}45`,
                                                overflow: 'hidden',
                                                display: 'flex',
                                                marginBottom: 4,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: `${rp}%`,
                                                    background: `linear-gradient(90deg, ${THEME.primary}70, ${THEME.primary})`,
                                                }}
                                            />
                                            <div
                                                style={{
                                                    flex: 1,
                                                    minWidth: 0,
                                                    background: `linear-gradient(90deg, ${THEME.secondary}70, ${THEME.secondary})`,
                                                }}
                                            />
                                        </div>
                                        <div
                                            style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5 }}
                                        >
                                            <span style={{ color: THEME.primary }}>R: {fmtNum(reads)}</span>
                                            <span style={{ color: THEME.secondary }}>W: {fmtNum(writes)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </PanelCard>

                <PanelCard title="WAL & Checkpoints" icon={Gauge} accentColor={THEME.info || THEME.primary}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                            {backupData?.role && (
                                <StatusBadge label={`Role: ${backupData.role}`} color={THEME.primary} />
                            )}
                            {backupData?.last_archived_time && (
                                <StatusBadge
                                    label={`Last archived: ${fmtRelTime(backupData.last_archived_time)}`}
                                    color={THEME.success}
                                />
                            )}
                            {backupData?.failed_count > 0 && (
                                <StatusBadge label={`${backupData.failed_count} failures`} color={THEME.danger} />
                            )}
                            {!backupData?.role && <StatusBadge label="No WAL data" color={THEME.textDim} />}
                        </div>
                        <Divider />
                        <div
                            style={{
                                padding: '12px 14px',
                                borderRadius: 10,
                                background: `${THEME.primary}07`,
                                border: `1px solid ${THEME.primary}18`,
                            }}
                        >
                            <div style={{ fontSize: 11, color: THEME.textDim, lineHeight: 1.7 }}>
                                WAL generation rate requires OS-level or{' '}
                                <code
                                    style={{
                                        color: THEME.primary,
                                        fontFamily: THEME.fontMono,
                                        fontSize: 10.5,
                                        background: `${THEME.primary}12`,
                                        padding: '1px 5px',
                                        borderRadius: 4,
                                    }}
                                >
                                    pg_stat_bgwriter
                                </code>{' '}
                                monitoring.
                            </div>
                            <button
                                onClick={() => nav?.goToTab('checkpoint')}
                                style={{
                                    marginTop: 10,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    fontSize: 11,
                                    color: THEME.primary,
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0,
                                    fontWeight: 600,
                                }}
                            >
                                Open Checkpoint Monitor <span style={{ fontSize: 13 }}>→</span>
                            </button>
                        </div>
                    </div>
                </PanelCard>
            </div>
        </div>
    );
};

export default React.memo(OverviewTab);
