/**
 * SystemHealthPanel.tsx
 * ─────────────────────
 * Operator view of GET /api/health?full=1 — control-plane status, the detected
 * database provider (Neon/Supabase/…), non-blocking configuration warnings
 * (e.g. "Supabase requires TLS"), and any hard blockers.
 *
 * Drop-in: <SystemHealthPanel />
 */
import { useEffect, useState } from 'react';
import { fetchDataFresh } from '../../../utils/api';
import { THEME } from '../../../utils/theme';

type Diag = {
    ok: boolean;
    encryption?: { ok: boolean; code: string; hint?: string };
    schema?: { ok: boolean; code: string; hint?: string };
    provider?: {
        provider: string;
        pooled: boolean;
        tls: boolean;
        host?: string | null;
        warnings?: Array<{ code: string; hint: string }>;
    };
    warnings?: Array<{ code: string; hint: string }>;
    blockers?: Array<{ component: string; code: string; hint?: string }>;
};
export type HealthResponse = {
    controlPlane: 'ok' | 'degraded' | string;
    activeConnections?: number;
    uptime?: number;
    memoryMB?: number;
    diagnostics?: Diag;
    timestamp?: string;
};

/** Pure: reduce a /api/health?full=1 payload into a render-ready summary. */
export function summarizeHealth(h: HealthResponse | null) {
    const d = h?.diagnostics;
    const provider = d?.provider?.provider || 'unknown';
    const warnings = (d?.warnings && d.warnings.length ? d.warnings : d?.provider?.warnings) || [];
    const blockers = d?.blockers || [];
    const ok = !!h && h.controlPlane === 'ok' && (d ? d.ok : true);
    const tone: 'ok' | 'warn' | 'error' =
        blockers.length > 0 ? 'error' : warnings.length > 0 ? 'warn' : ok ? 'ok' : 'error';
    return {
        ok,
        tone,
        provider,
        tls: !!d?.provider?.tls,
        pooled: !!d?.provider?.pooled,
        host: d?.provider?.host || null,
        warnings,
        blockers,
    };
}

const TONE_COLOR: Record<string, string> = { ok: THEME.success, warn: THEME.warning, error: THEME.dangerLight };

export default function SystemHealthPanel() {
    const [data, setData] = useState<HealthResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    async function load() {
        setLoading(true);
        setError(null);
        try {
            setData((await fetchDataFresh('/api/health?full=1')) as HealthResponse);
        } catch (e: any) {
            setError(e?.message || 'Failed to load system health');
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        load(); /* eslint-disable-next-line */
    }, []);

    if (loading) return <div className="sh-panel sh-loading">Checking system health…</div>;
    if (error)
        return (
            <div className="sh-panel sh-error">
                ⚠ {error} <button onClick={load}>Retry</button>
            </div>
        );

    const s = summarizeHealth(data);
    return (
        <div className="sh-panel">
            <header className="sh-head" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: TONE_COLOR[s.tone], fontSize: 14 }}>●</span>
                <strong>
                    Control plane: {s.ok ? 'healthy' : s.tone === 'warn' ? 'healthy (warnings)' : 'degraded'}
                </strong>
                <button style={{ marginLeft: 'auto' }} onClick={load}>
                    Refresh
                </button>
            </header>

            <div className="sh-provider" style={{ margin: '10px 0', fontSize: 13 }}>
                Database provider: <strong style={{ textTransform: 'capitalize' }}>{s.provider}</strong>
                {s.host && <span style={{ color: THEME.textMuted }}> · {s.host}</span>}
                <span style={{ color: s.tls ? THEME.success : THEME.warning, marginLeft: 8 }}>
                    {s.tls ? 'TLS ✓' : 'no TLS'}
                </span>
                {s.pooled && <span style={{ color: THEME.ai, marginLeft: 8 }}>pooled</span>}
            </div>

            {s.blockers.length > 0 && (
                <div className="sh-blockers">
                    <strong style={{ color: TONE_COLOR.error }}>Blockers</strong>
                    <ul>
                        {s.blockers.map((b, i) => (
                            <li key={i}>
                                <code>{b.component}</code> — {b.hint || b.code}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {s.warnings.length > 0 && (
                <div className="sh-warnings">
                    <strong style={{ color: TONE_COLOR.warn }}>Warnings</strong>
                    <ul>
                        {s.warnings.map((w, i) => (
                            <li key={i} title={w.code}>
                                {w.hint}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {s.blockers.length === 0 && s.warnings.length === 0 && (
                <p className="sh-clean" style={{ color: THEME.textMuted, fontSize: 12 }}>
                    No configuration issues detected.
                </p>
            )}
        </div>
    );
}
