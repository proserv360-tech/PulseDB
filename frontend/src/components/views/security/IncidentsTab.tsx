/**
 * IncidentsTab — the work-item view of alerting.
 *
 * An alert is a notification; an incident is the thing someone has to do
 * something about. This is the same table Slack renders, with the actions the
 * Slack buttons perform — so acknowledgement works whether or not Slack
 * interactivity is configured.
 *
 * Backed by routes/incidentRoutes.ts:
 *   GET  /api/incidents             list, with filters
 *   GET  /api/incidents/:id/audit   the trail
 *   POST /api/incidents/:id/acknowledge
 *   POST /api/incidents/:id/fix     pending | applied | verified | failed
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    AlertOctagon, AlertTriangle, Info, CheckCircle2, Clock, RefreshCw,
    User, Database, ChevronRight, Check, History, Search, Copy, Loader,
} from 'lucide-react';
import { THEME, useGlobalRefresh } from '../../../utils/theme';
import { fetchData, fetchDataFresh, postData } from '../../../utils/api';

/* ── Vocabulary ──────────────────────────────────────────────────────────── */

// Four levels, matching incidentService. Colour carries urgency; the label
// carries the meaning, because colour alone fails for ~8% of men.
const PRIORITY = {
    critical: { color: THEME.danger, bg: `${THEME.danger}18`, icon: AlertOctagon, label: 'Critical' },
    high: { color: THEME.warningDark || THEME.warning, bg: `${THEME.warning}18`, icon: AlertTriangle, label: 'High' },
    medium: { color: THEME.warning, bg: `${THEME.warning}10`, icon: AlertTriangle, label: 'Medium' },
    low: { color: THEME.primary, bg: `${THEME.primary}12`, icon: Info, label: 'Low' },
};

const FIX_STATUS = {
    pending: { label: 'Pending', color: THEME.textMuted },
    applied: { label: 'Applied', color: THEME.warning },
    verified: { label: 'Verified', color: THEME.success },
    failed: { label: 'Failed', color: THEME.danger },
};

/* ── SLA ─────────────────────────────────────────────────────────────────── */

/**
 * Relative, not absolute — "2h left" is the question people actually ask.
 * Mirrors formatSlaRemaining in alertFormatter so Slack and the UI never
 * disagree about how long is left.
 */
function slaRemaining(dueAt, { resolved = false } = {}) {
    if (!dueAt) return { text: '—', overdue: false, muted: true };
    if (resolved) return { text: 'met', overdue: false, muted: true };

    const ms = new Date(dueAt).getTime() - Date.now();
    const overdue = ms < 0;
    const mins = Math.round(Math.abs(ms) / 60000);

    let span;
    if (mins < 60) span = `${mins}m`;
    else if (mins < 1440) span = `${Math.floor(mins / 60)}h ${mins % 60}m`.replace(' 0m', '');
    else span = `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`.replace(' 0h', '');

    return { text: overdue ? `Overdue by ${span}` : `${span} left`, overdue, muted: false };
}

// `as const` on the literal unions (flexDirection, textAlign, textTransform,
// whiteSpace): without it TypeScript widens them to `string`, which is not
// assignable to CSSProperties.
const css = {
    page: { padding: 20, display: 'flex', flexDirection: 'column' as const, gap: 16 },
    panel: {
        background: THEME.surface, border: `1px solid ${THEME.glassBorder || 'rgba(147,180,235,0.14)'}`,
        borderRadius: 12, overflow: 'hidden',
    },
    row: { display: 'flex', alignItems: 'center', gap: 12 },
    input: {
        background: THEME.surfaceHover, border: `1px solid ${THEME.glassBorder || 'rgba(147,180,235,0.14)'}`,
        borderRadius: 8, padding: '7px 10px', color: THEME.textMain, fontSize: 13, outline: 'none',
    },
    th: {
        textAlign: 'left' as const, padding: '9px 12px', fontSize: 11, letterSpacing: '0.06em',
        textTransform: 'uppercase' as const, color: THEME.textMuted, fontWeight: 600,
        whiteSpace: 'nowrap' as const,
    },
    td: { padding: '11px 12px', fontSize: 13, color: THEME.textMain, verticalAlign: 'middle' },
    pill: (color, bg) => ({
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 999,
        background: bg, color, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }),
    btn: (primary) => ({
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 8,
        border: `1px solid ${primary ? THEME.primary : THEME.glassBorder || 'rgba(147,180,235,0.2)'}`,
        background: primary ? `${THEME.primary}1f` : 'transparent',
        color: primary ? THEME.primaryLight : THEME.textMuted,
        fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
    }),
    mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 },
};

/* ── Component ───────────────────────────────────────────────────────────── */

export default function IncidentsTab() {
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState(null);
    const [expanded, setExpanded] = useState(null);
    const [trail, setTrail] = useState({});
    const [toast, setToast] = useState('');

    const [filters, setFilters] = useState({ phase: 'active', priority: 'all', owner: 'all', search: '' });

    // Re-render on a timer so the SLA countdown stays honest. Cheap — it only
    // touches derived state, no network.
    const [, setTick] = useState(0);
    useEffect(() => {
        const iv = setInterval(() => setTick((t) => t + 1), 30_000);
        return () => clearInterval(iv);
    }, []);

    const load = useCallback(async (quiet = false) => {
        if (!quiet) setLoading(true);
        try {
            const params = new URLSearchParams({ limit: '200' });
            if (filters.phase !== 'all') params.set('phase', filters.phase);
            const data = await (quiet ? fetchDataFresh : fetchData)(`/api/incidents?${params}`);
            // The endpoint returns a bare array. Accept an envelope too — the
            // alerts endpoint disagrees with its own callers on exactly this,
            // and it silently showed mock data for months.
            const rows = Array.isArray(data) ? data : (data?.incidents ?? null);
            if (Array.isArray(rows)) {
                setIncidents(rows);
                setError('');
            } else {
                setError('Unexpected response from /api/incidents');
            }
        } catch (e) {
            setError(e?.message || 'Could not load incidents');
        } finally {
            setLoading(false);
        }
    }, [filters.phase]);

    useEffect(() => { load(false); }, [load]);
    useGlobalRefresh(() => load(true));

    const owners = useMemo(
        () => [...new Set(incidents.map((i) => i.owner).filter(Boolean))].sort(),
        [incidents],
    );

    const visible = useMemo(() => incidents.filter((i) => {
        if (filters.priority !== 'all' && i.priority !== filters.priority) return false;
        if (filters.owner === 'unassigned' && i.owner) return false;
        if (filters.owner !== 'all' && filters.owner !== 'unassigned' && i.owner !== filters.owner) return false;
        if (filters.search) {
            const hay = [i.id, i.database_name, i.schema_name, i.object_name, i.title]
                .filter(Boolean).join(' ').toLowerCase();
            if (!hay.includes(filters.search.toLowerCase())) return false;
        }
        return true;
    }), [incidents, filters]);

    const stats = useMemo(() => ({
        open: incidents.filter((i) => i.status_phase === 'active').length,
        unacked: incidents.filter((i) => i.status_phase === 'active' && !i.acknowledged_by).length,
        overdue: incidents.filter(
            (i) => i.status_phase === 'active' && i.resolution_due_at && new Date(i.resolution_due_at) < new Date(),
        ).length,
        critical: incidents.filter((i) => i.status_phase === 'active' && i.priority === 'critical').length,
    }), [incidents]);

    const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

    const acknowledge = async (id) => {
        setBusyId(id);
        try {
            const r = await postData(`/api/incidents/${id}/acknowledge`, {});
            // Someone else getting there first is a normal race, not a failure.
            flash(r.alreadyAcknowledged
                ? `${id} was already acknowledged by ${r.acknowledgedBy}`
                : `${id} acknowledged`);
            await load(true);
        } catch (e) {
            flash(`Could not acknowledge ${id}: ${e?.message || 'unknown error'}`);
        } finally {
            setBusyId(null);
        }
    };

    const setFix = async (id, fixStatus) => {
        setBusyId(id);
        try {
            await postData(`/api/incidents/${id}/fix`, { fixStatus });
            flash(fixStatus === 'verified' ? `${id} verified and resolved` : `${id} marked ${fixStatus}`);
            await load(true);
        } catch (e) {
            flash(`Could not update ${id}: ${e?.message || 'unknown error'}`);
        } finally {
            setBusyId(null);
        }
    };

    const toggleTrail = async (id) => {
        if (expanded === id) return setExpanded(null);
        setExpanded(id);
        if (!trail[id]) {
            try {
                const rows = await fetchDataFresh(`/api/incidents/${id}/audit`);
                setTrail((t) => ({ ...t, [id]: Array.isArray(rows) ? rows : [] }));
            } catch {
                setTrail((t) => ({ ...t, [id]: [] }));
            }
        }
    };

    return (
        <div style={css.page}>
            {/* ── Summary ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                {[
                    { label: 'Open', value: stats.open, color: THEME.textMain },
                    { label: 'Unacknowledged', value: stats.unacked, color: stats.unacked ? THEME.warning : THEME.textMuted },
                    { label: 'Past SLA', value: stats.overdue, color: stats.overdue ? THEME.danger : THEME.textMuted },
                    { label: 'Critical', value: stats.critical, color: stats.critical ? THEME.danger : THEME.textMuted },
                ].map((s) => (
                    <div key={s.label} style={{ ...css.panel, padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, color: THEME.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{s.label}</div>
                        <div style={{ fontSize: 24, fontWeight: 600, color: s.color, marginTop: 4 }}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* ── Controls ── */}
            <div style={{ ...css.row, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 220px' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: THEME.textDim }} />
                    <input
                        style={{ ...css.input, width: '100%', paddingLeft: 30 }}
                        placeholder="Incident, database, schema or object…"
                        value={filters.search}
                        onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                    />
                </div>
                <select style={css.input} value={filters.phase} onChange={(e) => setFilters((f) => ({ ...f, phase: e.target.value }))}>
                    <option value="active">Open</option>
                    <option value="done">Resolved</option>
                    <option value="all">All</option>
                </select>
                <select style={css.input} value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}>
                    <option value="all">Any priority</option>
                    {Object.keys(PRIORITY).map((p) => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
                </select>
                <select style={css.input} value={filters.owner} onChange={(e) => setFilters((f) => ({ ...f, owner: e.target.value }))}>
                    <option value="all">Any owner</option>
                    <option value="unassigned">Unassigned</option>
                    {owners.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <button style={css.btn(false)} onClick={() => load(true)}>
                    <RefreshCw size={13} /> Refresh
                </button>
            </div>

            {toast && (
                <div style={{ ...css.panel, padding: '10px 14px', borderColor: `${THEME.primary}55`, color: THEME.textMain, fontSize: 13 }}>
                    {toast}
                </div>
            )}
            {error && (
                <div style={{ ...css.panel, padding: '10px 14px', borderColor: `${THEME.danger}55`, color: THEME.danger, fontSize: 13 }}>
                    {error}
                </div>
            )}

            {/* ── Table ── */}
            <div style={css.panel}>
                {loading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: THEME.textMuted }}>
                        <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading incidents…
                    </div>
                ) : visible.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: THEME.textMuted, fontSize: 13 }}>
                        {incidents.length === 0
                            ? 'No incidents. They open automatically when an alert rule fires.'
                            : 'No incidents match these filters.'}
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${THEME.glassBorder || 'rgba(147,180,235,0.14)'}` }}>
                                    {['Incident', 'Object', 'Metric', 'Priority', 'Owner', 'Status', 'Ack', 'SLA', 'Fix', ''].map((h) => (
                                        <th key={h} style={css.th}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((i) => {
                                    const p = PRIORITY[i.priority] || PRIORITY.low;
                                    const PIcon = p.icon;
                                    const resolved = i.status_phase === 'done';
                                    const sla = slaRemaining(i.resolution_due_at, { resolved });
                                    const fix = FIX_STATUS[i.fix_status] || FIX_STATUS.pending;
                                    const isOpen = expanded === i.id;
                                    const busy = busyId === i.id;

                                    return (
                                        <React.Fragment key={i.id}>
                                            <tr style={{ borderBottom: `1px solid ${THEME.glassBorder || 'rgba(147,180,235,0.08)'}` }}>
                                                <td style={{ ...css.td, ...css.mono, whiteSpace: 'nowrap' }}>
                                                    {i.id}
                                                    {i.occurrences > 1 && (
                                                        <span style={{ color: THEME.textDim, marginLeft: 6, fontSize: 11 }}>×{i.occurrences}</span>
                                                    )}
                                                </td>
                                                <td style={css.td}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <Database size={13} style={{ color: THEME.textDim, flexShrink: 0 }} />
                                                        <span>{[i.schema_name, i.object_name].filter(Boolean).join('.') || i.database_name}</span>
                                                    </div>
                                                    <div style={{ fontSize: 11, color: THEME.textDim, marginLeft: 19 }}>{i.database_name}</div>
                                                </td>
                                                <td style={{ ...css.td, whiteSpace: 'nowrap' }}>
                                                    <span style={css.mono}>{i.metric_display ?? '—'}</span>
                                                    <div style={{ fontSize: 11, color: THEME.textDim }}>{i.metric_label}</div>
                                                </td>
                                                <td style={css.td}>
                                                    <span style={css.pill(p.color, p.bg)}><PIcon size={11} />{p.label}</span>
                                                </td>
                                                <td style={{ ...css.td, whiteSpace: 'nowrap' }}>
                                                    {i.owner || <span style={{ color: THEME.textDim }}>Unassigned</span>}
                                                </td>
                                                <td style={{ ...css.td, whiteSpace: 'nowrap', color: resolved ? THEME.success : THEME.textMain }}>
                                                    {i.status}
                                                </td>
                                                <td style={{ ...css.td, whiteSpace: 'nowrap' }}>
                                                    {i.acknowledged_by
                                                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: THEME.success }}>
                                                              <Check size={12} />{i.acknowledged_by}
                                                          </span>
                                                        : <span style={{ color: THEME.textDim }}>—</span>}
                                                </td>
                                                <td style={{ ...css.td, whiteSpace: 'nowrap', color: sla.overdue ? THEME.danger : sla.muted ? THEME.textDim : THEME.textMain }}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                        {!sla.muted && <Clock size={12} />}{sla.text}
                                                    </span>
                                                </td>
                                                <td style={{ ...css.td, whiteSpace: 'nowrap', color: fix.color }}>{fix.label}</td>
                                                <td style={{ ...css.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                    {!resolved && !i.acknowledged_by && (
                                                        <button style={css.btn(true)} disabled={busy} onClick={() => acknowledge(i.id)}>
                                                            {busy ? <Loader size={12} /> : <Check size={12} />} Acknowledge
                                                        </button>
                                                    )}
                                                    {!resolved && i.acknowledged_by && i.fix_status === 'pending' && (
                                                        <button style={css.btn(false)} disabled={busy} onClick={() => setFix(i.id, 'applied')}>
                                                            Mark applied
                                                        </button>
                                                    )}
                                                    {!resolved && i.fix_status === 'applied' && (
                                                        <button style={css.btn(false)} disabled={busy} onClick={() => setFix(i.id, 'verified')}>
                                                            Verify
                                                        </button>
                                                    )}
                                                    <button
                                                        style={{ ...css.btn(false), marginLeft: 6 }}
                                                        onClick={() => toggleTrail(i.id)}
                                                        title="History and suggested fix"
                                                    >
                                                        <History size={12} />
                                                        <ChevronRight size={12} style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
                                                    </button>
                                                </td>
                                            </tr>

                                            {isOpen && (
                                                <tr>
                                                    <td colSpan={10} style={{ ...css.td, background: THEME.surfaceHover, padding: 16 }}>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                                                            <div>
                                                                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: THEME.textMuted, marginBottom: 8 }}>
                                                                    Suggested fix
                                                                </div>
                                                                <div style={{ fontSize: 13, marginBottom: 8 }}>{i.fix_suggestion || '—'}</div>
                                                                {i.fix_sql && (
                                                                    <div style={{ position: 'relative' }}>
                                                                        <pre style={{ ...css.mono, background: THEME.bg, padding: 10, borderRadius: 8, overflowX: 'auto', margin: 0, color: THEME.textMain }}>
                                                                            {i.fix_sql}
                                                                        </pre>
                                                                        {/* Copy, never run. VACUUM FULL takes an ACCESS
                                                                            EXCLUSIVE lock — that is a decision a person
                                                                            makes, not a button. */}
                                                                        <button
                                                                            style={{ ...css.btn(false), position: 'absolute', top: 6, right: 6, padding: '3px 7px' }}
                                                                            onClick={() => { navigator.clipboard?.writeText(i.fix_sql); flash('SQL copied'); }}
                                                                        >
                                                                            <Copy size={11} /> Copy
                                                                        </button>
                                                                    </div>
                                                                )}
                                                                {i.ai_analysis && (
                                                                    <div style={{ marginTop: 12, fontSize: 12, color: THEME.textMuted, lineHeight: 1.5 }}>
                                                                        {i.ai_analysis}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div>
                                                                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: THEME.textMuted, marginBottom: 8 }}>
                                                                    Audit trail
                                                                </div>
                                                                {(trail[i.id] || []).length === 0 ? (
                                                                    <div style={{ fontSize: 12, color: THEME.textDim }}>
                                                                        {trail[i.id] ? 'No entries.' : 'Loading…'}
                                                                    </div>
                                                                ) : (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                                                        {trail[i.id].map((t) => (
                                                                            <div key={t.id} style={{ fontSize: 12, display: 'flex', gap: 8 }}>
                                                                                <span style={{ ...css.mono, color: THEME.textDim, flexShrink: 0 }}>
                                                                                    {new Date(t.at).toLocaleString()}
                                                                                </span>
                                                                                <span style={{ color: THEME.primaryLight, flexShrink: 0 }}>{t.action}</span>
                                                                                <span style={{ color: THEME.textMuted }}>
                                                                                    <User size={10} style={{ verticalAlign: -1 }} /> {t.actor}
                                                                                    {t.note ? ` — ${t.note}` : ''}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
