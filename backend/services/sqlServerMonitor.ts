// @ts-nocheck — new module 2026-10 (see docs/TS_MIGRATION.md)
/**
 * SQL Server monitoring views for the "SQL Server" UI section.
 *
 * Each view runs its panel queries (services/sqlServerQueries.ts) in parallel;
 * one failing panel (permissions, timeout, older version) does not blank the
 * rest of the screen — its message is returned under `errors[panel]`.
 *
 * Every request also takes a cheap "pulse" (performance counters, wait totals,
 * file I/O totals). SQL Server exposes most of these as ever-growing counters,
 * so the difference between two pulses gives real per-second rates; the
 * points are kept in memory per connection (`history`) so the screens can chart
 * trends while any SQL Server screen is open.
 */
import { PULSE, QUERIES } from './sqlServerQueries.js';

export const SQL_SERVER_VIEWS = Object.keys(QUERIES);

const PULSE_MIN_INTERVAL_MS = 5_000;
const HISTORY_POINTS = 240;

// cntr_type values from sys.dm_os_performance_counters
const PERF_COUNTER_BULK_COUNT = 272696576; // cumulative, per-second rate
const PERF_AVERAGE_BULK = 1073874176; // average with a matching "base"

const RATES = {
    batchPerSec: 'SQL Statistics|Batch Requests/sec',
    compilationsPerSec: 'SQL Statistics|SQL Compilations/sec',
    recompilationsPerSec: 'SQL Statistics|SQL Re-Compilations/sec',
    transactionsPerSec: 'Databases|Transactions/sec',
    logFlushesPerSec: 'Databases|Log Flushes/sec',
    logBytesFlushedPerSec: 'Databases|Log Bytes Flushed/sec',
    loginsPerSec: 'General Statistics|Logins/sec',
    errorsPerSec: 'SQL Errors|Errors/sec',
    lockRequestsPerSec: 'Locks|Lock Requests/sec',
    lockWaitsPerSec: 'Locks|Lock Waits/sec',
    lockTimeoutsPerSec: 'Locks|Lock Timeouts/sec',
    deadlocksPerSec: 'Locks|Number of Deadlocks/sec',
    pageSplitsPerSec: 'Access Methods|Page Splits/sec',
    fullScansPerSec: 'Access Methods|Full Scans/sec',
    indexSearchesPerSec: 'Access Methods|Index Searches/sec',
    rangeScansPerSec: 'Access Methods|Range Scans/sec',
    worktablesPerSec: 'Access Methods|Worktables Created/sec',
    workfilesPerSec: 'Access Methods|Workfiles Created/sec',
    forwardedRecordsPerSec: 'Access Methods|Forwarded Records/sec',
    lazyWritesPerSec: 'Buffer Manager|Lazy writes/sec',
    checkpointPagesPerSec: 'Buffer Manager|Checkpoint pages/sec',
    pageReadsPerSec: 'Buffer Manager|Page reads/sec',
    pageWritesPerSec: 'Buffer Manager|Page writes/sec',
    readaheadPagesPerSec: 'Buffer Manager|Readahead pages/sec',
};
const RAW = {
    pageLifeExpectancy: 'Buffer Manager|Page life expectancy',
    databasePages: 'Buffer Manager|Database pages',
    userConnections: 'General Statistics|User Connections',
    processesBlocked: 'General Statistics|Processes blocked',
    memoryGrantsPending: 'Memory Manager|Memory Grants Pending',
    memoryGrantsOutstanding: 'Memory Manager|Memory Grants Outstanding',
    totalServerMemoryKb: 'Memory Manager|Total Server Memory (KB)',
    targetServerMemoryKb: 'Memory Manager|Target Server Memory (KB)',
    stolenServerMemoryKb: 'Memory Manager|Stolen Server Memory (KB)',
    freeMemoryKb: 'Memory Manager|Free Memory (KB)',
    databaseCacheMemoryKb: 'Memory Manager|Database Cache Memory (KB)',
    versionStoreKb: 'Transactions|Version Store Size (KB)',
    tempdbFreeKb: 'Transactions|Free Space in tempdb (KB)',
    longestTransactionSec: 'Transactions|Longest Transaction Running Time',
    activeTransactions: 'Databases|Active Transactions',
    planCachePages: 'Plan Cache|Cache Pages',
};
const RATIOS = {
    bufferCacheHitPct: 'Buffer Manager|Buffer cache hit ratio',
    planCacheHitPct: 'Plan Cache|Cache Hit Ratio',
};
// [value counter, base counter] — the base is not always named "<value> base".
const AVERAGES = {
    avgLockWaitMs: ['Locks|Average Wait Time (ms)', 'Locks|Average Wait Time Base'],
};

// History fields each screen charts — keeps the payload small.
const HISTORY_FIELDS = {
    overview: ['batchPerSec', 'compilationsPerSec', 'recompilationsPerSec', 'transactionsPerSec', 'userConnections',
        'pageLifeExpectancy', 'bufferCacheHitPct', 'processesBlocked', 'deadlocksPerSec', 'errorsPerSec'],
    performance: ['waits', 'signalWaitPct', 'pageSplitsPerSec', 'fullScansPerSec', 'indexSearchesPerSec',
        'lockWaitsPerSec', 'deadlocksPerSec', 'worktablesPerSec', 'compilationsPerSec', 'batchPerSec'],
    sessions: ['userConnections', 'processesBlocked', 'lockWaitsPerSec', 'deadlocksPerSec', 'avgLockWaitMs'],
    memory: ['totalServerMemoryKb', 'targetServerMemoryKb', 'stolenServerMemoryKb', 'databaseCacheMemoryKb',
        'pageLifeExpectancy', 'lazyWritesPerSec', 'memoryGrantsPending', 'bufferCacheHitPct'],
    io: ['readsPerSec', 'writesPerSec', 'readMBps', 'writeMBps', 'readLatencyMs', 'writeLatencyMs',
        'logFlushesPerSec', 'checkpointPagesPerSec', 'pageReadsPerSec', 'pageWritesPerSec'],
};

const pulses = new Map(); // connectionId -> { prev, history, live }

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const round = (v, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? null : Number(v.toFixed(d)));

function counterIndex(rows) {
    const idx = new Map();
    for (const r of rows || []) {
        idx.set(`${r.obj}|${r.counter_name}`.toLowerCase(), { value: num(r.cntr_value), type: Number(r.cntr_type) });
    }
    return idx;
}
const get = (idx, key) => idx.get(key.toLowerCase());
const baseOf = (idx, key) => get(idx, `${key} base`);

function snapshot(raw) {
    return {
        at: Date.now(),
        counters: counterIndex(raw.counters),
        waits: Object.fromEntries(
            (raw.waits || []).map((w) => [w.category, { wait: num(w.wait_ms), signal: num(w.signal_ms) }]),
        ),
        io: raw.io?.[0] || null,
    };
}

function instantMetrics(cur) {
    const out = {};
    for (const [name, key] of Object.entries(RAW)) out[name] = get(cur.counters, key)?.value ?? null;
    for (const [name, key] of Object.entries(RATIOS)) {
        const v = get(cur.counters, key)?.value;
        const b = baseOf(cur.counters, key)?.value;
        out[name] = v !== undefined && v !== null && b ? round(Math.min(100, (100 * v) / b)) : null;
    }
    return out;
}

function rateMetrics(prev, cur) {
    const secs = (cur.at - prev.at) / 1000;
    const out = {};
    for (const [name, key] of Object.entries(RATES)) {
        const a = get(prev.counters, key);
        const b = get(cur.counters, key);
        out[name] =
            a && b && b.type === PERF_COUNTER_BULK_COUNT && b.value >= a.value ? round((b.value - a.value) / secs) : null;
    }
    for (const [name, [key, baseKey]] of Object.entries(AVERAGES)) {
        const a = get(prev.counters, key);
        const b = get(cur.counters, key);
        const ab = get(prev.counters, baseKey);
        const bb = get(cur.counters, baseKey);
        if (!a || !b || !ab || !bb || b.type !== PERF_AVERAGE_BULK) out[name] = null;
        else {
            const dBase = bb.value - ab.value;
            out[name] = dBase > 0 ? round((b.value - a.value) / dBase) : dBase === 0 ? 0 : null;
        }
    }
    // Wait time accrued per second, by category, plus the signal (CPU queue) share.
    const waits = {};
    let dWait = 0;
    let dSignal = 0;
    for (const [cat, w] of Object.entries(cur.waits)) {
        const p = prev.waits[cat];
        if (!p || w.wait < p.wait) continue;
        waits[cat] = round((w.wait - p.wait) / secs, 1);
        dWait += w.wait - p.wait;
        dSignal += w.signal - p.signal;
    }
    out.waits = waits;
    out.signalWaitPct = dWait > 0 ? round((100 * dSignal) / dWait, 1) : null;
    // File I/O
    const a = prev.io;
    const b = cur.io;
    if (a && b) {
        const dr = num(b.reads) - num(a.reads);
        const dw = num(b.writes) - num(a.writes);
        out.readsPerSec = dr >= 0 ? round(dr / secs) : null;
        out.writesPerSec = dw >= 0 ? round(dw / secs) : null;
        out.readMBps = dr >= 0 ? round((num(b.bytes_read) - num(a.bytes_read)) / 1048576 / secs, 3) : null;
        out.writeMBps = dw >= 0 ? round((num(b.bytes_written) - num(a.bytes_written)) / 1048576 / secs, 3) : null;
        out.readLatencyMs = dr > 0 ? round((num(b.stall_read_ms) - num(a.stall_read_ms)) / dr) : dr === 0 ? 0 : null;
        out.writeLatencyMs = dw > 0 ? round((num(b.stall_write_ms) - num(a.stall_write_ms)) / dw) : dw === 0 ? 0 : null;
    }
    return out;
}

/** Fold a pulse into the per-connection state; returns { live, history }. */
export function recordPulse(connectionId, raw, now = Date.now()) {
    const cur = { ...snapshot(raw), at: now };
    const state = pulses.get(connectionId) || { prev: null, history: [], live: null };
    const instant = instantMetrics(cur);
    if (state.prev && cur.at - state.prev.at >= PULSE_MIN_INTERVAL_MS) {
        // A restart resets the counters; rateMetrics turns negative deltas into nulls.
        const point = { t: new Date(cur.at).toISOString(), ...instant, ...rateMetrics(state.prev, cur) };
        state.history.push(point);
        if (state.history.length > HISTORY_POINTS) state.history.splice(0, state.history.length - HISTORY_POINTS);
        state.live = point;
        state.prev = cur;
    } else if (!state.prev) {
        state.prev = cur;
        state.live = { t: new Date(cur.at).toISOString(), ...instant };
    } else {
        // Too soon for a fair rate: keep the last rates, refresh the instantaneous values.
        state.live = { ...(state.live || {}), ...instant };
    }
    pulses.set(connectionId, state);
    return state;
}

/* ── deadlock graphs (system_health xml_deadlock_report) ─────────────────── */
const decode = (s) =>
    String(s ?? '')
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
const attrs = (s) => Object.fromEntries([...String(s).matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]));

export function parseDeadlock(xml) {
    if (!xml) return null;
    const victims = [...xml.matchAll(/<victimProcess\s([^>]*?)\/>/g)].map((m) => attrs(m[1]).id);
    const processes = [...xml.matchAll(/<process\s([^>]*)>([\s\S]*?)<\/process>/g)].map((m) => {
        const a = attrs(m[1]);
        const input = m[2].match(/<inputbuf>([\s\S]*?)<\/inputbuf>/);
        return {
            id: a.id,
            spid: num(a.spid),
            login: a.loginname || null,
            host: a.hostname || null,
            app: a.clientapp || null,
            database: a.currentdbname || a.currentdb || null,
            lockMode: a.lockMode || null,
            waitResource: a.waitresource || null,
            waitTimeMs: num(a.waittime),
            isolation: a.isolationlevel || null,
            statement: decode(input?.[1] || '').trim().slice(0, 2000),
            isVictim: victims.includes(a.id),
        };
    });
    const resources = [];
    const edges = [];
    const list = xml.match(/<resource-list>([\s\S]*?)<\/resource-list>/)?.[1] || '';
    const resourceRe = /<(\w+)\s([^>]*)>\s*<owner-list>([\s\S]*?)<\/owner-list>\s*<waiter-list>([\s\S]*?)<\/waiter-list>\s*<\/\1>/g;
    for (const m of list.matchAll(resourceRe)) {
        const a = attrs(m[2]);
        const label = [a.objectname, a.indexname].filter(Boolean).join(' / ') || m[1];
        resources.push({ type: m[1], object: a.objectname || null, index: a.indexname || null, mode: a.mode || null });
        const owners = [...m[3].matchAll(/<owner\s([^>]*?)\/>/g)].map((o) => attrs(o[1]));
        const waiters = [...m[4].matchAll(/<waiter\s([^>]*?)\/>/g)].map((w) => attrs(w[1]));
        for (const w of waiters) {
            for (const o of owners) {
                edges.push({ from: w.id, to: o.id, resource: label, waitMode: w.mode || null, holdMode: o.mode || null });
            }
        }
    }
    return { victims, processes, resources, edges };
}

/* ── shaping ─────────────────────────────────────────────────────────────── */
const SECURITY_CONFIG = {
    xp_cmdshell: { recommended: 0, why: 'Lets T-SQL run operating-system commands.' },
    'clr enabled': { recommended: 0, why: 'Allows .NET assemblies inside SQL Server; enable only if used.' },
    'clr strict security': { recommended: 1, why: 'Treats all CLR assemblies as UNSAFE unless signed.' },
    'Ole Automation Procedures': { recommended: 0, why: 'Lets T-SQL instantiate COM objects.' },
    'remote admin connections': { recommended: null, why: 'Remote dedicated admin connection — useful for emergencies.' },
    'Ad Hoc Distributed Queries': { recommended: 0, why: 'Allows OPENROWSET/OPENDATASOURCE to arbitrary sources.' },
    'cross db ownership chaining': { recommended: 0, why: 'Ownership chains across databases bypass permission checks.' },
    'Database Mail XPs': { recommended: null, why: 'Needed only if the server sends mail.' },
    'scan for startup procs': { recommended: 0, why: 'Runs procedures automatically at startup.' },
    'contained database authentication': { recommended: 0, why: 'Users can authenticate without a server login.' },
    'remote access': { recommended: 0, why: 'Deprecated remote stored-procedure calls.' },
    'default trace enabled': { recommended: 1, why: 'Lightweight trace used for troubleshooting and auditing.' },
};

function shapeSecurity(data) {
    if (data.config) {
        data.config = data.config.map((c) => {
            const rule = SECURITY_CONFIG[c.name] || {};
            const atRisk =
                rule.recommended !== null && rule.recommended !== undefined && Number(c.value_in_use) !== rule.recommended;
            return { ...c, recommended: rule.recommended ?? null, why: rule.why || null, at_risk: atRisk ? 1 : 0 };
        });
    }
    return data;
}

export function buildAlerts(data, live, now = Date.now()) {
    const alerts = [];
    const add = (severity, title, detail = null) => alerts.push({ severity, title, detail });
    const a = data.activity?.[0] || {};
    const s = data.server?.[0] || {};
    const mem = data.memory?.[0] || {};
    const cpu = data.cpuHistory?.[0];

    for (const d of data.databases || []) {
        if (d.state_desc && d.state_desc !== 'ONLINE') add('critical', `Database ${d.name} is ${d.state_desc}`);
    }
    if (Number(a.blocked_requests) > 0) {
        add(
            'warning',
            `${a.blocked_requests} blocked request(s)`,
            `Longest wait ${Math.round(Number(a.longest_block_ms) / 1000)} s — see Sessions & Locks.`,
        );
    }
    if (cpu && cpu.sql_cpu_pct !== null && cpu.sql_cpu_pct !== undefined) {
        if (cpu.sql_cpu_pct >= 90) add('critical', `SQL Server CPU at ${cpu.sql_cpu_pct}%`);
        else if (cpu.sql_cpu_pct >= 75) add('warning', `SQL Server CPU at ${cpu.sql_cpu_pct}%`);
    }
    if (s.scheduler_count && Number(a.runnable_tasks) >= Number(s.scheduler_count)) {
        add('warning', `${a.runnable_tasks} tasks waiting for CPU`, 'At least one runnable task per scheduler — CPU pressure.');
    }
    if (live?.pageLifeExpectancy !== null && live?.pageLifeExpectancy !== undefined && live.pageLifeExpectancy < 300) {
        add('warning', `Page life expectancy is ${live.pageLifeExpectancy} s`, 'Pages leave the buffer pool quickly — memory pressure.');
    }
    if (live?.bufferCacheHitPct !== null && live?.bufferCacheHitPct !== undefined && live.bufferCacheHitPct < 95) {
        add('warning', `Buffer cache hit ratio ${live.bufferCacheHitPct}%`);
    }
    if (Number(live?.memoryGrantsPending) > 0) add('warning', `${live.memoryGrantsPending} queries waiting for a memory grant`);
    if (Number(live?.deadlocksPerSec) > 0) add('warning', 'Deadlocks occurring right now', 'See Sessions & Locks for the deadlock graph.');
    if (mem.process_physical_memory_low) add('warning', 'SQL Server reports low physical memory');
    if (mem.system_memory_state_desc && /low/i.test(mem.system_memory_state_desc)) add('warning', mem.system_memory_state_desc);
    if (mem.max_server_memory_mb && Number(mem.max_server_memory_mb) >= 2147483647) {
        add('info', 'Max server memory is not set', 'SQL Server can take memory the OS needs; set "max server memory".');
    }

    // Backup checks only when msdb was readable — never guess.
    if (data.backupAges) {
        const backups = Object.fromEntries(data.backupAges.map((b) => [b.database_name, b]));
        for (const d of data.databases || []) {
            // model is only a template; master/msdb matter for a rebuild but are not user data.
            if (d.name === 'tempdb' || d.name === 'model' || d.state_desc !== 'ONLINE') continue;
            const level = d.name === 'master' || d.name === 'msdb' ? 'info' : 'warning';
            const b = backups[d.name];
            const full = b?.last_full ? new Date(b.last_full).getTime() : null;
            if (!full) add(level, `${d.name} has never had a full backup`);
            else if (now - full > 7 * 86400_000) {
                add(level, `${d.name}: last full backup ${Math.floor((now - full) / 86400_000)} days ago`);
            }
            if (d.recovery_model_desc === 'FULL' && d.name !== 'model') {
                const log = b?.last_log ? new Date(b.last_log).getTime() : null;
                if (!log || now - log > 86400_000) {
                    add('warning', `${d.name} is in FULL recovery without a log backup in 24 h`, 'The transaction log keeps growing until it is backed up.');
                }
            }
        }
    }
    for (const d of data.databases || []) {
        if (d.is_auto_shrink_on) add('info', `Auto-shrink is on for ${d.name}`);
        if (d.is_auto_close_on) add('info', `Auto-close is on for ${d.name}`);
        if (d.page_verify_option_desc && d.page_verify_option_desc !== 'CHECKSUM' && d.name !== 'tempdb') {
            add('info', `${d.name} page verify is ${d.page_verify_option_desc}`, 'CHECKSUM detects corruption earliest.');
        }
    }
    const rank = { critical: 0, warning: 1, info: 2 };
    return alerts.sort((x, y) => rank[x.severity] - rank[y.severity]);
}

async function runPanels(adapter, queries) {
    const data = {};
    const errors = {};
    await Promise.all(
        Object.entries(queries).map(async ([panel, sql]) => {
            try {
                data[panel] = (await adapter.query(sql)).rows || [];
            } catch (e) {
                errors[panel] = e.message;
                data[panel] = null;
            }
        }),
    );
    return { data, errors };
}

/**
 * Run one view's queries through a connected engine adapter.
 * @returns {Promise<{ view, data, errors, live, history?, collectedAt }>}
 */
export async function collectSqlServerView(adapter, view, connectionId) {
    const queries = QUERIES[view];
    if (!queries) throw Object.assign(new Error(`Unknown SQL Server view "${view}"`), { status: 404 });

    const [{ data, errors }, pulseRaw] = await Promise.all([runPanels(adapter, queries), runPanels(adapter, PULSE)]);
    const pulse = recordPulse(connectionId, pulseRaw.data);

    if (view === 'overview') data.alerts = buildAlerts(data, pulse.live);
    if (view === 'sessions' && data.deadlocks) {
        data.deadlocks = data.deadlocks.map((d) => ({ event_time: d.event_time, ...parseDeadlock(d.deadlock_xml) }));
    }
    if (view === 'security') shapeSecurity(data);
    if (pulseRaw.errors.counters) errors.pulse = pulseRaw.errors.counters;

    const result = { view, data, errors, live: pulse.live, collectedAt: new Date().toISOString() };
    const fields = HISTORY_FIELDS[view];
    if (fields) {
        result.history = pulse.history.map((p) => Object.fromEntries([['t', p.t], ...fields.map((f) => [f, p[f] ?? null])]));
    }
    return result;
}
