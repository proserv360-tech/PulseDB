// ==========================================================================
//  DemoSnowflakeFullTab.tsx — bespoke Snowflake demo.
//
//  Panels:
//    Overview         — KPIs + credits trend with budget line + alerts
//    Credits Explorer — stacked credits by warehouse, by user, by role
//    Warehouse Recommender — interactive: suggest cluster count + size per WH
//    Clustering Depth — per-table clustering depth with auto-clustering status
//    Query History   — filterable job table w/ queued vs compile vs execute
//    Storage         — time-travel + failsafe + active treemap
//    Data Sharing    — inbound / outbound shares map
//    Replication     — account-level replication graph
// ==========================================================================

import React, { useState, useMemo } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { buildMetricsTab } from './useMetricsTab';
import catalog from '../../../utils/catalogs/snowflakeCatalog';
import DemoLayout, { Panel, StatusBadge, DataTable, TabPills, AlertRow } from './DemoLayout';
import {
    Database,
    Zap,
    DollarSign,
    Gauge,
    Layers,
    Share2,
    GitBranch,
    Activity,
    HardDrive,
    AlertTriangle,
    Clock,
    CheckCircle,
    TrendingUp,
    Settings,
    Box,
} from 'lucide-react';
import {
    AreaChart,
    Area,
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    ComposedChart,
    Treemap,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine,
    ResponsiveContainer,
    LabelList,
} from 'recharts';

const SF_BLUE = '#29B5E8';
const SF_NAVY = THEME.surfaceRaised;
const SF_AMBER = THEME.warning;
const SF_GREEN = THEME.success;
const SF_RED = THEME.dangerLight;

const now = Date.now();
const tMinus = (m: number) => new Date(now - m * 60_000).toISOString();
function fmtHour(iso: string) {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function formatBytes(n: number) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let i = 0,
        x = n;
    while (x >= 1024 && i < units.length - 1) {
        x /= 1024;
        i++;
    }
    return `${x.toFixed(x >= 10 ? 0 : 2)} ${units[i]}`;
}

// ─────────────────────────────────────────────────────────────────────────
const SF = {
    identity: {
        account: 'acme-analytics.us-east-1',
        edition: 'Business Critical',
        region: 'AWS us-east-1',
        cloud: 'AWS',
        org: 'ACME_ORG',
        warehouses: '5',
    },
    kpis: [
        { label: 'Credits (1h)', value: '12.4', unit: '', color: SF_BLUE, icon: Zap },
        { label: 'Est. cost (1h)', value: '$49.60', unit: '', color: SF_AMBER, icon: DollarSign },
        { label: 'Queries (1h)', value: '1,842', unit: '', color: SF_BLUE, icon: Activity },
        { label: 'Avg compile', value: '342', unit: 'ms', color: SF_AMBER, icon: Clock },
        { label: 'Avg exec', value: '2.8', unit: 's', color: SF_BLUE, icon: Gauge },
        { label: 'Time-travel', value: '412', unit: 'GB', color: SF_NAVY, icon: HardDrive },
    ],
    creditsTrend: Array.from({ length: 48 }, (_, i) => {
        const hour = i % 24;
        const etl = hour >= 1 && hour <= 4 ? 0.8 : hour >= 9 && hour <= 18 ? 0.4 : 0.12;
        return {
            t: tMinus((47 - i) * 5),
            ETL_WH: +(etl + Math.random() * 0.08).toFixed(3),
            REPORT_WH: +((hour >= 9 && hour <= 18 ? 0.28 : 0.06) + Math.random() * 0.05).toFixed(3),
            TRANSFORM_WH: +(0.12 + Math.random() * 0.06).toFixed(3),
            DEV_WH: +(0.04 + Math.random() * 0.02).toFixed(3),
        };
    }),
    creditsByUser: [
        { user: 'ETL_SERVICE', credits: 142.4, pct: 51.2 },
        { user: 'REPORTING_USER', credits: 62.8, pct: 22.6 },
        { user: 'TRANSFORM_DBT', credits: 38.4, pct: 13.8 },
        { user: 'ANALYST_ALICE', credits: 18.2, pct: 6.6 },
        { user: 'ANALYST_BOB', credits: 12.1, pct: 4.4 },
        { user: 'ML_FEATURE_STORE', credits: 3.9, pct: 1.4 },
    ],
    creditsByRole: [
        { name: 'SYSADMIN', value: 48 },
        { name: 'ETL_ROLE', value: 142 },
        { name: 'REPORTER', value: 62 },
        { name: 'TRANSFORMER', value: 38 },
        { name: 'ANALYST', value: 30 },
    ],
    warehouses: [
        {
            name: 'ETL_WH',
            size: 'Large',
            clusters_current: 2,
            clusters_max: 4,
            avg_load: 0.78,
            peak_queue_ms: 8_400,
            auto_suspend_sec: 60,
            running_sec_24h: 62_400,
            credits_24h: 142.4,
            recommendation: {
                action: 'increase_max_clusters',
                note: 'Queue time p95 hits 8.4s during ETL window. Raise clusters_max to 6.',
            },
        },
        {
            name: 'REPORT_WH',
            size: 'Medium',
            clusters_current: 1,
            clusters_max: 2,
            avg_load: 0.42,
            peak_queue_ms: 820,
            auto_suspend_sec: 120,
            running_sec_24h: 28_800,
            credits_24h: 62.8,
            recommendation: { action: 'downsize', note: 'Average load 42%. Downsize to Small to save ~$72/month.' },
        },
        {
            name: 'TRANSFORM_WH',
            size: 'X-Small',
            clusters_current: 1,
            clusters_max: 1,
            avg_load: 0.68,
            peak_queue_ms: 1_800,
            auto_suspend_sec: 60,
            running_sec_24h: 8_640,
            credits_24h: 38.4,
            recommendation: {
                action: 'upsize',
                note: 'Queue p95 > 1s and load > 60%. Upsize to Small for tighter SLA.',
            },
        },
        {
            name: 'DEV_WH',
            size: 'X-Small',
            clusters_current: 1,
            clusters_max: 1,
            avg_load: 0.12,
            peak_queue_ms: 0,
            auto_suspend_sec: 30,
            running_sec_24h: 1_440,
            credits_24h: 3.9,
            recommendation: { action: 'ok', note: 'Right-sized — no action needed.' },
        },
        {
            name: 'ML_WH',
            size: 'Large',
            clusters_current: 1,
            clusters_max: 3,
            avg_load: 0.88,
            peak_queue_ms: 18_400,
            auto_suspend_sec: 300,
            running_sec_24h: 48_000,
            credits_24h: 124.8,
            recommendation: {
                action: 'scale_or_convert',
                note: 'Queue p95 = 18s. Convert to Snowpark Container Services or raise clusters_max.',
            },
        },
    ],
    clustering: [
        {
            schema: 'PROD',
            table: 'FACT_EVENTS',
            clustering_key: '(dt, country)',
            total_partitions: 48_210,
            avg_overlaps: 1.2,
            avg_depth: 1.8,
            auto_on: true,
            depth_state: 'OPTIMAL',
        },
        {
            schema: 'PROD',
            table: 'FACT_ORDERS',
            clustering_key: '(dt)',
            total_partitions: 28_420,
            avg_overlaps: 2.4,
            avg_depth: 3.2,
            auto_on: true,
            depth_state: 'OPTIMAL',
        },
        {
            schema: 'PROD',
            table: 'FACT_SESSIONS',
            clustering_key: '(user_id, dt)',
            total_partitions: 14_200,
            avg_overlaps: 8.1,
            avg_depth: 5.4,
            auto_on: false,
            depth_state: 'DEGRADED',
        },
        {
            schema: 'STAGING',
            table: 'RAW_CLICKSTREAM',
            clustering_key: '(ingest_hr)',
            total_partitions: 212_800,
            avg_overlaps: 18.2,
            avg_depth: 14.1,
            auto_on: false,
            depth_state: 'POOR',
        },
        {
            schema: 'MART',
            table: 'DIM_USERS',
            clustering_key: null,
            total_partitions: 1_820,
            avg_overlaps: 1.0,
            avg_depth: 1.0,
            auto_on: false,
            depth_state: 'N/A',
        },
    ],
    queries: [
        {
            query_id: 'abc-111',
            user: 'ETL_SERVICE',
            warehouse: 'ETL_WH',
            status: 'SUCCESS',
            compile_ms: 412,
            queue_ms: 184,
            exec_ms: 8_412_000,
            bytes_scanned: 441_000_000_000,
            rows: 8_420_100,
        },
        {
            query_id: 'abc-112',
            user: 'REPORTING_USER',
            warehouse: 'REPORT_WH',
            status: 'SUCCESS',
            compile_ms: 128,
            queue_ms: 12,
            exec_ms: 82_400,
            bytes_scanned: 12_200_000_000,
            rows: 84_201,
        },
        {
            query_id: 'abc-113',
            user: 'TRANSFORM_DBT',
            warehouse: 'TRANSFORM_WH',
            status: 'SUCCESS',
            compile_ms: 212,
            queue_ms: 1_800,
            exec_ms: 424_000,
            bytes_scanned: 82_200_000_000,
            rows: 1_842_100,
        },
        {
            query_id: 'abc-114',
            user: 'ETL_SERVICE',
            warehouse: 'ETL_WH',
            status: 'FAILED',
            compile_ms: 88,
            queue_ms: 412,
            exec_ms: 0,
            bytes_scanned: 0,
            rows: 0,
            error: 'statement cancelled by user',
        },
        {
            query_id: 'abc-115',
            user: 'ML_FEATURE_STORE',
            warehouse: 'ML_WH',
            status: 'RUNNING',
            compile_ms: 184,
            queue_ms: 8_400,
            exec_ms: 112_400,
            bytes_scanned: 28_400_000_000,
            rows: 0,
        },
    ],
    storage: [
        { name: 'PROD (active)', size: 1842, kind: 'ACTIVE' },
        { name: 'STAGING (active)', size: 4210, kind: 'ACTIVE' },
        { name: 'MART (active)', size: 842, kind: 'ACTIVE' },
        { name: 'PROD (time-travel)', size: 412, kind: 'TIME_TRAVEL' },
        { name: 'STAGING (time-travel)', size: 184, kind: 'TIME_TRAVEL' },
        { name: 'PROD (failsafe)', size: 128, kind: 'FAILSAFE' },
        { name: 'STAGING (failsafe)', size: 48, kind: 'FAILSAFE' },
        { name: 'PROD (cloned)', size: 184, kind: 'CLONED' },
    ],
    shares: {
        inbound: [
            { name: 'WEATHER_DATA.STANDARD', provider: 'WEATHER_CO', last_refresh: '6m ago' },
            { name: 'GEOIP_FEED', provider: 'MAXMIND', last_refresh: '1h ago' },
            { name: 'MARKETING_ATTRIBUTION', provider: 'AD_PARTNER_X', last_refresh: '12h ago' },
        ],
        outbound: [
            { name: 'PULSEDB_ANALYTICS_READONLY', consumers: 8, last_accessed: '12m ago' },
            { name: 'PULSEDB_COHORT_FEED', consumers: 3, last_accessed: '2h ago' },
        ],
    },
    replication: [
        {
            db: 'PULSEDB_PROD',
            primary: 'acme-us-east-1',
            replicated_to: 'acme-eu-west-1',
            is_primary: true,
            refresh: '10 MIN',
            lag_ms: 4_200,
        },
        {
            db: 'PULSEDB_DEV',
            primary: 'acme-us-east-1',
            replicated_to: null,
            is_primary: true,
            refresh: null,
            lag_ms: 0,
        },
    ],
    alerts: [
        {
            severity: 'warning',
            title: 'ML_WH queue p95 = 18.4s — saturation likely',
            time: '3m ago',
            source: 'queue-monitor',
        },
        {
            severity: 'warning',
            title: 'ETL credits trending +18% above plan',
            time: '34m ago',
            source: 'budget-monitor',
        },
        {
            severity: 'info',
            title: 'STAGING.RAW_CLICKSTREAM clustering depth 14 — suboptimal',
            time: '22m ago',
            source: 'clustering-advisor',
        },
    ],
};

// ─────────────────────────────────────────────────────────────────────────

function KpiTile({ k }: { k: (typeof SF.kpis)[0] }) {
    const Icon = k.icon;
    return (
        <div
            style={{
                padding: 16,
                borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(41,181,232,0.08), rgba(255,255,255,0))',
                border: `1px solid ${THEME.glassBorder}`,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: THEME.textMuted, fontSize: 12 }}>
                <Icon size={14} style={{ color: k.color }} />
                <span>{k.label}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color, marginTop: 4 }}>
                {k.value}
                <span style={{ fontSize: 12, color: THEME.textMuted, marginLeft: 4 }}>{k.unit}</span>
            </div>
        </div>
    );
}

// ── Overview
function OverviewPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Account identity" icon={Database} accentColor={SF_BLUE}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 12,
                        padding: 16,
                    }}
                >
                    {Object.entries(SF.identity).map(([k, v]) => (
                        <div
                            key={k}
                            style={{
                                padding: 12,
                                borderLeft: `3px solid ${SF_BLUE}`,
                                background: THEME.surfaceHover,
                                borderRadius: 4,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 11,
                                    color: THEME.textMuted,
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.5,
                                }}
                            >
                                {k.replace(/_/g, ' ')}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{v}</div>
                        </div>
                    ))}
                </div>
            </Panel>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {SF.kpis.map((k) => (
                    <KpiTile key={k.label} k={k} />
                ))}
            </div>

            <Panel title="Credits by warehouse — last 4h" icon={Zap} accentColor={SF_BLUE}>
                <div style={{ height: 300, padding: 12 }}>
                    <ResponsiveContainer>
                        <AreaChart data={SF.creditsTrend}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="t" tickFormatter={fmtHour} fontSize={11} />
                            <YAxis
                                fontSize={11}
                                label={{ value: 'credits', angle: -90, position: 'insideLeft', fontSize: 10 }}
                            />
                            <Tooltip labelFormatter={(v: any) => fmtHour(String(v))} />
                            <Legend />
                            <Area
                                type="monotone"
                                dataKey="ETL_WH"
                                stackId="1"
                                stroke={SF_BLUE}
                                fill={SF_BLUE}
                                fillOpacity={0.7}
                            />
                            <Area
                                type="monotone"
                                dataKey="REPORT_WH"
                                stackId="1"
                                stroke={SF_AMBER}
                                fill={SF_AMBER}
                                fillOpacity={0.7}
                            />
                            <Area
                                type="monotone"
                                dataKey="TRANSFORM_WH"
                                stackId="1"
                                stroke={SF_GREEN}
                                fill={SF_GREEN}
                                fillOpacity={0.7}
                            />
                            <Area
                                type="monotone"
                                dataKey="DEV_WH"
                                stackId="1"
                                stroke={SF_NAVY}
                                fill={SF_NAVY}
                                fillOpacity={0.7}
                            />
                            <ReferenceLine
                                y={1.5}
                                stroke={SF_RED}
                                strokeDasharray="4 4"
                                label={{
                                    value: 'budget limit (1.5 cr / 5min)',
                                    fontSize: 10,
                                    fill: SF_RED,
                                    position: 'right',
                                }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Panel>

            <Panel title="Alerts" icon={AlertTriangle} accentColor={SF_BLUE}>
                <div style={{ padding: '4px 0' }}>
                    {SF.alerts.map((a, i) => (
                        <AlertRow
                            key={i}
                            severity={a.severity as any}
                            title={a.title}
                            time={a.time}
                            source={a.source}
                            color={a.severity === 'warning' ? SF_AMBER : SF_BLUE}
                        />
                    ))}
                </div>
            </Panel>
        </div>
    );
}

// ── Credits explorer
function CreditsPanel() {
    const PIE = [SF_BLUE, SF_AMBER, SF_GREEN, THEME.ai, THEME.purple];
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                <Panel title="Credits by user — last 24h" icon={DollarSign} accentColor={SF_BLUE}>
                    <div style={{ height: 300, padding: 12 }}>
                        <ResponsiveContainer>
                            <BarChart data={SF.creditsByUser} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                <XAxis type="number" fontSize={11} />
                                <YAxis type="category" dataKey="user" width={160} fontSize={11} />
                                <Tooltip formatter={(v: any) => `${v} credits`} />
                                <Bar dataKey="credits" fill={SF_BLUE} radius={[0, 4, 4, 0]}>
                                    <LabelList
                                        dataKey="pct"
                                        position="right"
                                        formatter={(v: any) => `${v}%`}
                                        fontSize={11}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>

                <Panel title="Credits by role" icon={Layers} accentColor={SF_BLUE}>
                    <div style={{ height: 300, padding: 12 }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie
                                    data={SF.creditsByRole}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={95}
                                    paddingAngle={2}
                                    label={(p: any) => p.name}
                                >
                                    {SF.creditsByRole.map((_, i) => (
                                        <Cell key={i} fill={PIE[i % PIE.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(v: any) => `${v} credits`} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>
            </div>

            <Panel title="Forecast" icon={TrendingUp} accentColor={SF_BLUE}>
                <div
                    style={{
                        padding: 16,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 16,
                    }}
                >
                    <div>
                        <div style={{ fontSize: 11, color: THEME.textMuted }}>Projected daily spend</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: SF_BLUE }}>$1,188.80</div>
                        <div style={{ fontSize: 11, color: THEME.textDim }}>
                            Based on last 24h · 297 credits @ $4/cr
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: 11, color: THEME.textMuted }}>Monthly budget</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: SF_AMBER }}>$32,000</div>
                        <div style={{ fontSize: 11, color: THEME.textDim }}>
                            Pace will hit 111% — over budget by $3,640
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: 11, color: THEME.textMuted }}>Top spender</div>
                        <div style={{ fontSize: 20, fontWeight: 600 }}>ETL_SERVICE</div>
                        <div style={{ fontSize: 11, color: SF_AMBER }}>51.2% of credits — 142.4 credits / 24h</div>
                    </div>
                </div>
            </Panel>
        </div>
    );
}

// ── Warehouse recommender
function WarehouseRecommenderPanel() {
    const [selected, setSelected] = useState<string>(SF.warehouses[0].name);
    const wh = SF.warehouses.find((w) => w.name === selected)!;
    const actionColor = {
        increase_max_clusters: SF_AMBER,
        downsize: SF_GREEN,
        upsize: SF_AMBER,
        scale_or_convert: SF_RED,
        ok: SF_GREEN,
    }[wh.recommendation.action];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Warehouse fleet" icon={Box} accentColor={SF_BLUE}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: 12,
                        padding: 12,
                    }}
                >
                    {SF.warehouses.map((w) => (
                        <button
                            key={w.name}
                            onClick={() => setSelected(w.name)}
                            style={{
                                textAlign: 'left',
                                padding: 14,
                                borderRadius: 8,
                                border: `2px solid ${selected === w.name ? SF_BLUE : THEME.glassBorder}`,
                                background: selected === w.name ? THEME.infoLight : '#fff',
                                cursor: 'pointer',
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 6,
                                }}
                            >
                                <strong style={{ fontSize: 14 }}>{w.name}</strong>
                                <span
                                    style={{
                                        padding: '2px 8px',
                                        borderRadius: 4,
                                        fontSize: 10,
                                        fontWeight: 600,
                                        background: w.recommendation.action === 'ok' ? THEME.surface : THEME.warningLight,
                                        color: w.recommendation.action === 'ok' ? THEME.successDark : THEME.warningDark,
                                    }}
                                >
                                    {w.recommendation.action.replace(/_/g, ' ')}
                                </span>
                            </div>
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>
                                {w.size} · {w.clusters_current}/{w.clusters_max} clusters ·{' '}
                                {(w.avg_load * 100).toFixed(0)}% load
                            </div>
                            <div style={{ marginTop: 8, height: 6, background: THEME.glassBorder, borderRadius: 3 }}>
                                <div
                                    style={{
                                        width: `${w.avg_load * 100}%`,
                                        height: '100%',
                                        borderRadius: 3,
                                        background: w.avg_load > 0.8 ? SF_RED : w.avg_load > 0.6 ? SF_AMBER : SF_GREEN,
                                    }}
                                />
                            </div>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: THEME.textMuted,
                                    marginTop: 6,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                }}
                            >
                                <span>{w.credits_24h} cr/24h</span>
                                <span>${(w.credits_24h * 4).toFixed(0)}/24h</span>
                            </div>
                        </button>
                    ))}
                </div>
            </Panel>

            <Panel title={`Recommendation for ${wh.name}`} icon={Settings} accentColor={actionColor}>
                <div style={{ padding: 16 }}>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                            gap: 12,
                            marginBottom: 16,
                        }}
                    >
                        <div>
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>Current size</div>
                            <div style={{ fontSize: 18, fontWeight: 600 }}>{wh.size}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>Clusters</div>
                            <div style={{ fontSize: 18, fontWeight: 600 }}>
                                {wh.clusters_current} (max {wh.clusters_max})
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>Avg load</div>
                            <div
                                style={{
                                    fontSize: 18,
                                    fontWeight: 600,
                                    color: wh.avg_load > 0.8 ? SF_RED : wh.avg_load > 0.6 ? SF_AMBER : SF_GREEN,
                                }}
                            >
                                {(wh.avg_load * 100).toFixed(0)}%
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>Queue p95</div>
                            <div
                                style={{
                                    fontSize: 18,
                                    fontWeight: 600,
                                    color:
                                        wh.peak_queue_ms > 5_000
                                            ? SF_RED
                                            : wh.peak_queue_ms > 1_000
                                              ? SF_AMBER
                                              : SF_GREEN,
                                }}
                            >
                                {(wh.peak_queue_ms / 1000).toFixed(1)}s
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>Auto-suspend</div>
                            <div style={{ fontSize: 18, fontWeight: 600 }}>{wh.auto_suspend_sec}s</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>Credits / 24h</div>
                            <div style={{ fontSize: 18, fontWeight: 600 }}>{wh.credits_24h}</div>
                        </div>
                    </div>

                    <div
                        style={{
                            padding: 16,
                            background: THEME.surfaceHover,
                            borderRadius: 8,
                            borderLeft: `4px solid ${actionColor}`,
                        }}
                    >
                        <div style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 4 }}>RECOMMENDED ACTION</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: actionColor }}>
                            {wh.recommendation.action.replace(/_/g, ' ').toUpperCase()}
                        </div>
                        <div style={{ fontSize: 13, color: THEME.textDim, marginTop: 6 }}>{wh.recommendation.note}</div>
                    </div>
                </div>
            </Panel>
        </div>
    );
}

// ── Clustering depth
function ClusteringPanel() {
    return (
        <Panel title="Clustering depth — per table" icon={Layers} accentColor={SF_BLUE}>
            <div style={{ padding: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                        <tr style={{ background: THEME.surfaceHover, borderBottom: `2px solid ${SF_BLUE}` }}>
                            <th style={{ padding: '10px', textAlign: 'left' }}>Table</th>
                            <th style={{ padding: '10px', textAlign: 'left' }}>Clustering key</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>Partitions</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>Avg depth</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>Avg overlaps</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Auto</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>State</th>
                        </tr>
                    </thead>
                    <tbody>
                        {SF.clustering.map((c, i) => {
                            const stateColor = {
                                OPTIMAL: SF_GREEN,
                                DEGRADED: SF_AMBER,
                                POOR: SF_RED,
                                'N/A': THEME.textDim,
                            }[c.depth_state];
                            return (
                                <tr key={i} style={{ borderBottom: `1px solid ${THEME.glassBorder}` }}>
                                    <td style={{ padding: '10px', fontFamily: 'monospace' }}>
                                        {c.schema}.{c.table}
                                    </td>
                                    <td style={{ padding: '10px' }}>{c.clustering_key || '— (not clustered)'}</td>
                                    <td style={{ padding: '10px', textAlign: 'right' }}>
                                        {c.total_partitions.toLocaleString()}
                                    </td>
                                    <td
                                        style={{
                                            padding: '10px',
                                            textAlign: 'right',
                                            fontWeight: 600,
                                            color: c.avg_depth > 10 ? SF_RED : c.avg_depth > 4 ? SF_AMBER : SF_GREEN,
                                        }}
                                    >
                                        {c.avg_depth.toFixed(1)}
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'right' }}>{c.avg_overlaps.toFixed(1)}</td>
                                    <td style={{ padding: '10px', textAlign: 'center' }}>
                                        {c.auto_on ? (
                                            <CheckCircle size={14} color={SF_GREEN} />
                                        ) : (
                                            <span style={{ color: THEME.textDim }}>—</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'center' }}>
                                        <span
                                            style={{
                                                padding: '2px 8px',
                                                borderRadius: 4,
                                                fontSize: 11,
                                                fontWeight: 600,
                                                background: stateColor + '22',
                                                color: stateColor,
                                            }}
                                        >
                                            {c.depth_state}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <div style={{ fontSize: 11, color: THEME.textDim, padding: '10px 12px 0', fontStyle: 'italic' }}>
                    Avg depth &gt; 4 signals clustering drift. Enable automatic clustering with{' '}
                    <code>ALTER TABLE … RESUME RECLUSTER</code>.
                </div>
            </div>
        </Panel>
    );
}

// ── Query history
function QueryHistoryPanel() {
    const [filter, setFilter] = useState<'all' | 'failed' | 'running'>('all');
    const filtered = SF.queries.filter((q) =>
        filter === 'all' ? true : filter === 'failed' ? q.status === 'FAILED' : q.status === 'RUNNING',
    );
    return (
        <Panel title="Query history — last hour" icon={Activity} accentColor={SF_BLUE}>
            <div style={{ display: 'flex', gap: 8, padding: 12 }}>
                {(['all', 'running', 'failed'] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        style={{
                            padding: '4px 12px',
                            fontSize: 12,
                            borderRadius: 6,
                            border: `1px solid ${filter === f ? SF_BLUE : THEME.surfaceRaised}`,
                            background: filter === f ? SF_BLUE : 'transparent',
                            color: filter === f ? '#fff' : THEME.textDim,
                            cursor: 'pointer',
                        }}
                    >
                        {f[0].toUpperCase() + f.slice(1)}
                    </button>
                ))}
            </div>
            <DataTable
                accentColor={SF_BLUE}
                columns={[
                    { key: 'query_id', label: 'Query ID' },
                    { key: 'user', label: 'User' },
                    { key: 'warehouse', label: 'Warehouse' },
                    { key: 'status', label: 'Status' },
                    { key: 'compile', label: 'Compile (ms)' },
                    { key: 'queue', label: 'Queue (ms)' },
                    { key: 'exec', label: 'Execute' },
                    { key: 'bytes', label: 'Bytes scanned' },
                ]}
                rows={filtered.map((q) => ({
                    query_id: q.query_id,
                    user: q.user,
                    warehouse: q.warehouse,
                    status: q.status,
                    compile: q.compile_ms,
                    queue: q.queue_ms,
                    exec: (q.exec_ms / 1000).toFixed(1) + 's',
                    bytes: formatBytes(q.bytes_scanned),
                }))}
            />
        </Panel>
    );
}

// ── Storage treemap
function StoragePanel() {
    const color = (k: string) =>
        ({
            ACTIVE: SF_BLUE,
            TIME_TRAVEL: SF_AMBER,
            FAILSAFE: SF_RED,
            CLONED: SF_GREEN,
        })[k] || THEME.textDim;
    return (
        <Panel title="Storage breakdown" icon={HardDrive} accentColor={SF_BLUE}>
            <div style={{ height: 380, padding: 12 }}>
                <ResponsiveContainer>
                    <Treemap
                        data={SF.storage}
                        dataKey="size"
                        stroke="#fff"
                        nameKey="name"
                        content={({ x, y, width, height, name, payload }: any) => (
                            <g>
                                <rect
                                    x={x}
                                    y={y}
                                    width={width}
                                    height={height}
                                    style={{
                                        fill: color(payload?.kind),
                                        stroke: '#fff',
                                        strokeWidth: 2,
                                        opacity: 0.85,
                                    }}
                                />
                                {width > 80 && height > 28 && (
                                    <text x={x + 8} y={y + 20} fill="#fff" fontSize={12} fontWeight={600}>
                                        {name}
                                    </text>
                                )}
                                {width > 80 && height > 44 && (
                                    <text x={x + 8} y={y + 38} fill="#fff" fontSize={11}>
                                        {payload?.size} GB
                                    </text>
                                )}
                            </g>
                        )}
                    />
                </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', gap: 16, padding: '0 16px 16px', fontSize: 12, color: THEME.textMuted }}>
                {['ACTIVE', 'TIME_TRAVEL', 'FAILSAFE', 'CLONED'].map((k) => (
                    <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 12, height: 12, background: color(k), borderRadius: 2 }} />{' '}
                        {k.replace(/_/g, ' ')}
                    </span>
                ))}
            </div>
        </Panel>
    );
}

// ── Sharing
function SharingPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Panel title="Inbound shares" icon={Share2} accentColor={SF_GREEN}>
                    <DataTable
                        accentColor={SF_GREEN}
                        columns={[
                            { key: 'name', label: 'Share' },
                            { key: 'provider', label: 'Provider' },
                            { key: 'last_refresh', label: 'Last refresh' },
                        ]}
                        rows={SF.shares.inbound}
                    />
                </Panel>
                <Panel title="Outbound shares" icon={Share2} accentColor={SF_AMBER}>
                    <DataTable
                        accentColor={SF_AMBER}
                        columns={[
                            { key: 'name', label: 'Share' },
                            { key: 'consumers', label: 'Consumers' },
                            { key: 'last_accessed', label: 'Last accessed' },
                        ]}
                        rows={SF.shares.outbound}
                    />
                </Panel>
            </div>
        </div>
    );
}

// ── Replication
function ReplicationPanel() {
    return (
        <Panel title="Account-level replication" icon={GitBranch} accentColor={SF_BLUE}>
            <div style={{ padding: 20 }}>
                <svg width="100%" height={240} viewBox="0 0 640 240">
                    {/* Primary node */}
                    <circle cx={120} cy={120} r={32} fill={SF_BLUE} stroke={THEME.surfaceRaised} strokeWidth={2} />
                    <text x={120} y={125} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">
                        PRIMARY
                    </text>
                    <text x={120} y={76} textAnchor="middle" fontSize={12} fontWeight={600}>
                        acme-us-east-1
                    </text>
                    <text x={120} y={176} textAnchor="middle" fontSize={11} fill={THEME.textDim}>
                        PULSEDB_PROD / PULSEDB_DEV
                    </text>

                    {/* Edge */}
                    <line x1={152} y1={120} x2={488} y2={120} stroke={SF_BLUE} strokeWidth={2} strokeDasharray="6 4" />
                    <text x={320} y={114} textAnchor="middle" fontSize={11} fill={THEME.textDim}>
                        replicated every 10m · lag 4.2s
                    </text>

                    {/* Replica node */}
                    <circle cx={520} cy={120} r={28} fill={SF_GREEN} stroke={THEME.surfaceRaised} strokeWidth={2} />
                    <text x={520} y={125} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">
                        REPLICA
                    </text>
                    <text x={520} y={76} textAnchor="middle" fontSize={12} fontWeight={600}>
                        acme-eu-west-1
                    </text>
                    <text x={520} y={176} textAnchor="middle" fontSize={11} fill={THEME.textDim}>
                        PULSEDB_PROD (read-only)
                    </text>
                </svg>

                <DataTable
                    accentColor={SF_BLUE}
                    columns={[
                        { key: 'db', label: 'Database' },
                        { key: 'primary', label: 'Primary' },
                        { key: 'replicated_to', label: 'Replicated to' },
                        { key: 'refresh', label: 'Refresh schedule' },
                        { key: 'lag', label: 'Lag (ms)' },
                    ]}
                    rows={SF.replication.map((r) => ({
                        ...r,
                        replicated_to: r.replicated_to || '—',
                        refresh: r.refresh || '—',
                        lag: r.lag_ms,
                    }))}
                />
            </div>
        </Panel>
    );
}

// ─────────────────────────────────────────────────────────────────────────

const PANELS = [
    { id: 'overview', label: 'Overview', icon: Gauge },
    { id: 'credits', label: 'Credits Explorer', icon: DollarSign },
    { id: 'recommender', label: 'Warehouse Recommender', icon: Settings },
    { id: 'clustering', label: 'Clustering Depth', icon: Layers },
    { id: 'queries', label: 'Query History', icon: Activity },
    { id: 'storage', label: 'Storage', icon: HardDrive },
    { id: 'sharing', label: 'Data Sharing', icon: Share2 },
    { id: 'replication', label: 'Replication', icon: GitBranch },
];

export default function DemoSnowflakeFullTab({ subTabId }: { subTabId?: string } = {}) {
    useAdaptiveTheme();
    void subTabId;
    const { sections, renderContent } = buildMetricsTab(catalog);
    return (
        <DemoLayout
            title="Snowflake"
            subtitle="Business Critical · acme-analytics.us-east-1"
            accentColor={catalog.accentColor}
            connectionBarMeta={{ lastSync: '8s', refreshInterval: '30s' }}
            titleIcon={Database}
            activeDemo="demo-snowflake"
            sections={sections}
            renderContent={renderContent}
        />
    );
}
