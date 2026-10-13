// ==========================================================================
//  DemoBigQueryFullTab.tsx
//
//  Bespoke, BigQuery-specific demo tab. Replaces the generic DemoEngineTab
//  for the `bigquery` engine key with deep BigQuery-native views:
//
//    Overview         — KPI row + bytes-billed trend + cost guardrail banner
//    Cost Explorer    — bytes billed by user (bar), by dataset (pie),
//                       daily spend area + forecast
//    Slot Utilisation — 24×7 heatmap of slot-ms consumption
//    Job Explorer     — JOBS_BY_PROJECT-shaped table with expandable per-stage
//                       timings (input/compute/shuffle/wait)
//    Dry-Run Estimator— interactive SQL → estimated bytes processed + $cost
//    Partition Pruning— per-table partition scan % with pruning heatmap
//    Reservations     — on-demand vs reservation split, slot headroom
//    Storage / Cold   — dataset storage with cold-tail table treemap
//
//  All data comes from a dedicated `BQ_DEMO_DATA` map in this file so the
//  BigQuery demo is self-contained and doesn't share fixtures with the
//  generic engine demo.
// ==========================================================================

import React, { useMemo, useState, useEffect } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { buildMetricsTab } from './useMetricsTab';
import catalog from '../../../utils/catalogs/bigqueryCatalog';
import DemoLayout, { Panel, StatusBadge, DataTable, TabPills, AlertRow } from './DemoLayout';
import {
    Database,
    Activity,
    AlertTriangle,
    Clock,
    Layers,
    Cloud,
    DollarSign,
    Zap,
    Calculator,
    BarChart3,
    Map as MapIcon,
    Box,
    HardDrive,
    CheckCircle,
    Search,
    TrendingUp,
    Gauge,
    Terminal,
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
    LabelList,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';

const BQ_BLUE = THEME.primary;
const BQ_GOLD = '#F4B400';
const BQ_RED = '#DB4437';
const BQ_GREEN = '#0F9D58';

// ─────────────────────────────────────────────────────────────────────────
//  Mock data — shaped after actual BigQuery INFORMATION_SCHEMA output.
// ─────────────────────────────────────────────────────────────────────────

const now = Date.now();
const tMinus = (mins: number) => new Date(now - mins * 60_000).toISOString();

const BQ_DEMO_DATA = {
    identity: {
        project: 'acme-analytics',
        billing_project: 'acme-billing-01',
        location: 'US',
        org: 'acme.com',
        edition: 'ENTERPRISE',
        reservation: 'etl-main (slots: 500)',
    },
    kpis: [
        { label: 'Jobs (1h)', value: '2,841', unit: '', color: BQ_BLUE, icon: Activity },
        { label: 'Bytes billed (1h)', value: '842', unit: 'GB', color: BQ_GOLD, icon: Cloud },
        { label: 'Est. cost (1h)', value: '$4.18', unit: '', color: BQ_GREEN, icon: DollarSign },
        { label: 'Slot-ms (1h)', value: '1.8', unit: 'M', color: BQ_BLUE, icon: Gauge },
        { label: 'Queue p95', value: '412', unit: 'ms', color: BQ_GOLD, icon: Clock },
        { label: 'Error rate', value: '0.02', unit: '%', color: BQ_GREEN, icon: CheckCircle },
    ],
    bytesBilledTrend: Array.from({ length: 48 }, (_, i) => {
        const gb = +(800 + Math.sin(i / 4) * 200 + (Math.random() - 0.5) * 150).toFixed(1);
        return { t: tMinus((47 - i) * 5), gb, cost: +(gb * 0.005).toFixed(2) };
    }),
    bytesByUser: [
        { user: 'etl-service@acme', bytes: 412_210_884_096, pct: 48.9 },
        { user: 'looker@acme', bytes: 184_221_001_216, pct: 21.9 },
        { user: 'ml-feature-store@acme', bytes: 98_421_002_112, pct: 11.7 },
        { user: 'analyst.alice@acme', bytes: 62_001_984_512, pct: 7.4 },
        { user: 'analyst.bob@acme', bytes: 48_420_221_440, pct: 5.7 },
        { user: 'dbt-prod-runner@acme', bytes: 22_121_002_240, pct: 2.6 },
        { user: 'airflow-sched@acme', bytes: 15_201_998_848, pct: 1.8 },
    ],
    bytesByDataset: [
        { name: 'prod.events', value: 412 },
        { name: 'prod.users', value: 18 },
        { name: 'prod.orders', value: 122 },
        { name: 'staging.raw_pageviews', value: 184 },
        { name: 'marketing.attribution', value: 62 },
        { name: 'finance.ledger', value: 44 },
    ],
    // Slot utilisation heatmap: 24 hours × 7 days, 0–100% fill.
    slotHeatmap: (() => {
        const grid: Array<{ hour: number; day: number; pct: number }> = [];
        const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        void dayLabels;
        for (let d = 0; d < 7; d++) {
            for (let h = 0; h < 24; h++) {
                // Peak pattern: business hours mon-fri + overnight ETL
                const businessHours = h >= 9 && h <= 18 && d < 5;
                const etlWindow = h >= 1 && h <= 4;
                let pct = 12 + Math.random() * 10;
                if (businessHours) pct = 55 + Math.random() * 35;
                if (etlWindow) pct = 75 + Math.random() * 20;
                grid.push({ hour: h, day: d, pct: +pct.toFixed(1) });
            }
        }
        return grid;
    })(),
    jobs: [
        {
            job_id: 'bqjob_r_842a_1',
            user: 'etl-service@acme',
            state: 'DONE',
            started: tMinus(8),
            elapsed_ms: 184_210,
            slot_ms: 412_008,
            bytes_processed: 441_201_884_416,
            bytes_billed: 441_201_884_416,
            cost_usd: 2.21,
            statement_type: 'SELECT',
            query: 'SELECT * FROM `acme-analytics.prod.events` WHERE ts BETWEEN @start AND @end',
            stages: [
                { name: 'S00: Input scan', input_ms: 18_420, compute_ms: 2_400, shuffle_ms: 6_100, wait_ms: 4_200 },
                { name: 'S01: Filter', input_ms: 8_200, compute_ms: 1_800, shuffle_ms: 3_200, wait_ms: 2_100 },
                { name: 'S02: Aggregate', input_ms: 4_100, compute_ms: 42_100, shuffle_ms: 18_400, wait_ms: 8_100 },
                { name: 'S03: Output', input_ms: 1_200, compute_ms: 800, shuffle_ms: 600, wait_ms: 300 },
            ],
        },
        {
            job_id: 'bqjob_r_1be2_2',
            user: 'looker@acme',
            state: 'DONE',
            started: tMinus(12),
            elapsed_ms: 42_100,
            slot_ms: 128_400,
            bytes_processed: 122_001_984_000,
            bytes_billed: 122_001_984_000,
            cost_usd: 0.61,
            statement_type: 'SELECT',
            query: 'SELECT country, COUNT(*) FROM `acme-analytics.prod.events` WHERE dt = CURRENT_DATE() GROUP BY 1',
            stages: [
                { name: 'S00: Input scan', input_ms: 8_210, compute_ms: 1_200, shuffle_ms: 2_100, wait_ms: 1_400 },
                { name: 'S01: Group-by', input_ms: 4_100, compute_ms: 12_400, shuffle_ms: 8_200, wait_ms: 2_100 },
                { name: 'S02: Output', input_ms: 400, compute_ms: 200, shuffle_ms: 100, wait_ms: 80 },
            ],
        },
        {
            job_id: 'bqjob_r_9cd_3',
            user: 'ml-feature-store@acme',
            state: 'RUNNING',
            started: tMinus(2),
            elapsed_ms: 112_400,
            slot_ms: 88_210,
            bytes_processed: 82_104_221_440,
            bytes_billed: 82_104_221_440,
            cost_usd: 0.41,
            statement_type: 'INSERT',
            query: 'INSERT INTO `acme-analytics.feature_store.daily_embeddings` SELECT ... FROM ...',
            stages: [
                { name: 'S00: Input scan', input_ms: 12_400, compute_ms: 8_200, shuffle_ms: 4_100, wait_ms: 2_800 },
                { name: 'S01: UDF compute', input_ms: 4_200, compute_ms: 82_100, shuffle_ms: 12_400, wait_ms: 4_100 },
            ],
        },
        {
            job_id: 'bqjob_r_def_4',
            user: 'dbt-prod-runner@acme',
            state: 'DONE',
            started: tMinus(18),
            elapsed_ms: 8_120,
            slot_ms: 18_420,
            bytes_processed: 12_201_984_000,
            bytes_billed: 12_201_984_000,
            cost_usd: 0.06,
            statement_type: 'MERGE',
            query: 'MERGE INTO `acme-analytics.prod.orders_denorm` USING ...',
            stages: [
                { name: 'S00: Source scan', input_ms: 2_100, compute_ms: 800, shuffle_ms: 1_200, wait_ms: 400 },
                { name: 'S01: Target scan', input_ms: 1_400, compute_ms: 600, shuffle_ms: 800, wait_ms: 200 },
                { name: 'S02: Merge', input_ms: 600, compute_ms: 1_400, shuffle_ms: 200, wait_ms: 100 },
            ],
        },
    ],
    partitions: [
        {
            table: 'prod.events',
            partition_col: 'dt',
            total_partitions: 365,
            scanned_last_1h: 28,
            pruned_pct: 92.3,
            bytes_scanned_gb: 412,
            recommendation: 'Healthy — partition pruning is effective',
        },
        {
            table: 'prod.orders',
            partition_col: 'created_at',
            total_partitions: 730,
            scanned_last_1h: 412,
            pruned_pct: 43.6,
            bytes_scanned_gb: 184,
            recommendation: 'Poor pruning — check WHERE clauses use partition column',
        },
        {
            table: 'staging.raw_pageviews',
            partition_col: 'ingest_ts',
            total_partitions: 48,
            scanned_last_1h: 48,
            pruned_pct: 0.0,
            bytes_scanned_gb: 142,
            recommendation: 'No pruning — full scans are running every query',
        },
        {
            table: 'marketing.attribution',
            partition_col: 'null (not partitioned)',
            total_partitions: 1,
            scanned_last_1h: 1,
            pruned_pct: 0.0,
            bytes_scanned_gb: 62,
            recommendation: 'Table is not partitioned — consider partitioning by event_date',
        },
    ],
    reservations: [
        { name: 'etl-main', slots: 500, used_pct: 78, idle_pct: 22, autoscale_max: 1000 },
        { name: 'looker-bi', slots: 200, used_pct: 42, idle_pct: 58, autoscale_max: 400 },
        { name: 'on-demand-pool', slots: 2000, used_pct: 18, idle_pct: 82, autoscale_max: 2000 },
    ],
    storage: [
        { dataset: 'prod.events', bytes: 14_200_884_000_000, kind: 'ACTIVE' },
        { dataset: 'prod.orders', bytes: 1_842_000_000_000, kind: 'ACTIVE' },
        { dataset: 'prod.users', bytes: 418_000_000_000, kind: 'ACTIVE' },
        { dataset: 'staging.raw_pageviews', bytes: 8_820_221_000_000, kind: 'ACTIVE' },
        { dataset: 'marketing.attribution', bytes: 1_020_000_000_000, kind: 'ACTIVE' },
        { dataset: 'stale_pilot_2024', bytes: 4_210_000_000_000, kind: 'COLD' },
        { dataset: 'stale_holiday_2023', bytes: 2_100_000_000_000, kind: 'COLD' },
        { dataset: 'stale_test_suite', bytes: 420_000_000_000, kind: 'COLD' },
    ],
    coldTables: [
        { name: 'stale_pilot_2024.v1', bytes: 4_210_884_096_000, days_cold: 412, last_modified: '2025-03-08' },
        { name: 'stale_holiday_2023.v2', bytes: 2_100_442_048_000, days_cold: 388, last_modified: '2025-04-01' },
        { name: 'stale_test_suite.raw', bytes: 420_210_884_000, days_cold: 120, last_modified: '2025-12-24' },
        { name: 'stale_one_off.backup', bytes: 184_210_884_000, days_cold: 88, last_modified: '2026-01-25' },
    ],
    alerts: [
        { severity: 'warning', title: 'Cost: $842/day trending +18% vs plan', time: '6m ago', source: 'cost-guard' },
        {
            severity: 'warning',
            title: 'staging.raw_pageviews: 0% partition pruning',
            time: '11m ago',
            source: 'partition-advisor',
        },
        {
            severity: 'info',
            title: 'stale_pilot_2024 cold 412 days — candidate for deletion',
            time: '1h ago',
            source: 'cold-tail',
        },
        {
            severity: 'info',
            title: 'Reservation etl-main hit 78% — within threshold',
            time: '4m ago',
            source: 'slot-monitor',
        },
    ],
    datasets: [
        { name: 'pulsedb_prod', location: 'US', tables: 42, size_gb: 14_200, last_modified_days: 0 },
        { name: 'pulsedb_staging', location: 'US', tables: 18, size_gb: 2_420, last_modified_days: 0 },
        { name: 'marketing_eu', location: 'EU', tables: 12, size_gb: 1_020, last_modified_days: 2 },
        { name: 'ml_features', location: 'US', tables: 8, size_gb: 482, last_modified_days: 0 },
    ],
};

// ─────────────────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────────────────

function fmtHour(iso: string) {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatBytes(n: number) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let i = 0;
    let x = n;
    while (x >= 1024 && i < units.length - 1) {
        x /= 1024;
        i++;
    }
    return `${x.toFixed(x >= 10 ? 0 : 2)} ${units[i]}`;
}

function KpiTile({
    label,
    value,
    unit,
    color,
    Icon,
    sub,
}: {
    label: string;
    value: string;
    unit: string;
    color: string;
    Icon: React.ComponentType<any>;
    sub?: string;
}) {
    return (
        <div
            style={{
                padding: 16,
                borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(102, 157, 246, 0.08), rgba(255, 255, 255, 0))',
                border: `1px solid ${THEME.glassBorder}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: THEME.textMuted, fontSize: 12 }}>
                <Icon size={14} style={{ color }} />
                <span>{label}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color }}>
                {value}
                <span style={{ fontSize: 12, color: THEME.textMuted, marginLeft: 4 }}>{unit}</span>
            </div>
            {sub && <div style={{ fontSize: 11, color: THEME.textDim }}>{sub}</div>}
        </div>
    );
}

// ── Overview panel
function OverviewPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Project identity" icon={Database} accentColor={BQ_BLUE}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: 12,
                        padding: 16,
                    }}
                >
                    {Object.entries(BQ_DEMO_DATA.identity).map(([k, v]) => (
                        <div
                            key={k}
                            style={{
                                padding: 12,
                                borderLeft: `3px solid ${BQ_BLUE}`,
                                background: THEME.surfaceHover,
                                borderRadius: 4,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 11,
                                    color: THEME.textMuted,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                }}
                            >
                                {k.replace(/_/g, ' ')}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{v}</div>
                        </div>
                    ))}
                </div>
            </Panel>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                {BQ_DEMO_DATA.kpis.map((k) => (
                    <KpiTile
                        key={k.label}
                        label={k.label}
                        value={k.value}
                        unit={k.unit}
                        color={k.color}
                        Icon={k.icon}
                    />
                ))}
            </div>

            <Panel title="Bytes billed — last 4h (real-time)" icon={TrendingUp} accentColor={BQ_BLUE}>
                <div style={{ height: 280, padding: 12 }}>
                    <ResponsiveContainer>
                        <ComposedChart data={BQ_DEMO_DATA.bytesBilledTrend}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="t" tickFormatter={fmtHour} fontSize={11} />
                            <YAxis
                                yAxisId="gb"
                                orientation="left"
                                fontSize={11}
                                label={{ value: 'GB', angle: -90, position: 'insideLeft', fontSize: 10 }}
                            />
                            <YAxis
                                yAxisId="cost"
                                orientation="right"
                                fontSize={11}
                                label={{ value: '$', angle: 90, position: 'insideRight', fontSize: 10 }}
                            />
                            <Tooltip
                                labelFormatter={(v: any) => fmtHour(String(v))}
                                formatter={(v: any, name: string) =>
                                    name === 'cost' ? `$${Number(v).toFixed(2)}` : `${Number(v).toFixed(1)} GB`
                                }
                            />
                            <Legend />
                            <Area
                                yAxisId="gb"
                                type="monotone"
                                dataKey="gb"
                                stroke={BQ_BLUE}
                                fill={BQ_BLUE}
                                fillOpacity={0.18}
                                name="GB scanned"
                            />
                            <Line
                                yAxisId="cost"
                                type="monotone"
                                dataKey="cost"
                                stroke={BQ_GOLD}
                                strokeWidth={2}
                                dot={false}
                                name="Cost ($)"
                            />
                            <ReferenceLine
                                yAxisId="cost"
                                y={5.0}
                                stroke={BQ_RED}
                                strokeDasharray="4 4"
                                label={{ value: 'budget limit', fontSize: 10, fill: BQ_RED, position: 'right' }}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </Panel>

            <Panel title="Recent alerts" icon={AlertTriangle} accentColor={BQ_BLUE}>
                <div style={{ padding: '4px 0' }}>
                    {BQ_DEMO_DATA.alerts.map((a, i) => (
                        <AlertRow
                            key={i}
                            severity={a.severity as any}
                            title={a.title}
                            time={a.time}
                            source={a.source}
                            color={a.severity === 'warning' ? BQ_GOLD : a.severity === 'critical' ? BQ_RED : BQ_BLUE}
                        />
                    ))}
                </div>
            </Panel>

            <Panel title="Datasets" icon={Layers} accentColor={BQ_BLUE}>
                <DataTable
                    accentColor={BQ_BLUE}
                    columns={[
                        { key: 'name', label: 'Dataset' },
                        { key: 'location', label: 'Location' },
                        { key: 'tables', label: 'Tables' },
                        { key: 'size_gb', label: 'Size (GB)' },
                        { key: 'last_modified_days', label: 'Last modified' },
                    ]}
                    rows={BQ_DEMO_DATA.datasets.map((d) => ({
                        ...d,
                        size_gb: d.size_gb.toLocaleString(),
                        last_modified_days: d.last_modified_days === 0 ? 'today' : `${d.last_modified_days}d ago`,
                    }))}
                />
            </Panel>
        </div>
    );
}

// ── Cost Explorer panel
function CostExplorerPanel() {
    const PIE_COLORS = [BQ_BLUE, BQ_GOLD, BQ_GREEN, THEME.ai, THEME.purple, THEME.secondary];
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                <Panel title="Bytes billed by user (last 1h)" icon={DollarSign} accentColor={BQ_BLUE}>
                    <div style={{ height: 320, padding: 12 }}>
                        <ResponsiveContainer>
                            <BarChart data={BQ_DEMO_DATA.bytesByUser} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                <XAxis
                                    type="number"
                                    tickFormatter={(v) => `${(v / 1e9).toFixed(0)} GB`}
                                    fontSize={11}
                                />
                                <YAxis type="category" dataKey="user" width={170} fontSize={11} />
                                <Tooltip formatter={(v: any) => formatBytes(Number(v))} />
                                <Bar dataKey="bytes" fill={BQ_BLUE} radius={[0, 4, 4, 0]}>
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

                <Panel title="Bytes by dataset" icon={Layers} accentColor={BQ_BLUE}>
                    <div style={{ height: 320, padding: 12 }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie
                                    data={BQ_DEMO_DATA.bytesByDataset}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    label={(p: any) => p.name}
                                >
                                    {BQ_DEMO_DATA.bytesByDataset.map((_, i) => (
                                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(v: any) => `${v} GB`} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>
            </div>

            <Panel title="Cost forecast — next 7 days @ current rate" icon={TrendingUp} accentColor={BQ_BLUE}>
                <div style={{ padding: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 4 }}>
                            Projected daily spend
                        </div>
                        <div style={{ fontSize: 32, fontWeight: 700, color: BQ_BLUE }}>$102.30</div>
                        <div style={{ fontSize: 11, color: THEME.textDim }}>
                            Based on last 4h average · 7-day = $716.10
                        </div>
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 4 }}>
                            Budget limit (monthly)
                        </div>
                        <div style={{ fontSize: 32, fontWeight: 700, color: BQ_GOLD }}>$3,200</div>
                        <div style={{ fontSize: 11, color: THEME.textDim }}>Current pace will reach 96% of limit</div>
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 4 }}>Biggest driver</div>
                        <div style={{ fontSize: 20, fontWeight: 600 }}>etl-service@acme</div>
                        <div style={{ fontSize: 11, color: BQ_GOLD }}>48.9% of billed bytes · 412 GB in last hour</div>
                    </div>
                </div>
            </Panel>
        </div>
    );
}

// ── Slot heatmap
function SlotHeatmapPanel() {
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const hourLabels = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}`);
    const cellSize = 28;
    const gap = 3;

    function cellColor(pct: number) {
        if (pct < 20) return THEME.glassBorder;
        if (pct < 40) return THEME.primaryLight;
        if (pct < 60) return THEME.primaryLight;
        if (pct < 80) return THEME.primary;
        return THEME.primaryDark;
    }

    return (
        <Panel title="Slot utilisation — 7d × 24h heatmap" icon={Zap} accentColor={BQ_BLUE}>
            <div style={{ padding: 20, overflowX: 'auto' }}>
                <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap, paddingTop: 24 }}>
                        {dayLabels.map((d) => (
                            <div
                                key={d}
                                style={{
                                    height: cellSize,
                                    fontSize: 11,
                                    color: THEME.textMuted,
                                    display: 'flex',
                                    alignItems: 'center',
                                }}
                            >
                                {d}
                            </div>
                        ))}
                    </div>

                    <div>
                        <div style={{ display: 'flex', gap, marginBottom: 4 }}>
                            {hourLabels.map((h) => (
                                <div
                                    key={h}
                                    style={{
                                        width: cellSize,
                                        fontSize: 10,
                                        color: THEME.textMuted,
                                        textAlign: 'center',
                                    }}
                                >
                                    {h}
                                </div>
                            ))}
                        </div>
                        {dayLabels.map((_, d) => (
                            <div key={d} style={{ display: 'flex', gap, marginBottom: gap }}>
                                {hourLabels.map((_, h) => {
                                    const cell = BQ_DEMO_DATA.slotHeatmap.find((c) => c.day === d && c.hour === h);
                                    const pct = cell?.pct || 0;
                                    return (
                                        <div
                                            key={h}
                                            style={{
                                                width: cellSize,
                                                height: cellSize,
                                                background: cellColor(pct),
                                                borderRadius: 3,
                                                fontSize: 9,
                                                color: pct > 60 ? '#fff' : THEME.textMuted,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 600,
                                            }}
                                            title={`${dayLabels[d]} ${h}:00 — ${pct}%`}
                                        >
                                            {pct.toFixed(0)}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        marginTop: 20,
                        fontSize: 11,
                        color: THEME.textMuted,
                    }}
                >
                    <span>Low</span>
                    {[10, 30, 50, 70, 90].map((pct) => (
                        <div key={pct} style={{ width: 24, height: 14, background: cellColor(pct), borderRadius: 2 }} />
                    ))}
                    <span>High</span>
                    <span style={{ marginLeft: 'auto', fontStyle: 'italic' }}>
                        Peak: weekday business hours + overnight ETL window (01:00–04:00)
                    </span>
                </div>
            </div>
        </Panel>
    );
}

// ── Job Explorer
function JobExplorerPanel() {
    const [expanded, setExpanded] = useState<string | null>(BQ_DEMO_DATA.jobs[0].job_id);

    return (
        <Panel title="Job Explorer — last 1h" icon={Activity} accentColor={BQ_BLUE}>
            <div style={{ padding: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                        <tr style={{ background: THEME.surfaceHover, borderBottom: '2px solid #1a3878' }}>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Job</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>User</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>State</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Elapsed</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Slot-ms</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Billed</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Cost</th>
                        </tr>
                    </thead>
                    <tbody>
                        {BQ_DEMO_DATA.jobs.map((j) => (
                            <React.Fragment key={j.job_id}>
                                <tr
                                    style={{
                                        cursor: 'pointer',
                                        borderBottom: `1px solid ${THEME.glassBorder}`,
                                        background: expanded === j.job_id ? THEME.surface : 'transparent',
                                    }}
                                    onClick={() => setExpanded(expanded === j.job_id ? null : j.job_id)}
                                >
                                    <td style={{ padding: '10px', fontFamily: 'monospace' }}>{j.job_id}</td>
                                    <td style={{ padding: '10px' }}>{j.user}</td>
                                    <td style={{ padding: '10px' }}>
                                        <span
                                            style={{
                                                padding: '2px 8px',
                                                borderRadius: 4,
                                                fontSize: 11,
                                                fontWeight: 600,
                                                background: j.state === 'RUNNING' ? THEME.warningLight : THEME.successLight,
                                                color: j.state === 'RUNNING' ? THEME.warningDark : THEME.successDark,
                                            }}
                                        >
                                            {j.state}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'right' }}>
                                        {(j.elapsed_ms / 1000).toFixed(1)}s
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'right' }}>
                                        {j.slot_ms.toLocaleString()}
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'right' }}>
                                        {formatBytes(j.bytes_billed)}
                                    </td>
                                    <td
                                        style={{ padding: '10px', textAlign: 'right', fontWeight: 600, color: BQ_GOLD }}
                                    >
                                        ${j.cost_usd.toFixed(2)}
                                    </td>
                                </tr>
                                {expanded === j.job_id && (
                                    <tr>
                                        <td colSpan={7} style={{ padding: '0 12px 16px' }}>
                                            <div
                                                style={{
                                                    padding: 12,
                                                    background: THEME.surfaceHover,
                                                    borderRadius: 8,
                                                    border: `1px solid ${THEME.glassBorder}`,
                                                }}
                                            >
                                                <div style={{ marginBottom: 12, fontSize: 12, color: THEME.textMuted }}>
                                                    Statement type: <strong>{j.statement_type}</strong>
                                                </div>
                                                <div
                                                    style={{
                                                        marginBottom: 12,
                                                        fontFamily: 'monospace',
                                                        fontSize: 11,
                                                        background: THEME.bgAlt || THEME.bg,
                                                        color: THEME.textMain,
                                                        padding: 10,
                                                        borderRadius: 6,
                                                        overflowX: 'auto',
                                                    }}
                                                >
                                                    {j.query}
                                                </div>
                                                <div style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 6 }}>
                                                    Stage timing (ms):
                                                </div>
                                                <div style={{ height: 180 }}>
                                                    <ResponsiveContainer>
                                                        <BarChart data={j.stages} layout="vertical">
                                                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                                            <XAxis type="number" fontSize={11} />
                                                            <YAxis
                                                                type="category"
                                                                dataKey="name"
                                                                width={140}
                                                                fontSize={10}
                                                            />
                                                            <Tooltip />
                                                            <Legend />
                                                            <Bar
                                                                dataKey="wait_ms"
                                                                stackId="a"
                                                                fill={THEME.dangerLight}
                                                                name="Wait"
                                                            />
                                                            <Bar
                                                                dataKey="input_ms"
                                                                stackId="a"
                                                                fill={BQ_BLUE}
                                                                name="Input"
                                                            />
                                                            <Bar
                                                                dataKey="compute_ms"
                                                                stackId="a"
                                                                fill={BQ_GREEN}
                                                                name="Compute"
                                                            />
                                                            <Bar
                                                                dataKey="shuffle_ms"
                                                                stackId="a"
                                                                fill={BQ_GOLD}
                                                                name="Shuffle"
                                                            />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
                <div style={{ fontSize: 11, color: THEME.textDim, marginTop: 8, fontStyle: 'italic' }}>
                    Click a row to see statement type, SQL text, and per-stage timing breakdown.
                </div>
            </div>
        </Panel>
    );
}

// ── Dry-Run Cost Estimator
function DryRunEstimatorPanel() {
    const [sql, setSql] = useState(
        `SELECT user_id, COUNT(*) AS events
FROM \`acme-analytics.prod.events\`
WHERE dt BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) AND CURRENT_DATE()
GROUP BY user_id
ORDER BY events DESC
LIMIT 1000`,
    );
    const [estimate, setEstimate] = useState<null | {
        bytes: number;
        cost: number;
        tables: string[];
        partitions: number;
    }>(null);
    const [running, setRunning] = useState(false);

    function runEstimate() {
        setRunning(true);
        setTimeout(() => {
            // Deterministic-ish pseudo-estimate based on SQL length + table hints
            const hasPartitionFilter = /dt\s*(BETWEEN|=|>=|<=)/i.test(sql);
            const mentionsEvents = /\bevents\b/i.test(sql);
            const mentionsOrders = /\borders\b/i.test(sql);
            const mentionsUsers = /\busers\b/i.test(sql);
            let bytes = 0;
            const tables: string[] = [];
            if (mentionsEvents) {
                tables.push('prod.events');
                bytes += hasPartitionFilter ? 42_000_000_000 : 4_200_000_000_000;
            }
            if (mentionsOrders) {
                tables.push('prod.orders');
                bytes += hasPartitionFilter ? 18_000_000_000 : 1_840_000_000_000;
            }
            if (mentionsUsers) {
                tables.push('prod.users');
                bytes += 418_000_000;
            }
            if (!tables.length) {
                tables.push('unknown');
                bytes = sql.length * 12_000_000;
            }
            const cost = (bytes * 5) / 1e12; // $5 per TB
            const partitions = hasPartitionFilter ? 7 : 365;
            setEstimate({ bytes, cost, tables, partitions });
            setRunning(false);
        }, 600);
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Dry-Run Cost Estimator" icon={Calculator} accentColor={BQ_BLUE}>
                <div style={{ padding: 16 }}>
                    <div style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 8 }}>
                        Paste a BigQuery SQL query. PulseDB submits it with <code>dryRun: true</code>, reads the returned{' '}
                        <code>totalBytesProcessed</code> + <code>referencedTables</code>, and computes cost at the
                        on-demand rate ($5 / TB).
                    </div>
                    <textarea
                        value={sql}
                        onChange={(e) => setSql(e.target.value)}
                        style={{
                            width: '100%',
                            minHeight: 160,
                            fontFamily: 'monospace',
                            fontSize: 12,
                            border: `1px solid ${THEME.glassBorder}`,
                            borderRadius: 6,
                            padding: 10,
                            resize: 'vertical',
                            background: THEME.bgAlt || THEME.bg,
                            color: THEME.textMain,
                        }}
                        spellCheck={false}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                        <button
                            onClick={runEstimate}
                            disabled={running}
                            style={{
                                padding: '8px 16px',
                                background: BQ_BLUE,
                                color: '#fff',
                                border: 'none',
                                borderRadius: 6,
                                fontWeight: 600,
                                cursor: 'pointer',
                                opacity: running ? 0.6 : 1,
                            }}
                        >
                            {running ? 'Estimating…' : 'Estimate cost'}
                        </button>
                        <span style={{ fontSize: 11, color: THEME.textDim }}>
                            This is a demo — no query is actually submitted to BigQuery.
                        </span>
                    </div>

                    {estimate && (
                        <div
                            style={{
                                marginTop: 16,
                                padding: 16,
                                background: THEME.surfaceHover,
                                borderRadius: 8,
                                border: `1px solid ${BQ_BLUE}`,
                            }}
                        >
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                    gap: 16,
                                }}
                            >
                                <div>
                                    <div style={{ fontSize: 11, color: THEME.textMuted }}>Bytes processed</div>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: BQ_BLUE }}>
                                        {formatBytes(estimate.bytes)}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: THEME.textMuted }}>Estimated cost</div>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: BQ_GOLD }}>
                                        ${estimate.cost.toFixed(4)}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: THEME.textMuted }}>Referenced tables</div>
                                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>
                                        {estimate.tables.join(', ')}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: THEME.textMuted }}>Partitions scanned</div>
                                    <div
                                        style={{
                                            fontSize: 20,
                                            fontWeight: 700,
                                            color: estimate.partitions > 100 ? BQ_RED : BQ_GREEN,
                                        }}
                                    >
                                        {estimate.partitions}
                                    </div>
                                </div>
                            </div>

                            {estimate.partitions > 100 && (
                                <div
                                    style={{
                                        marginTop: 12,
                                        padding: 10,
                                        background: THEME.warningLight,
                                        borderRadius: 6,
                                        fontSize: 12,
                                        color: THEME.warningDark,
                                        display: 'flex',
                                        gap: 8,
                                        alignItems: 'center',
                                    }}
                                >
                                    <AlertTriangle size={16} />
                                    <span>
                                        <strong>Warning:</strong> this query scans {estimate.partitions} partitions. Add
                                        a WHERE filter on the partition column (<code>dt</code>) to reduce scan cost.
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Panel>
        </div>
    );
}

// ── Partition Pruning
function PartitionPruningPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Partition pruning effectiveness" icon={MapIcon} accentColor={BQ_BLUE}>
                <div style={{ padding: 12 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr style={{ background: THEME.surfaceHover, borderBottom: '2px solid #1a3878' }}>
                                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Table</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Partition column</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Scanned (1h)</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Pruned %</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Bytes (GB)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {BQ_DEMO_DATA.partitions.map((p, i) => (
                                <React.Fragment key={i}>
                                    <tr style={{ borderBottom: `1px solid ${THEME.glassBorder}` }}>
                                        <td style={{ padding: '10px', fontFamily: 'monospace' }}>{p.table}</td>
                                        <td style={{ padding: '10px' }}>{p.partition_col}</td>
                                        <td style={{ padding: '10px', textAlign: 'right' }}>{p.total_partitions}</td>
                                        <td style={{ padding: '10px', textAlign: 'right' }}>{p.scanned_last_1h}</td>
                                        <td
                                            style={{
                                                padding: '10px',
                                                textAlign: 'right',
                                                fontWeight: 600,
                                                color:
                                                    p.pruned_pct > 80 ? BQ_GREEN : p.pruned_pct > 40 ? BQ_GOLD : BQ_RED,
                                            }}
                                        >
                                            {p.pruned_pct.toFixed(1)}%
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'right' }}>{p.bytes_scanned_gb}</td>
                                    </tr>
                                    <tr>
                                        <td colSpan={6} style={{ padding: '0 10px 12px 10px' }}>
                                            {/* Mini heatmap: total partitions visualized as dots, scanned ones filled. */}
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 6 }}>
                                                {Array.from({ length: Math.min(p.total_partitions, 80) }, (_, ix) => {
                                                    const isScanned = ix < p.scanned_last_1h;
                                                    return (
                                                        <div
                                                            key={ix}
                                                            style={{
                                                                width: 8,
                                                                height: 8,
                                                                borderRadius: 2,
                                                                background: isScanned ? BQ_BLUE : THEME.glassBorder,
                                                            }}
                                                        />
                                                    );
                                                })}
                                                {p.total_partitions > 80 && (
                                                    <span style={{ fontSize: 10, color: THEME.textDim, marginLeft: 6 }}>
                                                        +{p.total_partitions - 80} more
                                                    </span>
                                                )}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 11,
                                                    fontStyle: 'italic',
                                                    color: p.pruned_pct < 40 ? BQ_RED : THEME.textMuted,
                                                }}
                                            >
                                                {p.recommendation}
                                            </div>
                                        </td>
                                    </tr>
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Panel>
        </div>
    );
}

// ── Reservations
function ReservationsPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                {BQ_DEMO_DATA.reservations.map((r) => (
                    <Panel key={r.name} title={r.name} icon={Box} accentColor={BQ_BLUE}>
                        <div style={{ padding: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                                <div>
                                    <div style={{ fontSize: 11, color: THEME.textMuted }}>Baseline slots</div>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: BQ_BLUE }}>
                                        {r.slots.toLocaleString()}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: THEME.textMuted }}>Autoscale max</div>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: BQ_GOLD }}>
                                        {r.autoscale_max.toLocaleString()}
                                    </div>
                                </div>
                            </div>
                            <div
                                style={{
                                    height: 10,
                                    background: THEME.glassBorder,
                                    borderRadius: 5,
                                    overflow: 'hidden',
                                    display: 'flex',
                                }}
                            >
                                <div style={{ width: `${r.used_pct}%`, background: BQ_BLUE }} />
                                <div style={{ width: `${r.idle_pct}%`, background: THEME.primaryLight }} />
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: 11,
                                    color: THEME.textMuted,
                                    marginTop: 6,
                                }}
                            >
                                <span>{r.used_pct}% used</span>
                                <span>{r.idle_pct}% idle</span>
                            </div>
                        </div>
                    </Panel>
                ))}
            </div>

            <Panel title="Reservation utilisation — last 24h" icon={Gauge} accentColor={BQ_BLUE}>
                <div style={{ height: 240, padding: 12 }}>
                    <ResponsiveContainer>
                        <LineChart
                            data={Array.from({ length: 24 }, (_, h) => ({
                                h: `${String(h).padStart(2, '0')}:00`,
                                'etl-main': 50 + Math.sin(h / 3) * 25 + Math.random() * 8,
                                'looker-bi': 20 + Math.sin(h / 2) * 15 + Math.random() * 6,
                                'on-demand-pool': 10 + Math.random() * 14,
                            }))}
                        >
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="h" fontSize={11} />
                            <YAxis
                                fontSize={11}
                                domain={[0, 100]}
                                label={{ value: '%', angle: -90, position: 'insideLeft', fontSize: 10 }}
                            />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="etl-main" stroke={BQ_BLUE} strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="looker-bi" stroke={BQ_GOLD} strokeWidth={2} dot={false} />
                            <Line
                                type="monotone"
                                dataKey="on-demand-pool"
                                stroke={BQ_GREEN}
                                strokeWidth={2}
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </Panel>
        </div>
    );
}

// ── Storage / Cold treemap
function StoragePanel() {
    const treemapData = BQ_DEMO_DATA.storage.map((s) => ({
        name: s.dataset,
        size: s.bytes / 1e9,
        kind: s.kind,
    }));
    const COLD_COLOR = THEME.dangerLight;
    const ACTIVE_COLOR = BQ_BLUE;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Storage treemap — active vs cold" icon={HardDrive} accentColor={BQ_BLUE}>
                <div style={{ height: 320, padding: 12 }}>
                    <ResponsiveContainer>
                        <Treemap
                            data={treemapData}
                            dataKey="size"
                            stroke="#fff"
                            nameKey="name"
                            content={({
                                root: _root,
                                depth,
                                x,
                                y,
                                width,
                                height,
                                index,
                                payload,
                                rank: _rank,
                                name,
                            }: any) => {
                                const kind = payload?.kind;
                                return (
                                    <g>
                                        <rect
                                            x={x}
                                            y={y}
                                            width={width}
                                            height={height}
                                            style={{
                                                fill: kind === 'COLD' ? COLD_COLOR : ACTIVE_COLOR,
                                                stroke: '#fff',
                                                strokeWidth: 2,
                                                opacity: depth === 1 ? 0.9 : 0.6,
                                            }}
                                        />
                                        {width > 80 && height > 28 && (
                                            <text x={x + 8} y={y + 20} fill="#fff" fontSize={12} fontWeight={600}>
                                                {name}
                                            </text>
                                        )}
                                        {width > 80 && height > 44 && (
                                            <text x={x + 8} y={y + 38} fill="#fff" fontSize={11} opacity={0.85}>
                                                {payload?.size?.toFixed(0)} GB
                                            </text>
                                        )}
                                    </g>
                                );
                            }}
                        />
                    </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', gap: 16, padding: '0 16px 16px', fontSize: 12, color: THEME.textMuted }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 12, height: 12, background: ACTIVE_COLOR, borderRadius: 2 }} /> Active
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 12, height: 12, background: COLD_COLOR, borderRadius: 2 }} /> Cold
                        (candidate for deletion)
                    </span>
                </div>
            </Panel>

            <Panel title="Cold tables — candidates for deletion" icon={Box} accentColor={BQ_RED}>
                <DataTable
                    accentColor={BQ_RED}
                    columns={[
                        { key: 'name', label: 'Table' },
                        { key: 'bytes_str', label: 'Size' },
                        { key: 'days_cold', label: 'Days cold' },
                        { key: 'last_modified', label: 'Last modified' },
                        { key: 'savings', label: 'Monthly savings if deleted' },
                    ]}
                    rows={BQ_DEMO_DATA.coldTables.map((c) => ({
                        ...c,
                        bytes_str: formatBytes(c.bytes),
                        savings: `$${((c.bytes / 1e9) * 0.02).toFixed(2)}`, // $0.02 per GB-month
                    }))}
                />
            </Panel>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────────────────────────────────

const PANELS = [
    { id: 'overview', label: 'Overview', icon: Gauge },
    { id: 'cost', label: 'Cost Explorer', icon: DollarSign },
    { id: 'slots', label: 'Slot Utilisation', icon: Zap },
    { id: 'jobs', label: 'Job Explorer', icon: Activity },
    { id: 'estimator', label: 'Dry-Run Estimator', icon: Calculator },
    { id: 'pruning', label: 'Partition Pruning', icon: MapIcon },
    { id: 'reserv', label: 'Reservations', icon: Box },
    { id: 'storage', label: 'Storage / Cold', icon: HardDrive },
];

export default function DemoBigQueryFullTab({ subTabId }: { subTabId?: string } = {}) {
    useAdaptiveTheme();
    void subTabId;
    const { sections, renderContent } = buildMetricsTab(catalog);
    return (
        <DemoLayout
            title="Google BigQuery"
            subtitle="acme-analytics-prod · multi-region US"
            accentColor={catalog.accentColor}
            connectionBarMeta={{ lastSync: '8s', refreshInterval: '30s' }}
            titleIcon={Database}
            activeDemo="demo-bigquery"
            sections={sections}
            renderContent={renderContent}
        />
    );
}
