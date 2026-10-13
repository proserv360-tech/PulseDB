import React, { useState, useEffect, useCallback, useRef } from 'react';
import PitrPanel from './PitrPanel';
import { THEME, useAdaptiveTheme, useGlobalRefresh } from '../../../utils/theme';
import { fetchData } from '../../../utils/api';
import {
    Archive,
    CheckCircle,
    AlertTriangle,
    RefreshCw,
    Clock,
    Database,
    Wifi,
    WifiOff,
    HardDrive,
    Shield,
    Radio,
    FileCheck,
    AlertCircle,
} from 'lucide-react';

/* ── Styles ───────────────────────────────────────────────────────────────── */
const Styles = () => (
    <style>{`
        @keyframes brSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes brFade { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes brPulse { 0%,100%{opacity:1;} 50%{opacity:.4;} }
        .br-card { background:${THEME.surface}; border:none; border-left:4px solid var(--pipe-color, ${THEME.primary}); border-radius:0 16px 16px 0; padding:24px; animation:brFade .3s ease; position:relative; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08); backdrop-filter:blur(12px); transition: all 0.25s ease; }
        .br-card:hover { box-shadow:0 4px 16px rgba(0,0,0,0.12); border-left-width: 6px; transform: translateY(-4px); }
        .br-card::before { content:''; position:absolute; top:0; right:0; width:40%; height:100%; background:repeating-linear-gradient(-45deg, transparent, transparent 8px, ${THEME.glassBorder}15 8px, ${THEME.glassBorder}15 9px); pointer-events:none; }
        .br-metric { background:${THEME.surface}; border:1px solid ${THEME.glassBorder}; border-radius: 20px; padding:20px 24px; display:flex; align-items:center; gap: 22px; box-shadow:0 4px 16px rgba(0,0,0,0.08); backdrop-filter:blur(12px); }
        .br-badge { display:inline-flex; align-items:center; gap:6px; padding:4px 12px; border-radius: 22px; font-size:11px; font-weight:700; }
        .br-setting-row { display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid ${THEME.glassBorder}40; font-size:13px; }
        .br-setting-row:last-child { border-bottom:none; }
    `}</style>
);

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const fmtDate = (d) => (d ? new Date(d).toLocaleString() : '—');
const fmtRelative = (d) => {
    if (!d) return '—';
    const s = Math.floor((Date.now() - new Date(d)) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
};

/* ── Health badge ─────────────────────────────────────────────────────────── */
const HealthBadge = ({ ok, label }) => (
    <span
        className="br-badge"
        style={{
            background: ok ? `${THEME.success}15` : `${THEME.danger}15`,
            color: ok ? THEME.success : THEME.danger,
            border: `1px solid ${ok ? THEME.success : THEME.danger}30`,
        }}
    >
        {ok ? <CheckCircle size={10} /> : <AlertTriangle size={10} />} {label}
    </span>
);

/* ── Metric card ──────────────────────────────────────────────────────────── */
const MetricCard = ({ icon: Icon, label, value, sub, color = THEME.primary }) => (
    <div className="br-metric">
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
            <div style={{ fontSize: 22, fontWeight: 800, color: THEME.textMain, lineHeight: 1 }}>{value}</div>
            <div
                style={{ fontSize: 11, color: THEME.textMuted, marginTop: 3, fontWeight: 600, letterSpacing: '0.02em' }}
            >
                {label}
            </div>
            {sub && <div style={{ fontSize: 11, color: THEME.textDim, marginTop: 2 }}>{sub}</div>}
        </div>
    </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   BACKUP & RECOVERY TAB
   ═══════════════════════════════════════════════════════════════════════════ */
export default function BackupRecoveryTab() {
    useAdaptiveTheme(); // keeps THEME in sync with dark/light toggle
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [lastAt, setLastAt] = useState(null);
    const [interval, setInterval_] = useState(30);
    const intervalRef = useRef(null);

    const load = useCallback(async (initial = false) => {
        if (!initial) setRefreshing(true);
        try {
            const d = await fetchData('/api/backup/status');
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
        if (interval > 0) intervalRef.current = setInterval(() => load(false), interval * 1000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [interval, load]);

    useGlobalRefresh(React.useCallback(() => load(), [load]));

    /* ── Derived values ─────────────────────────────────────────────────── */
    const archiver = data?.archiver || {};
    const wal = data?.wal || {};
    const settings = data?.settings || [];

    const archiveEnabled = settings.find((s) => s.name === 'archive_mode')?.setting === 'on';
    const walLevel = settings.find((s) => s.name === 'wal_level')?.setting || '—';
    const archiveCmd = settings.find((s) => s.name === 'archive_command')?.setting || '(none)';
    const maxWalSenders = settings.find((s) => s.name === 'max_wal_senders')?.setting || '0';
    const replicationOk = parseInt(maxWalSenders) > 0;
    const archiveHealthy = archiver.failed_count === 0 || archiver.failed_count === '0';
    const inRecovery = wal.in_recovery;

    const settingLabel = {
        archive_mode: 'Archive Mode',
        archive_command: 'Archive Command',
        wal_level: 'WAL Level',
        restore_command: 'Restore Command',
        recovery_target_timeline: 'Recovery Target Timeline',
        max_wal_senders: 'Max WAL Senders',
        wal_keep_size: 'WAL Keep Size (MB)',
    };

    /* ── Loading / Error ────────────────────────────────────────────────── */
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
                <RefreshCw size={24} style={{ animation: 'brSpin 1s linear infinite', marginRight: 10 }} /> Loading
                backup status…
            </div>
        );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Styles />

            {/* ── Toolbar ───────────────────────────────────────────────── */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '18px 24px',
                    background: THEME.surface,
                    borderRadius: 16,
                    border: `1px solid ${THEME.glassBorder}`,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                    backdropFilter: 'blur(12px)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <Archive size={20} color={THEME.primary} />
                    <span style={{ fontWeight: 700, fontSize: 15, color: THEME.textMain }}>Backup & Recovery</span>
                    {inRecovery && (
                        <span
                            className="br-badge"
                            style={{
                                background: `${THEME.warning}15`,
                                color: THEME.warning,
                                border: `1px solid ${THEME.warning}30`,
                            }}
                        >
                            <Radio size={10} /> REPLICA / RECOVERY MODE
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                    <span style={{ fontSize: 11, color: THEME.textDim }}>
                        {lastAt ? `Updated ${fmtRelative(lastAt)}` : ''}
                    </span>
                    <select
                        value={interval}
                        onChange={(e) => setInterval_(+e.target.value)}
                        style={{
                            background: THEME.surface,
                            border: `1px solid ${THEME.glassBorder}`,
                            color: THEME.textMain,
                            borderRadius: 20,
                            padding: '4px 8px',
                            fontSize: 12,
                        }}
                    >
                        <option value={10}>10s</option>
                        <option value={30}>30s</option>
                        <option value={60}>1m</option>
                        <option value={0}>Off</option>
                    </select>
                </div>
            </div>

            <PitrPanel />

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

            {/* ── Metric cards ──────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                <MetricCard
                    icon={FileCheck}
                    label="WAL Files Archived"
                    value={archiver.archived_count ?? '—'}
                    sub={`Last: ${fmtRelative(archiver.last_archived_time)}`}
                    color={THEME.success}
                />
                <MetricCard
                    icon={AlertTriangle}
                    label="Archive Failures"
                    value={archiver.failed_count ?? '—'}
                    sub={
                        archiver.last_failed_time
                            ? `Last fail: ${fmtRelative(archiver.last_failed_time)}`
                            : 'No failures'
                    }
                    color={parseInt(archiver.failed_count) > 0 ? THEME.danger : THEME.success}
                />
                <MetricCard
                    icon={Database}
                    label="WAL Level"
                    value={walLevel.toUpperCase()}
                    sub={`Senders: ${maxWalSenders}`}
                    color={THEME.primary}
                />
                <MetricCard
                    icon={Shield}
                    label="Server Role"
                    value={inRecovery ? 'Replica' : 'Primary'}
                    sub={inRecovery ? 'In recovery mode' : 'Read-write primary'}
                    color={inRecovery ? THEME.warning : THEME.secondary}
                />
            </div>

            {/* ── Main grid ─────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* WAL Archiving Status */}
                <div className="br-card">
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 16,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: THEME.textMain,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 20,
                            }}
                        >
                            <Archive size={15} color={THEME.primary} /> WAL Archiving
                        </div>
                        <HealthBadge
                            ok={archiveEnabled && archiveHealthy}
                            label={archiveEnabled ? (archiveHealthy ? 'Healthy' : 'Failures Detected') : 'Disabled'}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {[
                            { label: 'Archive Mode', value: archiveEnabled ? 'Enabled' : 'Disabled' },
                            { label: 'Total Archived', value: `${archiver.archived_count ?? 0} WAL files` },
                            { label: 'Last Archived WAL', value: archiver.last_archived_wal || '—' },
                            { label: 'Last Archive Time', value: fmtDate(archiver.last_archived_time) },
                            { label: 'Failed Archives', value: archiver.failed_count ?? 0 },
                            { label: 'Last Failed WAL', value: archiver.last_failed_wal || '—' },
                            { label: 'Stats Reset', value: fmtDate(archiver.stats_reset) },
                        ].map(({ label, value }) => (
                            <div key={label} className="br-setting-row">
                                <span style={{ color: THEME.textMuted }}>{label}</span>
                                <span
                                    style={{
                                        color: THEME.textMain,
                                        fontWeight: 600,
                                        fontFamily: THEME.fontMono,
                                        fontSize: 12,
                                        maxWidth: 220,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        flex: 1,
                                        minWidth: 0,
                                    }}
                                >
                                    {String(value)}
                                </span>
                            </div>
                        ))}
                    </div>

                    {!archiveEnabled && (
                        <div
                            style={{
                                marginTop: 16,
                                padding: 12,
                                background: `${THEME.warning}10`,
                                border: `1px solid ${THEME.warning}30`,
                                borderRadius: 16,
                                fontSize: 12,
                                color: THEME.warning,
                            }}
                        >
                            ⚠ WAL archiving is disabled. Set <code>archive_mode = on</code> in postgresql.conf to enable
                            point-in-time recovery.
                        </div>
                    )}
                    {parseInt(archiver.failed_count) > 0 && (
                        <div
                            style={{
                                marginTop: 12,
                                padding: 12,
                                background: `${THEME.danger}10`,
                                border: `1px solid ${THEME.danger}30`,
                                borderRadius: 16,
                                fontSize: 12,
                                color: THEME.danger,
                            }}
                        >
                            ❌ Archive failures detected. Last failed: <strong>{archiver.last_failed_wal}</strong> at{' '}
                            {fmtDate(archiver.last_failed_time)}
                        </div>
                    )}
                </div>

                {/* Current WAL Position */}
                <div className="br-card">
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
                        <HardDrive size={15} color={THEME.secondary} /> Current WAL Position
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {[
                            { label: 'Current LSN', value: wal.current_lsn || '—' },
                            { label: 'Current WAL File', value: wal.current_wal || '—' },
                            { label: 'Server Started', value: fmtDate(wal.started_at) },
                        ].map(({ label, value }) => (
                            <div key={label} className="br-setting-row">
                                <span style={{ color: THEME.textMuted }}>{label}</span>
                                <span
                                    style={{
                                        color: THEME.textMain,
                                        fontWeight: 600,
                                        fontFamily: THEME.fontMono,
                                        fontSize: 12,
                                    }}
                                >
                                    {value}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Replication readiness */}
                    <div style={{ marginTop: 20 }}>
                        <div
                            style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: THEME.textMuted,
                                letterSpacing: '0.02em',
                                marginBottom: 10,
                            }}
                        >
                            Replication Readiness
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {[
                                { label: 'WAL Level ≥ replica', ok: ['replica', 'logical'].includes(walLevel) },
                                { label: 'Archive mode enabled', ok: archiveEnabled },
                                { label: 'max_wal_senders > 0', ok: replicationOk },
                                { label: 'No archive failures', ok: archiveHealthy },
                            ].map(({ label, ok }) => (
                                <div
                                    key={label}
                                    style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 13 }}
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
                </div>
            </div>

            {/* ── Configuration settings ────────────────────────────────── */}
            <div className="br-card">
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
                    <Shield size={15} color={THEME.primary} /> Backup-Relevant Configuration
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
                    {settings.map((s) => (
                        <div key={s.name} className="br-setting-row">
                            <span style={{ color: THEME.textMuted, fontSize: 12 }}>
                                {settingLabel[s.name] || s.name}
                            </span>
                            <span
                                style={{
                                    fontFamily: THEME.fontMono,
                                    fontSize: 12,
                                    color: THEME.textMain,
                                    fontWeight: 600,
                                    maxWidth: 200,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {s.setting || '—'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Guidance panel ────────────────────────────────────────── */}
            <div className="br-card" style={{ borderColor: `${THEME.primary}30` }}>
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
                    <CheckCircle size={15} /> Backup Best Practices
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
                    {[
                        {
                            title: 'pg_basebackup',
                            desc: 'Use pg_basebackup for physical full backups. Schedule nightly off-peak.',
                        },
                        {
                            title: 'WAL Archiving',
                            desc: 'Enable archive_mode=on and configure archive_command to copy WAL to secure storage.',
                        },
                        {
                            title: 'PITR Testing',
                            desc: 'Regularly test point-in-time recovery to verify backups are restorable.',
                        },
                        {
                            title: 'Retention Policy',
                            desc: 'Keep at least 7 daily + 4 weekly + 12 monthly backups following a 3-2-1 rule.',
                        },
                    ].map(({ title, desc }) => (
                        <div
                            key={title}
                            style={{
                                padding: '12px 14px',
                                background: `${THEME.surface}`,
                                borderRadius: 16,
                                border: `1px solid ${THEME.glassBorder}`,
                            }}
                        >
                            <div style={{ fontSize: 12, fontWeight: 700, color: THEME.primary, marginBottom: 4 }}>
                                {title}
                            </div>
                            <div style={{ fontSize: 11, color: THEME.textMuted, lineHeight: 1.5 }}>{desc}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
