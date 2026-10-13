/**
 * WaitEventsPanel.tsx
 * ───────────────────
 * Engine-agnostic wait-event view. Calls GET /api/connections/:id/wait-events
 * and renders sorted bars, colour-coded by wait category, with per-event
 * descriptions and expandable waiting-session detail (Postgres). When the
 * engine doesn't support wait events the backend returns { supported: false,
 * note }, surfaced as an info state. Auto-refresh polls every POLL_MS.
 *
 * Drop-in: <WaitEventsPanel connectionId={conn.id} />
 */
import { useEffect, useState } from 'react';
import { fetchDataFresh } from '../../../utils/api';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { Activity, AlertTriangle, Info, RefreshCw, ChevronRight, ChevronDown } from 'lucide-react';

const POLL_MS = 10_000;

export type WaitSession = {
    pid?: number;
    state?: string | null;
    user?: string | null;
    application?: string | null;
    query?: string | null;
    waitSeconds?: number;
};
export type WaitEvent = {
    event: string;
    ms?: number;
    waiters?: number;
    type?: string;
    waitEvent?: string;
    sessions?: WaitSession[];
};
export type WaitEventsResponse = {
    supported: boolean;
    engine: string;
    window: string | null;
    events: WaitEvent[];
    note?: string;
};

/** Pure: compute the bar rows (label, value, pct of max) for rendering. */
export function toBars(
    events: WaitEvent[],
): Array<{ event: string; value: number; unit: 'ms' | 'waiters' | ''; pct: number }> {
    const rows = (events || []).map((e) => {
        const hasMs = typeof e.ms === 'number';
        const value = hasMs ? Number(e.ms) : typeof e.waiters === 'number' ? Number(e.waiters) : 0;
        const unit: 'ms' | 'waiters' | '' = hasMs ? 'ms' : typeof e.waiters === 'number' ? 'waiters' : '';
        return { event: e.event, value, unit };
    });
    const max = rows.reduce((m, r) => Math.max(m, r.value), 0);
    return rows.map((r) => ({ ...r, pct: max > 0 ? Math.round((r.value / max) * 100) : 0 }));
}

// Wait-event category → colour + one-line meaning (Postgres wait_event_type).
const CATEGORY: Record<string, { color: string; label: string; desc: string }> = {
    Lock: {
        color: THEME.danger,
        label: 'Lock',
        desc: 'Waiting to acquire a heavyweight lock — possible contention between sessions.',
    },
    LWLock: {
        color: THEME.warningDark,
        label: 'LWLock',
        desc: 'Waiting on a lightweight lock guarding a shared-memory structure.',
    },
    BufferPin: { color: THEME.warningDark, label: 'BufferPin', desc: 'Waiting to access a buffer pinned by another backend.' },
    IO: { color: THEME.warning, label: 'I/O', desc: 'Waiting for disk I/O (reading or writing data / WAL).' },
    IPC: { color: THEME.warning, label: 'IPC', desc: 'Waiting to coordinate with another server process.' },
    Timeout: {
        color: THEME.ai,
        label: 'Timeout',
        desc: 'Waiting on a deliberate timed delay (e.g. vacuum cost delay).',
    },
    Client: {
        color: THEME.primary,
        label: 'Client',
        desc: 'Waiting on the client connection — usually an idle session (benign).',
    },
    Activity: {
        color: THEME.textDim,
        label: 'Activity',
        desc: 'A background process idling between work cycles (benign).',
    },
    Extension: { color: THEME.textMuted, label: 'Extension', desc: 'Waiting inside a loaded extension.' },
};

// More specific descriptions for well-known events (override the category text).
const EVENT_DESC: Record<string, string> = {
    ClientRead: 'Reading the next query/data from the client socket (idle connection).',
    ClientWrite: 'Writing query results back to the client.',
    DataFileRead: 'Reading a table/index page from disk.',
    DataFileWrite: 'Writing a dirty page to disk.',
    WALWrite: 'Writing WAL records to disk.',
    WALSync: 'Flushing WAL to durable storage (fsync).',
    VacuumDelay: 'Autovacuum is throttling itself via cost delay (intentional pacing).',
    BgWriterMain: 'Background writer idling until it next flushes buffers.',
    BgWriterHibernate: 'Background writer hibernating (no dirty buffers to flush).',
    CheckpointerMain: 'Checkpointer idling until the next checkpoint.',
    WalWriterMain: 'WAL writer idling until more WAL needs flushing.',
    AutovacuumMain: 'Autovacuum launcher idling until the next worker is due.',
    ArchiverMain: 'WAL archiver idling until the next segment is ready.',
    LogicalLauncherMain: 'Logical-replication launcher idling.',
};

function catFor(type?: string) {
    return (type && CATEGORY[type]) || { color: THEME.primary, label: type || 'Other', desc: '' };
}
function descFor(e: WaitEvent) {
    return (e.waitEvent && EVENT_DESC[e.waitEvent]) || catFor(e.type).desc;
}
function fmtDur(s?: number) {
    const n = Number(s) || 0;
    if (n >= 86400) return `${Math.floor(n / 86400)}d`;
    if (n >= 3600) return `${Math.floor(n / 3600)}h`;
    if (n >= 60) return `${Math.floor(n / 60)}m`;
    return `${n}s`;
}

export default function WaitEventsPanel({ connectionId }: { connectionId: number | string }) {
    useAdaptiveTheme();
    const [data, setData] = useState<WaitEventsResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [auto, setAuto] = useState(false);
    const [open, setOpen] = useState<Record<string, boolean>>({});

    async function load(silent = false) {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const r = (await fetchDataFresh(`/api/connections/${connectionId}/wait-events`)) as WaitEventsResponse;
            setData(r);
        } catch (e: any) {
            setError(e?.message || 'Failed to load wait events');
        } finally {
            if (!silent) setLoading(false);
        }
    }

    useEffect(() => {
        if (connectionId != null) load(); /* eslint-disable-next-line */
    }, [connectionId]);

    useEffect(() => {
        if (!auto || connectionId == null) return;
        const id = setInterval(() => load(true), POLL_MS);
        return () => clearInterval(id);
        /* eslint-disable-next-line */
    }, [auto, connectionId]);

    const card = (children: React.ReactNode, headerRight?: React.ReactNode) => (
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
                    <Activity size={17} color={THEME.primary} />
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: THEME.textMain }}>Top wait events</div>
                        <div style={{ fontSize: 12, color: THEME.textMuted }}>
                            {data?.engine ?? 'engine'}
                            {data?.window ? ` · ${data.window}` : ''}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{headerRight}</div>
            </div>
            {children}
        </div>
    );

    const refreshControls = (
        <>
            <label
                title={`Auto-refresh every ${POLL_MS / 1000}s`}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: THEME.textMuted,
                    cursor: 'pointer',
                }}
            >
                <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto
            </label>
            <button
                onClick={() => load()}
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
        </>
    );

    if (loading && !data) {
        return card(
            <div style={{ padding: 20, textAlign: 'center', color: THEME.textMuted, fontSize: 13 }}>
                Loading wait events…
            </div>,
        );
    }
    if (error) {
        return card(
            <div style={{ padding: 14, color: THEME.danger, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertTriangle size={15} /> {error}
                <button
                    onClick={() => load()}
                    style={{
                        marginLeft: 8,
                        background: 'none',
                        border: `1px solid ${THEME.glassBorder}`,
                        borderRadius: 6,
                        padding: '2px 8px',
                        cursor: 'pointer',
                        color: THEME.textMuted,
                        fontSize: 12,
                    }}
                >
                    Retry
                </button>
            </div>,
            refreshControls,
        );
    }
    if (!data) return null;

    if (!data.supported) {
        return card(
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
                <Info size={15} /> {data.note || `${data.engine} does not expose wait events.`}
            </div>,
            refreshControls,
        );
    }

    const events = data.events || [];
    const maxWaiters = events.reduce((m, e) => Math.max(m, Number(e.waiters) || Number(e.ms) || 0), 0);
    const totalWaiters = events.reduce((s, e) => s + (Number(e.waiters) || 0), 0);

    // Category breakdown for the summary strip.
    const byCat = new Map<string, number>();
    for (const e of events)
        byCat.set(e.type || 'Other', (byCat.get(e.type || 'Other') || 0) + (Number(e.waiters) || 0));
    const catChips = [...byCat.entries()].sort((a, b) => b[1] - a[1]);

    return card(
        <>
            {data.note && (
                <div
                    style={{
                        fontSize: 12,
                        color: THEME.textMuted,
                        marginBottom: 12,
                        display: 'flex',
                        gap: 6,
                        alignItems: 'center',
                    }}
                >
                    <Info size={13} /> {data.note}
                </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: THEME.textMain }}>
                    {totalWaiters} waiting {totalWaiters === 1 ? 'backend' : 'backends'}
                </span>
                {catChips.map(([cat, n]) => {
                    const c = catFor(cat);
                    return (
                        <span
                            key={cat}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '3px 10px',
                                borderRadius: 999,
                                background: `${c.color}18`,
                                border: `1px solid ${c.color}44`,
                            }}
                        >
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.color }} />
                            <span style={{ fontSize: 12, color: THEME.textMain }}>{c.label}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: c.color }}>{n}</span>
                        </span>
                    );
                })}
            </div>

            {events.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: THEME.textMuted, fontSize: 13 }}>
                    No wait events in this window.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {events.map((e) => {
                        const c = catFor(e.type);
                        const value = Number(e.waiters) || Number(e.ms) || 0;
                        const unit = typeof e.ms === 'number' ? 'ms' : 'waiters';
                        const pct = maxWaiters > 0 ? Math.round((value / maxWaiters) * 100) : 0;
                        const sessions = e.sessions || [];
                        const isOpen = !!open[e.event];
                        return (
                            <div
                                key={e.event}
                                style={{ borderBottom: `1px solid ${THEME.glassBorder}`, paddingBottom: 6 }}
                            >
                                <div
                                    onClick={() =>
                                        sessions.length && setOpen((o) => ({ ...o, [e.event]: !o[e.event] }))
                                    }
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        padding: '6px 0',
                                        cursor: sessions.length ? 'pointer' : 'default',
                                    }}
                                >
                                    <span style={{ width: 16, flexShrink: 0, color: THEME.textMuted, display: 'flex' }}>
                                        {sessions.length ? (
                                            isOpen ? (
                                                <ChevronDown size={14} />
                                            ) : (
                                                <ChevronRight size={14} />
                                            )
                                        ) : null}
                                    </span>
                                    <span
                                        style={{
                                            width: 8,
                                            height: 8,
                                            flexShrink: 0,
                                            borderRadius: '50%',
                                            background: c.color,
                                        }}
                                    />
                                    <span
                                        title={e.event}
                                        style={{
                                            width: 210,
                                            flexShrink: 0,
                                            fontSize: 12.5,
                                            color: THEME.textMain,
                                            fontFamily: THEME.fontMono,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}
                                    >
                                        {e.event}
                                    </span>
                                    <span
                                        style={{
                                            flex: 1,
                                            height: 8,
                                            borderRadius: 999,
                                            background: `${c.color}18`,
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <span
                                            style={{
                                                display: 'block',
                                                height: '100%',
                                                width: `${pct}%`,
                                                background: c.color,
                                                borderRadius: 999,
                                            }}
                                        />
                                    </span>
                                    <span
                                        style={{
                                            width: 100,
                                            flexShrink: 0,
                                            textAlign: 'right',
                                            fontSize: 12.5,
                                            fontWeight: 600,
                                            color: THEME.textMain,
                                            fontFamily: THEME.fontMono,
                                        }}
                                    >
                                        {value.toLocaleString()}{' '}
                                        <span style={{ color: THEME.textMuted, fontWeight: 400 }}>{unit}</span>
                                    </span>
                                </div>
                                {(descFor(e) || sessions.length > 0) && (
                                    <div
                                        style={{
                                            fontSize: 11.5,
                                            color: THEME.textMuted,
                                            paddingLeft: 36,
                                            marginTop: -2,
                                            marginBottom: 4,
                                        }}
                                    >
                                        {descFor(e)}
                                        {sessions.length > 0 && !isOpen && (
                                            <span style={{ color: c.color }}>
                                                {' '}
                                                · {sessions.length} session{sessions.length > 1 ? 's' : ''} — click to
                                                expand
                                            </span>
                                        )}
                                    </div>
                                )}
                                {isOpen && sessions.length > 0 && (
                                    <div style={{ paddingLeft: 36, marginBottom: 6, overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                                            <thead>
                                                <tr style={{ color: THEME.textMuted, textAlign: 'left' }}>
                                                    {['PID', 'In state', 'User @ app', 'Query'].map((h) => (
                                                        <th
                                                            key={h}
                                                            style={{
                                                                padding: '4px 8px',
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
                                                {sessions.map((s, i) => (
                                                    <tr key={i} style={{ color: THEME.textMain }}>
                                                        <td style={{ padding: '4px 8px', fontFamily: THEME.fontMono }}>
                                                            {s.pid ?? '—'}
                                                        </td>
                                                        <td style={{ padding: '4px 8px', color: THEME.textMuted }}>
                                                            {fmtDur(s.waitSeconds)}
                                                            {s.state ? ` · ${s.state}` : ''}
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: '4px 8px',
                                                                color: THEME.textMuted,
                                                                whiteSpace: 'nowrap',
                                                            }}
                                                        >
                                                            {s.user || '—'}
                                                            {s.application ? ` @ ${s.application}` : ''}
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: '4px 8px',
                                                                fontFamily: THEME.fontMono,
                                                                maxWidth: 380,
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                            }}
                                                            title={s.query || ''}
                                                        >
                                                            {s.query || (
                                                                <span style={{ color: THEME.textMuted }}>
                                                                    (no query)
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </>,
        refreshControls,
    );
}
