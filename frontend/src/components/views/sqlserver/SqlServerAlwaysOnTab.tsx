import React from 'react';
import { GitBranch, Info, Layers, Network } from 'lucide-react';
import { THEME } from '../../../utils/theme';
import Advisor from './Advisor';
import { Badge, C, DataTable, Facts, Kpi, kb, n, Panel, Row, secs, Shell, stateColor, when, useAiAdvice } from './shared';

export default function SqlServerAlwaysOnTab() {
    const advice = useAiAdvice('alwayson');
    return (
        <Shell title="Always On & Replication" icon={GitBranch} view="alwayson" refreshMs={15_000}>
            {(result) => {
                const { data, errors } = result;
                const st: Row = data.status?.[0] || {};
                const groups: Row[] = data.groups || [];
                const replicas: Row[] = data.replicas || [];
                const dbs: Row[] = data.databases || [];
                const mirroring: Row[] = data.mirroring || [];
                const none = !groups.length && !mirroring.length;
                const maxSend = dbs.reduce((m, d) => Math.max(m, Number(d.send_queue_kb) || 0), 0);
                const maxRedo = dbs.reduce((m, d) => Math.max(m, Number(d.redo_queue_kb) || 0), 0);
                const unhealthy = replicas.filter((r) => r.synchronization_health_desc && r.synchronization_health_desc !== 'HEALTHY').length;
                return (
                    <>
                        <div className="mss-kpis">
                            <Kpi label="Always On" icon={GitBranch} color={C.blue} value={Number(st.hadr_enabled) ? 'Enabled' : 'Not enabled'} hint="instance setting (HADR)" />
                            <Kpi label="Availability groups" icon={Layers} color={C.purple} value={n(st.ag_count)} />
                            <Kpi label="Replicas" icon={Network} color={C.teal} value={n(replicas.length)} hint={unhealthy ? `${unhealthy} not healthy` : replicas.length ? 'all healthy' : undefined} tone={unhealthy ? 'danger' : null} />
                            <Kpi label="Max send queue" icon={Network} color={C.amber} value={kb(maxSend)} hint="log not yet sent to a secondary" tone={maxSend > 100 * 1024 ? 'warning' : null} />
                            <Kpi label="Max redo queue" icon={Network} color={C.orange} value={kb(maxRedo)} hint="log not yet replayed on a secondary" tone={maxRedo > 100 * 1024 ? 'warning' : null} />
                            <Kpi label="Mirrored databases" icon={GitBranch} color={C.slate} value={n(st.mirrored_dbs)} />
                        </div>

                        <Advisor result={result} advice={advice} />

                        {none ? (
                            <Panel title="No high-availability configuration" icon={Info} color={C.blue} error={errors.status}>
                                <div style={{ fontSize: 13, color: THEME.textMuted, lineHeight: 1.6 }}>
                                    This instance has no availability groups or database mirroring. {Number(st.hadr_enabled) ? 'Always On is enabled at the instance level, but no group is defined.' : 'Always On availability groups are not enabled (it needs Enterprise or, for basic groups, Standard edition on a Windows failover cluster).'}{' '}
                                    Backups are the recovery path — see Backups & Jobs.
                                </div>
                            </Panel>
                        ) : (
                            groups.map((g) => (
                                <Panel
                                    key={g.ag_name}
                                    title={`Availability group ${g.ag_name}`}
                                    icon={GitBranch}
                                    color={C.blue}
                                    right={<Badge color={stateColor(g.synchronization_health_desc)}>{g.synchronization_health_desc}</Badge>}
                                >
                                    <Topology replicas={replicas.filter((r) => r.ag_name === g.ag_name)} dbs={dbs.filter((d) => d.ag_name === g.ag_name)} />
                                    <div style={{ marginTop: 12 }}>
                                        <Facts
                                            items={[
                                                ['Primary replica', g.primary_replica],
                                                ['Recovery health', g.primary_recovery_health_desc],
                                                ['Backup preference', g.automated_backup_preference_desc],
                                                ['Failure condition level', g.failure_condition_level],
                                                ['Health check timeout', g.health_check_timeout ? `${g.health_check_timeout} ms` : null],
                                            ]}
                                        />
                                    </div>
                                </Panel>
                            ))
                        )}

                        {replicas.length > 0 && (
                            <Panel title="Replicas" icon={Network} color={C.teal} pad={false} error={errors.replicas}>
                                <DataTable
                                    rows={replicas}
                                    columns={[
                                        { key: 'ag_name', label: 'Group' },
                                        { key: 'replica_server_name', label: 'Replica' },
                                        { key: 'role_desc', label: 'Role', fmt: (v) => <Badge color={v === 'PRIMARY' ? C.red : C.blue}>{v || 'unknown'}</Badge> },
                                        { key: 'availability_mode_desc', label: 'Commit mode' },
                                        { key: 'failover_mode_desc', label: 'Failover' },
                                        { key: 'connected_state_desc', label: 'Connected', fmt: (v) => <Badge color={stateColor(v)}>{v || '—'}</Badge> },
                                        { key: 'synchronization_health_desc', label: 'Health', fmt: (v) => <Badge color={stateColor(v)}>{v || '—'}</Badge> },
                                        { key: 'secondary_role_allow_connections_desc', label: 'Readable secondary' },
                                    ]}
                                />
                            </Panel>
                        )}

                        {dbs.length > 0 && (
                            <Panel title="Database replica states" icon={Layers} color={C.purple} pad={false} error={errors.databases}>
                                <DataTable
                                    rows={dbs}
                                    columns={[
                                        { key: 'database_name', label: 'Database' },
                                        { key: 'replica_server_name', label: 'Replica' },
                                        { key: 'synchronization_state_desc', label: 'State', fmt: (v) => <Badge color={stateColor(v)}>{v}</Badge> },
                                        { key: 'is_suspended', label: 'Suspended', fmt: (v, r) => (Number(v) ? <Badge color={C.red}>{r.suspend_reason_desc || 'yes'}</Badge> : 'no') },
                                        { key: 'send_queue_kb', label: 'Send queue', num: true, fmt: kb },
                                        { key: 'send_rate_kbps', label: 'Send rate', num: true, fmt: (v) => `${kb(v)}/s` },
                                        { key: 'redo_queue_kb', label: 'Redo queue', num: true, fmt: kb },
                                        { key: 'redo_rate_kbps', label: 'Redo rate', num: true, fmt: (v) => `${kb(v)}/s` },
                                        { key: 'est_redo_sec', label: 'Est. catch-up', num: true, fmt: secs },
                                        { key: 'last_commit_time', label: 'Last commit', fmt: when },
                                    ]}
                                />
                            </Panel>
                        )}

                        {mirroring.length > 0 && (
                            <Panel title="Database mirroring" icon={GitBranch} color={C.slate} pad={false} error={errors.mirroring}>
                                <DataTable
                                    rows={mirroring}
                                    columns={[
                                        { key: 'database_name', label: 'Database' },
                                        { key: 'mirroring_role_desc', label: 'Role' },
                                        { key: 'mirroring_state_desc', label: 'State', fmt: (v) => <Badge color={stateColor(v)}>{v}</Badge> },
                                        { key: 'mirroring_safety_level_desc', label: 'Safety' },
                                        { key: 'mirroring_partner_instance', label: 'Partner' },
                                        { key: 'mirroring_witness_state_desc', label: 'Witness' },
                                    ]}
                                />
                            </Panel>
                        )}
                    </>
                );
            }}
        </Shell>
    );
}

function Topology({ replicas, dbs }: { replicas: Row[]; dbs: Row[] }) {
    if (!replicas.length) return <div className="mss-empty">No replica state visible from this server.</div>;
    const W = 720;
    const H = 210;
    const step = replicas.length > 1 ? (W - 160) / (replicas.length - 1) : 0;
    const xs = replicas.map((_, i) => (replicas.length > 1 ? 80 + i * step : W / 2));
    const primaryIdx = Math.max(0, replicas.findIndex((r) => r.role_desc === 'PRIMARY'));
    const queueOf = (name: string, key: string) => dbs.filter((d) => d.replica_server_name === name).reduce((s, d) => s + (Number(d[key]) || 0), 0);
    return (
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxHeight: 230 }}>
            {replicas.map((r, i) =>
                i === primaryIdx ? null : (
                    <line
                        key={`l${i}`}
                        x1={xs[primaryIdx]}
                        y1={95}
                        x2={xs[i]}
                        y2={95}
                        stroke={stateColor(r.synchronization_health_desc)}
                        strokeWidth={2.5}
                        strokeDasharray={r.availability_mode_desc === 'ASYNCHRONOUS_COMMIT' ? '7 5' : undefined}
                        opacity={0.8}
                    />
                ),
            )}
            {replicas.map((r, i) => {
                const primary = r.role_desc === 'PRIMARY';
                const send = queueOf(r.replica_server_name, 'send_queue_kb');
                const redo = queueOf(r.replica_server_name, 'redo_queue_kb');
                return (
                    <g key={r.replica_server_name}>
                        <circle cx={xs[i]} cy={95} r={primary ? 36 : 30} fill={primary ? C.red : stateColor(r.synchronization_health_desc)} stroke={THEME.surface} strokeWidth={3} />
                        <text x={xs[i]} y={99} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff">
                            {r.role_desc || '?'}
                        </text>
                        <text x={xs[i]} y={45} textAnchor="middle" fontSize={12} fontWeight={600} fill={THEME.textMain}>
                            {r.replica_server_name}
                        </text>
                        <text x={xs[i]} y={150} textAnchor="middle" fontSize={10} fill={THEME.textMuted}>
                            {String(r.availability_mode_desc || '').replace('_COMMIT', '').toLowerCase()} · {String(r.failover_mode_desc || '').toLowerCase()}
                        </text>
                        <text x={xs[i]} y={165} textAnchor="middle" fontSize={10} fill={THEME.textMuted}>
                            {r.synchronization_health_desc}
                        </text>
                        {!primary && (send > 0 || redo > 0) && (
                            <text x={xs[i]} y={182} textAnchor="middle" fontSize={10} fill={C.amber}>
                                send {kb(send)} · redo {kb(redo)}
                            </text>
                        )}
                    </g>
                );
            })}
        </svg>
    );
}
