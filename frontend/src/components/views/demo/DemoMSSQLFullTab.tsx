// ==========================================================================
//  DemoMSSQLFullTab.tsx — bespoke SQL Server demo.
//
//  Panels:
//    Overview         — KPIs + batch req/sec trend + alerts
//    Query Store      — top-N queries with regression detector
//    Wait Stats       — sys.dm_os_wait_stats delta breakdown (donut + trend)
//    Always-On AG     — replica health graph w/ send + redo queue depths
//    Deadlocks        — SVG deadlock graph viewer
//    Missing Indexes  — sys.dm_db_missing_index_details recommendations
//    Index Health     — fragmentation + page density per index
//    Buffer Pool      — cached pages by database (stacked bar)
// ==========================================================================

import React, { useState } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { buildMetricsTab } from './useMetricsTab';
import catalog from '../../../utils/catalogs/mssqlCatalog';
import DemoLayout, { Panel, DataTable, AlertRow } from './DemoLayout';
import {
    Database,
    Activity,
    AlertTriangle,
    Clock,
    Zap,
    Shield,
    Link2,
    Layers,
    HardDrive,
    CheckCircle,
    Gauge,
    TrendingUp,
    GitBranch,
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
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LabelList,
} from 'recharts';

const SQL_RED = '#CC2927';
const SQL_BLUE = '#0078D4';
const SQL_AMBER = '#F2C744';
const SQL_GREEN = '#107C10';

const now = Date.now();
const tMinus = (m: number) => new Date(now - m * 60_000).toISOString();
function fmtHour(iso: string) {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────
const MS = {
    identity: {
        server_name: 'sql-primary.prod.acme',
        version: 'SQL Server 2022 (16.0.4085.2) CU13',
        edition: 'Enterprise',
        collation: 'SQL_Latin1_General_CP1_CI_AS',
        cluster: 'PULSEDB_AG',
        os: 'Windows Server 2022',
    },
    kpis: [
        { label: 'Batch req/s', value: '12,480', unit: '', color: SQL_BLUE, icon: Activity },
        { label: 'Buffer hit', value: '99.7', unit: '%', color: SQL_GREEN, icon: HardDrive },
        { label: 'Page life exp', value: '8,214', unit: 's', color: SQL_BLUE, icon: Clock },
        { label: 'Active conns', value: '147', unit: '', color: SQL_BLUE, icon: Database },
        { label: 'Deadlocks', value: '2', unit: '/hr', color: SQL_AMBER, icon: Shield },
        { label: 'Blocking', value: '1', unit: '', color: SQL_AMBER, icon: Layers },
    ],
    batchReqTrend: Array.from({ length: 48 }, (_, i) => ({
        t: tMinus((47 - i) * 5),
        batch: Math.round(12000 + Math.sin(i / 3) * 1800 + Math.random() * 400),
        compile: Math.round(180 + Math.sin(i / 4) * 40 + Math.random() * 20),
        recompile: Math.round(12 + Math.random() * 6),
    })),
    queryStore: [
        {
            query_id: '1842',
            plan_id: '2011',
            query_text:
                'SELECT o.*, c.* FROM Orders o JOIN Customers c ON o.CustomerId=c.Id WHERE o.CreatedAt >= @start',
            exec_count_1h: 48_210,
            avg_cpu_ms: 412,
            avg_duration_ms: 842,
            regression: { baseline: 184, current: 842, pct: 358 },
            last_exec: '2m ago',
        },
        {
            query_id: '1911',
            plan_id: '2044',
            query_text: "EXEC sp_RebuildOrderIndex @TableName=N'Orders'",
            exec_count_1h: 12,
            avg_cpu_ms: 18_200,
            avg_duration_ms: 28_400,
            regression: null,
            last_exec: '48m ago',
        },
        {
            query_id: '2018',
            plan_id: '2078',
            query_text: 'SELECT TOP 100 * FROM AuditLog WITH (NOLOCK) ORDER BY CreatedAt DESC',
            exec_count_1h: 1_842,
            avg_cpu_ms: 84,
            avg_duration_ms: 498,
            regression: null,
            last_exec: '12s ago',
        },
        {
            query_id: '2100',
            plan_id: '2101',
            query_text: 'UPDATE Inventory SET StockCount = StockCount - 1 WHERE Sku = @sku',
            exec_count_1h: 8_420,
            avg_cpu_ms: 42,
            avg_duration_ms: 411,
            regression: { baseline: 88, current: 411, pct: 367 },
            last_exec: '4s ago',
        },
        {
            query_id: '2200',
            plan_id: '2210',
            query_text: 'SELECT dbo.fn_CalcTotal(OrderId) FROM Orders',
            exec_count_1h: 142,
            avg_cpu_ms: 1_842,
            avg_duration_ms: 2_412,
            regression: null,
            last_exec: '8m ago',
        },
    ],
    waitStats: {
        total_ms: 655_720,
        top: [
            { name: 'PAGEIOLATCH_SH', value: 412_000, color: SQL_RED },
            { name: 'LCK_M_S', value: 98_120, color: THEME.dangerLight },
            { name: 'CXPACKET', value: 71_400, color: SQL_AMBER },
            { name: 'WRITELOG', value: 32_800, color: THEME.secondary },
            { name: 'SOS_SCHEDULER_YIELD', value: 18_600, color: '#8D6E63' },
            { name: 'ASYNC_NETWORK_IO', value: 14_200, color: THEME.aiDark },
            { name: 'LATCH_EX', value: 8_600, color: THEME.warningDark },
        ],
    },
    waitTrend: Array.from({ length: 24 }, (_, i) => ({
        t: tMinus((23 - i) * 5),
        PAGEIOLATCH: 18_000 + Math.sin(i / 3) * 4_000 + Math.random() * 2_000,
        LCK_M_S: 4_000 + Math.sin(i / 4) * 1_000 + Math.random() * 500,
        CXPACKET: 3_000 + Math.random() * 800,
    })),
    alwaysOn: {
        name: 'PULSEDB_AG',
        role: 'PRIMARY',
        cluster_type: 'WSFC',
        replicas: [
            {
                name: 'sql-primary',
                role: 'PRIMARY',
                availability_mode: 'SYNCHRONOUS_COMMIT',
                sync_state: 'SYNCHRONIZED',
                send_queue_kb: 0,
                redo_queue_kb: 0,
                redo_rate_kbps: 0,
                last_committed_lsn: '184210:8421:1',
            },
            {
                name: 'sql-sec-east',
                role: 'SECONDARY',
                availability_mode: 'SYNCHRONOUS_COMMIT',
                sync_state: 'SYNCHRONIZED',
                send_queue_kb: 12,
                redo_queue_kb: 0,
                redo_rate_kbps: 12_400,
                last_committed_lsn: '184210:8421:1',
            },
            {
                name: 'sql-sec-west',
                role: 'SECONDARY',
                availability_mode: 'ASYNCHRONOUS_COMMIT',
                sync_state: 'SYNCHRONIZING',
                send_queue_kb: 4_200,
                redo_queue_kb: 1_800,
                redo_rate_kbps: 8_200,
                last_committed_lsn: '184210:8420:8',
            },
        ],
    },
    deadlock: {
        detected: '2m ago',
        victim: 'spid 64',
        graph: {
            processes: [
                {
                    spid: 54,
                    db: 'pulsedb_prod',
                    query: "UPDATE Orders SET Status='Shipped' WHERE Id=@id",
                    lock_mode: 'X',
                    resource: 'KEY: Orders.PK_Orders(id=8421)',
                },
                {
                    spid: 64,
                    db: 'pulsedb_prod',
                    query: 'UPDATE OrderLines SET Qty=@q WHERE OrderId=@id',
                    lock_mode: 'X',
                    resource: 'KEY: OrderLines.FK_OrderId(id=8421)',
                },
            ],
            edges: [
                { from: 54, to: 64, wait: 'X', resource: 'OrderLines.FK_OrderId' },
                { from: 64, to: 54, wait: 'X', resource: 'Orders.PK_Orders' },
            ],
        },
    },
    missingIndexes: [
        {
            database: 'pulsedb_prod',
            schema: 'dbo',
            table: 'Orders',
            equality: 'CustomerId',
            inequality: null,
            included: 'OrderDate, Total',
            impact: 88.4,
            uses: 48_210,
        },
        {
            database: 'pulsedb_prod',
            schema: 'dbo',
            table: 'LineItems',
            equality: 'ProductId',
            inequality: null,
            included: 'Qty, Price',
            impact: 72.1,
            uses: 18_420,
        },
        {
            database: 'pulsedb_prod',
            schema: 'dbo',
            table: 'AuditLog',
            equality: null,
            inequality: 'CreatedAt',
            included: 'EventType',
            impact: 62.8,
            uses: 8_420,
        },
        {
            database: 'pulsedb_prod',
            schema: 'dbo',
            table: 'Inventory',
            equality: 'Sku',
            inequality: null,
            included: 'StockCount',
            impact: 44.2,
            uses: 1_240,
        },
    ],
    indexes: [
        {
            table: 'dbo.Orders',
            index: 'PK_Orders',
            kind: 'Clustered',
            frag_pct: 2.1,
            page_density: 98.4,
            page_count: 8_421,
        },
        {
            table: 'dbo.Orders',
            index: 'IX_Orders_OrderDate',
            kind: 'Nonclustered',
            frag_pct: 42.1,
            page_density: 68.2,
            page_count: 18_420,
            action: 'REORGANIZE',
        },
        {
            table: 'dbo.Customers',
            index: 'PK_Customers',
            kind: 'Clustered',
            frag_pct: 1.2,
            page_density: 99.1,
            page_count: 1_842,
        },
        {
            table: 'dbo.LineItems',
            index: 'IX_LineItems_OrderId',
            kind: 'Nonclustered',
            frag_pct: 18.8,
            page_density: 82.4,
            page_count: 42_100,
        },
        {
            table: 'dbo.AuditLog',
            index: 'IX_AuditLog_CreatedAt',
            kind: 'Nonclustered',
            frag_pct: 58.4,
            page_density: 54.1,
            page_count: 92_100,
            action: 'REBUILD',
        },
    ],
    bufferPool: [
        { database: 'pulsedb_prod', Orders: 842, Customers: 412, LineItems: 1_842, AuditLog: 2_210, Other: 184 },
        { database: 'pulsedb_staging', Orders: 124, Customers: 88, LineItems: 420, AuditLog: 412, Other: 62 },
        { database: 'master', Orders: 0, Customers: 0, LineItems: 0, AuditLog: 0, Other: 18 },
        { database: 'msdb', Orders: 0, Customers: 0, LineItems: 0, AuditLog: 0, Other: 42 },
    ],
    alerts: [
        {
            severity: 'warning',
            title: 'Query 1842 regressed 358% — new plan estimated high',
            time: '8m ago',
            source: 'query-store',
        },
        { severity: 'warning', title: 'sql-sec-west async, 4,200 KB send queue', time: '14m ago', source: 'alwayson' },
        {
            severity: 'info',
            title: 'IX_AuditLog_CreatedAt fragmentation 58% — REBUILD',
            time: '22m ago',
            source: 'index-advisor',
        },
    ],
};

// ─────────────────────────────────────────────────────────────────────────

function KpiTile({ k }: { k: (typeof MS.kpis)[0] }) {
    const Icon = k.icon;
    return (
        <div
            style={{
                padding: 16,
                borderRadius: 12,
                background: THEME.surface,
                border: `1px solid ${THEME.glassBorder}`,
                borderTop: `2px solid ${k.color}`,
                boxShadow: THEME.shadowSm,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: THEME.textMuted, fontSize: 12 }}>
                <Icon size={14} style={{ color: k.color }} />
                <span>{k.label}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color, marginTop: 4 }}>
                {k.value}
                <span style={{ fontSize: 12, color: THEME.textDim, marginLeft: 4 }}>{k.unit}</span>
            </div>
        </div>
    );
}

function OverviewPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Server identity" icon={Database} accentColor={SQL_RED}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 12,
                        padding: 16,
                    }}
                >
                    {Object.entries(MS.identity).map(([k, v]) => (
                        <div
                            key={k}
                            style={{
                                padding: 12,
                                borderLeft: `3px solid ${SQL_RED}`,
                                background: THEME.surfaceHover,
                                border: `1px solid ${THEME.glassBorder}`,
                                borderLeftWidth: 3,
                                borderLeftColor: SQL_RED,
                                borderRadius: 6,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 11,
                                    color: THEME.textDim,
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.5,
                                }}
                            >
                                {k.replace(/_/g, ' ')}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: THEME.textMain }}>
                                {v}
                            </div>
                        </div>
                    ))}
                </div>
            </Panel>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {MS.kpis.map((k) => (
                    <KpiTile key={k.label} k={k} />
                ))}
            </div>

            <Panel title="Batch requests / sec — last 4h" icon={TrendingUp} accentColor={SQL_RED}>
                <div style={{ height: 280, padding: 12 }}>
                    <ResponsiveContainer>
                        <ComposedChart data={MS.batchReqTrend}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="t" tickFormatter={fmtHour} fontSize={11} />
                            <YAxis yAxisId="b" orientation="left" fontSize={11} />
                            <YAxis yAxisId="c" orientation="right" fontSize={11} />
                            <Tooltip labelFormatter={(v: any) => fmtHour(String(v))} />
                            <Legend />
                            <Area
                                yAxisId="b"
                                type="monotone"
                                dataKey="batch"
                                stroke={SQL_RED}
                                fill={SQL_RED}
                                fillOpacity={0.2}
                                name="Batch req/s"
                            />
                            <Line
                                yAxisId="c"
                                type="monotone"
                                dataKey="compile"
                                stroke={SQL_BLUE}
                                strokeWidth={2}
                                dot={false}
                                name="Compiles/s"
                            />
                            <Line
                                yAxisId="c"
                                type="monotone"
                                dataKey="recompile"
                                stroke={SQL_AMBER}
                                strokeWidth={2}
                                dot={false}
                                name="Recompiles/s"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </Panel>

            <Panel title="Alerts" icon={AlertTriangle} accentColor={SQL_RED}>
                <div style={{ padding: '4px 0' }}>
                    {MS.alerts.map((a, i) => (
                        <AlertRow
                            key={i}
                            severity={a.severity as any}
                            title={a.title}
                            time={a.time}
                            source={a.source}
                            color={a.severity === 'warning' ? SQL_AMBER : SQL_BLUE}
                        />
                    ))}
                </div>
            </Panel>
        </div>
    );
}

// ── Query Store
function QueryStorePanel() {
    const [selected, setSelected] = useState<string>(MS.queryStore[0].query_id);
    const q = MS.queryStore.find((x) => x.query_id === selected)!;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Top queries by impact — last 1h" icon={Activity} accentColor={SQL_RED}>
                <div style={{ padding: 12 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr style={{ background: THEME.surfaceHover, borderBottom: `2px solid ${SQL_RED}` }}>
                                <th style={{ padding: '10px', textAlign: 'left' }}>Query</th>
                                <th style={{ padding: '10px', textAlign: 'right' }}>Execs/h</th>
                                <th style={{ padding: '10px', textAlign: 'right' }}>Avg CPU</th>
                                <th style={{ padding: '10px', textAlign: 'right' }}>Avg dur</th>
                                <th style={{ padding: '10px', textAlign: 'center' }}>Regression</th>
                                <th style={{ padding: '10px', textAlign: 'left' }}>Last</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MS.queryStore.map((r) => (
                                <tr
                                    key={r.query_id}
                                    onClick={() => setSelected(r.query_id)}
                                    style={{
                                        cursor: 'pointer',
                                        borderBottom: `1px solid ${THEME.glassBorder}`,
                                        background: selected === r.query_id ? `${SQL_RED}10` : 'transparent',
                                    }}
                                >
                                    <td
                                        style={{
                                            padding: '10px',
                                            fontFamily: 'monospace',
                                            maxWidth: 360,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        #{r.query_id} · {r.query_text.slice(0, 80)}
                                        {r.query_text.length > 80 ? '…' : ''}
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'right' }}>
                                        {r.exec_count_1h.toLocaleString()}
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'right' }}>{r.avg_cpu_ms} ms</td>
                                    <td style={{ padding: '10px', textAlign: 'right' }}>{r.avg_duration_ms} ms</td>
                                    <td style={{ padding: '10px', textAlign: 'center' }}>
                                        {r.regression ? (
                                            <span
                                                style={{
                                                    padding: '2px 8px',
                                                    borderRadius: 4,
                                                    fontSize: 11,
                                                    fontWeight: 600,
                                                    background: `${SQL_RED}1f`,
                                                    color: SQL_RED,
                                                }}
                                            >
                                                +{r.regression.pct}%
                                            </span>
                                        ) : (
                                            <span style={{ color: THEME.textDim }}>—</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '10px' }}>{r.last_exec}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Panel>

            <Panel title={`Query #${q.query_id} — plan detail`} icon={Layers} accentColor={SQL_RED}>
                <div style={{ padding: 16 }}>
                    <div
                        style={{
                            fontFamily: 'monospace',
                            fontSize: 11,
                            background: THEME.bgAlt || THEME.bg,
                            color: THEME.textMain,
                            padding: 12,
                            borderRadius: 6,
                            marginBottom: 12,
                        }}
                    >
                        {q.query_text}
                    </div>
                    {q.regression ? (
                        <div
                            style={{
                                padding: 12,
                                background: `${SQL_RED}10`,
                                borderRadius: 8,
                                borderLeft: `4px solid ${SQL_RED}`,
                            }}
                        >
                            <div style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 4 }}>
                                PLAN REGRESSION DETECTED
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                                <div>
                                    <div style={{ fontSize: 11, color: THEME.textMuted }}>Baseline plan</div>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: SQL_GREEN }}>
                                        {q.regression.baseline} ms
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: THEME.textMuted }}>Current plan</div>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: SQL_RED }}>
                                        {q.regression.current} ms
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: THEME.textMuted }}>Recommendation</div>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                                        Force baseline plan via <code>sp_query_store_force_plan</code>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div
                            style={{
                                padding: 12,
                                background: `${SQL_GREEN}10`,
                                borderRadius: 8,
                                borderLeft: `4px solid ${SQL_GREEN}`,
                            }}
                        >
                            <div style={{ fontSize: 13 }}>
                                <CheckCircle
                                    size={14}
                                    style={{ verticalAlign: 'middle', marginRight: 6, color: SQL_GREEN }}
                                />
                                No regression detected — query plan is stable.
                            </div>
                        </div>
                    )}
                </div>
            </Panel>
        </div>
    );
}

// ── Wait Stats
function WaitStatsPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Panel title="Top waits — last hour" icon={Clock} accentColor={SQL_RED}>
                    <div style={{ height: 320, padding: 12 }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie
                                    data={MS.waitStats.top}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    label={(p: any) =>
                                        `${p.name} ${((p.value / MS.waitStats.total_ms) * 100).toFixed(1)}%`
                                    }
                                >
                                    {MS.waitStats.top.map((s, i) => (
                                        <Cell key={i} fill={s.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(v: any) => `${(Number(v) / 1000).toFixed(1)} s`} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>
                <Panel title="Wait trend (top 3) — last 2h" icon={TrendingUp} accentColor={SQL_RED}>
                    <div style={{ height: 320, padding: 12 }}>
                        <ResponsiveContainer>
                            <LineChart data={MS.waitTrend}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                <XAxis dataKey="t" tickFormatter={fmtHour} fontSize={11} />
                                <YAxis fontSize={11} />
                                <Tooltip labelFormatter={(v: any) => fmtHour(String(v))} />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="PAGEIOLATCH"
                                    stroke={SQL_RED}
                                    strokeWidth={2}
                                    dot={false}
                                />
                                <Line type="monotone" dataKey="LCK_M_S" stroke={THEME.dangerLight} strokeWidth={2} dot={false} />
                                <Line
                                    type="monotone"
                                    dataKey="CXPACKET"
                                    stroke={SQL_AMBER}
                                    strokeWidth={2}
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>
            </div>
            <Panel title="Wait stats detail" icon={Clock} accentColor={SQL_RED}>
                <DataTable
                    accentColor={SQL_RED}
                    columns={[
                        { key: 'name', label: 'Wait type' },
                        { key: 'ms', label: 'Wait time (ms)' },
                        { key: 'pct', label: 'Share' },
                    ]}
                    rows={MS.waitStats.top.map((w) => ({
                        name: w.name,
                        ms: w.value.toLocaleString(),
                        pct: `${((w.value / MS.waitStats.total_ms) * 100).toFixed(1)}%`,
                    }))}
                />
            </Panel>
        </div>
    );
}

// ── Always-On
function AlwaysOnPanel() {
    const ag = MS.alwaysOn;
    const replicaColor = (s: string) =>
        s === 'SYNCHRONIZED' ? SQL_GREEN : s === 'SYNCHRONIZING' ? SQL_AMBER : SQL_RED;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title={`Availability Group: ${ag.name}`} icon={GitBranch} accentColor={SQL_BLUE}>
                <div style={{ padding: 20 }}>
                    <svg width="100%" height={200} viewBox="0 0 720 200">
                        {ag.replicas.map((r, i) => {
                            const x = 60 + i * (620 / (ag.replicas.length - 1));
                            const isPrim = r.role === 'PRIMARY';
                            const color = replicaColor(r.sync_state);
                            return (
                                <g key={r.name}>
                                    {i > 0 && (
                                        <line
                                            x1={60 + (i - 1) * (620 / (ag.replicas.length - 1))}
                                            y1={100}
                                            x2={x}
                                            y2={100}
                                            stroke={color}
                                            strokeWidth={2}
                                            strokeDasharray={r.sync_state === 'SYNCHRONIZING' ? '6 4' : undefined}
                                        />
                                    )}
                                    <circle
                                        cx={x}
                                        cy={100}
                                        r={isPrim ? 34 : 28}
                                        fill={isPrim ? SQL_RED : color}
                                        stroke={THEME.surfaceRaised}
                                        strokeWidth={2}
                                    />
                                    <text x={x} y={105} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff">
                                        {r.role}
                                    </text>
                                    <text x={x} y={60} textAnchor="middle" fontSize={12} fontWeight={600}>
                                        {r.name}
                                    </text>
                                    <text x={x} y={150} textAnchor="middle" fontSize={10} fill={THEME.textDim}>
                                        {r.availability_mode}
                                    </text>
                                    <text x={x} y={164} textAnchor="middle" fontSize={10} fill={THEME.textDim}>
                                        {r.sync_state}
                                    </text>
                                    {r.send_queue_kb > 0 && (
                                        <text x={x} y={180} textAnchor="middle" fontSize={10} fill={SQL_AMBER}>
                                            send queue: {r.send_queue_kb} KB
                                        </text>
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                </div>
            </Panel>
            <Panel title="Replica detail" icon={Layers} accentColor={SQL_BLUE}>
                <DataTable
                    accentColor={SQL_BLUE}
                    columns={[
                        { key: 'name', label: 'Replica' },
                        { key: 'role', label: 'Role' },
                        { key: 'availability_mode', label: 'Avail. mode' },
                        { key: 'sync_state', label: 'Sync state' },
                        { key: 'send_queue_kb', label: 'Send queue (KB)' },
                        { key: 'redo_queue_kb', label: 'Redo queue (KB)' },
                        { key: 'redo_rate_kbps', label: 'Redo rate (KB/s)' },
                    ]}
                    rows={ag.replicas}
                />
            </Panel>
        </div>
    );
}

// ── Deadlock graph
function DeadlocksPanel() {
    const d = MS.deadlock;
    return (
        <Panel title={`Deadlock detected ${d.detected} — victim ${d.victim}`} icon={Shield} accentColor={SQL_RED}>
            <div style={{ padding: 20 }}>
                <svg width="100%" height={280} viewBox="0 0 600 280">
                    {/* Process nodes */}
                    {d.graph.processes.map((p, i) => {
                        const cx = i === 0 ? 140 : 460;
                        const cy = 140;
                        const isVictim = d.victim.includes(String(p.spid));
                        return (
                            <g key={p.spid}>
                                <circle
                                    cx={cx}
                                    cy={cy}
                                    r={44}
                                    fill={isVictim ? SQL_RED : SQL_BLUE}
                                    stroke={THEME.surfaceRaised}
                                    strokeWidth={2}
                                />
                                <text x={cx} y={cy - 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">
                                    SPID {p.spid}
                                </text>
                                <text x={cx} y={cy + 12} textAnchor="middle" fontSize={10} fill="#fff" opacity={0.9}>
                                    {isVictim ? 'VICTIM' : 'winner'}
                                </text>
                                <text x={cx} y={cy - 60} textAnchor="middle" fontSize={11} fontWeight={600}>
                                    {p.db}
                                </text>
                                <text x={cx} y={cy + 80} textAnchor="middle" fontSize={10} fill={THEME.textDim}>
                                    holds {p.lock_mode} on
                                </text>
                                <text x={cx} y={cy + 96} textAnchor="middle" fontSize={10} fontFamily="monospace">
                                    {p.resource.slice(0, 44)}
                                </text>
                            </g>
                        );
                    })}
                    {/* Edges */}
                    <defs>
                        <marker
                            id="arrow"
                            viewBox="0 0 10 10"
                            refX="8"
                            refY="5"
                            markerWidth="8"
                            markerHeight="8"
                            orient="auto"
                        >
                            <path d="M 0 0 L 10 5 L 0 10 z" fill={SQL_RED} />
                        </marker>
                    </defs>
                    <path
                        d="M 184 120 Q 300 80 416 120"
                        fill="none"
                        stroke={SQL_RED}
                        strokeWidth={2}
                        markerEnd="url(#arrow)"
                    />
                    <path
                        d="M 416 160 Q 300 200 184 160"
                        fill="none"
                        stroke={SQL_RED}
                        strokeWidth={2}
                        markerEnd="url(#arrow)"
                    />
                    <text x={300} y={70} textAnchor="middle" fontSize={10} fill={SQL_RED}>
                        waits for {d.graph.edges[0].wait}
                    </text>
                    <text x={300} y={218} textAnchor="middle" fontSize={10} fill={SQL_RED}>
                        waits for {d.graph.edges[1].wait}
                    </text>
                </svg>

                <div style={{ marginTop: 12 }}>
                    {d.graph.processes.map((p) => (
                        <div
                            key={p.spid}
                            style={{ padding: 10, background: THEME.surfaceHover, borderRadius: 6, marginBottom: 8 }}
                        >
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>
                                SPID {p.spid} — {p.db}
                            </div>
                            <div style={{ fontFamily: 'monospace', fontSize: 12, marginTop: 4 }}>{p.query}</div>
                        </div>
                    ))}
                </div>
            </div>
        </Panel>
    );
}

// ── Missing indexes
function MissingIndexesPanel() {
    return (
        <Panel title="Missing index recommendations" icon={Link2} accentColor={SQL_AMBER}>
            <div style={{ padding: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                        <tr style={{ background: THEME.surfaceHover, borderBottom: `2px solid ${SQL_AMBER}` }}>
                            <th style={{ padding: '10px', textAlign: 'left' }}>Table</th>
                            <th style={{ padding: '10px', textAlign: 'left' }}>Equality</th>
                            <th style={{ padding: '10px', textAlign: 'left' }}>Inequality</th>
                            <th style={{ padding: '10px', textAlign: 'left' }}>Included</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>Impact</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>Uses</th>
                        </tr>
                    </thead>
                    <tbody>
                        {MS.missingIndexes.map((m, i) => (
                            <tr key={i} style={{ borderBottom: `1px solid ${THEME.glassBorder}` }}>
                                <td style={{ padding: '10px', fontFamily: 'monospace' }}>
                                    {m.database}.{m.schema}.{m.table}
                                </td>
                                <td style={{ padding: '10px' }}>{m.equality || '—'}</td>
                                <td style={{ padding: '10px' }}>{m.inequality || '—'}</td>
                                <td style={{ padding: '10px' }}>{m.included || '—'}</td>
                                <td
                                    style={{
                                        padding: '10px',
                                        textAlign: 'right',
                                        fontWeight: 600,
                                        color: m.impact > 70 ? SQL_RED : m.impact > 40 ? SQL_AMBER : SQL_GREEN,
                                    }}
                                >
                                    {m.impact.toFixed(1)}
                                </td>
                                <td style={{ padding: '10px', textAlign: 'right' }}>{m.uses.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{ fontSize: 11, color: THEME.textDim, padding: '10px 12px 0', fontStyle: 'italic' }}>
                    Impact score combines avg_user_cost × avg_total_user_cost × user_seeks
                    (sys.dm_db_missing_index_group_stats).
                </div>
            </div>
        </Panel>
    );
}

// ── Index health
function IndexHealthPanel() {
    return (
        <Panel title="Index health" icon={Link2} accentColor={SQL_RED}>
            <DataTable
                accentColor={SQL_RED}
                columns={[
                    { key: 'table', label: 'Table' },
                    { key: 'index', label: 'Index' },
                    { key: 'kind', label: 'Type' },
                    { key: 'frag', label: 'Fragmentation' },
                    { key: 'density', label: 'Page density' },
                    { key: 'pages', label: 'Pages' },
                    { key: 'action', label: 'Action' },
                ]}
                rows={MS.indexes.map((i) => ({
                    table: i.table,
                    index: i.index,
                    kind: i.kind,
                    frag: `${i.frag_pct.toFixed(1)}%`,
                    density: `${i.page_density.toFixed(1)}%`,
                    pages: i.page_count.toLocaleString(),
                    action: i.action || '—',
                }))}
            />
        </Panel>
    );
}

// ── Buffer pool
function BufferPoolPanel() {
    return (
        <Panel title="Buffer pool by database" icon={HardDrive} accentColor={SQL_BLUE}>
            <div style={{ height: 340, padding: 12 }}>
                <ResponsiveContainer>
                    <BarChart data={MS.bufferPool}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="database" fontSize={11} />
                        <YAxis
                            fontSize={11}
                            label={{ value: 'Pages (×1000)', angle: -90, position: 'insideLeft', fontSize: 10 }}
                        />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Orders" stackId="a" fill={SQL_RED} />
                        <Bar dataKey="Customers" stackId="a" fill={SQL_BLUE} />
                        <Bar dataKey="LineItems" stackId="a" fill={SQL_AMBER} />
                        <Bar dataKey="AuditLog" stackId="a" fill={SQL_GREEN} />
                        <Bar dataKey="Other" stackId="a" fill={THEME.textDim} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div style={{ fontSize: 11, color: THEME.textDim, padding: '0 12px 12px', fontStyle: 'italic' }}>
                From <code>sys.dm_os_buffer_descriptors</code>. AuditLog consuming 2.2M pages in pulsedb_prod — 50%+ of
                pool.
            </div>
        </Panel>
    );
}

// ─────────────────────────────────────────────────────────────────────────

const PANELS = [
    { id: 'overview', label: 'Overview', icon: Gauge },
    { id: 'querystore', label: 'Query Store', icon: Activity },
    { id: 'waits', label: 'Wait Stats', icon: Clock },
    { id: 'alwayson', label: 'Always-On', icon: GitBranch },
    { id: 'deadlocks', label: 'Deadlocks', icon: Shield },
    { id: 'missing', label: 'Missing Indexes', icon: Link2 },
    { id: 'indexes', label: 'Index Health', icon: Box },
    { id: 'bufferpool', label: 'Buffer Pool', icon: HardDrive },
];

export default function DemoMSSQLFullTab({ subTabId }: { subTabId?: string } = {}) {
    useAdaptiveTheme();
    void subTabId;
    const { sections, renderContent } = buildMetricsTab(catalog);
    return (
        <DemoLayout
            title="Microsoft SQL Server"
            subtitle="SQL Server 2022 Enterprise · sql-primary.prod.acme"
            accentColor={catalog.accentColor}
            connectionBarMeta={{ lastSync: '8s', refreshInterval: '30s' }}
            titleIcon={Database}
            activeDemo="demo-mssql"
            sections={sections}
            renderContent={renderContent}
        />
    );
}
