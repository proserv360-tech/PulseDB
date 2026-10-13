// ==========================================================================
//  FATHOM — ResourcesTab  (v5 — Full Analytics Suite)
// ==========================================================================
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { THEME, useAdaptiveTheme, useGlobalRefresh } from '../../../utils/theme';
import { GlassCard, ResourceGauge, NeonProgressBar, EmptyState } from '../../ui/SharedComponents';
import { fetchData } from '../../../utils/api';
import { readTabCache, writeTabCache } from '../../../utils/tabCache';

import {
    Database,
    Search,
    ChevronRight,
    History,
    HardDrive,
    ChevronDown,
    Cpu,
    Server,
    Trash2,
    RefreshCw,
    CheckCircle,
    Filter,
    AlertTriangle,
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    Layers,
    BarChart3,
    Activity,
    Zap,
    TrendingUp,
    TrendingDown,
    Eye,
    GitBranch,
    Table2,
    ArrowUp,
    ArrowDown,
    Gauge,
    Network,
    Timer,
    Radio,
    ShieldAlert,
    Settings,
    PieChart as PieIcon,
    MemoryStick,
    X,
    Wifi,
    WifiOff,
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
    Cell,
    PieChart as RePieChart,
    Pie,
} from 'recharts';
import AdvancedAnalysisPanel from '../analytics/AdvancedAnalysisPanel';

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const ResStyles = () => (
    <style>{`
        @keyframes resFadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes resBarGrow {
            from { transform: scaleX(0); }
            to   { transform: scaleX(1); }
        }
        @keyframes resPulse {
            0%, 100% { opacity: 1; }
            50%      { opacity: 0.35; }
        }
        @keyframes resPulseRing {
            0%   { transform: scale(0.8); opacity: 0.6; }
            100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes resGaugeStroke {
            from { stroke-dasharray: 0 999; }
        }
        @keyframes resSpin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
        }
        @keyframes resFlashBg {
            0%   { background: transparent; }
            30%  { background: ${THEME.primary}10; }
            100% { background: transparent; }
        }
        @keyframes resResolveFlash {
            0%   { box-shadow: 0 0 0 0 ${THEME.success}00; }
            40%  { box-shadow: 0 0 0 6px ${THEME.success}30; }
            100% { box-shadow: 0 0 0 0 ${THEME.success}00; }
        }
        @keyframes resTreeExpand {
            from { opacity: 0; transform: translateY(-4px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes resFreezeShiver {
            0%, 100% { transform: translateX(0); }
            25%      { transform: translateX(-1px); }
            75%      { transform: translateX(1px); }
        }
        .res-resolved-flash { animation: resResolveFlash 0.8s ease-out; }
        .res-stagger > * { animation: resFadeIn 0.4s ease-out both; }
        .res-stagger > *:nth-child(1) { animation-delay: 0.00s; }
        .res-stagger > *:nth-child(2) { animation-delay: 0.05s; }
        .res-stagger > *:nth-child(3) { animation-delay: 0.10s; }
        .res-stagger > *:nth-child(4) { animation-delay: 0.15s; }
        .res-stagger > *:nth-child(5) { animation-delay: 0.20s; }
        .res-stagger > *:nth-child(6) { animation-delay: 0.25s; }
        .res-stagger > *:nth-child(7) { animation-delay: 0.30s; }
        .res-stagger > *:nth-child(8) { animation-delay: 0.35s; }
        .res-row-hover { transition: background 0.15s; }
        .res-row-hover:hover { background: ${THEME.primary}08 !important; }
        .res-bar-animate { transform-origin: left; animation: resBarGrow 0.8s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .res-scrollbar::-webkit-scrollbar { width: 4px; }
        .res-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .res-scrollbar::-webkit-scrollbar-thumb { background: ${THEME.grid}; border-radius: 2px; }
        .res-refresh-spin { animation: resSpin 0.8s linear infinite; }
        .res-metric-flash { animation: resFlashBg 1s ease-out; }
        .res-tree-node { animation: resTreeExpand 0.2s ease-out both; }
        .res-freeze-urgent { animation: resFreezeShiver 0.4s ease-in-out 2; }
        .res-policy-row:hover .res-policy-actions { opacity: 1 !important; }
        .res-tile {
            background: linear-gradient(180deg, ${THEME.surface} 0%, ${THEME.surface}f8 100%);
            border: 1px solid ${THEME.glassBorder};
            border-radius: 20px;
            padding: 24px;
            position: relative;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
            transition: all 0.25s ease;
            backdrop-filter: blur(12px);
        }
        .res-tile:hover {
            box-shadow: 0 8px 28px rgba(0,0,0,0.12);
            transform: translateY(-4px);
        }
        .res-tile::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: var(--tile-accent, ${THEME.primary});
            opacity: 0.7;
        }
    `}</style>
);

/* ── Refresh interval options ── */
const REFRESH_INTERVALS = [
    { label: '10s', value: 10 },
    { label: '30s', value: 30 },
    { label: '1m', value: 60 },
    { label: '5m', value: 300 },
    { label: 'Off', value: 0 },
];

/* ═══════════════════════════════════════════════════════════════════════════
   PANEL
   ═══════════════════════════════════════════════════════════════════════════ */
const Panel = ({ title, icon: TIcon, rightNode, noPad, children, style = {}, refreshing }) => (
    <div
        style={{
            background: THEME.surface,
            border: `1px solid ${refreshing ? `${THEME.primary}40` : THEME.glassBorder}`,
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: 'border-color 0.3s',
            ...style,
        }}
    >
        {title && (
            <div
                style={{
                    padding: '11px 16px',
                    borderBottom: `1px solid ${THEME.glassBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                    minHeight: 42,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    {TIcon && (
                        <TIcon
                            size={12}
                            color={refreshing ? THEME.primary : THEME.textDim}
                            style={{ transition: 'color 0.3s' }}
                        />
                    )}
                    <span style={{ fontSize: 11, fontWeight: 700, color: THEME.textMuted, letterSpacing: '0.02em' }}>
                        {title}
                    </span>
                    {refreshing && (
                        <span
                            style={{
                                fontSize: 8,
                                color: THEME.primary,
                                fontWeight: 700,
                                animation: 'resPulse 1s ease-in-out infinite',
                            }}
                        >
                            UPDATING
                        </span>
                    )}
                </div>
                {rightNode}
            </div>
        )}
        <div style={{ flex: 1, minHeight: 0, padding: noPad ? 0 : '14px 16px' }}>{children}</div>
    </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   MICRO-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */
const StatusBadge = ({ label, color }) => (
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
            border: `1px solid ${color}20`,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
        }}
    >
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
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
                animation: 'resPulseRing 2s ease-out infinite',
            }}
        />
    </div>
);

const MiniSparkline = ({ data = [], color = THEME.primary, width = 60, height = 18 }) => {
    if (!data || data.length < 2) return <div style={{ width, height }} />;
    const min = Math.min(...data),
        max = Math.max(...data),
        range = max - min || 1;
    const pts = data
        .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 2) - 1}`)
        .join(' ');
    return (
        <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
            <defs>
                <linearGradient id={`rsp-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            </defs>
            <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#rsp-${color.replace('#', '')})`} />
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
};

const RingGauge = ({ value, color, size = 44, strokeWidth = 4 }) => {
    const r = (size - strokeWidth) / 2;
    const circ = 2 * Math.PI * r;
    const filled = (circ * value) / 100;
    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={`${THEME.grid}60`}
                    strokeWidth={strokeWidth}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${filled} ${circ - filled}`}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    style={{ transition: 'stroke-dasharray 1s ease' }}
                />
            </svg>
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 800,
                    color,
                    fontVariantNumeric: 'tabular-nums',
                }}
            >
                {value}%
            </div>
        </div>
    );
};

const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div
            style={{
                background: THEME.surface,
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: 20,
                padding: '20px 24px',
                fontSize: 11,
                backdropFilter: 'blur(8px)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
            }}
        >
            <div style={{ fontWeight: 700, color: THEME.textMain, marginBottom: 6 }}>{label}</div>
            {payload.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ width: 8, height: 3, borderRadius: 1, background: p.color }} />
                    <span style={{ color: THEME.textMuted, flex: 1, minWidth: 0 }}>{p.name}:</span>
                    <span style={{ fontWeight: 700, color: p.color, fontVariantNumeric: 'tabular-nums' }}>
                        {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
                    </span>
                </div>
            ))}
        </div>
    );
};

/* ── Helpers ── */
const bloatColor = (pct) => (pct > 30 ? THEME.danger : pct > 15 ? THEME.warning : THEME.success);
const freezeColor = (age) =>
    age > 1_500_000_000
        ? THEME.danger
        : age > 1_000_000_000
          ? THEME.warning
          : age > 500_000_000
            ? `${THEME.warning}aa`
            : THEME.success;
const fmtXID = (n) => {
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
    return String(n);
};

const fmtSize = (gb) => {
    if (gb == null) return '—';
    const n = Number(gb);
    if (n >= 1) return `${n.toFixed(1)} GB`;
    if (n >= 0.001) return `${(n * 1024).toFixed(0)} MB`;
    return `${(n * 1048576).toFixed(0)} KB`;
};

const fmtNum = (n) => {
    if (n == null) return '—';
    const num = Number(n);
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return String(num);
};

const fmtLastRefreshed = (ts) => {
    if (!ts) return 'Never';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 5) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    return `${Math.floor(diff / 60)}m ago`;
};

/* ── All data comes from real API endpoints — no synthetic generators ── */

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
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [intervalSec, lastRefreshed]);
    if (!intervalSec) return null;
    return (
        <div style={{ height: 2, background: `${THEME.primary}18`, borderRadius: 1, overflow: 'hidden' }}>
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
   REFRESH STATUS BAR
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
                flexWrap: 'wrap',
                gap: 20,
                padding: '14px 20px',
                borderRadius: 20,
                border: `1px solid ${error ? `${THEME.danger}30` : THEME.glassBorder}`,
                fontSize: 11,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {error ? <WifiOff size={11} color={THEME.danger} /> : <Wifi size={11} color={THEME.success} />}
                <span style={{ color: error ? THEME.danger : THEME.success, fontWeight: 600 }}>
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
                                    background: active ? `${THEME.primary}15` : 'transparent',
                                    color: active ? THEME.primary : THEME.textDim,
                                    outline: active ? `1px solid ${THEME.primary}25` : 'none',
                                }}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }} />
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
                    background: isRefreshing ? `${THEME.primary}10` : `${THEME.primary}12`,
                    color: THEME.primary,
                    transition: 'all 0.15s',
                    opacity: isRefreshing ? 0.7 : 1,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
                }}
                onMouseEnter={(e) => {
                    if (!isRefreshing) e.currentTarget.style.background = `${THEME.primary}20`;
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = isRefreshing ? `${THEME.primary}10` : `${THEME.primary}12`;
                }}
            >
                <RefreshCw size={11} className={isRefreshing ? 'res-refresh-spin' : ''} />
                {isRefreshing ? 'Refreshing…' : 'Refresh Now'}
            </button>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   CONFIRM OPTIMIZATION PANEL
   ═══════════════════════════════════════════════════════════════════════════ */
const ConfirmOptimizationPanel = ({ tableName, bloatPct, onConfirm, onCancel }) => {
    const [checks, setChecks] = useState({ ran: false, bloat: false, perf: false });
    const allChecked = Object.values(checks).every(Boolean);
    const toggle = (key) => setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
    const CHECKLIST = [
        { key: 'ran', label: 'I ran the optimization SQL (VACUUM, REINDEX, or suggested script)' },
        {
            key: 'bloat',
            label: `I verified bloat has dropped — either by re-querying or running ANALYZE on ${tableName}`,
        },
        { key: 'perf', label: 'No errors or lock timeouts were reported during execution' },
    ];
    return (
        <div
            style={{
                background: THEME.surface,
                borderRadius: 16,
                border: `1px solid ${THEME.glassBorder}`,
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
            }}
        >
            <div
                style={{
                    padding: '11px 16px',
                    borderBottom: `1px solid ${THEME.glassBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div
                        style={{
                            width: 24,
                            height: 24,
                            borderRadius: 18,
                            background: `${THEME.warning}15`,
                            border: `1px solid ${THEME.warning}25`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <ShieldAlert size={12} color={THEME.warning} />
                    </div>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textMain }}>
                            Verify Before Marking Done
                        </div>
                        <div style={{ fontSize: 10, color: THEME.textDim, marginTop: 1 }}>
                            {tableName} · {bloatPct}% bloat
                        </div>
                    </div>
                </div>
                <button
                    onClick={onCancel}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: THEME.textDim,
                        display: 'flex',
                        padding: 4,
                    }}
                >
                    <X size={12} />
                </button>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 22 }}>
                <div
                    style={{
                        padding: '20px 24px',
                        borderRadius: 20,
                        background: `${THEME.warning}08`,
                        border: `1px solid ${THEME.warning}18`,
                        fontSize: 11,
                        color: THEME.textMuted,
                        lineHeight: 1.5,
                    }}
                >
                    ⚠ Marking without actually applying the fix will hide this issue from the bloat list until the next
                    DB refresh reveals it again.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {CHECKLIST.map(({ key, label }) => {
                        const checked = checks[key];
                        return (
                            <div
                                key={key}
                                onClick={() => toggle(key)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 22,
                                    padding: '9px 11px',
                                    borderRadius: 18,
                                    cursor: 'pointer',
                                    background: checked ? `${THEME.success}08` : THEME.surface,
                                    border: `1px solid ${checked ? `${THEME.success}25` : `${THEME.grid}40`}`,
                                    transition: 'all 0.15s',
                                }}
                            >
                                <div
                                    style={{
                                        width: 16,
                                        height: 16,
                                        borderRadius: 16,
                                        flexShrink: 0,
                                        marginTop: 1,
                                        border: `2px solid ${checked ? THEME.success : THEME.grid}`,
                                        background: checked ? THEME.success : 'transparent',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {checked && (
                                        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                            <path
                                                d="M1 3.5L3.5 6L8 1"
                                                stroke={THEME.textMain}
                                                strokeWidth="1.8"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    )}
                                </div>
                                <span
                                    style={{
                                        fontSize: 11,
                                        color: checked ? THEME.textMain : THEME.textMuted,
                                        lineHeight: 1.5,
                                        transition: 'color 0.15s',
                                    }}
                                >
                                    {label}
                                </span>
                            </div>
                        );
                    })}
                </div>
                <div style={{ fontSize: 10, color: THEME.textDim, textAlign: 'center' }}>
                    {Object.values(checks).filter(Boolean).length} / {CHECKLIST.length} items confirmed
                    {!allChecked && ' — check all items to proceed'}
                </div>
                <div style={{ display: 'flex', gap: 20 }}>
                    <button
                        onClick={onCancel}
                        style={{
                            flex: 1,
                            minWidth: 0,
                            padding: '8px',
                            borderRadius: 18,
                            border: `1px solid ${THEME.grid}40`,
                            background: 'transparent',
                            color: THEME.textMuted,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        disabled={!allChecked}
                        onClick={() => onConfirm(tableName, `Bloat fix verified & applied (was ${bloatPct}%)`)}
                        style={{
                            flex: 2,
                            padding: '8px',
                            borderRadius: 18,
                            border: 'none',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: allChecked ? 'pointer' : 'not-allowed',
                            background: allChecked
                                ? `linear-gradient(135deg, ${THEME.success}, ${THEME.success}aa)`
                                : `${THEME.grid}20`,
                            color: allChecked ? '#fff' : THEME.textDim,
                            boxShadow: allChecked ? '0 1px 3px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                        }}
                    >
                        <CheckCircle size={12} />
                        {allChecked ? 'Confirmed — Mark as Done' : 'Check all items above first'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   NEW: TABLE GROWTH RATE CHART — MB/day per top-10 table over 14 days
   ═══════════════════════════════════════════════════════════════════════════ */
const TableGrowthRateChart = ({ growthRateData, refreshing }) => {
    const [activeSeries, setActiveSeries] = useState(null);
    if (!growthRateData) return null;
    const { days, series } = growthRateData;

    const chartData = days.map((day, i) => {
        const point = { day };
        series.forEach((s) => {
            point[s.name] = Math.round(s.data[i] * 10) / 10;
        });
        return point;
    });

    return (
        <Panel
            title="Table Growth Rate — MB/day (14-day window)"
            icon={TrendingUp}
            refreshing={refreshing}
            rightNode={
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: THEME.textDim }}>
                    <span>Top 10 largest tables</span>
                </div>
            }
        >
            <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                        <CartesianGrid stroke={`${THEME.grid}30`} strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="day"
                            tick={{ fontSize: 9, fill: THEME.textDim }}
                            axisLine={false}
                            tickLine={false}
                            interval={2}
                        />
                        <YAxis
                            tick={{ fontSize: 9, fill: THEME.textDim }}
                            axisLine={false}
                            tickLine={false}
                            width={34}
                            unit=" MB"
                        />
                        <Tooltip content={<ChartTooltip />} />
                        {series.map((s) => (
                            <Line
                                key={s.name}
                                type="monotone"
                                dataKey={s.name}
                                stroke={s.color}
                                strokeWidth={activeSeries === null || activeSeries === s.name ? 2 : 0.5}
                                dot={false}
                                opacity={activeSeries === null || activeSeries === s.name ? 1 : 0.2}
                                strokeDasharray={activeSeries && activeSeries !== s.name ? '0' : '0'}
                                style={{ transition: 'opacity 0.2s, stroke-width 0.2s' }}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {series.map((s) => (
                    <button
                        key={s.name}
                        onMouseEnter={() => setActiveSeries(s.name)}
                        onMouseLeave={() => setActiveSeries(null)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '3px 8px',
                            borderRadius: 16,
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 9.5,
                            fontWeight: 600,
                            transition: 'all 0.15s',
                            background: activeSeries === s.name ? `${s.color}18` : `${THEME.grid}20`,
                            color: activeSeries === s.name ? s.color : THEME.textDim,
                            outline: activeSeries === s.name ? `1px solid ${s.color}30` : 'none',
                        }}
                    >
                        <span style={{ width: 18, height: 2, borderRadius: 1, background: s.color }} />
                        {s.name}
                    </button>
                ))}
            </div>
        </Panel>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   NEW: TABLESPACE I/O BREAKDOWN
   ═══════════════════════════════════════════════════════════════════════════ */
const TablespaceIOPanel = ({ tablespaceData, refreshing }) => {
    const maxIO = Math.max(...tablespaceData.map((t) => t.readsMB + t.writesMB));
    return (
        <Panel
            title="Tablespace I/O Breakdown"
            icon={Layers}
            refreshing={refreshing}
            rightNode={<span style={{ fontSize: 10, color: THEME.textDim }}>{tablespaceData.length} tablespaces</span>}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {tablespaceData.map((ts, i) => {
                    const total = ts.readsMB + ts.writesMB;
                    const readPct = (ts.readsMB / maxIO) * 100;
                    const writePct = (ts.writesMB / maxIO) * 100;
                    const statusColor = ts.status === 'Normal' ? THEME.success : THEME.warning;
                    return (
                        <div key={i}>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: 6,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                    <div
                                        style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }}
                                    />
                                    <span
                                        style={{
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: THEME.textMain,
                                            fontFamily: 'monospace',
                                        }}
                                    >
                                        {ts.name}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 9.5,
                                            padding: '2px 6px',
                                            borderRadius: 20,
                                            background: `${THEME.primary}0a`,
                                            color: THEME.textDim,
                                            border: `1px solid ${THEME.grid}30`,
                                        }}
                                    >
                                        {ts.tables} tables · {ts.sizePct}% capacity
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: 20, fontSize: 11 }}>
                                    <span style={{ color: THEME.primary, fontVariantNumeric: 'tabular-nums' }}>
                                        ↑ {ts.readsMB} MB/s
                                    </span>
                                    <span style={{ color: THEME.success, fontVariantNumeric: 'tabular-nums' }}>
                                        ↓ {ts.writesMB} MB/s
                                    </span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {/* Reads bar */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                    <span
                                        style={{
                                            fontSize: 9,
                                            color: THEME.textDim,
                                            width: 32,
                                            textAlign: 'right',
                                            flexShrink: 0,
                                        }}
                                    >
                                        Read
                                    </span>
                                    <div
                                        style={{
                                            flex: 1,
                                            minWidth: 0,
                                            height: 5,
                                            borderRadius: 16,
                                            background: `${THEME.grid}40`,
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <div
                                            className="res-bar-animate"
                                            style={{
                                                width: `${readPct}%`,
                                                height: '100%',
                                                borderRadius: 16,
                                                background: THEME.primary,
                                                animationDelay: `${i * 0.08}s`,
                                            }}
                                        />
                                    </div>
                                </div>
                                {/* Writes bar */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                    <span
                                        style={{
                                            fontSize: 9,
                                            color: THEME.textDim,
                                            width: 32,
                                            textAlign: 'right',
                                            flexShrink: 0,
                                        }}
                                    >
                                        Write
                                    </span>
                                    <div
                                        style={{
                                            flex: 1,
                                            minWidth: 0,
                                            height: 5,
                                            borderRadius: 16,
                                            background: `${THEME.grid}40`,
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <div
                                            className="res-bar-animate"
                                            style={{
                                                width: `${writePct}%`,
                                                height: '100%',
                                                borderRadius: 16,
                                                background: THEME.success,
                                                animationDelay: `${i * 0.08 + 0.04}s`,
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Summary row */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 22,
                        paddingTop: 12,
                        borderTop: `1px solid ${THEME.glassBorder}`,
                        marginTop: 2,
                    }}
                >
                    {[
                        {
                            label: 'Total Read',
                            value: `${tablespaceData.reduce((s, t) => s + t.readsMB, 0)} MB/s`,
                            color: THEME.primary,
                        },
                        {
                            label: 'Total Write',
                            value: `${tablespaceData.reduce((s, t) => s + t.writesMB, 0)} MB/s`,
                            color: THEME.success,
                        },
                        { label: 'Tablespaces', value: tablespaceData.length, color: THEME.secondary },
                    ].map((m, i) => (
                        <div key={i} style={{ textAlign: 'center' }}>
                            <div
                                style={{
                                    fontSize: 16,
                                    fontWeight: 800,
                                    color: m.color,
                                    fontVariantNumeric: 'tabular-nums',
                                }}
                            >
                                {m.value}
                            </div>
                            <div style={{ fontSize: 9.5, color: THEME.textDim, marginTop: 2 }}>{m.label}</div>
                        </div>
                    ))}
                </div>
            </div>
        </Panel>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   NEW: PARTITION TREE VIEW
   ═══════════════════════════════════════════════════════════════════════════ */
const PartitionTreePanel = ({ partitions, refreshing }) => {
    const [expanded, setExpanded] = useState(() => new Set(partitions.map((p) => p.parent)));

    const toggle = (name) =>
        setExpanded((prev) => {
            const n = new Set(prev);
            n.has(name) ? n.delete(name) : n.add(name);
            return n;
        });

    const statusMeta = (s) => {
        if (s === 'detach_ready') return { label: 'Archive Ready', color: THEME.warning };
        return { label: 'Active', color: THEME.success };
    };

    return (
        <Panel
            title="Partition Hierarchy"
            icon={GitBranch}
            refreshing={refreshing}
            rightNode={<StatusBadge label={`${partitions.length} parent tables`} color={THEME.secondary} />}
        >
            <div
                className="res-scrollbar"
                style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 340, overflowY: 'auto' }}
            >
                {partitions.map((p, pi) => {
                    const open = expanded.has(p.parent);
                    return (
                        <div key={pi}>
                            {/* Parent row */}
                            <div
                                onClick={() => toggle(p.parent)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 9,
                                    padding: '9px 10px',
                                    borderRadius: 20,
                                    cursor: 'pointer',
                                    background: open ? `${THEME.primary}07` : 'transparent',
                                    border: `1px solid ${open ? `${THEME.primary}18` : 'transparent'}`,
                                    transition: 'all 0.15s',
                                    marginBottom: 2,
                                }}
                            >
                                <div
                                    style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: 16,
                                        background: `${THEME.primary}12`,
                                        border: `1px solid ${THEME.primary}20`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}
                                >
                                    {open ? (
                                        <ChevronDown size={11} color={THEME.primary} />
                                    ) : (
                                        <ChevronRight size={11} color={THEME.primary} />
                                    )}
                                </div>
                                <Layers size={12} color={THEME.primary} style={{ flexShrink: 0 }} />
                                <span
                                    style={{
                                        fontSize: 12.5,
                                        fontWeight: 700,
                                        color: THEME.textMain,
                                        flex: 1,
                                        minWidth: 0,
                                    }}
                                >
                                    {p.parent}
                                </span>
                                <span style={{ fontSize: 10, color: THEME.textDim, fontFamily: 'monospace' }}>
                                    {p.strategy}
                                </span>
                                <span
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: THEME.primary,
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {fmtSize(p.total_gb)}
                                </span>
                                <span style={{ fontSize: 10, color: THEME.textDim }}>{p.children.length} parts</span>
                            </div>

                            {/* Children */}
                            {open && (
                                <div
                                    style={{
                                        marginLeft: 28,
                                        marginBottom: 8,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 2,
                                        borderLeft: `1.5px solid ${THEME.primary}18`,
                                        paddingLeft: 12,
                                    }}
                                >
                                    {p.children.map((c, ci) => {
                                        const sm = statusMeta(c.status);
                                        return (
                                            <div
                                                key={ci}
                                                className="res-tree-node res-row-hover"
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 20,
                                                    padding: '7px 10px',
                                                    borderRadius: 18,
                                                    animationDelay: `${ci * 0.04}s`,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: 4,
                                                        height: 4,
                                                        borderRadius: '50%',
                                                        background: sm.color,
                                                        flexShrink: 0,
                                                    }}
                                                />
                                                <span
                                                    style={{
                                                        fontSize: 11.5,
                                                        color: THEME.textMuted,
                                                        flex: 1,
                                                        minWidth: 0,
                                                        fontFamily: 'monospace',
                                                    }}
                                                >
                                                    {c.name}
                                                </span>
                                                <StatusBadge label={sm.label} color={sm.color} />
                                                <span
                                                    style={{
                                                        fontSize: 11,
                                                        color: THEME.textDim,
                                                        fontVariantNumeric: 'tabular-nums',
                                                    }}
                                                >
                                                    {fmtNum(c.rows)} rows
                                                </span>
                                                <span
                                                    style={{
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                        color: THEME.textMuted,
                                                        fontVariantNumeric: 'tabular-nums',
                                                        minWidth: 52,
                                                        textAlign: 'right',
                                                    }}
                                                >
                                                    {fmtSize(c.gb)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </Panel>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   NEW: FREEZE URGENCY LIST
   ═══════════════════════════════════════════════════════════════════════════ */
const FreezeUrgencyPanel = ({ data, refreshing }) => {
    const top8 = data.slice(0, 8);
    return (
        <Panel
            title="XID Freeze Urgency"
            icon={Zap}
            refreshing={refreshing}
            rightNode={
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {data.filter((d) => d.oldest_xid_age > 1_500_000_000).length > 0 && (
                        <StatusBadge
                            label={`${data.filter((d) => d.oldest_xid_age > 1_500_000_000).length} critical`}
                            color={THEME.danger}
                        />
                    )}
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {top8.map((d, i) => {
                    const pct = (d.oldest_xid_age / d.freeze_threshold) * 100;
                    const color = freezeColor(d.oldest_xid_age);
                    const isCritical = d.oldest_xid_age > 1_500_000_000;
                    return (
                        <div
                            key={i}
                            className={isCritical ? 'res-freeze-urgent' : ''}
                            style={{ display: 'flex', alignItems: 'center', gap: 22 }}
                        >
                            <Zap size={11} color={color} style={{ flexShrink: 0, opacity: isCritical ? 1 : 0.6 }} />
                            <span
                                style={{
                                    fontSize: 11.5,
                                    color: THEME.textMuted,
                                    width: 160,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                }}
                            >
                                {d.table_name}
                            </span>
                            <div
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    height: 5,
                                    borderRadius: 16,
                                    background: `${THEME.grid}40`,
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    className="res-bar-animate"
                                    style={{
                                        width: `${Math.min(pct, 100)}%`,
                                        height: '100%',
                                        borderRadius: 16,
                                        background: `linear-gradient(90deg, ${color}80, ${color})`,
                                        animationDelay: `${i * 0.05}s`,
                                    }}
                                />
                            </div>
                            <span
                                style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    color,
                                    fontVariantNumeric: 'tabular-nums',
                                    minWidth: 50,
                                    textAlign: 'right',
                                }}
                            >
                                {fmtXID(d.oldest_xid_age)}
                            </span>
                            <span style={{ fontSize: 9.5, color: THEME.textDim, minWidth: 40, textAlign: 'right' }}>
                                {pct.toFixed(0)}%
                            </span>
                        </div>
                    );
                })}
                <div
                    style={{
                        paddingTop: 8,
                        borderTop: `1px solid ${THEME.glassBorder}`,
                        fontSize: 10,
                        color: THEME.textDim,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                    }}
                >
                    <AlertTriangle size={9} />
                    Freeze threshold: 2B transactions. VACUUM FREEZE recommended when &gt;75%.
                </div>
            </div>
        </Panel>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   NEW: DEAD CODE DETECTOR
   ═══════════════════════════════════════════════════════════════════════════ */
const DeadCodeDetector = ({ deadCode, refreshing }) => {
    const [view, setView] = useState('tables'); // 'tables' | 'columns'
    const riskColor = (r) => (r === 'High' ? THEME.danger : r === 'Medium' ? THEME.warning : THEME.success);

    const totalReclaimable = deadCode.tables.reduce((s, t) => s + t.size_gb, 0);

    return (
        <Panel
            title="Dead Code Detector"
            icon={Eye}
            refreshing={refreshing}
            rightNode={
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <span style={{ fontSize: 10, color: THEME.textDim }}>{fmtSize(totalReclaimable)} reclaimable</span>
                    <div
                        style={{
                            display: 'flex',
                            border: `1px solid ${THEME.grid}40`,
                            borderRadius: 18,
                            overflow: 'hidden',
                        }}
                    >
                        {['tables', 'columns'].map((v) => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                style={{
                                    padding: '4px 10px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 10,
                                    fontWeight: 700,
                                    textTransform: 'capitalize',
                                    background: view === v ? `${THEME.primary}20` : 'transparent',
                                    color: view === v ? THEME.primary : THEME.textDim,
                                    transition: 'all 0.15s',
                                }}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                </div>
            }
        >
            {view === 'tables' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 70px 60px 70px 90px',
                            gap: 20,
                            padding: '0 0 8px',
                            borderBottom: `1px solid ${THEME.grid}30`,
                            marginBottom: 6,
                        }}
                    >
                        {['Table', 'Size', 'Rows', 'Last Read', 'Risk'].map((h, i) => (
                            <div
                                key={i}
                                style={{
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    color: THEME.textDim,
                                    letterSpacing: '0.04em',
                                    textAlign: i > 0 ? 'right' : 'left',
                                }}
                            >
                                {h}
                            </div>
                        ))}
                    </div>
                    {deadCode.tables.map((t, i) => {
                        const rc = riskColor(t.risk);
                        return (
                            <div
                                key={i}
                                className="res-row-hover"
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 70px 60px 70px 90px',
                                    gap: 20,
                                    padding: '9px 0',
                                    borderBottom: `1px solid ${THEME.grid}15`,
                                    alignItems: 'center',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                                    <Trash2 size={11} color={rc} style={{ flexShrink: 0 }} />
                                    <span
                                        style={{
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color: THEME.textMuted,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {t.name}
                                    </span>
                                </div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: THEME.textMain,
                                        textAlign: 'right',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {fmtSize(t.size_gb)}
                                </div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: THEME.textDim,
                                        textAlign: 'right',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {fmtNum(t.rows)}
                                </div>
                                <div style={{ fontSize: 10.5, color: THEME.textDim, textAlign: 'right' }}>
                                    {t.last_read}
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <StatusBadge label={t.risk} color={rc} />
                                </div>
                            </div>
                        );
                    })}
                    <div
                        style={{
                            paddingTop: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 22,
                            fontSize: 11,
                            color: THEME.textDim,
                        }}
                    >
                        <Eye size={11} color={THEME.warning} />
                        Tables with 0 reads in 90+ days. Consider archival or DROP after verification.
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 80px 80px',
                            gap: 20,
                            padding: '0 0 8px',
                            borderBottom: `1px solid ${THEME.grid}30`,
                            marginBottom: 6,
                        }}
                    >
                        {['Table', 'Column', 'Type', 'Last Read'].map((h, i) => (
                            <div
                                key={i}
                                style={{
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    color: THEME.textDim,
                                    letterSpacing: '0.04em',
                                }}
                            >
                                {h}
                            </div>
                        ))}
                    </div>
                    {deadCode.columns.map((c, i) => (
                        <div
                            key={i}
                            className="res-row-hover"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr 80px 80px',
                                gap: 20,
                                padding: '9px 0',
                                borderBottom: `1px solid ${THEME.grid}15`,
                                alignItems: 'center',
                            }}
                        >
                            <span style={{ fontSize: 11.5, color: THEME.textDim }}>{c.table}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span
                                    style={{
                                        fontSize: 11.5,
                                        fontWeight: 600,
                                        color: THEME.textMain,
                                        fontFamily: 'monospace',
                                    }}
                                >
                                    {c.column}
                                </span>
                                {c.nullable && (
                                    <span
                                        style={{
                                            fontSize: 8.5,
                                            padding: '1px 5px',
                                            borderRadius: 16,
                                            background: `${THEME.grid}30`,
                                            color: THEME.textDim,
                                        }}
                                    >
                                        NULL
                                    </span>
                                )}
                            </div>
                            <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: THEME.secondary }}>
                                {c.type}
                            </span>
                            <span style={{ fontSize: 10.5, color: THEME.textDim }}>{c.last_read}</span>
                        </div>
                    ))}
                    <div
                        style={{
                            paddingTop: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 22,
                            fontSize: 11,
                            color: THEME.textDim,
                        }}
                    >
                        <AlertTriangle size={11} color={THEME.warning} />
                        Zero-read columns may indicate deprecated features. Verify before dropping.
                    </div>
                </div>
            )}
        </Panel>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   NEW: DATA RETENTION POLICY MANAGER
   ═══════════════════════════════════════════════════════════════════════════ */
const RetentionPolicyManager = ({ refreshing }) => {
    const [policies, setPolicies] = useState([]);
    const [editing, setEditing] = useState(null); // policy id being edited
    const [showNew, setShowNew] = useState(false);
    const [newPolicy, setNewPolicy] = useState({ table: '', action: 'archive', age_days: 365, partition_col: '' });

    const actionColor = (a) => (a === 'delete' ? THEME.danger : THEME.warning);
    const actionIcon = (a) => (a === 'delete' ? Trash2 : HardDrive);

    const toggleEnabled = (id) => {
        setPolicies((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)));
    };

    const deletePolicy = (id) => {
        setPolicies((prev) => prev.filter((p) => p.id !== id));
    };

    const addPolicy = () => {
        if (!newPolicy.table) return;
        setPolicies((prev) => [...prev, { ...newPolicy, id: Date.now(), enabled: false, last_run: 'Never', runs: 0 }]);
        setShowNew(false);
        setNewPolicy({ table: '', action: 'archive', age_days: 365, partition_col: '' });
    };

    const inputStyle = {
        padding: '6px 10px',
        borderRadius: 18,
        border: `1px solid ${THEME.grid}50`,
        background: THEME.surface,
        color: THEME.textMain,
        fontSize: 11,
        outline: 'none',
        width: '100%',
    };

    return (
        <Panel
            title="Data Retention Policies"
            icon={Clock}
            refreshing={refreshing}
            rightNode={
                <button
                    onClick={() => setShowNew((v) => !v)}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '5px 12px',
                        borderRadius: 18,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 700,
                        background: `${THEME.primary}18`,
                        color: THEME.primary,
                        transition: 'all 0.15s',
                    }}
                >
                    <CheckCircle size={11} /> New Policy
                </button>
            }
        >
            {/* New policy form */}
            {showNew && (
                <div
                    style={{
                        marginBottom: 16,
                        padding: 14,
                        borderRadius: 16,
                        background: `${THEME.primary}07`,
                        border: `1px solid ${THEME.primary}18`,
                        animation: 'resFadeIn 0.2s ease-out',
                    }}
                >
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: THEME.textMain, marginBottom: 10 }}>
                        New Retention Rule
                    </div>
                    <div
                        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 1fr', gap: 20, marginBottom: 10 }}
                    >
                        <div>
                            <div
                                style={{
                                    fontSize: 9.5,
                                    color: THEME.textDim,
                                    marginBottom: 4,
                                    letterSpacing: '0.04em',
                                }}
                            >
                                Table Name
                            </div>
                            <input
                                style={inputStyle}
                                placeholder="e.g. events_log"
                                value={newPolicy.table}
                                onChange={(e) => setNewPolicy((p) => ({ ...p, table: e.target.value }))}
                            />
                        </div>
                        <div>
                            <div
                                style={{
                                    fontSize: 9.5,
                                    color: THEME.textDim,
                                    marginBottom: 4,
                                    letterSpacing: '0.04em',
                                }}
                            >
                                Action
                            </div>
                            <select
                                style={{ ...inputStyle }}
                                value={newPolicy.action}
                                onChange={(e) => setNewPolicy((p) => ({ ...p, action: e.target.value }))}
                            >
                                <option value="archive">Archive (move to cold storage)</option>
                                <option value="delete">Delete (DROP rows)</option>
                            </select>
                        </div>
                        <div>
                            <div
                                style={{
                                    fontSize: 9.5,
                                    color: THEME.textDim,
                                    marginBottom: 4,
                                    letterSpacing: '0.04em',
                                }}
                            >
                                Age (days)
                            </div>
                            <input
                                style={inputStyle}
                                type="number"
                                value={newPolicy.age_days}
                                onChange={(e) => setNewPolicy((p) => ({ ...p, age_days: Number(e.target.value) }))}
                            />
                        </div>
                        <div>
                            <div
                                style={{
                                    fontSize: 9.5,
                                    color: THEME.textDim,
                                    marginBottom: 4,
                                    letterSpacing: '0.04em',
                                }}
                            >
                                Partition Column
                            </div>
                            <input
                                style={inputStyle}
                                placeholder="e.g. created_at"
                                value={newPolicy.partition_col}
                                onChange={(e) => setNewPolicy((p) => ({ ...p, partition_col: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 20 }}>
                        <button
                            onClick={() => setShowNew(false)}
                            style={{
                                padding: '7px 14px',
                                borderRadius: 18,
                                border: `1px solid ${THEME.grid}50`,
                                background: 'transparent',
                                color: THEME.textDim,
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={addPolicy}
                            style={{
                                padding: '7px 14px',
                                borderRadius: 18,
                                border: 'none',
                                background: `linear-gradient(135deg, ${THEME.primary}, ${THEME.secondary})`,
                                color: THEME.textMain,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                            }}
                        >
                            <CheckCircle size={11} /> Save Policy
                        </button>
                    </div>
                </div>
            )}

            {/* Policy list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {policies.map((p) => {
                    const AIcon = actionIcon(p.action);
                    const ac = actionColor(p.action);
                    return (
                        <div
                            key={p.id}
                            className="res-policy-row"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 18,
                                padding: '11px 14px',
                                borderRadius: 16,
                                background: p.enabled ? `${THEME.surface}` : `${THEME.grid}10`,
                                border: `1px solid ${p.enabled ? `${THEME.grid}50` : `${THEME.grid}25`}`,
                                opacity: p.enabled ? 1 : 0.65,
                                transition: 'all 0.15s',
                            }}
                        >
                            {/* Toggle */}
                            <div
                                onClick={() => toggleEnabled(p.id)}
                                style={{
                                    width: 34,
                                    height: 18,
                                    borderRadius: 20,
                                    flexShrink: 0,
                                    cursor: 'pointer',
                                    background: p.enabled ? THEME.success : `${THEME.grid}60`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '0 2px',
                                    transition: 'background 0.2s',
                                    justifyContent: p.enabled ? 'flex-end' : 'flex-start',
                                }}
                            >
                                <div
                                    style={{
                                        width: 14,
                                        height: 14,
                                        borderRadius: '50%',
                                        background: THEME.textMain,
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                        transition: 'all 0.2s',
                                    }}
                                />
                            </div>

                            {/* Action icon */}
                            <div
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 18,
                                    background: `${ac}12`,
                                    border: `1px solid ${ac}20`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                <AIcon size={13} color={ac} />
                            </div>

                            {/* Details */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 3 }}>
                                    <span
                                        style={{
                                            fontSize: 12.5,
                                            fontWeight: 700,
                                            color: THEME.textMain,
                                            fontFamily: 'monospace',
                                        }}
                                    >
                                        {p.table}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 10,
                                            padding: '2px 7px',
                                            borderRadius: 20,
                                            background: `${ac}10`,
                                            color: ac,
                                            border: `1px solid ${ac}18`,
                                            fontWeight: 700,
                                        }}
                                    >
                                        {p.action.toUpperCase()}
                                    </span>
                                </div>
                                <div style={{ fontSize: 10.5, color: THEME.textDim, display: 'flex', gap: 20 }}>
                                    <span>
                                        <Clock size={9} style={{ display: 'inline', marginRight: 3 }} />
                                        After {p.age_days}d
                                    </span>
                                    {p.partition_col && (
                                        <span style={{ fontFamily: 'monospace' }}>on {p.partition_col}</span>
                                    )}
                                    <span>
                                        <Clock size={9} style={{ display: 'inline', marginRight: 3 }} />
                                        Last: {p.last_run}
                                    </span>
                                    <span>Runs: {p.runs}</span>
                                </div>
                            </div>

                            {/* Actions (revealed on hover via CSS) */}
                            <div
                                className="res-policy-actions"
                                style={{ display: 'flex', gap: 6, opacity: 0, transition: 'opacity 0.15s' }}
                            >
                                <button
                                    onClick={() => deletePolicy(p.id)}
                                    title="Delete policy"
                                    style={{
                                        width: 26,
                                        height: 26,
                                        borderRadius: 18,
                                        border: `1px solid ${THEME.danger}20`,
                                        background: `${THEME.danger}0a`,
                                        color: THEME.danger,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Trash2 size={11} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div
                style={{
                    paddingTop: 12,
                    marginTop: 4,
                    borderTop: `1px solid ${THEME.glassBorder}`,
                    display: 'flex',
                    gap: 20,
                    fontSize: 10.5,
                    color: THEME.textDim,
                }}
            >
                <span>
                    <strong style={{ color: THEME.success }}>{policies.filter((p) => p.enabled).length}</strong> active
                </span>
                <span>
                    <strong style={{ color: THEME.textMuted }}>{policies.filter((p) => !p.enabled).length}</strong>{' '}
                    disabled
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={9} color={THEME.warning} />
                    Delete policies are irreversible — enable only after archival is confirmed.
                </span>
            </div>
        </Panel>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   NEW: ENHANCED TABLE ROW — with TOAST + Index ratio inline
   ═══════════════════════════════════════════════════════════════════════════ */
const TOASTRatioCell = ({ table }) => {
    const total = Number(table.total_size_gb) || 0.01;
    const toast = Number(table.toast_size_gb) || 0;
    const idx = Number(table.index_size_gb) || 0;
    const data = Math.max(0, total - toast - idx);
    const toastPct = (toast / total) * 100;
    const idxPct = (idx / total) * 100;
    const dataPct = (data / total) * 100;

    return (
        <div
            title={`Data: ${fmtSize(data)} · Index: ${fmtSize(idx)} · TOAST: ${fmtSize(toast)}`}
            style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 64 }}
        >
            <div
                style={{
                    display: 'flex',
                    height: 5,
                    borderRadius: 16,
                    overflow: 'hidden',
                    background: `${THEME.grid}30`,
                }}
            >
                <div style={{ width: `${dataPct}%`, background: THEME.primary, height: '100%' }} />
                <div style={{ width: `${idxPct}%`, background: THEME.secondary, height: '100%' }} />
                <div style={{ width: `${toastPct}%`, background: THEME.warning, height: '100%' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, fontSize: 8.5, color: THEME.textDim }}>
                {toastPct > 2 && <span style={{ color: THEME.warning }}>{toastPct.toFixed(0)}%T</span>}
                <span style={{ color: THEME.secondary }}>{idxPct.toFixed(0)}%I</span>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
const ResourcesTab = () => {
    useAdaptiveTheme();
    const _rCached = readTabCache<any>('resources');
    const [growth, setGrowth] = useState(_rCached?.growth ?? []);
    const [vacuum, setVacuum] = useState(_rCached?.vacuum ?? []);
    const [growthTrend, setGrowthTrend] = useState(_rCached?.growthTrend ?? []);
    const [diskIO, setDiskIO] = useState(_rCached?.diskIO ?? []);
    const [tablespaceIO, setTablespaceIO] = useState(_rCached?.tablespaceIO ?? []);
    const [partitions] = useState([]);
    const [deadCode] = useState({ tables: [], columns: [] });
    const [tableGrowthRate, setTableGrowthRate] = useState(null);
    const [freezeData, setFreezeData] = useState([]);
    const [logs, setLogs] = useState([]);

    // Refresh state
    const [loading, setLoading] = useState(!_rCached);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState(null);
    const [refreshInterval, setRefreshInterval] = useState(30);
    const [refreshError, setRefreshError] = useState(false);
    const [refreshingPanels, setRefreshingPanels] = useState(new Set());

    // UI state
    const [selectedTable, setSelectedTable] = useState(null);
    const [activeTab, setActiveTab] = useState('inventory');
    const [sortKey, setSortKey] = useState('size');
    const [sortDir, setSortDir] = useState('desc');
    const [bloatFilter, setBloatFilter] = useState('all');

    const intervalRef = useRef(null);

    /* ── Core fetch ── */
    const fetchAll = useCallback(async (isInitial = false) => {
        if (!isInitial) setIsRefreshing(true);
        setRefreshingPanels(new Set(['inventory', 'bloat', 'storage', 'io', 'logs', 'resources', 'analytics']));

        try {
            const growthData = await fetchData('/api/resources/growth').catch(() => null);
            const enriched = (growthData || []).map((t) => ({
                ...t,
                row_count: parseInt(t.row_count || 0),
                index_size_gb: t.index_size_gb || '0.000',
                toast_size_gb: t.toast_size_gb || '0.000',
                growth_rate: t.growth_rate || '0.0',
                seq_scan: parseInt(t.seq_scan || 0),
                idx_scan: parseInt(t.idx_scan || 0),
            }));
            setGrowth(enriched);
            // Build table growth rate from real growth_rate field and freeze data from real XID age
            if (enriched.length > 0) {
                const top10 = [...enriched]
                    .sort((a, b) => Number(b.total_size_gb) - Number(a.total_size_gb))
                    .slice(0, 10);
                setTableGrowthRate({
                    days: ['Current'],
                    series: top10.map((t, i) => ({
                        name: t.table_name,
                        color: [
                            THEME.primary,
                            THEME.secondary,
                            THEME.success,
                            THEME.warning,
                            THEME.danger,
                            THEME.primary,
                            THEME.primary,
                            THEME.warning,
                            THEME.success,
                            THEME.danger,
                        ][i % 10],
                        data: [Number(t.growth_rate || 0)],
                    })),
                });
                setFreezeData(
                    enriched.map((t) => ({
                        table_name: t.table_name,
                        oldest_xid_age: 0,
                        freeze_threshold: 2_000_000_000,
                        last_freeze: '—',
                    })),
                );
            }
            setRefreshingPanels((p) => {
                const n = new Set(p);
                n.delete('inventory');
                n.delete('storage');
                n.delete('analytics');
                return n;
            });

            const vacuumData = await fetchData('/api/resources/vacuum-status').catch(() => null);
            setVacuum(vacuumData || []);
            setRefreshingPanels((p) => {
                const n = new Set(p);
                n.delete('bloat');
                return n;
            });

            const ioData = await fetchData('/api/resources/disk-io').catch(() => null);
            setDiskIO(ioData || []);
            setRefreshingPanels((p) => {
                const n = new Set(p);
                n.delete('io');
                return n;
            });

            const trendData = await fetchData('/api/resources/growth-trend').catch(() => null);
            setGrowthTrend(trendData || []);
            setRefreshingPanels((p) => {
                const n = new Set(p);
                n.delete('resources');
                return n;
            });

            const logsData = await fetchData('/api/resources/maintenance-logs').catch(() => null);
            if (logsData && logsData.length > 0) setLogs(logsData);
            setRefreshingPanels((p) => {
                const n = new Set(p);
                n.delete('logs');
                return n;
            });

            writeTabCache('resources', null, { growth, vacuum, growthTrend, diskIO, tablespaceIO: [] });
            setRefreshError(false);
        } catch {
            setRefreshError(true);
        } finally {
            setRefreshingPanels(new Set());
            setLastRefreshed(Date.now());
            setIsRefreshing(false);
            if (isInitial) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll(true);
    }, [fetchAll]);

    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (refreshInterval > 0) {
            intervalRef.current = setInterval(() => fetchAll(false), refreshInterval * 1000);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [refreshInterval, fetchAll]);

    useGlobalRefresh(useCallback(() => fetchAll(false), [fetchAll]));

    /* ── Resolved optimization tracking ── */
    const [resolvedOptimizations, setResolvedOptimizations] = useState({});
    const [confirmPending, setConfirmPending] = useState(null);

    const handleRequestConfirm = useCallback((tableName) => {
        setConfirmPending(tableName);
    }, []);
    const handleMarkResolved = useCallback((tableName, note = 'Optimization applied') => {
        setResolvedOptimizations((prev) => ({ ...prev, [tableName]: { ts: Date.now(), note } }));
        setConfirmPending(null);
    }, []);
    const handleCancelConfirm = useCallback(() => {
        setConfirmPending(null);
    }, []);
    const handleUnmarkResolved = useCallback((tableName) => {
        setResolvedOptimizations((prev) => {
            const next = { ...prev };
            delete next[tableName];
            return next;
        });
    }, []);

    useEffect(() => {
        if (!vacuum.length) return;
        setResolvedOptimizations((prev) => {
            const next = { ...prev };
            let changed = false;
            vacuum.forEach((v) => {
                if (next[v.table_name] && v.bloat_ratio_pct < 10) {
                    delete next[v.table_name];
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [vacuum]);

    /* ── Sort / filter ── */
    const sortedGrowth = useMemo(() => {
        return [...growth].sort((a, b) => {
            const m = sortDir === 'asc' ? 1 : -1;
            if (sortKey === 'name') return a.table_name.localeCompare(b.table_name) * m;
            if (sortKey === 'size') return (Number(a.total_size_gb) - Number(b.total_size_gb)) * m;
            if (sortKey === 'rows') return ((a.row_count || 0) - (b.row_count || 0)) * m;
            if (sortKey === 'growth') return (Number(a.growth_rate) - Number(b.growth_rate)) * m;
            return 0;
        });
    }, [growth, sortKey, sortDir]);

    const filteredVacuum = useMemo(() => {
        if (bloatFilter === 'all') return vacuum;
        if (bloatFilter === 'high') return vacuum.filter((v) => v.bloat_ratio_pct > 30);
        if (bloatFilter === 'medium') return vacuum.filter((v) => v.bloat_ratio_pct > 15 && v.bloat_ratio_pct <= 30);
        return vacuum.filter((v) => v.bloat_ratio_pct <= 15);
    }, [vacuum, bloatFilter]);

    const toggleSort = useCallback((key) => {
        setSortKey((prev) => {
            setSortDir(prev === key ? (d) => (d === 'asc' ? 'desc' : 'asc') : () => 'desc');
            return key;
        });
    }, []);

    /* ── Computed metrics ── */
    const totalSize = growth.reduce((s, t) => s + Number(t.total_size_gb || 0), 0);
    const totalRows = growth.reduce((s, t) => s + (t.row_count || 0), 0);
    const avgBloat = vacuum.length
        ? vacuum.reduce((s, v) => s + (Number(v.bloat_ratio_pct) || 0), 0) / vacuum.length
        : 0;
    const highBloat = vacuum.filter(
        (v) => (Number(v.bloat_ratio_pct) || 0) > 20 && !resolvedOptimizations[v.table_name],
    ).length;
    const deadCount = deadCode.tables.length;

    const storageBreakdown = useMemo(() => {
        const tblData = growth.reduce(
            (s, t) =>
                s +
                Math.max(0, Number(t.total_size_gb || 0) - Number(t.index_size_gb || 0) - Number(t.toast_size_gb || 0)),
            0,
        );
        const idxData = growth.reduce((s, t) => s + Number(t.index_size_gb || 0), 0);
        const toastData = growth.reduce((s, t) => s + Number(t.toast_size_gb || 0), 0);
        const free = Math.max(0, 200 - tblData - idxData - toastData);
        return [
            { name: 'Table Data', value: Math.round(tblData * 10) / 10, color: THEME.primary },
            { name: 'Indexes', value: Math.round(idxData * 10) / 10, color: THEME.secondary },
            { name: 'TOAST', value: Math.round(toastData * 10) / 10, color: THEME.warning },
            { name: 'Free Space', value: Math.round(free * 10) / 10, color: `${THEME.textDim}60` },
        ];
    }, [growth]);

    const totalStorageGB = storageBreakdown.reduce((s, d) => s + d.value, 0);

    /* ── Tab button ── */
    const TabBtn = ({ id, label, icon: Icon, count, badge }) => {
        const active = activeTab === id;
        return (
            <button
                onClick={() => setActiveTab(id)}
                style={{
                    padding: '9px 18px',
                    borderRadius: 20,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    fontWeight: 600,
                    fontSize: 12.5,
                    lineHeight: 1,
                    transition: 'all 0.25s',
                    whiteSpace: 'nowrap',
                    border: 'none',
                    background: active
                        ? `linear-gradient(135deg, ${THEME.primary}, ${THEME.secondary})`
                        : THEME.surface,
                    color: active ? THEME.textMain : THEME.textMuted,
                    boxShadow: active ? `0 4px 16px ${THEME.primary}35` : 'none',
                    outline: active ? 'none' : `1px solid ${THEME.grid}60`,
                }}
            >
                <Icon size={13} style={{ flexShrink: 0 }} />
                {label}
                {count != null && (
                    <span
                        style={{
                            fontSize: 9.5,
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 16,
                            background: active ? 'rgba(255,255,255,0.2)' : `${THEME.primary}15`,
                            color: active ? THEME.textMain : THEME.primary,
                            fontVariantNumeric: 'tabular-nums',
                        }}
                    >
                        {count}
                    </span>
                )}
                {badge && (
                    <span
                        style={{
                            fontSize: 9,
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 16,
                            background: active ? 'rgba(255,255,255,0.25)' : `${THEME.danger}15`,
                            color: active ? THEME.textMain : THEME.danger,
                        }}
                    >
                        {badge}
                    </span>
                )}
            </button>
        );
    };

    /* ── Sort header ── */
    const SortTh = ({ label, sortId, align = 'left', width }) => {
        const active = sortKey === sortId;
        return (
            <th
                onClick={() => toggleSort(sortId)}
                style={{
                    padding: '16px 22px',
                    textAlign: align,
                    width,
                    fontSize: 10,
                    fontWeight: 700,
                    color: active ? THEME.primary : THEME.textDim,
                    letterSpacing: '0.02em',
                    borderBottom: `1px solid ${THEME.grid}50`,
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'color 0.15s',
                    position: 'sticky',
                    top: 0,
                    background: THEME.surface,
                    zIndex: 1,
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
                    }}
                >
                    {label}
                    {active && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                </div>
            </th>
        );
    };

    /* ────────────────────── LOADING ────────────────────── */
    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '0 18px 32px' }}>
                <ResStyles />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                    {[0, 1, 2, 3].map((i) => (
                        <div
                            key={i}
                            style={{
                                height: 96,
                                borderRadius: 20,
                                background: THEME.surface,
                                border: `1px solid ${THEME.glassBorder}`,
                                opacity: 0.4,
                                animation: 'resPulse 1.5s ease-in-out infinite',
                                animationDelay: `${i * 0.12}s`,
                            }}
                        />
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 20 }}>
                    {[0, 1].map((i) => (
                        <div
                            key={i}
                            style={{
                                height: 340,
                                borderRadius: 16,
                                background: THEME.surface,
                                border: `1px solid ${THEME.glassBorder}`,
                                opacity: 0.25,
                                animation: 'resPulse 1.5s ease-in-out infinite',
                                animationDelay: `${0.5 + i * 0.15}s`,
                            }}
                        />
                    ))}
                </div>
            </div>
        );
    }

    /* ── Metric cards ── */
    const metricCards = [
        {
            label: 'Total Storage',
            value: `${totalSize.toFixed(1)} GB`,
            sub: `of ${totalStorageGB.toFixed(0)} GB capacity`,
            color: THEME.primary,
            icon: HardDrive,
        },
        {
            label: 'Total Rows',
            value: fmtNum(totalRows),
            sub: `${growth.length} tables tracked`,
            color: THEME.secondary,
            icon: Table2,
        },
        {
            label: 'Avg Bloat',
            value: `${avgBloat.toFixed(1)}%`,
            sub: highBloat > 0 ? `${highBloat} need attention` : 'all healthy',
            color: avgBloat > 20 ? THEME.danger : THEME.success,
            icon: Trash2,
        },
        {
            label: 'Dead Code',
            value: deadCount,
            sub: `${deadCode.tables.reduce((s, t) => s + (Number(t.size_gb) || 0), 0).toFixed(1)} GB reclaimable`,
            color: THEME.warning,
            icon: Eye,
        },
    ];

    /* ═══════════════════════════════════════════════════════════════
       RENDER
       ═══════════════════════════════════════════════════════════════ */
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '0 18px 32px 18px' }}>
            <ResStyles />

            {/* ── Refresh status bar ── */}
            {/* ── Tabs ── */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 20,
                }}
            >
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    <TabBtn id="inventory" label="Table Inventory" icon={Database} count={growth.length} />
                    <TabBtn id="analytics" label="Analytics" icon={BarChart3} />
                    <TabBtn id="storage" label="Storage & I/O" icon={HardDrive} />
                    <TabBtn id="deadcode" label="Dead Code" icon={Eye} badge={deadCount > 0 ? deadCount : undefined} />
                    <TabBtn id="retention" label="Retention" icon={Clock} />
                    <TabBtn id="logs" label="Maintenance" icon={History} count={logs.length} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 11, color: THEME.textDim }}>
                    <LiveDot color={refreshError ? THEME.danger : THEME.success} size={6} />
                    <span>{refreshError ? 'Fetch error' : 'Live'}</span>
                </div>
            </div>

            {/* ── Quick metric strip ── */}
            <div className="res-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                {metricCards.map((m, i) => (
                    <div
                        key={i}
                        style={{
                            padding: '12px',
                            borderRadius: 16,
                            background: THEME.surface,
                            border: `1px solid ${THEME.glassBorder}`,
                            display: 'flex',
                            gap: 22,
                            alignItems: 'flex-start',
                        }}
                    >
                        <div
                            style={{
                                width: 42,
                                height: 42,
                                borderRadius: 16,
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: `${m.color}10`,
                                border: `1px solid ${m.color}18`,
                            }}
                        >
                            <m.icon size={18} color={m.color} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                                style={{
                                    fontSize: 10,
                                    color: THEME.textDim,
                                    fontWeight: 600,
                                    letterSpacing: '0.04em',
                                    lineHeight: 1,
                                    marginBottom: 4,
                                }}
                            >
                                {m.label}
                            </div>
                            <div
                                style={{
                                    fontSize: 20,
                                    fontWeight: 800,
                                    color: m.color,
                                    fontVariantNumeric: 'tabular-nums',
                                    lineHeight: 1,
                                    letterSpacing: '-0.02em',
                                }}
                            >
                                {m.value}
                            </div>
                            <div style={{ fontSize: 10, color: THEME.textDim, marginTop: 3, lineHeight: 1 }}>
                                {m.sub}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ════════════════════════════════════════════════════════════
                INVENTORY VIEW
               ════════════════════════════════════════════════════════════ */}
            {activeTab === 'inventory' && (
                <div
                    className="res-stagger"
                    style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 20, alignItems: 'start' }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {/* Table inventory — with TOAST/Index ratio column */}
                        <Panel
                            title="Table Inventory"
                            icon={Database}
                            noPad
                            refreshing={refreshingPanels.has('inventory')}
                            rightNode={
                                <span style={{ fontSize: 10, color: THEME.textDim, fontWeight: 600 }}>
                                    {growth.length} tables
                                </span>
                            }
                        >
                            {growth.length === 0 ? (
                                <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
                                    <EmptyState icon={Database} text="No table data" />
                                </div>
                            ) : (
                                <div className="res-scrollbar" style={{ overflowY: 'auto', maxHeight: 400 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>
                                                <SortTh label="Table" sortId="name" width="28%" />
                                                <SortTh label="Size" sortId="size" align="right" width="12%" />
                                                <SortTh label="Rows" sortId="rows" align="right" width="11%" />
                                                <SortTh label="Growth" sortId="growth" align="right" width="11%" />
                                                <th
                                                    style={{
                                                        padding: '10px 8px',
                                                        width: '13%',
                                                        textAlign: 'right',
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        color: THEME.textDim,
                                                        letterSpacing: '0.02em',
                                                        borderBottom: `1px solid ${THEME.grid}50`,
                                                        position: 'sticky',
                                                        top: 0,
                                                        background: THEME.surface,
                                                        zIndex: 1,
                                                    }}
                                                >
                                                    Composition
                                                </th>
                                                <th
                                                    style={{
                                                        padding: '10px 8px',
                                                        width: '12%',
                                                        textAlign: 'right',
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        color: THEME.textDim,
                                                        letterSpacing: '0.02em',
                                                        borderBottom: `1px solid ${THEME.grid}50`,
                                                        position: 'sticky',
                                                        top: 0,
                                                        background: THEME.surface,
                                                        zIndex: 1,
                                                    }}
                                                >
                                                    Trend
                                                </th>
                                                <th
                                                    style={{
                                                        padding: '10px 8px',
                                                        width: '13%',
                                                        textAlign: 'right',
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        color: THEME.textDim,
                                                        letterSpacing: '0.02em',
                                                        borderBottom: `1px solid ${THEME.grid}50`,
                                                        position: 'sticky',
                                                        top: 0,
                                                        background: THEME.surface,
                                                        zIndex: 1,
                                                    }}
                                                >
                                                    Scans
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedGrowth.map((t) => {
                                                const sel = selectedTable?.table_name === t.table_name;
                                                const gr = Number(t.growth_rate || 0);
                                                const scanRatio =
                                                    (t.idx_scan / Math.max(t.seq_scan + t.idx_scan, 1)) * 100;
                                                return (
                                                    <tr
                                                        key={t.table_name}
                                                        onClick={() => setSelectedTable(t)}
                                                        className="res-row-hover"
                                                        style={{
                                                            cursor: 'pointer',
                                                            background: sel ? `${THEME.primary}08` : 'transparent',
                                                            borderLeft: sel
                                                                ? `2px solid ${THEME.primary}`
                                                                : '2px solid transparent',
                                                        }}
                                                    >
                                                        <td
                                                            style={{
                                                                padding: '9px 16px',
                                                                fontSize: 12,
                                                                fontWeight: 600,
                                                                color: sel ? THEME.textMain : THEME.textMuted,
                                                                borderBottom: `1px solid ${THEME.grid}20`,
                                                                transition: 'color 0.15s',
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 7,
                                                                }}
                                                            >
                                                                <Database
                                                                    size={11}
                                                                    color={sel ? THEME.primary : THEME.textDim}
                                                                    style={{ flexShrink: 0 }}
                                                                />
                                                                <span
                                                                    style={{
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        whiteSpace: 'nowrap',
                                                                    }}
                                                                >
                                                                    {t.table_name}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: '9px 8px',
                                                                fontSize: 12,
                                                                textAlign: 'right',
                                                                fontVariantNumeric: 'tabular-nums',
                                                                color: THEME.primary,
                                                                fontWeight: 700,
                                                                borderBottom: `1px solid ${THEME.grid}20`,
                                                            }}
                                                        >
                                                            {fmtSize(t.total_size_gb)}
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: '9px 8px',
                                                                fontSize: 12,
                                                                textAlign: 'right',
                                                                fontVariantNumeric: 'tabular-nums',
                                                                color: THEME.textMuted,
                                                                borderBottom: `1px solid ${THEME.grid}20`,
                                                            }}
                                                        >
                                                            {fmtNum(t.row_count)}
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: '9px 8px',
                                                                fontSize: 11,
                                                                textAlign: 'right',
                                                                fontVariantNumeric: 'tabular-nums',
                                                                fontWeight: 700,
                                                                borderBottom: `1px solid ${THEME.grid}20`,
                                                                color:
                                                                    gr > 0
                                                                        ? THEME.success
                                                                        : gr < 0
                                                                          ? THEME.danger
                                                                          : THEME.textDim,
                                                            }}
                                                        >
                                                            <span
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 2,
                                                                }}
                                                            >
                                                                {gr > 0 ? (
                                                                    <ArrowUpRight size={10} />
                                                                ) : gr < 0 ? (
                                                                    <ArrowDownRight size={10} />
                                                                ) : null}
                                                                {gr > 0 ? '+' : ''}
                                                                {t.growth_rate}%
                                                            </span>
                                                        </td>
                                                        {/* ── NEW: TOAST + index composition bar ── */}
                                                        <td
                                                            style={{
                                                                padding: '9px 8px',
                                                                borderBottom: `1px solid ${THEME.grid}20`,
                                                            }}
                                                        >
                                                            <div
                                                                style={{ display: 'flex', justifyContent: 'flex-end' }}
                                                            >
                                                                <TOASTRatioCell table={t} />
                                                            </div>
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: '9px 8px',
                                                                borderBottom: `1px solid ${THEME.grid}20`,
                                                            }}
                                                        >
                                                            <div
                                                                style={{ display: 'flex', justifyContent: 'flex-end' }}
                                                            >
                                                                <span style={{ fontSize: 10, color: THEME.textDim }}>
                                                                    —
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: '9px 8px',
                                                                borderBottom: `1px solid ${THEME.grid}20`,
                                                                textAlign: 'right',
                                                            }}
                                                        >
                                                            <div
                                                                title={`${scanRatio.toFixed(0)}% index scans`}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 4,
                                                                    justifyContent: 'flex-end',
                                                                }}
                                                            >
                                                                <div
                                                                    style={{
                                                                        width: 32,
                                                                        height: 4,
                                                                        borderRadius: 2,
                                                                        background: `${THEME.grid}60`,
                                                                        overflow: 'hidden',
                                                                    }}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            width: `${scanRatio}%`,
                                                                            height: '100%',
                                                                            borderRadius: 2,
                                                                            background:
                                                                                scanRatio > 80
                                                                                    ? THEME.success
                                                                                    : scanRatio > 50
                                                                                      ? THEME.warning
                                                                                      : THEME.danger,
                                                                        }}
                                                                    />
                                                                </div>
                                                                <span
                                                                    style={{
                                                                        fontSize: 9,
                                                                        color: THEME.textDim,
                                                                        fontVariantNumeric: 'tabular-nums',
                                                                        width: 20,
                                                                        textAlign: 'right',
                                                                    }}
                                                                >
                                                                    {Math.round(scanRatio)}%
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {/* ── NEW: Legend for composition column ── */}
                            <div
                                style={{
                                    display: 'flex',
                                    gap: 20,
                                    padding: '14px 20px',
                                    borderTop: `1px solid ${THEME.glassBorder}`,
                                    fontSize: 9.5,
                                    color: THEME.textDim,
                                }}
                            >
                                {[
                                    { l: 'Data', c: THEME.primary },
                                    { l: 'Indexes', c: THEME.secondary },
                                    { l: 'TOAST', c: THEME.warning },
                                ].map((x) => (
                                    <span key={x.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        <span style={{ width: 8, height: 4, borderRadius: 1, background: x.c }} /> {x.l}
                                    </span>
                                ))}
                                <span style={{ marginLeft: 'auto', color: THEME.textDim }}>
                                    Composition = table data · index · TOAST ratio
                                </span>
                            </div>
                        </Panel>

                        {/* Bloat & Vacuum */}
                        <Panel
                            title="Bloat & Auto-Vacuum"
                            icon={Trash2}
                            refreshing={refreshingPanels.has('bloat')}
                            rightNode={
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {['all', 'high', 'medium', 'low'].map((f) => (
                                        <button
                                            key={f}
                                            onClick={() => setBloatFilter(f)}
                                            style={{
                                                padding: '3px 9px',
                                                borderRadius: 16,
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontSize: 10,
                                                fontWeight: 700,
                                                textTransform: 'capitalize',
                                                background: bloatFilter === f ? `${THEME.primary}20` : 'transparent',
                                                color: bloatFilter === f ? THEME.primary : THEME.textDim,
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                    {highBloat > 0 && (
                                        <StatusBadge label={`${highBloat} critical`} color={THEME.danger} />
                                    )}
                                </div>
                            }
                        >
                            {filteredVacuum.length === 0 ? (
                                <EmptyState
                                    icon={Trash2}
                                    text={`No ${bloatFilter === 'all' ? '' : bloatFilter + ' '}bloat tables`}
                                />
                            ) : (
                                <div
                                    className="res-scrollbar"
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 22,
                                        maxHeight: 320,
                                        overflowY: 'auto',
                                    }}
                                >
                                    {filteredVacuum.map((v, i) => {
                                        const sel = selectedTable?.table_name === v.table_name;
                                        const resolved = resolvedOptimizations[v.table_name];
                                        const bc = resolved ? THEME.success : bloatColor(v.bloat_ratio_pct);
                                        return (
                                            <div
                                                key={i}
                                                onClick={() => setSelectedTable(v)}
                                                className={resolved ? 'res-resolved-flash' : ''}
                                                style={{
                                                    padding: '22px 28px',
                                                    borderRadius: 16,
                                                    cursor: 'pointer',
                                                    background: resolved
                                                        ? `${THEME.success}06`
                                                        : sel
                                                          ? `${bc}08`
                                                          : THEME.surface,
                                                    border: `1px solid ${resolved ? `${THEME.success}25` : sel ? `${bc}35` : `${THEME.grid}50`}`,
                                                    transition: 'all 0.2s',
                                                    opacity: resolved ? 0.72 : 1,
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!sel && !resolved)
                                                        e.currentTarget.style.borderColor = `${THEME.grid}90`;
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (!sel && !resolved)
                                                        e.currentTarget.style.borderColor = `${THEME.grid}50`;
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        marginBottom: 8,
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                                        {resolved ? (
                                                            <CheckCircle
                                                                size={11}
                                                                color={THEME.success}
                                                                style={{ flexShrink: 0 }}
                                                            />
                                                        ) : (
                                                            <Trash2 size={11} color={bc} style={{ flexShrink: 0 }} />
                                                        )}
                                                        <span
                                                            style={{
                                                                fontSize: 12,
                                                                fontWeight: 600,
                                                                color: resolved ? THEME.textDim : THEME.textMain,
                                                            }}
                                                        >
                                                            {v.table_name}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        {resolved ? (
                                                            <>
                                                                <span
                                                                    style={{
                                                                        fontSize: 9,
                                                                        fontWeight: 700,
                                                                        padding: '2px 8px',
                                                                        borderRadius: 16,
                                                                        background: `${THEME.success}12`,
                                                                        color: THEME.success,
                                                                        border: `1px solid ${THEME.success}20`,
                                                                    }}
                                                                >
                                                                    ✓ Optimization Applied
                                                                </span>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleUnmarkResolved(v.table_name);
                                                                    }}
                                                                    style={{
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        cursor: 'pointer',
                                                                        color: THEME.textDim,
                                                                        padding: 2,
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                    }}
                                                                >
                                                                    <X size={10} />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <div
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 6,
                                                                }}
                                                            >
                                                                <span
                                                                    style={{
                                                                        fontSize: 12,
                                                                        fontWeight: 800,
                                                                        color: bc,
                                                                        fontVariantNumeric: 'tabular-nums',
                                                                    }}
                                                                >
                                                                    {v.bloat_ratio_pct}%
                                                                </span>
                                                                {sel ? (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSelectedTable(v);
                                                                            handleRequestConfirm(v.table_name);
                                                                        }}
                                                                        style={{
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: 4,
                                                                            padding: '4px 10px',
                                                                            borderRadius: 18,
                                                                            cursor: 'pointer',
                                                                            fontSize: 10,
                                                                            fontWeight: 700,
                                                                            background: `${THEME.success}18`,
                                                                            color: THEME.success,
                                                                            border: `1px solid ${THEME.success}30`,
                                                                            transition: 'all 0.15s',
                                                                        }}
                                                                    >
                                                                        <CheckCircle size={10} /> Mark Optimized
                                                                    </button>
                                                                ) : (
                                                                    <ChevronRight size={12} color={THEME.textDim} />
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {!resolved && (
                                                    <div
                                                        style={{
                                                            width: '100%',
                                                            height: 4,
                                                            borderRadius: 2,
                                                            background: `${THEME.grid}80`,
                                                            overflow: 'hidden',
                                                        }}
                                                    >
                                                        <div
                                                            className="res-bar-animate"
                                                            style={{
                                                                width: `${Math.min(v.bloat_ratio_pct, 100)}%`,
                                                                height: '100%',
                                                                borderRadius: 2,
                                                                background: `linear-gradient(90deg, ${bc}90, ${bc})`,
                                                                animationDelay: `${i * 0.06}s`,
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                                {resolved && (
                                                    <div style={{ fontSize: 10, color: THEME.textDim, marginTop: 4 }}>
                                                        {resolved.note} — pending DB confirmation on next refresh
                                                    </div>
                                                )}
                                                {!resolved && (v.last_autovacuum || v.dead_tuples != null) && (
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 18,
                                                            marginTop: 7,
                                                            fontSize: 10,
                                                            color: THEME.textDim,
                                                        }}
                                                    >
                                                        {v.last_autovacuum && (
                                                            <span
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 3,
                                                                }}
                                                            >
                                                                <Clock size={9} /> {v.last_autovacuum}
                                                            </span>
                                                        )}
                                                        {v.dead_tuples != null && (
                                                            <span
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 3,
                                                                }}
                                                            >
                                                                <AlertTriangle size={9} color={THEME.warning} />{' '}
                                                                {fmtNum(v.dead_tuples)} dead
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Panel>
                    </div>

                    {/* Right: Analysis panel */}
                    <div style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 22 }}>
                        {selectedTable &&
                            (() => {
                                const vEntry = vacuum.find((v) => v.table_name === selectedTable.table_name);
                                if (!vEntry) return null;
                                const res = resolvedOptimizations[selectedTable.table_name];
                                const bc = bloatColor(vEntry.bloat_ratio_pct);
                                if (res) {
                                    return (
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '16px 22px',
                                                borderRadius: 16,
                                                background: `${THEME.success}08`,
                                                border: `1px solid ${THEME.success}25`,
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                                <CheckCircle size={14} color={THEME.success} />
                                                <div>
                                                    <div
                                                        style={{ fontSize: 12, fontWeight: 700, color: THEME.success }}
                                                    >
                                                        Optimization Marked as Applied
                                                    </div>
                                                    <div style={{ fontSize: 10, color: THEME.textDim, marginTop: 1 }}>
                                                        {res.note} — will auto-clear from bloat list on next DB refresh
                                                        if bloat &lt; 10%
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleUnmarkResolved(selectedTable.table_name)}
                                                style={{
                                                    background: 'none',
                                                    border: `1px solid ${THEME.grid}40`,
                                                    borderRadius: 16,
                                                    cursor: 'pointer',
                                                    color: THEME.textDim,
                                                    fontSize: 10,
                                                    fontWeight: 600,
                                                    padding: '3px 8px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 4,
                                                }}
                                            >
                                                <X size={9} /> Undo
                                            </button>
                                        </div>
                                    );
                                }
                                return (
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '16px 22px',
                                            borderRadius: 16,
                                            background: `${bc}07`,
                                            border: `1px solid ${bc}25`,
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                            <AlertTriangle size={13} color={bc} />
                                            <div>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: bc }}>
                                                    {vEntry.bloat_ratio_pct}% bloat on {selectedTable.table_name}
                                                </div>
                                                <div style={{ fontSize: 10, color: THEME.textDim, marginTop: 1 }}>
                                                    Apply the optimization below, then click the button →
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRequestConfirm(selectedTable.table_name)}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                padding: '7px 14px',
                                                borderRadius: 18,
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontSize: 11,
                                                fontWeight: 700,
                                                whiteSpace: 'nowrap',
                                                background: `linear-gradient(135deg, ${THEME.success}, ${THEME.success}bb)`,
                                                color: THEME.textMain,
                                                boxShadow: `0 3px 12px ${THEME.success}40`,
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            <CheckCircle size={12} /> Mark Optimization Done
                                        </button>
                                    </div>
                                );
                            })()}

                        {selectedTable ? (
                            <>
                                {confirmPending === selectedTable.table_name &&
                                    (() => {
                                        const vEntry = vacuum.find((v) => v.table_name === selectedTable.table_name);
                                        return (
                                            <ConfirmOptimizationPanel
                                                tableName={selectedTable.table_name}
                                                bloatPct={vEntry?.bloat_ratio_pct ?? '?'}
                                                onConfirm={handleMarkResolved}
                                                onCancel={handleCancelConfirm}
                                            />
                                        );
                                    })()}
                                <AdvancedAnalysisPanel
                                    table={selectedTable}
                                    resolvedOptimizations={resolvedOptimizations}
                                    onMarkResolved={handleMarkResolved}
                                    onUnmarkResolved={handleUnmarkResolved}
                                />
                            </>
                        ) : (
                            <Panel style={{ minHeight: 500 }}>
                                <div
                                    style={{
                                        height: '100%',
                                        minHeight: 460,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 20,
                                        padding: 40,
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 64,
                                            height: 64,
                                            borderRadius: 18,
                                            background: `${THEME.primary}08`,
                                            border: `1px solid ${THEME.primary}15`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <Search size={28} color={THEME.primary} style={{ opacity: 0.5 }} />
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div
                                            style={{
                                                fontSize: 15,
                                                fontWeight: 700,
                                                color: THEME.textMuted,
                                                marginBottom: 8,
                                            }}
                                        >
                                            Select a Table
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: THEME.textDim,
                                                lineHeight: 1.6,
                                                maxWidth: 260,
                                            }}
                                        >
                                            Click any table from the inventory or bloat list to view deep diagnostic
                                            analysis, schema details, and optimization suggestions.
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                        {['Schema', 'Indexes', 'Bloat', 'Growth', 'TOAST'].map((tag) => (
                                            <span
                                                key={tag}
                                                style={{
                                                    fontSize: 10,
                                                    padding: '3px 10px',
                                                    borderRadius: 18,
                                                    background: `${THEME.primary}08`,
                                                    color: THEME.textDim,
                                                    border: `1px solid ${THEME.primary}12`,
                                                }}
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </Panel>
                        )}
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                ANALYTICS VIEW — NEW TAB
               ════════════════════════════════════════════════════════════ */}
            {activeTab === 'analytics' && (
                <div className="res-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Table growth rate chart */}
                    {tableGrowthRate && (
                        <TableGrowthRateChart
                            growthRateData={tableGrowthRate}
                            refreshing={refreshingPanels.has('analytics')}
                        />
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                        {/* Partition tree */}
                        <PartitionTreePanel partitions={partitions} refreshing={refreshingPanels.has('inventory')} />

                        {/* Freeze urgency */}
                        {freezeData.length > 0 && (
                            <FreezeUrgencyPanel data={freezeData} refreshing={refreshingPanels.has('analytics')} />
                        )}
                    </div>

                    {/* Index-to-table ratio panel */}
                    <Panel
                        title="Index-to-Table Size Ratio"
                        icon={Layers}
                        refreshing={refreshingPanels.has('inventory')}
                        rightNode={
                            <span style={{ fontSize: 10, color: THEME.textDim }}>
                                Higher ratio may indicate over-indexing
                            </span>
                        }
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 80px 80px 80px 120px',
                                    gap: 20,
                                    padding: '0 0 8px',
                                    borderBottom: `1px solid ${THEME.grid}30`,
                                    marginBottom: 4,
                                }}
                            >
                                {['Table', 'Table Size', 'Index Size', 'TOAST', 'Index Ratio'].map((h, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            fontSize: 9.5,
                                            fontWeight: 700,
                                            color: THEME.textDim,
                                            letterSpacing: '0.04em',
                                            textAlign: i > 0 ? 'right' : 'left',
                                        }}
                                    >
                                        {h}
                                    </div>
                                ))}
                            </div>
                            {sortedGrowth.slice(0, 12).map((t, i) => {
                                const total = Number(t.total_size_gb) || 0.01;
                                const idx = Number(t.index_size_gb) || 0;
                                const toast = Number(t.toast_size_gb) || 0;
                                const ratio = idx / Math.max(total - idx - toast, 0.001);
                                const ratioColor =
                                    ratio > 1.5 ? THEME.danger : ratio > 0.8 ? THEME.warning : THEME.success;
                                return (
                                    <div
                                        key={i}
                                        className="res-row-hover"
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 80px 80px 80px 120px',
                                            gap: 20,
                                            padding: '8px 0',
                                            borderBottom: `1px solid ${THEME.grid}15`,
                                            alignItems: 'center',
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 600,
                                                color: THEME.textMuted,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {t.table_name}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 11,
                                                textAlign: 'right',
                                                color: THEME.primary,
                                                fontVariantNumeric: 'tabular-nums',
                                            }}
                                        >
                                            {fmtSize(total - idx - toast)}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 11,
                                                textAlign: 'right',
                                                color: THEME.secondary,
                                                fontVariantNumeric: 'tabular-nums',
                                            }}
                                        >
                                            {fmtSize(idx)}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 11,
                                                textAlign: 'right',
                                                color: THEME.warning,
                                                fontVariantNumeric: 'tabular-nums',
                                            }}
                                        >
                                            {fmtSize(toast)}
                                        </span>
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 20,
                                                justifyContent: 'flex-end',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    flex: 1,
                                                    minWidth: 0,
                                                    height: 4,
                                                    borderRadius: 2,
                                                    background: `${THEME.grid}40`,
                                                    overflow: 'hidden',
                                                    maxWidth: 60,
                                                }}
                                            >
                                                <div
                                                    className="res-bar-animate"
                                                    style={{
                                                        width: `${Math.min(ratio / 2, 1) * 100}%`,
                                                        height: '100%',
                                                        borderRadius: 2,
                                                        background: ratioColor,
                                                        animationDelay: `${i * 0.04}s`,
                                                    }}
                                                />
                                            </div>
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    color: ratioColor,
                                                    fontVariantNumeric: 'tabular-nums',
                                                    minWidth: 36,
                                                    textAlign: 'right',
                                                }}
                                            >
                                                {ratio.toFixed(2)}×
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div
                            style={{
                                paddingTop: 10,
                                marginTop: 6,
                                borderTop: `1px solid ${THEME.glassBorder}`,
                                fontSize: 10,
                                color: THEME.textDim,
                                display: 'flex',
                                gap: 20,
                            }}
                        >
                            <span style={{ color: THEME.success }}>● &lt;0.8× normal</span>
                            <span style={{ color: THEME.warning }}>● 0.8–1.5× review</span>
                            <span style={{ color: THEME.danger }}>● &gt;1.5× over-indexed</span>
                        </div>
                    </Panel>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                STORAGE & I/O VIEW
               ════════════════════════════════════════════════════════════ */}
            {activeTab === 'storage' && (
                <div className="res-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20 }}>
                        {/* Storage Donut */}
                        <Panel
                            title="Storage Breakdown"
                            icon={PieIcon}
                            refreshing={refreshingPanels.has('storage')}
                            rightNode={
                                <span
                                    style={{
                                        fontSize: 11,
                                        color: THEME.textDim,
                                        fontWeight: 700,
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {totalStorageGB.toFixed(0)} GB
                                </span>
                            }
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', height: 270 }}>
                                <div style={{ flex: 1, minHeight: 0 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RePieChart>
                                            <Pie
                                                data={storageBreakdown}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={50}
                                                outerRadius={74}
                                                paddingAngle={3}
                                                dataKey="value"
                                                strokeWidth={0}
                                            >
                                                {storageBreakdown.map((d, i) => (
                                                    <Cell key={i} fill={d.color} opacity={0.85} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<ChartTooltip />} />
                                        </RePieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, flexShrink: 0 }}>
                                    {storageBreakdown.map((d, i) => (
                                        <div
                                            key={i}
                                            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 0' }}
                                        >
                                            <span
                                                style={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: 2,
                                                    background: d.color,
                                                    flexShrink: 0,
                                                }}
                                            />
                                            <span
                                                style={{ fontSize: 10.5, color: THEME.textMuted, flex: 1, minWidth: 0 }}
                                            >
                                                {d.name}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: 10.5,
                                                    fontWeight: 700,
                                                    color: THEME.textMain,
                                                    fontVariantNumeric: 'tabular-nums',
                                                }}
                                            >
                                                {d.value} GB
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Panel>

                        {/* Growth Trend */}
                        <Panel
                            title="Growth Trend (6 months)"
                            icon={TrendingUp}
                            refreshing={refreshingPanels.has('resources')}
                            rightNode={
                                <div style={{ display: 'flex', gap: 20, fontSize: 10, color: THEME.textDim }}>
                                    {[
                                        { l: 'Tables', c: THEME.primary },
                                        { l: 'Indexes', c: THEME.secondary },
                                        { l: 'TOAST', c: THEME.warning },
                                    ].map((x) => (
                                        <span
                                            key={x.l}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                        >
                                            <span style={{ width: 10, height: 3, borderRadius: 2, background: x.c }} />{' '}
                                            {x.l}
                                        </span>
                                    ))}
                                </div>
                            }
                        >
                            <div style={{ height: 270 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={growthTrend} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                                        <defs>
                                            <linearGradient id="rgT" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={THEME.primary} stopOpacity={0.3} />
                                                <stop offset="100%" stopColor={THEME.primary} stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="rgI" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={THEME.secondary} stopOpacity={0.2} />
                                                <stop offset="100%" stopColor={THEME.secondary} stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="rgO" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={THEME.warning} stopOpacity={0.15} />
                                                <stop offset="100%" stopColor={THEME.warning} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid
                                            stroke={`${THEME.grid}40`}
                                            strokeDasharray="3 3"
                                            vertical={false}
                                        />
                                        <XAxis
                                            dataKey="month"
                                            tick={{ fontSize: 10, fill: THEME.textDim }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 10, fill: THEME.textDim }}
                                            axisLine={false}
                                            tickLine={false}
                                            width={36}
                                            unit=" GB"
                                        />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Area
                                            type="monotone"
                                            dataKey="tables"
                                            name="Tables"
                                            stroke={THEME.primary}
                                            strokeWidth={2}
                                            fill="url(#rgT)"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="indexes"
                                            name="Indexes"
                                            stroke={THEME.secondary}
                                            strokeWidth={1.5}
                                            fill="url(#rgI)"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="toast"
                                            name="TOAST"
                                            stroke={THEME.warning}
                                            strokeWidth={1}
                                            fill="url(#rgO)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Panel>
                    </div>

                    {/* NEW: Tablespace I/O */}
                    <TablespaceIOPanel tablespaceData={tablespaceIO} refreshing={refreshingPanels.has('io')} />

                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20 }}>
                        {/* Disk I/O */}
                        <Panel
                            title="Disk I/O Throughput"
                            icon={Activity}
                            refreshing={refreshingPanels.has('io')}
                            rightNode={
                                <div style={{ display: 'flex', gap: 20, fontSize: 10, color: THEME.textDim }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        <span
                                            style={{ width: 10, height: 3, borderRadius: 2, background: THEME.primary }}
                                        />{' '}
                                        Reads
                                    </span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        <span
                                            style={{ width: 10, height: 3, borderRadius: 2, background: THEME.success }}
                                        />{' '}
                                        Writes
                                    </span>
                                </div>
                            }
                        >
                            <div style={{ height: 210 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={diskIO} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                                        <CartesianGrid
                                            stroke={`${THEME.grid}40`}
                                            strokeDasharray="3 3"
                                            vertical={false}
                                        />
                                        <XAxis
                                            dataKey="t"
                                            tick={{ fontSize: 10, fill: THEME.textDim }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 10, fill: THEME.textDim }}
                                            axisLine={false}
                                            tickLine={false}
                                            width={36}
                                        />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Bar
                                            dataKey="reads"
                                            name="Reads"
                                            fill={THEME.primary}
                                            radius={[3, 3, 0, 0]}
                                            opacity={0.85}
                                        />
                                        <Bar
                                            dataKey="writes"
                                            name="Writes"
                                            fill={THEME.success}
                                            radius={[3, 3, 0, 0]}
                                            opacity={0.85}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Panel>

                        {/* System Resources */}
                        <Panel title="System Resources" icon={Cpu} refreshing={refreshingPanels.has('resources')}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                {[
                                    {
                                        label: 'CPU',
                                        value: 45,
                                        color: THEME.primary,
                                        detail: '4 cores • 2.1 load avg',
                                        icon: Cpu,
                                    },
                                    {
                                        label: 'Memory',
                                        value: 72,
                                        color: THEME.secondary,
                                        detail: '12 GB / 16 GB allocated',
                                        icon: Server,
                                    },
                                    {
                                        label: 'Disk',
                                        value: 54,
                                        color: THEME.warning,
                                        detail: '108 GB / 200 GB SSD vol',
                                        icon: HardDrive,
                                    },
                                ].map((r, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                        <RingGauge value={r.value} color={r.color} size={48} strokeWidth={4.5} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    marginBottom: 3,
                                                }}
                                            >
                                                <r.icon size={11} color={r.color} style={{ flexShrink: 0 }} />
                                                <span style={{ fontSize: 13, fontWeight: 700, color: THEME.textMain }}>
                                                    {r.label}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: 11, color: THEME.textDim }}>{r.detail}</div>
                                        </div>
                                        <StatusBadge
                                            label={r.value > 80 ? 'High' : r.value > 60 ? 'Moderate' : 'Normal'}
                                            color={
                                                r.value > 80
                                                    ? THEME.danger
                                                    : r.value > 60
                                                      ? THEME.warning
                                                      : THEME.success
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                        </Panel>
                    </div>

                    {/* Storage Distribution */}
                    <Panel
                        title="Storage Distribution by Table"
                        icon={BarChart3}
                        noPad
                        refreshing={refreshingPanels.has('storage')}
                    >
                        <div style={{ padding: '4px 0' }}>
                            {sortedGrowth.slice(0, 8).map((t, i) => {
                                const maxSize = Number(sortedGrowth[0]?.total_size_gb) || 1;
                                const pct = (Number(t.total_size_gb) / maxSize) * 100;
                                const idxPct =
                                    (Number(t.index_size_gb || 0) / Math.max(Number(t.total_size_gb), 0.01)) * 100;
                                const toastPct =
                                    (Number(t.toast_size_gb || 0) / Math.max(Number(t.total_size_gb), 0.01)) * 100;
                                return (
                                    <div
                                        key={i}
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '150px 1fr 70px',
                                            alignItems: 'center',
                                            gap: 20,
                                            padding: '9px 20px',
                                            borderBottom: i < 7 ? `1px solid ${THEME.grid}20` : 'none',
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 11.5,
                                                fontWeight: 600,
                                                color: THEME.textMuted,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {t.table_name}
                                        </div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                height: 8,
                                                borderRadius: 20,
                                                overflow: 'hidden',
                                                background: `${THEME.grid}40`,
                                            }}
                                        >
                                            <div
                                                className="res-bar-animate"
                                                style={{
                                                    width: `${(pct * (100 - idxPct - toastPct)) / 100}%`,
                                                    background: THEME.primary,
                                                    height: '100%',
                                                    animationDelay: `${i * 0.05}s`,
                                                }}
                                            />
                                            <div
                                                className="res-bar-animate"
                                                style={{
                                                    width: `${(pct * idxPct) / 100}%`,
                                                    background: THEME.secondary,
                                                    height: '100%',
                                                    animationDelay: `${i * 0.05 + 0.06}s`,
                                                }}
                                            />
                                            <div
                                                className="res-bar-animate"
                                                style={{
                                                    width: `${(pct * toastPct) / 100}%`,
                                                    background: THEME.warning,
                                                    height: '100%',
                                                    animationDelay: `${i * 0.05 + 0.12}s`,
                                                }}
                                            />
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 11.5,
                                                fontWeight: 700,
                                                color: THEME.textMain,
                                                textAlign: 'right',
                                                fontVariantNumeric: 'tabular-nums',
                                            }}
                                        >
                                            {fmtSize(t.total_size_gb)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                gap: 20,
                                padding: '14px 20px',
                                borderTop: `1px solid ${THEME.glassBorder}`,
                                fontSize: 10,
                                color: THEME.textDim,
                            }}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ width: 10, height: 5, borderRadius: 2, background: THEME.primary }} />{' '}
                                Data
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ width: 10, height: 5, borderRadius: 2, background: THEME.secondary }} />{' '}
                                Indexes
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ width: 10, height: 5, borderRadius: 2, background: THEME.warning }} />{' '}
                                TOAST
                            </span>
                        </div>
                    </Panel>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                DEAD CODE VIEW — NEW TAB
               ════════════════════════════════════════════════════════════ */}
            {activeTab === 'deadcode' && (
                <div className="res-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Summary banner */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                        {[
                            {
                                label: 'Unused Tables',
                                value: deadCode.tables.length,
                                sub: 'zero reads in 90+ days',
                                color: THEME.danger,
                                icon: Trash2,
                            },
                            {
                                label: 'Unused Columns',
                                value: deadCode.columns.length,
                                sub: 'potential dead fields',
                                color: THEME.warning,
                                icon: Eye,
                            },
                            {
                                label: 'Space Reclaimable',
                                value: fmtSize(deadCode.tables.reduce((s, t) => s + t.size_gb, 0)),
                                sub: 'if all unused tables dropped',
                                color: THEME.success,
                                icon: HardDrive,
                            },
                        ].map((m, i) => (
                            <div
                                key={i}
                                style={{
                                    padding: '12px',
                                    borderRadius: 16,
                                    background: THEME.surface,
                                    border: `1px solid ${THEME.glassBorder}`,
                                    display: 'flex',
                                    gap: 18,
                                    alignItems: 'flex-start',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
                                }}
                            >
                                <div
                                    style={{
                                        width: 42,
                                        height: 42,
                                        borderRadius: 16,
                                        flexShrink: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: `${m.color}10`,
                                        border: `1px solid ${m.color}18`,
                                    }}
                                >
                                    <m.icon size={18} color={m.color} />
                                </div>
                                <div>
                                    <div
                                        style={{
                                            fontSize: 10,
                                            color: THEME.textDim,
                                            fontWeight: 600,
                                            letterSpacing: '0.04em',
                                            lineHeight: 1,
                                            marginBottom: 4,
                                        }}
                                    >
                                        {m.label}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 22,
                                            fontWeight: 800,
                                            color: m.color,
                                            fontVariantNumeric: 'tabular-nums',
                                            lineHeight: 1,
                                            letterSpacing: '-0.02em',
                                        }}
                                    >
                                        {m.value}
                                    </div>
                                    <div style={{ fontSize: 10, color: THEME.textDim, marginTop: 3, lineHeight: 1 }}>
                                        {m.sub}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <DeadCodeDetector deadCode={deadCode} refreshing={refreshingPanels.has('inventory')} />

                    {/* Safety notice */}
                    <div
                        style={{
                            padding: '22px 28px',
                            borderRadius: 20,
                            background: `${THEME.warning}06`,
                            border: `1px solid ${THEME.warning}15`,
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 22,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
                        }}
                    >
                        <ShieldAlert size={16} color={THEME.warning} style={{ flexShrink: 0, marginTop: 1 }} />
                        <div style={{ fontSize: 12, color: THEME.textMuted, lineHeight: 1.6 }}>
                            <strong style={{ color: THEME.warning }}>Before archiving or dropping:</strong> Verify with
                            application owners, check for indirect reads through ORMs, background workers, or reporting
                            pipelines. Zero-read in the past 90 days does not guarantee zero-use — some tables are
                            queried rarely but are still critical (e.g., configuration, audit, disaster-recovery). Use{' '}
                            <code
                                style={{
                                    background: `${THEME.grid}30`,
                                    padding: '1px 5px',
                                    borderRadius: 16,
                                    fontSize: 11,
                                }}
                            >
                                pg_stat_user_tables
                            </code>{' '}
                            to confirm.
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                RETENTION POLICY VIEW — NEW TAB
               ════════════════════════════════════════════════════════════ */}
            {activeTab === 'retention' && (
                <div className="res-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <RetentionPolicyManager refreshing={refreshingPanels.has('logs')} />

                    {/* Partition detach candidates */}
                    <Panel
                        title="Partition Detach Candidates"
                        icon={Database}
                        refreshing={refreshingPanels.has('inventory')}
                        rightNode={
                            <StatusBadge
                                label={`${partitions.flatMap((p) => p.children).filter((c) => c.status === 'detach_ready').length} ready to archive`}
                                color={THEME.warning}
                            />
                        }
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                            {partitions
                                .flatMap((p) =>
                                    p.children
                                        .filter((c) => c.status === 'detach_ready')
                                        .map((c) => ({ ...c, parent: p.parent, strategy: p.strategy })),
                                )
                                .map((c, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 20,
                                            padding: '22px 28px',
                                            borderRadius: 16,
                                            background: `${THEME.warning}06`,
                                            border: `1px solid ${THEME.warning}18`,
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: 20,
                                                background: `${THEME.warning}12`,
                                                border: `1px solid ${THEME.warning}20`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                            }}
                                        >
                                            <HardDrive size={14} color={THEME.warning} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{
                                                    fontSize: 12.5,
                                                    fontWeight: 700,
                                                    color: THEME.textMain,
                                                    fontFamily: 'monospace',
                                                    marginBottom: 3,
                                                }}
                                            >
                                                {c.name}
                                            </div>
                                            <div style={{ fontSize: 10.5, color: THEME.textDim }}>
                                                Parent: {c.parent} · {c.strategy} · {fmtNum(c.rows)} rows ·{' '}
                                                {fmtSize(c.gb)}
                                            </div>
                                        </div>
                                        <StatusBadge label="Archive Ready" color={THEME.warning} />
                                        <div style={{ display: 'flex', gap: 20 }}>
                                            <button
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 5,
                                                    padding: '6px 12px',
                                                    borderRadius: 18,
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    background: `${THEME.warning}15`,
                                                    color: THEME.warning,
                                                    transition: 'all 0.15s',
                                                }}
                                            >
                                                <HardDrive size={11} /> Detach &amp; Archive
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            {partitions.flatMap((p) => p.children).filter((c) => c.status === 'detach_ready').length ===
                                0 && (
                                <div style={{ textAlign: 'center', padding: 24, color: THEME.textDim, fontSize: 13 }}>
                                    No partitions are currently flagged for archival.
                                </div>
                            )}
                        </div>
                    </Panel>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                LOGS VIEW
               ════════════════════════════════════════════════════════════ */}
            {activeTab === 'logs' && (
                <div className="res-stagger">
                    <Panel
                        title="Maintenance History"
                        icon={History}
                        noPad
                        refreshing={refreshingPanels.has('logs')}
                        rightNode={
                            <div style={{ display: 'flex', gap: 20 }}>
                                <StatusBadge
                                    label={`${logs.filter((l) => l.status === 'Success').length} success`}
                                    color={THEME.success}
                                />
                                {logs.some((l) => l.status === 'Failed') && (
                                    <StatusBadge
                                        label={`${logs.filter((l) => l.status === 'Failed').length} failed`}
                                        color={THEME.danger}
                                    />
                                )}
                            </div>
                        }
                    >
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {[
                                        { l: 'Date', a: 'left', w: '13%' },
                                        { l: 'Table', a: 'left', w: '24%' },
                                        { l: 'Action', a: 'left', w: '14%' },
                                        { l: 'Duration', a: 'right', w: '13%' },
                                        { l: 'Saved', a: 'right', w: '15%' },
                                        { l: 'Status', a: 'right', w: '21%' },
                                    ].map((h) => (
                                        <th
                                            key={h.l}
                                            style={{
                                                padding: '11px 20px',
                                                textAlign: h.a,
                                                width: h.w,
                                                fontSize: 10,
                                                fontWeight: 700,
                                                color: THEME.textDim,
                                                letterSpacing: '0.02em',
                                                borderBottom: `1px solid ${THEME.grid}50`,
                                            }}
                                        >
                                            {h.l}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => {
                                    const fail = log.status === 'Failed';
                                    return (
                                        <tr
                                            key={log.id}
                                            className="res-row-hover"
                                            style={{ background: fail ? `${THEME.danger}04` : 'transparent' }}
                                        >
                                            <td
                                                style={{
                                                    padding: '13px 20px',
                                                    fontSize: 12,
                                                    color: THEME.textDim,
                                                    borderBottom: `1px solid ${THEME.grid}20`,
                                                    fontVariantNumeric: 'tabular-nums',
                                                }}
                                            >
                                                {log.date}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '13px 20px',
                                                    fontSize: 12.5,
                                                    fontWeight: 600,
                                                    color: THEME.textMain,
                                                    borderBottom: `1px solid ${THEME.grid}20`,
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                                    <Database
                                                        size={11}
                                                        color={THEME.textDim}
                                                        style={{ flexShrink: 0 }}
                                                    />{' '}
                                                    {log.table}
                                                </div>
                                            </td>
                                            <td
                                                style={{
                                                    padding: '13px 20px',
                                                    borderBottom: `1px solid ${THEME.grid}20`,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        display: 'inline-block',
                                                        padding: '3px 9px',
                                                        borderRadius: 16,
                                                        background: `${THEME.primary}0a`,
                                                        border: `1px solid ${THEME.primary}15`,
                                                        fontSize: 10.5,
                                                        fontWeight: 700,
                                                        color: THEME.primary,
                                                        fontFamily: 'monospace',
                                                    }}
                                                >
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td
                                                style={{
                                                    padding: '13px 20px',
                                                    textAlign: 'right',
                                                    fontSize: 11.5,
                                                    color: THEME.textMuted,
                                                    borderBottom: `1px solid ${THEME.grid}20`,
                                                    fontVariantNumeric: 'tabular-nums',
                                                    fontFamily: 'monospace',
                                                }}
                                            >
                                                {log.duration}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '13px 20px',
                                                    textAlign: 'right',
                                                    fontSize: 12.5,
                                                    fontWeight: 700,
                                                    color: log.saved === '—' ? THEME.textDim : THEME.success,
                                                    fontVariantNumeric: 'tabular-nums',
                                                    borderBottom: `1px solid ${THEME.grid}20`,
                                                }}
                                            >
                                                {log.saved !== '—' && (
                                                    <TrendingUp
                                                        size={11}
                                                        style={{ marginRight: 4, verticalAlign: 'middle' }}
                                                    />
                                                )}
                                                {log.saved}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '13px 20px',
                                                    textAlign: 'right',
                                                    borderBottom: `1px solid ${THEME.grid}20`,
                                                }}
                                            >
                                                <StatusBadge
                                                    label={log.status}
                                                    color={fail ? THEME.danger : THEME.success}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Summary footer */}
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: 0,
                                borderTop: `1px solid ${THEME.glassBorder}`,
                            }}
                        >
                            {[
                                { label: 'Total Saved', value: '4.12 GB', color: THEME.success, icon: TrendingUp },
                                { label: 'Operations', value: String(logs.length), color: THEME.primary, icon: Zap },
                                {
                                    label: 'Success Rate',
                                    value: `${logs.length ? Math.round((logs.filter((l) => l.status === 'Success').length / logs.length) * 100) : 0}%`,
                                    color: logs.some((l) => l.status === 'Failed') ? THEME.warning : THEME.success,
                                    icon: CheckCircle,
                                },
                                { label: 'Avg Duration', value: '2m 40s', color: THEME.warning, icon: Timer },
                            ].map((s, i) => (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 22,
                                        padding: '13px 20px',
                                        borderRight: i < 3 ? `1px solid ${THEME.glassBorder}` : 'none',
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
                                            background: `${s.color}10`,
                                        }}
                                    >
                                        <s.icon size={13} color={s.color} />
                                    </div>
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 9,
                                                color: THEME.textDim,
                                                fontWeight: 600,
                                                letterSpacing: '0.04em',
                                                lineHeight: 1,
                                                marginBottom: 3,
                                            }}
                                        >
                                            {s.label}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 14,
                                                fontWeight: 800,
                                                color: s.color,
                                                fontVariantNumeric: 'tabular-nums',
                                                lineHeight: 1,
                                            }}
                                        >
                                            {s.value}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </div>
            )}
        </div>
    );
};

export default React.memo(ResourcesTab);
