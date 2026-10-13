// ==========================================================================
//  DemoElasticFullTab.tsx — bespoke Elasticsearch demo.
//  Overview | Shards | Hot Threads | ILM | Rollover | Cluster | Profiler | Mapping
// ==========================================================================

import React, { useState } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { buildMetricsTab } from './useMetricsTab';
import catalog from '../../../utils/catalogs/elasticCatalog';
import DemoLayout, { Panel, StatusBadge, DataTable, TabPills, AlertRow } from './DemoLayout';
import {
    Database,
    Activity,
    AlertTriangle,
    Clock,
    Layers,
    Cpu,
    Search,
    HardDrive,
    CheckCircle,
    Gauge,
    GitBranch,
    Zap,
    FileText,
} from 'lucide-react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ComposedChart,
    Area,
} from 'recharts';

const ES_TEAL = '#00BFB3';
const ES_NAVY = '#005571';
const ES_PINK = '#FEC514';
const ES_RED = THEME.dangerDark;
const ES_GREEN = THEME.successLight;

const now = Date.now();
const tMinus = (m: number) => new Date(now - m * 60_000).toISOString();
const fmtHour = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const ES = {
    identity: {
        cluster_name: 'pulsedb-search',
        cluster_uuid: 'aBcD-1234',
        version: '8.14.3',
        data_nodes: '3',
        master_nodes: '3',
        total_shards: '842',
    },
    kpis: [
        { label: 'Index rate', value: '22,481', unit: 'docs/s', color: ES_TEAL, icon: FileText },
        { label: 'Search rate', value: '1,482', unit: 'qps', color: ES_TEAL, icon: Search },
        { label: 'P95 search', value: '42', unit: 'ms', color: ES_GREEN, icon: Clock },
        { label: 'Cluster state', value: 'GREEN', unit: '', color: ES_GREEN, icon: CheckCircle },
        { label: 'Active shards', value: '842', unit: '/ 842', color: ES_GREEN, icon: Layers },
        { label: 'Unassigned', value: '0', unit: '', color: ES_GREEN, icon: AlertTriangle },
    ],
    rateTrend: Array.from({ length: 48 }, (_, i) => ({
        t: tMinus((47 - i) * 5),
        index_ps: Math.round(22000 + Math.sin(i / 3) * 3000 + Math.random() * 1000),
        search_ps: Math.round(1400 + Math.sin(i / 4) * 200 + Math.random() * 100),
        p95_ms: Math.round(40 + Math.sin(i / 5) * 8 + Math.random() * 4),
    })),
    nodes: [
        {
            name: 'node-1',
            role: 'master+data',
            cpu_pct: 42,
            heap_pct: 62,
            disk_pct: 58,
            shards: 284,
            ingest_rate: 12_210,
            zone: 'us-east-1a',
        },
        {
            name: 'node-2',
            role: 'data',
            cpu_pct: 38,
            heap_pct: 58,
            disk_pct: 62,
            shards: 279,
            ingest_rate: 9_840,
            zone: 'us-east-1b',
        },
        {
            name: 'node-3',
            role: 'data',
            cpu_pct: 44,
            heap_pct: 68,
            disk_pct: 54,
            shards: 279,
            ingest_rate: 8_420,
            zone: 'us-east-1c',
        },
    ],
    shardDistribution: [
        { index: 'logs-app-2026.04.23', node1: 2, node2: 2, node3: 2, total: 6 },
        { index: 'logs-app-2026.04.22', node1: 2, node2: 2, node3: 2, total: 6 },
        { index: 'logs-app-2026.04.21', node1: 2, node2: 2, node3: 2, total: 6 },
        { index: 'metrics-otel-2026-04', node1: 4, node2: 3, node3: 3, total: 10 },
        { index: 'audit-2026-04', node1: 2, node2: 1, node3: 2, total: 5 },
    ],
    hotThreads: [
        {
            node: 'node-3',
            cpu_pct: 42.1,
            state: 'RUNNABLE',
            name: '[search][logs-app][0]',
            stack: 'org.elasticsearch.search.SearchService.executeQueryPhase\n  at ... Lucene IndexSearcher.search\n  at ... TermInSetQuery.rewrite',
        },
        {
            node: 'node-1',
            cpu_pct: 38.4,
            state: 'RUNNABLE',
            name: '[write][logs-app][2]',
            stack: 'org.elasticsearch.index.engine.InternalEngine.index\n  at ... Lucene IndexWriter.addDocument',
        },
        {
            node: 'node-2',
            cpu_pct: 24.8,
            state: 'WAITING',
            name: '[refresh][metrics-otel][1]',
            stack: 'org.elasticsearch.index.shard.RefreshListeners.awaitRefresh',
        },
    ],
    ilmPolicy: {
        name: 'logs-app',
        phases: [
            {
                phase: 'hot',
                min_age: '0d',
                size: '50GB',
                priority: 100,
                action: 'Rollover when 50GB or 1d',
                status: 'ACTIVE',
            },
            {
                phase: 'warm',
                min_age: '7d',
                size: '-',
                priority: 50,
                action: 'Shrink to 1 shard, forcemerge',
                status: 'WAITING',
            },
            {
                phase: 'cold',
                min_age: '30d',
                size: '-',
                priority: 0,
                action: 'Migrate to cold tier, searchable snapshot',
                status: 'WAITING',
            },
            { phase: 'delete', min_age: '90d', size: '-', priority: -1, action: 'Delete index', status: 'WAITING' },
        ],
        indices: [
            { name: 'logs-app-2026.04.23', phase: 'hot', age_days: 0, size_gb: 42 },
            { name: 'logs-app-2026.04.22', phase: 'hot', age_days: 1, size_gb: 48 },
            { name: 'logs-app-2026.04.15', phase: 'warm', age_days: 8, size_gb: 46 },
            { name: 'logs-app-2026.03.15', phase: 'cold', age_days: 39, size_gb: 38 },
            { name: 'logs-app-2026.01.15', phase: 'delete', age_days: 99, size_gb: 0 },
        ],
    },
    rollover: [
        {
            alias: 'logs-app',
            current: 'logs-app-2026.04.23',
            docs: 82_000_000,
            size_gb: 42,
            threshold_size_gb: 50,
            threshold_age: '1d',
            hours_to_rollover: 8,
        },
        {
            alias: 'metrics-otel',
            current: 'metrics-otel-2026-04',
            docs: 182_000_000,
            size_gb: 92,
            threshold_size_gb: 100,
            threshold_age: '30d',
            hours_to_rollover: 72,
        },
    ],
    profiler: {
        query: '{"query":{"bool":{"must":[{"match":{"message":"error"}}],"filter":[{"range":{"@timestamp":{"gte":"now-1h"}}}]}}}',
        total_ms: 1_842,
        breakdown: [
            { type: 'BooleanQuery', children: 'must + filter', time_ms: 1_832, rewrite_ms: 2, score_ms: 1_830 },
            { type: 'MatchQuery', children: 'message:error', time_ms: 1_820, rewrite_ms: 1, score_ms: 1_819 },
            { type: 'RangeQuery', children: '@timestamp', time_ms: 12, rewrite_ms: 1, score_ms: 11 },
        ],
    },
    mapping: {
        index: 'logs-app-*',
        fields: [
            { name: '@timestamp', type: 'date', indexed: true, stored: false, docvalues: true },
            { name: 'message', type: 'text', indexed: true, stored: false, docvalues: false, analyzer: 'standard' },
            {
                name: 'message.keyword',
                type: 'keyword',
                indexed: true,
                stored: false,
                docvalues: true,
                ignore_above: 256,
            },
            { name: 'service', type: 'keyword', indexed: true, stored: false, docvalues: true },
            { name: 'trace_id', type: 'keyword', indexed: true, stored: false, docvalues: true },
            { name: 'host.name', type: 'keyword', indexed: true, stored: false, docvalues: true },
            { name: 'labels', type: 'object', indexed: false, stored: false, docvalues: false, note: 'flattened' },
        ],
    },
    alerts: [
        {
            severity: 'info',
            title: 'logs-app-2026.04.23 hot shard — 412 queue depth on node-3',
            time: '6m ago',
            source: 'shard-health',
        },
        {
            severity: 'info',
            title: 'ILM: logs-app-2026.01.15 entering delete phase in 4h',
            time: '2h ago',
            source: 'ilm',
        },
        { severity: 'info', title: 'logs-app rollover in ~8h (42/50 GB)', time: '1h ago', source: 'rollover' },
    ],
};

function KpiTile({ k }: { k: (typeof ES.kpis)[0] }) {
    const Icon = k.icon;
    return (
        <div
            style={{
                padding: 16,
                borderRadius: 10,
                border: `1px solid ${THEME.glassBorder}`,
                background: 'linear-gradient(135deg, rgba(0,191,179,0.08), rgba(255,255,255,0))',
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
            <Panel title="Cluster identity" icon={Database} accentColor={ES_TEAL}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 12,
                        padding: 16,
                    }}
                >
                    {Object.entries(ES.identity).map(([k, v]) => (
                        <div
                            key={k}
                            style={{
                                padding: 12,
                                borderLeft: `3px solid ${ES_TEAL}`,
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
                {ES.kpis.map((k) => (
                    <KpiTile key={k.label} k={k} />
                ))}
            </div>
            <Panel title="Indexing & search — last 4h" icon={Activity} accentColor={ES_TEAL}>
                <div style={{ height: 280, padding: 12 }}>
                    <ResponsiveContainer>
                        <ComposedChart data={ES.rateTrend}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="t" tickFormatter={fmtHour} fontSize={11} />
                            <YAxis yAxisId="rate" orientation="left" fontSize={11} />
                            <YAxis yAxisId="lat" orientation="right" fontSize={11} />
                            <Tooltip labelFormatter={(v: any) => fmtHour(String(v))} />
                            <Legend />
                            <Area
                                yAxisId="rate"
                                type="monotone"
                                dataKey="index_ps"
                                stroke={ES_TEAL}
                                fill={ES_TEAL}
                                fillOpacity={0.25}
                                name="Docs indexed/s"
                            />
                            <Line
                                yAxisId="rate"
                                type="monotone"
                                dataKey="search_ps"
                                stroke={ES_PINK}
                                strokeWidth={2}
                                dot={false}
                                name="Searches/s"
                            />
                            <Line
                                yAxisId="lat"
                                type="monotone"
                                dataKey="p95_ms"
                                stroke={ES_NAVY}
                                strokeWidth={2}
                                dot={false}
                                name="P95 search (ms)"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </Panel>
            <Panel title="Alerts" icon={AlertTriangle} accentColor={ES_TEAL}>
                <div style={{ padding: '4px 0' }}>
                    {ES.alerts.map((a, i) => (
                        <AlertRow
                            key={i}
                            severity={a.severity as any}
                            title={a.title}
                            time={a.time}
                            source={a.source}
                            color={ES_NAVY}
                        />
                    ))}
                </div>
            </Panel>
        </div>
    );
}

// ── Shards panel: per-node rings + distribution
function ShardsPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Per-node shard allocation" icon={Layers} accentColor={ES_TEAL}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: 12,
                        padding: 16,
                    }}
                >
                    {ES.nodes.map((n) => (
                        <div
                            key={n.name}
                            style={{
                                padding: 14,
                                borderRadius: 8,
                                border: `1px solid ${ES_TEAL}`,
                                background: THEME.surfaceHover,
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <strong style={{ fontSize: 14 }}>{n.name}</strong>
                                <span style={{ fontSize: 11, color: THEME.textMuted }}>{n.zone}</span>
                            </div>
                            <div style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 10 }}>{n.role}</div>
                            {[
                                {
                                    label: 'CPU',
                                    pct: n.cpu_pct,
                                    color: n.cpu_pct > 75 ? ES_RED : n.cpu_pct > 50 ? ES_PINK : ES_GREEN,
                                },
                                {
                                    label: 'Heap',
                                    pct: n.heap_pct,
                                    color: n.heap_pct > 75 ? ES_RED : n.heap_pct > 60 ? ES_PINK : ES_GREEN,
                                },
                                {
                                    label: 'Disk',
                                    pct: n.disk_pct,
                                    color: n.disk_pct > 85 ? ES_RED : n.disk_pct > 70 ? ES_PINK : ES_GREEN,
                                },
                            ].map((b) => (
                                <div key={b.label} style={{ marginBottom: 8 }}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            fontSize: 11,
                                            marginBottom: 2,
                                        }}
                                    >
                                        <span>{b.label}</span>
                                        <span>{b.pct}%</span>
                                    </div>
                                    <div style={{ height: 6, background: THEME.glassBorder, borderRadius: 3 }}>
                                        <div
                                            style={{
                                                width: `${b.pct}%`,
                                                height: '100%',
                                                background: b.color,
                                                borderRadius: 3,
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                            <div
                                style={{ display: 'flex', gap: 12, fontSize: 11, color: THEME.textMuted, marginTop: 8 }}
                            >
                                <span>{n.shards} shards</span>
                                <span>{n.ingest_rate.toLocaleString()} docs/s</span>
                            </div>
                        </div>
                    ))}
                </div>
            </Panel>
            <Panel title="Shard distribution (primary + replica)" icon={GitBranch} accentColor={ES_TEAL}>
                <div style={{ height: 280, padding: 12 }}>
                    <ResponsiveContainer>
                        <BarChart data={ES.shardDistribution}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="index" fontSize={11} />
                            <YAxis fontSize={11} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="node1" stackId="a" fill={ES_TEAL} />
                            <Bar dataKey="node2" stackId="a" fill={ES_NAVY} />
                            <Bar dataKey="node3" stackId="a" fill={ES_PINK} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Panel>
        </div>
    );
}

// ── Hot threads
function HotThreadsPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {ES.hotThreads.map((t, i) => (
                <Panel
                    key={i}
                    title={`${t.node} · ${t.name}`}
                    icon={Cpu}
                    accentColor={t.cpu_pct > 40 ? ES_RED : ES_PINK}
                >
                    <div style={{ padding: 16 }}>
                        <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                            <div>
                                <div style={{ fontSize: 11, color: THEME.textMuted }}>CPU</div>
                                <div
                                    style={{ fontSize: 20, fontWeight: 700, color: t.cpu_pct > 40 ? ES_RED : ES_PINK }}
                                >
                                    {t.cpu_pct}%
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: THEME.textMuted }}>State</div>
                                <div style={{ fontSize: 20, fontWeight: 700 }}>{t.state}</div>
                            </div>
                        </div>
                        <pre
                            style={{
                                margin: 0,
                                padding: 12,
                                background: THEME.bgAlt || THEME.bg,
                                color: THEME.textMain,
                                fontSize: 11,
                                borderRadius: 6,
                                overflowX: 'auto',
                            }}
                        >
                            {t.stack}
                        </pre>
                    </div>
                </Panel>
            ))}
        </div>
    );
}

// ── ILM
function IlmPanel() {
    const p = ES.ilmPolicy;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title={`ILM policy: ${p.name}`} icon={Clock} accentColor={ES_TEAL}>
                <div style={{ padding: 20 }}>
                    <svg width="100%" height={120} viewBox="0 0 640 120">
                        {p.phases.map((ph, i) => {
                            const x = 50 + i * 150;
                            const active = ph.status === 'ACTIVE';
                            const color =
                                ['hot', 'warm', 'cold', 'delete'][i] === 'hot'
                                    ? ES_RED
                                    : ['hot', 'warm', 'cold', 'delete'][i] === 'warm'
                                      ? ES_PINK
                                      : ['hot', 'warm', 'cold', 'delete'][i] === 'cold'
                                        ? ES_NAVY
                                        : THEME.textMuted;
                            return (
                                <g key={ph.phase}>
                                    {i > 0 && (
                                        <line
                                            x1={x - 100}
                                            y1={60}
                                            x2={x - 50}
                                            y2={60}
                                            stroke={THEME.textDim}
                                            strokeWidth={2}
                                        />
                                    )}
                                    <rect
                                        x={x - 48}
                                        y={30}
                                        width={96}
                                        height={60}
                                        rx={8}
                                        fill={active ? color : '#fff'}
                                        stroke={color}
                                        strokeWidth={2}
                                    />
                                    <text
                                        x={x}
                                        y={52}
                                        textAnchor="middle"
                                        fontSize={12}
                                        fontWeight={700}
                                        fill={active ? '#fff' : color}
                                    >
                                        {ph.phase.toUpperCase()}
                                    </text>
                                    <text
                                        x={x}
                                        y={72}
                                        textAnchor="middle"
                                        fontSize={10}
                                        fill={active ? '#fff' : THEME.textDim}
                                    >
                                        min {ph.min_age}
                                    </text>
                                    <text x={x} y={106} textAnchor="middle" fontSize={10} fill={THEME.textDim}>
                                        {ph.action.slice(0, 22)}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                </div>
            </Panel>
            <Panel title="Indices in policy" icon={FileText} accentColor={ES_TEAL}>
                <DataTable
                    accentColor={ES_TEAL}
                    columns={[
                        { key: 'name', label: 'Index' },
                        { key: 'phase', label: 'Phase' },
                        { key: 'age_days', label: 'Age (days)' },
                        { key: 'size_gb', label: 'Size (GB)' },
                    ]}
                    rows={p.indices}
                />
            </Panel>
        </div>
    );
}

// ── Rollover
function RolloverPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {ES.rollover.map((r) => {
                const sizeRatio = r.size_gb / r.threshold_size_gb;
                return (
                    <Panel key={r.alias} title={`Alias: ${r.alias}`} icon={GitBranch} accentColor={ES_TEAL}>
                        <div style={{ padding: 16 }}>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                    gap: 16,
                                    marginBottom: 16,
                                }}
                            >
                                <div>
                                    <div style={{ fontSize: 11, color: THEME.textMuted }}>Write index</div>
                                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>
                                        {r.current}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: THEME.textMuted }}>Docs</div>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: ES_TEAL }}>
                                        {r.docs.toLocaleString()}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: THEME.textMuted }}>Size / threshold</div>
                                    <div
                                        style={{
                                            fontSize: 20,
                                            fontWeight: 700,
                                            color: sizeRatio > 0.8 ? ES_PINK : ES_GREEN,
                                        }}
                                    >
                                        {r.size_gb} / {r.threshold_size_gb} GB
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: THEME.textMuted }}>Time to rollover</div>
                                    <div style={{ fontSize: 20, fontWeight: 700 }}>~{r.hours_to_rollover}h</div>
                                </div>
                            </div>
                            <div style={{ height: 10, background: THEME.glassBorder, borderRadius: 5 }}>
                                <div
                                    style={{
                                        width: `${Math.min(sizeRatio * 100, 100)}%`,
                                        height: '100%',
                                        background: sizeRatio > 0.8 ? ES_PINK : ES_TEAL,
                                        borderRadius: 5,
                                    }}
                                />
                            </div>
                        </div>
                    </Panel>
                );
            })}
        </div>
    );
}

// ── Cluster health
function ClusterPanel() {
    return (
        <Panel title="Cluster health" icon={CheckCircle} accentColor={ES_GREEN}>
            <DataTable
                accentColor={ES_GREEN}
                columns={[
                    { key: 'name', label: 'Node' },
                    { key: 'role', label: 'Role' },
                    { key: 'zone', label: 'Zone' },
                    { key: 'cpu', label: 'CPU' },
                    { key: 'heap', label: 'Heap' },
                    { key: 'disk', label: 'Disk' },
                    { key: 'shards', label: 'Shards' },
                    { key: 'ingest_rate', label: 'Ingest/s' },
                ]}
                rows={ES.nodes.map((n) => ({
                    name: n.name,
                    role: n.role,
                    zone: n.zone,
                    cpu: `${n.cpu_pct}%`,
                    heap: `${n.heap_pct}%`,
                    disk: `${n.disk_pct}%`,
                    shards: n.shards,
                    ingest_rate: n.ingest_rate.toLocaleString(),
                }))}
            />
        </Panel>
    );
}

// ── Profiler
function ProfilerPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Profile API output" icon={Search} accentColor={ES_TEAL}>
                <div style={{ padding: 16 }}>
                    <pre
                        style={{
                            fontFamily: 'monospace',
                            fontSize: 11,
                            padding: 12,
                            background: THEME.bgAlt || THEME.bg,
                            color: THEME.textMain,
                            borderRadius: 6,
                            margin: 0,
                        }}
                    >
                        {ES.profiler.query}
                    </pre>
                    <div style={{ marginTop: 12, fontSize: 13 }}>
                        Total: <strong style={{ color: ES_PINK }}>{ES.profiler.total_ms} ms</strong>
                    </div>
                </div>
            </Panel>
            <Panel title="Query breakdown" icon={Zap} accentColor={ES_TEAL}>
                <div style={{ height: 240, padding: 12 }}>
                    <ResponsiveContainer>
                        <BarChart data={ES.profiler.breakdown} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis type="number" fontSize={11} />
                            <YAxis type="category" dataKey="type" width={140} fontSize={11} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="rewrite_ms" stackId="a" fill={ES_NAVY} name="Rewrite" />
                            <Bar dataKey="score_ms" stackId="a" fill={ES_TEAL} name="Score" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Panel>
        </div>
    );
}

// ── Mapping
function MappingPanel() {
    return (
        <Panel title={`Mapping: ${ES.mapping.index}`} icon={FileText} accentColor={ES_TEAL}>
            <DataTable
                accentColor={ES_TEAL}
                columns={[
                    { key: 'name', label: 'Field' },
                    { key: 'type', label: 'Type' },
                    { key: 'indexed', label: 'Indexed' },
                    { key: 'stored', label: 'Stored' },
                    { key: 'docvalues', label: 'Doc values' },
                    { key: 'detail', label: 'Detail' },
                ]}
                rows={ES.mapping.fields.map((f) => ({
                    name: f.name,
                    type: f.type,
                    indexed: f.indexed ? '✓' : '—',
                    stored: f.stored ? '✓' : '—',
                    docvalues: f.docvalues ? '✓' : '—',
                    detail: f.analyzer
                        ? `analyzer=${f.analyzer}`
                        : f.ignore_above
                          ? `ignore_above=${f.ignore_above}`
                          : f.note || '',
                }))}
            />
        </Panel>
    );
}

const PANELS = [
    { id: 'overview', label: 'Overview', icon: Gauge },
    { id: 'shards', label: 'Shards', icon: Layers },
    { id: 'hotthreads', label: 'Hot Threads', icon: Cpu },
    { id: 'ilm', label: 'ILM', icon: Clock },
    { id: 'rollover', label: 'Rollover', icon: GitBranch },
    { id: 'cluster', label: 'Cluster', icon: CheckCircle },
    { id: 'profiler', label: 'Profiler', icon: Search },
    { id: 'mapping', label: 'Mapping', icon: FileText },
];

export default function DemoElasticFullTab({ subTabId }: { subTabId?: string } = {}) {
    useAdaptiveTheme();
    void subTabId;
    const { sections, renderContent } = buildMetricsTab(catalog);
    return (
        <DemoLayout
            title="Elasticsearch"
            subtitle="Elastic 8.13 · acme-search"
            accentColor={catalog.accentColor}
            connectionBarMeta={{ lastSync: '8s', refreshInterval: '30s' }}
            titleIcon={Database}
            activeDemo="demo-elasticsearch"
            sections={sections}
            renderContent={renderContent}
        />
    );
}
