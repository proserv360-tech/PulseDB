// ==========================================================================
//  DemoOracleFullTab.tsx — bespoke Oracle Database demo.
//
//  Panels:
//    Overview     — KPIs + sessions trend + alerts
//    ASH         — Active Session History stacked area by wait class
//    Top SQL     — v$sql top SQL with buffer-gets + elapsed
//    AWR         — Snapshot browser with comparison diff
//    Data Guard  — Primary + Standby health + lag graph
//    Waits       — v$system_event top waits
//    Tablespace  — Storage tablespace usage bars + growth
//    Locks       — v$lock blocking tree
// ==========================================================================

import React, { useState } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { buildMetricsTab } from './useMetricsTab';
import catalog from '../../../utils/catalogs/oracleCatalog';
import DemoLayout, { Panel, StatusBadge, DataTable, TabPills, AlertRow } from './DemoLayout';
import {
    Database,
    Activity,
    AlertTriangle,
    Clock,
    Zap,
    Shield,
    Link2,
    GitBranch,
    Layers,
    HardDrive,
    CheckCircle,
    Gauge,
    TrendingUp,
    Camera,
    Lock,
    BarChart3,
} from 'lucide-react';
import {
    AreaChart,
    Area,
    LineChart,
    Line,
    BarChart,
    Bar,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine,
    ResponsiveContainer,
} from 'recharts';

const OR_RED = '#F80000';
const OR_NAVY = THEME.surfaceRaised;
const OR_AMBER = THEME.warning;
const OR_GREEN = THEME.successDark;

const now = Date.now();
const tMinus = (m: number) => new Date(now - m * 60_000).toISOString();
function fmtHour(iso: string) {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────
const OR = {
    identity: {
        instance: 'FATHOM_PRIMARY',
        cdb: 'CDB$ROOT',
        pdb: 'FATHOM_PDB',
        version: 'Oracle 23ai Enterprise Edition',
        platform: 'Linux x86-64',
        role: 'PRIMARY',
    },
    kpis: [
        { label: 'Executes/sec', value: '9,421', unit: '', color: OR_RED, icon: Activity },
        { label: 'SGA hit', value: '98.4', unit: '%', color: OR_GREEN, icon: HardDrive },
        { label: 'Active sess', value: '86', unit: '', color: OR_RED, icon: Database },
        { label: 'Avg wait', value: '4.2', unit: 'ms', color: OR_AMBER, icon: Clock },
        { label: 'Redo MB/s', value: '24', unit: '', color: OR_NAVY, icon: Zap },
        { label: 'DG lag', value: '2.1', unit: 's', color: OR_GREEN, icon: GitBranch },
    ],
    ash: Array.from({ length: 24 }, (_, i) => ({
        t: tMinus((23 - i) * 5),
        cpu: Math.round(24 + Math.sin(i / 3) * 8 + Math.random() * 4),
        user_io: Math.round(18 + Math.sin(i / 4) * 6 + Math.random() * 3),
        commit: Math.round(8 + Math.random() * 4),
        concurrency: Math.round(4 + Math.random() * 3),
        network: Math.round(2 + Math.random() * 2),
        other: Math.round(1 + Math.random() * 2),
    })),
    topSql: [
        {
            sql_id: '8gnxhpxp1k5u2',
            hash: '2841847432',
            text: 'SELECT /*+ PARALLEL(8) */ * FROM fathom_app.transactions WHERE ts > :b1',
            execs: 48_210,
            elapsed_sec: 1_842,
            cpu_sec: 1_241,
            buffer_gets: 842_102_104,
            disk_reads: 142_211,
            user: 'FATHOM_APP',
        },
        {
            sql_id: '2bngjshd5mtz4',
            hash: '1847419021',
            text: 'MERGE INTO fathom_app.inventory i USING (SELECT ...) src ON (i.sku=src.sku)',
            execs: 1_820,
            elapsed_sec: 842,
            cpu_sec: 412,
            buffer_gets: 182_012_842,
            disk_reads: 42_012,
            user: 'FATHOM_APP',
        },
        {
            sql_id: '4kbnhrpqtd9mw',
            hash: '9127301847',
            text: 'BEGIN pkg_audit.flush_buffer; END;',
            execs: 24,
            elapsed_sec: 512,
            cpu_sec: 48,
            buffer_gets: 482_012,
            disk_reads: 12_042,
            user: 'AUDIT_ADMIN',
        },
        {
            sql_id: '7xjnhrtd9mw2k',
            hash: '9827419821',
            text: 'SELECT COUNT(*) FROM fathom_report.mv_daily_kpi WHERE dt = TRUNC(SYSDATE)',
            execs: 8_420,
            elapsed_sec: 412,
            cpu_sec: 142,
            buffer_gets: 82_012_804,
            disk_reads: 4_201,
            user: 'FATHOM_REPORT',
        },
    ],
    awrSnapshots: [
        {
            snap_id: 14821,
            start: tMinus(60),
            end: tMinus(0),
            db_time_sec: 28_412,
            cpu_sec: 18_412,
            executes: 842_104,
            logical_reads: 2_842_100_000,
            physical_reads: 8_420_100,
        },
        {
            snap_id: 14820,
            start: tMinus(120),
            end: tMinus(60),
            db_time_sec: 24_820,
            cpu_sec: 16_421,
            executes: 784_210,
            logical_reads: 2_421_000_000,
            physical_reads: 7_421_000,
        },
        {
            snap_id: 14819,
            start: tMinus(180),
            end: tMinus(120),
            db_time_sec: 22_421,
            cpu_sec: 15_142,
            executes: 742_120,
            logical_reads: 2_120_000_000,
            physical_reads: 6_820_100,
        },
        {
            snap_id: 14818,
            start: tMinus(240),
            end: tMinus(180),
            db_time_sec: 31_820,
            cpu_sec: 21_412,
            executes: 920_141,
            logical_reads: 3_142_000_000,
            physical_reads: 9_212_100,
        },
        {
            snap_id: 14817,
            start: tMinus(300),
            end: tMinus(240),
            db_time_sec: 42_821,
            cpu_sec: 28_421,
            executes: 1_241_042,
            logical_reads: 4_241_000_000,
            physical_reads: 12_421_000,
        },
    ],
    dataGuard: {
        primary: {
            name: 'FATHOM_PRIMARY',
            role: 'PRIMARY',
            db_role: 'PRIMARY',
            mode: 'MAXIMUM AVAILABILITY',
            lag_sec: 0,
            transport: '—',
            redo_rate_kbps: 0,
        },
        standbys: [
            {
                name: 'FATHOM_DR',
                role: 'PHYSICAL STANDBY',
                db_role: 'PHYSICAL STANDBY',
                mode: 'SYNC',
                lag_sec: 2.1,
                transport: 'LGWR SYNC',
                redo_rate_kbps: 24_000,
            },
            {
                name: 'FATHOM_LOGIC',
                role: 'LOGICAL STANDBY',
                db_role: 'LOGICAL STANDBY',
                mode: 'ASYNC',
                lag_sec: 18.4,
                transport: 'LGWR ASYNC',
                redo_rate_kbps: 12_400,
            },
        ],
    },
    waits: [
        { event: 'db file sequential read', class: 'User I/O', waits: 18_420, total_sec: 842, avg_ms: 4.6 },
        { event: 'log file sync', class: 'Commit', waits: 4_210, total_sec: 318, avg_ms: 7.5 },
        { event: 'enq: TX - row lock contention', class: 'Application', waits: 42, total_sec: 184, avg_ms: 438 },
        { event: 'library cache: mutex X', class: 'Concurrency', waits: 184, total_sec: 98, avg_ms: 533 },
        { event: 'direct path read', class: 'User I/O', waits: 82, total_sec: 12, avg_ms: 146 },
        { event: 'SQL*Net message from client', class: 'Idle', waits: 142_100, total_sec: 18, avg_ms: 0 },
    ],
    tablespaces: [
        { name: 'SYSTEM', size_gb: 8, used_gb: 4, pct: 50, autoextend: 'YES', growth_day_gb: 0.02 },
        { name: 'SYSAUX', size_gb: 16, used_gb: 11, pct: 69, autoextend: 'YES', growth_day_gb: 0.08 },
        { name: 'USERS', size_gb: 4, used_gb: 2, pct: 50, autoextend: 'YES', growth_day_gb: 0.01 },
        { name: 'FATHOM_DATA', size_gb: 840, used_gb: 692, pct: 82, autoextend: 'YES', growth_day_gb: 2.8 },
        { name: 'FATHOM_IDX', size_gb: 180, used_gb: 124, pct: 69, autoextend: 'YES', growth_day_gb: 0.42 },
        { name: 'FATHOM_LOB', size_gb: 420, used_gb: 384, pct: 91, autoextend: 'YES', growth_day_gb: 1.6, warn: true },
        { name: 'UNDOTBS1', size_gb: 42, used_gb: 14, pct: 33, autoextend: 'YES', growth_day_gb: 0.01 },
        { name: 'TEMP', size_gb: 32, used_gb: 8, pct: 25, autoextend: 'YES', growth_day_gb: 0.04 },
    ],
    locks: {
        blocking_tree: [
            {
                sid: 142,
                serial: 4812,
                user: 'FATHOM_APP',
                object: 'TRANSACTIONS',
                sql_id: '8gnxhpxp1k5u2',
                lock_type: 'TX',
                mode: '6 (exclusive)',
                wait_sec: 0,
                blocks: [
                    {
                        sid: 221,
                        serial: 1821,
                        user: 'FATHOM_APP',
                        object: 'TRANSACTIONS',
                        sql_id: '2bngjshd5mtz4',
                        lock_type: 'TX',
                        mode: '6 (exclusive)',
                        wait_sec: 18,
                        blocks: [
                            {
                                sid: 284,
                                serial: 881,
                                user: 'FATHOM_REPORT',
                                object: 'TRANSACTIONS',
                                sql_id: '7xjnhrtd9mw2k',
                                lock_type: 'TX',
                                mode: '4 (share)',
                                wait_sec: 4,
                                blocks: [],
                            },
                        ],
                    },
                    {
                        sid: 318,
                        serial: 402,
                        user: 'FATHOM_APP',
                        object: 'TRANSACTIONS',
                        sql_id: '8gnxhpxp1k5u2',
                        lock_type: 'TX',
                        mode: '6 (exclusive)',
                        wait_sec: 8,
                        blocks: [],
                    },
                ],
            },
        ],
    },
    alerts: [
        {
            severity: 'critical',
            title: 'SID 142 blocking 3 sessions on TRANSACTIONS',
            time: '2m ago',
            source: 'v$lock',
        },
        {
            severity: 'warning',
            title: 'FATHOM_LOB tablespace 91% — autoextend enabled',
            time: '18m ago',
            source: 'tablespace',
        },
        { severity: 'warning', title: 'FATHOM_LOGIC standby lag 18.4s', time: '12m ago', source: 'data-guard' },
    ],
};

// ─────────────────────────────────────────────────────────────────────────

function KpiTile({ k }: { k: (typeof OR.kpis)[0] }) {
    const Icon = k.icon;
    return (
        <div
            style={{
                padding: 16,
                borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(248,0,0,0.06), rgba(255,255,255,0))',
                border: `1px solid ${THEME.glassBorder}`,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: THEME.textMuted, fontSize: 12 }}>
                <Icon size={14} style={{ color: k.color }} />
                <span>{k.label}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color, marginTop: 4 }}>
                {k.value}
                <span style={{ fontSize: 12, color: THEME.textMuted, marginLeft: 4 }}>{k.unit}</span>
            </div>
        </div>
    );
}

// ── Overview
function OverviewPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Instance identity" icon={Database} accentColor={OR_RED}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 12,
                        padding: 16,
                    }}
                >
                    {Object.entries(OR.identity).map(([k, v]) => (
                        <div
                            key={k}
                            style={{
                                padding: 12,
                                borderLeft: `3px solid ${OR_RED}`,
                                background: THEME.surfaceHover,
                                borderRadius: 4,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 11,
                                    color: THEME.textMuted,
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.5,
                                }}
                            >
                                {k.replace(/_/g, ' ')}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{v}</div>
                        </div>
                    ))}
                </div>
            </Panel>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {OR.kpis.map((k) => (
                    <KpiTile key={k.label} k={k} />
                ))}
            </div>

            <Panel title="Alerts" icon={AlertTriangle} accentColor={OR_RED}>
                <div style={{ padding: '4px 0' }}>
                    {OR.alerts.map((a, i) => (
                        <AlertRow
                            key={i}
                            severity={a.severity as any}
                            title={a.title}
                            time={a.time}
                            source={a.source}
                            color={a.severity === 'critical' ? OR_RED : a.severity === 'warning' ? OR_AMBER : OR_NAVY}
                        />
                    ))}
                </div>
            </Panel>
        </div>
    );
}

// ── ASH
function AshPanel() {
    return (
        <Panel title="Active Session History — last 2h" icon={Activity} accentColor={OR_RED}>
            <div style={{ height: 340, padding: 12 }}>
                <ResponsiveContainer>
                    <AreaChart data={OR.ash}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="t" tickFormatter={fmtHour} fontSize={11} />
                        <YAxis
                            fontSize={11}
                            label={{ value: 'Active sessions', angle: -90, position: 'insideLeft', fontSize: 10 }}
                        />
                        <Tooltip labelFormatter={(v: any) => fmtHour(String(v))} />
                        <Legend />
                        <Area
                            type="monotone"
                            dataKey="cpu"
                            stackId="1"
                            stroke={OR_GREEN}
                            fill={OR_GREEN}
                            fillOpacity={0.7}
                            name="CPU"
                        />
                        <Area
                            type="monotone"
                            dataKey="user_io"
                            stackId="1"
                            stroke={OR_NAVY}
                            fill={OR_NAVY}
                            fillOpacity={0.7}
                            name="User I/O"
                        />
                        <Area
                            type="monotone"
                            dataKey="commit"
                            stackId="1"
                            stroke={OR_AMBER}
                            fill={OR_AMBER}
                            fillOpacity={0.7}
                            name="Commit"
                        />
                        <Area
                            type="monotone"
                            dataKey="concurrency"
                            stackId="1"
                            stroke={OR_RED}
                            fill={OR_RED}
                            fillOpacity={0.7}
                            name="Concurrency"
                        />
                        <Area
                            type="monotone"
                            dataKey="network"
                            stackId="1"
                            stroke={THEME.aiDark}
                            fill={THEME.aiDark}
                            fillOpacity={0.7}
                            name="Network"
                        />
                        <Area
                            type="monotone"
                            dataKey="other"
                            stackId="1"
                            stroke="#8D6E63"
                            fill="#8D6E63"
                            fillOpacity={0.7}
                            name="Other"
                        />
                        <ReferenceLine
                            y={80}
                            stroke={THEME.textDim}
                            strokeDasharray="4 4"
                            label={{ value: 'CPU count = 80', fontSize: 10, position: 'right' }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
            <div style={{ padding: '0 16px 12px', fontSize: 11, color: THEME.textDim, fontStyle: 'italic' }}>
                Sourced from v$active_session_history (sampled every 1s). Stacked by wait class — "CPU" is on-CPU;
                everything else is waiting.
            </div>
        </Panel>
    );
}

// ── Top SQL
function TopSqlPanel() {
    return (
        <Panel title="Top SQL — last hour (v$sql)" icon={Zap} accentColor={OR_RED}>
            <DataTable
                accentColor={OR_RED}
                columns={[
                    { key: 'sql_id', label: 'SQL ID' },
                    { key: 'text_preview', label: 'Text preview' },
                    { key: 'execs', label: 'Execs' },
                    { key: 'elapsed', label: 'Elapsed' },
                    { key: 'cpu', label: 'CPU' },
                    { key: 'buffer_gets', label: 'Buffer gets' },
                    { key: 'disk_reads', label: 'Disk reads' },
                    { key: 'user', label: 'User' },
                ]}
                rows={OR.topSql.map((s) => ({
                    sql_id: s.sql_id,
                    text_preview: s.text.slice(0, 64) + (s.text.length > 64 ? '…' : ''),
                    execs: s.execs.toLocaleString(),
                    elapsed: `${s.elapsed_sec} s`,
                    cpu: `${s.cpu_sec} s`,
                    buffer_gets: s.buffer_gets.toLocaleString(),
                    disk_reads: s.disk_reads.toLocaleString(),
                    user: s.user,
                }))}
            />
        </Panel>
    );
}

// ── AWR snapshot browser
function AwrPanel() {
    const [a, setA] = useState<number>(OR.awrSnapshots[1].snap_id);
    const [b, setB] = useState<number>(OR.awrSnapshots[0].snap_id);
    const snapA = OR.awrSnapshots.find((s) => s.snap_id === a)!;
    const snapB = OR.awrSnapshots.find((s) => s.snap_id === b)!;

    function diff(x: number, y: number) {
        const d = y - x;
        const pct = x === 0 ? 0 : (d / x) * 100;
        return { d, pct };
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="AWR snapshots" icon={Camera} accentColor={OR_RED}>
                <DataTable
                    accentColor={OR_RED}
                    columns={[
                        { key: 'snap_id', label: 'Snap ID' },
                        { key: 'start', label: 'Start' },
                        { key: 'end', label: 'End' },
                        { key: 'db_time', label: 'DB time' },
                        { key: 'cpu', label: 'CPU' },
                        { key: 'executes', label: 'Executes' },
                    ]}
                    rows={OR.awrSnapshots.map((s) => ({
                        snap_id: s.snap_id,
                        start: fmtHour(s.start),
                        end: fmtHour(s.end),
                        db_time: `${(s.db_time_sec / 60).toFixed(1)} min`,
                        cpu: `${(s.cpu_sec / 60).toFixed(1)} min`,
                        executes: s.executes.toLocaleString(),
                    }))}
                />
            </Panel>

            <Panel title="Compare snapshots" icon={BarChart3} accentColor={OR_RED}>
                <div style={{ padding: 16 }}>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                        <label>
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>Baseline (A)</div>
                            <select
                                value={a}
                                onChange={(e) => setA(Number(e.target.value))}
                                style={{ padding: 8, borderRadius: 6, border: '1px solid #1a3878' }}
                            >
                                {OR.awrSnapshots.map((s) => (
                                    <option key={s.snap_id} value={s.snap_id}>
                                        {s.snap_id}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <div style={{ fontSize: 11, color: THEME.textMuted }}>Current (B)</div>
                            <select
                                value={b}
                                onChange={(e) => setB(Number(e.target.value))}
                                style={{ padding: 8, borderRadius: 6, border: '1px solid #1a3878' }}
                            >
                                {OR.awrSnapshots.map((s) => (
                                    <option key={s.snap_id} value={s.snap_id}>
                                        {s.snap_id}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr style={{ background: THEME.surfaceHover, borderBottom: `2px solid ${OR_RED}` }}>
                                <th style={{ padding: '10px', textAlign: 'left' }}>Metric</th>
                                <th style={{ padding: '10px', textAlign: 'right' }}>A (#{snapA.snap_id})</th>
                                <th style={{ padding: '10px', textAlign: 'right' }}>B (#{snapB.snap_id})</th>
                                <th style={{ padding: '10px', textAlign: 'right' }}>Δ</th>
                                <th style={{ padding: '10px', textAlign: 'right' }}>Δ %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ['DB time (sec)', snapA.db_time_sec, snapB.db_time_sec],
                                ['CPU time (sec)', snapA.cpu_sec, snapB.cpu_sec],
                                ['Executes', snapA.executes, snapB.executes],
                                ['Logical reads', snapA.logical_reads, snapB.logical_reads],
                                ['Physical reads', snapA.physical_reads, snapB.physical_reads],
                            ].map(([label, aVal, bVal]: any) => {
                                const d = diff(aVal, bVal);
                                const color = d.pct > 20 ? OR_RED : d.pct < -10 ? OR_GREEN : THEME.textDim;
                                return (
                                    <tr key={label} style={{ borderBottom: `1px solid ${THEME.glassBorder}` }}>
                                        <td style={{ padding: '8px 10px' }}>{label}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                            {aVal.toLocaleString()}
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                            {bVal.toLocaleString()}
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', color }}>
                                            {d.d > 0 ? '+' : ''}
                                            {d.d.toLocaleString()}
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right', color, fontWeight: 600 }}>
                                            {d.pct > 0 ? '+' : ''}
                                            {d.pct.toFixed(1)}%
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Panel>
        </div>
    );
}

// ── Data Guard
function DataGuardPanel() {
    const allNodes = [OR.dataGuard.primary, ...OR.dataGuard.standbys];
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Data Guard configuration" icon={GitBranch} accentColor={OR_RED}>
                <div style={{ padding: 20 }}>
                    <svg width="100%" height={220} viewBox="0 0 720 220">
                        {allNodes.map((n, i) => {
                            const x = 80 + i * (560 / (allNodes.length - 1));
                            const isPrim = n.role === 'PRIMARY';
                            const lagColor = n.lag_sec > 10 ? OR_RED : n.lag_sec > 2 ? OR_AMBER : OR_GREEN;
                            return (
                                <g key={n.name}>
                                    {i > 0 && (
                                        <>
                                            <line
                                                x1={80 + (i - 1) * (560 / (allNodes.length - 1))}
                                                y1={100}
                                                x2={x}
                                                y2={100}
                                                stroke={lagColor}
                                                strokeWidth={2}
                                                strokeDasharray={n.lag_sec > 10 ? '6 4' : undefined}
                                            />
                                            <text
                                                x={(80 + (i - 1) * (560 / (allNodes.length - 1)) + x) / 2}
                                                y={94}
                                                textAnchor="middle"
                                                fontSize={10}
                                                fill={THEME.textDim}
                                            >
                                                {n.transport} · {n.lag_sec}s lag
                                            </text>
                                        </>
                                    )}
                                    <circle
                                        cx={x}
                                        cy={100}
                                        r={isPrim ? 38 : 32}
                                        fill={isPrim ? OR_RED : lagColor}
                                        stroke={THEME.surfaceRaised}
                                        strokeWidth={2}
                                    />
                                    <text x={x} y={98} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff">
                                        {isPrim ? 'PRIMARY' : n.role.split(' ')[0]}
                                    </text>
                                    <text x={x} y={112} textAnchor="middle" fontSize={9} fill="#fff" opacity={0.9}>
                                        {isPrim ? '' : n.role.split(' ')[1]}
                                    </text>
                                    <text x={x} y={50} textAnchor="middle" fontSize={12} fontWeight={600}>
                                        {n.name}
                                    </text>
                                    <text x={x} y={156} textAnchor="middle" fontSize={10} fill={THEME.textDim}>
                                        {n.mode}
                                    </text>
                                    {n.lag_sec > 0 && (
                                        <text
                                            x={x}
                                            y={172}
                                            textAnchor="middle"
                                            fontSize={10}
                                            fill={lagColor}
                                            fontWeight={600}
                                        >
                                            lag {n.lag_sec}s
                                        </text>
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                </div>
            </Panel>
            <Panel title="Standby detail" icon={Layers} accentColor={OR_RED}>
                <DataTable
                    accentColor={OR_RED}
                    columns={[
                        { key: 'name', label: 'DB' },
                        { key: 'db_role', label: 'Role' },
                        { key: 'mode', label: 'Mode' },
                        { key: 'transport', label: 'Transport' },
                        { key: 'lag_sec', label: 'Apply lag (s)' },
                        { key: 'redo_rate_kbps', label: 'Redo (KB/s)' },
                    ]}
                    rows={OR.dataGuard.standbys}
                />
            </Panel>
        </div>
    );
}

// ── Waits
function WaitsPanel() {
    const classColor = (c: string) =>
        ({
            'User I/O': OR_NAVY,
            Commit: OR_AMBER,
            Application: OR_RED,
            Concurrency: THEME.aiDark,
            Idle: THEME.textDim,
        })[c] || '#8D6E63';
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Top wait events — last hour" icon={Clock} accentColor={OR_RED}>
                <div style={{ height: 320, padding: 12 }}>
                    <ResponsiveContainer>
                        <BarChart data={OR.waits.filter((w) => w.class !== 'Idle')} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis type="number" fontSize={11} />
                            <YAxis type="category" dataKey="event" width={220} fontSize={10} />
                            <Tooltip />
                            <Bar dataKey="total_sec" radius={[0, 4, 4, 0]}>
                                {OR.waits
                                    .filter((w) => w.class !== 'Idle')
                                    .map((w, i) => (
                                        <Cell key={i} fill={classColor(w.class)} />
                                    ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Panel>
            <Panel title="Wait event detail" icon={Clock} accentColor={OR_RED}>
                <DataTable
                    accentColor={OR_RED}
                    columns={[
                        { key: 'event', label: 'Event' },
                        { key: 'class', label: 'Wait class' },
                        { key: 'waits', label: 'Waits' },
                        { key: 'total_sec', label: 'Total (s)' },
                        { key: 'avg_ms', label: 'Avg (ms)' },
                    ]}
                    rows={OR.waits.map((w) => ({
                        event: w.event,
                        class: w.class,
                        waits: w.waits.toLocaleString(),
                        total_sec: w.total_sec.toString(),
                        avg_ms: w.avg_ms.toFixed(1),
                    }))}
                />
            </Panel>
        </div>
    );
}

// ── Tablespaces
function TablespacePanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Tablespace usage" icon={HardDrive} accentColor={OR_RED}>
                <div style={{ padding: 16 }}>
                    {OR.tablespaces.map((t) => {
                        const color = t.pct > 90 ? OR_RED : t.pct > 75 ? OR_AMBER : OR_GREEN;
                        return (
                            <div key={t.name} style={{ marginBottom: 14 }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'baseline',
                                        marginBottom: 4,
                                    }}
                                >
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                                        {t.name}
                                        {t.warn && (
                                            <AlertTriangle
                                                size={12}
                                                color={OR_RED}
                                                style={{ verticalAlign: 'middle', marginLeft: 6 }}
                                            />
                                        )}
                                    </span>
                                    <span style={{ fontSize: 12, color: THEME.textMuted }}>
                                        {t.used_gb} / {t.size_gb} GB · {t.pct}% · autoextend {t.autoextend}
                                    </span>
                                </div>
                                <div
                                    style={{
                                        height: 10,
                                        background: THEME.glassBorder,
                                        borderRadius: 5,
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${t.pct}%`,
                                            height: '100%',
                                            background: color,
                                            borderRadius: 5,
                                        }}
                                    />
                                </div>
                                <div style={{ fontSize: 11, color: THEME.textDim, marginTop: 2 }}>
                                    Growth last 24h: +{t.growth_day_gb} GB
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Panel>
        </div>
    );
}

// ── Lock blocking tree
function LocksPanel() {
    function renderNode(n: any, depth: number): React.ReactNode {
        const color = n.wait_sec === 0 ? OR_RED : OR_AMBER;
        return (
            <div key={`${n.sid}-${n.serial}`} style={{ marginLeft: depth * 32 }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: 10,
                        background: depth === 0 ? THEME.surfaceHover : THEME.surfaceHover,
                        borderRadius: 8,
                        borderLeft: `3px solid ${color}`,
                        marginBottom: 8,
                    }}
                >
                    <Lock size={14} style={{ color }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                            SID {n.sid}.{n.serial} · {n.user}
                            {n.wait_sec > 0 && (
                                <span style={{ color: OR_AMBER, marginLeft: 8 }}>waiting {n.wait_sec}s</span>
                            )}
                            {n.wait_sec === 0 && depth === 0 && (
                                <span style={{ color: OR_RED, marginLeft: 8 }}>ROOT BLOCKER</span>
                            )}
                        </div>
                        <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 2 }}>
                            {n.lock_type} mode {n.mode} on <code>{n.object}</code> · sql_id <code>{n.sql_id}</code>
                        </div>
                    </div>
                </div>
                {n.blocks.map((c: any) => renderNode(c, depth + 1))}
            </div>
        );
    }
    return (
        <Panel title="Lock blocking tree (v$lock)" icon={Lock} accentColor={OR_RED}>
            <div style={{ padding: 16 }}>
                {OR.locks.blocking_tree.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: THEME.textMuted }}>
                        No blocking sessions.
                    </div>
                ) : (
                    OR.locks.blocking_tree.map((t) => renderNode(t, 0))
                )}
            </div>
        </Panel>
    );
}

// ─────────────────────────────────────────────────────────────────────────

const PANELS = [
    { id: 'overview', label: 'Overview', icon: Gauge },
    { id: 'ash', label: 'ASH', icon: Activity },
    { id: 'topsql', label: 'Top SQL', icon: Zap },
    { id: 'awr', label: 'AWR', icon: Camera },
    { id: 'dataguard', label: 'Data Guard', icon: GitBranch },
    { id: 'waits', label: 'Waits', icon: Clock },
    { id: 'tbs', label: 'Tablespaces', icon: HardDrive },
    { id: 'locks', label: 'Locks', icon: Lock },
];

export default function DemoOracleFullTab({ subTabId }: { subTabId?: string } = {}) {
    useAdaptiveTheme();
    void subTabId;
    const { sections, renderContent } = buildMetricsTab(catalog);
    return (
        <DemoLayout
            title="Oracle Database"
            subtitle="23ai Enterprise · FATHOM_PDB on FATHOM_PRIMARY"
            accentColor={catalog.accentColor}
            connectionBarMeta={{ lastSync: '8s', refreshInterval: '30s' }}
            titleIcon={Database}
            activeDemo="demo-oracle"
            sections={sections}
            renderContent={renderContent}
        />
    );
}
