import React, { useState, useEffect, useCallback, useRef } from 'react';
import PlanRegressionPanel from './PlanRegressionPanel';
import { THEME, useAdaptiveTheme, useGlobalRefresh, metricValue } from '../../../utils/theme';
import { fetchData, postData, deleteData } from '../../../utils/api';
import {
    TrendingUp,
    RefreshCw,
    AlertTriangle,
    CheckCircle,
    Play,
    Trash2,
    Database,
    Clock,
    AlertCircle,
    PlusCircle,
    GitCompare,
    BookOpen,
    Zap,
    Activity,
    BarChart2,
    Tag,
    Bell,
    BellOff,
    Settings,
    ChevronDown,
    ChevronUp,
    Info,
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
    ResponsiveContainer,
    Area,
    AreaChart,
    Legend,
    ComposedChart,
    Bar,
} from 'recharts';
import { getLatestPlan, subscribeLatestPlan } from './queryPlanStore';

/* ─── Styles ──────────────────────────────────────────────────────────────── */
const Styles = () => (
    <style>{`
        @keyframes qrSpin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes qrFade  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes qrPulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes qrSlide { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
        .qr-card        { background:${THEME.surface}; border:1px solid ${THEME.grid}; border-radius: 20px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04); backdrop-filter:blur(12px); transition:all 0.25s ease; animation:qrFade .3s ease; }
        .qr-card:hover  { box-shadow:0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08); transform:translateY(-4px); }
        .qr-card-header { height:28px; background:${THEME.textMain}06; display:flex; align-items:center; padding:14px 20px; gap:6px; border-bottom:1px solid ${THEME.glassBorder}; font-weight:700; }
        .qr-card-dot    { width:8px; height:8px; border-radius:50%; }
        .qr-card-title  { font-family:'JetBrains Mono','Fira Code',monospace; font-size:11px; color:${THEME.textMuted}; margin-left:8px; letter-spacing:0.03em; }
        .qr-card-body   { padding:20px 24px; box-shadow:inset 0 1px 3px rgba(0,0,0,0.05); }
        .qr-card.legacy { padding:20px; }
        .qr-metric      { background:${THEME.surface}; border:1px solid ${THEME.grid}; border-radius: 20px; padding:18px 24px; display:flex; align-items:center; gap: 22px; }
        .qr-badge       { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius: 20px; font-size:11px; font-weight:700; }
        .qr-textarea    { width:100%; background:${THEME.bg}90; border:1px solid ${THEME.grid}; color:${THEME.textMain}; border-radius: 20px; padding:14px 16px; font-family:${THEME.fontMono}; font-size:12px; outline:none; resize:vertical; line-height:1.6; box-sizing:border-box; }
        .qr-textarea:focus { border-color:${THEME.primary}60; }
        .qr-btn         { display:inline-flex; align-items:center; gap:6px; padding:10px 18px; border-radius: 20px; font-size:13px; font-weight:600; cursor:pointer; transition:all .15s; border:none; }
        .qr-btn:hover   { filter:brightness(1.1); }
        .qr-btn:disabled{ opacity:.45; cursor:not-allowed; filter:none; }
        .qr-baseline-row { padding:14px 16px; border-bottom:1px solid ${THEME.grid}20; display:flex; align-items:center; gap: 18px; font-size:12px; transition:background .15s; }
        .qr-baseline-row:last-child { border-bottom:none; }
        .qr-baseline-row:hover { background:${THEME.primary}05; }
        .qr-plan-box    { background:${THEME.bg}; border:1px solid ${THEME.grid}; border-radius: 20px; padding:16px 18px; font-family:${THEME.fontMono}; font-size:11px; color:${THEME.textMuted}; white-space:pre-wrap; overflow-x:auto; max-height:320px; overflow-y:auto; line-height:1.7; }
        .qr-tab-btn     { display:flex; align-items:center; gap:7px; padding:10px 18px; border-radius: 20px; font-size:13px; font-weight:600; cursor:pointer; transition:all .15s; }
        .qr-tab-btn.active { border-color:${THEME.primary}!important; background:${THEME.primary}12!important; color:${THEME.primary}!important; }
        .qr-watcher-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .qr-watcher-dot.active { background:${THEME.success}; animation:qrPulse 1.5s ease-in-out infinite; box-shadow:0 0 6px ${THEME.success}; }
        .qr-watcher-dot.inactive { background:${THEME.textDim}; }
        .qr-deploy-label { font-size:10px; font-weight:700; fill:${THEME.warning}; }
        .qr-input { background:${THEME.bg}; border:1px solid ${THEME.grid}; color:${THEME.textMain}; border-radius: 22px; padding:10px 14px; font-size:13px; outline:none; width:100%; box-sizing:border-box; }
        .qr-input:focus { border-color:${THEME.primary}60; }
        .qr-select { background:${THEME.bg}; border:1px solid ${THEME.grid}; color:${THEME.textMain}; border-radius: 22px; padding:10px 14px; font-size:13px; outline:none; cursor:pointer; }
        .qr-section-label { font-size:11px; font-weight:700; color:${THEME.textMuted}; text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px; display:block; }
    `}</style>
);

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString());
const fmtMs = (ms) => {
    const m = Number(ms) || 0;
    if (m < 1000) return `${m.toFixed(1)}ms`;
    return `${(m / 1000).toFixed(2)}s`;
};
const fmtDate = (d) => (d ? new Date(d).toLocaleString() : '—');
const fmtRel = (d) => {
    if (!d) return '';
    const s = Math.floor((Date.now() - new Date(d)) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
};
const fmtShortDate = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    return `${dt.getMonth() + 1}/${dt.getDate()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}`;
};

/* ─── Sub-components ──────────────────────────────────────────────────────── */
const StatusBadge = ({ status, change }) => {
    if (status === 'regression')
        return (
            <span
                className="qr-badge"
                style={{ background: `${THEME.danger}15`, color: THEME.danger, border: `1px solid ${THEME.danger}30` }}
            >
                <AlertTriangle size={10} /> Regression +{change}%
            </span>
        );
    if (status === 'ok')
        return (
            <span
                className="qr-badge"
                style={{
                    background: `${THEME.success}15`,
                    color: THEME.success,
                    border: `1px solid ${THEME.success}30`,
                }}
            >
                <CheckCircle size={10} /> OK {change > 0 ? `+${change}%` : change < 0 ? `${change}%` : ''}
            </span>
        );
    if (status === 'no_baseline')
        return (
            <span
                className="qr-badge"
                style={{
                    background: `${THEME.primary}15`,
                    color: THEME.primary,
                    border: `1px solid ${THEME.primary}30`,
                }}
            >
                <BookOpen size={10} /> No Baseline
            </span>
        );
    return null;
};

const PlanTree = ({ plan, title, accent }) => {
    if (!plan) return null;
    const node = plan['Plan'] || plan;
    const renderNode = (n, depth = 0) => {
        if (!n) return null;
        const type = n['Node Type'] || 'Unknown';
        const cost = n['Total Cost']?.toFixed(2);
        const rows = n['Plan Rows'];
        const rel = n['Relation Name'] || n['Alias'] || '';
        const children = n['Plans'] || [];
        return (
            <div
                key={`${depth}-${type}`}
                style={{
                    paddingLeft: depth > 0 ? 14 : 0,
                    borderLeft: depth > 0 ? `1px solid ${accent}30` : undefined,
                    marginLeft: depth > 0 ? 6 : 0,
                }}
            >
                <div style={{ color: accent, fontWeight: 700, fontSize: 11 }}>
                    {type}
                    {rel ? ` → ${rel}` : ''}
                </div>
                <div style={{ color: THEME.textDim, fontSize: 10, marginBottom: 4 }}>
                    cost={cost} rows={fmt(rows)}
                </div>
                {children.map((c, i) => renderNode(c, depth + 1))}
            </div>
        );
    };
    return (
        <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: accent, marginBottom: 8, letterSpacing: 0.5 }}>
                {title}
            </div>
            <div
                style={{
                    background: THEME.bg,
                    border: `1px solid ${THEME.glassBorder}`,
                    borderRadius: 20,
                    padding: 12,
                    maxHeight: 280,
                    overflowY: 'auto',
                }}
            >
                {renderNode(node)}
            </div>
        </div>
    );
};

/* ─── Deployment Marker Tooltip ───────────────────────────────────────────── */
const DeployTooltip = ({ x, y, payload, deployEvents }) => {
    if (!payload?.length) return null;
    const ts = payload[0]?.payload?.ts;
    const deploy = deployEvents?.find((d) => Math.abs(new Date(d.ts) - new Date(ts)) < 60000 * 30);
    return (
        <div
            style={{
                background: THEME.surface,
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: 20,
                padding: '22px 28px',
                fontSize: 12,
            }}
        >
            <div style={{ color: THEME.textMain, fontWeight: 700 }}>{fmtShortDate(ts)}</div>
            {payload.map((p) => (
                <div key={p.dataKey} style={{ color: p.color, marginTop: 4 }}>
                    {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</strong>
                </div>
            ))}
            {deploy && (
                <div
                    style={{
                        marginTop: 6,
                        padding: '4px 8px',
                        background: `${THEME.warning}15`,
                        border: `1px solid ${THEME.warning}30`,
                        borderRadius: 16,
                        color: THEME.warning,
                        fontSize: 11,
                        fontWeight: 700,
                    }}
                >
                    🚀 Deploy: {deploy.version || deploy.label}
                </div>
            )}
        </div>
    );
};

/* ─── Regression Timeline Chart ───────────────────────────────────────────── */
const RegressionTimeline = ({ history, deployEvents, regressionThreshold }) => {
    if (!history?.length)
        return (
            <div style={{ padding: 40, textAlign: 'center', color: THEME.textDim }}>
                <Activity size={36} style={{ opacity: 0.2, display: 'block', margin: '0 auto 12px' }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textMuted }}>No history yet</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Run comparisons to populate the regression timeline.</div>
            </div>
        );

    const data = history.map((h) => ({
        ts: h.ts,
        label: fmtShortDate(h.ts),
        baselineCost: h.baselineCost,
        currentCost: h.currentCost,
        change: h.costChange,
        regression: h.regression,
    }));

    // Identify deploy event X-positions
    const deployXLabels = (deployEvents || []).map((d) => fmtShortDate(d.ts));

    return (
        <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="baselineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={THEME.success} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={THEME.success} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="currentGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={THEME.primary} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={THEME.primary} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}50`} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: THEME.textDim }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: THEME.textDim }} tickLine={false} axisLine={false} />
                <Tooltip content={<DeployTooltip deployEvents={deployEvents} />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />

                {/* Deploy event vertical markers */}
                {deployXLabels.map((lbl, i) => (
                    <ReferenceLine
                        key={`deploy-${i}`}
                        x={lbl}
                        stroke={THEME.warning}
                        strokeDasharray="4 2"
                        strokeWidth={1.5}
                        label={{ value: '🚀', position: 'top', fontSize: 10 }}
                    />
                ))}

                {/* Regression threshold reference line */}
                {regressionThreshold && (
                    <ReferenceLine
                        y={regressionThreshold}
                        stroke={THEME.danger}
                        strokeDasharray="3 3"
                        strokeWidth={1}
                        label={{
                            value: `+${regressionThreshold}% threshold`,
                            position: 'right',
                            fontSize: 9,
                            fill: THEME.danger,
                        }}
                    />
                )}

                <Area
                    type="monotone"
                    dataKey="baselineCost"
                    name="Baseline Cost"
                    stroke={THEME.success}
                    strokeWidth={1.5}
                    fill="url(#baselineGrad)"
                    dot={false}
                />
                <Area
                    type="monotone"
                    dataKey="currentCost"
                    name="Current Cost"
                    stroke={THEME.primary}
                    strokeWidth={2}
                    fill="url(#currentGrad)"
                    dot={(props) => {
                        const { cx, cy, payload } = props;
                        if (!payload.regression)
                            return <circle key={`dot-${cx}`} cx={cx} cy={cy} r={3} fill={THEME.primary} />;
                        return (
                            <circle
                                key={`dot-r-${cx}`}
                                cx={cx}
                                cy={cy}
                                r={5}
                                fill={THEME.danger}
                                stroke={THEME.surface}
                                strokeWidth={2}
                            />
                        );
                    }}
                />
            </ComposedChart>
        </ResponsiveContainer>
    );
};

/* ─── Generic vs Custom Plan Ratio Chart ──────────────────────────────────── */
const PlanRatioChart = ({ ratioHistory }) => {
    if (!ratioHistory?.length)
        return (
            <div style={{ padding: 32, textAlign: 'center', color: THEME.textDim }}>
                <BarChart2 size={32} style={{ opacity: 0.2, display: 'block', margin: '0 auto 10px' }} />
                <div style={{ fontSize: 12, color: THEME.textMuted }}>
                    No ratio data yet. Enable the watcher to track plan type switches.
                </div>
            </div>
        );

    return (
        <ResponsiveContainer width="100%" height={180}>
            <BarChart data={ratioHistory} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}50`} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: THEME.textDim }} tickLine={false} axisLine={false} />
                <YAxis
                    tick={{ fontSize: 10, fill: THEME.textDim }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}%`}
                    domain={[0, 100]}
                />
                <Tooltip
                    contentStyle={{
                        background: THEME.surface,
                        border: `1px solid ${THEME.glassBorder}`,
                        borderRadius: 20,
                        fontSize: 12,
                    }}
                    formatter={(v, name) => [`${v.toFixed(1)}%`, name]}
                />
                <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="customPct" name="Custom Plan %" stackId="a" fill={THEME.success} radius={0} />
                <Bar
                    dataKey="genericPct"
                    name="Generic Plan %"
                    stackId="a"
                    fill={THEME.warning}
                    radius={[4, 4, 0, 0]}
                />
            </BarChart>
        </ResponsiveContainer>
    );
};

/* ─── Main Component ──────────────────────────────────────────────────────── */
export default function QueryPlanRegressionTab() {
    useAdaptiveTheme();

    // Core state
    const [baselines, setBaselines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [label, setLabel] = useState('');
    const [capturing, setCapturing] = useState(false);
    const [comparing, setComparing] = useState(false);
    const [captureMsg, setCaptureMsg] = useState(null);
    const [compareResult, setCompareResult] = useState(null);
    const [error, setError] = useState(null);

    // New feature state
    const [history, setHistory] = useState([]); // [{ts, baselineCost, currentCost, costChange, regression, queryLabel}]
    const [deployEvents, setDeployEvents] = useState([]); // [{ts, version, label}]
    const [ratioHistory, setRatioHistory] = useState([]); // [{label, customPct, genericPct, ts}]
    const [watcherActive, setWatcherActive] = useState(false);
    const [watcherConfig, setWatcherConfig] = useState({
        intervalMin: 15,
        threshold: 20,
        alertChannel: 'In-App Only',
        autoRebaseline: false,
        trackPlanType: true,
    });
    const [watcherAlerts, setWatcherAlerts] = useState([]);
    const watcherTimer = useRef(null);

    // Cross-tool integration: pick up the last analyzed plan/query from the Query Optimizer
    // so the user can one-click compare it without re-pasting.
    const [seedRec, setSeedRec] = useState(() => getLatestPlan());
    useEffect(() => subscribeLatestPlan(setSeedRec), []);

    // Deploy-event "Add" inline form
    const [newDeployVer, setNewDeployVer] = useState('');

    // ── Load baselines ──────────────────────────────────────────────────────
    const loadBaselines = useCallback(async () => {
        try {
            const d = await fetchData('/api/regression/baselines');
            setBaselines(d || []);
        } catch (e) {
            console.warn('Could not load baselines', e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useGlobalRefresh(loadBaselines);
    useEffect(() => {
        loadBaselines();
    }, [loadBaselines]);

    // ── Auto-watcher tick ───────────────────────────────────────────────────
    const runWatcherCheck = useCallback(async () => {
        if (!baselines.length) return;
        const alerts = [];
        for (const b of baselines) {
            try {
                const r = await postData('/api/regression/compare', { query: b.queryPreview });
                if (r.regression) {
                    alerts.push({
                        ts: new Date().toISOString(),
                        label: b.label,
                        change: r.costChange,
                        fingerprint: b.fingerprint,
                    });
                }
            } catch (e) {
                /* skip */
            }
        }
        if (alerts.length) setWatcherAlerts((prev) => [...alerts, ...prev].slice(0, 20));
    }, [baselines]);

    useEffect(() => {
        if (watcherActive) {
            runWatcherCheck();
            watcherTimer.current = setInterval(runWatcherCheck, watcherConfig.intervalMin * 60 * 1000);
        } else {
            clearInterval(watcherTimer.current);
        }
        return () => clearInterval(watcherTimer.current);
    }, [watcherActive, watcherConfig.intervalMin, runWatcherCheck]);

    // ── Capture ─────────────────────────────────────────────────────────────
    const handleCapture = async () => {
        if (!query.trim()) return;
        setCapturing(true);
        setCaptureMsg(null);
        setError(null);
        try {
            const r = await postData('/api/regression/capture', {
                query: query.trim(),
                label: label.trim() || undefined,
            });
            setCaptureMsg({ ok: true, cost: r.cost, fp: r.fingerprint });
            await loadBaselines();

            if (watcherConfig.trackPlanType) {
                setRatioHistory((prev) => [
                    ...prev,
                    {
                        ts: new Date().toISOString(),
                        label: fmtShortDate(new Date()),
                        customPct: r.planType === 'custom' ? 100 : 0,
                        genericPct: r.planType === 'generic' ? 100 : 0,
                    },
                ]);
            }
        } catch (e) {
            setCaptureMsg({ ok: false, msg: e.message });
        } finally {
            setCapturing(false);
        }
    };

    // ── Compare ─────────────────────────────────────────────────────────────
    const handleCompare = async () => {
        if (!query.trim()) return;
        setComparing(true);
        setCompareResult(null);
        setError(null);
        try {
            const r = await postData('/api/regression/compare', { query: query.trim() });
            setCompareResult(r);

            if (r.status !== 'no_baseline') {
                const entry = {
                    ts: new Date().toISOString(),
                    baselineCost: r.baseline?.cost,
                    currentCost: r.current?.cost,
                    costChange: r.costChange,
                    regression: r.regression,
                    queryLabel: label || 'Query',
                };
                setHistory((prev) => [...prev, entry].slice(-60));

                if (watcherConfig.trackPlanType && r.current?.planType) {
                    setRatioHistory((prev) =>
                        [
                            ...prev,
                            {
                                ts: new Date().toISOString(),
                                label: fmtShortDate(new Date()),
                                customPct: r.current.planType === 'custom' ? 100 : 0,
                                genericPct: r.current.planType === 'generic' ? 100 : 0,
                            },
                        ].slice(-30),
                    );
                }
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setComparing(false);
        }
    };

    const handleDelete = async (fp) => {
        try {
            await deleteData(`/api/regression/baselines/${fp}`);
            setBaselines((prev) => prev.filter((b) => b.fingerprint !== fp));
        } catch (e) {
            console.warn('Delete failed', e.message);
        }
    };

    const addDeploy = () => {
        if (!newDeployVer.trim()) return;
        setDeployEvents((prev) => [
            ...prev,
            { ts: new Date().toISOString(), version: newDeployVer.trim(), label: `Deploy ${newDeployVer.trim()}` },
        ]);
        setNewDeployVer('');
    };

    const useSeed = () => {
        if (seedRec?.query) setQuery(seedRec.query);
    };

    const regressionCount = history.filter((h) => h.regression).length;
    const lastRegression = history.filter((h) => h.regression).slice(-1)[0];

    if (loading)
        return (
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 300,
                    color: THEME.textMuted,
                }}
            >
                <RefreshCw size={24} style={{ animation: 'qrSpin 1s linear infinite', marginRight: 10 }} /> Loading
                regression data…
            </div>
        );

    // Reusable Cell wrapper — matches the new Optimizer's notebook style.
    const Cell = ({ title, meta, icon: Icon, accent, action, pill, children, noPad = false }) => (
        <div className="qr-card" style={{ animation: 'qrFade .25s ease' }}>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 16px',
                    borderBottom: `1px solid ${THEME.glassBorder}`,
                }}
            >
                <span
                    style={{
                        width: 30,
                        height: 30,
                        borderRadius: 9,
                        background: `${accent || THEME.primary}18`,
                        color: accent || THEME.primary,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}
                >
                    {Icon && <Icon size={14} />}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: THEME.textMain, lineHeight: 1.2 }}>
                        {title}
                    </div>
                    {meta && <div style={{ fontSize: 11.5, color: THEME.textDim, marginTop: 2 }}>{meta}</div>}
                </div>
                {pill}
                {action}
            </div>
            <div style={{ padding: noPad ? 0 : 16 }}>{children}</div>
        </div>
    );

    return (
        <div
            style={{
                minHeight: '100%',
                background: THEME.bg,
                color: THEME.textMain,
                margin: '-32px',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <Styles />

            {/* HERO BAND */}
            <div
                style={{
                    borderBottom: `1px solid ${THEME.grid}`,
                    background: `radial-gradient(1200px 240px at 8% -20%, ${THEME.primary}14, transparent 60%), radial-gradient(900px 220px at 92% -30%, ${THEME.danger}10, transparent 60%), ${THEME.surface}`,
                    padding: '18px 28px 14px',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
                    <div
                        style={{
                            padding: 8,
                            borderRadius: 12,
                            background: `linear-gradient(135deg, ${THEME.primary}20, ${THEME.danger}12)`,
                            border: `1px solid ${THEME.primary}30`,
                        }}
                    >
                        <TrendingUp size={16} color={THEME.primary} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.15 }}>
                            Plan Regression
                        </div>
                        <div style={{ fontSize: 12, color: THEME.textMuted, marginTop: 2 }}>
                            Capture baselines · Detect drift · Watch silently across deploys
                        </div>
                    </div>
                    <div style={{ flex: 1 }} />
                    {watcherActive && (
                        <span
                            className="qr-badge"
                            style={{
                                background: `${THEME.success}15`,
                                color: THEME.success,
                                border: `1px solid ${THEME.success}30`,
                            }}
                        >
                            <span className="qr-watcher-dot active" /> Watcher · {watcherConfig.intervalMin}m
                        </span>
                    )}
                    {regressionCount > 0 && (
                        <span
                            className="qr-badge"
                            style={{
                                background: `${THEME.danger}15`,
                                color: THEME.danger,
                                border: `1px solid ${THEME.danger}30`,
                            }}
                        >
                            <AlertTriangle size={11} /> {regressionCount} regression{regressionCount !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            </div>

            <div style={{ padding: '16px 28px 0' }}>
                <PlanRegressionPanel />
            </div>

            {/* KPI STRIP */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 12,
                    padding: '14px 28px',
                    borderBottom: `1px solid ${THEME.grid}`,
                    background: THEME.surface,
                }}
            >
                {[
                    {
                        label: 'Stored Baselines',
                        value: baselines.length,
                        sub: baselines.length
                            ? `across ${new Set(baselines.map((b) => b.fingerprint?.slice(0, 8))).size} queries`
                            : 'none yet',
                        icon: BookOpen,
                        color: THEME.primary,
                    },
                    {
                        label: 'History Points',
                        value: history.length,
                        sub: history.length ? 'comparison data' : '—',
                        icon: Activity,
                        color: THEME.secondary || THEME.primary,
                    },
                    {
                        label: 'Regressions',
                        value: regressionCount,
                        sub: lastRegression ? `last: ${fmtRel(lastRegression.ts)}` : 'none',
                        icon: AlertTriangle,
                        color: regressionCount ? THEME.danger : THEME.textDim,
                    },
                    {
                        label: 'Deploy Markers',
                        value: deployEvents.length,
                        sub: deployEvents[0]?.version
                            ? `latest: ${deployEvents[deployEvents.length - 1]?.version}`
                            : 'no deploys',
                        icon: Tag,
                        color: THEME.warning,
                    },
                ].map((k, i) => (
                    <div
                        key={i}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '12px 14px',
                            borderRadius: 12,
                            border: `1px solid ${THEME.glassBorder}`,
                            background: THEME.surface,
                        }}
                    >
                        <span
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 9,
                                background: `${k.color}18`,
                                color: k.color,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <k.icon size={16} />
                        </span>
                        <div style={{ minWidth: 0 }}>
                            <div
                                style={{
                                    fontSize: 10.5,
                                    fontWeight: 600,
                                    color: THEME.textDim,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.06em',
                                }}
                            >
                                {k.label}
                            </div>
                            <div
                                style={{
                                    fontSize: 20,
                                    fontWeight: 700,
                                    color: THEME.textMain,
                                    fontVariantNumeric: 'tabular-nums',
                                    lineHeight: 1.1,
                                }}
                            >
                                {k.value}
                            </div>
                            <div style={{ fontSize: 10.5, color: THEME.textDim, marginTop: 1 }}>{k.sub}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* QUICK CHIPS */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '14px 28px 6px' }}>
                {[
                    {
                        label: 'Compare vs baseline',
                        icon: Play,
                        kbd: '⌘ ↵',
                        primary: true,
                        onClick: handleCompare,
                        disabled: !query.trim() || comparing,
                    },
                    {
                        label: 'Capture as baseline',
                        icon: PlusCircle,
                        onClick: handleCapture,
                        disabled: !query.trim() || capturing,
                    },
                    seedRec?.query
                        ? { label: 'Use last query from Optimizer', icon: GitCompare, onClick: useSeed }
                        : null,
                    { label: 'Run watcher now', icon: Zap, onClick: runWatcherCheck, disabled: !baselines.length },
                    {
                        label: watcherActive ? 'Stop watcher' : 'Start watcher',
                        icon: watcherActive ? BellOff : Bell,
                        onClick: () => setWatcherActive((v) => !v),
                    },
                ]
                    .filter(Boolean)
                    .map((c, i) => (
                        <button
                            key={i}
                            onClick={c.onClick}
                            disabled={c.disabled}
                            style={{
                                border: c.primary ? '1px solid transparent' : `1px solid ${THEME.grid}`,
                                background: c.primary
                                    ? `linear-gradient(135deg, ${THEME.primary}, ${THEME.secondary || THEME.primary})`
                                    : THEME.surface,
                                color: c.primary ? '#fff' : THEME.textMuted,
                                borderRadius: 999,
                                padding: '6px 12px',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: c.disabled ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                opacity: c.disabled ? 0.5 : 1,
                                boxShadow: c.primary ? `0 4px 10px ${THEME.primary}30` : 'none',
                            }}
                        >
                            <c.icon size={12} /> {c.label}
                            {c.kbd && (
                                <span
                                    style={{
                                        marginLeft: 4,
                                        fontFamily: 'JetBrains Mono, monospace',
                                        fontSize: 10,
                                        color: c.primary ? 'rgba(255,255,255,0.7)' : THEME.textDim,
                                    }}
                                >
                                    {c.kbd}
                                </span>
                            )}
                        </button>
                    ))}
            </div>

            {/* WATCHER ALERT STRIP (top-of-fold notification) */}
            {watcherAlerts.length > 0 && (
                <div
                    style={{
                        margin: '6px 28px 0',
                        padding: '12px 16px',
                        background: `${THEME.danger}10`,
                        border: `1px solid ${THEME.danger}30`,
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                    }}
                >
                    <Bell size={15} color={THEME.danger} />
                    <div style={{ flex: 1, fontSize: 12.5, color: THEME.danger, fontWeight: 600 }}>
                        Watcher alert: <strong>{watcherAlerts[0].label}</strong> regressed by{' '}
                        <strong>+{watcherAlerts[0].change}%</strong>
                        {watcherAlerts.length > 1 && (
                            <span style={{ opacity: 0.7, fontWeight: 500 }}>
                                {' '}
                                · and {watcherAlerts.length - 1} more
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => setWatcherAlerts([])}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: THEME.danger,
                            fontSize: 11.5,
                            fontWeight: 600,
                        }}
                    >
                        Dismiss all
                    </button>
                </div>
            )}

            {/* WORKSPACE */}
            <div
                style={{
                    padding: '14px 28px 60px',
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) 320px',
                    gap: 22,
                    alignItems: 'start',
                }}
            >
                {/* LEFT — notebook cells */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
                    {/* Capture / Compare cell */}
                    <Cell
                        title="Compare & Capture"
                        meta="Snapshot a plan, or compare it against a stored baseline"
                        icon={GitCompare}
                    >
                        {/* Seed banner if Optimizer has a recent plan */}
                        {seedRec?.query && seedRec.query !== query && (
                            <div
                                style={{
                                    marginBottom: 12,
                                    padding: '10px 12px',
                                    background: `${THEME.primary}10`,
                                    border: `1px solid ${THEME.primary}30`,
                                    borderRadius: 10,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    fontSize: 12,
                                }}
                            >
                                <GitCompare size={14} color={THEME.primary} style={{ flexShrink: 0 }} />
                                <span>
                                    Last analyzed in <b>Query Optimizer</b> ·{' '}
                                    {fmtRel(new Date(seedRec.analyzedAt).toISOString())}
                                </span>
                                <span
                                    style={{
                                        flex: 1,
                                        color: THEME.textMuted,
                                        fontFamily: THEME.fontMono,
                                        fontSize: 11,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        minWidth: 0,
                                    }}
                                >
                                    {seedRec.query.length > 60 ? seedRec.query.slice(0, 57) + '…' : seedRec.query}
                                </span>
                                <button
                                    onClick={useSeed}
                                    style={{
                                        color: THEME.primary,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        fontSize: 11.5,
                                        background: 'none',
                                        border: 'none',
                                        flexShrink: 0,
                                    }}
                                >
                                    Use it →
                                </button>
                            </div>
                        )}

                        <label className="qr-section-label">SQL query</label>
                        <textarea
                            className="qr-textarea"
                            rows={6}
                            placeholder="SELECT * FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.created_at > NOW() - INTERVAL '30 days';"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />

                        <label className="qr-section-label" style={{ marginTop: 12 }}>
                            Label (optional)
                        </label>
                        <input
                            className="qr-input"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder="e.g. Orders last 30 days — before index"
                        />

                        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                            <button
                                className="qr-btn"
                                onClick={handleCapture}
                                disabled={!query.trim() || capturing}
                                style={{
                                    background: `${THEME.success}12`,
                                    color: THEME.success,
                                    border: `1px solid ${THEME.success}30`,
                                }}
                            >
                                {capturing ? (
                                    <RefreshCw size={13} style={{ animation: 'qrSpin 1s linear infinite' }} />
                                ) : (
                                    <PlusCircle size={13} />
                                )}
                                {capturing ? 'Capturing…' : 'Capture as baseline'}
                            </button>
                            <button
                                className="qr-btn"
                                onClick={handleCompare}
                                disabled={!query.trim() || comparing}
                                style={{
                                    background: `linear-gradient(135deg,${THEME.primary},${THEME.secondary || THEME.primary})`,
                                    color: '#fff',
                                }}
                            >
                                {comparing ? (
                                    <RefreshCw size={13} style={{ animation: 'qrSpin 1s linear infinite' }} />
                                ) : (
                                    <Play size={13} />
                                )}
                                {comparing ? 'Comparing…' : 'Compare vs baseline'}
                            </button>
                        </div>

                        {captureMsg && (
                            <div
                                style={{
                                    marginTop: 12,
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    background: captureMsg.ok ? `${THEME.success}10` : `${THEME.danger}10`,
                                    border: `1px solid ${captureMsg.ok ? THEME.success : THEME.danger}30`,
                                    color: captureMsg.ok ? THEME.success : THEME.danger,
                                    fontSize: 12,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                            >
                                {captureMsg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                {captureMsg.ok
                                    ? `Baseline captured — cost ${captureMsg.cost?.toFixed(2)} (fingerprint: ${captureMsg.fp?.slice(0, 12)}…)`
                                    : captureMsg.msg}
                            </div>
                        )}
                        {error && (
                            <div
                                style={{
                                    marginTop: 12,
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    background: `${THEME.danger}10`,
                                    border: `1px solid ${THEME.danger}30`,
                                    color: THEME.danger,
                                    fontSize: 12,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                            >
                                <AlertCircle size={14} /> {error}
                            </div>
                        )}
                    </Cell>

                    {/* Comparison result cell */}
                    {compareResult && (
                        <Cell
                            title="Comparison result"
                            meta={
                                compareResult.baseline ? `vs baseline from ${fmtRel(compareResult.baseline.ts)}` : '—'
                            }
                            icon={compareResult.regression ? AlertTriangle : CheckCircle}
                            accent={
                                compareResult.regression
                                    ? THEME.danger
                                    : compareResult.status === 'ok'
                                      ? THEME.success
                                      : THEME.primary
                            }
                            pill={<StatusBadge status={compareResult.status} change={compareResult.costChange} />}
                            noPad
                        >
                            {compareResult.status === 'no_baseline' ? (
                                <div
                                    style={{
                                        padding: '32px 20px',
                                        textAlign: 'center',
                                        color: THEME.textMuted,
                                        fontSize: 13,
                                    }}
                                >
                                    <BookOpen
                                        size={32}
                                        style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }}
                                    />
                                    No baseline found for this query. Click <b>Capture as baseline</b> first to
                                    establish a reference plan.
                                </div>
                            ) : (
                                <>
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: 14,
                                            padding: 16,
                                            borderBottom: `1px solid ${THEME.glassBorder}`,
                                        }}
                                    >
                                        {[
                                            {
                                                label: 'Baseline plan cost',
                                                value: compareResult.baseline?.cost?.toFixed(2),
                                                color: THEME.success,
                                                kind: 'good',
                                            },
                                            {
                                                label: 'Current plan cost',
                                                value: compareResult.current?.cost?.toFixed(2),
                                                color: compareResult.regression ? THEME.danger : THEME.success,
                                                kind: compareResult.regression ? 'bad' : 'good',
                                            },
                                        ].map(({ label: lbl, value, color }) => (
                                            <div
                                                key={lbl}
                                                style={{
                                                    padding: 14,
                                                    background: `${color}08`,
                                                    border: `1px solid ${color}30`,
                                                    borderRadius: 12,
                                                    textAlign: 'center',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontSize: 10.5,
                                                        fontWeight: 700,
                                                        color: THEME.textDim,
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.06em',
                                                        marginBottom: 6,
                                                    }}
                                                >
                                                    {lbl}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 24,
                                                        fontWeight: 800,
                                                        color: metricValue(color),
                                                        fontVariantNumeric: 'tabular-nums',
                                                    }}
                                                >
                                                    {value}
                                                </div>
                                            </div>
                                        ))}
                                        {compareResult.regression && (
                                            <div
                                                style={{
                                                    gridColumn: '1 / -1',
                                                    display: 'flex',
                                                    justifyContent: 'center',
                                                    marginTop: -4,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        padding: '4px 12px',
                                                        borderRadius: 999,
                                                        background: `${THEME.danger}15`,
                                                        color: THEME.danger,
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                    }}
                                                >
                                                    <TrendingUp size={12} /> +{compareResult.costChange}% — Plan
                                                    regression detected
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {compareResult.regression && (
                                        <div
                                            style={{
                                                padding: '12px 16px',
                                                background: `${THEME.danger}08`,
                                                borderBottom: `1px solid ${THEME.glassBorder}`,
                                                fontSize: 12,
                                                color: THEME.danger,
                                                display: 'flex',
                                                gap: 8,
                                                alignItems: 'flex-start',
                                            }}
                                        >
                                            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                                            <div>
                                                <b>Significant regression.</b> Consider running{' '}
                                                <code
                                                    style={{
                                                        background: `${THEME.grid}40`,
                                                        padding: '1px 5px',
                                                        borderRadius: 3,
                                                        fontFamily: THEME.fontMono,
                                                    }}
                                                >
                                                    ANALYZE
                                                </code>
                                                , checking for missing indexes, or reviewing recent schema changes.
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: 12, padding: 16 }}>
                                        <PlanTree
                                            plan={compareResult.baseline?.plan}
                                            title="Baseline plan"
                                            accent={THEME.success}
                                        />
                                        <PlanTree
                                            plan={compareResult.current?.plan}
                                            title="Current plan"
                                            accent={compareResult.regression ? THEME.danger : THEME.primary}
                                        />
                                    </div>
                                </>
                            )}
                        </Cell>
                    )}

                    {/* Timeline cell */}
                    <Cell
                        title="Regression timeline"
                        meta={`${history.length} comparison${history.length === 1 ? '' : 's'}${deployEvents.length ? ` · ${deployEvents.length} deploy marker${deployEvents.length === 1 ? '' : 's'}` : ''}`}
                        icon={Activity}
                        action={
                            <div
                                style={{
                                    display: 'flex',
                                    gap: 14,
                                    alignItems: 'center',
                                    fontSize: 11,
                                    color: THEME.textDim,
                                }}
                            >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <span
                                        style={{ width: 12, height: 2, background: THEME.warning, borderRadius: 1 }}
                                    />{' '}
                                    deploy
                                </span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <span
                                        style={{ width: 8, height: 8, borderRadius: '50%', background: THEME.danger }}
                                    />{' '}
                                    regression
                                </span>
                            </div>
                        }
                    >
                        <RegressionTimeline
                            history={history}
                            deployEvents={deployEvents}
                            regressionThreshold={watcherConfig.threshold}
                        />

                        {/* Recent comparison rows */}
                        {history.length > 0 && (
                            <div
                                style={{
                                    marginTop: 14,
                                    borderTop: `1px solid ${THEME.glassBorder}`,
                                    marginLeft: -16,
                                    marginRight: -16,
                                    marginBottom: -16,
                                }}
                            >
                                <div
                                    style={{
                                        padding: '10px 16px',
                                        fontSize: 10.5,
                                        fontWeight: 700,
                                        color: THEME.textDim,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.06em',
                                    }}
                                >
                                    Recent comparisons
                                </div>
                                {history
                                    .slice()
                                    .reverse()
                                    .slice(0, 6)
                                    .map((h, i) => (
                                        <div
                                            key={i}
                                            className="qr-baseline-row"
                                            style={{
                                                padding: '10px 16px',
                                                display: 'grid',
                                                gridTemplateColumns: '10px 1fr auto auto',
                                                gap: 12,
                                                alignItems: 'center',
                                            }}
                                        >
                                            <span
                                                style={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: '50%',
                                                    background: h.regression ? THEME.danger : THEME.success,
                                                }}
                                            />
                                            <div>
                                                <div style={{ fontSize: 12.5, fontWeight: 600, color: THEME.textMain }}>
                                                    {h.queryLabel || 'Query'}
                                                </div>
                                                <div style={{ fontSize: 11, color: THEME.textDim, marginTop: 1 }}>
                                                    {fmtRel(h.ts)}
                                                </div>
                                            </div>
                                            <div
                                                style={{
                                                    textAlign: 'right',
                                                    fontSize: 12,
                                                    fontVariantNumeric: 'tabular-nums',
                                                    color: THEME.textMuted,
                                                }}
                                            >
                                                {h.baselineCost?.toFixed(2)} →{' '}
                                                <b style={{ color: h.regression ? THEME.danger : THEME.success }}>
                                                    {h.currentCost?.toFixed(2)}
                                                </b>
                                            </div>
                                            <StatusBadge
                                                status={h.regression ? 'regression' : 'ok'}
                                                change={h.costChange}
                                            />
                                        </div>
                                    ))}
                            </div>
                        )}
                    </Cell>

                    {/* Plan Type Ratio cell */}
                    <Cell title="Plan type ratio" meta="Custom vs generic prepared-statement plans" icon={BarChart2}>
                        <div
                            style={{
                                fontSize: 12,
                                color: THEME.textMuted,
                                marginBottom: 12,
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 6,
                            }}
                        >
                            <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                            <span>
                                PostgreSQL may switch from a <b style={{ color: THEME.success }}>custom plan</b>{' '}
                                (optimized per parameter) to a <b style={{ color: THEME.warning }}>generic plan</b>{' '}
                                (one-size-fits-all). A rising generic ratio can silently degrade performance.
                            </span>
                        </div>
                        <PlanRatioChart ratioHistory={ratioHistory} />
                    </Cell>

                    {/* Watcher alert log — only shown when there are alerts */}
                    {watcherAlerts.length > 0 && (
                        <Cell
                            title="Watcher alert log"
                            meta={`${watcherAlerts.length} active`}
                            icon={Bell}
                            accent={THEME.danger}
                            action={
                                <button
                                    onClick={() => setWatcherAlerts([])}
                                    style={{
                                        fontSize: 11.5,
                                        color: THEME.textDim,
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '4px 8px',
                                    }}
                                >
                                    Clear all
                                </button>
                            }
                            noPad
                        >
                            {watcherAlerts.map((a, i) => (
                                <div
                                    key={i}
                                    className="qr-baseline-row"
                                    style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}
                                >
                                    <AlertTriangle size={14} color={THEME.danger} style={{ flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 12.5, fontWeight: 600, color: THEME.textMain }}>
                                            {a.label}
                                        </div>
                                        <div style={{ fontSize: 11, color: THEME.textDim, marginTop: 1 }}>
                                            {fmtRel(a.ts)}
                                        </div>
                                    </div>
                                    <span
                                        className="qr-badge"
                                        style={{
                                            background: `${THEME.danger}15`,
                                            color: THEME.danger,
                                            border: `1px solid ${THEME.danger}30`,
                                        }}
                                    >
                                        +{a.change}% cost
                                    </span>
                                </div>
                            ))}
                        </Cell>
                    )}
                </div>

                {/* RIGHT — side stack */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14,
                        position: 'sticky',
                        top: 16,
                        alignSelf: 'start',
                    }}
                >
                    {/* Watcher controls */}
                    <div className="qr-card">
                        <div
                            style={{
                                padding: '10px 14px',
                                borderBottom: `1px solid ${THEME.glassBorder}`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    color: THEME.textDim,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.06em',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                }}
                            >
                                <Bell size={12} /> Watcher
                            </span>
                            <div style={{ flex: 1 }} />
                            <button
                                onClick={() => setWatcherActive((v) => !v)}
                                style={{
                                    width: 38,
                                    height: 20,
                                    borderRadius: 999,
                                    border: 'none',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    background: watcherActive ? THEME.success : THEME.grid,
                                    transition: 'background 0.15s',
                                    padding: 0,
                                }}
                            >
                                <span
                                    style={{
                                        position: 'absolute',
                                        top: 2,
                                        left: watcherActive ? 20 : 2,
                                        width: 16,
                                        height: 16,
                                        borderRadius: '50%',
                                        background: '#fff',
                                        transition: 'left 0.15s',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                    }}
                                />
                            </button>
                        </div>
                        <div style={{ padding: '12px 14px', fontSize: 12 }}>
                            {[
                                {
                                    label: 'Interval',
                                    node: (
                                        <select
                                            value={watcherConfig.intervalMin}
                                            onChange={(e) =>
                                                setWatcherConfig((c) => ({ ...c, intervalMin: +e.target.value }))
                                            }
                                            style={{
                                                background: THEME.surface,
                                                border: `1px solid ${THEME.grid}`,
                                                color: THEME.textMain,
                                                borderRadius: 6,
                                                padding: '4px 8px',
                                                fontSize: 12,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            {[5, 15, 30, 60, 120, 360].map((v) => (
                                                <option key={v} value={v}>
                                                    {v} min
                                                </option>
                                            ))}
                                        </select>
                                    ),
                                },
                                {
                                    label: 'Threshold',
                                    node: (
                                        <select
                                            value={watcherConfig.threshold}
                                            onChange={(e) =>
                                                setWatcherConfig((c) => ({ ...c, threshold: +e.target.value }))
                                            }
                                            style={{
                                                background: THEME.surface,
                                                border: `1px solid ${THEME.grid}`,
                                                color: THEME.textMain,
                                                borderRadius: 6,
                                                padding: '4px 8px',
                                                fontSize: 12,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            {[10, 15, 20, 30, 50].map((v) => (
                                                <option key={v} value={v}>
                                                    +{v}%
                                                </option>
                                            ))}
                                        </select>
                                    ),
                                },
                                {
                                    label: 'Alert channel',
                                    node: (
                                        <select
                                            value={watcherConfig.alertChannel}
                                            onChange={(e) =>
                                                setWatcherConfig((c) => ({ ...c, alertChannel: e.target.value }))
                                            }
                                            style={{
                                                background: THEME.surface,
                                                border: `1px solid ${THEME.grid}`,
                                                color: THEME.textMain,
                                                borderRadius: 6,
                                                padding: '4px 8px',
                                                fontSize: 12,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            {['In-App Only', 'Webhook', 'Email', 'Slack'].map((v) => (
                                                <option key={v} value={v}>
                                                    {v}
                                                </option>
                                            ))}
                                        </select>
                                    ),
                                },
                                {
                                    label: 'Auto re-baseline',
                                    node: (
                                        <input
                                            type="checkbox"
                                            checked={watcherConfig.autoRebaseline}
                                            onChange={(e) =>
                                                setWatcherConfig((c) => ({ ...c, autoRebaseline: e.target.checked }))
                                            }
                                            style={{
                                                accentColor: THEME.primary,
                                                width: 15,
                                                height: 15,
                                                cursor: 'pointer',
                                            }}
                                        />
                                    ),
                                },
                                {
                                    label: 'Track plan type',
                                    node: (
                                        <input
                                            type="checkbox"
                                            checked={watcherConfig.trackPlanType}
                                            onChange={(e) =>
                                                setWatcherConfig((c) => ({ ...c, trackPlanType: e.target.checked }))
                                            }
                                            style={{
                                                accentColor: THEME.primary,
                                                width: 15,
                                                height: 15,
                                                cursor: 'pointer',
                                            }}
                                        />
                                    ),
                                },
                            ].map((r, i) => (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '6px 0',
                                        borderBottom: i < 4 ? `1px solid ${THEME.glassBorder}` : 'none',
                                    }}
                                >
                                    <span style={{ color: THEME.textMuted }}>{r.label}</span>
                                    {r.node}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Baselines */}
                    <div className="qr-card">
                        <div
                            style={{
                                padding: '10px 14px',
                                borderBottom: `1px solid ${THEME.glassBorder}`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    color: THEME.textDim,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.06em',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                }}
                            >
                                <BookOpen size={12} /> Baselines
                            </span>
                            <div style={{ flex: 1 }} />
                            <span style={{ fontSize: 10.5, color: THEME.textDim, fontWeight: 500 }}>
                                {baselines.length} stored
                            </span>
                        </div>
                        {baselines.length === 0 ? (
                            <div
                                style={{
                                    padding: '24px 14px',
                                    textAlign: 'center',
                                    color: THEME.textDim,
                                    fontSize: 12,
                                }}
                            >
                                <BookOpen
                                    size={28}
                                    style={{ opacity: 0.25, display: 'block', margin: '0 auto 10px' }}
                                />
                                No baselines stored
                            </div>
                        ) : (
                            <div>
                                {baselines.slice(0, 8).map((b) => (
                                    <div
                                        key={b.fingerprint}
                                        style={{
                                            padding: '10px 14px',
                                            borderBottom: `1px solid ${THEME.glassBorder}`,
                                            display: 'grid',
                                            gridTemplateColumns: '1fr auto',
                                            gap: 8,
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                        }}
                                        className="qr-baseline-row"
                                        onClick={() => setQuery(b.queryPreview || '')}
                                    >
                                        <div style={{ minWidth: 0 }}>
                                            <div
                                                style={{
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    color: THEME.textMain,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {b.label}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 10.5,
                                                    color: THEME.textDim,
                                                    fontFamily: THEME.fontMono,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {b.queryPreview}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <div
                                                style={{
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    color: THEME.primary,
                                                    fontVariantNumeric: 'tabular-nums',
                                                }}
                                            >
                                                cost {Number(b.cost).toFixed(0)}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 10.5,
                                                    color: THEME.textDim,
                                                    marginTop: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 4,
                                                    justifyContent: 'flex-end',
                                                }}
                                            >
                                                <span>{fmtRel(b.ts)}</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(b.fingerprint);
                                                    }}
                                                    title="Remove"
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        color: THEME.danger,
                                                        padding: 0,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                    }}
                                                >
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {baselines.length > 8 && (
                                    <div
                                        style={{
                                            padding: '8px 14px',
                                            fontSize: 11,
                                            color: THEME.textDim,
                                            textAlign: 'center',
                                        }}
                                    >
                                        + {baselines.length - 8} more
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Deploy events */}
                    <div className="qr-card">
                        <div
                            style={{
                                padding: '10px 14px',
                                borderBottom: `1px solid ${THEME.glassBorder}`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    color: THEME.textDim,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.06em',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                }}
                            >
                                <Tag size={12} /> Deploy events
                            </span>
                            <div style={{ flex: 1 }} />
                            <span style={{ fontSize: 10.5, color: THEME.textDim, fontWeight: 500 }}>
                                {deployEvents.length}
                            </span>
                        </div>
                        <div style={{ padding: '10px 12px', display: 'flex', gap: 6 }}>
                            <input
                                value={newDeployVer}
                                onChange={(e) => setNewDeployVer(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addDeploy()}
                                placeholder="Version tag · v2.4.1"
                                style={{
                                    flex: 1,
                                    background: THEME.surface,
                                    border: `1px solid ${THEME.grid}`,
                                    color: THEME.textMain,
                                    borderRadius: 8,
                                    padding: '6px 10px',
                                    fontSize: 12,
                                    outline: 'none',
                                }}
                            />
                            <button
                                onClick={addDeploy}
                                title="Mark deploy"
                                style={{
                                    background: `${THEME.warning}12`,
                                    color: THEME.warning,
                                    border: `1px solid ${THEME.warning}30`,
                                    borderRadius: 8,
                                    padding: '0 10px',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                }}
                            >
                                <Tag size={12} /> Add
                            </button>
                        </div>
                        {deployEvents.length === 0 ? (
                            <div
                                style={{
                                    padding: '10px 14px 14px',
                                    fontSize: 11.5,
                                    color: THEME.textDim,
                                    textAlign: 'center',
                                }}
                            >
                                No deploys marked
                            </div>
                        ) : (
                            <div style={{ padding: '0 14px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {deployEvents
                                    .slice()
                                    .reverse()
                                    .map((d, i) => {
                                        const realIdx = deployEvents.length - 1 - i;
                                        return (
                                            <span
                                                key={i}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 5,
                                                    padding: '3px 10px',
                                                    borderRadius: 999,
                                                    background: `${THEME.warning}12`,
                                                    border: `1px solid ${THEME.warning}30`,
                                                    fontSize: 11,
                                                }}
                                            >
                                                <span style={{ color: THEME.warning }}>🚀</span>
                                                <span style={{ color: THEME.textMain, fontWeight: 600 }}>
                                                    {d.version}
                                                </span>
                                                <span style={{ color: THEME.textDim }}>{fmtRel(d.ts)}</span>
                                                <button
                                                    onClick={() =>
                                                        setDeployEvents((prev) => prev.filter((_, j) => j !== realIdx))
                                                    }
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        color: THEME.textDim,
                                                        padding: 0,
                                                        display: 'flex',
                                                        marginLeft: 2,
                                                    }}
                                                >
                                                    <Trash2 size={10} />
                                                </button>
                                            </span>
                                        );
                                    })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
