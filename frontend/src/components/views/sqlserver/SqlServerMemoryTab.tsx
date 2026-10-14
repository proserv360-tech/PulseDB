import React from 'react';
import { Archive, Clock, Database, HardDrive, Layers, MemoryStick, Ticket, Users } from 'lucide-react';
import { THEME } from '../../../utils/theme';
import Advisor from './Advisor';
import {
    C,
    compact,
    DataTable,
    Donut,
    HBars,
    Kpi,
    kb,
    mb,
    ms,
    n,
    Panel,
    pct,
    Progress,
    Row,
    SERIES,
    Shell,
    sparkOf,
    TrendChart,
    when, useAiAdvice } from './shared';

export default function SqlServerMemoryTab() {
    const advice = useAiAdvice('memory');
    return (
        <Shell title="Memory & TempDB" icon={MemoryStick} view="memory" refreshMs={15_000}>
            {(result) => {
                const { data, errors, live, history } = result;
                const m: Row = data.memory?.[0] || {};
                const l: Row = live || {};
                const h = (history || []).map((p) => ({
                    ...p,
                    totalMb: p.totalServerMemoryKb / 1024,
                    targetMb: p.targetServerMemoryKb / 1024,
                    stolenMb: p.stolenServerMemoryKb / 1024,
                    cacheMb: p.databaseCacheMemoryKb / 1024,
                }));
                const plans: Row[] = data.planCache || [];
                const planMb = plans.reduce((s, p) => s + Number(p.size_mb), 0);
                const singleMb = plans.reduce((s, p) => s + Number(p.single_use_mb), 0);
                const t: Row = data.tempdbUsage?.[0] || {};
                const tempdbTotal = ['free_mb', 'user_objects_mb', 'internal_objects_mb', 'version_store_mb', 'mixed_extents_mb'].reduce((s, k) => s + Number(t[k] || 0), 0);
                const maxMem = Number(m.max_server_memory_mb) >= 2147483647 ? null : Number(m.max_server_memory_mb);
                const hostUsedKb = Number(m.total_physical_memory_kb) - Number(m.available_physical_memory_kb);

                return (
                    <>
                        <div className="mss-kpis">
                            <Kpi
                                label="SQL Server memory"
                                icon={MemoryStick}
                                color={C.purple}
                                value={kb(m.physical_memory_in_use_kb ?? l.totalServerMemoryKb)}
                                hint={`target ${kb(l.targetServerMemoryKb)}`}
                                spark={sparkOf(history, 'totalServerMemoryKb')}
                            />
                            <Kpi label="Max server memory" icon={Layers} color={C.slate} value={maxMem ? mb(maxMem) : 'Unlimited'} tone={maxMem ? null : 'warning'} hint={`min ${mb(m.min_server_memory_mb)}`} />
                            <Kpi
                                label="Host memory free"
                                icon={HardDrive}
                                color={C.teal}
                                value={kb(m.available_physical_memory_kb)}
                                hint={`of ${kb(m.total_physical_memory_kb)} · ${m.system_memory_state_desc || ''}`}
                                tone={m.process_physical_memory_low ? 'warning' : null}
                            />
                            <Kpi label="Page life expectancy" icon={Clock} color={C.blue} value={n(l.pageLifeExpectancy)} unit="s" tone={l.pageLifeExpectancy < 300 ? 'warning' : null} spark={sparkOf(history, 'pageLifeExpectancy')} />
                            <Kpi label="Buffer cache hit" icon={Database} color={C.green} value={pct(l.bufferCacheHitPct, 2)} spark={sparkOf(history, 'bufferCacheHitPct')} />
                            <Kpi
                                label="Memory grants"
                                icon={Ticket}
                                color={C.amber}
                                value={n(l.memoryGrantsOutstanding)}
                                hint={`${n(l.memoryGrantsPending)} waiting`}
                                tone={Number(l.memoryGrantsPending) > 0 ? 'danger' : null}
                                spark={sparkOf(history, 'memoryGrantsPending')}
                            />
                            <Kpi label="Lazy writes" icon={Archive} color={C.orange} value={compact(l.lazyWritesPerSec)} unit="/s" hint="buffer pool flushing to free memory" spark={sparkOf(history, 'lazyWritesPerSec')} />
                            <Kpi label="Plan cache" icon={Layers} color={C.magenta} value={mb(planMb)} hint={`${mb(singleMb)} single-use plans`} tone={planMb > 0 && singleMb / planMb > 0.5 ? 'warning' : null} />
                        </div>

                        <Advisor result={result} advice={advice} />

                        <div className="mss-row">
                            <Panel title="SQL Server memory — live" icon={MemoryStick} color={C.purple}>
                                <TrendChart
                                    data={h}
                                    yFmt={(v) => mb(v)}
                                    series={[
                                        { key: 'cacheMb', label: 'Data cache', color: C.blue, stack: true },
                                        { key: 'stolenMb', label: 'Stolen (plans, locks, grants…)', color: C.amber, stack: true },
                                        { key: 'targetMb', label: 'Target', color: C.red, type: 'line' },
                                    ]}
                                />
                            </Panel>
                            <Panel title="Memory clerks" icon={Layers} color={C.magenta} error={errors.clerks}>
                                <Donut
                                    data={(data.clerks || []).map((c: Row, i: number) => ({
                                        name: String(c.clerk_type).replace(/^MEMORYCLERK_/, '').replace(/^CACHESTORE_/, 'CACHE_'),
                                        value: Number(c.mb),
                                        color: SERIES[i % SERIES.length],
                                    }))}
                                    fmt={mb}
                                />
                            </Panel>
                        </div>

                        <div className="mss-row">
                            <Panel title="Buffer pool by database" icon={Database} color={C.blue} error={errors.bufferByDb}>
                                <HBars
                                    data={(data.bufferByDb || []).slice(0, 12).map((b: Row) => ({
                                        db: b.database_name,
                                        clean: Number(b.cached_mb) - Number(b.dirty_mb),
                                        dirty: Number(b.dirty_mb),
                                    }))}
                                    labelKey="db"
                                    fmt={mb}
                                    bars={[
                                        { key: 'clean', label: 'Cached', color: C.blue, stack: true },
                                        { key: 'dirty', label: 'Dirty (not yet written)', color: C.orange, stack: true },
                                    ]}
                                />
                            </Panel>
                            <Panel title="Plan cache by type" icon={Layers} color={C.magenta} pad={false} error={errors.planCache}>
                                <DataTable
                                    rows={plans}
                                    columns={[
                                        { key: 'objtype', label: 'Type' },
                                        { key: 'plans', label: 'Plans', num: true, fmt: compact },
                                        { key: 'size_mb', label: 'Size', num: true, fmt: mb },
                                        { key: 'single_use_plans', label: 'Single-use', num: true, fmt: compact },
                                        { key: 'single_use_mb', label: 'Single-use size', num: true, fmt: mb },
                                        { key: 'avg_use_count', label: 'Avg reuse', num: true, fmt: compact },
                                    ]}
                                />
                                {planMb > 0 && singleMb / planMb > 0.3 && (
                                    <div className="mss-note" style={{ paddingTop: 10 }}>
                                        {pct((100 * singleMb) / planMb, 0)} of the plan cache is single-use plans — consider “optimize for ad hoc workloads” or parameterizing queries.
                                    </div>
                                )}
                            </Panel>
                        </div>

                        <div className="mss-row">
                            <Panel title="TempDB space" icon={Archive} color={C.teal} error={errors.tempdbUsage}>
                                <Donut
                                    data={[
                                        { name: 'Free', value: Number(t.free_mb) || 0, color: '#94A3B8' },
                                        { name: 'User objects (#temp tables)', value: Number(t.user_objects_mb) || 0, color: C.blue },
                                        { name: 'Internal (sorts, hashes, spools)', value: Number(t.internal_objects_mb) || 0, color: C.amber },
                                        { name: 'Version store', value: Number(t.version_store_mb) || 0, color: C.purple },
                                        { name: 'Mixed extents', value: Number(t.mixed_extents_mb) || 0, color: C.slate },
                                    ]}
                                    fmt={mb}
                                    center={{ value: mb(tempdbTotal - Number(t.free_mb || 0)), label: `used of ${mb(tempdbTotal)}` }}
                                />
                            </Panel>
                            <Panel title="TempDB files" icon={HardDrive} color={C.teal} pad={false} error={errors.tempdbFiles}>
                                <DataTable
                                    rows={data.tempdbFiles}
                                    columns={[
                                        { key: 'file_name', label: 'File' },
                                        { key: 'type_desc', label: 'Type' },
                                        { key: 'size_mb', label: 'Size', num: true, fmt: mb },
                                        { key: 'growth', label: 'Growth' },
                                        { key: 'max_size_mb', label: 'Max size', num: true, fmt: (v) => (v === null ? 'unlimited' : mb(v)) },
                                    ]}
                                />
                                {(data.tempdbFiles || []).filter((f: Row) => f.type_desc === 'ROWS').length === 1 && (
                                    <div className="mss-note" style={{ paddingTop: 10 }}>
                                        Only one TempDB data file — multiple equally sized files (up to 8) reduce allocation contention.
                                    </div>
                                )}
                            </Panel>
                        </div>

                        <div className="mss-row">
                            <Panel title="Top TempDB consumers" icon={Users} color={C.teal} pad={false} error={errors.tempdbConsumers}>
                                <DataTable
                                    rows={data.tempdbConsumers}
                                    empty="No user session is using TempDB right now."
                                    columns={[
                                        { key: 'session_id', label: 'SPID', num: true },
                                        { key: 'login_name', label: 'Login' },
                                        { key: 'program_name', label: 'Program' },
                                        { key: 'user_objects_mb', label: 'User objects', num: true, fmt: mb },
                                        { key: 'internal_objects_mb', label: 'Internal', num: true, fmt: mb },
                                    ]}
                                />
                            </Panel>
                            <Panel title="Memory grants" icon={Ticket} color={C.amber} pad={false} error={errors.grants}>
                                <DataTable
                                    rows={data.grants}
                                    empty="No queries hold or wait for a memory grant."
                                    columns={[
                                        { key: 'session_id', label: 'SPID', num: true },
                                        { key: 'grant_time', label: 'Status', fmt: (v) => (v ? 'granted' : <span style={{ color: THEME.danger }}>waiting</span>) },
                                        { key: 'requested_memory_kb', label: 'Requested', num: true, fmt: kb },
                                        { key: 'granted_memory_kb', label: 'Granted', num: true, fmt: kb },
                                        {
                                            key: 'used_memory_kb',
                                            label: 'Used',
                                            num: true,
                                            fmt: (v, r) => (
                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
                                                    {kb(v)}
                                                    <div style={{ width: 50 }}>
                                                        <Progress value={Number(v)} max={Number(r.granted_memory_kb) || 1} color={C.amber} />
                                                    </div>
                                                </div>
                                            ),
                                        },
                                        { key: 'wait_time_ms', label: 'Waited', num: true, fmt: ms },
                                        { key: 'dop', label: 'DOP', num: true },
                                        { key: 'query_text', label: 'Query', code: true },
                                        { key: 'request_time', label: 'Requested at', fmt: when },
                                    ]}
                                />
                            </Panel>
                        </div>
                        {hostUsedKb > 0 && (
                            <div className="mss-note" style={{ padding: 0 }}>
                                Host memory in use: {kb(hostUsedKb)} of {kb(m.total_physical_memory_kb)}.
                            </div>
                        )}
                    </>
                );
            }}
        </Shell>
    );
}
