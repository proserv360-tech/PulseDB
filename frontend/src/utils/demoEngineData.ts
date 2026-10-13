import { THEME } from './theme';
// ==========================================================================
//  PulseDB — Per-engine demo data for the 9 engines added in Phase-5.
//
//  Shape mirrors what the real adapters return so the demo UI lights up
//  with the exact fields operators will see in production. Every engine
//  provides mock values for the 12 metric panels in the Engine Coverage
//  sheet of the competitive matrix.
//
//  Engines covered:
//    SQL Server, Oracle, Redis, Elasticsearch, Snowflake, BigQuery,
//    Redshift, Cassandra, DynamoDB
// ==========================================================================

export type EngineKey =
    | 'mssql'
    | 'oracle'
    | 'redis'
    | 'elasticsearch'
    | 'snowflake'
    | 'bigquery'
    | 'redshift'
    | 'cassandra'
    | 'dynamodb';

type KpiTile = { label: string; value: string; unit: string; trend?: 'up' | 'down' | 'flat'; sparkline?: number[] };
type SlowQuery = { query: string; metric: string; note?: string };
type IndexRow = { schema: string; table: string; kind: string; definition: string };
type ConnRow  = { session: string; user: string; kind?: string; started?: string; running_sec?: number };
type LockRow  = { note: string; rows: Array<Record<string, unknown>> };
type ReplRow  = { note: string; rows: Array<Record<string, unknown>> };
type WaitRow  = { event: string; ms?: number; micros?: number; note?: string };
type AlertRow = { severity: 'critical' | 'warning' | 'info'; title: string; time: string; source: string };

export type SignatureWidget =
    /** Stacked-area showing credits used by warehouse over 24h. */
    | { kind: 'credits_by_warehouse'; series: Array<{ name: string; data: Array<{ t: string; v: number }> }>; total: string }
    /** Time-series of bytes billed + cost estimate. */
    | { kind: 'bytes_billed';          area: Array<{ t: string; gb: number; cost: number }>; dailyEstimate: string }
    /** Donut of top 5 wait types. */
    | { kind: 'wait_donut';            slices: Array<{ name: string; value: number; color: string }> }
    /** Dual line: active sessions (historical) + current events. */
    | { kind: 'session_history';       activeSessions: Array<{ t: string; sessions: number; waiting: number }> }
    /** Dual-axis chart for memory vs ops/sec. */
    | { kind: 'memory_ops';            series: Array<{ t: string; mem_mb: number; ops: number }> }
    /** Dual-line indexing rate vs search rate. */
    | { kind: 'indexing_vs_search';    series: Array<{ t: string; index_ps: number; search_ps: number; p95_ms: number }> }
    /** Stacked-bar WLM queue timings. */
    | { kind: 'wlm_queues';            bars: Array<{ queue: string; exec_ms: number; queue_ms: number }> }
    /** Read/write with hinted handoff count. */
    | { kind: 'rw_hinted';             series: Array<{ t: string; reads: number; writes: number; hints: number }> }
    /** Consumed WCU/RCU stacked area + throttle bar overlay. */
    | { kind: 'dynamo_capacity';       series: Array<{ t: string; wcu: number; rcu: number; throttles: number }> };

/** Per-replica topology node for the Replication panel SVG. */
export type ReplicaNode = {
    id: string;
    role: 'primary' | 'replica' | 'standby' | 'coordinator' | 'worker';
    region?: string;
    lag_ms?: number;
    status?: 'healthy' | 'degraded' | 'down';
};

export interface EngineDemoSpec {
    key: EngineKey;
    name: string;
    accentColor: string;
    versionString: string;
    identity: Record<string, string>;
    catalog: Array<{ name: string; kind?: string; location?: string }>;
    kpis: KpiTile[];
    /** Time-series for each KPI, keyed by KPI label. */
    timeseries: Record<string, Array<{ t: string; v: number }>>;
    /** Engine-distinctive hero widget shown on the Overview panel. */
    signature: SignatureWidget;
    /** Active/recent alerts to show in the Overview header. */
    alerts: AlertRow[];
    /** Normalised replica topology for the Replication panel. */
    topology: ReplicaNode[];
    slowQueries: SlowQuery[];
    plan: { note: string; body: string };
    waits: { window: string; events: WaitRow[]; note?: string };
    tables: Array<{ schema: string; name: string; rows?: number; bytes?: number; note?: string }>;
    indexes: IndexRow[];
    connections: ConnRow[];
    locks: LockRow;
    replication: ReplRow;
    bloat: Array<Record<string, unknown>>;
    substitutes: string[];
}

// Helper: build a 24-point time-series at 5-minute spacing ending "now".
export function makeTs(base: number, variance: number, n = 24, trend = 0): Array<{ t: string; v: number }> {
    const out: Array<{ t: string; v: number }> = [];
    for (let i = 0; i < n; i++) {
        const t = new Date(Date.now() - (n - 1 - i) * 5 * 60 * 1000).toISOString();
        const v = +(base + Math.sin(i / 2) * variance + (Math.random() - 0.5) * variance * 0.6 + trend * i).toFixed(3);
        out.push({ t, v });
    }
    return out;
}

/** Pad a spec at module load with sensible time-series defaults derived from KPIs. */
function withDerivedTs(spec: Omit<EngineDemoSpec, 'timeseries'> & { timeseries?: EngineDemoSpec['timeseries'] }): EngineDemoSpec {
    const ts = spec.timeseries || {};
    for (const k of spec.kpis) {
        if (!ts[k.label] && k.sparkline) {
            ts[k.label] = k.sparkline.map((v, i) => ({
                t: new Date(Date.now() - (k.sparkline!.length - 1 - i) * 5 * 60 * 1000).toISOString(),
                v,
            }));
        }
    }
    return { ...spec, timeseries: ts } as EngineDemoSpec;
}

// ─────────────────────────────────────────────────────────────────────────────
const sparkline = (base: number, variance: number, n = 12): number[] =>
    Array.from({ length: n }, (_, i) => +(base + (Math.sin(i / 2) + Math.random() * 0.5 - 0.25) * variance).toFixed(2));

const isoAgoSec = (s: number) => new Date(Date.now() - s * 1000).toISOString();

// ─────────────────────────────────────────────────────────────────────────────
//  SQL Server
// ─────────────────────────────────────────────────────────────────────────────
export const DEMO_MSSQL: EngineDemoSpec = withDerivedTs({
    key:  'mssql',
    name: 'Microsoft SQL Server',
    accentColor:   '#CC2927',
    versionString: 'SQL Server 2022 (16.0.4085.2) - CU13',
    identity: { edition: 'Enterprise', collation: 'SQL_Latin1_General_CP1_CI_AS', product_level: 'RTM' },
    catalog: [
        { name: 'master' }, { name: 'tempdb' }, { name: 'model' },
        { name: 'msdb' },   { name: 'pulsedb_prod' }, { name: 'pulsedb_staging' },
    ],
    kpis: [
        { label: 'Batch req/sec', value: '12,480', unit: '',    trend: 'up',   sparkline: sparkline(12400, 400) },
        { label: 'Buffer hit',    value: '99.7',   unit: '%',   trend: 'flat', sparkline: sparkline(99.5, 0.3) },
        { label: 'Page life exp', value: '8,214',  unit: 's',   trend: 'up',   sparkline: sparkline(8200, 200) },
        { label: 'Deadlocks',     value: '2',      unit: '/hr', trend: 'flat', sparkline: sparkline(2, 1) },
        { label: 'Active conns',  value: '147',    unit: '',    trend: 'up',   sparkline: sparkline(145, 10) },
    ],
    slowQueries: [
        { query: "SELECT o.*, c.name FROM dbo.Orders o JOIN dbo.Customers c ...", metric: '842 ms avg' },
        { query: "EXEC sp_RebuildOrderIndex @TableName = 'Orders'",                metric: '612 ms avg' },
        { query: "SELECT TOP 100 * FROM dbo.AuditLog ORDER BY CreatedAt DESC",    metric: '498 ms avg' },
        { query: "UPDATE dbo.Inventory SET StockCount = StockCount - 1 WHERE ...",metric: '411 ms avg' },
    ],
    plan: {
        note: 'Captured via SET SHOWPLAN_XML ON',
        body: `Hash Match (Inner Join)  [cost 0.842]
├── Clustered Index Scan: dbo.Orders.PK_Orders (1.2M rows)
└── Index Seek: dbo.Customers.IX_Customer_Id
Missing index recommendation: CREATE INDEX IX_Orders_CustomerId ON dbo.Orders (CustomerId) INCLUDE (OrderDate, Total)`,
    },
    waits: { window: '1h', events: [
        { event: 'PAGEIOLATCH_SH', ms: 412_000 },
        { event: 'LCK_M_S',        ms:  98_120 },
        { event: 'CXPACKET',       ms:  71_400 },
        { event: 'WRITELOG',       ms:  32_800 },
        { event: 'SOS_SCHEDULER_YIELD', ms: 18_600 },
    ]},
    tables: [
        { schema: 'dbo', name: 'Orders',     rows: 1_284_920, bytes: 2_104_221_312 },
        { schema: 'dbo', name: 'Customers',  rows:   184_412, bytes:   289_212_416 },
        { schema: 'dbo', name: 'LineItems',  rows: 6_832_120, bytes: 8_921_002_112 },
        { schema: 'dbo', name: 'AuditLog',   rows:19_281_000, bytes:14_210_884_096 },
    ],
    indexes: [
        { schema: 'dbo', table: 'Orders',    kind: 'clustered',    definition: 'PK_Orders (Id)' },
        { schema: 'dbo', table: 'Orders',    kind: 'nonclustered', definition: 'IX_Orders_OrderDate (OrderDate)' },
        { schema: 'dbo', table: 'Customers', kind: 'clustered',    definition: 'PK_Customers (Id)' },
        { schema: 'dbo', table: 'LineItems', kind: 'nonclustered', definition: 'IX_LineItems_OrderId (OrderId)' },
    ],
    connections: [
        { session: '54',  user: 'app_service', kind: 'Session', started: isoAgoSec(4120) },
        { session: '62',  user: 'etl_batch',   kind: 'Session', started: isoAgoSec(210)  },
        { session: '73',  user: 'reporting',   kind: 'Session', started: isoAgoSec(45)   },
    ],
    locks: {
        note: 'Rows from sys.dm_tran_locks — shared + intent locks on active transactions.',
        rows: [
            { resource: 'Orders.PK_Orders',    mode: 'S',  status: 'GRANT', spid: 54 },
            { resource: 'Customers.PK_Cust',   mode: 'IX', status: 'GRANT', spid: 62 },
            { resource: 'LineItems.PK_LI',     mode: 'X',  status: 'WAIT',  spid: 73 },
        ],
    },
    replication: {
        note: 'Always-On AG: PULSEDB_AG — 1 primary + 2 secondaries.',
        rows: [
            { replica: 'sql-primary',   role: 'PRIMARY',   sync_state: 'SYNCHRONIZED',   lag_sec: 0 },
            { replica: 'sql-sec-east',  role: 'SECONDARY', sync_state: 'SYNCHRONIZED',   lag_sec: 1.2 },
            { replica: 'sql-sec-west',  role: 'SECONDARY', sync_state: 'SYNCHRONIZING',  lag_sec: 8.4 },
        ],
    },
    bloat: [
        { table: 'dbo.AuditLog',   fragmentation_pct: 42.1, page_density: 68.2, action: 'REORGANIZE' },
        { table: 'dbo.LineItems',  fragmentation_pct: 18.8, page_density: 82.4, action: 'UPDATE STATISTICS' },
    ],
    substitutes: [],
    alerts: [
        { severity: 'warning',  title: 'dbo.AuditLog fragmentation 42%',   time: '8m ago', source: 'index-advisor' },
        { severity: 'info',     title: 'AlwaysOn replica "sql-sec-west" lag 8s', time: '14m ago', source: 'replication' },
    ],
    topology: [
        { id: 'sql-primary',  role: 'primary', region: 'us-east-1', lag_ms: 0,    status: 'healthy' },
        { id: 'sql-sec-east', role: 'replica', region: 'us-east-1', lag_ms: 1200, status: 'healthy' },
        { id: 'sql-sec-west', role: 'replica', region: 'us-west-2', lag_ms: 8400, status: 'degraded' },
    ],
    signature: {
        kind: 'wait_donut',
        slices: [
            { name: 'PAGEIOLATCH_SH', value: 412_000, color: '#CC2927' },
            { name: 'LCK_M_S',        value:  98_120, color: THEME.dangerLight },
            { name: 'CXPACKET',       value:  71_400, color: '#FFD8B1' },
            { name: 'WRITELOG',       value:  32_800, color: THEME.successLight },
            { name: 'Other',          value:  41_400, color: THEME.aiLight },
        ],
    },
});

// ─────────────────────────────────────────────────────────────────────────────
//  Oracle
// ─────────────────────────────────────────────────────────────────────────────
export const DEMO_ORACLE: EngineDemoSpec = withDerivedTs({
    key:  'oracle',
    name: 'Oracle Database',
    accentColor:   '#F80000',
    versionString: 'Oracle Database 23ai Enterprise Edition',
    identity: { container: 'CDB$ROOT', pdb: 'PULSEDB_PDB', platform: 'Linux x86-64' },
    catalog: [
        { name: 'SYS' }, { name: 'SYSTEM' }, { name: 'PULSEDB_APP' },
        { name: 'PULSEDB_REPORT' }, { name: 'AUDIT_ADMIN' },
    ],
    kpis: [
        { label: 'Executes/sec',   value: '9,421',  unit: '',    sparkline: sparkline(9400, 300) },
        { label: 'SGA hit ratio',  value: '98.4',   unit: '%',   sparkline: sparkline(98, 0.5) },
        { label: 'Active sessions',value: '86',     unit: '',    sparkline: sparkline(85, 5) },
        { label: 'Redo generation',value: '24',     unit: 'MB/s',sparkline: sparkline(22, 4) },
        { label: 'SGA target',     value: '24',     unit: 'GB' },
    ],
    slowQueries: [
        { query: "SELECT /*+ PARALLEL(8) */ * FROM pulsedb_app.transactions WHERE ...", metric: '1,242 ms avg' },
        { query: "MERGE INTO pulsedb_app.inventory i USING (...) src ON (i.sku=src.sku)", metric: '842 ms avg' },
        { query: "BEGIN pkg_audit.flush_buffer; END;",                                  metric: '512 ms avg' },
    ],
    plan: {
        note: 'EXPLAIN PLAN via DBMS_XPLAN.DISPLAY_CURSOR',
        body: `HASH JOIN  cost=1842
├── TABLE ACCESS FULL  TRANSACTIONS  cost=1204
└── INDEX RANGE SCAN   IX_TX_DATE    cost=38`,
    },
    waits: { window: '1h', events: [
        { event: 'db file sequential read', ms: 318_000 },
        { event: 'log file sync',           ms: 124_800 },
        { event: 'enq: TX - row lock contention', ms: 48_200 },
        { event: 'library cache: mutex X',  ms:  18_600 },
        { event: 'direct path read',        ms:  12_400 },
    ]},
    tables: [
        { schema: 'PULSEDB_APP',    name: 'TRANSACTIONS', rows: 88_142_000, bytes: 142_211_002_112 },
        { schema: 'PULSEDB_APP',    name: 'CUSTOMERS',    rows:    412_800, bytes:     890_210_816 },
        { schema: 'PULSEDB_REPORT', name: 'MV_DAILY_KPI', rows:     30_420, bytes:     210_001_920 },
    ],
    indexes: [
        { schema: 'PULSEDB_APP', table: 'TRANSACTIONS', kind: 'b-tree',     definition: 'PK_TX (ID)' },
        { schema: 'PULSEDB_APP', table: 'TRANSACTIONS', kind: 'bitmap',     definition: 'BMX_TX_STATUS (STATUS)' },
        { schema: 'PULSEDB_APP', table: 'CUSTOMERS',    kind: 'function',   definition: 'FN_UPPER_EMAIL (UPPER(EMAIL))' },
    ],
    connections: [
        { session: '142', user: 'PULSEDB_APP',    kind: 'DEDICATED', started: isoAgoSec(8240) },
        { session: '168', user: 'PULSEDB_REPORT', kind: 'DEDICATED', started: isoAgoSec(302) },
    ],
    locks: {
        note: 'Rows from V$LOCK for non-idle sessions.',
        rows: [
            { sid: 142, type: 'TX', mode: 6, request: 0, blocking: 0 },
            { sid: 168, type: 'TM', mode: 3, request: 0, blocking: 0 },
            { sid: 221, type: 'TX', mode: 6, request: 6, blocking: 142 },
        ],
    },
    replication: {
        note: 'Data Guard: 1 primary + 1 physical + 1 logical standby.',
        rows: [
            { replica: 'PULSEDB_PRIMARY', role: 'PRIMARY',          lag_sec: 0,  protection_mode: 'MAXIMUM AVAILABILITY' },
            { replica: 'PULSEDB_DR',      role: 'PHYSICAL STANDBY', lag_sec: 2.1 },
            { replica: 'PULSEDB_LOGIC',   role: 'LOGICAL STANDBY',  lag_sec: 18.4 },
        ],
    },
    bloat: [
        { table: 'PULSEDB_APP.TRANSACTIONS', chain_rows: 2_842, row_chaining_pct: 3.2, action: 'SHRINK SPACE COMPACT' },
    ],
    substitutes: ['Bloat: Oracle Segment Advisor / row-chaining signal (Tuning Pack).'],
    alerts: [
        { severity: 'critical', title: 'TX lock contention: SID 221 blocked by 142', time: '2m ago',  source: 'v$lock' },
        { severity: 'warning',  title: 'Logical standby PULSEDB_LOGIC lag 18s',       time: '12m ago', source: 'data-guard' },
    ],
    topology: [
        { id: 'PULSEDB_PRIMARY', role: 'primary', region: 'us-east-1', lag_ms: 0,     status: 'healthy' },
        { id: 'PULSEDB_DR',      role: 'standby', region: 'us-west-2', lag_ms: 2_100, status: 'healthy' },
        { id: 'PULSEDB_LOGIC',   role: 'standby', region: 'eu-west-1', lag_ms: 18_400, status: 'degraded' },
    ],
    signature: {
        kind: 'session_history',
        activeSessions: makeTs(86, 14, 24).map((p) => ({
            t: p.t,
            sessions: Math.max(40, Math.round(p.v)),
            waiting:  Math.max(0,  Math.round(p.v * 0.12)),
        })),
    },
});

// ─────────────────────────────────────────────────────────────────────────────
//  Redis
// ─────────────────────────────────────────────────────────────────────────────
export const DEMO_REDIS: EngineDemoSpec = withDerivedTs({
    key:  'redis',
    name: 'Redis',
    accentColor:   '#DC382D',
    versionString: 'Redis 7.4.1 (mode=standalone)',
    identity: { mode: 'standalone', os: 'Linux 6.1.0', arch_bits: '64', tcp_port: '6379' },
    catalog: [
        { name: 'db0', kind: 'logical-db' }, { name: 'db1', kind: 'logical-db' },
        { name: 'db2', kind: 'logical-db' },
    ],
    kpis: [
        { label: 'Ops/sec',          value: '48,210', unit: '',    sparkline: sparkline(48000, 1500) },
        { label: 'Cache hit rate',   value: '97.8',   unit: '%',   sparkline: sparkline(97, 1) },
        { label: 'Used memory',      value: '1.84',   unit: 'GB',  sparkline: sparkline(1.84, 0.02) },
        { label: 'Connected clients',value: '284',    unit: '',    sparkline: sparkline(280, 20) },
        { label: 'Evicted keys',     value: '142',    unit: '/hr', sparkline: sparkline(140, 30) },
    ],
    slowQueries: [
        { query: "KEYS user:session:*",            metric: '1,842 ms — avoid KEYS in prod', note: 'Use SCAN' },
        { query: "LRANGE queue:jobs 0 -1",         metric: '412 ms — 184K elements' },
        { query: "ZRANGEBYSCORE leaderboard -inf +inf", metric: '288 ms' },
    ],
    plan: {
        note: 'Redis has no query planner — MEMORY USAGE + OBJECT ENCODING substitute.',
        body: `MEMORY USAGE user:session:abc  →  412 bytes
OBJECT ENCODING queue:jobs     →  quicklist
OBJECT FREQ ratelimit:ip:1.2.3 →  42 accesses/min (LFU)`,
    },
    waits: { window: '1h', events: [
        { event: 'command:GET',    ms: 412_000 },
        { event: 'command:SET',    ms: 288_400 },
        { event: 'command:LRANGE', ms:  92_120 },
        { event: 'command:ZRANGE', ms:  48_800 },
        { event: 'latency:fork',   ms:   1_200 },
    ]},
    tables: [
        { schema: 'db0', name: 'keys (user:session:*)',    rows: 148_210, bytes:  62_881_000, note: 'keyspace row' },
        { schema: 'db0', name: 'keys (queue:*)',           rows:   1_820, bytes:   4_120_000 },
        { schema: 'db1', name: 'keys (cache:*)',           rows: 482_120, bytes: 148_392_000 },
    ],
    indexes: [],
    connections: [
        { session: '1024', user: 'app-service', kind: 'client', started: isoAgoSec(9200) },
        { session: '1025', user: 'worker-1',    kind: 'client', started: isoAgoSec(48) },
    ],
    locks: {
        note: 'Redis is single-threaded — "lock equivalent" = commands with highest LATENCY LATEST event times.',
        rows: [
            { event: 'fork',   latest_ms: 42, max_ms: 310, since: isoAgoSec(320) },
            { event: 'fsync',  latest_ms: 18, max_ms: 82,  since: isoAgoSec(48) },
        ],
    },
    replication: {
        note: 'Primary with 2 replicas (INFO replication).',
        rows: [
            { replica: 'primary', role: 'master',  connected_slaves: 2, repl_backlog_active: 1 },
            { replica: 'slave-1', role: 'slave',   lag_sec: 0,  state: 'online' },
            { replica: 'slave-2', role: 'slave',   lag_sec: 0.4, state: 'online' },
        ],
    },
    bloat: [
        { key_pattern: 'stale-session:*', est_keys: 18_420, memory_bytes: 8_420_000, reason: 'No TTL set' },
    ],
    substitutes: [
        'Tables → per-database keyspace counters from INFO keyspace.',
        'Plan → MEMORY USAGE + OBJECT ENCODING / FREQ.',
        'Locks → LATENCY LATEST events (top latency-inducing commands).',
        'Bloat → keys with no TTL that drift above a threshold.',
    ],
    alerts: [
        { severity: 'warning', title: 'KEYS command detected in prod — 1.8s scan',  time: '4m ago', source: 'slowlog' },
        { severity: 'info',    title: '142 keys evicted/hr (LFU eviction active)',  time: '22m ago', source: 'info memory' },
    ],
    topology: [
        { id: 'redis-primary', role: 'primary', region: 'us-east-1', lag_ms: 0,   status: 'healthy' },
        { id: 'redis-slave-1', role: 'replica', region: 'us-east-1', lag_ms: 0,   status: 'healthy' },
        { id: 'redis-slave-2', role: 'replica', region: 'us-west-2', lag_ms: 400, status: 'healthy' },
    ],
    signature: {
        kind: 'memory_ops',
        series: Array.from({ length: 24 }, (_, i) => ({
            t:       new Date(Date.now() - (23 - i) * 5 * 60 * 1000).toISOString(),
            mem_mb:  +(1800 + Math.sin(i / 3) * 80 + Math.random() * 40).toFixed(1),
            ops:    Math.round(48000 + Math.sin(i / 2) * 3000 + (Math.random() - 0.5) * 2000),
        })),
    },
});

// ─────────────────────────────────────────────────────────────────────────────
//  Elasticsearch
// ─────────────────────────────────────────────────────────────────────────────
export const DEMO_ES: EngineDemoSpec = withDerivedTs({
    key:  'elasticsearch',
    name: 'Elasticsearch',
    accentColor:   '#00BFB3',
    versionString: 'Elasticsearch 8.14.3 (cluster=pulsedb-search)',
    identity: { cluster_uuid: 'aBcD-1234', node_count: '3', data_nodes: '3' },
    catalog: [
        { name: 'logs-app-*',     kind: 'data-stream' },
        { name: 'metrics-otel-*', kind: 'data-stream' },
        { name: 'audit-2026-04',  kind: 'index' },
    ],
    kpis: [
        { label: 'Index rate',    value: '22,481', unit: 'docs/s', sparkline: sparkline(22000, 1000) },
        { label: 'Search rate',   value: '1,482',  unit: 'qps',    sparkline: sparkline(1400, 100) },
        { label: 'P95 latency',   value: '42',     unit: 'ms',     sparkline: sparkline(40, 5) },
        { label: 'Cluster status',value: 'green',  unit: '' },
        { label: 'Shards active', value: '842',    unit: '/ 842' },
    ],
    slowQueries: [
        { query: 'POST logs-app-*/_search {"query":{"match_phrase":{"message":"error"}}}', metric: '2.4 s — no filter' },
        { query: 'POST metrics-otel-*/_search {"aggs":{"by_host":{"terms":{...}}}}',        metric: '1.1 s' },
    ],
    plan: {
        note: 'Profile API output (simplified).',
        body: `query:
  type: BooleanQuery
  children:
    MatchPhraseQuery  elapsed: 1842 ms
    TermQuery         elapsed:    8 ms
aggregations:
  terms.by_host     elapsed: 284 ms`,
    },
    waits: { window: '1h', events: [
        { event: 'search_fetch',   ms: 142_000 },
        { event: 'search_query',   ms:  98_400 },
        { event: 'indexing_delay', ms:  44_800 },
        { event: 'refresh',        ms:  18_200 },
        { event: 'merge',          ms:   9_400 },
    ]},
    tables: [
        { schema: 'logs-app',     name: 'logs-app-2026.04.23',  rows: 84_210_000, bytes:  48_221_884_416 },
        { schema: 'metrics-otel', name: 'metrics-otel-2026-04', rows: 182_410_000, bytes: 92_221_991_424 },
    ],
    indexes: [
        { schema: 'logs-app',     table: 'logs-app-*',     kind: 'mapping', definition: 'text+keyword (message, service, trace_id)' },
        { schema: 'metrics-otel', table: 'metrics-otel-*', kind: 'mapping', definition: 'keyword+long (metric, value, labels)' },
    ],
    connections: [
        { session: 'node-1', user: 'cluster', kind: 'data-node',   started: isoAgoSec(820000) },
        { session: 'node-2', user: 'cluster', kind: 'data-node',   started: isoAgoSec(820000) },
        { session: 'node-3', user: 'cluster', kind: 'master-node', started: isoAgoSec(820000) },
    ],
    locks: {
        note: 'ES has no row locks. Hot-shard signal = per-shard search_active + indexing_queue depth.',
        rows: [
            { shard: 'logs-app-2026.04.23:p0', search_active: 18, queue_depth: 412 },
            { shard: 'logs-app-2026.04.23:p2', search_active:  2, queue_depth:  42 },
        ],
    },
    replication: {
        note: 'Cluster replication: 1 primary + 1 replica per shard.',
        rows: [
            { index: 'logs-app-2026.04.23',  primaries: 3, replicas: 3, unassigned: 0 },
            { index: 'metrics-otel-2026-04', primaries: 5, replicas: 5, unassigned: 0 },
        ],
    },
    bloat: [
        { index: 'logs-app-2026.03.15', size_bytes: 18_210_884_416, age_days: 39, action: 'ILM delete policy' },
    ],
    substitutes: [
        'Locks → hot shards (indexing queue + search_active).',
        'Bloat → old indices beyond ILM delete-phase age.',
    ],
    alerts: [
        { severity: 'info', title: 'Shard logs-app-2026.04.23:p0 queue depth 412', time: '6m ago', source: 'shard-health' },
        { severity: 'info', title: 'ILM: logs-app-2026.03.15 entering delete phase', time: '2h ago', source: 'ilm' },
    ],
    topology: [
        { id: 'node-1', role: 'coordinator', region: 'us-east-1', status: 'healthy' },
        { id: 'node-2', role: 'worker',      region: 'us-east-1', status: 'healthy' },
        { id: 'node-3', role: 'worker',      region: 'us-east-1', status: 'healthy' },
    ],
    signature: {
        kind: 'indexing_vs_search',
        series: Array.from({ length: 24 }, (_, i) => ({
            t:         new Date(Date.now() - (23 - i) * 5 * 60 * 1000).toISOString(),
            index_ps:  Math.round(22000 + Math.sin(i / 2) * 2000 + (Math.random() - 0.5) * 1500),
            search_ps: Math.round(1400 + Math.sin(i / 3) * 200  + (Math.random() - 0.5) * 120),
            p95_ms:    +(40 + Math.sin(i / 4) * 8 + Math.random() * 4).toFixed(1),
        })),
    },
});

// ─────────────────────────────────────────────────────────────────────────────
//  Snowflake
// ─────────────────────────────────────────────────────────────────────────────
export const DEMO_SNOWFLAKE: EngineDemoSpec = withDerivedTs({
    key:  'snowflake',
    name: 'Snowflake',
    accentColor:   '#29B5E8',
    versionString: 'Snowflake 8.18.0 (managed)',
    identity: { account: 'acme-analytics.us-east-1', region: 'US-EAST-1', edition: 'Business Critical' },
    catalog: [
        { name: 'PULSEDB_PROD', location: 'US-EAST-1' },
        { name: 'PULSEDB_DEV',  location: 'US-EAST-1' },
        { name: 'SNOWFLAKE_SAMPLE_DATA', location: 'US-EAST-1' },
    ],
    kpis: [
        { label: 'Queries (1h)',      value: '1,842',  unit: '',        sparkline: sparkline(1800, 120) },
        { label: 'Credits (1h)',      value: '12.4',   unit: '',        sparkline: sparkline(12, 2) },
        { label: 'P95 exec',          value: '2.8',    unit: 's',       sparkline: sparkline(2.8, 0.4) },
        { label: 'Warehouse util',    value: '68',     unit: '%',       sparkline: sparkline(68, 10) },
        { label: 'Time-travel stor.', value: '412',    unit: 'GB' },
    ],
    slowQueries: [
        { query: 'SELECT * FROM fact_events WHERE dt BETWEEN ... ',  metric: '428.2 s — full scan' },
        { query: 'CREATE TABLE AS SELECT ... JOIN ... QUALIFY ...',   metric: '182.4 s' },
        { query: 'COPY INTO staging.raw_events FROM @ext/',           metric:  '48.1 s' },
    ],
    plan: {
        note: 'SYSTEM$EXPLAIN_JSON — top operators.',
        body: `TableScan  [fact_events, 842M rows]  cost=1842.4
└── Filter  [dt BETWEEN ...]
    └── Aggregate  [group by country]
        └── Result`,
    },
    waits: { window: '1h', events: [
        { event: 'execute',            ms: 8_412_000 },
        { event: 'compile',            ms:   412_000 },
        { event: 'queue_overload',     ms:   184_200 },
        { event: 'queue_provisioning', ms:    42_800 },
        { event: 'tx_blocked',         ms:     8_400 },
    ]},
    tables: [
        { schema: 'PROD',    name: 'FACT_EVENTS',     rows: 842_104_221, bytes: 1_842_221_122_304 },
        { schema: 'PROD',    name: 'DIM_USERS',       rows:   1_884_210, bytes:       884_221_440 },
        { schema: 'STAGING', name: 'RAW_CLICKSTREAM', rows: 2_842_104_221, bytes: 4_210_884_000_000 },
    ],
    indexes: [
        { schema: 'PROD', table: 'FACT_EVENTS', kind: 'clustering_key',     definition: '(dt, country)' },
        { schema: 'PROD', table: 'DIM_USERS',   kind: 'search_optimization', definition: 'SEARCH OPTIMIZATION' },
    ],
    connections: [
        { session: '18421', user: 'ETL_SERVICE',     kind: 'PUBLIC', started: isoAgoSec(1820) },
        { session: '18422', user: 'REPORTING_USER',  kind: 'PUBLIC', started: isoAgoSec(120) },
    ],
    locks: {
        note: 'Substitute: TRANSACTION_BLOCKED_TIME + QUEUED_OVERLOAD_TIME from QUERY_HISTORY.',
        rows: [
            { query_id: 'abc-1', user: 'ETL',       warehouse: 'ETL_WH',    blocked_ms: 18_400, queued_ms: 412 },
            { query_id: 'abc-2', user: 'REPORTING', warehouse: 'REPORT_WH', blocked_ms:  2_400, queued_ms:   8 },
        ],
    },
    replication: {
        note: 'SHOW REPLICATION DATABASES — PULSEDB_PROD replicated to EU-WEST-1.',
        rows: [
            { database: 'PULSEDB_PROD', primary_account: 'acme-us-east-1', replicated_to: 'acme-eu-west-1', is_primary: true },
        ],
    },
    bloat: [
        { table: 'PROD.FACT_EVENTS', active_bytes: 1_842_221_122_304, time_travel_bytes: 184_221_000_000, overhead_pct: 10.0 },
    ],
    substitutes: [
        'Locks → concurrency-blocker rows (TRANSACTION_BLOCKED_TIME + QUEUED_OVERLOAD_TIME).',
        'Indexes → clustering keys + search-optimization flags.',
        'Bloat → time-travel + failsafe overhead % per table.',
    ],
    alerts: [
        { severity: 'warning',  title: 'ETL_WH credits trending 18% above plan', time: '34m ago', source: 'budget-monitor' },
        { severity: 'info',     title: 'QUERY_HISTORY: 2 blocked transactions',  time: '11m ago', source: 'concurrency' },
    ],
    topology: [
        { id: 'PULSEDB_PROD (us-east-1)', role: 'primary', region: 'us-east-1', lag_ms: 0,     status: 'healthy' },
        { id: 'PULSEDB_PROD (eu-west-1)', role: 'replica', region: 'eu-west-1', lag_ms: 4_200, status: 'healthy' },
    ],
    signature: {
        kind: 'credits_by_warehouse',
        total: '12.4 credits (≈ $49.60)',
        series: [
            { name: 'ETL_WH',    data: Array.from({ length: 24 }, (_, i) => ({ t: new Date(Date.now() - (23 - i) * 5 * 60_000).toISOString(), v: +(0.4 + Math.sin(i / 3) * 0.12 + Math.random() * 0.08).toFixed(3) })) },
            { name: 'REPORT_WH', data: Array.from({ length: 24 }, (_, i) => ({ t: new Date(Date.now() - (23 - i) * 5 * 60_000).toISOString(), v: +(0.18 + Math.sin(i / 4) * 0.06 + Math.random() * 0.04).toFixed(3) })) },
            { name: 'DEV_WH',    data: Array.from({ length: 24 }, (_, i) => ({ t: new Date(Date.now() - (23 - i) * 5 * 60_000).toISOString(), v: +(0.04 + Math.random() * 0.02).toFixed(3) })) },
        ],
    },
});

// ─────────────────────────────────────────────────────────────────────────────
//  BigQuery
// ─────────────────────────────────────────────────────────────────────────────
export const DEMO_BIGQUERY: EngineDemoSpec = withDerivedTs({
    key:  'bigquery',
    name: 'Google BigQuery',
    accentColor:   THEME.primary,
    versionString: 'BigQuery (managed)',
    identity: { project: 'acme-analytics', location: 'US' },
    catalog: [
        { name: 'pulsedb_prod',    location: 'US' },
        { name: 'pulsedb_staging', location: 'US' },
        { name: 'marketing_eu',   location: 'EU' },
    ],
    kpis: [
        { label: 'Jobs (1h)',        value: '2,841',  unit: '',        sparkline: sparkline(2800, 200) },
        { label: 'Bytes billed (1h)',value: '842',    unit: 'GB',      sparkline: sparkline(842, 80) },
        { label: 'Slot-ms (1h)',     value: '1.8',    unit: 'M' },
        { label: 'Est. cost (1h)',   value: '$4.18',  unit: '' },
        { label: 'Queue p95',        value: '412',    unit: 'ms' },
    ],
    slowQueries: [
        { query: 'SELECT * FROM `acme-analytics.prod.events` WHERE ts > ...', metric: '184,210 slot-ms · 412 GB scanned' },
        { query: 'INSERT INTO `acme-analytics.prod.events_agg` ...',           metric: ' 48,212 slot-ms · 122 GB scanned' },
    ],
    plan: {
        note: 'Dry-run statistics + job stages.',
        body: `statementType: SELECT
totalBytesProcessed: 441,201,884,416
totalBytesBilled:    441,201,884,416
referencedTables:
  - acme-analytics.prod.events
stages:
  S00 Input:  Input → Output  shuffle=12.4 GB  wait=8 ms
  S01 Join :  Input × Input   shuffle= 2.1 GB  wait=4 ms`,
    },
    waits: { window: '1h', events: [
        { event: 'execute', ms: 1_840_000 },
        { event: 'queue',   ms:   184_200 },
        { event: 'slot_ms', ms: 1_842_000 },
    ]},
    tables: [
        { schema: 'prod', name: 'events',        rows: 4_821_104_221, bytes: 14_210_884_000_000 },
        { schema: 'prod', name: 'users',         rows:    18_842_100, bytes:      1_210_884_096 },
        { schema: 'prod', name: 'events_agg',    rows:       842_100, bytes:         82_108_800 },
    ],
    indexes: [
        { schema: 'prod', table: 'events',     kind: 'partition+cluster', definition: 'partition=dt, cluster=(country, device)' },
        { schema: 'prod', table: 'events_agg', kind: 'cluster',           definition: 'cluster=(dt)' },
    ],
    connections: [
        { session: 'bqjob_r_842a...', user: 'etl@acme.iam',    kind: 'QUERY', started: isoAgoSec(42), running_sec: 42 },
        { session: 'bqjob_r_1be2...', user: 'looker@acme.iam', kind: 'QUERY', started: isoAgoSec(8),  running_sec: 8 },
    ],
    locks: {
        note: 'Substitute: slot-contention — jobs delayed >1s waiting on slot capacity.',
        rows: [
            { job_id: 'bqjob_r_842a...', user: 'etl',    queue_ms: 18_400, total_ms: 184_200 },
            { job_id: 'bqjob_r_1be2...', user: 'looker', queue_ms:  4_200, total_ms:  42_000 },
        ],
    },
    replication: {
        note: 'Dataset-location distribution (BigQuery is multi-region-replicated by Google).',
        rows: [
            { location: 'US', datasets: 2 },
            { location: 'EU', datasets: 1 },
        ],
    },
    bloat: [
        { table: 'prod.stale_pilot_2024', rows: 8_420_100, bytes: 4_210_884_096, days_cold: 412, last_modified: '2025-03-08T12:00:00Z' },
    ],
    substitutes: [
        'Connections → running/pending jobs.',
        'Locks → slot-contention queue_ms.',
        'Indexes → partition + clustering columns.',
        'Bloat → cold-tail tables by days-since-modified.',
    ],
    alerts: [
        { severity: 'warning', title: 'Dataset prod.events: 412 GB scanned (no filter pushed down)', time: '8m ago', source: 'cost-guard' },
        { severity: 'info',    title: 'stale_pilot_2024 cold 412 days — candidate for delete', time: '1h ago', source: 'cold-tail' },
    ],
    topology: [
        { id: 'dataset(US):pulsedb_prod',    role: 'primary', region: 'US', status: 'healthy' },
        { id: 'dataset(US):pulsedb_staging', role: 'primary', region: 'US', status: 'healthy' },
        { id: 'dataset(EU):marketing_eu',   role: 'primary', region: 'EU', status: 'healthy' },
    ],
    signature: {
        kind: 'bytes_billed',
        dailyEstimate: '≈ $102.30 / day at current rate',
        area: Array.from({ length: 24 }, (_, i) => {
            const gb = +(800 + Math.sin(i / 2) * 120 + (Math.random() - 0.5) * 180).toFixed(1);
            return {
                t:    new Date(Date.now() - (23 - i) * 5 * 60_000).toISOString(),
                gb,
                cost: +(gb * 0.005).toFixed(2),  // $5/TB = $0.005/GB
            };
        }),
    },
});

// ─────────────────────────────────────────────────────────────────────────────
//  Redshift
// ─────────────────────────────────────────────────────────────────────────────
export const DEMO_REDSHIFT: EngineDemoSpec = withDerivedTs({
    key:  'redshift',
    name: 'AWS Redshift',
    accentColor:   '#FF9900',
    versionString: 'Redshift 1.0.82842 (dc2.large × 4)',
    identity: { cluster: 'pulsedb-prod', region: 'us-east-1', node_type: 'dc2.large', node_count: '4' },
    catalog: [
        { name: 'dev' }, { name: 'pulsedb_prod' }, { name: 'pulsedb_reporting' },
    ],
    kpis: [
        { label: 'Queries (1h)',    value: '842',   unit: '',    sparkline: sparkline(840, 40) },
        { label: 'Disk used',       value: '68',    unit: '%' },
        { label: 'WLM queue wait',  value: '142',   unit: 'ms',  sparkline: sparkline(140, 20) },
        { label: 'Active sessions', value: '28',    unit: '',    sparkline: sparkline(28, 4) },
        { label: 'Stats-stale tbls',value: '8',     unit: '' },
    ],
    slowQueries: [
        { query: 'SELECT ... FROM fact_events e JOIN dim_users u ON ...',  metric: '48,210 ms' },
        { query: 'COPY staging.raw FROM \'s3://...\' IAM_ROLE ...',        metric: ' 8,420 ms' },
    ],
    plan: {
        note: 'EXPLAIN (pg wire).',
        body: `XN Hash Join DS_DIST_NONE  (cost=842)
  Hash Cond: (e.user_id = u.id)
  →  XN Seq Scan on fact_events e  (cost=712, rows=842M)
  →  XN Hash  (cost=12, rows=1.8M)
      →  XN Seq Scan on dim_users u  (cost=12)`,
    },
    waits: { window: '1h', events: [
        { event: 'default queue',   ms:  82_400 },
        { event: 'etl queue',       ms: 142_800 },
        { event: 'reporting queue', ms:  48_200 },
    ]},
    tables: [
        { schema: 'public', name: 'fact_events', rows: 842_000_000, bytes: 184_210_884_096 },
        { schema: 'public', name: 'dim_users',   rows:   1_842_100, bytes:     210_884_000 },
    ],
    indexes: [
        { schema: 'public', table: 'fact_events', kind: 'sort+dist', definition: 'sortkey=(dt, user_id), diststyle=KEY, distkey=user_id' },
        { schema: 'public', table: 'dim_users',   kind: 'sort+dist', definition: 'sortkey=(id), diststyle=ALL' },
    ],
    connections: [
        { session: '18421', user: 'etl_user',       kind: 'session', started: isoAgoSec(820) },
        { session: '18432', user: 'reporting_user', kind: 'session', started: isoAgoSec(120) },
    ],
    locks: {
        note: 'STV_LOCKS — elevated role required. Fallback shows WLM waiters.',
        rows: [
            { txn_owner: 'etl_user',       relation: 'fact_events', mode: 'AccessShareLock',   granted: true  },
            { txn_owner: 'reporting_user', relation: 'fact_events', mode: 'AccessExclusive',   granted: false },
        ],
    },
    replication: {
        note: 'Per-node storage capacity (cluster has no sync replicas; cross-region via snapshots).',
        rows: [
            { node: '0', slice: '0', used_mb: 184_210, cap_mb: 320_000 },
            { node: '1', slice: '1', used_mb: 182_120, cap_mb: 320_000 },
            { node: '2', slice: '2', used_mb: 183_200, cap_mb: 320_000 },
            { node: '3', slice: '3', used_mb: 180_800, cap_mb: 320_000 },
        ],
    },
    bloat: [
        { schema: 'public', table: 'fact_events', unsorted_pct: 38.4, stats_off: 18, action: 'VACUUM + ANALYZE' },
    ],
    substitutes: [
        'Indexes → sort keys + dist keys + encoding.',
        'Replication → per-node storage breakdown.',
    ],
    alerts: [
        { severity: 'warning', title: 'public.fact_events unsorted 38% — VACUUM due',  time: '23m ago', source: 'bloat-watcher' },
        { severity: 'info',    title: 'WLM etl queue peaked 2.4s',                    time: '7m ago',  source: 'wlm' },
    ],
    topology: [
        { id: 'node-0', role: 'primary', region: 'us-east-1', status: 'healthy' },
        { id: 'node-1', role: 'worker',  region: 'us-east-1', status: 'healthy' },
        { id: 'node-2', role: 'worker',  region: 'us-east-1', status: 'healthy' },
        { id: 'node-3', role: 'worker',  region: 'us-east-1', status: 'healthy' },
    ],
    signature: {
        kind: 'wlm_queues',
        bars: [
            { queue: 'default',   exec_ms:  41_200, queue_ms: 82_400 },
            { queue: 'etl',       exec_ms: 184_200, queue_ms: 142_800 },
            { queue: 'reporting', exec_ms:  82_200, queue_ms: 48_200 },
            { queue: 'dev',       exec_ms:  12_400, queue_ms:  3_200 },
        ],
    },
});

// ─────────────────────────────────────────────────────────────────────────────
//  Cassandra
// ─────────────────────────────────────────────────────────────────────────────
export const DEMO_CASSANDRA: EngineDemoSpec = withDerivedTs({
    key:  'cassandra',
    name: 'Apache Cassandra',
    accentColor:   '#1287B1',
    versionString: 'Cassandra 5.0.1 (cluster=PulseDB)',
    identity: { cluster: 'PulseDB', datacenter: 'dc1', rack: 'rack1', node_count: '6' },
    catalog: [
        { name: 'pulsedb_app' },
        { name: 'system' },
        { name: 'system_schema' },
    ],
    kpis: [
        { label: 'Reads/sec',        value: '48,210', unit: '',   sparkline: sparkline(48000, 2000) },
        { label: 'Writes/sec',       value: '12,480', unit: '',   sparkline: sparkline(12400, 800) },
        { label: 'P99 read latency', value: '4.2',    unit: 'ms', sparkline: sparkline(4, 0.6) },
        { label: 'Hinted handoffs',  value: '12',     unit: '',   sparkline: sparkline(10, 4) },
        { label: 'Compactions',      value: '3',      unit: '' },
    ],
    slowQueries: [
        { query: 'SELECT * FROM pulsedb_app.events WHERE partition_id=? AND ts>?', metric: 'avg 12 ms / p99 48 ms' },
        { query: 'INSERT INTO pulsedb_app.audit (ts, event, actor) VALUES ...',    metric: 'avg 2 ms / p99 18 ms' },
    ],
    plan: {
        note: 'Via TRACING ON + system_traces.sessions.',
        body: `session_id=abc-1, coordinator=10.0.1.12, duration=18412 µs
activity                                                           source_elapsed
----------------------------------------------------------------  ----------------
Parsing SELECT ...                                                                 42
Preparing statement                                                                88
Reading data from 10.0.1.14 (REPLICA)                                          12,400
Merging data from memtables and sstables                                        5,800`,
    },
    waits: { window: 'since-trace', events: [
        { event: 'Reading data from replica', micros: 1_840_000 },
        { event: 'Merging memtable+sstable',  micros:   612_000 },
        { event: 'Parsing CQL',               micros:    18_400 },
    ]},
    tables: [
        { schema: 'pulsedb_app', name: 'events',  rows: 48_210_000, bytes: 18_210_000_000, note: 'from size_estimates' },
        { schema: 'pulsedb_app', name: 'audit',   rows:  8_420_100, bytes:  2_210_000_000 },
    ],
    indexes: [
        { schema: 'pulsedb_app', table: 'events', kind: 'secondary', definition: 'ix_events_status (status)' },
    ],
    connections: [
        { session: 'native-1', user: 'app_service', kind: 'driver-v4', started: isoAgoSec(184_000) },
        { session: 'native-2', user: 'etl_batch',   kind: 'driver-v4', started: isoAgoSec(42) },
    ],
    locks: {
        note: 'Substitute: hot-partition rows (largest mean_partition_size).',
        rows: [
            { schema: 'pulsedb_app', table: 'events', mean_size: 1_482_000, partitions: 18_420 },
            { schema: 'pulsedb_app', table: 'audit',  mean_size:   412_000, partitions:  8_420 },
        ],
    },
    replication: {
        note: 'Keyspace replication strategy.',
        rows: [
            { keyspace: 'pulsedb_app', strategy: 'NetworkTopologyStrategy', replication: '{ dc1: 3, dc2: 3 }', durable_writes: true },
            { keyspace: 'system',     strategy: 'LocalStrategy',           replication: '{}',                 durable_writes: true },
        ],
    },
    bloat: [
        { table: 'pulsedb_app.events', tombstones_per_read: 184, action: 'Run compaction' },
    ],
    substitutes: [
        'Tables → system.size_estimates aggregates (approximate).',
        'Locks → hot partitions (largest mean_partition_size).',
        'Wait events → TRACING ON + aggregated system_traces.events.',
        'Plan → TRACING ON + system_traces.sessions.',
    ],
    alerts: [
        { severity: 'warning', title: '12 hinted handoffs in last hour (node-4)', time: '18m ago', source: 'cluster-health' },
        { severity: 'info',    title: '3 compactions active on pulsedb_app.events', time: '5m ago', source: 'compaction' },
    ],
    topology: [
        { id: 'node-1 (dc1)', role: 'coordinator', region: 'dc1', status: 'healthy' },
        { id: 'node-2 (dc1)', role: 'worker',      region: 'dc1', status: 'healthy' },
        { id: 'node-3 (dc1)', role: 'worker',      region: 'dc1', status: 'healthy' },
        { id: 'node-4 (dc2)', role: 'worker',      region: 'dc2', status: 'degraded' },
        { id: 'node-5 (dc2)', role: 'worker',      region: 'dc2', status: 'healthy' },
        { id: 'node-6 (dc2)', role: 'worker',      region: 'dc2', status: 'healthy' },
    ],
    signature: {
        kind: 'rw_hinted',
        series: Array.from({ length: 24 }, (_, i) => ({
            t:      new Date(Date.now() - (23 - i) * 5 * 60_000).toISOString(),
            reads:  Math.round(48000 + Math.sin(i / 2) * 3000 + (Math.random() - 0.5) * 1500),
            writes: Math.round(12400 + Math.sin(i / 3) * 800  + (Math.random() - 0.5) * 600),
            hints:  i > 18 ? Math.round(Math.random() * 6) : Math.round(Math.random() * 1.2),
        })),
    },
});

// ─────────────────────────────────────────────────────────────────────────────
//  DynamoDB
// ─────────────────────────────────────────────────────────────────────────────
export const DEMO_DYNAMO: EngineDemoSpec = withDerivedTs({
    key:  'dynamodb',
    name: 'AWS DynamoDB',
    accentColor:   '#4053D6',
    versionString: 'DynamoDB (managed, region=us-east-1)',
    identity: { region: 'us-east-1', account_id: '123456789012', partitions: '~8' },
    catalog: [{ name: 'us-east-1', kind: 'region' }],
    kpis: [
        { label: 'Requests/sec',     value: '48,210', unit: '',     sparkline: sparkline(48000, 2000) },
        { label: 'Throttle events',  value: '12',     unit: '/hr',  sparkline: sparkline(10, 4) },
        { label: 'Consumed WCUs',    value: '1,842',  unit: '',     sparkline: sparkline(1800, 80) },
        { label: 'Consumed RCUs',    value: '4,210',  unit: '',     sparkline: sparkline(4200, 200) },
        { label: 'Latency p95',      value: '2.8',    unit: 'ms' },
    ],
    slowQueries: [
        { query: 'Scan table=Events, FilterExpression="begins_with(pk, :p)"', metric: '12,480 RCUs / 842 ms' },
        { query: 'Query table=Events IndexName=gsi_by_user KeyCondition=...', metric:    '184 RCUs /  18 ms' },
    ],
    plan: {
        note: 'PartiQL ExecuteStatement — ReturnConsumedCapacity=INDEXES.',
        body: `Statement: SELECT * FROM "Events" WHERE pk = 'user#42'
ConsumedCapacity:
  TableName: Events
  CapacityUnits: 42.0
  Table: { ReadCapacityUnits: 38.0 }
  GlobalSecondaryIndexes:
    gsi_by_user: { ReadCapacityUnits: 4.0 }
ItemCount: 184`,
    },
    waits: { window: '1h', events: [
        { event: 'ReadThrottleEvents',  ms:  4_200, note: 'CloudWatch' },
        { event: 'WriteThrottleEvents', ms:  1_800, note: 'CloudWatch' },
        { event: 'ThrottledRequests',   ms:  6_000, note: 'CloudWatch' },
        { event: 'SystemErrors',        ms:     48, note: 'CloudWatch' },
        { event: 'UserErrors',          ms:    412, note: 'CloudWatch' },
    ]},
    tables: [
        { schema: 'default', name: 'Events',    rows: 48_210_000, bytes: 184_210_884_096 },
        { schema: 'default', name: 'Users',     rows:  1_842_100, bytes:     210_884_000 },
        { schema: 'default', name: 'Sessions',  rows:    482_100, bytes:      84_210_000 },
    ],
    indexes: [
        { schema: 'default', table: 'Events', kind: 'GSI', definition: 'gsi_by_user (user_id, ts)' },
        { schema: 'default', table: 'Events', kind: 'GSI', definition: 'gsi_by_status (status, ts)' },
        { schema: 'default', table: 'Users',  kind: 'LSI', definition: 'lsi_by_email (email)' },
    ],
    connections: [],
    locks: {
        note: 'Substitute: ConditionalCheckFailedRequests from CloudWatch.',
        rows: [
            { event: 'ConditionalCheckFailedRequests', count_1h: 42, namespace: 'AWS/DynamoDB' },
        ],
    },
    replication: {
        note: 'Global Tables Replicas[] from DescribeTable.',
        rows: [
            { table: 'Events',   region: 'us-east-1', status: 'ACTIVE', kms_id: 'alias/aws/dynamodb' },
            { table: 'Events',   region: 'eu-west-1', status: 'ACTIVE', kms_id: 'alias/aws/dynamodb' },
            { table: 'Sessions', region: 'us-east-1', status: 'ACTIVE', kms_id: 'alias/aws/dynamodb' },
        ],
    },
    bloat: [
        { table: 'stale_pilot_2024', bytes: 18_210_884, rows: 0, days_old: 412, cold: true },
    ],
    substitutes: [
        'Connections → CloudWatch per-principal request counts.',
        'Slow queries → CloudWatch SuccessfulRequestLatency + ThrottledRequests.',
        'Locks → ConditionalCheckFailedRequests metric.',
        'Wait events → 5 CloudWatch throttle / error counters.',
        'Bloat → cold tables (no writes, rows=0, >30 days old).',
    ],
    alerts: [
        { severity: 'critical', title: '12 write-throttle events in last hour (Events table)', time: '3m ago', source: 'cloudwatch' },
        { severity: 'info',     title: 'Global table replication us-east-1 → eu-west-1 ACTIVE', time: '2h ago', source: 'global-tables' },
    ],
    topology: [
        { id: 'Events (us-east-1)',   role: 'primary', region: 'us-east-1', lag_ms: 0,     status: 'healthy' },
        { id: 'Events (eu-west-1)',   role: 'replica', region: 'eu-west-1', lag_ms: 840,   status: 'healthy' },
        { id: 'Sessions (us-east-1)', role: 'primary', region: 'us-east-1', lag_ms: 0,     status: 'healthy' },
    ],
    signature: {
        kind: 'dynamo_capacity',
        series: Array.from({ length: 24 }, (_, i) => ({
            t:         new Date(Date.now() - (23 - i) * 5 * 60_000).toISOString(),
            wcu:       Math.round(1800 + Math.sin(i / 3) * 200 + (Math.random() - 0.5) * 120),
            rcu:       Math.round(4200 + Math.sin(i / 2) * 400 + (Math.random() - 0.5) * 300),
            throttles: i >= 20 ? Math.round(Math.random() * 8) : 0,
        })),
    },
});

// ─────────────────────────────────────────────────────────────────────────────
//  Lookup
// ─────────────────────────────────────────────────────────────────────────────
export const DEMO_ENGINES: Record<EngineKey, EngineDemoSpec> = {
    mssql:         DEMO_MSSQL,
    oracle:        DEMO_ORACLE,
    redis:         DEMO_REDIS,
    elasticsearch: DEMO_ES,
    snowflake:     DEMO_SNOWFLAKE,
    bigquery:      DEMO_BIGQUERY,
    redshift:      DEMO_REDSHIFT,
    cassandra:     DEMO_CASSANDRA,
    dynamodb:      DEMO_DYNAMO,
};

export default DEMO_ENGINES;
