import React from 'react';
import { KeyRound, Lock, ShieldAlert, ShieldCheck, UserCheck, UserX, Users } from 'lucide-react';
import { THEME } from '../../../utils/theme';
import Advisor from './Advisor';
import { AlertList, Badge, C, DataTable, Kpi, n, Panel, Row, Shell, when, useAiAdvice } from './shared';

const yes = (v: any, good = false) => (Number(v) ? <Badge color={good ? C.green : C.red}>yes</Badge> : <span style={{ color: THEME.textDim }}>no</span>);

function findings(data: Row) {
    const out: { severity: string; title: string; detail?: string }[] = [];
    const s: Row = data.summary?.[0] || {};
    const logins: Row[] = data.sqlLogins || [];
    for (const l of logins) {
        if (Number(l.blank_password) && !Number(l.is_disabled)) out.push({ severity: 'critical', title: `SQL login "${l.name}" has a blank password` });
        if (Number(l.password_is_login_name) && !Number(l.is_disabled)) out.push({ severity: 'critical', title: `SQL login "${l.name}" uses its own name as password` });
        if (!Number(l.is_policy_checked) && !Number(l.is_disabled)) out.push({ severity: 'warning', title: `Password policy is off for "${l.name}"`, detail: 'Complexity and lockout rules are not enforced.' });
        if (Number(l.is_locked)) out.push({ severity: 'warning', title: `"${l.name}" is locked out`, detail: `${n(l.bad_password_count)} bad password attempts.` });
    }
    if (s.sa_disabled === 0 && !Number(s.windows_auth_only)) {
        out.push({ severity: 'warning', title: `The built-in "${s.sa_name}" login is enabled`, detail: 'It is the first account attackers try; disable or rename it.' });
    }
    for (const c of data.config || []) {
        if (c.at_risk) out.push({ severity: c.name === 'xp_cmdshell' ? 'critical' : 'warning', title: `"${c.name}" is ${c.value_in_use ? 'on' : 'off'} (recommended ${c.recommended ? 'on' : 'off'})`, detail: c.why });
    }
    for (const d of data.databases || []) {
        if (Number(d.is_trustworthy_on) && d.database_name !== 'msdb') {
            out.push({ severity: 'warning', title: `TRUSTWORTHY is on for ${d.database_name}`, detail: 'Code in the database can act with the owner’s server permissions.' });
        }
    }
    const failed = (data.failedLogins || []).length;
    if (failed >= 10) out.push({ severity: 'warning', title: `${failed}+ failed logins in the current error log`, detail: 'Check for password guessing.' });
    const rank: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export default function SqlServerSecurityTab() {
    const advice = useAiAdvice('security');
    return (
        <Shell title="Security" icon={ShieldCheck} view="security" refreshMs={null}>
            {(result) => {
                const { data, errors } = result;
                const s: Row = data.summary?.[0] || {};
                const logins: Row[] = data.sqlLogins || [];
                const weak = logins.filter((l) => !Number(l.is_disabled) && (Number(l.blank_password) || Number(l.password_is_login_name) || !Number(l.is_policy_checked))).length;
                const f = findings(data);
                return (
                    <>
                        <div className="mss-kpis">
                            <Kpi label="Authentication" icon={KeyRound} color={C.blue} value={Number(s.windows_auth_only) ? 'Windows only' : 'Mixed mode'} hint={Number(s.windows_auth_only) ? 'SQL logins cannot connect' : 'SQL and Windows logins'} />
                            <Kpi
                                label={`"${s.sa_name || 'sa'}" login`}
                                icon={UserX}
                                color={C.red}
                                value={s.sa_disabled === undefined ? '—' : s.sa_disabled ? 'Disabled' : 'Enabled'}
                                tone={s.sa_disabled === 0 ? 'warning' : 'success'}
                            />
                            <Kpi label="sysadmin members" icon={Users} color={C.purple} value={n(s.sysadmin_members)} hint={`${n(s.logins)} logins · ${n(s.disabled_logins)} disabled`} />
                            <Kpi label="Weak SQL logins" icon={Lock} color={C.orange} value={errors.sqlLogins ? '—' : n(weak)} hint="blank / name-as-password / no policy" tone={weak ? 'danger' : 'success'} />
                            <Kpi label="Failed logins" icon={ShieldAlert} color={C.red} value={errors.failedLogins ? '—' : n((data.failedLogins || []).length)} hint="in the current error log (max 50 shown)" tone={(data.failedLogins || []).length >= 10 ? 'warning' : null} />
                            <Kpi label="Encrypted databases" icon={ShieldCheck} color={C.green} value={n(s.encrypted_dbs)} hint="Transparent Data Encryption" />
                            <Kpi label="TRUSTWORTHY databases" icon={UserCheck} color={C.amber} value={n(s.trustworthy_dbs)} hint="excluding msdb" tone={Number(s.trustworthy_dbs) ? 'warning' : null} />
                        </div>

                        <Advisor result={result} advice={advice} />

                        <Panel title="Security findings" icon={ShieldAlert} color={C.red} pad={false} right={`${f.length} finding(s)`}>
                            <AlertList alerts={f} />
                        </Panel>

                        <div className="mss-row">
                            <Panel title="sysadmin role members" icon={Users} color={C.purple} pad={false} error={errors.sysadmins}>
                                <DataTable
                                    rows={data.sysadmins}
                                    columns={[
                                        { key: 'name', label: 'Login' },
                                        { key: 'type_desc', label: 'Type' },
                                        { key: 'is_disabled', label: 'Disabled', fmt: (v) => yes(v, true) },
                                        { key: 'create_date', label: 'Created', fmt: when },
                                    ]}
                                />
                            </Panel>
                            <Panel title="Server configuration" icon={ShieldCheck} color={C.blue} pad={false} error={errors.config}>
                                <DataTable
                                    rows={data.config}
                                    initialSort={{ key: 'at_risk', dir: 'desc' }}
                                    columns={[
                                        { key: 'name', label: 'Option' },
                                        { key: 'value_in_use', label: 'In use', num: true },
                                        { key: 'recommended', label: 'Recommended', num: true, fmt: (v) => (v === null ? <span style={{ color: THEME.textDim }}>depends</span> : v) },
                                        { key: 'at_risk', label: 'Status', fmt: (v) => (Number(v) ? <Badge color={C.red}>review</Badge> : <Badge color={C.green}>ok</Badge>) },
                                        { key: 'why', label: 'Why it matters', fmt: (v) => <span style={{ color: THEME.textMuted }}>{v}</span> },
                                    ]}
                                />
                            </Panel>
                        </div>

                        <Panel title="SQL logins" icon={KeyRound} color={C.orange} pad={false} error={errors.sqlLogins}>
                            <DataTable
                                rows={logins}
                                empty="No SQL-authenticated logins."
                                columns={[
                                    { key: 'name', label: 'Login', fmt: (v, r) => <span>{v} {Number(r.is_sysadmin) ? <Badge color={C.purple}>sysadmin</Badge> : null}</span> },
                                    { key: 'is_disabled', label: 'Disabled', fmt: (v) => yes(v, true) },
                                    { key: 'is_policy_checked', label: 'Policy', fmt: (v) => (Number(v) ? <Badge color={C.green}>on</Badge> : <Badge color={C.amber}>off</Badge>) },
                                    { key: 'is_expiration_checked', label: 'Expiry', fmt: (v) => (Number(v) ? 'on' : 'off') },
                                    { key: 'blank_password', label: 'Blank pwd', fmt: (v) => yes(v) },
                                    { key: 'password_is_login_name', label: 'Pwd = name', fmt: (v) => yes(v) },
                                    { key: 'is_locked', label: 'Locked', fmt: (v) => yes(v) },
                                    { key: 'bad_password_count', label: 'Bad attempts', num: true },
                                    { key: 'password_last_set', label: 'Password set', fmt: when },
                                    { key: 'default_database_name', label: 'Default DB' },
                                ]}
                            />
                        </Panel>

                        <div className="mss-row">
                            <Panel title="Database security" icon={ShieldCheck} color={C.green} pad={false} error={errors.databases}>
                                <DataTable
                                    rows={data.databases}
                                    columns={[
                                        { key: 'database_name', label: 'Database' },
                                        { key: 'owner', label: 'Owner' },
                                        { key: 'tde_state', label: 'Encryption (TDE)', fmt: (v, r) => (Number(r.is_encrypted) ? <Badge color={C.green}>{v || 'Encrypted'}</Badge> : <span style={{ color: THEME.textDim }}>{v || 'off'}</span>) },
                                        { key: 'is_trustworthy_on', label: 'Trustworthy', fmt: (v, r) => (r.database_name === 'msdb' ? <span style={{ color: THEME.textDim }}>yes (default)</span> : yes(v)) },
                                        { key: 'is_db_chaining_on', label: 'Ownership chaining', fmt: (v) => yes(v) },
                                        { key: 'containment_desc', label: 'Containment' },
                                    ]}
                                />
                            </Panel>
                            <Panel title="Recent failed logins" icon={ShieldAlert} color={C.red} pad={false} error={errors.failedLogins}>
                                <DataTable
                                    rows={data.failedLogins}
                                    empty="No failed logins in the current error log."
                                    columns={[
                                        { key: 'log_date', label: 'When', fmt: when },
                                        { key: 'message', label: 'Message', fmt: (v) => <span style={{ fontSize: 11 }}>{v}</span> },
                                    ]}
                                />
                            </Panel>
                        </div>

                        <Panel title="Server audits" icon={ShieldCheck} color={C.slate} pad={false} error={errors.audits}>
                            <DataTable
                                rows={data.audits}
                                empty="No SQL Server Audit is defined."
                                columns={[
                                    { key: 'name', label: 'Audit' },
                                    { key: 'type_desc', label: 'Target' },
                                    { key: 'is_enabled', label: 'Enabled', fmt: (v) => yes(v, true) },
                                    { key: 'status_desc', label: 'Status' },
                                ]}
                            />
                        </Panel>
                    </>
                );
            }}
        </Shell>
    );
}
