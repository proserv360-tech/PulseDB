import React, { useMemo, useState } from 'react';
import { Activity, Clock, Cpu, Gauge, Layers, ListOrdered, Lock, Search, Split, Table2 } from 'lucide-react';
import {
    Badge,
    C,
    compact,
    DataTable,
    Donut,
    HBars,
    Kpi,
    ms,
    Panel,
    pct,
    Progress,
    Row,
    Shell,
    sparkOf,
    TrendChart,
    WAIT_COLORS,
    when,
} from './shared';

const SORTS = [
    { key: 'total_cpu_ms', label: 'CPU', fmt: ms },
    { key: 'total_elapsed_ms', label: 'Duration', fmt: ms },
    { key: 'total_logical_reads', label: 'Reads', fmt: compact },
    { key: 'execution_count', label: 'Executions', fmt: compact },
];

const queryLabel = (r: Row) =>
    r.object_name ? `${r.object_name}` : String(r.query_text || '').replace(/\s+/g, ' ').trim().slice(0, 40) || '(no text)';

export default function SqlServerPerformanceTab() {
    const [sortKey, setSortKey] = useState('total_cpu_ms');
    return (
        <Shell title="Performance & Waits" icon={Gauge} view="performance" refreshMs={15_000}>
            {({ data, errors, live, history }) => (
                <PerformanceBody data={data} errors={errors} live={live || {}} history={history || []} sortKey={sortKey} setSortKey={setSortKey} />
            )}
        </Shell>
    );
}

function PerformanceBody({ data, errors, live: l, history, sortKey, setSortKey }: any) {
    const categories: Row[] = data.waitCategories || [];
    const totalWait = categories.reduce((s, c) => s + Number(c.wait_ms), 0);
    const totalSignal = categories.reduce((s, c) => s + Number(c.signal_ms), 0);
    const waitTrend = useMemo(
        () => history.map((p: Row) => ({ t: p.t, ...(p.waits || {}) })),
        [history],
    );
    const trendCats = useMemo(() => {
        const sums: Record<string, number> = {};
        for (const p of waitTrend) for (const [k, v] of Object.entries(p)) if (k !== 't') sums[k] = (sums[k] || 0) + Number(v || 0);
        return Object.entries(sums)
            .filter(([, v]) => v > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([k]) => k);
    }, [waitTrend]);
    const sort = SORTS.find((s) => s.key === sortKey)!;
    const topQueries = useMemo(
        () => [...(data.topQueries || [])].sort((a, b) => Number(b[sortKey]) - Number(a[sortKey])),
        [data.topQueries, sortKey],
    );

    return (
        <>
            <div className="mss-kpis">
                <Kpi
                    label="Signal wait"
                    icon={Cpu}
                    color={C.blue}
                    value={pct(l.signalWaitPct ?? (totalWait ? (100 * totalSignal) / totalWait : null))}
                    hint="share of waiting spent queued for CPU"
                    tone={l.signalWaitPct > 25 ? 'warning' : null}
                    spark={history.map((p: Row) => p.signalWaitPct)}
                />
                <Kpi label="Batch requests" icon={Activity} color={C.blue} value={compact(l.batchPerSec)} unit="/s" spark={sparkOf(history, 'batchPerSec')} />
                <Kpi
                    label="Compilations"
                    icon={Layers}
                    color={C.amber}
                    value={compact(l.compilationsPerSec)}
                    unit="/s"
                    hint={l.batchPerSec > 0 ? `${((100 * l.compilationsPerSec) / l.batchPerSec).toFixed(0)}% of batches compile` : undefined}
                    tone={l.batchPerSec > 10 && l.compilationsPerSec / l.batchPerSec > 0.3 ? 'warning' : null}
                    spark={sparkOf(history, 'compilationsPerSec')}
                />
                <Kpi label="Plan cache hit" icon={Gauge} color={C.green} value={pct(l.planCacheHitPct)} />
                <Kpi label="Page splits" icon={Split} color={C.orange} value={compact(l.pageSplitsPerSec)} unit="/s" spark={sparkOf(history, 'pageSplitsPerSec')} />
                <Kpi
                    label="Full scans"
                    icon={Table2}
                    color={C.red}
                    value={compact(l.fullScansPerSec)}
                    unit="/s"
                    hint={l.indexSearchesPerSec ? `index searches ${compact(l.indexSearchesPerSec)}/s` : undefined}
                    spark={sparkOf(history, 'fullScansPerSec')}
                />
                <Kpi label="Worktables" icon={Layers} color={C.purple} value={compact(l.worktablesPerSec)} unit="/s" hint="spools, sorts, hash work in tempdb" spark={sparkOf(history, 'worktablesPerSec')} />
                <Kpi label="Lock waits" icon={Lock} color={C.orange} value={compact(l.lockWaitsPerSec)} unit="/s" spark={sparkOf(history, 'lockWaitsPerSec')} />
            </div>

            <div className="mss-row">
                <Panel title="Where time is spent waiting (since restart)" icon={Clock} error={errors.waitCategories}>
                    <Donut
                        data={categories
                            .filter((c) => Number(c.wait_ms) > 0)
                            .map((c) => ({ name: c.category, value: Number(c.wait_ms), color: WAIT_COLORS[c.category] || C.slate }))}
                        fmt={ms}
                        center={{ value: ms(totalWait), label: 'total wait' }}
                    />
                </Panel>
                <Panel title="Wait time per second — live" icon={Activity} color={C.blue} right="ms of waiting per second">
                    <TrendChart
                        data={waitTrend}
                        series={trendCats.slice(0, 6).map((cat) => ({ key: cat, label: cat, color: WAIT_COLORS[cat] || C.slate, stack: true }))}
                        empty="Collecting samples — wait deltas appear after two refreshes."
                    />
                </Panel>
            </div>

            <Panel title="Top waits" icon={Clock} pad={false} error={errors.waits} right="benign/idle waits filtered out">
                <DataTable
                    rows={data.waits}
                    columns={[
                        { key: 'wait_type', label: 'Wait type', fmt: (v) => <code style={{ fontSize: 12 }}>{v}</code> },
                        { key: 'category', label: 'Category', fmt: (v) => <Badge color={WAIT_COLORS[v] || C.slate}>{v}</Badge> },
                        {
                            key: 'pct',
                            label: 'Share',
                            num: true,
                            fmt: (v, r) => (
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                                    <span>{pct(v)}</span>
                                    <div style={{ width: 90 }}>
                                        <Progress value={Number(v)} max={100} color={WAIT_COLORS[r.category] || C.blue} />
                                    </div>
                                </div>
                            ),
                        },
                        { key: 'wait_time_ms', label: 'Total wait', num: true, fmt: ms },
                        { key: 'avg_wait_ms', label: 'Avg per wait', num: true, fmt: ms },
                        { key: 'signal_wait_time_ms', label: 'Signal (CPU) wait', num: true, fmt: ms },
                        { key: 'waiting_tasks_count', label: 'Waits', num: true, fmt: compact },
                    ]}
                />
            </Panel>

            <Panel
                title="Top queries (plan cache)"
                icon={ListOrdered}
                color={C.purple}
                pad={false}
                error={errors.topQueries}
                right={
                    <span style={{ display: 'flex', gap: 4 }}>
                        {SORTS.map((s) => (
                            <button
                                key={s.key}
                                className="mss-btn"
                                style={{
                                    padding: '3px 10px',
                                    background: s.key === sortKey ? `${C.purple}1c` : undefined,
                                    color: s.key === sortKey ? C.purple : undefined,
                                    fontWeight: s.key === sortKey ? 700 : 500,
                                }}
                                onClick={() => setSortKey(s.key)}
                            >
                                by {s.label}
                            </button>
                        ))}
                    </span>
                }
            >
                <div style={{ padding: '12px 16px 0' }}>
                    <HBars
                        data={topQueries.slice(0, 10).map((r) => ({ label: queryLabel(r), value: Number(r[sortKey]) }))}
                        labelKey="label"
                        bars={[{ key: 'value', label: `Total ${sort.label.toLowerCase()}`, color: C.purple }]}
                        fmt={sort.fmt}
                    />
                </div>
                <DataTable
                    key={sortKey}
                    rows={topQueries}
                    initialSort={{ key: sortKey, dir: 'desc' }}
                    columns={[
                        { key: 'query_text', label: 'Statement', code: true },
                        { key: 'database_name', label: 'Database', fmt: (v, r) => (r.object_name ? `${v ?? ''}.${r.object_name}` : (v ?? '—')) },
                        { key: 'execution_count', label: 'Execs', num: true, fmt: compact },
                        { key: 'total_cpu_ms', label: 'Total CPU', num: true, fmt: ms },
                        { key: 'avg_cpu_ms', label: 'Avg CPU', num: true, fmt: ms },
                        { key: 'total_elapsed_ms', label: 'Total duration', num: true, fmt: ms },
                        { key: 'avg_elapsed_ms', label: 'Avg duration', num: true, fmt: ms },
                        { key: 'total_logical_reads', label: 'Reads', num: true, fmt: compact },
                        { key: 'avg_logical_reads', label: 'Avg reads', num: true, fmt: compact },
                        { key: 'total_rows', label: 'Rows', num: true, fmt: compact },
                        { key: 'last_execution_time', label: 'Last run', fmt: when },
                    ]}
                />
                <div className="mss-note" style={{ paddingTop: 10 }}>
                    From sys.dm_exec_query_stats — statements whose plans are still cached, ranked in the top 20 by CPU, duration, reads or executions. Click a statement to expand it.
                </div>
            </Panel>

            <Panel title="Access patterns — live" icon={Search} color={C.teal}>
                <TrendChart
                    data={history}
                    series={[
                        { key: 'indexSearchesPerSec', label: 'Index searches/s', color: C.teal },
                        { key: 'fullScansPerSec', label: 'Full scans/s', color: C.red, type: 'line', axis: 'right' },
                        { key: 'pageSplitsPerSec', label: 'Page splits/s', color: C.orange, type: 'line', axis: 'right' },
                    ]}
                />
            </Panel>
        </>
    );
}
