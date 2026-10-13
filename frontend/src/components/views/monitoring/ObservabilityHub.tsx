// ==========================================================================
//  FATHOM — ObservabilityHub (Unified Monitoring Dashboard) — v3.2.1 layout
//  Ported from observability_enterprise_v2 mockup, themed with THEME tokens.
// ==========================================================================
import React, { useState, useEffect, useMemo } from 'react';
import { THEME } from '../../../utils/theme';
import { fetchData } from '../../../utils/api';
import { renderSection, sectionStyles } from './ObservabilityHubSections';
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
    ComposedChart,
} from 'recharts';
import {
    Activity,
    AlertTriangle,
    Clock,
    Globe,
    Shield,
    Workflow,
    Cpu,
    Gauge,
    RefreshCw,
    DownloadCloud,
    Search,
    FileText,
    Server,
    GitBranch,
    Zap,
    DollarSign,
    Bell,
    Target,
    Menu,
    CheckCircle,
    ChevronRight,
} from 'lucide-react';

// ═════════════════════════════════════════════════════════════════════════
// THEME TOKENS
// ═════════════════════════════════════════════════════════════════════════
const T = {
    get bg() {
        return THEME.bg;
    },
    get bgAlt() {
        return THEME.bgAlt;
    },
    get surface() {
        return THEME.surface;
    },
    get surfaceHover() {
        return THEME.surfaceHover;
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

// ═════════════════════════════════════════════════════════════════════════
// NAV MODEL (mirrors the mockup sidebar)
// ═════════════════════════════════════════════════════════════════════════
const NAV_GROUPS = [
    {
        group: 'Monitor',
        items: [
            { id: 'overview', label: 'Overview', icon: Gauge },
            { id: 'api', label: 'API Monitoring', icon: Cpu },
            { id: 'exceptions', label: 'Exceptions', icon: AlertTriangle, badgeKey: 'exceptions', badgeTone: 'danger' },
            { id: 'uptime', label: 'Uptime', icon: Globe },
        ],
    },
    {
        group: 'Govern',
        items: [
            { id: 'audit', label: 'Audit Log', icon: Shield },
            { id: 'jobs', label: 'Job Monitor', icon: Workflow, badgeKey: 'jobsFailed', badgeTone: 'warning' },
        ],
    },
    {
        group: 'Reliability',
        items: [
            { id: 'slo', label: 'SLO / Error Budget', icon: Target },
            { id: 'alerts', label: 'Alerts', icon: Bell, badge: 4, badgeTone: 'danger' },
        ],
    },
    {
        group: 'Observe',
        items: [
            { id: 'logs', label: 'Log Explorer', icon: FileText },
            { id: 'infra', label: 'Infrastructure', icon: Server },
            { id: 'topology', label: 'Service Map', icon: GitBranch },
            { id: 'ai', label: 'AI Anomalies', icon: Zap, badge: 3, badgeTone: 'warning' },
            { id: 'cost', label: 'Cost & Budget', icon: DollarSign },
        ],
    },
    {
        group: 'Debug',
        items: [{ id: 'traces', label: 'API Tracing', icon: Activity, badge: 'NEW', badgeTone: 'new' }],
    },
];

const SECTION_TITLE = {
    overview: 'Overview',
    api: 'API Monitoring',
    exceptions: 'Exceptions',
    uptime: 'Uptime',
    audit: 'Audit Log',
    jobs: 'Job Monitor',
    slo: 'SLO / Error Budget',
    alerts: 'Alerts',
    logs: 'Log Explorer',
    infra: 'Infrastructure',
    topology: 'Service Map',
    ai: 'AI Anomalies',
    cost: 'Cost & Budget',
    traces: 'API Tracing',
};

// Section order for the combined 'all' view (Overview is rendered separately first)
const ALL_SECTION_IDS = [
    'api',
    'exceptions',
    'uptime',
    'audit',
    'jobs',
    'slo',
    'alerts',
    'logs',
    'infra',
    'topology',
    'ai',
    'cost',
    'traces',
];

// ═════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════
const Styles = () => (
    <style>{`
        @keyframes oh-fade { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
        @keyframes oh-spin-kf { to { transform:rotate(360deg); } }
        .oh-spin { animation:oh-spin-kf .8s linear infinite; }
        .ohx { display:flex; min-height:100%; background:${T.bg}; color:${T.text1}; border-radius:18px; overflow:hidden; }
        .ohx-side { width:230px; flex-shrink:0; background:${T.bgAlt}; border-right:1px solid ${T.border}; padding:16px 12px; display:flex; flex-direction:column; gap:4px; }
        .ohx-side.collapsed { width:60px; }
        .ohx-brand { display:flex; align-items:center; gap:10px; padding:6px 8px 14px 8px; }
        .ohx-brand-badge { width:30px; height:30px; border-radius:9px; background:${T.primary}; display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0; }
        .ohx-brand-name { font-weight:700; font-size:15px; color:${T.text1}; }
        .ohx-navgroup { font-size:10px; letter-spacing:1px; text-transform:uppercase; color:${T.text3}; padding:14px 10px 6px; }
        .ohx-navitem { display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:9px; cursor:pointer; color:${T.text2}; font-size:13px; font-weight:500; transition:all .15s; border:none; background:transparent; width:100%; text-align:left; }
        .ohx-navitem:hover { background:${T.surfaceHover}; color:${T.text1}; }
        .ohx-navitem.active { background:${T.primary}1f; color:${T.primary}; font-weight:600; }
        .ohx-navlabel { flex:1; white-space:nowrap; overflow:hidden; }
        .ohx-side.collapsed .ohx-navlabel, .ohx-side.collapsed .ohx-navgroup, .ohx-side.collapsed .ohx-brand-name, .ohx-side.collapsed .ohx-badge { display:none; }
        .ohx-badge { font-size:10px; font-weight:700; padding:1px 7px; border-radius:20px; }
        .ohx-badge.danger { background:${T.danger}26; color:${T.danger}; }
        .ohx-badge.warning { background:${T.warning}26; color:${T.warning}; }
        .ohx-badge.new { background:${T.primary}26; color:${T.primary}; }
        .ohx-main { flex:1; min-width:0; display:flex; flex-direction:column; }
        .ohx-top { display:flex; align-items:center; justify-content:space-between; padding:14px 22px; border-bottom:1px solid ${T.border}; }
        .ohx-crumb { font-size:12px; color:${T.text3}; }
        .ohx-crumb b { color:${T.text1}; }
        .ohx-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 13px; border-radius:9px; border:1px solid ${T.border}; background:${T.surface}; color:${T.text2}; font-size:12px; font-weight:600; cursor:pointer; transition:all .15s; }
        .ohx-btn:hover { background:${T.surfaceHover}; color:${T.text1}; }
        .ohx-btn.primary { background:${T.primary}; border-color:${T.primary}; color:#fff; }
        .ohx-live { display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:700; color:${T.success}; padding:3px 10px; border-radius:20px; background:${T.success}1a; }
        .ohx-dot { width:7px; height:7px; border-radius:50%; background:${T.success}; }
        .ohx-body { padding:22px; flex:1; overflow:auto; animation:oh-fade .25s ease; }
        .ohx-h { display:flex; align-items:center; gap:10px; margin-bottom:4px; }
        .ohx-h1 { font-size:22px; font-weight:700; color:${T.text1}; }
        .ohx-sub { font-size:13px; color:${T.text2}; margin-bottom:20px; }
        .ohx-card { background:${T.surface}; border:1px solid ${T.border}; border-radius:16px; padding:22px; margin-bottom:20px; }
        .ohx-cardhead { display:flex; align-items:center; gap:9px; margin-bottom:18px; font-size:15px; font-weight:700; color:${T.text1}; }
        .ohx-g3 { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; }
        .ohx-g4 { display:grid; grid-template-columns:repeat(4,1fr); gap:18px; }
        .ohx-stat-label { font-size:12px; color:${T.primary}; font-weight:600; margin-bottom:6px; display:flex; align-items:center; gap:4px; }
        .ohx-stat-big { font-size:28px; font-weight:700; color:${T.text1}; }
        .ohx-stat-sub { font-size:12px; color:${T.text2}; word-break:break-all; }
        .ohx-meter { height:8px; border-radius:20px; background:${T.raised}; overflow:hidden; display:flex; margin:8px 0; }
        .ohx-meter > span { display:block; height:100%; }
        .ohx-legend { font-size:11px; color:${T.text2}; display:flex; gap:14px; flex-wrap:wrap; }
        .ohx-legend i { width:8px; height:8px; border-radius:50%; display:inline-block; margin-right:5px; }
        .ohx-row { display:flex; align-items:center; justify-content:space-between; padding:11px 0; border-bottom:1px solid ${T.border}; font-size:13px; }
        .ohx-row:last-child { border-bottom:none; }
        .ohx-snap { background:${T.raised}; border:1px solid ${T.border}; border-radius:14px; padding:18px; }
        .ohx-snap-label { font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:${T.text2}; display:flex; align-items:center; gap:6px; }
        .ohx-snap-val { font-size:26px; font-weight:700; margin:8px 0 4px; }
        .ohx-snap-link { font-size:12px; color:${T.primary}; cursor:pointer; }
        .ohx-placeholder { text-align:center; padding:60px 20px; color:${T.text2}; }
        @media (max-width:1100px){ .ohx-g3,.ohx-g4{ grid-template-columns:1fr 1fr; } }
        @media (max-width:680px){ .ohx-g3,.ohx-g4{ grid-template-columns:1fr; } .ohx-side{ display:none; } }
        ${sectionStyles}
    `}</style>
);

// ═════════════════════════════════════════════════════════════════════════
// SMALL HELPERS
// ═════════════════════════════════════════════════════════════════════════
const num = (v, fallback = 0) => (typeof v === 'number' && isFinite(v) ? v : fallback);
const fmt = (v) => (v == null ? '—' : Number(v).toLocaleString());
const pct = (v, d = 1) => (v == null ? '—' : `${Number(v).toFixed(d)}%`);
const len = (a) => (Array.isArray(a) ? a.length : 0);

// ═════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════
const ObservabilityHub = ({ initialSection = 'overview', hideSidebar = false } = {}) => {
    const [section, setSection] = useState(initialSection || 'overview');
    useEffect(() => {
        if (initialSection) setSection(initialSection);
    }, [initialSection]);
    const [collapsed, setCollapsed] = useState(false);
    const [apiMetrics, setApiMetrics] = useState(null);
    const [exceptions, setExceptions] = useState(null);
    const [uptime, setUptime] = useState(null);
    const [auditLog, setAuditLog] = useState(null);
    const [jobs, setJobs] = useState(null);
    const [traces, setTraces] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastSync, setLastSync] = useState(null);

    const loadData = async () => {
        setLoading(true);
        const results = await Promise.allSettled([
            fetchData('/api/observability/api-metrics'),
            fetchData('/api/observability/exceptions'),
            fetchData('/api/observability/uptime'),
            fetchData('/api/observability/audit-log'),
            fetchData('/api/observability/jobs'),
            fetchData('/api/traces?limit=50'),
        ]);
        const val = (r) => (r.status === 'fulfilled' ? r.value : null);
        if (val(results[0])) setApiMetrics(val(results[0]));
        if (val(results[1])) setExceptions(val(results[1]));
        if (val(results[2])) setUptime(val(results[2]));
        if (val(results[3])) setAuditLog(val(results[3]));
        if (val(results[4])) setJobs(val(results[4]));
        if (val(results[5])) setTraces(val(results[5]));
        setLastSync(new Date());
        setLoading(false);
    };

    useEffect(() => {
        loadData(); /* eslint-disable-next-line */
    }, []);

    // ── Derived badge counts (defensive) ──────────────────────────────────
    const badgeValues = useMemo(
        () => ({
            exceptions: len(exceptions?.recentExceptions) || exceptions?.total || 0,
            jobsFailed: len(jobs?.allJobs?.filter?.((j) => j?.status === 'failed')) || 0,
        }),
        [exceptions, jobs],
    );

    // ── Exceptions overview metrics ───────────────────────────────────────
    const exc = useMemo(() => {
        const recent = Array.isArray(exceptions?.recentExceptions) ? exceptions.recentExceptions : [];
        const recurring = Array.isArray(exceptions?.topRecurring) ? exceptions.topRecurring : [];
        const total = exceptions?.total ?? recent.length;
        const critical = recent.filter((e) => (e?.severity || e?.level) === 'critical').length;
        const mostCommon = recurring[0]?.message || recent[0]?.message || '—';
        const mostCritical =
            recent.find((e) => (e?.severity || e?.level) === 'critical')?.message || recent[0]?.message || '—';
        const resolved = recent.filter((e) => e?.resolved).length;
        const open = Math.max(total - resolved, 0);
        return {
            recent,
            total,
            critical,
            minor: Math.max(total - critical, 0),
            mostCommon,
            mostCritical,
            open,
            resolved,
        };
    }, [exceptions]);

    // ── API overview metrics ──────────────────────────────────────────────
    const api = useMemo(() => {
        const series = Array.isArray(apiMetrics?.timeSeriesData) ? apiMetrics.timeSeriesData : [];
        const slow = Array.isArray(apiMetrics?.topSlowestEndpoints) ? apiMetrics.topSlowestEndpoints : [];
        const codes = Array.isArray(apiMetrics?.statusCodeBreakdown) ? apiMetrics.statusCodeBreakdown : [];
        const total = apiMetrics?.totalRequests ?? codes.reduce((s, c) => s + num(c?.count), 0);
        const ok2xx = codes.filter((c) => c?.status >= 200 && c?.status < 300).reduce((s, c) => s + num(c?.count), 0);
        const errRate = num(apiMetrics?.errorRate);
        const failed =
            Math.round(total * (errRate / 100)) ||
            codes.filter((c) => c?.status >= 400).reduce((s, c) => s + num(c?.count), 0);
        const okPct = total ? Math.round((ok2xx / total) * 100) : 0;
        return {
            series,
            total,
            ok2xx,
            failed,
            success: Math.max(total - failed, 0),
            okPct,
            errPct: 100 - okPct,
            slowest: slow[0],
            avg: apiMetrics?.averageResponseTime,
        };
    }, [apiMetrics]);

    // ════════════════════════════════════════════════════════════════════
    // RENDER: OVERVIEW
    // ════════════════════════════════════════════════════════════════════
    const renderOverview = () => (
        <>
            {/* Exceptions card */}
            <div className="ohx-card">
                <div className="ohx-cardhead">
                    <AlertTriangle size={17} color={T.danger} /> Exceptions
                </div>
                <div className="ohx-g3">
                    <div>
                        <div className="ohx-stat-label">
                            Total Exceptions <ChevronRight size={12} />
                        </div>
                        <div className="ohx-stat-big">{fmt(exc.total)}</div>
                    </div>
                    <div>
                        <div className="ohx-stat-label">
                            Most Common <ChevronRight size={12} />
                        </div>
                        <div className="ohx-stat-sub" style={{ fontWeight: 600, color: T.text1 }}>
                            {exc.mostCommon}
                        </div>
                    </div>
                    <div>
                        <div className="ohx-stat-label">
                            Most Critical <ChevronRight size={12} />
                        </div>
                        <div className="ohx-stat-sub" style={{ fontWeight: 600, color: T.danger }}>
                            {exc.mostCritical}
                        </div>
                    </div>
                </div>

                <div className="ohx-g3" style={{ marginTop: 22, gridTemplateColumns: '1fr 1fr' }}>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Severity Distribution</div>
                        <div className="ohx-meter">
                            <span
                                style={{
                                    width: `${exc.total ? (exc.critical / exc.total) * 100 : 0}%`,
                                    background: T.danger,
                                }}
                            />
                            <span
                                style={{
                                    width: `${exc.total ? (exc.minor / exc.total) * 100 : 100}%`,
                                    background: T.raised,
                                }}
                            />
                        </div>
                        <div className="ohx-legend">
                            <span>
                                <i style={{ background: T.danger }} />
                                Critical ({exc.critical})
                            </span>
                            <span>
                                <i style={{ background: T.text3 }} />
                                Minor ({exc.minor})
                            </span>
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Resolution Status</div>
                        <div className="ohx-meter">
                            <span
                                style={{
                                    width: `${exc.total ? (exc.open / exc.total) * 100 : 0}%`,
                                    background: T.text3,
                                }}
                            />
                            <span
                                style={{
                                    width: `${exc.total ? (exc.resolved / exc.total) * 100 : 0}%`,
                                    background: T.success,
                                }}
                            />
                        </div>
                        <div className="ohx-legend">
                            <span>
                                <i style={{ background: T.text3 }} />
                                Open {exc.open}
                            </span>
                            <span style={{ color: T.success }}>
                                <i style={{ background: T.success }} />
                                Resolved {exc.resolved}
                            </span>
                        </div>
                    </div>
                </div>

                {exc.recent.length > 0 && (
                    <div style={{ marginTop: 22 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: T.text2 }}>
                            Recent Exceptions
                        </div>
                        {exc.recent.slice(0, 4).map((e, i) => (
                            <div className="ohx-row" key={e?.id ?? i}>
                                <span style={{ color: T.text1 }}>
                                    {String(e?.type || e?.message || 'Exception').slice(0, 60)}
                                </span>
                                <span style={{ color: T.text3, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    {e?.timestamp ? new Date(e.timestamp).toLocaleString() : ''}
                                    <ChevronRight size={13} />
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* API Monitoring card */}
            <div className="ohx-card">
                <div className="ohx-cardhead">
                    <Cpu size={17} color={T.primary} /> API Monitoring
                </div>
                <div className="ohx-g3">
                    <div>
                        <div className="ohx-stat-label">
                            Total <ChevronRight size={12} />
                        </div>
                        <div className="ohx-stat-big">{fmt(api.total)}</div>
                    </div>
                    <div>
                        <div className="ohx-stat-label" style={{ color: T.success }}>
                            Successful <ChevronRight size={12} />
                        </div>
                        <div className="ohx-stat-big" style={{ color: T.success }}>
                            {fmt(api.success)}
                        </div>
                    </div>
                    <div>
                        <div className="ohx-stat-label" style={{ color: T.danger }}>
                            Failed <ChevronRight size={12} />
                        </div>
                        <div className="ohx-stat-big" style={{ color: T.danger }}>
                            {fmt(api.failed)}
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: 22 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Response Status Distribution</div>
                    <div className="ohx-meter">
                        <span style={{ width: `${api.okPct}%`, background: T.success }} />
                        <span style={{ width: `${api.errPct}%`, background: T.danger }} />
                    </div>
                    <div className="ohx-legend">
                        <span style={{ color: T.success }}>
                            <i style={{ background: T.success }} />
                            {api.okPct}% 2xx
                        </span>
                        <span style={{ color: T.danger }}>
                            <i style={{ background: T.danger }} />
                            {api.errPct}% 4xx/5xx
                        </span>
                    </div>
                </div>

                {api.series.length > 0 && (
                    <div style={{ marginTop: 22 }}>
                        <ResponsiveContainer width="100%" height={200}>
                            <ComposedChart data={api.series}>
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
                                <Bar dataKey="requests" fill={T.primary} radius={[3, 3, 0, 0]} opacity={0.85} />
                                <Line type="monotone" dataKey="errors" stroke={T.danger} strokeWidth={2} dot={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Health Snapshot */}
            <div className="ohx-card">
                <div className="ohx-cardhead">
                    <CheckCircle size={17} color={T.success} /> Health Snapshot
                </div>
                <div className="ohx-g4">
                    <div className="ohx-snap">
                        <div className="ohx-snap-label">
                            <Globe size={13} /> Uptime (30d)
                        </div>
                        <div className="ohx-snap-val" style={{ color: T.success }}>
                            {pct(uptime?.uptimePercentage, 2)}
                        </div>
                        <div className="ohx-snap-link" onClick={() => setSection('uptime')}>
                            Uptime Monitor →
                        </div>
                    </div>
                    <div className="ohx-snap">
                        <div className="ohx-snap-label">
                            <Activity size={13} /> API Success
                        </div>
                        <div className="ohx-snap-val" style={{ color: api.okPct >= 90 ? T.success : T.warning }}>
                            {api.okPct}%
                        </div>
                        <div className="ohx-snap-link" onClick={() => setSection('api')}>
                            API Monitoring →
                        </div>
                    </div>
                    <div className="ohx-snap">
                        <div className="ohx-snap-label">
                            <Shield size={13} /> Audit Events
                        </div>
                        <div className="ohx-snap-val" style={{ color: T.text1 }}>
                            {fmt(auditLog?.total ?? len(auditLog?.events))}
                        </div>
                        <div className="ohx-snap-link" onClick={() => setSection('audit')}>
                            Audit Log →
                        </div>
                    </div>
                    <div className="ohx-snap">
                        <div className="ohx-snap-label">
                            <Workflow size={13} /> Jobs Failed
                        </div>
                        <div
                            className="ohx-snap-val"
                            style={{ color: badgeValues.jobsFailed > 0 ? T.danger : T.success }}
                        >
                            {badgeValues.jobsFailed}
                        </div>
                        <div className="ohx-snap-link" onClick={() => setSection('jobs')}>
                            Job Monitor →
                        </div>
                    </div>
                </div>
            </div>
        </>
    );

    // ════════════════════════════════════════════════════════════════════
    // RENDER: generic section placeholder (sections without a full port yet)
    // ════════════════════════════════════════════════════════════════════
    const renderPlaceholder = (label) => (
        <div className="ohx-card">
            <div className="ohx-placeholder">
                <Search size={28} color={T.text3} style={{ marginBottom: 10 }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: T.text1 }}>{label}</div>
                <div style={{ marginTop: 6, fontSize: 13 }}>
                    This section is part of the v3.2.1 layout and is being wired up. Data and detail views are coming
                    next.
                </div>
            </div>
        </div>
    );

    const badgeFor = (item) => {
        if (item.badge !== undefined) return item.badge;
        if (item.badgeKey) return badgeValues[item.badgeKey] || 0;
        return null;
    };

    // ════════════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════════════
    return (
        <div className="ohx">
            <Styles />

            {/* Sidebar */}
            {!hideSidebar && (
                <aside className={`ohx-side ${collapsed ? 'collapsed' : ''}`}>
                    <div className="ohx-brand">
                        <div className="ohx-brand-badge">
                            <Activity size={17} />
                        </div>
                        <div className="ohx-brand-name">Observability</div>
                        <button
                            className="ohx-navitem"
                            style={{ width: 'auto', padding: 6, marginLeft: 'auto' }}
                            onClick={() => setCollapsed((c) => !c)}
                            title="Toggle sidebar"
                        >
                            <Menu size={16} />
                        </button>
                    </div>
                    {NAV_GROUPS.map((g) => (
                        <div key={g.group}>
                            <div className="ohx-navgroup">{g.group}</div>
                            {g.items.map((item) => {
                                const Icon = item.icon;
                                const badge = badgeFor(item);
                                return (
                                    <button
                                        key={item.id}
                                        className={`ohx-navitem ${section === item.id ? 'active' : ''}`}
                                        onClick={() => setSection(item.id)}
                                    >
                                        <Icon size={16} />
                                        <span className="ohx-navlabel">{item.label}</span>
                                        {badge != null && badge !== 0 && (
                                            <span className={`ohx-badge ${item.badgeTone || 'new'}`}>{badge}</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </aside>
            )}

            {/* Main */}
            <div className="ohx-main">
                {/* Top bar */}
                <div className="ohx-top">
                    <div className="ohx-crumb">
                        Platform / Observability /{' '}
                        <b>{section === 'all' ? 'Observability Hub' : SECTION_TITLE[section] || 'Overview'}</b>
                    </div>
                    <div className="ohx-topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="ohx-live">
                            <span className="ohx-dot" /> LIVE
                        </span>
                        <span style={{ fontSize: 11, color: T.text3 }}>
                            {lastSync ? `Last sync ${lastSync.toLocaleTimeString()}` : 'Syncing…'}
                        </span>
                        <button className="ohx-btn" onClick={loadData} disabled={loading}>
                            <RefreshCw size={13} className={loading ? 'oh-spin' : ''} /> Refresh
                        </button>
                        <button className="ohx-btn primary">
                            <DownloadCloud size={13} /> Export
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="ohx-body">
                    <div className="ohx-h">
                        {(() => {
                            const Icon =
                                NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === section)?.icon || Gauge;
                            return <Icon size={22} color={T.primary} />;
                        })()}
                        <div className="ohx-h1">
                            {section === 'all' ? 'Observability Hub' : SECTION_TITLE[section] || 'Overview'}
                        </div>
                    </div>
                    <div className="ohx-sub">
                        {section === 'overview' || section === 'all'
                            ? 'Unified monitoring for API performance, exceptions, uptime, audit logs, and job execution'
                            : `FATHOM observability — ${SECTION_TITLE[section] || ''}`}
                    </div>

                    {section === 'all' ? (
                        <>
                            <div className="ohx-cardhead" style={{ fontSize: 17, marginTop: 4 }}>
                                <Gauge size={18} color={T.primary} /> Overview
                            </div>
                            {renderOverview()}
                            {ALL_SECTION_IDS.map((sid) => (
                                <div key={sid}>
                                    <div className="ohx-cardhead" style={{ fontSize: 17, marginTop: 26 }}>
                                        {(() => {
                                            const Ic =
                                                NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === sid)?.icon ||
                                                Gauge;
                                            return <Ic size={18} color={T.primary} />;
                                        })()}
                                        {SECTION_TITLE[sid] || sid}
                                    </div>
                                    {renderSection(sid, {
                                        apiMetrics,
                                        exceptions,
                                        uptime,
                                        auditLog,
                                        jobs,
                                        traces,
                                        setSection,
                                    }) || renderPlaceholder(SECTION_TITLE[sid] || 'Section')}
                                </div>
                            ))}
                        </>
                    ) : section === 'overview' ? (
                        renderOverview()
                    ) : (
                        renderSection(section, {
                            apiMetrics,
                            exceptions,
                            uptime,
                            auditLog,
                            jobs,
                            traces,
                            setSection,
                        }) || renderPlaceholder(SECTION_TITLE[section] || 'Section')
                    )}
                </div>
            </div>
        </div>
    );
};

export default ObservabilityHub;
