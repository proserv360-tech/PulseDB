import React, { useState, useEffect, useCallback, useRef } from 'react';
import { THEME } from '../../../utils/theme';
import { fetchData, postData } from '../../../utils/api';
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Legend,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import {
    Network,
    TrendingUp,
    AlertTriangle,
    Activity,
    AlertCircle,
    CheckCircle,
    RefreshCw,
    ArrowRight,
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

        .mongo-shard-box {
            background: ${DARK_THEME.bg};
            border: 1px solid ${DARK_THEME.border};
            border-radius: 20px;
            padding: 20px;
            text-align: center;
        }

        .mongo-metric-box {
            background: ${DARK_THEME.bg};
            border: 1px solid ${DARK_THEME.border};
            border-radius: 20px;
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
            font-size: 20px;
            font-weight: 700;
            color: ${DARK_THEME.accent};
        }

        .mongo-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            margin-right: 4px;
            margin-bottom: 4px;
        }

        .mongo-badge-active {
            background: ${DARK_THEME.success}20;
            color: ${DARK_THEME.success};
        }

        .mongo-badge-inactive {
            background: ${DARK_THEME.danger}20;
            color: ${DARK_THEME.danger};
        }

        .mongo-badge-balancing {
            background: ${DARK_THEME.warning}20;
            color: ${DARK_THEME.warning};
        }

        .mongo-migration-item {
            background: ${DARK_THEME.bg};
            border: 1px solid ${DARK_THEME.border};
            border-left: 3px solid ${DARK_THEME.accent};
            border-radius: 20px;
            padding: 12px;
            margin-bottom: 12px;
            animation: mongoFade 0.3s ease;
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

        .mongo-info-box {
            background: ${DARK_THEME.accent}15;
            border: 1px solid ${DARK_THEME.accent}30;
            border-left: 3px solid ${DARK_THEME.accent};
            border-radius: 20px;
            padding: 12px;
            margin-bottom: 12px;
            font-size: 12px;
            color: ${DARK_THEME.text};
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
/* MONGO SHARDING TAB COMPONENT */
/* ═══════════════════════════════════════════════════════════════════════════ */
export default function MongoShardingTab() {
    const [shards, setShards] = useState([]);
    const [shardStats, setShardStats] = useState({});
    const [chunkDistribution, setChunkDistribution] = useState([]);
    const [balancerStatus, setBalancerStatus] = useState({});
    const [migrations, setMigrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const pollIntervalRef = useRef(null);

    const loadData = useCallback(async () => {
        try {
            setError(null);
            const [shard, stats, chunk, balancer, mig] = await Promise.all([
                fetchData('/api/mongodb/shards').catch(() => null),
                fetchData('/api/mongodb/shard-stats').catch(() => null),
                fetchData('/api/mongodb/chunk-distribution').catch(() => null),
                fetchData('/api/mongodb/balancer-status').catch(() => null),
                fetchData('/api/mongodb/migrations').catch(() => null),
            ]);

            setShards(shard || []);

            setShardStats(
                stats || {
                    totalShards: 0,
                    totalChunks: 0,
                    totalSize: 0,
                    databaseCount: 0,
                    collectionCount: 0,
                    imbalancePercent: 0,
                },
            );

            setChunkDistribution(chunk || []);

            setBalancerStatus(
                balancer || {
                    enabled: false,
                    running: false,
                    balanceStarted: null,
                    balanceCompleted: null,
                    balanceRound: 0,
                    autoBalance: false,
                },
            );

            setMigrations(mig || []);
        } catch (err) {
            setError(err.message || 'Failed to load sharding data');
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
                        <Network className="mongo-spinner" size={20} />
                        Loading sharding topology...
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

                {/* Sharding Overview */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <Network size={16} /> Cluster Overview
                    </h3>
                    <div className="mongo-card">
                        <div className="mongo-grid">
                            <div className="mongo-metric-box">
                                <div className="mongo-metric-label">Total Shards</div>
                                <div className="mongo-metric-value">{shardStats.totalShards}</div>
                            </div>
                            <div className="mongo-metric-box">
                                <div className="mongo-metric-label">Total Chunks</div>
                                <div className="mongo-metric-value">{shardStats.totalChunks}</div>
                            </div>
                            <div className="mongo-metric-box">
                                <div className="mongo-metric-label">Cluster Size</div>
                                <div className="mongo-metric-value">{fmt(shardStats.totalSize)} GB</div>
                            </div>
                            <div className="mongo-metric-box">
                                <div className="mongo-metric-label">Imbalance</div>
                                <div
                                    className="mongo-metric-value"
                                    style={{
                                        color:
                                            shardStats.imbalancePercent > 5 ? DARK_THEME.warning : DARK_THEME.success,
                                    }}
                                >
                                    {shardStats.imbalancePercent}%
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Shard Status */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <Activity size={16} /> Shard Status
                    </h3>
                    <div className="mongo-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <table className="mongo-table">
                            <thead className="mongo-table-head">
                                <tr>
                                    <th>Shard ID</th>
                                    <th>Host</th>
                                    <th>State</th>
                                    <th>Chunks</th>
                                    <th>Size (GB)</th>
                                </tr>
                            </thead>
                            <tbody className="mongo-table-body">
                                {shards.map((shard) => (
                                    <tr key={shard._id}>
                                        <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{shard._id}</td>
                                        <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{shard.host}</td>
                                        <td>
                                            <span
                                                className={`mongo-badge mongo-badge-${shard.state === 'READY' ? 'active' : 'inactive'}`}
                                            >
                                                {shard.state}
                                            </span>
                                        </td>
                                        <td>{shard.chunks}</td>
                                        <td>{fmt(shard.size)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Chunk Distribution */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <TrendingUp size={16} /> Chunk Distribution
                    </h3>
                    <div className="mongo-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={chunkDistribution}>
                                <XAxis dataKey="shard" stroke={DARK_THEME.textMuted} />
                                <YAxis stroke={DARK_THEME.textMuted} />
                                <Tooltip content={<ChartTooltip />} />
                                <Bar dataKey="chunks" fill={DARK_THEME.accent} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Balancer Status */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <CheckCircle size={16} /> Balancer Status
                    </h3>
                    <div className="mongo-card">
                        <div className="mongo-grid">
                            <div
                                style={{
                                    padding: 12,
                                    background: DARK_THEME.bg,
                                    borderRadius: 20,
                                    border: `1px solid ${DARK_THEME.border}`,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                                    <div
                                        style={{
                                            width: 12,
                                            height: 12,
                                            borderRadius: '50%',
                                            background: balancerStatus.enabled ? DARK_THEME.green : DARK_THEME.danger,
                                            marginRight: 8,
                                        }}
                                    />
                                    <span style={{ fontWeight: 600, color: DARK_THEME.text }}>Status</span>
                                </div>
                                <div style={{ fontSize: 12, color: DARK_THEME.textMuted }}>
                                    {balancerStatus.enabled ? 'ENABLED' : 'DISABLED'}
                                </div>
                            </div>

                            <div
                                style={{
                                    padding: 12,
                                    background: DARK_THEME.bg,
                                    borderRadius: 20,
                                    border: `1px solid ${DARK_THEME.border}`,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                                    <div
                                        style={{
                                            width: 12,
                                            height: 12,
                                            borderRadius: '50%',
                                            background: balancerStatus.running
                                                ? DARK_THEME.warning
                                                : DARK_THEME.success,
                                            marginRight: 8,
                                        }}
                                    />
                                    <span style={{ fontWeight: 600, color: DARK_THEME.text }}>Running</span>
                                </div>
                                <div style={{ fontSize: 12, color: DARK_THEME.textMuted }}>
                                    {balancerStatus.running ? 'YES' : 'NO'}
                                </div>
                            </div>

                            <div
                                style={{
                                    padding: 12,
                                    background: DARK_THEME.bg,
                                    borderRadius: 20,
                                    border: `1px solid ${DARK_THEME.border}`,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: DARK_THEME.textMuted,

                                        marginBottom: 4,
                                    }}
                                >
                                    Balance Rounds
                                </div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: DARK_THEME.accent }}>
                                    {balancerStatus.balanceRound}
                                </div>
                            </div>

                            <div
                                style={{
                                    padding: 12,
                                    background: DARK_THEME.bg,
                                    borderRadius: 20,
                                    border: `1px solid ${DARK_THEME.border}`,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: DARK_THEME.textMuted,

                                        marginBottom: 4,
                                    }}
                                >
                                    Last Balanced
                                </div>
                                <div style={{ fontSize: 12, color: DARK_THEME.accent }}>
                                    {new Date(balancerStatus.balanceCompleted).toLocaleTimeString()}
                                </div>
                            </div>
                        </div>

                        {balancerStatus.autoBalance && (
                            <div className="mongo-info-box" style={{ marginTop: 16 }}>
                                Auto-balancing is enabled. The balancer will automatically distribute chunks to maintain
                                cluster balance.
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Migrations */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <ArrowRight size={16} /> Recent Chunk Migrations
                    </h3>
                    <div className="mongo-card">
                        {migrations.length === 0 ? (
                            <div
                                style={{ textAlign: 'center', padding: 20, color: DARK_THEME.textMuted, fontSize: 13 }}
                            >
                                No recent migrations
                            </div>
                        ) : (
                            <div>
                                {migrations.map((mig) => (
                                    <div key={mig._id} className="mongo-migration-item">
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'flex-start',
                                                marginBottom: 8,
                                            }}
                                        >
                                            <div>
                                                <div
                                                    style={{ fontWeight: 700, color: DARK_THEME.text, marginBottom: 4 }}
                                                >
                                                    {mig.ns}
                                                </div>
                                                <div style={{ fontSize: 12, color: DARK_THEME.textMuted }}>
                                                    To:{' '}
                                                    <span style={{ fontFamily: 'monospace', color: DARK_THEME.accent }}>
                                                        {mig.shard}
                                                    </span>
                                                </div>
                                            </div>
                                            <span
                                                className={`mongo-badge mongo-badge-${mig.status === 'completed' ? 'active' : 'balancing'}`}
                                            >
                                                {mig.status.toUpperCase()}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 11, color: DARK_THEME.textMuted }}>
                                            <strong>Chunks:</strong> {mig.chunks.join(', ')} ({mig.chunks.length} total)
                                        </div>
                                        <div style={{ fontSize: 11, color: DARK_THEME.textMuted, marginTop: 4 }}>
                                            {new Date(mig.startTime).toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Collection Sharding Info */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <Database size={16} style={{ display: 'none' }} /> Sharded Collections
                    </h3>
                    <div className="mongo-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <table className="mongo-table">
                            <thead className="mongo-table-head">
                                <tr>
                                    <th>Namespace</th>
                                    <th>Shard Key</th>
                                    <th>Chunks</th>
                                    <th>Docs</th>
                                    <th>Size (MB)</th>
                                </tr>
                            </thead>
                            <tbody className="mongo-table-body">
                                <tr>
                                    <td style={{ fontFamily: 'monospace' }}>mydb.users</td>
                                    <td style={{ fontFamily: 'monospace' }}>{'{ _id: 1 }'}</td>
                                    <td>245</td>
                                    <td>{fmt(2500000)}</td>
                                    <td>{fmt(2048)}</td>
                                </tr>
                                <tr>
                                    <td style={{ fontFamily: 'monospace' }}>mydb.products</td>
                                    <td style={{ fontFamily: 'monospace' }}>{'{ category: 1, _id: 1 }'}</td>
                                    <td>254</td>
                                    <td>{fmt(1800000)}</td>
                                    <td>{fmt(2112)}</td>
                                </tr>
                                <tr>
                                    <td style={{ fontFamily: 'monospace' }}>mydb.orders</td>
                                    <td style={{ fontFamily: 'monospace' }}>{'{ date: 1 }'}</td>
                                    <td>251</td>
                                    <td>{fmt(5600000)}</td>
                                    <td>{fmt(2080)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}
