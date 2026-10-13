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
import { HardDrive, AlertTriangle, TrendingUp, AlertCircle, Zap, Check, Eye, EyeOff } from 'lucide-react';

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
            padding: 4px 8px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            margin-right: 4px;
        }

        .mongo-badge-success {
            background: ${DARK_THEME.success}20;
            color: ${DARK_THEME.success};
        }

        .mongo-badge-warning {
            background: ${DARK_THEME.warning}20;
            color: ${DARK_THEME.warning};
        }

        .mongo-badge-danger {
            background: ${DARK_THEME.danger}20;
            color: ${DARK_THEME.danger};
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
/* MONGO STORAGE TAB COMPONENT */
/* ═══════════════════════════════════════════════════════════════════════════ */
export default function MongoStorageTab() {
    const [indexStats, setIndexStats] = useState({});
    const [collections, setCollections] = useState([]);
    const [wiredTiger, setWiredTiger] = useState({});
    const [capacityPlan, setCapacityPlan] = useState({});
    const [growthChart, setGrowthChart] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const pollIntervalRef = useRef(null);

    const loadData = useCallback(async () => {
        try {
            setError(null);
            const [idx, coll, wt, cap, growth] = await Promise.all([
                fetchData('/api/mongodb/index-stats').catch(() => null),
                fetchData('/api/mongodb/collection-stats').catch(() => null),
                fetchData('/api/mongodb/wiredtiger').catch(() => null),
                fetchData('/api/mongodb/capacity-plan').catch(() => null),
                fetchData('/api/mongodb/growth-chart').catch(() => null),
            ]);

            setIndexStats(
                idx || {
                    totalIndexes: 0,
                    unusedIndexes: 0,
                    collscanPercent: 0,
                    indexSize: 0,
                    indexMaintenance: 0,
                },
            );

            setCollections(coll || []);

            setWiredTiger(
                wt || {
                    cacheSize: 0,
                    cacheFilled: 0,
                    cacheDirty: 0,
                    cacheHitRatio: 0,
                    pageReadCount: 0,
                    pageWriteCount: 0,
                    evictionRate: 0,
                },
            );

            setCapacityPlan(
                cap || {
                    totalSize: 0,
                    growthRate: 0,
                    daysUntilFull: 0,
                    diskTotal: 0,
                    diskUsed: 0,
                },
            );

            setGrowthChart(growth || []);
        } catch (err) {
            setError(err.message || 'Failed to load storage data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
        pollIntervalRef.current = setInterval(loadData, 60000);
        return () => clearInterval(pollIntervalRef.current);
    }, [loadData]);

    if (loading) {
        return (
            <>
                <Styles />
                <div style={{ padding: 40, textAlign: 'center' }}>
                    <div className="mongo-loading">
                        <HardDrive className="mongo-spinner" size={20} />
                        Loading storage metrics...
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

                {/* Index Advisor */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <Zap size={16} /> Index Analysis
                    </h3>
                    <div className="mongo-card">
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                gap: 22,
                                marginBottom: 16,
                            }}
                        >
                            <div className="mongo-metric-box">
                                <div className="mongo-metric-label">Total Indexes</div>
                                <div className="mongo-metric-value">{indexStats.totalIndexes}</div>
                            </div>
                            <div className="mongo-metric-box">
                                <div className="mongo-metric-label">Unused Indexes</div>
                                <div className="mongo-metric-value" style={{ color: DARK_THEME.warning }}>
                                    {indexStats.unusedIndexes}
                                </div>
                            </div>
                            <div className="mongo-metric-box">
                                <div className="mongo-metric-label">COLLSCAN Rate</div>
                                <div className="mongo-metric-value" style={{ color: DARK_THEME.danger }}>
                                    {fmt(indexStats.collscanPercent)}%
                                </div>
                            </div>
                            <div className="mongo-metric-box">
                                <div className="mongo-metric-label">Index Size</div>
                                <div className="mongo-metric-value">{fmt(indexStats.indexSize)} MB</div>
                            </div>
                        </div>
                        {indexStats.unusedIndexes > 0 && (
                            <div className="mongo-info-box">
                                <AlertTriangle
                                    size={14}
                                    style={{ display: 'inline-block', marginRight: 8, verticalAlign: 'text-top' }}
                                />
                                {indexStats.unusedIndexes} unused indexes consuming{' '}
                                {Math.round((indexStats.unusedIndexes / indexStats.totalIndexes) * 100)}% of index
                                storage. Consider dropping them to improve write performance.
                            </div>
                        )}
                    </div>
                </div>

                {/* Collection Statistics */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <HardDrive size={16} /> Collection Statistics
                    </h3>
                    <div className="mongo-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <table className="mongo-table">
                            <thead className="mongo-table-head">
                                <tr>
                                    <th>Collection</th>
                                    <th>Size (MB)</th>
                                    <th>Documents</th>
                                    <th>Avg Doc Size</th>
                                    <th>Indexes</th>
                                </tr>
                            </thead>
                            <tbody className="mongo-table-body">
                                {collections.map((coll) => (
                                    <tr key={coll.name}>
                                        <td style={{ fontWeight: 600 }}>{coll.name}</td>
                                        <td>{fmt(coll.size)}</td>
                                        <td>{fmt(coll.count)}</td>
                                        <td>{fmt(coll.avgDocSize)} bytes</td>
                                        <td>{coll.indexes}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* WiredTiger Cache Metrics */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <Zap size={16} /> WiredTiger Cache
                    </h3>
                    <div className="mongo-card">
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: 22,
                                marginBottom: 16,
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
                                    Size
                                </div>
                                <div
                                    style={{ fontSize: 18, fontWeight: 700, color: DARK_THEME.accent, marginBottom: 8 }}
                                >
                                    {fmt(wiredTiger.cacheFilled)} / {fmt(wiredTiger.cacheSize)} MB
                                </div>
                                <div
                                    style={{
                                        height: 8,
                                        background: DARK_THEME.border,
                                        borderRadius: 20,
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div
                                        style={{
                                            height: '100%',
                                            width: `${(wiredTiger.cacheFilled / wiredTiger.cacheSize) * 100}%`,
                                            background: DARK_THEME.success,
                                        }}
                                    />
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
                                    Dirty Pages
                                </div>
                                <div
                                    style={{
                                        fontSize: 18,
                                        fontWeight: 700,
                                        color: DARK_THEME.warning,
                                        marginBottom: 8,
                                    }}
                                >
                                    {fmt(wiredTiger.cacheDirty)} MB
                                </div>
                                <div
                                    style={{
                                        height: 8,
                                        background: DARK_THEME.border,
                                        borderRadius: 20,
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div
                                        style={{
                                            height: '100%',
                                            width: `${(wiredTiger.cacheDirty / wiredTiger.cacheSize) * 100}%`,
                                            background: DARK_THEME.warning,
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="mongo-metric-box">
                                <div className="mongo-metric-label">Hit Ratio</div>
                                <div className="mongo-metric-value" style={{ color: DARK_THEME.success }}>
                                    {(wiredTiger.cacheHitRatio * 100).toFixed(1)}%
                                </div>
                            </div>
                            <div className="mongo-metric-box">
                                <div className="mongo-metric-label">Eviction Rate</div>
                                <div className="mongo-metric-value">{fmt(wiredTiger.evictionRate)}/s</div>
                            </div>
                        </div>
                        <div style={{ paddingTop: 16, borderTop: `1px solid ${DARK_THEME.border}` }}>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                    gap: 22,
                                }}
                            >
                                <div>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            color: DARK_THEME.textMuted,

                                            marginBottom: 4,
                                        }}
                                    >
                                        Page Reads
                                    </div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: DARK_THEME.text }}>
                                        {fmt(wiredTiger.pageReadCount)}
                                    </div>
                                </div>
                                <div>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            color: DARK_THEME.textMuted,

                                            marginBottom: 4,
                                        }}
                                    >
                                        Page Writes
                                    </div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: DARK_THEME.text }}>
                                        {fmt(wiredTiger.pageWriteCount)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Storage Growth Chart */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <TrendingUp size={16} /> Storage Growth
                    </h3>
                    <div className="mongo-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={growthChart}>
                                <defs>
                                    <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={DARK_THEME.accent} stopOpacity={0.3} />
                                        <stop offset="100%" stopColor={DARK_THEME.accent} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" stroke={DARK_THEME.textMuted} />
                                <YAxis stroke={DARK_THEME.textMuted} />
                                <Tooltip content={<ChartTooltip />} />
                                <Line
                                    type="monotone"
                                    dataKey="size"
                                    stroke={DARK_THEME.accent}
                                    strokeWidth={2}
                                    name="Size (MB)"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Capacity Planning */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <TrendingUp size={16} /> Capacity Planning
                    </h3>
                    <div className="mongo-card">
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: 22,
                                marginBottom: 16,
                            }}
                        >
                            <div className="mongo-metric-box">
                                <div className="mongo-metric-label">Growth Rate</div>
                                <div className="mongo-metric-value">{fmt(capacityPlan.growthRate)} MB/month</div>
                            </div>
                            <div className="mongo-metric-box">
                                <div className="mongo-metric-label">Days Until Full</div>
                                <div
                                    className="mongo-metric-value"
                                    style={{
                                        color: capacityPlan.daysUntilFull < 30 ? DARK_THEME.danger : DARK_THEME.success,
                                    }}
                                >
                                    {capacityPlan.daysUntilFull}
                                </div>
                            </div>
                            <div className="mongo-metric-box">
                                <div className="mongo-metric-label">Disk Used</div>
                                <div className="mongo-metric-value">
                                    {((capacityPlan.diskUsed / capacityPlan.diskTotal) * 100).toFixed(0)}%
                                </div>
                            </div>
                        </div>

                        <div style={{ fontSize: 12, color: DARK_THEME.text, lineHeight: 1.6 }}>
                            <div style={{ marginBottom: 12 }}>
                                <strong>Current Usage:</strong> {fmt(capacityPlan.diskUsed)} /{' '}
                                {fmt(capacityPlan.diskTotal)} GB
                            </div>
                            <div
                                style={{
                                    height: 12,
                                    background: DARK_THEME.border,
                                    borderRadius: 18,
                                    overflow: 'hidden',
                                    marginBottom: 12,
                                }}
                            >
                                <div
                                    style={{
                                        height: '100%',
                                        width: `${(capacityPlan.diskUsed / capacityPlan.diskTotal) * 100}%`,
                                        background: `linear-gradient(90deg, ${DARK_THEME.success} 0%, ${DARK_THEME.warning} 70%, ${DARK_THEME.danger} 100%)`,
                                    }}
                                />
                            </div>
                            <div style={{ fontSize: 11, color: DARK_THEME.textMuted }}>
                                At current growth rate of {fmt(capacityPlan.growthRate)} MB/month, your storage will
                                reach capacity in approximately {capacityPlan.daysUntilFull} days.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
