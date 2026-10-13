import React, { useState, useEffect, useRef, useCallback } from 'react';
import { THEME, useAdaptiveTheme, useGlobalRefresh } from '../../../utils/theme';
import { fetchData } from '../../../utils/api';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    Legend,
} from 'recharts';
import {
    Activity,
    Server,
    Wifi,
    WifiOff,
    Clock,
    Settings,
    RefreshCw,
    AlertTriangle,
    AlertCircle,
    TrendingUp,
    TrendingDown,
} from 'lucide-react';

/* ── Styles ───────────────────────────────────────────────────────────────── */
const Styles = () => (
    <style>{`
        @keyframes pmdFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pmdSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .pmd-card {
            background: linear-gradient(180deg, ${THEME.surface} 0%, ${THEME.surface}f8 100%);
            border: 1px solid ${THEME.glassBorder};
            border-radius: 20px;
            padding: 20px;
            position: relative;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
            transition: all 0.25s ease;
            animation: pmdFade 0.3s ease;
            backdrop-filter: blur(12px);
        }
        .pmd-card:hover {
            box-shadow: 0 8px 28px rgba(0,0,0,0.12);
            transform: translateY(-4px);
        }
        .pmd-card::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: var(--tile-accent, ${THEME.primary});
            opacity: 0.7;
        }
        .pmd-metric { display: flex; align-items: center; gap: 18px; padding: 16px; background: ${THEME.surface}; border: 1px solid ${THEME.glassBorder}; border-radius: 20px; }
        .pmd-spin { animation: pmdSpin 1s linear infinite; }
        .pmd-slider { -webkit-appearance: none; width: 100%; height: 4px; border-radius: 2px; background: ${THEME.grid}; outline: none; cursor: pointer; }
        .pmd-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border-radius: 50%; background: ${THEME.primary}; cursor: pointer; }
        .pmd-slider::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: ${THEME.primary}; cursor: pointer; border: none; }
    `}</style>
);

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const fmt = (n) => {
    if (n === null || n === undefined) return '—';
    const num = Number(n);
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
};

const fmtMs = (ms) => {
    if (ms === null || ms === undefined) return '—';
    const m = Number(ms);
    if (m < 1000) return `${m.toFixed(0)}ms`;
    return `${(m / 1000).toFixed(2)}s`;
};

/* ── Metric Card ──────────────────────────────────────────────────────────── */
const MetricCard = React.memo(({ icon: Icon, label, value, unit = '', sub, color = THEME.primary, warn }) => (
    <div
        className="pmd-metric"
        style={{
            borderColor: warn ? `${THEME.warning}40` : THEME.grid,
            background: warn ? `${THEME.warning}08` : THEME.surface,
        }}
    >
        <div
            style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                background: `${color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: `1px solid ${color}40`,
            }}
        >
            <Icon size={18} color={color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: THEME.textMain, lineHeight: 1 }}>
                {value}
                {unit && (
                    <span style={{ fontSize: '11px', marginLeft: '4px', fontWeight: 600, color: THEME.textMuted }}>
                        {unit}
                    </span>
                )}
            </div>
            <div
                style={{
                    fontSize: '11px',
                    color: THEME.textMuted,
                    marginTop: 4,
                    fontWeight: 600,
                    letterSpacing: '0.5px',
                }}
            >
                {label}
            </div>
            {sub && (
                <div style={{ fontSize: '11px', color: warn ? THEME.warning : THEME.textDim, marginTop: 2 }}>{sub}</div>
            )}
        </div>
    </div>
));

/* ── Custom Chart Tooltip ─────────────────────────────────────────────────── */
const ChartTip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div
            style={{
                background: THEME.surface,
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: 20,
                padding: '20px 24px',
                fontSize: 12,
                boxShadow: THEME.shadowSm,
            }}
        >
            <div style={{ color: THEME.textMuted, marginBottom: 4 }}>{label}</div>
            {payload.map((p) => (
                <div key={p.name} style={{ color: p.color, fontWeight: 600 }}>
                    {p.name}: {fmt(p.value)}
                </div>
            ))}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   POOL CONFIGURATION SECTION
   ═══════════════════════════════════════════════════════════════════════════ */
const PoolConfigSection = ({ config, onUpdate }) => {
    const [localConfig, setLocalConfig] = useState(config || { min: 0, max: 0, idleTimeout: 0 });
    const [updated, setUpdated] = useState(false);

    useEffect(() => {
        setLocalConfig(config || { min: 0, max: 0, idleTimeout: 0 });
    }, [config]);

    const handleChange = (field, value) => {
        const newConfig = { ...localConfig, [field]: value };
        setLocalConfig(newConfig);
        setUpdated(true);
    };

    const handleApply = async () => {
        try {
            // In real implementation, send to API
            // await postData('/api/pool/config', localConfig);
            setUpdated(false);
            // Show success message
        } catch (err) {
            console.error('Failed to update config:', err);
        }
    };

    return (
        <div className="pmd-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                <Settings size={18} color={THEME.primary} />
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: THEME.textMain, margin: 0 }}>
                    Pool Configuration
                </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                {/* Min Size */}
                <div>
                    <label
                        style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: THEME.textMuted,
                            marginBottom: '8px',
                            display: 'block',
                        }}
                    >
                        Min Connections:{' '}
                        <span style={{ color: THEME.primary, fontWeight: 700 }}>{localConfig.min}</span>
                    </label>
                    <input
                        type="range"
                        min="1"
                        max="50"
                        value={localConfig.min}
                        onChange={(e) => handleChange('min', Number(e.target.value))}
                        className="pmd-slider"
                        style={{ width: '100%' }}
                    />
                </div>

                {/* Max Size */}
                <div>
                    <label
                        style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: THEME.textMuted,
                            marginBottom: '8px',
                            display: 'block',
                        }}
                    >
                        Max Connections:{' '}
                        <span style={{ color: THEME.primary, fontWeight: 700 }}>{localConfig.max}</span>
                    </label>
                    <input
                        type="range"
                        min="1"
                        max="100"
                        value={localConfig.max}
                        onChange={(e) => handleChange('max', Number(e.target.value))}
                        className="pmd-slider"
                        style={{ width: '100%' }}
                    />
                </div>

                {/* Idle Timeout */}
                <div>
                    <label
                        style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: THEME.textMuted,
                            marginBottom: '8px',
                            display: 'block',
                        }}
                    >
                        Idle Timeout (sec):{' '}
                        <span style={{ color: THEME.primary, fontWeight: 700 }}>{localConfig.idleTimeout}</span>
                    </label>
                    <input
                        type="range"
                        min="10"
                        max="300"
                        step="10"
                        value={localConfig.idleTimeout}
                        onChange={(e) => handleChange('idleTimeout', Number(e.target.value))}
                        className="pmd-slider"
                        style={{ width: '100%' }}
                    />
                </div>
            </div>

            {updated && (
                <div
                    style={{
                        marginTop: '16px',
                        paddingTop: '16px',
                        borderTop: `1px solid ${THEME.grid}`,
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '14px',
                    }}
                >
                    <button
                        onClick={() => setLocalConfig(config || { min: 0, max: 0, idleTimeout: 0 })}
                        style={{
                            padding: '14px 20px',
                            background: THEME.surfaceLight,
                            color: THEME.textMain,
                            border: `1px solid ${THEME.border}`,
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            fontFamily: THEME.fontBody,
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.borderColor = THEME.borderHot;
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.borderColor = THEME.border;
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleApply}
                        style={{
                            padding: '14px 20px',
                            background: THEME.primary,
                            color: THEME.void,
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            fontFamily: THEME.fontBody,
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.boxShadow = `0 0 12px ${THEME.primary}40`;
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.boxShadow = 'none';
                        }}
                    >
                        Apply
                    </button>
                </div>
            )}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   POOL METRICS DASHBOARD (Main Component)
   ═══════════════════════════════════════════════════════════════════════════ */
export default function PoolMetricsDashboard() {
    useAdaptiveTheme();
    const [metrics, setMetrics] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [autoRefresh, setAutoRefresh] = useState(10);
    const intervalRef = useRef(null);

    /* ── Load metrics ────────────────────────────────────────────────────── */
    const loadMetrics = useCallback(async () => {
        try {
            const data = await fetchData('/api/pool/metrics');
            setMetrics(data);
            setLastUpdate(new Date());
            setError(null);

            // Add to history (keep last 20 points)
            setHistory((prev) =>
                [
                    ...prev,
                    {
                        timestamp: new Date().toLocaleTimeString(),
                        active: data.active_connections || 0,
                        idle: data.idle_connections || 0,
                        waiting: data.waiting_requests || 0,
                        utilization: data.utilization_percent || 0,
                    },
                ].slice(-20),
            );
        } catch (err) {
            console.error('Failed to load pool metrics:', err);
            setError(err.message || 'Failed to load pool metrics');
        } finally {
            setLoading(false);
        }
    }, []);

    /* ── Initial load and auto-refresh ───────────────────────────────────── */
    useEffect(() => {
        loadMetrics();
    }, [loadMetrics]);

    useEffect(() => {
        if (autoRefresh > 0) {
            intervalRef.current = setInterval(loadMetrics, autoRefresh * 1000);
            return () => {
                if (intervalRef.current) clearInterval(intervalRef.current);
            };
        }
    }, [autoRefresh, loadMetrics]);

    useGlobalRefresh(loadMetrics);

    if (loading && !metrics) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: THEME.textMuted }}>
                <div className="pmd-spin" style={{ display: 'inline-block', marginBottom: '10px' }}>
                    ⟳
                </div>
                <div style={{ fontSize: '14px' }}>Loading pool metrics...</div>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px' }}>
            <Styles />

            {/* Header */}
            <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}
            >
                <div>
                    <h2
                        style={{
                            fontSize: '20px',
                            fontWeight: 800,
                            color: THEME.textMain,
                            margin: 0,
                            marginBottom: '4px',
                        }}
                    >
                        Connection Pool Metrics
                    </h2>
                    <p style={{ fontSize: '13px', color: THEME.textMuted, margin: 0 }}>
                        {lastUpdate && `Last updated: ${lastUpdate.toLocaleTimeString()}`}
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                    <div>
                        <label
                            style={{ fontSize: '12px', fontWeight: 600, color: THEME.textMuted, marginRight: '8px' }}
                        >
                            Auto-refresh:
                        </label>
                        <select
                            value={autoRefresh}
                            onChange={(e) => setAutoRefresh(Number(e.target.value))}
                            style={{
                                padding: '6px 10px',
                                background: THEME.surface,
                                border: `1px solid ${THEME.border}`,
                                borderRadius: '6px',
                                color: THEME.textMain,
                                fontSize: '12px',
                                fontFamily: THEME.fontBody,
                            }}
                        >
                            <option value="0">Off</option>
                            <option value="5">5s</option>
                            <option value="10">10s</option>
                            <option value="30">30s</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div
                    style={{
                        background: `${THEME.danger}15`,
                        border: `1px solid ${THEME.danger}40`,
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '18px',
                        boxShadow: THEME.shadowSm,
                    }}
                >
                    <AlertTriangle size={16} color={THEME.danger} style={{ marginTop: '2px', flexShrink: 0 }} />
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: THEME.danger }}>Error</div>
                        <div style={{ fontSize: '12px', color: THEME.textMuted }}>{error}</div>
                    </div>
                </div>
            )}

            {/* Current Metrics */}
            {metrics && (
                <>
                    {/* Top Stats */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                            gap: '18px',
                            marginBottom: '20px',
                        }}
                    >
                        <MetricCard
                            icon={Activity}
                            label="Active Connections"
                            value={fmt(metrics.active_connections)}
                            sub={`Pool: ${metrics.active_connections}/${metrics.max_connections}`}
                            warn={metrics.active_connections > metrics.max_connections * 0.8}
                        />
                        <MetricCard
                            icon={Wifi}
                            label="Idle Connections"
                            value={fmt(metrics.idle_connections)}
                            color={THEME.success}
                        />
                        <MetricCard
                            icon={Clock}
                            label="Waiting Requests"
                            value={fmt(metrics.waiting_requests)}
                            warn={metrics.waiting_requests > 5}
                            color={THEME.warning}
                        />
                        <MetricCard
                            icon={Server}
                            label="Total Created"
                            value={fmt(metrics.total_created)}
                            sub={`Destroyed: ${fmt(metrics.total_destroyed)}`}
                            color={THEME.info}
                        />
                    </div>

                    {/* Utilization */}
                    <div className="pmd-card" style={{ marginBottom: '20px' }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '12px',
                            }}
                        >
                            <div>
                                <h3
                                    style={{
                                        fontSize: '15px',
                                        fontWeight: 700,
                                        color: THEME.textMain,
                                        margin: 0,
                                        marginBottom: '4px',
                                    }}
                                >
                                    Pool Utilization
                                </h3>
                                <div style={{ fontSize: '13px', color: THEME.textMuted }}>
                                    {(metrics.utilization_percent || 0).toFixed(1)}% of {metrics.max_connections}{' '}
                                    connections in use
                                </div>
                            </div>
                        </div>
                        <div
                            style={{
                                width: '100%',
                                height: '8px',
                                background: THEME.grid,
                                borderRadius: '6px',
                                overflow: 'hidden',
                            }}
                        >
                            <div
                                style={{
                                    width: `${Math.min(metrics.utilization_percent || 0, 100)}%`,
                                    height: '100%',
                                    background: metrics.utilization_percent > 80 ? THEME.danger : THEME.primary,
                                    transition: 'all 0.3s ease',
                                }}
                            />
                        </div>
                    </div>

                    {/* Lifecycle Metrics */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div className="pmd-card">
                            <h3
                                style={{
                                    fontSize: '15px',
                                    fontWeight: 700,
                                    color: THEME.textMain,
                                    margin: 0,
                                    marginBottom: '16px',
                                }}
                            >
                                Connection Lifecycle
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        paddingBottom: '12px',
                                        borderBottom: `1px solid ${THEME.grid}`,
                                    }}
                                >
                                    <span style={{ fontSize: '13px', color: THEME.textMuted }}>Avg Connect Time</span>
                                    <span style={{ fontSize: '14px', fontWeight: 700, color: THEME.textMain }}>
                                        {fmtMs(metrics.avg_connect_time)}
                                    </span>
                                </div>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        paddingBottom: '12px',
                                        borderBottom: `1px solid ${THEME.grid}`,
                                    }}
                                >
                                    <span style={{ fontSize: '13px', color: THEME.textMuted }}>Avg Query Time</span>
                                    <span style={{ fontSize: '14px', fontWeight: 700, color: THEME.textMain }}>
                                        {fmtMs(metrics.avg_query_time)}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '13px', color: THEME.textMuted }}>Max Idle Time</span>
                                    <span style={{ fontSize: '14px', fontWeight: 700, color: THEME.textMain }}>
                                        {fmtMs(metrics.max_idle_time)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Dead Connection Detection */}
                        <div className="pmd-card">
                            <h3
                                style={{
                                    fontSize: '15px',
                                    fontWeight: 700,
                                    color: THEME.textMain,
                                    margin: 0,
                                    marginBottom: '16px',
                                }}
                            >
                                Connection Health
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '14px',
                                        padding: '12px',
                                        background:
                                            metrics.dead_connections > 0 ? `${THEME.warning}15` : `${THEME.success}15`,
                                        border:
                                            metrics.dead_connections > 0
                                                ? `1px solid ${THEME.warning}40`
                                                : `1px solid ${THEME.success}40`,
                                        borderRadius: '12px',
                                    }}
                                >
                                    {metrics.dead_connections > 0 ? (
                                        <AlertCircle size={18} color={THEME.warning} />
                                    ) : (
                                        <CheckIcon size={18} color={THEME.success} />
                                    )}
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: THEME.textMain }}>
                                            Dead Connections
                                        </div>
                                        <div
                                            style={{
                                                fontSize: '14px',
                                                fontWeight: 700,
                                                color: metrics.dead_connections > 0 ? THEME.warning : THEME.success,
                                                marginTop: '2px',
                                            }}
                                        >
                                            {fmt(metrics.dead_connections)}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ fontSize: '12px', color: THEME.textMuted, lineHeight: '1.4' }}>
                                    {metrics.dead_connections > 0
                                        ? 'Some connections have been detected as dead and will be recycled.'
                                        : 'All connections are healthy. No dead connections detected.'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* History Chart */}
                    {history.length > 1 && (
                        <div className="pmd-card" style={{ marginBottom: '20px' }}>
                            <h3
                                style={{
                                    fontSize: '15px',
                                    fontWeight: 700,
                                    color: THEME.textMain,
                                    margin: 0,
                                    marginBottom: '16px',
                                }}
                            >
                                Connection History
                            </h3>
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={history}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                                    <XAxis
                                        dataKey="timestamp"
                                        stroke={THEME.textMuted}
                                        tick={{ fontSize: 11, fill: THEME.textMuted }}
                                    />
                                    <YAxis stroke={THEME.textMuted} tick={{ fontSize: 11, fill: THEME.textMuted }} />
                                    <Tooltip content={<ChartTip />} />
                                    <Legend
                                        wrapperStyle={{ fontSize: '12px', color: THEME.textMuted }}
                                        iconType="circle"
                                    />
                                    <Bar dataKey="active" stackId="a" fill={THEME.primary} name="Active" />
                                    <Bar dataKey="idle" stackId="a" fill={THEME.success} name="Idle" />
                                    <Bar dataKey="waiting" stackId="a" fill={THEME.warning} name="Waiting" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Configuration */}
                    <PoolConfigSection config={metrics.config} onUpdate={loadMetrics} />
                </>
            )}
        </div>
    );
}

/* ── Check Icon (simple SVG) ──────────────────────────────────────────────── */
const CheckIcon = ({ size = 24, color = THEME.success }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);
