/**
 * Copilot.tsx
 * ───────────
 * Schema-aware SQL copilot chat panel.
 *
 * Three modes:
 *   • sql      — natural-language → SQL, with a safety-guard badge
 *   • explain  — paste a plan, get a plain-English review
 *   • rca      — draft an incident root-cause summary
 *
 * The panel is intentionally small and drop-in: paste into any page via
 *     <Copilot workspaceId={activeWs.id} />
 */
import { useEffect, useRef, useState } from 'react';
import { THEME } from '../../../utils/theme';

type Mode = 'sql' | 'explain' | 'rca';

type Turn = {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    guard?: { safe: boolean; reason?: string };
    meta?: { provider?: string; model?: string };
};

type Provider = { provider: string; model: string };

const MODE_LABEL: Record<Mode, string> = {
    sql:     'SQL from prompt',
    explain: 'Explain a plan',
    rca:     'Draft incident RCA',
};

const PLACEHOLDER: Record<Mode, string> = {
    sql:     'Top 10 slowest queries in the last 24h, grouped by database…',
    explain: 'Paste the JSON output of EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)…',
    rca:     'Paste incident JSON ({ trigger, metrics, timeline, actions })…',
};

export interface CopilotProps {
    workspaceId?: number | string;
    connectionId?: number | string;   // required for mode='sql' — identifies the monitored DB
    defaultMode?: Mode;
}

// LOW-7: client-side size cap for the input textarea. The server-side cap
// is 8 KB for `input` and 16 KB for `output` (see 0003_copilot.sql comment
// and copilotService.js). We soft-cap the client at 32 KB so a user who
// pastes a huge plan doesn't silently get truncated by the backend — the
// UI tells them to trim it first. Keep in sync with copilotService limits.
const INPUT_MAX_BYTES = 32 * 1024;

export default function Copilot({ workspaceId, connectionId, defaultMode = 'sql' }: CopilotProps) {
    const [mode, setMode]         = useState<Mode>(defaultMode);
    const [input, setInput]       = useState('');
    const [busy, setBusy]         = useState(false);
    const [provider, setProvider] = useState<Provider | null>(null);
    const [turns, setTurns]       = useState<Turn[]>([]);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Byte-length, not char-length: multi-byte UTF-8 (emoji, accented text,
    // Chinese schema dumps) fill the server buffer faster than String.length
    // would suggest.
    const inputBytes = typeof TextEncoder !== 'undefined'
        ? new TextEncoder().encode(input).length
        : input.length;
    const overLimit = inputBytes > INPUT_MAX_BYTES;

    useEffect(() => {
        fetch('/api/copilot/provider', { credentials: 'include' })
            .then(r => (r.ok ? r.json() : null))
            .then(setProvider)
            .catch(() => {});
    }, []);

    // A5: surface the configured retention TTL so the user knows old
    // turns are auto-purged. Fails open — banner just doesn't appear.
    const [retentionDays, setRetentionDays] = useState<number | null>(null);
    useEffect(() => {
        fetch('/api/copilot/retention', { credentials: 'include' })
            .then(r => (r.ok ? r.json() : null))
            .then(j => { if (j && typeof j.maxAgeDays === 'number') setRetentionDays(j.maxAgeDays); })
            .catch(() => {});
    }, []);

    async function clearHistory() {
        if (!confirm('Delete all your copilot history in this workspace? This cannot be undone.')) return;
        try {
            const headers: Record<string, string> = {};
            if (workspaceId) headers['x-workspace-id'] = String(workspaceId);
            const r = await fetch('/api/copilot/history', {
                method: 'DELETE', credentials: 'include', headers,
            });
            if (r.ok) setTurns([]);
        } catch { /* no-op */ }
    }

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [turns.length]);

    async function send() {
        const text = input.trim();
        if (!text || busy) return;
        if (overLimit) {
            setTurns(t => [...t, {
                id: String(Date.now() + 1),
                role: 'assistant',
                text: `Input is ${inputBytes.toLocaleString()} bytes — max ${INPUT_MAX_BYTES.toLocaleString()}. ` +
                      `Trim the prompt or paste a smaller plan.`,
            }]);
            return;
        }
        if (mode === 'sql' && !connectionId) {
            setTurns(t => [...t, {
                id: String(Date.now() + 1),
                role: 'assistant',
                text: 'Select a monitored database connection before using SQL mode — ' +
                      'the copilot needs live schema context from your database.',
            }]);
            return;
        }
        const userTurn: Turn = { id: String(Date.now()), role: 'user', text };
        setTurns(t => [...t, userTurn]);
        setInput('');
        setBusy(true);

        try {
            const headers: Record<string, string> = { 'content-type': 'application/json' };
            if (workspaceId) headers['x-workspace-id'] = String(workspaceId);

            let body: any;
            if (mode === 'sql')      body = { prompt: text, connectionId };
            else if (mode === 'explain') {
                try { body = { plan: JSON.parse(text) }; }
                catch { body = { plan: text }; }
            }
            else                      { try { body = { incident: JSON.parse(text) }; } catch { body = { incident: { raw: text } }; } }

            const url = `/api/copilot/${mode}`;
            const r = await fetch(url, {
                method: 'POST', credentials: 'include', headers,
                body: JSON.stringify(body),
            });
            const j = await r.json();
            const payload =
                mode === 'sql'     ? j.sql :
                mode === 'explain' ? j.review :
                                     j.rca;
            setTurns(t => [...t, {
                id: String(Date.now() + 1),
                role: 'assistant',
                text: payload || `(no response)`,
                guard: j.guard,
                meta: { provider: j.provider, model: j.model },
            }]);
        } catch (err: any) {
            setTurns(t => [...t, {
                id: String(Date.now() + 1),
                role: 'assistant',
                text: `Error: ${err.message || err}`,
            }]);
        } finally {
            setBusy(false);
        }
    }

    function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
    }

    return (
        <div className="copilot-panel" style={panel}>
            <header style={header}>
                <strong>FATHOM Copilot</strong>
                <div style={{ display: 'flex', gap: 8 }}>
                    {(['sql', 'explain', 'rca'] as Mode[]).map(m => (
                        <button
                            key={m}
                            onClick={() => setMode(m)}
                            style={mode === m ? modeOn : modeOff}
                        >{MODE_LABEL[m]}</button>
                    ))}
                </div>
                {provider && (
                    <span style={{ opacity: 0.6, fontSize: 11 }}>
                        {provider.provider}·{provider.model}
                    </span>
                )}
                {retentionDays && (
                    <span style={{ opacity: 0.5, fontSize: 11 }}>
                        auto-purged after {retentionDays}d
                    </span>
                )}
                <button
                    onClick={clearHistory}
                    title="Clear my copilot history in this workspace"
                    style={{
                        marginLeft: 'auto',
                        padding: '4px 10px',
                        background: '#fff',
                        color: THEME.textDim,
                        border: '1px solid #1a3878',
                        borderRadius: 6,
                        fontSize: 11,
                        cursor: 'pointer',
                    }}
                >Clear history</button>
            </header>

            <div style={transcript}>
                {turns.length === 0 && (
                    <div style={{ opacity: 0.6, padding: 24, textAlign: 'center' }}>
                        Ask a schema-aware question. ⌘/Ctrl-Enter to send.
                    </div>
                )}
                {turns.map(t => (
                    <div key={t.id} style={t.role === 'user' ? userBubble : botBubble}>
                        <pre style={pre}>{t.text}</pre>
                        {t.guard && (
                            <div style={{ fontSize: 11, marginTop: 4 }}>
                                {t.guard.safe
                                    ? <span style={{ color: THEME.success }}>✓ safe to run</span>
                                    : <span style={{ color: THEME.dangerDark }}>⚠ blocked: {t.guard.reason}</span>}
                            </div>
                        )}
                        {t.meta?.provider && (
                            <div style={{ fontSize: 10, opacity: 0.55, marginTop: 2 }}>
                                via {t.meta.provider}·{t.meta.model}
                            </div>
                        )}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            <footer style={footer}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <textarea
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={onKey}
                        placeholder={PLACEHOLDER[mode]}
                        style={{
                            ...textarea,
                            borderColor: overLimit ? THEME.dangerDark : THEME.surfaceRaised,
                        }}
                        rows={4}
                        disabled={busy}
                    />
                    <div style={{
                        fontSize: 11, textAlign: 'right',
                        color: overLimit ? THEME.dangerDark : THEME.textDim,
                    }}>
                        {inputBytes.toLocaleString()} / {INPUT_MAX_BYTES.toLocaleString()} bytes
                        {overLimit && ' — too long, trim before sending'}
                    </div>
                </div>
                <button onClick={send} disabled={busy || !input.trim() || overLimit} style={sendBtn}>
                    {busy ? 'Thinking…' : 'Send'}
                </button>
            </footer>
        </div>
    );
}

// ── inline styles so 
