// ==========================================================================
//  DemoEngineTab.tsx — mid-depth multi-engine demo tab.
//
//  One component, 9 engines. Looks up the engine spec from demoEngineData.ts
//  and renders:
//    • Overview panel with KPIs (with real recharts time-series per KPI),
//      an engine-distinctive "signature widget" (credits chart for
//      Snowflake, bytes-billed for BigQuery, wait-donut for SQL Server,
//      session history for Oracle, memory-vs-ops for Redis, index-vs-search
//      for Elasticsearch, WLM queue bars for Redshift, read/write/hints for
//      Cassandra, capacity/throttle for DynamoDB), and an alert stack.
//    • Queries / Plan / Waits / Tables / Indexes / Connections / Locks /
//      Replication / Bloat / Engine Notes panels.
//    • Replication panel renders a live SVG topology of primary + replicas
//      with status dots and lag labels.
// ==========================================================================

import React, { useMemo, useState } from 'react';
import { useAdaptiveTheme } from '../../../utils/theme';
import DemoLayout, { Panel, StatusBadge, MetricCard, DataTable, TabPills, AlertRow } from './DemoLayout';
import {
    Database,
    Gauge,
    Activity,
    AlertTriangle,
    Clock,
    Layers,
    Link2,
    Lock,
    Network,
    Terminal,
    Info,
    BarChart3,
    GitBranch,
    HardDrive,
    Eye,
    Zap,
    CheckCircle,
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
} from 'recharts';
import DEMO_ENGINES, { EngineKey, EngineDemoSpec, SignatureWidget, ReplicaNode } from '../../../utils/demoEngineData';
import { THEME } from '../../../utils/theme';

const PANEL_IDS = [
    { id: 'overview', label: 'Overview', icon: Gauge },
    { id: 'queries', label: 'Top Queries', icon: Activity },
    { id: 'plan', label: 'Plan', icon: Terminal },
    { id: 'waits', label: 'Wait Events', icon: Clock },
    { id: 'tables', label: 'Tables', icon: Layers },
    { id: 'indexes', label: 'Indexes', icon: Link2 },
    { id: 'connections', label: 'Connections', icon: Network },
    { id: 'locks', label: 'Locks', icon: Lock },
    { id: 'replication', label: 'Replication', icon: GitBranch },
    { id: 'bloat', label: 'Bloat / Stale', icon: HardDrive },
    { id: 'substitutes', label: 'Engine Notes', icon: Info },
];

const RANGES = [
    { id: '1h', label: '1h' },
    { id: '6h', label: '6h' },
    { id: '24h', label: '24h' },
    { id: '7d', label: '7d' },
];

// ─────────────────────────────────────────────────────────────────────────
// Charts
// ─────────────────────────────────────────────────────────────────────────

function fmtHour(iso: string) {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function KpiCharts({ spec }: { spec: EngineDemoSpec }) {
    // First three KPIs get full-size area charts, the rest get sparkline-only cards.
    const featured = spec.kpis.slice(0, 3);
    const rest = spec.kpis.slice(3);
    return (
        <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                {featured.map((k) => {
                    const ts = spec.timeseries[k.label] || [];
                    return (
                        <Panel key={k.label} title={k.label} icon={BarChart3} accentColor={spec.accentColor}>
                            <div style={{ padding: 12 }}>
                                <div style={{ fontSize: 28, fontWeight: 700, color: spec.accentColor }}>
                                    {k.value}
                                    <span style={{ fontSize: 14, color: THEME.textDim, marginLeft: 4 }}>{k.unit}</span>
                                </div>
                                <div style={{ height: 64, marginTop: 8 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={ts}>
                                            <defs>
                                                <linearGradient
                                                    id={`g-${spec.key}-${k.label.replace(/\W/g, '')}`}
                                                    x1="0"
                                                    y1="0"
                                                    x2="0"
                                                    y2="1"
                                                >
                                                    <stop offset="0%" stopColor={spec.accentColor} stopOpacity={0.4} />
                                                    <stop offset="100%" stopColor={spec.accentColor} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <Area
                                                type="monotone"
                                                dataKey="v"
                                                stroke={spec.accentColor}
                                                strokeWidth={2}
                                                fill={`url(#g-${spec.key}-${k.label.replace(/\W/g, '')})`}
                                                isAnimationActive={false}
                                            />
                                            <Tooltip labelFormatter={(v: any) => fmtHour(String(v))} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </Panel>
                    );
                })}
            </div>
            {rest.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    {rest.map((k) => (
                        <MetricCard
                            key={k.label}
                            icon={Gauge}
                            label={k.label}
                            value={k.value + (k.unit ? ` ${k.unit}` : '')}
                            color={spec.accentColor}
                            spark={k.sparkline}
                            trend={k.trend}
                        />
                    ))}
                </div>
            )}
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────
// Signature widget dispatch — one per engine.
// ─────────────────────────────────────────────────────────────────────────

function SignatureWidgetView({ sig, accentColor }: { sig: SignatureWidget; accentColor: string }) {
    if (sig.kind === 'credits_by_warehouse') {
        // Flatten the series into rows keyed by time. Snowflake shows credits
        // spent per warehouse stacked over 24h — the money meter operators
        // actually watch.
        const times = sig.series[0]?.data.map((d) => d.t) || [];
        const rows = times.map((t, i) => {
            const row: Record<string, any> = { t };
            for (const s of sig.series) row[s.name] = s.data[i]?.v ?? 0;
            return row;
        });
        const COLORS = ['#29B5E8', THEME.infoLight, THEME.infoLight];
        return (
            <Panel
                title={`Credits by warehouse — last 2h  ·  total: ${sig.total}`}
                icon={Zap}
                accentColor={accentColor}
            >
                <div style={{ height: 260, padding: 12 }}>
                    <ResponsiveContainer>
                        <AreaChart data={rows}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="t" tickFormatter={fmtHour} fontSize={11} />
                            <YAxis fontSize={11} />
                            <Tooltip labelFormatter={(v: any) => fmtHour(String(v))} />
                            <Legend />
                            {sig.series.map((s, i) => (
                                <Area
                                    key={s.name}
                                    type="monotone"
                                    dataKey={s.name}
                                    stackId="1"
                                    stroke={COLORS[i % COLORS.length]}
                                    fill={COLORS[i % COLORS.length]}
                                    fillOpacity={0.7}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Panel>
        );
    }

    if (sig.kind === 'bytes_billed') {
        return (
            <Panel title={`Bytes billed — last 2h  ·  ${sig.dailyEstimate}`} icon={Zap} accentColor={accentColor}>
                <div style={{ height: 260, padding: 12 }}>
                    <ResponsiveContainer>
                        <ComposedChart data={sig.area}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="t" tickFormatter={fmtHour} fontSize={11} />
                            <YAxis yAxisId="gb" orientation="left" fontSize={11} />
                            <YAxis yAxisId="cost" orientation="right" fontSize={11} />
                            <Tooltip labelFormatter={(v: any) => fmtHour(String(v))} />
                            <Legend />
                            <Area
                                yAxisId="gb"
                                type="monotone"
                                dataKey="gb"
                                stroke={accentColor}
                                fill={accentColor}
                                fillOpacity={0.25}
                                name="GB scanned"
                            />
                            <Line
                                yAxisId="cost"
                                type="monotone"
                                dataKey="cost"
                                stroke={THEME.warning}
                                strokeWidth={2}
                                dot={false}
                                name="Cost ($)"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </Panel>
        );
    }

    if (sig.kind === 'wait_donut') {
        return (
            <Panel title="Top wait types — last hour" icon={Zap} accentColor={accentColor}>
                <div style={{ height: 260, padding: 12 }}>
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie
                                data={sig.slices}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={90}
                                paddingAngle={2}
                            >
                                {sig.slices.map((s, i) => (
                                    <Cell key={i} fill={s.color} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(v: any) => `${(Number(v) / 1000).toFixed(1)} s`} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </Panel>
        );
    }

    if (sig.kind === 'session_history') {
        return (
            <Panel title="Active sessions history — last 2h" icon={Zap} accentColor={accentColor}>
                <div style={{ height: 260, padding: 12 }}>
                    <ResponsiveContainer>
                        <AreaChart data={sig.activeSessions}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="t" tickFormatter={fmtHour} fontSize={11} />
                            <YAxis fontSize={11} />
                            <Tooltip labelFormatter={(v: any) => fmtHour(String(v))} />
                            <Legend />
                            <Area
                                type="monotone"
                                dataKey="sessions"
                                stroke={accentColor}
                                fill={accentColor}
                                fillOpacity={0.3}
                                name="Active"
                            />
                            <Area
                                type="monotone"
                                dataKey="waiting"
                                stroke={THEME.dangerLight}
                                fill={THEME.dangerLight}
                                fillOpacity={0.4}
                                name="Waiting"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Panel>
        );
    }

    if (sig.kind === 'memory_ops') {
        return (
            <Panel title="Memory vs ops/sec — last 2h" icon={Zap} accentColor={accentColor}>
                <div style={{ height: 260, padding: 12 }}>
                    <ResponsiveContainer>
                        <ComposedChart data={sig.series}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="t" tickFormatter={fmtHour} fontSize={11} />
                            <YAxis yAxisId="mem" orientation="left" fontSize={11} />
                            <YAxis yAxisId="ops" orientation="right" fontSize={11} />
                            <Tooltip labelFormatter={(v: any) => fmtHour(String(v))} />
                            <Legend />
                            <Area
                                yAxisId="mem"
                                type="monotone"
                                dataKey="mem_mb"
                                stroke={accentColor}
                                fill={accentColor}
                                fillOpacity={0.25}
                                name="Memory (MB)"
                            />
                            <Line
                                yAxisId="ops"
                                type="monotone"
                                dataKey="ops"
                                stroke={THEME.warning}
                                strokeWidth={2}
                                dot={false}
                                name="Ops/sec"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </Panel>
        );
    }

    if (sig.kind === 'indexing_vs_search') {
        return (
            <Panel title="Indexing vs search rate — last 2h" icon={Zap} accentColor={accentColor}>
                <div style={{ height: 260, padding: 12 }}>
                    <ResponsiveContainer>
                        <LineChart data={sig.series}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="t" tickFormatter={fmtHour} fontSize={11} />
                            <YAxis fontSize={11} />
                            <Tooltip labelFormatter={(v: any) => fmtHour(String(v))} />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="index_ps"
                                stroke={accentColor}
                                strokeWidth={2}
                                dot={false}
                                name="Indexing/s"
                            />
                            <Line
                                type="monotone"
                                dataKey="search_ps"
                                stroke={THEME.dangerLight}
                                strokeWidth={2}
                                dot={false}
                                name="Searches/s"
                            />
                            <Line
                                type="monotone"
                                dataKey="p95_ms"
                                stroke={THEME.primary}
                                strokeWidth={2}
                                dot={false}
                                name="p95 ms"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </Panel>
        );
    }

    if (sig.kind === 'wlm_queues') {
        return (
            <Panel title="WLM queue timing — last hour" icon={Zap} accentColor={accentColor}>
                <div style={{ height: 260, padding: 12 }}>
                    <ResponsiveContainer>
                        <BarChart data={sig.bars}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="queue" fontSize={11} />
                            <YAxis fontSize={11} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="queue_ms" stackId="a" fill={THEME.dangerLight} name="Queued (ms)" />
                            <Bar dataKey="exec_ms" stackId="a" fill={accentColor} name="Executed (ms)" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Panel>
        );
    }

    if (sig.kind === 'rw_hinted') {
        return (
            <Panel title="Reads, writes & hinted handoffs — last 2h" icon={Zap} accentColor={accentColor}>
                <div style={{ height: 260, padding: 12 }}>
                    <ResponsiveContainer>
                        <ComposedChart data={sig.series}>
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
                                stroke={accentColor}
                                fill={accentColor}
                                fillOpacity={0.25}
                                name="Reads/s"
                            />
                            <Area
                                yAxisId="rw"
                                type="monotone"
                                dataKey="writes"
                                stroke={THEME.dangerLight}
                                fill={THEME.dangerLight}
                                fillOpacity={0.25}
                                name="Writes/s"
                            />
                            <Bar yAxisId="hint" dataKey="hints" fill={THEME.warning} name="Hints" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </Panel>
        );
    }

    if (sig.kind === 'dynamo_capacity') {
        return (
            <Panel title="Consumed capacity — last 2h" icon={Zap} accentColor={accentColor}>
                <div style={{ height: 260, padding: 12 }}>
                    <ResponsiveContainer>
                        <ComposedChart data={sig.series}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="t" tickFormatter={fmtHour} fontSize={11} />
                            <YAxis yAxisId="cap" orientation="left" fontSize={11} />
                            <YAxis yAxisId="thr" orientation="right" fontSize={11} />
                            <Tooltip labelFormatter={(v: any) => fmtHour(String(v))} />
                            <Legend />
                            <Area
                                yAxisId="cap"
                                type="monotone"
                                dataKey="rcu"
                                stackId="1"
                                stroke={accentColor}
                                fill={accentColor}
                                fillOpacity={0.3}
                                name="RCU"
                            />
                            <Area
                                yAxisId="cap"
                                type="monotone"
                                dataKey="wcu"
                                stackId="1"
                                stroke={THEME.dangerLight}
                                fill={THEME.dangerLight}
                                fillOpacity={0.3}
                                name="WCU"
                            />
                            <Bar yAxisId="thr" dataKey="throttles" fill={THEME.warning} name="Throttles" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </Panel>
        );
    }

    return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Alert stack
// ─────────────────────────────────────────────────────────────────────────

function AlertsPanel({ spec }: { spec: EngineDemoSpec }) {
    if (!spec.alerts?.length) return null;
    const severityColor = { critical: THEME.dangerDark, warning: THEME.warning, info: THEME.primary } as const;
    return (
        <Panel title="Recent alerts" icon={AlertTriangle} accentColor={spec.accentColor}>
            <div style={{ padding: '4px 0' }}>
                {spec.alerts.map((a, i) => (
                    <AlertRow
                        key={i}
                        severity={a.severity}
                        title={a.title}
                        time={a.time}
                        source={a.source}
                        color={severityColor[a.severity]}
                    />
                ))}
            </div>
        </Panel>
    );
}

// ─────────────────────────────────────────────────────────────────────────
// Replication topology SVG
// ─────────────────────────────────────────────────────────────────────────

function TopologyGraph({ nodes, accentColor }: { nodes: ReplicaNode[]; accentColor: string }) {
    if (!nodes.length) return null;
    const width = 640;
    const height = 220;
    const primary = nodes.find((n) => n.role === 'primary') || nodes[0];
    const rest = nodes.filter((n) => n !== primary);
    const cxP = width / 2;
    const cyP = 48;

    const statusFill = { healthy: THEME.success, degraded: THEME.warning, down: THEME.dangerDark } as const;

    return (
        <div style={{ width: '100%', overflowX: 'auto', padding: 12 }}>
            <svg width={width} height={height} style={{ display: 'block', margin: '0 auto' }}>
                {/* Edges from primary to each replica */}
                {rest.map((r, i) => {
                    const cx = (width / (rest.length + 1)) * (i + 1);
                    const cy = height - 48;
                    return (
                        <g key={r.id}>
                            <line
                                x1={cxP}
                                y1={cyP + 24}
                                x2={cx}
                                y2={cy - 24}
                                stroke={r.status === 'down' ? THEME.dangerDark : THEME.textMuted}
                                strokeWidth={2}
                                strokeDasharray={r.status === 'degraded' ? '6 4' : undefined}
                            />
                            {r.lag_ms != null && (
                                <text
                                    x={(cxP + cx) / 2}
                                    y={(cyP + cy) / 2}
                                    textAnchor="middle"
                                    fontSize={11}
                                    fill={THEME.textDim}
                                >
                                    {r.lag_ms}ms lag
                                </text>
                            )}
                        </g>
                    );
                })}

                {/* Primary node */}
                <circle cx={cxP} cy={cyP} r={24} fill={accentColor} stroke={THEME.surfaceRaised} strokeWidth={2} />
                <text x={cxP} y={cyP + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">
                    P
                </text>
                <text x={cxP} y={cyP - 34} textAnchor="middle" fontSize={12} fontWeight={600}>
                    {primary.id}
                </text>
                <text x={cxP} y={cyP - 20} textAnchor="middle" fontSize={10} fill={THEME.textDim}>
                    {primary.region || ''}
                </text>

                {/* Replica nodes */}
                {rest.map((r, i) => {
                    const cx = (width / (rest.length + 1)) * (i + 1);
                    const cy = height - 48;
                    return (
                        <g key={r.id}>
                            <circle
                                cx={cx}
                                cy={cy}
                                r={20}
                                fill={statusFill[r.status || 'healthy']}
                                stroke={THEME.surfaceRaised}
                                strokeWidth={2}
                            />
                            <text x={cx} y={cy + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff">
                                {r.role[0].toUpperCase()}
                            </text>
                            <text x={cx} y={cy + 38} textAnchor="middle" fontSize={11} fontWeight={600}>
                                {r.id}
                            </text>
                            <text x={cx} y={cy + 52} textAnchor="middle" fontSize={10} fill={THEME.textDim}>
                                {r.region || ''}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────
// Panel renderers
// ─────────────────────────────────────────────────────────────────────────

function renderOverview(spec: EngineDemoSpec) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title={`${spec.name} — identity`} icon={Database} accentColor={spec.accentColor}>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', padding: 16 }}>
                    <strong>Version</strong>
                    <span>{spec.versionString}</span>
                    {Object.entries(spec.identity).map(([k, v]) => (
                        <React.Fragment key={k}>
                            <strong style={{ textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</strong>
                            <span>{String(v)}</span>
                        </React.Fragment>
                    ))}
                </div>
            </Panel>

            <KpiCharts spec={spec} />

            <SignatureWidgetView sig={spec.signature} accentColor={spec.accentColor} />

            <AlertsPanel spec={spec} />

            <Panel title="Catalog" icon={Layers} accentColor={spec.accentColor}>
                <DataTable
                    accentColor={spec.accentColor}
                    columns={[
                        { key: 'name', label: 'Name' },
                        { key: 'kind', label: 'Kind' },
                        { key: 'location', label: 'Location' },
                    ]}
                    rows={spec.catalog.map((c) => ({
                        name: c.name,
                        kind: c.kind || 'database',
                        location: c.location || '—',
                    }))}
                />
            </Panel>
        </div>
    );
}

function renderQueries(spec: EngineDemoSpec) {
    return (
        <Panel title="Top queries (last 1h)" icon={Activity} accentColor={spec.accentColor}>
            <DataTable
                accentColor={spec.accentColor}
                columns={[
                    { key: 'query', label: 'Query / Statement' },
                    { key: 'metric', label: 'Cost' },
                    { key: 'note', label: 'Note' },
                ]}
                rows={spec.slowQueries.map((q) => ({ query: q.query, metric: q.metric, note: q.note || '' }))}
            />
        </Panel>
    );
}

function renderPlan(spec: EngineDemoSpec) {
    return (
        <Panel title="Execution plan" icon={Terminal} accentColor={spec.accentColor}>
            <div style={{ padding: 16 }}>
                <div style={{ fontSize: 12, color: THEME.textDim, marginBottom: 8 }}>{spec.plan.note}</div>
                <pre
                    style={{
                        background: THEME.bg,
                        color: THEME.primaryLight,
                        padding: 12,
                        borderRadius: 8,
                        fontSize: 12,
                        overflow: 'auto',
                        margin: 0,
                    }}
                >
                    {spec.plan.body}
                </pre>
            </div>
        </Panel>
    );
}

function renderWaits(spec: EngineDemoSpec) {
    const data = spec.waits.events
        .map((e) => ({
            event: e.event,
            ms: e.ms ?? (e.micros ?? 0) / 1000,
        }))
        .sort((a, b) => b.ms - a.ms);
    return (
        <Panel title={`Wait-event breakdown (${spec.waits.window})`} icon={Clock} accentColor={spec.accentColor}>
            <div style={{ height: 320, padding: 12 }}>
                <ResponsiveContainer>
                    <BarChart data={data} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis type="number" fontSize={11} />
                        <YAxis type="category" dataKey="event" width={180} fontSize={11} />
                        <Tooltip formatter={(v: any) => `${Number(v).toFixed(0)} ms`} />
                        <Bar dataKey="ms" fill={spec.accentColor} radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            {spec.waits.note && (
                <div style={{ fontSize: 12, color: THEME.textDim, padding: '0 16px 16px', fontStyle: 'italic' }}>
                    {spec.waits.note}
                </div>
            )}
        </Panel>
    );
}

function renderTables(spec: EngineDemoSpec) {
    return (
        <Panel title="Tables / collections" icon={Layers} accentColor={spec.accentColor}>
            <DataTable
                accentColor={spec.accentColor}
                columns={[
                    { key: 'schema', label: 'Schema' },
                    { key: 'name', label: 'Name' },
                    { key: 'rows', label: 'Rows' },
                    { key: 'bytes', label: 'Bytes' },
                    { key: 'note', label: 'Note' },
                ]}
                rows={spec.tables.map((t) => ({
                    schema: t.schema,
                    name: t.name,
                    rows: t.rows != null ? t.rows.toLocaleString() : '—',
                    bytes: t.bytes != null ? formatBytes(t.bytes) : '—',
                    note: t.note || '',
                }))}
            />
        </Panel>
    );
}

function renderIndexes(spec: EngineDemoSpec) {
    if (!spec.indexes.length) {
        return (
            <Panel title="Indexes" icon={Link2} accentColor={spec.accentColor}>
                <EmptyState note="Indexes do not apply to this engine." />
            </Panel>
        );
    }
    return (
        <Panel title="Indexes" icon={Link2} accentColor={spec.accentColor}>
            <DataTable
                accentColor={spec.accentColor}
                columns={[
                    { key: 'schema', label: 'Schema' },
                    { key: 'table', label: 'Table' },
                    { key: 'kind', label: 'Kind' },
                    { key: 'definition', label: 'Definition' },
                ]}
                rows={spec.indexes}
            />
        </Panel>
    );
}

function renderConnections(spec: EngineDemoSpec) {
    if (!spec.connections.length) {
        return (
            <Panel title="Active connections" icon={Network} accentColor={spec.accentColor}>
                <EmptyState note="This engine is stateless — connections don't apply. See the Engine Notes tab." />
            </Panel>
        );
    }
    return (
        <Panel title="Active connections" icon={Network} accentColor={spec.accentColor}>
            <DataTable
                accentColor={spec.accentColor}
                columns={[
                    { key: 'session', label: 'Session' },
                    { key: 'user', label: 'User' },
                    { key: 'kind', label: 'Kind' },
                    { key: 'started', label: 'Started' },
                ]}
                rows={spec.connections.map((c) => ({
                    session: c.session,
                    user: c.user,
                    kind: c.kind || '—',
                    started: c.started ? timeAgo(c.started) : '—',
                }))}
            />
        </Panel>
    );
}

function renderLocks(spec: EngineDemoSpec) {
    const cols = Object.keys(spec.locks.rows[0] || {}).map((k) => ({ key: k, label: k }));
    return (
        <Panel title="Locks / contention" icon={Lock} accentColor={spec.accentColor}>
            <div style={{ padding: '12px 16px 0', fontSize: 12, color: THEME.textDim, fontStyle: 'italic' }}>
                {spec.locks.note}
            </div>
            {spec.locks.rows.length > 0 ? (
                <DataTable accentColor={spec.accentColor} columns={cols} rows={spec.locks.rows as any[]} />
            ) : (
                <EmptyState note="No contention detected in the last hour." />
            )}
        </Panel>
    );
}

function renderReplication(spec: EngineDemoSpec) {
    const cols = Object.keys(spec.replication.rows[0] || {}).map((k) => ({ key: k, label: k }));
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {spec.topology.length > 0 && (
                <Panel title="Topology" icon={GitBranch} accentColor={spec.accentColor}>
                    <TopologyGraph nodes={spec.topology} accentColor={spec.accentColor} />
                </Panel>
            )}
            <Panel title="Replication / topology" icon={GitBranch} accentColor={spec.accentColor}>
                <div style={{ padding: '12px 16px 0', fontSize: 12, color: THEME.textDim, fontStyle: 'italic' }}>
                    {spec.replication.note}
                </div>
                {spec.replication.rows.length > 0 ? (
                    <DataTable accentColor={spec.accentColor} columns={cols} rows={spec.replication.rows as any[]} />
                ) : (
                    <EmptyState note="No replicas configured." />
                )}
            </Panel>
        </div>
    );
}

function renderBloat(spec: EngineDemoSpec) {
    if (!spec.bloat.length) {
        return (
            <Panel title="Bloat / stale data" icon={HardDrive} accentColor={spec.accentColor}>
                <EmptyState note="Nothing flagged — engine storage is healthy." />
            </Panel>
        );
    }
    const cols = Object.keys(spec.bloat[0] || {}).map((k) => ({ key: k, label: k }));
    return (
        <Panel title="Bloat / stale data" icon={HardDrive} accentColor={spec.accentColor}>
            <DataTable accentColor={spec.accentColor} columns={cols} rows={spec.bloat as any[]} />
        </Panel>
    );
}

function renderSubstitutes(spec: EngineDemoSpec) {
    if (!spec.substitutes.length) {
        return (
            <Panel title="Engine-native substitutes" icon={Info} accentColor={spec.accentColor}>
                <EmptyState note="No substitutes — every panel maps directly to a native metric for this engine." />
            </Panel>
        );
    }
    return (
        <Panel title="Engine-native substitutes" icon={Info} accentColor={spec.accentColor}>
            <div style={{ padding: 16 }}>
                <p style={{ fontSize: 13, color: THEME.textDim, marginTop: 0 }}>
                    For panels where {spec.name} does not have a direct analog, PulseDB surfaces the closest actionable
                    signal in the same panel. These are the substitutions in use:
                </p>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {spec.substitutes.map((s, i) => (
                        <li key={i} style={{ marginBottom: 6 }}>
                            {s}
                        </li>
                    ))}
                </ul>
            </div>
        </Panel>
    );
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function EmptyState({ note }: { note: string }) {
    return (
        <div
            style={{
                padding: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: THEME.textDim,
                fontSize: 13,
            }}
        >
            <Eye size={16} style={{ marginRight: 8 }} />
            {note}
        </div>
    );
}

function formatBytes(n: number) {
    if (n < 1024) return `${n} B`;
    const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
    let i = -1;
    let x = n;
    while (x >= 1024 && i < units.length - 1) {
        x /= 1024;
        i++;
    }
    return `${x.toFixed(2)} ${units[i]}`;
}

function timeAgo(iso: string) {
    const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
}

// ─────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────

export interface DemoEngineTabProps {
    engine: EngineKey;
    subTabId?: string;
}

export default function DemoEngineTab({ engine, subTabId }: DemoEngineTabProps) {
    useAdaptiveTheme();
    const spec = DEMO_ENGINES[engine];

    const initialPanel = useMemo(() => {
        const found = PANEL_IDS.find((p) => p.id === subTabId);
        return found?.id || 'overview';
    }, [subTabId]);
    const [activePanel, setActivePanel] = useState<string>(initialPanel);
    const [range, setRange] = useState<string>('24h');

    if (!spec) {
        return (
            <div style={{ padding: 24 }}>
                <StatusBadge label={`Unknown engine: ${engine}`} color="#c00" />
            </div>
        );
    }

    let body: React.ReactNode = null;
    switch (activePanel) {
        case 'overview':
            body = renderOverview(spec);
            break;
        case 'queries':
            body = renderQueries(spec);
            break;
        case 'plan':
            body = renderPlan(spec);
            break;
        case 'waits':
            body = renderWaits(spec);
            break;
        case 'tables':
            body = renderTables(spec);
            break;
        case 'indexes':
            body = renderIndexes(spec);
            break;
        case 'connections':
            body = renderConnections(spec);
            break;
        case 'locks':
            body = renderLocks(spec);
            break;
        case 'replication':
            body = renderReplication(spec);
            break;
        case 'bloat':
            body = renderBloat(spec);
            break;
        case 'substitutes':
            body = renderSubstitutes(spec);
            break;
        default:
            body = renderOverview(spec);
    }

    const alertCount = (spec.alerts || []).length;
    const topBar = (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <StatusBadge label="LIVE" color={spec.accentColor} pulse />
                <span style={{ fontSize: 13, color: THEME.textDim }}>
                    <CheckCircle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Connection healthy · last sync 8s ago
                </span>
                {alertCount > 0 && (
                    <StatusBadge label={`${alertCount} alert${alertCount === 1 ? '' : 's'}`} color={THEME.warning} />
                )}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
                {RANGES.map((r) => (
                    <button
                        key={r.id}
                        onClick={() => setRange(r.id)}
                        style={{
                            padding: '4px 10px',
                            fontSize: 12,
                            borderRadius: 6,
                            border: '1px solid ' + (range === r.id ? spec.accentColor : THEME.surfaceRaised),
                            background: range === r.id ? spec.accentColor : 'transparent',
                            color: range === r.id ? '#fff' : THEME.textDim,
                            cursor: 'pointer',
                        }}
                    >
                        {r.label}
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <DemoLayout
            title={spec.name}
            subtitle={spec.versionString}
            accentColor={spec.accentColor}
            connectionBarMeta={{ lastSync: '8s', refreshInterval: '30s' }}
        >
            {topBar}
            <TabPills
                accentColor={spec.accentColor}
                active={activePanel}
                onChange={setActivePanel}
                tabs={PANEL_IDS.map((p) => ({ id: p.id, label: p.label }))}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>{body}</div>
        </DemoLayout>
    );
}
