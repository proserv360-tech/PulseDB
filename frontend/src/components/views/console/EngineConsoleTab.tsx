// ==========================================================================
//  EngineConsoleTab.tsx
//
//  Unified command console for engines that don't fit the T-SQL model:
//  Redis (space-separated commands), Cassandra (CQL), DynamoDB (PartiQL),
//  plus optional coverage for MSSQL / Oracle / Snowflake / BigQuery / Redshift
//  when their own tab isn't available.
//
//  Adapts to the active connection's dbType:
//    • Prompt label ("redis>", "cqlsh>", "partiql>", …)
//    • Example queries shown as clickable chips
//    • Syntax hint and docs link
//  Sends every command via POST /api/engine-console (audit-logged server-side).
//  Shows results in a sortable table with JSON fallback for complex values.
// ==========================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { useConnection } from '../../../context/ConnectionContext';
import { postData, fetchData } from '../../../utils/api';
import {
    Terminal, Play, Clock, AlertCircle, CheckCircle, BookOpen,
    Copy, ChevronDown, ChevronRight, History,
} from 'lucide-react';

type HelpPayload = {
    prompt: string;
    docs_url: string;
    syntax: string;
    examples: string[];
};

type Result =
    | { ok: true; rows: any[]; columns: string[]; meta: Record<string, any>; elapsed_ms: number }
    | { ok: false; error: string; elapsed_ms: number };

const PROMPT_COLORS: Record<string, string> = {
    redis:         '#DC382D',
    cassandra:     '#1287B1',
    dynamodb:      '#4053D6',
    mssql:         '#CC2927',
    oracle:        '#F80000',
    snowflake:     '#29B5E8',
    bigquery:      THEME.primary,
    redshift:      '#FF9900',
};

const HISTORY_LIMIT = 40;
const HISTORY_KEY = 'fathom_console_history';

export default function EngineConsoleTab() {
    useAdaptiveTheme();
    const { activeConnection } = useConnection();
    const connId = activeConnection?.id;
    const dbType = (activeConnection?.dbType || 'postgresql').toLowerCase();
    const accent = PROMPT_COLORS[dbType] || THEME.primary;

    const [help, setHelp] = useState<HelpPayload | null>(null);
    const [command, setCommand] = useState('');
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<Result | null>(null);
    const [history, setHistory] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
        catch { return []; }
    });
    const [showHistory, setShowHistory] = useState(false);

    // Load engine help when dbType changes.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const h = await fetchData(`/api/engine-console/help?dbType=${encodeURIComponent(dbType)}`);
                if (!cancelled) setHelp(h);
            } catch {
                if (!cancelled) setHelp(null);
            }
        })();
        return () => { cancelled = true; };
    }, [dbType]);

    const saveHistory = useCallback((cmd: string) => {
        setHistory(prev => {
            const next = [cmd, ...prev.filter(x => x !== cmd)].slice(0, HISTORY_LIMIT);
            try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
            return next;
        });
    }, []);

    const run = useCallback(async () => {
        if (!command.trim()) return;
        if (!connId) {
            setResult({ ok: false, error: 'No active connection', elapsed_ms: 0 });
            return;
        }
        setRunning(true);
        const started = Date.now();
        try {
            const r = await postData('/api/engine-console', { connectionId: connId, command });
            setResult({ ok: true, ...r });
            saveHistory(command.trim());
        } catch (err: any) {
            setResult({
                ok: false,
                error: err?.message || String(err),
                elapsed_ms: Date.now() - started,
            });
        } finally {
            setRunning(false);
        }
    }, [command, connId, saveHistory]);

    const onKeyDown = (e: React.KeyboardEvent) => {
        // Cmd/Ctrl+Enter runs the command.
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            run();
        }
    };

    const promptLabel = help?.prompt || `${dbType}>`;

    return (
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, minHeight: '100vh',
                      background: THEME.bg, color: THEME.textMain }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Terminal size={22} style={{ color: accent }} />
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                    Engine Console <span style={{ color: accent }}>— {activeConnection?.name || dbType}</span>
                </h2>
                <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                               background: `${accent}20`, color: accent, textTransform: 'uppercase' }}>
                    {dbType}
                </span>
                {help?.docs_url && (
                    <a href={help.docs_url} target="_blank" rel="noreferrer"
                       style={{ fontSize: 12, color: accent, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <BookOpen size={12} /> docs
                    </a>
                )}
            </div>

            {/* Syntax hint */}
            {help?.syntax && (
                <div style={{ padding: 12, borderRadius: 8,
                              background: `${accent}10`, borderLeft: `3px solid ${accent}`,
                              fontSize: 13 }}>
                    <strong style={{ color: accent }}>Syntax:</strong> {help.syntax}
                </div>
            )}

            {/* Example chips */}
            {help?.examples && help.examples.length > 0 && (
                <div>
                    <div style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Examples
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {help.examples.map((ex, i) => (
                            <button key={i} onClick={() => setCommand(ex)}
                                    style={{
                                        padding: '4px 10px', fontSize: 11, fontFamily: 'monospace',
                                        borderRadius: 4, cursor: 'pointer',
                                        border: `1px solid ${accent}40`,
                                        background: 'transparent', color: accent,
                                    }}
                                    title="Click to paste">{ex}</button>
                        ))}
                    </div>
                </div>
            )}

            {/* Editor */}
            <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                              background: THEME.bg, color: accent,
                              borderRadius: '8px 8px 0 0', fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>
                    {promptLabel}
                </div>
                <textarea value={command} onChange={e => setCommand(e.target.value)} onKeyDown={onKeyDown}
                          placeholder={`Type a ${dbType} command and press Cmd/Ctrl+Enter to run`}
                          spellCheck={false}
                          style={{
                              width: '100%', minHeight: 140, padding: 12, fontFamily: 'monospace', fontSize: 13,
                              background: THEME.bg, color: THEME.primaryLight, border: 'none',
                              borderRadius: '0 0 8px 8px', resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                          }} />
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={run} disabled={running || !command.trim()}
                        style={{
                            padding: '8px 16px', background: accent, color: '#fff',
                            border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6,
                            opacity: running || !command.trim() ? 0.55 : 1,
                        }}>
                    <Play size={14} /> {running ? 'Running…' : 'Run (Ctrl/Cmd + ⏎)'}
                </button>
                <button onClick={() => setShowHistory(!showHistory)}
                        style={{
                            padding: '8px 12px', background: 'transparent', color: THEME.textMain,
                            border: `1px solid ${THEME.glassBorder}`, borderRadius: 6, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                        }}>
                    <History size={14} /> History ({history.length})
                    {showHistory ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
                {result?.ok === true && (
                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: THEME.success }}>
                        <CheckCircle size={14} /> {result.meta?.row_count ?? result.rows.length} rows in {result.elapsed_ms} ms
                    </span>
                )}
                {result?.ok === false && (
                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: THEME.danger }}>
                        <AlertCircle size={14} /> failed in {result.elapsed_ms} ms
                    </span>
                )}
            </div>

            {/* History drawer */}
            {showHistory && history.length > 0 && (
                <div style={{ padding: 8, background: THEME.surface, borderRadius: 6,
                              border: `1px solid ${THEME.glassBorder}`, maxHeight: 220, overflowY: 'auto' }}>
                    {history.map((h, i) => (
                        <div key={i} onClick={() => { setCommand(h); setShowHistory(false); }}
                             style={{ padding: '6px 8px', fontSize: 12, fontFamily: 'monospace',
                                      borderRadius: 4, cursor: 'pointer' }}
                             onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = `${accent}12`; }}
                             onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}>
                            {h}
                        </div>
                    ))}
                </div>
            )}

            {/* Result */}
            {result && <ResultView result={result} accent={accent} />}

            {/* Connection required banner */}
            {!connId && (
                <div style={{ padding: 16, textAlign: 'center', color: THEME.textMuted, fontStyle: 'italic' }}>
                    Select an active connection to use the console.
                </div>
            )}
        </div>
    );
}

function ResultView({ result, accent }: { result: Result; accent: string }) {
    if (!result.ok) {
        return (
            <div style={{ padding: 12, background: THEME.dangerLight, color: THEME.dangerDark, borderRadius: 6,
                          fontSize: 13, fontFamily: 'monospace', border: '1px solid #fda4af' }}>
                <strong>Error: </strong>{result.error}
            </div>
        );
    }
    if (!result.rows || result.rows.length === 0) {
        return (
            <div style={{ padding: 16, textAlign: 'center', color: THEME.textMuted, fontStyle: 'italic',
                          background: THEME.surface, borderRadius: 6, border: `1px solid ${THEME.glassBorder}` }}>
                Command succeeded — no rows returned.
            </div>
        );
    }

    const { rows, columns } = result;
    const copyJson = () => {
        try { navigator.clipboard.writeText(JSON.stringify(rows, null, 2)); } catch { /* ignore */ }
    };

    return (
        <div style={{ background: THEME.surface, borderRadius: 6, border: `1px solid ${THEME.glassBorder}`, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px',
                          background: `${accent}08`, fontSize: 11, color: THEME.textMuted, fontWeight: 600 }}>
                {rows.length} row{rows.length === 1 ? '' : 's'} · {columns.length} column{columns.length === 1 ? '' : 's'}
                <button onClick={copyJson}
                        style={{ marginLeft: 'auto', padding: '4px 8px', fontSize: 11, borderRadius: 4,
                                 border: `1px solid ${THEME.glassBorder}`, background: 'transparent',
                                 color: THEME.textMain, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Copy size={12} /> Copy JSON
                </button>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 480 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                        <tr>
                            {columns.map(c => (
                                <th key={c} style={{
                                    position: 'sticky', top: 0,
                                    padding: '8px 10px', textAlign: 'left',
                                    background: THEME.surface, borderBottom: `2px solid ${accent}`,
                                    fontWeight: 700, zIndex: 1,
                                }}>{c}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i} style={{ borderBottom: `1px solid ${THEME.glassBorder}` }}>
                                {columns.map(c => (
                                    <td key={c} style={{ padding: '6px 10px', fontFamily: 'monospace',
                                                         maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                        title={renderValue(row[c])}>
                                        {renderValue(row[c])}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function renderValue(v: any): string {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    try { return JSON.stringify(v); } catch { return String(v); }
}
