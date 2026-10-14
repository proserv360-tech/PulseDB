import React from 'react';
import { Archive, Info, ListOrdered, TrendingUp } from 'lucide-react';
import { THEME } from '../../../utils/theme';
import { Badge, C, compact, DataTable, Facts, HBars, ms, n, Panel, Progress, Row, Shell, when } from './shared';

export default function SqlServerQueryStoreTab() {
    return (
        <Shell title="Query Store" icon={Archive} view="querystore" refreshMs={null}>
            {({ data, errors }) => {
                const o: Row = data.options?.[0] || {};
                const off = o.actual_state_desc && o.actual_state_desc !== 'READ_WRITE';
                const top: Row[] = data.top || [];
                return (
                    <>
                        <Panel title={`Query Store — ${o.database_name || 'current database'}`} icon={Archive} color={C.green} error={errors.options}>
                            <Facts
                                items={[
                                    ['State', <Badge key="s" color={o.actual_state_desc === 'READ_WRITE' ? C.green : o.actual_state_desc === 'OFF' ? C.slate : C.amber}>{o.actual_state_desc || '—'}</Badge>],
                                    [
                                        'Storage used',
                                        <div key="u">
                                            {n(o.current_storage_size_mb)} / {n(o.max_storage_size_mb)} MB
                                            <div style={{ marginTop: 6 }}>
                                                <Progress value={Number(o.current_storage_size_mb)} max={Number(o.max_storage_size_mb) || 1} />
                                            </div>
                                        </div>,
                                    ],
                                    ['Capture mode', o.query_capture_mode_desc],
                                    ['Stale threshold', o.stale_query_threshold_days ? `${o.stale_query_threshold_days} days` : null],
                                    ['Interval', o.interval_length_minutes ? `${o.interval_length_minutes} min` : null],
                                    ['Queries tracked', n(o.queries)],
                                    ['Plans', n(o.plans)],
                                    ['Forced plans', n(o.forced_plans)],
                                ]}
                            />
                            {off && (
                                <div style={{ display: 'flex', gap: 8, marginTop: 14, fontSize: 12, color: THEME.textMuted }}>
                                    <Info size={14} color={C.blue} style={{ flexShrink: 0 }} />
                                    <span>
                                        Query Store is {String(o.actual_state_desc).toLowerCase()} for this database
                                        {o.readonly_reason ? ` (reason code ${o.readonly_reason})` : ''}. To capture query history, an administrator can run{' '}
                                        <code>ALTER DATABASE [{o.database_name}] SET QUERY_STORE = ON;</code> — PulseDB only reads it.
                                    </span>
                                </div>
                            )}
                        </Panel>

                        <Panel
                            title="Regressed queries — last 7 days"
                            icon={TrendingUp}
                            color={C.red}
                            pad={false}
                            error={errors.regressed}
                            right="current plan ≥ 1.5× slower than the best plan"
                        >
                            <DataTable
                                rows={data.regressed}
                                empty={off ? 'Query Store is not collecting data.' : 'No plan regressions found.'}
                                columns={[
                                    { key: 'query_id', label: 'Query', num: true },
                                    { key: 'query_text', label: 'Statement', code: true },
                                    {
                                        key: 'regression_pct',
                                        label: 'Regression',
                                        num: true,
                                        fmt: (v) => <Badge color={C.red}>+{n(v)}%</Badge>,
                                    },
                                    { key: 'best_avg_ms', label: 'Best plan avg', num: true, fmt: (v, r) => <span style={{ color: C.green }}>{ms(v)} <small>(#{r.best_plan_id})</small></span> },
                                    { key: 'current_avg_ms', label: 'Current plan avg', num: true, fmt: (v, r) => <span style={{ color: C.red }}>{ms(v)} <small>(#{r.current_plan_id})</small></span> },
                                    { key: 'plan_count', label: 'Plans', num: true },
                                    { key: 'current_plan_execs', label: 'Execs', num: true, fmt: compact },
                                    { key: 'forced', label: 'Forced', fmt: (v) => (v ? <Badge color={C.blue}>forced</Badge> : '—') },
                                    { key: 'last_execution_time', label: 'Last run', fmt: when },
                                ]}
                            />
                            {(data.regressed || []).length > 0 && (
                                <div className="mss-note" style={{ paddingTop: 10 }}>
                                    To pin the faster plan an administrator can run <code>EXEC sp_query_store_force_plan @query_id, @plan_id;</code> with the best plan id.
                                </div>
                            )}
                        </Panel>

                        <Panel title="Top queries by total duration — last 24 hours" icon={ListOrdered} color={C.purple} pad={false} error={errors.top}>
                            {top.length > 0 && (
                                <div style={{ padding: '12px 16px 0' }}>
                                    <HBars
                                        data={top.slice(0, 10).map((r) => ({
                                            label: r.object_name || `#${r.query_id} ${String(r.query_text || '').replace(/\s+/g, ' ').slice(0, 30)}`,
                                            duration: Number(r.total_duration_ms),
                                        }))}
                                        labelKey="label"
                                        bars={[{ key: 'duration', label: 'Total duration', color: C.purple }]}
                                        fmt={ms}
                                    />
                                </div>
                            )}
                            <DataTable
                                rows={top}
                                empty={off ? 'Query Store is not collecting data.' : 'No executions recorded in the last 24 hours.'}
                                columns={[
                                    { key: 'query_id', label: 'Query', num: true },
                                    { key: 'query_text', label: 'Statement', code: true },
                                    { key: 'object_name', label: 'Object' },
                                    { key: 'executions', label: 'Execs', num: true, fmt: compact },
                                    { key: 'total_duration_ms', label: 'Total duration', num: true, fmt: ms },
                                    { key: 'avg_duration_ms', label: 'Avg duration', num: true, fmt: ms },
                                    { key: 'avg_cpu_ms', label: 'Avg CPU', num: true, fmt: ms },
                                    { key: 'avg_logical_reads', label: 'Avg reads', num: true, fmt: compact },
                                    { key: 'plan_count', label: 'Plans', num: true, fmt: (v) => <span style={{ color: Number(v) > 1 ? C.amber : undefined }}>{n(v)}</span> },
                                    { key: 'last_execution_time', label: 'Last run', fmt: when },
                                ]}
                            />
                        </Panel>
                    </>
                );
            }}
        </Shell>
    );
}
