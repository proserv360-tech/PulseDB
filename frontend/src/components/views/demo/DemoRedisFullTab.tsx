// ==========================================================================
//  DemoRedisFullTab.tsx — bespoke Redis demo.
//  Overview | Memory Explorer | Slowlog | Keyspace | Latency | Replication | Clients | Config
// ==========================================================================

import React, { useState } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { buildMetricsTab } from './useMetricsTab';
import catalog from '../../../utils/catalogs/redisCatalog';
import DemoLayout, { Panel, StatusBadge, DataTable, TabPills, AlertRow } from './DemoLayout';
import {
    Database,
    Activity,
    AlertTriangle,
    Clock,
    HardDrive,
    GitBranch,
    Users,
    Settings,
    Zap,
    CheckCircle,
    Gauge,
    Box,
    Key,
    Terminal,
} from 'lucide-react';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    Treemap,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ComposedChart,
    Line,
} from 'recharts';

const R_RED = '#DC382D';
const R_NAVY = THEME.bgAlt;
const R_AMBER = THEME.warning;
const R_GREEN = THEME.success;
const R_PURPLE = THEME.aiDark;

const now = Date.now();
const tMinus = (m: number) => new Date(now - m * 60_000).toISOString();
const fmtHour = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const fmtBytes = (n: number) => {
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let x = n;
    while (x >= 1024 && i < u.length - 1) {
        x /= 1024;
        i++;
    }
    return `${x.toFixed(x >= 10 ? 0 : 2)} ${u[i]}`;
};

const R = {
    identity: {
        mode: 'standalone',
        version: '7.4.1',
        tcp_port: '6379',
        os: 'Linux 6.1.0 x86_64',
        arch_bits: '64',
        role: 'master',
    },
    kpis: [
        { label: 'Ops/sec', value: '48,210', unit: '', color: R_RED, icon: Activity },
        { label: 'Hit rate', value: '97.8', unit: '%', color: R_GREEN, icon: Zap },
        { label: 'Used memory', value: '1.84', unit: 'GB', color: R_NAVY, icon: HardDrive },
        { label: 'Clients', value: '284', unit: '', color: R_RED, icon: Users },
        { label: 'Evictions', value: '142', unit: '/hr', color: R_AMBER, icon: AlertTriangle },
        { label: 'Keyspace miss', value: '2.2', unit: '%', color: R_AMBER, icon: Key },
    ],
    opsTrend: Array.from({ length: 48 }, (_, i) => ({
        t: tMinus((47 - i) * 5),
        ops: Math.round(48000 + Math.sin(i / 3) * 6000 + (Math.random() - 0.5) * 3000),
        hits: Math.round(46200 + Math.sin(i / 3) * 5800 + (Math.random() - 0.5) * 2800),
        misses: Math.round(1800 + (Math.random() - 0.5) * 400),
    })),
    memoryByPattern: [
        { name: 'user:session:*', size: 621, count: 148_210, avg_size: 4_200, ttl: 'set (1h)' },
        { name: 'cache:*', size: 482, count: 482_120, avg_size: 1_000, ttl: 'set (5m)' },
        { name: 'ratelimit:ip:*', size: 184, count: 84_210, avg_size: 2_240, ttl: 'set (1m)' },
        { name: 'queue:jobs', size: 142, count: 1_820, avg_size: 78_000, ttl: 'none' },
        { name: 'leaderboard:*', size: 98, count: 24, avg_size: 4_000_000, ttl: 'none' },
        { name: 'feature_flag:*', size: 62, count: 1_420, avg_size: 44_000, ttl: 'none' },
        { name: 'stale-session:*', size: 48, count: 18_420, avg_size: 2_600, ttl: 'NONE (bug)' },
        { name: 'pubsub:chan:*', size: 22, count: 124, avg_size: 182_000, ttl: 'none' },
    ],
    slowlog: [
        { id: 142, ts: '3m ago', duration_us: 1_842_000, command: 'KEYS user:session:*', client: '10.0.1.42:54212' },
        { id: 141, ts: '8m ago', duration_us: 412_000, command: 'LRANGE queue:jobs 0 -1', client: '10.0.1.48:54842' },
        {
            id: 140,
            ts: '18m ago',
            duration_us: 288_000,
            command: 'ZRANGEBYSCORE leaderboard:daily -inf +inf',
            client: '10.0.1.42:55010',
        },
        {
            id: 139,
            ts: '24m ago',
            duration_us: 142_000,
            command: 'SORT queue:jobs BY * LIMIT 0 1000',
            client: '10.0.1.48:55204',
        },
        { id: 138, ts: '32m ago', duration_us: 42_000, command: 'SMEMBERS online_users', client: '10.0.1.48:55410' },
    ],
    keyspace: [
        { db: 'db0', keys: 652_754, with_ttl: 630_330, avg_ttl_sec: 1_820 },
        { db: 'db1', keys: 482_120, with_ttl: 482_120, avg_ttl_sec: 300 },
        { db: 'db2', keys: 1_820, with_ttl: 0, avg_ttl_sec: 0 },
    ],
    latencyEvents: [
        { event: 'fork', latest_ms: 42, max_ms: 310, count_1h: 18 },
        { event: 'fsync', latest_ms: 18, max_ms: 82, count_1h: 4_210 },
        { event: 'expire-cycle', latest_ms: 12, max_ms: 44, count_1h: 84 },
        { event: 'aof-rewrite', latest_ms: 0, max_ms: 1_240, count_1h: 2 },
    ],
    replication: [
        { role: 'master', host: 'redis-primary', state: 'online', offset: 184_210_442, lag_ms: 0, priority: 100 },
        { role: 'slave', host: 'redis-slave-1', state: 'online', offset: 184_210_442, lag_ms: 0, priority: 90 },
        { role: 'slave', host: 'redis-slave-2', state: 'online', offset: 184_210_001, lag_ms: 400, priority: 80 },
    ],
    clients: [
        {
            id: 1024,
            addr: '10.0.1.42:54212',
            name: 'app-web-1',
            age_sec: 9_200,
            idle_sec: 4,
            cmd: 'GET',
            flags: 'N',
            db: 'db0',
        },
        {
            id: 1025,
            addr: '10.0.1.42:54218',
            name: 'app-web-1',
            age_sec: 9_200,
            idle_sec: 0,
            cmd: 'SUBSCRIBE',
            flags: 'P',
            db: 'db0',
        },
        {
            id: 1026,
            addr: '10.0.1.48:55104',
            name: 'worker-1',
            age_sec: 48,
            idle_sec: 2,
            cmd: 'BRPOP',
            flags: 'N',
            db: 'db0',
        },
        {
            id: 1027,
            addr: '10.0.1.48:55108',
            name: 'worker-2',
            age_sec: 48,
            idle_sec: 1,
            cmd: 'BRPOP',
            flags: 'N',
            db: 'db0',
        },
        {
            id: 1028,
            addr: '10.0.1.55:60021',
            name: 'analyst-cli',
            age_sec: 182,
            idle_sec: 182,
            cmd: 'CLIENT',
            flags: 'N',
            db: 'db0',
        },
        {
            id: 1029,
            addr: '10.0.1.12:58402',
            name: 'sentinel',
            age_sec: 820_000,
            idle_sec: 0,
            cmd: 'PING',
            flags: 'N',
            db: 'db0',
        },
    ],
    config: {
        Memory: {
            maxmemory: '2gb',
            'maxmemory-policy': 'allkeys-lfu',
            'maxmemory-samples': '5',
        },
        Persistence: {
            save: '3600 1 300 100 60 10000',
            appendonly: 'yes',
            appendfsync: 'everysec',
        },
        Networking: {
            'tcp-keepalive': '300',
            timeout: '0',
            'tcp-backlog': '511',
        },
        Slowlog: {
            'slowlog-log-slower-than': '10000',
            'slowlog-max-len': '128',
        },
    },
    alerts: [
        {
            severity: 'warning',
            title: 'KEYS command run in prod — 1.8s blocking call',
            time: '3m ago',
            source: 'slowlog',
        },
        {
            severity: 'warning',
            title: 'stale-session:* keys lack TTL — 48MB drift',
            time: '22m ago',
            source: 'pattern-advisor',
        },
        { severity: 'info', title: '142 keys evicted/hr (LFU eviction active)', time: '8m ago', source: 'info memory' },
    ],
};

function KpiTile({ k }: { k: (typeof R.kpis)[0] }) {
    const Icon = k.icon;
    return (
        <div
            style={{
                padding: 16,
                borderRadius: 10,
                border: `1px solid ${THEME.glassBorder}`,
                background: 'linear-gradient(135deg, rgba(220,56,45,0.06), rgba(255,255,255,0))',
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
            <Panel title="Instance identity" icon={Database} accentColor={R_RED}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 12,
                        padding: 16,
                    }}
                >
                    {Object.entries(R.identity).map(([k, v]) => (
                        <div
                            key={k}
                            style={{
                                padding: 12,
                                borderLeft: `3px solid ${R_RED}`,
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
                {R.kpis.map((k) => (
                    <KpiTile key={k.label} k={k} />
                ))}
            </div>
            <Panel title="Ops/sec vs hits vs misses — last 4h" icon={Activity} accentColor={R_RED}>
                <div style={{ height: 280, padding: 12 }}>
                    <ResponsiveContainer>
                        <ComposedChart data={R.opsTrend}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="t" tickFormatter={fmtHour} fontSize={11} />
                            <YAxis fontSize={11} />
                            <Tooltip labelFormatter={(v: any) => fmtHour(String(v))} />
                            <Legend />
                            <Area
                                type="monotone"
                                dataKey="hits"
                                stackId="a"
                                stroke={R_GREEN}
                                fill={R_GREEN}
                                fillOpacity={0.5}
                            />
                            <Area
                                type="monotone"
                                dataKey="misses"
                                stackId="a"
                                stroke={R_AMBER}
                                fill={R_AMBER}
                                fillOpacity={0.5}
                            />
                            <Line
                                type="monotone"
                                dataKey="ops"
                                stroke={R_RED}
                                strokeWidth={2}
                                dot={false}
                                name="Total ops"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </Panel>
            <Panel title="Alerts" icon={AlertTriangle} accentColor={R_RED}>
                <div style={{ padding: '4px 0' }}>
                    {R.alerts.map((a, i) => (
                        <AlertRow
                            key={i}
                            severity={a.severity as any}
                            title={a.title}
                            time={a.time}
                            source={a.source}
                            color={a.severity === 'warning' ? R_AMBER : R_NAVY}
                        />
                    ))}
                </div>
            </Panel>
        </div>
    );
}

// ── Memory Explorer — treemap by key pattern
function MemoryPanel() {
    const data = R.memoryByPattern.map((p) => ({ name: p.name, size: p.size, count: p.count, ttl: p.ttl }));
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Memory by key pattern" icon={HardDrive} accentColor={R_RED}>
                <div style={{ height: 380, padding: 12 }}>
                    <ResponsiveContainer>
                        <Treemap
                            data={data}
                            dataKey="size"
                            stroke="#fff"
                            nameKey="name"
                            content={({ x, y, width, height, name, payload }: any) => {
                                const noTtl = payload?.ttl?.includes('NONE') || payload?.ttl === 'none';
                                return (
                                    <g>
                                        <rect
                                            x={x}
                                            y={y}
                                            width={width}
                                            height={height}
                                            style={{
                                                fill: noTtl ? R_AMBER : R_RED,
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
                                                {payload?.size} MB · {payload?.count?.toLocaleString()} keys
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
                        <div style={{ width: 12, height: 12, background: R_RED, borderRadius: 2 }} /> TTL set
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 12, height: 12, background: R_AMBER, borderRadius: 2 }} /> No TTL
                        (potential memory leak)
                    </span>
                </div>
            </Panel>
            <Panel title="Pattern detail" icon={Key} accentColor={R_RED}>
                <DataTable
                    accentColor={R_RED}
                    columns={[
                        { key: 'name', label: 'Pattern' },
                        { key: 'size_mb', label: 'Size' },
                        { key: 'count', label: 'Key count' },
                        { key: 'avg_size', label: 'Avg key size' },
                        { key: 'ttl', label: 'TTL strategy' },
                    ]}
                    rows={R.memoryByPattern.map((p) => ({
                        name: p.name,
                        size_mb: `${p.size} MB`,
                        count: p.count.toLocaleString(),
                        avg_size: fmtBytes(p.avg_size),
                        ttl: p.ttl,
                    }))}
                />
            </Panel>
        </div>
    );
}

// ── Slowlog with "replay"
function SlowlogPanel() {
    const [sel, setSel] = useState<number>(R.slowlog[0].id);
    const entry = R.slowlog.find((e) => e.id === sel)!;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="SLOWLOG GET 128" icon={Clock} accentColor={R_RED}>
                <DataTable
                    accentColor={R_RED}
                    columns={[
                        { key: 'id', label: 'ID' },
                        { key: 'ts', label: 'When' },
                        { key: 'dur', label: 'Duration' },
                        { key: 'command', label: 'Command' },
                        { key: 'client', label: 'Client' },
                    ]}
                    rows={R.slowlog.map((e) => ({
                        id: e.id,
                        ts: e.ts,
                        dur: `${(e.duration_us / 1000).toFixed(1)} ms`,
                        command: e.command,
                        client: e.client,
                    }))}
                />
            </Panel>
            <Panel title={`Entry #${entry.id} — replay preview`} icon={Terminal} accentColor={R_RED}>
                <div style={{ padding: 16 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        {R.slowlog.map((e) => (
                            <button
                                key={e.id}
                                onClick={() => setSel(e.id)}
                                style={{
                                    padding: '4px 10px',
                                    fontSize: 12,
                                    borderRadius: 6,
                                    border: `1px solid ${sel === e.id ? R_RED : THEME.surfaceRaised}`,
                                    background: sel === e.id ? R_RED : 'transparent',
                                    color: sel === e.id ? '#fff' : THEME.textDim,
                                    cursor: 'pointer',
                                }}
                            >
                                #{e.id}
                            </button>
                        ))}
                    </div>
                    <div
                        style={{
                            fontFamily: 'monospace',
                            fontSize: 12,
                            padding: 12,
                            background: THEME.bgAlt || THEME.bg,
                            color: THEME.textMain,
                            borderRadius: 6,
                        }}
                    >
                        $ redis-cli {'>>>'} {entry.command}
                        {'\n'}
                        {entry.command.startsWith('KEYS') &&
                            '(error) prod guardrail: KEYS is blocking — use SCAN instead'}
                    </div>
                    {entry.command.startsWith('KEYS') && (
                        <div
                            style={{
                                marginTop: 10,
                                padding: 10,
                                background: THEME.warningLight,
                                borderRadius: 6,
                                fontSize: 12,
                                color: THEME.warningDark,
                            }}
                        >
                            <strong>Advisor:</strong> Replace with <code>SCAN 0 MATCH user:session:* COUNT 100</code> —
                            non-blocking cursor iteration.
                        </div>
                    )}
                </div>
            </Panel>
        </div>
    );
}

// ── Keyspace heatmap
function KeyspacePanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                <Panel title="Keyspace distribution" icon={Key} accentColor={R_RED}>
                    <div style={{ height: 280, padding: 12 }}>
                        <ResponsiveContainer>
                            <BarChart data={R.keyspace}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                <XAxis dataKey="db" fontSize={11} />
                                <YAxis fontSize={11} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="keys" stackId="a" fill={R_RED} name="Keys" />
                                <Bar dataKey="with_ttl" stackId="b" fill={R_GREEN} name="With TTL" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>
                <Panel title="TTL coverage" icon={Clock} accentColor={R_RED}>
                    <div style={{ padding: 16 }}>
                        {R.keyspace.map((d) => {
                            const pct = d.keys === 0 ? 0 : (d.with_ttl / d.keys) * 100;
                            return (
                                <div key={d.db} style={{ marginBottom: 14 }}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            fontSize: 13,
                                            marginBottom: 4,
                                        }}
                                    >
                                        <strong>{d.db}</strong>
                                        <span style={{ color: pct < 50 ? R_AMBER : R_GREEN }}>
                                            {pct.toFixed(1)}% with TTL
                                        </span>
                                    </div>
                                    <div style={{ height: 8, background: THEME.glassBorder, borderRadius: 4 }}>
                                        <div
                                            style={{
                                                width: `${pct}%`,
                                                height: '100%',
                                                background: pct < 50 ? R_AMBER : R_GREEN,
                                                borderRadius: 4,
                                            }}
                                        />
                                    </div>
                                    <div style={{ fontSize: 11, color: THEME.textDim, marginTop: 2 }}>
                                        {d.keys.toLocaleString()} keys · avg TTL {d.avg_ttl_sec}s
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Panel>
            </div>
        </div>
    );
}

// ── LATENCY LATEST
function LatencyPanel() {
    return (
        <Panel title="LATENCY LATEST + history" icon={Zap} accentColor={R_RED}>
            <DataTable
                accentColor={R_RED}
                columns={[
                    { key: 'event', label: 'Event' },
                    { key: 'latest_ms', label: 'Latest (ms)' },
                    { key: 'max_ms', label: 'Max (ms)' },
                    { key: 'count_1h', label: 'Count (1h)' },
                    { key: 'severity', label: 'Severity' },
                ]}
                rows={R.latencyEvents.map((e) => {
                    const sev = e.max_ms > 500 ? 'HIGH' : e.max_ms > 100 ? 'MED' : 'LOW';
                    return {
                        event: e.event,
                        latest_ms: e.latest_ms,
                        max_ms: e.max_ms,
                        count_1h: e.count_1h.toLocaleString(),
                        severity: sev,
                    };
                })}
            />
        </Panel>
    );
}

// ── Replication
function ReplicationPanel() {
    return (
        <Panel title="Replication topology" icon={GitBranch} accentColor={R_RED}>
            <div style={{ padding: 20 }}>
                <svg width="100%" height={200} viewBox="0 0 600 200">
                    <circle cx={120} cy={100} r={34} fill={R_RED} stroke={THEME.surfaceRaised} strokeWidth={2} />
                    <text x={120} y={104} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">
                        MASTER
                    </text>
                    <text x={120} y={58} textAnchor="middle" fontSize={12} fontWeight={600}>
                        redis-primary
                    </text>
                    {R.replication.slice(1).map((r, i) => {
                        const cx = 360 + i * 140;
                        const color = r.lag_ms > 1000 ? R_AMBER : R_GREEN;
                        return (
                            <g key={r.host}>
                                <line
                                    x1={154}
                                    y1={100}
                                    x2={cx - 28}
                                    y2={100}
                                    stroke={color}
                                    strokeWidth={2}
                                    strokeDasharray={r.lag_ms > 1000 ? '6 4' : undefined}
                                />
                                <text x={(154 + cx - 28) / 2} y={94} textAnchor="middle" fontSize={10} fill={THEME.textDim}>
                                    {r.lag_ms}ms lag
                                </text>
                                <circle cx={cx} cy={100} r={26} fill={color} stroke={THEME.surfaceRaised} strokeWidth={2} />
                                <text x={cx} y={104} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff">
                                    SLAVE
                                </text>
                                <text x={cx} y={58} textAnchor="middle" fontSize={12} fontWeight={600}>
                                    {r.host}
                                </text>
                                <text x={cx} y={148} textAnchor="middle" fontSize={10} fill={THEME.textDim}>
                                    priority {r.priority}
                                </text>
                            </g>
                        );
                    })}
                </svg>
                <DataTable
                    accentColor={R_RED}
                    columns={[
                        { key: 'host', label: 'Host' },
                        { key: 'role', label: 'Role' },
                        { key: 'state', label: 'State' },
                        { key: 'offset', label: 'Repl offset' },
                        { key: 'lag_ms', label: 'Lag (ms)' },
                        { key: 'priority', label: 'Priority' },
                    ]}
                    rows={R.replication.map((r) => ({ ...r, offset: r.offset.toLocaleString() }))}
                />
            </div>
        </Panel>
    );
}

// ── Clients
function ClientsPanel() {
    return (
        <Panel title="CLIENT LIST" icon={Users} accentColor={R_RED}>
            <DataTable
                accentColor={R_RED}
                columns={[
                    { key: 'id', label: 'ID' },
                    { key: 'addr', label: 'Address' },
                    { key: 'name', label: 'Name' },
                    { key: 'age_sec', label: 'Age' },
                    { key: 'idle_sec', label: 'Idle' },
                    { key: 'cmd', label: 'Last cmd' },
                    { key: 'flags', label: 'Flags' },
                    { key: 'db', label: 'DB' },
                ]}
                rows={R.clients.map((c) => ({
                    ...c,
                    age_sec:
                        c.age_sec < 60
                            ? `${c.age_sec}s`
                            : c.age_sec < 3600
                              ? `${Math.floor(c.age_sec / 60)}m`
                              : `${Math.floor(c.age_sec / 3600)}h`,
                    idle_sec:
                        c.idle_sec === 0
                            ? 'active'
                            : c.idle_sec < 60
                              ? `${c.idle_sec}s`
                              : `${Math.floor(c.idle_sec / 60)}m`,
                }))}
            />
        </Panel>
    );
}

// ── Config
function ConfigPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.entries(R.config).map(([section, kv]) => (
                <Panel key={section} title={section} icon={Settings} accentColor={R_RED}>
                    <DataTable
                        accentColor={R_RED}
                        columns={[
                            { key: 'param', label: 'Parameter' },
                            { key: 'value', label: 'Value' },
                        ]}
                        rows={Object.entries(kv).map(([param, value]) => ({ param, value: String(value) }))}
                    />
                </Panel>
            ))}
        </div>
    );
}

const PANELS = [
    { id: 'overview', label: 'Overview', icon: Gauge },
    { id: 'memory', label: 'Memory', icon: HardDrive },
    { id: 'slowlog', label: 'Slowlog', icon: Clock },
    { id: 'keyspace', label: 'Keyspace', icon: Key },
    { id: 'latency', label: 'Latency', icon: Zap },
    { id: 'replication', label: 'Replication', icon: GitBranch },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'config', label: 'Config', icon: Settings },
];

export default function DemoRedisFullTab({ subTabId }: { subTabId?: string } = {}) {
    useAdaptiveTheme();
    void subTabId;
    const { sections, renderContent } = buildMetricsTab(catalog);
    return (
        <DemoLayout
            title="Redis"
            subtitle="Redis 7.2 · cluster mode · acme-cache"
            accentColor={catalog.accentColor}
            connectionBarMeta={{ lastSync: '8s', refreshInterval: '30s' }}
            titleIcon={Database}
            activeDemo="demo-redis"
            sections={sections}
            renderContent={renderContent}
        />
    );
}
