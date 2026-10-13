// components/tabs/PerformanceTab.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { THEME, ChartDefs, useAdaptiveTheme, metricValue } from '../../../utils/theme';
import {
    GlassCard,
    MetricCard,
    ResourceGauge,
    DataTable,
    ConnectionPoolBar,
    SkeletonLoader,
    NeonProgressBar,
    BloatStatusBadge,
    EmptyState,
} from '../../ui/SharedComponents';
import { fetchData } from '../../../utils/api';
import { readTabCache, writeTabCache } from '../../../utils/tabCache';
import {
    Activity,
    Clock,
    Server,
    Lock,
    Copy,
    ShieldAlert,
    Cpu,
    Database,
    ChevronLeft,
    Sparkles,
    Zap,
    ArrowRight,
    ArrowDown,
    CheckCircle,
    Play,
    X,
    AlertTriangle,
    FileSearch,
    BarChart3,
    HardDrive,
    Gauge,
    Network,
    Timer,
    TrendingUp,
    TrendingDown,
    Eye,
    Layers,
    GitBranch,
    RotateCcw,
    Terminal,
    Workflow,
    CircleDot,
    Radio,
    Tag,
    Bookmark,
    BookmarkCheck,
    Trash2,
    Search,
    Filter,
    ChevronDown,
    ChevronRight,
    Wifi,
    XCircle,
    List,
    Calendar,
    Hash,
    User,
    RefreshCcw,
    BarChart2,
    AlertCircle,
    Info,
    MoreHorizontal,
    SlidersHorizontal,
    Box,
    Package,
    Merge,
    GitMerge,
    Columns,
    Rows,
    Maximize2,
    Minimize2,
    FileText,
    Disc,
    GitFork,
} from 'lucide-react';

// Safe aliases for icons not available in lucide-react@0.263.1
const BrainCircuit = Cpu;
const Waypoints = GitMerge;
const Boxes = Package;
const Hourglass = Clock;
const Sigma = BarChart2;
const FileCog = SlidersHorizontal;
const Braces = FileText;
const MemoryStick = HardDrive;
const SquareStack = Layers;
const Falling = TrendingDown;
const LayoutGrid = Maximize2;
// GitFork added in later lucide versions — use GitBranch as fallback if needed
// Disc is available in 0.263.1 so no alias needed
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    BarChart,
    Bar,
    LineChart,
    Line,
    ReferenceLine,
    Cell,
    ComposedChart,
    PieChart,
    Pie,
    Legend,
    RadialBarChart,
    RadialBar,
    ScatterChart,
    Scatter,
} from 'recharts';

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const PerfStyles = () => (
    <style>{`
        @keyframes perfSpin {
            to { transform: rotate(360deg); }
        }
        .perf-row-hover:hover {
            background: ${THEME.primary}08 !important;
        }
        .perf-bar-animate {
            transform-origin: left;
        }
        .perf-spin { animation: perfSpin 1s linear infinite; }
        .perf-equal-row {
            display: grid;
            gap: 20px;
        }
        .perf-equal-row > * {
            height: 100%;
            min-height: 0;
        }
        .perf-equal-row > * > * {
            height: 100%;
            display: flex;
            flex-direction: column;
        }
        .tag-btn:hover { opacity: 0.85; }
        .filter-chip { cursor: pointer; }
        .filter-chip:hover { opacity: 0.85; }
        .wait-segment { cursor: pointer; }
        .wait-segment:hover { opacity: 0.85; }
        .kill-btn {
            opacity: 0;
        }
        tr:hover .kill-btn { opacity: 1 !important; }
    `}</style>
);

/* ═══════════════════════════════════════════════════════════════════════════
   MICRO-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */
const AnimValue = ({ value, decimals = 0, suffix = '', prefix = '' }) => {
    const [display, setDisplay] = useState(0);
    const ref = useRef();
    useEffect(() => {
        const target = Number(value) || 0;
        let startTime = null;
        const step = (ts) => {
            if (!startTime) startTime = ts;
            const p = Math.min((ts - startTime) / 800, 1);
            const ease = 1 - Math.pow(1 - p, 3);
            setDisplay(ease * target);
            if (p < 1) ref.current = requestAnimationFrame(step);
        };
        ref.current = requestAnimationFrame(step);
        return () => cancelAnimationFrame(ref.current);
    }, [value]);
    return (
        <span>
            {prefix}
            {display.toFixed(decimals)}
            {suffix}
        </span>
    );
};

const LiveDot = ({ color = THEME.success, size = 8 }) => (
    <span
        style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: size,
            height: size,
        }}
    >
        <span style={{ width: size * 0.7, height: size * 0.7, borderRadius: '50%', background: color }} />
    </span>
);

const MiniSparkline = ({ data, color, width = 80, height = 24 }) => {
    if (!data?.length) return null;
    const max = Math.max(...data),
        min = Math.min(...data),
        range = max - min || 1;
    const pts = data
        .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 2) - 1}`)
        .join(' ');
    const id = `msp-${color.replace(/[^a-z0-9]/gi, '')}-${width}`;
    return (
        <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
            <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${id})`} />
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

const SeverityBar = ({ value, max = 100, color = THEME.danger, delay = 0 }) => (
    <div style={{ width: '100%', height: 4, background: `${THEME.grid}60`, borderRadius: 2, overflow: 'hidden' }}>
        <div
            className="perf-bar-animate"
            style={{
                width: `${Math.min((value / max) * 100, 100)}%`,
                height: '100%',
                borderRadius: 2,
                background: `linear-gradient(90deg, ${color}90, ${color})`,
                animationDelay: `${delay}s`,
            }}
        />
    </div>
);

const SeverityTag = ({ ms }) => {
    const n = Number(ms);
    const level =
        n > 5000
            ? { label: 'CRITICAL', color: THEME.danger, bg: `${THEME.danger}18` }
            : n > 1000
              ? { label: 'HIGH', color: THEME.warning, bg: `${THEME.warning}15` }
              : n > 200
                ? { label: 'MEDIUM', color: THEME.primary, bg: `${THEME.primary}12` }
                : { label: 'LOW', color: THEME.textDim, bg: `${THEME.textDim}15` };
    return (
        <span
            style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '0.02em',
                padding: '3px 8px',
                borderRadius: 18,
                background: level.bg,
                color: level.color,
                border: `1px solid ${level.color}25`,
            }}
        >
            {level.label}
        </span>
    );
};

const StatChip = ({ label, value, color = THEME.textMain, icon: Icon, small }) => (
    <div
        style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: small ? 3 : 5,
            padding: small ? '8px 12px' : '12px 14px',
            background: THEME.surface,
            borderRadius: 20,
            border: `1px solid ${THEME.grid}40`,
            minWidth: 0,
            minHeight: small ? 52 : 62,
        }}
    >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, lineHeight: 1 }}>
            {Icon && <Icon size={10} color={THEME.textDim} style={{ flexShrink: 0 }} />}
            <span
                style={{
                    fontSize: 10,
                    color: THEME.textDim,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1,
                }}
            >
                {label}
            </span>
        </div>
        <span
            style={{
                fontSize: small ? 15 : 18,
                fontWeight: 800,
                color,
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
            }}
        >
            {value}
        </span>
    </div>
);

const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div
            style={{
                background: THEME.surface,
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: 20,
                padding: '20px 24px',
            }}
        >
            <div style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 2 }}>t = {label}</div>
            {payload.map((p, i) => (
                <div key={i} style={{ fontSize: 12, fontWeight: 700, color: p.color || THEME.primary }}>
                    {Number(p.value).toFixed(1)} {p.name}
                </div>
            ))}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   QUERY FINGERPRINTING & HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
const fingerprintQuery = (query) => {
    if (!query) return '';
    return query
        .replace(/\b\d+(\.\d+)?\b/g, '?')
        .replace(/'[^']*'/g, "'?'")
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        .substring(0, 80);
};

const groupByFingerprint = (queries) => {
    const groups = {};
    queries.forEach((q) => {
        const fp = fingerprintQuery(q.query);
        if (!groups[fp]) {
            groups[fp] = { fingerprint: fp, queries: [], totalCalls: 0, maxTime: 0, minTime: Infinity, avgTime: 0 };
        }
        groups[fp].queries.push(q);
        groups[fp].totalCalls += Number(q.calls || 1);
        groups[fp].maxTime = Math.max(groups[fp].maxTime, Number(q.mean_time_ms || 0));
        groups[fp].minTime = Math.min(groups[fp].minTime, Number(q.mean_time_ms || 0));
    });
    Object.values(groups).forEach((g) => {
        g.avgTime = g.queries.reduce((s, q) => s + Number(q.mean_time_ms || 0), 0) / g.queries.length;
        g.representative = g.queries[0];
    });
    return Object.values(groups);
};

const detectN1Patterns = (queries) => {
    const fingerprints = {};
    queries.forEach((q) => {
        const fp = fingerprintQuery(q.query);
        fingerprints[fp] = (fingerprints[fp] || 0) + Number(q.calls || 1);
    });
    return Object.entries(fingerprints)
        .filter(([_, count]) => count > 10)
        .map(([fp, count]) => ({
            fingerprint: fp,
            callCount: count,
            severity: count > 100 ? 'high' : count > 50 ? 'medium' : 'low',
        }))
        .sort((a, b) => b.callCount - a.callCount);
};

/* ═══════════════════════════════════════════════════════════════════════════
   AI OPTIMIZER
   ═══════════════════════════════════════════════════════════════════════════ */
const generateOptimization = (query) => {
    // Provide basic pattern-based suggestions — real EXPLAIN comes from the backend
    const suggestions = [];
    if (query?.includes('SELECT *'))
        suggestions.push({
            fixType: 'Column Pruning',
            reason: 'SELECT * fetches all columns including unused fields. Specify only needed columns.',
            category: 'IO Optimization',
        });
    if (query && /\bOR\b/i.test(query))
        suggestions.push({
            fixType: 'Query Rewrite',
            reason: 'OR conditions may disable index usage. Consider UNION ALL for separate index scans.',
            category: 'Index Utilization',
        });
    if (query && /ORDER BY/i.test(query) && !/LIMIT/i.test(query))
        suggestions.push({
            fixType: 'Missing LIMIT',
            reason: 'ORDER BY without LIMIT sorts all rows. Add LIMIT to reduce work.',
            category: 'Sort Optimization',
        });
    if (!suggestions.length)
        suggestions.push({
            fixType: 'Review Indexes',
            reason: 'Run EXPLAIN ANALYZE to check for sequential scans on large tables.',
            category: 'General',
        });
    const sug = suggestions[0];
    return {
        optimized: '-- Run EXPLAIN ANALYZE on this query for a real execution plan',
        reason: sug.reason,
        fixType: sug.fixType,
        category: sug.category,
        improvement: 'Run EXPLAIN to measure',
        costBefore: 0,
        costAfter: 0,
    };
};

/* ═══════════════════════════════════════════════════════════════════════════
   EXPLAIN PLAN TREE VISUALIZER
   ═══════════════════════════════════════════════════════════════════════════ */
// generateExplainTree removed — real EXPLAIN plans come from /api/optimizer/analyze
const generateExplainTree = () => [];

const ExplainTreeNode = ({ node, depth = 0, maxCost = 2845 }) => {
    const [expanded, setExpanded] = useState(true);
    const costPct = (parseFloat(node.cost?.split('..')[1]) / maxCost) * 100;
    const isExpensive = costPct > 60;
    const color = isExpensive ? THEME.danger : costPct > 30 ? THEME.warning : THEME.success;

    return (
        <div style={{ marginLeft: depth > 0 ? 24 : 0 }}>
            <div
                onClick={() => node.children?.length && setExpanded(!expanded)}
                style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 22,
                    padding: '8px 10px',
                    borderRadius: 20,
                    marginBottom: 4,
                    cursor: node.children?.length ? 'pointer' : 'default',
                    background: isExpensive ? `${THEME.danger}06` : `${THEME.grid}15`,
                    border: `1px solid ${isExpensive ? `${THEME.danger}20` : `${THEME.grid}30`}`,
                    position: 'relative',
                }}
            >
                {depth > 0 && (
                    <div
                        style={{
                            position: 'absolute',
                            left: -24,
                            top: '50%',
                            width: 20,
                            height: 1,
                            background: `${THEME.grid}50`,
                        }}
                    />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    {node.children?.length ? (
                        <div style={{ color: THEME.textDim, flexShrink: 0 }}>
                            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </div>
                    ) : (
                        <div style={{ width: 12, flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: THEME.textMain }}>{node.op}</span>
                            {node.table && (
                                <span style={{ fontSize: 11, color: THEME.primary, fontFamily: THEME.fontMono }}>
                                    on {node.table}
                                </span>
                            )}
                            {node.index && (
                                <span
                                    style={{
                                        fontSize: 10,
                                        color: THEME.success,
                                        padding: '1px 6px',
                                        borderRadius: 20,
                                        background: `${THEME.success}10`,
                                        border: `1px solid ${THEME.success}20`,
                                    }}
                                >
                                    idx: {node.index}
                                </span>
                            )}
                        </div>
                        <div style={{ fontSize: 10, color: THEME.textDim, marginTop: 2, fontFamily: THEME.fontMono }}>
                            {node.detail}
                        </div>
                        {node.rowsRemoved && (
                            <div style={{ fontSize: 10, color: THEME.warning, marginTop: 1 }}>
                                ⚠ {node.rowsRemoved.toLocaleString()} rows removed by filter
                            </div>
                        )}
                    </div>
                </div>
                <div
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}
                >
                    <span style={{ fontSize: 12, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>
                        {parseFloat(node.cost?.split('..')[1]).toFixed(1)}
                    </span>
                    <div
                        style={{
                            width: 60,
                            height: 3,
                            background: `${THEME.grid}40`,
                            borderRadius: 2,
                            overflow: 'hidden',
                        }}
                    >
                        <div style={{ width: `${costPct}%`, height: '100%', background: color, borderRadius: 2 }} />
                    </div>
                    {node.actualTime && (
                        <span style={{ fontSize: 9, color: THEME.textDim, fontFamily: THEME.fontMono }}>
                            {node.actualTime}ms
                        </span>
                    )}
                </div>
            </div>
            {expanded &&
                node.children?.map((child) => (
                    <ExplainTreeNode key={child.id} node={child} depth={depth + 1} maxCost={maxCost} />
                ))}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   WAIT EVENT BREAKDOWN PIE CHART  ★ NEW
   ═══════════════════════════════════════════════════════════════════════════ */
const WAIT_COLORS = {
    Lock: THEME.danger,
    IO: THEME.warning,
    CPU: THEME.primary,
    Client: THEME.success,
    IPC: THEME.primaryLight,
    Timeout: THEME.warning,
    Extension: THEME.textDim,
};

const PieCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, pct }) => {
    if (parseFloat(pct) < 6) return null;
    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
        <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700}>
            {pct}%
        </text>
    );
};

const WaitEventBreakdown = ({ waitEventTypes, waitEvents }) => {
    const [hoveredWait, setHoveredWait] = useState(null);

    const waitData = useMemo(() => {
        // Use real wait_event_type aggregation from pg_stat_activity
        if (!waitEventTypes?.length) return [];
        const total = waitEventTypes.reduce((s, w) => s + Number(w.count), 0) || 1;
        return waitEventTypes
            .map((w) => ({
                name: w.wait_event_type,
                value: Number(w.count),
                pct: ((Number(w.count) / total) * 100).toFixed(1),
                color: WAIT_COLORS[w.wait_event_type] || THEME.textDim,
            }))
            .sort((a, b) => b.value - a.value);
    }, [waitEventTypes]);

    const total = waitData.reduce((s, d) => s + d.value, 0);

    // Build detail rows from real wait_event data grouped by type
    const detailRows = useMemo(() => {
        if (!waitEvents?.length) return {};
        const grouped = {};
        waitEvents.forEach((w) => {
            const type = w.wait_event_type;
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push({ event: w.wait_event, count: Number(w.count), type });
        });
        return grouped;
    }, [waitEvents]);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, alignItems: 'start' }}>
            {/* Pie */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
                <div style={{ position: 'relative' }}>
                    <PieChart width={200} height={200}>
                        <Pie
                            data={waitData}
                            cx={100}
                            cy={100}
                            innerRadius={55}
                            outerRadius={90}
                            dataKey="value"
                            labelLine={false}
                            label={PieCustomLabel}
                            onMouseEnter={(_, i) => setHoveredWait(waitData[i]?.name)}
                            onMouseLeave={() => setHoveredWait(null)}
                        >
                            {waitData.map((entry, i) => (
                                <Cell
                                    key={i}
                                    fill={entry.color}
                                    opacity={hoveredWait && hoveredWait !== entry.name ? 0.4 : 1}
                                    stroke={hoveredWait === entry.name ? entry.color : 'transparent'}
                                    strokeWidth={hoveredWait === entry.name ? 2 : 0}
                                    style={{ transition: 'opacity 0.2s', cursor: 'pointer' }}
                                />
                            ))}
                        </Pie>
                    </PieChart>
                    <div
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            textAlign: 'center',
                            pointerEvents: 'none',
                        }}
                    >
                        <div
                            style={{
                                fontSize: 20,
                                fontWeight: 800,
                                color: hoveredWait ? WAIT_COLORS[hoveredWait] : THEME.textMain,
                                fontVariantNumeric: 'tabular-nums',
                                lineHeight: 1,
                            }}
                        >
                            {hoveredWait ? waitData.find((d) => d.name === hoveredWait)?.pct + '%' : total}
                        </div>
                        <div
                            style={{
                                fontSize: 9,
                                color: THEME.textDim,
                                fontWeight: 600,
                                marginTop: 3,
                                letterSpacing: '0.02em',
                            }}
                        >
                            {hoveredWait || 'sessions'}
                        </div>
                    </div>
                </div>
                {/* Legend */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                    {waitData.map((d) => (
                        <div
                            key={d.name}
                            onMouseEnter={() => setHoveredWait(d.name)}
                            onMouseLeave={() => setHoveredWait(null)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '3px 10px',
                                borderRadius: 20,
                                cursor: 'pointer',
                                background: hoveredWait === d.name ? `${d.color}15` : `${THEME.grid}20`,
                                border: `1px solid ${hoveredWait === d.name ? `${d.color}40` : 'transparent'}`,
                            }}
                        >
                            <span
                                style={{ width: 7, height: 7, borderRadius: '50%', background: d.color, flexShrink: 0 }}
                            />
                            <span
                                style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    color: hoveredWait === d.name ? d.color : THEME.textDim,
                                }}
                            >
                                {d.name}
                            </span>
                            <span
                                style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    color: hoveredWait === d.name ? d.color : THEME.textMain,
                                }}
                            >
                                {d.value}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Detail breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div
                    style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: THEME.textDim,
                        letterSpacing: '0.02em',
                        marginBottom: 2,
                    }}
                >
                    {hoveredWait ? `${hoveredWait} Wait Events` : 'Hover a slice to drill down'}
                </div>
                {(hoveredWait && detailRows[hoveredWait]
                    ? detailRows[hoveredWait]
                    : waitData.flatMap((d) => (detailRows[d.name] || []).slice(0, 1))
                ).map((row, i) => {
                    const color = WAIT_COLORS[row.type];
                    const maxCount = 30;
                    return (
                        <div
                            key={i}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 22,
                                padding: '6px 10px',
                                borderRadius: 18,
                                background: `${THEME.grid}15`,
                                border: `1px solid ${THEME.grid}25`,
                            }}
                        >
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                            <span
                                style={{
                                    flex: 1,
                                    fontSize: 11,
                                    color: THEME.textMuted,
                                    fontFamily: THEME.fontMono,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {row.event}
                            </span>
                            <div style={{ width: 60, flexShrink: 0 }}>
                                <SeverityBar value={row.count} max={maxCount} color={color} />
                            </div>
                            <span
                                style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color,
                                    fontVariantNumeric: 'tabular-nums',
                                    flexShrink: 0,
                                    minWidth: 20,
                                    textAlign: 'right',
                                }}
                            >
                                {row.count}
                            </span>
                        </div>
                    );
                })}
                <div
                    style={{
                        marginTop: 4,
                        padding: '8px 10px',
                        borderRadius: 18,
                        background: `${THEME.primary}08`,
                        border: `1px solid ${THEME.primary}15`,
                    }}
                >
                    <div style={{ fontSize: 10, color: THEME.textDim, lineHeight: 1.5 }}>
                        <span style={{ color: THEME.primary, fontWeight: 700 }}>Tip:</span>{' '}
                        {hoveredWait === 'Lock' &&
                            'High lock waits indicate contention. Check long-running transactions and use NOWAIT or advisory locks.'}
                        {hoveredWait === 'IO' &&
                            'High IO waits suggest buffer cache pressure. Consider increasing shared_buffers or adding indexes.'}
                        {hoveredWait === 'CPU' &&
                            'CPU-bound sessions are actively computing. Check for missing indexes or large sort operations.'}
                        {hoveredWait === 'Client' &&
                            'Client wait suggests slow application reads. Check network latency or application processing time.'}
                        {!hoveredWait &&
                            'Wait events show what sessions are waiting for. IO and Lock waits are most actionable.'}
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SLOW QUERY TREND (24h)  ★ NEW
   ═══════════════════════════════════════════════════════════════════════════ */
const SlowQueryTrend24h = ({ slowQueries }) => {
    // Show real slow query distribution: group by total_time contribution
    const data = useMemo(() => {
        if (!slowQueries?.length) return [];
        // Show top queries ranked by total execution time as bar chart
        return slowQueries.slice(0, 12).map((q, i) => ({
            label: `Q${i + 1}`,
            slow: Math.round(Number(q.total_time_ms || q.mean_time_ms || 0)),
            critical: Number(q.max_time_ms || 0) > 5000 ? 1 : 0,
            p99: Math.round(Number(q.max_time_ms || q.mean_time_ms || 0)),
            query: q.query?.substring(0, 40) || '',
        }));
    }, [slowQueries]);

    if (!data.length)
        return (
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 160,
                    color: THEME.textDim,
                    fontSize: 12,
                }}
            >
                No slow queries detected
            </div>
        );

    const maxSlow = Math.max(...data.map((d) => d.slow), 1);
    const peakQuery = data.reduce((best, d) => (d.slow > best.slow ? d : best), data[0]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 22 }}>
                {[
                    { label: 'Slowest', value: peakQuery?.label || '—', color: THEME.danger, icon: TrendingUp },
                    {
                        label: 'Avg Time (ms)',
                        value: Math.round(data.reduce((s, d) => s + d.slow, 0) / data.length),
                        color: THEME.warning,
                        icon: Sigma,
                    },
                    {
                        label: 'Total (ms)',
                        value: data.reduce((s, d) => s + d.slow, 0).toLocaleString(),
                        color: THEME.primary,
                        icon: BarChart2,
                    },
                    {
                        label: 'Critical',
                        value: data.reduce((s, d) => s + d.critical, 0),
                        color: THEME.danger,
                        icon: AlertCircle,
                    },
                ].map((s, i) => (
                    <StatChip key={i} label={s.label} value={s.value} color={s.color} icon={s.icon} small />
                ))}
            </div>
            <ResponsiveContainer width="100%" height={160}>
                <ComposedChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke={`${THEME.grid}30`} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 8, fill: THEME.textDim }}
                        axisLine={false}
                        tickLine={false}
                        interval={3}
                    />
                    <YAxis
                        yAxisId="count"
                        tick={{ fontSize: 9, fill: THEME.textDim }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        yAxisId="p99"
                        orientation="right"
                        tick={{ fontSize: 9, fill: THEME.textDim }}
                        axisLine={false}
                        tickLine={false}
                        unit="ms"
                    />
                    <Tooltip
                        content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            return (
                                <div
                                    style={{
                                        background: THEME.surface,
                                        border: `1px solid ${THEME.glassBorder}`,
                                        borderRadius: 20,
                                        padding: '20px 24px',
                                    }}
                                >
                                    <div style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 4 }}>{label}</div>
                                    {payload.map((p, i) => (
                                        <div key={i} style={{ fontSize: 12, fontWeight: 700, color: p.color }}>
                                            {p.name}: {Number(p.value).toFixed(p.name === 'P99 ms' ? 0 : 0)}
                                            {p.name === 'P99 ms' ? 'ms' : ''}
                                        </div>
                                    ))}
                                </div>
                            );
                        }}
                    />
                    <Bar yAxisId="count" dataKey="slow" name="Slow Queries" radius={[2, 2, 0, 0]}>
                        {data.map((d, i) => (
                            <Cell
                                key={i}
                                fill={
                                    d.slow >= maxSlow * 0.8
                                        ? THEME.danger
                                        : d.slow >= maxSlow * 0.5
                                          ? THEME.warning
                                          : `${THEME.primary}80`
                                }
                            />
                        ))}
                    </Bar>
                    <Bar
                        yAxisId="count"
                        dataKey="critical"
                        name="Critical"
                        fill={`${THEME.danger}50`}
                        radius={[2, 2, 0, 0]}
                    />
                    <Line
                        yAxisId="p99"
                        type="monotone"
                        dataKey="p99"
                        stroke={THEME.primary}
                        strokeWidth={1.5}
                        dot={false}
                        name="P99 ms"
                    />
                </ComposedChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 22, fontSize: 10, color: THEME.textDim, flexWrap: 'wrap' }}>
                {[
                    { label: 'Slow Queries', color: THEME.warning },
                    { label: 'Critical (>5s)', color: THEME.danger },
                    { label: 'P99 Latency', color: THEME.primary },
                ].map((l) => (
                    <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 10, height: 3, borderRadius: 2, background: l.color }} />
                        {l.label}
                    </span>
                ))}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   JIT COMPILATION STATS  ★ NEW
   ═══════════════════════════════════════════════════════════════════════════ */
const JITCompilationPanel = ({ slowQueries, jitEnabled }) => {
    const jitData = useMemo(() => {
        // Show real slow query data — JIT columns require PG 15+ pg_stat_statements
        return (slowQueries || []).slice(0, 8).map((q, i) => ({
            ...q,
            id: q.id || i,
            hasJit: false, // True JIT status requires EXPLAIN ANALYZE per-query
            compileMs: 0,
            execMs: Math.round(Number(q.mean_time_ms || 0)),
            savings: 0,
            net: 0,
            functions: 0,
            inlining: false,
            optimization: false,
            deform: false,
        }));
    }, [slowQueries]);

    const jitQueries = jitData.filter((q) => q.hasJit);
    const totalSavings = jitQueries.reduce((s, q) => s + q.savings, 0);
    const totalCost = jitQueries.reduce((s, q) => s + q.compileMs, 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {/* Summary strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 22 }}>
                {[
                    { label: 'JIT Queries', value: jitQueries.length, color: THEME.primary, icon: BrainCircuit },
                    { label: 'Compile Time', value: `${totalCost}ms`, color: THEME.warning, icon: Timer },
                    { label: 'Exec Savings', value: `${totalSavings}ms`, color: THEME.success, icon: TrendingDown },
                    {
                        label: 'Net Benefit',
                        value: `${totalSavings - totalCost}ms`,
                        color: totalSavings > totalCost ? THEME.success : THEME.danger,
                        icon: Zap,
                    },
                ].map((s, i) => (
                    <StatChip key={i} {...s} small />
                ))}
            </div>

            {/* Per-query table */}
            <div style={{ borderRadius: 20, border: `1px solid ${THEME.grid}40`, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: `${THEME.grid}15` }}>
                            {['Query', 'JIT', 'Compile', 'Exec Time', 'Savings', 'Net', 'Flags'].map((h, i) => (
                                <th
                                    key={h}
                                    style={{
                                        padding: '20px 24px',
                                        textAlign: i === 0 ? 'left' : 'center',
                                        fontSize: 9,
                                        fontWeight: 700,
                                        color: THEME.textDim,
                                        letterSpacing: '0.02em',
                                        borderBottom: `1px solid ${THEME.grid}40`,
                                    }}
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {jitData.map((q, i) => (
                            <tr
                                key={i}
                                className="perf-row-hover"
                                style={{ borderBottom: `1px solid ${THEME.grid}20` }}
                            >
                                <td style={{ padding: '20px 24px', maxWidth: 180 }}>
                                    <span
                                        style={{
                                            fontSize: 11,
                                            fontFamily: THEME.fontMono,
                                            color: THEME.textMuted,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            display: 'block',
                                        }}
                                    >
                                        {q.query?.substring(0, 28) || `Query ${i + 1}`}…
                                    </span>
                                </td>
                                <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                                    {q.hasJit ? (
                                        <span
                                            style={{
                                                fontSize: 9,
                                                fontWeight: 800,
                                                padding: '2px 7px',
                                                borderRadius: 18,
                                                background: `${THEME.primary}12`,
                                                color: THEME.primary,
                                                border: `1px solid ${THEME.primary}20`,
                                            }}
                                        >
                                            ON
                                        </span>
                                    ) : (
                                        <span
                                            style={{
                                                fontSize: 9,
                                                fontWeight: 700,
                                                padding: '2px 7px',
                                                borderRadius: 18,
                                                background: `${THEME.grid}20`,
                                                color: THEME.textDim,
                                            }}
                                        >
                                            OFF
                                        </span>
                                    )}
                                </td>
                                <td
                                    style={{
                                        padding: '20px 24px',
                                        textAlign: 'center',
                                        fontSize: 11,
                                        color: q.hasJit ? THEME.warning : THEME.textDim,
                                        fontVariantNumeric: 'tabular-nums',
                                        fontWeight: 600,
                                    }}
                                >
                                    {q.hasJit ? `${q.compileMs}ms` : '—'}
                                </td>
                                <td
                                    style={{
                                        padding: '20px 24px',
                                        textAlign: 'center',
                                        fontSize: 11,
                                        fontVariantNumeric: 'tabular-nums',
                                        fontWeight: 700,
                                        color: q.execMs > 1000 ? THEME.danger : THEME.warning,
                                    }}
                                >
                                    {q.execMs}ms
                                </td>
                                <td
                                    style={{
                                        padding: '20px 24px',
                                        textAlign: 'center',
                                        fontSize: 11,
                                        color: q.hasJit ? THEME.success : THEME.textDim,
                                        fontVariantNumeric: 'tabular-nums',
                                        fontWeight: 700,
                                    }}
                                >
                                    {q.hasJit ? `−${q.savings}ms` : '—'}
                                </td>
                                <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                                    {q.hasJit ? (
                                        <span
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 800,
                                                fontVariantNumeric: 'tabular-nums',
                                                color: q.net >= 0 ? THEME.success : THEME.danger,
                                            }}
                                        >
                                            {q.net >= 0 ? '+' : ''}
                                            {q.net}ms
                                        </span>
                                    ) : (
                                        <span style={{ color: THEME.textDim, fontSize: 11 }}>—</span>
                                    )}
                                </td>
                                <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
                                        {q.inlining && (
                                            <span
                                                title="Inlining"
                                                style={{
                                                    fontSize: 8,
                                                    padding: '1px 5px',
                                                    borderRadius: 20,
                                                    background: `${THEME.primary}12`,
                                                    color: THEME.primary,
                                                    border: `1px solid ${THEME.primary}20`,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                INL
                                            </span>
                                        )}
                                        {q.optimization && (
                                            <span
                                                title="Optimization"
                                                style={{
                                                    fontSize: 8,
                                                    padding: '1px 5px',
                                                    borderRadius: 20,
                                                    background: `${THEME.success}12`,
                                                    color: THEME.success,
                                                    border: `1px solid ${THEME.success}20`,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                OPT
                                            </span>
                                        )}
                                        {q.deform && (
                                            <span
                                                title="Deform"
                                                style={{
                                                    fontSize: 8,
                                                    padding: '1px 5px',
                                                    borderRadius: 20,
                                                    background: `${THEME.warning}12`,
                                                    color: THEME.warning,
                                                    border: `1px solid ${THEME.warning}20`,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                DEF
                                            </span>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div
                style={{
                    fontSize: 10,
                    color: THEME.textDim,
                    padding: '6px 10px',
                    background: `${THEME.grid}15`,
                    borderRadius: 18,
                }}
            >
                <span style={{ color: THEME.primary, fontWeight: 700 }}>INL</span> = function inlining &nbsp;·&nbsp;
                <span style={{ color: THEME.success, fontWeight: 700 }}>OPT</span> = expression optimization
                &nbsp;·&nbsp;
                <span style={{ color: THEME.warning, fontWeight: 700 }}>DEF</span> = tuple deforming &nbsp;·&nbsp; JIT
                helps complex analytical queries with many repeated expressions.
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   PARALLEL QUERY UTILIZATION  ★ NEW
   ═══════════════════════════════════════════════════════════════════════════ */
const ParallelQueryPanel = ({ stats, settings }) => {
    const maxWorkers = Number(settings?.max_parallel_workers) || Number(stats?.max_parallel_workers) || 0;
    const maxWorkersPerGather =
        Number(settings?.max_parallel_workers_per_gather) || Number(stats?.max_parallel_workers_per_gather) || 0;

    // No synthetic data — show configuration info and note that live parallel worker tracking requires EXPLAIN
    const parallelData = [];
    const queryBreakdown = [];

    const avgWorkers = 0;
    const utilizationPct = '—';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 22 }}>
                {[
                    { label: 'Max Workers', value: maxWorkers, color: THEME.primary, icon: Boxes },
                    { label: 'Per Gather', value: maxWorkersPerGather, color: THEME.textMuted, icon: GitFork },
                    { label: 'Avg Active', value: avgWorkers.toFixed(1), color: THEME.success, icon: Activity },
                    {
                        label: 'Utilization',
                        value: `${utilizationPct}%`,
                        color: Number(utilizationPct) > 70 ? THEME.danger : THEME.warning,
                        icon: Gauge,
                    },
                ].map((s, i) => (
                    <StatChip key={i} {...s} small />
                ))}
            </div>

            <div
                style={{
                    padding: 16,
                    borderRadius: 20,
                    background: `${THEME.primary}06`,
                    border: `1px solid ${THEME.primary}15`,
                }}
            >
                <div style={{ fontSize: 11, color: THEME.textDim, lineHeight: 1.6 }}>
                    <span style={{ color: THEME.primary, fontWeight: 700 }}>Note:</span> Parallel worker utilization is
                    a point-in-time metric from active queries. Use{' '}
                    <code style={{ color: THEME.primary }}>EXPLAIN ANALYZE</code> on individual queries to see actual
                    parallel worker allocation. Current configuration:{' '}
                    <code style={{ color: THEME.primary }}>max_parallel_workers = {maxWorkers}</code>,{' '}
                    <code style={{ color: THEME.primary }}>
                        max_parallel_workers_per_gather = {maxWorkersPerGather}
                    </code>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   LOCK TREE / BLOCKING CHAIN VISUALIZATION  ★ NEW
   ═══════════════════════════════════════════════════════════════════════════ */
const LockTreeNode = ({ node, depth = 0, isLast = false }) => {
    const [expanded, setExpanded] = useState(true);
    const hasBlockees = node.blockees && node.blockees.length > 0;
    const colors = {
        holder: THEME.warning,
        waiter: THEME.danger,
        deadlock: THEME.dangerDark,
    };
    const color = colors[node.role] || THEME.textMuted;

    return (
        <div style={{ position: 'relative' }}>
            {depth > 0 && (
                <div
                    style={{
                        position: 'absolute',
                        left: -16,
                        top: 0,
                        bottom: isLast ? '50%' : 0,
                        width: 1,
                        background: `${THEME.grid}50`,
                    }}
                />
            )}
            {depth > 0 && (
                <div
                    style={{
                        position: 'absolute',
                        left: -16,
                        top: '50%',
                        width: 16,
                        height: 1,
                        background: `${THEME.grid}50`,
                    }}
                />
            )}
            <div style={{ marginLeft: depth > 0 ? 20 : 0, marginBottom: 8 }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 22,
                        padding: '22px 28px',
                        borderRadius: 20,
                        background: `${color}06`,
                        border: `1px solid ${color}20`,
                        cursor: hasBlockees ? 'pointer' : 'default',
                    }}
                    onClick={() => hasBlockees && setExpanded(!expanded)}
                >
                    <div
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 20,
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: `${color}12`,
                            border: `1px solid ${color}20`,
                        }}
                    >
                        {node.role === 'holder' ? <Lock size={14} color={color} /> : <Timer size={14} color={color} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 20,
                                flexWrap: 'wrap',
                                marginBottom: 3,
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    padding: '1px 7px',
                                    borderRadius: 18,
                                    background: `${color}15`,
                                    color,
                                    border: `1px solid ${color}25`,
                                }}
                            >
                                {node.role === 'holder' ? 'HOLDING' : 'WAITING'}
                            </span>
                            <span
                                style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: THEME.textMain,
                                    fontFamily: THEME.fontMono,
                                }}
                            >
                                PID {node.pid}
                            </span>
                            <span style={{ fontSize: 10, color: THEME.textDim }}>{node.app}</span>
                            <span style={{ fontSize: 10, color: THEME.textDim }}>·</span>
                            <span style={{ fontSize: 10, color: THEME.primary, fontFamily: THEME.fontMono }}>
                                {node.lockType}
                            </span>
                            <span style={{ fontSize: 10, color: THEME.textDim }}>on</span>
                            <span
                                style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: THEME.primary,
                                    fontFamily: THEME.fontMono,
                                }}
                            >
                                {node.relation}
                            </span>
                            {node.waitTime && (
                                <span style={{ fontSize: 10, fontWeight: 700, color: color, marginLeft: 4 }}>
                                    ({node.waitTime})
                                </span>
                            )}
                        </div>
                        <div
                            style={{
                                fontSize: 10,
                                fontFamily: THEME.fontMono,
                                color: THEME.textDim,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {node.query}
                        </div>
                    </div>
                    {hasBlockees && (
                        <div style={{ flexShrink: 0, color: THEME.textDim }}>
                            <span style={{ fontSize: 10, color: THEME.danger, fontWeight: 700, marginRight: 6 }}>
                                blocking {node.blockees.length}
                            </span>
                            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </div>
                    )}
                </div>

                {expanded && hasBlockees && (
                    <div style={{ marginTop: 4 }}>
                        {node.blockees.map((child, i) => (
                            <LockTreeNode
                                key={i}
                                node={child}
                                depth={depth + 1}
                                isLast={i === node.blockees.length - 1}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const LockBlockingTree = ({ lockBlocking }) => {
    const tree = useMemo(() => {
        // Build tree from real lock blocking data from pg_stat_activity + pg_blocking_pids
        if (!lockBlocking?.length) return [];
        // Group by blocking PID
        const holders = {};
        lockBlocking.forEach((row) => {
            const bpid = row.blocking_pid;
            if (!holders[bpid]) {
                holders[bpid] = {
                    pid: bpid,
                    app: row.blocking_app || '',
                    role: 'holder',
                    lockType: row.wait_event || 'Lock',
                    relation: '',
                    query: row.blocking_query || '',
                    waitTime: null,
                    blockees: [],
                };
            }
            holders[bpid].blockees.push({
                pid: row.blocked_pid,
                app: row.blocked_app || '',
                role: 'waiter',
                lockType: row.wait_event || 'Lock',
                relation: '',
                query: row.blocked_query || '',
                waitTime: row.wait_sec ? `${row.wait_sec}s` : '',
                blockees: [],
            });
        });
        return Object.values(holders);
    }, [lockBlocking]);

    const totalBlocked = tree.reduce((s, t) => s + t.blockees.length + t.blockees.flatMap((b) => b.blockees).length, 0);

    if (tree.length === 0)
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
                <EmptyState icon={CheckCircle} text="No lock blocking chains detected" />
            </div>
        );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', gap: 22, marginBottom: 8, flexWrap: 'wrap' }}>
                <span
                    style={{
                        fontSize: 10,
                        padding: '3px 10px',
                        borderRadius: 18,
                        background: `${THEME.warning}12`,
                        color: THEME.warning,
                        border: `1px solid ${THEME.warning}20`,
                        fontWeight: 700,
                    }}
                >
                    {tree.length} lock holders
                </span>
                <span
                    style={{
                        fontSize: 10,
                        padding: '3px 10px',
                        borderRadius: 18,
                        background: `${THEME.danger}12`,
                        color: THEME.danger,
                        border: `1px solid ${THEME.danger}20`,
                        fontWeight: 700,
                    }}
                >
                    {totalBlocked} blocked processes
                </span>
                <span
                    style={{
                        fontSize: 10,
                        color: THEME.textDim,
                        padding: '3px 0',
                        display: 'flex',
                        alignItems: 'center',
                    }}
                >
                    Click a node to collapse its subtree
                </span>
            </div>
            {tree.map((root, i) => (
                <LockTreeNode key={i} node={root} depth={0} />
            ))}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   DEADLOCK HISTORY  ★ NEW
   ═══════════════════════════════════════════════════════════════════════════ */
const DeadlockHistory = ({ dbStats }) => {
    const [selectedDeadlock, setSelectedDeadlock] = useState(null);

    const deadlockCount = Number(dbStats?.deadlocks || 0);
    const deadlocks = [];
    // PostgreSQL only exposes cumulative deadlock count via pg_stat_database
    // Individual deadlock details require log parsing (not available via SQL)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 22, marginBottom: 4 }}>
                <StatChip
                    label="Total Deadlocks"
                    value={deadlockCount}
                    color={deadlockCount > 0 ? THEME.danger : THEME.success}
                    icon={ShieldAlert}
                    small
                />
                <StatChip
                    label="Status"
                    value={deadlockCount === 0 ? 'Clean' : 'Review Needed'}
                    color={deadlockCount === 0 ? THEME.success : THEME.warning}
                    icon={CheckCircle}
                    small
                />
            </div>

            {deadlockCount === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
                    <EmptyState icon={CheckCircle} text="No deadlocks detected (since last stats reset)" />
                </div>
            ) : (
                <div
                    style={{
                        padding: 16,
                        borderRadius: 20,
                        background: `${THEME.danger}06`,
                        border: `1px solid ${THEME.danger}15`,
                    }}
                >
                    <div style={{ fontSize: 12, color: THEME.textMuted, lineHeight: 1.6 }}>
                        <span style={{ color: THEME.danger, fontWeight: 700 }}>{deadlockCount} deadlock(s)</span>{' '}
                        detected since the last statistics reset. PostgreSQL resolves deadlocks by aborting one of the
                        transactions involved.
                    </div>
                    <div style={{ fontSize: 10, color: THEME.textDim, marginTop: 10, lineHeight: 1.6 }}>
                        <span style={{ color: THEME.primary, fontWeight: 700 }}>Tip:</span> Enable{' '}
                        <code style={{ color: THEME.primary }}>log_lock_waits = on</code> and check PostgreSQL server
                        logs for detailed deadlock information including the exact queries and PIDs involved.
                    </div>
                </div>
            )}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   GENERIC VS CUSTOM PLAN RATIO  ★ NEW
   ═══════════════════════════════════════════════════════════════════════════ */
const GenericCustomPlanPanel = ({ slowQueries, settings }) => {
    const planCacheMode = settings?.plan_cache_mode || 'auto';

    const planData = useMemo(() => {
        // Real data: show actual slow query stats; generic/custom plan split requires PG 16+ columns
        const stmts = (slowQueries || []).slice(0, 10).map((q, i) => {
            const calls = Number(q.calls || 0);
            const meanMs = Math.round(Number(q.mean_time_ms || 0));
            const stddevMs = Math.round(Number(q.stddev_ms || 0));
            const highVariance = stddevMs > meanMs * 0.5;
            return {
                id: i,
                query: q.query?.substring(0, 40) + '…' || `stmt_${i}`,
                calls,
                meanMs,
                stddevMs,
                totalMs: Math.round(Number(q.total_time_ms || 0)),
                healthy: !highVariance,
                concern: highVariance ? 'High variance — may benefit from force_custom_plan' : null,
            };
        });

        return { stmts };
    }, [slowQueries]);

    const unhealthyCount = planData.stmts.filter((s) => !s.healthy).length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22 }}>
                {[
                    { label: 'Statements', value: planData.stmts.length, color: THEME.primary, icon: FileCog },
                    {
                        label: 'High Variance',
                        value: unhealthyCount,
                        color: unhealthyCount > 0 ? THEME.warning : THEME.textDim,
                        icon: AlertTriangle,
                    },
                    { label: 'plan_cache_mode', value: planCacheMode, color: THEME.textMuted, icon: SlidersHorizontal },
                ].map((s, i) => (
                    <StatChip key={i} {...s} small />
                ))}
            </div>

            {/* Per-statement breakdown */}
            {planData.stmts.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                    <EmptyState icon={FileCog} text="No slow statements found in pg_stat_statements" />
                </div>
            ) : (
                <div style={{ borderRadius: 20, border: `1px solid ${THEME.grid}40`, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: `${THEME.grid}15` }}>
                                {['Statement', 'Calls', 'Mean', 'Stddev', 'Total', 'Status'].map((h, i) => (
                                    <th
                                        key={h}
                                        style={{
                                            padding: '20px 24px',
                                            textAlign: i === 0 ? 'left' : 'center',
                                            fontSize: 9,
                                            fontWeight: 700,
                                            color: THEME.textDim,
                                            letterSpacing: '0.02em',
                                            borderBottom: `1px solid ${THEME.grid}40`,
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {planData.stmts.map((s, i) => (
                                <tr
                                    key={i}
                                    className="perf-row-hover"
                                    style={{ borderBottom: `1px solid ${THEME.grid}20` }}
                                >
                                    <td style={{ padding: '20px 24px', maxWidth: 200 }}>
                                        <span
                                            style={{
                                                fontSize: 10,
                                                fontFamily: THEME.fontMono,
                                                color: THEME.textMuted,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                display: 'block',
                                            }}
                                        >
                                            {s.query}
                                        </span>
                                    </td>
                                    <td
                                        style={{
                                            padding: '20px 24px',
                                            textAlign: 'center',
                                            fontSize: 11,
                                            color: THEME.primary,
                                            fontVariantNumeric: 'tabular-nums',
                                            fontWeight: 600,
                                        }}
                                    >
                                        {s.calls.toLocaleString()}
                                    </td>
                                    <td
                                        style={{
                                            padding: '20px 24px',
                                            textAlign: 'center',
                                            fontSize: 11,
                                            fontVariantNumeric: 'tabular-nums',
                                            color: THEME.warning,
                                            fontWeight: 600,
                                        }}
                                    >
                                        {s.meanMs}ms
                                    </td>
                                    <td
                                        style={{
                                            padding: '20px 24px',
                                            textAlign: 'center',
                                            fontSize: 11,
                                            fontVariantNumeric: 'tabular-nums',
                                            color: THEME.textMuted,
                                        }}
                                    >
                                        {s.stddevMs}ms
                                    </td>
                                    <td
                                        style={{
                                            padding: '20px 24px',
                                            textAlign: 'center',
                                            fontSize: 11,
                                            fontVariantNumeric: 'tabular-nums',
                                            color: THEME.textMuted,
                                        }}
                                    >
                                        {(s.totalMs / 1000).toFixed(1)}s
                                    </td>
                                    <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                                        {s.concern ? (
                                            <span
                                                title={s.concern}
                                                style={{
                                                    fontSize: 9,
                                                    padding: '2px 7px',
                                                    borderRadius: 18,
                                                    background: `${THEME.warning}12`,
                                                    color: THEME.warning,
                                                    border: `1px solid ${THEME.warning}20`,
                                                    fontWeight: 700,
                                                    cursor: 'help',
                                                }}
                                            >
                                                ⚠ Review
                                            </span>
                                        ) : (
                                            <span
                                                style={{
                                                    fontSize: 9,
                                                    padding: '2px 7px',
                                                    borderRadius: 18,
                                                    background: `${THEME.success}10`,
                                                    color: THEME.success,
                                                    border: `1px solid ${THEME.success}20`,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                ✓ OK
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <div
                style={{
                    fontSize: 10,
                    color: THEME.textDim,
                    lineHeight: 1.6,
                    padding: '6px 10px',
                    background: `${THEME.grid}15`,
                    borderRadius: 18,
                }}
            >
                <span style={{ color: THEME.primary, fontWeight: 700 }}>High variance</span> queries (stddev {'>'} 50%
                of mean) may benefit from{' '}
                <code style={{ color: THEME.primary }}>plan_cache_mode = force_custom_plan</code>. Generic vs custom
                plan split requires PostgreSQL 16+ pg_stat_statements columns.
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   TEMP FILE USAGE TRACKER  ★ NEW
   ═══════════════════════════════════════════════════════════════════════════ */
const TempFileTracker = ({ slowQueries, dbStats, settings }) => {
    const tempData = useMemo(() => {
        // Use real temp_blks_read/written from pg_stat_statements
        const queries = (slowQueries || [])
            .filter((q) => Number(q.temp_blks_read || 0) + Number(q.temp_blks_written || 0) > 0)
            .slice(0, 8)
            .map((q) => ({
                ...q,
                tempBlksRead: Number(q.temp_blks_read || 0),
                tempBlksWritten: Number(q.temp_blks_written || 0),
                tempSizeKB: Math.round((Number(q.temp_blks_read || 0) + Number(q.temp_blks_written || 0)) * 8), // 8KB per block
            }));
        return { queries };
    }, [slowQueries]);

    const totalSizeKB = tempData.queries.reduce((s, q) => s + q.tempSizeKB, 0);
    const dbTempFiles = Number(dbStats?.temp_files || 0);
    const dbTempBytes = Number(dbStats?.temp_bytes || 0);
    const workMem = settings?.work_mem || '—';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 22 }}>
                {[
                    {
                        label: 'DB Temp Files',
                        value: dbTempFiles.toLocaleString(),
                        color: dbTempFiles > 0 ? THEME.warning : THEME.textDim,
                        icon: HardDrive,
                    },
                    {
                        label: 'DB Temp Bytes',
                        value:
                            dbTempBytes > 1048576
                                ? `${(dbTempBytes / 1048576).toFixed(1)} MB`
                                : `${Math.round(dbTempBytes / 1024)} KB`,
                        color: dbTempBytes > 0 ? THEME.danger : THEME.textDim,
                        icon: Disc,
                    },
                    {
                        label: 'Queries Spilling',
                        value: tempData.queries.length,
                        color: tempData.queries.length > 0 ? THEME.warning : THEME.textDim,
                        icon: Falling,
                    },
                    { label: 'work_mem', value: workMem, color: THEME.primary, icon: Zap },
                ].map((s, i) => (
                    <StatChip key={i} {...s} small />
                ))}
            </div>

            {/* Top offenders from pg_stat_statements */}
            {tempData.queries.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                    <EmptyState icon={CheckCircle} text="No queries using temp files detected in pg_stat_statements" />
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: THEME.textDim, letterSpacing: '0.02em' }}>
                        Queries Using Temp Blocks
                    </div>
                    {tempData.queries.map((q, i) => {
                        const sizeMB = (q.tempSizeKB / 1024).toFixed(1);
                        const sizeColor =
                            q.tempSizeKB > 32768 ? THEME.danger : q.tempSizeKB > 8192 ? THEME.warning : THEME.textDim;
                        return (
                            <div
                                key={i}
                                style={{
                                    padding: '22px 28px',
                                    borderRadius: 20,
                                    background: `${sizeColor}04`,
                                    border: `1px solid ${sizeColor}15`,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                fontFamily: THEME.fontMono,
                                                color: THEME.textMuted,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                marginBottom: 6,
                                            }}
                                        >
                                            {q.query}
                                        </div>
                                        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: 10, color: THEME.textDim }}>
                                                Reads:{' '}
                                                <span style={{ fontWeight: 700, color: THEME.warning }}>
                                                    {q.tempBlksRead} blks
                                                </span>
                                            </span>
                                            <span style={{ fontSize: 10, color: THEME.textDim }}>
                                                Writes:{' '}
                                                <span style={{ fontWeight: 700, color: THEME.danger }}>
                                                    {q.tempBlksWritten} blks
                                                </span>
                                            </span>
                                            <span style={{ fontSize: 10, color: THEME.textDim }}>
                                                Est. Size:{' '}
                                                <span style={{ fontWeight: 700, color: sizeColor }}>{sizeMB} MB</span>
                                            </span>
                                            <span style={{ fontSize: 10, color: THEME.textDim }}>
                                                Calls:{' '}
                                                <span style={{ fontWeight: 700, color: THEME.textMuted }}>
                                                    {Number(q.calls || 0).toLocaleString()}
                                                </span>
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ flexShrink: 0, width: 80 }}>
                                        <SeverityBar
                                            value={q.tempSizeKB}
                                            max={Math.max(...tempData.queries.map((x) => x.tempSizeKB), 1)}
                                            color={sizeColor}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            <div
                style={{
                    fontSize: 10,
                    color: THEME.textDim,
                    lineHeight: 1.6,
                    padding: '8px 10px',
                    borderRadius: 18,
                    background: `${THEME.primary}06`,
                    border: `1px solid ${THEME.primary}12`,
                }}
            >
                <span style={{ color: THEME.primary, fontWeight: 700 }}>Fix:</span> Increase{' '}
                <code style={{ color: THEME.primary }}>work_mem</code> for sessions running large sorts/hashes. Use{' '}
                <code style={{ color: THEME.primary }}>SET work_mem = '64MB'</code> per-session rather than globally to
                avoid OOM. Enable <code style={{ color: THEME.primary }}>log_temp_files = 0</code> to track all temp
                file creation in the server log.
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   GANTT CHART
   ═══════════════════════════════════════════════════════════════════════════ */
const GanttChart = ({ queries }) => {
    const now = Date.now();
    const ganttData = queries.slice(0, 8).map((q, i) => {
        const dur = Number(q.mean_time_ms || 0);
        // Spread queries across the timeline proportionally based on their execution time
        const start = now - dur - (queries.length - i) * 100;
        return { ...q, start, end: start + dur, duration: dur, lane: i };
    });
    const minTime = Math.min(...ganttData.map((d) => d.start));
    const maxTime = Math.max(...ganttData.map((d) => d.end));
    const totalSpan = maxTime - minTime || 1;

    return (
        <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 500 }}>
                <div style={{ display: 'flex', marginLeft: 180, marginBottom: 6 }}>
                    {[0, 25, 50, 75, 100].map((pct) => (
                        <div
                            key={pct}
                            style={{
                                flex: pct === 100 ? 0 : 1,
                                fontSize: 9,
                                color: THEME.textDim,
                                textAlign: 'left',
                                borderLeft: `1px dashed ${THEME.grid}40`,
                                paddingLeft: 3,
                            }}
                        >
                            {Math.round((totalSpan * pct) / 100)}ms
                        </div>
                    ))}
                </div>
                {ganttData.map((row, i) => {
                    const left = ((row.start - minTime) / totalSpan) * 100;
                    const width = Math.max((row.duration / totalSpan) * 100, 0.5);
                    const color =
                        row.duration > 5000 ? THEME.danger : row.duration > 1000 ? THEME.warning : THEME.primary;
                    return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 6 }}>
                            <div
                                style={{
                                    minWidth: 170,
                                    flex: 'none',
                                    fontSize: 10,
                                    color: THEME.textDim,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                    fontFamily: THEME.fontMono,
                                    textAlign: 'right',
                                }}
                            >
                                {row.query?.substring(0, 24) || `Query ${i + 1}`}…
                            </div>
                            <div
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    height: 22,
                                    background: `${THEME.grid}20`,
                                    borderRadius: 18,
                                    position: 'relative',
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{
                                        position: 'absolute',
                                        left: `${left}%`,
                                        width: `${width}%`,
                                        height: '100%',
                                        background: `linear-gradient(90deg, ${color}80, ${color})`,
                                        borderRadius: 18,
                                        minWidth: 4,
                                        animationDelay: `${i * 0.05}s`,
                                    }}
                                />
                                <div
                                    style={{
                                        position: 'absolute',
                                        right: 4,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        fontSize: 9,
                                        color: THEME.textDim,
                                        fontVariantNumeric: 'tabular-nums',
                                        pointerEvents: 'none',
                                    }}
                                >
                                    {row.duration.toFixed(0)}ms
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
   LOCK WAIT DETAILS (original panel, kept)
   ═══════════════════════════════════════════════════════════════════════════ */
const LockWaitDetails = ({ lockBlocking }) => {
    const waitChains = useMemo(() => {
        // Use real lock blocking data from the API
        if (!lockBlocking?.length) return [];
        return lockBlocking.map((row, i) => ({
            waiter: {
                pid: row.blocked_pid,
                query: row.blocked_query || '',
                waitTime: row.wait_sec ? `${row.wait_sec}s` : '',
            },
            holder: {
                pid: row.blocking_pid,
                query: row.blocking_query || '',
                application_name: row.blocking_app || '',
            },
            lockType: row.wait_event || 'Lock',
            relation: '',
        }));
    }, [lockBlocking]);

    if (!waitChains.length)
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                <EmptyState icon={Lock} text="No lock waits detected" />
            </div>
        );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {waitChains.map((chain, i) => (
                <div
                    key={i}
                    style={{
                        padding: 14,
                        borderRadius: 20,
                        background: `${THEME.danger}05`,
                        border: `1px solid ${THEME.danger}15`,
                    }}
                >
                    <div
                        style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: THEME.textDim,
                            letterSpacing: '0.02em',
                            marginBottom: 10,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <span
                            style={{
                                padding: '2px 8px',
                                borderRadius: 18,
                                background: `${THEME.danger}15`,
                                color: THEME.danger,
                                border: `1px solid ${THEME.danger}20`,
                            }}
                        >
                            {chain.lockType}
                        </span>
                        <span>
                            on{' '}
                            <span style={{ color: THEME.primary, fontFamily: THEME.fontMono }}>{chain.relation}</span>
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                        <div
                            style={{
                                flex: 1,
                                minWidth: 0,
                                padding: '20px 24px',
                                borderRadius: 20,
                                background: `${THEME.danger}08`,
                                border: `1px solid ${THEME.danger}15`,
                            }}
                        >
                            <div style={{ fontSize: 10, color: THEME.danger, fontWeight: 700, marginBottom: 4 }}>
                                WAITING — PID {chain.waiter.pid} ({chain.waiter.waitTime})
                            </div>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: THEME.textMuted,
                                    fontFamily: THEME.fontMono,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {chain.waiter.query}
                            </div>
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 2,
                                flexShrink: 0,
                            }}
                        >
                            <ArrowRight size={14} color={THEME.warning} />
                            <span style={{ fontSize: 9, color: THEME.textDim }}>blocked by</span>
                        </div>
                        <div
                            style={{
                                flex: 1,
                                minWidth: 0,
                                padding: '20px 24px',
                                borderRadius: 20,
                                background: `${THEME.warning}08`,
                                border: `1px solid ${THEME.warning}15`,
                            }}
                        >
                            <div style={{ fontSize: 10, color: THEME.warning, fontWeight: 700, marginBottom: 4 }}>
                                HOLDING — PID {chain.holder.pid} ({chain.holder.application_name || 'app'})
                            </div>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: THEME.textMuted,
                                    fontFamily: THEME.fontMono,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {chain.holder.query || ''}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   KILL QUERY MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
const KillQueryModal = ({ query, onConfirm, onClose }) => {
    const [reason, setReason] = useState('');
    const [killing, setKilling] = useState(false);
    const reasons = [
        'Blocking other queries',
        'Consuming excessive resources',
        'Runaway query / no end condition',
        'User requested termination',
        'Maintenance window',
    ];

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(2,6,23,0.88)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1100,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: 480,
                    background: THEME.surface,
                    border: `1px solid ${THEME.danger}30`,
                    borderRadius: 18,
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        padding: '22px 28px',
                        borderBottom: `1px solid ${THEME.glassBorder}`,
                        background: THEME.surface,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 18,
                    }}
                >
                    <div
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 20,
                            background: `${THEME.danger}15`,
                            border: `1px solid ${THEME.danger}25`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <XCircle size={18} color={THEME.danger} />
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: THEME.textMain }}>Terminate Query</div>
                        <div style={{ fontSize: 11, color: THEME.textMuted }}>
                            PID {query.pid || '—'} · This action cannot be undone
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            marginLeft: 'auto',
                            background: 'transparent',
                            border: 'none',
                            color: THEME.textDim,
                            cursor: 'pointer',
                            padding: 4,
                        }}
                    >
                        <X size={16} />
                    </button>
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 22 }}>
                    <div
                        style={{
                            padding: 12,
                            borderRadius: 20,
                            background: THEME.bg,
                            border: `1px solid ${THEME.grid}40`,
                            fontFamily: THEME.fontMono,
                            fontSize: 11,
                            color: THEME.textMuted,
                            maxHeight: 80,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {query.query?.substring(0, 120)}…
                    </div>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: THEME.textDim, marginBottom: 8 }}>
                            Reason for termination
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {reasons.map((r) => (
                                <div
                                    key={r}
                                    onClick={() => setReason(r)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 20,
                                        padding: '20px 24px',
                                        borderRadius: 18,
                                        cursor: 'pointer',
                                        background: reason === r ? `${THEME.danger}10` : 'transparent',
                                        border: `1px solid ${reason === r ? `${THEME.danger}25` : `${THEME.grid}30`}`,
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 14,
                                            height: 14,
                                            borderRadius: '50%',
                                            border: `2px solid ${reason === r ? THEME.danger : THEME.grid}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}
                                    >
                                        {reason === r && (
                                            <div
                                                style={{
                                                    width: 6,
                                                    height: 6,
                                                    borderRadius: '50%',
                                                    background: THEME.danger,
                                                }}
                                            />
                                        )}
                                    </div>
                                    <span
                                        style={{ fontSize: 12, color: reason === r ? THEME.textMain : THEME.textMuted }}
                                    >
                                        {r}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 20 }}>
                        <button
                            onClick={onClose}
                            style={{
                                flex: 1,
                                minWidth: 0,
                                padding: '10px',
                                borderRadius: 20,
                                border: `1px solid ${THEME.glassBorder}`,
                                background: 'transparent',
                                color: THEME.textMuted,
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: 12,
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            disabled={!reason || killing}
                            onClick={() => {
                                setKilling(true);
                                setTimeout(() => {
                                    onConfirm(query, reason);
                                    onClose();
                                }, 1000);
                            }}
                            style={{
                                flex: 1,
                                minWidth: 0,
                                padding: '10px',
                                borderRadius: 20,
                                border: 'none',
                                background: killing ? `${THEME.danger}50` : `${THEME.danger}`,
                                color: '#fff',
                                cursor: reason ? 'pointer' : 'not-allowed',
                                fontWeight: 700,
                                fontSize: 12,
                                opacity: !reason ? 0.5 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                            }}
                        >
                            {killing ? <RotateCcw size={13} className="perf-spin" /> : <XCircle size={13} />}
                            {killing ? 'Terminating…' : 'Terminate Query'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   QUERY ANALYSIS MODAL (enhanced with plan tree, trends, tags, kill)
   ═══════════════════════════════════════════════════════════════════════════ */
const QueryAnalysisModal = ({ queryData, onClose, onApply, onKill, tags, onTag }) => {
    const [isApplying, setIsApplying] = useState(false);
    const [applied, setApplied] = useState(false);
    const [activePanel, setActivePanel] = useState('diff');
    const [showKillModal, setShowKillModal] = useState(false);
    const opt = generateOptimization(queryData.query);
    const explainTree = generateExplainTree(queryData.query);
    const currentTag = tags?.[queryData.id];

    /* No historical trend data available from pg_stat_statements — show single current point */
    const meanMs = Number(queryData.mean_time_ms) || 0;
    const totalCalls = Number(queryData.calls) || 0;
    const trendData = [{ t: 'Current', ms: meanMs, calls: totalCalls }];

    const handleApply = () => {
        setIsApplying(true);
        setTimeout(() => {
            setIsApplying(false);
            setApplied(true);
            onApply(queryData.id);
            setTimeout(() => onClose(), 1200);
        }, 1500);
    };

    const panels = [
        { id: 'diff', label: 'Query Diff', icon: GitBranch },
        { id: 'plan', label: 'Plan Tree', icon: Workflow },
        { id: 'trends', label: 'Trends', icon: TrendingUp },
    ];

    return (
        <>
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(2,6,23,0.88)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                }}
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        width: '94%',
                        maxWidth: 1100,
                        maxHeight: '90vh',
                        background: THEME.surface,
                        border: `1px solid ${THEME.glassBorder}`,
                        borderRadius: 18,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            padding: '16px 24px',
                            borderBottom: `1px solid ${THEME.glassBorder}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: THEME.surface,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                            <div
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: `${THEME.danger}15`,
                                    border: `1px solid ${THEME.danger}25`,
                                }}
                            >
                                <AlertTriangle size={18} color={THEME.danger} />
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
                                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: THEME.textMain }}>
                                        Slow Query Detected
                                    </h3>
                                    <SeverityTag ms={queryData.mean_time_ms} />
                                    {currentTag && (
                                        <span
                                            style={{
                                                fontSize: 9,
                                                fontWeight: 700,
                                                padding: '3px 8px',
                                                borderRadius: 18,
                                                background:
                                                    currentTag === 'known-slow'
                                                        ? `${THEME.warning}15`
                                                        : `${THEME.success}12`,
                                                color: currentTag === 'known-slow' ? THEME.warning : THEME.success,
                                                border: `1px solid ${currentTag === 'known-slow' ? `${THEME.warning}25` : `${THEME.success}20`}`,
                                            }}
                                        >
                                            {currentTag === 'known-slow' ? '⚑ KNOWN SLOW' : '✓ ACCEPTABLE'}
                                        </span>
                                    )}
                                </div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: THEME.textMuted,
                                        marginTop: 2,
                                        display: 'flex',
                                        gap: 18,
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <span>
                                        PID{' '}
                                        <span
                                            style={{
                                                color: THEME.textMain,
                                                fontWeight: 600,
                                                fontFamily: THEME.fontMono,
                                            }}
                                        >
                                            {queryData.pid || '—'}
                                        </span>
                                    </span>
                                    <span>
                                        Duration{' '}
                                        <span style={{ color: THEME.danger, fontWeight: 600 }}>
                                            {Number(queryData.mean_time_ms).toFixed(1)}ms
                                        </span>
                                    </span>
                                    <span>
                                        Cache Hit{' '}
                                        <span style={{ color: THEME.success, fontWeight: 600 }}>
                                            {queryData.cache_hit_pct || '—'}%
                                        </span>
                                    </span>
                                    <span>
                                        Temp Files{' '}
                                        <span
                                            style={{
                                                color: queryData.tempFiles > 0 ? THEME.warning : THEME.textDim,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {queryData.tempFiles || 0}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                            <button
                                className="tag-btn"
                                onClick={() => onTag(queryData.id, currentTag === 'known-slow' ? null : 'known-slow')}
                                style={{
                                    padding: '5px 12px',
                                    borderRadius: 18,
                                    border: `1px solid ${THEME.warning}30`,
                                    background: currentTag === 'known-slow' ? `${THEME.warning}15` : 'transparent',
                                    color: currentTag === 'known-slow' ? THEME.warning : THEME.textDim,
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                }}
                            >
                                <Tag size={11} /> Known Slow
                            </button>
                            <button
                                className="tag-btn"
                                onClick={() => onTag(queryData.id, currentTag === 'acceptable' ? null : 'acceptable')}
                                style={{
                                    padding: '5px 12px',
                                    borderRadius: 18,
                                    border: `1px solid ${THEME.success}30`,
                                    background: currentTag === 'acceptable' ? `${THEME.success}12` : 'transparent',
                                    color: currentTag === 'acceptable' ? THEME.success : THEME.textDim,
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                }}
                            >
                                <CheckCircle size={11} /> Acceptable
                            </button>
                            <button
                                onClick={() => setShowKillModal(true)}
                                style={{
                                    padding: '5px 12px',
                                    borderRadius: 18,
                                    border: `1px solid ${THEME.danger}30`,
                                    background: 'transparent',
                                    color: THEME.danger,
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = `${THEME.danger}15`;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                <XCircle size={11} /> Kill
                            </button>
                            <button
                                onClick={onClose}
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 20,
                                    border: `1px solid ${THEME.glassBorder}`,
                                    background: 'transparent',
                                    color: THEME.textMuted,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = `${THEME.danger}20`;
                                    e.currentTarget.style.color = THEME.danger;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = THEME.textMuted;
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    <div
                        style={{
                            flex: 1,
                            minHeight: 0,
                            display: 'grid',
                            gridTemplateColumns: '1.6fr 1fr',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Left */}
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                borderRight: `1px solid ${THEME.glassBorder}`,
                                overflow: 'hidden',
                            }}
                        >
                            <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${THEME.glassBorder}` }}>
                                {panels.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => setActivePanel(t.id)}
                                        style={{
                                            flex: 1,
                                            minWidth: 0,
                                            padding: '20px 24px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 5,
                                            fontSize: 11,
                                            fontWeight: 600,
                                            background: activePanel === t.id ? `${THEME.primary}10` : 'transparent',
                                            color: activePanel === t.id ? THEME.primary : THEME.textDim,
                                            borderBottom: `2px solid ${activePanel === t.id ? THEME.primary : 'transparent'}`,
                                        }}
                                    >
                                        <t.icon size={12} /> {t.label}
                                    </button>
                                ))}
                            </div>
                            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>
                                {activePanel === 'diff' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                        <div>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    marginBottom: 6,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: 2,
                                                        background: THEME.danger,
                                                    }}
                                                />
                                                <span
                                                    style={{
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        color: THEME.danger,
                                                        letterSpacing: '0.02em',
                                                    }}
                                                >
                                                    Original Query
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    background: `${THEME.danger}06`,
                                                    border: `1px solid ${THEME.danger}18`,
                                                    padding: '18px 22px',
                                                    borderRadius: 20,
                                                    fontFamily: THEME.fontMono,
                                                    fontSize: 12,
                                                    lineHeight: 1.7,
                                                    color: THEME.danger,
                                                    position: 'relative',
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        left: 0,
                                                        top: 0,
                                                        bottom: 0,
                                                        width: 3,
                                                        background: THEME.danger,
                                                        borderRadius: '8px 0 0 8px',
                                                    }}
                                                />
                                                <code
                                                    style={{
                                                        paddingLeft: 8,
                                                        display: 'block',
                                                        whiteSpace: 'pre-wrap',
                                                        wordBreak: 'break-all',
                                                    }}
                                                >
                                                    {queryData.query}
                                                </code>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                                            <div
                                                style={{
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: '50%',
                                                    background: THEME.surface,
                                                    border: `1px solid ${THEME.glassBorder}`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                <ArrowDown size={13} color={THEME.textDim} />
                                            </div>
                                        </div>
                                        <div>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    marginBottom: 6,
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span
                                                        style={{
                                                            width: 8,
                                                            height: 8,
                                                            borderRadius: 2,
                                                            background: THEME.success,
                                                        }}
                                                    />
                                                    <span
                                                        style={{
                                                            fontSize: 10,
                                                            fontWeight: 700,
                                                            color: THEME.success,
                                                            letterSpacing: '0.02em',
                                                        }}
                                                    >
                                                        Optimized
                                                    </span>
                                                </div>
                                                <span
                                                    style={{
                                                        fontSize: 9,
                                                        fontWeight: 700,
                                                        padding: '2px 8px',
                                                        borderRadius: 18,
                                                        background: `${THEME.success}15`,
                                                        color: THEME.success,
                                                        border: `1px solid ${THEME.success}20`,
                                                    }}
                                                >
                                                    {opt.fixType}
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    background: `${THEME.success}06`,
                                                    border: `1px solid ${THEME.success}18`,
                                                    padding: '18px 22px',
                                                    borderRadius: 20,
                                                    fontFamily: THEME.fontMono,
                                                    fontSize: 12,
                                                    lineHeight: 1.7,
                                                    color: THEME.successLight,
                                                    position: 'relative',
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        left: 0,
                                                        top: 0,
                                                        bottom: 0,
                                                        width: 3,
                                                        background: THEME.success,
                                                        borderRadius: '8px 0 0 8px',
                                                    }}
                                                />
                                                <code
                                                    style={{
                                                        paddingLeft: 8,
                                                        display: 'block',
                                                        whiteSpace: 'pre-wrap',
                                                        wordBreak: 'break-all',
                                                    }}
                                                >
                                                    {opt.optimized}
                                                </code>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {activePanel === 'plan' && (
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 10,
                                                fontWeight: 700,
                                                color: THEME.textDim,
                                                letterSpacing: '0.02em',
                                                marginBottom: 14,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6,
                                            }}
                                        >
                                            <Workflow size={10} /> EXPLAIN ANALYZE — Visual Tree
                                            <span
                                                style={{
                                                    marginLeft: 'auto',
                                                    fontSize: 9,
                                                    padding: '2px 8px',
                                                    borderRadius: 18,
                                                    background: `${THEME.primary}10`,
                                                    color: THEME.primary,
                                                    border: `1px solid ${THEME.primary}20`,
                                                }}
                                            >
                                                Cost scale: node bar width
                                            </span>
                                        </div>
                                        {explainTree.map((node) => (
                                            <ExplainTreeNode key={node.id} node={node} maxCost={2845} />
                                        ))}
                                    </div>
                                )}
                                {activePanel === 'trends' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                        <div>
                                            <div
                                                style={{
                                                    fontSize: 10,
                                                    fontWeight: 700,
                                                    color: THEME.textDim,
                                                    letterSpacing: '0.02em',
                                                    marginBottom: 10,
                                                }}
                                            >
                                                Execution Time Trend (last 60min)
                                            </div>
                                            <ResponsiveContainer width="100%" height={140}>
                                                <ComposedChart
                                                    data={trendData}
                                                    margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                                                >
                                                    <CartesianGrid
                                                        stroke={`${THEME.grid}30`}
                                                        strokeDasharray="3 3"
                                                        vertical={false}
                                                    />
                                                    <XAxis
                                                        dataKey="t"
                                                        tick={{ fontSize: 9, fill: THEME.textDim }}
                                                        axisLine={false}
                                                        tickLine={false}
                                                        interval={2}
                                                    />
                                                    <YAxis
                                                        tick={{ fontSize: 9, fill: THEME.textDim }}
                                                        axisLine={false}
                                                        tickLine={false}
                                                    />
                                                    <Tooltip content={<ChartTooltip />} />
                                                    <Area
                                                        type="monotone"
                                                        dataKey="ms"
                                                        stroke={THEME.danger}
                                                        fill="none"
                                                        strokeWidth={2}
                                                    />
                                                    <ReferenceLine
                                                        y={Number(queryData.mean_time_ms)}
                                                        stroke={`${THEME.warning}60`}
                                                        strokeDasharray="4 4"
                                                        label={{
                                                            value: 'avg',
                                                            position: 'right',
                                                            fontSize: 9,
                                                            fill: THEME.warning,
                                                        }}
                                                    />
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div>
                                            <div
                                                style={{
                                                    fontSize: 10,
                                                    fontWeight: 700,
                                                    color: THEME.textDim,
                                                    letterSpacing: '0.02em',
                                                    marginBottom: 10,
                                                }}
                                            >
                                                Call Volume Trend
                                            </div>
                                            <ResponsiveContainer width="100%" height={100}>
                                                <BarChart
                                                    data={trendData}
                                                    margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                                                >
                                                    <XAxis
                                                        dataKey="t"
                                                        tick={{ fontSize: 9, fill: THEME.textDim }}
                                                        axisLine={false}
                                                        tickLine={false}
                                                        interval={2}
                                                    />
                                                    <YAxis
                                                        tick={{ fontSize: 9, fill: THEME.textDim }}
                                                        axisLine={false}
                                                        tickLine={false}
                                                    />
                                                    <Tooltip content={<ChartTooltip />} />
                                                    <Bar
                                                        dataKey="calls"
                                                        fill={THEME.primary}
                                                        opacity={0.7}
                                                        radius={[2, 2, 0, 0]}
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right sidebar */}
                        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div
                                style={{
                                    flex: 1,
                                    minHeight: 0,
                                    overflowY: 'auto',
                                    padding: 16,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 22,
                                }}
                            >
                                <div>
                                    <div
                                        style={{
                                            fontSize: 10,
                                            fontWeight: 700,
                                            color: THEME.textDim,
                                            letterSpacing: '0.02em',
                                            marginBottom: 10,
                                        }}
                                    >
                                        Root Cause
                                    </div>
                                    <div
                                        style={{
                                            display: 'flex',
                                            gap: 22,
                                            padding: 14,
                                            borderRadius: 20,
                                            background: `${THEME.warning}08`,
                                            border: `1px solid ${THEME.warning}15`,
                                        }}
                                    >
                                        <FileSearch
                                            color={THEME.warning}
                                            size={16}
                                            style={{ marginTop: 1, flexShrink: 0 }}
                                        />
                                        <div style={{ fontSize: 12, color: THEME.textMuted, lineHeight: 1.6 }}>
                                            {opt.reason}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <div
                                        style={{
                                            fontSize: 10,
                                            fontWeight: 700,
                                            color: THEME.textDim,
                                            letterSpacing: '0.02em',
                                            marginBottom: 10,
                                        }}
                                    >
                                        Performance Metrics
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                        <StatChip
                                            label="Cache Hit"
                                            value={`${queryData.cache_hit_pct || '—'}%`}
                                            color={THEME.success}
                                            icon={Database}
                                            small
                                        />
                                        <StatChip
                                            label="Temp Files"
                                            value={queryData.tempFiles || 0}
                                            color={queryData.tempFiles > 0 ? THEME.warning : THEME.textDim}
                                            icon={HardDrive}
                                            small
                                        />
                                        <StatChip
                                            label="Category"
                                            value={opt.category}
                                            color={THEME.primary}
                                            icon={Layers}
                                            small
                                        />
                                        <StatChip
                                            label="Impact"
                                            value={opt.improvement}
                                            color={THEME.success}
                                            icon={TrendingUp}
                                            small
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div
                                        style={{
                                            fontSize: 10,
                                            fontWeight: 700,
                                            color: THEME.textDim,
                                            letterSpacing: '0.02em',
                                            marginBottom: 10,
                                        }}
                                    >
                                        Cost Comparison
                                    </div>
                                    <div
                                        style={{
                                            padding: 16,
                                            background: THEME.bg,
                                            borderRadius: 20,
                                            border: `1px solid ${THEME.grid}40`,
                                        }}
                                    >
                                        {[
                                            {
                                                label: 'Before',
                                                value: opt.costBefore,
                                                max: opt.costBefore,
                                                color: THEME.danger,
                                                delay: 0,
                                            },
                                            {
                                                label: 'After',
                                                value: opt.costAfter,
                                                max: opt.costBefore,
                                                color: THEME.success,
                                                delay: 0.3,
                                            },
                                        ].map((bar, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 22,
                                                    marginBottom: i === 0 ? 12 : 14,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        width: 40,
                                                        fontSize: 10,
                                                        color: bar.color,
                                                        fontWeight: 600,
                                                        textAlign: 'right',
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    {bar.label}
                                                </span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <SeverityBar
                                                        value={bar.value}
                                                        max={bar.max}
                                                        color={bar.color}
                                                        delay={bar.delay}
                                                    />
                                                </div>
                                                <span
                                                    style={{
                                                        width: 44,
                                                        fontSize: 12,
                                                        fontWeight: 800,
                                                        color: bar.color,
                                                        textAlign: 'right',
                                                        fontVariantNumeric: 'tabular-nums',
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    {bar.value.toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                        <div style={{ height: 1, background: THEME.grid, margin: '0 0 10px' }} />
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                            }}
                                        >
                                            <span style={{ fontSize: 11, color: THEME.textDim }}>Reduction</span>
                                            <span style={{ fontSize: 18, fontWeight: 800, color: THEME.success }}>
                                                {opt.costBefore > 0
                                                    ? `${((1 - opt.costAfter / opt.costBefore) * 100).toFixed(0)}%`
                                                    : '—'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div
                                style={{
                                    padding: '22px 28px',
                                    borderTop: `1px solid ${THEME.glassBorder}`,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 20,
                                }}
                            >
                                {applied ? (
                                    <div
                                        style={{
                                            padding: 14,
                                            borderRadius: 20,
                                            background: `${THEME.success}15`,
                                            border: `1px solid ${THEME.success}30`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 20,
                                            color: THEME.success,
                                            fontWeight: 700,
                                            fontSize: 12,
                                        }}
                                    >
                                        <CheckCircle size={16} /> Optimization Applied
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            style={{
                                                padding: 11,
                                                borderRadius: 20,
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                                fontSize: 12,
                                                background: 'transparent',
                                                border: `1px solid ${THEME.glassBorder}`,
                                                color: THEME.textMuted,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 6,
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
                                            <Play size={13} /> Test in Sandbox
                                        </button>
                                        <button
                                            onClick={handleApply}
                                            disabled={isApplying}
                                            style={{
                                                padding: 11,
                                                borderRadius: 20,
                                                border: 'none',
                                                cursor: isApplying ? 'wait' : 'pointer',
                                                fontWeight: 700,
                                                fontSize: 12,
                                                color: '#fff',
                                                background: THEME.primary,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 6,
                                                opacity: isApplying ? 0.8 : 1,
                                            }}
                                        >
                                            {isApplying ? (
                                                <RotateCcw size={13} className="perf-spin" />
                                            ) : (
                                                <Sparkles size={13} />
                                            )}
                                            {isApplying ? 'Applying…' : 'Apply Optimization'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {showKillModal && (
                <KillQueryModal query={queryData} onConfirm={onKill} onClose={() => setShowKillModal(false)} />
            )}
        </>
    );
};

/* ── APM plan-node color helper ── */
function apmNodeColor(type: string): string {
    if (/seq scan/i.test(type)) return THEME.danger;
    if (/hash join/i.test(type)) return THEME.warning;
    if (/index/i.test(type)) return THEME.success;
    return THEME.primary;
}

/* ── APM plan tree (module-scope — must not be defined inside render) ── */
function PlanNode({ node, depth = 0 }: { node: any; depth?: number }) {
    const [open, setOpen] = React.useState(depth < 2);
    const children: any[] = node?.Plans ?? [];
    const cost: number | undefined = node?.['Actual Total Time'];
    const rows: number | undefined = node?.['Actual Rows'];
    const type: string = node?.['Node Type'] ?? 'Unknown';
    const nc = apmNodeColor(type);
    const C = THEME;
    return (
        <div style={{ marginLeft: depth * 14 }}>
            <div
                onClick={() => children.length && setOpen((o) => !o)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 6px',
                    borderRadius: 6,
                    cursor: children.length ? 'pointer' : 'default',
                    background: depth === 0 ? `${nc}18` : 'transparent',
                    marginBottom: 2,
                }}
            >
                {children.length > 0 && <span style={{ fontSize: 9, color: C.textDim }}>{open ? '▼' : '▶'}</span>}
                <span
                    style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: nc,
                        fontFamily: THEME.fontMono,
                        padding: '1px 6px',
                        background: `${nc}18`,
                        borderRadius: 4,
                        border: `1px solid ${nc}30`,
                    }}
                >
                    {type}
                </span>
                {node?.['Relation Name'] && (
                    <span style={{ fontSize: 10, color: C.textDim, fontFamily: THEME.fontMono }}>
                        {node['Relation Name']}
                    </span>
                )}
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                    {cost != null && (
                        <span style={{ fontSize: 10, color: cost > 500 ? C.danger : C.textDim }}>
                            {cost.toFixed(1)}ms
                        </span>
                    )}
                    {rows != null && <span style={{ fontSize: 10, color: C.textDim }}>{rows} rows</span>}
                </span>
            </div>
            {open && children.map((child: any, i: number) => <PlanNode key={i} node={child} depth={depth + 1} />)}
        </div>
    );
}

/* ── ApmPanel component (module-scope) ── */
interface ApmPanelProps {
    apmData: { events: any[]; queries: any[] };
    apmLoading: boolean;
    apmError: string | null;
    apmHours: number;
    apmSelectedQuery: any | null;
    setApmHours: (h: number) => void;
    setApmSelectedQuery: (q: any | null) => void;
}
function ApmPanel({
    apmData,
    apmLoading,
    apmError,
    apmHours,
    apmSelectedQuery,
    setApmHours,
    setApmSelectedQuery,
}: ApmPanelProps) {
    const C = THEME;
    const { events, queries } = apmData;
    const sel = apmSelectedQuery;
    const selEvents = sel ? events.filter((e: any) => e.queryId === sel.queryId).slice(0, 50) : [];
    const src = sel ? selEvents : events;
    const buckets = [0, 50, 100, 200, 500, 1000, 2000, 5000];
    const histData = buckets
        .slice(0, -1)
        .map((lo, i) => ({
            label: `${lo}–${buckets[i + 1]}ms`,
            count: src.filter((e: any) => e.durationMs >= lo && e.durationMs < buckets[i + 1]).length,
        }))
        .concat([{ label: '≥5s', count: src.filter((e: any) => e.durationMs >= 5000).length }]);
    const maxCount = Math.max(...histData.map((b) => b.count), 1);
    const planEv = sel && selEvents.length > 0 ? selEvents[0] : null;
    const plan = planEv?.planJson?.Plan ?? planEv?.planJson ?? null;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Workflow size={14} color={C.primary} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.textMain }}>
                        auto_explain APM Correlation
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                    {[1, 6, 12, 24].map((h) => (
                        <button
                            key={h}
                            onClick={() => setApmHours(h)}
                            style={{
                                padding: '3px 10px',
                                borderRadius: 8,
                                fontSize: 11,
                                cursor: 'pointer',
                                background: apmHours === h ? C.primary : C.surfaceRaised,
                                color: apmHours === h ? '#fff' : C.textDim,
                                border: `1px solid ${apmHours === h ? C.primary : C.glassBorder}`,
                                fontWeight: apmHours === h ? 700 : 400,
                            }}
                        >
                            {h}h
                        </button>
                    ))}
                </div>
                {apmLoading && <span style={{ fontSize: 11, color: C.textDim }}>Loading…</span>}
            </div>
            {apmError && (
                <div
                    style={{
                        padding: '10px 14px',
                        background: `${C.danger}12`,
                        borderRadius: 10,
                        border: `1px solid ${C.danger}30`,
                        color: C.danger,
                        fontSize: 12,
                    }}
                >
                    {apmError}
                </div>
            )}
            <GlassCard
                title={`Top Slow Queries — Last ${apmHours}h`}
                rightNode={
                    <span style={{ fontSize: 10, color: C.textDim }}>
                        {queries.length} unique · {events.length} samples
                    </span>
                }
            >
                {queries.length === 0 && !apmLoading ? (
                    <EmptyState
                        icon={Workflow}
                        text="No auto_explain events yet. Enable auto_explain in postgresql.conf, or install the Fathom log shipper."
                    />
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${C.glassBorder}` }}>
                                    {['Query', 'Calls', 'Avg ms', 'P99 ms', 'Max ms'].map((h) => (
                                        <th
                                            key={h}
                                            style={{
                                                padding: '6px 10px',
                                                textAlign: 'left',
                                                fontSize: 10,
                                                fontWeight: 700,
                                                color: C.textDim,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                            }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {queries.slice(0, 10).map((q: any, i: number) => (
                                    <tr
                                        key={i}
                                        onClick={() => setApmSelectedQuery(sel?.queryId === q.queryId ? null : q)}
                                        style={{
                                            cursor: 'pointer',
                                            background: sel?.queryId === q.queryId ? `${C.primary}12` : 'transparent',
                                            borderBottom: `1px solid ${C.glassBorder}20`,
                                        }}
                                    >
                                        <td style={{ padding: '7px 10px', maxWidth: 320 }}>
                                            <span
                                                style={{
                                                    fontFamily: THEME.fontMono,
                                                    fontSize: 11,
                                                    color: C.textMain,
                                                    display: 'block',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    maxWidth: 300,
                                                }}
                                                title={q.statement}
                                            >
                                                {q.statement}
                                            </span>
                                        </td>
                                        <td style={{ padding: '7px 10px', color: C.textDim }}>
                                            {q.callCount?.toLocaleString()}
                                        </td>
                                        <td style={{ padding: '7px 10px' }}>
                                            <span
                                                style={{
                                                    color:
                                                        q.avgDurationMs > 500
                                                            ? C.danger
                                                            : q.avgDurationMs > 200
                                                              ? C.warning
                                                              : C.success,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                {q.avgDurationMs}
                                            </span>
                                        </td>
                                        <td style={{ padding: '7px 10px', color: C.textDim }}>
                                            {q.p99DurationMs ?? '—'}
                                        </td>
                                        <td style={{ padding: '7px 10px', color: C.danger }}>{q.maxDurationMs}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </GlassCard>
            <GlassCard
                title={sel ? `Latency Distribution — Query #${sel.queryId}` : 'Latency Distribution — All Queries'}
            >
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100, padding: '0 4px' }}>
                    {histData.map((b, i) => (
                        <div
                            key={i}
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                        >
                            <div
                                style={{
                                    width: '100%',
                                    height: `${Math.round((b.count / maxCount) * 80)}px`,
                                    background: i >= 4 ? `${C.danger}90` : i >= 2 ? `${C.warning}90` : `${C.success}90`,
                                    borderRadius: '3px 3px 0 0',
                                    minHeight: b.count > 0 ? 4 : 0,
                                    transition: 'height 0.3s ease',
                                }}
                            />
                            <span
                                style={{
                                    fontSize: 9,
                                    color: C.textDim,
                                    whiteSpace: 'nowrap',
                                    transform: 'rotate(-30deg)',
                                    transformOrigin: 'top center',
                                }}
                            >
                                {b.label}
                            </span>
                        </div>
                    ))}
                </div>
            </GlassCard>
            {planEv && (
                <GlassCard
                    title={`EXPLAIN ANALYZE — Most Recent Execution (${planEv.durationMs}ms)`}
                    rightNode={
                        <div style={{ display: 'flex', gap: 12, fontSize: 10, color: C.textDim }}>
                            <span>
                                {planEv.databaseName} · {planEv.userName}
                            </span>
                            <span>{new Date(planEv.capturedAt).toLocaleTimeString()}</span>
                        </div>
                    }
                >
                    {plan ? (
                        <div
                            style={{
                                background: C.surfaceRaised,
                                borderRadius: 8,
                                padding: 12,
                                border: `1px solid ${C.glassBorder}`,
                                maxHeight: 320,
                                overflowY: 'auto',
                            }}
                        >
                            <PlanNode node={plan} depth={0} />
                        </div>
                    ) : (
                        <EmptyState icon={Database} text="No plan JSON available for this event." />
                    )}
                    <div
                        style={{
                            marginTop: 12,
                            padding: '10px 12px',
                            background: C.surfaceRaised,
                            borderRadius: 8,
                            border: `1px solid ${C.glassBorder}`,
                            fontFamily: THEME.fontMono,
                            fontSize: 11,
                            color: C.textDim,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                        }}
                    >
                        {planEv.statement}
                    </div>
                </GlassCard>
            )}
            <GlassCard
                title={sel ? `Recent Executions — Query #${sel.queryId}` : 'Recent Executions (All Queries)'}
                rightNode={<span style={{ fontSize: 10, color: C.textDim }}>{src.length} events</span>}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 260, overflowY: 'auto' }}>
                    {src.slice(0, 30).map((ev: any, i: number) => (
                        <div
                            key={i}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '5px 8px',
                                borderRadius: 6,
                                background: i % 2 === 0 ? `${C.surfaceRaised}60` : 'transparent',
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    minWidth: 52,
                                    textAlign: 'right',
                                    color: ev.durationMs > 500 ? C.danger : ev.durationMs > 200 ? C.warning : C.success,
                                }}
                            >
                                {ev.durationMs}ms
                            </span>
                            <span
                                style={{
                                    flex: 1,
                                    fontSize: 11,
                                    color: C.textDim,
                                    fontFamily: THEME.fontMono,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                                title={ev.statement}
                            >
                                {ev.statement}
                            </span>
                            <span style={{ fontSize: 10, color: C.textDim, whiteSpace: 'nowrap' }}>
                                {ev.application}
                            </span>
                            <span style={{ fontSize: 10, color: C.textDim, whiteSpace: 'nowrap' }}>
                                {new Date(ev.capturedAt).toLocaleTimeString()}
                            </span>
                        </div>
                    ))}
                </div>
            </GlassCard>
        </div>
    );
}

/* ── Module-scope tab/metric components (must NOT be defined inside render) ── */
const ViewTab = ({ id, label, icon: Icon, badge, activeView, setActiveView }) => {
    const active = activeView === id;
    return (
        <button
            onClick={() => setActiveView(id)}
            style={{
                padding: '10px 22px',
                borderRadius: 22,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 700,
                fontSize: 12,
                lineHeight: 1,
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
                background: active ? `linear-gradient(135deg, ${THEME.primary}, ${THEME.primary}cc)` : THEME.surface,
                color: active ? '#fff' : THEME.textMuted,
                border: active ? `1px solid ${THEME.primary}` : `1px solid ${THEME.glassBorder}`,
                boxShadow: active ? `0 4px 14px ${THEME.primary}35` : 'none',
                transition: 'all 0.2s ease',
                position: 'relative',
            }}
        >
            <Icon size={14} style={{ flexShrink: 0 }} /> {label}
            {badge && (
                <span
                    style={{
                        fontSize: 9,
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: 20,
                        background: active ? 'rgba(255,255,255,0.25)' : `${THEME.warning}20`,
                        color: active ? '#fff' : THEME.warning,
                        border: active ? '1px solid rgba(255,255,255,0.3)' : `1px solid ${THEME.warning}30`,
                        marginLeft: 2,
                    }}
                >
                    {badge}
                </span>
            )}
        </button>
    );
};

const SubViewTab = ({ id, label, icon: Icon, stateKey, setState, badge }) => {
    const active = stateKey === id;
    return (
        <button
            onClick={() => setState(id)}
            style={{
                padding: '7px 16px',
                borderRadius: 20,
                border: `1px solid ${active ? THEME.primary + '50' : THEME.glassBorder}`,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
                fontSize: 11,
                background: active ? `${THEME.primary}15` : 'transparent',
                color: active ? THEME.primary : THEME.textMuted,
                whiteSpace: 'nowrap',
                transition: 'all 0.18s ease',
                boxShadow: active ? `0 2px 8px ${THEME.primary}20` : 'none',
            }}
        >
            <Icon size={12} /> {label}
            {badge && (
                <span
                    style={{
                        fontSize: 8,
                        fontWeight: 800,
                        padding: '1px 5px',
                        borderRadius: 20,
                        background: `${THEME.danger}15`,
                        color: THEME.danger,
                        border: `1px solid ${THEME.danger}25`,
                    }}
                >
                    {badge}
                </span>
            )}
        </button>
    );
};

const SessionMetric = ({ icon: Icon, title, value, color, filterKey, sessionFilter, setSessionFilter }) => {
    const isActive = sessionFilter === filterKey;
    return (
        <div
            onClick={() => setSessionFilter(filterKey)}
            style={{
                cursor: 'pointer',
                padding: '18px 20px',
                borderRadius: 18,
                background: isActive ? `${color}10` : THEME.surface,
                border: `1px solid ${isActive ? color + '40' : THEME.glassBorder}`,
                borderTop: `2px solid ${isActive ? color : color + '50'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                position: 'relative',
                overflow: 'hidden',
                minHeight: 110,
                boxShadow: isActive ? `0 4px 16px ${color}20` : 'none',
                transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
                if (!isActive) {
                    e.currentTarget.style.borderColor = `${color}30`;
                    e.currentTarget.style.background = `${color}06`;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = `0 4px 16px ${color}15`;
                }
            }}
            onMouseLeave={(e) => {
                if (!isActive) {
                    e.currentTarget.style.borderColor = THEME.glassBorder;
                    e.currentTarget.style.background = THEME.surface;
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                }
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: `linear-gradient(135deg, ${color}25, ${color}10)`,
                        border: `1px solid ${color}25`,
                        boxShadow: `0 2px 8px ${color}20`,
                    }}
                >
                    <Icon size={17} color={color} />
                </div>
                <div
                    style={{
                        fontSize: 10,
                        color: THEME.textMuted,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                    }}
                >
                    {title}
                </div>
            </div>
            <div
                style={{
                    fontSize: 32,
                    fontWeight: 800,
                    color: metricValue(color),
                    letterSpacing: '-0.03em',
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                }}
            >
                <AnimValue value={value} />
            </div>
        </div>
    );
};

const HealthMetricCard = ({ title, value, unit, icon: Icon, color, trend, detail }) => (
    <div
        style={{
            padding: 20,
            borderRadius: 16,
            background: THEME.surface,
            border: `1px solid ${THEME.glassBorder}`,
            borderTop: `2px solid ${color}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            boxShadow: `0 2px 12px rgba(0,0,0,0.06)`,
            transition: 'all 0.2s ease',
            cursor: 'default',
        }}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                    style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: `linear-gradient(135deg, ${color}22, ${color}0e)`,
                        border: `1px solid ${color}25`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: `0 2px 6px ${color}20`,
                    }}
                >
                    <Icon size={15} color={color} />
                </div>
                <span
                    style={{
                        fontSize: 11,
                        color: THEME.textMuted,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                    }}
                >
                    {title}
                </span>
            </div>
            {trend !== undefined && (
                <span
                    style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: trend > 0 ? THEME.danger : THEME.success,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                    }}
                >
                    {trend > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {Math.abs(trend)}%
                </span>
            )}
        </div>
        <div
            style={{
                fontSize: 30,
                fontWeight: 800,
                color: metricValue(color),
                letterSpacing: '-0.03em',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
            }}
        >
            {value}
            <span style={{ fontSize: 12, fontWeight: 500, color: THEME.textMuted, marginLeft: 4 }}>{unit}</span>
        </div>
        {detail && <div style={{ fontSize: 10, color: THEME.textDim, marginTop: 2 }}>{detail}</div>}
    </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
const PerformanceTab = () => {
    useAdaptiveTheme();
    const [activeView, setActiveView] = useState('activity');
    const [selectedQuery, setSelectedQuery] = useState(null);
    const [sessionFilter, setSessionFilter] = useState(null);
    const _perfCached = useMemo(() => readTabCache('performance'), []);
    const [data, setData] = useState(_perfCached ?? null);
    const [loading, setLoading] = useState(!_perfCached);

    const [queryTags, setQueryTags] = useState({});
    const [bookmarkedQueries, setBookmarkedQueries] = useState(new Set());
    const [queryGroupMode, setQueryGroupMode] = useState(false);
    const [activitySubView, setActivitySubView] = useState('queries');
    const [filterUser, setFilterUser] = useState('');
    const [filterDb, setFilterDb] = useState('');
    const [filterApp, setFilterApp] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [killedQueries, setKilledQueries] = useState(new Set());

    // Health sub-state
    const [healthSubView, setHealthSubView] = useState('overview');
    // auto_explain APM state
    const [apmData, setApmData] = useState<{ events: any[]; queries: any[] }>({ events: [], queries: [] });
    const [apmLoading, setApmLoading] = useState(false);
    const [apmError, setApmError] = useState<string | null>(null);
    const [apmSelectedQuery, setApmSelectedQuery] = useState<any | null>(null);
    const [apmHours, setApmHours] = useState(6);
    const [insightsSubView, setInsightsSubView] = useState('wait_events');

    useEffect(() => {
        const load = async () => {
            try {
                // Use allSettled so a single failing endpoint never blanks the tab
                const [statsRes, connsRes, locksRes, ioRes, replRes, deepRes] = await Promise.allSettled([
                    fetchData('/api/performance/stats'),
                    fetchData('/api/reliability/active-connections'),
                    fetchData('/api/reliability/locks'),
                    fetchData('/api/performance/table-io'),
                    fetchData('/api/reliability/replication'),
                    fetchData('/api/performance/deep-stats'),
                ]);
                const val = (r) => (r.status === 'fulfilled' ? r.value : null);
                const fresh = {
                    stats: val(statsRes) || { available: false, slowQueries: [] },
                    conns: val(connsRes) || [],
                    locks: val(locksRes) || [],
                    io: val(ioRes) || [],
                    repl: val(replRes) || [],
                    deep: val(deepRes) || {
                        waitEvents: [],
                        waitEventTypes: [],
                        lockBlocking: [],
                        dbStats: {},
                        slowQueries: [],
                        locks: [],
                        settings: {},
                        bgwriter: {},
                    },
                };
                setData(fresh);
                writeTabCache('performance', undefined, fresh);
            } catch (e) {
                setData({
                    stats: { available: false, slowQueries: [] },
                    conns: [],
                    locks: [],
                    io: [],
                    repl: [],
                    deep: {
                        waitEvents: [],
                        waitEventTypes: [],
                        lockBlocking: [],
                        dbStats: {},
                        slowQueries: [],
                        locks: [],
                        settings: {},
                        bgwriter: {},
                    },
                });
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // Fetch auto_explain APM data when tab or hours changes
    useEffect(() => {
        if (insightsSubView !== 'apm') return;
        let cancelled = false;
        const load = async () => {
            setApmLoading(true);
            setApmError(null);
            try {
                const now = Date.now();
                const from = new Date(now - apmHours * 3600_000).toISOString();
                const to = new Date(now).toISOString();
                // connectionId is appended automatically by request()/appendConnectionId.
                const qs = `?from=${from}&to=${to}`;
                const [evRes, sumRes] = await Promise.allSettled([
                    fetchData(`/api/auto-explain/recent${qs}&limit=200`),
                    fetchData(`/api/auto-explain/summary${qs}`),
                ]);
                if (cancelled) return;
                const rawEvents = evRes.status === 'fulfilled' ? (evRes.value?.events ?? []) : [];
                const rawQueries = sumRes.status === 'fulfilled' ? (sumRes.value?.queries ?? []) : [];
                // Map backend (snake_case) rows to the shape ApmPanel renders.
                const events = rawEvents.map((r: any) => ({
                    id: r.id,
                    capturedAt: r.captured_at ?? r.capturedAt,
                    durationMs: Number(r.duration_ms ?? r.durationMs ?? 0),
                    statement: r.statement,
                    queryId: r.query_id ?? r.queryId ?? null,
                    databaseName: r.database_name ?? r.databaseName,
                    userName: r.user_name ?? r.userName,
                    application: r.application,
                    planJson: r.plan_json ?? r.planJson ?? null,
                }));
                const queries = rawQueries.map((r: any) => ({
                    queryId: r.query_id ?? r.queryId ?? null,
                    statement: r.statement ?? '',
                    callCount: Number(r.executions ?? r.callCount ?? 0),
                    avgDurationMs: Math.round(Number(r.avg_ms ?? r.avgDurationMs ?? 0)),
                    maxDurationMs: Math.round(Number(r.max_ms ?? r.maxDurationMs ?? 0)),
                    p99DurationMs: r.p99_ms != null ? Math.round(Number(r.p99_ms)) : (r.p99DurationMs ?? null),
                }));
                // No synthetic fallback — show real events or an honest empty state.
                setApmData({ events, queries });
            } catch (e: any) {
                if (!cancelled) setApmError(e?.message ?? 'Failed to load APM data');
            } finally {
                if (!cancelled) setApmLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [insightsSubView, apmHours]);

    if (loading)
        return (
            <div style={{ padding: 16 }}>
                <SkeletonLoader rows={5} height={100} />
            </div>
        );
    if (!data) return null;

    const { stats, conns, locks, io, repl, deep } = data;
    const { settings: pgSettings, dbStats: deepDbStats } = deep;

    const activeSessions = conns.filter((c) => c.state === 'active');
    const idleSessions = conns.filter((c) => c.state?.includes('idle'));
    const longRunning = conns.filter((c) => c.is_slow);
    const totalConns = conns.length;

    // Session timeline — show current snapshot as a single data point (no fake timeline)
    const sessionTimeline = [{ t: 'Now', active: activeSessions.length, idle: idleSessions.length }];

    const ioSparklines = (io || []).slice(0, 6);

    const uniqueApps = [...new Set(conns.map((c) => c.application_name).filter(Boolean))];
    const uniqueUsers = [...new Set(conns.map((c) => c.usename || c.user).filter(Boolean))];

    // Use real data from pg_stat_statements
    const rawSlowQueries = (stats?.slowQueries || []).map((q, i) => ({
        ...q,
        id: q.id || i,
        cache_hit_pct: q.cache_hit_pct || '—',
        tempFiles: Number(q.temp_blks_read || 0) + Number(q.temp_blks_written || 0),
        pid: '—',
    }));

    const filteredSlowQueries = rawSlowQueries.filter((q) => {
        const matchSearch = !searchQuery || q.query?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchApp = !filterApp || q.application_name === filterApp;
        const matchUser = !filterUser || q.usename === filterUser;
        return matchSearch && matchApp && matchUser;
    });

    const groupedQueries = queryGroupMode ? groupByFingerprint(filteredSlowQueries) : null;
    const n1Patterns = detectN1Patterns(rawSlowQueries);

    // Deep insights data from the new API
    const deepSlowQueries = deep?.slowQueries || [];

    // Real database stats
    const maxConnections = Number(pgSettings?.max_connections) || 100;
    const cacheHitPct = deepDbStats?.cache_hit_pct || '—';
    const deadlockCount = Number(deepDbStats?.deadlocks || 0);
    const dbTempFiles = Number(deepDbStats?.temp_files || 0);
    const dbTempBytes = Number(deepDbStats?.temp_bytes || 0);
    const uptime = deepDbStats?.uptime || '—';
    const tps = deepDbStats?.xact_commit ? Math.round(Number(deepDbStats.xact_commit) / 3600) : '—';

    const getFilteredSessionList = () => {
        if (sessionFilter === 'active') return activeSessions;
        if (sessionFilter === 'long') return longRunning;
        if (sessionFilter === 'idle') return idleSessions;
        if (sessionFilter === 'blocked') return locks;
        return [];
    };

    const handleTagQuery = (id, tag) => {
        setQueryTags((prev) =>
            tag ? { ...prev, [id]: tag } : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== String(id))),
        );
    };

    const handleKillQuery = (query, reason) => {
        setKilledQueries((prev) => new Set([...prev, query.id]));
        // kill action recorded — backend integration point for pg_terminate_backend
    };

    const slowQueryCols = [
        {
            key: 'severity',
            label: '',
            maxWidth: 60,
            align: 'center',
            render: (_, row) => <SeverityTag ms={row.mean_time_ms} />,
        },
        {
            key: 'query',
            label: 'Query',
            mono: true,
            maxWidth: 340,
            render: (t, row) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setBookmarkedQueries((prev) => {
                                const s = new Set(prev);
                                s.has(row.id) ? s.delete(row.id) : s.add(row.id);
                                return s;
                            });
                        }}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: bookmarkedQueries.has(row.id) ? THEME.warning : THEME.grid,
                            padding: 2,
                            flexShrink: 0,
                        }}
                    >
                        {bookmarkedQueries.has(row.id) ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
                    </button>
                    <span style={{ fontSize: 11, lineHeight: 1.4, opacity: 0.85 }}>
                        {t?.length > 60 ? `${t.substring(0, 60)}…` : t}
                    </span>
                    {queryTags[row.id] && (
                        <span
                            style={{
                                fontSize: 8,
                                padding: '1px 5px',
                                borderRadius: 20,
                                background:
                                    queryTags[row.id] === 'known-slow' ? `${THEME.warning}15` : `${THEME.success}12`,
                                color: queryTags[row.id] === 'known-slow' ? THEME.warning : THEME.success,
                                border: `1px solid ${queryTags[row.id] === 'known-slow' ? `${THEME.warning}25` : `${THEME.success}20`}`,
                                flexShrink: 0,
                            }}
                        >
                            {queryTags[row.id] === 'known-slow' ? '⚑' : '✓'}
                        </span>
                    )}
                </div>
            ),
        },
        {
            key: 'calls',
            label: 'Calls',
            align: 'right',
            maxWidth: 65,
            render: (v) => (
                <span style={{ fontVariantNumeric: 'tabular-nums', color: THEME.textMuted }}>
                    {Number(v || 0).toLocaleString()}
                </span>
            ),
        },
        {
            key: 'cache_hit_pct',
            label: 'Cache Hit',
            align: 'right',
            maxWidth: 75,
            render: (v, row) => (
                <span
                    style={{
                        fontWeight: 700,
                        color:
                            Number(row.cache_hit_pct) > 95
                                ? THEME.success
                                : Number(row.cache_hit_pct) > 85
                                  ? THEME.warning
                                  : THEME.danger,
                        fontSize: 11,
                    }}
                >
                    {row.cache_hit_pct}%
                </span>
            ),
        },
        {
            key: 'tempFiles',
            label: 'Tmp',
            align: 'center',
            maxWidth: 45,
            render: (_, row) =>
                row.tempFiles > 0 ? (
                    <span style={{ color: THEME.warning, fontWeight: 700, fontSize: 11 }}>⚠ {row.tempFiles}</span>
                ) : (
                    <span style={{ color: THEME.textDim, fontSize: 11 }}>—</span>
                ),
        },
        {
            key: 'mean_time_ms',
            label: 'Avg Time',
            align: 'right',
            maxWidth: 90,
            render: (v) => (
                <span
                    style={{
                        fontWeight: 700,
                        color: Number(v) > 1000 ? THEME.danger : THEME.warning,
                        fontVariantNumeric: 'tabular-nums',
                    }}
                >
                    {Number(v).toFixed(1)}
                    <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 1 }}>ms</span>
                </span>
            ),
        },
        {
            key: 'cost_bar',
            label: 'Cost',
            maxWidth: 70,
            render: (_, row) => (
                <SeverityBar
                    value={Number(row.mean_time_ms)}
                    max={Number(stats?.slowQueries?.[0]?.mean_time_ms || 100)}
                    color={Number(row.mean_time_ms) > 5000 ? THEME.danger : THEME.warning}
                />
            ),
        },
        {
            key: 'actions',
            label: '',
            align: 'right',
            maxWidth: 80,
            render: (_, row) => (
                <button
                    onClick={() => setSelectedQuery(row)}
                    style={{
                        background: `${THEME.primary}10`,
                        border: `1px solid ${THEME.primary}20`,
                        color: THEME.primary,
                        padding: '5px 10px',
                        borderRadius: 18,
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = `${THEME.primary}25`;
                        e.currentTarget.style.borderColor = THEME.primary;
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = `${THEME.primary}10`;
                        e.currentTarget.style.borderColor = `${THEME.primary}20`;
                    }}
                >
                    <Sparkles size={10} /> Analyze
                </button>
            ),
        },
    ];

    const sessionListCols = [
        {
            key: 'pid',
            label: 'PID',
            mono: true,
            maxWidth: 70,
            render: (v) => <span style={{ color: THEME.primary }}>{v}</span>,
        },
        {
            key: 'usename',
            label: 'User',
            maxWidth: 90,
            render: (v) => <span style={{ fontSize: 11, color: THEME.textMuted }}>{v || '—'}</span>,
        },
        { key: 'application_name', label: 'App', maxWidth: 100 },
        {
            key: 'query',
            label: 'Query',
            mono: true,
            render: (t) => <span style={{ opacity: 0.7, fontSize: 11 }}>{t ? t.substring(0, 36) + '…' : '—'}</span>,
        },
        {
            key: 'state',
            label: 'State',
            align: 'right',
            render: (v) => {
                const c = v === 'active' ? THEME.success : v?.includes('idle') ? THEME.textDim : THEME.warning;
                return (
                    <span
                        style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 18,
                            background: `${c}15`,
                            color: c,
                            border: `1px solid ${c}20`,
                        }}
                    >
                        {v || '—'}
                    </span>
                );
            },
        },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '0 24px 40px 24px' }}>
            <PerfStyles />

            {/* View Switcher */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                    padding: '6px 8px',
                    background: THEME.surface,
                    border: `1px solid ${THEME.glassBorder}`,
                    borderRadius: 26,
                    width: 'fit-content',
                }}
            >
                <ViewTab
                    id="activity"
                    label="Activity & Queries"
                    icon={Zap}
                    activeView={activeView}
                    setActiveView={setActiveView}
                />
                <ViewTab
                    id="insights"
                    label="Deep Insights"
                    icon={BrainCircuit}
                    activeView={activeView}
                    setActiveView={setActiveView}
                />
                <ViewTab
                    id="health"
                    label="Resources & Health"
                    icon={Cpu}
                    activeView={activeView}
                    setActiveView={setActiveView}
                />
            </div>

            {/* ════════════════════ ACTIVITY VIEW ════════════════════ */}
            {activeView === 'activity' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Live Sessions */}
                    <GlassCard
                        title={
                            sessionFilter
                                ? `${sessionFilter.charAt(0).toUpperCase() + sessionFilter.slice(1)} Sessions`
                                : 'Live Sessions'
                        }
                        rightNode={
                            <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        fontSize: 11,
                                        color: THEME.textDim,
                                    }}
                                >
                                    <LiveDot color={THEME.success} size={7} />
                                    <span>{totalConns} total connections</span>
                                </div>
                                {sessionFilter && (
                                    <button
                                        onClick={() => setSessionFilter(null)}
                                        style={{
                                            background: `${THEME.primary}10`,
                                            border: `1px solid ${THEME.primary}20`,
                                            color: THEME.primary,
                                            padding: '4px 12px',
                                            borderRadius: 18,
                                            cursor: 'pointer',
                                            fontSize: 11,
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4,
                                        }}
                                    >
                                        <ChevronLeft size={12} /> Back
                                    </button>
                                )}
                            </div>
                        }
                    >
                        {sessionFilter ? (
                            <div style={{ minHeight: 200 }}>
                                <DataTable
                                    columns={sessionListCols}
                                    data={getFilteredSessionList()}
                                    pageSize={6}
                                    compact
                                />
                                {getFilteredSessionList().length === 0 && (
                                    <div
                                        style={{ textAlign: 'center', padding: 32, color: THEME.textDim, fontSize: 12 }}
                                    >
                                        No sessions in this category
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(4, 1fr)',
                                    gap: 18,
                                    padding: '4px 0',
                                }}
                            >
                                <SessionMetric
                                    icon={Activity}
                                    title="Active"
                                    value={activeSessions.length}
                                    color={THEME.success}
                                    filterKey="active"
                                    sessionFilter={sessionFilter}
                                    setSessionFilter={setSessionFilter}
                                />
                                <SessionMetric
                                    icon={Clock}
                                    title="Long Running"
                                    value={longRunning.length}
                                    color={THEME.warning}
                                    filterKey="long"
                                    sessionFilter={sessionFilter}
                                    setSessionFilter={setSessionFilter}
                                />
                                <SessionMetric
                                    icon={Server}
                                    title="Idle"
                                    value={idleSessions.length}
                                    color={THEME.textMuted}
                                    filterKey="idle"
                                    sessionFilter={sessionFilter}
                                    setSessionFilter={setSessionFilter}
                                />
                                <SessionMetric
                                    icon={Lock}
                                    title="Blocked"
                                    value={locks.length}
                                    color={THEME.danger}
                                    filterKey="blocked"
                                    sessionFilter={sessionFilter}
                                    setSessionFilter={setSessionFilter}
                                />
                            </div>
                        )}
                    </GlassCard>

                    {/* Session Traffic */}
                    <GlassCard
                        title="Session Traffic"
                        style={{ minHeight: 280 }}
                        rightNode={
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 18,
                                    fontSize: 11,
                                    color: THEME.textDim,
                                }}
                            >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                    <span
                                        style={{ width: 10, height: 3, borderRadius: 2, background: THEME.primary }}
                                    />{' '}
                                    Active
                                </span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                    <span
                                        style={{
                                            width: 10,
                                            height: 3,
                                            borderRadius: 2,
                                            background: `${THEME.textDim}80`,
                                        }}
                                    />{' '}
                                    Idle
                                </span>
                            </div>
                        }
                    >
                        <div style={{ flex: 1, minWidth: 0, width: '100%', minHeight: 180 }}>
                            <ResponsiveContainer width="100%" height={180}>
                                <AreaChart data={sessionTimeline} margin={{ top: 10, right: 12, bottom: 4, left: -16 }}>
                                    <CartesianGrid stroke={`${THEME.grid}40`} strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="t"
                                        tick={{ fontSize: 10, fill: THEME.textDim }}
                                        axisLine={false}
                                        tickLine={false}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis
                                        tick={{ fontSize: 10, fill: THEME.textDim }}
                                        axisLine={false}
                                        tickLine={false}
                                        width={36}
                                    />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Area
                                        type="monotone"
                                        dataKey="idle"
                                        stroke={`${THEME.textDim}60`}
                                        strokeWidth={1.5}
                                        fill="none"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="active"
                                        stroke={THEME.primary}
                                        strokeWidth={2}
                                        fill="none"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </GlassCard>

                    {/* Slow Query Analysis */}
                    <GlassCard
                        title="Query Analysis"
                        noPad
                        style={{ minHeight: 400 }}
                        rightNode={
                            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                                <span
                                    style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        padding: '3px 10px',
                                        borderRadius: 18,
                                        background: `${THEME.danger}12`,
                                        color: THEME.danger,
                                        border: `1px solid ${THEME.danger}20`,
                                    }}
                                >
                                    {filteredSlowQueries.length} slow queries
                                </span>
                                {n1Patterns.length > 0 && (
                                    <span
                                        style={{
                                            fontSize: 10,
                                            fontWeight: 700,
                                            padding: '3px 10px',
                                            borderRadius: 18,
                                            background: `${THEME.warning}12`,
                                            color: THEME.warning,
                                            border: `1px solid ${THEME.warning}20`,
                                        }}
                                    >
                                        {n1Patterns.length} N+1 patterns
                                    </span>
                                )}
                            </div>
                        }
                    >
                        <div
                            style={{
                                padding: '22px 28px',
                                borderBottom: `1px solid ${THEME.glassBorder}`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 20,
                                flexWrap: 'wrap',
                            }}
                        >
                            <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                                <SubViewTab
                                    id="queries"
                                    label="Slow Queries"
                                    icon={List}
                                    stateKey={activitySubView}
                                    setState={setActivitySubView}
                                />
                                <SubViewTab
                                    id="gantt"
                                    label="Timeline"
                                    icon={Calendar}
                                    stateKey={activitySubView}
                                    setState={setActivitySubView}
                                />
                                <SubViewTab
                                    id="locks"
                                    label="Lock Waits"
                                    icon={Lock}
                                    stateKey={activitySubView}
                                    setState={setActivitySubView}
                                />
                                <SubViewTab
                                    id="n1"
                                    label="N+1 Patterns"
                                    icon={Merge}
                                    stateKey={activitySubView}
                                    setState={setActivitySubView}
                                />
                            </div>
                            {activitySubView === 'queries' && (
                                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                        <Search
                                            size={12}
                                            color={THEME.textDim}
                                            style={{ position: 'absolute', left: 8, pointerEvents: 'none' }}
                                        />
                                        <input
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search queries…"
                                            style={{
                                                paddingLeft: 26,
                                                paddingRight: 10,
                                                paddingTop: 6,
                                                paddingBottom: 6,
                                                borderRadius: 18,
                                                border: `1px solid ${THEME.grid}50`,
                                                background: THEME.bg,
                                                color: THEME.textMain,
                                                fontSize: 11,
                                                width: 160,
                                                outline: 'none',
                                            }}
                                        />
                                    </div>
                                    <button
                                        onClick={() => setQueryGroupMode(!queryGroupMode)}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: 18,
                                            border: `1px solid ${queryGroupMode ? THEME.primary + '40' : THEME.grid + '40'}`,
                                            background: queryGroupMode ? `${THEME.primary}12` : 'transparent',
                                            color: queryGroupMode ? THEME.primary : THEME.textDim,
                                            cursor: 'pointer',
                                            fontSize: 11,
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 5,
                                        }}
                                    >
                                        <Merge size={12} /> Group
                                    </button>
                                    <button
                                        onClick={() => setShowFilterPanel(!showFilterPanel)}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: 18,
                                            border: `1px solid ${showFilterPanel ? THEME.primary + '40' : THEME.grid + '40'}`,
                                            background: showFilterPanel ? `${THEME.primary}12` : 'transparent',
                                            color: showFilterPanel ? THEME.primary : THEME.textDim,
                                            cursor: 'pointer',
                                            fontSize: 11,
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 5,
                                        }}
                                    >
                                        <Filter size={12} /> Filter{' '}
                                        {(filterApp || filterUser) && (
                                            <span
                                                style={{
                                                    width: 6,
                                                    height: 6,
                                                    borderRadius: '50%',
                                                    background: THEME.warning,
                                                    flexShrink: 0,
                                                }}
                                            />
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>

                        {showFilterPanel && activitySubView === 'queries' && (
                            <div
                                style={{
                                    padding: '12px 20px',
                                    borderBottom: `1px solid ${THEME.glassBorder}`,
                                    display: 'flex',
                                    gap: 18,
                                    background: `${THEME.primary}04`,
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                }}
                            >
                                <span style={{ fontSize: 10, color: THEME.textDim, fontWeight: 600 }}>FILTER BY:</span>
                                <select
                                    value={filterApp}
                                    onChange={(e) => setFilterApp(e.target.value)}
                                    style={{
                                        padding: '4px 10px',
                                        borderRadius: 18,
                                        border: `1px solid ${THEME.grid}50`,
                                        background: THEME.surface,
                                        color: filterApp ? THEME.primary : THEME.textDim,
                                        fontSize: 11,
                                        cursor: 'pointer',
                                        outline: 'none',
                                    }}
                                >
                                    <option value="">All Apps</option>
                                    {uniqueApps.map((a) => (
                                        <option key={a} value={a}>
                                            {a}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={filterUser}
                                    onChange={(e) => setFilterUser(e.target.value)}
                                    style={{
                                        padding: '4px 10px',
                                        borderRadius: 18,
                                        border: `1px solid ${THEME.grid}50`,
                                        background: THEME.surface,
                                        color: filterUser ? THEME.primary : THEME.textDim,
                                        fontSize: 11,
                                        cursor: 'pointer',
                                        outline: 'none',
                                    }}
                                >
                                    <option value="">All Users</option>
                                    {uniqueUsers.map((u) => (
                                        <option key={u} value={u}>
                                            {u}
                                        </option>
                                    ))}
                                </select>
                                {(filterApp || filterUser || searchQuery) && (
                                    <button
                                        onClick={() => {
                                            setFilterApp('');
                                            setFilterUser('');
                                            setSearchQuery('');
                                        }}
                                        style={{
                                            padding: '4px 10px',
                                            borderRadius: 18,
                                            border: `1px solid ${THEME.danger}30`,
                                            background: 'transparent',
                                            color: THEME.danger,
                                            cursor: 'pointer',
                                            fontSize: 11,
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4,
                                        }}
                                    >
                                        <X size={10} /> Clear
                                    </button>
                                )}
                            </div>
                        )}

                        <div
                            style={{
                                padding: activitySubView === 'queries' && !queryGroupMode ? 0 : 20,
                                flex: 1,
                                minHeight: 0,
                            }}
                        >
                            {activitySubView === 'queries' && !queryGroupMode && (
                                <DataTable columns={slowQueryCols} data={filteredSlowQueries} pageSize={7} compact />
                            )}

                            {activitySubView === 'queries' && queryGroupMode && (
                                <div>
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr auto auto auto auto',
                                            gap: 0,
                                            padding: '14px 20px',
                                            borderBottom: `1px solid ${THEME.glassBorder}`,
                                        }}
                                    >
                                        {['Query Fingerprint', 'Variants', 'Total Calls', 'Avg Time', ''].map(
                                            (h, i) => (
                                                <div
                                                    key={i}
                                                    style={{
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        color: THEME.textDim,
                                                        letterSpacing: '0.02em',
                                                        textAlign: i > 0 ? 'right' : 'left',
                                                        padding: '0 8px',
                                                    }}
                                                >
                                                    {h}
                                                </div>
                                            ),
                                        )}
                                    </div>
                                    {(groupedQueries || []).map((g, i) => (
                                        <div
                                            key={i}
                                            className="perf-row-hover"
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr auto auto auto auto',
                                                gap: 0,
                                                padding: '16px 22px',
                                                borderBottom: `1px solid ${THEME.grid}20`,
                                                alignItems: 'center',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontFamily: THEME.fontMono,
                                                    fontSize: 11,
                                                    color: THEME.textMain,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    padding: '0 8px',
                                                }}
                                            >
                                                <Hash size={10} color={THEME.textDim} style={{ marginRight: 5 }} />
                                                {g.fingerprint}
                                            </div>
                                            <div
                                                style={{
                                                    textAlign: 'right',
                                                    fontSize: 12,
                                                    color: THEME.primary,
                                                    fontWeight: 600,
                                                    padding: '0 12px',
                                                }}
                                            >
                                                {g.queries.length}
                                            </div>
                                            <div
                                                style={{
                                                    textAlign: 'right',
                                                    fontSize: 12,
                                                    fontVariantNumeric: 'tabular-nums',
                                                    color: THEME.textMuted,
                                                    padding: '0 12px',
                                                }}
                                            >
                                                {g.totalCalls.toLocaleString()}
                                            </div>
                                            <div
                                                style={{
                                                    textAlign: 'right',
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    color: g.avgTime > 1000 ? THEME.danger : THEME.warning,
                                                    fontVariantNumeric: 'tabular-nums',
                                                    padding: '0 12px',
                                                }}
                                            >
                                                {g.avgTime.toFixed(1)}ms
                                            </div>
                                            <div style={{ padding: '0 8px' }}>
                                                <button
                                                    onClick={() => setSelectedQuery(g.representative)}
                                                    style={{
                                                        background: `${THEME.primary}10`,
                                                        border: `1px solid ${THEME.primary}20`,
                                                        color: THEME.primary,
                                                        padding: '4px 10px',
                                                        borderRadius: 16,
                                                        cursor: 'pointer',
                                                        fontSize: 10,
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    <Sparkles size={9} style={{ marginRight: 3 }} />
                                                    Analyze
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activitySubView === 'gantt' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 4 }}>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: THEME.textDim }}>
                                            Query Execution Timeline
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 10,
                                                color: THEME.textDim,
                                                padding: '2px 8px',
                                                borderRadius: 18,
                                                background: `${THEME.grid}30`,
                                                border: `1px solid ${THEME.grid}40`,
                                            }}
                                        >
                                            last 5 seconds
                                        </span>
                                    </div>
                                    <GanttChart queries={rawSlowQueries} />
                                </div>
                            )}

                            {activitySubView === 'locks' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 4 }}>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: THEME.textDim }}>
                                            Active Lock Wait Chains
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 10,
                                                color: locks.length > 0 ? THEME.danger : THEME.success,
                                                padding: '2px 8px',
                                                borderRadius: 18,
                                                background:
                                                    locks.length > 0 ? `${THEME.danger}10` : `${THEME.success}10`,
                                                border: `1px solid ${locks.length > 0 ? `${THEME.danger}20` : `${THEME.success}20`}`,
                                            }}
                                        >
                                            {locks.length} blocked queries
                                        </span>
                                    </div>
                                    <LockWaitDetails lockBlocking={deep?.lockBlocking} />
                                </div>
                            )}

                            {activitySubView === 'n1' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                    <div
                                        style={{ fontSize: 11, fontWeight: 600, color: THEME.textDim, marginBottom: 4 }}
                                    >
                                        Repetitive Query Patterns — Potential N+1 Issues
                                    </div>
                                    {n1Patterns.length === 0 ? (
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: 40,
                                            }}
                                        >
                                            <EmptyState icon={CheckCircle} text="No N+1 patterns detected" />
                                        </div>
                                    ) : (
                                        n1Patterns.map((p, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    padding: 14,
                                                    borderRadius: 20,
                                                    background:
                                                        p.severity === 'high'
                                                            ? `${THEME.danger}06`
                                                            : `${THEME.warning}06`,
                                                    border: `1px solid ${p.severity === 'high' ? `${THEME.danger}15` : `${THEME.warning}15`}`,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'flex-start',
                                                        gap: 18,
                                                    }}
                                                >
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 20,
                                                                marginBottom: 6,
                                                            }}
                                                        >
                                                            <span
                                                                style={{
                                                                    fontSize: 9,
                                                                    fontWeight: 800,
                                                                    padding: '2px 8px',
                                                                    borderRadius: 18,
                                                                    background:
                                                                        p.severity === 'high'
                                                                            ? `${THEME.danger}18`
                                                                            : `${THEME.warning}15`,
                                                                    color:
                                                                        p.severity === 'high'
                                                                            ? THEME.danger
                                                                            : THEME.warning,
                                                                    border: `1px solid ${p.severity === 'high' ? `${THEME.danger}25` : `${THEME.warning}20`}`,
                                                                }}
                                                            >
                                                                {p.severity} N+1
                                                            </span>
                                                            <span
                                                                style={{
                                                                    fontSize: 12,
                                                                    fontWeight: 800,
                                                                    color:
                                                                        p.severity === 'high'
                                                                            ? THEME.danger
                                                                            : THEME.warning,
                                                                    fontVariantNumeric: 'tabular-nums',
                                                                }}
                                                            >
                                                                {p.callCount.toLocaleString()}× calls
                                                            </span>
                                                        </div>
                                                        <div
                                                            style={{
                                                                fontFamily: THEME.fontMono,
                                                                fontSize: 11,
                                                                color: THEME.textMuted,
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                            }}
                                                        >
                                                            {p.fingerprint}
                                                        </div>
                                                        <div
                                                            style={{ fontSize: 10, color: THEME.textDim, marginTop: 6 }}
                                                        >
                                                            ⚡ Consider batching with{' '}
                                                            <code style={{ color: THEME.primary }}>IN (?, ?, ...)</code>{' '}
                                                            or using a JOIN to eliminate repetition
                                                        </div>
                                                    </div>
                                                    <div style={{ flexShrink: 0 }}>
                                                        <SeverityBar
                                                            value={p.callCount}
                                                            max={Math.max(...n1Patterns.map((x) => x.callCount))}
                                                            color={p.severity === 'high' ? THEME.danger : THEME.warning}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </GlassCard>
                </div>
            )}

            {/* ════════════════════ DEEP INSIGHTS VIEW   ════════════════════ */}
            {activeView === 'insights' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Sub-view tabs */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {[
                            { id: 'wait_events', label: 'Wait Events', icon: Hourglass },
                            { id: 'slow_trend', label: 'Slow Query Trend', icon: BarChart3 },
                            { id: 'jit', label: 'JIT Compilation', icon: BrainCircuit },
                            { id: 'parallel', label: 'Parallel Workers', icon: GitFork },
                            {
                                id: 'lock_tree',
                                label: 'Blocking Tree',
                                icon: Waypoints,
                                badge: locks.length > 0 ? locks.length : null,
                            },
                            { id: 'deadlocks', label: 'Deadlock History', icon: ShieldAlert },
                            { id: 'plan_ratio', label: 'Plan Cache', icon: FileCog },
                            { id: 'temp_files', label: 'Temp Files', icon: HardDrive },
                            { id: 'apm', label: 'APM (auto_explain)', icon: Workflow },
                        ].map((t) => (
                            <SubViewTab
                                key={t.id}
                                id={t.id}
                                label={t.label}
                                icon={t.icon}
                                stateKey={insightsSubView}
                                setState={setInsightsSubView}
                                badge={t.badge}
                            />
                        ))}
                    </div>

                    {/* ── WAIT EVENTS ── */}
                    {insightsSubView === 'wait_events' && (
                        <GlassCard
                            title="Wait Event Breakdown"
                            rightNode={
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        fontSize: 11,
                                        color: THEME.textDim,
                                    }}
                                >
                                    <LiveDot color={THEME.primary} size={7} />
                                    <span>Live sampling</span>
                                </div>
                            }
                        >
                            <WaitEventBreakdown waitEventTypes={deep?.waitEventTypes} waitEvents={deep?.waitEvents} />
                        </GlassCard>
                    )}

                    {/* ── SLOW QUERY TREND ── */}
                    {insightsSubView === 'slow_trend' && (
                        <GlassCard
                            title="Slow Query Trend — Last 24 Hours"
                            rightNode={
                                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                    <span
                                        style={{
                                            fontSize: 10,
                                            fontWeight: 700,
                                            padding: '2px 8px',
                                            borderRadius: 16,
                                            background: `${THEME.danger}12`,
                                            color: THEME.danger,
                                            border: `1px solid ${THEME.danger}20`,
                                        }}
                                    >
                                        P99 latency overlay
                                    </span>
                                </div>
                            }
                        >
                            <SlowQueryTrend24h slowQueries={deepSlowQueries} />
                        </GlassCard>
                    )}

                    {/* ── JIT COMPILATION ── */}
                    {insightsSubView === 'jit' && (
                        <GlassCard
                            title="JIT Compilation Analysis"
                            rightNode={
                                <div style={{ display: 'flex', gap: 20 }}>
                                    <span
                                        style={{
                                            fontSize: 10,
                                            color: THEME.textDim,
                                            padding: '3px 8px',
                                            borderRadius: 16,
                                            background: `${THEME.grid}20`,
                                            border: `1px solid ${THEME.grid}40`,
                                            fontFamily: THEME.fontMono,
                                        }}
                                    >
                                        jit = on
                                    </span>
                                </div>
                            }
                        >
                            <JITCompilationPanel slowQueries={deepSlowQueries} jitEnabled={pgSettings?.jit === 'on'} />
                        </GlassCard>
                    )}

                    {/* ── PARALLEL WORKERS ── */}
                    {insightsSubView === 'parallel' && (
                        <GlassCard
                            title="Parallel Query Utilization"
                            rightNode={
                                <div style={{ display: 'flex', gap: 20 }}>
                                    <span
                                        style={{
                                            fontSize: 10,
                                            color: THEME.textDim,
                                            padding: '3px 8px',
                                            borderRadius: 16,
                                            background: `${THEME.grid}20`,
                                            border: `1px solid ${THEME.grid}40`,
                                            fontFamily: THEME.fontMono,
                                        }}
                                    >
                                        max_parallel_workers = {pgSettings?.max_parallel_workers || '—'}
                                    </span>
                                </div>
                            }
                        >
                            <ParallelQueryPanel stats={stats} settings={pgSettings} />
                        </GlassCard>
                    )}

                    {/* ── LOCK BLOCKING TREE ── */}
                    {insightsSubView === 'lock_tree' && (
                        <GlassCard
                            title="Lock Blocking Tree"
                            rightNode={
                                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                    {locks.length > 0 && <LiveDot color={THEME.danger} size={7} />}
                                    <span
                                        style={{
                                            padding: '3px 10px',
                                            borderRadius: 16,
                                            background: locks.length > 0 ? `${THEME.danger}12` : `${THEME.success}10`,
                                            color: locks.length > 0 ? THEME.danger : THEME.success,
                                            border: `1px solid ${locks.length > 0 ? `${THEME.danger}20` : `${THEME.success}20`}`,
                                            fontWeight: 700,
                                            fontSize: 10,
                                        }}
                                    >
                                        {locks.length > 0 ? `${locks.length} active blocks` : 'No blocks'}
                                    </span>
                                </div>
                            }
                        >
                            <LockBlockingTree lockBlocking={deep?.lockBlocking} />
                        </GlassCard>
                    )}

                    {/* ── DEADLOCK HISTORY ── */}
                    {insightsSubView === 'deadlocks' && (
                        <GlassCard
                            title="Deadlock History"
                            rightNode={
                                <span style={{ fontSize: 10, color: THEME.textDim }}>
                                    Last 7 days · Click to expand
                                </span>
                            }
                        >
                            <DeadlockHistory dbStats={deepDbStats} />
                        </GlassCard>
                    )}

                    {/* ── PLAN CACHE RATIO ── */}
                    {insightsSubView === 'plan_ratio' && (
                        <GlassCard
                            title="Generic vs Custom Plan Ratio"
                            rightNode={
                                <span style={{ fontSize: 10, color: THEME.textDim }}>Prepared statement health</span>
                            }
                        >
                            <GenericCustomPlanPanel slowQueries={deepSlowQueries} settings={pgSettings} />
                        </GlassCard>
                    )}

                    {/* ── TEMP FILES ── */}
                    {insightsSubView === 'temp_files' && (
                        <GlassCard
                            title="Temporary File Usage — Queries Spilling to Disk"
                            rightNode={
                                <span style={{ fontSize: 10, color: THEME.textDim, fontFamily: THEME.fontMono }}>
                                    work_mem = {pgSettings?.work_mem || '—'}
                                </span>
                            }
                        >
                            <TempFileTracker
                                slowQueries={deepSlowQueries}
                                dbStats={deepDbStats}
                                settings={pgSettings}
                            />
                        </GlassCard>
                    )}

                    {/* ── APM (auto_explain) correlation ── */}
                    {insightsSubView === 'apm' && (
                        <ApmPanel
                            apmData={apmData}
                            apmLoading={apmLoading}
                            apmError={apmError}
                            apmHours={apmHours}
                            apmSelectedQuery={apmSelectedQuery}
                            setApmHours={setApmHours}
                            setApmSelectedQuery={setApmSelectedQuery}
                        />
                    )}
                </div>
            )}

            {/* ════════════════════ HEALTH VIEW ════════════════════ */}
            {activeView === 'health' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {[
                            { id: 'overview', label: 'Overview', icon: BarChart3 },
                            { id: 'cpu', label: 'CPU', icon: Cpu },
                            { id: 'memory', label: 'Memory', icon: MemoryStick },
                            { id: 'disk', label: 'Disk', icon: Disc },
                            { id: 'network', label: 'Network', icon: Wifi },
                            { id: 'buffer', label: 'Buffer Cache', icon: Database },
                        ].map((t) => (
                            <SubViewTab
                                key={t.id}
                                id={t.id}
                                label={t.label}
                                icon={t.icon}
                                stateKey={healthSubView}
                                setState={setHealthSubView}
                            />
                        ))}
                    </div>

                    {/* ── OVERVIEW ── */}
                    {healthSubView === 'overview' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                                {[
                                    {
                                        title: 'Connections',
                                        icon: Network,
                                        pct: Math.round((totalConns / maxConnections) * 100),
                                        displayValue: `${totalConns}`,
                                        unit: `/ ${maxConnections}`,
                                        color: totalConns > maxConnections * 0.8 ? THEME.warning : THEME.primary,
                                        chips: [
                                            { label: 'Active', value: totalConns, icon: Network },
                                            { label: 'Max', value: maxConnections, icon: Server },
                                        ],
                                    },
                                    {
                                        title: 'Cache Hit',
                                        icon: Database,
                                        pct: Number(cacheHitPct) || 0,
                                        displayValue: `${cacheHitPct}`,
                                        unit: '%',
                                        color: THEME.success,
                                        chips: [
                                            {
                                                label: 'Reads',
                                                value: Number(deepDbStats?.blks_read || 0).toLocaleString(),
                                                icon: HardDrive,
                                            },
                                            {
                                                label: 'Hits',
                                                value: Number(deepDbStats?.blks_hit || 0).toLocaleString(),
                                                icon: Database,
                                            },
                                        ],
                                    },
                                    {
                                        title: 'Shared Buffers',
                                        icon: Layers,
                                        pct: 100,
                                        displayValue: pgSettings?.shared_buffers || '—',
                                        unit: '',
                                        color: THEME.primary,
                                        chips: [
                                            { label: 'Size', value: pgSettings?.shared_buffers || '—', icon: Database },
                                            { label: 'work_mem', value: pgSettings?.work_mem || '—', icon: Layers },
                                        ],
                                    },
                                ].map((card, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            display: 'flex',
                                            borderRadius: 16,
                                            overflow: 'hidden',
                                            border: `1px solid ${THEME.glassBorder}`,
                                            boxShadow: THEME.shadowMd,
                                        }}
                                    >
                                        {/* Left: colored panel with big metric */}
                                        <div
                                            style={{
                                                width: '42%',
                                                background: `linear-gradient(145deg, ${card.color}, ${card.color}dd)`,
                                                padding: '22px 18px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                gap: 6,
                                                position: 'relative',
                                            }}
                                        >
                                            {/* Decorative circle */}
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    top: -20,
                                                    right: -20,
                                                    width: 80,
                                                    height: 80,
                                                    borderRadius: '50%',
                                                    background: 'rgba(255,255,255,0.08)',
                                                }}
                                            />
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    bottom: -15,
                                                    left: -15,
                                                    width: 50,
                                                    height: 50,
                                                    borderRadius: '50%',
                                                    background: 'rgba(255,255,255,0.05)',
                                                }}
                                            />
                                            <card.icon
                                                size={20}
                                                color="rgba(255,255,255,0.7)"
                                                style={{ marginBottom: 2 }}
                                            />
                                            <div
                                                style={{
                                                    fontSize: 30,
                                                    fontWeight: 800,
                                                    color: '#fff',
                                                    fontFamily: THEME.fontMono,
                                                    lineHeight: 1,
                                                    letterSpacing: '-0.03em',
                                                    position: 'relative',
                                                }}
                                            >
                                                {card.displayValue}
                                                {card.unit && (
                                                    <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.75 }}>
                                                        {' '}
                                                        {card.unit}
                                                    </span>
                                                )}
                                            </div>
                                            <span
                                                style={{
                                                    fontSize: 10,
                                                    fontWeight: 600,
                                                    color: 'rgba(255,255,255,0.7)',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.08em',
                                                }}
                                            >
                                                {card.pct}% used
                                            </span>
                                        </div>

                                        {/* Right: white panel with title + details */}
                                        <div
                                            style={{
                                                flex: 1,
                                                minHeight: 0,
                                                background: THEME.surface,
                                                padding: '18px 18px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'center',
                                                gap: 18,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: 13,
                                                    fontWeight: 650,
                                                    color: THEME.textMain,
                                                    letterSpacing: '-0.01em',
                                                }}
                                            >
                                                {card.title}
                                            </span>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                                {card.chips.map((chip, i) => (
                                                    <div
                                                        key={i}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 20 }}
                                                    >
                                                        <chip.icon size={12} color={THEME.textDim} />
                                                        <span
                                                            style={{ fontSize: 11, color: THEME.textDim, minWidth: 48 }}
                                                        >
                                                            {chip.label}
                                                        </span>
                                                        <span
                                                            style={{
                                                                fontSize: 14,
                                                                fontWeight: 700,
                                                                color: THEME.textMain,
                                                                fontFamily: THEME.fontMono,
                                                                fontVariantNumeric: 'tabular-nums',
                                                            }}
                                                        >
                                                            {typeof chip.value === 'number'
                                                                ? chip.value.toLocaleString()
                                                                : chip.value}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="perf-equal-row" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
                                <GlassCard title="Top Tables by I/O" noPad>
                                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', height: 280 }}>
                                        {ioSparklines.length === 0 ? (
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: '40px 20px',
                                                    minHeight: 200,
                                                }}
                                            >
                                                <EmptyState icon={HardDrive} text="No IO data" />
                                            </div>
                                        ) : (
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr>
                                                        {[
                                                            { label: 'Table', align: 'left', width: '30%' },
                                                            { label: 'Reads', align: 'right', width: '18%' },
                                                            { label: 'Writes', align: 'right', width: '18%' },
                                                            { label: 'Hit Ratio', align: 'right', width: '14%' },
                                                            { label: 'Trend', align: 'right', width: '20%' },
                                                        ].map((h) => (
                                                            <th
                                                                key={h.label}
                                                                style={{
                                                                    padding: '22px 28px',
                                                                    textAlign: h.align,
                                                                    width: h.width,
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
                                                                {h.label}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {ioSparklines.map((t, i) => {
                                                        const reads = Number(t.heap_blks_read || t.seq_scan || 0);
                                                        const writes = Number(t.heap_blks_hit || t.idx_scan || 0);
                                                        const hitRatio =
                                                            reads + writes > 0
                                                                ? ((writes / (reads + writes)) * 100).toFixed(0)
                                                                : 0;
                                                        return (
                                                            <tr key={i} className="perf-row-hover">
                                                                <td
                                                                    style={{
                                                                        padding: '22px 28px',
                                                                        fontSize: 12,
                                                                        fontWeight: 600,
                                                                        color: THEME.textMain,
                                                                        borderBottom: `1px solid ${THEME.grid}20`,
                                                                    }}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: 6,
                                                                        }}
                                                                    >
                                                                        <div
                                                                            style={{
                                                                                width: 6,
                                                                                height: 6,
                                                                                borderRadius: '50%',
                                                                                background: THEME.primary,
                                                                                flexShrink: 0,
                                                                            }}
                                                                        />
                                                                        {t.table_name || t.relname || `table_${i}`}
                                                                    </div>
                                                                </td>
                                                                <td
                                                                    style={{
                                                                        padding: '22px 28px',
                                                                        fontSize: 12,
                                                                        fontVariantNumeric: 'tabular-nums',
                                                                        color: THEME.primary,
                                                                        textAlign: 'right',
                                                                        borderBottom: `1px solid ${THEME.grid}20`,
                                                                    }}
                                                                >
                                                                    {reads.toLocaleString()}
                                                                </td>
                                                                <td
                                                                    style={{
                                                                        padding: '22px 28px',
                                                                        fontSize: 12,
                                                                        fontVariantNumeric: 'tabular-nums',
                                                                        color: THEME.success,
                                                                        textAlign: 'right',
                                                                        borderBottom: `1px solid ${THEME.grid}20`,
                                                                    }}
                                                                >
                                                                    {writes.toLocaleString()}
                                                                </td>
                                                                <td
                                                                    style={{
                                                                        padding: '22px 28px',
                                                                        fontSize: 12,
                                                                        fontWeight: 700,
                                                                        color:
                                                                            Number(hitRatio) > 95
                                                                                ? THEME.success
                                                                                : THEME.warning,
                                                                        textAlign: 'right',
                                                                        borderBottom: `1px solid ${THEME.grid}20`,
                                                                    }}
                                                                >
                                                                    {hitRatio}%
                                                                </td>
                                                                <td
                                                                    style={{
                                                                        padding: '22px 28px',
                                                                        borderBottom: `1px solid ${THEME.grid}20`,
                                                                    }}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            display: 'flex',
                                                                            justifyContent: 'flex-end',
                                                                        }}
                                                                    >
                                                                        <span
                                                                            style={{
                                                                                fontSize: 10,
                                                                                color: THEME.textDim,
                                                                            }}
                                                                        >
                                                                            —
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </GlassCard>
                                <GlassCard title="Replication Status">
                                    <div
                                        style={{
                                            flex: 1,
                                            minHeight: 0,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            overflowY: 'auto',
                                            height: 280,
                                        }}
                                    >
                                        {repl.length === 0 ? (
                                            <div
                                                style={{
                                                    flex: 1,
                                                    minHeight: 0,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    height: 200,
                                                }}
                                            >
                                                <EmptyState icon={Copy} text="Standalone Instance" />
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                                {repl.map((r, i) => {
                                                    const lagBytes = Number(r.replication_lag_bytes || 0);
                                                    const lagColor =
                                                        lagBytes > 10000000
                                                            ? THEME.danger
                                                            : lagBytes > 1000000
                                                              ? THEME.warning
                                                              : THEME.success;
                                                    return (
                                                        <div
                                                            key={i}
                                                            style={{
                                                                padding: 14,
                                                                borderRadius: 20,
                                                                background: THEME.surface,
                                                                border: `1px solid ${THEME.grid}50`,
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
                                                                <div
                                                                    style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: 20,
                                                                    }}
                                                                >
                                                                    <LiveDot color={lagColor} size={7} />
                                                                    <span
                                                                        style={{
                                                                            fontSize: 12,
                                                                            fontWeight: 600,
                                                                            color: THEME.textMain,
                                                                        }}
                                                                    >
                                                                        {r.client_addr || `Replica ${i + 1}`}
                                                                    </span>
                                                                </div>
                                                                <span
                                                                    style={{
                                                                        fontSize: 10,
                                                                        fontWeight: 700,
                                                                        padding: '3px 10px',
                                                                        borderRadius: 18,
                                                                        background: `${lagColor}15`,
                                                                        color: lagColor,
                                                                        border: `1px solid ${lagColor}20`,
                                                                    }}
                                                                >
                                                                    {r.state || 'streaming'}
                                                                </span>
                                                            </div>
                                                            <div
                                                                style={{
                                                                    display: 'grid',
                                                                    gridTemplateColumns: '1fr 1fr',
                                                                    gap: 20,
                                                                }}
                                                            >
                                                                <StatChip
                                                                    label="Lag"
                                                                    value={
                                                                        lagBytes > 1000000
                                                                            ? `${(lagBytes / 1048576).toFixed(1)} MB`
                                                                            : `${(lagBytes / 1024).toFixed(0)} KB`
                                                                    }
                                                                    color={lagColor}
                                                                    icon={Timer}
                                                                    small
                                                                />
                                                                <StatChip
                                                                    label="LSN Diff"
                                                                    value={r.sent_lsn ? r.sent_lsn.split('/')[1] : '—'}
                                                                    icon={GitBranch}
                                                                    small
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </GlassCard>
                            </div>

                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(5, 1fr)',
                                    gap: 0,
                                    borderRadius: 18,
                                    background: THEME.surface,
                                    overflow: 'hidden',
                                    border: `1px solid ${THEME.glassBorder}`,
                                }}
                            >
                                {[
                                    {
                                        label: 'Cache Hit',
                                        value: `${cacheHitPct}%`,
                                        color: THEME.success,
                                        icon: CheckCircle,
                                    },
                                    {
                                        label: 'Commits',
                                        value: Number(deepDbStats?.xact_commit || 0).toLocaleString(),
                                        color: THEME.primary,
                                        icon: Zap,
                                    },
                                    {
                                        label: 'Deadlocks',
                                        value: deadlockCount,
                                        color: deadlockCount > 0 ? THEME.danger : THEME.textDim,
                                        icon: ShieldAlert,
                                    },
                                    {
                                        label: 'Temp Files',
                                        value: dbTempFiles > 0 ? dbTempFiles.toLocaleString() : '0',
                                        color: dbTempFiles > 0 ? THEME.warning : THEME.textDim,
                                        icon: HardDrive,
                                    },
                                    { label: 'Uptime', value: uptime, color: THEME.textMain, icon: Radio },
                                ].map((s, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 22,
                                            padding: '18px 22px',
                                            height: 58,
                                            borderRight: i < 4 ? `1px solid ${THEME.glassBorder}` : 'none',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 30,
                                                height: 30,
                                                borderRadius: 20,
                                                flexShrink: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                background: `${s.color}10`,
                                            }}
                                        >
                                            <s.icon size={14} color={s.color} />
                                        </div>
                                        <div
                                            style={{
                                                minWidth: 0,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize: 9,
                                                    color: THEME.textDim,
                                                    fontWeight: 600,
                                                    letterSpacing: '0.04em',
                                                    lineHeight: 1,
                                                    marginBottom: 4,
                                                }}
                                            >
                                                {s.label}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 15,
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
                        </div>
                    )}

                    {healthSubView === 'cpu' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
                                <HealthMetricCard
                                    title="Active Sessions"
                                    value={`${activeSessions.length}`}
                                    unit=""
                                    icon={Cpu}
                                    color={THEME.primary}
                                    detail={`of ${totalConns} total connections`}
                                />
                                <HealthMetricCard
                                    title="Max Workers"
                                    value={pgSettings?.max_worker_processes || '—'}
                                    unit=""
                                    icon={Gauge}
                                    color={THEME.success}
                                    detail="max_worker_processes"
                                />
                                <HealthMetricCard
                                    title="Parallel Workers"
                                    value={pgSettings?.max_parallel_workers || '—'}
                                    unit=""
                                    icon={User}
                                    color={THEME.primary}
                                    detail="max_parallel_workers"
                                />
                                <HealthMetricCard
                                    title="IO Concurrency"
                                    value={pgSettings?.effective_io_concurrency || '—'}
                                    unit=""
                                    icon={Server}
                                    color={THEME.warning}
                                    detail="effective_io_concurrency"
                                />
                            </div>
                            <div
                                style={{
                                    padding: 16,
                                    borderRadius: 20,
                                    background: `${THEME.primary}06`,
                                    border: `1px solid ${THEME.primary}15`,
                                }}
                            >
                                <div style={{ fontSize: 11, color: THEME.textDim, lineHeight: 1.6 }}>
                                    <span style={{ color: THEME.primary, fontWeight: 700 }}>Note:</span> CPU/OS-level
                                    metrics require a system monitoring agent (e.g., node_exporter, pg_stat_monitor).
                                    PostgreSQL exposes database-level activity through pg_stat_activity and
                                    pg_stat_statements.
                                </div>
                            </div>
                        </div>
                    )}

                    {healthSubView === 'memory' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
                                <HealthMetricCard
                                    title="Shared Buffers"
                                    value={pgSettings?.shared_buffers || '—'}
                                    unit=""
                                    icon={Database}
                                    color={THEME.primary}
                                    detail="PostgreSQL buffer pool"
                                />
                                <HealthMetricCard
                                    title="Work Mem"
                                    value={pgSettings?.work_mem || '—'}
                                    unit=""
                                    icon={Layers}
                                    color={THEME.success}
                                    detail="Per-sort/hash allocation"
                                />
                                <HealthMetricCard
                                    title="Eff. Cache Size"
                                    value={pgSettings?.effective_cache_size || '—'}
                                    unit=""
                                    icon={MemoryStick}
                                    color={THEME.warning}
                                    detail="Planner estimate of OS cache"
                                />
                                <HealthMetricCard
                                    title="Seq Page Cost"
                                    value={pgSettings?.seq_page_cost || '—'}
                                    unit=""
                                    icon={RefreshCcw}
                                    color={THEME.textMuted}
                                    detail={`Random: ${pgSettings?.random_page_cost || '—'}`}
                                />
                            </div>
                            <div
                                style={{
                                    padding: 16,
                                    borderRadius: 20,
                                    background: `${THEME.primary}06`,
                                    border: `1px solid ${THEME.primary}15`,
                                }}
                            >
                                <div style={{ fontSize: 11, color: THEME.textDim, lineHeight: 1.6 }}>
                                    <span style={{ color: THEME.primary, fontWeight: 700 }}>Note:</span> OS-level memory
                                    metrics require a system monitoring agent. The values above are PostgreSQL
                                    configuration settings from{' '}
                                    <code style={{ color: THEME.primary }}>pg_settings</code>.
                                </div>
                            </div>
                        </div>
                    )}

                    {healthSubView === 'disk' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
                                <HealthMetricCard
                                    title="Blocks Read"
                                    value={Number(deepDbStats?.blks_read || 0).toLocaleString()}
                                    unit=""
                                    icon={HardDrive}
                                    color={THEME.primary}
                                    detail="From disk (pg_stat_database)"
                                />
                                <HealthMetricCard
                                    title="Blocks Hit"
                                    value={Number(deepDbStats?.blks_hit || 0).toLocaleString()}
                                    unit=""
                                    icon={HardDrive}
                                    color={THEME.success}
                                    detail="From buffer cache"
                                />
                                <HealthMetricCard
                                    title="Temp Files"
                                    value={dbTempFiles.toLocaleString()}
                                    unit=""
                                    icon={Timer}
                                    color={dbTempFiles > 0 ? THEME.warning : THEME.textDim}
                                    detail="Queries spilling to disk"
                                />
                                <HealthMetricCard
                                    title="Temp Bytes"
                                    value={
                                        dbTempBytes > 1048576
                                            ? `${(dbTempBytes / 1048576).toFixed(1)}`
                                            : `${Math.round(dbTempBytes / 1024)}`
                                    }
                                    unit={dbTempBytes > 1048576 ? 'MB' : 'KB'}
                                    icon={Layers}
                                    color={dbTempBytes > 0 ? THEME.warning : THEME.textDim}
                                    detail="Total temp file size"
                                />
                            </div>
                            <div
                                style={{
                                    padding: 16,
                                    borderRadius: 20,
                                    background: `${THEME.primary}06`,
                                    border: `1px solid ${THEME.primary}15`,
                                }}
                            >
                                <div style={{ fontSize: 11, color: THEME.textDim, lineHeight: 1.6 }}>
                                    <span style={{ color: THEME.primary, fontWeight: 700 }}>Note:</span> Disk I/O
                                    throughput and latency metrics require OS-level monitoring. The counters above are
                                    cumulative values from{' '}
                                    <code style={{ color: THEME.primary }}>pg_stat_database</code> since the last stats
                                    reset.
                                </div>
                            </div>
                        </div>
                    )}

                    {healthSubView === 'network' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
                                <HealthMetricCard
                                    title="Total Connections"
                                    value={`${totalConns}`}
                                    unit=""
                                    icon={Wifi}
                                    color={THEME.primary}
                                    detail="Active pg_stat_activity"
                                />
                                <HealthMetricCard
                                    title="Tuples Fetched"
                                    value={Number(deepDbStats?.tup_fetched || 0).toLocaleString()}
                                    unit=""
                                    icon={Wifi}
                                    color={THEME.success}
                                    detail="Since stats reset"
                                />
                                <HealthMetricCard
                                    title="Tuples Inserted"
                                    value={Number(deepDbStats?.tup_inserted || 0).toLocaleString()}
                                    unit=""
                                    icon={Network}
                                    color={THEME.warning}
                                    detail="Since stats reset"
                                />
                                <HealthMetricCard
                                    title="Rollbacks"
                                    value={Number(deepDbStats?.xact_rollback || 0).toLocaleString()}
                                    unit=""
                                    icon={AlertCircle}
                                    color={Number(deepDbStats?.xact_rollback || 0) > 0 ? THEME.danger : THEME.textDim}
                                    detail="Transaction rollbacks"
                                />
                            </div>
                            <div
                                style={{
                                    padding: 16,
                                    borderRadius: 20,
                                    background: `${THEME.primary}06`,
                                    border: `1px solid ${THEME.primary}15`,
                                }}
                            >
                                <div style={{ fontSize: 11, color: THEME.textDim, lineHeight: 1.6 }}>
                                    <span style={{ color: THEME.primary, fontWeight: 700 }}>Note:</span> Network
                                    throughput metrics require OS-level monitoring. The values above are cumulative
                                    tuple/transaction counters from{' '}
                                    <code style={{ color: THEME.primary }}>pg_stat_database</code>.
                                </div>
                            </div>
                        </div>
                    )}

                    {healthSubView === 'buffer' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
                                <HealthMetricCard
                                    title="Cache Hit Ratio"
                                    value={`${cacheHitPct}`}
                                    unit="%"
                                    icon={Database}
                                    color={THEME.success}
                                    detail="Block-level hit rate"
                                />
                                <HealthMetricCard
                                    title="Buffers (Checkpoint)"
                                    value={Number(deep?.bgwriter?.buffers_checkpoint || 0).toLocaleString()}
                                    unit=""
                                    icon={HardDrive}
                                    color={THEME.warning}
                                    detail="Written during checkpoints"
                                />
                                <HealthMetricCard
                                    title="Buffers (Backend)"
                                    value={Number(deep?.bgwriter?.buffers_backend || 0).toLocaleString()}
                                    unit=""
                                    icon={RefreshCcw}
                                    color={THEME.primary}
                                    detail="Written by backends directly"
                                />
                                <HealthMetricCard
                                    title="Buffers (Clean)"
                                    value={Number(deep?.bgwriter?.buffers_clean || 0).toLocaleString()}
                                    unit=""
                                    icon={TrendingDown}
                                    color={THEME.textMuted}
                                    detail="Written by bgwriter"
                                />
                            </div>
                            <div
                                style={{
                                    padding: 16,
                                    borderRadius: 20,
                                    background: `${THEME.primary}06`,
                                    border: `1px solid ${THEME.primary}15`,
                                }}
                            >
                                <div style={{ fontSize: 11, color: THEME.textDim, lineHeight: 1.6 }}>
                                    <span style={{ color: THEME.primary, fontWeight: 700 }}>Buffer stats</span> are
                                    cumulative counters from{' '}
                                    <code style={{ color: THEME.primary }}>pg_stat_bgwriter</code>. A high "Buffers
                                    (Backend)" count relative to "Buffers (Checkpoint)" may indicate the bgwriter is not
                                    keeping up — consider tuning{' '}
                                    <code style={{ color: THEME.primary }}>bgwriter_lru_maxpages</code> and{' '}
                                    <code style={{ color: THEME.primary }}>bgwriter_delay</code>.
                                </div>
                            </div>

                            <GlassCard title="Buffer Efficiency per Table" noPad>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            {['Table', 'Heap Reads', 'Buffer Hits', 'Hit Ratio', 'Efficiency'].map(
                                                (h, i) => (
                                                    <th
                                                        key={h}
                                                        style={{
                                                            padding: '16px 22px',
                                                            textAlign: i > 0 ? 'right' : 'left',
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
                                                        {h}
                                                    </th>
                                                ),
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ioSparklines.map((t, i) => {
                                            const reads = Number(t.heap_blks_read || 0);
                                            const hits = Number(t.heap_blks_hit || 0);
                                            const ratio = reads + hits > 0 ? (hits / (reads + hits)) * 100 : 0;
                                            return (
                                                <tr key={i} className="perf-row-hover">
                                                    <td
                                                        style={{
                                                            padding: '16px 22px',
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                            color: THEME.textMain,
                                                            borderBottom: `1px solid ${THEME.grid}20`,
                                                        }}
                                                    >
                                                        {t.table_name || t.relname || `table_${i}`}
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: '16px 22px',
                                                            fontSize: 12,
                                                            textAlign: 'right',
                                                            color: THEME.textMuted,
                                                            fontVariantNumeric: 'tabular-nums',
                                                            borderBottom: `1px solid ${THEME.grid}20`,
                                                        }}
                                                    >
                                                        {reads.toLocaleString()}
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: '16px 22px',
                                                            fontSize: 12,
                                                            textAlign: 'right',
                                                            color: THEME.primary,
                                                            fontVariantNumeric: 'tabular-nums',
                                                            borderBottom: `1px solid ${THEME.grid}20`,
                                                        }}
                                                    >
                                                        {hits.toLocaleString()}
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: '16px 22px',
                                                            fontSize: 12,
                                                            textAlign: 'right',
                                                            fontWeight: 700,
                                                            color:
                                                                ratio > 95
                                                                    ? THEME.success
                                                                    : ratio > 80
                                                                      ? THEME.warning
                                                                      : THEME.danger,
                                                            fontVariantNumeric: 'tabular-nums',
                                                            borderBottom: `1px solid ${THEME.grid}20`,
                                                        }}
                                                    >
                                                        {ratio.toFixed(1)}%
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: '16px 22px',
                                                            borderBottom: `1px solid ${THEME.grid}20`,
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                            <SeverityBar
                                                                value={ratio}
                                                                max={100}
                                                                color={
                                                                    ratio > 95
                                                                        ? THEME.success
                                                                        : ratio > 80
                                                                          ? THEME.warning
                                                                          : THEME.danger
                                                                }
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </GlassCard>
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {selectedQuery && (
                <QueryAnalysisModal
                    queryData={selectedQuery}
                    onClose={() => setSelectedQuery(null)}
                    onApply={() => setSelectedQuery(null)}
                    onKill={(reason) => {
                        handleKillQuery(selectedQuery, reason);
                        setSelectedQuery(null);
                    }}
                    tags={queryTags}
                    onTag={handleTagQuery}
                />
            )}
        </div>
    );
};

export default PerformanceTab;
