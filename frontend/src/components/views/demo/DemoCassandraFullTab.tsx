// ==========================================================================
//  DemoCassandraFullTab.tsx — bespoke Cassandra / Scylla demo.
//  Overview | Ring Topology | Replication | Compactions | Hints | Slow Queries | MVs
// ==========================================================================

import React, { useState } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { buildMetricsTab } from './useMetricsTab';
import catalog from '../../../utils/catalogs/cassandraCatalog';
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
    GitBranch,
    Box,
    Zap,
    RefreshCw,
    Radio,
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
    Cell,
} from 'recharts';

const CS_BLUE = '#1287B1';
const CS_NAVY = THEME.surfaceRaised;
const CS_AMBER = THEME.warning;
const CS_RED = THEME.dangerDark;
const CS_GREEN = THEME.success;

const now = Date.now();
const tMinus = (m: number) => new Date(now - m * 60_000).toISOString();
const fmtHour = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const CS = {
    identity: {
        cluster: 'FATHOM',
        version: '5.0.1',
        datacenter_count: '2',
        node_count: '6',
        snitch: 'GossipingPropertyFileSnitch',
    },
    kpis: [
        { label: 'Reads/sec', value: '48,210', unit: '', color: CS_BLUE, icon: Activity },
        { label: 'Writes/sec', value: '12,480', unit: '', color: CS_AMBER, icon: Activity },
        { label: 'Read p99', value: '4.2', unit: 'ms', color: CS_GREEN, icon: Clock },
        { label: 'Hint handoff', value: '12', unit: '', color: CS_AMBER, icon: RefreshCw },
        { label: 'Compactions', value: '3', unit: '', color: CS_BLUE, icon: RefreshCw },
        { label: 'Cluster', value: 'UP', unit: '6/6', color: CS_GREEN, icon: CheckCircle },
    ],
    rwTrend: Array.from({ length: 48 }, (_, i) => ({
        t: tMinus((47 - i) * 5),
        reads: Math.round(48000 + Math.sin(i / 3) * 4000 + (Math.random() - 0.5) * 2000),
        writes: Math.round(12400 + Math.sin(i / 4) * 1500 + (Math.random() - 0.5) * 800),
        hints: i > 40 ? Math.round(Math.random() * 8) : Math.round(Math.random() * 2),
    })),
    ring: [
        { node: 'node-1', dc: 'dc1', rack: 'rack1', token_pct: 16.6, load_gb: 842, up: true, host_id: '8a-1' },
        { node: 'node-2', dc: 'dc1', rack: 'rack2', token_pct: 16.7, load_gb: 838, up: true, host_id: '8a-2' },
        { node: 'node-3', dc: 'dc1', rack: 'rack3', token_pct: 16.6, load_gb: 842, up: true, host_id: '8a-3' },
        { node: 'node-4', dc: 'dc2', rack: 'rack1', token_pct: 16.7, load_gb: 839, up: false, host_id: '8b-1' },
        { node: 'node-5', dc: 'dc2', rack: 'rack2', token_pct: 16.7, load_gb: 841, up: true, host_id: '8b-2' },
        { node: 'node-6', dc: 'dc2', rack: 'rack3', token_pct: 16.7, load_gb: 840, up: true, host_id: '8b-3' },
    ],
    keyspaces: [
        {
            name: 'fathom_app',
            strategy: 'NetworkTopologyStrategy',
            replication: '{ dc1: 3, dc2: 3 }',
            durable: true,
            tables: 18,
            consistency: 'LOCAL_QUORUM',
        },
        {
            name: 'fathom_telemetry',
            strategy: 'NetworkTopologyStrategy',
            replication: '{ dc1: 3, dc2: 3 }',
            durable: true,
            tables: 8,
            consistency: 'LOCAL_ONE',
        },
        { name: 'system', strategy: 'LocalStrategy', replication: '{}', durable: true, tables: 22, consistency: 'N/A' },
        {
            name: 'system_auth',
            strategy: 'NetworkTopologyStrategy',
            replication: '{ dc1: 3, dc2: 3 }',
            durable: true,
            tables: 5,
            consistency: 'LOCAL_QUORUM',
        },
    ],
    compactions: [
        {
            ks: 'fathom_app',
            table: 'events',
            kind: 'Compaction',
            strategy: 'STCS',
            completed: 12,
            total: 48,
            progress_pct: 25,
            eta_min: 18,
        },
        {
            ks: 'fathom_app',
            table: 'audit',
            kind: 'Compaction',
            strategy: 'LCS',
            completed: 8,
            total: 8,
            progress_pct: 100,
            eta_min: 0,
        },
        {
            ks: 'fathom_telemetry',
            table: 'metrics',
            kind: 'Compaction',
            strategy: 'TWCS',
            completed: 18,
            total: 24,
            progress_pct: 75,
            eta_min: 4,
        },
    ],
    hints: [{ target_node: 'node-4', total_hints: 18_420, oldest_hint: '12m ago', rate_per_sec: 48 }],
    slowQueries: [
        {
            session_id: 'a1b2c3',
            cql: 'SELECT * FROM fathom_app.events WHERE partition_id = ? AND ts > ?',
            coord: 'node-1',
            duration_us: 1_842_000,
            activity: 'Read data from replicas',
        },
        {
            session_id: 'd4e5f6',
            cql: 'INSERT INTO fathom_app.audit (ts, event, actor) VALUES (?, ?, ?)',
            coord: 'node-2',
            duration_us: 412_000,
            activity: 'Batch write to LOG',
        },
        {
            session_id: 'g7h8i9',
            cql: 'SELECT COUNT(*) FROM fathom_telemetry.metrics WHERE ts > ?',
            coord: 'node-3',
            duration_us: 8_420_000,
            activity: 'Full-table scan — WARNING',
        },
    ],
    mvs: [
        {
            ks: 'fathom_app',
            base: 'events',
            mv: 'events_by_user',
            build_state: 'BUILT',
            lag_us: 1_200,
            consistency: 'ONE',
        },
        {
            ks: 'fathom_app',
            base: 'events',
            mv: 'events_by_type',
            build_state: 'BUILT',
            lag_us: 2_800,
            consistency: 'ONE',
        },
        {
            ks: 'fathom_app',
            base: 'orders',
            mv: 'orders_by_merchant',
            build_state: 'BUILDING',
            lag_us: 18_400,
            consistency: 'ONE',
        },
    ],
    alerts: [
        { severity: 'critical', title: 'node-4 (dc2.rack1) DOWN for 8 minutes', time: '8m ago', source: 'gossip' },
        { severity: 'warning', title: '18,420 hints queued for node-4', time: '7m ago', source: 'hinted-handoff' },
        {
            severity: 'info',
            title: 'MV orders_by_merchant still BUILDING (18s lag)',
            time: '22m ago',
            source: 'mv-advisor',
        },
    ],
};

function KpiTile({ k }: { k: (typeof CS.kpis)[0] }) {
    const Icon = k.icon;
    return (
        <div
            style={{
                padding: 16,
                borderRadius: 10,
                border: `1px solid ${THEME.glassBorder}`,
                background: 'linear-gradient(135deg, rgba(18,135,177,0.08), rgba(255,255,255,0))',
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
            <Panel title="Cluster identity" icon={Database} accentColor={CS_BLUE}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 12,
                        padding: 16,
                    }}
                >
                    {Object.entries(CS.identity).map(([k, v]) => (
                        <div
                            key={k}
                            style={{
                                padding: 12,
                                borderLeft: `3px solid ${CS_BLUE}`,
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
                {CS.kpis.map((k) => (
                    <KpiTile key={k.label} k={k} />
                ))}
            </div>
            <Panel title="Read/write + hinted handoffs — last 4h" icon={Activity} accentColor={CS_BLUE}>
                <div style={{ height: 280, padding: 12 }}>
                    <ResponsiveContainer>
                        <ComposedChart data={CS.rwTrend}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="t" tickFormatter={fmtHour} fontSize={11} />
                            <YAxis yAxisId="rw" orientation="left" fontSize={11} />
                            <YAxis yAxisId="hint" orientation="right" fontSize={11} />
                            <Tooltip labelFormatter={(v: any) => fmtHour(String(v))} />
                            <Legend />
                            <Area
                                yAxisId="rw"
                                type="monotone"
                                dataKey="reads"
                                stackId="1"
                                stroke={CS_BLUE}
                                fill={CS_BLUE}
                                fillOpacity={0.25}
                            />
                            <Area
                                yAxisId="rw"
                                type="monotone"
                                dataKey="writes"
                                stackId="1"
                                stroke={CS_AMBER}
                                fill={CS_AMBER}
                                fillOpacity={0.25}
                            />
                            <Bar yAxisId="hint" dataKey="hints" fill={CS_RED} name="Hints" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </Panel>
            <Panel title="Alerts" icon={AlertTriangle} accentColor={CS_BLUE}>
                <div style={{ padding: '4px 0' }}>
                    {CS.alerts.map((a, i) => (
                        <AlertRow
                            key={i}
                            severity={a.severity as any}
                            title={a.title}
                            time={a.time}
                            source={a.source}
                            color={a.severity === 'critical' ? CS_RED : a.severity === 'warning' ? CS_AMBER : CS_NAVY}
                        />
                    ))}
                </div>
            </Panel>
        </div>
    );
}

// ── Ring topology
function RingPanel() {
    const cx = 280,
        cy = 220,
        r = 140;
    const n = CS.ring.length;
    return (
        <Panel title="Ring topology + token ownership" icon={Radio} accentColor={CS_BLUE}>
            <div style={{ padding: 20 }}>
                <svg width="100%" height={460} viewBox="0 0 560 460">
                    {/* Ring */}
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke={THEME.surfaceRaised} strokeWidth={2} />
                    {CS.ring.map((node, i) => {
                        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
                        const x = cx + r * Math.cos(angle);
                        const y = cy + r * Math.sin(angle);
                        const tx = cx + (r + 46) * Math.cos(angle);
                        const ty = cy + (r + 46) * Math.sin(angle);
                        const color = !node.up ? CS_RED : node.dc === 'dc1' ? CS_BLUE : CS_GREEN;
                        return (
                            <g key={node.node}>
                                {/* Wedge for token ownership */}
                                <path
                                    d={`M ${cx} ${cy} L ${x} ${y} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(angle + (2 * Math.PI) / n)} ${cy + r * Math.sin(angle + (2 * Math.PI) / n)} Z`}
                                    fill={color}
                                    opacity={0.1}
                                />
                                {/* Node dot */}
                                <circle cx={x} cy={y} r={20} fill={color} stroke={THEME.surfaceRaised} strokeWidth={2} />
                                <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">
                                    {node.node.split('-')[1]}
                                </text>
                                <text x={tx} y={ty} textAnchor="middle" fontSize={11} fontWeight={600}>
                                    {node.node}
                                </text>
                                <text x={tx} y={ty + 14} textAnchor="middle" fontSize={10} fill={THEME.textDim}>
                                    {node.dc}.{node.rack} · {node.token_pct}%
                                </text>
                                {!node.up && (
                                    <text
                                        x={tx}
                                        y={ty + 28}
                                        textAnchor="middle"
                                        fontSize={10}
                                        fill={CS_RED}
                                        fontWeight={700}
                                    >
                                        DOWN
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>
                <DataTable
                    accentColor={CS_BLUE}
                    columns={[
                        { key: 'node', label: 'Node' },
                        { key: 'dc', label: 'DC' },
                        { key: 'rack', label: 'Rack' },
                        { key: 'token_pct', label: 'Token %' },
                        { key: 'load_gb', label: 'Load (GB)' },
                        { key: 'state', label: 'State' },
                        { key: 'host_id', label: 'Host ID' },
                    ]}
                    rows={CS.ring.map((n) => ({ ...n, state: n.up ? 'UP' : 'DOWN' }))}
                />
            </div>
        </Panel>
    );
}

// ── Replication / keyspaces
function ReplicationPanel() {
    return (
        <Panel title="Keyspaces + replication strategy" icon={GitBranch} accentColor={CS_BLUE}>
            <DataTable
                accentColor={CS_BLUE}
                columns={[
                    { key: 'name', label: 'Keyspace' },
                    { key: 'strategy', label: 'Strategy' },
                    { key: 'replication', label: 'RF' },
                    { key: 'durable', label: 'Durable writes' },
                    { key: 'tables', label: 'Tables' },
                    { key: 'consistency', label: 'Default CL' },
                ]}
                rows={CS.keyspaces.map((k) => ({ ...k, durable: k.durable ? '✓' : '—' }))}
            />
        </Panel>
    );
}

// ── Compactions
function CompactionsPanel() {
    return (
        <Panel title="Active + recent compactions" icon={RefreshCw} accentColor={CS_AMBER}>
            <div style={{ padding: 16 }}>
                {CS.compactions.map((c, i) => (
                    <div key={i} style={{ marginBottom: 16 }}>
                        <div
                            style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}
                        >
                            <strong>
                                {c.ks}.{c.table}
                            </strong>
                            <span style={{ color: THEME.textMuted }}>
                                {c.strategy} · {c.completed}/{c.total} SSTables
                            </span>
                        </div>
                        <div style={{ height: 10, background: THEME.glassBorder, borderRadius: 5, overflow: 'hidden' }}>
                            <div
                                style={{
                                    width: `${c.progress_pct}%`,
                                    height: '100%',
                                    background: c.progress_pct === 100 ? CS_GREEN : CS_AMBER,
                                    borderRadius: 5,
                                }}
                            />
                        </div>
                        <div style={{ fontSize: 11, color: THEME.textDim, marginTop: 2 }}>
                            {c.progress_pct}% · {c.eta_min === 0 ? 'done' : `ETA ${c.eta_min} min`}
                        </div>
                    </div>
                ))}
            </div>
        </Panel>
    );
}

// ── Hints
function HintsPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Hinted handoffs" icon={RefreshCw} accentColor={CS_AMBER}>
                <div style={{ padding: 16 }}>
                    {CS.hints.map((h, i) => (
                        <div
                            key={i}
                            style={{
                                padding: 16,
                                background: THEME.warningLight,
                                borderRadius: 8,
                                borderLeft: `4px solid ${CS_AMBER}`,
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <strong>Target: {h.target_node}</strong>
                                <span style={{ color: CS_RED, fontWeight: 600 }}>
                                    {h.total_hints.toLocaleString()} hints queued
                                </span>
                            </div>
                            <div style={{ fontSize: 12, color: THEME.textMuted, marginTop: 4 }}>
                                Oldest: {h.oldest_hint} · Rate: {h.rate_per_sec} hints/sec
                            </div>
                            <div style={{ fontSize: 12, color: THEME.textDim, marginTop: 8, fontStyle: 'italic' }}>
                                {h.target_node} is currently DOWN. Hints will replay once the node comes back UP. If{' '}
                                {h.target_node} stays down beyond <code>max_hint_window_in_ms</code> (3h), unreplayed
                                hints are discarded and a repair is required.
                            </div>
                        </div>
                    ))}
                </div>
            </Panel>
            <Panel title="Hints trend — last 4h" icon={Activity} accentColor={CS_AMBER}>
                <div style={{ height: 240, padding: 12 }}>
                    <ResponsiveContainer>
                        <BarChart data={CS.rwTrend}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="t" tickFormatter={fmtHour} fontSize={11} />
                            <YAxis fontSize={11} />
                            <Tooltip labelFormatter={(v: any) => fmtHour(String(v))} />
                            <Bar dataKey="hints" name="Hints">
                                {CS.rwTrend.map((d, i) => (
                                    <Cell key={i} fill={d.hints > 4 ? CS_RED : CS_AMBER} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Panel>
        </div>
    );
}

// ── Slow queries
function SlowQueriesPanel() {
    return (
        <Panel title="TRACING-sampled slow queries" icon={Clock} accentColor={CS_BLUE}>
            <DataTable
                accentColor={CS_BLUE}
                columns={[
                    { key: 'session_id', label: 'Session' },
                    { key: 'coord', label: 'Coordinator' },
                    { key: 'dur', label: 'Duration' },
                    { key: 'cql', label: 'CQL preview' },
                    { key: 'activity', label: 'Trace activity' },
                ]}
                rows={CS.slowQueries.map((q) => ({
                    ...q,
                    dur: `${(q.duration_us / 1000).toFixed(1)} ms`,
                    cql: q.cql.length > 60 ? q.cql.slice(0, 60) + '…' : q.cql,
                }))}
            />
        </Panel>
    );
}

// ── Materialized views
function MVPanel() {
    return (
        <Panel title="Materialized views" icon={Layers} accentColor={CS_BLUE}>
            <DataTable
                accentColor={CS_BLUE}
                columns={[
                    { key: 'ks', label: 'Keyspace' },
                    { key: 'base', label: 'Base table' },
                    { key: 'mv', label: 'MV name' },
                    { key: 'build_state', label: 'Build state' },
                    { key: 'lag_ms', label: 'Write lag (µs)' },
                    { key: 'consistency', label: 'Consistency' },
                ]}
                rows={CS.mvs}
            />
        </Panel>
    );
}

const PANELS = [
    { id: 'overview', label: 'Overview', icon: Gauge },
    { id: 'ring', label: 'Ring', icon: Radio },
    { id: 'replication', label: 'Keyspaces', icon: GitBranch },
    { id: 'compactions', label: 'Compactions', icon: RefreshCw },
    { id: 'hints', label: 'Hints', icon: Zap },
    { id: 'slow', label: 'Slow Queries', icon: Clock },
    { id: 'mvs', label: 'MVs', icon: Layers },
];

export default function DemoCassandraFullTab({ subTabId }: { subTabId?: string } = {}) {
    useAdaptiveTheme();
    void subTabId;
    const { sections, renderContent } = buildMetricsTab(catalog);
    return (
        <DemoLayout
            title="Apache Cassandra"
            subtitle="Apache Cassandra 4.1 · 3 DCs · 12 nodes"
            accentColor={catalog.accentColor}
            connectionBarMeta={{ lastSync: '8s', refreshInterval: '30s' }}
            titleIcon={Database}
            activeDemo="demo-cassandra"
            sections={sections}
            renderContent={renderContent}
        />
    );
}
