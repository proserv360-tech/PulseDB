/**
 * PitrPanel.tsx — point-in-time-recovery window + restore planner (B-2).
 * Reads GET /api/backups/pitr/window and, for a chosen target time, GET
 * /api/backups/pitr/plan to show the base backup + WAL segments to replay.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { THEME, useAdaptiveTheme, useGlobalRefresh } from '../../../utils/theme';
import { fetchData } from '../../../utils/api';
import { History, AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react';

const PitrPanel: React.FC = () => {
    useAdaptiveTheme();
    const [win, setWin] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [target, setTarget] = useState('');
    const [plan, setPlan] = useState<any>(null);
    const [planning, setPlanning] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setWin(await fetchData('/api/backups/pitr/window'));
        } catch (e: any) {
            setError(e?.message ?? 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        load();
    }, [load]);
    useGlobalRefresh(load);

    const buildPlan = async () => {
        if (!target) return;
        setPlanning(true);
        setPlan(null);
        try {
            const iso = new Date(target).toISOString();
            const sep = '/api/backups/pitr/plan'.includes('?') ? '&' : '?';
            setPlan(await fetchData(`/api/backups/pitr/plan${sep}target=${encodeURIComponent(iso)}`));
        } catch (e: any) {
            setPlan({ error: e?.message });
        } finally {
            setPlanning(false);
        }
    };

    return (
        <div
            style={{
                background: THEME.surface,
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: 14,
                padding: 20,
                marginBottom: 18,
                fontFamily: THEME.fontBody,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <History size={17} color={THEME.primary} />
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: THEME.textMain }}>
                            Point-in-Time Recovery
                        </div>
                        <div style={{ fontSize: 12, color: THEME.textMuted }}>
                            Recoverable window and restore plan for a target time
                        </div>
                    </div>
                </div>
                <button
                    onClick={load}
                    title="Refresh"
                    style={{
                        background: 'none',
                        border: `1px solid ${THEME.glassBorder}`,
                        borderRadius: 8,
                        padding: 6,
                        cursor: 'pointer',
                        color: THEME.textMuted,
                        display: 'flex',
                    }}
                >
                    <RefreshCw size={13} style={loading ? { animation: 'rotation 1s linear infinite' } : undefined} />
                </button>
            </div>

            {loading ? (
                <div style={{ padding: 20, textAlign: 'center', color: THEME.textMuted, fontSize: 13 }}>
                    Loading recovery window…
                </div>
            ) : error ? (
                <div
                    style={{
                        padding: 14,
                        color: THEME.danger,
                        fontSize: 13,
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                    }}
                >
                    <AlertTriangle size={15} /> {error}
                </div>
            ) : (
                <>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                        {[
                            ['Earliest restorable', win?.earliest],
                            ['Latest restorable', win?.latest],
                            ['Base backups', win?.baseBackups],
                            ['WAL segments', win?.walSegments],
                        ].map(([label, val]) => (
                            <div
                                key={label as string}
                                style={{
                                    flex: '1 1 160px',
                                    background: THEME.glass,
                                    borderRadius: 10,
                                    padding: '11px 14px',
                                }}
                            >
                                <div style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 3 }}>{label}</div>
                                <div
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: THEME.textMain,
                                        fontFamily: THEME.fontMono,
                                    }}
                                >
                                    {val == null
                                        ? '—'
                                        : String(val)
                                              .replace('T', ' ')
                                              .replace(/\.\d+Z$/, 'Z')}
                                </div>
                            </div>
                        ))}
                    </div>
                    {!win?.feasible && (
                        <div
                            style={{
                                padding: 10,
                                fontSize: 12.5,
                                color: THEME.warning,
                                background: '#fbbf2414',
                                border: '1px solid #fbbf2433',
                                borderRadius: 8,
                                marginBottom: 14,
                            }}
                        >
                            {win?.reason || 'No recoverable window — register base backups and WAL segments first.'}
                        </div>
                    )}
                    <div
                        style={{
                            display: 'flex',
                            gap: 10,
                            alignItems: 'center',
                            marginBottom: plan ? 14 : 0,
                            flexWrap: 'wrap',
                        }}
                    >
                        <span style={{ fontSize: 12.5, color: THEME.textMuted }}>Restore to:</span>
                        <input
                            type="datetime-local"
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            style={{
                                background: THEME.glass,
                                border: `1px solid ${THEME.glassBorder}`,
                                borderRadius: 8,
                                padding: '7px 10px',
                                color: THEME.textMain,
                                fontSize: 13,
                            }}
                        />
                        <button
                            onClick={buildPlan}
                            disabled={!target || planning}
                            style={{
                                background: THEME.primary,
                                border: 'none',
                                borderRadius: 8,
                                padding: '8px 16px',
                                color: '#fff',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: target ? 'pointer' : 'not-allowed',
                                opacity: target ? 1 : 0.5,
                            }}
                        >
                            {planning ? 'Planning…' : 'Build plan'}
                        </button>
                    </div>
                    {plan && (
                        <div style={{ border: `1px solid ${THEME.glassBorder}`, borderRadius: 10, padding: 14 }}>
                            {plan.error ? (
                                <div style={{ color: THEME.danger, fontSize: 13 }}>{plan.error}</div>
                            ) : plan.feasible ? (
                                <>
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            marginBottom: 10,
                                            color: THEME.success,
                                            fontSize: 13,
                                            fontWeight: 600,
                                        }}
                                    >
                                        <CheckCircle size={15} /> Recoverable to{' '}
                                        {String(plan.targetTs).replace('T', ' ')}
                                    </div>
                                    <div style={{ fontSize: 12.5, color: THEME.textMain, marginBottom: 6 }}>
                                        Base backup:{' '}
                                        <span style={{ fontFamily: THEME.fontMono, color: THEME.textMuted }}>
                                            {String(plan.baseBackup?.backupTime).replace('T', ' ')}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 12.5, color: THEME.textMain }}>
                                        Replay {plan.walSegments?.length ?? 0} WAL segment(s):{' '}
                                        <span style={{ fontFamily: THEME.fontMono, color: THEME.textMuted }}>
                                            {(plan.walSegments || [])
                                                .map((w: any) => w.segment)
                                                .slice(0, 8)
                                                .join(', ')}
                                            {(plan.walSegments?.length || 0) > 8 ? '…' : ''}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        color: THEME.danger,
                                        fontSize: 13,
                                    }}
                                >
                                    <AlertTriangle size={15} /> Not recoverable: {plan.reason}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default PitrPanel;
