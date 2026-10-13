import React, { useState, useEffect } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { fetchData } from '../../../utils/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
    Box,
    Server,
    Cpu,
    MemoryStick,
    Network,
    Activity,
    CheckCircle,
    XCircle,
    RefreshCw,
    AlertTriangle,
} from 'lucide-react';

/* ── Styles ───────────────────────────────────────────────────────────────── */
const Styles = () => (
    <style>{`
        @keyframes kSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes kFade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .k-card {
            background: linear-gradient(180deg, ${THEME.surface} 0%, ${THEME.surface}f8 100%);
            border: 1px solid ${THEME.glassBorder};
            border-radius: 20px;
            padding: 24px;
            position: relative;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
            transition: all 0.25s ease;
            animation: kFade 0.3s ease;
            backdrop-filter: blur(12px);
        }
        .k-card:hover {
            box-shadow: 0 8px 28px rgba(0,0,0,0.12);
            transform: translateY(-4px);
        }
        .k-card::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: var(--tile-accent, ${THEME.primary});
            opacity: 0.7;
        }
        .k-label { font-size:12px; font-weight:700; color:${THEME.textMuted}; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; }
        .k-metric { background:${THEME.grid}; border:1px solid ${THEME.glassBorder}; border-radius: 20px; padding:16px; margin-bottom:12px; }
        .k-progress-bar { width:100%; height:8px; background:${THEME.grid}; border-radius: 20px; overflow:hidden; margin-top:8px; }
        .k-progress-fill { height:100%; border-radius: 20px; }
        .k-row { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:20px; margin-bottom:16px; }
        .k-status-ok { color:${THEME.success}; }
        .k-status-fail { color:${THEME.danger}; }
        .k-spinner { animation:kSpin 1s linear infinite; }
        .k-table { width:100%; border-collapse:collapse; font-size:13px; }
        .k-table th { text-align:left; padding:12px; border-bottom:1px solid ${THEME.glassBorder}; color:${THEME.textMuted}; font-weight:700; }
        .k-table td { padding:12px; border-bottom:1px solid ${THEME.glassBorder}40; }
        .k-table tr:hover { background:${THEME.grid}30; }
    `}</style>
);

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const fmt = (n) => (n === null ? '—' : Number(n).toLocaleString());
const fmtBytes = (b) => {
    if (b === null) return '—';
    const n = Number(b);
    if (n < 1024) return `${n}B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)}MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(1)}GB`;
};

const ChartTip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div
            style={{
                background: THEME.surface,
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: 16,
                padding: '8px 12px',
                fontSize: 12,
                boxShadow: THEME.shadowSm,
            }}
        >
            <div style={{ color: THEME.textMuted, marginBottom: 4 }}>{label}</div>
            {payload.map((p) => (
                <div key={p.name} style={{ color: p.color, fontWeight: 600 }}>
                    {p.name}: {p.value}%
                </div>
            ))}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   KUBERNETES TAB
   ═══════════════════════════════════════════════════════════════════════════ */
export default function KubernetesTab() {
    useAdaptiveTheme();
    const [podInfo, setPodInfo] = useState(null);
    const [metrics, setMetrics] = useState(null);
    const [resources, setResources] = useState(null);
    const [connections, setConnections] = useState([]);
    const [topology, setTopology] = useState(null);
    const [historyData, setHistoryData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [k8sDetected, setK8sDetected] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const [pods, met, res, conns, topo, hist] = await Promise.all([
                    fetchData('/api/k8s/pod-info').catch(() => null),
                    fetchData('/api/k8s/metrics').catch(() => null),
                    fetchData('/api/k8s/resources').catch(() => null),
                    fetchData('/api/k8s/connections').catch(() => null),
                    fetchData('/api/k8s/topology').catch(() => null),
                    fetchData('/api/k8s/resources?history=true').catch(() => null),
                ]);

                if (!pods && !met) {
                    setK8sDetected(false);
                    setError(null);
                } else {
                    setPodInfo(pods);
                    setMetrics(met);
                    setResources(res);
                    setConnections(conns?.connections || []);
                    setTopology(topo);
                    setHistoryData(hist?.history || []);
                    setError(null);
                }
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) {
        return (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <Styles />
                <RefreshCw size={32} color={THEME.primary} className="k-spinner" style={{ margin: '0 auto 16px' }} />
                <div style={{ color: THEME.textMuted }}>Loading Kubernetes data...</div>
            </div>
        );
    }

    if (!k8sDetected) {
        return (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <AlertTriangle size={48} color={THEME.warning} style={{ margin: '0 auto 16px' }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: THEME.textMain, marginBottom: 8 }}>
                    Not Detected
                </div>
                <div style={{ color: THEME.textMuted, fontSize: 13 }}>
                    PostgreSQL is not running in a Kubernetes cluster. This monitoring view is only available for
                    containerized deployments.
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '0 0 20px 0' }}>
            <Styles />

            {error && (
                <div
                    style={{
                        background: `${THEME.danger}15`,
                        border: `1px solid ${THEME.danger}40`,
                        borderRadius: 18,
                        padding: '12px 16px',
                        marginBottom: 20,
                        color: THEME.danger,
                        fontSize: 13,
                    }}
                >
                    <AlertTriangle
                        size={16}
                        style={{ display: 'inline-block', marginRight: 8, verticalAlign: 'middle' }}
                    />
                    {error}
                </div>
            )}

            {/* Pod Info Card */}
            {podInfo && (
                <div className="k-card" style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: THEME.textMain, marginBottom: 16 }}>
                        <Box size={18} style={{ display: 'inline-block', marginRight: 10, verticalAlign: 'middle' }} />
                        Pod Information
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 22 }}>
                        <div>
                            <div className="k-label">Pod Name</div>
                            <div style={{ fontSize: 14, color: THEME.textMain, fontWeight: 600 }}>
                                {podInfo.name || '—'}
                            </div>
                        </div>
                        <div>
                            <div className="k-label">Namespace</div>
                            <div style={{ fontSize: 14, color: THEME.textMain, fontWeight: 600 }}>
                                {podInfo.namespace || '—'}
                            </div>
                        </div>
                        <div>
                            <div className="k-label">Node</div>
                            <div style={{ fontSize: 14, color: THEME.textMain, fontWeight: 600 }}>
                                {podInfo.node || '—'}
                            </div>
                        </div>
                        <div>
                            <div className="k-label">Container ID</div>
                            <div style={{ fontSize: 12, color: THEME.textMuted, fontFamily: 'monospace' }}>
                                {podInfo.containerId?.substring(0, 20)}...
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Resource Gauges */}
            {resources && (
                <div className="k-card" style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: THEME.textMain, marginBottom: 16 }}>
                        <Activity
                            size={18}
                            style={{ display: 'inline-block', marginRight: 10, verticalAlign: 'middle' }}
                        />
                        Resource Usage
                    </div>
                    <div className="k-row">
                        <div className="k-metric">
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: 10,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                    <Cpu size={16} color={THEME.primary} />
                                    <div className="k-label" style={{ marginBottom: 0 }}>
                                        CPU Usage
                                    </div>
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: THEME.primary }}>
                                    {fmt(resources.cpuUsagePercent)}%
                                </div>
                            </div>
                            <div className="k-progress-bar">
                                <div
                                    className="k-progress-fill"
                                    style={{
                                        width: `${Math.min(resources.cpuUsagePercent, 100)}%`,
                                        background: resources.cpuUsagePercent > 80 ? THEME.danger : THEME.primary,
                                    }}
                                />
                            </div>
                            <div style={{ fontSize: 11, color: THEME.textDim, marginTop: 6 }}>
                                {resources.cpuUsage}m / {resources.cpuLimit}m
                            </div>
                        </div>

                        <div className="k-metric">
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: 10,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                    <MemoryStick size={16} color={THEME.secondary} />
                                    <div className="k-label" style={{ marginBottom: 0 }}>
                                        Memory Usage
                                    </div>
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: THEME.secondary }}>
                                    {fmt(resources.memoryUsagePercent)}%
                                </div>
                            </div>
                            <div className="k-progress-bar">
                                <div
                                    className="k-progress-fill"
                                    style={{
                                        width: `${Math.min(resources.memoryUsagePercent, 100)}%`,
                                        background: resources.memoryUsagePercent > 80 ? THEME.danger : THEME.secondary,
                                    }}
                                />
                            </div>
                            <div style={{ fontSize: 11, color: THEME.textDim, marginTop: 6 }}>
                                {fmtBytes(resources.memoryUsage)} / {fmtBytes(resources.memoryLimit)}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Health Status */}
            {metrics && (
                <div className="k-card" style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: THEME.textMain, marginBottom: 16 }}>
                        <Server
                            size={18}
                            style={{ display: 'inline-block', marginRight: 10, verticalAlign: 'middle' }}
                        />
                        Health Check Status
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
                        <div style={{ background: THEME.grid, borderRadius: 16, padding: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: THEME.textMain }}>
                                Readiness Probe
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                {metrics.readinessProbe ? (
                                    <>
                                        <CheckCircle size={20} className="k-status-ok" />
                                        <span style={{ color: THEME.success, fontWeight: 700 }}>Ready</span>
                                    </>
                                ) : (
                                    <>
                                        <XCircle size={20} className="k-status-fail" />
                                        <span style={{ color: THEME.danger, fontWeight: 700 }}>Not Ready</span>
                                    </>
                                )}
                            </div>
                        </div>
                        <div style={{ background: THEME.grid, borderRadius: 16, padding: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: THEME.textMain }}>
                                Liveness Probe
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                {metrics.livenessProbe ? (
                                    <>
                                        <CheckCircle size={20} className="k-status-ok" />
                                        <span style={{ color: THEME.success, fontWeight: 700 }}>Healthy</span>
                                    </>
                                ) : (
                                    <>
                                        <XCircle size={20} className="k-status-fail" />
                                        <span style={{ color: THEME.danger, fontWeight: 700 }}>Unhealthy</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Connections by Pod */}
            {connections.length > 0 && (
                <div className="k-card" style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: THEME.textMain, marginBottom: 16 }}>
                        <Network
                            size={18}
                            style={{ display: 'inline-block', marginRight: 10, verticalAlign: 'middle' }}
                        />
                        Connections by Pod
                    </div>
                    <table className="k-table">
                        <thead>
                            <tr>
                                <th>Pod Name</th>
                                <th>Active Connections</th>
                                <th>Max Connections</th>
                                <th>Usage %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {connections.map((conn, i) => (
                                <tr key={i}>
                                    <td>{conn.podName}</td>
                                    <td>{fmt(conn.activeConnections)}</td>
                                    <td>{fmt(conn.maxConnections)}</td>
                                    <td style={{ color: conn.usagePercent > 80 ? THEME.warning : THEME.textMain }}>
                                        {fmt(conn.usagePercent)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Replica Topology */}
            {topology && (
                <div className="k-card" style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: THEME.textMain, marginBottom: 16 }}>
                        <Server
                            size={18}
                            style={{ display: 'inline-block', marginRight: 10, verticalAlign: 'middle' }}
                        />
                        Replica Topology
                    </div>
                    <div style={{ background: THEME.grid, borderRadius: 16, padding: 16, textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: THEME.primary, marginBottom: 16 }}>
                            {topology.primary}
                        </div>
                        <div style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 12 }}>Primary</div>
                        {topology.replicas && topology.replicas.length > 0 && (
                            <>
                                <div style={{ fontSize: 20, color: THEME.textDim, marginBottom: 12 }}>↓</div>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: `repeat(${Math.min(topology.replicas.length, 3)}, 1fr)`,
                                        gap: 18,
                                    }}
                                >
                                    {topology.replicas.map((rep, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                background: THEME.surfaceHover,
                                                borderRadius: 20,
                                                padding: 8,
                                                fontSize: 12,
                                                color: THEME.secondary,
                                            }}
                                        >
                                            {rep}
                                        </div>
                                    ))}
                                </div>
                                <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 12 }}>
                                    {topology.replicas.length} Replicas
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Resource History Chart */}
            {historyData.length > 0 && (
                <div className="k-card">
                    <div style={{ fontSize: 16, fontWeight: 700, color: THEME.textMain, marginBottom: 16 }}>
                        <Activity
                            size={18}
                            style={{ display: 'inline-block', marginRight: 10, verticalAlign: 'middle' }}
                        />
                        Resource History (24h)
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={historyData}>
                            <XAxis dataKey="timestamp" stroke={THEME.textDim} style={{ fontSize: 12 }} />
                            <YAxis stroke={THEME.textDim} style={{ fontSize: 12 }} />
                            <Tooltip content={<ChartTip />} />
                            <Line
                                type="monotone"
                                dataKey="cpuPercent"
                                stroke={THEME.primary}
                                dot={false}
                                name="CPU %"
                                isAnimationActive={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="memoryPercent"
                                stroke={THEME.secondary}
                                dot={false}
                                name="Memory %"
                                isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
