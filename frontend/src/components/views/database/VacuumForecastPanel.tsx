/**
 * VacuumForecastPanel.tsx — predictive VACUUM advisor (B-1).
 * Reads GET /api/advisor/bloat/forecast and ranks tables by how soon autovacuum
 * will fire. Self-contained: fetches its own data, reloads on the global refresh.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { THEME, useAdaptiveTheme, useGlobalRefresh } from '../../../utils/theme';
import { fetchData } from '../../../utils/api';
import { Clock, AlertTriangle, RefreshCw } from 'lucide-react';

const URGENCY = {
    overdue: { label: 'Overdue', color: THEME.danger },
    soon: { label: 'Soon (<24h)', color: THEME.warning },
    watch: { label: 'Watch (<7d)', color: THEME.primary },
    ok: { label: 'OK', color: THEME.success },
};

const fmtEta = (h) =>
    h == null
        ? '—'
        : h === 0
          ? 'now'
          : h < 1
            ? `${Math.round(h * 60)}m`
            : h < 48
              ? `${Math.round(h)}h`
              : `${Math.round(h / 24)}d`;

const VacuumForecastPanel: React.FC = () => {
    useAdaptiveTheme();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const d = await fetchData('/api/advisor/bloat/forecast');
            setData(d && Array.isArray(d.tables) ? d : { summary: {}, tables: [] });
        } catch (e: any) {
            setError(e?.message ?? 'Failed to load forecast');
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
                    <Clock size={17} color={THEME.primary} />
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: THEME.textMain }}>Vacuum Forecast</div>
                        <div style={{ fontSize: 12, color: THEME.textMuted }}>
                            Predicted time until autovacuum triggers, per table
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

            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                {(['overdue', 'soon', 'watch', 'ok'] as const).map((k) => (
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
            </div>

            {loading && !tables.length ? (
                <div style={{ padding: 20, textAlign: 'center', color: THEME.textMuted, fontSize: 13 }}>
                    Loading forecast…
                </div>
            ) : error || data?.error ? (
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
                    <AlertTriangle size={15} /> {error || data?.error}
                </div>
            ) : !tables.length ? (
                <div style={{ padding: 20, textAlign: 'center', color: THEME.textMuted, fontSize: 13 }}>
                    No tables with dead tuples — nothing to forecast.
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                        <thead>
                            <tr style={{ color: THEME.textMuted, textAlign: 'left' }}>
                                {['Table', 'Dead / threshold', 'Dead %', 'Growth/h', 'ETA', 'Urgency'].map((h) => (
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
                                const u = URGENCY[t.urgency] || URGENCY.ok;
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
                                            {Number(t.deadTuples).toLocaleString()} /{' '}
                                            {Number(t.threshold).toLocaleString()}
                                        </td>
                                        <td
                                            style={{
                                                padding: '8px 10px',
                                                borderBottom: `1px solid ${THEME.glassBorder}`,
                                            }}
                                        >
                                            {t.deadPct}%
                                        </td>
                                        <td
                                            style={{
                                                padding: '8px 10px',
                                                borderBottom: `1px solid ${THEME.glassBorder}`,
                                                color: THEME.textMuted,
                                            }}
                                        >
                                            {t.growthPerHour}
                                        </td>
                                        <td
                                            style={{
                                                padding: '8px 10px',
                                                borderBottom: `1px solid ${THEME.glassBorder}`,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {fmtEta(t.hoursUntilVacuum)}
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
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default VacuumForecastPanel;
