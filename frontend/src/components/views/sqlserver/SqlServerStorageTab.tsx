import React from 'react';
import { Copy, Database, Layers, Link2, ChartPie as PieIcon, Puzzle, Table2, Zap } from 'lucide-react';
import { THEME } from '../../../utils/theme';
import Advisor from './Advisor';
import { Badge, C, compact, DataTable, Donut, HBars, Kpi, kb, n, Panel, pct, Row, Shell, when, useAiAdvice } from './shared';

export default function SqlServerStorageTab() {
    const advice = useAiAdvice('storage');
    return (
        <Shell title="Tables & Indexes" icon={Table2} view="storage" refreshMs={null}>
            {(result) => {
                const { data, errors } = result;
                const s: Row = data.indexSummary?.[0] || {};
                const frag: Row[] = data.fragmentation || [];
                const rebuild = frag.filter((f) => f.action === 'REBUILD').length;
                const reorganize = frag.filter((f) => f.action === 'REORGANIZE').length;
                const reads = Number(s.total_seeks) + Number(s.total_scans) + Number(s.total_lookups);
                const tables: Row[] = data.tables || [];
                return (
                    <>
                        <div style={{ fontSize: 12, color: THEME.textMuted, marginTop: -6 }}>
                            Database: <strong style={{ color: THEME.textMain }}>{s.database_name || '—'}</strong> (the connection's database). Usage counters reset when SQL Server restarts.
                        </div>
                        <div className="mss-kpis">
                            <Kpi label="Indexes" icon={Layers} color={C.blue} value={n(s.total_indexes)} hint={`${n(s.clustered_indexes)} clustered · ${n(s.nonclustered_indexes)} nonclustered`} />
                            <Kpi label="Heaps" icon={Database} color={C.slate} value={n(s.heaps)} hint="tables without a clustered index" tone={Number(s.heaps) > 0 ? 'warning' : null} />
                            <Kpi label="Columnstore" icon={Layers} color={C.teal} value={n(s.columnstore_indexes)} />
                            <Kpi label="Unused indexes" icon={Zap} color={C.amber} value={n(s.unused_since_restart)} hint="never read since restart" tone={Number(s.unused_since_restart) > 0 ? 'warning' : null} />
                            <Kpi label="Duplicate indexes" icon={Copy} color={C.purple} value={errors.duplicates ? '—' : n((data.duplicates || []).length)} tone={(data.duplicates || []).length ? 'warning' : null} />
                            <Kpi label="Need rebuild" icon={Puzzle} color={C.red} value={n(rebuild)} hint={`${n(reorganize)} need reorganize`} tone={rebuild ? 'warning' : null} />
                            <Kpi label="Missing indexes" icon={Link2} color={C.orange} value={errors.missingIndexes ? '—' : n((data.missingIndexes || []).length)} hint="suggested by the optimizer" />
                            <Kpi label="Avg fill factor" icon={PieIcon} color={C.green} value={pct(s.avg_fill_factor, 0)} />
                        </div>

                        <Advisor result={result} advice={advice} />

                        <div className="mss-row">
                            <Panel title="Largest tables" icon={Table2} error={errors.tables}>
                                <HBars
                                    data={tables.slice(0, 10).map((t) => ({
                                        label: `${t.schema_name}.${t.table_name}`,
                                        data: Number(t.data_kb),
                                        index: Number(t.index_kb),
                                        other: Math.max(0, Number(t.reserved_kb) - Number(t.data_kb) - Number(t.index_kb)),
                                    }))}
                                    labelKey="label"
                                    fmt={kb}
                                    bars={[
                                        { key: 'data', label: 'Data', color: C.blue, stack: true },
                                        { key: 'index', label: 'Indexes', color: C.purple, stack: true },
                                        { key: 'other', label: 'Unused reserved', color: '#94A3B8', stack: true },
                                    ]}
                                />
                            </Panel>
                            <Panel title="How indexes are read" icon={PieIcon} color={C.teal} error={errors.indexSummary}>
                                <Donut
                                    data={[
                                        { name: 'Seeks', value: Number(s.total_seeks) || 0, color: C.green },
                                        { name: 'Scans', value: Number(s.total_scans) || 0, color: C.red },
                                        { name: 'Key lookups', value: Number(s.total_lookups) || 0, color: C.amber },
                                    ]}
                                    center={{ value: compact(reads), label: 'reads' }}
                                />
                                <div className="mss-note" style={{ padding: '8px 0 0' }}>
                                    Seeks are targeted; a high share of scans or lookups usually points to missing or non-covering indexes.
                                </div>
                            </Panel>
                        </div>

                        <Panel title="Missing index suggestions" icon={Link2} color={C.orange} pad={false} error={errors.missingIndexes}>
                            <DataTable
                                rows={data.missingIndexes}
                                empty="The optimizer has no missing-index suggestions for this database."
                                columns={[
                                    { key: 'table_name', label: 'Table', fmt: (v) => <code style={{ fontSize: 11 }}>{v}</code> },
                                    { key: 'equality_columns', label: 'Equality columns' },
                                    { key: 'inequality_columns', label: 'Inequality columns' },
                                    { key: 'included_columns', label: 'Include' },
                                    {
                                        key: 'avg_user_impact',
                                        label: 'Impact',
                                        num: true,
                                        fmt: (v) => <Badge color={v > 70 ? C.red : v > 40 ? C.amber : C.green}>{pct(v, 0)}</Badge>,
                                    },
                                    { key: 'user_seeks', label: 'Seeks', num: true, fmt: compact },
                                    { key: 'improvement_score', label: 'Score', num: true, fmt: compact },
                                    { key: 'last_user_seek', label: 'Last wanted', fmt: when },
                                ]}
                            />
                            <div className="mss-note" style={{ paddingTop: 10 }}>
                                Suggestions are hints: review overlap with existing indexes before creating one.
                            </div>
                        </Panel>

                        <Panel title="Fragmentation (indexes of 100+ pages)" icon={Puzzle} color={C.red} pad={false} error={errors.fragmentation}>
                            <DataTable
                                rows={frag}
                                empty="No indexes of 100+ pages."
                                columns={[
                                    { key: 'table_name', label: 'Table', fmt: (v, r) => `${r.schema_name}.${v}` },
                                    { key: 'index_name', label: 'Index' },
                                    { key: 'index_type_desc', label: 'Type' },
                                    {
                                        key: 'fragmentation_pct',
                                        label: 'Fragmentation',
                                        num: true,
                                        fmt: (v) => <span style={{ color: v >= 30 ? THEME.danger : v >= 10 ? THEME.warning : undefined, fontWeight: 600 }}>{pct(v)}</span>,
                                    },
                                    { key: 'page_count', label: 'Pages', num: true, fmt: compact },
                                    { key: 'action', label: 'Suggested', fmt: (v) => (v ? <Badge color={v === 'REBUILD' ? C.red : C.amber}>{v}</Badge> : <span style={{ color: THEME.textDim }}>none</span>) },
                                ]}
                            />
                        </Panel>

                        <Panel title="Index usage" icon={Layers} color={C.blue} pad={false} error={errors.indexUsage}>
                            <DataTable
                                rows={data.indexUsage}
                                columns={[
                                    { key: 'table_name', label: 'Table', fmt: (v, r) => `${r.schema_name}.${v}` },
                                    { key: 'index_name', label: 'Index', fmt: (v, r) => <span>{v} {r.is_primary_key ? <Badge color={C.blue}>PK</Badge> : r.is_unique ? <Badge color={C.slate}>unique</Badge> : null}</span> },
                                    { key: 'type_desc', label: 'Type' },
                                    { key: 'seeks', label: 'Seeks', num: true, fmt: compact },
                                    { key: 'scans', label: 'Scans', num: true, fmt: compact },
                                    { key: 'lookups', label: 'Lookups', num: true, fmt: compact },
                                    {
                                        key: 'updates',
                                        label: 'Writes',
                                        num: true,
                                        fmt: (v, r) => {
                                            const unread = Number(v) > 0 && !Number(r.seeks) && !Number(r.scans) && !Number(r.lookups);
                                            return (
                                                <span style={{ color: unread ? THEME.warning : undefined }} title={unread ? 'Written but never read since restart' : undefined}>
                                                    {compact(v)}
                                                </span>
                                            );
                                        },
                                    },
                                    { key: 'size_kb', label: 'Size', num: true, fmt: kb },
                                    { key: 'last_user_seek', label: 'Last seek', fmt: when },
                                ]}
                            />
                        </Panel>

                        <div className="mss-row">
                            <Panel title="Duplicate indexes" icon={Copy} color={C.purple} pad={false} error={errors.duplicates}>
                                <DataTable
                                    rows={data.duplicates}
                                    empty="No duplicate index keys found."
                                    columns={[
                                        { key: 'table_name', label: 'Table', fmt: (v, r) => `${r.schema_name}.${v}` },
                                        { key: 'index_name', label: 'Index' },
                                        { key: 'duplicate_of', label: 'Same keys as' },
                                        { key: 'key_columns', label: 'Key columns' },
                                    ]}
                                />
                            </Panel>
                            <Panel title="Tables" icon={Database} color={C.slate} pad={false} error={errors.tables}>
                                <DataTable
                                    rows={tables}
                                    columns={[
                                        { key: 'table_name', label: 'Table', fmt: (v, r) => <span>{r.schema_name}.{v} {r.is_heap ? <Badge color={C.amber}>heap</Badge> : null}</span> },
                                        { key: 'row_count', label: 'Rows', num: true, fmt: compact },
                                        { key: 'reserved_kb', label: 'Reserved', num: true, fmt: kb },
                                        { key: 'data_kb', label: 'Data', num: true, fmt: kb },
                                        { key: 'index_kb', label: 'Indexes', num: true, fmt: kb },
                                    ]}
                                />
                            </Panel>
                        </div>
                    </>
                );
            }}
        </Shell>
    );
}
