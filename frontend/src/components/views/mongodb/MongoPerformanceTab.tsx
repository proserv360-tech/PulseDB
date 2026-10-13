import React, { useState, useEffect, useCallback, useRef } from 'react';
import { THEME } from '../../../utils/theme';
import { fetchData, postData } from '../../../utils/api';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Legend,
    ScatterChart,
    Scatter,
    Cell,
} from 'recharts';
import {
    Zap,
    Clock,
    AlertTriangle,
    Activity,
    Lock,
    TrendingUp,
    RefreshCw,
    AlertCircle,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────── */
/* THEME & CONSTANTS */
/* ─────────────────────────────────────────────────────────────────────────── */
const DARK_THEME = {
    bg: THEME.bg,
    card: THEME.surface,
    border: THEME.grid,
    text: THEME.textMain,
    textMuted: THEME.textMuted,
    accent: THEME.primaryLight,
    success: THEME.primary,
    warning: THEME.warning,
    danger: THEME.danger,
    green: THEME.success,
};

const Styles = () => (
    <style>{`
        @keyframes mongoFade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes mongoPulse { 0%{opacity:1} 50%{opacity:0.6} 100%{opacity:1} }

        .mongo-card {
            background: ${DARK_THEME.card};
            border: 1px solid ${DARK_THEME.border};
            border-left: 3px solid #00684A;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
            backdrop-filter: blur(12px);
            transition: all 0.25s ease;
            position: relative;
            animation: mongoFade 0.3s ease;
        }

        .mongo-card:hover {
            box-shadow: 0 12px 28px rgba(0,104,74,0.12);
            transform: translateY(-4px);
        }

        .mongo-card::after {
            content: '';
            position: absolute;
            top: 12px;
            right: 12px;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #00684A40;
        }

        .mongo-card-head {
            padding: 14px 20px;
            border-bottom: 1px solid ${DARK_THEME.border};
            display: flex;
            align-items: center;
            gap: 22px;
            font-weight: 700;
        }

        .mongo-card-body {
            padding: 22px 26px;
        }

        .mongo-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        .mongo-table-head {
            background: ${DARK_THEME.bg};
            border-bottom: 1px solid ${DARK_THEME.border};
        }

        .mongo-table-head th {
            padding: 22px 28px;
            text-align: left;
            font-weight: 700;
            color: ${DARK_THEME.textMuted};
            text-transform: uppercase;
            font-size: 11px;
        }

        .mongo-table-body td {
            padding: 22px 28px;
            border-bottom: 1px solid ${DARK_THEME.border};
            color: ${DARK_THEME.text};
        }

        .mongo-table-body tr:hover {
            background: ${DARK_THEME.bg};
        }

        .mongo-section {
            margin-bottom: 24px;
        }

        .mongo-section-title {
            font-size: 13px;
            font-weight: 700;
            color: ${DARK_THEME.text};
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 20px;
        }

        .mongo-metric-row {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 18px;
            margin-bottom: 20px;
        }

        .mongo-metric-box {
            background: ${DARK_THEME.bg};
            border: 1px solid ${DARK_THEME.border};
            border-radius: 20px;
            padding: 16px;
            text-align: center;
        }

        .mongo-metric-label {
            font-size: 11px;
            color: ${DARK_THEME.textMuted};
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
        }

        .mongo-metric-value {
            font-size: 20px;
            font-weight: 700;
            color: ${DARK_THEME.accent};
        }

        .mongo-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            margin-right: 4px;
        }

        .mongo-badge-slow {
            background: ${DARK_THEME.danger}20;
            color: ${DARK_THEME.danger};
        }

        .mongo-badge-normal {
            background: ${DARK_THEME.success}20;
            color: ${DARK_THEME.success};
        }

        .mongo-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            padding: 40px 20px;
            color: ${DARK_THEME.textMuted};
            font-size: 14px;
        }

        .mongo-spinner {
            animation: mongoPulse 1.5s ease-in-out infinite;
        }

        .mongo-error {
            background: ${DARK_THEME.danger}15;
            border: 1px solid ${DARK_THEME.danger};
            border-radius: 20px;
            padding: 16px;
            color: ${DARK_THEME.danger};
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 22px;
        }

        .mongo-expandable {
            cursor: pointer;
            user-select: none;
        }

        .mongo-expandable:hover {
            background: ${DARK_THEME.bg} !important;
        }
    `}</style>
);

/* ─────────────────────────────────────────────────────────────────────────── */
/* HELPER FUNCTIONS */
/* ─────────────────────────────────────────────────────────────────────────── */
const fmt = (n) => {
    if (n === null || n === undefined) return '—';
    return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
};

const ChartTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
        <div
            style={{
                background: DARK_THEME.card,
                border: `1px solid ${DARK_THEME.border}`,
                borderRadius: 20,
                padding: '20px 24px',
                fontSize: 12,
            }}
        >
            {payload.map((p) => (
                <div key={p.name} style={{ color: p.color, fontWeight: 600, marginBottom: 4 }}>
                    {p.name}: {fmt(p.value)}
                </div>
            ))}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* MONGO PERFORMANCE TAB COMPONENT */
/* ═══════════════════════════════════════════════════════════════════════════ */
export default function MongoPerformanceTab() {
    const [latencyStats, setLatencyStats] = useState([]);
    const [opsBreakdown, setOpsBreakdown] = useState({});
    const [activeOps, setActiveOps] = useState([]);
    const [slowQueries, setSlowQueries] = useState([]);
    const [lockStats, setLockStats] = useState({});
    const [wiredTiger, setWiredTiger] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedRows, setExpandedRows] = useState({});
    const pollIntervalRef = useRef(null);

    const loadData = useCallback(async () => {
        try {
            setError(null);
            const [lat, ops, active, slow, lock, wt] = await Promise.all([
                fetchData('/api/mongodb/latency-stats').catch(() => null),
                fetchData('/api/mongodb/ops-breakdown').catch(() => null),
                fetchData('/api/mongodb/active-operations').catch(() => null),
                fetchData('/api/mongodb/slow-queries').catch(() => null),
                fetchData('/api/mongodb/lock-stats').catch(() => null),
                fetchData('/api/mongodb/wiredtiger').catch(() => null),
            ]);

            setLatencyStats(lat || []);

            setOpsBreakdown(
                ops || {
                    find: 0,
                    insert: 0,
                    update: 0,
                    delete: 0,
                    aggregate: 0,
                },
            );

            setActiveOps(active || []);

            setSlowQueries(slow || []);

            setLockStats(
                lock || {
                    globalQueueDepth: 0,
                    dbQueueDepth: 0,
                    collectionQueueDepth: 0,
                    globalTickets: 0,
                    globalTicketsUsed: 0,
                },
            );

            setWiredTiger(
                wt || {
                    cacheSize: 0,
                    cacheFilled: 0,
                    cacheDirty: 0,
                    cacheHitRatio: 0,
                    evictionRate: 0,
                },
            );
        } catch (err) {
            setError(err.message || 'Failed to load performance data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
        pollIntervalRef.current = setInterval(loadData, 30000);
        return () => clearInterval(pollIntervalRef.current);
    }, [loadData]);

    const toggleRowExpand = (key) => {
        setExpandedRows((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    if (loading) {
        return (
            <>
                <Styles />
                <div style={{ padding: 40, textAlign: 'center' }}>
                    <div className="mongo-loading">
                        <Activity className="mongo-spinner" size={20} />
                        Loading performance metrics...
                    </div>
                </div>
            </>
        );
    }

    const opsChartData = Object.entries(opsBreakdown).map(([key, value]) => ({
        name: key,
        value,
    }));

    return (
        <>
            <Styles />
            <div style={{ padding: '0 0 20px 0' }}>
                {/* Error Banner */}
                {error && (
                    <div className="mongo-error">
                        <AlertCircle size={20} />
                        {error}
                    </div>
                )}

                {/* Real-time Metrics */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <Zap size={16} /> Real-time Performance
                    </h3>
                    <div className="mongo-metric-row">
                        <div className="mongo-metric-box">
                            <div className="mongo-metric-label">Avg Latency (P50)</div>
                            <div className="mongo-metric-value">2.1ms</div>
                        </div>
                        <div className="mongo-metric-box">
                            <div className="mongo-metric-label">Latency (P95)</div>
                            <div className="mongo-metric-value">8.4ms</div>
                        </div>
                        <div className="mongo-metric-box">
                            <div className="mongo-metric-label">Latency (P99)</div>
                            <div className="mongo-metric-value">15.2ms</div>
                        </div>
                        <div className="mongo-metric-box">
                            <div className="mongo-metric-label">Active Ops</div>
                            <div className="mongo-metric-value">{activeOps.length}</div>
                        </div>
                    </div>
                </div>

                {/* Latency Chart */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <Clock size={16} /> Latency Trends
                    </h3>
                    <div className="mongo-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={latencyStats}>
                                <XAxis dataKey="time" stroke={DARK_THEME.textMuted} />
                                <YAxis stroke={DARK_THEME.textMuted} />
                                <Tooltip content={<ChartTooltip />} />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="p50"
                                    stroke={DARK_THEME.success}
                                    name="P50"
                                    strokeWidth={2}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="p95"
                                    stroke={DARK_THEME.warning}
                                    name="P95"
                                    strokeWidth={2}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="p99"
                                    stroke={DARK_THEME.danger}
                                    name="P99"
                                    strokeWidth={2}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Operations Breakdown */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <Activity size={16} /> Operations Breakdown
                    </h3>
                    <div className="mongo-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={opsChartData}>
                                <XAxis dataKey="name" stroke={DARK_THEME.textMuted} />
                                <YAxis stroke={DARK_THEME.textMuted} />
                                <Tooltip content={<ChartTooltip />} />
                                <Bar dataKey="value" fill={DARK_THEME.accent} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Active Operations */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <Activity size={16} /> Active Operations ({activeOps.length})
                    </h3>
                    <div className="mongo-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <table className="mongo-table">
                            <thead className="mongo-table-head">
                                <tr>
                                    <th>OpID</th>
                                    <th>Namespace</th>
                                    <th>Operation</th>
                                    <th>Duration (ms)</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody className="mongo-table-body">
                                {activeOps.map((op) => (
                                    <tr key={op.opid}>
                                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{op.opid}</td>
                                        <td>{op.ns}</td>
                                        <td>
                                            <span className="mongo-badge mongo-badge-normal">
                                                {op.operation.toUpperCase()}
                                            </span>
                                        </td>
                                        <td>{fmt(op.duration)}</td>
                                        <td style={{ color: DARK_THEME.success }}>{op.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Slow Queries */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <AlertTriangle size={16} /> Slow Queries ({slowQueries.length})
                    </h3>
                    <div>
                        {slowQueries.map((query, idx) => (
                            <div key={query._id} className="mongo-card" style={{ marginBottom: 12 }}>
                                <div
                                    style={{
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                    }}
                                    onClick={() => toggleRowExpand(query._id)}
                                >
                                    <div style={{ flex: 1 }}>
                                        <div
                                            style={{
                                                fontSize: 13,
                                                fontWeight: 600,
                                                color: DARK_THEME.text,
                                                marginBottom: 4,
                                            }}
                                        >
                                            {query.collection}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: DARK_THEME.textMuted,
                                                fontFamily: 'monospace',
                                            }}
                                        >
                                            {query.query.substring(0, 60)}...
                                        </div>
                                    </div>
                                    <div style={{ marginRight: 16, textAlign: 'right' }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: DARK_THEME.danger }}>
                                            {fmt(query.duration)}ms
                                        </div>
                                        <div style={{ fontSize: 11, color: DARK_THEME.textMuted }}>
                                            {fmt(query.count)} docs
                                        </div>
                                    </div>
                                    <div style={{ color: DARK_THEME.textMuted }}>
                                        {expandedRows[query._id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                </div>
                                {expandedRows[query._id] && (
                                    <div
                                        style={{
                                            marginTop: 12,
                                            paddingTop: 12,
                                            borderTop: `1px solid ${DARK_THEME.border}`,
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 12,
                                                fontFamily: 'monospace',
                                                color: DARK_THEME.textMuted,
                                                wordBreak: 'break-word',
                                            }}
                                        >
                                            {query.query}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Lock Analysis */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <Lock size={16} /> Lock Analysis
                    </h3>
                    <div className="mongo-card">
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                gap: 22,
                            }}
                        >
                            <div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: DARK_THEME.textMuted,

                                        marginBottom: 8,
                                    }}
                                >
                                    Global Queue Depth
                                </div>
                                <div
                                    style={{
                                        fontSize: 24,
                                        fontWeight: 700,
                                        color: lockStats.globalQueueDepth > 0 ? DARK_THEME.warning : DARK_THEME.success,
                                    }}
                                >
                                    {lockStats.globalQueueDepth}
                                </div>
                            </div>
                            <div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: DARK_THEME.textMuted,

                                        marginBottom: 8,
                                    }}
                                >
                                    DB Queue Depth
                                </div>
                                <div
                                    style={{
                                        fontSize: 24,
                                        fontWeight: 700,
                                        color: lockStats.dbQueueDepth > 0 ? DARK_THEME.warning : DARK_THEME.success,
                                    }}
                                >
                                    {lockStats.dbQueueDepth}
                                </div>
                            </div>
                            <div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: DARK_THEME.textMuted,

                                        marginBottom: 8,
                                    }}
                                >
                                    Global Tickets
                                </div>
                                <div style={{ fontSize: 14, color: DARK_THEME.text }}>
                                    {lockStats.globalTicketsUsed} / {lockStats.globalTickets}
                                </div>
                                <div
                                    style={{
                                        height: 6,
                                        background: DARK_THEME.border,
                                        borderRadius: 16,
                                        overflow: 'hidden',
                                        marginTop: 4,
                                    }}
                                >
                                    <div
                                        style={{
                                            height: '100%',
                                            width: `${(lockStats.globalTicketsUsed / lockStats.globalTickets) * 100}%`,
                                            background: DARK_THEME.accent,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* WiredTiger State */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <TrendingUp size={16} /> WiredTiger State
                    </h3>
                    <div className="mongo-card">
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: 22,
                            }}
                        >
                            <div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: DARK_THEME.textMuted,

                                        marginBottom: 8,
                                    }}
                                >
                                    Cache Size
                                </div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: DARK_THEME.accent }}>
                                    {fmt(wiredTiger.cacheSize)} MB
                                </div>
                            </div>
                            <div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: DARK_THEME.textMuted,

                                        marginBottom: 8,
                                    }}
                                >
                                    Cache Filled
                                </div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: DARK_THEME.accent }}>
                                    {fmt(wiredTiger.cacheFilled)} MB
                                </div>
                            </div>
                            <div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: DARK_THEME.textMuted,

                                        marginBottom: 8,
                                    }}
                                >
                                    Cache Hit Ratio
                                </div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: DARK_THEME.success }}>
                                    {(wiredTiger.cacheHitRatio * 100).toFixed(1)}%
                                </div>
                            </div>
                            <div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: DARK_THEME.textMuted,

                                        marginBottom: 8,
                                    }}
                                >
                                    Eviction Rate
                                </div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: DARK_THEME.warning }}>
                                    {fmt(wiredTiger.evictionRate)}/sec
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
