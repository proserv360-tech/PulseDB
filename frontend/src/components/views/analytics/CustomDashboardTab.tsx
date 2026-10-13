import React, { useState, useEffect, useCallback } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { fetchData } from '../../../utils/api';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
} from 'recharts';
import {
    Layout,
    Plus,
    Trash2,
    Settings,
    Grid,
    Move,
    Save,
    AlertTriangle,
    RefreshCw,
    Download,
    Upload,
    MoreVertical,
    Edit2,
} from 'lucide-react';

/* ── Styles ───────────────────────────────────────────────────────────────── */
const Styles = () => (
    <style>{`
        @keyframes cdFade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .cd-card { background:${THEME.surface}; border:1px solid ${THEME.glassBorder}; border-radius: 20px; padding:0; animation:cdFade .3s ease; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08); backdrop-filter:blur(12px); transition:all 0.25s ease; }
        .cd-card:hover { box-shadow:0 4px 16px rgba(0,0,0,0.12); transform:translateY(-4px); }
        .cd-card-ribbon { height:50px; background:linear-gradient(135deg, var(--ribbon-color, ${THEME.primary}) 0%, var(--ribbon-end, ${THEME.primary}cc) 100%); display:flex; align-items:center; padding:0 20px; gap: 18px; color:white; font-weight:600; font-size:13px; letter-spacing:0.02em; }
        .cd-card-body { padding:20px; }
        .cd-button { background:${THEME.primary}; color:${THEME.textInverse}; border:none; border-radius: 22px; padding:10px 18px; font-weight:700; font-size:13px; cursor:pointer; transition:all .2s ease; }
        .cd-button:hover { background:${THEME.primaryLight}; }
        .cd-button-secondary { background:${THEME.secondary}; }
        .cd-button-secondary:hover { background:${THEME.secondaryLight}; }
        .cd-button-danger { background:${THEME.danger}; }
        .cd-button-danger:hover { background:${THEME.dangerLight}; }
        .cd-select { background:${THEME.surfaceHover}; border:1px solid ${THEME.glassBorder}; border-radius: 22px; padding:11px 14px; color:${THEME.textMain}; font-size:13px; width:100%; cursor:pointer; }
        .cd-input { background:${THEME.surfaceHover}; border:1px solid ${THEME.glassBorder}; border-radius: 22px; padding:11px 14px; color:${THEME.textMain}; font-size:13px; width:100%; }
        .cd-input:focus { outline:none; border-color:${THEME.primary}; }
        .cd-label { font-size:12px; font-weight:700; color:${THEME.textMuted}; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; }
        .cd-widget { background:${THEME.glassBorder}; border:1px solid ${THEME.glassBorder}; border-radius: 22px; padding:16px; position:relative; animation:cdFade .3s ease; cursor:grab; transition:all .2s ease; box-shadow:0 2px 8px rgba(0,0,0,0.04); }
        .cd-widget:hover { border-color:${THEME.primary}40; box-shadow:0 4px 16px rgba(0,0,0,0.08); }
        .cd-widget.dragging { opacity:0.7; }
        .cd-widget-drag-handle { cursor:grab; padding:8px; position:absolute; top:8px; left:8px; color:${THEME.textDim}; }
        .cd-widget-toolbar { position:absolute; top:8px; right:8px; display:flex; gap: 20px; }
        .cd-widget-icon { cursor:pointer; padding:6px; color:${THEME.textDim}; transition:all .2s ease; }
        .cd-widget-icon:hover { color:${THEME.primary}; }
        .cd-widget-remove:hover { color:${THEME.danger}; }
        .cd-modal { position:fixed; inset:0; background:rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; z-index:1000; }
        .cd-modal-content { background:${THEME.surface}; border:1px solid ${THEME.glassBorder}; border-radius: 20px; padding:24px; max-width:600px; width:90%; max-height:90vh; overflow-y:auto; box-shadow:0 4px 16px rgba(0,0,0,0.08); backdrop-filter:blur(12px); }
        .cd-modal-title { font-size:18px; font-weight:700; color:${THEME.textMain}; margin-bottom:16px; }
        .cd-modal-field { margin-bottom:16px; }
        .cd-modal-section { margin-bottom:24px; }
        .cd-modal-section-title { font-size:13px; font-weight:700; color:${THEME.primary}; margin-bottom:12px; text-transform:uppercase; }
        .cd-tabs { display:flex; gap: 18px; margin-bottom:20px; border-bottom:1px solid ${THEME.glassBorder}; }
        .cd-tab { padding:14px 18px; font-size:13px; font-weight:700; color:${THEME.textDim}; cursor:pointer; border-bottom:2px solid transparent; transition:all .2s ease; }
        .cd-tab.active { color:${THEME.primary}; border-bottom-color:${THEME.primary}; }
        .cd-grid { display:grid; gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))'; gap:20px; marginBottom:20px; }
        .cd-gauge-container { position:relative; width:200px; height:200px; margin:0 auto; }
        .cd-gauge-label { position:absolute; top:50%; left:50%; transform:'translate(-50%, -50%)'; textAlign:center; }
        .cd-gauge-value { fontSize:32px; fontWeight:800; color:${THEME.primary}; }
        .cd-gauge-unit { fontSize:12px; color:${THEME.textMuted}; marginTop:4px; }
        .cd-health-grid { display:grid; gridTemplateColumns:'repeat(auto-fit, minmax(80px, 1fr))'; gap: 18px; }
        .cd-health-item { textAlign:center; padding:16px; borderRadius:12px; background:${THEME.surfaceHover}; }
        .cd-health-dot { fontSize:32px; marginBottom:8px; }
        .cd-health-label { fontSize:11px; color:${THEME.textMuted}; }
        .cd-spinner { animation:spin 1s linear infinite; display:inline-block; }
        .cd-templateGallery { display:grid; gridTemplateColumns:'repeat(2, 1fr)'; gap: 18px; }
        .cd-templateCard { background:${THEME.surfaceHover}; border:1px solid ${THEME.glassBorder}; borderRadius:12px; padding:16px; cursor:pointer; transition:all .2s ease; }
        .cd-templateCard:hover { borderColor:${THEME.primary}40; background:${THEME.surface}; }
        .cd-templateCard.selected { borderColor:${THEME.primary}; background:${THEME.primary}15; }
        .cd-templateIcon { fontSize:24px; marginBottom:8px; }
        .cd-templateName { fontSize:13px; fontWeight:700; color:${THEME.textMain}; marginBottom:4px; }
        .cd-templateDesc { fontSize:11px; color:${THEME.textMuted}; }
    `}</style>
);

/* ── Widget Component ──────────────────────────────────────────────────────── */
const DashboardWidget = ({ widget, onRemove, onEdit, data, loading }) => {
    const [showMenu, setShowMenu] = useState(false);

    const renderContent = () => {
        if (loading)
            return (
                <div style={{ color: THEME.textDim, textAlign: 'center', padding: '20px 0' }}>
                    <RefreshCw size={16} className="cd-spinner" style={{ marginRight: 8 }} />
                    Loading...
                </div>
            );
        if (!data) return <div style={{ color: THEME.textDim, textAlign: 'center', padding: '20px 0' }}>No data</div>;

        if (widget.type === 'stat_card') {
            const healthColor =
                widget.status === 'critical'
                    ? THEME.danger
                    : widget.status === 'warning'
                      ? THEME.warning
                      : THEME.success;
            return (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: healthColor, marginBottom: 8 }}>
                        {data.value !== undefined ? data.value : 'N/A'} {widget.unit}
                    </div>
                    <div style={{ fontSize: 12, color: THEME.textMuted }}>{widget.metricLabel}</div>
                </div>
            );
        }

        if (widget.type === 'metric_chart') {
            return (
                <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={Array.isArray(data) ? data : []}>
                        <XAxis dataKey="timestamp" stroke={THEME.textDim} style={{ fontSize: 10 }} />
                        <YAxis stroke={THEME.textDim} style={{ fontSize: 10 }} />
                        <Tooltip />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke={THEME.primary}
                            dot={false}
                            isAnimationActive={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            );
        }

        if (widget.type === 'gauge') {
            const percentage = typeof data === 'number' ? Math.min(Math.max(data, 0), 100) : 0;
            const gaugeColor =
                percentage > widget.thresholdCritical
                    ? THEME.danger
                    : percentage > widget.thresholdWarning
                      ? THEME.warning
                      : THEME.success;
            return (
                <div className="cd-gauge-container">
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '50%',
                            border: `3px solid ${THEME.glassBorder}`,
                            position: 'relative',
                        }}
                    >
                        <div
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                borderRadius: '50%',
                                background: `conic-gradient(${gaugeColor} ${percentage}%, ${THEME.glassBorder} ${percentage}%)`,
                            }}
                        />
                    </div>
                    <div className="cd-gauge-label">
                        <div className="cd-gauge-value">{percentage.toFixed(1)}</div>
                        <div className="cd-gauge-unit">{widget.unit}</div>
                    </div>
                </div>
            );
        }

        if (widget.type === 'health_grid') {
            const items = [
                { label: 'Performance', status: data?.performance > 80 ? 'ok' : 'warning' },
                { label: 'Connections', status: data?.connections < 80 ? 'ok' : 'warning' },
                { label: 'Cache', status: data?.cache > 90 ? 'ok' : 'warning' },
                { label: 'Replication', status: data?.replication < 5 ? 'ok' : 'warning' },
            ];
            return (
                <div className="cd-health-grid">
                    {items.map((item, i) => (
                        <div key={i} className="cd-health-item">
                            <div className="cd-health-dot">
                                {item.status === 'ok' ? '🟢' : item.status === 'warning' ? '🟡' : '🔴'}
                            </div>
                            <div className="cd-health-label">{item.label}</div>
                        </div>
                    ))}
                </div>
            );
        }

        if (widget.type === 'alert_feed') {
            return (
                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    {(data || []).slice(0, 5).map((alert, i) => (
                        <div
                            key={i}
                            style={{
                                padding: '8px',
                                borderLeft: `3px solid ${alert.severity === 'critical' ? THEME.danger : alert.severity === 'warning' ? THEME.warning : THEME.success}`,
                                borderRadius: 16,
                                marginBottom: 8,
                                fontSize: 11,
                                color: THEME.textDim,
                            }}
                        >
                            <div style={{ fontWeight: 700, marginBottom: 2 }}>{alert.title}</div>
                            <div style={{ fontSize: 10, color: THEME.textMuted }}>{alert.message}</div>
                        </div>
                    ))}
                </div>
            );
        }

        if (widget.type === 'sparkline') {
            return (
                <ResponsiveContainer width="100%" height={60}>
                    <LineChart data={Array.isArray(data) ? data : []}>
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke={THEME.primary}
                            dot={false}
                            isAnimationActive={false}
                            strokeWidth={2}
                        />
                    </LineChart>
                </ResponsiveContainer>
            );
        }

        if (widget.type === 'text_note') {
            return (
                <div style={{ fontSize: 13, color: THEME.textDim, lineHeight: '1.6', fontFamily: 'monospace' }}>
                    {widget.content || 'No content'}
                </div>
            );
        }

        return <div style={{ color: THEME.textDim }}>Unknown widget type</div>;
    };

    return (
        <div
            className="cd-widget"
            style={{
                gridColumn: `span ${widget.size === 'large' ? 2 : widget.size === 'medium' ? 1 : 1}`,
            }}
        >
            <div className="cd-widget-drag-handle" title="Drag to reorder">
                <Move size={14} />
            </div>
            <div className="cd-widget-toolbar">
                <div
                    className="cd-widget-icon"
                    onClick={() => onEdit(widget)}
                    title="Edit widget"
                    style={{ cursor: 'pointer' }}
                >
                    <Edit2 size={14} />
                </div>
                <div style={{ position: 'relative' }}>
                    <MoreVertical
                        size={14}
                        className="cd-widget-icon"
                        onClick={() => setShowMenu(!showMenu)}
                        title="More options"
                        style={{ cursor: 'pointer' }}
                    />
                    {showMenu && (
                        <div
                            style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                background: THEME.surface,
                                border: `1px solid ${THEME.glassBorder}`,
                                borderRadius: 18,
                                minWidth: 150,
                                zIndex: 100,
                            }}
                        >
                            <div
                                style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    color: THEME.danger,
                                    fontSize: 12,
                                    borderRadius: 16,
                                    transition: 'all .2s ease',
                                }}
                                onClick={() => {
                                    onRemove(widget.id);
                                    setShowMenu(false);
                                }}
                                onMouseEnter={(e) => (e.target.style.background = THEME.surfaceHover)}
                                onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                            >
                                Remove Widget
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div style={{ marginTop: 16, marginRight: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textMain, marginBottom: 12 }}>
                    {widget.title}
                </div>
                {widget.subtitle && (
                    <div style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 8 }}>{widget.subtitle}</div>
                )}
                {renderContent()}
            </div>
        </div>
    );
};

/* ── Widget Configuration Modal ─────────────────────────────────────────── */
const WidgetConfigModal = ({ isOpen, onClose, onSave, widget, metrics, categories }) => {
    const [config, setConfig] = useState(
        widget || {
            type: 'stat_card',
            title: '',
            subtitle: '',
            metricId: '',
            size: 'medium',
            refreshInterval: 30000,
            thresholdWarning: 80,
            thresholdCritical: 95,
            content: '',
        },
    );

    const handleSave = () => {
        if (!config.title || !config.metricId) {
            alert('Title and Metric are required');
            return;
        }
        onSave(config);
        onClose();
    };

    if (!isOpen) return null;

    const selectedMetric = metrics.find((m) => m.id === config.metricId);

    return (
        <div className="cd-modal" onClick={onClose}>
            <div className="cd-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="cd-modal-title">{widget ? 'Edit Widget' : 'Add Widget'}</div>

                <div className="cd-modal-section">
                    <div className="cd-modal-section-title">Widget Type</div>
                    <select
                        className="cd-select"
                        value={config.type}
                        onChange={(e) => setConfig({ ...config, type: e.target.value })}
                    >
                        <option value="stat_card">Stat Card</option>
                        <option value="metric_chart">Metric Chart (Line)</option>
                        <option value="gauge">Gauge</option>
                        <option value="health_grid">Health Grid</option>
                        <option value="alert_feed">Alert Feed</option>
                        <option value="sparkline">Sparkline</option>
                        <option value="text_note">Text Note</option>
                    </select>
                </div>

                <div className="cd-modal-section">
                    <div className="cd-modal-field">
                        <div className="cd-label">Widget Title</div>
                        <input
                            className="cd-input"
                            placeholder="e.g., Cache Hit Ratio"
                            value={config.title}
                            onChange={(e) => setConfig({ ...config, title: e.target.value })}
                        />
                    </div>
                    <div className="cd-modal-field">
                        <div className="cd-label">Subtitle (Optional)</div>
                        <input
                            className="cd-input"
                            placeholder="e.g., PostgreSQL Instance"
                            value={config.subtitle || ''}
                            onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                        />
                    </div>
                </div>

                {config.type !== 'text_note' && (
                    <div className="cd-modal-section">
                        <div className="cd-modal-section-title">Metric Source</div>
                        <div className="cd-modal-field">
                            <div className="cd-label">Select Metric</div>
                            <select
                                className="cd-select"
                                value={config.metricId}
                                onChange={(e) => setConfig({ ...config, metricId: e.target.value })}
                            >
                                <option value="">Choose a metric...</option>
                                {categories.map((cat) => (
                                    <optgroup key={cat} label={cat}>
                                        {metrics
                                            .filter((m) => m.category === cat)
                                            .map((m) => (
                                                <option key={m.id} value={m.id}>
                                                    {m.label}
                                                </option>
                                            ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                        {selectedMetric && (
                            <div
                                style={{
                                    fontSize: 11,
                                    color: THEME.textMuted,
                                    marginTop: 8,
                                    padding: 8,
                                    background: THEME.surfaceHover,
                                    borderRadius: 18,
                                }}
                            >
                                {selectedMetric.description}
                            </div>
                        )}
                    </div>
                )}

                {config.type === 'text_note' && (
                    <div className="cd-modal-section">
                        <div className="cd-modal-field">
                            <div className="cd-label">Content (Markdown)</div>
                            <textarea
                                className="cd-input"
                                placeholder="Enter markdown content..."
                                value={config.content || ''}
                                onChange={(e) => setConfig({ ...config, content: e.target.value })}
                                style={{ minHeight: '100px', fontFamily: 'monospace', fontSize: 12 }}
                            />
                        </div>
                    </div>
                )}

                <div className="cd-modal-section">
                    <div className="cd-modal-section-title">Display Settings</div>
                    <div className="cd-modal-field">
                        <div className="cd-label">Widget Size</div>
                        <select
                            className="cd-select"
                            value={config.size}
                            onChange={(e) => setConfig({ ...config, size: e.target.value })}
                        >
                            <option value="small">Small (1 column)</option>
                            <option value="medium">Medium (1 column)</option>
                            <option value="large">Large (2 columns)</option>
                        </select>
                    </div>
                    <div className="cd-modal-field">
                        <div className="cd-label">Refresh Interval (ms)</div>
                        <select
                            className="cd-select"
                            value={config.refreshInterval}
                            onChange={(e) => setConfig({ ...config, refreshInterval: parseInt(e.target.value) })}
                        >
                            <option value={5000}>5 seconds</option>
                            <option value={15000}>15 seconds</option>
                            <option value={30000}>30 seconds</option>
                            <option value={60000}>1 minute</option>
                            <option value={300000}>5 minutes</option>
                        </select>
                    </div>
                </div>

                {['gauge', 'metric_chart'].includes(config.type) && (
                    <div className="cd-modal-section">
                        <div className="cd-modal-section-title">Thresholds</div>
                        <div className="cd-modal-field">
                            <div className="cd-label">Warning Threshold</div>
                            <input
                                className="cd-input"
                                type="number"
                                value={config.thresholdWarning}
                                onChange={(e) => setConfig({ ...config, thresholdWarning: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div className="cd-modal-field">
                            <div className="cd-label">Critical Threshold</div>
                            <input
                                className="cd-input"
                                type="number"
                                value={config.thresholdCritical}
                                onChange={(e) =>
                                    setConfig({ ...config, thresholdCritical: parseFloat(e.target.value) })
                                }
                            />
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 22, marginTop: 20 }}>
                    <button className="cd-button" onClick={handleSave}>
                        {widget ? 'Update Widget' : 'Add Widget'}
                    </button>
                    <button className="cd-button" style={{ background: THEME.surfaceHover }} onClick={onClose}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ── Template Gallery Modal ────────────────────────────────────────────── */
const TemplateGalleryModal = ({ isOpen, onClose, onApply }) => {
    const templates = [
        {
            id: 'performance',
            name: 'Performance Overview',
            icon: '⚡',
            description: 'Cache, TPS, and query metrics',
            widgets: [
                { id: 1, type: 'stat_card', title: 'Cache Hit Ratio', metricId: 'cache_hit_ratio', size: 'medium' },
                {
                    id: 2,
                    type: 'stat_card',
                    title: 'Active Connections',
                    metricId: 'active_connections',
                    size: 'medium',
                },
                {
                    id: 3,
                    type: 'metric_chart',
                    title: 'Transactions/sec',
                    metricId: 'transactions_per_sec',
                    size: 'large',
                },
            ],
        },
        {
            id: 'health',
            name: 'Connection Health',
            icon: '💚',
            description: 'Connection and lock monitoring',
            widgets: [
                { id: 1, type: 'health_grid', title: 'System Health', size: 'large' },
                { id: 2, type: 'gauge', title: 'Connection Usage', metricId: 'active_connections', size: 'medium' },
                { id: 3, type: 'alert_feed', title: 'Recent Alerts', size: 'medium' },
            ],
        },
        {
            id: 'storage',
            name: 'Storage Analysis',
            icon: '💾',
            description: 'Database and table growth',
            widgets: [
                { id: 1, type: 'stat_card', title: 'Database Size', metricId: 'db_size', size: 'medium' },
                { id: 2, type: 'stat_card', title: 'Dead Tuples', metricId: 'dead_tuples_ratio', size: 'medium' },
                {
                    id: 3,
                    type: 'metric_chart',
                    title: 'Maintenance Activity',
                    metricId: 'vacuum_running',
                    size: 'large',
                },
            ],
        },
        {
            id: 'replication',
            name: 'Replication Monitor',
            icon: '🔄',
            description: 'Replication lag and WAL metrics',
            widgets: [
                { id: 1, type: 'gauge', title: 'Replication Lag', metricId: 'replication_lag', size: 'medium' },
                { id: 2, type: 'sparkline', title: 'WAL Rate', metricId: 'wal_generation_rate', size: 'medium' },
                { id: 3, type: 'metric_chart', title: 'Lag Trend', metricId: 'replication_lag', size: 'large' },
            ],
        },
    ];

    if (!isOpen) return null;

    return (
        <div className="cd-modal" onClick={onClose}>
            <div className="cd-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="cd-modal-title">Dashboard Templates</div>
                <div className="cd-templateGallery">
                    {templates.map((t) => (
                        <div
                            key={t.id}
                            className="cd-templateCard"
                            onClick={() => {
                                onApply(t.widgets);
                                onClose();
                            }}
                        >
                            <div className="cd-templateIcon">{t.icon}</div>
                            <div className="cd-templateName">{t.name}</div>
                            <div className="cd-templateDesc">{t.description}</div>
                        </div>
                    ))}
                </div>
                <div style={{ marginTop: 20 }}>
                    <button className="cd-button" style={{ background: THEME.surfaceHover }} onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   CUSTOM DASHBOARD TAB
   ═══════════════════════════════════════════════════════════════════════════ */
export default function CustomDashboardTab() {
    useAdaptiveTheme();
    const [widgets, setWidgets] = useState(() => {
        try {
            const saved = localStorage.getItem('fathom_custom_dashboards');
            if (saved) {
                const dashboards = JSON.parse(saved);
                const activeName = localStorage.getItem('fathom_active_dashboard');
                const active = dashboards.find((d) => d.name === activeName);
                return active ? active.widgets : [];
            }
            return [];
        } catch {
            return [];
        }
    });

    const [metrics, setMetrics] = useState([]);
    const [categories, setCategories] = useState([]);
    const [widgetData, setWidgetData] = useState({});
    const [loadingWidgets, setLoadingWidgets] = useState({});
    const [error, setError] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false);
    const [editingWidget, setEditingWidget] = useState(null);
    const [dashboardName, setDashboardName] = useState('Custom Dashboard');

    // Load available metrics
    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchData('/api/metrics/registry');
                setMetrics(data?.metrics || []);
                setError(null);
                const cats = await fetchData('/api/metrics/categories');
                setCategories(cats?.categories || []);
            } catch (e) {
                console.error('Failed to load metrics:', e);
                setError('Failed to load metrics: ' + e.message);
            }
        };
        load();
    }, []);

    // Load widget data with useCallback
    const loadWidgetData = useCallback(async () => {
        let cancelled = false;

        for (const widget of widgets) {
            if (!widget.metricId) continue;

            if (cancelled) return;
            setLoadingWidgets((prev) => ({ ...prev, [widget.id]: true }));
            try {
                let data;
                if (widget.type === 'metric_chart' || widget.type === 'sparkline') {
                    data = await fetchData(`/api/metrics/history/${widget.metricId}?hours=24`);
                    data = data?.history || [];
                } else {
                    const current = await fetchData('/api/metrics/current');
                    data = current?.current?.[widget.metricId]?.value;
                }
                if (!cancelled) {
                    setWidgetData((prev) => ({ ...prev, [widget.id]: data }));
                    setError(null);
                }
            } catch (e) {
                console.error(`Failed to load data for widget ${widget.id}:`, e);
                if (!cancelled) {
                    setError(`Failed to load widget data: ${e.message}`);
                }
            } finally {
                if (!cancelled) {
                    setLoadingWidgets((prev) => ({ ...prev, [widget.id]: false }));
                }
            }
        }
    }, [widgets]);

    useEffect(() => {
        let cancelled = false;

        loadWidgetData();
        const interval = setInterval(loadWidgetData, 30000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [loadWidgetData]);

    const saveDashboard = () => {
        try {
            const dashboards = localStorage.getItem('fathom_custom_dashboards')
                ? JSON.parse(localStorage.getItem('fathom_custom_dashboards'))
                : [];

            const existingIndex = dashboards.findIndex((d) => d.name === dashboardName);
            const dashboard = { name: dashboardName, widgets, timestamp: new Date().toISOString() };

            if (existingIndex >= 0) {
                dashboards[existingIndex] = dashboard;
            } else {
                dashboards.push(dashboard);
            }

            localStorage.setItem('fathom_custom_dashboards', JSON.stringify(dashboards));
            localStorage.setItem('fathom_active_dashboard', dashboardName);
            alert('Dashboard saved successfully');
        } catch (e) {
            alert('Failed to save dashboard: ' + e.message);
        }
    };

    const handleAddWidget = (config) => {
        const newWidget = {
            ...config,
            id: Date.now(),
        };
        setWidgets([...widgets, newWidget]);
    };

    const handleEditWidget = (widget) => {
        setEditingWidget(widget);
        setModalOpen(true);
    };

    const handleUpdateWidget = (config) => {
        setWidgets(widgets.map((w) => (w.id === editingWidget.id ? { ...config, id: w.id } : w)));
        setEditingWidget(null);
    };

    const handleRemoveWidget = (id) => {
        setWidgets(widgets.filter((w) => w.id !== id));
    };

    const applyTemplate = (templateWidgets) => {
        setWidgets(templateWidgets.map((w) => ({ ...w, id: Date.now() + 0 })));
    };

    const exportDashboard = () => {
        try {
            const data = JSON.stringify({ name: dashboardName, widgets }, null, 2);
            const element = document.createElement('a');
            element.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(data));
            element.setAttribute('download', `dashboard-${dashboardName}.json`);
            element.style.display = 'none';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
        } catch (e) {
            alert('Failed to export: ' + e.message);
        }
    };

    return (
        <div style={{ padding: '0 0 20px 0' }}>
            <Styles />

            {/* Header */}
            <div className="cd-card" style={{ marginBottom: 20 }}>
                <div
                    className="cd-card-ribbon"
                    style={{ '--ribbon-color': THEME.primary, '--ribbon-end': THEME.primary + 'cc' }}
                >
                    <Layout size={16} color="white" />
                    <span>Custom Dashboard</span>
                </div>
                <div
                    className="cd-card-body"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                    <div>
                        <input
                            className="cd-input"
                            placeholder="Dashboard name..."
                            value={dashboardName}
                            onChange={(e) => setDashboardName(e.target.value)}
                            style={{ width: '300px', fontSize: 12 }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button className="cd-button" onClick={() => setTemplateGalleryOpen(true)}>
                            <Grid size={14} style={{ marginRight: 6 }} />
                            Templates
                        </button>
                        <button className="cd-button" onClick={() => setModalOpen(true)}>
                            <Plus size={14} style={{ marginRight: 6 }} />
                            Add Widget
                        </button>
                        <button className="cd-button cd-button-secondary" onClick={saveDashboard}>
                            <Save size={14} style={{ marginRight: 6 }} />
                            Save
                        </button>
                        <button className="cd-button cd-button-secondary" onClick={exportDashboard}>
                            <Download size={14} style={{ marginRight: 6 }} />
                            Export
                        </button>
                    </div>
                </div>
            </div>

            {/* Widgets Grid */}
            {widgets.length > 0 ? (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: 20,
                        marginBottom: 20,
                    }}
                >
                    {widgets.map((widget) => (
                        <DashboardWidget
                            key={widget.id}
                            widget={widget}
                            onRemove={handleRemoveWidget}
                            onEdit={handleEditWidget}
                            data={widgetData[widget.id]}
                            loading={loadingWidgets[widget.id]}
                        />
                    ))}
                </div>
            ) : (
                <div className="cd-card">
                    <div
                        className="cd-card-ribbon"
                        style={{ '--ribbon-color': THEME.warning, '--ribbon-end': THEME.warning + 'cc' }}
                    >
                        <AlertTriangle size={16} color="white" />
                        <span>Getting Started</span>
                    </div>
                    <div className="cd-card-body" style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <div style={{ color: THEME.textMuted, fontSize: 14, marginBottom: 20 }}>
                            No widgets added yet. Create your custom dashboard to get started.
                        </div>
                        <button className="cd-button" onClick={() => setTemplateGalleryOpen(true)}>
                            <Grid size={14} style={{ marginRight: 6 }} />
                            Browse Templates
                        </button>
                    </div>
                </div>
            )}

            {/* Modals */}
            <WidgetConfigModal
                isOpen={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setEditingWidget(null);
                }}
                onSave={editingWidget ? handleUpdateWidget : handleAddWidget}
                widget={editingWidget}
                metrics={metrics}
                categories={categories}
            />

            <TemplateGalleryModal
                isOpen={templateGalleryOpen}
                onClose={() => setTemplateGalleryOpen(false)}
                onApply={applyTemplate}
            />
        </div>
    );
}
