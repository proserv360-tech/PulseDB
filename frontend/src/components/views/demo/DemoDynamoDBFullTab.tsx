// ==========================================================================
//  DemoDynamoDBFullTab.tsx — bespoke DynamoDB demo.
//  Overview | Capacity Mode | Hot Partitions | Global Tables | CloudWatch | TTL | Streams
// ==========================================================================

import React, { useState } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { buildMetricsTab } from './useMetricsTab';
import catalog from '../../../utils/catalogs/dynamodbCatalog';
import DemoLayout, { Panel, StatusBadge, DataTable, TabPills, AlertRow } from './DemoLayout';
import {
    Database,
    Activity,
    AlertTriangle,
    Clock,
    Layers,
    HardDrive,
    CheckCircle,
    Gauge,
    Zap,
    Globe,
    DollarSign,
    Radio,
    Settings,
    TrendingUp,
} from 'lucide-react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ComposedChart,
    Cell,
    ReferenceLine,
} from 'recharts';

const DY_BLUE = '#4053D6';
const DY_NAVY = '#232F3E';
const DY_ORANGE = '#FF9900';
const DY_GREEN = '#7AA116';
const DY_RED = '#D13212';

const now = Date.now();
const tMinus = (m: number) => new Date(now - m * 60_000).toISOString();
const fmtHour = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const DY = {
    identity: {
        region: 'us-east-1',
        account_id: '123456789012',
        tables: '8',
        global_tables: '2',
        streams: '3',
    },
    kpis: [
        { label: 'Requests/sec', value: '48,210', unit: '', color: DY_BLUE, icon: Activity },
        { label: 'Consumed RCU', value: '4,210', unit: '', color: DY_BLUE, icon: Gauge },
        { label: 'Consumed WCU', value: '1,842', unit: '', color: DY_BLUE, icon: Gauge },
        { label: 'Throttle events', value: '12', unit: '/hr', color: DY_ORANGE, icon: AlertTriangle },
        { label: 'Latency p95', value: '2.8', unit: 'ms', color: DY_GREEN, icon: Clock },
        { label: 'Errors', value: '0', unit: '', color: DY_GREEN, icon: CheckCircle },
    ],
    cloudwatchTrend: Array.from({ length: 48 }, (_, i) => ({
        t: tMinus((47 - i) * 5),
        rcu: Math.round(4200 + Math.sin(i / 3) * 400 + Math.random() * 200),
        wcu: Math.round(1800 + Math.sin(i / 3) * 200 + Math.random() * 100),
        read_thr: i > 42 ? Math.round(Math.random() * 4) : 0,
        write_thr: i > 42 ? Math.round(Math.random() * 2) : 0,
        p95_ms: Math.round(3 + Math.sin(i / 4) + Math.random()),
    })),
    tables: [
        {
            name: 'Events',
            billing: 'PROVISIONED',
            rcu_prov: 5000,
            wcu_prov: 2000,
            rcu_avg: 4210,
            wcu_avg: 1842,
            rcu_peak: 4812,
            wcu_peak: 2101,
            throttles_1h: 12,
            size_bytes: 184_210_884_096_000,
            item_count: 48_210_000_000,
            recommendation: 'ON_DEMAND likely cheaper (peak-to-avg ratio 1.14× but WCU peaking above provisioned)',
        },
        {
            name: 'Users',
            billing: 'ON_DEMAND',
            rcu_prov: 0,
            wcu_prov: 0,
            rcu_avg: 142,
            wcu_avg: 38,
            rcu_peak: 412,
            wcu_peak: 88,
            throttles_1h: 0,
            size_bytes: 1_842_000_000,
            item_count: 1_842_000,
            recommendation: 'OK — low avg, spiky access pattern fits ON_DEMAND',
        },
        {
            name: 'Sessions',
            billing: 'PROVISIONED',
            rcu_prov: 1000,
            wcu_prov: 500,
            rcu_avg: 112,
            wcu_avg: 42,
            rcu_peak: 184,
            wcu_peak: 82,
            throttles_1h: 0,
            size_bytes: 420_000_000,
            item_count: 482_100,
            recommendation: 'Downsize to RCU=300/WCU=150 → save $1,840/mo',
        },
        {
            name: 'AuditLog',
            billing: 'PROVISIONED',
            rcu_prov: 200,
            wcu_prov: 2000,
            rcu_avg: 18,
            wcu_avg: 1212,
            rcu_peak: 48,
            wcu_peak: 1840,
            throttles_1h: 0,
            size_bytes: 18_210_000_000_000,
            item_count: 8_421_000_000,
            recommendation: 'OK — write-heavy, low read',
        },
    ],
    partitions: [
        // Each cell = a 5-minute bucket, values are request count
        {
            pk: 'user#42',
            buckets: [120, 188, 142, 204, 142, 188, 2_820, 1_840, 18_420, 24_210, 32_120, 28_412],
            hot: true,
        },
        { pk: 'user#1024', buckets: [48, 62, 58, 52, 48, 58, 62, 48, 52, 58, 62, 48], hot: false },
        { pk: 'user#8', buckets: [22, 28, 18, 24, 22, 28, 32, 38, 42, 48, 42, 38], hot: false },
        { pk: 'user#99', buckets: [18, 20, 22, 18, 20, 22, 18, 20, 18, 22, 18, 20], hot: false },
        { pk: 'user#184', buckets: [12, 14, 18, 12, 14, 18, 14, 12, 18, 14, 12, 14], hot: false },
    ],
    globalTables: [
        {
            table: 'Events',
            replicas: [
                { region: 'us-east-1', status: 'ACTIVE', lag_ms: 0, is_primary: true },
                { region: 'eu-west-1', status: 'ACTIVE', lag_ms: 842, is_primary: false },
            ],
        },
        {
            table: 'Users',
            replicas: [
                { region: 'us-east-1', status: 'ACTIVE', lag_ms: 0, is_primary: true },
                { region: 'eu-west-1', status: 'ACTIVE', lag_ms: 412, is_primary: false },
                { region: 'ap-south-1', status: 'ACTIVE', lag_ms: 1_240, is_primary: false },
            ],
        },
    ],
    ttl: [
        {
            table: 'Sessions',
            ttl_attr: 'expires_at',
            enabled: true,
            expiring_rate_per_sec: 12.4,
            total_ttl_items: 142_000,
        },
        {
            table: 'Events',
            ttl_attr: null,
            enabled: false,
            expiring_rate_per_sec: 0,
            total_ttl_items: 0,
            recommendation: 'Enable TTL on stale_after — saves $240/mo',
        },
        {
            table: 'AuditLog',
            ttl_attr: 'retention_ts',
            enabled: true,
            expiring_rate_per_sec: 42.1,
            total_ttl_items: 842_000,
        },
    ],
    streams: [
        {
            table: 'Events',
            stream_type: 'NEW_AND_OLD_IMAGES',
            consumer: 'events-to-eventbridge',
            lag_sec: 0.4,
            status: 'ENABLED',
        },
        {
            table: 'Users',
            stream_type: 'NEW_IMAGE',
            consumer: 'user-mirror-to-redshift',
            lag_sec: 2.8,
            status: 'ENABLED',
        },
        {
            table: 'AuditLog',
            stream_type: 'NEW_IMAGE',
            consumer: 'compliance-archiver',
            lag_sec: 48.4,
            status: 'ENABLED',
        },
    ],
    alerts: [
        {
            severity: 'critical',
            title: '12 WriteThrottleEvents on Events in last 15m (pk=user#42 hot)',
            time: '4m ago',
            source: 'cloudwatch',
        },
        {
            severity: 'warning',
            title: 'Sessions table over-provisioned: RCU 1000 / used 112',
            time: '18m ago',
            source: 'capacity-advisor',
        },
        {
            severity: 'info',
            title: 'AuditLog stream consumer lag 48s — backlog growing',
            time: '12m ago',
            source: 'streams',
        },
    ],
};

function KpiTile({ k }: { k: (typeof DY.kpis)[0] }) {
    const Icon = k.icon;
    return (
        <div
            style={{
                padding: 16,
                borderRadius: 10,
                border: `1px solid ${THEME.glassBorder}`,
                background: 'linear-gradient(135deg, rgba(64,83,214,0.08), rgba(255,255,255,0))',
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

function OverviewPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Account identity" icon={Database} accentColor={DY_BLUE}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 12,
                        padding: 16,
                    }}
                >
                    {Object.entries(DY.identity).map(([k, v]) => (
                        <div
                            key={k}
                            style={{
                                padding: 12,
                                borderLeft: `3px solid ${DY_BLUE}`,
                                background: THEME.surfaceHover,
                                borderRadius: 4,
                            }}
                        >
                            <div style={{ fontSize: 11, color: THEME.textMuted, textTransform: 'uppercase' }}>
                                {k.replace(/_/g, ' ')}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{v}</div>
                        </div>
                    ))}
                </div>
            </Panel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {DY.kpis.map((k) => (
                    <KpiTile key={k.label} k={k} />
                ))}
            </div>
            <Panel title="Alerts" icon={AlertTriangle} accentColor={DY_BLUE}>
                <div style={{ padding: '4px 0' }}>
                    {DY.alerts.map((a, i) => (
                        <AlertRow
                            key={i}
                            severity={a.severity as any}
                            title={a.title}
                            time={a.time}
                            source={a.source}
                            color={a.severity === 'critical' ? DY_RED : a.severity === 'warning' ? DY_ORANGE : DY_NAVY}
                        />
                    ))}
                </div>
            </Panel>
        </div>
    );
}

// ── Capacity Mode Recommender
function CapacityPanel() {
    const [sel, setSel] = useState(DY.tables[0].name);
    const t = DY.tables.find((x) => x.name === sel)!;
    // Simplified monthly cost model:
    //  - PROVISIONED:  $0.00065/RCU-hr + $0.00065/WCU-hr × 730 (approx real AWS)
    //  - ON_DEMAND:    $0.25 per million reads + $1.25 per million writes
    const provCost = (t.rcu_prov + t.wcu_prov) * 0.00065 * 730;
    const reqPerMo = 48210 * 60 * 60 * 24 * 30; // assumed rate
    const onDemand = (reqPerMo / 1_000_000) * 0.75;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Per-table capacity mode" icon={Gauge} accentColor={DY_BLUE}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: 12,
                        padding: 12,
                    }}
                >
                    {DY.tables.map((tt) => (
                        <button
                            key={tt.name}
                            onClick={() => setSel(tt.name)}
                            style={{
                                textAlign: 'left',
                                padding: 14,
                                borderRadius: 8,
                                border: `2px solid ${sel === tt.name ? DY_BLUE : THEME.glassBorder}`,
                                background: sel === tt.name ? THEME.surface : '#fff',
                                cursor: 'pointer',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <strong>{tt.name}</strong>
                                <span
                                    style={{
                                        fontSize: 10,
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        background: tt.billing === 'ON_DEMAND' ? THEME.infoLight : THEME.warningLight,
                                        color: tt.billing === 'ON_DEMAND' ? THEME.infoDark : THEME.warningDark,
                                    }}
                                >
                                    {tt.billing}
                                </span>
                            </div>
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>
                                {tt.billing === 'PROVISIONED'
                                    ? `RCU ${tt.rcu_prov} · WCU ${tt.wcu_prov}`
                                    : 'Pay-per-request'}
                            </div>
                            <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 4 }}>
                                avg R {tt.rcu_avg} · W {tt.wcu_avg} · {tt.throttles_1h} throttles/h
                            </div>
                        </button>
                    ))}
                </div>
            </Panel>
            <Panel title={`${t.name} — cost analysis`} icon={DollarSign} accentColor={DY_BLUE}>
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
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>Current mode</div>
                            <div style={{ fontSize: 18, fontWeight: 600 }}>{t.billing}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>Item count</div>
                            <div style={{ fontSize: 18, fontWeight: 600 }}>{t.item_count.toLocaleString()}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>Size</div>
                            <div style={{ fontSize: 18, fontWeight: 600 }}>{(t.size_bytes / 1e9).toFixed(1)} GB</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>Throttles (1h)</div>
                            <div
                                style={{ fontSize: 18, fontWeight: 600, color: t.throttles_1h > 0 ? DY_RED : DY_GREEN }}
                            >
                                {t.throttles_1h}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ padding: 14, border: `1px solid ${THEME.glassBorder}`, borderRadius: 8 }}>
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>PROVISIONED (est. monthly)</div>
                            <div style={{ fontSize: 22, fontWeight: 700 }}>${provCost.toFixed(0)}</div>
                            <div style={{ fontSize: 11, color: THEME.textDim, marginTop: 4 }}>
                                {t.rcu_prov} RCU × $0.00065/hr + {t.wcu_prov} WCU × $0.00065/hr × 730h
                            </div>
                        </div>
                        <div style={{ padding: 14, border: `1px solid ${THEME.glassBorder}`, borderRadius: 8 }}>
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>ON_DEMAND (est. monthly)</div>
                            <div style={{ fontSize: 22, fontWeight: 700 }}>${onDemand.toFixed(0)}</div>
                            <div style={{ fontSize: 11, color: THEME.textDim, marginTop: 4 }}>
                                At current req rate · $0.25/M reads + $1.25/M writes
                            </div>
                        </div>
                    </div>

                    <div
                        style={{
                            marginTop: 16,
                            padding: 12,
                            background: THEME.surfaceHover,
                            borderRadius: 8,
                            borderLeft: `4px solid ${DY_BLUE}`,
                        }}
                    >
                        <div style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 4 }}>ADVISOR</div>
                        <div style={{ fontSize: 13 }}>{t.recommendation}</div>
                    </div>
                </div>
            </Panel>
        </div>
    );
}

// ── Hot partitions heatmap
function HotPartitionsPanel() {
    const hourLabels = [
        't-55m',
        't-50m',
        't-45m',
        't-40m',
        't-35m',
        't-30m',
        't-25m',
        't-20m',
        't-15m',
        't-10m',
        't-5m',
        'now',
    ];
    const max = 50_000; // partition throughput ceiling
    function cellColor(v: number) {
        const pct = (v / max) * 100;
        if (pct < 5) return THEME.glassBorder;
        if (pct < 15) return THEME.primaryLight;
        if (pct < 30) return THEME.primaryLight;
        if (pct < 60) return THEME.primary;
        return DY_RED;
    }
    return (
        <Panel title="Hot-partition detector — Events table" icon={Radio} accentColor={DY_BLUE}>
            <div style={{ padding: 16, overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'separate', borderSpacing: 3, fontSize: 11 }}>
                    <thead>
                        <tr>
                            <th style={{ padding: 4, color: THEME.textMuted, textAlign: 'left', fontWeight: 500 }}>
                                Partition key
                            </th>
                            {hourLabels.map((h) => (
                                <th key={h} style={{ padding: 4, color: THEME.textMuted, fontWeight: 500 }}>
                                    {h}
                                </th>
                            ))}
                            <th style={{ padding: 4, color: THEME.textMuted, fontWeight: 500 }}>Verdict</th>
                        </tr>
                    </thead>
                    <tbody>
                        {DY.partitions.map((p) => (
                            <tr key={p.pk}>
                                <td style={{ padding: 4, fontFamily: 'monospace' }}>{p.pk}</td>
                                {p.buckets.map((v, i) => (
                                    <td
                                        key={i}
                                        style={{
                                            width: 60,
                                            height: 28,
                                            background: cellColor(v),
                                            borderRadius: 3,
                                            color: v > 20_000 ? '#fff' : THEME.textDim,
                                            textAlign: 'center',
                                            fontSize: 10,
                                            fontWeight: 600,
                                        }}
                                    >
                                        {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
                                    </td>
                                ))}
                                <td style={{ padding: '4px 8px' }}>
                                    {p.hot ? (
                                        <span style={{ color: DY_RED, fontWeight: 600 }}>🔥 HOT — throttle risk</span>
                                    ) : (
                                        <span style={{ color: DY_GREEN }}>OK</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{ fontSize: 11, color: THEME.textDim, marginTop: 10, fontStyle: 'italic' }}>
                    <strong>user#42</strong> is consuming 32k req/min in the latest bucket — a single partition's
                    ceiling is ~40k. Spread writes with a write-sharding strategy (<code>user#42#shard0..N</code>) or
                    switch the PK to include a high-cardinality prefix.
                </div>
            </div>
        </Panel>
    );
}

// ── Global Tables
function GlobalTablesPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {DY.globalTables.map((g) => (
                <Panel key={g.table} title={`Global Table: ${g.table}`} icon={Globe} accentColor={DY_BLUE}>
                    <div style={{ padding: 20 }}>
                        <svg width="100%" height={200} viewBox="0 0 640 200">
                            {g.replicas.map((r, i) => {
                                const x = 80 + i * (480 / (g.replicas.length - 1 || 1));
                                const color = r.lag_ms > 1000 ? DY_ORANGE : DY_GREEN;
                                return (
                                    <g key={r.region}>
                                        {i > 0 && (
                                            <>
                                                <line
                                                    x1={80 + (i - 1) * (480 / (g.replicas.length - 1))}
                                                    y1={100}
                                                    x2={x}
                                                    y2={100}
                                                    stroke={color}
                                                    strokeWidth={2}
                                                />
                                                <text
                                                    x={(80 + (i - 1) * (480 / (g.replicas.length - 1)) + x) / 2}
                                                    y={94}
                                                    textAnchor="middle"
                                                    fontSize={10}
                                                    fill={THEME.textDim}
                                                >
                                                    {r.lag_ms}ms
                                                </text>
                                            </>
                                        )}
                                        <circle
                                            cx={x}
                                            cy={100}
                                            r={32}
                                            fill={r.is_primary ? DY_BLUE : color}
                                            stroke={THEME.surfaceRaised}
                                            strokeWidth={2}
                                        />
                                        <text
                                            x={x}
                                            y={104}
                                            textAnchor="middle"
                                            fontSize={10}
                                            fontWeight={700}
                                            fill="#fff"
                                        >
                                            {r.is_primary ? 'PRIMARY' : 'REPLICA'}
                                        </text>
                                        <text x={x} y={58} textAnchor="middle" fontSize={12} fontWeight={600}>
                                            {r.region}
                                        </text>
                                        <text x={x} y={152} textAnchor="middle" fontSize={10} fill={THEME.textDim}>
                                            {r.status}
                                        </text>
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                </Panel>
            ))}
        </div>
    );
}

// ── CloudWatch bridge
function CloudWatchPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="RCU / WCU consumed — last 4h" icon={TrendingUp} accentColor={DY_BLUE}>
                <div style={{ height: 280, padding: 12 }}>
                    <ResponsiveContainer>
                        <AreaChart data={DY.cloudwatchTrend}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="t" tickFormatter={fmtHour} fontSize={11} />
                            <YAxis fontSize={11} />
                            <Tooltip labelFormatter={(v: any) => fmtHour(String(v))} />
                            <Legend />
                            <Area
                                type="monotone"
                                dataKey="rcu"
                                stackId="1"
                                stroke={DY_BLUE}
                                fill={DY_BLUE}
                                fillOpacity={0.4}
                            />
                            <Area
                                type="monotone"
                                dataKey="wcu"
                                stackId="1"
                                stroke={DY_ORANGE}
                                fill={DY_ORANGE}
                                fillOpacity={0.4}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Panel>
            <Panel title="Throttle events — last 4h" icon={AlertTriangle} accentColor={DY_RED}>
                <div style={{ height: 240, padding: 12 }}>
                    <ResponsiveContainer>
                        <BarChart data={DY.cloudwatchTrend}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="t" tickFormatter={fmtHour} fontSize={11} />
                            <YAxis fontSize={11} />
                            <Tooltip labelFormatter={(v: any) => fmtHour(String(v))} />
                            <Legend />
                            <Bar dataKey="read_thr" fill={DY_ORANGE} name="ReadThrottleEvents" />
                            <Bar dataKey="write_thr" fill={DY_RED} name="WriteThrottleEvents" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Panel>
            <Panel title="Latency p95 — last 4h" icon={Clock} accentColor={DY_BLUE}>
                <div style={{ height: 220, padding: 12 }}>
                    <ResponsiveContainer>
                        <LineChart data={DY.cloudwatchTrend}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="t" tickFormatter={fmtHour} fontSize={11} />
                            <YAxis
                                fontSize={11}
                                label={{ value: 'ms', angle: -90, position: 'insideLeft', fontSize: 10 }}
                            />
                            <Tooltip labelFormatter={(v: any) => fmtHour(String(v))} />
                            <Line type="monotone" dataKey="p95_ms" stroke={DY_BLUE} strokeWidth={2} dot={false} />
                            <ReferenceLine
                                y={10}
                                stroke={DY_ORANGE}
                                strokeDasharray="4 4"
                                label={{ value: 'SLO: 10ms', fontSize: 10, fill: DY_ORANGE }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </Panel>
        </div>
    );
}

// ── TTL
function TtlPanel() {
    return (
        <Panel title="TTL configuration" icon={Clock} accentColor={DY_BLUE}>
            <DataTable
                accentColor={DY_BLUE}
                columns={[
                    { key: 'table', label: 'Table' },
                    { key: 'ttl_attr', label: 'TTL attribute' },
                    { key: 'enabled', label: 'Status' },
                    { key: 'rate', label: 'Expiring/sec' },
                    { key: 'items', label: 'TTL-tagged items' },
                    { key: 'recommendation', label: 'Recommendation' },
                ]}
                rows={DY.ttl.map((t) => ({
                    table: t.table,
                    ttl_attr: t.ttl_attr || '—',
                    enabled: t.enabled ? 'ENABLED' : 'DISABLED',
                    rate: t.expiring_rate_per_sec.toFixed(1),
                    items: t.total_ttl_items.toLocaleString(),
                    recommendation: t.recommendation || 'OK',
                }))}
            />
        </Panel>
    );
}

// ── Streams
function StreamsPanel() {
    return (
        <Panel title="DynamoDB Streams + consumers" icon={Zap} accentColor={DY_BLUE}>
            <DataTable
                accentColor={DY_BLUE}
                columns={[
                    { key: 'table', label: 'Table' },
                    { key: 'stream_type', label: 'Stream type' },
                    { key: 'consumer', label: 'Consumer' },
                    { key: 'lag', label: 'Lag' },
                    { key: 'status', label: 'Status' },
                ]}
                rows={DY.streams.map((s) => ({
                    ...s,
                    lag: s.lag_sec < 1 ? `${(s.lag_sec * 1000).toFixed(0)} ms` : `${s.lag_sec.toFixed(1)} s`,
                }))}
            />
        </Panel>
    );
}

const PANELS = [
    { id: 'overview', label: 'Overview', icon: Gauge },
    { id: 'capacity', label: 'Capacity Mode', icon: Settings },
    { id: 'hot', label: 'Hot Partitions', icon: Radio },
    { id: 'global', label: 'Global Tables', icon: Globe },
    { id: 'cw', label: 'CloudWatch', icon: TrendingUp },
    { id: 'ttl', label: 'TTL', icon: Clock },
    { id: 'streams', label: 'Streams', icon: Zap },
];

export default function DemoDynamoDBFullTab({ subTabId }: { subTabId?: string } = {}) {
    useAdaptiveTheme();
    void subTabId;
    const { sections, renderContent } = buildMetricsTab(catalog);
    return (
        <DemoLayout
            title="Amazon DynamoDB"
            subtitle="us-east-1 · 82 tables · on-demand & provisioned"
            accentColor={catalog.accentColor}
            connectionBarMeta={{ lastSync: '8s', refreshInterval: '30s' }}
            titleIcon={Database}
            activeDemo="demo-dynamodb"
            sections={sections}
            renderContent={renderContent}
        />
    );
}
