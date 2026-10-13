import React, { useState, useEffect, useCallback } from 'react';
import RollupTiersPanel from './RollupTiersPanel';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { fetchData, putData, postData } from '../../../utils/api';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Database, HardDrive, Trash2, TrendingDown, Save, AlertTriangle, RefreshCw } from 'lucide-react';

/* ── Styles ───────────────────────────────────────────────────────────────── */
const Styles = () => (
    <style>{`
        @keyframes rmSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes rmFade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .rm-card { background:${THEME.surface}; border:1px solid ${THEME.glassBorder}; border-radius: 20px; padding:20px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04); animation:rmFade .3s ease; transition:all 0.2s ease; backdrop-filter:blur(12px); }
        .rm-card:hover { border-color:${THEME.primary}30; transform:translateY(-4px); box-shadow:0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06); }
        .rm-card-section { padding:14px 20px; border-bottom:1px solid ${THEME.glassBorder}; background:${THEME.bg}06; }
        .rm-card-section:last-child { border-bottom:none; }
        .rm-label { font-size:12px; font-weight:700; color:${THEME.textMuted}; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; }
        .rm-input { background:${THEME.surfaceHover}; border:1px solid ${THEME.glassBorder}; border-radius: 22px; padding:12px 14px; color:${THEME.textMain}; font-size:13px; width:100%; }
        .rm-input:focus { outline:none; border-color:${THEME.primary}; }
        .rm-button { background:${THEME.primary}; color:${THEME.textInverse}; border:none; border-radius: 22px; padding:12px 18px; font-weight:700; font-size:13px; cursor:pointer; }
        .rm-button:hover { background:${THEME.primaryLight}; }
        .rm-button-danger { background:${THEME.danger}; }
        .rm-button-danger:hover { background:${THEME.dangerLight}; }
        .rm-spinner { animation:rmSpin 1s linear infinite; }
        .rm-row { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px; }
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
                border: `1px solid ${THEME.grid}`,
                borderRadius: 20,
                padding: '8px 12px',
                fontSize: 12,
            }}
        >
            <div style={{ color: THEME.textMuted, marginBottom: 4 }}>{label}</div>
            {payload.map((p) => (
                <div key={p.name} style={{ color: p.color, fontWeight: 600 }}>
                    {p.name}: {fmtBytes(p.value)}
                </div>
            ))}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   RETENTION MANAGEMENT TAB
   ═══════════════════════════════════════════════════════════════════════════ */
export default function RetentionManagementTab() {
    useAdaptiveTheme();
    const [policy, setPolicy] = useState(null);
    const [formValues, setFormValues] = useState({ metrics: 30, logs: 7, alerts: 90, audit: 365 });
    const [stats, setStats] = useState(null);
    const [growthData, setGrowthData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [cleaning, setCleaning] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);

    // Load retention policy and stats
    useEffect(() => {
        const load = async () => {
            try {
                const results = await Promise.allSettled([
                    fetchData('/api/retention/policy'),
                    fetchData('/api/retention/stats'),
                    fetchData('/api/retention/growth'),
                ]);
                const val = (r) => (r.status === 'fulfilled' ? r.value : null);
                const p = val(results[0]);
                const s = val(results[1]);
                const g = val(results[2]);
                if (p) setPolicy(p);
                if (s) setStats(s);
                setGrowthData(g?.data || []);
                setFormValues({
                    metrics: p?.metricsRetentionDays || 30,
                    logs: p?.logsRetentionDays || 7,
                    alerts: p?.alertsRetentionDays || 90,
                    audit: p?.auditRetentionDays || 365,
                });
                // Only show error if the policy fetch failed (critical)
                const policyFailed = results[0].status === 'rejected';
                setError(policyFailed ? results[0].reason?.message : null);
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleSavePolicy = async () => {
        setSaving(true);
        try {
            const result = await putData('/api/retention/policy', {
                metricsRetentionDays: Number(formValues.metrics),
                logsRetentionDays: Number(formValues.logs),
                alertsRetentionDays: Number(formValues.alerts),
                auditRetentionDays: Number(formValues.audit),
            });
            setPolicy(result);
            setSuccess('Retention policy saved successfully');
            setError(null);
            setTimeout(() => setSuccess(null), 3000);
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCleanup = async () => {
        setCleaning(true);
        try {
            const result = await postData('/api/retention/cleanup');
            setStats(result?.stats);
            setSuccess(`Cleanup completed: ${fmt(result?.deletedRecords)} records deleted`);
            setError(null);
            setShowCleanupConfirm(false);
            setTimeout(() => setSuccess(null), 3000);
        } catch (e) {
            setError(e.message);
        } finally {
            setCleaning(false);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <Styles />
                <RefreshCw size={32} color={THEME.primary} className="rm-spinner" style={{ margin: '0 auto 16px' }} />
                <div style={{ color: THEME.textMuted }}>Loading retention settings...</div>
            </div>
        );
    }

    const estimatedSavings = stats
        ? (Number(formValues.metrics) - policy?.metricsRetentionDays) *
          (stats.metricsSize / policy?.metricsRetentionDays || 0)
        : 0;

    return (
        <div style={{ padding: '0 0 20px 0' }}>
            <Styles />

            {error && (
                <div
                    style={{
                        background: `${THEME.danger}15`,
                        border: `1px solid ${THEME.danger}40`,
                        borderRadius: 16,
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

            {success && (
                <div
                    style={{
                        background: `${THEME.success}15`,
                        border: `1px solid ${THEME.success}40`,
                        borderRadius: 16,
                        padding: '12px 16px',
                        marginBottom: 20,
                        color: THEME.success,
                        fontSize: 13,
                    }}
                >
                    {success}
                </div>
            )}

            <RollupTiersPanel />

            {/* Retention Settings Form */}
            <div className="rm-card" style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: THEME.textMain, marginBottom: 20 }}>
                    <Database size={18} style={{ display: 'inline-block', marginRight: 10, verticalAlign: 'middle' }} />
                    Retention Policy Settings
                </div>

                <div className="rm-row">
                    <div>
                        <div className="rm-label">Metrics Retention (days)</div>
                        <input
                            type="number"
                            className="rm-input"
                            min="1"
                            max="3650"
                            value={formValues.metrics}
                            onChange={(e) => setFormValues({ ...formValues, metrics: e.target.value })}
                        />
                    </div>
                    <div>
                        <div className="rm-label">Logs Retention (days)</div>
                        <input
                            type="number"
                            className="rm-input"
                            min="1"
                            max="3650"
                            value={formValues.logs}
                            onChange={(e) => setFormValues({ ...formValues, logs: e.target.value })}
                        />
                    </div>
                </div>

                <div className="rm-row">
                    <div>
                        <div className="rm-label">Alerts Retention (days)</div>
                        <input
                            type="number"
                            className="rm-input"
                            min="1"
                            max="3650"
                            value={formValues.alerts}
                            onChange={(e) => setFormValues({ ...formValues, alerts: e.target.value })}
                        />
                    </div>
                    <div>
                        <div className="rm-label">Audit Retention (days)</div>
                        <input
                            type="number"
                            className="rm-input"
                            min="1"
                            max="3650"
                            value={formValues.audit}
                            onChange={(e) => setFormValues({ ...formValues, audit: e.target.value })}
                        />
                    </div>
                </div>

                <button className="rm-button" onClick={handleSavePolicy} disabled={saving} style={{ marginTop: 16 }}>
                    {saving ? (
                        <RefreshCw size={14} className="rm-spinner" style={{ marginRight: 6 }} />
                    ) : (
                        <Save size={14} style={{ marginRight: 6 }} />
                    )}
                    {saving ? 'Saving...' : 'Save Policy'}
                </button>

                {estimatedSavings > 0 && (
                    <div
                        style={{
                            background: `${THEME.warning}15`,
                            border: `1px solid ${THEME.warning}40`,
                            borderRadius: 20,
                            padding: '12px 16px',
                            marginTop: 16,
                            color: THEME.warning,
                            fontSize: 12,
                        }}
                    >
                        <AlertTriangle
                            size={14}
                            style={{ display: 'inline-block', marginRight: 8, verticalAlign: 'middle' }}
                        />
                        Estimated storage savings: {fmtBytes(estimatedSavings)}
                    </div>
                )}
            </div>

            {/* Data Size Visualization */}
            {stats && (
                <div className="rm-card" style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: THEME.textMain, marginBottom: 16 }}>
                        <HardDrive
                            size={18}
                            style={{ display: 'inline-block', marginRight: 10, verticalAlign: 'middle' }}
                        />
                        Data Size by Category
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart
                            data={[
                                { name: 'Metrics', size: stats.metricsSize || 0, fill: THEME.primary },
                                { name: 'Logs', size: stats.logsSize || 0, fill: THEME.secondary },
                                { name: 'Alerts', size: stats.alertsSize || 0, fill: THEME.warning },
                                { name: 'Audit', size: stats.auditSize || 0, fill: THEME.success },
                            ]}
                        >
                            <XAxis dataKey="name" stroke={THEME.textDim} style={{ fontSize: 12 }} />
                            <YAxis stroke={THEME.textDim} style={{ fontSize: 12 }} tickFormatter={fmtBytes} />
                            <Tooltip content={<ChartTip />} />
                            <Bar dataKey="size" radius={[8, 8, 0, 0]}>
                                {[THEME.primary, THEME.secondary, THEME.warning, THEME.success].map((color, i) => (
                                    <Cell key={i} fill={color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Growth Trend */}
            {growthData.length > 0 && (
                <div className="rm-card" style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: THEME.textMain, marginBottom: 16 }}>
                        <TrendingDown
                            size={18}
                            style={{ display: 'inline-block', marginRight: 10, verticalAlign: 'middle' }}
                        />
                        Storage Growth Trend (30 days)
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={growthData}>
                            <XAxis dataKey="date" stroke={THEME.textDim} style={{ fontSize: 12 }} />
                            <YAxis stroke={THEME.textDim} style={{ fontSize: 12 }} tickFormatter={fmtBytes} />
                            <Tooltip content={<ChartTip />} />
                            <Line
                                type="monotone"
                                dataKey="totalSize"
                                stroke={THEME.primary}
                                dot={false}
                                isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Manual Cleanup */}
            <div className="rm-card">
                <div style={{ fontSize: 16, fontWeight: 700, color: THEME.textMain, marginBottom: 16 }}>
                    <Trash2 size={18} style={{ display: 'inline-block', marginRight: 10, verticalAlign: 'middle' }} />
                    Manual Data Cleanup
                </div>
                <p style={{ color: THEME.textMuted, fontSize: 13, marginBottom: 16 }}>
                    Permanently delete expired records based on current retention policy. This action cannot be undone.
                </p>

                {!showCleanupConfirm ? (
                    <button className="rm-button rm-button-danger" onClick={() => setShowCleanupConfirm(true)}>
                        <Trash2 size={14} style={{ marginRight: 6 }} />
                        Run Cleanup Now
                    </button>
                ) : (
                    <div style={{ background: THEME.grid, borderRadius: 20, padding: 16 }}>
                        <div style={{ color: THEME.danger, marginBottom: 12, fontWeight: 700, fontSize: 13 }}>
                            Are you sure? This will permanently delete expired records.
                        </div>
                        <div style={{ display: 'flex', gap: 22 }}>
                            <button className="rm-button rm-button-danger" onClick={handleCleanup} disabled={cleaning}>
                                {cleaning ? <RefreshCw size={14} className="rm-spinner" /> : <Trash2 size={14} />}
                                {cleaning ? 'Cleaning...' : 'Confirm Cleanup'}
                            </button>
                            <button
                                className="rm-button"
                                style={{ background: THEME.surfaceHover }}
                                onClick={() => setShowCleanupConfirm(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
