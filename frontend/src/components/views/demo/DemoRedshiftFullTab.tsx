// ==========================================================================
//  DemoRedshiftFullTab.tsx — bespoke Redshift demo.
//  Overview | WLM | Vacuum | Distribution | Nodes | Query History | Locks
// ==========================================================================

import React, { useState } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { buildMetricsTab } from './useMetricsTab';
import catalog from '../../../utils/catalogs/redshiftCatalog';
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
    Lock,
    Settings,
    Zap,
    Box,
    GitBranch,
} from 'lucide-react';
import {
    BarChart,
    Bar,
    AreaChart,
    Area,
    ComposedChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell,
} from 'recharts';

const RS_ORANGE = '#FF9900';
const RS_NAVY = '#232F3E';
const RS_RED = '#D13212';
const RS_GREEN = '#59BA47';
const RS_BLUE = '#146EB4';

const now = Date.now();
const tMinus = (m: number) => new Date(now - m * 60_000).toISOString();
const fmtHour = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const RD = {
    identity: {
        cluster: 'fathom-prod',
        region: 'us-east-1',
        node_type: 'dc2.large',
        node_count: '4',
        version: '1.0.82842',
        endpoint: 'fathom.abc.us-east-1.redshift.amazonaws.com:5439',
    },
    kpis: [
        { label: 'Queries/hr', value: '842', unit: '', color: RS_ORANGE, icon: Activity },
        { label: 'Disk used', value: '68', unit: '%', color: RS_BLUE, icon: HardDrive },
        { label: 'WLM queue p95', value: '142', unit: 'ms', color: RS_GREEN, icon: Clock },
        { label: 'Sessions', value: '28', unit: '', color: RS_ORANGE, icon: Database },
        { label: 'Stats stale', value: '8', unit: '', color: RS_RED, icon: AlertTriangle },
        { label: 'Active cluster', value: 'dc2.large', unit: '× 4', color: RS_NAVY, icon: Box },
    ],
    wlmQueues: [
        {
            name: 'default',
            slots: 5,
            concurrency: 5,
            timeout_ms: 0,
            mem_pct: 40,
            query_count_1h: 412,
            avg_queue_ms: 82,
            avg_exec_ms: 412,
            recommendation: 'OK',
        },
        {
            name: 'etl',
            slots: 5,
            concurrency: 10,
            timeout_ms: 120_000,
            mem_pct: 40,
            query_count_1h: 184,
            avg_queue_ms: 412,
            avg_exec_ms: 1_842,
            recommendation: 'Raise slot count to 8',
        },
        {
            name: 'reporting',
            slots: 2,
            concurrency: 2,
            timeout_ms: 60_000,
            mem_pct: 10,
            query_count_1h: 48,
            avg_queue_ms: 48,
            avg_exec_ms: 282,
            recommendation: 'OK',
        },
        {
            name: 'dev',
            slots: 2,
            concurrency: 2,
            timeout_ms: 30_000,
            mem_pct: 10,
            query_count_1h: 12,
            avg_queue_ms: 8,
            avg_exec_ms: 120,
            recommendation: 'OK',
        },
    ],
    wlmTrend: Array.from({ length: 24 }, (_, i) => ({
        t: tMinus((23 - i) * 5),
        default: Math.round(60 + Math.random() * 40),
        etl: Math.round(180 + Math.sin(i / 4) * 120 + Math.random() * 80),
        reporting: Math.round(40 + Math.random() * 20),
        dev: Math.round(8 + Math.random() * 4),
    })),
    vacuum: [
        {
            schema: 'public',
            table: 'fact_events',
            rows: 842_000_000,
            unsorted_pct: 38.4,
            stats_off: 18,
            priority: 'HIGH',
            action: 'VACUUM FULL + ANALYZE',
            est_duration_min: 142,
        },
        {
            schema: 'public',
            table: 'dim_users',
            rows: 1_842_100,
            unsorted_pct: 4.2,
            stats_off: 2,
            priority: 'LOW',
            action: 'ANALYZE',
            est_duration_min: 2,
        },
        {
            schema: 'public',
            table: 'fact_orders',
            rows: 28_420_100,
            unsorted_pct: 22.8,
            stats_off: 12,
            priority: 'MEDIUM',
            action: 'VACUUM',
            est_duration_min: 18,
        },
        {
            schema: 'staging',
            table: 'raw_pageviews',
            rows: 2_842_000_000,
            unsorted_pct: 58.2,
            stats_off: 24,
            priority: 'HIGH',
            action: 'VACUUM FULL',
            est_duration_min: 420,
        },
        {
            schema: 'mart',
            table: 'mv_kpi_daily',
            rows: 124_820,
            unsorted_pct: 1.1,
            stats_off: 1,
            priority: 'LOW',
            action: '—',
            est_duration_min: 0,
        },
    ],
    distribution: [
        {
            schema: 'public',
            table: 'fact_events',
            diststyle: 'KEY',
            distkey: 'user_id',
            sortkey: '(dt, user_id)',
            slices: [
                { slice: 0, pct: 24.2, rows: 203_848_000 },
                { slice: 1, pct: 25.1, rows: 211_322_000 },
                { slice: 2, pct: 24.8, rows: 208_816_000 },
                { slice: 3, pct: 25.9, rows: 218_014_000 },
            ],
            skew_score: 0.07,
            verdict: 'HEALTHY',
        },
        {
            schema: 'public',
            table: 'fact_orders',
            diststyle: 'KEY',
            distkey: 'tenant_id',
            sortkey: '(dt)',
            slices: [
                { slice: 0, pct: 8.4, rows: 2_387_288 },
                { slice: 1, pct: 14.2, rows: 4_035_654 },
                { slice: 2, pct: 12.1, rows: 3_438_832 },
                { slice: 3, pct: 65.3, rows: 18_558_325 },
            ],
            skew_score: 0.72,
            verdict: 'SEVERE SKEW — consider EVEN or different distkey',
        },
        {
            schema: 'public',
            table: 'dim_users',
            diststyle: 'ALL',
            distkey: null,
            sortkey: '(id)',
            slices: [
                { slice: 0, pct: 25.0, rows: 1_842_100 },
                { slice: 1, pct: 25.0, rows: 1_842_100 },
                { slice: 2, pct: 25.0, rows: 1_842_100 },
                { slice: 3, pct: 25.0, rows: 1_842_100 },
            ],
            skew_score: 0.0,
            verdict: 'HEALTHY (ALL strategy — full replication)',
        },
    ],
    nodes: [
        { node: 'leader', cpu_pct: 42, disk_used_gb: 0, disk_cap_gb: 0, read_iops: 0, write_iops: 0 },
        { node: 'n0', cpu_pct: 58, disk_used_gb: 184, disk_cap_gb: 320, read_iops: 1_842, write_iops: 412 },
        { node: 'n1', cpu_pct: 62, disk_used_gb: 182, disk_cap_gb: 320, read_iops: 1_884, write_iops: 402 },
        { node: 'n2', cpu_pct: 48, disk_used_gb: 183, disk_cap_gb: 320, read_iops: 1_612, write_iops: 388 },
        { node: 'n3', cpu_pct: 54, disk_used_gb: 180, disk_cap_gb: 320, read_iops: 1_724, write_iops: 408 },
    ],
    queryHistory: [
        {
            qid: 18421,
            user: 'etl_user',
            queue: 'etl',
            duration_sec: 48,
            queue_sec: 0.2,
            returned: 1_842_100,
            aborted: false,
            sql: 'SELECT ... FROM fact_events e JOIN dim_users u ON ...',
        },
        {
            qid: 18422,
            user: 'looker',
            queue: 'reporting',
            duration_sec: 2,
            queue_sec: 0.0,
            returned: 412,
            aborted: false,
            sql: 'SELECT dt, SUM(amount) FROM fact_orders WHERE dt = CURRENT_DATE GROUP BY 1',
        },
        {
            qid: 18423,
            user: 'etl_user',
            queue: 'etl',
            duration_sec: 182,
            queue_sec: 1.2,
            returned: 0,
            aborted: false,
            sql: "COPY staging.raw FROM 's3://...' IAM_ROLE ...",
        },
        {
            qid: 18424,
            user: 'analyst',
            queue: 'reporting',
            duration_sec: 62,
            queue_sec: 0.0,
            returned: 18_420,
            aborted: false,
            sql: 'SELECT user_id, COUNT(*) FROM fact_events WHERE ... GROUP BY 1 LIMIT 1000',
        },
        {
            qid: 18425,
            user: 'dev_user',
            queue: 'dev',
            duration_sec: 0,
            queue_sec: 0.0,
            returned: 0,
            aborted: true,
            sql: 'SELECT * FROM public.fact_events',
        },
    ],
    locks: [
        {
            pid: 18421,
            user: 'etl_user',
            txn_start: '2m ago',
            mode: 'AccessExclusiveLock',
            relation: 'public.fact_events',
            granted: true,
            waiting_on: null,
        },
        {
            pid: 18422,
            user: 'analyst',
            txn_start: '1m ago',
            mode: 'AccessShareLock',
            relation: 'public.fact_events',
            granted: false,
            waiting_on: 18421,
        },
        {
            pid: 18423,
            user: 'looker',
            txn_start: '0m ago',
            mode: 'AccessShareLock',
            relation: 'public.fact_events',
            granted: false,
            waiting_on: 18421,
        },
    ],
    alerts: [
        {
            severity: 'warning',
            title: 'public.fact_orders skew score 0.72 — severe distkey imbalance',
            time: '12m ago',
            source: 'skew-advisor',
        },
        {
            severity: 'warning',
            title: 'staging.raw_pageviews unsorted 58% — VACUUM FULL needed',
            time: '23m ago',
            source: 'bloat-watcher',
        },
        { severity: 'info', title: 'WLM etl queue p95 = 412ms', time: '7m ago', source: 'wlm' },
    ],
};

function KpiTile({ k }: { k: (typeof RD.kpis)[0] }) {
    const Icon = k.icon;
    return (
        <div
            style={{
                padding: 16,
                borderRadius: 10,
                border: `1px solid ${THEME.glassBorder}`,
                background: 'linear-gradient(135deg, rgba(255,153,0,0.08), rgba(255,255,255,0))',
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
            <Panel title="Cluster identity" icon={Database} accentColor={RS_ORANGE}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 12,
                        padding: 16,
                    }}
                >
                    {Object.entries(RD.identity).map(([k, v]) => (
                        <div
                            key={k}
                            style={{
                                padding: 12,
                                borderLeft: `3px solid ${RS_ORANGE}`,
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
                {RD.kpis.map((k) => (
                    <KpiTile key={k.label} k={k} />
                ))}
            </div>
            <Panel title="Alerts" icon={AlertTriangle} accentColor={RS_ORANGE}>
                <div style={{ padding: '4px 0' }}>
                    {RD.alerts.map((a, i) => (
                        <AlertRow
                            key={i}
                            severity={a.severity as any}
                            title={a.title}
                            time={a.time}
                            source={a.source}
                            color={RS_ORANGE}
                        />
                    ))}
                </div>
            </Panel>
        </div>
    );
}

// ── WLM simulator
function WlmPanel() {
    const [selected, setSelected] = useState(RD.wlmQueues[1].name);
    const q = RD.wlmQueues.find((x) => x.name === selected)!;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="WLM queue configuration" icon={Settings} accentColor={RS_ORANGE}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: 12,
                        padding: 12,
                    }}
                >
                    {RD.wlmQueues.map((qq) => (
                        <button
                            key={qq.name}
                            onClick={() => setSelected(qq.name)}
                            style={{
                                textAlign: 'left',
                                padding: 14,
                                borderRadius: 8,
                                border: `2px solid ${selected === qq.name ? RS_ORANGE : THEME.glassBorder}`,
                                background: selected === qq.name ? THEME.warningLight : '#fff',
                                cursor: 'pointer',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <strong style={{ fontSize: 14 }}>{qq.name}</strong>
                                <span
                                    style={{
                                        fontSize: 10,
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        background: qq.recommendation === 'OK' ? THEME.surface : THEME.warningLight,
                                        color: qq.recommendation === 'OK' ? THEME.successDark : THEME.warningDark,
                                    }}
                                >
                                    {qq.recommendation === 'OK' ? 'OK' : 'TUNE'}
                                </span>
                            </div>
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>
                                {qq.slots} slots · {qq.concurrency} concurrency · {qq.mem_pct}% mem
                            </div>
                            <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 4 }}>
                                {qq.query_count_1h} queries/h · avg queue {qq.avg_queue_ms}ms
                            </div>
                        </button>
                    ))}
                </div>
            </Panel>
            <Panel title={`Recommendation for ${q.name}`} icon={Zap} accentColor={RS_ORANGE}>
                <div style={{ padding: 16 }}>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                            gap: 12,
                            marginBottom: 12,
                        }}
                    >
                        <div>
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>Slots</div>
                            <div style={{ fontSize: 18, fontWeight: 600 }}>{q.slots}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>Concurrency</div>
                            <div style={{ fontSize: 18, fontWeight: 600 }}>{q.concurrency}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>Timeout</div>
                            <div style={{ fontSize: 18, fontWeight: 600 }}>
                                {q.timeout_ms === 0 ? '—' : `${q.timeout_ms / 1000}s`}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>Queries/hr</div>
                            <div style={{ fontSize: 18, fontWeight: 600 }}>{q.query_count_1h}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>Avg queue</div>
                            <div
                                style={{
                                    fontSize: 18,
                                    fontWeight: 600,
                                    color: q.avg_queue_ms > 200 ? RS_RED : RS_GREEN,
                                }}
                            >
                                {q.avg_queue_ms}ms
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>Avg exec</div>
                            <div style={{ fontSize: 18, fontWeight: 600 }}>{q.avg_exec_ms}ms</div>
                        </div>
                    </div>
                    <div
                        style={{
                            padding: 12,
                            background: q.recommendation === 'OK' ? THEME.surface : THEME.warningLight,
                            borderRadius: 8,
                            borderLeft: `4px solid ${q.recommendation === 'OK' ? RS_GREEN : RS_ORANGE}`,
                        }}
                    >
                        <div style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 4 }}>RECOMMENDED</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{q.recommendation}</div>
                    </div>
                </div>
            </Panel>
            <Panel title="WLM queue duration — last 2h" icon={Clock} accentColor={RS_ORANGE}>
                <div style={{ height: 280, padding: 12 }}>
                    <ResponsiveContainer>
                        <AreaChart data={RD.wlmTrend}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="t" tickFormatter={fmtHour} fontSize={11} />
                            <YAxis fontSize={11} />
                            <Tooltip labelFormatter={(v: any) => fmtHour(String(v))} />
                            <Legend />
                            <Area
                                type="monotone"
                                dataKey="etl"
                                stackId="a"
                                stroke={RS_ORANGE}
                                fill={RS_ORANGE}
                                fillOpacity={0.5}
                            />
                            <Area
                                type="monotone"
                                dataKey="reporting"
                                stackId="a"
                                stroke={RS_BLUE}
                                fill={RS_BLUE}
                                fillOpacity={0.5}
                            />
                            <Area
                                type="monotone"
                                dataKey="default"
                                stackId="a"
                                stroke={RS_NAVY}
                                fill={RS_NAVY}
                                fillOpacity={0.5}
                            />
                            <Area
                                type="monotone"
                                dataKey="dev"
                                stackId="a"
                                stroke={RS_GREEN}
                                fill={RS_GREEN}
                                fillOpacity={0.5}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Panel>
        </div>
    );
}

// ── Vacuum scheduler
function VacuumPanel() {
    const prioColor = (p: string) => (p === 'HIGH' ? RS_RED : p === 'MEDIUM' ? RS_ORANGE : RS_GREEN);
    return (
        <Panel title="Vacuum + ANALYZE priority queue" icon={Zap} accentColor={RS_ORANGE}>
            <div style={{ padding: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                        <tr style={{ background: THEME.surfaceHover, borderBottom: `2px solid ${RS_ORANGE}` }}>
                            <th style={{ padding: '10px', textAlign: 'left' }}>Table</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>Rows</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>Unsorted %</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>Stats off</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Priority</th>
                            <th style={{ padding: '10px', textAlign: 'left' }}>Action</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>Est. dur.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {RD.vacuum.map((v, i) => (
                            <tr key={i} style={{ borderBottom: `1px solid ${THEME.glassBorder}` }}>
                                <td style={{ padding: '10px', fontFamily: 'monospace' }}>
                                    {v.schema}.{v.table}
                                </td>
                                <td style={{ padding: '10px', textAlign: 'right' }}>{v.rows.toLocaleString()}</td>
                                <td
                                    style={{
                                        padding: '10px',
                                        textAlign: 'right',
                                        fontWeight: 600,
                                        color:
                                            v.unsorted_pct > 30 ? RS_RED : v.unsorted_pct > 10 ? RS_ORANGE : RS_GREEN,
                                    }}
                                >
                                    {v.unsorted_pct.toFixed(1)}%
                                </td>
                                <td style={{ padding: '10px', textAlign: 'right' }}>{v.stats_off}</td>
                                <td style={{ padding: '10px', textAlign: 'center' }}>
                                    <span
                                        style={{
                                            padding: '2px 8px',
                                            borderRadius: 4,
                                            fontSize: 11,
                                            fontWeight: 600,
                                            background: prioColor(v.priority) + '22',
                                            color: prioColor(v.priority),
                                        }}
                                    >
                                        {v.priority}
                                    </span>
                                </td>
                                <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: 11 }}>{v.action}</td>
                                <td style={{ padding: '10px', textAlign: 'right' }}>
                                    {v.est_duration_min === 0 ? '—' : `${v.est_duration_min} min`}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Panel>
    );
}

// ── Distribution skew analyzer
function DistPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {RD.distribution.map((d) => (
                <Panel
                    key={`${d.schema}.${d.table}`}
                    title={`${d.schema}.${d.table} — ${d.diststyle}${d.distkey ? ` on ${d.distkey}` : ''}`}
                    icon={Layers}
                    accentColor={d.skew_score > 0.5 ? RS_RED : d.skew_score > 0.2 ? RS_ORANGE : RS_GREEN}
                >
                    <div style={{ padding: 16 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                            <div>
                                <div style={{ fontSize: 11, color: THEME.textMuted }}>Sort key</div>
                                <div style={{ fontSize: 13, fontFamily: 'monospace' }}>{d.sortkey || '—'}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: THEME.textMuted }}>Skew score</div>
                                <div
                                    style={{
                                        fontSize: 20,
                                        fontWeight: 700,
                                        color: d.skew_score > 0.5 ? RS_RED : d.skew_score > 0.2 ? RS_ORANGE : RS_GREEN,
                                    }}
                                >
                                    {d.skew_score.toFixed(2)}
                                </div>
                            </div>
                        </div>
                        <div style={{ height: 200 }}>
                            <ResponsiveContainer>
                                <BarChart data={d.slices}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis
                                        dataKey="slice"
                                        fontSize={11}
                                        label={{ value: 'Slice', position: 'insideBottom', fontSize: 10 }}
                                    />
                                    <YAxis
                                        fontSize={11}
                                        label={{ value: '%', angle: -90, position: 'insideLeft', fontSize: 10 }}
                                    />
                                    <Tooltip
                                        formatter={(v: any, n: string) =>
                                            n === 'pct' ? `${v}%` : Number(v).toLocaleString()
                                        }
                                    />
                                    <Bar dataKey="pct">
                                        {d.slices.map((s, i) => (
                                            <Cell
                                                key={i}
                                                fill={s.pct > 40 ? RS_RED : s.pct > 30 ? RS_ORANGE : RS_GREEN}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div
                            style={{
                                fontSize: 12,
                                fontStyle: 'italic',
                                color: d.skew_score > 0.2 ? RS_RED : THEME.textMuted,
                                marginTop: 6,
                            }}
                        >
                            {d.verdict}
                        </div>
                    </div>
                </Panel>
            ))}
        </div>
    );
}

// ── Nodes
function NodesPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Per-node resources" icon={Box} accentColor={RS_ORANGE}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 12,
                        padding: 12,
                    }}
                >
                    {RD.nodes.map((n) => (
                        <div
                            key={n.node}
                            style={{ padding: 14, borderRadius: 8, border: `1px solid ${THEME.glassBorder}` }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <strong>{n.node}</strong>
                                {n.node === 'leader' && (
                                    <span
                                        style={{
                                            fontSize: 10,
                                            padding: '2px 6px',
                                            borderRadius: 4,
                                            background: RS_ORANGE + '22',
                                            color: RS_ORANGE,
                                        }}
                                    >
                                        LEADER
                                    </span>
                                )}
                            </div>
                            <div style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 4 }}>
                                CPU {n.cpu_pct}%
                            </div>
                            <div
                                style={{ height: 6, background: THEME.glassBorder, borderRadius: 3, marginBottom: 10 }}
                            >
                                <div
                                    style={{
                                        width: `${n.cpu_pct}%`,
                                        height: '100%',
                                        background: n.cpu_pct > 80 ? RS_RED : n.cpu_pct > 60 ? RS_ORANGE : RS_GREEN,
                                        borderRadius: 3,
                                    }}
                                />
                            </div>
                            {n.disk_cap_gb > 0 && (
                                <>
                                    <div style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 4 }}>
                                        Disk {n.disk_used_gb}/{n.disk_cap_gb} GB (
                                        {Math.round((n.disk_used_gb / n.disk_cap_gb) * 100)}%)
                                    </div>
                                    <div style={{ height: 6, background: THEME.glassBorder, borderRadius: 3 }}>
                                        <div
                                            style={{
                                                width: `${(n.disk_used_gb / n.disk_cap_gb) * 100}%`,
                                                height: '100%',
                                                background: RS_BLUE,
                                                borderRadius: 3,
                                            }}
                                        />
                                    </div>
                                    <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 8 }}>
                                        R {n.read_iops.toLocaleString()} IOPS · W {n.write_iops.toLocaleString()} IOPS
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </Panel>
        </div>
    );
}

// ── Query history
function QueryHistoryPanel() {
    return (
        <Panel title="STL_QUERY — last hour" icon={Activity} accentColor={RS_ORANGE}>
            <DataTable
                accentColor={RS_ORANGE}
                columns={[
                    { key: 'qid', label: 'QID' },
                    { key: 'user', label: 'User' },
                    { key: 'queue', label: 'Queue' },
                    { key: 'dur', label: 'Duration' },
                    { key: 'wait', label: 'Queued' },
                    { key: 'returned', label: 'Rows returned' },
                    { key: 'status', label: 'Status' },
                    { key: 'sql', label: 'SQL preview' },
                ]}
                rows={RD.queryHistory.map((q) => ({
                    qid: q.qid,
                    user: q.user,
                    queue: q.queue,
                    dur: q.duration_sec === 0 ? '—' : `${q.duration_sec}s`,
                    wait: `${q.queue_sec.toFixed(1)}s`,
                    returned: q.returned.toLocaleString(),
                    status: q.aborted ? 'ABORTED' : 'OK',
                    sql: q.sql.length > 70 ? q.sql.slice(0, 70) + '…' : q.sql,
                }))}
            />
        </Panel>
    );
}

// ── Locks
function LocksPanel() {
    return (
        <Panel title="STV_LOCKS — active transactions" icon={Lock} accentColor={RS_RED}>
            <DataTable
                accentColor={RS_RED}
                columns={[
                    { key: 'pid', label: 'PID' },
                    { key: 'user', label: 'User' },
                    { key: 'txn_start', label: 'Txn start' },
                    { key: 'mode', label: 'Lock mode' },
                    { key: 'relation', label: 'Relation' },
                    { key: 'granted', label: 'Granted' },
                    { key: 'waiting_on', label: 'Waiting on PID' },
                ]}
                rows={RD.locks.map((l) => ({
                    pid: l.pid,
                    user: l.user,
                    txn_start: l.txn_start,
                    mode: l.mode,
                    relation: l.relation,
                    granted: l.granted ? '✓' : '—',
                    waiting_on: l.waiting_on || '—',
                }))}
            />
        </Panel>
    );
}

const PANELS = [
    { id: 'overview', label: 'Overview', icon: Gauge },
    { id: 'wlm', label: 'WLM Queues', icon: Settings },
    { id: 'vacuum', label: 'Vacuum', icon: Zap },
    { id: 'distribution', label: 'Distribution', icon: Layers },
    { id: 'nodes', label: 'Nodes', icon: Box },
    { id: 'queries', label: 'Query History', icon: Activity },
    { id: 'locks', label: 'Locks', icon: Lock },
];

export default function DemoRedshiftFullTab({ subTabId }: { subTabId?: string } = {}) {
    useAdaptiveTheme();
    void subTabId;
    const { sections, renderContent } = buildMetricsTab(catalog);
    return (
        <DemoLayout
            title="Amazon Redshift"
            subtitle="ra3.4xlarge · 8 nodes · us-east-1"
            accentColor={catalog.accentColor}
            connectionBarMeta={{ lastSync: '8s', refreshInterval: '30s' }}
            titleIcon={Database}
            activeDemo="demo-redshift"
            sections={sections}
            renderContent={renderContent}
        />
    );
}
