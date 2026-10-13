/**
 * TraceCorrelationTab.tsx — dashboard tab wrapper for TraceCorrelationView.
 * Accepts a 32-hex trace id (typed, or handed over from the traces list via
 * the pulsedb:navigate-tab event) and renders the span↔query correlation view.
 */
import { useEffect, useState } from 'react';
import TraceCorrelationView from './TraceCorrelationView';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { GitBranch, Info } from 'lucide-react';

const TRACE_RE = /^[0-9a-f]{32}$/i;
const PAYLOAD_KEY = 'pulsedb:tab-payload:trace-correlation';

export default function TraceCorrelationTab() {
    useAdaptiveTheme();
    const [input, setInput] = useState('');
    const [traceId, setTraceId] = useState<string | null>(null);
    const valid = TRACE_RE.test(input.trim());

    // Pick up a trace id handed over by the traces list "Correlate" link. Read once.
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(PAYLOAD_KEY);
            if (!raw) return;
            sessionStorage.removeItem(PAYLOAD_KEY);
            const parsed = JSON.parse(raw) || {};
            const tid = parsed.traceId;
            if (typeof tid === 'string' && TRACE_RE.test(tid)) {
                setInput(tid);
                setTraceId(tid.toLowerCase());
            }
        } catch {
            /* ignore malformed payload */
        }
    }, []);

    return (
        <div style={{ padding: '16px 28px 0', fontFamily: THEME.fontBody }}>
            <div
                style={{
                    background: THEME.surface,
                    border: `1px solid ${THEME.glassBorder}`,
                    borderRadius: 14,
                    padding: 20,
                    marginBottom: 18,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <GitBranch size={17} color={THEME.primary} />
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: THEME.textMain }}>Trace Correlation</div>
                        <div style={{ fontSize: 12, color: THEME.textMuted }}>
                            Span tree + every query in the trace (includes Trace Detail)
                        </div>
                    </div>
                </div>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (valid) setTraceId(input.trim().toLowerCase());
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
                >
                    <label htmlFor="tc-trace-input" style={{ fontSize: 13, color: THEME.textMuted }}>
                        Trace ID
                    </label>
                    <input
                        id="tc-trace-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="32-character hex trace id"
                        spellCheck={false}
                        autoComplete="off"
                        style={{
                            flex: '1 1 320px',
                            minWidth: 240,
                            fontSize: 13,
                            fontFamily: THEME.fontMono,
                            color: THEME.textMain,
                            background: THEME.bg ?? 'transparent',
                            border: `1px solid ${THEME.glassBorder}`,
                            borderRadius: 8,
                            padding: '8px 12px',
                            outline: 'none',
                        }}
                    />
                    <button
                        type="submit"
                        disabled={!valid}
                        style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#fff',
                            background: valid ? THEME.primary : THEME.glassBorder,
                            border: 'none',
                            borderRadius: 8,
                            padding: '8px 16px',
                            cursor: valid ? 'pointer' : 'not-allowed',
                            opacity: valid ? 1 : 0.6,
                        }}
                    >
                        Correlate
                    </button>
                    {input && !valid && (
                        <span style={{ fontSize: 12, color: THEME.danger }}>Trace IDs are 32 hex characters.</span>
                    )}
                </form>
            </div>
            {traceId ? (
                <TraceCorrelationView traceId={traceId} />
            ) : (
                <div
                    style={{
                        background: THEME.surface,
                        border: `1px solid ${THEME.glassBorder}`,
                        borderRadius: 14,
                        padding: 20,
                        fontSize: 13,
                        color: THEME.textMuted,
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                    }}
                >
                    <Info size={15} /> Enter a trace ID to see its spans correlated with the SQL each span ran.
                </div>
            )}
        </div>
    );
}
