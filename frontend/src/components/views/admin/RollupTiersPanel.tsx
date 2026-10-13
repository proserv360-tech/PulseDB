/**
 * RollupTiersPanel.tsx — tiered metric retention + rollups (B-3).
 * Shows the raw/hourly/daily tiers and lets an admin trigger a rollup+prune via
 * POST /api/retention/rollup.
 */
import React, { useState, useCallback } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { postData } from '../../../utils/api';
import { Layers, CheckCircle, AlertTriangle } from 'lucide-react';

const TIERS = [
    { name: 'Raw', res: 'per-sample', keep: '7 days', color: THEME.primary },
    { name: 'Hourly', res: '1h buckets', keep: '90 days', color: THEME.aiDark },
    { name: 'Daily', res: '1d buckets', keep: '730 days', color: THEME.success },
];

const RollupTiersPanel: React.FC = () => {
    useAdaptiveTheme();
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<any>(null);

    const runRollup = useCallback(async () => {
        setRunning(true);
        setResult(null);
        try {
            setResult(await postData('/api/retention/rollup', {}));
        } catch (e: any) {
            setResult({ error: e?.message ?? 'Rollup failed' });
        } finally {
            setRunning(false);
        }
    }, []);

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Layers size={17} color={THEME.primary} />
                <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: THEME.textMain }}>Metric Retention Tiers</div>
                    <div style={{ fontSize: 12, color: THEME.textMuted }}>
                        Long history kept at lower resolution instead of deleted
                    </div>
                </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                {TIERS.map((t) => (
                    <div
                        key={t.name}
                        style={{
                            flex: '1 1 150px',
                            background: THEME.glass,
                            border: `1px solid ${t.color}33`,
                            borderRadius: 10,
                            padding: '12px 14px',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: THEME.textMain }}>{t.name}</span>
                        </div>
                        <div style={{ fontSize: 12, color: THEME.textMuted }}>{t.res}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textMain, marginTop: 4 }}>
                            kept {t.keep}
                        </div>
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button
                    onClick={runRollup}
                    disabled={running}
                    style={{
                        background: THEME.primary,
                        border: 'none',
                        borderRadius: 8,
                        padding: '9px 18px',
                        color: '#fff',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: running ? 'not-allowed' : 'pointer',
                        opacity: running ? 0.6 : 1,
                    }}
                >
                    {running ? 'Rolling up…' : 'Run rollup + prune now'}
                </button>
                {result && !result.error && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: THEME.success }}>
                        <CheckCircle size={14} /> Rolled {result.rolled?.hourly ?? 0} hourly /{' '}
                        {result.rolled?.daily ?? 0} daily; pruned raw {result.pruned?.raw_deleted ?? 0}
                    </span>
                )}
                {result?.error && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: THEME.danger }}>
                        <AlertTriangle size={14} /> {result.error}
                    </span>
                )}
            </div>
            <div style={{ fontSize: 11.5, color: THEME.textMuted, marginTop: 12 }}>
                Rollups also run automatically (hourly) with daily pruning. Tiers are env-tunable via
                PULSEDB_METRICS_*_DAYS.
            </div>
        </div>
    );
};

export default RollupTiersPanel;
