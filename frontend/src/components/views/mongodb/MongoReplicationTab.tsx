import React, { useState, useEffect, useCallback, useRef } from 'react';
import { THEME } from '../../../utils/theme';
import { fetchData, postData } from '../../../utils/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';
import { Server, Clock, AlertTriangle, AlertCircle, TrendingUp, CheckCircle, RefreshCw, Activity } from 'lucide-react';

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
        @keyframes mongoGlow { 0%{box-shadow:0 0 0 0 ${DARK_THEME.success}40} to{box-shadow:0 0 0 8px ${DARK_THEME.success}00} }

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

        .mongo-member-card {
            background: ${DARK_THEME.bg};
            border: 1px solid ${DARK_THEME.border};
            border-radius: 20px;
            padding: 20px;
            animation: mongoFade 0.3s ease;
        }

        .mongo-member-card.primary {
            border: 2px solid ${DARK_THEME.success};
            box-shadow: 0 0 8px ${DARK_THEME.success}20;
        }

        .mongo-member-card.secondary {
            border: 1px solid ${DARK_THEME.border};
        }

        .mongo-member-status {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
        }

        .mongo-member-status.primary {
            background: ${DARK_THEME.green};
        }

        .mongo-member-status.secondary {
            background: ${DARK_THEME.success};
        }

        .mongo-member-status.down {
            background: ${DARK_THEME.danger};
            animation: none;
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
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            margin-right: 6px;
            margin-bottom: 6px;
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

        .mongo-timeline {
            position: relative;
            padding-left: 20px;
        }

        .mongo-timeline-item {
            padding: 12px;
            margin-bottom: 8px;
            background: ${DARK_THEME.bg};
            border-left: 2px solid ${DARK_THEME.border};
            border-radius: 20px;
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
/* MONGO REPLICATION TAB COMPONENT */
/* ═══════════════════════════════════════════════════════════════════════════ */
export default function MongoReplicationTab() {
    const [members, setMembers] = useState([]);
    const [replicationStatus, setReplicationStatus] = useState({});
    const [lagChart, setLagChart] = useState([]);
    const [electionHistory, setElectionHistory] = useState([]);
    const [oplogStats, setOplogStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const pollIntervalRef = useRef(null);

    const loadData = useCallback(async () => {
        try {
            setError(null);
            const [mem, rep, lag, elec, oplog] = await Promise.all([
                fetchData('/api/mongodb/replica-members').catch(() => null),
                fetchData('/api/mongodb/server-status').catch(() => null),
                fetchData('/api/mongodb/replication-lag-chart').catch(() => null),
                fetchData('/api/mongodb/election-history').catch(() => null),
                fetchData('/api/mongodb/oplog-stats').catch(() => null),
            ]);

            setMembers(mem || []);

            setReplicationStatus(
                rep || {
                    set: '',
                    ismaster: false,
                    secondary: false,
                    primary: '',
                    me: '',
                    term: 0,
                    electionDate: null,
                    ok: 0,
                },
            );

            setLagChart(lag || []);

            setElectionHistory(elec || []);

            setOplogStats(
                oplog || {
                    oplogSize: 0,
                    oplogUsed: 0,
                    oplogWindow: 0,
                    firstOpTime: null,
                    lastOpTime: null,
                    opsCaptured: 0,
                },
            );
        } catch (err) {
            setError(err.message || 'Failed to load replication data');
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
                        <Server className="mongo-spinner" size={20} />
                        Loading replication status...
                    </div>
                </div>
            </>
        );
    }

    const getMemberColor = (state) => {
        if (state === 1 || state === 'PRIMARY') return DARK_THEME.green;
        if (state === 2 || state === 'SECONDARY') return DARK_THEME.success;
        return DARK_THEME.danger;
    };

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

                {/* Replica Set Overview */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <Server size={16} /> Replica Set Overview
                    </h3>
                    <div className="mongo-card">
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                gap: 22,
                            }}
                        >
                            <div className="mongo-metric-box">
                                <div className="mongo-metric-label">Replica Set</div>
                                <div className="mongo-metric-value" style={{ fontSize: 16 }}>
                                    {replicationStatus.set || 'rs0'}
                                </div>
                            </div>
                            <div className="mongo-metric-box">
                                <div className="mongo-metric-label">Replication Term</div>
                                <div className="mongo-metric-value">{replicationStatus.term || 0}</div>
                            </div>
                            <div className="mongo-metric-box">
                                <div className="mongo-metric-label">Primary Node</div>
                                <div className="mongo-metric-value" style={{ fontSize: 12, fontFamily: 'monospace' }}>
                                    {(replicationStatus.primary || 'N/A').split(':')[0]}
                                </div>
                            </div>
                            <div className="mongo-metric-box">
                                <div className="mongo-metric-label">Members</div>
                                <div className="mongo-metric-value">{members.length}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Replica Set Members */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <Activity size={16} /> Replica Set Members
                    </h3>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                            gap: 22,
                        }}
                    >
                        {members.map((member) => (
                            <div
                                key={member._id}
                                className={`mongo-member-card ${member.stateStr === 'PRIMARY' ? 'primary' : 'secondary'}`}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                                    <div
                                        className={`mongo-member-status ${member.stateStr.toLowerCase().replace('_', '-')}`}
                                    />
                                    <div>
                                        <div style={{ fontWeight: 700, color: DARK_THEME.text, fontSize: 14 }}>
                                            {member.name}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: DARK_THEME.textMuted,
                                                fontFamily: 'monospace',
                                            }}
                                        >
                                            {member.host}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ marginBottom: 12 }}>
                                    <span
                                        className={`mongo-badge mongo-badge-${member.health === 1 ? 'success' : 'danger'}`}
                                    >
                                        {member.health === 1 ? 'HEALTHY' : 'DOWN'}
                                    </span>
                                    <span
                                        className={`mongo-badge mongo-badge-${member.stateStr === 'PRIMARY' ? 'success' : 'warning'}`}
                                    >
                                        {member.stateStr}
                                    </span>
                                </div>

                                <div style={{ fontSize: 12, color: DARK_THEME.textMuted, marginBottom: 4 }}>
                                    Uptime:{' '}
                                    <span style={{ color: DARK_THEME.accent }}>
                                        {Math.round(member.uptime / 86400)}d
                                    </span>
                                </div>

                                {member.lag > 0 && (
                                    <div style={{ fontSize: 12, color: DARK_THEME.textMuted }}>
                                        Replication Lag:{' '}
                                        <span
                                            style={{ color: member.lag > 1 ? DARK_THEME.warning : DARK_THEME.success }}
                                        >
                                            {fmt(member.lag)}s
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Replication Lag Chart */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <Clock size={16} /> Replication Lag
                    </h3>
                    <div className="mongo-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={lagChart}>
                                <XAxis dataKey="time" stroke={DARK_THEME.textMuted} />
                                <YAxis
                                    label={{ value: 'Lag (seconds)', angle: -90, position: 'insideLeft' }}
                                    stroke={DARK_THEME.textMuted}
                                />
                                <Tooltip content={<ChartTooltip />} />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="secondary1"
                                    stroke={DARK_THEME.success}
                                    name="Secondary 1"
                                    strokeWidth={2}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="secondary2"
                                    stroke={DARK_THEME.warning}
                                    name="Secondary 2"
                                    strokeWidth={2}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Oplog Statistics */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <TrendingUp size={16} /> Oplog Status
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
                                    Oplog Size
                                </div>
                                <div
                                    style={{ fontSize: 18, fontWeight: 700, color: DARK_THEME.accent, marginBottom: 8 }}
                                >
                                    {fmt(oplogStats.oplogUsed)} / {fmt(oplogStats.oplogSize)} MB
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
                                            width: `${(oplogStats.oplogUsed / oplogStats.oplogSize) * 100}%`,
                                            background: DARK_THEME.accent,
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="mongo-metric-box">
                                <div className="mongo-metric-label">Oplog Window</div>
                                <div className="mongo-metric-value">{fmt(oplogStats.oplogWindow)}s</div>
                                <div style={{ fontSize: 11, color: DARK_THEME.textMuted, marginTop: 4 }}>
                                    ~{Math.round(oplogStats.oplogWindow / 3600)}h
                                </div>
                            </div>
                            <div className="mongo-metric-box">
                                <div className="mongo-metric-label">Ops Captured</div>
                                <div className="mongo-metric-value" style={{ fontSize: 14 }}>
                                    {fmt(oplogStats.opsCaptured)}
                                </div>
                            </div>
                        </div>

                        {oplogStats.oplogWindow < 3600 && (
                            <div className="mongo-info-box">
                                <AlertTriangle
                                    size={14}
                                    style={{ display: 'inline-block', marginRight: 8, verticalAlign: 'text-top' }}
                                />
                                Oplog window is less than 1 hour. Secondary nodes may struggle to catch up during
                                extended outages.
                            </div>
                        )}

                        <div
                            style={{
                                paddingTop: 16,
                                borderTop: `1px solid ${DARK_THEME.border}`,
                                fontSize: 12,
                                color: DARK_THEME.textMuted,
                            }}
                        >
                            <div style={{ marginBottom: 4 }}>
                                First entry:{' '}
                                <span style={{ color: DARK_THEME.accent }}>
                                    {new Date(oplogStats.firstOpTime).toLocaleString()}
                                </span>
                            </div>
                            <div>
                                Last entry:{' '}
                                <span style={{ color: DARK_THEME.accent }}>
                                    {new Date(oplogStats.lastOpTime).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Election History */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <CheckCircle size={16} /> Election History
                    </h3>
                    <div className="mongo-card">
                        <div className="mongo-timeline">
                            {electionHistory.map((event, idx) => (
                                <div key={idx} className="mongo-timeline-item">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <div>
                                            <span style={{ fontWeight: 700, color: DARK_THEME.text }}>
                                                Term {event.term}
                                            </span>
                                            <span
                                                className={`mongo-badge mongo-badge-${event.type === 'election' ? 'success' : 'warning'}`}
                                            >
                                                {event.type.toUpperCase()}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 11, color: DARK_THEME.textMuted }}>
                                            {new Date(event.timestamp).toLocaleString()}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 12, color: DARK_THEME.textMuted }}>
                                        <strong>Winner:</strong> {event.winner}
                                    </div>
                                    <div style={{ fontSize: 12, color: DARK_THEME.textMuted }}>
                                        <strong>Reason:</strong> {event.reason}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Failover Readiness */}
                <div className="mongo-section">
                    <h3 className="mongo-section-title">
                        <AlertTriangle size={16} /> Failover Readiness
                    </h3>
                    <div className="mongo-card">
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: 22,
                            }}
                        >
                            <div
                                style={{
                                    padding: 12,
                                    background: DARK_THEME.bg,
                                    borderRadius: 20,
                                    border: `1px solid ${DARK_THEME.border}`,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                                    <CheckCircle size={16} style={{ color: DARK_THEME.success, marginRight: 8 }} />
                                    <span style={{ fontWeight: 600, color: DARK_THEME.text }}>Healthy Secondaries</span>
                                </div>
                                <div style={{ fontSize: 12, color: DARK_THEME.textMuted }}>
                                    {members.filter((m) => m.stateStr === 'SECONDARY' && m.health === 1).length} /{' '}
                                    {members.filter((m) => m.stateStr === 'SECONDARY').length}
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
                                    <CheckCircle size={16} style={{ color: DARK_THEME.success, marginRight: 8 }} />
                                    <span style={{ fontWeight: 600, color: DARK_THEME.text }}>Oplog Available</span>
                                </div>
                                <div style={{ fontSize: 12, color: DARK_THEME.textMuted }}>
                                    Window: ~{Math.round(oplogStats.oplogWindow / 3600)}h
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
                                    <CheckCircle size={16} style={{ color: DARK_THEME.success, marginRight: 8 }} />
                                    <span style={{ fontWeight: 600, color: DARK_THEME.text }}>Low Lag</span>
                                </div>
                                <div style={{ fontSize: 12, color: DARK_THEME.textMuted }}>
                                    Max: {fmt(Math.max(...members.map((m) => m.lag || 0)))}s
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
