import React from 'react';
import { AlertTriangle, Briefcase, CalendarClock, DatabaseBackup, Server, ShieldCheck } from 'lucide-react';
import { THEME } from '../../../utils/theme';
import { ago, Badge, C, DataTable, Kpi, mb, n, Panel, Row, secs, Shell, stateColor, when } from './shared';

const DAY = 86400_000;
const age = (v: any) => (v ? Date.now() - new Date(v).getTime() : Infinity);

export default function SqlServerBackupsTab() {
    return (
        <Shell title="Backups & Jobs" icon={DatabaseBackup} view="backups" refreshMs={null}>
            {({ data, errors }) => {
                // KPIs count user databases; the table below still lists the system ones.
                const dbs: Row[] = (data.backups || []).filter(
                    (d: Row) => d.state_desc === 'ONLINE' && !['master', 'model', 'msdb'].includes(d.database_name),
                );
                const noFull = dbs.filter((d) => !d.last_full).length;
                const staleFull = dbs.filter((d) => d.last_full && age(d.last_full) > 7 * DAY).length;
                const noLog = dbs.filter((d) => d.recovery_model_desc === 'FULL' && age(d.last_log) > DAY).length;
                const jobs: Row[] = data.jobs || [];
                const failed = jobs.reduce((s, j) => s + Number(j.failures_24h || 0), 0);
                const agent = (data.services || []).find((s: Row) => /agent/i.test(s.servicename));
                const latest = (data.recent || [])[0];
                return (
                    <>
                        <div className="mss-kpis">
                            <Kpi label="Never backed up" icon={AlertTriangle} color={C.red} value={errors.backups ? '—' : n(noFull)} hint="user databases without a full backup" tone={noFull ? 'danger' : 'success'} />
                            <Kpi label="Full backup > 7 days" icon={CalendarClock} color={C.amber} value={errors.backups ? '—' : n(staleFull)} tone={staleFull ? 'warning' : null} />
                            <Kpi label="FULL recovery, no log backup 24h" icon={DatabaseBackup} color={C.orange} value={errors.backups ? '—' : n(noLog)} hint="log keeps growing until backed up" tone={noLog ? 'warning' : null} />
                            <Kpi label="Last backup" icon={ShieldCheck} color={C.green} value={latest ? ago(latest.backup_finish_date) : 'none'} hint={latest ? `${latest.backup_type} of ${latest.database_name}` : undefined} />
                            <Kpi label="SQL Agent" icon={Server} color={C.blue} value={agent ? agent.status_desc : '—'} hint={agent ? `startup: ${agent.startup_type_desc}` : 'not found (Express has no Agent)'} tone={agent && agent.status_desc !== 'Running' ? 'warning' : null} />
                            <Kpi label="Failed job runs (24h)" icon={Briefcase} color={C.red} value={errors.jobs ? '—' : n(failed)} hint={`${jobs.length} jobs`} tone={failed ? 'danger' : null} />
                        </div>

                        <Panel title="Backup status by database" icon={DatabaseBackup} color={C.green} pad={false} error={errors.backups}>
                            <DataTable
                                rows={data.backups}
                                columns={[
                                    { key: 'database_name', label: 'Database', fmt: (v) => <strong>{v}</strong> },
                                    { key: 'recovery_model_desc', label: 'Recovery' },
                                    {
                                        key: 'last_full',
                                        label: 'Last full',
                                        fmt: (v) => <Badge color={!v ? C.red : age(v) > 7 * DAY ? C.amber : C.green}>{ago(v)}</Badge>,
                                    },
                                    { key: 'last_diff', label: 'Last differential', fmt: (v) => (v ? ago(v) : <span style={{ color: THEME.textDim }}>—</span>) },
                                    {
                                        key: 'last_log',
                                        label: 'Last log',
                                        fmt: (v, r) =>
                                            r.recovery_model_desc === 'SIMPLE' ? (
                                                <span style={{ color: THEME.textDim }}>n/a (simple)</span>
                                            ) : (
                                                <Badge color={!v || age(v) > DAY ? C.amber : C.green}>{ago(v)}</Badge>
                                            ),
                                    },
                                    { key: 'last_full_mb', label: 'Full size', num: true, fmt: mb },
                                    {
                                        key: 'last_full_compressed_mb',
                                        label: 'Compressed',
                                        num: true,
                                        fmt: (v, r) => (r.last_full_mb ? `${mb(v)} (${(Number(r.last_full_mb) / Math.max(Number(v), 0.001)).toFixed(1)}×)` : '—'),
                                    },
                                    { key: 'state_desc', label: 'State', fmt: (v) => <Badge color={stateColor(v)}>{v}</Badge> },
                                ]}
                            />
                        </Panel>

                        <Panel title="Recent backups" icon={CalendarClock} color={C.blue} pad={false} error={errors.recent}>
                            <DataTable
                                rows={data.recent}
                                empty="msdb has no backup history."
                                columns={[
                                    { key: 'backup_finish_date', label: 'Finished', fmt: when },
                                    { key: 'database_name', label: 'Database' },
                                    { key: 'backup_type', label: 'Type', fmt: (v, r) => <span>{v} {r.is_copy_only ? <Badge color={C.slate}>copy-only</Badge> : null}</span> },
                                    { key: 'duration_sec', label: 'Duration', num: true, fmt: secs },
                                    { key: 'size_mb', label: 'Size', num: true, fmt: mb },
                                    { key: 'compressed_mb', label: 'Compressed', num: true, fmt: mb },
                                    { key: 'physical_device_name', label: 'Destination', fmt: (v) => <code style={{ fontSize: 11 }}>{v}</code> },
                                ]}
                            />
                        </Panel>

                        <div className="mss-row">
                            <Panel title="SQL Server services" icon={Server} color={C.slate} pad={false} error={errors.services}>
                                <DataTable
                                    rows={data.services}
                                    columns={[
                                        { key: 'servicename', label: 'Service' },
                                        { key: 'status_desc', label: 'Status', fmt: (v) => <Badge color={stateColor(v)}>{v}</Badge> },
                                        { key: 'startup_type_desc', label: 'Startup' },
                                        { key: 'last_startup_time', label: 'Last started', fmt: when },
                                    ]}
                                />
                            </Panel>
                            <Panel title="SQL Agent jobs" icon={Briefcase} color={C.purple} pad={false} error={errors.jobs}>
                                <DataTable
                                    rows={jobs}
                                    empty="No SQL Agent jobs."
                                    columns={[
                                        { key: 'job_name', label: 'Job', fmt: (v, r) => <span style={{ color: r.enabled ? undefined : THEME.textDim }}>{v}{r.enabled ? '' : ' (disabled)'}</span> },
                                        { key: 'last_outcome', label: 'Last outcome', fmt: (v) => (v ? <Badge color={stateColor(v)}>{v}</Badge> : <span style={{ color: THEME.textDim }}>never run</span>) },
                                        { key: 'last_run', label: 'Last run', fmt: when },
                                        { key: 'last_duration_sec', label: 'Took', num: true, fmt: secs },
                                        { key: 'failures_24h', label: 'Fails 24h', num: true, fmt: (v) => <span style={{ color: Number(v) ? THEME.danger : undefined }}>{n(v)}</span> },
                                        { key: 'category', label: 'Category' },
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
