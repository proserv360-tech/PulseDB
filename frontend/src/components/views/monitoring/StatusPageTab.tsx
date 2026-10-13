import React, { useState, useEffect } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { fetchData, postData, putData } from '../../../utils/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
    Globe,
    CheckCircle,
    AlertTriangle,
    XCircle,
    Clock,
    Shield,
    PlusCircle,
    RefreshCw,
    Edit,
    Trash2,
} from 'lucide-react';

/* ── Styles ───────────────────────────────────────────────────────────────── */
const Styles = () => (
    <style>{`
        @keyframes spSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes spFade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .sp-card {
            background: linear-gradient(180deg, ${THEME.surface} 0%, ${THEME.surface}f8 100%);
            border: 1px solid ${THEME.glassBorder};
            border-radius: 20px;
            padding: 24px;
            position: relative;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
            transition: all 0.25s ease;
            animation: spFade 0.3s ease;
            backdrop-filter: blur(12px);
        }
        .sp-card:hover {
            box-shadow: 0 8px 28px rgba(0,0,0,0.12);
            transform: translateY(-4px);
        }
        .sp-card::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: var(--tile-accent, ${THEME.primary});
            opacity: 0.7;
        }
        .sp-label { font-size:12px; font-weight:700; color:${THEME.textMuted}; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; }
        .sp-input { background:${THEME.surfaceHover}; border:1px solid ${THEME.glassBorder}; border-radius: 20px; padding:10px 12px; color:${THEME.textMain}; font-size:13px; width:100%; }
        .sp-input:focus { outline:none; border-color:${THEME.primary}; }
        .sp-textarea { background:${THEME.surfaceHover}; border:1px solid ${THEME.glassBorder}; border-radius: 20px; padding:10px 12px; color:${THEME.textMain}; font-size:13px; width:100%; min-height:100px; resize:vertical; }
        .sp-textarea:focus { outline:none; border-color:${THEME.primary}; }
        .sp-button { background:${THEME.primary}; color:${THEME.textInverse}; border:none; border-radius: 22px; padding:10px 16px; font-weight:700; font-size:13px; cursor:pointer; }
        .sp-button:hover { background:${THEME.primaryLight}; }
        .sp-button-danger { background:${THEME.danger}; }
        .sp-button-danger:hover { background:${THEME.dangerLight}; }
        .sp-button-secondary { background:${THEME.secondary}; }
        .sp-button-secondary:hover { background:${THEME.secondaryLight}; }
        .sp-status-operational { color:${THEME.success}; }
        .sp-status-degraded { color:${THEME.warning}; }
        .sp-status-outage { color:${THEME.danger}; }
        .sp-component-row { display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid ${THEME.glassBorder}40; }
        .sp-component-row:last-child { border-bottom:none; }
        .sp-incident { background:${THEME.grid}; border-left:4px solid ${THEME.warning}; border-radius: 20px; padding:12px; margin-bottom:12px; }
        .sp-spinner { animation:spSpin 1s linear infinite; }
    `}</style>
);

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const fmtDate = (d) => (d ? new Date(d).toLocaleString() : '—');

const StatusIndicator = ({ status }) => {
    if (status === 'operational') return <CheckCircle size={16} className="sp-status-operational" />;
    if (status === 'degraded') return <AlertTriangle size={16} className="sp-status-degraded" />;
    return <XCircle size={16} className="sp-status-outage" />;
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
   STATUS PAGE TAB
   ═══════════════════════════════════════════════════════════════════════════ */
export default function StatusPageTab() {
    useAdaptiveTheme();
    const [status, setStatus] = useState(null);
    const [components, setComponents] = useState([]);
    const [uptimeHistory, setUptimeHistory] = useState([]);
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showIncidentForm, setShowIncidentForm] = useState(false);
    const [incidentForm, setIncidentForm] = useState({ title: '', description: '', severity: 'degraded' });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const [s, uptime, inc] = await Promise.all([
                    fetchData('/api/status/public'),
                    fetchData('/api/status/uptime'),
                    fetchData('/api/status/incidents'),
                ]);
                setStatus(s);
                setComponents(s?.components || []);
                setUptimeHistory(uptime?.data || []);
                setIncidents(inc?.incidents || []);
                setError(null);
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleCreateIncident = async () => {
        if (!incidentForm.title.trim()) {
            setError('Please enter an incident title');
            return;
        }
        setSubmitting(true);
        try {
            const result = await postData('/api/status/incidents', incidentForm);
            setIncidents([result, ...incidents]);
            setIncidentForm({ title: '', description: '', severity: 'degraded' });
            setShowIncidentForm(false);
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleResolveIncident = async (id) => {
        try {
            await putData(`/api/status/incidents/${id}`, { status: 'resolved' });
            setIncidents(incidents.map((i) => (i.id === id ? { ...i, status: 'resolved' } : i)));
            setError(null);
        } catch (e) {
            setError(e.message);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <Styles />
                <RefreshCw size={32} color={THEME.primary} className="sp-spinner" style={{ margin: '0 auto 16px' }} />
                <div style={{ color: THEME.textMuted }}>Loading status page...</div>
            </div>
        );
    }

    const statusColor =
        status?.status === 'operational' ? THEME.success : status?.status === 'degraded' ? THEME.warning : THEME.danger;

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

            {/* Overall Status */}
            <div className="sp-card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                        <Globe size={32} color={statusColor} />
                        <div>
                            <div style={{ fontSize: 12, color: THEME.textMuted, fontWeight: 700, marginBottom: 4 }}>
                                System Status
                            </div>
                            <div
                                style={{
                                    fontSize: 28,
                                    fontWeight: 800,
                                    color: statusColor,
                                    textTransform: 'capitalize',
                                }}
                            >
                                {status?.status || 'Unknown'}
                            </div>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 4 }}>Uptime (30d)</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: THEME.primary }}>
                            {status?.uptime30d || 0}%
                        </div>
                    </div>
                </div>

                {status?.lastUpdate && (
                    <div style={{ marginTop: 16, fontSize: 11, color: THEME.textDim }}>
                        <Clock size={12} style={{ display: 'inline-block', marginRight: 4, verticalAlign: 'middle' }} />
                        Last updated: {fmtDate(status.lastUpdate)}
                    </div>
                )}

                <div style={{ marginTop: 12, fontSize: 12, color: THEME.textMuted }}>
                    <Shield size={12} style={{ display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />
                    Public Status Page:{' '}
                    <a href="#" style={{ color: THEME.primary }}>
                        status.example.com
                    </a>
                </div>
            </div>

            {/* Component Status */}
            <div className="sp-card" style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: THEME.textMain, marginBottom: 16 }}>
                    <Shield size={18} style={{ display: 'inline-block', marginRight: 10, verticalAlign: 'middle' }} />
                    Component Status
                </div>
                {components.map((comp, i) => (
                    <div key={i} className="sp-component-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                            <StatusIndicator status={comp.status} />
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: THEME.textMain }}>{comp.name}</div>
                                <div style={{ fontSize: 11, color: THEME.textDim }}>{comp.description}</div>
                            </div>
                        </div>
                        <div style={{ fontSize: 11, color: THEME.textMuted, textTransform: 'capitalize' }}>
                            {comp.status}
                        </div>
                    </div>
                ))}
            </div>

            {/* Uptime History Chart */}
            {uptimeHistory.length > 0 && (
                <div className="sp-card" style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: THEME.textMain, marginBottom: 16 }}>
                        <Clock
                            size={18}
                            style={{ display: 'inline-block', marginRight: 10, verticalAlign: 'middle' }}
                        />
                        Uptime History (Last 30 Days)
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={uptimeHistory}>
                            <XAxis dataKey="date" stroke={THEME.textDim} style={{ fontSize: 11 }} />
                            <YAxis stroke={THEME.textDim} style={{ fontSize: 11 }} domain={[0, 100]} />
                            <Tooltip content={<ChartTip />} />
                            <Bar dataKey="uptime" radius={[4, 4, 0, 0]}>
                                {uptimeHistory.map((entry, i) => (
                                    <Cell
                                        key={i}
                                        fill={
                                            entry.uptime > 99
                                                ? THEME.success
                                                : entry.uptime > 95
                                                  ? THEME.warning
                                                  : THEME.danger
                                        }
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Incidents */}
            <div className="sp-card" style={{ marginBottom: 20 }}>
                <div
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}
                >
                    <div style={{ fontSize: 16, fontWeight: 700, color: THEME.textMain }}>
                        <AlertTriangle
                            size={18}
                            style={{ display: 'inline-block', marginRight: 10, verticalAlign: 'middle' }}
                        />
                        Incidents
                    </div>
                    <button className="sp-button" onClick={() => setShowIncidentForm(!showIncidentForm)}>
                        <PlusCircle size={14} style={{ marginRight: 6 }} />
                        Create Incident
                    </button>
                </div>

                {showIncidentForm && (
                    <div style={{ background: THEME.grid, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                        <div style={{ marginBottom: 12 }}>
                            <div className="sp-label">Incident Title</div>
                            <input
                                type="text"
                                className="sp-input"
                                placeholder="e.g., Database connectivity issue"
                                value={incidentForm.title}
                                onChange={(e) => setIncidentForm({ ...incidentForm, title: e.target.value })}
                            />
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <div className="sp-label">Description</div>
                            <textarea
                                className="sp-textarea"
                                placeholder="Describe the incident..."
                                value={incidentForm.description}
                                onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })}
                            />
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <div className="sp-label">Severity</div>
                            <select
                                style={{
                                    background: THEME.surfaceHover,
                                    border: `1px solid ${THEME.grid}`,
                                    borderRadius: 20,
                                    padding: '10px 12px',
                                    color: THEME.textMain,
                                    fontSize: 13,
                                    width: '100%',
                                    cursor: 'pointer',
                                }}
                                value={incidentForm.severity}
                                onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value })}
                            >
                                <option value="degraded">Degraded Performance</option>
                                <option value="outage">Outage</option>
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: 22 }}>
                            <button className="sp-button" onClick={handleCreateIncident} disabled={submitting}>
                                {submitting ? (
                                    <RefreshCw size={14} className="sp-spinner" style={{ marginRight: 6 }} />
                                ) : (
                                    <PlusCircle size={14} style={{ marginRight: 6 }} />
                                )}
                                {submitting ? 'Creating...' : 'Create Incident'}
                            </button>
                            <button
                                className="sp-button"
                                style={{ background: THEME.surfaceHover }}
                                onClick={() => setShowIncidentForm(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {incidents.length > 0 ? (
                    incidents.map((incident, i) => (
                        <div key={i} className="sp-incident">
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'start',
                                    marginBottom: 8,
                                }}
                            >
                                <div>
                                    <div
                                        style={{
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: THEME.textMain,
                                            marginBottom: 4,
                                        }}
                                    >
                                        {incident.title}
                                    </div>
                                    <div style={{ fontSize: 11, color: THEME.textDim, marginBottom: 6 }}>
                                        {fmtDate(incident.createdAt)}
                                    </div>
                                </div>
                                <div
                                    style={{
                                        padding: '4px 10px',
                                        background:
                                            incident.status === 'resolved' ? `${THEME.success}20` : `${THEME.danger}20`,
                                        color: incident.status === 'resolved' ? THEME.success : THEME.danger,
                                        borderRadius: 16,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        textTransform: 'capitalize',
                                    }}
                                >
                                    {incident.status}
                                </div>
                            </div>

                            {incident.description && (
                                <div style={{ fontSize: 12, color: THEME.textDim, marginBottom: 8 }}>
                                    {incident.description}
                                </div>
                            )}

                            {incident.status !== 'resolved' && (
                                <button
                                    className="sp-button sp-button-secondary"
                                    onClick={() => handleResolveIncident(incident.id)}
                                    style={{ fontSize: 11, padding: '6px 12px' }}
                                >
                                    <CheckCircle size={12} style={{ marginRight: 4 }} />
                                    Mark Resolved
                                </button>
                            )}
                        </div>
                    ))
                ) : (
                    <div style={{ textAlign: 'center', padding: '20px', color: THEME.textDim, fontSize: 12 }}>
                        No incidents reported
                    </div>
                )}
            </div>
        </div>
    );
}
