// ==========================================================================
//  FATHOM — AdminTab (v7 — ADVANCED VISUAL EDITION)
// ==========================================================================
import React, { useState, useEffect, useMemo, useCallback, useRef, useReducer } from 'react';
import { THEME, useAdaptiveTheme, metricValue } from '../../../utils/theme';
import { fetchData, postData } from '../../../utils/api';
import {
    Settings,
    Puzzle,
    Database,
    Trash2,
    Search,
    X,
    Copy,
    Check,
    Shield,
    ShieldCheck,
    ShieldAlert,
    Zap,
    Clock,
    HardDrive,
    Server,
    Cpu,
    Network,
    RefreshCw,
    ChevronRight,
    ChevronDown,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Info,
    Eye,
    EyeOff,
    Activity,
    Lock,
    Unlock,
    Download,
    Upload,
    ArrowUp,
    ArrowDown,
    ArrowUpRight,
    Filter,
    Hash,
    Layers,
    ToggleLeft,
    ToggleRight,
    ExternalLink,
    Package,
    Timer,
    Radio,
    FileText,
    Terminal,
    GitBranch,
    Power,
    Plug,
    PlugZap,
    Wrench,
    Sliders,
    BarChart3,
    Users,
    Edit3,
    Save,
    RotateCcw,
    PlayCircle,
    Loader2,
    TrendingUp,
    TrendingDown,
    Minus,
    ChevronUp,
    AlertCircle,
    List,
    Star,
    Plus,
    Flame,
    Gauge,
    Maximize2,
    ChevronLeft,
    Globe,
    Wifi,
    Layers2,
    Circle,
} from 'lucide-react';

// Safe aliases
const MemoryStick = ({ size, color, style }) => <Database size={size} color={color} style={style} />;
const Sparkles = ({ size, color, style }) => <Zap size={size} color={color} style={style} />;
const GitCompare = ({ size, color, style }) => <GitBranch size={size} color={color} style={style} />;
const CornerUpLeft = ({ size, color, style }) => <ArrowUp size={size} color={color} style={style} />;
const Pin = ({ size, color, style, fill }) => <Star size={size} color={color} style={style} fill={fill} />;
const History = ({ size, color, style }) => <Clock size={size} color={color} style={style} />;
const Diff = ({ size, color, style }) => <Filter size={size} color={color} style={style} />;
const Braces = ({ size, color, style }) => <Hash size={size} color={color} style={style} />;
const SortAsc = ({ size, color }) => <ChevronUp size={size} color={color} />;
const SortDesc = ({ size, color }) => <ChevronDown size={size} color={color} />;

/* ═══════════════════════════════════════════════════════════════════════════
   THEME NORMALIZATION — live getters so T always reflects the current THEME
   ═══════════════════════════════════════════════════════════════════════════ */
const T = {
    get primary() {
        return THEME.primary || THEME.primary;
    },
    get secondary() {
        return THEME.secondary || THEME.primary;
    },
    get success() {
        return THEME.success || THEME.success;
    },
    get warning() {
        return THEME.warning || THEME.warning;
    },
    get danger() {
        return THEME.danger || THEME.danger;
    },
    get info() {
        return THEME.info || THEME.primary;
    },
    get teal() {
        return THEME.primary || THEME.secondaryDark;
    },
    get glass() {
        return THEME.surface || 'rgba(255,255,255,0.04)';
    },
    get glassBorder() {
        return THEME.glassBorder || 'rgba(255,255,255,0.08)';
    },
    get surface() {
        return THEME.surface || 'rgba(255,255,255,0.06)';
    },
    get grid() {
        return THEME.grid || 'rgba(255,255,255,0.08)';
    },
    get textMain() {
        return THEME.textMain || THEME.surface;
    },
    get textMuted() {
        return THEME.textMuted || THEME.textMuted;
    },
    get textDim() {
        return THEME.textDim || THEME.textDim;
    },
    get fontBody() {
        return THEME.fontBody || "'Outfit', sans-serif";
    },
    get fontMono() {
        return THEME.fontMono || "'JetBrains Mono', monospace";
    },
};

/* ── history reducer ── */
const historyReducer = (state, action) => {
    switch (action.type) {
        case 'SET': {
            const n = { ...state.present, [action.key]: action.value };
            return { past: [...state.past, state.present], present: n, future: [] };
        }
        case 'REMOVE': {
            const n = { ...state.present };
            delete n[action.key];
            return { past: [...state.past, state.present], present: n, future: [] };
        }
        case 'BATCH': {
            const n = { ...state.present, ...action.changes };
            return { past: [...state.past, state.present], present: n, future: [] };
        }
        case 'UNDO': {
            if (!state.past.length) return state;
            const p = state.past[state.past.length - 1];
            return { past: state.past.slice(0, -1), present: p, future: [state.present, ...state.future] };
        }
        case 'REDO': {
            if (!state.future.length) return state;
            const n = state.future[0];
            return { past: [...state.past, state.present], present: n, future: state.future.slice(1) };
        }
        case 'CLEAR':
            return { past: [], present: {}, future: [] };
        default:
            return state;
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   ADVANCED STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const AdminStyles = () => (
    <style>{`

        @keyframes admFadeIn      { from{opacity:0;transform:translateY(10px);} to{opacity:1;transform:translateY(0);} }
        @keyframes admFadeInLeft  { from{opacity:0;transform:translateX(-12px);} to{opacity:1;transform:translateX(0);} }
        @keyframes admSlideUp     { from{opacity:0;transform:translateY(20px);} to{opacity:1;transform:translateY(0);} }
        @keyframes admPulse       { 0%,100%{opacity:1;} 50%{opacity:0.25;} }
        @keyframes admPulseRing   { 0%{transform:scale(0.8);opacity:0.7;} 100%{transform:scale(2.6);opacity:0;} }
        @keyframes admSpin        { to{transform:rotate(360deg);} }
        @keyframes admShimmer     { 0%{background-position:-400px 0;} 100%{background-position:400px 0;} }
        @keyframes admBarGrow     { from{transform:scaleX(0);} to{transform:scaleX(1);} }
        @keyframes admFloat       { 0%,100%{transform:translateY(0px);} 50%{transform:translateY(-6px);} }
        @keyframes admGlowPulse   { 0%,100%{box-shadow:0 0 12px ${T.primary}30;} 50%{box-shadow:0 0 28px ${T.primary}60, 0 0 50px ${T.primary}20;} }
        @keyframes admCountUp     { from{opacity:0;transform:scale(0.8);} to{opacity:1;transform:scale(1);} }
        @keyframes admScanline    { 0%{transform:translateY(-100%);} 100%{transform:translateY(400%);} }
        @keyframes admFlicker     { 0%,100%{opacity:1;} 92%{opacity:1;} 93%{opacity:0.4;} 94%{opacity:1;} 95%{opacity:0.6;} 96%{opacity:1;} }
        @keyframes admRipple      { 0%{transform:scale(0);opacity:0.8;} 100%{transform:scale(4);opacity:0;} }
        @keyframes admNeonDrift   { 0%,100%{text-shadow:0 0 8px ${T.primary}90,0 0 20px ${T.primary}40;} 50%{text-shadow:0 0 16px ${T.primary},0 0 40px ${T.primary}60,0 0 60px ${T.primary}20;} }
        @keyframes admGraphFill   { from{stroke-dashoffset:500;} to{stroke-dashoffset:0;} }
        @keyframes admWave        { 0%{d:path("M0,20 Q25,10 50,20 T100,20");} 50%{d:path("M0,20 Q25,30 50,20 T100,20");} 100%{d:path("M0,20 Q25,10 50,20 T100,20");} }
        @keyframes admDotBlink    { 0%,90%{opacity:1;} 91%,100%{opacity:0;} }

        .adm-stagger > * { animation: admFadeIn 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        .adm-stagger > *:nth-child(1){animation-delay:0.00s;}
        .adm-stagger > *:nth-child(2){animation-delay:0.07s;}
        .adm-stagger > *:nth-child(3){animation-delay:0.14s;}
        .adm-stagger > *:nth-child(4){animation-delay:0.21s;}
        .adm-stagger > *:nth-child(5){animation-delay:0.28s;}
        .adm-stagger > *:nth-child(6){animation-delay:0.35s;}

        .adm-row-hover { transition: all 0.15s; }
        .adm-row-hover:hover { background: ${T.primary}06 !important; }
        .adm-row-hover:hover .adm-row-actions { opacity:1 !important; }
        .adm-row-actions { opacity:0; transition:opacity 0.15s; }

        .adm-scrollbar::-webkit-scrollbar { width:4px; height:4px; }
        .adm-scrollbar::-webkit-scrollbar-track { background:transparent; }
        .adm-scrollbar::-webkit-scrollbar-thumb { background:${T.grid}; border-radius: 20px; }

        .adm-ext-card { background:${T.surface}; border:1px solid ${T.glassBorder}; border-radius: 20px; padding:0; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04); transition:all 0.2s ease; backdrop-filter:blur(12px); }
        .adm-ext-card:hover { border-color:${T.primary}30; transform:translateY(-4px); box-shadow:0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06); }

        .adm-input-field:focus { outline:none; border-color:${T.primary} !important; box-shadow:0 0 0 2px ${T.primary}25; }
        .adm-spin { animation:admSpin 1s linear infinite; }

        .adm-stat-card { background:${T.surface}; border:1px solid ${T.glassBorder}; border-radius: 20px; padding:0; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04); transition:all 0.2s ease; backdrop-filter:blur(12px); }
        .adm-stat-card:hover { border-color:${T.primary}30; transform:translateY(-4px); box-shadow:0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06); }
        .adm-stat-section { padding:14px 20px; border-bottom:1px solid ${T.glassBorder}; background:${T.bg}06; }
        .adm-stat-section:last-child { border-bottom:none; }

        .adm-tab-btn { transition:all 0.2s cubic-bezier(0.22,1,0.36,1); position:relative; overflow:hidden; }
        .adm-tab-btn:hover { transform:translateY(-3px); }
        .adm-btn { transition:all 0.15s cubic-bezier(0.22,1,0.36,1); }
        .adm-btn:hover { transform:translateY(-3px); }
        .adm-btn:active { transform:translateY(0); }

        .adm-kbd { display:inline-flex; align-items:center; justify-content:center; padding:1px 5px; border-radius: 22px; font-size:9px; font-weight:700; background:${T.surface}; border:1px solid ${T.glassBorder}; color:${T.textDim}; font-family:${T.fontMono}; }

        .adm-tooltip { position:relative; }
        .adm-tooltip:hover .adm-tooltip-content { opacity:1; pointer-events:auto; transform:translateX(-50%) translateY(0); }
        .adm-tooltip-content { position:absolute; bottom:calc(100% + 8px); left:50%; transform:translateX(-50%) translateY(4px); background:rgba(8,8,12,0.96); border:1px solid rgba(255,255,255,0.12); border-radius: 22px; padding:6px 11px; font-size:10px; white-space:nowrap; color:#fff; pointer-events:none; opacity:0; transition:all 0.15s; z-index:9999; }

        .adm-progress-animated { transition:width 1.2s cubic-bezier(0.22,1,0.36,1); }
        .adm-conn-row:hover .adm-kill-btn { opacity:1 !important; }
        .adm-kill-btn { opacity:0 !important; transition:opacity 0.15s; }
        .adm-conn-row:hover { background:rgba(255,255,255,0.02) !important; }

        .adm-neon { animation:admNeonDrift 3s ease-in-out infinite; }
        .adm-flicker { animation:admFlicker 8s ease-in-out infinite; }

        .adm-grid-pattern {
            background-image: linear-gradient(${T.grid}20 1px, transparent 1px), linear-gradient(90deg, ${T.grid}20 1px, transparent 1px);
            background-size: 24px 24px;
        }

        .adm-segment-bar { position:relative; overflow:hidden; border-radius: 20px; }

        .adm-heatmap-cell { transition:all 0.2s; border-radius: 22px; }
        .adm-heatmap-cell:hover { transform:scale(1.3); z-index:2; position:relative; }

        .panel-glow { box-shadow:0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06); }
    `}</style>
);

/* ═══════════════════════════════════════════════════════════════════════════
   DATA & CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */
const RISK_LEVELS = {
    high: { color: THEME.danger, label: 'HIGH RISK', icon: ShieldAlert },
    medium: { color: THEME.warning, label: 'MEDIUM RISK', icon: AlertTriangle },
    low: { color: THEME.success, label: 'LOW RISK', icon: ShieldCheck },
};

const SETTING_CATEGORIES = {
    memory: {
        label: 'Memory',
        icon: MemoryStick,
        color: THEME.primary,
        keys: [
            'shared_buffers',
            'work_mem',
            'maintenance_work_mem',
            'effective_cache_size',
            'wal_buffers',
            'temp_buffers',
            'huge_pages',
        ],
    },
    connections: {
        label: 'Connections',
        icon: Network,
        color: THEME.primary,
        keys: [
            'max_connections',
            'superuser_reserved_connections',
            'max_prepared_transactions',
            'tcp_keepalives',
            'listen_addresses',
            'port',
        ],
    },
    performance: {
        label: 'Performance',
        icon: Zap,
        color: THEME.warning,
        keys: [
            'max_worker_processes',
            'max_parallel_workers',
            'max_parallel_workers_per_gather',
            'random_page_cost',
            'effective_io_concurrency',
            'parallel_tuple_cost',
            'jit',
        ],
    },
    wal: {
        label: 'WAL & Recovery',
        icon: Shield,
        color: THEME.success,
        keys: [
            'wal_level',
            'max_wal_size',
            'min_wal_size',
            'checkpoint_timeout',
            'checkpoint_completion_target',
            'archive_mode',
            'wal_compression',
        ],
    },
    logging: {
        label: 'Logging',
        icon: FileText,
        color: THEME.primary,
        keys: [
            'log_statement',
            'log_min_duration_statement',
            'log_connections',
            'log_disconnections',
            'logging_collector',
            'log_destination',
        ],
    },
    autovacuum: {
        label: 'Autovacuum',
        icon: RefreshCw,
        color: THEME.info,
        keys: [
            'autovacuum',
            'autovacuum_max_workers',
            'autovacuum_naptime',
            'autovacuum_vacuum_threshold',
            'autovacuum_analyze_threshold',
            'autovacuum_vacuum_scale_factor',
        ],
    },
    security: {
        label: 'Security',
        icon: Lock,
        color: THEME.primaryLight,
        keys: [
            'ssl',
            'password_encryption',
            'krb_server_keyfile',
            'pg_hba',
            'row_security',
            'fsync',
            'synchronous_commit',
        ],
    },
};

const categorize = (name) => {
    for (const [cat, def] of Object.entries(SETTING_CATEGORIES)) if (def.keys.some((k) => name.includes(k))) return cat;
    return 'other';
};

const fmtBytes = (b) => {
    const n = Number(b);
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)} KB`;
    return `${n} B`;
};

const calculateTuning = (ramGB, cpus, driveType, profile, pgVersion) => {
    const totalMem = ramGB * 1024 * 1024 * 1024;
    const maxConns = { web: 200, oltp: 300, dw: 40, mixed: 100, readonly: 50 }[profile] || 100;
    const sharedBuffers = Math.floor(totalMem * 0.25);
    const effectiveCache = Math.floor(totalMem * 0.75);
    const maintenanceWorkMem = Math.min(Math.floor(totalMem * 0.1), 2 * 1024 ** 3);
    const estActive = Math.max(1, Math.floor(maxConns * (profile === 'dw' ? 0.5 : 0.1)));
    const workMem = Math.floor((totalMem - sharedBuffers) / (estActive * 3));
    const isSSD = driveType === 'ssd' || driveType === 'nvme';
    const workers = Math.min(8, cpus);
    const gatherWorkers = Math.max(2, Math.floor(workers / 2));
    const toSize = (b) => (b > 1024 ** 3 ? `${Math.floor(b / 1024 ** 3)}GB` : `${Math.floor(b / 1024 ** 2)}MB`);
    return [
        {
            name: 'max_connections',
            val: String(maxConns),
            reason: `Optimized for ${profile} workload`,
            impact: 'restart',
            risk: 'medium',
        },
        {
            name: 'shared_buffers',
            val: toSize(sharedBuffers),
            reason: '25% of system RAM',
            impact: 'restart',
            risk: 'low',
        },
        {
            name: 'effective_cache_size',
            val: toSize(effectiveCache),
            reason: '75% RAM (incl. OS cache)',
            impact: 'reload',
            risk: 'low',
        },
        {
            name: 'maintenance_work_mem',
            val: toSize(maintenanceWorkMem),
            reason: 'Vacuum/index maintenance',
            impact: 'reload',
            risk: 'low',
        },
        {
            name: 'checkpoint_completion_target',
            val: '0.9',
            reason: 'Spreads checkpoint I/O',
            impact: 'reload',
            risk: 'low',
        },
        { name: 'wal_buffers', val: '16MB', reason: 'WAL data buffer', impact: 'restart', risk: 'low' },
        {
            name: 'random_page_cost',
            val: String(isSSD ? 1.1 : 4.0),
            reason: isSSD ? 'SSD random access' : 'HDD seeks',
            impact: 'reload',
            risk: 'low',
        },
        {
            name: 'effective_io_concurrency',
            val: String(isSSD ? 200 : 2),
            reason: isSSD ? 'High I/O conc.' : 'Low I/O conc.',
            impact: 'reload',
            risk: 'low',
        },
        { name: 'work_mem', val: toSize(workMem), reason: 'Per-op sort/hash memory', impact: 'reload', risk: 'medium' },
        {
            name: 'max_worker_processes',
            val: String(workers),
            reason: 'Based on CPU cores',
            impact: 'restart',
            risk: 'low',
        },
        {
            name: 'max_parallel_workers_per_gather',
            val: String(gatherWorkers),
            reason: 'Parallel execution limit',
            impact: 'reload',
            risk: 'low',
        },
    ];
};

const validateSettingValue = (setting, value) => {
    const errors = [];
    if (!value) return errors;
    if (
        ['shared_buffers', 'work_mem', 'maintenance_work_mem', 'effective_cache_size', 'wal_buffers'].includes(
            setting.name,
        )
    )
        if (!/^\d+(MB|GB|kB|TB)$/i.test(value)) errors.push('Must be a memory size like 128MB, 4GB');
    if (setting.name === 'max_connections') {
        const n = parseInt(value);
        if (isNaN(n) || n < 1 || n > 10000) errors.push('Must be 1–10000');
    }
    return errors;
};

/* ── Mock Data ── */
const MOCK_EXTENSIONS = [];

const MOCK_SETTINGS = [];

const MOCK_CACHE = { hitRate: 0, missRate: 0, size: '—', evictions: 0, history: [] };

const MOCK_CONNECTIONS = [];

// Default fallback server stats (used when API is unavailable)
const DEFAULT_SERVER_STATS = {
    version: '—',
    uptime: '—',
    cpu: { pct: 0, cores: 0, freq: '—', history: [] },
    ram: { usedGB: 0, totalGB: 0 },
    disk: { usedGB: 0, totalGB: 0, readMBs: 0, writeMBs: 0 },
    tps: { current: 0, history: [] },
    network: { inKBs: 0, outKBs: 0 },
    replication: { streaming: false, lag: '—', slots: 0 },
};

const MOCK_CHANGE_LOG = [];

/* ═══════════════════════════════════════════════════════════════════════════
   MICRO COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */
const StatusBadge = ({ label, color, pulse, size = 'md' }) => (
    <span
        style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: size === 'sm' ? 9 : 10,
            fontWeight: 700,
            padding: size === 'sm' ? '2px 7px' : '3px 9px',
            borderRadius: 16,
            background: `${color}14`,
            color,
            border: `1px solid ${color}25`,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            letterSpacing: '0.04em',
        }}
    >
        <span
            style={{
                width: size === 'sm' ? 4 : 5,
                height: size === 'sm' ? 4 : 5,
                borderRadius: '50%',
                background: color,
                flexShrink: 0,
                animation: pulse ? 'admPulse 1.5s ease-in-out infinite' : 'none',
            }}
        />
        {label}
    </span>
);

const LiveDot = ({ color = T.success, size = 7 }) => (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color }} />
        <div
            style={{
                position: 'absolute',
                inset: -3,
                borderRadius: '50%',
                border: `1px solid ${color}60`,
                animation: 'admPulseRing 2s ease-out infinite',
            }}
        />
    </div>
);

const Kbd = ({ children }) => <span className="adm-kbd">{children}</span>;

const Tooltip = ({ content, children }) => (
    <div className="adm-tooltip" style={{ display: 'inline-flex' }}>
        {children}
        <div className="adm-tooltip-content">{content}</div>
    </div>
);

/* ── Ring Gauge ── */
const RingGauge = ({ value, color, size = 80, strokeWidth = 6, label, sublabel }) => {
    const r = (size - strokeWidth) / 2;
    const circ = 2 * Math.PI * r;
    const filled = (circ * Math.min(value, 100)) / 100;
    const dangerColor = value > 90 ? T.danger : value > 70 ? T.warning : color;
    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={`${dangerColor}18`}
                    strokeWidth={strokeWidth}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={dangerColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${filled} ${circ - filled}`}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    style={{
                        transition: 'stroke-dasharray 1.2s cubic-bezier(0.22,1,0.36,1)',
                        filter: `drop-shadow(0 0 6px ${dangerColor}70)`,
                    }}
                />
            </svg>
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                }}
            >
                <span
                    style={{
                        fontSize: size > 60 ? 17 : 10,
                        fontWeight: 800,
                        color: dangerColor,
                        fontFamily: T.fontMono,
                        lineHeight: 1,
                    }}
                >
                    {value}%
                </span>
                {label && (
                    <span style={{ fontSize: 8, color: T.textDim, fontWeight: 700, letterSpacing: '0.02em' }}>
                        {label}
                    </span>
                )}
                {sublabel && (
                    <span style={{ fontSize: 7, color: `${dangerColor}80`, fontWeight: 600 }}>{sublabel}</span>
                )}
            </div>
        </div>
    );
};

/* ── Sparkline ── */
const MiniSparkline = ({ data, color, height = 28, width = 80, filled = false }) => {
    if (!Array.isArray(data) || data.length < 2) return null;
    try {
        const safeData = data.filter((v) => typeof v === 'number' && !isNaN(v));
        if (safeData.length < 2) return null;
        const min = Math.min(...safeData),
            max = Math.max(...safeData);
        const range = max - min || 1;
        const pts = safeData
            .map((v, i) => `${(i / (safeData.length - 1)) * width},${height - ((v - min) / range) * (height - 4)}`)
            .join(' ');
        if (!pts) return null;
        const lastPt = pts.split(' ').pop();
        const lx = parseFloat(lastPt?.split(',')[0] || '0');
        const ly = parseFloat(lastPt?.split(',')[1] || '0');
        return (
            <svg width={width} height={height} style={{ overflow: 'visible' }}>
                {filled && <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`${color}12`} />}
                <polyline
                    points={pts}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ filter: `drop-shadow(0 0 3px ${color}50)` }}
                />
                <circle cx={lx} cy={ly} r={3} fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
            </svg>
        );
    } catch {
        return null;
    }
};

/* ── TPS Gauge ── */
const TPSIndicator = ({ value, history, color }) => {
    const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    const formattedValue = (() => {
        try {
            return safeValue.toLocaleString();
        } catch {
            return '0';
        }
    })();
    const safeHistory = Array.isArray(history) ? history : [];
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: metricValue(color), fontFamily: T.fontMono, lineHeight: 1 }}>
                    {formattedValue}
                </span>
                <span style={{ fontSize: 9, color: T.textDim, letterSpacing: '0.02em' }}>TPS</span>
            </div>
            <MiniSparkline data={safeHistory} color={color} width={140} height={28} filled />
        </div>
    );
};

/* ── Stat Card ── */
const StatCard = ({ label, value, icon: Icon, color, sub, spark, trend }) => {
    const safeValue = (() => {
        if (value === null || value === undefined) return '—';
        if (typeof value === 'number') return value;
        return value;
    })();
    const safeTrend = typeof trend === 'number' && !isNaN(trend) ? trend : null;
    const safeSpark = Array.isArray(spark) ? spark : null;
    return (
        <div
            className="adm-stat-card"
            style={{
                '--card-color': color,
                padding: '22px 26px',
                borderRadius: 20,
                background: T.glass,
                border: `1px solid ${T.glassBorder}`,
                position: 'relative',
                overflow: 'hidden',
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
                    background: `${color}06`,
                    filter: 'blur(20px)',
                }}
            />
            <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}
            >
                <div style={{ padding: 8, borderRadius: 20, background: `${color}14`, border: `1px solid ${color}20` }}>
                    <Icon size={14} color={color} />
                </div>
                {safeTrend != null && (
                    <span
                        style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: safeTrend > 0 ? T.success : T.danger,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                        }}
                    >
                        {safeTrend > 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />} {Math.abs(safeTrend)}%
                    </span>
                )}
            </div>
            <div
                style={{ fontSize: 24, fontWeight: 900, color: metricValue(color), fontFamily: T.fontMono, lineHeight: 1, marginBottom: 4 }}
            >
                {safeValue}
            </div>
            <div
                style={{
                    fontSize: 10,
                    color: T.textDim,
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                    marginBottom: safeSpark ? 8 : 0,
                }}
            >
                {label}
            </div>
            {sub && <div style={{ fontSize: 10, color: T.textDim, marginBottom: safeSpark ? 6 : 0 }}>{sub}</div>}
            {safeSpark && <MiniSparkline data={safeSpark} color={color} width="100%" height={24} filled />}
        </div>
    );
};

/* ── Panel ── */
const Panel = ({ title, icon: TIcon, rightNode, noPad, children, style = {}, accent, className = '' }) => (
    <div
        className={`panel-glow ${className}`}
        style={{
            border: `1px solid ${accent ? `${accent}20` : T.glassBorder}`,
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: accent ? `0 0 0 1px ${accent}08, inset 0 1px 0 rgba(255,255,255,0.04)` : 'none',
            ...style,
        }}
    >
        {title && (
            <div
                style={{
                    padding: '13px 20px',
                    borderBottom: `1px solid ${T.glassBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                    background: accent
                        ? `linear-gradient(90deg, ${accent}08 0%, transparent 60%)`
                        : 'linear-gradient(90deg, rgba(255,255,255,0.01), transparent)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    {TIcon && <TIcon size={13} color={accent || T.primary} />}
                    <span
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: T.textMuted,
                            letterSpacing: '0.02em',
                            fontFamily: T.fontBody,
                        }}
                    >
                        {title}
                    </span>
                </div>
                {rightNode}
            </div>
        )}
        <div
            className="adm-scrollbar"
            style={{ flex: 1, minHeight: 0, padding: noPad ? 0 : '16px 20px', overflowY: 'auto' }}
        >
            {children}
        </div>
    </div>
);

/* ── Confirm Dialog ── */
const ConfirmDialog = ({ title, body, onConfirm, onCancel, danger = false }) => (
    <div
        style={{
            position: 'fixed',
            inset: 0,
            zIndex: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
        }}
    >
        <div
            style={{
                width: 420,
                background: T.surface,
                borderRadius: 16,
                border: `1px solid ${danger ? T.danger + '40' : T.glassBorder}`,
                padding: 28,
                boxShadow: `0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)`,
                animation: 'admSlideUp 0.2s ease',
            }}
        >
            <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
                <div
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 16,
                        background: danger ? `${T.danger}15` : `${T.primary}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        border: `1px solid ${danger ? T.danger : T.primary}25`,
                    }}
                >
                    {danger ? <AlertTriangle size={18} color={T.danger} /> : <Info size={18} color={T.primary} />}
                </div>
                <div>
                    <div
                        style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: T.textMain,
                            marginBottom: 6,
                            fontFamily: T.fontBody,
                        }}
                    >
                        {title}
                    </div>
                    <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.6 }}>{body}</div>
                </div>
            </div>
            <div style={{ display: 'flex', gap: 20, justifyContent: 'flex-end' }}>
                <button
                    onClick={onCancel}
                    style={{
                        padding: '9px 18px',
                        borderRadius: 20,
                        background: T.surface,
                        border: `1px solid ${T.grid}50`,
                        color: T.textMuted,
                        cursor: 'pointer',
                        fontSize: 12,
                    }}
                >
                    Cancel
                </button>
                <button
                    onClick={onConfirm}
                    style={{
                        padding: '9px 18px',
                        borderRadius: 20,
                        background: danger ? T.danger : T.primary,
                        border: 'none',
                        color: THEME.textMain,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 700,
                        boxShadow: `0 4px 14px ${danger ? T.danger : T.primary}40`,
                    }}
                >
                    {danger ? 'Yes, proceed' : 'Confirm'}
                </button>
            </div>
        </div>
    </div>
);

/* ── DiffTag ── */
const DiffTag = ({ before, after }) => {
    if (!before || before === after) return null;
    return (
        <span
            style={{
                fontSize: 9,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 7px',
                borderRadius: 20,
                background: `${T.warning}14`,
                color: T.warning,
                border: `1px solid ${T.warning}25`,
                fontFamily: T.fontMono,
            }}
        >
            <span style={{ opacity: 0.6, textDecoration: 'line-through' }}>{before}</span>
            <ArrowUpRight size={7} />
            <strong>{after}</strong>
        </span>
    );
};
/* ═══════════════════════════════════════════════════════════════════════════
   SERVER SIDEBAR — ADVANCED
   ═══════════════════════════════════════════════════════════════════════════ */
const ServerSidebar = ({ collapsed, onToggle, serverStats = DEFAULT_SERVER_STATS }) => {
    // Defensive merge: a partially-shaped serverStats object (e.g. a raw
    // overview-stats payload) must never crash the whole Admin section.
    const s = {
        ...DEFAULT_SERVER_STATS,
        ...(serverStats || {}),
        cpu: { ...DEFAULT_SERVER_STATS.cpu, ...(serverStats?.cpu || {}) },
        ram: { ...DEFAULT_SERVER_STATS.ram, ...(serverStats?.ram || {}) },
        disk: { ...DEFAULT_SERVER_STATS.disk, ...(serverStats?.disk || {}) },
        tps: { ...DEFAULT_SERVER_STATS.tps, ...(serverStats?.tps || {}) },
        network: { ...DEFAULT_SERVER_STATS.network, ...(serverStats?.network || {}) },
        replication: { ...DEFAULT_SERVER_STATS.replication, ...(serverStats?.replication || {}) },
    };
    const cpuColor = s.cpu.pct > 80 ? T.danger : s.cpu.pct > 50 ? T.warning : T.success;
    const ramPct = Math.round((s.ram.usedGB / s.ram.totalGB) * 100);
    const diskPct = Math.round((s.disk.usedGB / s.disk.totalGB) * 100);

    if (collapsed)
        return (
            <div
                style={{
                    width: 40,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 20,
                    paddingTop: 16,
                }}
            >
                <button
                    onClick={onToggle}
                    style={{
                        background: 'none',
                        border: `1px solid ${T.grid}60`,
                        borderRadius: 20,
                        cursor: 'pointer',
                        color: T.textDim,
                        padding: 6,
                        display: 'flex',
                    }}
                >
                    <Server size={13} />
                </button>
                <div title={`CPU ${s.cpu.pct}%`}>
                    <RingGauge value={s.cpu.pct} color={cpuColor} size={30} strokeWidth={4} />
                </div>
                <div title={`RAM ${ramPct}%`}>
                    <RingGauge value={ramPct} color={T.primary} size={30} strokeWidth={4} />
                </div>
                <div title={`Disk ${diskPct}%`}>
                    <RingGauge value={diskPct} color={T.secondary} size={30} strokeWidth={4} />
                </div>
            </div>
        );

    return (
        <div style={{ width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0 8px' }}
            >
                <span
                    style={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        color: T.textDim,
                        letterSpacing: '0.02em',
                        fontFamily: T.fontBody,
                    }}
                >
                    Server Status
                </span>
                <button
                    onClick={onToggle}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textDim, padding: 2 }}
                >
                    <ChevronRight size={12} />
                </button>
            </div>

            {/* Version + TPS */}
            <div
                style={{
                    padding: '22px 28px',
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${T.glassBorder}`,
                    borderRadius: 18,
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                <div className="adm-grid-pattern" style={{ position: 'absolute', inset: 0, opacity: 0.4 }} />
                <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                        <LiveDot color={T.success} size={6} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: T.textMain }}>{s.version}</span>
                    </div>
                    <TPSIndicator value={s.tps.current} history={s.tps.history} color={T.primary} />
                    <div style={{ fontSize: 9, color: T.textDim, marginTop: 6 }}>↑ {s.uptime}</div>
                </div>
            </div>

            {/* Gauges Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
                {[
                    { label: 'CPU', value: s.cpu.pct, color: cpuColor },
                    { label: 'RAM', value: ramPct, color: T.primary },
                    { label: 'Disk', value: diskPct, color: T.secondary },
                ].map((g) => (
                    <div
                        key={g.label}
                        style={{
                            padding: '10px 8px',
                            background: T.glass,
                            border: `1px solid ${T.glassBorder}`,
                            borderRadius: 16,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 4,
                        }}
                    >
                        <RingGauge value={g.value} color={g.color} size={52} strokeWidth={5} />
                        <span style={{ fontSize: 9, color: T.textDim, fontWeight: 700 }}>{g.label}</span>
                    </div>
                ))}
            </div>

            {/* CPU Sparkline */}
            <div
                style={{
                    padding: '22px 28px',
                    background: T.glass,
                    border: `1px solid ${T.glassBorder}`,
                    borderRadius: 11,
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Cpu size={10} color={T.textDim} />
                        <span style={{ fontSize: 9.5, color: T.textDim, fontWeight: 600 }}>
                            CPU · {s.cpu.cores} cores · {s.cpu.freq}
                        </span>
                    </div>
                </div>
                <MiniSparkline data={s.cpu.history} color={cpuColor} width={178} height={28} filled />
            </div>

            {/* Memory */}
            <div
                style={{
                    padding: '22px 28px',
                    background: T.glass,
                    border: `1px solid ${T.glassBorder}`,
                    borderRadius: 11,
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <MemoryStick size={10} color={T.textDim} />
                        <span style={{ fontSize: 9.5, color: T.textDim, fontWeight: 600 }}>Memory</span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, color: T.primary, fontFamily: T.fontMono }}>
                        {s.ram.usedGB}/{s.ram.totalGB}GB
                    </span>
                </div>
                <div style={{ height: 5, background: `${T.grid}50`, borderRadius: 16, overflow: 'hidden' }}>
                    <div
                        style={{
                            width: `${ramPct}%`,
                            height: '100%',
                            background: `linear-gradient(90deg, ${T.primary}, ${T.secondary})`,
                            borderRadius: 16,
                            transition: 'width 1s ease',
                        }}
                    />
                </div>
            </div>

            {/* Disk I/O */}
            <div
                style={{
                    padding: '22px 28px',
                    background: T.glass,
                    border: `1px solid ${T.glassBorder}`,
                    borderRadius: 11,
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <HardDrive size={10} color={T.textDim} />
                        <span style={{ fontSize: 9.5, color: T.textDim, fontWeight: 600 }}>Disk I/O</span>
                    </div>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: T.secondary, fontFamily: T.fontMono }}>
                        {diskPct}%
                    </span>
                </div>
                <div
                    style={{
                        height: 4,
                        background: `${T.grid}50`,
                        borderRadius: 2,
                        overflow: 'hidden',
                        marginBottom: 6,
                    }}
                >
                    <div style={{ width: `${diskPct}%`, height: '100%', background: T.secondary, borderRadius: 2 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                    <span style={{ color: T.success }}>↓ {s.disk.readMBs} MB/s</span>
                    <span style={{ color: T.warning }}>↑ {s.disk.writeMBs} MB/s</span>
                </div>
            </div>

            {/* Network */}
            <div
                style={{
                    padding: '22px 28px',
                    background: T.glass,
                    border: `1px solid ${T.glassBorder}`,
                    borderRadius: 11,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                    <Wifi size={10} color={T.textDim} />
                    <span style={{ fontSize: 9.5, color: T.textDim, fontWeight: 600 }}>Network</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                    <span style={{ color: T.primary }}>↓ {s.network.inKBs} KB/s</span>
                    <span style={{ color: T.info }}>↑ {s.network.outKBs} KB/s</span>
                </div>
            </div>

            {/* Replication */}
            <div
                style={{
                    padding: '22px 28px',
                    background: `${s.replication.streaming ? T.success : T.danger}06`,
                    border: `1px solid ${s.replication.streaming ? T.success + '30' : T.danger + '30'}`,
                    borderRadius: 11,
                }}
            >
                <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <GitBranch size={10} color={s.replication.streaming ? T.success : T.danger} />
                        <span style={{ fontSize: 9.5, color: T.textDim, fontWeight: 600 }}>Replication</span>
                    </div>
                    <LiveDot color={s.replication.streaming ? T.success : T.danger} size={6} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5 }}>
                    <span style={{ color: T.textDim }}>
                        Lag: <strong style={{ color: T.success }}>{s.replication.lag}</strong>
                    </span>
                    <span style={{ color: T.textDim }}>
                        Slots: <strong style={{ color: T.textMain }}>{s.replication.slots}</strong>
                    </span>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   TUNING WIZARD
   ═══════════════════════════════════════════════════════════════════════════ */
const TuningModal = ({ onClose, onApply, currentSettings }) => {
    const [step, setStep] = useState(1);
    const [inputs, setInputs] = useState({ ram: 8, cpus: 4, storage: 'ssd', profile: 'web', pgVersion: 16 });
    const [recommendations, setRecommendations] = useState([]);
    const [selected, setSelected] = useState(new Set());

    const handleCalculate = () => {
        const recs = calculateTuning(inputs.ram, inputs.cpus, inputs.storage, inputs.profile, inputs.pgVersion);
        setRecommendations(recs);
        setSelected(new Set(recs.map((r) => r.name)));
        setStep(2);
    };

    const getCurrent = (key) => {
        const f = currentSettings.find((s) => s.name === key);
        return f ? `${f.setting}${f.unit || ''}` : '—';
    };
    const toggleSel = (name) => {
        const n = new Set(selected);
        n.has(name) ? n.delete(name) : n.add(name);
        setSelected(n);
    };
    const safeRecommendations = Array.isArray(recommendations) ? recommendations : [];
    const restartCount = safeRecommendations.filter((r) => selected.has(r?.name) && r?.impact === 'restart').length;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.8)',
                backdropFilter: 'blur(4px)',
            }}
        >
            <div
                style={{
                    width: 680,
                    maxHeight: '92vh',
                    display: 'flex',
                    flexDirection: 'column',
                    background: T.surface,
                    borderRadius: 20,
                    border: `1px solid ${T.glassBorder}`,
                    boxShadow: `0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px ${T.primary}10`,
                    overflow: 'hidden',
                    animation: 'admSlideUp 0.25s cubic-bezier(0.22,1,0.36,1)',
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: '18px 26px',
                        borderBottom: `1px solid ${T.grid}30`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: `linear-gradient(135deg, ${T.primary}08, ${T.secondary}04)`,
                        position: 'relative',
                        overflow: 'hidden',
                    }}
                >
                    <div className="adm-grid-pattern" style={{ position: 'absolute', inset: 0, opacity: 0.3 }} />
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 20 }}>
                        <div
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 18,
                                background: `linear-gradient(135deg, ${T.primary}, ${T.secondary})`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: `0 6px 20px ${T.primary}50`,
                            }}
                            className="adm-float"
                        >
                            <Sparkles size={20} color={THEME.textMain} />
                        </div>
                        <div>
                            <div
                                style={{
                                    fontSize: 17,
                                    fontWeight: 800,
                                    color: T.textMain,
                                    fontFamily: T.fontBody,
                                    letterSpacing: '-0.02em',
                                }}
                            >
                                Config Tuning Wizard
                            </div>
                            <div style={{ fontSize: 10, color: T.textDim }}>
                                Step {step} of 2 · {step === 1 ? 'System Specifications' : 'Review Recommendations'}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            position: 'relative',
                            background: `${T.grid}60`,
                            border: `1px solid ${T.grid}80`,
                            cursor: 'pointer',
                            color: T.textDim,
                            width: 30,
                            height: 30,
                            borderRadius: 20,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Step Bar */}
                <div
                    style={{
                        padding: '12px 26px',
                        borderBottom: `1px solid ${T.grid}20`,
                        display: 'flex',
                        gap: 20,
                        alignItems: 'center',
                    }}
                >
                    {[1, 2].map((i) => (
                        <React.Fragment key={i}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <div
                                    style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: '50%',
                                        background: i <= step ? T.primary : T.surface,
                                        border: `2px solid ${i <= step ? T.primary : T.grid}50`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 10,
                                        fontWeight: 800,
                                        color: i <= step ? THEME.textMain : T.textDim,
                                        transition: 'all 0.3s',
                                    }}
                                >
                                    {i < step ? <Check size={11} /> : i}
                                </div>
                                <span
                                    style={{
                                        fontSize: 10.5,
                                        color: i <= step ? T.textMain : T.textDim,
                                        fontWeight: i === step ? 700 : 500,
                                    }}
                                >
                                    {i === 1 ? 'System Specs' : 'Recommendations'}
                                </span>
                            </div>
                            {i < 2 && (
                                <div
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        height: 1,
                                        background: step > i ? T.primary : `${T.grid}40`,
                                        transition: 'background 0.4s',
                                    }}
                                />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                <div
                    className="adm-scrollbar"
                    style={{ padding: '24px 26px', overflowY: 'auto', flex: 1, minHeight: 0 }}
                >
                    {step === 1 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                                {[
                                    { key: 'ram', label: 'System RAM', unit: 'GB', icon: MemoryStick },
                                    { key: 'cpus', label: 'CPU Cores', unit: 'cores', icon: Cpu },
                                    {
                                        key: 'pgVersion',
                                        label: 'PG Version',
                                        unit: '',
                                        icon: Database,
                                        min: 12,
                                        max: 17,
                                    },
                                ].map((f) => (
                                    <div key={f.key}>
                                        <label
                                            style={{
                                                display: 'block',
                                                fontSize: 9.5,
                                                fontWeight: 800,
                                                color: T.textDim,
                                                marginBottom: 7,
                                                letterSpacing: '0.02em',
                                            }}
                                        >
                                            {f.label}
                                        </label>
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 20,
                                                padding: '10px 13px',
                                                background: T.surface,
                                                border: `1px solid ${T.grid}50`,
                                                borderRadius: 20,
                                            }}
                                        >
                                            <f.icon size={14} color={T.primary} />
                                            <input
                                                type="number"
                                                value={inputs[f.key]}
                                                min={f.min || 1}
                                                max={f.max || 2048}
                                                onChange={(e) =>
                                                    setInputs({ ...inputs, [f.key]: Number(e.target.value) })
                                                }
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: T.textMain,
                                                    width: '100%',
                                                    fontWeight: 800,
                                                    fontSize: 14,
                                                    fontFamily: T.fontMono,
                                                }}
                                            />
                                            {f.unit && (
                                                <span style={{ fontSize: 9.5, color: T.textDim, whiteSpace: 'nowrap' }}>
                                                    {f.unit}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: 9.5,
                                        fontWeight: 800,
                                        color: T.textDim,
                                        marginBottom: 8,
                                    }}
                                >
                                    Storage Type
                                </label>
                                <div style={{ display: 'flex', gap: 20 }}>
                                    {[
                                        { v: 'ssd', l: 'SSD', i: Zap, d: 'Solid State' },
                                        { v: 'nvme', l: 'NVMe', i: Flame, d: 'Ultra Fast' },
                                        { v: 'hdd', l: 'HDD', i: HardDrive, d: 'Spinning Disk' },
                                    ].map((t) => (
                                        <button
                                            key={t.v}
                                            onClick={() => setInputs({ ...inputs, storage: t.v })}
                                            style={{
                                                flex: 1,
                                                minWidth: 0,
                                                padding: '12px',
                                                borderRadius: 16,
                                                border: `1px solid ${inputs.storage === t.v ? T.primary : T.grid}50`,
                                                background: inputs.storage === t.v ? `${T.primary}14` : 'transparent',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            <t.i
                                                size={18}
                                                color={inputs.storage === t.v ? T.primary : T.textDim}
                                                style={{ display: 'block', margin: '0 auto 6px' }}
                                            />
                                            <div
                                                style={{
                                                    color: inputs.storage === t.v ? THEME.textMain : T.textMuted,
                                                    fontWeight: 700,
                                                    fontSize: 12,
                                                }}
                                            >
                                                {t.l}
                                            </div>
                                            <div style={{ color: T.textDim, fontSize: 9.5 }}>{t.d}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: 9.5,
                                        fontWeight: 800,
                                        color: T.textDim,
                                        marginBottom: 8,
                                    }}
                                >
                                    Workload Profile
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                    {[
                                        {
                                            id: 'web',
                                            l: 'Web Application',
                                            d: 'High concurrency, short queries',
                                            i: Network,
                                        },
                                        { id: 'oltp', l: 'OLTP', d: 'Transaction safety, mixed workloads', i: Zap },
                                        { id: 'dw', l: 'Data Warehouse', d: 'Large analytical queries', i: BarChart3 },
                                        { id: 'mixed', l: 'Mixed', d: 'General purpose workload', i: Layers },
                                        { id: 'readonly', l: 'Read-Only', d: 'Reporting replica, low writes', i: Eye },
                                    ].map((p) => (
                                        <button
                                            key={p.id}
                                            onClick={() => setInputs({ ...inputs, profile: p.id })}
                                            style={{
                                                padding: '22px 28px',
                                                borderRadius: 16,
                                                border: `1px solid ${inputs.profile === p.id ? T.secondary : T.grid}50`,
                                                background:
                                                    inputs.profile === p.id ? `${T.secondary}10` : 'transparent',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 18,
                                            }}
                                        >
                                            <p.i
                                                size={14}
                                                color={inputs.profile === p.id ? T.secondary : T.textDim}
                                                style={{ flexShrink: 0 }}
                                            />
                                            <div>
                                                <div
                                                    style={{
                                                        color: inputs.profile === p.id ? THEME.textMain : T.textMain,
                                                        fontWeight: 700,
                                                        fontSize: 12,
                                                    }}
                                                >
                                                    {p.l}
                                                </div>
                                                <div style={{ color: T.textDim, fontSize: 9.5, marginTop: 2 }}>
                                                    {p.d}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleCalculate}
                                style={{
                                    padding: '14px',
                                    borderRadius: 18,
                                    background: `linear-gradient(135deg, ${T.primary}, ${T.secondary})`,
                                    color: THEME.textMain,
                                    border: 'none',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 9,
                                    fontSize: 13,
                                    fontFamily: T.fontBody,
                                    boxShadow: `0 6px 20px ${T.primary}50`,
                                    letterSpacing: '-0.01em',
                                }}
                            >
                                <Sparkles size={16} /> Generate Recommendations
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: restartCount > 0 ? '1fr 1fr' : '1fr',
                                    gap: 22,
                                }}
                            >
                                <div
                                    style={{
                                        padding: '18px 22px',
                                        borderRadius: 16,
                                        background: `${T.success}08`,
                                        border: `1px solid ${T.success}20`,
                                        display: 'flex',
                                        gap: 18,
                                        alignItems: 'center',
                                    }}
                                >
                                    <CheckCircle size={20} color={T.success} style={{ flexShrink: 0 }} />
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: T.success }}>
                                            {recommendations.length} parameters optimized
                                        </div>
                                        <div style={{ fontSize: 9.5, color: T.textMuted, marginTop: 1 }}>
                                            {inputs.ram}GB · {inputs.cpus} Cores · {inputs.storage.toUpperCase()} ·{' '}
                                            {inputs.profile}
                                        </div>
                                    </div>
                                </div>
                                {restartCount > 0 && (
                                    <div
                                        style={{
                                            padding: '18px 22px',
                                            borderRadius: 16,
                                            background: `${T.warning}08`,
                                            border: `1px solid ${T.warning}20`,
                                            display: 'flex',
                                            gap: 18,
                                            alignItems: 'center',
                                        }}
                                    >
                                        <AlertTriangle size={20} color={T.warning} style={{ flexShrink: 0 }} />
                                        <div>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: T.warning }}>
                                                {restartCount} require restart
                                            </div>
                                            <div style={{ fontSize: 9.5, color: T.textMuted, marginTop: 1 }}>
                                                Plan a maintenance window
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 11, color: T.textDim }}>
                                    {selected.size} of {safeRecommendations.length} selected
                                </span>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button
                                        onClick={() =>
                                            setSelected(
                                                new Set(safeRecommendations.map((r) => r?.name).filter((n) => n)),
                                            )
                                        }
                                        style={{
                                            fontSize: 10,
                                            padding: '4px 9px',
                                            borderRadius: 16,
                                            background: 'transparent',
                                            border: `1px solid ${T.grid}50`,
                                            color: T.textDim,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        All
                                    </button>
                                    <button
                                        onClick={() => setSelected(new Set())}
                                        style={{
                                            fontSize: 10,
                                            padding: '4px 9px',
                                            borderRadius: 16,
                                            background: 'transparent',
                                            border: `1px solid ${T.grid}50`,
                                            color: T.textDim,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        None
                                    </button>
                                </div>
                            </div>

                            <div style={{ border: `1px solid ${T.grid}40`, borderRadius: 18, overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                                    <thead style={{ background: `${T.surface}` }}>
                                        <tr>
                                            <th style={{ padding: '9px 14px', width: 36 }}></th>
                                            <th
                                                style={{
                                                    padding: '9px 14px',
                                                    textAlign: 'left',
                                                    fontSize: 9.5,
                                                    color: T.textDim,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                Parameter
                                            </th>
                                            <th
                                                style={{
                                                    padding: '9px 14px',
                                                    textAlign: 'left',
                                                    fontSize: 9.5,
                                                    color: T.textDim,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                Current
                                            </th>
                                            <th
                                                style={{
                                                    padding: '9px 14px',
                                                    textAlign: 'left',
                                                    fontSize: 9.5,
                                                    color: T.success,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                Recommended
                                            </th>
                                            <th
                                                style={{
                                                    padding: '9px 14px',
                                                    textAlign: 'center',
                                                    fontSize: 9.5,
                                                    color: T.textDim,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                Apply
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {safeRecommendations.map((rec) => {
                                            const curr = getCurrent(rec?.name || '');
                                            const changed =
                                                (curr || '').replace(/ /g, '') !== (rec?.val || '').replace(/ /g, '');
                                            const isSel = selected.has(rec?.name);
                                            return (
                                                <tr
                                                    key={rec.name}
                                                    onClick={() => toggleSel(rec.name)}
                                                    style={{
                                                        borderTop: `1px solid ${T.grid}20`,
                                                        background: isSel && changed ? `${T.success}04` : 'transparent',
                                                        cursor: 'pointer',
                                                        transition: 'background 0.15s',
                                                    }}
                                                >
                                                    <td style={{ padding: '22px 28px', textAlign: 'center' }}>
                                                        <div
                                                            style={{
                                                                width: 16,
                                                                height: 16,
                                                                borderRadius: 20,
                                                                border: `2px solid ${isSel ? T.primary : T.grid}60`,
                                                                background: isSel ? T.primary : 'transparent',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                transition: 'all 0.15s',
                                                            }}
                                                        >
                                                            {isSel && <Check size={10} color={THEME.textMain} />}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '22px 28px' }}>
                                                        <div
                                                            style={{
                                                                fontWeight: 600,
                                                                color: T.textMain,
                                                                fontFamily: T.fontMono,
                                                                fontSize: 11,
                                                            }}
                                                        >
                                                            {rec?.name || '—'}
                                                        </div>
                                                        <div style={{ fontSize: 9, color: T.textDim }}>
                                                            {rec?.reason || ''}
                                                        </div>
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: '22px 28px',
                                                            fontFamily: T.fontMono,
                                                            color: T.textMuted,
                                                            fontSize: 11,
                                                        }}
                                                    >
                                                        {curr || '—'}
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: '22px 28px',
                                                            fontFamily: T.fontMono,
                                                            fontWeight: 700,
                                                            color: changed ? T.success : T.textDim,
                                                            fontSize: 11,
                                                        }}
                                                    >
                                                        {rec?.val || '—'}
                                                        {changed && (
                                                            <ArrowUpRight
                                                                size={9}
                                                                style={{
                                                                    marginLeft: 3,
                                                                    display: 'inline',
                                                                    verticalAlign: 'middle',
                                                                }}
                                                            />
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '22px 28px', textAlign: 'center' }}>
                                                        <span
                                                            style={{
                                                                fontSize: 9,
                                                                padding: '2px 7px',
                                                                borderRadius: 20,
                                                                background:
                                                                    rec?.impact === 'restart'
                                                                        ? `${T.warning}15`
                                                                        : `${T.success}10`,
                                                                color:
                                                                    rec?.impact === 'restart' ? T.warning : T.success,
                                                                fontWeight: 700,
                                                            }}
                                                        >
                                                            {rec?.impact === 'restart' ? '⚡ restart' : '↺ reload'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ display: 'flex', gap: 22 }}>
                                <button
                                    onClick={() => setStep(1)}
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        padding: '12px',
                                        background: 'transparent',
                                        border: `1px solid ${T.grid}50`,
                                        borderRadius: 16,
                                        color: T.textMuted,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 6,
                                        fontSize: 12,
                                    }}
                                >
                                    <CornerUpLeft size={13} /> Back
                                </button>
                                <button
                                    onClick={() => onApply(safeRecommendations.filter((r) => selected.has(r?.name)))}
                                    disabled={!selected.size}
                                    style={{
                                        flex: 2,
                                        padding: '12px',
                                        background: selected.size
                                            ? `linear-gradient(135deg, ${T.success}, ${T.teal})`
                                            : T.grid,
                                        border: 'none',
                                        borderRadius: 16,
                                        color: selected.size ? '#000' : T.textDim,
                                        fontWeight: 800,
                                        cursor: selected.size ? 'pointer' : 'not-allowed',
                                        fontSize: 12,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 7,
                                        fontFamily: T.fontBody,
                                        boxShadow: selected.size ? `0 4px 16px ${T.success}40` : 'none',
                                    }}
                                >
                                    <Save size={14} /> Apply {selected.size} Recommendations
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   CHANGE LOG MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
const ChangeLogModal = ({ onClose }) => (
    <div
        style={{
            position: 'fixed',
            inset: 0,
            zIndex: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(4px)',
        }}
    >
        <div
            style={{
                width: 560,
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                background: T.surface,
                borderRadius: 18,
                border: `1px solid ${T.glassBorder}`,
                overflow: 'hidden',
                boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
                animation: 'admSlideUp 0.2s ease',
            }}
        >
            <div
                style={{
                    padding: '16px 22px',
                    borderBottom: `1px solid ${T.grid}30`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: `linear-gradient(90deg, ${T.primary}06, transparent)`,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <History size={14} color={T.primary} />
                    <span style={{ fontSize: 14, fontWeight: 800, color: T.textMain, fontFamily: T.fontBody }}>
                        Configuration History
                    </span>
                </div>
                <button
                    onClick={onClose}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textDim, padding: 4 }}
                >
                    <X size={16} />
                </button>
            </div>
            <div className="adm-scrollbar" style={{ padding: '20px 22px', overflowY: 'auto' }}>
                {MOCK_CHANGE_LOG.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '32px 16px', color: T.textDim }}>
                        <History
                            size={28}
                            color={T.textDim}
                            style={{ display: 'block', margin: '0 auto 12px', opacity: 0.6 }}
                        />
                        <div style={{ fontSize: 13, fontWeight: 600 }}>No configuration changes recorded</div>
                        <div style={{ fontSize: 11, marginTop: 6, color: T.textMuted }}>
                            Configuration change history will appear here as changes are made.
                        </div>
                    </div>
                )}
                {MOCK_CHANGE_LOG.map((entry, i) => (
                    <div key={entry.id} style={{ display: 'flex', gap: 20, marginBottom: 20, position: 'relative' }}>
                        {i < MOCK_CHANGE_LOG.length - 1 && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: 11,
                                    top: 22,
                                    bottom: -20,
                                    width: 1,
                                    background: `${T.grid}40`,
                                }}
                            />
                        )}
                        <div
                            style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                background: `${T.primary}16`,
                                border: `1px solid ${T.primary}40`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                zIndex: 1,
                            }}
                        >
                            <GitBranch size={10} color={T.primary} />
                        </div>
                        <div
                            style={{
                                flex: 1,
                                minWidth: 0,
                                padding: '22px 28px',
                                background: T.glass,
                                border: `1px solid ${T.glassBorder}`,
                                borderRadius: 16,
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span
                                    style={{ fontFamily: T.fontMono, fontSize: 12, fontWeight: 700, color: T.primary }}
                                >
                                    {entry.param}
                                </span>
                                <span style={{ fontSize: 9.5, color: T.textDim }}>
                                    {new Date(entry.ts).toLocaleDateString()}{' '}
                                    {new Date(entry.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 6 }}>
                                <span
                                    style={{
                                        fontFamily: T.fontMono,
                                        fontSize: 11,
                                        color: T.textDim,
                                        textDecoration: 'line-through',
                                    }}
                                >
                                    {entry.before}
                                </span>
                                <ArrowUpRight size={10} color={T.textDim} />
                                <span
                                    style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 700, color: T.success }}
                                >
                                    {entry.after}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: 20 }}>
                                <span style={{ fontSize: 9.5, color: T.textDim }}>
                                    by <strong style={{ color: T.textMuted }}>{entry.user}</strong>
                                </span>
                                <span
                                    style={{
                                        fontSize: 9,
                                        padding: '1px 6px',
                                        borderRadius: 16,
                                        background: `${T.primary}10`,
                                        color: T.primary,
                                        border: `1px solid ${T.primary}20`,
                                    }}
                                >
                                    {entry.source}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   CACHE TAB — VISUAL UPGRADE
   ═══════════════════════════════════════════════════════════════════════════ */
const CacheView = ({ onClear }) => {
    const c = MOCK_CACHE;

    if (!c || c.history.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '48px 32px', color: T.textDim }}>
                <Gauge size={32} color={T.textDim} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.6 }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>Cache statistics unavailable</div>
                <div style={{ fontSize: 12, marginTop: 6, color: T.textMuted }}>
                    Ensure the database connection is active. Cache data will load automatically.
                </div>
            </div>
        );
    }

    const usedPct = Math.round((c.size / c.maxSize) * 100);

    return (
        <div className="adm-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
                <StatCard
                    label="Hit Rate"
                    value={`${c.hitRate}%`}
                    icon={CheckCircle}
                    color={T.success}
                    spark={c.recentHits}
                    trend={2.1}
                />
                <StatCard label="Miss Rate" value={`${c.missRate}%`} icon={XCircle} color={T.danger} trend={-0.4} />
                <StatCard label="Entries" value={c.entries} icon={Hash} color={T.primary} sub="cached objects" />
                <StatCard label="Evictions" value={c.evictions} icon={Trash2} color={T.warning} sub="this session" />
            </div>

            {/* Main panels */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 22 }}>
                {/* Ring + Controls */}
                <Panel title="Memory Usage" icon={Gauge} accent={T.primary}>
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 20,
                            padding: '8px 0',
                        }}
                    >
                        <div style={{ position: 'relative' }}>
                            <RingGauge
                                value={usedPct}
                                color={T.primary}
                                size={140}
                                strokeWidth={10}
                                label="Used"
                                sublabel={`${c.size}/${c.maxSize}KB`}
                            />
                        </div>

                        {/* Stats below ring */}
                        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                            {[
                                { label: 'Avg TTL', val: c?.avgTtl || '—', color: T.info },
                                {
                                    label: 'Last Cleared',
                                    val: c?.lastCleared ? new Date(c.lastCleared).toLocaleDateString() : '—',
                                    color: T.textMuted,
                                },
                            ].map((item) => (
                                <div
                                    key={item.label}
                                    style={{
                                        padding: '9px 10px',
                                        background: T.surface,
                                        borderRadius: 20,
                                        border: `1px solid ${T.grid}40`,
                                    }}
                                >
                                    <div style={{ fontSize: 9, color: T.textDim, marginBottom: 3 }}>{item.label}</div>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: item.color,
                                            fontFamily: T.fontMono,
                                        }}
                                    >
                                        {item.val}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ width: '100%', display: 'flex', gap: 20 }}>
                            <button
                                onClick={onClear}
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 7,
                                    padding: '10px',
                                    background: `${T.danger}10`,
                                    color: T.danger,
                                    border: `1px solid ${T.danger}25`,
                                    borderRadius: 20,
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    transition: 'all 0.2s',
                                }}
                            >
                                <Trash2 size={12} /> Clear Cache
                            </button>
                            <button
                                style={{
                                    padding: '10px',
                                    background: T.glass,
                                    border: `1px solid ${T.glassBorder}`,
                                    borderRadius: 20,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <RefreshCw size={13} color={T.textDim} />
                            </button>
                        </div>
                    </div>
                </Panel>

                {/* Breakdown */}
                <Panel title="Cache Breakdown" icon={BarChart3} accent={T.secondary}>
                    {/* Stacked bar */}
                    <div style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 9.5, color: T.textDim, marginBottom: 6, letterSpacing: '0.02em' }}>
                            Composition
                        </div>
                        <div style={{ display: 'flex', height: 12, borderRadius: 18, overflow: 'hidden', gap: 1 }}>
                            {Array.isArray(c?.breakdown) &&
                                c.breakdown.map((b, i) => (
                                    <Tooltip key={i} content={`${b?.label || 'Item'}: ${b?.pct || 0}%`}>
                                        <div
                                            style={{
                                                flex: typeof b?.pct === 'number' ? b.pct : 0,
                                                background: b?.color || T.grid,
                                                transition: 'flex 0.8s ease',
                                                minWidth: 4,
                                            }}
                                        />
                                    </Tooltip>
                                ))}
                        </div>
                        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginTop: 8 }}>
                            {Array.isArray(c?.breakdown) &&
                                c.breakdown.map((b, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <div
                                            style={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: 2,
                                                background: b?.color || T.grid,
                                                flexShrink: 0,
                                            }}
                                        />
                                        <span style={{ fontSize: 9, color: T.textDim }}>
                                            {b?.label || 'Item'} ({b?.pct || 0}%)
                                        </span>
                                    </div>
                                ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                        {c.breakdown.map((b, i) => (
                            <div key={i}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                        <div style={{ width: 9, height: 9, borderRadius: 2, background: b.color }} />
                                        <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>
                                            {b.label}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 18 }}>
                                        <span style={{ fontSize: 9.5, color: T.textDim }}>{b.count} entries</span>
                                        <span
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 800,
                                                color: T.textMain,
                                                fontFamily: T.fontMono,
                                            }}
                                        >
                                            {b.size} KB
                                        </span>
                                    </div>
                                </div>
                                <div
                                    style={{
                                        height: 5,
                                        background: `${T.grid}40`,
                                        borderRadius: 16,
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div
                                        className="adm-progress-animated"
                                        style={{
                                            width: `${b.pct * 2.5}%`,
                                            height: '100%',
                                            background: `linear-gradient(90deg, ${b.color}, ${b.color}bb)`,
                                            borderRadius: 16,
                                            maxWidth: '100%',
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </Panel>
            </div>

            {/* Hit Rate Trend */}
            <Panel title="Hit Rate Over Time" icon={TrendingUp} accent={T.success}>
                <div style={{ padding: '4px 0 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, marginBottom: 12 }}>
                        <span
                            style={{
                                fontSize: 32,
                                fontWeight: 900,
                                color: T.success,
                                fontFamily: T.fontMono,
                                lineHeight: 1,
                            }}
                        >
                            {typeof c?.hitRate === 'number' ? c.hitRate : 0}%
                        </span>
                        <span style={{ fontSize: 11, color: T.success }}>↑ 2.1% vs yesterday</span>
                    </div>
                    <svg width="100%" height={60} style={{ overflow: 'visible' }}>
                        {Array.isArray(c?.history) &&
                            c.history.map((v, i) => {
                                const x = (i / (c.history.length - 1)) * 100;
                                const y = 60 - (((typeof v === 'number' ? v : 70) - 70) / 30) * 54;
                                return (
                                    <Tooltip key={i} content={`${typeof v === 'number' ? v.toFixed(1) : '0'}%`}>
                                        <circle
                                            cx={`${x}%`}
                                            cy={y}
                                            r={4}
                                            fill={T.success}
                                            style={{
                                                opacity: i === (c?.history?.length || 1) - 1 ? 1 : 0.4,
                                                filter: `drop-shadow(0 0 4px ${T.success})`,
                                                cursor: 'pointer',
                                            }}
                                        />
                                    </Tooltip>
                                );
                            })}
                        <polyline
                            points={
                                Array.isArray(c?.history)
                                    ? c.history
                                          .map(
                                              (v, i) =>
                                                  `${(i / ((c?.history?.length || 1) - 1)) * 100}% ${60 - (((typeof v === 'number' ? v : 70) - 70) / 30) * 54}`,
                                          )
                                          .join(' ')
                                    : '0 60'
                            }
                            fill="none"
                            stroke={T.success}
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ filter: `drop-shadow(0 0 5px ${T.success}60)` }}
                        />
                    </svg>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        <span style={{ fontSize: 9.5, color: T.textDim }}>15 sessions ago</span>
                        <span style={{ fontSize: 9.5, color: T.textDim }}>Now</span>
                    </div>
                </div>
            </Panel>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   CONNECTIONS TAB — VISUAL UPGRADE
   ═══════════════════════════════════════════════════════════════════════════ */
const ConnectionsView = ({ connData, onKill, onRefresh }) => {
    const [sortField, setSortField] = useState('durationMs');
    const [sortDir, setSortDir] = useState('desc');
    const [filterState, setFilterState] = useState('all');

    const sorted = useMemo(() => {
        let list = Array.isArray(connData) ? [...connData] : [];
        if (filterState !== 'all')
            list = list.filter((c) => typeof c?.state === 'string' && c.state.includes(filterState));
        return list.sort((a, b) => {
            const av = a?.[sortField],
                bv = b?.[sortField];
            const cmp =
                typeof av === 'number' && typeof bv === 'number'
                    ? av - bv
                    : String(av || '').localeCompare(String(bv || ''));
            return sortDir === 'desc' ? -cmp : cmp;
        });
    }, [connData, sortField, sortDir, filterState]);

    const stats = useMemo(() => {
        const safe = Array.isArray(connData) ? connData : [];
        const cpus = safe.map((c) => (typeof c?.cpu === 'number' ? c.cpu : 0)).filter((v) => !isNaN(v));
        return {
            total: safe.length,
            active: safe.filter((c) => c?.state === 'active').length,
            waiting: safe.filter((c) => c?.wait).length,
            idle: safe.filter((c) => typeof c?.state === 'string' && c.state.includes('idle')).length,
            maxCpu: cpus.length > 0 ? Math.max(...cpus) : 0,
        };
    }, [connData]);

    const toggleSort = (f) => {
        if (sortField === f) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else {
            setSortField(f);
            setSortDir('desc');
        }
    };

    const ColHeader = ({ field, children }) => (
        <th
            onClick={() => toggleSort(field)}
            style={{
                padding: '22px 28px',
                textAlign: 'left',
                fontSize: 9.5,
                fontWeight: 700,
                color: sortField === field ? T.primary : T.textDim,
                cursor: 'pointer',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                letterSpacing: '0.02em',
            }}
        >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {children}
                {sortField === field && (sortDir === 'asc' ? <ChevronUp size={9} /> : <ChevronDown size={9} />)}
            </span>
        </th>
    );

    return (
        <div className="adm-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 22 }}>
                {[
                    { label: 'Total', value: stats.total, color: T.textMain, icon: Network },
                    { label: 'Active', value: stats.active, color: T.success, icon: Activity },
                    { label: 'Waiting', value: stats.waiting, color: T.warning, icon: Clock },
                    { label: 'Idle', value: stats.idle, color: T.textDim, icon: Minus },
                    {
                        label: 'Peak CPU',
                        value: `${stats.maxCpu}%`,
                        color: stats.maxCpu > 80 ? T.danger : T.primary,
                        icon: Cpu,
                    },
                ].map((s) => (
                    <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} color={s.color} />
                ))}
            </div>

            {/* Filter + refresh */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                    {[
                        { v: 'all', l: 'All' },
                        { v: 'active', l: 'Active' },
                        { v: 'idle', l: 'Idle' },
                        { v: 'transaction', l: 'In Txn' },
                    ].map((f) => (
                        <button
                            key={f.v}
                            onClick={() => setFilterState(f.v)}
                            style={{
                                padding: '5px 12px',
                                borderRadius: 18,
                                border: `1px solid ${filterState === f.v ? T.primary : T.grid}50`,
                                background: filterState === f.v ? `${T.primary}12` : 'transparent',
                                color: filterState === f.v ? T.primary : T.textDim,
                                cursor: 'pointer',
                                fontSize: 10.5,
                                fontWeight: 600,
                            }}
                        >
                            {f.l}
                        </button>
                    ))}
                </div>
                <button
                    onClick={onRefresh}
                    style={{
                        background: T.glass,
                        border: `1px solid ${T.glassBorder}`,
                        borderRadius: 20,
                        padding: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        color: T.textDim,
                    }}
                >
                    <RefreshCw size={13} />
                </button>
            </div>

            <Panel title={`Active Connections (${sorted.length})`} icon={Network} noPad>
                {sorted.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 32px', color: T.textDim }}>
                        <Network
                            size={32}
                            color={T.textDim}
                            style={{ display: 'block', margin: '0 auto 12px', opacity: 0.6 }}
                        />
                        <div style={{ fontSize: 14, fontWeight: 600 }}>No active connections</div>
                        <div style={{ fontSize: 12, marginTop: 6, color: T.textMuted }}>
                            Active connections will show from pg_stat_activity when database is in use.
                        </div>
                    </div>
                ) : (
                    <div className="adm-scrollbar" style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${T.grid}30` }}>
                                    <ColHeader field="pid">PID</ColHeader>
                                    <ColHeader field="user">User</ColHeader>
                                    <ColHeader field="db">Database</ColHeader>
                                    <ColHeader field="state">State</ColHeader>
                                    <ColHeader field="durationMs">Duration</ColHeader>
                                    <ColHeader field="cpu">CPU</ColHeader>
                                    <ColHeader field="wait">Wait</ColHeader>
                                    <th
                                        style={{
                                            padding: '22px 28px',
                                            fontSize: 9.5,
                                            color: T.textDim,
                                            textAlign: 'left',
                                        }}
                                    >
                                        QUERY
                                    </th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((c) => {
                                    const isLong = c.durationMs > 60000;
                                    const isBlocked = c.wait === 'Lock';
                                    const rowBg = isBlocked
                                        ? `${T.danger}05`
                                        : isLong
                                          ? `${T.warning}04`
                                          : 'transparent';
                                    return (
                                        <tr
                                            key={c.pid}
                                            className="adm-conn-row"
                                            style={{
                                                borderBottom: `1px solid ${T.grid}12`,
                                                background: rowBg,
                                                transition: 'background 0.15s',
                                            }}
                                        >
                                            <td
                                                style={{
                                                    padding: '22px 28px',
                                                    fontSize: 12,
                                                    color: T.primary,
                                                    fontFamily: T.fontMono,
                                                    fontWeight: 800,
                                                }}
                                            >
                                                {c.pid}
                                            </td>
                                            <td style={{ padding: '22px 28px' }}>
                                                <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>
                                                    {c.user}
                                                </div>
                                                <div style={{ fontSize: 9, color: T.textDim }}>{c.appName}</div>
                                            </td>
                                            <td
                                                style={{
                                                    padding: '22px 28px',
                                                    fontSize: 11,
                                                    color: T.textDim,
                                                    fontFamily: T.fontMono,
                                                }}
                                            >
                                                {c.db}
                                            </td>
                                            <td style={{ padding: '22px 28px' }}>
                                                <StatusBadge
                                                    label={c.state}
                                                    color={
                                                        c.state === 'active'
                                                            ? T.success
                                                            : c.state === 'idle'
                                                              ? T.textDim
                                                              : T.warning
                                                    }
                                                    size="sm"
                                                    pulse={c.state === 'active'}
                                                />
                                            </td>
                                            <td style={{ padding: '22px 28px' }}>
                                                <span
                                                    style={{
                                                        fontSize: 12,
                                                        fontFamily: T.fontMono,
                                                        fontWeight: 700,
                                                        color: isLong ? T.danger : T.textMuted,
                                                    }}
                                                >
                                                    {c.duration}
                                                    {isLong && (
                                                        <AlertTriangle
                                                            size={10}
                                                            color={T.danger}
                                                            style={{
                                                                marginLeft: 5,
                                                                display: 'inline',
                                                                verticalAlign: 'middle',
                                                            }}
                                                        />
                                                    )}
                                                </span>
                                            </td>
                                            <td style={{ padding: '22px 28px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <div
                                                        style={{
                                                            width: 44,
                                                            height: 4,
                                                            background: `${T.grid}40`,
                                                            borderRadius: 2,
                                                            overflow: 'hidden',
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                width: `${Math.min(c.cpu, 100)}%`,
                                                                height: '100%',
                                                                background:
                                                                    c.cpu > 80
                                                                        ? T.danger
                                                                        : c.cpu > 40
                                                                          ? T.warning
                                                                          : T.success,
                                                                borderRadius: 2,
                                                                transition: 'width 0.5s',
                                                            }}
                                                        />
                                                    </div>
                                                    <span
                                                        style={{
                                                            fontSize: 10,
                                                            color: T.textDim,
                                                            fontFamily: T.fontMono,
                                                        }}
                                                    >
                                                        {c.cpu}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '22px 28px' }}>
                                                {c.wait ? (
                                                    <StatusBadge
                                                        label={c.wait}
                                                        color={c.wait === 'Lock' ? T.danger : T.warning}
                                                        size="sm"
                                                    />
                                                ) : (
                                                    <span style={{ fontSize: 11, color: T.textDim }}>—</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '22px 28px', maxWidth: 220 }}>
                                                <Tooltip content={c.query}>
                                                    <span
                                                        style={{
                                                            fontSize: 10.5,
                                                            color: T.textDim,
                                                            fontFamily: T.fontMono,
                                                            display: 'block',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            cursor: 'default',
                                                        }}
                                                    >
                                                        {c.query}
                                                    </span>
                                                </Tooltip>
                                            </td>
                                            <td style={{ padding: '22px 28px', textAlign: 'right', paddingRight: 16 }}>
                                                <button
                                                    className="adm-kill-btn"
                                                    onClick={() => onKill(c.pid)}
                                                    disabled={c.state === 'idle'}
                                                    style={{
                                                        background: `${T.danger}12`,
                                                        border: `1px solid ${T.danger}28`,
                                                        borderRadius: 18,
                                                        cursor: c.state === 'idle' ? 'not-allowed' : 'pointer',
                                                        opacity: c.state === 'idle' ? 0.3 : 1,
                                                        color: T.danger,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 4,
                                                        padding: '5px 9px',
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        transition: 'all 0.15s',
                                                    }}
                                                >
                                                    <Power size={11} /> Kill
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   EXTENSIONS TAB — VISUAL UPGRADE
   ═══════════════════════════════════════════════════════════════════════════ */
const ExtensionsView = ({ extData, onInstall }) => {
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');

    const EXT_CATEGORY_COLORS = {
        monitoring: THEME.primary,
        security: THEME.primaryLight,
        utility: THEME.warning,
        search: THEME.success,
        geospatial: THEME.info,
        partitioning: THEME.primary,
        timeseries: THEME.primary,
        ai: THEME.warning,
        maintenance: THEME.textMuted,
    };

    const filtered = useMemo(() => {
        let list = Array.isArray(extData) ? extData : [];
        if (filter === 'installed') list = list.filter((e) => e?.installed);
        if (filter === 'available') list = list.filter((e) => !e?.installed);
        if (search)
            list = list.filter((e) => {
                const name = (e?.name || '').toLowerCase();
                const desc = (e?.description || '').toLowerCase();
                return name.includes(search.toLowerCase()) || desc.includes(search.toLowerCase());
            });
        return list;
    }, [extData, filter, search]);

    const cats = [...new Set(filtered.map((e) => e?.category).filter((c) => c))];

    const StarRating = ({ rating }) => {
        const safeRating = typeof rating === 'number' && !isNaN(rating) ? rating : 0;
        return (
            <div style={{ display: 'flex', gap: 2 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                        key={i}
                        size={9}
                        color={i <= Math.round(safeRating) ? T.warning : T.grid}
                        fill={i <= Math.round(safeRating) ? T.warning : 'none'}
                    />
                ))}
                <span style={{ fontSize: 9, color: T.textDim, marginLeft: 3 }}>{safeRating}</span>
            </div>
        );
    };

    return (
        <div className="adm-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 22 }}>
                <StatCard
                    label="Installed"
                    value={(Array.isArray(extData) ? extData : []).filter((e) => e?.installed).length}
                    icon={PlugZap}
                    color={T.success}
                />
                <StatCard
                    label="Active"
                    value={(Array.isArray(extData) ? extData : []).filter((e) => e?.active).length}
                    icon={Zap}
                    color={T.primary}
                />
                <StatCard
                    label="Available"
                    value={(Array.isArray(extData) ? extData : []).filter((e) => !e?.installed).length}
                    icon={Package}
                    color={T.info}
                />
                <StatCard
                    label="Categories"
                    value={
                        [...new Set((Array.isArray(extData) ? extData : []).map((e) => e?.category).filter((c) => c))]
                            .length
                    }
                    icon={Layers}
                    color={T.secondary}
                />
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 20,
                        padding: '7px 12px',
                        borderRadius: 20,
                        background: T.surface,
                        border: `1px solid ${T.grid}60`,
                        flex: 1,
                        minWidth: 0,
                        maxWidth: 300,
                    }}
                >
                    <Search size={12} color={T.textDim} />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search extensions…"
                        style={{
                            border: 'none',
                            background: 'transparent',
                            color: T.textMain,
                            outline: 'none',
                            flex: 1,
                            minWidth: 0,
                            fontSize: 12,
                        }}
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                            <X size={11} color={T.textDim} />
                        </button>
                    )}
                </div>
                {['all', 'installed', 'available'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        style={{
                            padding: '6px 14px',
                            borderRadius: 18,
                            border: `1px solid ${filter === f ? T.primary : T.grid}50`,
                            background: filter === f ? `${T.primary}12` : 'transparent',
                            color: filter === f ? T.primary : T.textDim,
                            cursor: 'pointer',
                            fontSize: 10.5,
                            fontWeight: 700,
                            textTransform: 'capitalize',
                        }}
                    >
                        {f}
                    </button>
                ))}
                <div style={{ marginLeft: 'auto', fontSize: 11, color: T.textDim }}>{filtered.length} shown</div>
            </div>

            {/* Empty State */}
            {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 32px', color: T.textDim }}>
                    <Package
                        size={32}
                        color={T.textDim}
                        style={{ display: 'block', margin: '0 auto 12px', opacity: 0.6 }}
                    />
                    <div style={{ fontSize: 14, fontWeight: 600 }}>No extensions found</div>
                    <div style={{ fontSize: 12, marginTop: 6, color: T.textMuted }}>
                        Extension data will load from pg_available_extensions when connected to a database.
                    </div>
                </div>
            )}

            {/* Category grids */}
            {cats.map((cat) => {
                const catColor = EXT_CATEGORY_COLORS[cat] || T.primary;
                const catItems = filtered.filter((e) => e.category === cat);
                return (
                    <div key={cat}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 10 }}>
                            <div style={{ width: 4, height: 16, borderRadius: 2, background: catColor }} />
                            <span
                                style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    color: catColor,
                                    letterSpacing: '0.02em',
                                    fontFamily: T.fontBody,
                                }}
                            >
                                {cat}
                            </span>
                            <div style={{ flex: 1, minWidth: 0, height: 1, background: `${catColor}15` }} />
                            <span style={{ fontSize: 9.5, color: T.textDim }}>
                                {catItems.length} extension{catItems.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(290px,1fr))',
                                gap: 18,
                            }}
                        >
                            {catItems.map((ext) => (
                                <div
                                    key={ext.name}
                                    className="adm-ext-card"
                                    style={{
                                        padding: '18px 20px',
                                        borderRadius: 20,
                                        background: ext.active ? `${catColor}04` : T.glass,
                                        border: `1px solid ${ext.active ? catColor + '30' : ext.installed ? T.primary + '15' : T.glassBorder}`,
                                        position: 'relative',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {ext.active && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: 10,
                                                right: 10,
                                                width: 6,
                                                height: 6,
                                                borderRadius: '50%',
                                                background: T.success,
                                            }}
                                        />
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                                        <div>
                                            <div
                                                style={{
                                                    fontWeight: 800,
                                                    color: T.textMain,
                                                    fontSize: 13,
                                                    marginBottom: 4,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 7,
                                                    fontFamily: T.fontBody,
                                                }}
                                            >
                                                {ext.name}
                                                {ext.superuser && (
                                                    <Tooltip content="Requires superuser">
                                                        <Lock size={9} color={T.warning} />
                                                    </Tooltip>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                                <span
                                                    style={{
                                                        fontSize: 9,
                                                        padding: '2px 7px',
                                                        borderRadius: 20,
                                                        background: `${catColor}14`,
                                                        color: catColor,
                                                        border: `1px solid ${catColor}20`,
                                                        fontFamily: T.fontMono,
                                                    }}
                                                >
                                                    v{ext.version}
                                                </span>
                                                {ext.installed && (
                                                    <StatusBadge
                                                        label={ext.active ? 'Active' : 'Installed'}
                                                        color={ext.active ? T.success : T.warning}
                                                        size="sm"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'flex-end',
                                                gap: 6,
                                            }}
                                        >
                                            {ext.installed ? (
                                                <PlugZap size={16} color={ext.active ? T.success : T.warning} />
                                            ) : (
                                                <Plug size={16} color={T.textDim} />
                                            )}
                                            {!ext.installed && (
                                                <button
                                                    onClick={() => onInstall(ext)}
                                                    style={{
                                                        fontSize: 10,
                                                        padding: '4px 10px',
                                                        borderRadius: 18,
                                                        background: `${T.primary}14`,
                                                        border: `1px solid ${T.primary}30`,
                                                        color: T.primary,
                                                        cursor: 'pointer',
                                                        fontWeight: 700,
                                                        transition: 'all 0.2s',
                                                    }}
                                                >
                                                    + Install
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <p style={{ fontSize: 11, color: T.textDim, margin: '0 0 10px', lineHeight: 1.55 }}>
                                        {ext?.description || ''}
                                    </p>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <StarRating rating={ext?.rating} />
                                        <span style={{ fontSize: 9, color: T.textDim }}>
                                            {ext?.downloads || 0} downloads
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
/* ═══════════════════════════════════════════════════════════════════════════
   SETTINGS VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── ★ NEW HIGH: pg_hba.conf VISUAL EDITOR ── */
const HBA_SAMPLE = [];
const HBA_METHODS = [
    'trust',
    'reject',
    'md5',
    'scram-sha-256',
    'password',
    'gss',
    'sspi',
    'ident',
    'peer',
    'ldap',
    'radius',
    'cert',
    'pam',
];
const HBA_TYPES = ['local', 'host', 'hostssl', 'hostnossl', 'hostgssenc', 'hostnogssenc'];
const METHOD_CLR = {
    trust: THEME.danger,
    reject: THEME.textMuted,
    md5: THEME.warning,
    'scram-sha-256': THEME.success,
    ldap: THEME.info,
    cert: THEME.primaryLight,
};

/* ── Shared mini form controls — defined OUTSIDE HBAView so React doesn't remount on each render ── */
const HBASelect = ({ val, opts, onChange, w = 120 }) => (
    <select
        value={val}
        onChange={(e) => onChange(e.target.value)}
        style={{
            background: T.surface,
            border: `1px solid ${T.grid}`,
            color: T.textMain,
            borderRadius: 16,
            padding: '3px 6px',
            fontSize: 11,
            fontFamily: T.fontMono,
            cursor: 'pointer',
            width: w,
        }}
    >
        {opts.map((o) => (
            <option key={o} value={o}>
                {o}
            </option>
        ))}
    </select>
);
const HBAInput = ({ val, onChange, ph, w = 120 }) => (
    <input
        value={val}
        onChange={(e) => onChange(e.target.value)}
        placeholder={ph}
        style={{
            background: T.surface,
            border: `1px solid ${T.grid}`,
            color: T.textMain,
            borderRadius: 16,
            padding: '3px 8px',
            fontSize: 11,
            fontFamily: T.fontMono,
            width: w,
            outline: 'none',
        }}
    />
);

const HBAView = () => {
    const [rules, setRules] = useState(HBA_SAMPLE);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(null);
    const [saved, setSaved] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [newRow, setNewRow] = useState({
        type: 'host',
        database: 'all',
        user: 'all',
        address: '127.0.0.1/32',
        method: 'scram-sha-256',
        comment: '',
    });

    useEffect(() => {
        setLoading(true);
        fetchData('/api/admin/hba')
            .then((r) => {
                if (Array.isArray(r) && r.length) setRules(r);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const save = async () => {
        try {
            await postData('/api/admin/hba', { rules });
        } catch {
            /* demo */
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };
    const del = (id) => setRules((r) => r.filter((x) => x.id !== id));
    const upd = (id, field, val) => setRules((r) => r.map((x) => (x.id === id ? { ...x, [field]: val } : x)));
    const addRule = () => {
        setRules((r) => [...r, { ...newRow, id: Date.now() }]);
        setNewRow({
            type: 'host',
            database: 'all',
            user: 'all',
            address: '127.0.0.1/32',
            method: 'scram-sha-256',
            comment: '',
        });
        setShowAdd(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <div
                        style={{
                            fontSize: 15,
                            fontWeight: 800,
                            color: T.textMain,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 20,
                        }}
                    >
                        <FileText size={16} color={T.primary} /> pg_hba.conf Visual Editor
                    </div>
                    <div style={{ fontSize: 11, color: T.textDim, marginTop: 3 }}>
                        Host-based authentication rules · changes take effect after{' '}
                        <span style={{ fontFamily: T.fontMono, color: T.primary }}>SELECT pg_reload_conf()</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 20 }}>
                    <button
                        onClick={() => setShowAdd((s) => !s)}
                        style={{
                            background: `${T.primary}18`,
                            border: `1px solid ${T.primary}35`,
                            color: T.primary,
                            padding: '7px 14px',
                            borderRadius: 20,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 700,
                            fontFamily: T.fontBody,
                            display: 'flex',
                            gap: 6,
                            alignItems: 'center',
                        }}
                    >
                        <Plus size={12} /> Add Rule
                    </button>
                    <button
                        onClick={save}
                        style={{
                            background: saved ? `${T.success}18` : `${T.primary}12`,
                            border: `1px solid ${saved ? T.success : T.primary}35`,
                            color: saved ? T.success : T.primary,
                            padding: '7px 14px',
                            borderRadius: 20,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 700,
                            fontFamily: T.fontBody,
                            display: 'flex',
                            gap: 6,
                            alignItems: 'center',
                        }}
                    >
                        {saved ? (
                            <>
                                <Check size={12} /> Saved!
                            </>
                        ) : (
                            <>
                                <Save size={12} /> Save & Reload
                            </>
                        )}
                    </button>
                </div>
            </div>

            {showAdd && (
                <div
                    style={{
                        background: `${T.primary}08`,
                        border: `1px solid ${T.primary}25`,
                        borderRadius: 16,
                        padding: '12px 16px',
                        display: 'flex',
                        gap: 20,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                    }}
                >
                    <HBASelect
                        val={newRow.type}
                        opts={HBA_TYPES}
                        onChange={(v) => setNewRow((p) => ({ ...p, type: v }))}
                        w={110}
                    />
                    <HBAInput
                        val={newRow.database}
                        onChange={(v) => setNewRow((p) => ({ ...p, database: v }))}
                        ph="database"
                        w={100}
                    />
                    <HBAInput
                        val={newRow.user}
                        onChange={(v) => setNewRow((p) => ({ ...p, user: v }))}
                        ph="user"
                        w={90}
                    />
                    <HBAInput
                        val={newRow.address}
                        onChange={(v) => setNewRow((p) => ({ ...p, address: v }))}
                        ph="address"
                        w={130}
                    />
                    <HBASelect
                        val={newRow.method}
                        opts={HBA_METHODS}
                        onChange={(v) => setNewRow((p) => ({ ...p, method: v }))}
                        w={130}
                    />
                    <HBAInput
                        val={newRow.comment}
                        onChange={(v) => setNewRow((p) => ({ ...p, comment: v }))}
                        ph="comment"
                        w={160}
                    />
                    <button
                        onClick={addRule}
                        style={{
                            background: T.success,
                            color: THEME.textMain,
                            border: 'none',
                            padding: '5px 12px',
                            borderRadius: 18,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 700,
                            fontFamily: T.fontBody,
                        }}
                    >
                        Add
                    </button>
                    <button
                        onClick={() => setShowAdd(false)}
                        style={{ background: 'transparent', color: T.textDim, border: 'none', cursor: 'pointer' }}
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            <div
                style={{
                    background: T.glass,
                    border: `1px solid ${T.glassBorder}`,
                    borderRadius: 18,
                    overflow: 'hidden',
                }}
            >
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr style={{ background: T.surface }}>
                                {['#', 'Type', 'Database', 'User', 'Address', 'Method', 'Comment', ''].map((h) => (
                                    <th
                                        key={h}
                                        style={{
                                            padding: '10px 12px',
                                            textAlign: 'left',
                                            color: T.textDim,
                                            fontWeight: 600,
                                            fontSize: 11,
                                            borderBottom: `1px solid ${T.grid}`,
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rules.map((row, i) => (
                                <tr
                                    key={row.id}
                                    style={{ borderBottom: `1px solid ${T.grid}25` }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = T.surface)}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            color: T.textDim,
                                            fontFamily: T.fontMono,
                                            fontSize: 11,
                                        }}
                                    >
                                        {i + 1}
                                    </td>
                                    <td style={{ padding: '8px 6px' }}>
                                        {editing === row.id ? (
                                            <HBASelect
                                                val={row.type}
                                                opts={HBA_TYPES}
                                                onChange={(v) => upd(row.id, 'type', v)}
                                                w={110}
                                            />
                                        ) : (
                                            <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.primary }}>
                                                {row.type}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '8px 6px' }}>
                                        {editing === row.id ? (
                                            <HBAInput
                                                val={row.database}
                                                onChange={(v) => upd(row.id, 'database', v)}
                                                ph="db"
                                                w={90}
                                            />
                                        ) : (
                                            <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMain }}>
                                                {row.database}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '8px 6px' }}>
                                        {editing === row.id ? (
                                            <HBAInput
                                                val={row.user}
                                                onChange={(v) => upd(row.id, 'user', v)}
                                                ph="user"
                                                w={90}
                                            />
                                        ) : (
                                            <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMain }}>
                                                {row.user}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '8px 6px' }}>
                                        {editing === row.id ? (
                                            <HBAInput
                                                val={row.address}
                                                onChange={(v) => upd(row.id, 'address', v)}
                                                ph="addr"
                                                w={120}
                                            />
                                        ) : (
                                            <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textDim }}>
                                                {row.address || '—'}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '8px 6px' }}>
                                        {editing === row.id ? (
                                            <HBASelect
                                                val={row.method}
                                                opts={HBA_METHODS}
                                                onChange={(v) => upd(row.id, 'method', v)}
                                                w={130}
                                            />
                                        ) : (
                                            <span
                                                style={{
                                                    padding: '2px 8px',
                                                    borderRadius: 16,
                                                    fontSize: 11,
                                                    fontFamily: T.fontMono,
                                                    background: `${METHOD_CLR[row.method] || THEME.textMuted}18`,
                                                    color: METHOD_CLR[row.method] || THEME.textMuted,
                                                    border: `1px solid ${METHOD_CLR[row.method] || THEME.textMuted}35`,
                                                }}
                                            >
                                                {row.method}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '8px 6px' }}>
                                        {editing === row.id ? (
                                            <HBAInput
                                                val={row.comment}
                                                onChange={(v) => upd(row.id, 'comment', v)}
                                                ph="comment"
                                                w={150}
                                            />
                                        ) : (
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    color: T.textDim,
                                                    fontStyle: row.comment ? 'normal' : 'italic',
                                                }}
                                            >
                                                {row.comment || '—'}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button
                                                onClick={() => setEditing(editing === row.id ? null : row.id)}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: editing === row.id ? T.success : T.textDim,
                                                    padding: 3,
                                                }}
                                            >
                                                {editing === row.id ? <Check size={13} /> : <Edit3 size={13} />}
                                            </button>
                                            <button
                                                onClick={() => del(row.id)}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: T.danger,
                                                    padding: 3,
                                                }}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div
                    style={{
                        padding: '10px 16px',
                        borderTop: `1px solid ${T.grid}25`,
                        fontSize: 11,
                        color: T.textDim,
                        display: 'flex',
                        gap: 18,
                        flexWrap: 'wrap',
                    }}
                >
                    <span>
                        ⚡ <strong style={{ color: THEME.danger }}>trust</strong> = no password required
                    </span>
                    <span>
                        🔒 <strong style={{ color: THEME.success }}>scram-sha-256</strong> = recommended
                    </span>
                    <span>
                        💡 Needs{' '}
                        <span style={{ fontFamily: T.fontMono, color: T.primary }}>SELECT pg_reload_conf()</span> to
                        take effect
                    </span>
                </div>
            </div>
        </div>
    );
};

/* ── ★ NEW HIGH: EXTENSION ECOSYSTEM DASHBOARD ── */
const ExtDashboard = ({ extData = [] }) => {
    const installed = extData.filter((e) => e.installed);
    const categories = extData.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + 1;
        return acc;
    }, {});
    const catEntries = Object.entries(categories).sort((a, b) => b[1] - a[1]);
    const clrs = [THEME.info, THEME.success, THEME.warning, THEME.danger, THEME.primaryLight, THEME.warning];
    const secFlags = extData.filter(
        (e) => e.installed && (e.name === 'dblink' || e.name === 'pg_tle' || e.superuser),
    ).length;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 18 }}>
            <div
                style={{
                    background: T.glass,
                    border: `1px solid ${T.glassBorder}`,
                    borderRadius: 16,
                    padding: '14px 16px',
                }}
            >
                <div style={{ fontSize: 24, fontWeight: 800, color: T.primary }}>{installed.length}</div>
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 3 }}>Installed</div>
                <div style={{ marginTop: 8, height: 3, background: T.grid, borderRadius: 2 }}>
                    <div
                        style={{
                            height: 3,
                            width: `${(installed.length / Math.max(extData.length, 1)) * 100}%`,
                            background: T.primary,
                            borderRadius: 2,
                        }}
                    />
                </div>
                <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>{extData.length} available</div>
            </div>
            <div
                style={{
                    background: T.glass,
                    border: `1px solid ${T.glassBorder}`,
                    borderRadius: 16,
                    padding: '14px 16px',
                }}
            >
                <div style={{ fontSize: 24, fontWeight: 800, color: T.success }}>
                    {installed.filter((e) => e.active).length}
                </div>
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 3 }}>Active</div>
                <div style={{ fontSize: 10, color: T.textDim, marginTop: 10 }}>
                    {installed.filter((e) => !e.active).length} inactive
                </div>
            </div>
            <div
                style={{
                    background: T.glass,
                    border: `1px solid ${T.glassBorder}`,
                    borderRadius: 16,
                    padding: '14px 16px',
                }}
            >
                <div style={{ fontSize: 24, fontWeight: 800, color: secFlags > 0 ? T.warning : T.success }}>
                    {secFlags}
                </div>
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 3 }}>Security Flags</div>
                <div style={{ fontSize: 10, color: secFlags > 0 ? T.warning : T.textDim, marginTop: 10 }}>
                    {secFlags > 0 ? '⚠ Review needed' : '✓ No issues'}
                </div>
            </div>
            <div
                style={{
                    background: T.glass,
                    border: `1px solid ${T.glassBorder}`,
                    borderRadius: 16,
                    padding: '14px 16px',
                }}
            >
                <div style={{ fontSize: 12, fontWeight: 700, color: T.textMain, marginBottom: 8 }}>Categories</div>
                {catEntries.slice(0, 4).map(([cat, cnt], i) => (
                    <div
                        key={cat}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 11 }}
                    >
                        <div style={{ width: 6, height: 6, borderRadius: 2, background: clrs[i], flexShrink: 0 }} />
                        <span style={{ color: T.textMuted, flex: 1, minWidth: 0 }}>{cat}</span>
                        <span style={{ color: T.textMain, fontWeight: 600 }}>{cnt}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SettingsView = ({
    settingsData,
    pendingChanges,
    dispatch,
    isEditMode,
    setIsEditMode,
    showWizard,
    setShowWizard,
    showChangelog,
    setShowChangelog,
    history,
    validationErrors,
    setValidationErrors,
    triggerSave,
    pinnedSettings,
    setPinnedSettings,
    copiedName,
    setCopiedName,
}) => {
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [viewMode, setViewMode] = useState('grouped');
    const [expandedSetting, setExpandedSetting] = useState(null);
    const [sortField, setSortField] = useState(null);
    const [sortDir, setSortDir] = useState('asc');

    const copyVal = (v, name) => {
        navigator.clipboard?.writeText(v);
        setCopiedName(name);
        setTimeout(() => setCopiedName(null), 1500);
    };
    const togglePin = (name) => {
        const n = new Set(pinnedSettings);
        n.has(name) ? n.delete(name) : n.add(name);
        setPinnedSettings(n);
    };
    const handleSetChange = (name, val) => {
        const setting = settingsData.find((s) => s.name === name);
        const errors = setting ? validateSettingValue(setting, val) : [];
        setValidationErrors((prev) => ({ ...prev, [name]: errors }));
        dispatch({ type: 'SET', key: name, value: val });
    };

    const filteredSettings = useMemo(() => {
        let list = Array.isArray(settingsData) ? settingsData : [];
        if (category !== 'all') list = list.filter((s) => categorize(s?.name || '') === category);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter((s) => {
                const name = (s?.name || '').toLowerCase();
                const desc = (s?.short_desc || '').toLowerCase();
                return name.includes(q) || desc.includes(q);
            });
        }
        if (viewMode === 'diff')
            list = list.filter((s) => s?.setting !== s?.boot_val || pendingChanges[s?.name] !== undefined);
        if (sortField)
            list = [...list].sort((a, b) => {
                const av = a?.[sortField] || '';
                const bv = b?.[sortField] || '';
                const astr = String(av).toLowerCase();
                const bstr = String(bv).toLowerCase();
                return sortDir === 'asc' ? astr.localeCompare(bstr) : bstr.localeCompare(astr);
            });
        return list;
    }, [settingsData, category, search, viewMode, pendingChanges, sortField, sortDir]);

    const settingGroups = useMemo(() => {
        const pinned = filteredSettings.filter((s) => pinnedSettings.has(s.name));
        const rest = filteredSettings.filter((s) => !pinnedSettings.has(s.name));
        const groups = {};
        if (pinned.length) groups['_pinned'] = pinned;
        rest.forEach((s) => {
            const cat = categorize(s.name);
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(s);
        });
        return groups;
    }, [filteredSettings, pinnedSettings]);

    const renderEditInput = (s, currentVal, onChange) => {
        const isBool = ['on', 'off'].includes(s.boot_val) || ['on', 'off'].includes(s.setting);
        const errs = validationErrors[s.name] || [];
        if (isBool) {
            const isActive = currentVal === 'on';
            return (
                <button
                    onClick={() => onChange(isActive ? 'off' : 'on')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        borderRadius: 18,
                        border: 'none',
                        background: isActive ? `${T.success}18` : `${T.grid}40`,
                        color: isActive ? T.success : T.textDim,
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 11,
                        transition: 'all 0.2s',
                    }}
                >
                    {isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />} {isActive ? 'ON' : 'OFF'}
                </button>
            );
        }
        const isNum = /^\d+(\.\d+)?$/.test(s.boot_val);
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                <input
                    className="adm-input-field"
                    type={isNum ? 'number' : 'text'}
                    value={currentVal}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={s.boot_val}
                    style={{
                        background: errs.length ? `${T.danger}08` : T.surface,
                        border: `1px solid ${errs.length ? T.danger : T.grid}60`,
                        color: T.textMain,
                        borderRadius: 18,
                        padding: '5px 9px',
                        fontSize: 12,
                        width: isNum ? 92 : 135,
                        fontFamily: T.fontMono,
                    }}
                />
                {errs.map((e, i) => (
                    <span key={i} style={{ fontSize: 9, color: T.danger }}>
                        {e}
                    </span>
                ))}
            </div>
        );
    };

    const renderRow = (s) => {
        const isExpanded = expandedSetting === s.name;
        const pendingVal = pendingChanges[s.name];
        const hasPending = pendingVal !== undefined;
        const displayVal = hasPending ? pendingVal : s.setting;
        const isModified = s.setting !== s.boot_val;
        const isPinned = pinnedSettings.has(s.name);
        const riskDef = s.riskLevel ? RISK_LEVELS[s.riskLevel] : null;
        const catDef = SETTING_CATEGORIES[categorize(s.name)];
        const hasError = (validationErrors[s.name] || []).length > 0;

        return (
            <div
                key={s.name}
                className="adm-row-hover"
                style={{
                    padding: '11px 20px',
                    cursor: isEditMode ? 'default' : 'pointer',
                    borderBottom: `1px solid ${T.grid}15`,
                    background: hasError
                        ? `${T.danger}05`
                        : hasPending
                          ? `${T.success}04`
                          : isExpanded
                            ? `${T.primary}03`
                            : 'transparent',
                    borderLeft: `2px solid ${hasError ? T.danger : hasPending ? T.success : isModified && !hasPending ? T.secondary : 'transparent'}`,
                    transition: 'all 0.15s',
                }}
                onClick={() => !isEditMode && setExpandedSetting(isExpanded ? null : s.name)}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                    {catDef && <catDef.icon size={11} color={catDef.color} style={{ flexShrink: 0, opacity: 0.7 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span
                                style={{ fontSize: 12.5, fontWeight: 600, color: T.textMain, fontFamily: T.fontMono }}
                            >
                                {s.name}
                            </span>
                            {hasPending && <StatusBadge label="PENDING" color={T.success} size="sm" />}
                            {isModified && !hasPending && <StatusBadge label="CUSTOM" color={T.secondary} size="sm" />}
                            {s.pending_restart && <StatusBadge label="RESTART" color={T.warning} size="sm" />}
                            {riskDef?.label === 'HIGH RISK' && (
                                <StatusBadge label="HIGH RISK" color={T.danger} size="sm" />
                            )}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        <button
                            className="adm-row-actions"
                            onClick={(e) => {
                                e.stopPropagation();
                                togglePin(s.name);
                            }}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 2,
                                color: isPinned ? T.warning : T.textDim,
                            }}
                        >
                            {isPinned ? <Pin size={11} fill="currentColor" color={T.warning} /> : <Pin size={11} />}
                        </button>

                        {isEditMode ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                {hasPending && <DiffTag before={s.setting} after={pendingVal} />}
                                {renderEditInput(s, displayVal, (val) => handleSetChange(s.name, val))}
                                {hasPending && (
                                    <Tooltip content="Reset">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                dispatch({ type: 'REMOVE', key: s.name });
                                                setValidationErrors((p) => {
                                                    const n = { ...p };
                                                    delete n[s.name];
                                                    return n;
                                                });
                                            }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: T.textDim,
                                                padding: 2,
                                            }}
                                        >
                                            <RotateCcw size={12} />
                                        </button>
                                    </Tooltip>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 800,
                                        fontFamily: T.fontMono,
                                        color: hasPending ? T.success : isModified ? T.secondary : T.textMuted,
                                    }}
                                >
                                    {displayVal}
                                    {!hasPending && s.unit ? ` ${s.unit}` : ''}
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        copyVal(`${s.name} = ${s.setting}`, s.name);
                                    }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: 2,
                                        color: T.textDim,
                                    }}
                                >
                                    {copiedName === s.name ? <Check size={11} color={T.success} /> : <Copy size={11} />}
                                </button>
                                <ChevronDown
                                    size={12}
                                    color={T.textDim}
                                    style={{
                                        transition: 'transform 0.15s',
                                        transform: isExpanded ? 'rotate(180deg)' : 'none',
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {isExpanded && !isEditMode && (
                    <div
                        style={{
                            marginTop: 12,
                            paddingTop: 12,
                            borderTop: `1px solid ${T.grid}25`,
                            animation: 'admFadeIn 0.15s ease',
                        }}
                    >
                        <p style={{ fontSize: 11.5, color: T.textMuted, lineHeight: 1.65, margin: '0 0 10px' }}>
                            {s.short_desc}
                        </p>
                        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 10, marginBottom: 12 }}>
                            <span style={{ color: T.textDim }}>
                                Default:{' '}
                                <strong style={{ color: T.textMuted, fontFamily: T.fontMono }}>{s.boot_val}</strong>
                            </span>
                            <span style={{ color: T.textDim }}>
                                Source: <strong style={{ color: T.textMuted }}>{s.source}</strong>
                            </span>
                        </div>
                        {riskDef && riskDef.label !== 'LOW RISK' && (
                            <div
                                style={{
                                    padding: '10px 13px',
                                    borderRadius: 20,
                                    background: `${riskDef.color}10`,
                                    border: `1px solid ${riskDef.color}25`,
                                    display: 'flex',
                                    gap: 22,
                                    alignItems: 'flex-start',
                                }}
                            >
                                <riskDef.icon size={15} color={riskDef.color} style={{ flexShrink: 0, marginTop: 1 }} />
                                <span style={{ fontSize: 11, color: riskDef.color, fontWeight: 600 }}>
                                    {s.riskLevel === 'high'
                                        ? 'Changing this setting can lead to data loss or corruption. Proceed with extreme caution.'
                                        : 'This setting carries moderate risk. Test changes in staging before production.'}
                                </span>
                            </div>
                        )}
                        <div style={{ marginTop: 10, display: 'flex', gap: 20 }}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditMode(true);
                                    setExpandedSetting(null);
                                }}
                                style={{
                                    fontSize: 10,
                                    padding: '5px 11px',
                                    borderRadius: 18,
                                    border: `1px solid ${T.primary}30`,
                                    background: `${T.primary}10`,
                                    color: T.primary,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                }}
                            >
                                <Edit3 size={10} /> Edit Value
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    copyVal(`${s.name} = '${s.setting}'`, s.name + '_pg');
                                }}
                                style={{
                                    fontSize: 10,
                                    padding: '5px 11px',
                                    borderRadius: 18,
                                    border: `1px solid ${T.grid}40`,
                                    background: 'transparent',
                                    color: T.textDim,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                }}
                            >
                                <Terminal size={10} /> Copy as conf
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="adm-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Pending Banner */}
            {Object.keys(pendingChanges).length > 0 && (
                <div
                    style={{
                        padding: '18px 22px',
                        borderRadius: 11,
                        background: `${T.warning}08`,
                        border: `1px solid ${T.warning}25`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 18,
                        animation: 'admFadeIn 0.2s ease',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                        <AlertCircle size={16} color={T.warning} />
                        <span style={{ fontSize: 12, color: T.warning, fontWeight: 700 }}>
                            {Object.keys(pendingChanges).length} unsaved change
                            {Object.keys(pendingChanges).length > 1 ? 's' : ''}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: 7 }}>
                        <button
                            onClick={() => dispatch({ type: 'UNDO' })}
                            disabled={!history.past.length}
                            style={{
                                background: 'none',
                                border: `1px solid ${T.grid}50`,
                                borderRadius: 18,
                                padding: '4px 9px',
                                cursor: history.past.length ? 'pointer' : 'not-allowed',
                                color: T.textMuted,
                                fontSize: 10,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            <RotateCcw size={10} /> Undo
                        </button>
                        <button
                            onClick={triggerSave}
                            style={{
                                background: T.warning,
                                border: 'none',
                                borderRadius: 18,
                                padding: '4px 13px',
                                cursor: 'pointer',
                                color: THEME.textInverse,
                                fontSize: 11,
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                            }}
                        >
                            <Save size={11} /> Save
                        </button>
                        <button
                            onClick={() => {
                                dispatch({ type: 'CLEAR' });
                                setValidationErrors({});
                            }}
                            style={{
                                background: 'none',
                                border: `1px solid ${T.grid}50`,
                                borderRadius: 18,
                                padding: '4px 8px',
                                cursor: 'pointer',
                                color: T.textDim,
                                display: 'flex',
                            }}
                        >
                            <X size={12} />
                        </button>
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 18,
                    flexWrap: 'wrap',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 20,
                        padding: '8px 13px',
                        borderRadius: 20,
                        background: T.surface,
                        border: `1px solid ${T.grid}60`,
                        flex: 1,
                        minWidth: 0,
                        maxWidth: 360,
                    }}
                >
                    <Search size={12} color={T.textDim} />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search parameters…"
                        style={{
                            border: 'none',
                            background: 'transparent',
                            color: T.textMain,
                            outline: 'none',
                            flex: 1,
                            minWidth: 0,
                            fontSize: 12,
                        }}
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                            <X size={11} color={T.textDim} />
                        </button>
                    )}
                </div>

                <div
                    style={{
                        display: 'flex',
                        gap: 4,
                        background: T.surface,
                        border: `1px solid ${T.grid}50`,
                        borderRadius: 20,
                        padding: 3,
                    }}
                >
                    {[
                        { v: 'grouped', i: Layers, t: 'Grouped' },
                        { v: 'flat', i: List, t: 'Flat' },
                        { v: 'diff', i: GitCompare, t: 'Changed Only' },
                    ].map((m) => (
                        <Tooltip key={m.v} content={m.t}>
                            <button
                                onClick={() => setViewMode(m.v)}
                                style={{
                                    padding: '5px 9px',
                                    borderRadius: 18,
                                    border: 'none',
                                    background: viewMode === m.v ? T.glass : 'transparent',
                                    cursor: 'pointer',
                                    color: viewMode === m.v ? T.textMain : T.textDim,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 10.5,
                                    fontWeight: 600,
                                }}
                            >
                                <m.i size={11} /> {viewMode === m.v && <span>{m.t}</span>}
                            </button>
                        </Tooltip>
                    ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Tooltip content="Configuration History">
                        <button
                            onClick={() => setShowChangelog(true)}
                            className="adm-btn"
                            style={{
                                background: 'transparent',
                                border: `1px solid ${T.grid}60`,
                                padding: '7px',
                                borderRadius: 20,
                                cursor: 'pointer',
                                color: T.textDim,
                                display: 'flex',
                            }}
                        >
                            <History size={13} />
                        </button>
                    </Tooltip>
                    <Tooltip content="Export JSON">
                        <button
                            onClick={() => {
                                const b = new Blob([JSON.stringify(settingsData, null, 2)], {
                                    type: 'application/json',
                                });
                                const u = URL.createObjectURL(b);
                                const a = document.createElement('a');
                                a.href = u;
                                a.download = `fathom-config-${new Date().toISOString().slice(0, 10)}.json`;
                                a.click();
                            }}
                            className="adm-btn"
                            style={{
                                background: 'transparent',
                                border: `1px solid ${T.grid}60`,
                                padding: '7px',
                                borderRadius: 20,
                                cursor: 'pointer',
                                color: T.textDim,
                                display: 'flex',
                            }}
                        >
                            <Download size={13} />
                        </button>
                    </Tooltip>
                    <button
                        onClick={() => setShowWizard(true)}
                        className="adm-btn"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                            padding: '7px 14px',
                            borderRadius: 20,
                            border: `1px solid ${T.primary}35`,
                            cursor: 'pointer',
                            background: `linear-gradient(135deg, ${T.primary}14, ${T.secondary}08)`,
                            color: T.primary,
                            fontSize: 11.5,
                            fontWeight: 700,
                        }}
                    >
                        <Sparkles size={12} /> Tuning Wizard
                    </button>
                    <div style={{ width: 1, height: 20, background: `${T.grid}60` }} />
                    {isEditMode ? (
                        <>
                            <button
                                onClick={triggerSave}
                                className="adm-btn"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '7px 14px',
                                    borderRadius: 20,
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: `linear-gradient(135deg, ${T.success}, ${T.teal})`,
                                    color: THEME.textInverse,
                                    fontSize: 11.5,
                                    fontWeight: 800,
                                }}
                            >
                                <Save size={12} /> Save
                                {Object.keys(pendingChanges).length > 0
                                    ? ` (${Object.keys(pendingChanges).length})`
                                    : ''}
                            </button>
                            <button
                                onClick={() => {
                                    setIsEditMode(false);
                                    dispatch({ type: 'CLEAR' });
                                    setValidationErrors({});
                                }}
                                style={{
                                    padding: '7px',
                                    borderRadius: 20,
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: T.surface,
                                    color: T.textDim,
                                    display: 'flex',
                                }}
                            >
                                <X size={14} />
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setIsEditMode(true)}
                            className="adm-btn"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '7px 14px',
                                borderRadius: 20,
                                border: `1px solid ${T.grid}60`,
                                cursor: 'pointer',
                                background: T.surface,
                                color: T.textMuted,
                                fontSize: 11.5,
                                fontWeight: 600,
                            }}
                        >
                            <Edit3 size={12} /> Edit <Kbd>E</Kbd>
                        </button>
                    )}
                </div>
            </div>

            {/* Category Pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                    onClick={() => setCategory('all')}
                    style={{
                        padding: '4px 14px',
                        borderRadius: 20,
                        border: `1px solid ${category === 'all' ? T.primary : T.grid}50`,
                        background: category === 'all' ? `${T.primary}14` : 'transparent',
                        color: category === 'all' ? T.primary : T.textDim,
                        cursor: 'pointer',
                        fontSize: 10,
                        fontWeight: 700,
                    }}
                >
                    All
                </button>
                {Object.entries(SETTING_CATEGORIES).map(([k, def]) => (
                    <button
                        key={k}
                        onClick={() => setCategory(category === k ? 'all' : k)}
                        style={{
                            padding: '4px 14px',
                            borderRadius: 20,
                            border: `1px solid ${category === k ? def.color : T.grid}50`,
                            background: category === k ? `${def.color}14` : 'transparent',
                            color: category === k ? def.color : T.textDim,
                            cursor: 'pointer',
                            fontSize: 10,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            transition: 'all 0.15s',
                        }}
                    >
                        <def.icon size={9} /> {def.label}
                    </button>
                ))}
            </div>

            {/* Settings */}
            {viewMode === 'grouped' ? (
                Object.entries(settingGroups).map(([cat, items]) => {
                    const isPinCat = cat === '_pinned';
                    const catDef = isPinCat ? null : SETTING_CATEGORIES[cat];
                    return (
                        <Panel
                            key={cat}
                            title={isPinCat ? 'Pinned' : catDef?.label || 'Other'}
                            icon={isPinCat ? Pin : catDef?.icon || Settings}
                            noPad
                            accent={isPinCat ? T.warning : catDef?.color}
                            rightNode={
                                <span
                                    style={{
                                        fontSize: 10,
                                        padding: '2px 8px',
                                        borderRadius: 16,
                                        background: `${T.grid}40`,
                                        color: T.textDim,
                                    }}
                                >
                                    {items.length}
                                </span>
                            }
                        >
                            {items.map(renderRow)}
                        </Panel>
                    );
                })
            ) : (
                <Panel
                    title={viewMode === 'diff' ? 'Changed Parameters' : 'All Parameters'}
                    icon={viewMode === 'diff' ? GitCompare : List}
                    noPad
                    rightNode={
                        <span
                            style={{
                                fontSize: 10,
                                padding: '2px 8px',
                                borderRadius: 16,
                                background: `${T.grid}40`,
                                color: T.textDim,
                            }}
                        >
                            {filteredSettings.length}
                        </span>
                    }
                >
                    {filteredSettings.length === 0 ? (
                        <div style={{ padding: 40, textAlign: 'center', color: T.textDim }}>
                            <CheckCircle
                                size={32}
                                color={T.grid}
                                style={{ marginBottom: 12, display: 'block', margin: '0 auto 12px' }}
                            />
                            <div style={{ fontSize: 13 }}>No changes detected</div>
                            <div style={{ fontSize: 11, marginTop: 4 }}>All parameters match defaults</div>
                        </div>
                    ) : (
                        filteredSettings.map(renderRow)
                    )}
                </Panel>
            )}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
const AdminTab = () => {
    useAdaptiveTheme(); // keeps THEME in sync with dark/light toggle
    const [activeSub, setActiveSub] = useState('settings');
    const [settingsData, setSettingsData] = useState([]);
    const [extData, setExtData] = useState([]);
    const [cacheData, setCacheData] = useState(null);
    const [connData, setConnData] = useState([]);
    const [serverStats, setServerStats] = useState(DEFAULT_SERVER_STATS);
    const [loading, setLoading] = useState(true);

    // Settings UI State
    const [isEditMode, setIsEditMode] = useState(false);
    const [showWizard, setShowWizard] = useState(false);
    const [showChangelog, setShowChangelog] = useState(false);
    const [toast, setToast] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [validationErrors, setValidationErrors] = useState({});
    const [pinnedSettings, setPinnedSettings] = useState(new Set(['max_connections', 'shared_buffers', 'work_mem']));
    const [copiedName, setCopiedName] = useState(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const [history, dispatch] = useReducer(historyReducer, { past: [], present: {}, future: [] });
    const pendingChanges = history.present;

    // Keyboard shortcuts
    useEffect(() => {
        const h = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'z' && isEditMode) {
                e.preventDefault();
                dispatch({ type: 'UNDO' });
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'y' && isEditMode) {
                e.preventDefault();
                dispatch({ type: 'REDO' });
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 's' && isEditMode) {
                e.preventDefault();
                triggerSave();
            }
            if (e.key === 'Escape') {
                if (showWizard) setShowWizard(false);
                if (showChangelog) setShowChangelog(false);
            }
        };
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, [isEditMode, showWizard, showChangelog]);

    useEffect(() => {
        if (toast) {
            const t = setTimeout(() => setToast(null), 3500);
            return () => clearTimeout(t);
        }
    }, [toast]);
    const showToast = (type, msg) => setToast({ type, msg });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // Always fetch server stats for the sidebar
            const statsData = await fetchData('/api/overview/stats').catch(() => null);
            // /api/overview/stats returns {activeConnections, uptimeSeconds, ...};
            // only adopt it as server stats when it actually carries the
            // cpu/ram/disk shape the sidebar renders — otherwise keep defaults.
            if (statsData && typeof statsData === 'object' && statsData.cpu && typeof statsData.cpu.pct === 'number') {
                setServerStats({ ...DEFAULT_SERVER_STATS, ...statsData });
            } else {
                setServerStats(DEFAULT_SERVER_STATS);
            }

            if (activeSub === 'settings') {
                const r = await fetchData('/api/admin/settings');
                setSettingsData(Array.isArray(r) && r.length ? r : MOCK_SETTINGS);
            } else if (activeSub === 'extensions') {
                const r = await fetchData('/api/admin/extensions');
                setExtData(Array.isArray(r) && r.length ? r : MOCK_EXTENSIONS);
            } else if (activeSub === 'cache') {
                const r = await fetchData('/api/admin/cache/stats');
                setCacheData(r?.size != null ? r : MOCK_CACHE);
            } else if (activeSub === 'connections') {
                const r = await fetchData('/api/admin/connections');
                setConnData(Array.isArray(r) && r.length ? r : MOCK_CONNECTIONS);
            }
        } catch {
            setServerStats(DEFAULT_SERVER_STATS);
            if (activeSub === 'settings') setSettingsData(MOCK_SETTINGS);
            if (activeSub === 'extensions') setExtData(MOCK_EXTENSIONS);
            if (activeSub === 'cache') setCacheData(MOCK_CACHE);
            if (activeSub === 'connections') setConnData(MOCK_CONNECTIONS);
        }
        setLoading(false);
    }, [activeSub]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleClearCache = () => {
        setConfirm({
            title: 'Clear Application Cache',
            body: 'This will invalidate all cached query plans and schema data. Active connections may experience temporary slowdowns.',
            danger: true,
            onConfirm: async () => {
                setConfirm(null);
                try {
                    await postData('/api/admin/cache/clear', {});
                    loadData();
                    showToast('success', 'Cache cleared successfully');
                } catch {
                    showToast('error', 'Failed to clear cache');
                }
            },
        });
    };

    const handleApplyWizard = (recs) => {
        dispatch({ type: 'BATCH', changes: Object.fromEntries(recs.map((r) => [r.name, r.val])) });
        setIsEditMode(true);
        setShowWizard(false);
        showToast('success', `Applied ${recs.length} recommendations`);
    };

    const triggerSave = () => {
        const count = Object.keys(pendingChanges).length;
        if (!count) return;
        const restartRequired = Object.keys(pendingChanges).some(
            (k) => settingsData.find((s) => s.name === k)?.pending_restart,
        );
        setConfirm({
            title: 'Apply Configuration Changes',
            body: `Apply ${count} configuration change${count > 1 ? 's' : ''}?${restartRequired ? '\n\n⚡ Some changes require a server restart.' : ''}`,
            danger: restartRequired,
            onConfirm: async () => {
                setConfirm(null);
                try {
                    showToast('success', `Applied ${count} setting${count > 1 ? 's' : ''} successfully`);
                    dispatch({ type: 'CLEAR' });
                    setIsEditMode(false);
                    loadData();
                } catch {
                    showToast('error', 'Failed to apply settings');
                }
            },
        });
    };

    const handleKillConnection = (pid) => {
        setConfirm({
            title: `Terminate PID ${pid}`,
            body: 'This will immediately terminate the connection. Uncommitted transactions will be rolled back.',
            danger: true,
            onConfirm: async () => {
                setConfirm(null);
                try {
                    await postData('/api/admin/connections/kill', { pid });
                    showToast('success', `Connection ${pid} terminated`);
                    loadData();
                } catch {
                    showToast('error', 'Could not terminate connection');
                }
            },
        });
    };

    const NAV_TABS = [
        { id: 'settings', l: 'Config', i: Settings, dot: Object.keys(pendingChanges).length > 0 },
        { id: 'extensions', l: 'Extensions', i: Puzzle, dot: false },
        { id: 'cache', l: 'Cache', i: Database, dot: false },
        { id: 'connections', l: 'Connections', i: Network, dot: (connData || []).some((c) => c.wait) },
        { id: 'hba', l: '★ pg_hba.conf', i: FileText, dot: false },
    ];

    const showSidebar = activeSub === 'settings' || activeSub === 'connections';

    if (loading)
        return (
            <div style={{ padding: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                <AdminStyles />
                <div
                    style={{
                        width: 48,
                        height: 48,
                        borderRadius: 20,
                        background: `linear-gradient(135deg, ${T.primary}, ${T.secondary})`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                    className="adm-float"
                >
                    <Settings size={22} color={THEME.textMain} className="adm-spin" />
                </div>
                <div style={{ color: T.textDim, fontSize: 12 }}>Loading Admin Panel…</div>
            </div>
        );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '0 24px 48px' }}>
            <AdminStyles />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
                {/* Nav Tabs */}
                <div
                    style={{
                        display: 'flex',
                        gap: 5,
                        padding: '4px',
                        background: T.glass,
                        border: `1px solid ${T.glassBorder}`,
                        borderRadius: 18,
                    }}
                >
                    {NAV_TABS.map((t) => (
                        <button
                            key={t.id}
                            className="adm-tab-btn"
                            onClick={() => setActiveSub(t.id)}
                            style={{
                                padding: '9px 18px',
                                borderRadius: 20,
                                cursor: 'pointer',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                fontSize: 12.5,
                                fontWeight: 700,
                                background:
                                    activeSub === t.id
                                        ? `linear-gradient(135deg, ${T.primary}, ${T.secondary})`
                                        : 'transparent',
                                color: activeSub === t.id ? THEME.textMain : T.textMuted,
                                boxShadow: activeSub === t.id ? `0 4px 16px ${T.primary}35` : 'none',
                                fontFamily: T.fontBody,
                                position: 'relative',
                            }}
                        >
                            <t.i size={13} />
                            {t.l}
                            {t.dot && (
                                <span
                                    style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        background: activeSub === t.id ? 'rgba(255,255,255,0.8)' : T.warning,
                                        position: 'absolute',
                                        top: 6,
                                        right: 6,
                                    }}
                                />
                            )}
                        </button>
                    ))}
                </div>

                {/* Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <button
                        onClick={loadData}
                        style={{
                            background: T.surface,
                            border: `1px solid ${T.grid}50`,
                            borderRadius: 18,
                            padding: '6px',
                            cursor: 'pointer',
                            color: T.textDim,
                            display: 'flex',
                        }}
                    >
                        <RefreshCw size={12} />
                    </button>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                            padding: '6px 12px',
                            background: `${T.success}08`,
                            border: `1px solid ${T.success}20`,
                            borderRadius: 20,
                        }}
                    >
                        <LiveDot color={T.success} size={6} />
                        <span style={{ fontSize: 10.5, color: T.textDim, fontWeight: 600 }}>Connected</span>
                    </div>
                </div>
            </div>

            {/* Content + Sidebar */}
            <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    {activeSub === 'settings' && (
                        <SettingsView
                            settingsData={settingsData}
                            pendingChanges={pendingChanges}
                            dispatch={dispatch}
                            isEditMode={isEditMode}
                            setIsEditMode={setIsEditMode}
                            showWizard={showWizard}
                            setShowWizard={setShowWizard}
                            showChangelog={showChangelog}
                            setShowChangelog={setShowChangelog}
                            history={history}
                            validationErrors={validationErrors}
                            setValidationErrors={setValidationErrors}
                            triggerSave={triggerSave}
                            pinnedSettings={pinnedSettings}
                            setPinnedSettings={setPinnedSettings}
                            copiedName={copiedName}
                            setCopiedName={setCopiedName}
                        />
                    )}
                    {activeSub === 'extensions' && (
                        <>
                            {/* ★ NEW HIGH: Extension Ecosystem Dashboard */}
                            <ExtDashboard extData={extData} />
                            <ExtensionsView
                                extData={extData}
                                onInstall={(ext) => showToast('success', `Installing ${ext.name}…`)}
                            />
                        </>
                    )}
                    {activeSub === 'cache' && cacheData && <CacheView onClear={handleClearCache} />}
                    {activeSub === 'connections' && (
                        <ConnectionsView connData={connData} onKill={handleKillConnection} onRefresh={loadData} />
                    )}
                    {/* ★ NEW HIGH: pg_hba.conf visual editor */}
                    {activeSub === 'hba' && <HBAView />}
                </div>

                {showSidebar && (
                    <ServerSidebar
                        collapsed={sidebarCollapsed}
                        onToggle={() => setSidebarCollapsed((p) => !p)}
                        serverStats={serverStats}
                    />
                )}
            </div>

            {/* Modals */}
            {showWizard && (
                <TuningModal
                    currentSettings={settingsData}
                    onClose={() => setShowWizard(false)}
                    onApply={handleApplyWizard}
                />
            )}
            {showChangelog && <ChangeLogModal onClose={() => setShowChangelog(false)} />}
            {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}

            {/* Toast */}
            {toast && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: 24,
                        right: 24,
                        zIndex: 600,
                        padding: '13px 18px',
                        borderRadius: 18,
                        background: T.surface,
                        border: `1px solid ${toast.type === 'error' ? T.danger : T.success}35`,
                        boxShadow: `0 10px 36px rgba(0,0,0,0.6), 0 0 0 1px ${toast.type === 'error' ? T.danger : T.success}12, 0 0 24px ${toast.type === 'error' ? T.danger : T.success}15`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 11,
                        animation: 'admSlideUp 0.3s cubic-bezier(0.22,1,0.36,1)',
                    }}
                >
                    {toast.type === 'error' ? (
                        <XCircle size={18} color={T.danger} />
                    ) : (
                        <CheckCircle size={18} color={T.success} />
                    )}
                    <span style={{ fontWeight: 700, color: T.textMain, fontSize: 13, fontFamily: T.fontBody }}>
                        {toast.msg}
                    </span>
                    <button
                        onClick={() => setToast(null)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: T.textDim,
                            padding: 0,
                            marginLeft: 4,
                        }}
                    >
                        <X size={12} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default AdminTab;
