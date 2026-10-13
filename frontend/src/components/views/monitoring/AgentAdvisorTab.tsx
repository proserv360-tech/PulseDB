/**
 * components/views/monitoring/AgentAdvisorTab.tsx
 * ───────────────────────────────────────────────
 * Surfaces the autonomous-agent backend (June 2026 gap sprint):
 *   • Findings      — anomaly findings with ack/resolve and manual sweep
 *   • Query Advisor — plan anti-pattern recommendations + rewrite benchmark
 *   • Schema Drift  — change timeline with on-demand capture
 *   • What-if Index — hypothetical index evaluation (HypoPG-aware)
 */
import { useMemo, useState } from 'react';
import {
    Bot,
    RefreshCcw,
    Check,
    X,
    Sparkles,
    GitCompareArrows,
    Layers,
    Play,
    AlertTriangle,
    Info,
    Flame,
    Clock,
} from 'lucide-react';
import { THEME } from '../../../utils/theme';
import { useApiQuery, useApiMutation } from '../../../hooks/useApi';
import { postData } from '../../../utils/api';
import { asArray, asText } from '../../../utils/shape';

const S = {
    page: { padding: 20, display: 'flex', flexDirection: 'column' as const, gap: 16 },
    card: {
        background: THEME.surface,
        border: `1px solid ${THEME.glassBorder}`,
        borderRadius: 12,
        padding: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    },
    h: { fontSize: 14, fontWeight: 700, color: THEME.textMain, display: 'flex', alignItems: 'center', gap: 8 },
    sub: { fontSize: 11, color: THEME.textMuted },
    row: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 4px',
        borderBottom: `1px solid ${THEME.glassBorder}`,
    },
    btn: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 12px',
        borderRadius: 8,
        border: `1px solid ${THEME.glassBorder}`,
        background: 'transparent',
        color: THEME.textMain,
        fontSize: 12,
        cursor: 'pointer',
    },
    btnPrimary: { background: THEME.primary, color: '#fff', border: 'none' },
    pill: (c: string) => ({
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 999,
        background: `${c}18`,
        color: c,
        border: `1px solid ${c}30`,
        textTransform: 'uppercase' as const,
    }),
    input: {
        width: '100%',
        minHeight: 70,
        padding: 10,
        borderRadius: 8,
        fontFamily: 'monospace',
        fontSize: 12,
        border: `1px solid ${THEME.glassBorder}`,
        background: 'transparent',
        color: THEME.textMain,
    },
    tabs: { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
    tabBtn: (active: boolean) => ({
        ...{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
        border: `1px solid ${active ? THEME.primary : THEME.glassBorder}`,
        background: active ? `${THEME.primary}14` : 'transparent',
        color: active ? THEME.primary : THEME.textMuted,
    }),
};

const sevIcon = (sev: string) =>
    sev === 'critical' ? (
        <Flame size={14} color={THEME.danger} />
    ) : sev === 'warning' ? (
        <AlertTriangle size={14} color={THEME.warning} />
    ) : (
        <Info size={14} color={THEME.info} />
    );
const sevColor = (sev: string) => (sev === 'critical' ? THEME.danger : sev === 'warning' ? THEME.warning : THEME.info);

/* ── Findings ─────────────────────────────────────────────────────────── */
function FindingsSection() {
    const [status, setStatus] = useState('open');
    const { data, isLoading, refetch } = useApiQuery<{ findings: any[] }>(`/api/agent/findings?status=${status}`, {
        refetchInterval: 30_000,
    });
    const setFindingStatus = useApiMutation('POST', (v: any) => `/api/agent/findings/${v.id}/status`, {
        invalidates: ['/api/agent/findings'],
    });
    const [sweeping, setSweeping] = useState(false);
    const sweep = async () => {
        setSweeping(true);
        try {
            await postData('/api/agent/sweep');
            await refetch();
        } finally {
            setSweeping(false);
        }
    };
    const findings = asArray<any>(data?.findings);

    return (
        <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                    <div style={S.h}>
                        <Bot size={15} /> Agent Findings
                    </div>
                    <div style={S.sub}>Anomalies the autonomous agent detected, diagnosed, and proposed fixes for</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        style={{ ...S.btn, paddingRight: 8 }}
                    >
                        <option value="open">Open</option>
                        <option value="acked">Acked</option>
                        <option value="resolved">Resolved</option>
                    </select>
                    <button style={{ ...S.btn, ...S.btnPrimary }} onClick={sweep} disabled={sweeping}>
                        <RefreshCcw size={13} /> {sweeping ? 'Sweeping…' : 'Run sweep'}
                    </button>
                </div>
            </div>
            {isLoading && <div style={S.sub}>Loading findings…</div>}
            {!isLoading && findings.length === 0 && (
                <div style={{ ...S.sub, padding: '18px 0' }}>
                    No {status} findings. The agent sweeps automatically on every monitoring cycle.
                </div>
            )}
            {findings.map((f) => (
                <div key={f.id} style={S.row}>
                    <div style={{ marginTop: 2 }}>{sevIcon(f.severity)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: THEME.textMain }}>
                                {asText(f.title)}
                            </span>
                            <span style={S.pill(sevColor(f.severity))}>{f.severity}</span>
                        </div>
                        <div style={{ ...S.sub, marginTop: 3 }}>{asText(f.summary)}</div>
                        {f.proposal && (
                            <div
                                style={{
                                    fontSize: 11,
                                    color: THEME.textMain,
                                    marginTop: 6,
                                    padding: '6px 10px',
                                    background: `${THEME.primary}0a`,
                                    borderRadius: 6,
                                }}
                            >
                                <Sparkles size={11} style={{ marginRight: 4, verticalAlign: -1 }} />
                                {asText(f.proposal)}
                            </div>
                        )}
                        <div style={{ ...S.sub, marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
                            <Clock size={10} /> {new Date(f.detected_at).toLocaleString()}
                        </div>
                    </div>
                    {status === 'open' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button
                                style={S.btn}
                                title="Acknowledge"
                                onClick={() => setFindingStatus.mutate({ id: f.id, status: 'acked' })}
                            >
                                <Check size={12} /> Ack
                            </button>
                            <button
                                style={S.btn}
                                title="Resolve"
                                onClick={() => setFindingStatus.mutate({ id: f.id, status: 'resolved' })}
                            >
                                <X size={12} /> Resolve
                            </button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

/* ── Query Advisor ─────────────────────────────────────────────────────── */
function AdvisorSection() {
    const { data, isLoading, refetch } = useApiQuery<{ recommendations: any[] }>(
        '/api/query-advisor/recommendations?status=open',
    );
    const setRec = useApiMutation('POST', (v: any) => `/api/query-advisor/recommendations/${v.id}/status`, {
        invalidates: ['/api/query-advisor'],
    });
    const [sweeping, setSweeping] = useState(false);
    const recs = asArray<any>(data?.recommendations);
    const sweep = async () => {
        setSweeping(true);
        try {
            await postData('/api/query-advisor/sweep');
            await refetch();
        } finally {
            setSweeping(false);
        }
    };

    return (
        <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                    <div style={S.h}>
                        <Sparkles size={15} /> Query Advisor
                    </div>
                    <div style={S.sub}>
                        Anti-patterns detected in captured EXPLAIN plans, ranked by severity and frequency
                    </div>
                </div>
                <button style={{ ...S.btn, ...S.btnPrimary }} onClick={sweep} disabled={sweeping}>
                    <RefreshCcw size={13} /> {sweeping ? 'Analyzing…' : 'Analyze recent plans'}
                </button>
            </div>
            {isLoading && <div style={S.sub}>Loading recommendations…</div>}
            {!isLoading && recs.length === 0 && (
                <div style={{ ...S.sub, padding: '18px 0' }}>
                    No open recommendations. Plans arrive via auto_explain ingest or the collector.
                </div>
            )}
            {recs.map((r) => (
                <div key={r.id} style={S.row}>
                    <div style={{ marginTop: 2 }}>{sevIcon(r.severity)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={S.pill(sevColor(r.severity))}>{r.severity}</span>
                            <span style={S.sub}>seen {r.occurrences}×</span>
                        </div>
                        <pre
                            style={{
                                fontSize: 11,
                                fontFamily: 'monospace',
                                color: THEME.textMain,
                                margin: '6px 0',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                maxHeight: 64,
                                overflow: 'hidden',
                            }}
                        >
                            {asText(r.statement).slice(0, 300)}
                        </pre>
                        {asArray<any>(r.issues).map((iss, i) => (
                            <div
                                key={i}
                                style={{
                                    fontSize: 11,
                                    marginTop: 4,
                                    padding: '6px 10px',
                                    background: `${sevColor(iss.severity)}0d`,
                                    borderRadius: 6,
                                    color: THEME.textMain,
                                }}
                            >
                                <strong>{asText(iss.title)}</strong> — {asText(iss.suggestion)}
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button style={S.btn} onClick={() => setRec.mutate({ id: r.id, status: 'applied' })}>
                            <Check size={12} /> Applied
                        </button>
                        <button style={S.btn} onClick={() => setRec.mutate({ id: r.id, status: 'dismissed' })}>
                            <X size={12} /> Dismiss
                        </button>
                    </div>
                </div>
            ))}
            <BenchmarkPanel />
        </div>
    );
}

function BenchmarkPanel() {
    const [original, setOriginal] = useState('');
    const [rewrite, setRewrite] = useState('');
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const run = async () => {
        setBusy(true);
        setError(null);
        setResult(null);
        try {
            setResult(await postData('/api/query-advisor/benchmark', { original, rewrite }));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };
    return (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px dashed ${THEME.glassBorder}` }}>
            <div style={{ ...S.h, fontSize: 12 }}>
                <GitCompareArrows size={13} /> Benchmark a rewrite (read-only, rolled back)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                <textarea
                    style={S.input}
                    placeholder="Original SELECT…"
                    value={original}
                    onChange={(e) => setOriginal(e.target.value)}
                />
                <textarea
                    style={S.input}
                    placeholder="Proposed rewrite…"
                    value={rewrite}
                    onChange={(e) => setRewrite(e.target.value)}
                />
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                <button style={{ ...S.btn, ...S.btnPrimary }} disabled={busy || !original || !rewrite} onClick={run}>
                    <Play size={12} /> {busy ? 'Comparing…' : 'Compare plans'}
                </button>
                {error && <span style={{ fontSize: 11, color: THEME.danger }}>{error}</span>}
                {result && (
                    <span style={{ fontSize: 12, color: result.improvement > 0 ? THEME.success : THEME.warning }}>
                        {result.improvement > 0 ? '▼' : '▲'} {Math.abs(result.improvement)}% by {result.basis}
                    </span>
                )}
            </div>
        </div>
    );
}

/* ── Schema Drift ──────────────────────────────────────────────────────── */
function DriftSection() {
    const { data, isLoading, refetch } = useApiQuery<{ changes: any[] }>('/api/schema/track/timeline');
    const [capturing, setCapturing] = useState(false);
    const [captureMsg, setCaptureMsg] = useState<string | null>(null);
    const changes = asArray<any>(data?.changes);
    const capture = async () => {
        setCapturing(true);
        setCaptureMsg(null);
        try {
            const r: any = await postData('/api/schema/track/capture');
            setCaptureMsg(
                r.changed
                    ? r.initial
                        ? 'Baseline snapshot stored.'
                        : `${r.changes.length} change(s) recorded.`
                    : 'No changes since last snapshot.',
            );
            await refetch();
        } catch (e: any) {
            setCaptureMsg(e.message);
        } finally {
            setCapturing(false);
        }
    };
    const chColor = (t: string) => (t === 'added' ? THEME.success : t === 'removed' ? THEME.danger : THEME.warning);

    return (
        <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                    <div style={S.h}>
                        <GitCompareArrows size={15} /> Schema Drift Timeline
                    </div>
                    <div style={S.sub}>
                        Structural changes between snapshots — correlate with performance regressions
                    </div>
                </div>
                <button style={{ ...S.btn, ...S.btnPrimary }} onClick={capture} disabled={capturing}>
                    <RefreshCcw size={13} /> {capturing ? 'Capturing…' : 'Capture snapshot'}
                </button>
            </div>
            {captureMsg && <div style={{ ...S.sub, marginBottom: 6 }}>{captureMsg}</div>}
            {isLoading && <div style={S.sub}>Loading timeline…</div>}
            {!isLoading && changes.length === 0 && (
                <div style={{ ...S.sub, padding: '18px 0' }}>
                    No drift recorded yet — capture a baseline snapshot to start tracking.
                </div>
            )}
            {changes.map((c) => (
                <div key={c.id} style={S.row}>
                    <span style={S.pill(chColor(c.change_type))}>{c.change_type}</span>
                    <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 12.5, fontFamily: 'monospace', color: THEME.textMain }}>
                            {c.object_type}: {asText(c.object_name)}
                        </span>
                        <div style={{ ...S.sub, marginTop: 2 }}>{new Date(c.detected_at).toLocaleString()}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ── What-if Index ─────────────────────────────────────────────────────── */
function WhatIfSection() {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const run = async () => {
        setBusy(true);
        setError(null);
        setResult(null);
        try {
            setResult(await postData('/api/advisor/what-if', { query }));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };
    const results = asArray<any>(result?.results);

    return (
        <div style={S.card}>
            <div style={S.h}>
                <Layers size={15} /> What-if Index Analysis
            </div>
            <div style={{ ...S.sub, marginBottom: 8 }}>
                Paste a SELECT — candidate indexes are evaluated against the real planner
                {result && !result.hypopg && ' (install the hypopg extension for verified cost estimates)'}
            </div>
            <textarea
                style={S.input}
                placeholder="SELECT * FROM orders o WHERE o.status = 'pending' AND o.created_at > now() - interval '1 day'"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                <button style={{ ...S.btn, ...S.btnPrimary }} disabled={busy || !query} onClick={run}>
                    <Play size={12} /> {busy ? 'Evaluating…' : 'Evaluate candidates'}
                </button>
                {error && <span style={{ fontSize: 11, color: THEME.danger }}>{error}</span>}
                {result && (
                    <span style={S.sub}>
                        baseline cost {result.baselineCost ?? '—'} · hypopg {result.hypopg ? 'on' : 'off'}
                    </span>
                )}
            </div>
            {results.map((r, i) => (
                <div key={i} style={S.row}>
                    <div style={{ flex: 1 }}>
                        <code style={{ fontSize: 11.5, color: THEME.textMain, wordBreak: 'break-all' }}>{r.ddl}</code>
                        <div style={{ ...S.sub, marginTop: 3 }}>
                            {r.verified ? (
                                <span style={{ color: THEME.success }}>
                                    verified · cost {r.costAfter} ({r.improvement}% better)
                                </span>
                            ) : (
                                <span style={{ color: THEME.warning }}>unverified candidate</span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ── Tab shell ─────────────────────────────────────────────────────────── */
export default function AgentAdvisorTab() {
    const sections = useMemo(
        () => [
            { id: 'findings', label: 'Findings', el: <FindingsSection /> },
            { id: 'advisor', label: 'Query Advisor', el: <AdvisorSection /> },
            { id: 'drift', label: 'Schema Drift', el: <DriftSection /> },
            { id: 'whatif', label: 'What-if Indexes', el: <WhatIfSection /> },
        ],
        [],
    );
    const [active, setActive] = useState('findings');
    return (
        <div style={S.page}>
            <div style={S.tabs}>
                {sections.map((s) => (
                    <button key={s.id} style={S.tabBtn(active === s.id)} onClick={() => setActive(s.id)}>
                        {s.label}
                    </button>
                ))}
            </div>
            {sections.find((s) => s.id === active)?.el}
        </div>
    );
}
