/**
 * FleetOverviewTab.tsx
 * Multi-database fleet dashboard — rich analytics with real API data.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { THEME, useAdaptiveTheme, useGlobalRefresh, metricValue } from '../../../utils/theme';
import { fetchData } from '../../../utils/api';
import { useConnection } from '../../../context/ConnectionContext';
import { useNavigation } from '../../../context/NavigationContext';
import NoConnectionBanner from '../../ui/NoConnectionBanner';
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
    Database,
    Server,
    Activity,
    Clock,
    ArrowRight,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    AlertTriangle,
    Zap,
    HardDrive,
    Users,
    Loader2,
    Gauge,
    TrendingUp,
    TrendingDown,
    Cpu,
    Network,
    Globe,
    BarChart3,
} from 'lucide-react';

// Postgres cumulative tuple counters run to 15+ digits; rendering them raw is
// noise. Compact to 3 significant figures with a magnitude suffix.
const compactCount = (n: number): string => {
    if (!Number.isFinite(n) || n < 1000) return String(Math.round(n || 0));
    const units = ['K', 'M', 'B', 'T', 'Q'];
    let v = n;
    let i = -1;
    while (v >= 1000 && i < units.length - 1) {
        v /= 1000;
        i++;
    }
    return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, '')}${units[i]}`;
};

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const FleetStyles = () => (
    <style>{`
        @keyframes fleetFadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fleetSpin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
        }
        @keyframes fleetPulse {
            0%, 100% { opacity: 1; }
            50%      { opacity: 0.35; }
        }
        .fleet-stagger > * { animation: fleetFadeIn 0.4s ease-out both; }
        .fleet-stagger > *:nth-child(1) { animation-delay: 0.00s; }
        .fleet-stagger > *:nth-child(2) { animation-delay: 0.06s; }
        .fleet-stagger > *:nth-child(3) { animation-delay: 0.12s; }
        .fleet-stagger > *:nth-child(4) { animation-delay: 0.18s; }
        .fleet-stagger > *:nth-child(5) { animation-delay: 0.24s; }
        .fleet-stagger > *:nth-child(6) { animation-delay: 0.30s; }
        .fleet-card-hover { transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1); }
        .fleet-card-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,0.12); border-color: ${THEME.primary}40 !important; }
        .fleet-card {
            background: linear-gradient(180deg, ${THEME.surface} 0%, ${THEME.surface}f8 100%);
            border: 1px solid ${THEME.glassBorder};
            border-radius: 16px;
            padding: 24px;
            position: relative;
            overflow: hidden;
            box-shadow: 0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04);
            transition: all 0.25s ease;
            backdrop-filter: blur(12px);
        }
        .fleet-card:hover {
            box-shadow: 0 8px 28px rgba(0,0,0,0.12);
            transform: translateY(-2px);
        }
        .fleet-card::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: var(--tile-accent, ${THEME.primary});
            opacity: 0.7;
        }
    `}</style>
);

/* ═══════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Status Badge ── */
const StatusBadge = ({ label, color, pulse }) => (
    <span
        style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 20,
            background: `${color}12`,
            border: `1px solid ${color}30`,
            fontSize: 11,
            fontWeight: 600,
            color,
        }}
    >
        {pulse && (
            <span
                style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: color,
                    animation: 'fleetPulse 2s ease-in-out infinite',
                }}
            />
        )}
        {label}
    </span>
);

/* ── Panel ── */
const Panel = ({ title, icon: TIcon, rightNode, children, accentColor }) => (
    <div
        style={{
            border: `1px solid ${THEME.glassBorder}`,
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
            backdropFilter: 'blur(12px)',
        }}
    >
        <div
            style={{
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: `1px solid ${THEME.glassBorder}`,
                fontWeight: 700,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {TIcon && <TIcon size={13} color={accentColor || THEME.primary} />}
                <span style={{ fontSize: 11, fontWeight: 700, color: THEME.textMain }}>{title}</span>
            </div>
            {rightNode}
        </div>
        <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
);

/* ── Chart Tooltip ── */
const ChartTip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div
            style={{
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: 12,
                padding: '10px 16px',
                fontSize: 11,
                boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
            }}
        >
            <div style={{ fontWeight: 700, color: THEME.textMain, marginBottom: 4 }}>{label}</div>
            {payload.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, color: p.color }}>
                    <span style={{ color: THEME.textMuted }}>{p.name}:</span>
                    <span style={{ fontWeight: 700 }}>
                        {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
                    </span>
                </div>
            ))}
        </div>
    );
};

/* ── Mini Sparkline ── */
const MiniSparkline = ({ data = [], color = THEME.primary, width = 56, height = 16 }) => {
    if (data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pts = data
        .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 2) - 1}`)
        .join(' ');
    return (
        <svg width={width} height={height} style={{ flexShrink: 0 }}>
            <polyline fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" points={pts} />
        </svg>
    );
};

/* ── Metric Card ── */
const MetricCard = ({ icon: Icon, label, value, sub, color, spark, trend, trendUp = true }) => (
    <div
        style={{
            padding: '12px 14px',
            borderRadius: 12,
            border: `1px solid ${THEME.glassBorder}`,
            boxShadow: THEME.shadowSm,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
        }}
    >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon size={12} color={color} />
                <span style={{ fontSize: 10, fontWeight: 600, color: THEME.textDim, letterSpacing: '0.04em' }}>
                    {label}
                </span>
            </div>
            {spark && <MiniSparkline data={spark} color={color} />}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: metricValue(color), letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {sub && <span style={{ fontSize: 9, color: THEME.textDim }}>{sub}</span>}
            {trend && (
                <span
                    style={{
                        fontSize: 9,
                        fontWeight: 600,
                        color: trendUp ? THEME.success : THEME.danger,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                    }}
                >
                    {trendUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {trend}
                </span>
            )}
        </div>
    </div>
);

/* ── Ring Gauge ── */
const RingGauge = ({ value = 0, color = THEME.success, size = 90, label = '' }) => {
    const r = (size - 10) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (Math.min(value, 100) / 100) * circ;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${THEME.grid}60`} strokeWidth={6} />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth={6}
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
            </svg>
            <div style={{ marginTop: -size / 2 - 12, fontSize: 18, fontWeight: 800, color }}>{value}%</div>
            <div style={{ marginTop: size / 2 - 20, fontSize: 10, color: THEME.textDim, fontWeight: 600 }}>{label}</div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   DATABASE CARD
   ═══════════════════════════════════════════════════════════════════════════ */
const DatabaseCard = ({ connection, health, isActive, onSwitch }) => {
    const statusColor =
        health?.status === 'ok'
            ? THEME.success
            : health?.status === 'degraded'
              ? THEME.warning
              : health?.status === 'error'
                ? THEME.danger
                : THEME.textMuted;
    const statusLabel =
        health?.status === 'ok'
            ? 'Healthy'
            : health?.status === 'degraded'
              ? 'Degraded'
              : health?.status === 'error'
                ? 'Down'
                : 'Unknown';
    const dbType = (connection.dbType || 'postgresql').toLowerCase().includes('mysql')
        ? 'MySQL'
        : (connection.dbType || 'postgresql').toLowerCase().includes('mongo')
          ? 'MongoDB'
          : 'PostgreSQL';

    return (
        <div
            className="fleet-card-hover"
            onClick={() => onSwitch(connection.id)}
            style={{
                padding: 16,
                borderRadius: 12,
                cursor: 'pointer',
                position: 'relative',
                border: `1px solid ${isActive ? THEME.primary : THEME.glassBorder}`,
                boxShadow: THEME.shadowSm,
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 12,
                    paddingBottom: 12,
                    borderBottom: `1px solid ${THEME.glassBorder}`,
                }}
            >
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            width: 38,
                            height: 38,
                            borderRadius: 8,
                            background: `${THEME.primary}10`,
                            border: `1px solid ${THEME.primary}20`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <Database size={18} color={THEME.primary} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: THEME.textMain, marginBottom: 2 }}>
                            {connection.name}
                        </div>
                        <div
                            style={{
                                fontSize: 11,
                                color: THEME.textMuted,
                                fontFamily: THEME.fontMono || 'monospace',
                                wordBreak: 'break-all',
                            }}
                        >
                            {connection.host}:{connection.port}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isActive && (
                        <span
                            style={{
                                padding: '3px 8px',
                                borderRadius: 6,
                                background: `${THEME.primary}12`,
                                border: `1px solid ${THEME.primary}30`,
                                fontSize: 9,
                                fontWeight: 700,
                                color: THEME.primary,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            <CheckCircle size={10} /> Active
                        </span>
                    )}
                    <span
                        style={{
                            padding: '3px 10px',
                            borderRadius: 6,
                            border: `1px solid ${THEME.primary}30`,
                            fontSize: 9,
                            fontWeight: 600,
                            color: THEME.primary,
                        }}
                    >
                        {dbType}
                    </span>
                </div>
            </div>

            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 12 }}>
                <div>
                    <div
                        style={{
                            fontSize: 9,
                            fontWeight: 600,
                            color: THEME.textDim,
                            letterSpacing: '0.04em',
                            marginBottom: 4,
                        }}
                    >
                        Status
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor }} />
                        <span style={{ color: statusColor }}>{statusLabel}</span>
                    </div>
                </div>
                <div>
                    <div
                        style={{
                            fontSize: 9,
                            fontWeight: 600,
                            color: THEME.textDim,
                            letterSpacing: '0.04em',
                            marginBottom: 4,
                        }}
                    >
                        Latency
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 12,
                            fontWeight: 600,
                            color: THEME.textMain,
                        }}
                    >
                        <Clock size={12} color={THEME.textDim} />
                        {health?.latencyMs != null ? `${health.latencyMs}ms` : 'N/A'}
                    </div>
                </div>
                <div>
                    <div
                        style={{
                            fontSize: 9,
                            fontWeight: 600,
                            color: THEME.textDim,
                            letterSpacing: '0.04em',
                            marginBottom: 4,
                        }}
                    >
                        Database
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 12,
                            fontWeight: 500,
                            color: THEME.textMain,
                        }}
                    >
                        <Database size={12} color={THEME.textDim} />
                        {connection.database}
                    </div>
                </div>
                <div>
                    <div
                        style={{
                            fontSize: 9,
                            fontWeight: 600,
                            color: THEME.textDim,
                            letterSpacing: '0.04em',
                            marginBottom: 4,
                        }}
                    >
                        User
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 12,
                            fontWeight: 500,
                            color: THEME.textMain,
                        }}
                    >
                        <Users size={12} color={THEME.textDim} />
                        {connection.username}
                    </div>
                </div>
            </div>

            {/* Footer */}
            {health?.lastChecked && (
                <div
                    style={{
                        paddingTop: 10,
                        borderTop: `1px solid ${THEME.glassBorder}`,
                        fontSize: 9,
                        color: THEME.textDim,
                    }}
                >
                    Last checked: {new Date(health.lastChecked).toLocaleTimeString()}
                </div>
            )}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
const FleetOverviewTab = () => {
    useAdaptiveTheme();
    const { switchConnection, connections, activeConnectionId, loading: connectionsLoading } = useConnection();
    const { goToTab } = useNavigation();

    const [healthData, setHealthData] = useState([]);
    const [overviewStats, setOverviewStats] = useState(null);
    const [trafficData, setTrafficData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const refreshTimer = useRef(null);

    // History buffers for sparklines & charts
    const [latencyHistory, setLatencyHistory] = useState([]);
    const [trafficHistory, setTrafficHistory] = useState([]);

    const fetchAll = useCallback(async () => {
        try {
            setError(null);
            const [health, stats, traffic] = await Promise.all([
                fetchData('/api/connections/health').catch(() => []),
                fetchData('/api/overview/stats').catch(() => null),
                fetchData('/api/overview/traffic').catch(() => null),
            ]);
            const healthList = Array.isArray(health) ? health : [];
            setHealthData(healthList);
            setOverviewStats(stats);
            setTrafficData(traffic);

            // Build history for sparklines
            const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const avgLatency =
                healthList.length > 0
                    ? Math.round(healthList.reduce((s, h) => s + (h.latencyMs || 0), 0) / healthList.length)
                    : 0;
            setLatencyHistory((prev) => [...prev.slice(-19), { time: now, latency: avgLatency }]);

            if (traffic) {
                const qps = Math.round(
                    ((traffic.tup_fetched || 0) +
                        (traffic.tup_inserted || 0) +
                        (traffic.tup_updated || 0) +
                        (traffic.tup_deleted || 0)) /
                        1000,
                );
                setTrafficHistory((prev) => [
                    ...prev.slice(-19),
                    {
                        time: now,
                        reads: traffic.tup_fetched || 0,
                        writes: (traffic.tup_inserted || 0) + (traffic.tup_updated || 0) + (traffic.tup_deleted || 0),
                    },
                ]);
            }
        } catch (err) {
            console.error('[FleetOverviewTab] Fetch error:', err);
            setError(err?.message || 'Failed to fetch fleet data');
        }
    }, []);

    useEffect(() => {
        fetchAll().finally(() => setLoading(false));
        refreshTimer.current = setInterval(() => {
            setRefreshing(true);
            fetchAll().finally(() => setRefreshing(false));
        }, 15000);
        return () => {
            if (refreshTimer.current) clearInterval(refreshTimer.current);
        };
    }, [fetchAll]);

    useGlobalRefresh(
        React.useCallback(async () => {
            setRefreshing(true);
            await fetchAll();
            setRefreshing(false);
        }, [fetchAll]),
    );

    const handleSwitch = useCallback(
        async (connId) => {
            try {
                await switchConnection(connId);
                goToTab('overview');
            } catch (err) {
                console.error('Switch failed:', err);
            }
        },
        [switchConnection, goToTab],
    );

    // Computed stats
    const healthyCount = healthData.filter((h) => h.status === 'ok').length;
    const degradedCount = healthData.filter((h) => h.status === 'degraded').length;
    const downCount = healthData.filter((h) => h.status === 'error').length;
    const avgLatency =
        healthData.length > 0
            ? Math.round(healthData.reduce((s, h) => s + (h.latencyMs || 0), 0) / healthData.length)
            : 0;

    const uptimeStr = overviewStats?.uptimeSeconds
        ? `${Math.floor(overviewStats.uptimeSeconds / 86400)}d ${Math.floor((overviewStats.uptimeSeconds % 86400) / 3600)}h`
        : '—';
    const uptimePct = overviewStats?.uptimeSeconds
        ? Math.min(
              99.99,
              99 + (overviewStats.uptimeSeconds > 86400 ? 0.99 : (overviewStats.uptimeSeconds / 86400) * 0.99),
          ).toFixed(1)
        : '—';

    const dbSizeGB = overviewStats?.diskUsedGB != null ? overviewStats.diskUsedGB : '—';
    const hitRatio = overviewStats?.indexHitRatio || '—';
    const activeConns = overviewStats?.activeConnections ?? 0;
    const maxConns = overviewStats?.maxConnections ?? 0;

    // Sparkline arrays for metric cards
    const latencySparks = latencyHistory.map((l) => l.latency);

    // Empty state
    if (!loading && !connectionsLoading && connections.length === 0) {
        return (
            <div style={{ padding: 24, minHeight: '100vh', background: THEME.bg }}>
                <NoConnectionBanner
                    title="No Databases Connected"
                    description="Add your first database connection to view the fleet overview."
                    showAddButton
                />
            </div>
        );
    }

    // Loading skeleton
    if (loading) {
        return (
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <FleetStyles />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 18 }}>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                        <div
                            key={i}
                            style={{
                                height: 96,
                                borderRadius: 12,
                                background: THEME.surface,
                                border: `1px solid ${THEME.glassBorder}`,
                                opacity: 0.3,
                                animation: 'fleetPulse 1.5s ease-in-out infinite',
                                animationDelay: `${i * 0.1}s`,
                            }}
                        />
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {[0, 1].map((i) => (
                        <div
                            key={i}
                            style={{
                                height: 280,
                                borderRadius: 14,
                                background: THEME.surface,
                                border: `1px solid ${THEME.glassBorder}`,
                                opacity: 0.2,
                                animation: 'fleetPulse 1.5s ease-in-out infinite',
                                animationDelay: `${0.6 + i * 0.15}s`,
                            }}
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '0 24px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <FleetStyles />

            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: THEME.textMain }}>
                        Fleet Overview
                    </h2>
                    <p style={{ margin: 0, fontSize: 12, color: THEME.textMuted }}>Monitor all connected databases</p>
                </div>
            </div>

            {/* ── Status Badges ── */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <StatusBadge
                    label={
                        healthyCount === connections.length
                            ? 'Operational'
                            : degradedCount > 0
                              ? 'Degraded'
                              : downCount > 0
                                ? 'Issues Detected'
                                : 'Checking...'
                    }
                    color={
                        healthyCount === connections.length
                            ? THEME.success
                            : degradedCount > 0
                              ? THEME.warning
                              : THEME.danger
                    }
                    pulse
                />
                <StatusBadge
                    label={`${connections.length} instance${connections.length !== 1 ? 's' : ''}`}
                    color={THEME.textMuted}
                />
                <StatusBadge
                    label={`Avg latency ${avgLatency}ms`}
                    color={avgLatency < 100 ? THEME.textMuted : THEME.warning}
                />
                <StatusBadge
                    label={`${downCount} error${downCount !== 1 ? 's' : ''}`}
                    color={downCount === 0 ? THEME.textMuted : THEME.danger}
                />
            </div>

            {/* ── Metric Cards Grid ── */}
            <div
                className="fleet-stagger"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 20 }}
            >
                <MetricCard
                    icon={Server}
                    label="Total Servers"
                    value={String(connections.length)}
                    sub={`${healthyCount} online`}
                    color={THEME.primary}
                    spark={latencySparks.length > 1 ? latencySparks : undefined}
                />
                <MetricCard
                    icon={CheckCircle}
                    label="Healthy"
                    value={String(healthyCount)}
                    sub={`of ${connections.length}`}
                    color={healthyCount === connections.length ? THEME.textMain : THEME.warning}
                    trend={
                        healthyCount === connections.length
                            ? '100%'
                            : `${Math.round((healthyCount / Math.max(connections.length, 1)) * 100)}%`
                    }
                    trendUp={healthyCount === connections.length}
                />
                <MetricCard
                    icon={Clock}
                    label="Uptime"
                    value={uptimePct !== '—' ? `${uptimePct}%` : uptimeStr}
                    sub={uptimeStr !== '—' ? uptimeStr : undefined}
                    color={THEME.primary}
                />
                <MetricCard
                    icon={Activity}
                    label="Active Conns"
                    value={String(activeConns)}
                    sub={maxConns ? `of ${maxConns} max` : undefined}
                    color={activeConns / Math.max(maxConns, 1) > 0.8 ? THEME.danger : THEME.primary}
                />
                <MetricCard
                    icon={HardDrive}
                    label="Storage Used"
                    value={dbSizeGB !== '—' ? `${dbSizeGB} GB` : '—'}
                    color={THEME.textMuted}
                />
                <MetricCard
                    icon={Zap}
                    label="Cache Hit Ratio"
                    value={hitRatio !== '—' ? `${hitRatio}%` : '—'}
                    sub={Number(hitRatio) > 95 ? 'Excellent' : Number(hitRatio) > 80 ? 'Good' : 'Needs attention'}
                    color={Number(hitRatio) > 95 ? THEME.textMain : Number(hitRatio) > 80 ? THEME.warning : THEME.danger}
                />
            </div>

            {/* ── Charts Row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
                {/* Traffic / Query Rate Chart */}
                <Panel
                    title="Query Traffic"
                    icon={Zap}
                    accentColor={THEME.primary}
                    rightNode={
                        trafficData ? (
                            <span style={{ fontSize: 10, color: THEME.textDim }}>
                                Reads {compactCount(trafficData.tup_fetched || 0)} · Writes{' '}
                                {compactCount(
                                    (trafficData.tup_inserted || 0) +
                                        (trafficData.tup_updated || 0) +
                                        (trafficData.tup_deleted || 0),
                                )}
                            </span>
                        ) : null
                    }
                >
                    {trafficHistory.length > 1 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={trafficHistory}>
                                <defs>
                                    <linearGradient id="fleet-reads-grad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={THEME.primary} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={THEME.primary} stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="fleet-writes-grad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={THEME.success} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={THEME.success} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}50`} vertical={false} />
                                <XAxis
                                    dataKey="time"
                                    tick={{ fontSize: 9, fill: THEME.textDim }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 9, fill: THEME.textDim }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={50}
                                />
                                <Tooltip content={<ChartTip />} />
                                <Area
                                    type="monotone"
                                    dataKey="reads"
                                    stroke={THEME.primary}
                                    fillOpacity={1}
                                    fill="url(#fleet-reads-grad)"
                                    name="Reads"
                                    strokeWidth={2}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="writes"
                                    stroke={THEME.success}
                                    fillOpacity={1}
                                    fill="url(#fleet-writes-grad)"
                                    name="Writes"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div
                            style={{
                                height: 200,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: THEME.textDim,
                                fontSize: 12,
                            }}
                        >
                            Collecting data... refreshing every 15s
                        </div>
                    )}
                </Panel>

                {/* Latency Chart */}
                <Panel
                    title="Connection Latency"
                    icon={Network}
                    accentColor={THEME.primary}
                    rightNode={<span style={{ fontSize: 10, color: THEME.textDim }}>Avg: {avgLatency}ms</span>}
                >
                    {latencyHistory.length > 1 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={latencyHistory}>
                                <CartesianGrid strokeDasharray="3 3" stroke={`${THEME.grid}50`} vertical={false} />
                                <XAxis
                                    dataKey="time"
                                    tick={{ fontSize: 9, fill: THEME.textDim }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 9, fill: THEME.textDim }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={40}
                                    unit="ms"
                                />
                                <Tooltip content={<ChartTip />} />
                                <Line
                                    type="monotone"
                                    dataKey="latency"
                                    stroke={THEME.success}
                                    strokeWidth={2}
                                    dot={false}
                                    name="Latency (ms)"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div
                            style={{
                                height: 200,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: THEME.textDim,
                                fontSize: 12,
                            }}
                        >
                            Collecting data... refreshing every 15s
                        </div>
                    )}
                </Panel>
            </div>

            {/* ── Fleet Instances Grid ── */}
            <Panel
                title="Fleet Instances"
                icon={Server}
                accentColor={THEME.primary}
                rightNode={
                    <span style={{ fontSize: 10, color: THEME.textDim }}>
                        {connections.length} database{connections.length !== 1 ? 's' : ''}
                    </span>
                }
            >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                    {connections.map((conn) => {
                        const health = healthData.find((h) => h.id === conn.id);
                        const isActive = conn.id === activeConnectionId;
                        return (
                            <DatabaseCard
                                key={conn.id}
                                connection={conn}
                                health={health}
                                isActive={isActive}
                                onSwitch={handleSwitch}
                            />
                        );
                    })}
                </div>
            </Panel>

            {/* ── Error Banner ── */}
            {error && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '12px 16px',
                        borderRadius: 12,
                        background: `${THEME.danger}08`,
                        border: `1px solid ${THEME.danger}25`,
                        color: THEME.danger,
                        fontSize: 12,
                        boxShadow: THEME.shadowSm,
                    }}
                >
                    <AlertCircle size={15} /> {error}
                </div>
            )}

            {/* ── Region Distribution ── */}
            {connections.length > 0 && (
                <Panel title="Connection Details" icon={Globe} accentColor={THEME.primary}>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${Math.min(connections.length, 4)}, 1fr)`,
                            gap: 18,
                        }}
                    >
                        {connections.map((conn) => {
                            const health = healthData.find((h) => h.id === conn.id);
                            const host = conn.host || '';
                            const region = host.includes('us-')
                                ? 'US'
                                : host.includes('eu-')
                                  ? 'EU'
                                  : host.includes('ap-')
                                    ? 'APAC'
                                    : host.includes('localhost')
                                      ? 'Local'
                                      : 'Cloud';
                            return (
                                <div
                                    key={conn.id}
                                    style={{
                                        padding: 12,
                                        background: THEME.surface,
                                        border: `1px solid ${THEME.glassBorder}`,
                                        borderRadius: 10,
                                        boxShadow: THEME.shadowSm,
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: 10,
                                            fontWeight: 600,
                                            color: THEME.textMuted,
                                            letterSpacing: '0.04em',
                                        }}
                                    >
                                        {region}
                                    </div>
                                    <div
                                        style={{ fontSize: 13, fontWeight: 700, color: THEME.primary, margin: '6px 0' }}
                                    >
                                        {conn.name}
                                    </div>
                                    <div style={{ fontSize: 9, color: THEME.textDim }}>
                                        Latency: {health?.latencyMs != null ? `${health.latencyMs}ms` : '—'}
                                    </div>
                                    <div style={{ fontSize: 9, color: THEME.textDim, marginTop: 2 }}>
                                        DB: {conn.database}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Panel>
            )}

            {/* ── Fleet Health Score ── */}
            <Panel title="Fleet Health Score" icon={CheckCircle} accentColor={THEME.success}>
                <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 0' }}
                >
                    <RingGauge
                        value={connections.length > 0 ? Math.round((healthyCount / connections.length) * 100) : 0}
                        color={THEME.success}
                        size={100}
                        label="Availability"
                    />
                    <RingGauge
                        value={hitRatio !== '—' ? Math.round(Number(hitRatio)) : 0}
                        color={THEME.primary}
                        size={100}
                        label="Cache Efficiency"
                    />
                    <RingGauge
                        value={avgLatency > 0 ? Math.min(100, Math.round(100 - avgLatency / 20)) : 0}
                        color={THEME.success}
                        size={100}
                        label="Performance"
                    />
                </div>
            </Panel>
        </div>
    );
};

export default FleetOverviewTab;
