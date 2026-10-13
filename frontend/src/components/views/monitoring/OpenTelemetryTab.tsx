import React, { useState, useEffect, useCallback } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { fetchData } from '../../../utils/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Activity, Search, Clock, BarChart2, Filter, RefreshCw, AlertTriangle } from 'lucide-react';

/* ── Styles ───────────────────────────────────────────────────────────────── */
const Styles = () => (
    <style>{`
        @keyframes otSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes otFade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .ot-card {
            background: linear-gradient(180deg, ${THEME.surface} 0%, ${THEME.surface}f8 100%);
            border: 1px solid ${THEME.glassBorder};
            border-radius: 20px;
            padding: 24px;
            position: relative;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
            transition: all 0.25s ease;
            animation: otFade 0.3s ease;
            backdrop-filter: blur(12px);
        }
        .ot-card:hover {
            box-shadow: 0 8px 28px rgba(0,0,0,0.12);
            transform: translateY(-4px);
        }
        .ot-card::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: var(--tile-accent, ${THEME.primary});
            opacity: 0.7;
        }
        .ot-section { margin-bottom:24px; }
        .ot-label { font-size:12px; font-weight:700; color:${THEME.textMuted}; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; }
        .ot-select { background:${THEME.surfaceHover}; border:1px solid ${THEME.glassBorder}; border-radius: 20px; padding:10px 12px; color:${THEME.textMain}; font-size:14px; width:100%; cursor:pointer; }
        .ot-input { background:${THEME.surfaceHover}; border:1px solid ${THEME.glassBorder}; border-radius: 20px; padding:10px 12px; color:${THEME.textMain}; font-size:13px; width:100%; }
        .ot-stat { display:inline-block; padding:12px 16px; background:${THEME.grid}; border-radius: 22px; margin-right:12px; margin-bottom:8px; }
        .ot-spinner { animation:otSpin 1s linear infinite; }
        .ot-badge { display:inline-block; padding:4px 10px; background:${THEME.primary}20; color:${THEME.primary}; border-radius: 22px; font-size:11px; font-weight:700; }
    `}</style>
);

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const fmt = (n) => (n === null ? '—' : Number(n).toLocaleString());
const fmtDate = (d) => (d ? new Date(d).toLocaleString() : '—');

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
                    {p.name}: {fmt(p.value)}
                </div>
            ))}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   OPENTELEMETRY TAB
   ═══════════════════════════════════════════════════════════════════════════ */
export default function OpenTelemetryTab() {
    useAdaptiveTheme();
    const [services, setServices] = useState([]);
    const [metricNames, setMetricNames] = useState([]);
    const [chartData, setChartData] = useState([]);
    const [stats, setStats] = useState(null);
    const [selectedService, setSelectedService] = useState('');
    const [selectedMetric, setSelectedMetric] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [timeRange, setTimeRange] = useState('6h');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    // Load services and metric names
    useEffect(() => {
        const load = async () => {
            try {
                const [svcs, metrics] = await Promise.all([
                    fetchData('/api/otel/services'),
                    fetchData('/api/otel/metrics/names'),
                ]);
                setServices(svcs?.services || []);
                setMetricNames(metrics?.names || []);
                if (svcs?.services?.[0]) setSelectedService(svcs.services[0]);
                if (metrics?.names?.[0]) setSelectedMetric(metrics.names[0]);
                setError(null);
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // Load chart data and stats when service/metric changes
    useEffect(() => {
        if (!selectedService || !selectedMetric) return;

        const load = async () => {
            setRefreshing(true);
            try {
                const data = await fetchData(
                    `/api/otel/metrics/data?service=${encodeURIComponent(selectedService)}&metric=${encodeURIComponent(selectedMetric)}&range=${timeRange}`,
                );
                // /api/otel/metrics/data responds with `res.json(rows)` — a bare
                // array. This read data.data and data.stats, so the chart was
                // always empty and the stat cards never rendered, whatever the
                // query returned. Accept both shapes.
                const rows = Array.isArray(data) ? data : (data?.data ?? []);
                setChartData(rows);

                // The endpoint sends no stats block, so derive it from the rows
                // rather than leaving four cards permanently hidden. Only when
                // there is something numeric to summarise — a label/value pair
                // like the connections breakdown has one; a commits/rollbacks
                // row does not, and inventing an average of those would be
                // worse than showing nothing.
                const values = rows
                    .map((r) => Number(r.value))
                    .filter((n) => Number.isFinite(n));
                setStats(
                    data?.stats ??
                        (values.length
                            ? {
                                  avg: values.reduce((a, b) => a + b, 0) / values.length,
                                  min: Math.min(...values),
                                  max: Math.max(...values),
                                  // Nearest-rank p95: no interpolation, so a
                                  // three-point series reports a real reading
                                  // rather than a number that never occurred.
                                  p95: [...values].sort((a, b) => a - b)[
                                      Math.min(values.length - 1, Math.ceil(values.length * 0.95) - 1)
                                  ],
                                  lastIngested: new Date().toISOString(),
                              }
                            : null),
                );
                setError(null);
            } catch (e) {
                setError(e.message);
            } finally {
                setRefreshing(false);
            }
        };
        load();
    }, [selectedService, selectedMetric, timeRange]);

    const filteredMetrics = metricNames.filter((m) => m.toLowerCase().includes(searchTerm.toLowerCase()));

    if (loading) {
        return (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <Styles />
                <RefreshCw size={32} color={THEME.primary} className="ot-spinner" style={{ margin: '0 auto 16px' }} />
                <div style={{ color: THEME.textMuted }}>Loading OpenTelemetry metrics...</div>
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

            {/* Service & Metric Selection */}
            <div
                className="ot-card"
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}
            >
                <div className="ot-section">
                    <div className="ot-label">
                        <Activity
                            size={14}
                            style={{ display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }}
                        />
                        Service
                    </div>
                    <select
                        className="ot-select"
                        value={selectedService}
                        onChange={(e) => setSelectedService(e.target.value)}
                    >
                        {services.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="ot-section">
                    <div className="ot-label">
                        <BarChart2
                            size={14}
                            style={{ display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }}
                        />
                        Metric Name
                    </div>
                    <select
                        className="ot-select"
                        value={selectedMetric}
                        onChange={(e) => setSelectedMetric(e.target.value)}
                    >
                        {filteredMetrics.map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Search & Filters */}
            <div
                className="ot-card"
                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}
            >
                <div className="ot-section">
                    <div className="ot-label">
                        <Search
                            size={14}
                            style={{ display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }}
                        />
                        Search Metrics
                    </div>
                    <input
                        type="text"
                        className="ot-input"
                        placeholder="Filter metric names..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="ot-section">
                    <div className="ot-label">
                        <Clock size={14} style={{ display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />
                        Time Range
                    </div>
                    <select className="ot-select" value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
                        <option value="1h">Last 1 Hour</option>
                        <option value="6h">Last 6 Hours</option>
                        <option value="24h">Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                    </select>
                </div>
            </div>

            {/* Time Series Chart */}
            <div className="ot-card" style={{ marginBottom: 20 }}>
                <div
                    style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                    <div style={{ fontSize: 14, fontWeight: 700, color: THEME.textMain }}>
                        <BarChart2
                            size={16}
                            style={{ display: 'inline-block', marginRight: 8, verticalAlign: 'middle' }}
                        />
                        Metric Timeline
                    </div>
                    {refreshing && <RefreshCw size={14} color={THEME.primary} className="ot-spinner" />}
                </div>
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={chartData}>
                            <XAxis dataKey="timestamp" stroke={THEME.textDim} style={{ fontSize: 12 }} />
                            <YAxis stroke={THEME.textDim} style={{ fontSize: 12 }} />
                            <Tooltip content={<ChartTip />} />
                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke={THEME.primary}
                                dot={false}
                                isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: THEME.textDim }}>
                        No data available
                    </div>
                )}
            </div>

            {/* Stats Table */}
            {stats && (
                <div className="ot-card" style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: THEME.textMain, marginBottom: 16 }}>
                        <Filter
                            size={16}
                            style={{ display: 'inline-block', marginRight: 8, verticalAlign: 'middle' }}
                        />
                        Metric Statistics
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
                        <div style={{ background: THEME.grid, borderRadius: 16, padding: 12 }}>
                            <div style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 4, fontWeight: 700 }}>
                                Average
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: THEME.primary }}>{fmt(stats.avg)}</div>
                        </div>
                        <div style={{ background: THEME.grid, borderRadius: 16, padding: 12 }}>
                            <div style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 4, fontWeight: 700 }}>
                                Min
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: THEME.success }}>{fmt(stats.min)}</div>
                        </div>
                        <div style={{ background: THEME.grid, borderRadius: 16, padding: 12 }}>
                            <div style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 4, fontWeight: 700 }}>
                                Max
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: THEME.warning }}>{fmt(stats.max)}</div>
                        </div>
                        <div style={{ background: THEME.grid, borderRadius: 16, padding: 12 }}>
                            <div style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 4, fontWeight: 700 }}>
                                P95
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: THEME.ai }}>{fmt(stats.p95)}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Ingestion Stats */}
            <div className="ot-card">
                <div style={{ fontSize: 14, fontWeight: 700, color: THEME.textMain, marginBottom: 16 }}>
                    <Activity size={16} style={{ display: 'inline-block', marginRight: 8, verticalAlign: 'middle' }} />
                    Ingestion Statistics
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
                    <div style={{ background: THEME.grid, borderRadius: 16, padding: 16 }}>
                        <div style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 6, fontWeight: 700 }}>
                            Total Metrics
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: THEME.primary }}>
                            {fmt(metricNames.length)}
                        </div>
                    </div>
                    <div style={{ background: THEME.grid, borderRadius: 16, padding: 16 }}>
                        <div style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 6, fontWeight: 700 }}>
                            Last Ingested
                        </div>
                        <div style={{ fontSize: 13, color: THEME.textMain, fontWeight: 600 }}>
                            {fmtDate(stats?.lastIngested)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
