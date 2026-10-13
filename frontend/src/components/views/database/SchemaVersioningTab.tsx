import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import DOMPurify from 'dompurify';
import { THEME, useAdaptiveTheme, useGlobalRefresh, metricValue } from '../../../utils/theme';
import { fetchData } from '../../../utils/api';

import {
    GitBranch,
    GitCommit,
    GitPullRequest,
    History,
    ArrowLeftRight,
    AlertTriangle,
    CheckCircle,
    XCircle,
    FileCode,
    Database,
    Layers,
    Clock,
    ShieldAlert,
    Network,
    Play,
    ChevronRight,
    ChevronDown,
    RefreshCw,
    FileText,
    Zap,
    Lock,
    Search,
    Filter,
    ArrowRight,
    Calendar,
    User,
    Tag,
    GitMerge,
    Copy,
    Download,
    Upload,
    Trash2,
    Edit,
    Eye,
    Code,
    Terminal,
    PauseCircle,
    PlayCircle,
    SkipForward,
    Rewind,
    Settings,
    Info,
    ExternalLink,
    Star,
    StarOff,
} from 'lucide-react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    LineChart,
    Line,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
} from 'recharts';

/* ═══════════════════════════════════════════════════════════════════════════
   CUSTOM HOOKS
   ═══════════════════════════════════════════════════════════════════════════ */
const useDebounce = (value, delay = 300) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
};

const useLocalStorage = (key, initialValue) => {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
            return item ? JSON.parse(item) : initialValue;
        } catch {
            return initialValue;
        }
    });
    const setValue = useCallback(
        (value) => {
            try {
                const valueToStore = value instanceof Function ? value(storedValue) : value;
                setStoredValue(valueToStore);
                if (typeof window !== 'undefined') {
                    window.localStorage.setItem(key, JSON.stringify(valueToStore));
                }
            } catch (error) {
                console.error('useLocalStorage error:', error);
            }
        },
        [key, storedValue],
    );
    return [storedValue, setValue];
};

const useWebSocket = (_url, onMessage) => {
    const [isConnected, setIsConnected] = useState(false);
    const onMessageRef = useRef(onMessage);
    useEffect(() => {
        onMessageRef.current = onMessage;
    }, [onMessage]);
    useEffect(() => {
        const interval = setInterval(() => {
            onMessageRef.current?.({ type: 'heartbeat', timestamp: Date.now() });
        }, 5000);
        setIsConnected(true);
        return () => {
            clearInterval(interval);
            setIsConnected(false);
        };
    }, []);
    return { isConnected };
};

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES — matches BloatAnalysisTab visual system exactly
   Fonts: Syne (display) + JetBrains Mono (data)
   Cards: glassmorphic gradient, baFadeUp entrance, ::before shimmer
   Metric cards: column layout, accent orb ::after, hover lift, glow on crit
   Rows: left-border severity, subtle hover
   Badges: inline-flex, animated entrance
   Tabs: indigo active gradient + glow
   Progress bars: slide animation, glowing tip
   Dots: pulsing critical / static high / ok
   ═══════════════════════════════════════════════════════════════════════════ */
const SV_STYLE_ID = 'sv-adaptive-styles';
function ensureSvStyles() {
    if (typeof document === 'undefined') return;
    let el = document.getElementById(SV_STYLE_ID);
    if (!el) {
        el = document.createElement('style');
        el.id = SV_STYLE_ID;
        document.head.appendChild(el);
    }
    el.textContent = [
        '@keyframes svSpin     { to { transform: rotate(360deg) } }',
        '@keyframes svFadeUp   { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }',
        '@keyframes svPulse    { 0%,100% { opacity:1 } 50% { opacity:.4 } }',
        `@keyframes svGlow     { 0%,100% { box-shadow:0 0 8px ${THEME.danger}40 } 50% { box-shadow:0 0 20px ${THEME.danger}70 } }`,
        '@keyframes svSlide    { from { width:0 } }',
        '@keyframes svCounter  { from { opacity:0; transform:scale(.8) } to { opacity:1; transform:scale(1) } }',
        '@keyframes svShimmer  { 0% { background-position:-1000px 0 } 100% { background-position:1000px 0 } }',
        '@keyframes svSlideIn  { from { transform:translateX(-10px); opacity:0 } to { transform:translateX(0); opacity:1 } }',
        '@keyframes svSlideUp  { from { transform:translateY(20px); opacity:0 } to { transform:translateY(0); opacity:1 } }',
        '@keyframes svFadeIn   { from { opacity:0 } to { opacity:1 } }',

        '/* ── Base ── */',
        `.sv-wrap { font-family: ${THEME.fontBody}; }`,
        `.sv-mono { font-family: ${THEME.fontMono} !important; }`,

        '/* ── Card ── */',
        `.sv-card {
            background: ${THEME.surface};
            border: 1px solid ${THEME.grid};
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
            backdrop-filter: blur(12px);
            transition: all 0.25s ease;
            animation: svFadeUp .4s ease both;
        }`,
        `.sv-card:hover {
            box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08);
            transform: translateY(-4px);
        }`,
        `.sv-card-header {
            height: 28px;
            background: ${THEME.textMain}06;
            display: flex;
            align-items: center;
            padding: 14px 20px;
            gap: 6px;
            border-bottom: 1px solid ${THEME.glassBorder};
            font-weight: 700;
        }`,
        `.sv-card-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }`,
        `.sv-card-title {
            font-family: 'JetBrains Mono', 'Fira Code', monospace;
            font-size: 11px;
            color: ${THEME.textMuted};
            margin-left: 8px;
            letter-spacing: 0.03em;
        }`,
        `.sv-card-body {
            padding: 24px 30px;
            box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);
        }`,
        `.sv-card.legacy {
            padding: 20px;
        }`,

        '/* ── Metric card ── */',
        `.sv-metric-card {
            background: linear-gradient(145deg, ${THEME.surfaceHover} 0%, ${THEME.surface} 100%);
            border: 1px solid ${THEME.grid};
            border-radius: 20px;
            padding: 24px 30px;
            display: flex; flex-direction: column; gap: 22px;
            position: relative; overflow: hidden;
            transition: transform .2s, border-color .2s;
            cursor: default;
            animation: svFadeUp .4s ease both;
        }`,
        `.sv-metric-card:hover { transform: translateY(-4px); border-color: ${THEME.glassBorder}; }`,
        `.sv-metric-card::after {
            content: '';
            position: absolute;
            top: -30px; right: -30px;
            width: 100px; height: 100px;
            border-radius: 50%;
            opacity: .06;
        }`,
        '.sv-metric-card.warn { border-color: rgba(245,158,11,.3); }',

        '/* ── Migration card ── */',
        `.sv-mig-card {
            position: relative; display: flex; gap: 22px; padding: 18px 20px;
            border-radius: 20px;
            background: linear-gradient(135deg, ${THEME.surface}, ${THEME.surface});
            border: 1px solid ${THEME.grid};
            transition: all .25s;
            cursor: pointer;
            animation: svSlideIn .3s ease both;
        }`,
        `.sv-mig-card:hover {
            background: ${THEME.surfaceHover};
            border-color: rgba(99,102,241,.35);
            transform: translateY(-4px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08);
        }`,
        '.sv-mig-card.is-hovered { border-color: rgba(99,102,241,.5); }',

        '/* ── Timeline ── */',
        '.sv-timeline-node { position: relative; padding-left: 32px; margin-bottom: 16px; }',
        `.sv-timeline-node::before {
            content: ''; position: absolute; left: 7px; top: 28px; bottom: -16px;
            width: 2px; background: linear-gradient(180deg, ${THEME.grid}, ${THEME.surface});
        }`,
        '.sv-timeline-node:last-child::before { display: none; }',
        `.sv-timeline-dot {
            width: 16px; height: 16px; border-radius: 50%;
            position: absolute; left: 0; top: 20px; z-index: 2;
            transition: transform .2s, box-shadow .2s;
            cursor: pointer;
        }`,
        '.sv-timeline-dot:hover { transform: scale(1.3); }',

        '/* ── Tab button ── */',
        `.sv-tab {
            display: flex; align-items: center; gap: 20px;
            padding: 9px 16px; cursor: pointer; font-size: 13px; font-weight: 700;
            border: 1px solid ${THEME.grid};
            border-radius: 9px;
            background: transparent;
            color: ${THEME.textDim};
            font-family: ${THEME.fontBody};
            transition: all .2s;
            letter-spacing: .3px;
        }`,
        `.sv-tab.active {
            background: linear-gradient(135deg, rgba(99,102,241,.25), rgba(139,92,246,.15));
            border-color: rgba(99,102,241,.5);
            color: '${THEME.primaryLight}';
            box-shadow: ${THEME.shadowLg};
        }`,
        `.sv-tab:hover:not(.active) { border-color: ${THEME.glassBorder}; color: ${THEME.textMain}; }`,

        '/* ── Badge ── */',
        `.sv-badge {
            display: inline-flex; align-items: center; gap: 4px;
            padding: 3px 9px; border-radius: 22px;
            font-size: 11px; font-weight: 700;
            animation: svCounter .3s ease;
        }`,

        '/* ── Severity dots ── */',
        `.sv-dot {
            width: 6px; height: 6px; border-radius: 50%;
            display: inline-block; flex-shrink: 0;
        }`,
        `'.sv-dot.critical { background: ${THEME.danger}; box-shadow: 0 0 6px ${THEME.danger}; animation: svPulse 1.5s ease infinite; }`,
        `'.sv-dot.high     { background: ${THEME.warning}; }`,
        `'.sv-dot.ok       { background: ${THEME.success}; }`,
        `'.sv-dot.live     { background: ${THEME.success}; box-shadow: 0 0 6px ${THEME.success}; animation: svPulse 2s ease infinite; }`,

        '/* ── Input ── */',
        `.sv-input {
            background: ${THEME.surfaceHover};
            border: 1px solid ${THEME.grid};
            color: ${THEME.textMain};
            border-radius: 11px;
            padding: 11px 14px;
            font-size: 13px;
            outline: none;
            transition: border-color .2s, background .2s;
            font-family: ${THEME.fontBody};
        }`,
        '.sv-input:focus { border-color: rgba(99,102,241,.6); background: rgba(99,102,241,.08); }',
        `.sv-input::placeholder { color: ${THEME.textDim}; }`,

        '/* ── Filter chip ── */',
        `.sv-chip {
            display: inline-flex; align-items: center; gap: 5px;
            padding: 5px 11px; border-radius: 20px;
            font-size: 11px; font-weight: 700; cursor: pointer;
            transition: all .2s;
            border: 1px solid ${THEME.grid};
            background: transparent;
            color: ${THEME.textDim};
            font-family: ${THEME.fontBody};
        }`,
        `.sv-chip:hover { border-color: rgba(99,102,241,.4); color: ${THEME.primaryLight}; background: rgba(99,102,241,.08); }`,
        `.sv-chip.active { background: rgba(99,102,241,.2); color: ${THEME.primaryLight}; border-color: rgba(99,102,241,.5); }`,

        '/* ── Progress bar ── */',
        `.sv-progress-track {
            width: 100%; height: 6px; background: ${THEME.grid}; border-radius: 3px; overflow: visible; position: relative;
        }`,
        `.sv-progress-fill {
            height: 100%; border-radius: 3px; animation: svSlide .6s ease both; position: relative;
        }`,
        `.sv-progress-fill::after {
            content: '';
            position: absolute; right: -1px; top: -2px;
            width: 10px; height: 10px; border-radius: 50%;
            background: inherit; box-shadow: 0 0 8px currentColor;
        }`,

        '/* ── Code block ── */',
        `.sv-code {
            background: ${THEME.surfaceHover}; border: 1px solid ${THEME.grid}; border-radius: 22px;
            padding: 22px 26px; font-family: ${THEME.fontMono};
            font-size: 12px; line-height: 1.7; color: ${THEME.textMain};
            overflow-x: auto; position: relative;
        }`,
        `.sv-code::before {
            content: 'SQL'; position: absolute; top: 8px; right: 10px;
            font-size: 9px; color: ${THEME.textDim};
            background: ${THEME.surface}; padding: 2px 7px;
            border-radius: 20px; border: 1px solid ${THEME.grid};
            font-family: ${THEME.fontBody}; font-weight: 700; letter-spacing: 1px;
        }`,
        '.syntax-keyword { color: #C678DD; font-weight: 700; }',
        '.syntax-type    { color: #E5C07B; }',
        '.syntax-string  { color: #98C379; }',
        '.syntax-table   { color: #61AFEF; }',
        `.syntax-comment { color: ${THEME.textDim}; font-style: italic; }`,

        '/* ── Diff labels ── */',
        `.diff-added   { background: rgba(16,185,129,.15); color: ${THEME.success}40; padding: 2px 7px; border-radius: 20px; font-weight: 700; }`,
        `.diff-removed { background: rgba(239,68,68,.12); color: ${THEME.danger}40; text-decoration: line-through; padding: 2px 7px; border-radius: 20px; opacity: .8; }`,
        `.diff-changed { background: rgba(245,158,11,.12); color: ${THEME.warning}40; padding: 2px 7px; border-radius: 20px; font-weight: 700; }`,

        '/* ── Action buttons ── */',
        `.sv-btn-primary {
            background: rgba(99,102,241,.85); color: white; border: none;
            padding: 9px 18px; border-radius: 9px; font-weight: 700; font-size: 13px;
            cursor: pointer; transition: all .2s;
            display: inline-flex; align-items: center; gap: 7px;
            font-family: ${THEME.fontBody};
        }`,
        '.sv-btn-primary:hover { background: rgba(99,102,241,1); transform: translateY(-3px); box-shadow: 0 4px 16px rgba(99,102,241,.35); }',

        `.sv-btn-secondary {
            background: transparent; color: ${THEME.textMuted};
            border: 1px solid ${THEME.glassBorder};
            padding: 7px 14px; border-radius: 20px; font-weight: 700; font-size: 12px;
            cursor: pointer; transition: all .2s;
            display: inline-flex; align-items: center; gap: 6px;
            font-family: ${THEME.fontBody};
        }`,
        `.sv-btn-secondary:hover { border-color: rgba(99,102,241,.45); color: ${THEME.primaryLight}; background: rgba(99,102,241,.08); }`,

        '/* ── Modal ── */',
        `.sv-modal-overlay {
            position: fixed; inset: 0;
            background: rgba(0,0,0,.7); backdrop-filter: blur(6px);
            z-index: 999; display: flex; align-items: center; justify-content: center;
            animation: svFadeIn .2s ease;
        }`,
        `.sv-modal-content {
            background: linear-gradient(135deg, rgba(20,20,35,.98), rgba(12,12,25,.98));
            border: 1px solid ${THEME.grid};
            border-radius: 20px; max-width: 820px; width: 90%;
            max-height: 85vh; overflow-y: auto;
            box-shadow: 0 24px 80px rgba(0,0,0,.6);
            animation: svSlideUp .3s cubic-bezier(.4,0,.2,1);
        }`,

        '/* ── Skeleton ── */',
        `.sv-skeleton {
            background: linear-gradient(90deg, ${THEME.surfaceHover} 0%, ${THEME.grid} 50%, ${THEME.surfaceHover} 100%);
            background-size: 1000px 100%; animation: svShimmer 2s infinite; border-radius: 20px;
        }`,

        '/* ── Dep node ── */',
        '.sv-dep-node { cursor: pointer; }',

        '/* ── Expandable ── */',
        '.sv-expandable { max-height: 0; overflow: hidden; transition: max-height .4s cubic-bezier(.4,0,.2,1); }',
        '.sv-expandable.expanded { max-height: 2000px; }',

        '/* ── Fav button ── */',
        `.sv-fav-btn {
            background: transparent; border: none; cursor: pointer;
            padding: 4px; border-radius: 22px; transition: all .2s;
            display: inline-flex; align-items: center;
        }`,
        '.sv-fav-btn:hover { transform: scale(1.2); }',

        '::-webkit-scrollbar { width: 4px; height: 4px; }',
        '::-webkit-scrollbar-track { background: transparent; }',
        `.sv-scrollbar-thumb { background: ${THEME.grid}; border-radius: 2px; }`,
        `::-webkit-scrollbar-thumb:hover { background: ${THEME.glassBorder}; }`,
    ].join('\n');
}
const Styles = () => {
    useAdaptiveTheme();
    ensureSvStyles();
    return null;
};

/* ═══════════════════════════════════════════════════════════════════════════
   MOCK DATA (unchanged)
   ═══════════════════════════════════════════════════════════════════════════ */
const MIGRATIONS_INITIAL = [];

const PENDING_MIGRATIONS_INITIAL = [];

/* Note: SCHEMA_DIFF, MIGRATION_STATS, and DEPENDENCY_DATA are now fetched from APIs via component state */

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════════════════════ */
const getSeverityColor = (severity) => {
    if (severity === 'critical') return THEME.danger;
    if (severity === 'warning') return THEME.warning;
    return THEME.primary;
};

const getNodeColor = (type) => {
    if (type === 'table') return THEME.primary;
    if (type === 'view') return THEME.success;
    if (type === 'function') return THEME.warning;
    return THEME.textDim;
};

const highlightSQL = (sql) => {
    const keywords =
        /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TABLE|INDEX|PRIMARY|KEY|FOREIGN|REFERENCES|CASCADE|ON|DEFAULT|NOT|NULL|UNIQUE|CHECK|CONSTRAINT|PARTITION|BY|RANGE|FOR|VALUES|TO|AS|JSONB|TEXT|VARCHAR|UUID|BIGSERIAL|TIMESTAMPTZ|BOOLEAN|ARRAY)\b/gi;
    return sql
        .replace(keywords, '<span class="syntax-keyword">$1</span>')
        .replace(/('[^']*')/g, '<span class="syntax-string">$1</span>')
        .replace(/\b([a-z_]+\.[a-z_]+)\b/gi, '<span class="syntax-table">$1</span>')
        .replace(/(--[^\n]*)/g, '<span class="syntax-comment">$1</span>');
};

/* ═══════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Metric card ── */
const MetricCard = ({ icon: Icon, label, value, sub, accent = THEME.primary, warn, critical, delay = 0 }) => {
    const borderColor = critical ? 'rgba(239,68,68,.35)' : warn ? 'rgba(245,158,11,.3)' : THEME.grid;
    return (
        <div
            className={`sv-metric-card${critical ? ' crit' : warn ? ' warn' : ''}`}
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
                    <span className={`sv-dot ${critical ? 'critical' : 'high'}`} style={{ marginTop: 6 }} />
                )}
            </div>
            <div>
                <div
                    style={{ fontSize: 26, fontWeight: 800, color: THEME.textMain, lineHeight: 1, letterSpacing: -0.5 }}
                >
                    {value}
                </div>
                <div style={{ fontSize: 11, color: THEME.textDim, marginTop: 4, fontWeight: 700, letterSpacing: 0.8 }}>
                    {label}
                </div>
                {sub && (
                    <div
                        style={{
                            fontSize: 11,
                            color: critical ? '${THEME.danger}' : warn ? '${THEME.warning}' : THEME.textDim,
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

/* ── Risk badge ── */
const RiskBadge = ({ risk }) => {
    const config = {
        low: { color: '${THEME.success}', label: 'SAFE', icon: CheckCircle },
        medium: { color: '${THEME.warning}', label: 'CAUTION', icon: AlertTriangle },
        high: { color: '${THEME.danger}', label: 'DESTRUCTIVE', icon: ShieldAlert },
    };
    const c = config[risk] || config.low;
    const Icon = c.icon;
    return (
        <span
            className="sv-badge"
            style={{ background: `${c.color}15`, color: c.color, border: `1px solid ${c.color}28` }}
        >
            <Icon size={10} /> {c.label}
        </span>
    );
};

/* ── Status badge ── */
const StatusBadge = ({ status }) => {
    const config = {
        applied: { color: '${THEME.success}', label: 'Applied', icon: CheckCircle },
        rolled_back: { color: '${THEME.danger}', label: 'Rolled Back', icon: XCircle },
        pending: { color: '${THEME.warning}', label: 'Pending', icon: Clock },
        running: { color: '${THEME.primary}', label: 'Running', icon: PlayCircle },
    };
    const c = config[status] || config.pending;
    const Icon = c.icon;
    return (
        <span
            className="sv-badge"
            style={{ background: `${c.color}15`, color: c.color, border: `1px solid ${c.color}28` }}
        >
            <Icon size={10} /> {c.label}
        </span>
    );
};

/* ── Chart tooltip ── */
const ChartTip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div
            style={{
                background: THEME.surface,
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: 16,
                padding: '22px 28px',
                fontSize: 12,
                backdropFilter: 'blur(8px)',
            }}
        >
            <div style={{ color: THEME.textDim, marginBottom: 6, fontSize: 11 }}>{label}</div>
            {payload.map((p) => (
                <div
                    key={p.name}
                    style={{
                        color: p.stroke || p.fill || '${THEME.primaryLight}',
                        fontWeight: 700,
                        display: 'flex',
                        gap: 20,
                    }}
                >
                    <span style={{ color: THEME.textDim, fontWeight: 400 }}>{p.name}</span>
                    <span>{p.value}</span>
                </div>
            ))}
        </div>
    );
};

/* ── Migration card ── */
const MigrationCard = ({
    mig,
    pending = false,
    onExpand,
    expanded = false,
    isFavorite,
    onToggleFavorite,
    onSelect,
}) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div className="sv-timeline-node">
            <div
                className={`sv-mig-card${isHovered ? ' is-hovered' : ''}`}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={() => onExpand?.(mig.id)}
            >
                <div
                    className="sv-timeline-dot"
                    style={{
                        background: pending ? '${THEME.warning}' : '${THEME.success}',
                        border: `3px solid ${pending ? 'rgba(245,158,11,.25)' : 'rgba(16,185,129,.25)'}`,
                        boxShadow: pending ? '0 0 0 4px rgba(245,158,11,.08)' : '0 0 0 4px rgba(16,185,129,.08)',
                    }}
                />
                <div style={{ flex: 1 }}>
                    {/* Header */}
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: 8,
                        }}
                    >
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 4 }}>
                                <span
                                    className="sv-mono"
                                    style={{ fontSize: 13, fontWeight: 700, color: THEME.primary }}
                                >
                                    {mig.version}
                                </span>
                                <span style={{ color: THEME.textMuted }}>·</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: THEME.textMain }}>{mig.name}</span>
                            </div>
                            <div className="sv-mono" style={{ fontSize: 10, color: THEME.textDim }}>
                                {mig.id}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                                className="sv-fav-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleFavorite?.(mig.id);
                                }}
                                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            >
                                {isFavorite ? (
                                    <Star size={14} color="'${THEME.warning}'" fill="'${THEME.warning}'" />
                                ) : (
                                    <StarOff size={14} color={THEME.textDim} />
                                )}
                            </button>
                            {pending ? <RiskBadge risk={mig.risk} /> : <StatusBadge status={mig.status} />}
                            {expanded ? (
                                <ChevronDown size={15} color={THEME.textDim} />
                            ) : (
                                <ChevronRight size={15} color={THEME.textDim} />
                            )}
                        </div>
                    </div>

                    {/* Meta */}
                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: 18,
                            fontSize: 11,
                            color: THEME.textDim,
                            marginBottom: 8,
                        }}
                    >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <User size={11} />
                            {mig.author}
                        </span>
                        {mig.applied_at && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={11} />
                                {mig.applied_at}
                            </span>
                        )}
                        {mig.duration && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Zap size={11} color="'${THEME.warning}'" />
                                {mig.duration}
                            </span>
                        )}
                        {mig.estimated_time && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={11} color="'${THEME.warning}'" />~{mig.estimated_time}
                            </span>
                        )}
                        {mig.size_impact && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Database size={11} />
                                {mig.size_impact}
                            </span>
                        )}
                    </div>

                    {/* Tags */}
                    {mig.tags?.length > 0 && (
                        <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
                            {mig.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="sv-mono"
                                    style={{
                                        fontSize: 9,
                                        padding: '2px 7px',
                                        borderRadius: 20,
                                        background: THEME.surface,
                                        color: THEME.textDim,
                                        border: `1px solid ${THEME.glassBorder}`,
                                        letterSpacing: '.8px',
                                    }}
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Expandable */}
                    <div className={`sv-expandable ${expanded ? 'expanded' : ''}`}>
                        {mig.changes?.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                                <div
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: THEME.textMuted,
                                        marginBottom: 6,
                                        letterSpacing: '.8px',
                                    }}
                                >
                                    Changes
                                </div>
                                {mig.changes.map((change, idx) => (
                                    <div
                                        key={idx}
                                        className="sv-mono"
                                        style={{
                                            fontSize: 11,
                                            color: THEME.textDim,
                                            marginLeft: 12,
                                            padding: '5px 10px',
                                            background: THEME.surfaceHover,
                                            borderRadius: 18,
                                            marginBottom: 4,
                                            borderLeft: `2px solid rgba(99,102,241,.3)`,
                                        }}
                                    >
                                        {change.type}: <span style={{ color: THEME.primary }}>{change.target}</span>
                                        {change.fields && (
                                            <span style={{ color: THEME.textDim }}> ({change.fields} fields)</span>
                                        )}
                                        {change.concurrent && (
                                            <span style={{ color: '${THEME.success}' }}> [CONCURRENT]</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {mig.sql && (
                            <div style={{ marginBottom: 12 }}>
                                <div
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: THEME.textMuted,
                                        marginBottom: 6,
                                        letterSpacing: '.8px',
                                    }}
                                >
                                    SQL
                                </div>
                                <div
                                    className="sv-code"
                                    dangerouslySetInnerHTML={{
                                        __html: DOMPurify.sanitize(
                                            highlightSQL(mig.sql.slice(0, 300) + (mig.sql.length > 300 ? '…' : '')),
                                        ),
                                    }}
                                    style={{ maxHeight: 150, overflowY: 'auto' }}
                                />
                            </div>
                        )}

                        {pending && mig.issues?.length > 0 && (
                            <div
                                style={{
                                    padding: 12,
                                    borderRadius: 16,
                                    background: 'rgba(239,68,68,.06)',
                                    border: '1px solid rgba(239,68,68,.2)',
                                    marginBottom: 12,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: `${THEME.danger}40`,
                                        marginBottom: 8,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                    }}
                                >
                                    <ShieldAlert size={13} /> Issues Detected ({mig.issues.length})
                                </div>
                                {mig.issues.map((issue, idx) => (
                                    <div
                                        key={idx}
                                        style={{ fontSize: 11, marginBottom: 6, paddingLeft: 18, position: 'relative' }}
                                    >
                                        <span
                                            style={{
                                                position: 'absolute',
                                                left: 0,
                                                top: 3,
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                background: getSeverityColor(issue.severity),
                                                opacity: 0.5,
                                                display: 'block',
                                            }}
                                        />
                                        <div style={{ color: THEME.textMain, fontWeight: 700 }}>
                                            [{issue.severity.toUpperCase()}] {issue.code}
                                        </div>
                                        <div style={{ color: THEME.textDim, marginTop: 2 }}>{issue.message}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {pending && mig.pre_checks && (
                            <div style={{ marginBottom: 12 }}>
                                <div
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: THEME.textMuted,
                                        marginBottom: 6,
                                        letterSpacing: '.8px',
                                    }}
                                >
                                    Pre-flight Checks
                                </div>
                                {mig.pre_checks.map((check, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '6px 10px',
                                            background: THEME.surfaceHover,
                                            borderRadius: 18,
                                            marginBottom: 4,
                                            fontSize: 11,
                                        }}
                                    >
                                        <span style={{ color: THEME.textMuted }}>{check.name}</span>
                                        <span
                                            className="sv-mono"
                                            style={{
                                                padding: '2px 7px',
                                                borderRadius: 20,
                                                fontSize: 9,
                                                fontWeight: 700,
                                                background:
                                                    check.status === 'passed'
                                                        ? 'rgba(16,185,129,.15)'
                                                        : 'rgba(245,158,11,.12)',
                                                color:
                                                    check.status === 'passed'
                                                        ? `${THEME.success}40`
                                                        : `${THEME.warning}40`,
                                            }}
                                        >
                                            {check.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
                            {pending ? (
                                <>
                                    <button
                                        className="sv-btn-primary"
                                        style={{ flex: 1 }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Play size={13} /> Execute Migration
                                    </button>
                                    <button className="sv-btn-secondary" onClick={(e) => e.stopPropagation()}>
                                        <Eye size={13} /> Dry Run
                                    </button>
                                    <button
                                        className="sv-btn-secondary"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelect?.(mig);
                                        }}
                                    >
                                        <Edit size={13} />
                                    </button>
                                    <button
                                        className="sv-btn-secondary"
                                        style={{ color: `${THEME.danger}40`, borderColor: 'rgba(239,68,68,.3)' }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </>
                            ) : (
                                <>
                                    {mig.rollback_available && (
                                        <button className="sv-btn-secondary" onClick={(e) => e.stopPropagation()}>
                                            <Rewind size={13} /> Rollback
                                        </button>
                                    )}
                                    <button
                                        className="sv-btn-secondary"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelect?.(mig);
                                        }}
                                    >
                                        <Eye size={13} /> Details
                                    </button>
                                    <button className="sv-btn-secondary" onClick={(e) => e.stopPropagation()}>
                                        <Download size={13} /> Export
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ── Migration detail modal ── */
const MigrationDetailModal = ({ migration, onClose }) => {
    if (!migration) return null;
    return (
        <div className="sv-modal-overlay" onClick={onClose}>
            <div className="sv-modal-content" onClick={(e) => e.stopPropagation()}>
                <div
                    style={{
                        padding: '22px 28px',
                        borderBottom: `1px solid ${THEME.grid}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: THEME.textMain }}>{migration.name}</div>
                        <div className="sv-mono" style={{ fontSize: 10, color: THEME.textDim, marginTop: 4 }}>
                            {migration.id}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                        {migration.status ? (
                            <StatusBadge status={migration.status} />
                        ) : (
                            <RiskBadge risk={migration.risk} />
                        )}
                        <button className="sv-btn-secondary" onClick={onClose} style={{ padding: '5px 10px' }}>
                            ✕
                        </button>
                    </div>
                </div>
                <div style={{ padding: 28 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 24 }}>
                        {[
                            { label: 'Author', value: migration.author },
                            { label: 'Version', value: migration.version },
                            { label: 'Duration', value: migration.duration || migration.estimated_time || '—' },
                        ].map(({ label, value }) => (
                            <div
                                key={label}
                                style={{
                                    padding: 14,
                                    background: THEME.surfaceHover,
                                    borderRadius: 16,
                                    border: `1px solid ${THEME.glassBorder}`,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 10,
                                        color: THEME.textDim,
                                        letterSpacing: '.8px',
                                        marginBottom: 4,
                                        fontWeight: 700,
                                    }}
                                >
                                    {label}
                                </div>
                                <div
                                    className="sv-mono"
                                    style={{ fontSize: 14, fontWeight: 700, color: THEME.textMain }}
                                >
                                    {value}
                                </div>
                            </div>
                        ))}
                    </div>

                    {migration.sql && (
                        <div style={{ marginBottom: 20 }}>
                            <div
                                style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: THEME.textMuted,
                                    letterSpacing: '.8px',
                                    marginBottom: 8,
                                }}
                            >
                                Full SQL
                            </div>
                            <div
                                className="sv-code"
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(highlightSQL(migration.sql)) }}
                                style={{ maxHeight: 300, overflowY: 'auto' }}
                            />
                        </div>
                    )}

                    {migration.issues?.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                            <div
                                style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: THEME.textMuted,
                                    letterSpacing: '.8px',
                                    marginBottom: 8,
                                }}
                            >
                                Issues
                            </div>
                            {migration.issues.map((issue, i) => (
                                <div
                                    key={i}
                                    style={{
                                        padding: '22px 28px',
                                        marginBottom: 6,
                                        borderRadius: 20,
                                        background: `${getSeverityColor(issue.severity)}08`,
                                        border: `1px solid ${getSeverityColor(issue.severity)}25`,
                                        fontSize: 12,
                                    }}
                                >
                                    <span style={{ fontWeight: 700, color: getSeverityColor(issue.severity) }}>
                                        [{issue.severity.toUpperCase()}]
                                    </span>
                                    <span style={{ color: THEME.textMuted, marginLeft: 8 }}>{issue.message}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div
                        style={{
                            display: 'flex',
                            gap: 22,
                            justifyContent: 'flex-end',
                            paddingTop: 16,
                            borderTop: `1px solid ${THEME.grid}`,
                        }}
                    >
                        <button className="sv-btn-secondary" onClick={onClose}>
                            Close
                        </button>
                        <button className="sv-btn-secondary">
                            <Copy size={13} /> Copy SQL
                        </button>
                        <button className="sv-btn-secondary">
                            <Download size={13} /> Export
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ── Dependency graph ── */
const DependencyGraph = ({ data }) => {
    const [selectedNode, setSelectedNode] = useState(null);
    const [hoveredNode, setHoveredNode] = useState(null);

    const positions = useMemo(() => {
        const nodeMap = {};
        const nodes = Array.isArray(data?.nodes) ? data.nodes : [];
        if (nodes.length === 0) return nodeMap;
        nodes.forEach((node, i) => {
            if (node && node.id) {
                nodeMap[node.id] = { x: 100 + (i % 3) * 180, y: 80 + Math.floor(i / 3) * 100, ...node };
            }
        });
        return nodeMap;
    }, [data]);

    return (
        <div
            style={{
                position: 'relative',
                height: 400,
                background: THEME.surfaceHover,
                borderRadius: 18,
                overflow: 'hidden',
                border: `1px solid ${THEME.glassBorder}`,
            }}
        >
            <svg width="100%" height="100%" viewBox="0 0 600 400" style={{ cursor: 'grab' }}>
                <defs>
                    <marker id="sv-arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill={THEME.textDim} />
                    </marker>
                    <filter id="sv-glow">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                <g opacity="0.5">
                    {(() => {
                        const edges = Array.isArray(data?.edges) ? data.edges : [];
                        return edges.map((edge, i) => {
                            if (!edge) return null;
                            const from = positions[edge.from];
                            const to = positions[edge.to];
                            if (!from || !to) return null;
                            const dx = to.x - from.x,
                                dy = to.y - from.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist === 0) return null;
                            const ox = (dx / dist) * 35,
                                oy = (dy / dist) * 35;
                            return (
                                <line
                                    key={i}
                                    x1={from.x + ox}
                                    y1={from.y + oy}
                                    x2={to.x - ox}
                                    y2={to.y - oy}
                                    stroke={THEME.grid}
                                    strokeWidth="1.5"
                                    markerEnd="url(#sv-arrowhead)"
                                />
                            );
                        });
                    })()}
                </g>
                {Object.values(positions).map((node: any) => {
                    if (!node || !node.id) return null;
                    const isSelected = node.id === selectedNode;
                    const isHov = node.id === hoveredNode;
                    const scale = isSelected || isHov ? 1.08 : 1;
                    const tx = (node.x || 0) * (1 - scale);
                    const ty = (node.y || 0) * (1 - scale);
                    const nodeColor = getNodeColor(node.type);
                    return (
                        <g
                            key={node.id}
                            className="sv-dep-node"
                            onClick={() => setSelectedNode(node.id === selectedNode ? null : node.id)}
                            onMouseEnter={() => setHoveredNode(node.id)}
                            onMouseLeave={() => setHoveredNode(null)}
                            transform={`translate(${tx}, ${ty}) scale(${scale})`}
                            filter={isSelected ? 'url(#sv-glow)' : ''}
                        >
                            <circle
                                cx={node.x || 0}
                                cy={node.y || 0}
                                r={isSelected ? 35 : 30}
                                fill="rgba(20,20,35,.9)"
                                stroke={nodeColor}
                                strokeWidth={isSelected ? 2.5 : 1.5}
                                opacity={isSelected ? 1 : 0.9}
                            />
                            <text
                                x={node.x || 0}
                                y={(node.y || 0) - 2}
                                textAnchor="middle"
                                fill={THEME.surface}
                                fontSize="10"
                                fontWeight="700"
                                fontFamily="inherit"
                            >
                                {String(node.id || 'unknown').length > 12
                                    ? String(node.id || '').slice(0, 10) + '…'
                                    : String(node.id || 'unknown')}
                            </text>
                            <text
                                x={node.x || 0}
                                y={(node.y || 0) + 11}
                                textAnchor="middle"
                                fill={THEME.textMuted}
                                fontSize="9"
                                fontFamily="inherit"
                            >
                                {node.type || 'unknown'}
                            </text>
                            {(node.connections || 0) > 0 && (
                                <g>
                                    <circle
                                        cx={(node.x || 0) + 20}
                                        cy={(node.y || 0) - 20}
                                        r="10"
                                        fill={nodeColor}
                                        opacity="0.85"
                                    />
                                    <text
                                        x={(node.x || 0) + 20}
                                        y={(node.y || 0) - 17}
                                        textAnchor="middle"
                                        fill="white"
                                        fontSize="10"
                                        fontWeight="700"
                                    >
                                        {node.connections || 0}
                                    </text>
                                </g>
                            )}
                        </g>
                    );
                })}
            </svg>

            {/* Legend */}
            <div
                style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: THEME.surface,
                    border: `1px solid ${THEME.glassBorder}`,
                    borderRadius: 16,
                    padding: '22px 28px',
                    fontSize: 11,
                    backdropFilter: 'blur(8px)',
                }}
            >
                <div style={{ fontWeight: 800, marginBottom: 8, color: THEME.textMain, fontSize: 11 }}>Legend</div>
                {[
                    ['Table', 'table'],
                    ['View', 'view'],
                    ['Function', 'function'],
                ].map(([label, type]) => (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                        <div style={{ width: 8, height: 8, background: getNodeColor(type), borderRadius: '50%' }} />
                        <span style={{ color: THEME.textDim }}>{label}</span>
                    </div>
                ))}
            </div>

            {selectedNode && positions[selectedNode] && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 12,
                        left: 12,
                        background: THEME.surface,
                        border: `2px solid ${getNodeColor(positions[selectedNode]?.type)}`,
                        borderRadius: 16,
                        padding: '18px 22px',
                        minWidth: 200,
                        backdropFilter: 'blur(8px)',
                    }}
                >
                    <div
                        className="sv-mono"
                        style={{ fontSize: 12, fontWeight: 700, color: THEME.textMain, marginBottom: 4 }}
                    >
                        {selectedNode}
                    </div>
                    <div style={{ fontSize: 10, color: THEME.textDim, marginBottom: 3 }}>
                        Type: <span style={{ color: THEME.primary }}>{positions[selectedNode]?.type || 'unknown'}</span>
                    </div>
                    <div style={{ fontSize: 10, color: THEME.textDim }}>
                        Outgoing:{' '}
                        <span style={{ color: THEME.primary }}>{positions[selectedNode]?.connections || 0}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
const SchemaVersioningTab = () => {
    useAdaptiveTheme(); // keeps THEME in sync with dark/light toggle
    const [view, setView] = useState('timeline');
    const [envDiff, setEnvDiff] = useState({ source: 'staging', target: 'production' });
    const [diffSqlMode, setDiffSqlMode] = useState(false); // ★ NEW: SQL/DDL diff view mode
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTags, setFilterTags] = useState([]);
    const [expandedMigrations, setExpandedMigrations] = useState([]);
    const [selectedMigration, setSelectedMigration] = useState(null);
    const [favorites, setFavorites] = useLocalStorage('pulsedb_favorite_migrations', []);
    const [migrations, setMigrations] = useState([]);
    const [pendingMigrations, setPendingMigrations] = useState([]);
    const [schemaMessage, setSchemaMessage] = useState('');
    const [schemaDiff, setSchemaDiff] = useState([]);
    const [migrationStats, setMigrationStats] = useState([]);
    const [dependencyData, setDependencyData] = useState({ nodes: [], edges: [] });

    const debouncedSearch = useDebounce(searchQuery, 300);

    // Load migrations function
    const loadMigrations = useCallback(async () => {
        try {
            const data = await fetchData('/api/schema/migrations');
            // Validate API response is an object with expected structure
            if (!data || typeof data !== 'object') {
                console.error('Invalid API response:', data);
                setMigrations([]);
                setPendingMigrations([]);
                setSchemaMessage('Invalid response from server.');
                return;
            }
            // Ensure migrations and pending are arrays
            const safeData = Array.isArray(data.migrations) ? data.migrations : [];
            const safePending = Array.isArray(data.pending) ? data.pending : [];
            setMigrations(safeData);
            setPendingMigrations(safePending);
            if (data.message && typeof data.message === 'string') {
                setSchemaMessage(data.message);
            }
        } catch (err) {
            console.error('Failed to load migrations:', err);
            setMigrations([]);
            setPendingMigrations([]);
            setSchemaMessage('Failed to load schema migrations.');
        }
    }, []);

    useGlobalRefresh(loadMigrations);

    // Fetch schema migrations from API
    useEffect(() => {
        loadMigrations();
    }, [loadMigrations]);

    // Build the dependency topology from the schema relationships (tables + FKs).
    // /api/schema/dependencies only returns view/function edges (empty on most app
    // schemas); the real graph is tables joined by foreign keys from
    // /api/schema/relationships. Nodes capped for a readable auto-layout.
    useEffect(() => {
        const loadDependencies = async () => {
            try {
                const [rel, dep] = await Promise.all([
                    fetchData('/api/schema/relationships').catch(() => null),
                    fetchData('/api/schema/dependencies').catch(() => null),
                ]);
                const tables = rel && Array.isArray(rel.tables) ? rel.tables : [];
                const rels = rel && Array.isArray(rel.relationships) ? rel.relationships : [];
                const viewDeps = dep && Array.isArray(dep.dependencies) ? dep.dependencies : [];
                let edges = rels.map((r) => ({ from: r.from, to: r.to, kind: 'fk' }));
                viewDeps.forEach((d) => {
                    if (d && d.source && d.target) edges.push({ from: d.source, to: d.target, kind: 'dep' });
                });
                const degree = {};
                edges.forEach((e) => {
                    degree[e.from] = (degree[e.from] || 0) + 1;
                    degree[e.to] = (degree[e.to] || 0) + 1;
                });
                let nodes = tables
                    .map((tbl) => ({ id: tbl.id, name: tbl.name, type: 'table', deg: degree[tbl.id] || 0 }))
                    .sort((a, b) => b.deg - a.deg)
                    .slice(0, 40);
                const keep = new Set(nodes.map((n) => n.id));
                edges = edges.filter((e) => keep.has(e.from) && keep.has(e.to));
                setDependencyData({ nodes, edges });
            } catch (err) {
                console.error('Failed to load schema topology:', err);
                setDependencyData({ nodes: [], edges: [] });
            }
        };
        loadDependencies();
    }, []);

    // Extract and set migration stats from migrations data
    useEffect(() => {
        if (Array.isArray(migrations) && migrations.length > 0) {
            // Extract stats from migrations if available, or compute from migration history
            const stats = {};
            migrations.forEach((m) => {
                if (m && m.timestamp) {
                    const date = new Date(m.timestamp);
                    const month = date.toLocaleString('default', { month: 'short' });
                    if (!stats[month]) {
                        stats[month] = { month, successful: 0, failed: 0, rolled_back: 0 };
                    }
                    if (m.status === 'failed') {
                        stats[month].failed++;
                    } else if (m.status === 'rolled_back') {
                        stats[month].rolled_back++;
                    } else {
                        stats[month].successful++;
                    }
                }
            });
            const statsArray = Object.values(stats);
            setMigrationStats(statsArray.length > 0 ? statsArray : []);
        }
    }, [migrations]);

    const wsUrl = (import.meta.env.VITE_API_URL || '').replace(/^http/, 'ws');
    const { isConnected } = useWebSocket(wsUrl, () => {});

    const allTags = useMemo(() => {
        const tags = new Set();
        [...migrations, ...pendingMigrations].forEach((m) => {
            if (m && Array.isArray(m.tags)) {
                m.tags.forEach((t) => {
                    if (t) tags.add(t);
                });
            }
        });
        return Array.from(tags);
    }, [migrations, pendingMigrations]);

    const filteredMigrations = useMemo(() => {
        let filtered = [...migrations, ...pendingMigrations];
        if (debouncedSearch) {
            filtered = filtered.filter((m) => {
                if (!m) return false;
                const name = m.name && typeof m.name === 'string' ? m.name.toLowerCase() : '';
                const version = m.version && typeof m.version === 'string' ? m.version : '';
                const author = m.author && typeof m.author === 'string' ? m.author.toLowerCase() : '';
                return (
                    name.includes(debouncedSearch.toLowerCase()) ||
                    version.includes(debouncedSearch) ||
                    author.includes(debouncedSearch.toLowerCase())
                );
            });
        }
        if (filterTags.length > 0) {
            filtered = filtered.filter((m) => {
                if (!m || !Array.isArray(m.tags)) return false;
                return m.tags.some((t) => filterTags.includes(t));
            });
        }
        return filtered;
    }, [debouncedSearch, filterTags, migrations, pendingMigrations]);

    const toggleExpanded = useCallback((id) => {
        setExpandedMigrations((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }, []);

    const toggleFilter = useCallback((tag) => {
        setFilterTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));
    }, []);

    const toggleFavorite = useCallback(
        (id) => {
            setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
        },
        [setFavorites],
    );

    const handleExportSchema = useCallback(() => {
        try {
            const blob = new Blob(
                [
                    JSON.stringify(
                        { migrations: migrations || [], pending: pendingMigrations || [], diff: schemaDiff || [] },
                        null,
                        2,
                    ),
                ],
                { type: 'application/json' },
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `schema_export_${new Date().toISOString()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to export schema:', err);
            setSchemaMessage('Failed to export schema.');
        }
    }, [migrations, pendingMigrations, schemaDiff]);

    const pendingIds = useMemo(() => {
        const ids = new Set();
        if (Array.isArray(pendingMigrations)) {
            pendingMigrations.forEach((p) => {
                if (p && p.id) ids.add(p.id);
            });
        }
        return ids;
    }, [pendingMigrations]);

    const appliedIds = useMemo(() => {
        const ids = new Set();
        if (Array.isArray(migrations)) {
            migrations.forEach((m) => {
                if (m && m.id) ids.add(m.id);
            });
        }
        return ids;
    }, [migrations]);

    const TabButton = ({ id, icon: Icon, label }) => (
        <button className={`sv-tab${view === id ? ' active' : ''}`} onClick={() => setView(id)}>
            <Icon size={14} /> {label}
        </button>
    );

    return (
        <div className="sv-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Styles />

            {selectedMigration && (
                <MigrationDetailModal migration={selectedMigration} onClose={() => setSelectedMigration(null)} />
            )}

            {/* ── Toolbar ── */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 20px',
                    background: `linear-gradient(135deg, ${THEME.surfaceHover}, ${THEME.surface})`,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 16,
                            background: 'rgba(99,102,241,.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid rgba(99,102,241,.3)',
                        }}
                    >
                        <GitBranch size={18} color="'${THEME.primaryLight}'" />
                    </div>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: THEME.textMain, letterSpacing: -0.2 }}>
                            Schema Versioning &amp; Migrations
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 22,
                                fontSize: 11,
                                color: THEME.textDim,
                                marginTop: 2,
                            }}
                        >
                            <span className="sv-mono">v1.5.2</span>
                            <span style={{ color: THEME.textDim }}>·</span>
                            <span style={{ color: `${THEME.success}40` }}>✓ Synced</span>
                            <span style={{ color: THEME.textDim }}>·</span>
                            <span>
                                {migrations.length} applied, {pendingMigrations.length} pending
                            </span>
                        </div>
                    </div>
                    {isConnected && (
                        <span
                            className="sv-badge"
                            style={{
                                background: 'rgba(16,185,129,.12)',
                                color: `${THEME.success}40`,
                                border: '1px solid rgba(16,185,129,.3)',
                                animation: 'svPulse 2s infinite',
                            }}
                        >
                            <span className="sv-dot live" style={{ width: 5, height: 5 }} /> Live
                        </span>
                    )}
                    {favorites.length > 0 && (
                        <span
                            className="sv-badge"
                            style={{
                                background: 'rgba(245,158,11,.1)',
                                color: `${THEME.warning}40`,
                                border: '1px solid rgba(245,158,11,.2)',
                            }}
                        >
                            <Star size={10} fill={`${THEME.warning}40`} /> {favorites.length} starred
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 20 }}>
                    <button className="sv-btn-secondary" onClick={handleExportSchema}>
                        <Download size={13} /> Export
                    </button>
                    <button className="sv-btn-secondary">
                        <Upload size={13} /> Import
                    </button>
                    <button className="sv-btn-primary">
                        <GitCommit size={13} /> New Migration
                    </button>
                </div>
            </div>

            {/* ── Metric cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                <MetricCard
                    icon={CheckCircle}
                    label="Success Rate"
                    value="98.5%"
                    sub="Last 90 days"
                    accent="'${THEME.success}'"
                    delay={0}
                />
                <MetricCard
                    icon={Zap}
                    label="Avg Duration"
                    value="2.3s"
                    sub="Per migration"
                    accent="'${THEME.warning}'"
                    warn
                    delay={60}
                />
                <MetricCard
                    icon={AlertTriangle}
                    label="Pending Review"
                    value={pendingMigrations.length}
                    sub={pendingMigrations.length > 0 ? '1 high-risk' : 'None'}
                    accent="'${THEME.warning}'"
                    warn={pendingMigrations.length > 0}
                    delay={120}
                />
                <MetricCard
                    icon={Layers}
                    label="Schema Objects"
                    value={dependencyData?.nodes?.length || 0}
                    sub={`${dependencyData?.edges?.length || 0} dependencies`}
                    accent="'${THEME.primary}'"
                    delay={180}
                />
            </div>

            {/* ── View tabs ── */}
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                <TabButton id="timeline" icon={History} label="Migration Timeline" />
                <TabButton id="diff" icon={ArrowLeftRight} label="Schema Diff" />
                <TabButton id="graph" icon={Network} label="Dependencies" />
                <TabButton id="analytics" icon={Database} label="Analytics" />
            </div>

            {/* ══════════════════════════════════════════════════════════════
                TIMELINE VIEW
            ══════════════════════════════════════════════════════════════ */}
            {view === 'timeline' && (
                <div>
                    {/* Schema Message */}
                    {schemaMessage && (
                        <div
                            style={{
                                padding: '18px 22px',
                                marginBottom: 16,
                                borderRadius: 20,
                                background: `${THEME.info}12`,
                                border: `1px solid ${THEME.info}30`,
                                fontSize: 12,
                                color: THEME.textMuted,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 20,
                            }}
                        >
                            <Info size={14} color={THEME.info} />
                            {schemaMessage}
                        </div>
                    )}

                    {/* Search + filters */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ position: 'relative', marginBottom: 10 }}>
                            <Search
                                size={14}
                                color={THEME.textDim}
                                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
                            />
                            <input
                                type="text"
                                placeholder="Search by name, version, or author…"
                                className="sv-input"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ paddingLeft: 36, width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                            <Filter size={12} color={THEME.textDim} />
                            <span style={{ fontSize: 11, color: THEME.textDim, fontWeight: 700 }}>Filter:</span>
                            {allTags.map((tag) => (
                                <div
                                    key={tag}
                                    className={`sv-chip${filterTags.includes(tag) ? ' active' : ''}`}
                                    onClick={() => toggleFilter(tag)}
                                >
                                    <Tag size={9} /> {tag}
                                </div>
                            ))}
                            {filterTags.length > 0 && (
                                <button
                                    onClick={() => setFilterTags([])}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: THEME.textDim,
                                        fontSize: 11,
                                        cursor: 'pointer',
                                        fontFamily: THEME.fontBody,
                                    }}
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 18 }}>
                        {/* Migration list */}
                        <div className="sv-card" style={{ padding: '20px 24px', maxHeight: 800, overflowY: 'auto' }}>
                            {/* Pending queue */}
                            {filteredMigrations.some((m) => pendingIds.has(m.id)) && (
                                <>
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            marginBottom: 14,
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 20,
                                                fontSize: 14,
                                                fontWeight: 800,
                                                color: THEME.textMain,
                                            }}
                                        >
                                            <Clock size={16} color={THEME.warning} />
                                            Migration Queue
                                            <span
                                                className="sv-badge"
                                                style={{
                                                    background: 'rgba(245,158,11,.12)',
                                                    color: `${THEME.warning}40`,
                                                    border: '1px solid rgba(245,158,11,.2)',
                                                }}
                                            >
                                                {filteredMigrations.filter((m) => pendingIds.has(m.id)).length}
                                            </span>
                                        </div>
                                        <button className="sv-btn-secondary" style={{ fontSize: 11 }}>
                                            <PlayCircle size={12} /> Execute All Safe
                                        </button>
                                    </div>
                                    {filteredMigrations
                                        .filter((m) => pendingIds.has(m.id))
                                        .map((mig) => (
                                            <MigrationCard
                                                key={mig.id}
                                                mig={mig}
                                                pending
                                                expanded={expandedMigrations.includes(mig.id)}
                                                onExpand={toggleExpanded}
                                                isFavorite={favorites.includes(mig.id)}
                                                onToggleFavorite={toggleFavorite}
                                                onSelect={setSelectedMigration}
                                            />
                                        ))}
                                    <div style={{ borderTop: `2px dashed ${THEME.grid}`, margin: '20px 0' }} />
                                </>
                            )}

                            {/* Applied history */}
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: 14,
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 20,
                                        fontSize: 14,
                                        fontWeight: 800,
                                        color: THEME.textMain,
                                    }}
                                >
                                    <CheckCircle size={16} color="'${THEME.success}'" /> Applied History
                                </div>
                                <button className="sv-btn-secondary" style={{ fontSize: 11 }}>
                                    <Download size={12} /> Export Log
                                </button>
                            </div>
                            {filteredMigrations
                                .filter((m) => appliedIds.has(m.id))
                                .map((mig) => (
                                    <MigrationCard
                                        key={mig.id}
                                        mig={mig}
                                        expanded={expandedMigrations.includes(mig.id)}
                                        onExpand={toggleExpanded}
                                        isFavorite={favorites.includes(mig.id)}
                                        onToggleFavorite={toggleFavorite}
                                        onSelect={setSelectedMigration}
                                    />
                                ))}

                            {filteredMigrations.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '60px 20px', color: THEME.textDim }}>
                                    <Search size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
                                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                                        No migrations found
                                    </div>
                                    <div style={{ fontSize: 12 }}>Try adjusting your search or filters</div>
                                </div>
                            )}
                        </div>

                        {/* Sidebar */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {/* Risk analysis */}
                            <div className="sv-card" style={{ borderColor: 'rgba(239,68,68,.2)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                                    <AlertTriangle size={15} color="'${THEME.warning}'" />
                                    <span style={{ fontSize: 13, fontWeight: 800, color: THEME.textMain }}>
                                        Risk Analysis
                                    </span>
                                </div>
                                <div style={{ fontSize: 12, color: THEME.textDim, lineHeight: 1.7, marginBottom: 12 }}>
                                    <b style={{ color: `${THEME.danger}40` }}>2 high-risk operations</b> detected in
                                    migration{' '}
                                    <span className="sv-mono" style={{ color: THEME.primary, fontSize: 11 }}>
                                        1.6.0
                                    </span>
                                    :
                                </div>
                                <div style={{ fontSize: 12, color: THEME.textDim, lineHeight: 1.8, marginBottom: 14 }}>
                                    · DROP COLUMN requires exclusive table lock
                                    <br />· Data type change may cause truncation
                                </div>
                                <div className="sv-progress-track" style={{ marginBottom: 8 }}>
                                    <div
                                        className="sv-progress-fill"
                                        style={{
                                            width: '75%',
                                            background: `linear-gradient(90deg, ${THEME.danger}90, ${THEME.danger})`,
                                        }}
                                    />
                                </div>
                                <div style={{ fontSize: 11, color: THEME.textDim, marginBottom: 14 }}>
                                    Risk Score:{' '}
                                    <span className="sv-mono" style={{ color: `${THEME.danger}40`, fontWeight: 700 }}>
                                        7.5/10
                                    </span>
                                </div>
                                <button
                                    className="sv-btn-primary"
                                    style={{
                                        width: '100%',
                                        justifyContent: 'center',
                                        background: 'rgba(245,158,11,.8)',
                                    }}
                                >
                                    <ShieldAlert size={13} /> Run Pre-flight Checks
                                </button>
                            </div>

                            {/* Starred */}
                            {favorites.length > 0 && (
                                <div className="sv-card">
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 20,
                                            marginBottom: 12,
                                            fontSize: 13,
                                            fontWeight: 800,
                                            color: THEME.textMain,
                                        }}
                                    >
                                        <Star size={14} color="'${THEME.warning}'" fill="'${THEME.warning}'" /> Starred
                                        ({favorites.length})
                                    </div>
                                    {[...(migrations || []), ...(pendingMigrations || [])]
                                        .filter((m) => m && favorites.includes(m.id))
                                        .map(
                                            (m) =>
                                                m && (
                                                    <div
                                                        key={m.id}
                                                        style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            padding: '8px 0',
                                                            borderBottom: `1px solid ${THEME.grid}`,
                                                            fontSize: 12,
                                                        }}
                                                    >
                                                        <span className="sv-mono" style={{ color: THEME.primary }}>
                                                            {m.name || 'Unknown'}
                                                        </span>
                                                        <span style={{ color: THEME.textDim, fontSize: 11 }}>
                                                            {m.version || 'N/A'}
                                                        </span>
                                                    </div>
                                                ),
                                        )}
                                </div>
                            )}

                            {/* Quick actions */}
                            <div className="sv-card">
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 20,
                                        marginBottom: 14,
                                        fontSize: 13,
                                        fontWeight: 800,
                                        color: THEME.textMain,
                                    }}
                                >
                                    <Zap size={14} color="'${THEME.primaryLight}'" /> Quick Actions
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                    {[
                                        [FileText, 'Generate Data Dictionary'],
                                        [Network, 'Export ER Diagram'],
                                        [GitMerge, 'Compare Environments'],
                                        [Terminal, 'Open SQL Console'],
                                    ].map(([Icon, label]) => (
                                        <button
                                            key={label}
                                            className="sv-btn-secondary"
                                            style={{ justifyContent: 'flex-start', width: '100%' }}
                                        >
                                            <Icon size={13} /> {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Activity chart */}
                            <div className="sv-card">
                                <div style={{ fontSize: 13, fontWeight: 800, color: THEME.textMain, marginBottom: 14 }}>
                                    Recent Activity
                                </div>
                                <ResponsiveContainer width="100%" height={140}>
                                    <AreaChart data={Array.isArray(migrationStats) ? migrationStats : []}>
                                        <defs>
                                            <linearGradient id="sv-colorSuccess" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="'${THEME.success}'" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="'${THEME.success}'" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                        <XAxis
                                            dataKey="month"
                                            stroke={THEME.textDim}
                                            fontSize={10}
                                            fontFamily={THEME.fontMono}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis
                                            stroke={THEME.textDim}
                                            fontSize={10}
                                            fontFamily={THEME.fontMono}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <Tooltip content={<ChartTip />} />
                                        <Area
                                            type="monotone"
                                            dataKey="successful"
                                            stroke="'${THEME.success}'"
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill="url(#sv-colorSuccess)"
                                            name="Successful"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Resources */}
                            <div className="sv-card">
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 20,
                                        marginBottom: 12,
                                        fontSize: 13,
                                        fontWeight: 800,
                                        color: THEME.textMain,
                                    }}
                                >
                                    <Info size={14} color="'${THEME.primaryLight}'" /> Resources
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 12 }}>
                                    {[
                                        'Migration Best Practices',
                                        'Rollback Strategies',
                                        'Zero-Downtime Migrations',
                                    ].map((link) => (
                                        <a
                                            key={link}
                                            href="#"
                                            style={{
                                                color: '${THEME.primaryLight}',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                textDecoration: 'none',
                                                transition: 'color .15s',
                                            }}
                                        >
                                            <ExternalLink size={11} /> {link}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                DIFF VIEW
            ══════════════════════════════════════════════════════════════ */}
            {view === 'diff' && (
                <div className="sv-card" style={{ padding: 0, minHeight: 600 }}>
                    {/* Toolbar */}
                    <div
                        style={{
                            padding: '16px 22px',
                            borderBottom: `1px solid ${THEME.grid}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 20,
                            background: THEME.surfaceHover,
                            flexWrap: 'wrap',
                            borderRadius: '14px 14px 0 0',
                        }}
                    >
                        {[
                            {
                                label: 'Source',
                                key: 'source',
                                options: [
                                    ['dev', 'Development'],
                                    ['staging', 'Staging'],
                                    ['uat', 'UAT'],
                                ],
                            },
                            {
                                label: 'Target',
                                key: 'target',
                                options: [
                                    ['production', 'Production'],
                                    ['dr', 'DR Site'],
                                    ['staging', 'Staging'],
                                ],
                            },
                        ].map(({ label, key, options }, i) => (
                            <React.Fragment key={key}>
                                {i > 0 && <ArrowRight size={16} color="'${THEME.primary}'" strokeWidth={2.5} />}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                    <span
                                        style={{
                                            fontSize: 11,
                                            color: THEME.textDim,
                                            fontWeight: 700,
                                            letterSpacing: '.8px',
                                        }}
                                    >
                                        {label}
                                    </span>
                                    <select
                                        value={envDiff[key]}
                                        onChange={(e) => setEnvDiff({ ...envDiff, [key]: e.target.value })}
                                        style={{
                                            background: THEME.surface,
                                            color: THEME.textMain,
                                            border: `1px solid ${THEME.glassBorder}`,
                                            borderRadius: 20,
                                            padding: '6px 12px',
                                            fontSize: 12,
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            outline: 'none',
                                            fontFamily: THEME.fontBody,
                                        }}
                                    >
                                        {options.map(([val, lbl]) => (
                                            <option key={val} value={val}>
                                                {lbl}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </React.Fragment>
                        ))}
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 20 }}>
                            {/* ★ NEW: SQL/Table view toggle */}
                            <button
                                className={diffSqlMode ? 'sv-btn-primary' : 'sv-btn-secondary'}
                                onClick={() => setDiffSqlMode((v) => !v)}
                            >
                                <Code size={13} /> {diffSqlMode ? 'SQL View' : 'SQL View'}
                            </button>
                            <button className="sv-btn-primary">
                                <Code size={13} /> Generate Sync Script
                            </button>
                        </div>
                    </div>

                    <div style={{ padding: 24, overflowY: 'auto' }}>
                        {/* Summary */}
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: 18,
                                marginBottom: 24,
                            }}
                        >
                            {(() => {
                                const safeDiff = Array.isArray(schemaDiff) ? schemaDiff : [];
                                return [
                                    {
                                        label: 'Added',
                                        count: safeDiff.filter((d) => d && d.type === 'added').length,
                                        color: '${THEME.success}',
                                    },
                                    {
                                        label: 'Modified',
                                        count: safeDiff.filter((d) => d && d.type === 'modified').length,
                                        color: '${THEME.warning}',
                                    },
                                    {
                                        label: 'Removed',
                                        count: safeDiff.filter((d) => d && d.type === 'removed').length,
                                        color: '${THEME.danger}',
                                    },
                                    {
                                        label: 'Total Changes',
                                        count: safeDiff.reduce(
                                            (s, d) => s + (Array.isArray(d?.changes) ? d.changes.length : 0),
                                            0,
                                        ),
                                        color: '${THEME.primary}',
                                    },
                                ].map(({ label, count, color }) => (
                                    <div
                                        key={label}
                                        className="sv-metric-card"
                                        style={{ borderColor: `${color}25`, animationDelay: '0ms' }}
                                    >
                                        <div style={{ fontSize: 22, fontWeight: 800, color: metricValue(color), lineHeight: 1 }}>
                                            {count}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 10,
                                                color: THEME.textDim,
                                                fontWeight: 700,
                                                letterSpacing: 0.8,
                                            }}
                                        >
                                            {label}
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>

                        {/* ★ NEW: SQL / DDL diff mode */}
                        {diffSqlMode && (
                            <div
                                style={{
                                    marginBottom: 28,
                                    background: THEME.surface,
                                    borderRadius: 18,
                                    border: `1px solid ${THEME.glassBorder}`,
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{
                                        padding: '16px 22px',
                                        borderBottom: `1px solid ${THEME.grid}`,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                    }}
                                >
                                    <span style={{ fontSize: 12, fontWeight: 700, color: THEME.textMain }}>
                                        DDL Diff — {envDiff?.source || 'source'} → {envDiff?.target || 'target'}
                                    </span>
                                    <span style={{ fontSize: 11, color: THEME.textDim }}>git-style unified diff</span>
                                </div>
                                <pre
                                    style={{
                                        margin: 0,
                                        padding: '16px',
                                        overflowX: 'auto',
                                        fontSize: 11.5,
                                        lineHeight: 1.7,
                                        fontFamily: THEME.fontMono,
                                        color: THEME.textMuted,
                                    }}
                                >
                                    {(() => {
                                        const safeDiff = Array.isArray(schemaDiff) ? schemaDiff : [];
                                        return safeDiff
                                            .flatMap((item) => {
                                                if (!item) return [];
                                                const lines = [];
                                                lines.push(
                                                    `--- ${envDiff?.source || 'source'}/${item.schema || 'unknown'}.${item.table || 'unknown'}`,
                                                );
                                                lines.push(
                                                    `+++ ${envDiff?.target || 'target'}/${item.schema || 'unknown'}.${item.table || 'unknown'}`,
                                                );
                                                if (Array.isArray(item.changes)) {
                                                    item.changes.forEach((c) => {
                                                        if (!c) return;
                                                        if (c.status === 'added')
                                                            lines.push(
                                                                `+ ADD COLUMN ${c.field || 'column'} ${c.type || 'type'}${c.nullable ? ' NULL' : ' NOT NULL'}${c.default ? ` DEFAULT ${c.default}` : ''};`,
                                                            );
                                                        if (c.status === 'removed')
                                                            lines.push(
                                                                `- DROP COLUMN ${c.field || 'column'}; -- was ${c.type || 'type'}`,
                                                            );
                                                        if (c.status === 'changed')
                                                            lines.push(
                                                                `~ ALTER COLUMN ${c.field || 'column'} TYPE ${c.to || 'type'}; -- was ${c.from || 'type'}`,
                                                            );
                                                    });
                                                }
                                                if (Array.isArray(item.indexes)) {
                                                    item.indexes.forEach((idx) => {
                                                        if (
                                                            idx &&
                                                            idx.status === 'added' &&
                                                            Array.isArray(idx.columns)
                                                        ) {
                                                            lines.push(
                                                                `+ CREATE${idx.unique ? ' UNIQUE' : ''} INDEX ${idx.name || 'index'} ON ${item.schema || 'schema'}.${item.table || 'table'} (${idx.columns.join(', ')});`,
                                                            );
                                                        }
                                                    });
                                                }
                                                return lines;
                                            })
                                            .map((line, i) => (
                                                <span
                                                    key={i}
                                                    style={{
                                                        display: 'block',
                                                        background: line.startsWith('+')
                                                            ? 'rgba(16,185,129,0.08)'
                                                            : line.startsWith('-')
                                                              ? 'rgba(239,68,68,0.08)'
                                                              : line.startsWith('~')
                                                                ? 'rgba(245,158,11,0.07)'
                                                                : 'transparent',
                                                        color: line.startsWith('+')
                                                            ? `${THEME.success}40`
                                                            : line.startsWith('-')
                                                              ? `${THEME.danger}40`
                                                              : line.startsWith('~')
                                                                ? `${THEME.warning}40`
                                                                : line.startsWith('---') || line.startsWith('+++')
                                                                  ? THEME.primaryLight
                                                                  : THEME.textMuted,
                                                        paddingLeft: 8,
                                                    }}
                                                >
                                                    {line}
                                                </span>
                                            ));
                                    })()}
                                </pre>
                            </div>
                        )}

                        {/* Diff items */}
                        {(() => {
                            const safeDiff = Array.isArray(schemaDiff) ? schemaDiff : [];
                            return safeDiff.map((item, i) => {
                                if (!item) return null;
                                return (
                                    <div key={i} style={{ marginBottom: 28 }}>
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 18,
                                                marginBottom: 12,
                                                paddingBottom: 10,
                                                borderBottom: `1px solid ${THEME.grid}`,
                                            }}
                                        >
                                            {item.type === 'added' && (
                                                <CheckCircle size={16} color="'${THEME.success}'" />
                                            )}
                                            {item.type === 'removed' && <XCircle size={16} color="'${THEME.danger}'" />}
                                            {item.type === 'modified' && <RefreshCw size={16} color={THEME.warning} />}
                                            <span
                                                className="sv-mono"
                                                style={{ fontSize: 14, fontWeight: 700, color: THEME.textMain }}
                                            >
                                                {item.schema}.{item.table}
                                            </span>
                                            <span
                                                className="sv-badge"
                                                style={{
                                                    background:
                                                        item.type === 'added'
                                                            ? 'rgba(16,185,129,.12)'
                                                            : item.type === 'removed'
                                                              ? 'rgba(239,68,68,.12)'
                                                              : 'rgba(245,158,11,.12)',
                                                    color:
                                                        item.type === 'added'
                                                            ? `${THEME.success}40`
                                                            : item.type === 'removed'
                                                              ? `${THEME.danger}40`
                                                              : `${THEME.warning}40`,
                                                    border: `1px solid ${item.type === 'added' ? 'rgba(16,185,129,.25)' : item.type === 'removed' ? 'rgba(239,68,68,.25)' : 'rgba(245,158,11,.25)'}`,
                                                }}
                                            >
                                                {item.type}
                                            </span>
                                            {item.reason && (
                                                <span
                                                    style={{ fontSize: 11, color: THEME.textDim, fontStyle: 'italic' }}
                                                >
                                                    — {item.reason}
                                                </span>
                                            )}
                                        </div>

                                        {/* Columns */}
                                        {Array.isArray(item.changes) && item.changes.length > 0 && (
                                            <div style={{ marginBottom: 14 }}>
                                                <div
                                                    style={{
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        color: THEME.textDim,
                                                        marginBottom: 8,
                                                        marginLeft: 4,
                                                        letterSpacing: '.8px',
                                                    }}
                                                >
                                                    Columns
                                                </div>
                                                <div
                                                    style={{
                                                        background: THEME.surfaceHover,
                                                        borderRadius: 16,
                                                        border: `1px solid ${THEME.glassBorder}`,
                                                        overflow: 'hidden',
                                                    }}
                                                >
                                                    {item.changes.map((c, j) => {
                                                        if (!c) return null;
                                                        return (
                                                            <div
                                                                key={j}
                                                                style={{
                                                                    display: 'grid',
                                                                    gridTemplateColumns: '180px 1fr',
                                                                    gap: 22,
                                                                    padding: '22px 28px',
                                                                    borderBottom:
                                                                        j < item.changes.length - 1
                                                                            ? `1px solid ${THEME.grid}`
                                                                            : 'none',
                                                                    background:
                                                                        c.status === 'added'
                                                                            ? 'rgba(16,185,129,.03)'
                                                                            : c.status === 'removed'
                                                                              ? 'rgba(239,68,68,.03)'
                                                                              : 'transparent',
                                                                }}
                                                            >
                                                                <span
                                                                    className="sv-mono"
                                                                    style={{
                                                                        color: THEME.textMain,
                                                                        fontWeight: 700,
                                                                        fontSize: 12,
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: 6,
                                                                    }}
                                                                >
                                                                    {c.status === 'added' && (
                                                                        <span style={{ color: `${THEME.success}40` }}>
                                                                            +
                                                                        </span>
                                                                    )}
                                                                    {c.status === 'removed' && (
                                                                        <span style={{ color: `${THEME.danger}40` }}>
                                                                            -
                                                                        </span>
                                                                    )}
                                                                    {c.status === 'changed' && (
                                                                        <span style={{ color: `${THEME.warning}40` }}>
                                                                            ~
                                                                        </span>
                                                                    )}
                                                                    {c.status === 'pending_removal' && (
                                                                        <span style={{ color: THEME.warning }}>⏳</span>
                                                                    )}
                                                                    {c.field}
                                                                </span>
                                                                {c.status === 'added' && (
                                                                    <span
                                                                        className="diff-added sv-mono"
                                                                        style={{ fontSize: 11 }}
                                                                    >
                                                                        {c.type} {c.nullable ? 'NULL' : 'NOT NULL'}
                                                                        {c.default ? ` DEFAULT ${c.default}` : ''}
                                                                    </span>
                                                                )}
                                                                {c.status === 'removed' && (
                                                                    <span
                                                                        className="diff-removed sv-mono"
                                                                        style={{ fontSize: 11 }}
                                                                    >
                                                                        {c.type}
                                                                    </span>
                                                                )}
                                                                {c.status === 'changed' && (
                                                                    <span
                                                                        className="diff-changed sv-mono"
                                                                        style={{
                                                                            fontSize: 11,
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: 20,
                                                                        }}
                                                                    >
                                                                        <span
                                                                            style={{
                                                                                textDecoration: 'line-through',
                                                                                opacity: 0.6,
                                                                            }}
                                                                        >
                                                                            {c.from}
                                                                        </span>
                                                                        <ArrowRight size={11} />
                                                                        <span style={{ fontWeight: 700 }}>{c.to}</span>
                                                                    </span>
                                                                )}
                                                                {c.status === 'pending_removal' && (
                                                                    <span
                                                                        className="sv-mono"
                                                                        style={{
                                                                            fontSize: 11,
                                                                            background: 'rgba(245,158,11,.12)',
                                                                            color: `${THEME.warning}40`,
                                                                            padding: '2px 8px',
                                                                            borderRadius: 20,
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: 5,
                                                                        }}
                                                                    >
                                                                        <Clock size={9} /> Scheduled for removal ·{' '}
                                                                        {c.type}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Indexes */}
                                        {Array.isArray(item.indexes) && item.indexes.length > 0 && (
                                            <div style={{ marginBottom: 14 }}>
                                                <div
                                                    style={{
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        color: THEME.textDim,
                                                        marginBottom: 8,
                                                        marginLeft: 4,
                                                        letterSpacing: '.8px',
                                                    }}
                                                >
                                                    Indexes
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                    {item.indexes.map((idx, j) => {
                                                        if (!idx || !Array.isArray(idx.columns)) return null;
                                                        return (
                                                            <div
                                                                key={j}
                                                                className="sv-mono"
                                                                style={{
                                                                    padding: '20px 24px',
                                                                    background: THEME.surfaceHover,
                                                                    border: `1px solid ${THEME.glassBorder}`,
                                                                    borderRadius: 20,
                                                                    fontSize: 11,
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                }}
                                                            >
                                                                <span style={{ color: THEME.textMain }}>
                                                                    {idx.status === 'added' && (
                                                                        <span
                                                                            style={{
                                                                                color: `${THEME.success}40`,
                                                                                marginRight: 6,
                                                                            }}
                                                                        >
                                                                            +
                                                                        </span>
                                                                    )}
                                                                    {idx.name}{' '}
                                                                    <span style={{ color: THEME.textDim }}>
                                                                        ({idx.columns.join(', ')})
                                                                    </span>
                                                                </span>
                                                                <div style={{ display: 'flex', gap: 5 }}>
                                                                    <span
                                                                        style={{
                                                                            fontSize: 9,
                                                                            padding: '2px 6px',
                                                                            borderRadius: 20,
                                                                            background: THEME.surface,
                                                                            color: THEME.textDim,
                                                                            fontWeight: 700,
                                                                        }}
                                                                    >
                                                                        {idx.type}
                                                                    </span>
                                                                    {idx.unique && (
                                                                        <span
                                                                            style={{
                                                                                fontSize: 9,
                                                                                padding: '2px 6px',
                                                                                borderRadius: 20,
                                                                                background: 'rgba(99,102,241,.15)',
                                                                                color: THEME.primaryLight,
                                                                                fontWeight: 700,
                                                                            }}
                                                                        >
                                                                            UNIQUE
                                                                        </span>
                                                                    )}
                                                                    {idx.primary && (
                                                                        <span
                                                                            style={{
                                                                                fontSize: 9,
                                                                                padding: '2px 6px',
                                                                                borderRadius: 20,
                                                                                background: 'rgba(16,185,129,.15)',
                                                                                color: `${THEME.success}40`,
                                                                                fontWeight: 700,
                                                                            }}
                                                                        >
                                                                            PRIMARY
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Constraints */}
                                        {Array.isArray(item.constraints) && item.constraints.length > 0 && (
                                            <div>
                                                <div
                                                    style={{
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        color: THEME.textDim,
                                                        marginBottom: 8,
                                                        marginLeft: 4,
                                                        letterSpacing: '.8px',
                                                    }}
                                                >
                                                    Constraints
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                    {item.constraints.map((con, j) => {
                                                        if (!con) return null;
                                                        return (
                                                            <div
                                                                key={j}
                                                                className="sv-mono"
                                                                style={{
                                                                    padding: '9px 12px',
                                                                    background: THEME.surfaceHover,
                                                                    border: `1px solid ${THEME.glassBorder}`,
                                                                    borderRadius: 20,
                                                                    fontSize: 11,
                                                                }}
                                                            >
                                                                <div
                                                                    style={{
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        marginBottom: 4,
                                                                    }}
                                                                >
                                                                    <span style={{ color: THEME.textMain }}>
                                                                        {con.status === 'added' && (
                                                                            <span
                                                                                style={{
                                                                                    color: `${THEME.success}40`,
                                                                                    marginRight: 6,
                                                                                }}
                                                                            >
                                                                                +
                                                                            </span>
                                                                        )}
                                                                        {con.name || 'constraint'}
                                                                    </span>
                                                                    <span
                                                                        style={{
                                                                            fontSize: 9,
                                                                            padding: '2px 7px',
                                                                            borderRadius: 20,
                                                                            background: THEME.surface,
                                                                            color: THEME.textDim,
                                                                            fontWeight: 700,
                                                                        }}
                                                                    >
                                                                        {(con.type || '').replace('_', ' ')}
                                                                    </span>
                                                                </div>
                                                                <div
                                                                    style={{
                                                                        fontSize: 10,
                                                                        color: THEME.textDim,
                                                                        fontStyle: 'italic',
                                                                    }}
                                                                >
                                                                    {con.definition || 'No definition'}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                DEPENDENCY GRAPH VIEW
            ══════════════════════════════════════════════════════════════ */}
            {view === 'graph' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div className="sv-card">
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 18,
                            }}
                        >
                            <div style={{ fontSize: 14, fontWeight: 800, color: THEME.textMain }}>
                                Schema Dependency Topology
                            </div>
                            <div style={{ display: 'flex', gap: 20 }}>
                                <button className="sv-btn-secondary">
                                    <Download size={13} /> Export SVG
                                </button>
                                <button className="sv-btn-secondary">
                                    <Settings size={13} /> Layout
                                </button>
                            </div>
                        </div>
                        <DependencyGraph data={dependencyData} />
                        <div
                            style={{
                                marginTop: 16,
                                padding: '18px 22px',
                                background: 'rgba(245,158,11,.06)',
                                border: '1px solid rgba(245,158,11,.18)',
                                borderRadius: 16,
                                fontSize: 12,
                                lineHeight: 1.7,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 22 }}>
                                <Info size={15} color={THEME.warning} style={{ flexShrink: 0, marginTop: 2 }} />
                                <div>
                                    <div style={{ fontWeight: 800, marginBottom: 4, color: `${THEME.warning}40` }}>
                                        Impact Analysis
                                    </div>
                                    <div style={{ color: THEME.textDim }}>
                                        Modifying{' '}
                                        <span className="sv-mono" style={{ color: THEME.primary, fontSize: 11 }}>
                                            users
                                        </span>{' '}
                                        will cascade to:
                                        <span style={{ color: THEME.textMuted, marginLeft: 6 }}>
                                            view_user_stats
                                        </span>{' '}
                                        (~5s rebuild), <span style={{ color: THEME.textMuted }}>func_auth_check</span>{' '}
                                        (recompile),{' '}
                                        <span style={{ color: THEME.textMuted }}>
                                            orders, api_keys, user_preferences
                                        </span>{' '}
                                        (FK constraints)
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Dependency matrix */}
                    <div className="sv-card">
                        <div style={{ fontSize: 14, fontWeight: 800, color: THEME.textMain, marginBottom: 16 }}>
                            Dependency Matrix
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: THEME.surfaceHover }}>
                                        {['Object', 'Type', 'Dependencies', 'Dependents', 'Risk Level'].map((h) => (
                                            <th
                                                key={h}
                                                style={{
                                                    padding: '22px 28px',
                                                    textAlign: 'left',
                                                    borderBottom: `1px solid ${THEME.grid}`,
                                                    fontWeight: 700,
                                                    fontSize: 10,
                                                    letterSpacing: '.8px',
                                                    color: THEME.textDim,
                                                }}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const nodes = Array.isArray(dependencyData?.nodes) ? dependencyData.nodes : [];
                                        const edges = Array.isArray(dependencyData?.edges) ? dependencyData.edges : [];
                                        return nodes.map((node) => {
                                            if (!node || !node.id) return null;
                                            const deps = edges.filter((e) => e && e.from === node.id).length;
                                            const dependents = edges.filter((e) => e && e.to === node.id).length;
                                            const riskLevel = deps > 3 ? 'high' : deps > 1 ? 'medium' : 'low';
                                            return (
                                                <tr
                                                    key={node.id}
                                                    style={{
                                                        borderBottom: `1px solid ${THEME.grid}`,
                                                        transition: 'background .15s',
                                                    }}
                                                    onMouseEnter={(e) =>
                                                        (e.currentTarget.style.background = THEME.surfaceHover)
                                                    }
                                                    onMouseLeave={(e) =>
                                                        (e.currentTarget.style.background = 'transparent')
                                                    }
                                                >
                                                    <td
                                                        className="sv-mono"
                                                        style={{
                                                            padding: '22px 28px',
                                                            fontWeight: 700,
                                                            color: THEME.textMain,
                                                        }}
                                                    >
                                                        {node.id}
                                                    </td>
                                                    <td style={{ padding: '22px 28px' }}>
                                                        <span
                                                            className="sv-badge"
                                                            style={{
                                                                background: `${getNodeColor(node.type)}18`,
                                                                color: getNodeColor(node.type),
                                                                border: `1px solid ${getNodeColor(node.type)}28`,
                                                            }}
                                                        >
                                                            {node.type}
                                                        </span>
                                                    </td>
                                                    <td
                                                        className="sv-mono"
                                                        style={{ padding: '22px 28px', color: THEME.textDim }}
                                                    >
                                                        {deps}
                                                    </td>
                                                    <td
                                                        className="sv-mono"
                                                        style={{ padding: '22px 28px', color: THEME.textDim }}
                                                    >
                                                        {dependents}
                                                    </td>
                                                    <td style={{ padding: '22px 28px' }}>
                                                        <RiskBadge risk={riskLevel} />
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                ANALYTICS VIEW
            ══════════════════════════════════════════════════════════════ */}
            {view === 'analytics' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                    <div className="sv-card">
                        <div style={{ fontSize: 14, fontWeight: 800, color: THEME.textMain, marginBottom: 16 }}>
                            Migration Success Rate (90d)
                        </div>
                        <ResponsiveContainer width="100%" height={240}>
                            <LineChart data={Array.isArray(migrationStats) ? migrationStats : []}>
                                <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                <XAxis
                                    dataKey="month"
                                    stroke={THEME.textDim}
                                    fontSize={10}
                                    fontFamily={THEME.fontMono}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke={THEME.textDim}
                                    fontSize={10}
                                    fontFamily={THEME.fontMono}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip content={<ChartTip />} />
                                <Line
                                    type="monotone"
                                    dataKey="successful"
                                    stroke="'${THEME.success}'"
                                    strokeWidth={2}
                                    dot={{ fill: '${THEME.success}', r: 4 }}
                                    name="Successful"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="failed"
                                    stroke="'${THEME.danger}'"
                                    strokeWidth={2}
                                    dot={{ fill: '${THEME.danger}', r: 4 }}
                                    name="Failed"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="rolled_back"
                                    stroke="'${THEME.warning}'"
                                    strokeWidth={2}
                                    dot={{ fill: '${THEME.warning}', r: 4 }}
                                    name="Rolled Back"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="sv-card">
                        <div style={{ fontSize: 14, fontWeight: 800, color: THEME.textMain, marginBottom: 16 }}>
                            Migration Types Distribution
                        </div>
                        <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Safe', value: 45 },
                                        { name: 'Locking', value: 30 },
                                        { name: 'Breaking', value: 15 },
                                        { name: 'Maintenance', value: 10 },
                                    ]}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    dataKey="value"
                                >
                                    {[
                                        '${THEME.success}',
                                        '${THEME.warning}',
                                        '${THEME.danger}',
                                        '${THEME.primary}',
                                    ].map((color, index) => (
                                        <Cell key={`cell-${index}`} fill={color} />
                                    ))}
                                </Pie>
                                <Tooltip content={<ChartTip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="sv-card" style={{ gridColumn: 'span 2' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: THEME.textMain, marginBottom: 16 }}>
                            Migration Volume by Month
                        </div>
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={Array.isArray(migrationStats) ? migrationStats : []}>
                                <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                <XAxis
                                    dataKey="month"
                                    stroke={THEME.textDim}
                                    fontSize={10}
                                    fontFamily={THEME.fontMono}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke={THEME.textDim}
                                    fontSize={10}
                                    fontFamily={THEME.fontMono}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip content={<ChartTip />} />
                                <Bar dataKey="successful" stackId="a" fill="'${THEME.success}'" name="Successful" />
                                <Bar dataKey="failed" stackId="a" fill="'${THEME.danger}'" name="Failed" />
                                <Bar
                                    dataKey="rolled_back"
                                    stackId="a"
                                    fill="'${THEME.warning}'"
                                    radius={[4, 4, 0, 0]}
                                    name="Rolled Back"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SchemaVersioningTab;
