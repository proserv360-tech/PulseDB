/* ═══════════════════════════════════════════════════════════════════════════
   MetricsExplorer.tsx

   Renders a MetricCatalog as a searchable, filterable grid of KPI cards.
   Each card shows the metric's current value + sparkline; clicking expands it
   to a full time-series chart. The component is engine-agnostic — it takes a
   MetricCatalog and a "section to render" (or undefined for "all").

   Props:
     catalog       — the engine's MetricCatalog
     sectionKey    — only render metrics in this section (undefined = all)
     compactDefault — start in compact mode (no sparklines), default false
   ═══════════════════════════════════════════════════════════════════════════ */

import React, { useMemo, useState } from 'react';
import { THEME, metricValue } from '../../../utils/theme';
import {
    Metric,
    MetricCatalog,
    MetricSection,
    mockValue,
    mockTrend,
    makeSparkline,
    formatValue,
    filterMetrics,
    groupBySection,
} from '../../../utils/metricsCatalog';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Search, X, ChevronRight, ChevronDown, Maximize2, Minimize2, LayoutGrid, List, Filter } from 'lucide-react';

/* ── Tiny sparkline ───────────────────────────────────────────────────── */
const Sparkline: React.FC<{ data: number[]; color: string; w?: number; h?: number }> = ({
    data,
    color,
    w = 90,
    h = 28,
}) => {
    if (!data || data.length < 2) return <div style={{ width: w, height: h }} />;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ');
    const uid = `mxspk-${color.replace(/[^a-z0-9]/gi, '')}-${w}-${h}-${data.length}`;
    return (
        <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
            <defs>
                <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            </defs>
            <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${uid})`} />
            <polyline
                points={pts}
                fill="none"
                stroke={color}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

/* ── Ring gauge for percentages ────────────────────────────────────────── */
const RingGauge: React.FC<{ value: number; color: string; size?: number }> = ({ value, color, size = 72 }) => {
    const pct = Math.max(0, Math.min(100, value));
    const r = (size - 10) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;
    return (
        <div style={{ position: 'relative', width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${THEME.glassBorder}`} strokeWidth={6} />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth={6}
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
            </svg>
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: size / 4.5,
                    fontWeight: 800,
                    color,
                    fontFamily: THEME.fontMono,
                    letterSpacing: '-0.02em',
                }}
            >
                {pct.toFixed(0)}%
            </div>
        </div>
    );
};

/* ── Mini bar chart for distributions ──────────────────────────────────── */
const MiniBars: React.FC<{ data: number[]; color: string; w?: number; h?: number }> = ({
    data,
    color,
    w = 96,
    h = 32,
}) => {
    if (!data || data.length === 0) return <div style={{ width: w, height: h }} />;
    const max = Math.max(...data) || 1;
    const bw = Math.max(2, w / data.length - 1.5);
    return (
        <svg width={w} height={h}>
            {data.map((v, i) => {
                const barH = (v / max) * (h - 4);
                return (
                    <rect
                        key={i}
                        x={i * (bw + 1.5)}
                        y={h - barH - 2}
                        width={bw}
                        height={barH}
                        rx={1}
                        fill={color}
                        fillOpacity={0.65 + 0.35 * (v / max)}
                    />
                );
            })}
        </svg>
    );
};

/* ── Stacked progress bar — used/total ─────────────────────────────────── */
const StackedBar: React.FC<{ pct: number; color: string }> = ({ pct, color }) => {
    const p = Math.max(0, Math.min(100, pct));
    return (
        <div
            style={{
                height: 8,
                background: `${color}18`,
                borderRadius: 4,
                overflow: 'hidden',
                width: '100%',
            }}
        >
            <div
                style={{
                    height: '100%',
                    width: `${p}%`,
                    background: `linear-gradient(90deg, ${color}aa, ${color})`,
                    borderRadius: 4,
                    transition: 'width 0.8s ease',
                }}
            />
        </div>
    );
};

/* ── Smart viz router — picks the visualization for a metric format ────── */
const SmartViz: React.FC<{
    metric: Metric;
    value: number;
    color: string;
    spark: number[];
    compact?: boolean;
}> = ({ metric, value, color, spark, compact }) => {
    /* For percentages: a ring gauge. */
    if (metric.format === 'percent') {
        return (
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '4px 0',
                }}
            >
                <RingGauge value={value} color={color} size={compact ? 56 : 64} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            fontSize: 9.5,
                            color: THEME.textDim,
                            fontFamily: THEME.fontMono,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                        }}
                    >
                        of {metric.higherIsBetter === false ? 'cap' : 'target'}
                    </div>
                    <Sparkline data={spark} color={color} w={compact ? 70 : 100} h={20} />
                </div>
            </div>
        );
    }

    /* For currency/cost: bar chart with delta indicator. */
    if (metric.format === 'currency') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span
                        style={{
                            fontSize: compact ? 18 : 22,
                            fontWeight: 800,
                            color,
                            fontFamily: THEME.fontMono,
                            letterSpacing: '-0.02em',
                            lineHeight: 1,
                        }}
                    >
                        {formatValue(metric, value)}
                    </span>
                </div>
                <MiniBars data={spark.slice(-12)} color={color} w={compact ? 120 : 160} h={32} />
            </div>
        );
    }

    /* For bytes: big number + stacked progress bar showing fill %. */
    if (metric.format === 'bytes') {
        const pct = Math.min(100, (value / (metric.baseValue || value || 1)) * 100);
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span
                        style={{
                            fontSize: compact ? 18 : 22,
                            fontWeight: 800,
                            color,
                            fontFamily: THEME.fontMono,
                            letterSpacing: '-0.02em',
                            lineHeight: 1,
                        }}
                    >
                        {formatValue(metric, value)}
                    </span>
                    {metric.unit && <span style={{ fontSize: 10, color: THEME.textDim }}>{metric.unit}</span>}
                </div>
                <StackedBar pct={pct} color={color} />
            </div>
        );
    }

    /* For duration: small line chart. */
    if (metric.format === 'duration') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span
                        style={{
                            fontSize: compact ? 16 : 20,
                            fontWeight: 800,
                            color,
                            fontFamily: THEME.fontMono,
                            letterSpacing: '-0.02em',
                            lineHeight: 1,
                        }}
                    >
                        {formatValue(metric, value)}
                    </span>
                </div>
                <Sparkline data={spark} color={color} w={compact ? 130 : 180} h={36} />
            </div>
        );
    }

    /* For counts (events / sec, items / hour, etc.): big number + bars. */
    if (metric.format === 'count') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span
                        style={{
                            fontSize: compact ? 18 : 22,
                            fontWeight: 800,
                            color,
                            fontFamily: THEME.fontMono,
                            letterSpacing: '-0.02em',
                            lineHeight: 1,
                        }}
                    >
                        {formatValue(metric, value)}
                    </span>
                    {metric.unit && <span style={{ fontSize: 10, color: THEME.textDim }}>{metric.unit}</span>}
                </div>
                <MiniBars data={spark.slice(-14)} color={color} w={compact ? 110 : 150} h={28} />
            </div>
        );
    }

    /* Default — big number + area sparkline. */
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span
                    style={{
                        fontSize: compact ? 18 : 22,
                        fontWeight: 800,
                        color,
                        fontFamily: THEME.fontMono,
                        letterSpacing: '-0.02em',
                        lineHeight: 1,
                    }}
                >
                    {formatValue(metric, value)}
                </span>
                {metric.unit && <span style={{ fontSize: 10, color: THEME.textDim }}>{metric.unit}</span>}
            </div>
            <Sparkline data={spark} color={color} w={compact ? 110 : 150} h={28} />
        </div>
    );
};

/* ── Tier badge ───────────────────────────────────────────────────────── */
const TierBadge: React.FC<{ tier: Metric['tier'] }> = ({ tier }) => {
    const COLORS: Record<Metric['tier'], string> = {
        basic: THEME.success,
        intermediate: THEME.primary,
        advanced: THEME.warning,
    };
    const c = COLORS[tier];
    return (
        <span
            style={{
                fontSize: 8.5,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 4,
                background: `${c}18`,
                color: c,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontFamily: THEME.fontMono,
            }}
        >
            {tier}
        </span>
    );
};

/* ── KPI card ─────────────────────────────────────────────────────────── */
interface KpiCardProps {
    metric: Metric;
    color: string;
    expanded: boolean;
    onToggle: () => void;
    compact?: boolean;
    featured?: boolean;
}
const KpiCard: React.FC<KpiCardProps> = ({ metric, color, expanded, onToggle, compact, featured }) => {
    const value = mockValue(metric);
    const trend = mockTrend(metric);
    const spark = useMemo(() => makeSparkline(metric.id, metric.baseValue, metric.range), [metric]);

    /* When expanded → render a fuller AreaChart instead of just the sparkline. */
    if (expanded) {
        const data = spark.map((v, i) => ({ t: `T-${24 - i}h`, v }));
        return (
            <div
                style={{
                    gridColumn: '1 / -1',
                    background: THEME.surface,
                    borderRadius: 16,
                    border: `1px solid ${THEME.glassBorder}`,
                    borderTop: `2px solid ${color}`,
                    padding: '16px 18px 12px',
                    boxShadow: THEME.shadowSm,
                    position: 'relative',
                }}
            >
                <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}
                >
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span
                                style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: THEME.textMain,
                                    letterSpacing: '-0.01em',
                                }}
                            >
                                {metric.label}
                            </span>
                            <TierBadge tier={metric.tier} />
                            {metric.source && (
                                <span
                                    style={{
                                        fontSize: 9.5,
                                        color: THEME.textDim,
                                        fontFamily: THEME.fontMono,
                                    }}
                                >
                                    {metric.source}
                                </span>
                            )}
                        </div>
                        <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 2 }}>{metric.description}</div>
                    </div>
                    <button
                        onClick={onToggle}
                        title="Collapse"
                        style={{
                            background: 'transparent',
                            border: `1px solid ${THEME.glassBorder}`,
                            borderRadius: 8,
                            padding: 4,
                            cursor: 'pointer',
                            color: THEME.textMuted,
                        }}
                    >
                        <Minimize2 size={12} />
                    </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '6px 0 8px' }}>
                    <span
                        style={{
                            fontSize: 28,
                            fontWeight: 800,
                            color: metricValue(color),
                            fontFamily: THEME.fontMono,
                            letterSpacing: '-0.02em',
                            lineHeight: 1,
                        }}
                    >
                        {formatValue(metric, value)}
                    </span>
                    {metric.unit && <span style={{ fontSize: 12, color: THEME.textDim }}>{metric.unit}</span>}
                    <span
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: trend.up ? THEME.success : THEME.danger,
                            fontFamily: THEME.fontMono,
                        }}
                    >
                        {trend.up ? '↗' : '↘'} {trend.text}
                    </span>
                </div>
                <div style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id={`mx-${metric.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                            <XAxis dataKey="t" fontSize={10} stroke={THEME.textDim} />
                            <YAxis fontSize={10} stroke={THEME.textDim} />
                            <Tooltip
                                contentStyle={{
                                    background: THEME.surfaceRaised || THEME.surface,
                                    border: `1px solid ${THEME.glassBorder}`,
                                    borderRadius: 8,
                                    fontSize: 11,
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="v"
                                stroke={color}
                                strokeWidth={2}
                                fill={`url(#mx-${metric.id})`}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }

    /* Compact / regular KPI tile. */
    return (
        <button
            onClick={onToggle}
            style={{
                textAlign: 'left',
                background: featured ? `linear-gradient(135deg, ${color}0c, ${THEME.surface})` : THEME.surface,
                borderRadius: 14,
                border: `1px solid ${featured ? `${color}44` : THEME.glassBorder}`,
                borderTop: `2px solid ${color}`,
                padding: compact ? '10px 12px' : '14px 16px',
                boxShadow: THEME.shadowSm,
                display: 'flex',
                flexDirection: 'column',
                gap: compact ? 6 : 8,
                cursor: 'pointer',
                transition: THEME.transitionFast,
                fontFamily: THEME.fontBody,
                gridColumn: featured ? 'span 2' : undefined,
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${color}66`;
                e.currentTarget.style.boxShadow = THEME.shadowMd;
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = THEME.glassBorder;
                e.currentTarget.style.boxShadow = THEME.shadowSm;
            }}
            title={metric.description}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span
                        style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: THEME.textMuted,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            fontFamily: THEME.fontMono,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {metric.label}
                    </span>
                </div>
                <TierBadge tier={metric.tier} />
            </div>
            <SmartViz metric={metric} value={value} color={color} spark={spark} compact={compact} />
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 9.5,
                    color: THEME.textDim,
                    fontFamily: THEME.fontMono,
                    letterSpacing: '0.03em',
                }}
            >
                <span
                    style={{
                        fontWeight: 700,
                        color: trend.up ? THEME.success : THEME.danger,
                    }}
                >
                    {trend.up ? '↗' : '↘'} {trend.text}
                </span>
                {metric.source && !compact && (
                    <span
                        style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '60%',
                        }}
                        title={metric.source}
                    >
                        {metric.source}
                    </span>
                )}
            </div>
        </button>
    );
};

/* ── Section header ───────────────────────────────────────────────────── */
const SectionHeader: React.FC<{
    section: MetricSection;
    count: number;
    color: string;
    open: boolean;
    onToggle: () => void;
}> = ({ section, count, color, open, onToggle }) => (
    <button
        onClick={onToggle}
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '10px 4px',
            background: 'transparent',
            border: 'none',
            borderBottom: `1px solid ${THEME.glassBorder}`,
            cursor: 'pointer',
            fontFamily: THEME.fontBody,
            marginBottom: 12,
        }}
    >
        {open ? <ChevronDown size={14} color={THEME.textDim} /> : <ChevronRight size={14} color={THEME.textDim} />}
        <span
            style={{
                fontSize: 12,
                fontWeight: 700,
                color: THEME.textMain,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontFamily: THEME.fontMono,
            }}
        >
            {section.label}
        </span>
        <span
            style={{
                fontSize: 9.5,
                fontWeight: 700,
                color,
                background: `${color}14`,
                border: `1px solid ${color}30`,
                padding: '1px 8px',
                borderRadius: 10,
                fontFamily: THEME.fontMono,
            }}
        >
            {count}
        </span>
    </button>
);

/* ====================================================================
   MetricsExplorer
   ==================================================================== */
interface MetricsExplorerProps {
    catalog: MetricCatalog;
    sectionKey?: string;
    initialSearch?: string;
}

export const MetricsExplorer: React.FC<MetricsExplorerProps> = ({ catalog, sectionKey, initialSearch = '' }) => {
    const [search, setSearch] = useState(initialSearch);
    const [tierFilter, setTierFilter] = useState<'all' | Metric['tier']>('all');
    const [compact, setCompact] = useState(false);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

    const accent = catalog.accentColor;

    const filtered = useMemo(() => {
        let m = catalog.metrics;
        if (sectionKey) m = m.filter((x) => x.section === sectionKey);
        if (tierFilter !== 'all') m = m.filter((x) => x.tier === tierFilter);
        m = filterMetrics(m, search);
        return m;
    }, [catalog.metrics, sectionKey, search, tierFilter]);

    const grouped = useMemo(() => groupBySection(catalog, filtered), [catalog, filtered]);

    const toggleExpanded = (id: string) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const toggleSection = (key: string) =>
        setCollapsedSections((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Toolbar */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                    padding: '10px 12px',
                    background: THEME.glass,
                    border: `1px solid ${THEME.glassBorder}`,
                    borderRadius: 12,
                    backdropFilter: 'saturate(180%) blur(10px)',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flex: 1,
                        minWidth: 220,
                        padding: '6px 10px',
                        background: THEME.surfaceHover,
                        border: `1px solid ${THEME.glassBorder}`,
                        borderRadius: 8,
                    }}
                >
                    <Search size={13} color={THEME.textDim} />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={`Search ${catalog.metrics.length} metrics…`}
                        style={{
                            flex: 1,
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            color: THEME.textMain,
                            fontSize: 12,
                            fontFamily: THEME.fontBody,
                        }}
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: THEME.textDim,
                                display: 'flex',
                            }}
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Filter size={11} color={THEME.textDim} />
                    {(['all', 'basic', 'intermediate', 'advanced'] as const).map((t) => {
                        const isOn = tierFilter === t;
                        return (
                            <button
                                key={t}
                                onClick={() => setTierFilter(t)}
                                style={{
                                    fontSize: 10,
                                    fontWeight: isOn ? 700 : 600,
                                    padding: '3px 9px',
                                    borderRadius: 6,
                                    border: `1px solid ${isOn ? accent : THEME.glassBorder}`,
                                    background: isOn ? `${accent}18` : 'transparent',
                                    color: isOn ? accent : THEME.textMuted,
                                    cursor: 'pointer',
                                    fontFamily: THEME.fontMono,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                }}
                            >
                                {t}
                            </button>
                        );
                    })}
                </div>

                <button
                    onClick={() => setCompact((v) => !v)}
                    title={compact ? 'Card view' : 'Compact view'}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '5px 10px',
                        background: compact ? `${accent}14` : 'transparent',
                        border: `1px solid ${compact ? accent : THEME.glassBorder}`,
                        borderRadius: 8,
                        color: compact ? accent : THEME.textMuted,
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: THEME.fontBody,
                    }}
                >
                    {compact ? <List size={12} /> : <LayoutGrid size={12} />}
                    {compact ? 'Compact' : 'Cards'}
                </button>

                <div
                    style={{
                        fontSize: 10,
                        color: THEME.textDim,
                        fontFamily: THEME.fontMono,
                        letterSpacing: '0.04em',
                    }}
                >
                    {filtered.length} / {catalog.metrics.length}
                </div>
            </div>

            {filtered.length === 0 && (
                <div
                    style={{
                        padding: '40px 20px',
                        textAlign: 'center',
                        background: THEME.surface,
                        border: `1px dashed ${THEME.glassBorder}`,
                        borderRadius: 12,
                        color: THEME.textDim,
                        fontSize: 12,
                    }}
                >
                    No metrics match {search ? `"${search}"` : 'the current filters'}.
                </div>
            )}

            {grouped.map(({ section, metrics }) => {
                const sectionColor = section.color || accent;
                const isCollapsed = collapsedSections.has(section.key);
                return (
                    <div key={section.key}>
                        <SectionHeader
                            section={section}
                            count={metrics.length}
                            color={sectionColor}
                            open={!isCollapsed}
                            onToggle={() => toggleSection(section.key)}
                        />
                        {!isCollapsed && (
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: compact
                                        ? 'repeat(auto-fill, minmax(180px, 1fr))'
                                        : 'repeat(auto-fill, minmax(240px, 1fr))',
                                    gap: 12,
                                }}
                            >
                                {metrics.map((m, i) => (
                                    <KpiCard
                                        key={m.id}
                                        metric={m}
                                        color={m.color || sectionColor}
                                        expanded={expanded.has(m.id)}
                                        onToggle={() => toggleExpanded(m.id)}
                                        compact={compact}
                                        featured={!compact && i % 5 === 0}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default MetricsExplorer;
