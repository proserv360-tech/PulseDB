import React from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Clock, FileText, HardDrive, Timer } from 'lucide-react';
import { THEME } from '../../../utils/theme';
import { Badge, C, compact, DataTable, HBars, Kpi, mb, ms, Panel, pct, Progress, Row, Shell, sparkOf, TrendChart } from './shared';

const latencyColor = (v: any) => (Number(v) >= 50 ? THEME.danger : Number(v) >= 20 ? THEME.warning : undefined);

export default function SqlServerIoTab() {
    return (
        <Shell title="Storage & I/O" icon={HardDrive} view="io" refreshMs={15_000}>
            {({ data, errors, live, history }) => {
                const l: Row = live || {};
                const files: Row[] = data.files || [];
                const dataMb = files.filter((f) => f.type_desc === 'ROWS').reduce((s, f) => s + Number(f.size_mb), 0);
                const logMb = files.filter((f) => f.type_desc === 'LOG').reduce((s, f) => s + Number(f.size_mb), 0);
                const fullestLog = (data.logUsage || [])[0];
                return (
                    <>
                        <div className="mss-kpis">
                            <Kpi label="Reads" icon={ArrowDownToLine} color={C.blue} value={compact(l.readsPerSec)} unit="IOPS" hint={`${compact(l.readMBps)} MB/s`} spark={sparkOf(history, 'readsPerSec')} />
                            <Kpi label="Writes" icon={ArrowUpFromLine} color={C.orange} value={compact(l.writesPerSec)} unit="IOPS" hint={`${compact(l.writeMBps)} MB/s`} spark={sparkOf(history, 'writesPerSec')} />
                            <Kpi
                                label="Read latency"
                                icon={Clock}
                                color={C.teal}
                                value={ms(l.readLatencyMs)}
                                hint="per read, last interval"
                                tone={l.readLatencyMs >= 50 ? 'danger' : l.readLatencyMs >= 20 ? 'warning' : null}
                                spark={sparkOf(history, 'readLatencyMs')}
                            />
                            <Kpi
                                label="Write latency"
                                icon={Clock}
                                color={C.purple}
                                value={ms(l.writeLatencyMs)}
                                hint="per write, last interval"
                                tone={l.writeLatencyMs >= 50 ? 'danger' : l.writeLatencyMs >= 20 ? 'warning' : null}
                                spark={sparkOf(history, 'writeLatencyMs')}
                            />
                            <Kpi label="Log flushes" icon={FileText} color={C.amber} value={compact(l.logFlushesPerSec)} unit="/s" spark={sparkOf(history, 'logFlushesPerSec')} />
                            <Kpi label="Data files" icon={HardDrive} color={C.blue} value={mb(dataMb)} hint={`${files.filter((f) => f.type_desc === 'ROWS').length} files`} />
                            <Kpi label="Log files" icon={FileText} color={C.slate} value={mb(logMb)} hint={fullestLog ? `fullest: ${fullestLog.database_name} ${fullestLog.log_used_pct}%` : undefined} />
                            <Kpi label="Checkpoint writes" icon={Timer} color={C.green} value={compact(l.checkpointPagesPerSec)} unit="pages/s" spark={sparkOf(history, 'checkpointPagesPerSec')} />
                        </div>

                        <div className="mss-row">
                            <Panel title="IOPS — live" icon={HardDrive} color={C.blue}>
                                <TrendChart
                                    data={history || []}
                                    series={[
                                        { key: 'readsPerSec', label: 'Reads/s', color: C.blue },
                                        { key: 'writesPerSec', label: 'Writes/s', color: C.orange },
                                    ]}
                                />
                            </Panel>
                            <Panel title="Latency — live" icon={Clock} color={C.teal}>
                                <TrendChart
                                    data={history || []}
                                    yFmt={(v) => `${v} ms`}
                                    series={[
                                        { key: 'readLatencyMs', label: 'Read latency', color: C.teal, type: 'line' },
                                        { key: 'writeLatencyMs', label: 'Write latency', color: C.purple, type: 'line' },
                                    ]}
                                />
                            </Panel>
                        </div>

                        <div className="mss-row">
                            <Panel title="Disk volumes" icon={HardDrive} color={C.slate} error={errors.volumes}>
                                {(data.volumes || []).length === 0 ? (
                                    <div className="mss-empty">No volume information.</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        {(data.volumes || []).map((v: Row) => {
                                            const used = Number(v.total_gb) - Number(v.free_gb);
                                            return (
                                                <div key={v.volume_mount_point}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, color: THEME.textMuted }}>
                                                        <span>
                                                            <strong style={{ color: THEME.textMain }}>{v.volume_mount_point}</strong> {v.logical_volume_name} · {v.file_system_type}
                                                        </span>
                                                        <span style={{ color: Number(v.free_pct) < 10 ? THEME.danger : Number(v.free_pct) < 20 ? THEME.warning : THEME.textMain }}>
                                                            {v.free_gb} GB free of {v.total_gb} GB ({pct(v.free_pct, 0)})
                                                        </span>
                                                    </div>
                                                    <Progress value={used} max={Number(v.total_gb)} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </Panel>
                            <Panel title="Transaction log usage" icon={FileText} color={C.amber} pad={false} error={errors.logUsage}>
                                <DataTable
                                    rows={data.logUsage}
                                    initialSort={{ key: 'log_used_pct', dir: 'desc' }}
                                    columns={[
                                        { key: 'database_name', label: 'Database' },
                                        {
                                            key: 'log_used_pct',
                                            label: 'Used',
                                            num: true,
                                            fmt: (v) => (
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                                                    {pct(v, 0)}
                                                    <div style={{ width: 70 }}>
                                                        <Progress value={Number(v)} />
                                                    </div>
                                                </div>
                                            ),
                                        },
                                        { key: 'log_size_mb', label: 'Log size', num: true, fmt: mb },
                                        { key: 'recovery_model_desc', label: 'Recovery' },
                                        {
                                            key: 'log_reuse_wait_desc',
                                            label: 'Waiting on',
                                            fmt: (v) => (v === 'NOTHING' ? <span style={{ color: THEME.textDim }}>nothing</span> : <Badge color={C.amber}>{v}</Badge>),
                                        },
                                    ]}
                                />
                            </Panel>
                        </div>

                        <Panel title="Slowest files — average latency since restart" icon={Clock} color={C.teal} error={errors.files}>
                            <HBars
                                data={files.slice(0, 10).map((f) => ({ label: `${f.database_name} · ${f.file_name}`, read: Number(f.avg_read_ms) || 0, write: Number(f.avg_write_ms) || 0 }))}
                                labelKey="label"
                                fmt={(v) => `${compact(v)} ms`}
                                bars={[
                                    { key: 'read', label: 'Avg read', color: C.teal },
                                    { key: 'write', label: 'Avg write', color: C.purple },
                                ]}
                            />
                        </Panel>

                        <Panel title="Database files" icon={FileText} pad={false} error={errors.files} right="cumulative since restart">
                            <DataTable
                                rows={files}
                                columns={[
                                    { key: 'database_name', label: 'Database' },
                                    { key: 'file_name', label: 'File' },
                                    { key: 'type_desc', label: 'Type', fmt: (v) => <Badge color={v === 'LOG' ? C.amber : C.blue}>{v}</Badge> },
                                    { key: 'size_mb', label: 'Size', num: true, fmt: mb },
                                    { key: 'growth', label: 'Growth', fmt: (v) => <span style={{ color: String(v).endsWith('%') ? THEME.warning : undefined }} title={String(v).endsWith('%') ? 'Percentage growth gets slower as files grow' : undefined}>{v}</span> },
                                    { key: 'max_size_mb', label: 'Max', num: true, fmt: (v) => (v === null ? 'unlimited' : mb(v)) },
                                    { key: 'num_of_reads', label: 'Reads', num: true, fmt: compact },
                                    { key: 'avg_read_ms', label: 'Avg read', num: true, fmt: (v) => <span style={{ color: latencyColor(v) }}>{ms(v)}</span> },
                                    { key: 'num_of_writes', label: 'Writes', num: true, fmt: compact },
                                    { key: 'avg_write_ms', label: 'Avg write', num: true, fmt: (v) => <span style={{ color: latencyColor(v) }}>{ms(v)}</span> },
                                    { key: 'mb_read', label: 'Read', num: true, fmt: mb },
                                    { key: 'mb_written', label: 'Written', num: true, fmt: mb },
                                    { key: 'physical_name', label: 'Path', fmt: (v) => <code style={{ fontSize: 11 }}>{v}</code> },
                                ]}
                            />
                        </Panel>
                    </>
                );
            }}
        </Shell>
    );
}
