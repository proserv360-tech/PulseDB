/**
 * StorageAdvisorPanel.tsx — reclaimable-storage advisor (multi-engine).
 * Reads GET /api/connections/:id/storage-advisor. Ranks tables by reclaimable
 * free space and recommends the engine-appropriate reclaim command (OPTIMIZE
 * TABLE / compact / ALTER INDEX REBUILD / SHRINK SPACE / VACUUM). For fully
 * managed engines the backend returns { supported:false, managed:true } and
 * this renders a short "managed — no action needed" note; PostgreSQL uses the
 * Vacuum Forecast above. Self-contained: resolves the active connection from
 * localStorage and reloads on the global refresh.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { THEME, useAdaptiveTheme, useGlobalRefresh } from '../../../utils/theme';
import { fetchDataFresh } from '../../../utils/api';
import { HardDrive, AlertTriangle, RefreshCw, Info } from 'lucide-react';

const URGENCY: Record<string, { label: string; color: string }> = {
    high: { label: 'High', color: THEME.danger },
    medium: { label: 'Medium', color: THEME.warning },
    low: { label: 'Low', color: THEME.primary },
};

const fmtBytes = (b: number) => {
    const n = Number(b) || 0;
    if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
    if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
    if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${n} B`;
};

const StorageAdvisorPanel: React.FC = () => {
    useAdaptiveTheme();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const connId =
                typeof localStorage !== 'undefined' ? localStorage.getItem('fathom_active_connection_id') : null;
            if (!connId) {
                setData({ supported: false, note: 'Select a connection to analyze reclaimable storage.' });
                return;
            }
            const d = await fetchDataFresh(`/api/connections/${connId}/storage-advisor`);
            setData(d ?? { supported: false, tables: [], summary: {} });
        } catch (e: any) {
            setError(e?.message ?? 'Failed to load storage advisor');
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        load();
    }, [load]);
    useGlobalRefresh(load);

    const tables = data?.tables ?? [];
    const summary = data?.summary ?? {};
    const supported = data?.supported !== false;

    const shell = (children: React.ReactNode) => (
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
                    <HardDrive size={17} color={THEME.primary} />
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: THEME.textMain }}>Storage Advisor</div>
                        <div style={{ fontSize: 12, color: THEME.textMuted }}>
                            Reclaimable space per table (MySQL · MongoDB · SQL Server · Oracle · Redshift)
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
            {children}
        </div>
    );

    if (loading && !tables.length) {
        return shell(
            <div style={{ padding: 20, textAlign: 'center', color: THEME.textMuted, fontSize: 13 }}>
                Loading storage advisor…
            </div>,
        );
    }
    if (error) {
        return shell(
            <div style={{ padding: 14, color: THEME.danger, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertTriangle size={15} /> {error}
            </div>,
        );
    }
    if (!supported) {
        return shell(
            <div
                style={{
                    padding: 14,
                    color: THEME.textMuted,
                    fontSize: 13,
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                }}
            >
                <Info size={15} />{' '}
                {data?.note ??
                    'Reclaimable-storage analysis is available for MySQL/MariaDB. For PostgreSQL, use the Vacuum Forecast above.'}
            </div>,
        );
    }

    return shell(
        <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                {(['high', 'medium', 'low'] as const).map((k) => (
                    <div
                        key={k}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '5px 11px',
                            borderRadius: 999,
                            background: `${URGENCY[k].color}18`,
                            border: `1px solid ${URGENCY[k].color}44`,
                        }}
                    >
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: URGENCY[k].color }} />
                        <span style={{ fontSize: 12, color: THEME.textMain }}>{URGENCY[k].label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: URGENCY[k].color }}>
                            {summary[k] ?? 0}
                        </span>
                    </div>
                ))}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 11px',
                        borderRadius: 999,
                        background: `${THEME.primary}14`,
                        border: `1px solid ${THEME.glassBorder}`,
                    }}
                >
                    <span style={{ fontSize: 12, color: THEME.textMuted }}>Reclaimable</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: THEME.primary }}>
                        {summary.reclaimableMb ?? 0} MB
                    </span>
                </div>
            </div>

            {!tables.length ? (
                <div style={{ padding: 20, textAlign: 'center', color: THEME.textMuted, fontSize: 13 }}>
                    No fragmented tables — nothing to reclaim.
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                        <thead>
                            <tr style={{ color: THEME.textMuted, textAlign: 'left' }}>
                                {['Table', 'Size', 'Reclaimable', 'Frag %', 'Urgency', 'Fix'].map((h) => (
                                    <th
                                        key={h}
                                        style={{
                                            padding: '8px 10px',
                                            borderBottom: `1px solid ${THEME.glassBorder}`,
                                            fontWeight: 600,
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {tables.slice(0, 30).map((t: any, i: number) => {
                                const u = URGENCY[t.urgency] || URGENCY.low;
                                return (
                                    <tr key={i} style={{ color: THEME.textMain }}>
                                        <td
                                            style={{
                                                padding: '8px 10px',
                                                borderBottom: `1px solid ${THEME.glassBorder}`,
                                                fontFamily: THEME.fontMono,
                                            }}
                                        >
                                            {t.schema}.{t.table}
                                        </td>
                                        <td
                                            style={{
                                                padding: '8px 10px',
                                                borderBottom: `1px solid ${THEME.glassBorder}`,
                                                color: THEME.textMuted,
                                                fontFamily: THEME.fontMono,
                                            }}
                                        >
                                            {fmtBytes(t.totalSizeBytes)}
                                        </td>
                                        <td
                                            style={{
                                                padding: '8px 10px',
                                                borderBottom: `1px solid ${THEME.glassBorder}`,
                                                fontFamily: THEME.fontMono,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {fmtBytes(t.reclaimableBytes)}
                                        </td>
                                        <td
                                            style={{
                                                padding: '8px 10px',
                                                borderBottom: `1px solid ${THEME.glassBorder}`,
                                            }}
                                        >
                                            {t.fragmentationPct}%
                                        </td>
                                        <td
                                            style={{
                                                padding: '8px 10px',
                                                borderBottom: `1px solid ${THEME.glassBorder}`,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    fontWeight: 600,
                                                    color: u.color,
                                                    background: `${u.color}18`,
                                                    border: `1px solid ${u.color}44`,
                                                    borderRadius: 6,
                                                    padding: '2px 8px',
                                                }}
                                            >
                                                {u.label}
                                            </span>
                                        </td>
                                        <td
                                            style={{
                                                padding: '8px 10px',
                                                borderBottom: `1px solid ${THEME.glassBorder}`,
                                                color: THEME.textMuted,
                                                fontFamily: THEME.fontMono,
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {t.recommendation}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </>,
    );
};

export default StorageAdvisorPanel;
