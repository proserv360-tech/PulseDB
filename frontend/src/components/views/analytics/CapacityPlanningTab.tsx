/**
 * CapacityPlanningTabV3.tsx
 * ──────────────────────────────────────────────────────────────────────────
 * Operator-grade + AI-native capacity planning view.
 *
 * Differences vs. V2:
 *   • Datadog-dense top bar (title + scenario picker + live status + refresh).
 *   • AI summary banner — headline, confidence ring, drivers, Apply buttons.
 *   • 8-cell metric strip: Used, Growth/day, Full in, At 80% in, Est. savings,
 *     Cold rows %, Bloat, Monthly cost.
 *   • Bigger SVG forecast (historical, projection, confidence band, 80/100%
 *     capacity lines, anomaly pin, hover tooltip).
 *   • 3 side-by-side scenario cards (Slow / Current / Spike) with mini
 *     sparklines and hit-date callouts.
 *   • Tables heatmap — 8-week history per top table.
 *   • Ranked AI action plan with impact/confidence/effort + checkbox apply.
 *   • Collapsible "Backend endpoints needed" block explaining what the
 *     production API would need to make this real.
 *
 * Data: the production app doesn't expose `/api/capacity/*` yet; all data
 * flows through `_capacityHelpers.ts`. Types match what a future backend
 * response should look like.
 * ──────────────────────────────────────────────────────────────────────── */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    Archive,
    Bell,
    Box,
    ChevronDown,
    ChevronRight,
    Clock,
    DollarSign,
    HardDrive,
    Lightbulb,
    RefreshCcw,
    Server,
    Settings2,
    Sparkles,
    TrendingUp,
    Zap,
} from 'lucide-react';

import { THEME, useAdaptiveTheme, useGlobalRefresh, metricValue } from '../../../utils/theme';
import { TremorStyles } from '../../ui/tremor';

import {
    MONTHLY_COST_USD,
    SCENARIOS,
    buildForecast,
    buildSummary,
    daysUntilCapacity,
    forecastAt,
    fmtGB,
    fmtDays,
    impactTone,
    useCapacityData,
    type ForecastPoint,
    type Scenario,
    type Action,
} from './_capacityHelpers';

/* ─────────────────────────────────────────────────────────────────────────
 * Small inline sparkline
 * ────────────────────────────────────────────────────────────────────── */

const Spark: React.FC<{ values: number[]; color: string; w?: number; h?: number }> = ({
    values,
    color,
    w = 60,
    h = 18,
}) => {
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = Math.max(1, max - min);
    const step = w / Math.max(1, values.length - 1);
    const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * (h - 2) - 1).toFixed(1)}`);
    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
            <polyline
                points={pts.join(' ')}
                fill="none"
                stroke={color}
                strokeWidth={1.3}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    );
};

/* ─────────────────────────────────────────────────────────────────────────
 * Confidence ring (SVG)
 * ────────────────────────────────────────────────────────────────────── */

const ConfidenceRing: React.FC<{ pct: number; size?: number; color?: string }> = ({
    pct,
    size = 56,
    color = THEME.primary,
}) => {
    const r = size / 2 - 4;
    const circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;
    return (
        <div style={{ position: 'relative', width: size, height: size }}>
            <svg width={size} height={size}>
                <circle cx={size / 2} cy={size / 2} r={r} stroke={THEME.glassBorder} strokeWidth={4} fill="none" />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    stroke={color}
                    strokeWidth={4}
                    fill="none"
                    strokeDasharray={`${dash} ${circ}`}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </svg>
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: size < 50 ? 11 : 13,
                    fontWeight: 700,
                    color: THEME.textMain,
                    fontFamily: THEME.fontMono,
                }}
            >
                {Math.round(pct)}%
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────────────────────────────────
 * Metric strip cell
 * ────────────────────────────────────────────────────────────────────── */

const MetricCell: React.FC<{
    label: string;
    value: string;
    sub?: string;
    color?: string;
    spark?: number[];
    trend?: 'up' | 'down' | 'flat';
    icon?: React.ReactNode;
}> = ({ label, value, sub, color = THEME.primary, spark, trend, icon }) => (
    <div
        style={{
            flex: '1 1 0',
            minWidth: 120,
            padding: '10px 12px',
            borderRight: `1px solid ${THEME.glassBorder}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
        }}
    >
        <div
            style={{
                fontSize: 10,
                fontWeight: 700,
                color: THEME.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
            }}
        >
            {icon}
            {label}
            {trend === 'up' && <TrendingUp size={10} color={THEME.danger} />}
            {trend === 'down' && <TrendingUp size={10} color={THEME.success} style={{ transform: 'scaleY(-1)' }} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
                style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: THEME.textMain,
                    fontFamily: THEME.fontMono,
                    letterSpacing: '-0.02em',
                    lineHeight: 1,
                }}
            >
                {value}
            </span>
            {sub && <span style={{ fontSize: 10.5, color: THEME.textDim, fontWeight: 500 }}>{sub}</span>}
        </div>
        <div style={{ height: 18, marginTop: 2 }}>
            {spark ? <Spark values={spark} color={color} w={72} h={18} /> : null}
        </div>
    </div>
);

/* ─────────────────────────────────────────────────────────────────────────
 * Forecast chart (SVG, 700×280)
 * ────────────────────────────────────────────────────────────────────── */

interface HoverPoint {
    x: number;
    y: number;
    day: number;
    used: number;
    band?: number;
    alert?: string;
}

const ForecastChart: React.FC<{
    points: ForecastPoint[];
    multiplier: number;
    totalGB: number;
}> = ({ points, multiplier, totalGB }) => {
    const W = 720;
    const H = 300;
    const padL = 44;
    const padR = 20;
    const padT = 20;
    const padB = 28;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    const [hover, setHover] = useState<HoverPoint | null>(null);

    const allUsed = points.map((p) => p.used);
    const maxY = Math.max(totalGB + 40, Math.max(...allUsed) + 30);
    const minY = 0;
    const days = points.map((p) => p.day);
    const minX = Math.min(...days);
    const maxX = Math.max(...days);
    const xFor = (d: number) => padL + ((d - minX) / (maxX - minX)) * innerW;
    const yFor = (v: number) => padT + (1 - (v - minY) / (maxY - minY)) * innerH;

    const historical = points.filter((p) => p.day <= 0);
    const projected = points.filter((p) => p.day >= 0);
    const historicalPath = historical
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(p.day).toFixed(1)},${yFor(p.used).toFixed(1)}`)
        .join(' ');
    const projectedPath = projected
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(p.day).toFixed(1)},${yFor(p.used).toFixed(1)}`)
        .join(' ');

    // Band polygon
    const bandTop = projected.map((p) => `${xFor(p.day).toFixed(1)},${yFor(p.used + (p.band || 0)).toFixed(1)}`);
    const bandBot = [...projected]
        .reverse()
        .map((p) => `${xFor(p.day).toFixed(1)},${yFor(p.used - (p.band || 0)).toFixed(1)}`);
    const bandPath = `M${bandTop.join(' L')} L${bandBot.join(' L')} Z`;

    const capacityY = yFor(totalGB);
    const warnY = yFor(totalGB * 0.8);

    const days100 = daysUntilCapacity(multiplier);
    const hit100X = xFor(Math.min(maxX, Math.round(days100)));

    const anomaly = points.find((p) => p.alert);

    // Mouse move — find nearest point
    const onMove: React.MouseEventHandler<SVGSVGElement> = (e) => {
        const rect = (e.target as SVGElement).getBoundingClientRect?.();
        if (!rect) return;
        const parent = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const x = e.clientX - parent.left;
        const dVal = minX + ((x - padL) / innerW) * (maxX - minX);
        const nearest = points.reduce(
            (best, p) => (Math.abs(p.day - dVal) < Math.abs(best.day - dVal) ? p : best),
            points[0],
        );
        setHover({
            x: xFor(nearest.day),
            y: yFor(nearest.used),
            day: nearest.day,
            used: nearest.used,
            band: nearest.band,
            alert: nearest.alert,
        });
    };

    // Y ticks
    const yTicks = [0, 100, 200, 300, 400, 500].filter((v) => v <= maxY);
    // X ticks (every 15 days)
    const xTicks = [-30, -15, 0, 15, 30, 45, 60];

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <svg
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                style={{ width: '100%', height: H, display: 'block' }}
                onMouseMove={onMove}
                onMouseLeave={() => setHover(null)}
            >
                {/* Grid */}
                {yTicks.map((v) => (
                    <g key={`gy${v}`}>
                        <line
                            x1={padL}
                            x2={W - padR}
                            y1={yFor(v)}
                            y2={yFor(v)}
                            stroke={THEME.glassBorder}
                            strokeWidth={0.5}
                            strokeDasharray="2 3"
                        />
                        <text
                            x={padL - 6}
                            y={yFor(v) + 3}
                            textAnchor="end"
                            fontSize={9.5}
                            fontFamily={THEME.fontMono}
                            fill={THEME.textDim}
                        >
                            {v}
                        </text>
                    </g>
                ))}
                {xTicks.map((d) => (
                    <g key={`gx${d}`}>
                        <text
                            x={xFor(d)}
                            y={H - 8}
                            textAnchor="middle"
                            fontSize={9.5}
                            fontFamily={THEME.fontMono}
                            fill={THEME.textDim}
                        >
                            {d === 0 ? 'today' : `${d > 0 ? '+' : ''}${d}d`}
                        </text>
                    </g>
                ))}

                {/* 80% capacity line */}
                <line
                    x1={padL}
                    x2={W - padR}
                    y1={warnY}
                    y2={warnY}
                    stroke={THEME.warning}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    opacity={0.55}
                />
                <text
                    x={W - padR - 4}
                    y={warnY - 4}
                    textAnchor="end"
                    fontSize={9.5}
                    fill={THEME.warning}
                    fontFamily={THEME.fontMono}
                >
                    80% • alert threshold
                </text>

                {/* 100% capacity line */}
                <line
                    x1={padL}
                    x2={W - padR}
                    y1={capacityY}
                    y2={capacityY}
                    stroke={THEME.danger}
                    strokeWidth={1.3}
                    strokeDasharray="5 4"
                />
                <text
                    x={W - padR - 4}
                    y={capacityY - 4}
                    textAnchor="end"
                    fontSize={9.5}
                    fill={THEME.danger}
                    fontFamily={THEME.fontMono}
                >
                    100% • {totalGB} GB
                </text>

                {/* Band polygon */}
                <path d={bandPath} fill={THEME.warning} opacity={0.11} />

                {/* Historical path — solid */}
                <path
                    d={historicalPath}
                    fill="none"
                    stroke={THEME.primary}
                    strokeWidth={1.8}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />
                {/* Projected path — dashed */}
                <path
                    d={projectedPath}
                    fill="none"
                    stroke={THEME.primary}
                    strokeWidth={1.8}
                    strokeDasharray="5 3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={0.9}
                />

                {/* Today marker */}
                <line
                    x1={xFor(0)}
                    x2={xFor(0)}
                    y1={padT}
                    y2={H - padB}
                    stroke={THEME.textDim}
                    strokeWidth={0.8}
                    strokeDasharray="2 3"
                />
                <text
                    x={xFor(0)}
                    y={padT - 4}
                    textAnchor="middle"
                    fontSize={9.5}
                    fill={THEME.textMuted}
                    fontFamily={THEME.fontMono}
                >
                    today
                </text>

                {/* Hit-capacity marker */}
                {days100 <= 60 && (
                    <>
                        <line
                            x1={hit100X}
                            x2={hit100X}
                            y1={padT}
                            y2={H - padB}
                            stroke={THEME.danger}
                            strokeWidth={1}
                            strokeDasharray="3 3"
                            opacity={0.75}
                        />
                        <circle cx={hit100X} cy={capacityY} r={4} fill={THEME.danger} />
                        <text
                            x={hit100X}
                            y={capacityY - 8}
                            textAnchor="middle"
                            fontSize={10}
                            fill={THEME.danger}
                            fontFamily={THEME.fontMono}
                            fontWeight={700}
                        >
                            full • {Math.round(days100)}d
                        </text>
                    </>
                )}

                {/* Anomaly pin */}
                {anomaly && (
                    <g>
                        <circle
                            cx={xFor(anomaly.day)}
                            cy={yFor(anomaly.used)}
                            r={5}
                            fill={THEME.warning}
                            opacity={0.85}
                        />
                        <circle
                            cx={xFor(anomaly.day)}
                            cy={yFor(anomaly.used)}
                            r={9}
                            fill="none"
                            stroke={THEME.warning}
                            opacity={0.5}
                        />
                    </g>
                )}

                {/* Hover crosshair + dot */}
                {hover && (
                    <g>
                        <line
                            x1={hover.x}
                            x2={hover.x}
                            y1={padT}
                            y2={H - padB}
                            stroke={THEME.textMuted}
                            strokeWidth={0.5}
                        />
                        <circle cx={hover.x} cy={hover.y} r={4} fill={THEME.primary} />
                    </g>
                )}
            </svg>

            {/* Hover tooltip */}
            {hover && (
                <div
                    style={{
                        position: 'absolute',
                        top: Math.max(8, hover.y - 10),
                        left: Math.min(hover.x + 16, 520),
                        padding: '6px 9px',
                        borderRadius: 6,
                        background: THEME.surfaceRaised ?? THEME.surface,
                        border: `1px solid ${THEME.glassBorder}`,
                        fontSize: 11,
                        color: THEME.textMain,
                        fontFamily: THEME.fontMono,
                        pointerEvents: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                    }}
                >
                    <div style={{ color: THEME.textMuted, fontSize: 10 }}>
                        {hover.day === 0 ? 'today' : hover.day > 0 ? `+${hover.day}d` : `${hover.day}d`}
                    </div>
                    <div>{fmtGB(hover.used)}</div>
                    {hover.band !== undefined && (
                        <div style={{ color: THEME.textMuted, fontSize: 10 }}>±{hover.band.toFixed(0)} GB</div>
                    )}
                    {hover.alert && <div style={{ color: THEME.warning, fontSize: 10 }}>{hover.alert}</div>}
                </div>
            )}
        </div>
    );
};

/* ─────────────────────────────────────────────────────────────────────────
 * Scenario card
 * ────────────────────────────────────────────────────────────────────── */

const ScenarioCard: React.FC<{
    scenario: Scenario;
    active: boolean;
    onSelect: () => void;
}> = ({ scenario, active, onSelect }) => {
    const forecast = useMemo(() => buildForecast(scenario.multiplier, 60), [scenario.multiplier]);
    const days = daysUntilCapacity(scenario.multiplier);
    const hitDate = new Date(Date.now() + days * 86_400_000);
    const projectedValues = forecast.filter((p) => p.day >= 0).map((p) => p.used);
    const color = scenario.multiplier === 1 ? THEME.primary : scenario.multiplier > 1 ? THEME.danger : THEME.success;

    return (
        <button
            type="button"
            onClick={onSelect}
            style={{
                flex: '1 1 220px',
                minWidth: 200,
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 10,
                background: active ? (THEME.surfaceRaised ?? THEME.surface) : THEME.surface,
                border: `1.5px solid ${active ? color : THEME.glassBorder}`,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'border-color 120ms ease',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: color,
                        }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 700, color: THEME.textMain }}>{scenario.label}</span>
                </div>
                <span
                    style={{
                        fontSize: 10,
                        color: THEME.textDim,
                        fontFamily: THEME.fontMono,
                    }}
                >
                    ×{scenario.multiplier}
                </span>
            </div>
            <div style={{ fontSize: 11, color: THEME.textMuted, lineHeight: 1.4 }}>{scenario.description}</div>
            <div>
                <Spark values={projectedValues} color={color} w={200} h={40} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                    <div
                        style={{
                            fontSize: 10,
                            color: THEME.textDim,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                        }}
                    >
                        Full in
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: metricValue(color), fontFamily: THEME.fontMono }}>
                        {fmtDays(days)}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div
                        style={{
                            fontSize: 10,
                            color: THEME.textDim,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                        }}
                    >
                        Hit date
                    </div>
                    <div style={{ fontSize: 11, color: THEME.textMain, fontFamily: THEME.fontMono }}>
                        {hitDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                </div>
            </div>
        </button>
    );
};

/* ─────────────────────────────────────────────────────────────────────────
 * Tables heatmap row
 * ────────────────────────────────────────────────────────────────────── */

const HEATMAP_SCALE = [
    { max: 10, bg: `${THEME.info}15` },
    { max: 30, bg: `${THEME.info}35` },
    { max: 60, bg: `${THEME.warning}30` },
    { max: 100, bg: `${THEME.warning}55` },
    { max: Infinity, bg: `${THEME.danger}55` },
];

const heatColor = (v: number): string => {
    for (const stop of HEATMAP_SCALE) if (v <= stop.max) return stop.bg;
    return HEATMAP_SCALE[HEATMAP_SCALE.length - 1].bg;
};

const healthDot = (health: 'healthy' | 'slow' | 'hot'): string =>
    health === 'hot' ? THEME.danger : health === 'slow' ? THEME.warning : THEME.success;

/* ─────────────────────────────────────────────────────────────────────────
 * Category → icon helper for actions
 * ────────────────────────────────────────────────────────────────────── */

const ActionIcon: React.FC<{ category: Action['category']; size?: number }> = ({ category, size = 13 }) => {
    const color = THEME.textMuted;
    switch (category) {
        case 'archive':
            return <Archive size={size} color={color} />;
        case 'vacuum':
            return <Zap size={size} color={color} />;
        case 'tier':
            return <Box size={size} color={color} />;
        case 'config':
            return <Settings2 size={size} color={color} />;
        case 'alert':
            return <Bell size={size} color={color} />;
        default:
            return <Lightbulb size={size} color={color} />;
    }
};

/* ─────────────────────────────────────────────────────────────────────────
 * Main component
 * ────────────────────────────────────────────────────────────────────── */

const CapacityPlanningTabV3: React.FC = () => {
    useAdaptiveTheme();

    const [scenarioKey, setScenarioKey] = useState<Scenario['key']>('current');
    const [lastLoaded, setLastLoaded] = useState<Date>(new Date());
    const [refreshing, setRefreshing] = useState(false);
    const [applied, setApplied] = useState<Set<string>>(new Set());
    const [backendOpen, setBackendOpen] = useState(false);
    const [focusIdx, setFocusIdx] = useState(0);
    const searchRef = useRef<HTMLInputElement>(null);

    // ── Live data (falls back to mock until the first snapshot exists) ──
    const cap = useCapacityData(60);
    // Normalize live rows so the heatmap/render never throws on missing or
    // string-typed fields coming back from the API (pg NUMERIC can serialize
    // as strings; history may be shorter than the 8-week grid).
    const liveTables = useMemo(
        () =>
            (cap.tables || []).map((t: any) => {
                const num = (x: any, d = 0) => {
                    const n = Number(x);
                    return Number.isFinite(n) ? n : d;
                };
                let weekly = Array.isArray(t.weekly) ? t.weekly.map((v: any) => num(v)) : [];
                if (weekly.length === 0) weekly = [num(t.sizeGB)];
                // pad/trim to exactly 8 columns to match the grid header
                while (weekly.length < 8) weekly.unshift(weekly[0] ?? 0);
                weekly = weekly.slice(-8);
                return {
                    name: t.name ?? 'unknown',
                    sizeGB: num(t.sizeGB),
                    rowsMillions: num(t.rowsMillions),
                    growthPctPerWeek: num(t.growthPctPerWeek),
                    health: t.health === 'hot' || t.health === 'slow' || t.health === 'healthy' ? t.health : 'healthy',
                    weekly,
                };
            }),
        [cap.tables],
    );
    const liveActions = useMemo(
        () =>
            (cap.actions || []).map((a: any) => ({
                id: a.id ?? Math.random().toString(36).slice(2),
                title: a.title ?? '',
                detail: a.detail ?? '',
                impact: a.impact === 'high' || a.impact === 'med' || a.impact === 'low' ? a.impact : 'low',
                estSavingsGB: Number.isFinite(Number(a.estSavingsGB)) ? Number(a.estSavingsGB) : 0,
                confidencePct: Number.isFinite(Number(a.confidencePct)) ? Number(a.confidencePct) : 0,
                effortHours: Number.isFinite(Number(a.effortHours)) ? Number(a.effortHours) : 0,
                category: a.category ?? 'config',
            })),
        [cap.actions],
    );

    const reload = useCallback(() => {
        setRefreshing(true);
        cap.reload();
        setLastLoaded(new Date());
        // brief spinner for UX; cap.loading drives the real state
        setTimeout(() => setRefreshing(false), 300);
    }, [cap]);
    useGlobalRefresh(reload);

    const scenario = useMemo(() => SCENARIOS.find((s) => s.key === scenarioKey) ?? SCENARIOS[1], [scenarioKey]);

    // Use live forecast when available, scaled by the selected scenario multiplier
    // relative to "current"; otherwise fall back to the deterministic generator.
    const forecast = useMemo<ForecastPoint[]>(() => {
        if (cap.forecastPoints && cap.forecastPoints.length) {
            const m = scenario.multiplier;
            const base = Number(cap.stats.usedGB) || 0;
            return cap.forecastPoints.map((p: any) => {
                const day = Number(p.day) || 0;
                const used = Number(p.used) || 0;
                const band = p.band != null ? Number(p.band) : undefined;
                const scaled = day > 0 && m !== 1 ? base + (used - base) * m : used;
                return { day, used: scaled, band, alert: p.alert };
            });
        }
        return buildForecast(scenario.multiplier, 60);
    }, [cap.forecastPoints, cap.stats.usedGB, scenario.multiplier]);

    const summary = useMemo(() => buildSummary(scenario.multiplier), [scenario.multiplier]);

    const used = cap.stats.usedGB;
    const totalGB = cap.stats.totalGB;
    const usedPct = (used / totalGB) * 100;
    const dailyGrowth = cap.stats.growthGBPerDay * scenario.multiplier;
    const daysTo80 = dailyGrowth > 0 ? Math.max(0, (totalGB * 0.8 - used) / dailyGrowth) : Infinity;
    const savingsGB = liveActions.reduce((s, a) => s + a.estSavingsGB, 0);
    const last30Used = forecast.filter((p) => p.day >= -30 && p.day <= 0).map((p) => p.used);
    const next30Used = forecast.filter((p) => p.day >= 0 && p.day <= 30).map((p) => p.used);

    // Keyboard shortcuts
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement;
            const inInput = t && ['INPUT', 'TEXTAREA'].includes(t.tagName);
            if (inInput) return;
            if (e.key === '1') setScenarioKey('slow');
            if (e.key === '2') setScenarioKey('current');
            if (e.key === '3') setScenarioKey('spike');
            if (e.key === 'j') setFocusIdx((i) => Math.min(liveActions.length - 1, i + 1));
            if (e.key === 'k') setFocusIdx((i) => Math.max(0, i - 1));
            if (e.key === 'Enter') {
                const a = liveActions[focusIdx];
                if (a)
                    setApplied((s) => {
                        const n = new Set(s);
                        if (n.has(a.id)) n.delete(a.id);
                        else n.add(a.id);
                        return n;
                    });
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [focusIdx, liveActions]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 0 40px' }}>
            <TremorStyles />

            {/* Top bar */}
            <header
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: THEME.surface,
                    border: `1px solid ${THEME.glassBorder}`,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <HardDrive size={14} color={THEME.primary} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: THEME.textMain }}>Capacity planning</span>
                    <span
                        style={{
                            fontSize: 10.5,
                            color: THEME.textDim,
                            fontFamily: THEME.fontMono,
                        }}
                    >
                        {used.toFixed(0)}/{totalGB} GB{cap.live ? '' : ' (sample)'}
                    </span>
                </div>

                {/* Segmented scenario picker */}
                <div
                    style={{
                        display: 'inline-flex',
                        padding: 2,
                        borderRadius: 8,
                        border: `1px solid ${THEME.glassBorder}`,
                        background: THEME.surface,
                    }}
                >
                    {SCENARIOS.map((s, i) => (
                        <button
                            key={s.key}
                            type="button"
                            onClick={() => setScenarioKey(s.key)}
                            style={{
                                padding: '5px 10px',
                                borderRadius: 6,
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: 11.5,
                                fontWeight: 600,
                                color: scenarioKey === s.key ? THEME.textMain : THEME.textMuted,
                                background:
                                    scenarioKey === s.key ? (THEME.surfaceRaised ?? THEME.surfaceHover) : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                            }}
                            title={`${s.description} — press ${i + 1}`}
                        >
                            {s.label}
                            <kbd
                                style={{
                                    padding: '0 4px',
                                    borderRadius: 3,
                                    fontSize: 9,
                                    fontFamily: THEME.fontMono,
                                    color: THEME.textDim,
                                    border: `1px solid ${THEME.glassBorder}`,
                                }}
                            >
                                {i + 1}
                            </kbd>
                        </button>
                    ))}
                </div>

                <div style={{ flex: 1 }} />

                <div
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 11,
                        color: THEME.textMuted,
                        fontFamily: THEME.fontMono,
                    }}
                >
                    <span
                        style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: THEME.success,
                            boxShadow: `0 0 8px ${THEME.success}`,
                        }}
                    />
                    model trained • {lastLoaded.toLocaleTimeString()}
                </div>

                <button
                    type="button"
                    onClick={reload}
                    disabled={refreshing}
                    aria-label="Refresh"
                    style={{
                        padding: 7,
                        borderRadius: 8,
                        border: `1px solid ${THEME.glassBorder}`,
                        background: THEME.surface,
                        color: THEME.textMuted,
                        cursor: refreshing ? 'progress' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <RefreshCcw size={13} className={refreshing ? 'ov-spin' : undefined} />
                </button>
            </header>

            {/* AI Summary banner */}
            <section
                style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    gap: 14,
                    padding: '14px 16px',
                    borderRadius: 10,
                    background: `linear-gradient(135deg, ${THEME.primary}10, ${THEME.surface})`,
                    border: `1px solid ${THEME.primary}40`,
                    flexWrap: 'wrap',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        minWidth: 220,
                    }}
                >
                    <ConfidenceRing pct={summary.confidencePct} size={64} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div
                            style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: THEME.textMuted,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            <Sparkles size={10} color={THEME.primary} />
                            AI forecast
                        </div>
                        <div style={{ fontSize: 12, color: THEME.textMain, fontWeight: 600 }}>
                            {fmtDays(summary.daysUntilFull)} runway
                        </div>
                        <div style={{ fontSize: 10.5, color: THEME.textMuted, fontFamily: THEME.fontMono }}>
                            ±{summary.bandDays}d • hits {summary.hitDateLabel}
                        </div>
                    </div>
                </div>

                <div style={{ flex: '1 1 320px', minWidth: 280 }}>
                    <div
                        style={{
                            fontSize: 14,
                            color: THEME.textMain,
                            lineHeight: 1.4,
                            fontWeight: 500,
                            marginBottom: 8,
                        }}
                    >
                        {summary.headline}
                    </div>
                    <ul
                        style={{
                            listStyle: 'none',
                            margin: 0,
                            padding: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                        }}
                    >
                        {summary.drivers.map((d, i) => (
                            <li
                                key={i}
                                style={{
                                    fontSize: 11.5,
                                    color: THEME.textMuted,
                                    lineHeight: 1.4,
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 6,
                                }}
                            >
                                <span
                                    style={{
                                        marginTop: 6,
                                        width: 4,
                                        height: 4,
                                        borderRadius: '50%',
                                        background: THEME.primary,
                                        flexShrink: 0,
                                    }}
                                />
                                {d}
                            </li>
                        ))}
                    </ul>
                </div>

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        alignSelf: 'center',
                    }}
                >
                    <button
                        type="button"
                        style={{
                            padding: '7px 14px',
                            borderRadius: 6,
                            border: 'none',
                            cursor: 'pointer',
                            background: THEME.primary,
                            color: '#fff',
                            fontSize: 12,
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <Zap size={12} /> Apply plan
                    </button>
                    <button
                        type="button"
                        style={{
                            padding: '7px 14px',
                            borderRadius: 6,
                            border: `1px solid ${THEME.glassBorder}`,
                            background: 'transparent',
                            color: THEME.textMuted,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 500,
                        }}
                    >
                        See why
                    </button>
                </div>
            </section>

            {/* Metric strip — 8 cells */}
            <section
                style={{
                    display: 'flex',
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: THEME.surface,
                    border: `1px solid ${THEME.glassBorder}`,
                    flexWrap: 'wrap',
                }}
            >
                <MetricCell
                    label="Storage used"
                    value={`${usedPct.toFixed(0)}%`}
                    sub={`${used} GB`}
                    color={usedPct > 80 ? THEME.danger : usedPct > 60 ? THEME.warning : THEME.success}
                    spark={last30Used}
                    trend="up"
                    icon={<HardDrive size={10} color={THEME.textMuted} />}
                />
                <MetricCell
                    label="Growth / day"
                    value={`${dailyGrowth.toFixed(1)} GB`}
                    sub={scenario.key === 'current' ? 'observed' : scenario.label.toLowerCase()}
                    color={THEME.primary}
                    spark={next30Used}
                    trend="up"
                />
                <MetricCell
                    label="Full in"
                    value={fmtDays(summary.daysUntilFull)}
                    sub={`±${summary.bandDays}d`}
                    color={summary.daysUntilFull < 45 ? THEME.danger : THEME.warning}
                />
                <MetricCell
                    label="At 80% in"
                    value={fmtDays(daysTo80)}
                    sub="alert trigger"
                    color={THEME.warning}
                    icon={<Bell size={10} color={THEME.textMuted} />}
                />
                <MetricCell
                    label="Savings avail."
                    value={fmtGB(savingsGB)}
                    sub="if all applied"
                    color={THEME.success}
                    icon={<Sparkles size={10} color={THEME.textMuted} />}
                />
                <MetricCell label="Cold rows" value={`${cap.stats.coldRowPct}%`} sub=">90 days" color={THEME.info} />
                <MetricCell label="Bloat" value={`${cap.stats.bloatGB} GB`} sub="reclaimable" color={THEME.info} />
                <MetricCell
                    label="Monthly cost"
                    value={`$${MONTHLY_COST_USD}`}
                    sub="at current rate"
                    color={THEME.textMuted}
                    icon={<DollarSign size={10} color={THEME.textMuted} />}
                />
            </section>

            {/* Forecast chart */}
            <section
                style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: THEME.surface,
                    border: `1px solid ${THEME.glassBorder}`,
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        marginBottom: 6,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: THEME.textMain }}>90-day forecast</span>
                        <span style={{ fontSize: 10.5, color: THEME.textDim }}>
                            last 30d + next 60d • {scenario.label}
                        </span>
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            fontSize: 10,
                            color: THEME.textMuted,
                        }}
                    >
                        <Legend color={THEME.primary} label="Historical" />
                        <Legend color={THEME.primary} label="Projection" dashed />
                        <Legend color={THEME.warning} label="Uncertainty" band />
                        <Legend color={THEME.danger} label="Capacity" dashed />
                    </div>
                </div>
                <ForecastChart points={forecast} multiplier={scenario.multiplier} totalGB={totalGB} />
            </section>

            {/* Scenario comparison */}
            <section style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {SCENARIOS.map((s) => (
                    <ScenarioCard
                        key={s.key}
                        scenario={s}
                        active={s.key === scenarioKey}
                        onSelect={() => setScenarioKey(s.key)}
                    />
                ))}
            </section>

            {/* Tables heatmap */}
            <section
                style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: THEME.surface,
                    border: `1px solid ${THEME.glassBorder}`,
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 10,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Server size={13} color={THEME.primary} />
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: THEME.textMain }}>
                            Top tables — 8-week heatmap
                        </span>
                        <span style={{ fontSize: 10.5, color: THEME.textDim }}>size per week • darker = larger</span>
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            fontSize: 10,
                            color: THEME.textMuted,
                        }}
                    >
                        {HEATMAP_SCALE.slice(0, 5).map((s, i) => (
                            <span
                                key={i}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                }}
                            >
                                <span
                                    style={{
                                        width: 10,
                                        height: 10,
                                        borderRadius: 2,
                                        background: s.bg,
                                        border: `1px solid ${THEME.glassBorder}`,
                                    }}
                                />
                            </span>
                        ))}
                        <span style={{ fontFamily: THEME.fontMono }}>0 → {forecastAt(0, 1).toFixed(0)}+ GB</span>
                    </div>
                </div>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '180px 58px 60px 58px repeat(8, 1fr)',
                        columnGap: 4,
                        rowGap: 4,
                        alignItems: 'center',
                        fontSize: 11,
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            color: THEME.textDim,
                            fontWeight: 600,
                            fontSize: 10,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                        }}
                    >
                        Table
                    </div>
                    <div
                        style={{
                            color: THEME.textDim,
                            fontWeight: 600,
                            fontSize: 10,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            textAlign: 'right',
                        }}
                    >
                        Size
                    </div>
                    <div
                        style={{
                            color: THEME.textDim,
                            fontWeight: 600,
                            fontSize: 10,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            textAlign: 'right',
                        }}
                    >
                        Rows
                    </div>
                    <div
                        style={{
                            color: THEME.textDim,
                            fontWeight: 600,
                            fontSize: 10,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            textAlign: 'right',
                        }}
                    >
                        Δ/wk
                    </div>
                    {Array.from({ length: 8 }, (_, i) => (
                        <div
                            key={`wk${i}`}
                            style={{
                                color: THEME.textDim,
                                fontWeight: 600,
                                fontSize: 9,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                textAlign: 'center',
                            }}
                        >
                            W-{7 - i}
                        </div>
                    ))}

                    {/* Rows */}
                    {liveTables.map((t) => (
                        <React.Fragment key={t.name}>
                            <div
                                style={{
                                    fontFamily: THEME.fontMono,
                                    color: THEME.textMain,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                <span
                                    style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        background: healthDot(t.health),
                                        flexShrink: 0,
                                    }}
                                />
                                {t.name}
                            </div>
                            <div
                                style={{
                                    textAlign: 'right',
                                    color: THEME.textMain,
                                    fontFamily: THEME.fontMono,
                                    fontSize: 11,
                                }}
                            >
                                {t.sizeGB}
                                <span style={{ color: THEME.textDim, fontSize: 10 }}> GB</span>
                            </div>
                            <div
                                style={{
                                    textAlign: 'right',
                                    color: THEME.textMuted,
                                    fontFamily: THEME.fontMono,
                                    fontSize: 10.5,
                                }}
                            >
                                {t.rowsMillions}M
                            </div>
                            <div
                                style={{
                                    textAlign: 'right',
                                    color:
                                        t.growthPctPerWeek >= 3
                                            ? THEME.danger
                                            : t.growthPctPerWeek >= 1.5
                                              ? THEME.warning
                                              : THEME.success,
                                    fontFamily: THEME.fontMono,
                                    fontSize: 10.5,
                                    fontWeight: 600,
                                }}
                            >
                                +{t.growthPctPerWeek}%
                            </div>
                            {t.weekly.map((v, i) => (
                                <div
                                    key={i}
                                    title={`W-${7 - i}: ${v} GB`}
                                    style={{
                                        height: 22,
                                        borderRadius: 3,
                                        background: heatColor(v),
                                        border: `1px solid ${THEME.glassBorder}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: THEME.textMain,
                                        fontFamily: THEME.fontMono,
                                        fontSize: 9.5,
                                        fontWeight: 500,
                                    }}
                                >
                                    {v.toFixed(0)}
                                </div>
                            ))}
                        </React.Fragment>
                    ))}
                </div>
            </section>

            {/* AI-ranked action plan */}
            <section
                style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: THEME.surface,
                    border: `1px solid ${THEME.glassBorder}`,
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 10,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkles size={13} color={THEME.primary} />
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: THEME.textMain }}>AI action plan</span>
                        <span style={{ fontSize: 10.5, color: THEME.textDim }}>
                            ranked by impact × confidence ÷ effort
                        </span>
                    </div>
                    <div
                        style={{
                            fontSize: 11,
                            color: THEME.textMuted,
                            fontFamily: THEME.fontMono,
                        }}
                    >
                        {applied.size}/{liveActions.length} selected •
                        <span style={{ color: THEME.success, marginLeft: 4 }}>
                            {fmtGB(
                                liveActions.filter((a) => applied.has(a.id)).reduce((s, a) => s + a.estSavingsGB, 0),
                            )}{' '}
                            savings
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {liveActions.map((a, i) => {
                        const tone = impactTone(a.impact);
                        const isFocus = i === focusIdx;
                        const isApplied = applied.has(a.id);
                        return (
                            <div
                                key={a.id}
                                onClick={() =>
                                    setApplied((s) => {
                                        const n = new Set(s);
                                        if (n.has(a.id)) n.delete(a.id);
                                        else n.add(a.id);
                                        return n;
                                    })
                                }
                                role="button"
                                tabIndex={0}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '20px 24px 4px 1fr 120px 70px 60px',
                                    columnGap: 10,
                                    alignItems: 'center',
                                    padding: '8px 10px',
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    background: isFocus
                                        ? (THEME.surfaceHover ?? THEME.surface)
                                        : isApplied
                                          ? `${THEME.success}08`
                                          : 'transparent',
                                    border: `1px solid ${isFocus ? THEME.primary : isApplied ? `${THEME.success}40` : THEME.glassBorder}`,
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={isApplied}
                                    onChange={() => {}}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ accentColor: THEME.primary, cursor: 'pointer' }}
                                />
                                <div
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 22,
                                        height: 22,
                                        borderRadius: '50%',
                                        background: `${THEME.primary}18`,
                                        color: THEME.primary,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        fontFamily: THEME.fontMono,
                                    }}
                                >
                                    {i + 1}
                                </div>
                                <div
                                    style={{
                                        width: 4,
                                        height: 28,
                                        borderRadius: 2,
                                        background: tone.color,
                                    }}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            fontSize: 12.5,
                                            color: THEME.textMain,
                                            fontWeight: 600,
                                        }}
                                    >
                                        <ActionIcon category={a.category} />
                                        {a.title}
                                        <span
                                            style={{
                                                padding: '1px 6px',
                                                borderRadius: 3,
                                                fontSize: 9,
                                                fontWeight: 700,
                                                color: tone.color,
                                                background: `${tone.color}18`,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                            }}
                                        >
                                            {a.impact}
                                        </span>
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            color: THEME.textMuted,
                                            lineHeight: 1.4,
                                        }}
                                    >
                                        {a.detail}
                                    </div>
                                </div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: THEME.success,
                                        fontFamily: THEME.fontMono,
                                        textAlign: 'right',
                                    }}
                                >
                                    {a.estSavingsGB > 0 ? `+${a.estSavingsGB} GB` : '—'}
                                    <div
                                        style={{
                                            fontSize: 9.5,
                                            color: THEME.textDim,
                                            marginTop: 1,
                                        }}
                                    >
                                        {a.estSavingsGB > 0 && dailyGrowth > 0
                                            ? `+${Math.round(a.estSavingsGB / dailyGrowth)}d runway`
                                            : a.estSavingsGB > 0
                                              ? `${a.estSavingsGB} GB freed`
                                              : 'no GB impact'}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <ConfidenceRing pct={a.confidencePct} size={34} color={tone.color} />
                                </div>
                                <div
                                    style={{
                                        textAlign: 'right',
                                        fontSize: 11,
                                        color: THEME.textMuted,
                                        fontFamily: THEME.fontMono,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'flex-end',
                                        gap: 3,
                                    }}
                                >
                                    <Clock size={10} />
                                    {a.effortHours < 1 ? `${Math.round(a.effortHours * 60)}m` : `${a.effortHours}h`}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Backend endpoints block */}
            <section
                style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: THEME.surface,
                    border: `1px dashed ${THEME.glassBorder}`,
                }}
            >
                <button
                    type="button"
                    onClick={() => setBackendOpen((v) => !v)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: THEME.textMuted,
                        fontSize: 11,
                        fontWeight: 600,
                        padding: 0,
                    }}
                >
                    {backendOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    Backend endpoints needed to make this real
                </button>
                {backendOpen && (
                    <div
                        style={{
                            marginTop: 10,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                            fontSize: 11,
                            color: THEME.textMuted,
                            fontFamily: THEME.fontMono,
                        }}
                    >
                        <div style={{ color: THEME.textDim, fontFamily: 'inherit', fontStyle: 'italic' }}>
                            Today this view runs on deterministic generators. To wire it to real telemetry we'd need:
                        </div>
                        <EndpointRow
                            verb="GET"
                            path="/api/capacity/stats"
                            desc="Current used / total GB, daily growth rate, hit date, monthly cost."
                        />
                        <EndpointRow
                            verb="GET"
                            path="/api/capacity/forecast?days=60"
                            desc="Historical + projected series with optional confidence bands."
                        />
                        <EndpointRow
                            verb="GET"
                            path="/api/capacity/tables?limit=8"
                            desc="Top tables with size, rows, growth %, health, 8-week history."
                        />
                        <EndpointRow
                            verb="GET"
                            path="/api/capacity/actions"
                            desc="Ranked recommendations with impact, savings, effort, confidence."
                        />
                        <EndpointRow
                            verb="POST"
                            path="/api/capacity/actions/:id/apply"
                            desc="Applies a recommendation (e.g. vacuum, archive, enable compression)."
                        />
                        <EndpointRow
                            verb="POST"
                            path="/api/ai/capacity/summary"
                            desc="LLM-generated summary given stats + top tables + recent anomalies."
                        />
                    </div>
                )}
            </section>

            {/* Keyboard hints footer */}
            <footer
                style={{
                    display: 'flex',
                    gap: 14,
                    justifyContent: 'center',
                    fontSize: 10.5,
                    color: THEME.textDim,
                    fontFamily: THEME.fontMono,
                    paddingTop: 4,
                }}
            >
                <Kbd label="1/2/3" meaning="switch scenario" />
                <Kbd label="j/k" meaning="move action focus" />
                <Kbd label="Enter" meaning="toggle action" />
                <span>model retrained every 6h</span>
            </footer>
        </div>
    );
};

/* ─────────────────────────────────────────────────────────────────────────
 * Small helpers
 * ────────────────────────────────────────────────────────────────────── */

const Legend: React.FC<{ color: string; label: string; dashed?: boolean; band?: boolean }> = ({
    color,
    label,
    dashed,
    band,
}) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {band ? (
            <span
                style={{
                    width: 16,
                    height: 8,
                    borderRadius: 2,
                    background: `${color}30`,
                    border: `1px solid ${color}60`,
                }}
            />
        ) : (
            <span
                style={{
                    width: 16,
                    height: 0,
                    borderTop: `${dashed ? '2px dashed' : '2px solid'} ${color}`,
                }}
            />
        )}
        {label}
    </span>
);

const Kbd: React.FC<{ label: string; meaning: string }> = ({ label, meaning }) => (
    <span>
        <kbd
            style={{
                padding: '1px 5px',
                borderRadius: 3,
                border: `1px solid ${THEME.glassBorder}`,
                fontSize: 10,
                fontFamily: THEME.fontMono,
                color: THEME.textMuted,
                marginRight: 4,
            }}
        >
            {label}
        </kbd>
        {meaning}
    </span>
);

const EndpointRow: React.FC<{ verb: string; path: string; desc: string }> = ({ verb, path, desc }) => (
    <div
        style={{
            display: 'grid',
            gridTemplateColumns: '42px 260px 1fr',
            columnGap: 10,
            alignItems: 'baseline',
        }}
    >
        <span
            style={{
                fontSize: 9,
                fontWeight: 700,
                color: verb === 'POST' ? THEME.warning : THEME.info,
                background: `${verb === 'POST' ? THEME.warning : THEME.info}18`,
                padding: '2px 5px',
                borderRadius: 3,
                textAlign: 'center',
            }}
        >
            {verb}
        </span>
        <span style={{ color: THEME.textMain }}>{path}</span>
        <span
            style={{
                fontFamily: 'inherit',
                color: THEME.textMuted,
                fontSize: 11,
                lineHeight: 1.4,
            }}
        >
            {desc}
        </span>
    </div>
);

export default CapacityPlanningTabV3;
