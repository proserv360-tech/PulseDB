import React from 'react';
import {
    Activity,
    AlertTriangle,
    Clock,
    Cpu,
    Database,
    HardDrive,
    Layers,
    MemoryStick,
    Server,
    Shield,
    TrendingUp,
    Users,
    Zap,
} from 'lucide-react';
import { THEME } from '../../../utils/theme';
import {
    AlertList,
    Badge,
    C,
    compact,
    DataTable,
    duration,
    Facts,
    Kpi,
    kb,
    mb,
    n,
    ago,
    Panel,
    Progress,
    pct,
    Row,
    Shell,
    sparkOf,
    stateColor,
    TrendChart,
    when,
} from './shared';

export default function SqlServerOverviewTab() {
    return (
        <Shell title="SQL Server Overview" icon={Server} view="overview" refreshMs={15_000}>
            {({ data, errors, live, history }) => {
                const s = data.server?.[0] || {};
                const host = data.host?.[0];
                const a = data.activity?.[0] || {};
                const mem = data.memory?.[0] || {};
                const l = live || {};
                const cpuRows: Row[] = [...(data.cpuHistory || [])].reverse().map((r) => ({
                    t: r.event_time,
                    sql: r.sql_cpu_pct,
                    other: Math.max(0, 100 - Number(r.system_idle_pct) - Number(r.sql_cpu_pct)),
                }));
                const cpuNow = data.cpuHistory?.[0];
                const backups = Object.fromEntries((data.backupAges || []).map((b: Row) => [b.database_name, b]));
                const maxDb = Math.max(1, ...(data.databases || []).map((d: Row) => Number(d.data_mb) + Number(d.log_mb)));
                const usedKb = Number(l.totalServerMemoryKb ?? s.committed_kb);
                const targetKb = Number(l.targetServerMemoryKb ?? s.committed_target_kb);

                return (
                    <>
                        <Panel title="Server identity" icon={Server} error={errors.server}>
                            <Facts
                                items={[
                                    ['Product', [s.product_name, s.product_level, s.product_update_level].filter(Boolean).join(' · ')],
                                    ['Version', s.product_version],
                                    ['Edition', s.edition],
                                    ['Server', s.server_name],
                                    ['Host OS', host ? `${host.host_distribution} ${host.host_release ?? ''}`.trim() : s.machine_name],
                                    ['Started', s.start_time ? `${when(s.start_time)} (${duration(s.uptime_seconds)})` : null],
                                    ['CPUs', s.cpu_count ? `${s.cpu_count} logical · ${s.scheduler_count} schedulers` : null],
                                    ['Physical memory', kb(s.physical_memory_kb)],
                                    ['Collation', s.collation],
                                    ['Authentication', s.windows_auth_only ? 'Windows only' : 'SQL Server and Windows'],
                                    ['High availability', s.is_hadr_enabled ? 'Always On enabled' : s.is_clustered ? 'Failover cluster' : 'Standalone'],
                                    ['Platform', s.virtual_machine_type_desc === 'NONE' ? 'Physical' : s.virtual_machine_type_desc],
                                ]}
                            />
                        </Panel>

                        <div className="mss-kpis">
                            <Kpi
                                label="SQL CPU"
                                icon={Cpu}
                                color={C.red}
                                value={cpuNow ? cpuNow.sql_cpu_pct : '—'}
                                unit="%"
                                hint={cpuNow ? `other processes ${Math.max(0, 100 - cpuNow.system_idle_pct - cpuNow.sql_cpu_pct)}%` : errors.cpuHistory}
                                tone={cpuNow?.sql_cpu_pct >= 90 ? 'danger' : cpuNow?.sql_cpu_pct >= 75 ? 'warning' : null}
                                spark={cpuRows.slice(-40).map((r) => r.sql)}
                            />
                            <Kpi
                                label="SQL memory"
                                icon={MemoryStick}
                                color={C.purple}
                                value={kb(usedKb)}
                                hint={`target ${kb(targetKb)} · max setting ${mem.max_server_memory_mb >= 2147483647 ? 'unlimited' : mb(mem.max_server_memory_mb)}`}
                            />
                            <Kpi label="Batch requests" icon={Zap} color={C.blue} value={compact(l.batchPerSec)} unit="/s" hint="T-SQL batches received" spark={sparkOf(history, 'batchPerSec')} />
                            <Kpi label="Transactions" icon={Activity} color={C.teal} value={compact(l.transactionsPerSec)} unit="/s" spark={sparkOf(history, 'transactionsPerSec')} />
                            <Kpi
                                label="Compilations"
                                icon={Layers}
                                color={C.amber}
                                value={compact(l.compilationsPerSec)}
                                unit="/s"
                                hint={`recompilations ${compact(l.recompilationsPerSec)}/s`}
                                spark={sparkOf(history, 'compilationsPerSec')}
                            />
                            <Kpi
                                label="User connections"
                                icon={Users}
                                color={C.blue}
                                value={n(l.userConnections ?? a.user_sessions)}
                                hint={`${n(a.system_sessions)} system sessions`}
                                spark={sparkOf(history, 'userConnections')}
                            />
                            <Kpi label="Active requests" icon={Activity} color={C.green} value={n(a.active_requests)} hint={`${n(a.runnable_tasks)} tasks waiting for CPU`} />
                            <Kpi
                                label="Blocked requests"
                                icon={Shield}
                                color={C.orange}
                                value={n(a.blocked_requests)}
                                hint={Number(a.blocked_requests) > 0 ? `longest ${Math.round(a.longest_block_ms / 1000)} s` : 'no blocking'}
                                tone={Number(a.blocked_requests) > 0 ? 'danger' : null}
                                spark={sparkOf(history, 'processesBlocked')}
                            />
                            <Kpi
                                label="Buffer cache hit"
                                icon={HardDrive}
                                color={C.green}
                                value={pct(l.bufferCacheHitPct, 2)}
                                tone={l.bufferCacheHitPct < 95 ? 'warning' : null}
                                spark={sparkOf(history, 'bufferCacheHitPct')}
                            />
                            <Kpi
                                label="Page life expectancy"
                                icon={Clock}
                                color={C.blue}
                                value={n(l.pageLifeExpectancy)}
                                unit="s"
                                hint="seconds a page stays cached"
                                tone={l.pageLifeExpectancy < 300 ? 'warning' : null}
                                spark={sparkOf(history, 'pageLifeExpectancy')}
                            />
                            <Kpi
                                label="Deadlocks"
                                icon={AlertTriangle}
                                color={C.red}
                                value={compact(l.deadlocksPerSec)}
                                unit="/s"
                                tone={Number(l.deadlocksPerSec) > 0 ? 'warning' : null}
                                hint={`errors ${compact(l.errorsPerSec)}/s`}
                                spark={sparkOf(history, 'deadlocksPerSec')}
                            />
                            <Kpi
                                label="Databases"
                                icon={Database}
                                color={C.slate}
                                value={n(a.user_databases)}
                                hint={Number(a.databases_not_online) > 0 ? `${a.databases_not_online} not online` : 'user databases, all online'}
                                tone={Number(a.databases_not_online) > 0 ? 'danger' : null}
                            />
                        </div>

                        <div className="mss-row">
                            <Panel title="CPU — last 4 hours" icon={Cpu} error={errors.cpuHistory}>
                                <TrendChart
                                    data={cpuRows}
                                    seconds={false}
                                    yFmt={(v) => `${v}%`}
                                    yDomain={[0, 100]}
                                    series={[
                                        { key: 'sql', label: 'SQL Server', color: C.red, stack: true },
                                        { key: 'other', label: 'Other processes', color: C.slate, stack: true },
                                    ]}
                                    empty="SQL Server has not recorded CPU samples yet (one per minute)."
                                />
                            </Panel>
                            <Panel title="Throughput" icon={TrendingUp} color={C.blue} right="live while this screen is open">
                                <TrendChart
                                    data={history || []}
                                    series={[
                                        { key: 'batchPerSec', label: 'Batch req/s', color: C.blue },
                                        { key: 'transactionsPerSec', label: 'Transactions/s', color: C.teal, type: 'line' },
                                        { key: 'compilationsPerSec', label: 'Compilations/s', color: C.amber, type: 'line', axis: 'right' },
                                    ]}
                                />
                            </Panel>
                        </div>

                        <div className="mss-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))' }}>
                            <Panel
                                title="Health checks"
                                icon={AlertTriangle}
                                color={C.amber}
                                pad={false}
                                right={`${(data.alerts || []).length} finding(s)`}
                            >
                                <div style={{ maxHeight: 420, overflow: 'auto' }}>
                                    <AlertList alerts={data.alerts || []} />
                                </div>
                            </Panel>
                            <Panel title="Memory" icon={MemoryStick} color={C.purple} error={errors.memory}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    {[
                                        ['SQL Server committed vs target', usedKb, targetKb, kb],
                                        ['Host memory in use', Number(mem.total_physical_memory_kb) - Number(mem.available_physical_memory_kb), Number(mem.total_physical_memory_kb), kb],
                                    ].map(([label, used, total, f]: any) => (
                                        <div key={label}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: THEME.textMuted, marginBottom: 6 }}>
                                                <span>{label}</span>
                                                <span style={{ color: THEME.textMain, fontWeight: 600 }}>
                                                    {f(used)} / {f(total)}
                                                </span>
                                            </div>
                                            <Progress value={used} max={total} />
                                        </div>
                                    ))}
                                    <Facts
                                        items={[
                                            ['OS memory state', mem.system_memory_state_desc],
                                            ['Memory grants pending', n(l.memoryGrantsPending)],
                                            ['Min / max server memory', `${mb(mem.min_server_memory_mb)} / ${mem.max_server_memory_mb >= 2147483647 ? 'unlimited' : mb(mem.max_server_memory_mb)}`],
                                            ['Plan cache hit', pct(l.planCacheHitPct)],
                                        ]}
                                    />
                                </div>
                            </Panel>
                        </div>

                        <Panel title="Databases" icon={Database} pad={false} error={errors.databases} right={`${(data.databases || []).length} databases`}>
                            <DataTable
                                rows={data.databases}
                                initialSort={{ key: 'data_mb', dir: 'desc' }}
                                columns={[
                                    { key: 'name', label: 'Database', fmt: (v) => <strong>{v}</strong> },
                                    { key: 'state_desc', label: 'State', fmt: (v) => <Badge color={stateColor(v)}>{v}</Badge> },
                                    { key: 'recovery_model_desc', label: 'Recovery' },
                                    {
                                        key: 'data_mb',
                                        label: 'Size',
                                        num: true,
                                        sortValue: (r) => Number(r.data_mb) + Number(r.log_mb),
                                        fmt: (_, r) => (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                                                <span>{mb(Number(r.data_mb) + Number(r.log_mb))}</span>
                                                <div style={{ width: 80 }}>
                                                    <Progress value={Number(r.data_mb) + Number(r.log_mb)} max={maxDb} color={C.blue} />
                                                </div>
                                            </div>
                                        ),
                                    },
                                    { key: 'log_mb', label: 'Log', num: true, fmt: mb },
                                    {
                                        key: 'last_full',
                                        label: 'Last full backup',
                                        sortValue: (r) => backups[r.name]?.last_full || '',
                                        fmt: (_, r) => {
                                            if (r.name === 'tempdb') return <span style={{ color: THEME.textDim }}>n/a</span>;
                                            if (!data.backupAges) return '—';
                                            const t = backups[r.name]?.last_full;
                                            const old = !t || Date.now() - new Date(t).getTime() > 7 * 86400_000;
                                            return <span style={{ color: old ? THEME.warning : undefined }}>{ago(t)}</span>;
                                        },
                                    },
                                    { key: 'log_reuse_wait_desc', label: 'Log reuse wait', fmt: (v) => <span style={{ color: v === 'NOTHING' ? THEME.textDim : THEME.warning }}>{v}</span> },
                                    { key: 'compatibility_level', label: 'Compat', num: true },
                                    { key: 'create_date', label: 'Created', fmt: when },
                                ]}
                            />
                        </Panel>
                    </>
                );
            }}
        </Shell>
    );
}
