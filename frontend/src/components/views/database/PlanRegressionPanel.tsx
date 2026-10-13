/**
 * PlanRegressionPanel.tsx — auto_explain plan-regression detection (B-1).
 * Reads GET /api/auto-explain/regressions and lists queries whose current plan
 * is materially slower than a faster plan they used earlier in the window.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { THEME, useAdaptiveTheme, useGlobalRefresh } from '../../../utils/theme';
import { fetchData } from '../../../utils/api';
import { TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react';

const PlanRegressionPanel: React.FC = () => {
    useAdaptiveTheme();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const d = await fetchData('/api/auto-explain/regressions');
            setData(d && Array.isArray(d.regressions) ? d : { regressions: [], eventsAnalyzed: 0 });
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

    const regs = data?.regressions ?? [];

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
                    <TrendingUp size={17} color={THEME.danger} />
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: THEME.textMain }}>Plan Regressions</div>
                        <div style={{ fontSize: 12, color: THEME.textMuted }}>
                            Queries whose current plan is slower than an earlier one
                            {data ? ` · ${data.eventsAnalyzed} events analyzed` : ''}
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

            {loading && !regs.length ? (
                <div style={{ padding: 20, textAlign: 'center', color: THEME.textMuted, fontSize: 13 }}>
                    Analyzing captured plans…
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
            ) : !regs.length ? (
                <div style={{ padding: 20, textAlign: 'center', color: THEME.textMuted, fontSize: 13 }}>
                    No plan regressions detected. (Requires auto_explain events shipped for this connection.)
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {regs.slice(0, 20).map((r: any, i: number) => (
                        <div
                            key={i}
                            style={{ border: `1px solid ${THEME.glassBorder}`, borderRadius: 10, padding: 12 }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 8,
                                    gap: 12,
                                }}
                            >
                                <span
                                    style={{
                                        fontFamily: THEME.fontMono,
                                        fontSize: 12,
                                        color: THEME.textMain,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        flex: 1,
                                    }}
                                >
                                    {r.statement || `query ${r.queryId}`}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: THEME.danger, whiteSpace: 'nowrap' }}>
                                    +{r.slowdownPct}% slower
                                </span>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    gap: 18,
                                    fontSize: 12,
                                    color: THEME.textMuted,
                                    flexWrap: 'wrap',
                                }}
                            >
                                <span>
                                    baseline <strong style={{ color: THEME.success }}>{r.baselinePlan.avgMs}ms</strong>{' '}
                                    <span style={{ fontFamily: THEME.fontMono }}>({r.baselinePlan.fingerprint})</span>
                                </span>
                                <span>
                                    → current <strong style={{ color: THEME.danger }}>{r.currentPlan.avgMs}ms</strong>{' '}
                                    <span style={{ fontFamily: THEME.fontMono }}>({r.currentPlan.fingerprint})</span>
                                </span>
                                <span>
                                    {r.currentPlan.executions} runs · {r.distinctPlans} plans seen
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PlanRegressionPanel;
