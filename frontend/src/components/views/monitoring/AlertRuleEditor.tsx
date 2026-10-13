import React, { useState, useEffect, useCallback } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { fetchData, postData, deleteData } from '../../../utils/api';
import {
    Bell, Plus, Trash2, Edit3, Save, X, AlertTriangle, Info, AlertCircle,
    ToggleLeft, ToggleRight, Mail, MessageSquare, Monitor, Activity, TrendingUp, Zap
} from 'lucide-react';

/* ── Styles ───────────────────────────────────────────────────────────────── */
const Styles = () => (
    <style>{`
        @keyframes areFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes areSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes anomPulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        .are-card {
            background: linear-gradient(180deg, ${THEME.surface} 0%, ${THEME.surface}f8 100%);
            border: 1px solid ${THEME.glassBorder};
            border-radius: 20px;
            padding: 24px;
            position: relative;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
            transition: all 0.25s ease;
            animation: areFade 0.3s ease;
            backdrop-filter: blur(12px);
        }
        .are-card:hover {
            box-shadow: 0 8px 28px rgba(0,0,0,0.12);
            transform: translateY(-4px);
        }
        .are-card::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: var(--tile-accent, ${THEME.primary});
            opacity: 0.7;
        }
        .are-badge { display: inline-block; padding: 4px 10px; border-radius: 22px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .are-spin { animation: areSpin 1s linear infinite; }
        /* background is explicit: without it the inactive tab falls through to
           the browser's default button chrome — a light pill under light text. */
        .are-tab { padding: 8px 16px; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; background: transparent; border: 1px solid transparent; transition: all 0.2s ease; }
        .are-tab.active { background: ${THEME.primary}20; color: ${THEME.primary}; border-color: ${THEME.primary}40; }
        .are-tab:not(.active) { color: ${THEME.textMuted}; }
        .are-tab:not(.active):hover { background: ${THEME.surfaceLight}; color: ${THEME.textMain}; }
        .anomaly-dot { width: 8px; height: 8px; border-radius: 50%; background: ${THEME.warning}; animation: anomPulse 2s infinite; display: inline-block; }
    `}</style>
);

/* ── Metric options ──────────────────────────────────────────────────────── */
const METRICS = ['CPU Usage', 'Memory', 'Replication Lag', 'Long Queries', 'Cache Hit Ratio', 'Connections', 'Disk Usage'];
const CONDITIONS = ['Greater Than', 'Less Than', 'Equals'];
const DURATIONS = ['1m', '5m', '15m', '30m', '1h'];
const SEVERITIES = ['info', 'warning', 'critical'];
const ANOMALY_METHODS = [
    { value: 'zscore', label: 'Z-Score', desc: 'Flags points beyond N standard deviations from a rolling mean' },
    { value: 'ewma', label: 'EWMA', desc: 'Exponentially-weighted moving average — more weight on recent data' },
    { value: 'seasonal', label: 'Seasonal', desc: 'Hour-of-week seasonal residual — catches day/time pattern breaks' },
];
const CHANNELS = [
    { id: 'in-app', label: 'In-App', icon: Monitor },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'slack', label: 'Slack Webhook', icon: MessageSquare },
];

/* ── Severity color mapping ──────────────────────────────────────────────── */
const getSeverityColor = (severity) => {
    switch (severity) {
        case 'info': return THEME.info;
        case 'warning': return THEME.warning;
        case 'critical': return THEME.danger;
        default: return THEME.textMuted;
    }
};

/* ── Get metric unit ─────────────────────────────────────────────────────── */
const getMetricUnit = (metric) => {
    const units = {
        'CPU Usage': '%', 'Memory': '%', 'Replication Lag': 'ms',
        'Long Queries': 'sec', 'Cache Hit Ratio': '%', 'Connections': '#', 'Disk Usage': '%',
    };
    return units[metric] || '';
};

const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    background: THEME.surface,
    border: `1px solid ${THEME.glassBorder}`,
    borderRadius: '10px',
    color: THEME.textMain,
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box' as const,
};

const labelStyle = {
    fontSize: '11px',
    fontWeight: 600 as const,
    color: THEME.textMuted,
    letterSpacing: '0.5px',
    marginBottom: '6px',
    display: 'block',
    textTransform: 'uppercase' as const,
};

/* ═══════════════════════════════════════════════════════════════════════════
   ANOMALY PREVIEW PANEL
   Shows live detection results when user configures an anomaly rule
   ═══════════════════════════════════════════════════════════════════════════ */
const AnomalyPreview = ({ metric, method, threshold, connectionId }) => {
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const runDetect = useCallback(async () => {
        if (!connectionId) return;
        setLoading(true);
        setError(null);
        try {
            const data = await postData('/api/anomaly/detect', {
                connectionId,
                metric,
                method,
                threshold: Number(threshold),
                windowSeconds: 3600,
            });
            setResult(data);
        } catch (err: any) {
            setError(err.message || 'Detection failed');
        } finally {
            setLoading(false);
        }
    }, [connectionId, metric, method, threshold]);

    useEffect(() => {
        const t = setTimeout(runDetect, 600);
        return () => clearTimeout(t);
    }, [runDetect]);

    if (!connectionId) return (
        <div style={{ padding: '12px', background: `${THEME.info}10`, border: `1px solid ${THEME.info}30`, borderRadius: '10px', fontSize: '12px', color: THEME.textMuted }}>
            <Info size={12} style={{ display: 'inline', marginRight: '6px' }} />
            Select a connection to preview live anomaly detection
        </div>
    );

    return (
        <div style={{ padding: '14px', background: `${THEME.warning}08`, border: `1px solid ${THEME.warning}30`, borderRadius: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span className="anomaly-dot" />
                <span style={{ fontSize: '12px', fontWeight: 700, color: THEME.warning }}>Live Anomaly Preview</span>
                {loading && <span className="are-spin" style={{ display: 'inline-block', fontSize: '12px', color: THEME.textMuted }}>⟳</span>}
            </div>
            {error && <div style={{ fontSize: '12px', color: THEME.danger }}>{error}</div>}
            {result && !loading && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: result.count > 0 ? THEME.danger : THEME.success }}>{result.count ?? 0}</div>
                        <div style={{ fontSize: '11px', color: THEME.textMuted }}>Anomalies (1h)</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: THEME.textMain }}>{result.method?.toUpperCase() || method.toUpperCase()}</div>
                        <div style={{ fontSize: '11px', color: THEME.textMuted }}>Method</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: THEME.primary }}>{threshold}σ</div>
                        <div style={{ fontSize: '11px', color: THEME.textMuted }}>Threshold</div>
                    </div>
                    {result.anomalies?.length > 0 && (
                        <div style={{ gridColumn: '1/-1', marginTop: '6px' }}>
                            <div style={{ fontSize: '11px', color: THEME.textMuted, marginBottom: '4px' }}>Recent anomalies:</div>
                            {result.anomalies.slice(0, 3).map((a, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '4px 0', borderBottom: `1px solid ${THEME.glassBorder}` }}>
                                    <span style={{ color: THEME.textMuted }}>{new Date(a.t).toLocaleTimeString()}</span>
                                    <span style={{ color: THEME.danger, fontWeight: 600 }}>v={a.v?.toFixed(2)} (score {a.score?.toFixed(2)})</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   RULE FORM (Edit/Create) — threshold OR anomaly mode
   ═══════════════════════════════════════════════════════════════════════════ */
const RuleForm = ({ rule, onSave, onCancel, saving, connections }) => {
    const [ruleType, setRuleType] = useState<'threshold' | 'anomaly'>(rule?.rule_type || 'threshold');

    // Merge over the defaults, never replace them.
    //
    // This was `useState(rule || {...})`, so editing an existing rule set the
    // form to the raw database row — which has no `notification_channels`. The
    // render then calls `form.notification_channels.includes(...)`, which throws
    // on undefined and takes the whole section down with it. It only ever
    // worked because nothing was loading real rules until now.
    //
    // `channels` is what GET /api/alerts/rules returns (derived from the
    // notify_email / notify_slack booleans); `notification_channels` is what
    // this form speaks. Map at the boundary rather than teach the form two
    // vocabularies.
    const DEFAULTS = {
        name: '',
        metric: 'CPU Usage',
        condition: 'Greater Than',
        threshold: 80,
        duration: '5m',
        severity: 'warning',
        notification_channels: ['in-app'],
        enabled: true,
        // anomaly fields
        rule_type: 'threshold',
        anomaly_method: 'zscore',
        anomaly_threshold: 3.0,
        connection_id: '',
    };

    const [form, setForm] = useState(() => {
        if (!rule) return DEFAULTS;
        const channels = Array.isArray(rule.notification_channels)
            ? rule.notification_channels
            : Array.isArray(rule.channels)
              ? rule.channels
              : DEFAULTS.notification_channels;
        return {
            ...DEFAULTS,
            ...rule,
            // Nulls from the database must not defeat the defaults — spreading
            // `rule` overwrites with null, which breaks the same way undefined does.
            duration: rule.duration ?? DEFAULTS.duration,
            severity: rule.severity ?? DEFAULTS.severity,
            condition: rule.condition ?? DEFAULTS.condition,
            metric: rule.metric ?? DEFAULTS.metric,
            threshold: rule.threshold ?? DEFAULTS.threshold,
            connection_id: rule.connection_id ?? '',
            notification_channels: channels,
        };
    });

    const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    const handleChannelToggle = (channelId) => {
        setForm(prev => ({
            ...prev,
            // Belt and braces: the initialiser guarantees an array, but a
            // future path that setForm()s a raw row shouldn't crash the tab.
            notification_channels: (prev.notification_channels ?? []).includes(channelId)
                ? prev.notification_channels.filter(c => c !== channelId)
                : [...prev.notification_channels, channelId],
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.name.trim()) { alert('Please enter a rule name'); return; }
        onSave({ ...form, rule_type: ruleType });
    };

    const unit = getMetricUnit(form.metric);

    return (
        <form onSubmit={handleSubmit} style={{ background: `linear-gradient(135deg, ${THEME.surface}80, ${THEME.elevated}80)`, border: `1px solid ${THEME.glassBorder}`, borderRadius: '14px', padding: '24px', marginBottom: '20px' }}>
            {/* Rule type tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                <button type="button" className={`are-tab ${ruleType === 'threshold' ? 'active' : ''}`} onClick={() => { setRuleType('threshold'); handleChange('rule_type', 'threshold'); }}>
                    <TrendingUp size={12} style={{ display: 'inline', marginRight: '6px' }} />
                    Threshold
                </button>
                <button type="button" className={`are-tab ${ruleType === 'anomaly' ? 'active' : ''}`} onClick={() => { setRuleType('anomaly'); handleChange('rule_type', 'anomaly'); }}>
                    <Activity size={12} style={{ display: 'inline', marginRight: '6px' }} />
                    Anomaly Detection
                </button>
                {ruleType === 'anomaly' && (
                    <span style={{ marginLeft: 'auto', fontSize: '11px', color: THEME.textMuted, alignSelf: 'center' }}>
                        Fires when a metric deviates statistically from its normal pattern
                    </span>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                {/* Name */}
                <div>
                    <label style={labelStyle}>Rule Name</label>
                    <input type="text" placeholder="e.g., High CPU Alert" value={form.name} onChange={(e) => handleChange('name', e.target.value)} style={inputStyle} onFocus={(e) => { e.target.style.borderColor = THEME.borderHot; }} onBlur={(e) => { e.target.style.borderColor = THEME.glassBorder; }} />
                </div>

                {/* Metric */}
                <div>
                    <label style={labelStyle}>Metric</label>
                    <select value={form.metric} onChange={(e) => handleChange('metric', e.target.value)} style={inputStyle} onFocus={(e) => { e.target.style.borderColor = THEME.borderHot; }} onBlur={(e) => { e.target.style.borderColor = THEME.glassBorder; }}>
                        {METRICS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>

                {ruleType === 'threshold' ? (
                    <>
                        {/* Condition */}
                        <div>
                            <label style={labelStyle}>Condition</label>
                            <select value={form.condition} onChange={(e) => handleChange('condition', e.target.value)} style={inputStyle} onFocus={(e) => { e.target.style.borderColor = THEME.borderHot; }} onBlur={(e) => { e.target.style.borderColor = THEME.glassBorder; }}>
                                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        {/* Threshold */}
                        <div>
                            <label style={labelStyle}>Threshold {unit && `(${unit})`}</label>
                            <input type="number" value={form.threshold} onChange={(e) => handleChange('threshold', Number(e.target.value))} style={inputStyle} onFocus={(e) => { e.target.style.borderColor = THEME.borderHot; }} onBlur={(e) => { e.target.style.borderColor = THEME.glassBorder; }} />
                        </div>
                    </>
                ) : (
                    <>
                        {/* Anomaly method */}
                        <div>
                            <label style={labelStyle}>Detection Method</label>
                            <select value={form.anomaly_method} onChange={(e) => handleChange('anomaly_method', e.target.value)} style={inputStyle} onFocus={(e) => { e.target.style.borderColor = THEME.borderHot; }} onBlur={(e) => { e.target.style.borderColor = THEME.glassBorder; }}>
                                {ANOMALY_METHODS.map(m => <option key={m.value} value={m.value}>{m.label} — {m.desc}</option>)}
                            </select>
                        </div>
                        {/* Sensitivity (sigma threshold) */}
                        <div>
                            <label style={labelStyle}>Sensitivity (σ threshold) — lower = more sensitive</label>
                            <input type="number" min="1" max="10" step="0.5" value={form.anomaly_threshold} onChange={(e) => handleChange('anomaly_threshold', Number(e.target.value))} style={inputStyle} onFocus={(e) => { e.target.style.borderColor = THEME.borderHot; }} onBlur={(e) => { e.target.style.borderColor = THEME.glassBorder; }} />
                        </div>
                        {/* Connection */}
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelStyle}>Connection (for live preview)</label>
                            <select value={form.connection_id} onChange={(e) => handleChange('connection_id', e.target.value)} style={inputStyle} onFocus={(e) => { e.target.style.borderColor = THEME.borderHot; }} onBlur={(e) => { e.target.style.borderColor = THEME.glassBorder; }}>
                                <option value="">Select connection…</option>
                                {(connections || []).map(c => <option key={c.id} value={c.id}>{c.name} ({c.host})</option>)}
                            </select>
                        </div>
                        {/* Live preview */}
                        <div style={{ gridColumn: '1/-1' }}>
                            <AnomalyPreview metric={form.metric} method={form.anomaly_method} threshold={form.anomaly_threshold} connectionId={form.connection_id} />
                        </div>
                    </>
                )}

                {/* Duration */}
                <div>
                    <label style={labelStyle}>Evaluation Duration</label>
                    <select value={form.duration} onChange={(e) => handleChange('duration', e.target.value)} style={inputStyle} onFocus={(e) => { e.target.style.borderColor = THEME.borderHot; }} onBlur={(e) => { e.target.style.borderColor = THEME.glassBorder; }}>
                        {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>

                {/* Severity */}
                <div>
                    <label style={labelStyle}>Severity</label>
                    <select value={form.severity} onChange={(e) => handleChange('severity', e.target.value)} style={inputStyle} onFocus={(e) => { e.target.style.borderColor = THEME.borderHot; }} onBlur={(e) => { e.target.style.borderColor = THEME.glassBorder; }}>
                        {SEVERITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                </div>
            </div>

            {/* Notification Channels */}
            <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Notification Channels</label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' as const }}>
                    {CHANNELS.map(ch => {
                        const Icon = ch.icon;
                        const active = (form.notification_channels ?? []).includes(ch.id);
                        return (
                            <button key={ch.id} type="button" onClick={() => handleChannelToggle(ch.id)}
                                style={{ padding: '8px 14px', background: active ? `${THEME.primary}20` : THEME.surfaceLight, color: active ? THEME.primary : THEME.textMuted, border: `1px solid ${active ? THEME.primary + '40' : THEME.glassBorder}`, borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, transition: 'all 0.2s ease' }}>
                                <Icon size={13} />{ch.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={onCancel} style={{ padding: '10px 20px', background: THEME.surfaceLight, color: THEME.textMuted, border: `1px solid ${THEME.glassBorder}`, borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <X size={14} />Cancel
                </button>
                <button type="submit" disabled={saving} style={{ padding: '10px 20px', background: THEME.primary, color: THEME.void, border: 'none', borderRadius: '10px', cursor: saving ? 'wait' : 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', opacity: saving ? 0.7 : 1 }}>
                    {saving ? <span className="are-spin" style={{ display: 'inline-block' }}>⟳</span> : <Save size={14} />}
                    {saving ? 'Saving…' : 'Save Rule'}
                </button>
            </div>
        </form>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   RULE CARD
   ═══════════════════════════════════════════════════════════════════════════ */
const RuleCard = ({ rule, onEdit, onDelete, deleting }) => {
    const isAnomaly = rule.rule_type === 'anomaly';
    return (
        <div className="are-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '14px', background: `${getSeverityColor(rule.severity)}15`, border: `1px solid ${getSeverityColor(rule.severity)}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isAnomaly ? <Activity size={18} color={getSeverityColor(rule.severity)} /> : <Bell size={18} color={getSeverityColor(rule.severity)} />}
                    </div>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: THEME.textMain, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {rule.name}
                            {isAnomaly && <span className="are-badge" style={{ background: `${THEME.warning}15`, color: THEME.warning, border: `1px solid ${THEME.warning}30` }}>Anomaly</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: THEME.textMuted, marginTop: '2px' }}>{rule.metric}</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                    <div>
                        <div style={{ color: THEME.textMuted, marginBottom: '2px' }}>{isAnomaly ? 'Method' : 'Condition'}</div>
                        <div style={{ color: THEME.textMain, fontWeight: 600 }}>
                            {isAnomaly
                                ? `${ANOMALY_METHODS.find(m => m.value === rule.anomaly_method)?.label || rule.anomaly_method} @ ${rule.anomaly_threshold}σ`
                                : `${rule.condition} ${rule.threshold}${getMetricUnit(rule.metric)}`}
                        </div>
                    </div>
                    <div>
                        <div style={{ color: THEME.textMuted, marginBottom: '2px' }}>Duration</div>
                        {/* alert_rules has cooldown_minutes, not duration — a rule
                            loaded from the database has no duration at all. An
                            empty cell reads as a rendering fault; a dash says
                            "not set". */}
                        <div style={{ color: rule.duration ? THEME.textMain : THEME.textMuted, fontWeight: 600 }}>
                            {rule.duration || (rule.cooldown_minutes ? `${rule.cooldown_minutes}m cooldown` : '—')}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px', flexWrap: 'wrap' as const }}>
                    <span className="are-badge" style={{ background: `${getSeverityColor(rule.severity)}20`, color: getSeverityColor(rule.severity), border: `1px solid ${getSeverityColor(rule.severity)}40` }}>{rule.severity}</span>
                    <span className="are-badge" style={{ background: rule.enabled ? `${THEME.success}20` : `${THEME.textMuted}20`, color: rule.enabled ? THEME.success : THEME.textMuted, border: rule.enabled ? `1px solid ${THEME.success}40` : `1px solid ${THEME.textMuted}40` }}>
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' as const }}>
                <button onClick={() => onEdit(rule)} style={{ padding: '8px 14px', background: THEME.surfaceLight, color: THEME.textMain, border: `1px solid ${THEME.glassBorder}`, borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600 }}>
                    <Edit3 size={13} />Edit
                </button>
                <button onClick={() => onDelete(rule.id)} disabled={deleting} style={{ padding: '8px 14px', background: `${THEME.danger}15`, color: THEME.danger, border: `1px solid ${THEME.danger}40`, borderRadius: '10px', cursor: deleting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600 }}>
                    <Trash2 size={13} />{deleting ? 'Deleting…' : 'Delete'}
                </button>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   ALERT RULE EDITOR (Main)
   ═══════════════════════════════════════════════════════════════════════════ */
export default function AlertRuleEditor() {
    useAdaptiveTheme();
    const [rules, setRules] = useState<any[]>([]);
    const [connections, setConnections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingRule, setEditingRule] = useState<any>(null);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'threshold' | 'anomaly'>('all');

    useEffect(() => { loadRules(); loadConnections(); }, []);

    const loadRules = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const data = await fetchData('/api/alerts/rules');
            // GET /api/alerts/rules returns a bare array. This read data.rules,
            // which is undefined on an array — so every seeded rule was
            // discarded and the screen showed "no rules" however many existed.
            // Accept both shapes rather than break whichever caller expects the
            // other.
            setRules(Array.isArray(data) ? data : (data?.rules ?? []));
        } catch (err: any) {
            setError(err.message || 'Failed to load alert rules');
        } finally { setLoading(false); }
    }, []);

    const loadConnections = useCallback(async () => {
        try {
            const data = await fetchData('/api/connections');
            setConnections(data.connections || data || []);
        } catch { /* non-fatal */ }
    }, []);

    const handleSaveRule = useCallback(async (rule) => {
        setSaving(true);
        try {
            if (editingRule) await postData(`/api/alerts/rules/${editingRule.id}`, rule);
            else await postData('/api/alerts/rules', rule);
            await loadRules();
            setShowForm(false); setEditingRule(null);
        } catch (err: any) { alert(`Error: ${err.message}`); }
        finally { setSaving(false); }
    }, [editingRule, loadRules]);

    const handleDeleteRule = useCallback(async (ruleId) => {
        if (!confirm('Delete this alert rule? This cannot be undone.')) return;
        setDeleting(ruleId);
        try { await deleteData(`/api/alerts/rules/${ruleId}`); await loadRules(); }
        catch (err: any) { alert(`Error: ${err.message}`); }
        finally { setDeleting(null); }
    }, [loadRules]);

    const filteredRules = rules.filter(r => filter === 'all' || (r.rule_type || 'threshold') === filter);
    const anomalyCount = rules.filter(r => r.rule_type === 'anomaly').length;

    return (
        <div style={{ padding: '20px' }}>
            <Styles />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: THEME.textMain, margin: 0, marginBottom: '4px' }}>Alert Rules</h2>
                    <p style={{ fontSize: '13px', color: THEME.textMuted, margin: 0 }}>
                        Threshold and anomaly-based alerting
                        {/* One style prop, merged. There were two: JSX keeps the
                            last and silently drops the rest, so the marginLeft
                            never applied and the badge sat flush against the
                            text. esbuild warns about this; nothing else does. */}
                        {anomalyCount > 0 && (
                            <span
                                className="are-badge"
                                style={{
                                    marginLeft: '8px',
                                    background: `${THEME.warning}15`,
                                    color: THEME.warning,
                                    border: `1px solid ${THEME.warning}30`,
                                }}
                            >
                                {anomalyCount} anomaly {anomalyCount === 1 ? 'rule' : 'rules'}
                            </span>
                        )}
                    </p>
                </div>
                {!showForm && (
                    <button onClick={() => { setEditingRule(null); setShowForm(true); }}
                        style={{ padding: '10px 18px', background: THEME.primary, color: THEME.void, border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Plus size={15} />Add Rule
                    </button>
                )}
            </div>

            {/* Filter tabs */}
            {!showForm && rules.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    {(['all', 'threshold', 'anomaly'] as const).map(f => (
                        <button key={f} className={`are-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                            {f === 'all' ? `All (${rules.length})` : f === 'threshold' ? `Threshold (${rules.length - anomalyCount})` : `Anomaly (${anomalyCount})`}
                        </button>
                    ))}
                </div>
            )}

            {showForm ? (
                <RuleForm rule={editingRule} onSave={handleSaveRule} onCancel={() => { setShowForm(false); setEditingRule(null); }} saving={saving} connections={connections} />
            ) : (
                <>
                    {loading && <div style={{ textAlign: 'center', padding: '40px', color: THEME.textMuted }}>Loading alert rules…</div>}
                    {error && (
                        <div style={{ background: `${THEME.danger}15`, border: `1px solid ${THEME.danger}40`, borderRadius: '12px', padding: '16px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <AlertTriangle size={16} color={THEME.danger} />
                            <div style={{ fontSize: '13px', color: THEME.danger }}>{error}</div>
                        </div>
                    )}
                    {!loading && filteredRules.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {filteredRules.map(rule => (
                                <RuleCard key={rule.id} rule={rule} onEdit={(r) => { setEditingRule(r); setShowForm(true); }} onDelete={handleDeleteRule} deleting={deleting === rule.id} />
                            ))}
                        </div>
                    )}
                    {!loading && filteredRules.length === 0 && !error && (
                        <div style={{ textAlign: 'center', padding: '48px 20px', background: `linear-gradient(135deg, ${THEME.surface}80, ${THEME.elevated}80)`, border: `1px solid ${THEME.glassBorder}`, borderRadius: '14px' }}>
                            <Bell size={40} color={THEME.textMuted} style={{ marginBottom: '12px', opacity: 0.4 }} />
                            <div style={{ fontSize: '14px', fontWeight: 600, color: THEME.textMain, marginBottom: '6px' }}>No {filter !== 'all' ? filter : ''} rules yet</div>
                            <div style={{ fontSize: '12px', color: THEME.textMuted, marginBottom: '16px' }}>Create a threshold rule or use anomaly detection to catch statistical deviations</div>
                            <button onClick={() => { setEditingRule(null); setShowForm(true); }}
                                style={{ padding: '10px 18px', background: THEME.primary, color: THEME.void, border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                <Plus size={15} />Create Rule
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
