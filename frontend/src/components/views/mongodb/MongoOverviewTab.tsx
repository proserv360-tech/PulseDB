import React, { useState, useEffect, useCallback, useRef } from 'react';
import { THEME } from '../../../utils/theme';
import { fetchData, postData } from '../../../utils/api';
import { readTabCache, writeTabCache } from '../../../utils/tabCache';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Legend,
    AreaChart,
    Area,
} from 'recharts';
import {
    Activity,
    AlertTriangle,
    TrendingUp,
    Zap,
    Database,
    CheckCircle,
    RefreshCw,
    AlertCircle,
    Clock,
    Server,
    Cpu,
    HardDrive,
    Gauge,
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
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04);
            backdrop-filter: blur(12px);
            transition: all 0.25s ease;
            position: relative;
            animation: mongoFade 0.3s ease;
        }

        .mongo-card:hover {
            box-shadow: 0 12px 28px rgba(0,104,74,0.12);
            transform: translateY(-2px);
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
            gap: 10px;
            font-weight: 700;
        }

        .mongo-card-body {
            padding: 16px 18px;
        }

        .mongo-gauge-container {
            position: relative;
            width: 150px;
            height: 150px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto;
        }

        .mongo-gauge-value {
            font-size: 36px;
            font-weight: 800;
            color: ${DARK_THEME.accent};
            z-index: 2;
            text-align: center;
        }

        .mongo-metric-box {
            background: ${DARK_THEME.card};
            border: 1px solid ${DARK_THEME.border};
            border-radius: 16px;
            padding: 20px;
            text-align: center;
        }

        .mongo-metric-label {
            font-size: 11px;
            color: ${DARK_THEME.textMuted};
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }

        .mongo-metric-value {
            font-size: 24px;
            font-weight: 700;
            color: ${DARK_THEME.accent};
        }

        .mongo-alert-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 700;
            margin-right: 8px;
            margin-bottom: 8px;
        }

        .mongo-alert-critical {
            background: ${DARK_THEME.danger}20;
            color: ${DARK_THEME.danger};
            border-left: 3px solid ${DARK_THEME.danger};
        }

        .mongo-alert-warning {
            background: ${DARK_THEME.warning}20;
            color: ${DARK_THEME.warning};
            border-left: 3px solid ${DARK_THEME.warning};
        }

        .mongo-alert-info {
            background: ${DARK_THEME.accent}20;
            color: ${DARK_THEME.accent};
            border-left: 3px solid ${DARK_THEME.accent};
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
            gap: 8px;
        }

        .mongo-status-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 8px;
        }

        .mongo-status-healthy {
            background: ${DARK_THEME.green};
        }

        .mongo-status-warning {
            background: ${DARK_THEME.warning};
        }

        .mongo-status-critical {
            background: ${DARK_THEME.danger};
        }

        .mongo-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
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
            border-radius: 8px;
            padding: 16px;
            color: ${DARK_THEME.danger};
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .mongo-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
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

const getHealthColor = (score) => {
    if (score >= 90) return DARK_THEME.green;
    if (score >= 75) return DARK_THEME.warning;
    if (score >= 50) return THEME.warning;
    return DARK_THEME.danger;
};

const ChartTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
        <div
            style={{
                background: DARK_THEME.card,
                border: `1px solid ${DARK_THEME.border}`,
                borderRadius: 8,
                padding: '8px 12px',
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
/* MONGO OVERVIEW TAB COMPONENT */
/* ═══════════════════════════════════════════════════════════════════════════ */
export default function MongoOverviewTab() {
    const _cached = readTabCache<any>('mongo_overview');
    const [overview, setOverview] = useState(_cached?.overview ?? null);
    const [opsChart, setOpsChart] = useState(_cached?.opsChart ?? []);
    const [latencyChart, setLatencyChart] = useState(_cached?.latencyChart ?? []);
    const [replicationStatus, setReplicationStatus] = useState(_cached?.replicationStatus ?? null);
    const [alerts, setAlerts] = useState(_cached?.alerts ?? []);
    const [loading, setLoading] = useState(!_cached);
    const [error, setError] = useState(null);
    const pollIntervalRef = useRef(null);

    const loadData = useCallback(async () => {
        try {
            setError(null);
            const [ovData, ops, lat, rep, alrt] = await Promise.all([
                fetchData('/api/mongodb/overview').catch(() => null),
                fetchData('/api/mongodb/ops-chart').catch(() => null),
                fetchData('/api/mongodb/latency-chart').catch(() => null),
                fetchData('/api/mongodb/replication-status').catch(() => null),
                fetchData('/api/mongodb/alerts').catch(() => null),
            ]);

            setOverview(
                ovData || {
                    connections: 0,
                    opsPerSec: 0,
                    avgLatency: 0,
                    replicationLag: 0,
                    cpuUsage: 0,
                    memoryUsage: 0,
                    diskIOPS: 0,
                    cacheFillRatio: 0,
                    healthScore: 0,
                },
            );

            setOpsChart(ops || []);

            setLatencyChart(lat || []);

            setReplicationStatus(
                rep || {
                    isPrimary: false,
                    members: [],
                    oplogWindow: 0,
                },
            );

            setAlerts(alrt || []);
            writeTabCache('mongo_overview', null, { overview: ovData, opsChart: ops || [], latencyChart: lat || [], replicationStatus: rep, alerts: alrt || [] });
        } catch (err) {
            setError(err.message || 'Failed to load MongoDB overview');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
        pollIntervalRef.current = setInterval(loadData, 30000);
        return () => clearInterval(pollIntervalRef.current);
    }, [loadData]);

    if (loading) {
        return (
            <>
                <Styles />
                <div style={{ padding: 40, textAlign: 'center' }}>
                    <div className="mongo-loading">
                        <Database className="mongo-spinner" size={20} />
                        Loading MongoDB overview...
                    </div>
                </div>
            </>
        );
    }

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

                {/* Health Score Section */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <Activity size={16} /> Overall Health
                    </h3>
                    <div className="mongo-card" style={{ textAlign: 'center', padding: 30 }}>
                        <div
                            className="mongo-gauge-container"
                            style={{
                                background: `conic-gradient(${getHealthColor(overview?.healthScore || 0)} 0deg ${(overview?.healthScore || 0) * 3.6}deg, ${DARK_THEME.border} ${(overview?.healthScore || 0) * 3.6}deg 360deg)`,
                            }}
                        >
                            <div
                                style={{
                                    position: 'absolute',
                                    width: 120,
                                    height: 120,
                                    background: DARK_THEME.card,
                                    borderRadius: '50%',
                                }}
                            />
                            <div style={{ position: 'relative', textAlign: 'center' }}>
                                <div className="mongo-gauge-value">{overview?.healthScore || 0}</div>
                                <div style={{ fontSize: 11, color: DARK_THEME.textMuted, marginTop: 4 }}>
                                    Health Score
                                </div>
                            </div>
                        </div>

                        <div className="mongo-grid" style={{ marginTop: 30 }}>
                            <div className="mongo-metric-box">
                                <div className="mongo-metric-label">Connections</div>
                                <div className="mongo-metric-value">{overview?.connections}</div>
                            </div>
                            <div className="mongo-metric-box">
                                <div className="mongo-metric-label">Ops/Sec</div>
                                <div className="mongo-metric-value">{fmt(overview?.opsPerSec)}</div>
                            </div>
                            <div className="mongo-metric-box">
                                <div className="mongo-metric-label">Avg Latency (ms)</div>
                                <div className="mongo-metric-value">{fmt(overview?.avgLatency)}</div>
                            </div>
                            <div className="mongo-metric-box">
                                <div className="mongo-metric-label">Replication Lag (s)</div>
                                <div className="mongo-metric-value">{fmt(overview?.replicationLag)}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Resource Metrics */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <Cpu size={16} /> System Resources
                    </h3>
                    <div className="mongo-grid">
                        <div className="mongo-card">
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: 12,
                                }}
                            >
                                <span style={{ fontSize: 13, fontWeight: 600, color: DARK_THEME.text }}>CPU Usage</span>
                                <span style={{ fontSize: 18, fontWeight: 700, color: DARK_THEME.accent }}>
                                    {overview?.cpuUsage || 0}%
                                </span>
                            </div>
                            <div
                                style={{
                                    height: 8,
                                    background: DARK_THEME.border,
                                    borderRadius: 14,
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{
                                        height: '100%',
                                        width: `${overview?.cpuUsage || 0}%`,
                                        background: getHealthColor(100 - (overview?.cpuUsage || 0)),
                                    }}
                                />
                            </div>
                        </div>

                        <div className="mongo-card">
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: 12,
                                }}
                            >
                                <span style={{ fontSize: 13, fontWeight: 600, color: DARK_THEME.text }}>
                                    Memory Usage
                                </span>
                                <span style={{ fontSize: 18, fontWeight: 700, color: DARK_THEME.accent }}>
                                    {overview?.memoryUsage || 0}%
                                </span>
                            </div>
                            <div
                                style={{
                                    height: 8,
                                    background: DARK_THEME.border,
                                    borderRadius: 14,
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{
                                        height: '100%',
                                        width: `${overview?.memoryUsage || 0}%`,
                                        background: getHealthColor(100 - (overview?.memoryUsage || 0)),
                                    }}
                                />
                            </div>
                        </div>

                        <div className="mongo-card">
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: 12,
                                }}
                            >
                                <span style={{ fontSize: 13, fontWeight: 600, color: DARK_THEME.text }}>Disk IOPS</span>
                                <span style={{ fontSize: 18, fontWeight: 700, color: DARK_THEME.accent }}>
                                    {overview?.diskIOPS || 0}
                                </span>
                            </div>
                            <div style={{ fontSize: 12, color: DARK_THEME.textMuted }}>operations/sec</div>
                        </div>

                        <div className="mongo-card">
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: 12,
                                }}
                            >
                                <span style={{ fontSize: 13, fontWeight: 600, color: DARK_THEME.text }}>
                                    Cache Fill
                                </span>
                                <span style={{ fontSize: 18, fontWeight: 700, color: DARK_THEME.accent }}>
                                    {overview?.cacheFillRatio || 0}%
                                </span>
                            </div>
                            <div
                                style={{
                                    height: 8,
                                    background: DARK_THEME.border,
                                    borderRadius: 14,
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{
                                        height: '100%',
                                        width: `${overview?.cacheFillRatio || 0}%`,
                                        background: DARK_THEME.success,
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Operations Chart */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <Zap size={16} /> Operations Per Second
                    </h3>
                    <div className="mongo-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={opsChart}>
                                <defs>
                                    <linearGradient id="opsGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={DARK_THEME.accent} stopOpacity={0.3} />
                                        <stop offset="100%" stopColor={DARK_THEME.accent} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="time" stroke={DARK_THEME.textMuted} />
                                <YAxis stroke={DARK_THEME.textMuted} />
                                <Tooltip content={<ChartTooltip />} />
                                <Area type="monotone" dataKey="ops" stroke={DARK_THEME.accent} fill="url(#opsGrad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Latency Chart */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <Clock size={16} /> Latency Percentiles
                    </h3>
                    <div className="mongo-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={latencyChart}>
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

                {/* Replica Set Status */}
                {replicationStatus && (
                    <div className="mongo-section">
                        <h3 className="mongo-section-title">
                            <Server size={16} /> Replica Set Status
                        </h3>
                        <div className="mongo-card">
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                    gap: 16,
                                }}
                            >
                                {replicationStatus.members?.map((member, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            padding: 12,
                                            background: DARK_THEME.bg,
                                            border: `1px solid ${DARK_THEME.border}`,
                                            borderRadius: 8,
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                                            <div
                                                className={`mongo-status-indicator mongo-status-${member.state === 'PRIMARY' ? 'healthy' : 'healthy'}`}
                                            />
                                            <span style={{ fontWeight: 600, color: DARK_THEME.text, fontSize: 13 }}>
                                                {member.name}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 12, color: DARK_THEME.textMuted, marginBottom: 4 }}>
                                            State: <span style={{ color: DARK_THEME.accent }}>{member.state}</span>
                                        </div>
                                        <div style={{ fontSize: 12, color: DARK_THEME.textMuted }}>
                                            Lag: <span style={{ color: DARK_THEME.accent }}>{fmt(member.lag)}s</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div
                                style={{
                                    marginTop: 16,
                                    paddingTop: 16,
                                    borderTop: `1px solid ${DARK_THEME.border}`,
                                    fontSize: 12,
                                    color: DARK_THEME.textMuted,
                                }}
                            >
                                Oplog Window:{' '}
                                <span style={{ color: DARK_THEME.accent, fontWeight: 600 }}>
                                    {replicationStatus.oplogWindow} seconds
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Active Alerts */}
                {alerts.length > 0 && (
                    <div className="mongo-section">
                        <h3 className="mongo-section-title">
                            <AlertTriangle size={16} /> Active Alerts ({alerts.length})
                        </h3>
                        <div>
                            {alerts.map((alert) => (
                                <div key={alert.id} className="mongo-card" style={{ marginBottom: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                        <div className={`mongo-alert-badge mongo-alert-${alert.severity}`}>
                                            {alert.severity.toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: DARK_THEME.text }}>
                                                {alert.message}
                                            </div>
                                            <div style={{ fontSize: 11, color: DARK_THEME.textMuted, marginTop: 4 }}>
                                                {new Date(alert.time).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
