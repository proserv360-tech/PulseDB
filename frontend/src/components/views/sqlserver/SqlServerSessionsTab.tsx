import React, { useMemo, useState } from 'react';
import { Activity, GitBranch, Lock, Skull, Timer, Users, Workflow } from 'lucide-react';
import { THEME } from '../../../utils/theme';
import {
    Badge,
    C,
    Code,
    compact,
    DataTable,
    HBars,
    Kpi,
    ms,
    n,
    Panel,
    Row,
    secs,
    Shell,
    sparkOf,
    TrendChart,
    when,
} from './shared';

export default function SqlServerSessionsTab() {
    return (
        <Shell title="Sessions & Locks" icon={Users} view="sessions" refreshMs={10_000}>
            {({ data, errors, live, history }) => <SessionsBody data={data} errors={errors} l={live || {}} history={history || []} />}
        </Shell>
    );
}

function SessionsBody({ data, errors, l, history }: any) {
    const sessions: Row[] = data.sessions || [];
    const blocking: Row[] = data.blocking || [];
    const transactions: Row[] = data.transactions || [];
    const deadlocks: Row[] = data.deadlocks || [];
    const running = sessions.filter((s) => s.request_status).length;
    const longestTx = transactions.reduce((m, t) => Math.max(m, Number(t.duration_sec) || 0), 0);
    const lockByType = useMemo(() => {
        const agg: Record<string, Row> = {};
        for (const r of data.locks || []) {
            const k = r.resource_type;
            agg[k] = agg[k] || { resource: k, granted: 0, waiting: 0 };
            agg[k][r.request_status === 'GRANT' ? 'granted' : 'waiting'] += Number(r.lock_count);
        }
        return Object.values(agg).sort((a, b) => b.granted + b.waiting - (a.granted + a.waiting));
    }, [data.locks]);

    return (
        <>
            <div className="mss-kpis">
                <Kpi label="User sessions" icon={Users} color={C.blue} value={n(sessions.length)} hint={`${n(l.userConnections)} user connections`} spark={sparkOf(history, 'userConnections')} />
                <Kpi label="Running requests" icon={Activity} color={C.green} value={n(running)} />
                <Kpi
                    label="Blocked"
                    icon={Lock}
                    color={C.orange}
                    value={n(blocking.length)}
                    hint={blocking.length ? `longest ${ms(Math.max(...blocking.map((b) => Number(b.wait_ms))))}` : 'no blocking'}
                    tone={blocking.length ? 'danger' : null}
                    spark={sparkOf(history, 'processesBlocked')}
                />
                <Kpi label="Lock waits" icon={Lock} color={C.amber} value={compact(l.lockWaitsPerSec)} unit="/s" hint={`avg wait ${ms(l.avgLockWaitMs)}`} spark={sparkOf(history, 'lockWaitsPerSec')} />
                <Kpi
                    label="Open transactions"
                    icon={Timer}
                    color={C.purple}
                    value={n(transactions.length)}
                    hint={transactions.length ? `oldest ${secs(longestTx)}` : undefined}
                    tone={longestTx > 600 ? 'warning' : null}
                />
                <Kpi
                    label="Recent deadlocks"
                    icon={Skull}
                    color={C.red}
                    value={errors.deadlocks ? '—' : n(deadlocks.length)}
                    hint={deadlocks[0] ? `last ${when(deadlocks[0].event_time)}` : 'from system_health'}
                    tone={deadlocks.length ? 'warning' : null}
                />
            </div>

            <div className="mss-row">
                <Panel title="Blocking chains" icon={GitBranch} color={C.orange} error={errors.blocking}>
                    <BlockingTree blocking={blocking} sessions={sessions} />
                </Panel>
                <Panel title="Locking — live" icon={Lock} color={C.amber}>
                    <TrendChart
                        data={history}
                        height={220}
                        series={[
                            { key: 'lockWaitsPerSec', label: 'Lock waits/s', color: C.amber },
                            { key: 'processesBlocked', label: 'Blocked processes', color: C.red, type: 'line', axis: 'right' },
                        ]}
                    />
                </Panel>
            </div>

            <Panel title="Deadlocks (system_health)" icon={Skull} color={C.red} error={errors.deadlocks} pad={false}>
                <Deadlocks deadlocks={deadlocks} />
            </Panel>

            <Panel title="User sessions" icon={Users} pad={false} error={errors.sessions} right="click a statement to expand">
                <DataTable
                    rows={sessions}
                    empty="No other user sessions."
                    columns={[
                        { key: 'session_id', label: 'SPID', num: true },
                        { key: 'login_name', label: 'Login' },
                        { key: 'host_name', label: 'Host' },
                        { key: 'program_name', label: 'Program' },
                        { key: 'database_name', label: 'Database' },
                        {
                            key: 'request_status',
                            label: 'Status',
                            sortValue: (r) => r.request_status || r.session_status,
                            fmt: (v, r) =>
                                r.blocking_session_id ? (
                                    <Badge color={C.red}>blocked by {r.blocking_session_id}</Badge>
                                ) : v ? (
                                    <Badge color={v === 'running' ? C.green : C.amber}>{v}</Badge>
                                ) : (
                                    <span style={{ color: THEME.textDim }}>{r.session_status}</span>
                                ),
                        },
                        { key: 'command', label: 'Command' },
                        { key: 'wait_type', label: 'Wait' },
                        { key: 'elapsed_ms', label: 'Elapsed', num: true, fmt: ms },
                        { key: 'cpu_ms', label: 'CPU', num: true, fmt: ms },
                        { key: 'logical_reads', label: 'Reads', num: true, fmt: compact },
                        { key: 'open_transaction_count', label: 'Open tx', num: true },
                        { key: 'current_statement', label: 'Current statement', code: true },
                    ]}
                />
            </Panel>

            <div className="mss-row">
                <Panel title="Open transactions" icon={Timer} color={C.purple} pad={false} error={errors.transactions}>
                    <DataTable
                        rows={transactions}
                        empty="No open user transactions."
                        columns={[
                            { key: 'session_id', label: 'SPID', num: true },
                            { key: 'login_name', label: 'Login' },
                            { key: 'transaction_name', label: 'Name' },
                            { key: 'transaction_type', label: 'Type' },
                            { key: 'state', label: 'State' },
                            { key: 'duration_sec', label: 'Open for', num: true, fmt: (v) => <span style={{ color: v > 600 ? THEME.warning : undefined }}>{secs(v)}</span> },
                            { key: 'log_bytes_used', label: 'Log used', num: true, fmt: (v) => compact(Number(v) / 1024) + ' KB' },
                        ]}
                    />
                </Panel>
                <Panel title="Locks held and requested" icon={Workflow} color={C.amber} error={errors.locks}>
                    {lockByType.length ? (
                        <HBars
                            data={lockByType}
                            labelKey="resource"
                            bars={[
                                { key: 'granted', label: 'Granted', color: C.blue, stack: true },
                                { key: 'waiting', label: 'Waiting', color: C.red, stack: true },
                            ]}
                        />
                    ) : (
                        <div className="mss-empty">No locks held by other sessions.</div>
                    )}
                </Panel>
            </div>
        </>
    );
}

/* ── blocking tree ──────────────────────────────────────────────────────── */
function BlockingTree({ blocking, sessions }: { blocking: Row[]; sessions: Row[] }) {
    if (!blocking.length) return <div className="mss-empty" style={{ padding: 0 }}>No sessions are blocked right now.</div>;
    const bySpid = Object.fromEntries(sessions.map((s) => [s.session_id, s]));
    const children: Record<string, Row[]> = {};
    const blocked = new Set(blocking.map((b) => String(b.blocked_session)));
    for (const b of blocking) (children[b.blocking_session] = children[b.blocking_session] || []).push(b);
    const heads = [...new Set(blocking.map((b) => String(b.blocking_session)))].filter((s) => !blocked.has(s));

    const Node = ({ spid, depth, row }: { spid: string; depth: number; row?: Row }) => {
        const s = bySpid[spid] || {};
        const head = depth === 0;
        return (
            <div style={{ marginLeft: depth * 22, borderLeft: depth ? `2px solid ${THEME.glassBorder}` : undefined, paddingLeft: depth ? 12 : 0, marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
                    <Badge color={head ? C.red : C.orange}>{head ? 'head blocker' : 'blocked'} · SPID {spid}</Badge>
                    <span style={{ color: THEME.textMuted }}>
                        {[s.login_name || row?.blocking_login, s.host_name || row?.blocking_host, s.program_name || row?.blocking_program].filter(Boolean).join(' · ')}
                    </span>
                    {row && (
                        <span style={{ color: THEME.textMuted }}>
                            waiting {ms(row.wait_ms)} on <code>{row.wait_type}</code> {row.wait_resource && `(${row.wait_resource})`}
                        </span>
                    )}
                </div>
                <div style={{ marginTop: 4 }}>
                    <Code text={row ? row.blocked_statement : s.current_statement || blocking.find((b) => String(b.blocking_session) === spid)?.blocking_statement} />
                </div>
                {(children[spid] || []).map((c) => (
                    <Node key={c.blocked_session} spid={String(c.blocked_session)} depth={depth + 1} row={c} />
                ))}
            </div>
        );
    };
    return (
        <div style={{ maxHeight: 360, overflow: 'auto' }}>
            {heads.map((h) => (
                <Node key={h} spid={h} depth={0} />
            ))}
        </div>
    );
}

/* ── deadlock graph ─────────────────────────────────────────────────────── */
function Deadlocks({ deadlocks }: { deadlocks: Row[] }) {
    const [sel, setSel] = useState(0);
    if (!deadlocks.length) {
        return <div className="mss-empty">No deadlocks in the system_health ring buffer (it keeps the most recent events since the last restart).</div>;
    }
    const d = deadlocks[Math.min(sel, deadlocks.length - 1)];
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 220px) 1fr', minHeight: 320 }}>
            <div style={{ borderRight: `1px solid ${THEME.glassBorder}`, overflow: 'auto', maxHeight: 520 }}>
                {deadlocks.map((x, i) => (
                    <div
                        key={i}
                        onClick={() => setSel(i)}
                        style={{
                            padding: '10px 14px',
                            cursor: 'pointer',
                            fontSize: 12,
                            borderBottom: `1px solid ${THEME.glassBorder}`,
                            background: i === sel ? `${C.red}12` : undefined,
                            borderLeft: i === sel ? `3px solid ${C.red}` : '3px solid transparent',
                            color: THEME.textMain,
                        }}
                    >
                        <div style={{ fontWeight: 600 }}>{when(x.event_time)}</div>
                        <div style={{ color: THEME.textMuted }}>
                            {x.processes?.length || 0} processes · victim SPID {x.processes?.find((p: Row) => p.isVictim)?.spid ?? '?'}
                        </div>
                    </div>
                ))}
            </div>
            <div style={{ padding: 16, minWidth: 0 }}>
                <DeadlockGraph d={d} />
                <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    {(d.processes || []).map((p: Row) => (
                        <div key={p.id} style={{ padding: 10, borderRadius: 8, background: THEME.surfaceHover, borderLeft: `3px solid ${p.isVictim ? C.red : C.blue}` }}>
                            <div style={{ fontSize: 12, color: THEME.textMuted, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <strong style={{ color: THEME.textMain }}>SPID {p.spid}</strong>
                                {p.isVictim && <Badge color={C.red}>victim</Badge>}
                                <span>{[p.login, p.host, p.app, p.database].filter(Boolean).join(' · ')}</span>
                                {p.lockMode && <span>wants {p.lockMode}</span>}
                                {p.isolation && <span>{p.isolation}</span>}
                            </div>
                            <div style={{ marginTop: 6 }}>
                                <Code text={p.statement} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function DeadlockGraph({ d }: { d: Row }) {
    const procs: Row[] = d.processes || [];
    const W = 640;
    const H = 260;
    const cx = W / 2;
    const cy = H / 2;
    const pos: Record<string, { x: number; y: number }> = {};
    procs.forEach((p, i) => {
        if (procs.length === 2) pos[p.id] = { x: i === 0 ? 150 : W - 150, y: cy };
        else {
            const a = (2 * Math.PI * i) / procs.length - Math.PI / 2;
            pos[p.id] = { x: cx + 200 * Math.cos(a), y: cy + 95 * Math.sin(a) };
        }
    });
    const R = 38;
    return (
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxHeight: 280 }}>
            <defs>
                <marker id="dl-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                    <path d="M0 0 L10 5 L0 10 z" fill={C.red} />
                </marker>
            </defs>
            {(d.edges || []).map((e: Row, i: number) => {
                const a = pos[e.from];
                const b = pos[e.to];
                if (!a || !b) return null;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const len = Math.hypot(dx, dy) || 1;
                const ux = dx / len;
                const uy = dy / len;
                // bend each edge to one side so A→B and B→A don't overlap
                const mx = (a.x + b.x) / 2 - uy * 45;
                const my = (a.y + b.y) / 2 + ux * 45;
                const sx = a.x + ux * R;
                const sy = a.y + uy * R;
                const ex = b.x - ux * (R + 4);
                const ey = b.y - uy * (R + 4);
                return (
                    <g key={i}>
                        <path d={`M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`} fill="none" stroke={C.red} strokeWidth={2} markerEnd="url(#dl-arrow)" />
                        <text x={mx} y={my - 4} textAnchor="middle" fontSize={10} fill={THEME.textMuted}>
                            waits for {e.waitMode || '?'} on {String(e.resource).slice(0, 40)}
                        </text>
                    </g>
                );
            })}
            {procs.map((p) => {
                const { x, y } = pos[p.id];
                return (
                    <g key={p.id}>
                        <circle cx={x} cy={y} r={R} fill={p.isVictim ? C.red : C.blue} stroke={THEME.surface} strokeWidth={3} />
                        <text x={x} y={y - 2} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">
                            SPID {p.spid}
                        </text>
                        <text x={x} y={y + 13} textAnchor="middle" fontSize={10} fill="#fff" opacity={0.9}>
                            {p.isVictim ? 'victim' : 'survived'}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}
