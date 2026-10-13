// ==========================================================================
//  ObservabilityHubSections — section renderers for the v3.2.1 hub.
//  Sample data ported from observability_enterprise_v2 mockup.
//  Data-backed sections (api/exceptions/uptime/audit/jobs/traces) receive
//  live data via ctx and fall back to sample data when absent.
// ==========================================================================
import React from 'react';
import { THEME } from '../../../utils/theme';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
} from 'recharts';

const T = {
    get bg() {
        return THEME.bg;
    },
    get surface() {
        return THEME.surface;
    },
    get raised() {
        return THEME.surfaceRaised;
    },
    get border() {
        return THEME.grid;
    },
    get text1() {
        return THEME.textMain;
    },
    get text2() {
        return THEME.textMuted;
    },
    get text3() {
        return THEME.textDim;
    },
    get primary() {
        return THEME.primary;
    },
    get success() {
        return THEME.success;
    },
    get warning() {
        return THEME.warning;
    },
    get danger() {
        return THEME.danger;
    },
    get info() {
        return THEME.info;
    },
};

const toneColor = (s) => {
    switch (s) {
        case 'critical':
        case 'danger':
        case 'Error':
        case 'off':
            return T.danger;
        case 'warn':
        case 'warning':
            return T.warning;
        case 'ok':
        case 'on':
        case 'Running':
        case 'resolved':
            return T.success;
        case 'info':
            return T.info;
        default:
            return T.text2;
    }
};

// ════════════════════════════════════════════════════════════════════════
// SAMPLE DATA (from mockup)
// ════════════════════════════════════════════════════════════════════════
const SLOS = [
    { name: 'api-gateway', target: 99.9, current: 99.94, budget: 82, burn: 0.8, status: 'ok' },
    { name: 'auth-service', target: 99.9, current: 99.95, budget: 78, burn: 1.1, status: 'ok' },
    { name: 'orders-api', target: 99.5, current: 99.28, budget: 22, burn: 4.1, status: 'critical' },
    { name: 'payments-api', target: 99.99, current: 99.97, budget: 55, burn: 2.0, status: 'warn' },
    { name: 'search-es', target: 99.5, current: 99.71, budget: 90, burn: 0.5, status: 'ok' },
    { name: 'notifications', target: 99.0, current: 99.82, budget: 96, burn: 0.2, status: 'ok' },
    { name: 'worker-queue', target: 99.5, current: 99.41, budget: 31, burn: 3.2, status: 'warn' },
    { name: 'cdn-edge', target: 99.95, current: 99.99, budget: 99, burn: 0.1, status: 'ok' },
];
const ALERTS = [
    {
        sev: 'critical',
        title: 'orders-api SLO burn rate 4.1x',
        service: 'orders-api',
        time: '14:18',
        dur: '26m',
        msg: 'Error budget at 22% — on track to exhaust in ~5 days at current rate',
    },
    {
        sev: 'critical',
        title: 'index.rebuild job failed — lock timeout',
        service: 'worker',
        time: '13:40',
        dur: '44m',
        msg: 'Job has failed 3x in 6h. Manual intervention required.',
    },
    {
        sev: 'warning',
        title: 'search-es P99 latency spike',
        service: 'search-es',
        time: '13:55',
        dur: '29m',
        msg: 'P99 hit 1.4s (SLO threshold 800ms). Shard rebalancing in progress.',
    },
    {
        sev: 'warning',
        title: 'payments-api error budget 55%',
        service: 'payments-api',
        time: '12:00',
        dur: '2h',
        msg: 'Burn rate 2.0x — monitor closely',
    },
    {
        sev: 'info',
        title: 'worker-queue depth elevated',
        service: 'worker',
        time: '11:30',
        dur: '3h',
        msg: 'Queue depth 2,800 — above normal 1,500 baseline',
    },
    {
        sev: 'resolved',
        title: 'Redis primary failover',
        service: 'cache',
        time: '02:14',
        dur: '12m',
        msg: 'Failover completed. Replica promoted. All connections restored.',
    },
];
const ALERT_RULES = [
    {
        name: 'SLO Burn Rate > 2x',
        condition: 'burn_rate > 2 for 15m',
        sev: 'critical',
        channel: 'PagerDuty',
        status: 'on',
    },
    {
        name: 'P99 > SLO threshold',
        condition: 'latency_p99 > slo_threshold',
        sev: 'warning',
        channel: 'Slack #alerts',
        status: 'on',
    },
    {
        name: 'Error rate > 5%',
        condition: 'error_rate > 0.05 for 5m',
        sev: 'critical',
        channel: 'PagerDuty',
        status: 'on',
    },
    {
        name: 'Job failure > 2x',
        condition: 'job_fail_count > 2 in 1h',
        sev: 'warning',
        channel: 'Slack #ops',
        status: 'on',
    },
    {
        name: 'CPU > 85% (5m avg)',
        condition: 'avg(cpu) > 85 for 5m',
        sev: 'warning',
        channel: 'Slack #infra',
        status: 'off',
    },
];
const HOSTS = [
    { name: 'prod-web-01', role: 'web', cpu: 72, mem: 58, disk: 44, status: 'ok' },
    { name: 'prod-web-02', role: 'web', cpu: 69, mem: 61, disk: 47, status: 'ok' },
    { name: 'prod-api-01', role: 'api', cpu: 81, mem: 74, disk: 55, status: 'warn' },
    { name: 'prod-api-02', role: 'api', cpu: 78, mem: 70, disk: 52, status: 'ok' },
    { name: 'prod-db-01', role: 'db', cpu: 45, mem: 88, disk: 83, status: 'critical' },
    { name: 'prod-db-02', role: 'db', cpu: 42, mem: 85, disk: 81, status: 'critical' },
    { name: 'prod-cache-01', role: 'cache', cpu: 22, mem: 44, disk: 18, status: 'ok' },
    { name: 'prod-worker-01', role: 'worker', cpu: 88, mem: 62, disk: 39, status: 'warn' },
];
const PODS = [
    { name: 'api-gateway-5d9f-xk2p', ns: 'default', status: 'Running', restarts: 0, cpu: '82m', mem: '128Mi' },
    { name: 'orders-api-7c8b-mn4q', ns: 'default', status: 'Running', restarts: 3, cpu: '240m', mem: '512Mi' },
    { name: 'payments-api-6a7d-pq1r', ns: 'default', status: 'Running', restarts: 0, cpu: '110m', mem: '256Mi' },
    { name: 'search-es-0', ns: 'elastic', status: 'Running', restarts: 1, cpu: '480m', mem: '2Gi' },
    { name: 'index-rebuild-job-xt9z', ns: 'jobs', status: 'Error', restarts: 3, cpu: '0m', mem: '0' },
    { name: 'worker-queue-4f2c-ab3s', ns: 'default', status: 'Running', restarts: 0, cpu: '190m', mem: '384Mi' },
];
const ANOMALIES = [
    {
        sev: 'critical',
        title: 'orders-api: deadlock surge (PostgreSQL)',
        time: '14:18',
        service: 'orders-api',
        insight:
            'Deadlock rate spiked 12x over baseline in the last 30 minutes. Two concurrent UPDATE transactions on orders.id and inventory.product_id acquire locks in opposite order. Fix: enforce consistent lock acquisition order or use SELECT ... FOR UPDATE SKIP LOCKED. P99 latency impact: +340ms.',
    },
    {
        sev: 'warning',
        title: 'search-es: shard rebalance latency spike',
        time: '13:55',
        service: 'search-es',
        insight:
            'Shard rebalance triggered by node recovery is causing read latency increase. P95 rose from 380ms to 1,240ms. Predicted to self-resolve in ~15min when rebalance completes. orders-api downstream queries are affected.',
    },
    {
        sev: 'warning',
        title: 'worker-queue: consumer lag growing',
        time: '11:30',
        service: 'worker',
        insight:
            'Queue depth at 2,800 (baseline 1,200). Consumer rate 44 msg/sec vs publish 58 msg/sec. At this rate, lag reaches 5,000 in ~2h. Recommend scaling worker replicas 2→4.',
    },
];
const COST_SERVICES = [
    { name: 'orders-api', logs: 42, traces: 31, metrics: 2.8, cost: 820 },
    { name: 'search-es', logs: 88, traces: 12, metrics: 1.2, cost: 640 },
    { name: 'api-gateway', logs: 55, traces: 48, metrics: 3.1, cost: 580 },
    { name: 'payments-api', logs: 28, traces: 22, metrics: 1.8, cost: 420 },
    { name: 'auth-service', logs: 18, traces: 14, metrics: 1.1, cost: 280 },
    { name: 'worker-queue', logs: 32, traces: 8, metrics: 0.8, cost: 240 },
    { name: 'notifications', logs: 12, traces: 5, metrics: 0.4, cost: 140 },
    { name: 'cdn-edge', logs: 22, traces: 2, metrics: 0.6, cost: 180 },
];
const DEPLOYMENTS = [
    {
        time: '13:40',
        service: 'orders-api',
        version: 'v2.8.1',
        author: 'dilip@pulsedb',
        note: 'hotfix: retry logic',
        impact: 'warn',
    },
    {
        time: '11:00',
        service: 'search-es',
        version: 'v1.4.0',
        author: 'svc-ci',
        note: 'shard config update',
        impact: 'warn',
    },
    {
        time: '06:00',
        service: 'payments-api',
        version: 'v3.1.2',
        author: 'svc-ci',
        note: 'stripe sdk upgrade',
        impact: 'ok',
    },
    {
        time: '01:00',
        service: 'api-gateway',
        version: 'v5.0.8',
        author: 'svc-ci',
        note: 'rate limit policy update',
        impact: 'ok',
    },
];
const LOG_DATA = [
    { ts: '14:22:01.441', lvl: 'INFO', svc: 'api-gateway', msg: 'GET /api/v2/users/482 200 · 142ms · user_id=482' },
    {
        ts: '14:21:58.330',
        lvl: 'ERROR',
        svc: 'orders-api',
        msg: 'deadlock detected orders.id row lock · SQLSTATE 40P01 · retry 1/3',
    },
    {
        ts: '14:21:55.210',
        lvl: 'WARN',
        svc: 'payments-api',
        msg: 'stripe webhook latency 820ms · above SLO threshold 800ms',
    },
    { ts: '14:21:50.091', lvl: 'INFO', svc: 'auth', msg: 'sso.saml.login dilip@pulsedb · session created · TTL 3600s' },
    {
        ts: '14:21:44.882',
        lvl: 'DEBUG',
        svc: 'search-es',
        msg: 'shard rebalance started · primary 7→8 replicas · eta 4m',
    },
    {
        ts: '14:21:38.774',
        lvl: 'ERROR',
        svc: 'orders-api',
        msg: 'deadlock detected orders.id row lock · SQLSTATE 40P01 · retry 2/3',
    },
    {
        ts: '14:21:30.553',
        lvl: 'INFO',
        svc: 'api-gateway',
        msg: 'POST /api/v2/orders 201 · 312ms · order_id=ORD-88241',
    },
    { ts: '14:21:22.310', lvl: 'WARN', svc: 'worker', msg: 'queue depth 2800 · threshold 2500 · consumer lag 42s' },
    { ts: '14:21:15.099', lvl: 'INFO', svc: 'payments-api', msg: 'payment.processed order_id=ORD-88241 · $142.00' },
    { ts: '14:21:08.004', lvl: 'DEBUG', svc: 'auth', msg: 'jwt.verify user_id=482 · exp in 3542s' },
    {
        ts: '14:20:58.881',
        lvl: 'ERROR',
        svc: 'orders-api',
        msg: 'FATAL deadlock · 3 retries exhausted · order_id=ORD-88240 rolled back',
    },
    {
        ts: '14:20:50.770',
        lvl: 'INFO',
        svc: 'api-gateway',
        msg: 'GET /api/v2/products?q=laptop 200 · 88ms · 14 results',
    },
    {
        ts: '14:20:42.660',
        lvl: 'INFO',
        svc: 'search-es',
        msg: 'query executed · 14 results · took 34ms · index products_v3',
    },
    {
        ts: '14:20:35.551',
        lvl: 'WARN',
        svc: 'api-gateway',
        msg: 'rate limit approaching user_id=301 · 880/1000 req/min',
    },
    {
        ts: '14:20:20.330',
        lvl: 'INFO',
        svc: 'payments-api',
        msg: 'webhook.received stripe · event payment_intent.succeeded',
    },
    {
        ts: '14:20:12.220',
        lvl: 'ERROR',
        svc: 'worker',
        msg: 'index.rebuild failed · lock timeout after 30s · PSQLException',
    },
];

// ════════════════════════════════════════════════════════════════════════
// SHARED STYLE BLOCK (consumed by the hub)
// ════════════════════════════════════════════════════════════════════════
export const sectionStyles = `
    .ohx-card { background:${T.surface}; border:1px solid ${T.border}; border-radius:16px; padding:22px; margin-bottom:20px; }
    .ohx-cardhead { display:flex; align-items:center; gap:9px; margin-bottom:18px; font-size:15px; font-weight:700; color:${T.text1}; }
    .ohx-tbl { width:100%; border-collapse:collapse; font-size:13px; }
    .ohx-tbl th { text-align:left; color:${T.text2}; font-weight:600; padding:10px 12px; border-bottom:1px solid ${T.border}; font-size:12px; text-transform:uppercase; letter-spacing:.4px; }
    .ohx-tbl td { padding:11px 12px; border-bottom:1px solid ${T.border}; color:${T.text1}; }
    .ohx-tbl tr:hover td { background:${T.raised}; }
    .ohx-pill { display:inline-block; padding:2px 9px; border-radius:20px; font-size:11px; font-weight:700; }
    .ohx-bar { height:7px; border-radius:20px; background:${T.raised}; overflow:hidden; min-width:80px; }
    .ohx-bar > span { display:block; height:100%; }
    .ohx-item { padding:14px 0; border-bottom:1px solid ${T.border}; }
    .ohx-item:last-child { border-bottom:none; }
    .ohx-log { font-family:ui-monospace,Menlo,monospace; font-size:12px; padding:6px 10px; border-bottom:1px solid ${T.border}; display:flex; gap:12px; }
    .ohx-g2 { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
    .ohx-g4 { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
    .ohx-kpi { background:${T.raised}; border:1px solid ${T.border}; border-radius:14px; padding:16px; }
    .ohx-kpi-label { font-size:11px; text-transform:uppercase; color:${T.text2}; letter-spacing:.5px; }
    .ohx-kpi-val { font-size:24px; font-weight:700; margin-top:6px; }
    @media (max-width:1100px){ .ohx-g2,.ohx-g4{ grid-template-columns:1fr; } }
`;

const Pill = ({ tone, children }) => (
    <span className="ohx-pill" style={{ background: `${toneColor(tone)}22`, color: toneColor(tone) }}>
        {children}
    </span>
);

const Bar3 = ({ value, color }) => (
    <div className="ohx-bar">
        <span style={{ width: `${Math.min(Math.max(value, 0), 100)}%`, background: color || T.primary }} />
    </div>
);

// ════════════════════════════════════════════════════════════════════════
// SECTION RENDERERS
// ════════════════════════════════════════════════════════════════════════
const Card = ({ title, icon, children }) => (
    <div className="ohx-card">
        {title && (
            <div className="ohx-cardhead">
                {icon}
                {title}
            </div>
        )}
        {children}
    </div>
);

function SloSection() {
    const breaching = SLOS.filter((s) => s.status !== 'ok');
    return (
        <>
            <div className="ohx-g4" style={{ marginBottom: 20 }}>
                <div className="ohx-kpi">
                    <div className="ohx-kpi-label">Services</div>
                    <div className="ohx-kpi-val" style={{ color: T.text1 }}>
                        {SLOS.length}
                    </div>
                </div>
                <div className="ohx-kpi">
                    <div className="ohx-kpi-label">Meeting SLO</div>
                    <div className="ohx-kpi-val" style={{ color: T.success }}>
                        {SLOS.filter((s) => s.status === 'ok').length}
                    </div>
                </div>
                <div className="ohx-kpi">
                    <div className="ohx-kpi-label">At Risk</div>
                    <div className="ohx-kpi-val" style={{ color: T.warning }}>
                        {SLOS.filter((s) => s.status === 'warn').length}
                    </div>
                </div>
                <div className="ohx-kpi">
                    <div className="ohx-kpi-label">Breaching</div>
                    <div className="ohx-kpi-val" style={{ color: T.danger }}>
                        {SLOS.filter((s) => s.status === 'critical').length}
                    </div>
                </div>
            </div>
            <Card title="Service Level Objectives">
                <table className="ohx-tbl">
                    <thead>
                        <tr>
                            <th>Service</th>
                            <th>Target</th>
                            <th>Current</th>
                            <th>Error Budget</th>
                            <th>Burn Rate</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {SLOS.map((s) => (
                            <tr key={s.name}>
                                <td style={{ fontWeight: 600 }}>{s.name}</td>
                                <td>{s.target}%</td>
                                <td style={{ color: s.current >= s.target ? T.success : T.danger }}>{s.current}%</td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Bar3
                                            value={s.budget}
                                            color={s.budget < 30 ? T.danger : s.budget < 60 ? T.warning : T.success}
                                        />
                                        <span style={{ fontSize: 12 }}>{s.budget}%</span>
                                    </div>
                                </td>
                                <td style={{ color: s.burn > 2 ? T.danger : T.text1 }}>{s.burn}x</td>
                                <td>
                                    <Pill tone={s.status}>{s.status}</Pill>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
            {breaching.length > 0 && (
                <Card title="Error Budget Alerts">
                    {breaching.map((s) => (
                        <div
                            className="ohx-item"
                            key={s.name}
                            style={{ display: 'flex', justifyContent: 'space-between' }}
                        >
                            <div>
                                <div style={{ fontWeight: 600 }}>{s.name}</div>
                                <div style={{ fontSize: 12, color: T.text2 }}>
                                    Burn rate {s.burn}x · budget {s.budget}% remaining
                                </div>
                            </div>
                            <Pill tone={s.status}>{s.status}</Pill>
                        </div>
                    ))}
                </Card>
            )}
        </>
    );
}

function AlertsSection() {
    return (
        <>
            <Card title="Active Alerts">
                {ALERTS.map((a, i) => (
                    <div className="ohx-item" key={i}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <Pill tone={a.sev}>{a.sev}</Pill>
                            <span style={{ fontWeight: 600 }}>{a.title}</span>
                            <span style={{ marginLeft: 'auto', fontSize: 12, color: T.text3 }}>
                                {a.time} · {a.dur}
                            </span>
                        </div>
                        <div style={{ fontSize: 13, color: T.text2 }}>
                            {a.service} — {a.msg}
                        </div>
                    </div>
                ))}
            </Card>
            <Card title="Alert Rules">
                <table className="ohx-tbl">
                    <thead>
                        <tr>
                            <th>Rule</th>
                            <th>Condition</th>
                            <th>Severity</th>
                            <th>Channel</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ALERT_RULES.map((r, i) => (
                            <tr key={i}>
                                <td style={{ fontWeight: 600 }}>{r.name}</td>
                                <td style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12, color: T.text2 }}>
                                    {r.condition}
                                </td>
                                <td>
                                    <Pill tone={r.sev}>{r.sev}</Pill>
                                </td>
                                <td>{r.channel}</td>
                                <td>
                                    <Pill tone={r.status}>{r.status === 'on' ? 'enabled' : 'disabled'}</Pill>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </>
    );
}

function LogsSection() {
    const lvlColor = (l) => (l === 'ERROR' ? T.danger : l === 'WARN' ? T.warning : l === 'DEBUG' ? T.text3 : T.info);
    return (
        <Card title="Log Explorer">
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
                {LOG_DATA.map((l, i) => (
                    <div className="ohx-log" key={i}>
                        <span style={{ color: T.text3, minWidth: 96 }}>{l.ts}</span>
                        <span style={{ color: lvlColor(l.lvl), fontWeight: 700, minWidth: 48 }}>{l.lvl}</span>
                        <span style={{ color: T.primary, minWidth: 96 }}>{l.svc}</span>
                        <span style={{ color: T.text1 }}>{l.msg}</span>
                    </div>
                ))}
            </div>
        </Card>
    );
}

function InfraSection() {
    return (
        <>
            <Card title="Hosts">
                <table className="ohx-tbl">
                    <thead>
                        <tr>
                            <th>Host</th>
                            <th>Role</th>
                            <th>CPU</th>
                            <th>Memory</th>
                            <th>Disk</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {HOSTS.map((h) => (
                            <tr key={h.name}>
                                <td style={{ fontWeight: 600 }}>{h.name}</td>
                                <td style={{ color: T.text2 }}>{h.role}</td>
                                {[h.cpu, h.mem, h.disk].map((v, j) => (
                                    <td key={j}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Bar3
                                                value={v}
                                                color={v > 85 ? T.danger : v > 70 ? T.warning : T.success}
                                            />
                                            <span style={{ fontSize: 12 }}>{v}%</span>
                                        </div>
                                    </td>
                                ))}
                                <td>
                                    <Pill tone={h.status}>{h.status}</Pill>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
            <Card title="Pods">
                <table className="ohx-tbl">
                    <thead>
                        <tr>
                            <th>Pod</th>
                            <th>Namespace</th>
                            <th>Status</th>
                            <th>Restarts</th>
                            <th>CPU</th>
                            <th>Memory</th>
                        </tr>
                    </thead>
                    <tbody>
                        {PODS.map((p) => (
                            <tr key={p.name}>
                                <td style={{ fontWeight: 600, fontFamily: 'ui-monospace,monospace', fontSize: 12 }}>
                                    {p.name}
                                </td>
                                <td style={{ color: T.text2 }}>{p.ns}</td>
                                <td>
                                    <Pill tone={p.status}>{p.status}</Pill>
                                </td>
                                <td style={{ color: p.restarts > 0 ? T.warning : T.text1 }}>{p.restarts}</td>
                                <td>{p.cpu}</td>
                                <td>{p.mem}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </>
    );
}

function TopologySection() {
    const services = [
        'api-gateway',
        'orders-api',
        'payments-api',
        'auth-service',
        'search-es',
        'worker-queue',
        'notifications',
        'cdn-edge',
    ];
    return (
        <Card title="Service Map">
            <div style={{ fontSize: 13, color: T.text2, marginBottom: 16 }}>
                Dependency overview — node health by SLO status.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {services.map((name) => {
                    const slo = SLOS.find((s) => s.name === name);
                    const tone = slo?.status || 'ok';
                    return (
                        <div
                            key={name}
                            style={{
                                border: `1px solid ${toneColor(tone)}55`,
                                background: `${toneColor(tone)}12`,
                                borderRadius: 12,
                                padding: '14px 18px',
                                minWidth: 150,
                            }}
                        >
                            <div style={{ fontWeight: 700, color: T.text1 }}>{name}</div>
                            <div style={{ fontSize: 12, color: T.text2, marginTop: 4 }}>
                                {slo ? `${slo.current}% · burn ${slo.burn}x` : 'healthy'}
                            </div>
                            <div style={{ marginTop: 8 }}>
                                <Pill tone={tone}>{tone}</Pill>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

function AiSection() {
    return (
        <>
            <Card title="AI-Detected Anomalies">
                {ANOMALIES.map((a, i) => (
                    <div className="ohx-item" key={i}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <Pill tone={a.sev}>{a.sev}</Pill>
                            <span style={{ fontWeight: 600 }}>{a.title}</span>
                            <span style={{ marginLeft: 'auto', fontSize: 12, color: T.text3 }}>
                                {a.time} · {a.service}
                            </span>
                        </div>
                        <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.5 }}>{a.insight}</div>
                    </div>
                ))}
            </Card>
            <Card title="Recent Deployments (correlation)">
                <table className="ohx-tbl">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Service</th>
                            <th>Version</th>
                            <th>Author</th>
                            <th>Change</th>
                            <th>Impact</th>
                        </tr>
                    </thead>
                    <tbody>
                        {DEPLOYMENTS.map((d, i) => (
                            <tr key={i}>
                                <td>{d.time}</td>
                                <td style={{ fontWeight: 600 }}>{d.service}</td>
                                <td style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12 }}>{d.version}</td>
                                <td style={{ color: T.text2 }}>{d.author}</td>
                                <td style={{ color: T.text2 }}>{d.note}</td>
                                <td>
                                    <Pill tone={d.impact}>{d.impact}</Pill>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </>
    );
}

function CostSection() {
    const total = COST_SERVICES.reduce((s, c) => s + c.cost, 0);
    const chartData = COST_SERVICES.map((c) => ({ name: c.name, cost: c.cost }));
    return (
        <>
            <div className="ohx-g4" style={{ marginBottom: 20 }}>
                <div className="ohx-kpi">
                    <div className="ohx-kpi-label">Monthly Spend</div>
                    <div className="ohx-kpi-val" style={{ color: T.text1 }}>
                        ${total.toLocaleString()}
                    </div>
                </div>
                <div className="ohx-kpi">
                    <div className="ohx-kpi-label">Top Cost</div>
                    <div className="ohx-kpi-val" style={{ color: T.warning }}>
                        {COST_SERVICES[0].name}
                    </div>
                </div>
                <div className="ohx-kpi">
                    <div className="ohx-kpi-label">Services</div>
                    <div className="ohx-kpi-val" style={{ color: T.text1 }}>
                        {COST_SERVICES.length}
                    </div>
                </div>
                <div className="ohx-kpi">
                    <div className="ohx-kpi-label">Logs GB/mo</div>
                    <div className="ohx-kpi-val" style={{ color: T.primary }}>
                        {COST_SERVICES.reduce((s, c) => s + c.logs, 0)}
                    </div>
                </div>
            </div>
            <Card title="Cost by Service">
                <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                        <XAxis type="number" stroke={T.text3} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" stroke={T.text3} tick={{ fontSize: 11 }} width={90} />
                        <Tooltip
                            contentStyle={{
                                background: T.surface,
                                border: `1px solid ${T.border}`,
                                borderRadius: 10,
                                color: T.text1,
                            }}
                        />
                        <Bar dataKey="cost" fill={T.primary} radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </Card>
            <Card title="Telemetry Volume">
                <table className="ohx-tbl">
                    <thead>
                        <tr>
                            <th>Service</th>
                            <th>Logs (GB)</th>
                            <th>Traces (M)</th>
                            <th>Metrics (M)</th>
                            <th>Cost / mo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {COST_SERVICES.map((c) => (
                            <tr key={c.name}>
                                <td style={{ fontWeight: 600 }}>{c.name}</td>
                                <td>{c.logs}</td>
                                <td>{c.traces}</td>
                                <td>{c.metrics}</td>
                                <td style={{ fontWeight: 600 }}>${c.cost}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </>
    );
}

// ── Data-backed sections (live data via ctx, sample fallback) ───────────
function ApiSection(ctx) {
    const m = ctx.apiMetrics;
    const series = Array.isArray(m?.timeSeriesData) ? m.timeSeriesData : [];
    const slow = Array.isArray(m?.topSlowestEndpoints) ? m.topSlowestEndpoints : [];
    const codes = Array.isArray(m?.statusCodeBreakdown) ? m.statusCodeBreakdown : [];
    return (
        <>
            <div className="ohx-g4" style={{ marginBottom: 20 }}>
                <div className="ohx-kpi">
                    <div className="ohx-kpi-label">Total Requests</div>
                    <div className="ohx-kpi-val">{(m?.totalRequests ?? 0).toLocaleString()}</div>
                </div>
                <div className="ohx-kpi">
                    <div className="ohx-kpi-label">Avg Response</div>
                    <div className="ohx-kpi-val">
                        {m?.averageResponseTime != null ? `${Math.round(m.averageResponseTime)}ms` : '—'}
                    </div>
                </div>
                <div className="ohx-kpi">
                    <div className="ohx-kpi-label">Error Rate</div>
                    <div className="ohx-kpi-val" style={{ color: (m?.errorRate ?? 0) > 1 ? T.danger : T.success }}>
                        {m?.errorRate != null ? `${Number(m.errorRate).toFixed(2)}%` : '—'}
                    </div>
                </div>
                <div className="ohx-kpi">
                    <div className="ohx-kpi-label">Status Codes</div>
                    <div className="ohx-kpi-val">{codes.length}</div>
                </div>
            </div>
            {series.length > 0 && (
                <Card title="Request Volume">
                    <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={series}>
                            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                            <XAxis dataKey="time" stroke={T.text3} tick={{ fontSize: 11 }} />
                            <YAxis stroke={T.text3} tick={{ fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{
                                    background: T.surface,
                                    border: `1px solid ${T.border}`,
                                    borderRadius: 10,
                                    color: T.text1,
                                }}
                            />
                            <Area type="monotone" dataKey="requests" stroke={T.primary} fill={`${T.primary}33`} />
                        </AreaChart>
                    </ResponsiveContainer>
                </Card>
            )}
            {slow.length > 0 && (
                <Card title="Slowest Endpoints">
                    <table className="ohx-tbl">
                        <thead>
                            <tr>
                                <th>Endpoint</th>
                                <th>Avg Response</th>
                            </tr>
                        </thead>
                        <tbody>
                            {slow.slice(0, 10).map((e, i) => (
                                <tr key={i}>
                                    <td style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12 }}>
                                        {String(e?.endpoint ?? '')}
                                    </td>
                                    <td>{String(e?.avgResponseTime ?? '')}ms</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}
        </>
    );
}

function ExceptionsSection(ctx) {
    const recent = Array.isArray(ctx.exceptions?.recentExceptions) ? ctx.exceptions.recentExceptions : [];
    const recurring = Array.isArray(ctx.exceptions?.topRecurring) ? ctx.exceptions.topRecurring : [];
    return (
        <>
            {recurring.length > 0 && (
                <Card title="Top Recurring">
                    <table className="ohx-tbl">
                        <thead>
                            <tr>
                                <th>Message</th>
                                <th>Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recurring.slice(0, 10).map((e, i) => (
                                <tr key={i}>
                                    <td>{String(e?.message ?? '').slice(0, 90)}</td>
                                    <td>{String(e?.count ?? '')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}
            <Card title="Recent Exceptions">
                {recent.length === 0 && <div style={{ color: T.text2, fontSize: 13 }}>No recent exceptions.</div>}
                {recent.slice(0, 20).map((e, i) => (
                    <div className="ohx-item" key={e?.id ?? i}>
                        <div style={{ fontWeight: 600, color: T.danger }}>
                            {String(e?.type || e?.message || 'Exception').slice(0, 80)}
                        </div>
                        <div style={{ fontSize: 12, color: T.text3 }}>
                            {e?.timestamp ? new Date(e.timestamp).toLocaleString() : ''}
                        </div>
                    </div>
                ))}
            </Card>
        </>
    );
}

function UptimeSection(ctx) {
    const u = ctx.uptime;
    const timeline = Array.isArray(u?.uptimeTimeline) ? u.uptimeTimeline : [];
    const incidents = Array.isArray(u?.downtimeIncidents) ? u.downtimeIncidents : [];
    return (
        <>
            <div className="ohx-g4" style={{ marginBottom: 20 }}>
                <div className="ohx-kpi">
                    <div className="ohx-kpi-label">Uptime</div>
                    <div className="ohx-kpi-val" style={{ color: T.success }}>
                        {u?.uptimePercentage != null ? `${Number(u.uptimePercentage).toFixed(2)}%` : '—'}
                    </div>
                </div>
                <div className="ohx-kpi">
                    <div className="ohx-kpi-label">SLA Compliance</div>
                    <div className="ohx-kpi-val">
                        {u?.slaCompliance != null ? `${Number(u.slaCompliance).toFixed(1)}%` : '—'}
                    </div>
                </div>
                <div className="ohx-kpi">
                    <div className="ohx-kpi-label">MTTR</div>
                    <div className="ohx-kpi-val">{String(u?.mttr ?? '—')}</div>
                </div>
                <div className="ohx-kpi">
                    <div className="ohx-kpi-label">Incidents</div>
                    <div className="ohx-kpi-val" style={{ color: incidents.length ? T.warning : T.success }}>
                        {incidents.length}
                    </div>
                </div>
            </div>
            {timeline.length > 0 && (
                <Card title="Uptime Timeline">
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={timeline}>
                            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                            <XAxis dataKey="date" stroke={T.text3} tick={{ fontSize: 10 }} />
                            <YAxis domain={[95, 100]} stroke={T.text3} tick={{ fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{
                                    background: T.surface,
                                    border: `1px solid ${T.border}`,
                                    borderRadius: 10,
                                    color: T.text1,
                                }}
                            />
                            <Line type="monotone" dataKey="uptime" stroke={T.success} strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </Card>
            )}
            <Card title="Downtime Incidents">
                {incidents.length === 0 && <div style={{ color: T.text2, fontSize: 13 }}>No incidents recorded.</div>}
                {incidents.map((x, i) => (
                    <div
                        className="ohx-item"
                        key={x?.id ?? i}
                        style={{ display: 'flex', justifyContent: 'space-between' }}
                    >
                        <div>
                            <div style={{ fontWeight: 600 }}>{String(x?.cause || 'Downtime')}</div>
                            <div style={{ fontSize: 12, color: T.text3 }}>
                                {x?.date ? new Date(x.date).toLocaleString() : ''}
                            </div>
                        </div>
                        <span style={{ color: T.warning }}>{String(x?.duration ?? '')}</span>
                    </div>
                ))}
            </Card>
        </>
    );
}

function AuditSection(ctx) {
    const events = Array.isArray(ctx.auditLog?.events) ? ctx.auditLog.events : [];
    return (
        <Card title="Audit Log">
            <table className="ohx-tbl">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>User</th>
                        <th>Action</th>
                        <th>Level</th>
                    </tr>
                </thead>
                <tbody>
                    {events.slice(0, 30).map((e, i) => (
                        <tr key={e?.id ?? i}>
                            <td style={{ color: T.text2 }}>
                                {e?.timestamp ? new Date(e.timestamp).toLocaleString() : ''}
                            </td>
                            <td>{String(e?.username ?? e?.user ?? '—')}</td>
                            <td style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12 }}>
                                {String(e?.action ?? '')}
                            </td>
                            <td>
                                <Pill
                                    tone={e?.level === 'error' ? 'critical' : e?.level === 'warn' ? 'warning' : 'info'}
                                >
                                    {String(e?.level ?? 'info')}
                                </Pill>
                            </td>
                        </tr>
                    ))}
                    {events.length === 0 && (
                        <tr>
                            <td colSpan={4} style={{ color: T.text2 }}>
                                No audit events.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </Card>
    );
}

function JobsSection(ctx) {
    const all = Array.isArray(ctx.jobs?.allJobs) ? ctx.jobs.allJobs : [];
    return (
        <>
            <div className="ohx-g4" style={{ marginBottom: 20 }}>
                <div className="ohx-kpi">
                    <div className="ohx-kpi-label">Active</div>
                    <div className="ohx-kpi-val" style={{ color: T.warning }}>
                        {Array.isArray(ctx.jobs?.activeJobs) ? ctx.jobs.activeJobs.length : 0}
                    </div>
                </div>
                <div className="ohx-kpi">
                    <div className="ohx-kpi-label">Scheduled</div>
                    <div className="ohx-kpi-val">
                        {Array.isArray(ctx.jobs?.scheduledJobs) ? ctx.jobs.scheduledJobs.length : 0}
                    </div>
                </div>
                <div className="ohx-kpi">
                    <div className="ohx-kpi-label">Completed</div>
                    <div className="ohx-kpi-val" style={{ color: T.success }}>
                        {Array.isArray(ctx.jobs?.completedJobs) ? ctx.jobs.completedJobs.length : 0}
                    </div>
                </div>
                <div className="ohx-kpi">
                    <div className="ohx-kpi-label">Total</div>
                    <div className="ohx-kpi-val">{all.length}</div>
                </div>
            </div>
            <Card title="Jobs">
                <table className="ohx-tbl">
                    <thead>
                        <tr>
                            <th>Job</th>
                            <th>Status</th>
                            <th>Last Run</th>
                            <th>Duration</th>
                            <th>Success Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        {all.slice(0, 30).map((j, i) => (
                            <tr key={j?.id ?? i}>
                                <td style={{ fontWeight: 600 }}>{String(j?.name ?? '')}</td>
                                <td>
                                    <Pill
                                        tone={
                                            j?.status === 'failed'
                                                ? 'critical'
                                                : j?.status === 'active'
                                                  ? 'warning'
                                                  : 'ok'
                                        }
                                    >
                                        {String(j?.status ?? '')}
                                    </Pill>
                                </td>
                                <td style={{ color: T.text2 }}>
                                    {j?.lastRun ? new Date(j.lastRun).toLocaleString() : '—'}
                                </td>
                                <td>{j?.duration != null ? `${j.duration}` : '—'}</td>
                                <td>{j?.successRate != null ? `${j.successRate}%` : '—'}</td>
                            </tr>
                        ))}
                        {all.length === 0 && (
                            <tr>
                                <td colSpan={5} style={{ color: T.text2 }}>
                                    No jobs.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </Card>
        </>
    );
}

function TracesSection(ctx) {
    const list = Array.isArray(ctx.traces?.traces) ? ctx.traces.traces : [];
    return (
        <Card title="API Tracing">
            <table className="ohx-tbl">
                <thead>
                    <tr>
                        <th>Trace ID</th>
                        <th>Endpoint</th>
                        <th>Duration</th>
                        <th>Status</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {list.slice(0, 30).map((t, i) => {
                        const tid = String(t?.traceId ?? t?.id ?? '');
                        const canCorrelate = /^[0-9a-f]{32}$/i.test(tid);
                        return (
                            <tr key={t?.id ?? t?.traceId ?? i}>
                                <td style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12 }}>
                                    {tid.slice(0, 16)}
                                </td>
                                <td>{String(t?.endpoint ?? t?.name ?? '')}</td>
                                <td>{t?.duration != null ? `${t.duration}ms` : '—'}</td>
                                <td>
                                    <Pill tone={t?.status >= 400 || t?.error ? 'critical' : 'ok'}>
                                        {String(t?.status ?? 'ok')}
                                    </Pill>
                                </td>
                                <td>
                                    {canCorrelate && (
                                        <button
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: T.primary,
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                                fontSize: 12,
                                            }}
                                            title="Correlate this trace with the SQL each span ran"
                                            onClick={() =>
                                                window.dispatchEvent(
                                                    new CustomEvent('pulsedb:navigate-tab', {
                                                        detail: {
                                                            tab: 'trace-correlation',
                                                            payload: { traceId: tid.toLowerCase() },
                                                        },
                                                    }),
                                                )
                                            }
                                        >
                                            Correlate →
                                        </button>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                    {list.length === 0 && (
                        <tr>
                            <td colSpan={5} style={{ color: T.text2 }}>
                                No traces in range.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </Card>
    );
}

// ════════════════════════════════════════════════════════════════════════
// DISPATCH
// ════════════════════════════════════════════════════════════════════════
export function renderSection(section, ctx) {
    switch (section) {
        case 'api':
            return ApiSection(ctx);
        case 'exceptions':
            return ExceptionsSection(ctx);
        case 'uptime':
            return UptimeSection(ctx);
        case 'audit':
            return AuditSection(ctx);
        case 'jobs':
            return JobsSection(ctx);
        case 'traces':
            return TracesSection(ctx);
        case 'slo':
            return SloSection();
        case 'alerts':
            return AlertsSection();
        case 'logs':
            return LogsSection();
        case 'infra':
            return InfraSection();
        case 'topology':
            return TopologySection();
        case 'ai':
            return AiSection();
        case 'cost':
            return CostSection();
        default:
            return null;
    }
}
