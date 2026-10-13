// ==========================================================================
//  PulseDB — Security & Compliance Center (v2.0)
// ==========================================================================
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { THEME, useAdaptiveTheme, useGlobalRefresh, metricValue } from '../../../utils/theme';
import { fetchData } from '../../../utils/api';

import {
    Shield,
    Lock,
    AlertOctagon,
    FileText,
    Key,
    Eye,
    UserCheck,
    Globe,
    Activity,
    Search,
    AlertTriangle,
    CheckCircle,
    XCircle,
    ChevronRight,
    Download,
    RefreshCw,
    Database,
    Server,
    Fingerprint,
    FileCheck,
    ShieldAlert,
    TrendingUp,
    TrendingDown,
    Cpu,
    Wifi,
    WifiOff,
    Bell,
    ChevronDown,
    ChevronUp,
    Filter,
    MoreVertical,
    Zap,
    Clock,
    MapPin,
    Terminal,
    BarChart2,
    List,
    LayoutGrid,
    UserCog,
    AlertCircle,
    ClipboardList,
} from 'lucide-react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    AreaChart,
    Area,
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
} from 'recharts';

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const SecStyles = () => (
    <style>{`
        .sec-root {
            font-family: ${THEME.fontBody};
            background: ${THEME.bg};
            min-height: 100vh;
        }

        .sec-card {
            background: ${THEME.surface};
            border: 1px solid ${THEME.glassBorder};
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
            backdrop-filter: blur(12px);
            transition: all 0.25s ease;
            display: flex;
            position: relative;
        }
        .sec-card:hover {
            border-color: ${THEME.danger}40;
            box-shadow: 0 12px 40px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08);
            transform: translateY(-4px);
        }

        .sec-card-stripe {
            width: 5px;
            flex-shrink: 0;
            background: var(--severity-color, ${THEME.primary});
        }

        .sec-card-content {
            flex: 1;
            padding: 20px 22px;
        }

        .sec-card-header {
            background: ${THEME.textMain}06;
            padding: 14px 20px;
            border-bottom: 1px solid ${THEME.glassBorder};
            font-weight: 700;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 22px;
        }

        /* Legacy .card fallback for compatibility */
        .card {
            background: ${THEME.surface};
            border: 1px solid ${THEME.glassBorder};
            border-radius: 20px;
            overflow: hidden;
            transition: border-color 0.2s, box-shadow 0.2s;
            position: relative;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
            backdrop-filter: blur(12px);
        }
        .card:hover {
            border-color: ${THEME.primary}33;
            box-shadow: 0 12px 40px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08);
            transform: translateY(-4px);
        }

        .card-glow-red:hover {
            border-color: ${THEME.danger}4d !important;
            box-shadow: 0 12px 40px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08) !important;
        }

        .mono { font-family: ${THEME.fontMono}; }

        /* Scrollbar */
        .sec-scroll::-webkit-scrollbar { width: 4px; }
        .sec-scroll::-webkit-scrollbar-track { background: transparent; }
        .sec-scroll::-webkit-scrollbar-thumb { background: ${THEME.primary}33; border-radius: 2px; }

        /* Tabs */
        .nav-tab {
            padding: 10px 20px;
            border-radius: 22px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.04em;
            cursor: pointer;
            border: none;
            transition: all 0.2s;
            background: transparent;
            color: ${THEME.textMuted};
            text-transform: uppercase;
        }
        .nav-tab:hover { color: ${THEME.textMain}; }
        .nav-tab.active {
            background: ${THEME.primary}1a;
            color: ${THEME.primary};
            border: 1px solid ${THEME.primary}40;
        }

        /* Threat rows */
        .threat-row {
            display: grid;
            grid-template-columns: 32px 1.8fr 1fr 90px 110px 36px;
            padding: 15px 22px;
            border-bottom: 1px solid ${THEME.glassBorder};
            align-items: center;
            font-size: 12px;
            transition: background 0.15s;
            gap: 20px;
        }
        .threat-row:hover { background: ${THEME.danger}0a; }
        .threat-row.critical-row { border-left: 2px solid ${THEME.danger}; }
        .threat-row.high-row { border-left: 2px solid ${THEME.warning}; }
        .threat-row.medium-row { border-left: 2px solid ${THEME.warning}; }
        .threat-row.low-row { border-left: 2px solid ${THEME.info}; }

        .threat-row-header {
            display: grid;
            grid-template-columns: 32px 1.8fr 1fr 90px 110px 36px;
            padding: 12px 22px;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: ${THEME.textDim};
            border-bottom: 1px solid ${THEME.glassBorder};
            gap: 20px;
        }

        /* Compliance items */
        .comp-item {
            display: grid;
            grid-template-columns: 20px 1fr 70px 80px;
            align-items: center;
            gap: 20px;
            padding: 24px 30px;
            border-radius: 22px;
            border: 1px solid transparent;
            transition: all 0.2s;
            cursor: pointer;
            margin-bottom: 6px;
        }
        .comp-item:hover { border-color: ${THEME.primary}26; background: ${THEME.primary}08; }

        /* Pulse animation for live indicator */
        @keyframes pulse-ring {
            0% { transform: scale(0.8); opacity: 1; }
            100% { transform: scale(2.2); opacity: 0; }
        }
        .live-dot {
            width: 8px; height: 8px; border-radius: 50%;
            background: ${THEME.danger};
            position: relative; display: inline-block;
        }
        .live-dot::after {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: ${THEME.danger};
            animation: pulse-ring 1.6s ease-out infinite;
        }

        @keyframes scan-line {
            0% { top: 0%; opacity: 0.6; }
            50% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
        }
        .scan-line {
            position: absolute; left: 0; right: 0; height: 1px;
            background: linear-gradient(90deg, transparent, ${THEME.primary}99, transparent);
            animation: scan-line 3s linear infinite;
            pointer-events: none;
        }

        @keyframes fadeSlideIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .fade-in { animation: fadeSlideIn 0.35s ease-out forwards; }

        /* Score ring */
        @keyframes ring-draw {
            from { stroke-dashoffset: 440; }
            to { stroke-dashoffset: var(--target-offset); }
        }
        .score-ring-circle {
            stroke-dasharray: 440;
            stroke-dashoffset: var(--target-offset);
            animation: ring-draw 1.2s cubic-bezier(0.4,0,0.2,1) forwards;
            transform-origin: center;
            transform: rotate(-90deg);
        }

        /* Badge */
        .badge {
            display: inline-flex; align-items: center;
            padding: 2px 8px; border-radius: 22px;
            font-size: 10px; font-weight: 800; letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        /* GEO heatmap cells */
        .geo-cell {
            padding: 24px 30px;
            border-radius: 20px;
            font-size: 11px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 4px;
            transition: all 0.2s;
        }

        /* Timeline event */
        .timeline-event {
            display: flex; gap: 18px; align-items: flex-start;
            padding-bottom: 16px;
            position: relative;
        }
        .timeline-event::before {
            content: '';
            position: absolute; left: 15px; top: 28px; bottom: 0;
            width: 1px; background: ${THEME.glassBorder};
        }
        .timeline-event:last-child::before { display: none; }

        /* Key vault */
        .key-item {
            padding: 22px 28px;
            border-radius: 20px;
            border: 1px solid ${THEME.glassBorder};
            background: ${THEME.surface};
            margin-bottom: 8px;
            transition: all 0.2s;
        }
        .key-item:hover { border-color: ${THEME.primary}33; }

        /* Expiry progress */
        .key-progress {
            height: 3px; border-radius: 2px;
            background: ${THEME.glassBorder};
            margin-top: 8px; overflow: hidden;
        }
        .key-progress-fill {
            height: 100%; border-radius: 2px;
            transition: width 0.8s ease;
        }

        /* Search bar */
        .search-input {
            background: ${THEME.surface};
            border: 1px solid ${THEME.glassBorder};
            border-radius: 22px; padding: 14px 20px 8px 36px;
            color: ${THEME.textMain}; font-size: 12px; width: 200px;
            outline: none; transition: all 0.2s;
            font-family: ${THEME.fontMono};
        }
        .search-input:focus {
            border-color: ${THEME.primary}59;
            background: ${THEME.primary}0a;
            width: 260px;
        }
        .search-input::placeholder { color: ${THEME.textDim}; }

        /* MITRE ATT&CK badges */
        .mitre-tag {
            font-family: ${THEME.fontMono};
            font-size: 9px; padding: 2px 6px; border-radius: 3px;
            background: ${THEME.primary}14;
            color: ${THEME.primary}b3;
            border: 1px solid ${THEME.primary}26;
        }

        /* Radar chart label */
        .recharts-polar-angle-axis-tick text {
            fill: ${THEME.textMuted} !important;
            font-size: 11px !important;
        }
    `}</style>
);

/* ═══════════════════════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════════════════════ */
const THREAT_LOGS = [];

const COMPLIANCE_CHECKS = [];
// Empty state: "Compliance checks will load when security policies are configured."

const ENCRYPTION_KEYS = [];
// Empty state: "Encryption key inventory will load from your security configuration."

const PII_ACCESS = [];
// Empty state: "PII access logs will appear from audit trail data."

const GEO_THREATS = [];

const THREAT_TIMELINE = [];

// RADAR_DATA is now computed from compliance data in the component

const AUDIT_EVENTS = [];

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
const SEV_COLORS = {
    critical: THEME.danger,
    high: THEME.warning,
    medium: THEME.warning,
    low: THEME.info,
    info: THEME.info,
};

const Badge = ({ label, color }) => (
    <span className="badge" style={{ background: `${color}18`, color, border: `1px solid ${color}35` }}>
        {label}
    </span>
);

const ThreatBadge = ({ severity }) => <Badge label={severity} color={SEV_COLORS[severity] || THEME.textMuted} />;

const SectionHeader = ({ icon: Icon, title, iconColor, right }) => (
    <div
        style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 20px',
            borderBottom: `1px solid ${THEME.glassBorder}`,
        }}
    >
        <h3
            style={{
                fontSize: 13,
                fontWeight: 700,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                color: THEME.textMain,
                letterSpacing: '0.02em',
            }}
        >
            <Icon size={15} color={iconColor || THEME.primary} />
            {title}
        </h3>
        {right}
    </div>
);

const MiniStat = ({ label, value, sub, color, icon: Icon }) => (
    <div
        style={{
            padding: '20px 24px',
            background: THEME.surface,
            borderRadius: 16,
            border: `1px solid ${THEME.glassBorder}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
        }}
    >
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.02em',
                color: THEME.textMuted,
            }}
        >
            {Icon && <Icon size={12} color={color} />} {label}
        </div>
        <div
            style={{
                fontSize: 26,
                fontWeight: 800,
                color: metricValue(color),
                lineHeight: 1,
                fontFamily: THEME.fontMono,
            }}
        >
            {value}
        </div>
        {sub && <div style={{ fontSize: 11, color: THEME.textDim, fontFamily: THEME.fontMono }}>{sub}</div>}
    </div>
);

/* Score Ring SVG */
const ScoreRing = ({ score }) => {
    const r = 68,
        circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    const color = score >= 80 ? THEME.success : score >= 60 ? THEME.warning : THEME.danger;
    return (
        <div
            style={{
                position: 'relative',
                width: 160,
                height: 160,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <svg width="160" height="160" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r={r} stroke={THEME.glassBorder} strokeWidth="8" fill="none" />
                <circle
                    cx="80"
                    cy="80"
                    r={r}
                    stroke={color}
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    transform="rotate(-90 80 80)"
                    style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
                />
                <defs>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                <circle
                    cx="80"
                    cy="80"
                    r={r}
                    stroke={color}
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    transform="rotate(-90 80 80)"
                    filter="url(#glow)"
                    opacity="0.4"
                />
            </svg>
            <div style={{ position: 'absolute', textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: metricValue(color), fontFamily: THEME.fontMono, lineHeight: 1 }}>
                    {score}
                </div>
                <div
                    style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: THEME.textMuted,
                        letterSpacing: '0.12em',
                        marginTop: 4,
                    }}
                >
                    SECURITY
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: THEME.textMuted, letterSpacing: '0.12em' }}>
                    SCORE
                </div>
            </div>
        </div>
    );
};

/* Custom Tooltip */
const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div
            style={{
                background: THEME.surface,
                border: `1px solid ${THEME.primary}33`,
                borderRadius: 20,
                padding: '14px 20px',
                fontSize: 12,
                fontFamily: THEME.fontMono,
            }}
        >
            <div style={{ color: THEME.textMuted, marginBottom: 4 }}>{label}</div>
            {payload.map((p, i) => (
                <div key={i} style={{ color: p.color || THEME.info }}>
                    {p.name}: <strong>{p.value}</strong>
                </div>
            ))}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   PANELS
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Threat Monitor ─────────────────────────────────────────────────────── */
const ThreatMonitor = ({ search, threatLogs = [] }) => {
    const [expanded, setExpanded] = useState(null);
    const safeThreatLogs = Array.isArray(threatLogs) ? threatLogs : [];
    const filtered = safeThreatLogs.filter(
        (t) =>
            !search ||
            (t.type?.toLowerCase?.() || '').includes(search.toLowerCase()) ||
            (t.user?.toLowerCase?.() || '').includes(search.toLowerCase()),
    );

    return (
        <div className="card card-glow-red">
            <SectionHeader
                icon={AlertOctagon}
                title="Live Threat Monitor"
                iconColor={THEME.danger}
                right={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        <span className="live-dot" />
                        <span
                            style={{ fontSize: 11, color: THEME.danger, fontWeight: 700, fontFamily: THEME.fontMono }}
                        >
                            LIVE
                        </span>
                    </div>
                }
            />
            <div className="threat-row-header">
                <div />
                <div>Threat / Query</div>
                <div>Actor</div>
                <div>MITRE</div>
                <div>Severity</div>
                <div />
            </div>
            <div className="sec-scroll" style={{ maxHeight: 340, overflowY: 'auto' }}>
                {filtered.map((log) => (
                    <React.Fragment key={log.id}>
                        <div
                            className={`threat-row ${log.severity}-row`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                        >
                            <ShieldAlert size={14} color={SEV_COLORS[log.severity]} />
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: THEME.textMain, marginBottom: 2 }}>
                                    {log.type}
                                </div>
                                <div
                                    className="mono"
                                    style={{
                                        fontSize: 10,
                                        color: THEME.textDim,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        maxWidth: 280,
                                        minWidth: 0,
                                    }}
                                >
                                    {log.query}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, color: THEME.textMain }}>{log.user}</div>
                                <div className="mono" style={{ fontSize: 10, color: THEME.textDim }}>
                                    {log.source}
                                </div>
                            </div>
                            <span className="mitre-tag">{log.mitre}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ThreatBadge severity={log.severity} />
                                {log.blocked && <Badge label="blocked" color={THEME.success} />}
                            </div>
                            <ChevronDown
                                size={14}
                                color={THEME.textDim}
                                style={{
                                    transform: expanded === log.id ? 'rotate(180deg)' : 'none',
                                    transition: 'transform 0.2s',
                                }}
                            />
                        </div>
                        {expanded === log.id && (
                            <div
                                className="fade-in"
                                style={{
                                    padding: '12px 20px 16px 52px',
                                    background: `${SEV_COLORS[log.severity]}06`,
                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                }}
                            >
                                <div
                                    className="mono"
                                    style={{
                                        fontSize: 11,
                                        color: THEME.primary,
                                        padding: '20px 24px',
                                        background: THEME.bg,
                                        borderRadius: 18,
                                        border: `1px solid ${THEME.primary}26`,
                                        marginBottom: 10,
                                    }}
                                >
                                    {log.query}
                                </div>
                                <div style={{ display: 'flex', gap: 24, fontSize: 11, color: THEME.textMuted }}>
                                    <span>
                                        Time: <strong style={{ color: THEME.textMain }}>{log.time}</strong>
                                    </span>
                                    <span>
                                        Origin: <strong style={{ color: THEME.textMain }}>{log.geo}</strong>
                                    </span>
                                    <span>
                                        Status:{' '}
                                        <strong style={{ color: log.blocked ? THEME.success : THEME.danger }}>
                                            {log.blocked ? 'Blocked' : 'Allowed'}
                                        </strong>
                                    </span>
                                </div>
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

/* ── Threat Timeline Chart ──────────────────────────────────────────────── */
const ThreatTimeline = () => (
    <div className="card">
        <SectionHeader
            icon={Activity}
            title="Threat Activity (24h)"
            iconColor={THEME.warning}
            right={
                <span style={{ fontSize: 11, color: THEME.textDim, fontFamily: THEME.fontMono }}>threats / hour</span>
            }
        />
        <div style={{ padding: '16px 8px 8px' }}>
            <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={THREAT_TIMELINE} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="tGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={THEME.danger} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={THEME.danger} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="bGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={THEME.success} stopOpacity={0.25} />
                            <stop offset="95%" stopColor={THEME.success} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={THEME.glassBorder} />
                    <XAxis
                        dataKey="h"
                        tick={{ fill: THEME.textDim, fontSize: 9 }}
                        axisLine={false}
                        tickLine={false}
                        interval={3}
                    />
                    <YAxis tick={{ fill: THEME.textDim, fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                        type="monotone"
                        dataKey="threats"
                        name="Threats"
                        stroke={THEME.danger}
                        fill="url(#tGrad)"
                        strokeWidth={2}
                        dot={false}
                    />
                    <Area
                        type="monotone"
                        dataKey="blocked"
                        name="Blocked"
                        stroke={THEME.success}
                        fill="url(#bGrad)"
                        strokeWidth={1.5}
                        dot={false}
                        strokeDasharray="4 2"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    </div>
);

/* ── GEO Threat Map ─────────────────────────────────────────────────────── */
const GeoThreatPanel = () => {
    const safeGeoThreats = Array.isArray(GEO_THREATS) ? GEO_THREATS : [];
    return (
        <div className="card" style={{ padding: 20 }}>
            <SectionHeader
                icon={Globe}
                title="Attack Origin"
                iconColor={THEME.info}
                right={<Badge label="last 24h" color={THEME.info} />}
            />
            <div style={{ marginTop: 16 }}>
                {safeGeoThreats.map((g, i) => (
                    <div
                        key={i}
                        className="geo-cell"
                        style={{ background: `${g.color}08`, border: `1px solid ${g.color}15` }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                            <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: g.color, width: 24 }}>
                                {g.code}
                            </span>
                            <span style={{ fontSize: 12, color: THEME.textMain }}>{g.country}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                            <div style={{ width: 80, height: 4, background: THEME.glassBorder, borderRadius: 2 }}>
                                <div
                                    style={{ width: `${g.pct}%`, height: '100%', background: g.color, borderRadius: 2 }}
                                />
                            </div>
                            <span
                                className="mono"
                                style={{ fontSize: 11, color: g.color, width: 28, textAlign: 'right' }}
                            >
                                {g.count}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ── Compliance Panel ───────────────────────────────────────────────────── */
const CompliancePanel = ({ complianceChecks = [] }) => {
    const [filter, setFilter] = useState('all');
    const standards = ['all', 'SOC2', 'GDPR', 'HIPAA', 'ISO27001', 'CIS'];
    const safeChecks = Array.isArray(complianceChecks) ? complianceChecks : [];
    const filtered = filter === 'all' ? safeChecks : safeChecks.filter((c) => c.standard === filter);
    const passCount = safeChecks.filter((c) => c.status === 'pass').length;

    return (
        <div className="card">
            <SectionHeader
                icon={FileCheck}
                title="Compliance Posture"
                right={
                    <div className="mono" style={{ fontSize: 12, color: THEME.success, fontWeight: 700 }}>
                        {passCount}/{safeChecks.length} Pass
                    </div>
                }
            />
            <div
                style={{
                    padding: '16px 22px',
                    borderBottom: `1px solid ${THEME.glassBorder}`,
                    display: 'flex',
                    gap: 4,
                    overflowX: 'auto',
                }}
            >
                {standards.map((s) => (
                    <button
                        key={s}
                        className={`nav-tab ${filter === s ? 'active' : ''}`}
                        style={{ padding: '4px 10px', fontSize: 10 }}
                        onClick={() => setFilter(s)}
                    >
                        {s}
                    </button>
                ))}
            </div>
            <div className="sec-scroll" style={{ maxHeight: 320, overflowY: 'auto', padding: '22px 28px' }}>
                {filtered.map((item) => {
                    const color =
                        item.status === 'pass' ? THEME.success : item.status === 'fail' ? THEME.danger : THEME.warning;
                    const Icon =
                        item.status === 'pass' ? CheckCircle : item.status === 'fail' ? XCircle : AlertTriangle;
                    return (
                        <div key={item.id} className="comp-item">
                            <Icon size={16} color={color} />
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: THEME.textMain }}>{item.label}</div>
                                <div style={{ fontSize: 10, color: THEME.textDim, marginTop: 2 }}>{item.cat}</div>
                            </div>
                            <Badge label={item.standard} color={THEME.textMuted} />
                            <Badge label={item.status} color={color} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/* ── Security Radar ─────────────────────────────────────────────────────── */
const SecurityRadar = ({ complianceChecks = [] }) => {
    // Compute radar data from compliance checks
    const computeRadarData = () => {
        const categoryScores = {
            'Access Ctrl': [],
            Encryption: [],
            Auditing: [],
            Patching: [],
            Network: [],
            'Data Privacy': [],
        };

        const safeChecks = Array.isArray(complianceChecks) ? complianceChecks : [];

        // Map compliance categories to radar axes
        safeChecks.forEach((check) => {
            if (!check) return;
            const checkStatus = check.status === 'pass' ? 100 : check.status === 'warn' ? 50 : 0;

            // Map compliance categories to radar dimensions
            if (check.cat && check.cat.includes('access')) categoryScores['Access Ctrl'].push(checkStatus);
            if (check.cat && check.cat.includes('encrypt')) categoryScores['Encryption'].push(checkStatus);
            if (check.cat && check.cat.includes('audit')) categoryScores['Auditing'].push(checkStatus);
            if (check.cat && check.cat.includes('patch')) categoryScores['Patching'].push(checkStatus);
            if (check.cat && check.cat.includes('network')) categoryScores['Network'].push(checkStatus);
            if (check.cat && check.cat.includes('privacy')) categoryScores['Data Privacy'].push(checkStatus);

            // Fallback: map by standard or label keywords
            if (check.standard === 'SOC2') {
                categoryScores['Auditing'].push(checkStatus);
                categoryScores['Access Ctrl'].push(checkStatus);
            }
            if (check.standard === 'GDPR' || check.label?.includes('GDPR')) {
                categoryScores['Data Privacy'].push(checkStatus);
            }
            if (check.standard === 'HIPAA') {
                categoryScores['Encryption'].push(checkStatus);
                categoryScores['Data Privacy'].push(checkStatus);
            }
        });

        // Average scores for each category
        return Object.entries(categoryScores).map(([axis, scores]) => ({
            axis,
            val: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
        }));
    };

    const radarData = computeRadarData();

    return (
        <div className="card" style={{ padding: '0 0 12px' }}>
            <SectionHeader icon={BarChart2} title="Security Posture Radar" iconColor={THEME.primaryLight} />
            <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={75}>
                    <PolarGrid stroke={THEME.glassBorder} />
                    <PolarAngleAxis dataKey="axis" tick={{ fill: THEME.textMuted, fontSize: 11 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                        name="Score"
                        dataKey="val"
                        stroke={THEME.primaryLight}
                        fill={THEME.primaryLight}
                        fillOpacity={0.15}
                        strokeWidth={2}
                        dot={{ fill: THEME.primaryLight, r: 3 }}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
};

/* ── PII Access Log ─────────────────────────────────────────────────────── */
const PIIAccessLog = () => {
    const safePIIAccess = Array.isArray(PII_ACCESS) ? PII_ACCESS : [];
    return (
        <div className="card">
            <SectionHeader
                icon={Fingerprint}
                title="PII / Sensitive Access"
                iconColor={THEME.danger}
                right={<span style={{ fontSize: 11, color: THEME.textDim, fontFamily: THEME.fontMono }}>last 24h</span>}
            />
            <div style={{ padding: '12px 20px' }}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 90px 80px 60px',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.02em',
                        color: THEME.textDim,
                        borderBottom: `1px solid ${THEME.glassBorder}`,
                        paddingBottom: 8,
                        marginBottom: 4,
                    }}
                >
                    <div>Resource · Accessor</div>
                    <div>Hits</div>
                    <div>Trend</div>
                    <div>Risk</div>
                </div>
                {safePIIAccess.map((a, i) => (
                    <div
                        key={i}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 90px 80px 60px',
                            padding: '11px 0',
                            borderBottom: `1px solid ${THEME.glassBorder}`,
                            alignItems: 'center',
                            fontSize: 12,
                        }}
                    >
                        <div>
                            <div>
                                <span style={{ color: THEME.textMuted }}>{a.table}</span>
                                <span style={{ color: THEME.danger, fontWeight: 700 }}>.{a.col}</span>
                            </div>
                            <div className="mono" style={{ fontSize: 10, color: THEME.textDim, marginTop: 2 }}>
                                {a.user}
                            </div>
                        </div>
                        <div className="mono" style={{ fontWeight: 700, color: THEME.textMain }}>
                            {(a.hits || 0).toLocaleString()}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {a.trend > 0 ? (
                                <TrendingUp size={12} color={THEME.warning} />
                            ) : a.trend < 0 ? (
                                <TrendingDown size={12} color={THEME.success} />
                            ) : (
                                <span style={{ color: THEME.textDim, fontSize: 11 }}>—</span>
                            )}
                            <span
                                className="mono"
                                style={{
                                    fontSize: 11,
                                    color: a.trend > 0 ? THEME.warning : a.trend < 0 ? THEME.success : THEME.textDim,
                                }}
                            >
                                {a.trend !== 0 ? `${a.trend > 0 ? '+' : ''}${a.trend}%` : ''}
                            </span>
                        </div>
                        <ThreatBadge severity={a.risk} />
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ── Encryption Key Vault ───────────────────────────────────────────────── */
const KeyVault = () => {
    const statusColors = { active: THEME.success, expiring: THEME.danger, warning: THEME.warning };
    const safeEncryptionKeys = Array.isArray(ENCRYPTION_KEYS) ? ENCRYPTION_KEYS : [];
    return (
        <div className="card" style={{ padding: 0 }}>
            <SectionHeader
                icon={Key}
                title="Encryption Key Vault"
                iconColor={THEME.warning}
                right={
                    <button
                        style={{
                            fontSize: 11,
                            color: THEME.info,
                            background: `${THEME.info}14`,
                            border: `1px solid ${THEME.info}33`,
                            borderRadius: 18,
                            padding: '4px 10px',
                            cursor: 'pointer',
                            fontFamily: THEME.fontBody,
                            fontWeight: 700,
                        }}
                    >
                        Rotate Keys
                    </button>
                }
            />
            <div style={{ padding: '18px 22px' }}>
                {safeEncryptionKeys.map((k, i) => {
                    const color = statusColors[k.status];
                    const pct = ((k.daysLeft || 0) / (k.total || 1)) * 100;
                    return (
                        <div key={i} className="key-item">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textMain }}>{k.name}</div>
                                    <div className="mono" style={{ fontSize: 10, color: THEME.textDim, marginTop: 2 }}>
                                        {k.algo}
                                    </div>
                                </div>
                                <Badge label={k.status} color={color} />
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginTop: 6,
                                    fontSize: 11,
                                    color: THEME.textMuted,
                                }}
                            >
                                <span>Rotated {k.rotated}</span>
                                <span style={{ color }}>
                                    {k.daysLeft < 30 ? `⚠ ${k.daysLeft}d left` : `${k.daysLeft}d left`}
                                </span>
                            </div>
                            <div className="key-progress">
                                <div
                                    className="key-progress-fill"
                                    style={{
                                        width: `${pct}%`,
                                        background: pct > 60 ? color : pct > 20 ? THEME.warning : THEME.danger,
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/* ── Audit Timeline ─────────────────────────────────────────────────────── */
const AuditTimeline = ({ auditEvents = [] }) => {
    const safeAuditEvents = Array.isArray(auditEvents) ? auditEvents : [];
    return (
        <div className="card" style={{ padding: 0 }}>
            <SectionHeader
                icon={Clock}
                title="Audit Events"
                iconColor={THEME.info}
                right={
                    <button
                        style={{
                            fontSize: 11,
                            color: THEME.textMuted,
                            background: THEME.surface,
                            border: `1px solid ${THEME.glassBorder}`,
                            borderRadius: 18,
                            padding: '4px 10px',
                            cursor: 'pointer',
                        }}
                    >
                        Export
                    </button>
                }
            />
            <div style={{ padding: '22px 28px' }}>
                {safeAuditEvents.map((ev, i) => {
                    const color = SEV_COLORS[ev.severity] || '#888';
                    return (
                        <div key={i} className="timeline-event">
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    background: `${color}15`,
                                    border: `1.5px solid ${color}40`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                <Activity size={12} color={color} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: THEME.textMain }}>
                                        {ev.action}
                                    </span>
                                    <span className="mono" style={{ fontSize: 10, color: THEME.textDim }}>
                                        {ev.ts}
                                    </span>
                                </div>
                                <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 2 }}>
                                    <span style={{ color: THEME.info }}>{ev.user}</span> → {ev.target}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   ★ NEW HIGH: SUPERUSER ACTIVITY MONITOR
   ═══════════════════════════════════════════════════════════════════════════ */
const SUPERUSER_SAMPLE = [];
// Empty state: "Superuser activity will load from pg_stat_activity."

const RISK_COLOR = { critical: THEME.danger, high: THEME.danger, medium: THEME.warning, low: THEME.success };

const SuperuserMonitor = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('all'); // all | critical | high | medium | low
    const [expandedPid, setExpanded] = useState(null);

    const fetchActivity = async () => {
        setLoading(true);
        try {
            const data = await fetchData('/api/security/superuser-activity');
            // Backend returns { active_sessions: [...], superuser_roles: [...] }
            let sessions = null;
            if (data?.active_sessions && Array.isArray(data.active_sessions)) {
                sessions = data.active_sessions;
            } else if (Array.isArray(data)) {
                sessions = data;
            }
            setRows(sessions && sessions.length > 0 ? sessions : SUPERUSER_SAMPLE);
        } catch (err) {
            console.error('Failed to load superuser activity:', err);
            setRows(SUPERUSER_SAMPLE);
        } finally {
            setLoading(false);
        }
    };

    useGlobalRefresh(fetchActivity);

    useEffect(() => {
        fetchActivity();
    }, []);

    const safeRows = Array.isArray(rows) ? rows : [];
    const visible = filter === 'all' ? safeRows : safeRows.filter((r) => r.risk === filter);
    const counts = safeRows.reduce((acc, r) => {
        acc[r.risk] = (acc[r.risk] || 0) + 1;
        return acc;
    }, {});

    return (
        <div>
            {/* Summary strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 18 }}>
                {['critical', 'high', 'medium', 'low'].map((lvl) => (
                    <div
                        key={lvl}
                        className="card"
                        style={{
                            padding: '18px 22px',
                            cursor: 'pointer',
                            border: filter === lvl ? `1px solid ${RISK_COLOR[lvl]}` : '1px solid transparent',
                        }}
                        onClick={() => setFilter((f) => (f === lvl ? 'all' : lvl))}
                    >
                        <div style={{ fontSize: 22, fontWeight: 800, color: RISK_COLOR[lvl] }}>{counts[lvl] || 0}</div>
                        <div style={{ fontSize: 11, color: THEME.textDim, textTransform: 'capitalize', marginTop: 2 }}>
                            {lvl} risk
                        </div>
                    </div>
                ))}
            </div>

            <div className="card" style={{ padding: 20 }}>
                <div
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}
                >
                    <SectionHeader icon={UserCog} title="Superuser Activity Log" iconColor={THEME.danger} />
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr style={{ borderBottom: `1px solid ${THEME.glassBorder}` }}>
                                {[
                                    'PID',
                                    'User',
                                    'Database',
                                    'Last Query',
                                    'Duration',
                                    'State',
                                    'App',
                                    'Risk',
                                    'When',
                                ].map((h) => (
                                    <th
                                        key={h}
                                        style={{
                                            padding: '8px 10px',
                                            textAlign: 'left',
                                            color: THEME.textDim,
                                            fontWeight: 600,
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {visible.length === 0 && (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: 30, color: THEME.textDim }}>
                                        No activity found
                                    </td>
                                </tr>
                            )}
                            {visible.map((r, i) => (
                                <React.Fragment key={r.pid}>
                                    <tr
                                        onClick={() => setExpanded(expandedPid === r.pid ? null : r.pid)}
                                        style={{
                                            borderBottom: `1px solid ${THEME.glassBorder}`,
                                            cursor: 'pointer',
                                            background:
                                                expandedPid === r.pid ? 'rgba(255,255,255,0.03)' : 'transparent',
                                        }}
                                        onMouseEnter={(e) =>
                                            (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')
                                        }
                                        onMouseLeave={(e) =>
                                            (e.currentTarget.style.background =
                                                expandedPid === r.pid ? 'rgba(255,255,255,0.03)' : 'transparent')
                                        }
                                    >
                                        <td className="mono" style={{ padding: '10px 10px', color: THEME.textDim }}>
                                            {r.pid}
                                        </td>
                                        <td style={{ padding: '10px 10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <UserCog size={12} color={THEME.primary} />
                                                <span style={{ color: THEME.textMain, fontWeight: 600 }}>{r.user}</span>
                                            </div>
                                        </td>
                                        <td className="mono" style={{ padding: '10px 10px', color: THEME.textDim }}>
                                            {r.db}
                                        </td>
                                        <td
                                            className="mono"
                                            style={{
                                                padding: '10px 10px',
                                                maxWidth: 260,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                color: THEME.textMuted,
                                                minWidth: 0,
                                            }}
                                        >
                                            {r.query}
                                        </td>
                                        <td
                                            className="mono"
                                            style={{
                                                padding: '10px 10px',
                                                color: r.duration_sec > 10 ? THEME.warning : THEME.textDim,
                                            }}
                                        >
                                            {r.duration_sec}s
                                        </td>
                                        <td style={{ padding: '10px 10px' }}>
                                            <Badge
                                                label={r.state}
                                                color={
                                                    r.state === 'active'
                                                        ? THEME.success
                                                        : r.state.includes('transaction')
                                                          ? THEME.danger
                                                          : THEME.textDim
                                                }
                                            />
                                        </td>
                                        <td style={{ padding: '10px 10px', color: THEME.textDim }}>{r.app}</td>
                                        <td style={{ padding: '10px 10px' }}>
                                            <Badge label={r.risk} color={RISK_COLOR[r.risk]} />
                                        </td>
                                        <td
                                            style={{ padding: '10px 10px', color: THEME.textDim, whiteSpace: 'nowrap' }}
                                        >
                                            {r.ts}
                                        </td>
                                    </tr>
                                    {expandedPid === r.pid && (
                                        <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                                            <td colSpan={9} style={{ padding: '12px 20px' }}>
                                                <div
                                                    style={{
                                                        fontFamily: THEME.fontMono,
                                                        fontSize: 12,
                                                        color: THEME.primary,
                                                        background: 'rgba(0,0,0,0.3)',
                                                        borderRadius: 20,
                                                        padding: '18px 22px',
                                                        lineHeight: 1.6,
                                                        wordBreak: 'break-all',
                                                    }}
                                                >
                                                    {r.query}
                                                </div>
                                                <div style={{ marginTop: 10, display: 'flex', gap: 20 }}>
                                                    {r.risk === 'critical' || r.risk === 'high' ? (
                                                        <div
                                                            style={{
                                                                fontSize: 11,
                                                                color: THEME.danger,
                                                                display: 'flex',
                                                                gap: 4,
                                                                alignItems: 'center',
                                                            }}
                                                        >
                                                            <AlertCircle size={12} /> This operation warrants immediate
                                                            review — consider revoking session if unauthorized
                                                        </div>
                                                    ) : (
                                                        <div style={{ fontSize: 11, color: THEME.textDim }}>
                                                            No immediate action required.
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div
                    style={{
                        marginTop: 14,
                        padding: '22px 28px',
                        background: 'rgba(99,215,255,0.06)',
                        borderRadius: 20,
                        fontSize: 11,
                        color: THEME.textDim,
                    }}
                >
                    <strong style={{ color: THEME.primary }}>Tip:</strong> To terminate a suspicious session run{' '}
                    <span className="mono" style={{ color: THEME.primary }}>
                        SELECT pg_terminate_backend(&lt;pid&gt;);
                    </span>{' '}
                    in the SQL console.
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   ★ NEW HIGH: COMPLIANCE REPORT GENERATOR
   ═══════════════════════════════════════════════════════════════════════════ */
const FRAMEWORKS = [];

const ComplianceReportGenerator = () => {
    const [selected, setSelected] = useState('soc2');
    const [generating, setGenerating] = useState(false);
    const [lastGenerated, setLastGenerated] = useState(null);
    const [includeDetails, setIncludeDetails] = useState(true);
    const [includeRemediation, setIncludeRemediation] = useState(true);

    const safeFrameworks = Array.isArray(FRAMEWORKS) ? FRAMEWORKS : [];
    const fw = safeFrameworks.find((f) => f.id === selected);
    const pct = fw ? Math.round((fw.passed / (fw.checks || 1)) * 100) : 0;

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            await new Promise((r) => setTimeout(r, 1600)); // simulate generation
            setLastGenerated(new Date().toLocaleString());
        } catch (err) {
            console.error('Failed to generate report:', err);
        } finally {
            setGenerating(false);
        }
    };

    if (!fw) {
        return (
            <div className="card" style={{ padding: 20, marginTop: 18 }}>
                <SectionHeader icon={FileCheck} title="Compliance Report Generator" iconColor={THEME.primaryLight} />
                <div style={{ padding: '20px', textAlign: 'center', color: THEME.textDim }}>
                    No compliance frameworks configured
                </div>
            </div>
        );
    }

    return (
        <div className="card" style={{ padding: 20, marginTop: 18 }}>
            <SectionHeader icon={FileCheck} title="Compliance Report Generator" iconColor={THEME.primaryLight} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, margin: '16px 0' }}>
                {safeFrameworks.map((f) => (
                    <div
                        key={f.id}
                        onClick={() => setSelected(f.id)}
                        style={{
                            padding: '18px 22px',
                            borderRadius: 16,
                            cursor: 'pointer',
                            border: `1px solid ${selected === f.id ? f.color : THEME.glassBorder}`,
                            background: selected === f.id ? `${f.color}15` : 'transparent',
                            transition: 'all 0.15s',
                        }}
                    >
                        <div style={{ fontSize: 20, marginBottom: 6 }}>{f.icon}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textMain }}>{f.label}</div>
                        <div style={{ marginTop: 8 }}>
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: 11,
                                    color: THEME.textDim,
                                    marginBottom: 4,
                                }}
                            >
                                <span>
                                    {f.passed}/{f.checks} checks
                                </span>
                                <span style={{ color: f.color }}>{Math.round((f.passed / f.checks) * 100)}%</span>
                            </div>
                            <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                                <div
                                    style={{
                                        height: 4,
                                        width: `${(f.passed / f.checks) * 100}%`,
                                        background: f.color,
                                        borderRadius: 2,
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                {/* Config */}
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textMain, marginBottom: 14 }}>
                        Report Options
                    </div>
                    {[
                        { label: 'Include detailed findings', val: includeDetails, set: setIncludeDetails },
                        { label: 'Include remediation steps', val: includeRemediation, set: setIncludeRemediation },
                    ].map((opt) => (
                        <label
                            key={opt.label}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 22,
                                marginBottom: 12,
                                cursor: 'pointer',
                                fontSize: 12,
                                color: THEME.textMuted,
                            }}
                        >
                            <div
                                onClick={() => opt.set((v) => !v)}
                                style={{
                                    width: 36,
                                    height: 20,
                                    borderRadius: 16,
                                    background: opt.val ? THEME.primary : 'rgba(255,255,255,0.1)',
                                    position: 'relative',
                                    transition: 'background 0.2s',
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                }}
                            >
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: 3,
                                        left: opt.val ? 18 : 3,
                                        width: 14,
                                        height: 14,
                                        borderRadius: 18,
                                        background: THEME.textMain,
                                        transition: 'left 0.2s',
                                    }}
                                />
                            </div>
                            {opt.label}
                        </label>
                    ))}

                    <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 11, color: THEME.textDim, marginBottom: 8 }}>Export Format</div>
                        <div style={{ display: 'flex', gap: 20 }}>
                            {['PDF', 'CSV', 'JSON'].map((fmt) => (
                                <div
                                    key={fmt}
                                    style={{
                                        padding: '5px 14px',
                                        borderRadius: 18,
                                        border: `1px solid ${THEME.glassBorder}`,
                                        fontSize: 11,
                                        color: THEME.textMuted,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {fmt}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Summary + Generate */}
                <div
                    style={{
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 16,
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                    }}
                >
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textMain, marginBottom: 12 }}>
                            {fw.label} Summary
                        </div>
                        <div style={{ display: 'flex', gap: 22, marginBottom: 14 }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 32, fontWeight: 800, color: fw.color }}>{pct}%</div>
                                <div style={{ fontSize: 10, color: THEME.textDim }}>Compliance</div>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        fontSize: 11,
                                        color: THEME.textDim,
                                        marginBottom: 6,
                                    }}
                                >
                                    <span style={{ color: THEME.success }}>✓ Passed: {fw.passed}</span>
                                    <span style={{ color: THEME.danger }}>✗ Failed: {fw.checks - fw.passed}</span>
                                </div>
                                <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 16 }}>
                                    <div
                                        style={{ height: 8, width: `${pct}%`, background: fw.color, borderRadius: 16 }}
                                    />
                                </div>
                                <div style={{ fontSize: 11, color: THEME.textDim, marginTop: 8 }}>
                                    Total checks: {fw.checks}
                                </div>
                            </div>
                        </div>
                        {lastGenerated && (
                            <div
                                style={{
                                    fontSize: 11,
                                    color: THEME.textDim,
                                    padding: '20px 24px',
                                    background: 'rgba(74,222,128,0.08)',
                                    borderRadius: 18,
                                    display: 'flex',
                                    gap: 6,
                                    alignItems: 'center',
                                }}
                            >
                                <CheckCircle size={11} color={THEME.success} /> Last report generated: {lastGenerated}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        style={{
                            marginTop: 16,
                            background: generating ? 'rgba(167,139,250,0.3)' : 'rgba(167,139,250,0.15)',
                            border: '1px solid rgba(167,139,250,0.4)',
                            color: THEME.primaryLight,
                            padding: '10px 18px',
                            borderRadius: 20,
                            cursor: generating ? 'not-allowed' : 'pointer',
                            fontSize: 13,
                            fontWeight: 700,
                            fontFamily: THEME.fontBody,
                            display: 'flex',
                            gap: 20,
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                        }}
                    >
                        {generating ? (
                            <>
                                <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating…
                            </>
                        ) : (
                            <>
                                <ClipboardList size={14} /> Generate {fw.label} Report
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
const SecurityComplianceTab = () => {
    useAdaptiveTheme(); // keeps THEME in sync with dark/light toggle
    const [activeTab, setActiveTab] = useState('overview');
    const [search, setSearch] = useState('');
    const [score] = useState(88);
    const [threatLogs, setThreatLogs] = useState([]);
    const [complianceChecks, setComplianceChecks] = useState([]);
    const [auditEvents, setAuditEvents] = useState([]);
    const [superuserActivity, setSuperuserActivity] = useState({});

    // Fetch security data from API
    useEffect(() => {
        const loadSecurityData = async () => {
            try {
                const [threats, compliance, audit, superuser] = await Promise.all([
                    fetchData('/api/security/threats').catch(() => []),
                    fetchData('/api/security/compliance').catch(() => []),
                    fetchData('/api/security/audit-events').catch(() => []),
                    fetchData('/api/security/superuser-activity').catch(() => ({})),
                ]);
                setThreatLogs(Array.isArray(threats) ? threats : []);
                setComplianceChecks(Array.isArray(compliance) ? compliance : []);
                setAuditEvents(Array.isArray(audit) ? audit : []);
                setSuperuserActivity(superuser && typeof superuser === 'object' ? superuser : {});
            } catch (err) {
                console.error('Failed to load security data:', err);
                setThreatLogs([]);
                setComplianceChecks([]);
                setAuditEvents([]);
                setSuperuserActivity({});
            }
        };
        loadSecurityData();
    }, []);

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'threats', label: 'Threats' },
        { id: 'compliance', label: 'Compliance' },
        { id: 'encryption', label: 'Encryption' },
        { id: 'audit', label: 'Audit Log' },
        { id: 'superuser', label: '★ Superuser Monitor' },
    ];

    return (
        <div className="sec-root" style={{ padding: '0 0 60px' }}>
            <SecStyles />

            {/* ── Header ── */}
            <div style={{ padding: '16px 24px 0', marginBottom: 20 }}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                        gap: 18,
                    }}
                >
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 4 }}>
                            <Shield size={22} color={THEME.info} />
                            <h1
                                style={{
                                    fontSize: 22,
                                    fontWeight: 800,
                                    color: THEME.textMain,
                                    margin: 0,
                                    letterSpacing: '-0.02em',
                                }}
                            >
                                Security & Compliance
                            </h1>
                            <Badge label="Protected" color={THEME.success} />
                        </div>
                        <div style={{ fontSize: 12, color: THEME.textMuted, fontFamily: THEME.fontMono }}>
                            Last scan: 12m ago &nbsp;·&nbsp; 4 active threats &nbsp;·&nbsp; 1 critical
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                        {/* Search */}
                        <div style={{ position: 'relative' }}>
                            <Search
                                size={13}
                                color={THEME.textDim}
                                style={{
                                    position: 'absolute',
                                    left: 12,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    pointerEvents: 'none',
                                }}
                            />
                            <input
                                className="search-input"
                                placeholder="Search threats..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <button
                            style={{
                                background: `${THEME.danger}1f`,
                                color: THEME.danger,
                                border: `1px solid ${THEME.danger}4d`,
                                padding: '14px 20px',
                                borderRadius: 20,
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 700,
                                display: 'flex',
                                gap: 6,
                                alignItems: 'center',
                                fontFamily: THEME.fontBody,
                            }}
                        >
                            <AlertOctagon size={13} /> Run Scan
                        </button>
                        <button
                            style={{
                                background: THEME.primaryDark,
                                color: THEME.textInverse,
                                border: 'none',
                                padding: '14px 20px',
                                borderRadius: 20,
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 700,
                                display: 'flex',
                                gap: 6,
                                alignItems: 'center',
                                fontFamily: THEME.fontBody,
                            }}
                        >
                            <FileText size={13} /> Export Report
                        </button>
                    </div>
                </div>

                {/* Sub-nav */}
                <div style={{ display: 'flex', gap: 4, marginTop: 16 }}>
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            className={`nav-tab ${activeTab === t.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(t.id)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Overview ── */}
            {activeTab === 'overview' && (
                <div style={{ padding: '0 24px' }} className="fade-in">
                    {/* Metric bar */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 22 }}>
                        <MiniStat
                            label="Security Score"
                            value={score}
                            sub="↑ +3 from last week"
                            color={THEME.success}
                            icon={Shield}
                        />
                        <MiniStat
                            label="Active Threats"
                            value="4"
                            sub="1 critical, 2 medium"
                            color={THEME.danger}
                            icon={AlertOctagon}
                        />
                        <MiniStat
                            label="Failed Logins"
                            value="42"
                            sub="last 24 hours"
                            color={THEME.warning}
                            icon={UserCheck}
                        />
                        <MiniStat
                            label="PII Accesses"
                            value="1.5k"
                            sub="tracked resources"
                            color={THEME.danger}
                            icon={Eye}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
                        <ThreatMonitor search={search} threatLogs={threatLogs} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '160px 1fr',
                                    gap: 18,
                                    alignItems: 'center',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <ScoreRing score={score} />
                                </div>
                                <SecurityRadar complianceChecks={complianceChecks} />
                            </div>
                            <GeoThreatPanel />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                        <ThreatTimeline />
                        <PIIAccessLog />
                    </div>
                </div>
            )}

            {/* ── Threats ── */}
            {activeTab === 'threats' && (
                <div style={{ padding: '0 24px' }} className="fade-in">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            <ThreatMonitor search={search} threatLogs={threatLogs} />
                            <ThreatTimeline />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            <GeoThreatPanel />
                            <AuditTimeline auditEvents={auditEvents} />
                        </div>
                    </div>
                </div>
            )}

            {/* ── Compliance ── */}
            {activeTab === 'compliance' && (
                <div style={{ padding: '0 24px' }} className="fade-in">
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
                        <CompliancePanel complianceChecks={complianceChecks} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            <SecurityRadar complianceChecks={complianceChecks} />
                            <PIIAccessLog />
                        </div>
                    </div>
                    {/* ★ NEW HIGH: Compliance Report Generator */}
                    <ComplianceReportGenerator />
                </div>
            )}

            {/* ── Encryption ── */}
            {activeTab === 'encryption' && (
                <div style={{ padding: '0 24px' }} className="fade-in">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                        <KeyVault />
                        <div className="card" style={{ padding: 20 }}>
                            <SectionHeader icon={Lock} title="TLS Certificate Status" iconColor={THEME.success} />
                            <div style={{ padding: '16px 0' }}>
                                {[
                                    {
                                        domain: 'db.internal.company.com',
                                        expires: '2026-09-12',
                                        days: 207,
                                        status: 'valid',
                                    },
                                    {
                                        domain: 'replica-01.db.internal',
                                        expires: '2025-07-30',
                                        days: 12,
                                        status: 'expiring',
                                    },
                                    {
                                        domain: 'analytics.db.internal',
                                        expires: '2026-08-01',
                                        days: 165,
                                        status: 'valid',
                                    },
                                ].map((cert, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            padding: '12px 0',
                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <div>
                                            <div className="mono" style={{ fontSize: 12, color: THEME.textMain }}>
                                                {cert.domain}
                                            </div>
                                            <div style={{ fontSize: 11, color: THEME.textDim, marginTop: 3 }}>
                                                Expires {cert.expires}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                            <span
                                                className="mono"
                                                style={{
                                                    fontSize: 11,
                                                    color: cert.days < 30 ? THEME.danger : THEME.success,
                                                }}
                                            >
                                                {cert.days}d
                                            </span>
                                            <Badge
                                                label={cert.status}
                                                color={cert.status === 'valid' ? THEME.success : THEME.danger}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Audit Log ── */}
            {activeTab === 'audit' && (
                <div style={{ padding: '0 24px' }} className="fade-in">
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
                        <AuditTimeline auditEvents={auditEvents} />
                        <PIIAccessLog />
                    </div>
                </div>
            )}

            {/* ── ★ NEW HIGH: Superuser Monitor ── */}
            {activeTab === 'superuser' && (
                <div style={{ padding: '0 24px' }} className="fade-in">
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 4 }}>
                            <UserCog size={16} color={THEME.danger} />
                            <span style={{ fontSize: 14, fontWeight: 700, color: THEME.textMain }}>
                                Superuser Activity Monitor
                            </span>
                            <Badge label="Live" color={THEME.success} />
                        </div>
                        <div style={{ fontSize: 12, color: THEME.textDim }}>
                            Tracks all queries and actions executed by superusers in real time. High-risk operations are
                            automatically flagged.
                        </div>
                    </div>
                    <SuperuserMonitor />

                    {/* Role privilege summary */}
                    <div className="card" style={{ padding: 20, marginTop: 18 }}>
                        <SectionHeader icon={Shield} title="Superuser Role Summary" iconColor={THEME.info} />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginTop: 14 }}>
                            {(Array.isArray(SUPERUSER_SAMPLE) && SUPERUSER_SAMPLE.length > 0
                                ? SUPERUSER_SAMPLE.map((s) => ({
                                      role: s.user || 'unknown',
                                      sessions: 1,
                                      queries_24h: 0,
                                      last_seen: s.ts || 'N/A',
                                      critical: s.risk === 'critical' ? 1 : 0,
                                  }))
                                : []
                            ).map((r) => (
                                <div
                                    key={r.role}
                                    style={{
                                        background: 'rgba(255,255,255,0.03)',
                                        borderRadius: 16,
                                        padding: '18px 22px',
                                        border:
                                            r.critical > 0
                                                ? `1px solid ${THEME.danger}4d`
                                                : `1px solid ${THEME.glassBorder}`,
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginBottom: 10,
                                        }}
                                    >
                                        <span
                                            className="mono"
                                            style={{ fontSize: 13, fontWeight: 700, color: THEME.textMain }}
                                        >
                                            {r.role}
                                        </span>
                                        {r.critical > 0 && <Badge label="⚠ Critical" color={THEME.danger} />}
                                    </div>
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: 20,
                                            fontSize: 11,
                                        }}
                                    >
                                        <div style={{ color: THEME.textDim }}>Active sessions</div>
                                        <div style={{ color: THEME.textMain, textAlign: 'right' }}>{r.sessions}</div>
                                        <div style={{ color: THEME.textDim }}>Queries (24h)</div>
                                        <div style={{ color: THEME.textMain, textAlign: 'right' }}>{r.queries_24h}</div>
                                        <div style={{ color: THEME.textDim }}>Last seen</div>
                                        <div style={{ color: THEME.textDim, textAlign: 'right' }}>{r.last_seen}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SecurityComplianceTab;
