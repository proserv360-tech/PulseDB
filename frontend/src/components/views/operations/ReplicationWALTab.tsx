import React, { useState, useEffect, useCallback, useRef } from 'react';
import { THEME, useAdaptiveTheme, useGlobalRefresh } from '../../../utils/theme';
import { fetchData } from '../../../utils/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
    Radio,
    RefreshCw,
    AlertTriangle,
    CheckCircle,
    Database,
    Wifi,
    WifiOff,
    Clock,
    Activity,
    Server,
    AlertCircle,
    Layers,
    Zap,
} from 'lucide-react';

const Styles = () => (
    <style>{`
        @keyframes rwSpin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes rwFade  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes rwPulse { 0%,100%{opacity:1} 50%{opacity:.35} }
        .rw-card  { background:${THEME.surface}; border:none; border-left:4px solid var(--pipe-color, ${THEME.primary}); border-radius:0 16px 16px 0; padding:20px; animation:rwFade .3s ease; box-shadow:0 4px 16px rgba(0,0,0,0.08); backdrop-filter:blur(12px); position:relative; overflow:hidden; transition: all 0.25s ease; }
        .rw-card:hover { box-shadow:0 4px 16px rgba(0,0,0,0.12); border-left-width: 6px; transform: translateY(-4px); }
        .rw-card::before { content:''; position:absolute; top:0; right:0; width:40%; height:100%; background:repeating-linear-gradient(-45deg, transparent, transparent 8px, ${THEME.glassBorder}15 8px, ${THEME.glassBorder}15 9px); pointer-events:none; }
        .rw-metric{ background:${THEME.surface}; border:1px solid ${THEME.glassBorder}; border-radius: 20px; padding:16px 20px; display:flex; align-items:center; gap: 20px; box-shadow:0 4px 16px rgba(0,0,0,0.08); backdrop-filter:blur(12px); }
        .rw-row   { display:flex; justify-content:space-between; align-items:center; padding:11px 0; border-bottom:1px solid ${THEME.glassBorder}30; font-size:12px; }
        .rw-row:last-child { border-bottom:none; }
        .rw-badge { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius: 20px; font-size:10px; font-weight:700; }
        .rw-table-head { display:grid; gap: 18px; padding:12px 18px; font-size:10px; font-weight:700; color:${THEME.textMuted}; text-transform:uppercase; letter-spacing:.5px; border-bottom:1px solid ${THEME.glassBorder}; }
        .rw-table-row  { display:grid; gap: 18px; padding:13px 18px; font-size:12px; border-bottom:1px solid ${THEME.glassBorder}20; align-items:center; }
        .rw-table-row:hover { background:${THEME.surfaceHover}; }
        .rw-table-row:last-child { border-bottom:none; }
    `}</style>
);

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString());
const fmtBytes = (b) => {
    const n = Number(b) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
    return `${(n / 1073741824).toFixed(2)} GB`;
};
const fmtLag = (s) => {
    const n = Number(s) || 0;
    if (n === 0) return 'In sync';
    if (n < 60) return `${n}s`;
    return `${Math.floor(n / 60)}m ${n % 60}s`;
};
const fmtDate = (d) => (d ? new Date(d).toLocaleTimeString() : '—');

const StateBadge = ({ state, sync }) => {
    const color = state === 'streaming' ? THEME.success : state === 'catchup' ? THEME.warning : THEME.danger;
    return (
        <span className="rw-badge" style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
            {state === 'streaming' && (
                <span
                    style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: color,
                        animation: 'rwPulse 1.5s infinite',
                        display: 'inline-block',
                    }}
                />
            )}
            {state || '—'}
            {sync && ` · ${sync}`}
        </span>
    );
};

const MetricCard = ({ icon: Icon, label, value, sub, color = THEME.primary, warn }) => (
    <div className="rw-metric" style={{ borderColor: warn ? `${THEME.warning}40` : undefined }}>
        <div
            style={{
                width: 44,
                height: 44,
                borderRadius: 18,
                background: `${color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
            }}
        >
            <Icon size={20} color={color} />
        </div>
        <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: THEME.textMain, lineHeight: 1 }}>{value}</div>
            <div
                style={{ fontSize: 11, color: THEME.textMuted, marginTop: 3, fontWeight: 600, letterSpacing: '0.02em' }}
            >
                {label}
            </div>
            {sub && (
                <div style={{ fontSize: 11, color: warn ? THEME.warning : THEME.textDim, marginTop: 2 }}>{sub}</div>
            )}
        </div>
    </div>
);

const ChartTip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div
            style={{
                background: THEME.surface,
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: 18,
                padding: '10px 14px',
                fontSize: 12,
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                backdropFilter: 'blur(12px)',
            }}
        >
            <div style={{ color: THEME.textMuted, marginBottom: 4 }}>{label}</div>
            {payload.map((p) => (
                <div key={p.name} style={{ color: p.fill, fontWeight: 600 }}>
                    {p.name}: {fmtBytes(p.value)}
                </div>
            ))}
        </div>
    );
};

export default function ReplicationWALTab() {
    useAdaptiveTheme(); // keeps THEME in sync with dark/light toggle
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [lastAt, setLastAt] = useState(null);
    const [autoRfsh, setAutoRfsh] = useState(10);
    const [activeTab, setActiveTab] = useState('replicas');
    const intervalRef = useRef(null);

    const load = useCallback(async (initial = false) => {
        if (!initial) setRefreshing(true);
        try {
            const d = await fetchData('/api/replication/status');
            setData(d);
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setLastAt(Date.now());
            setRefreshing(false);
            if (initial) setLoading(false);
        }
    }, []);

    useEffect(() => {
        load(true);
    }, [load]);
    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (autoRfsh > 0) intervalRef.current = setInterval(() => load(false), autoRfsh * 1000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [autoRfsh, load]);

    useGlobalRefresh(React.useCallback(() => load(), [load]));

    const replicas = data?.replicas || [];
    const slots = data?.slots || [];
    const walReceiver = data?.walReceiver || null;
    const walSender = data?.walSender || {};
    const settings = data?.settings || [];

    const inRecovery = walSender.in_recovery;
    const replicaCount = Number(walSender.replica_count) || 0;
    const maxLagBytes = replicas.length ? Math.max(...replicas.map((r) => Number(r.total_lag_bytes) || 0)) : 0;
    const maxLagSec = replicas.length ? Math.max(...replicas.map((r) => Number(r.replay_lag_sec) || 0)) : 0;
    const lagWarn = maxLagBytes > 104857600; // 100 MB
    const inactiveSlots = slots.filter((s) => !s.active).length;

    const fmtRel = (d) => {
        if (!d) return '';
        const s = Math.floor((Date.now() - new Date(d)) / 1000);
        if (s < 60) return `${s}s ago`;
        if (s < 3600) return `${Math.floor(s / 60)}m ago`;
        return `${Math.floor(s / 3600)}h ago`;
    };

    const lagChart = replicas.map((r) => ({
        name: r.application_name || r.client_addr || 'replica',
        write: Number(r.write_lag_bytes) || 0,
        flush: Number(r.flush_lag_bytes) || 0,
        replay: Number(r.replay_lag_bytes) || 0,
    }));

    if (loading)
        return (
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 300,
                    color: THEME.textMuted,
                }}
            >
                <RefreshCw size={24} style={{ animation: 'rwSpin 1s linear infinite', marginRight: 10 }} /> Loading
                replication status…
            </div>
        );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Styles />

            {/* Toolbar */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px 20px',
                    background: THEME.surface,
                    borderRadius: 18,
                    border: `1px solid ${THEME.glassBorder}`,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <Radio size={20} color={THEME.primary} />
                    <span style={{ fontWeight: 700, fontSize: 15, color: THEME.textMain }}>Replication & WAL</span>
                    <span
                        className="rw-badge"
                        style={{
                            background: inRecovery ? `${THEME.warning}15` : `${THEME.success}15`,
                            color: inRecovery ? THEME.warning : THEME.success,
                            border: `1px solid ${inRecovery ? THEME.warning : THEME.success}30`,
                            fontSize: 11,
                        }}
                    >
                        {inRecovery ? <WifiOff size={10} /> : <Wifi size={10} />} {inRecovery ? 'REPLICA' : 'PRIMARY'}
                    </span>
                    {lagWarn && (
                        <span
                            className="rw-badge"
                            style={{
                                background: `${THEME.danger}15`,
                                color: THEME.danger,
                                border: `1px solid ${THEME.danger}30`,
                                fontSize: 11,
                            }}
                        >
                            <AlertTriangle size={10} /> High Lag
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                    <span style={{ fontSize: 11, color: THEME.textDim }}>
                        {lastAt ? `Updated ${fmtRel(lastAt)}` : ''}
                    </span>
                    <select
                        value={autoRfsh}
                        onChange={(e) => setAutoRfsh(+e.target.value)}
                        style={{
                            background: THEME.surface,
                            border: `1px solid ${THEME.glassBorder}`,
                            color: THEME.textMain,
                            borderRadius: 20,
                            padding: '4px 8px',
                            fontSize: 12,
                        }}
                    >
                        <option value={5}>5s</option>
                        <option value={10}>10s</option>
                        <option value={30}>30s</option>
                        <option value={0}>Off</option>
                    </select>
                </div>
            </div>

            {error && (
                <div
                    style={{
                        padding: 14,
                        background: `${THEME.danger}10`,
                        border: `1px solid ${THEME.danger}30`,
                        borderRadius: 18,
                        color: THEME.danger,
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 20,
                    }}
                >
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {/* Metric cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
                <MetricCard
                    icon={Server}
                    label="Streaming Replicas"
                    value={replicaCount}
                    sub={replicaCount === 0 ? 'No replicas connected' : 'Active connections'}
                    color={replicaCount > 0 ? THEME.success : THEME.textDim}
                />
                <MetricCard
                    icon={Activity}
                    label="Max Replay Lag"
                    value={fmtLag(maxLagSec)}
                    sub={fmtBytes(maxLagBytes)}
                    color={lagWarn ? THEME.danger : THEME.success}
                    warn={lagWarn}
                />
                <MetricCard
                    icon={Layers}
                    label="Replication Slots"
                    value={slots.length}
                    sub={inactiveSlots > 0 ? `⚠ ${inactiveSlots} inactive` : 'All active'}
                    color={inactiveSlots > 0 ? THEME.warning : THEME.primary}
                />
                <MetricCard
                    icon={Database}
                    label="Current WAL File"
                    value={walSender.current_wal?.slice(-8) || '—'}
                    sub={walSender.current_lsn || '—'}
                    color={THEME.secondary}
                />
            </div>

            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: 6 }}>
                {[
                    { id: 'replicas', label: 'Streaming Replicas', icon: Radio },
                    { id: 'slots', label: 'Replication Slots', icon: Layers },
                    { id: 'wal', label: 'WAL Settings', icon: Zap },
                ].map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                            padding: '8px 16px',
                            borderRadius: 20,
                            border: `1px solid ${activeTab === id ? THEME.primary : THEME.glassBorder}`,
                            background: activeTab === id ? `${THEME.primary}12` : 'transparent',
                            color: activeTab === id ? THEME.primary : THEME.textMuted,
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 600,
                            transition: 'all .15s',
                        }}
                    >
                        <Icon size={14} /> {label}
                    </button>
                ))}
            </div>

            {/* Streaming Replicas tab */}
            {activeTab === 'replicas' && (
                <>
                    {replicas.length === 0 ? (
                        <div className="rw-card" style={{ textAlign: 'center', padding: 40 }}>
                            <WifiOff size={40} color={THEME.textDim} style={{ opacity: 0.3, marginBottom: 12 }} />
                            <div style={{ fontSize: 14, fontWeight: 600, color: THEME.textMuted }}>
                                No streaming replicas connected
                            </div>
                            <div style={{ fontSize: 12, color: THEME.textDim, marginTop: 6 }}>
                                {inRecovery
                                    ? 'This server is a replica — check the primary for replication status.'
                                    : 'Set wal_level=replica and configure max_wal_senders > 0 to enable streaming replication.'}
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Lag chart */}
                            <div className="rw-card">
                                <div
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: THEME.textMain,
                                        marginBottom: 16,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 20,
                                    }}
                                >
                                    <Activity size={15} color={THEME.primary} /> Replication Lag by Replica
                                </div>
                                <ResponsiveContainer width="100%" height={160}>
                                    <BarChart
                                        data={lagChart}
                                        margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
                                        barGap={2}
                                    >
                                        <XAxis
                                            dataKey="name"
                                            tick={{ fontSize: 11, fill: THEME.textDim }}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis
                                            tickFormatter={fmtBytes}
                                            tick={{ fontSize: 10, fill: THEME.textDim }}
                                            tickLine={false}
                                            axisLine={false}
                                            width={60}
                                        />
                                        <Tooltip content={<ChartTip />} />
                                        <Bar
                                            dataKey="write"
                                            name="Write Lag"
                                            fill={THEME.primary}
                                            radius={[3, 3, 0, 0]}
                                        />
                                        <Bar
                                            dataKey="flush"
                                            name="Flush Lag"
                                            fill={THEME.secondary}
                                            radius={[3, 3, 0, 0]}
                                        />
                                        <Bar
                                            dataKey="replay"
                                            name="Replay Lag"
                                            fill={THEME.warning}
                                            radius={[3, 3, 0, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                                <div style={{ display: 'flex', gap: 22, marginTop: 6 }}>
                                    {[
                                        { c: THEME.primary, l: 'Write' },
                                        { c: THEME.secondary, l: 'Flush' },
                                        { c: THEME.warning, l: 'Replay' },
                                    ].map(({ c, l }) => (
                                        <div
                                            key={l}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 5,
                                                fontSize: 11,
                                                color: THEME.textMuted,
                                            }}
                                        >
                                            <div style={{ width: 10, height: 3, borderRadius: 1, background: c }} />
                                            {l} Lag
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Replica detail table */}
                            <div className="rw-card" style={{ padding: 0 }}>
                                <div
                                    style={{
                                        padding: '14px 16px',
                                        borderBottom: `1px solid ${THEME.glassBorder}`,
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: THEME.textMain,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 20,
                                    }}
                                >
                                    <Radio size={15} color={THEME.primary} /> Replica Details
                                </div>
                                <div
                                    className="rw-table-head"
                                    style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr' }}
                                >
                                    <span>Application</span>
                                    <span>Client</span>
                                    <span>State</span>
                                    <span>Write Lag</span>
                                    <span>Flush Lag</span>
                                    <span>Replay Lag</span>
                                </div>
                                {replicas.map((r, i) => (
                                    <div
                                        key={i}
                                        className="rw-table-row"
                                        style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr' }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 700, color: THEME.textMain }}>
                                                {r.application_name || '—'}
                                            </div>
                                            <div style={{ fontSize: 10, color: THEME.textDim, marginTop: 2 }}>
                                                {r.reply_time ? `Last reply ${fmtDate(r.reply_time)}` : ''}
                                            </div>
                                        </div>
                                        <span style={{ fontFamily: THEME.fontMono, color: THEME.textMuted }}>
                                            {r.client_addr || '—'}
                                        </span>
                                        <StateBadge state={r.state} sync={r.sync_state} />
                                        <span style={{ fontFamily: THEME.fontMono, color: THEME.textMain }}>
                                            {fmtBytes(r.write_lag_bytes)}
                                        </span>
                                        <span style={{ fontFamily: THEME.fontMono, color: THEME.textMain }}>
                                            {fmtBytes(r.flush_lag_bytes)}
                                        </span>
                                        <span
                                            style={{
                                                fontFamily: THEME.fontMono,
                                                color:
                                                    Number(r.replay_lag_bytes) > 104857600
                                                        ? THEME.danger
                                                        : THEME.textMain,
                                                fontWeight: Number(r.replay_lag_bytes) > 104857600 ? 700 : 400,
                                            }}
                                        >
                                            {fmtBytes(r.replay_lag_bytes)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* WAL Receiver panel (if this is a replica) */}
                    {walReceiver && (
                        <div
                            className="rw-card"
                            style={{ borderColor: `${THEME.warning}30`, borderRadius: '0 12px 12px 0' }}
                        >
                            <div
                                style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: THEME.warning,
                                    marginBottom: 14,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 20,
                                }}
                            >
                                <Wifi size={15} /> WAL Receiver Status (This server is a replica)
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
                                {[
                                    { label: 'Status', value: walReceiver.status },
                                    {
                                        label: 'Sender Host',
                                        value: `${walReceiver.sender_host}:${walReceiver.sender_port}`,
                                    },
                                    { label: 'Slot Name', value: walReceiver.slot_name || '—' },
                                    { label: 'Last Msg Sent', value: fmtDate(walReceiver.last_msg_send_time) },
                                    { label: 'Last Msg Recv', value: fmtDate(walReceiver.last_msg_receipt_time) },
                                    { label: 'Latest LSN', value: walReceiver.latest_end_lsn },
                                ].map(({ label, value }) => (
                                    <div key={label} className="rw-row">
                                        <span style={{ color: THEME.textMuted }}>{label}</span>
                                        <span
                                            style={{
                                                fontFamily: THEME.fontMono,
                                                color: THEME.textMain,
                                                fontWeight: 600,
                                                fontSize: 11,
                                            }}
                                        >
                                            {value || '—'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Replication Slots tab */}
            {activeTab === 'slots' && (
                <div className="rw-card" style={{ padding: 0 }}>
                    <div
                        style={{
                            padding: '14px 16px',
                            borderBottom: `1px solid ${THEME.glassBorder}`,
                            fontSize: 13,
                            fontWeight: 700,
                            color: THEME.textMain,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 20,
                        }}
                    >
                        <Layers size={15} color={THEME.primary} /> Replication Slots
                        {inactiveSlots > 0 && (
                            <span
                                className="rw-badge"
                                style={{
                                    background: `${THEME.danger}15`,
                                    color: THEME.danger,
                                    border: `1px solid ${THEME.danger}30`,
                                }}
                            >
                                <AlertTriangle size={9} /> {inactiveSlots} inactive — may cause WAL accumulation
                            </span>
                        )}
                    </div>
                    {slots.length === 0 ? (
                        <div style={{ padding: 40, textAlign: 'center', color: THEME.textDim, fontSize: 13 }}>
                            No replication slots configured.
                        </div>
                    ) : (
                        <>
                            <div className="rw-table-head" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr' }}>
                                <span>Slot Name</span>
                                <span>Type</span>
                                <span>Active</span>
                                <span>Lag</span>
                                <span>WAL Status</span>
                            </div>
                            {slots.map((s, i) => (
                                <div
                                    key={i}
                                    className="rw-table-row"
                                    style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr' }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 700, color: THEME.textMain }}>{s.slot_name}</div>
                                        <div style={{ fontSize: 10, color: THEME.textDim }}>
                                            {s.plugin || 'physical'} · {s.database || 'global'}
                                        </div>
                                    </div>
                                    <span style={{ color: THEME.textMuted, textTransform: 'capitalize' }}>
                                        {s.slot_type}
                                    </span>
                                    <span
                                        style={{
                                            color: s.active ? THEME.success : THEME.danger,
                                            fontWeight: 700,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 5,
                                        }}
                                    >
                                        {s.active ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}{' '}
                                        {s.active ? 'Active' : 'Inactive'}
                                    </span>
                                    <span
                                        style={{
                                            fontFamily: THEME.fontMono,
                                            color: Number(s.lag_bytes) > 104857600 ? THEME.danger : THEME.textMain,
                                            fontWeight: Number(s.lag_bytes) > 104857600 ? 700 : 400,
                                        }}
                                    >
                                        {s.lag_pretty || '—'}
                                    </span>
                                    <span
                                        style={{
                                            color:
                                                s.wal_status === 'reserved'
                                                    ? THEME.success
                                                    : s.wal_status === 'extended'
                                                      ? THEME.warning
                                                      : THEME.danger,
                                            fontWeight: 600,
                                            textTransform: 'capitalize',
                                        }}
                                    >
                                        {s.wal_status || '—'}
                                    </span>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}

            {/* WAL Settings tab */}
            {activeTab === 'wal' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
                    <div className="rw-card">
                        <div
                            style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: THEME.textMain,
                                marginBottom: 14,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 20,
                            }}
                        >
                            <Zap size={15} color={THEME.secondary} /> WAL Configuration
                        </div>
                        {settings.map((s) => (
                            <div key={s.name} className="rw-row">
                                <span style={{ color: THEME.textMuted }}>{s.name}</span>
                                <span
                                    style={{
                                        fontFamily: THEME.fontMono,
                                        color: THEME.textMain,
                                        fontWeight: 600,
                                        fontSize: 11,
                                    }}
                                >
                                    {s.setting}
                                    {s.unit ? ` ${s.unit}` : ''}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="rw-card">
                        <div
                            style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: THEME.primary,
                                marginBottom: 12,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 20,
                            }}
                        >
                            <CheckCircle size={15} /> Replication Health Checklist
                        </div>
                        {[
                            {
                                label: 'WAL level is replica or logical',
                                ok: ['replica', 'logical'].includes(
                                    settings.find((s) => s.name === 'wal_level')?.setting,
                                ),
                            },
                            {
                                label: 'max_wal_senders > 0',
                                ok: parseInt(settings.find((s) => s.name === 'max_wal_senders')?.setting || 0) > 0,
                            },
                            {
                                label: 'max_replication_slots > 0',
                                ok:
                                    parseInt(settings.find((s) => s.name === 'max_replication_slots')?.setting || 0) >
                                    0,
                            },
                            { label: 'No inactive replication slots', ok: inactiveSlots === 0 },
                            {
                                label: 'All replicas streaming (not catchup)',
                                ok: replicas.every((r) => r.state === 'streaming'),
                            },
                            { label: 'Replay lag < 100 MB', ok: maxLagBytes < 104857600 },
                        ].map(({ label, ok }) => (
                            <div
                                key={label}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 20,
                                    padding: '8px 0',
                                    borderBottom: `1px solid ${THEME.glassBorder}20`,
                                    fontSize: 13,
                                }}
                            >
                                {ok ? (
                                    <CheckCircle size={14} color={THEME.success} />
                                ) : (
                                    <AlertTriangle size={14} color={THEME.warning} />
                                )}
                                <span style={{ color: ok ? THEME.textMain : THEME.textMuted }}>{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
