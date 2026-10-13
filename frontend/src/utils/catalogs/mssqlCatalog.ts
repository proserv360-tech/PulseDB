/* SQL Server metric catalog — ~200 metrics across 12 sections. */

import { MetricCatalog, Metric, MetricSection, MetricTier } from '../metricsCatalog';

const SQL_RED = '#CC2927';

const sections: MetricSection[] = [
    { key: 'overview',       label: 'Overview',           order: 1, color: SQL_RED },
    { key: 'performance',    label: 'Performance',        order: 2, color: '#0078D4' },
    { key: 'waits',          label: 'Wait Stats',         order: 3, color: '#F2C744' },
    { key: 'querystore',     label: 'Query Store',        order: 4, color: '#107C10' },
    { key: 'indexes',        label: 'Indexes',            order: 5, color: '#5C2D91' },
    { key: 'locks',          label: 'Locks & Blocking',   order: 6, color: '#D83B01' },
    { key: 'alwayson',       label: 'Always-On',          order: 7, color: '#00B7C3' },
    { key: 'bufferpool',     label: 'Buffer Pool',        order: 8, color: '#8764B8' },
    { key: 'tempdb',         label: 'TempDB',             order: 9, color: '#E3008C' },
    { key: 'backup',         label: 'Backup & Recovery', order: 10, color: '#498205' },
    { key: 'security',       label: 'Security',          order: 11, color: '#A4262C' },
    { key: 'storage',        label: 'Storage & I/O',     order: 12, color: '#0099BC' },
];

const m = (
    id: string, label: string, section: string, tier: MetricTier,
    unit = '', description = '', extras: Partial<Metric> = {},
): Metric => ({ id, label, section, tier, unit, description, ...extras });

const metrics: Metric[] = [
    /* ── Overview ─────────────────────────────────────────────────────── */
    m('mssql.uptime',           'Uptime',                    'overview', 'basic', 'days',  'Days since last instance restart.',                  { format: 'count', baseValue: 142, range: 20 }),
    m('mssql.version',          'Version build',             'overview', 'basic', '',      'SQL Server build number reported by @@VERSION.',     { baseValue: 16, range: 0 }),
    m('mssql.cpu_pct',          'CPU utilization',           'overview', 'basic', '%',     'sys.dm_os_ring_buffers SystemHealth process CPU.',   { format: 'percent', source: 'sys.dm_os_ring_buffers', baseValue: 42, range: 30, higherIsBetter: false }),
    m('mssql.memory_used',      'Memory used',               'overview', 'basic', 'GB',    'physical_memory_in_use_kb from sys.dm_os_process_memory.', { format: 'number', baseValue: 56, range: 12 }),
    m('mssql.memory_total',     'Memory target',             'overview', 'basic', 'GB',    'max_server_memory configured value.',                { format: 'number', baseValue: 64, range: 0 }),
    m('mssql.active_conns',     'Active connections',        'overview', 'basic', '',      'COUNT(*) FROM sys.dm_exec_connections.',              { format: 'count', source: 'sys.dm_exec_connections', baseValue: 147, range: 60 }),
    m('mssql.user_conns',       'User connections',          'overview', 'basic', '',      'User-initiated connections only.',                    { format: 'count', baseValue: 124, range: 40 }),
    m('mssql.system_conns',     'System connections',        'overview', 'intermediate', '', 'Internal SQL Server connections.',                  { format: 'count', baseValue: 23, range: 8 }),
    m('mssql.batch_req_sec',    'Batch req / sec',           'overview', 'basic', 'req/s', 'Batches received per second (SQLServer:SQL Statistics).', { format: 'count', baseValue: 12480, range: 3000 }),
    m('mssql.transactions_sec', 'Transactions / sec',        'overview', 'intermediate', 'tx/s', 'Per-database transaction throughput.',          { format: 'count', baseValue: 4820, range: 1200 }),
    m('mssql.compilations_sec', 'Compilations / sec',        'overview', 'intermediate', '/s', 'Plan compilations per second; spikes = parameter sniffing.', { baseValue: 180, range: 60 }),
    m('mssql.recompilations',   'Recompilations / sec',      'overview', 'intermediate', '/s', 'Re-compiled plans per second.',                   { baseValue: 12, range: 8 }),
    m('mssql.databases',        'Databases',                 'overview', 'basic', '',      'User databases (excluding system).',                  { format: 'count', baseValue: 24, range: 5 }),
    m('mssql.errors_sec',       'Errors / sec',              'overview', 'advanced', '/s','Error rate from SQLServer:SQL Errors counter.',       { baseValue: 0.2, range: 0.4 }),
    m('mssql.errors_severe',    'Severe errors (20+)',       'overview', 'advanced', '/min','High-severity errors per minute.',                   { baseValue: 0.05, range: 0.1 }),
    m('mssql.scheduler_count',  'Schedulers',                'overview', 'intermediate', '', 'sys.dm_os_schedulers count.',                       { format: 'count', baseValue: 16, range: 0 }),
    m('mssql.workers_active',   'Active workers',            'overview', 'intermediate', '', 'sys.dm_os_workers in RUNNING state.',               { format: 'count', baseValue: 84, range: 22 }),
    m('mssql.requests_running', 'Running requests',          'overview', 'basic', '',      'sys.dm_exec_requests with status RUNNING.',           { format: 'count', baseValue: 36, range: 14 }),

    /* ── Performance ──────────────────────────────────────────────────── */
    m('mssql.perf.signal_wait_pct', 'Signal wait %',         'performance', 'advanced', '%', 'CPU pressure indicator (signal_wait_time / wait_time).', { format: 'percent', baseValue: 12, range: 6 }),
    m('mssql.perf.parallelism',     'Parallel plans %',      'performance', 'advanced', '%', 'Percentage of plans using CXPACKET.',                  { format: 'percent', baseValue: 18, range: 8 }),
    m('mssql.perf.proc_cache_hit',  'Procedure cache hit',   'performance', 'intermediate', '%', 'Plan cache hit ratio.',                             { format: 'percent', baseValue: 96, range: 3, higherIsBetter: true }),
    m('mssql.perf.proc_cache_pages','Plan cache pages',      'performance', 'advanced', '', 'Pages used by procedure cache.',                       { format: 'count', baseValue: 124800, range: 32000 }),
    m('mssql.perf.cpu_signal_wait', 'CPU signal wait',       'performance', 'advanced', 'ms','Total signal wait time accumulated.',                 { format: 'duration', baseValue: 412000, range: 100000 }),
    m('mssql.perf.cpu_idle_pct',    'CPU idle %',            'performance', 'basic', '%',  'sys.dm_os_ring_buffers SystemIdle.',                  { format: 'percent', baseValue: 58, range: 25, higherIsBetter: true }),
    m('mssql.perf.context_switches','Context switches / s',  'performance', 'advanced', '/s', 'OS context switches per second.',                    { baseValue: 28000, range: 8000 }),
    m('mssql.perf.disk_queue',      'Avg disk queue',        'performance', 'intermediate', '', 'sys.dm_io_virtual_file_stats avg queue depth.',     { baseValue: 0.4, range: 0.6 }),
    m('mssql.perf.avg_latch_wait',  'Avg latch wait',        'performance', 'advanced', 'ms','sys.dm_os_latch_stats wait_time_ms / waiting_requests_count.', { format: 'duration', baseValue: 1.2, range: 0.8 }),
    m('mssql.perf.spinlock_collisions', 'Spinlock collisions / s', 'performance', 'advanced', '/s', 'sys.dm_os_spinlock_stats collisions delta.', { baseValue: 1200, range: 400 }),
    m('mssql.perf.target_recovery', 'Target recovery interval', 'performance', 'advanced', 's', 'Configured target recovery interval.',           { baseValue: 60, range: 0 }),
    m('mssql.perf.checkpoint_pages_sec', 'Checkpoint pages / s', 'performance', 'intermediate', '/s', 'Pages written during checkpoints.',         { baseValue: 4200, range: 1200 }),
    m('mssql.perf.lazy_writes_sec', 'Lazy writes / sec',     'performance', 'intermediate', '/s', 'Buffer Manager lazy writes per second.',         { baseValue: 320, range: 120 }),
    m('mssql.perf.page_splits_sec', 'Page splits / sec',     'performance', 'intermediate', '/s', 'sys.dm_db_index_operational_stats leaf_allocation_count.', { baseValue: 84, range: 30 }),
    m('mssql.perf.full_scans_sec',  'Full scans / sec',      'performance', 'advanced', '/s', 'Full-table scans / second.',                         { baseValue: 12, range: 8 }),
    m('mssql.perf.index_searches_sec','Index searches / sec','performance', 'intermediate', '/s', 'Index searches per second.',                    { baseValue: 18420, range: 4200 }),
    m('mssql.perf.range_scans_sec', 'Range scans / sec',     'performance', 'advanced', '/s', 'Index range scans per second.',                      { baseValue: 920, range: 300 }),
    m('mssql.perf.workfiles_sec',   'Workfiles created / s', 'performance', 'advanced', '/s', 'Temp workfiles allocated per second.',               { baseValue: 4, range: 6 }),
    m('mssql.perf.worktables_sec',  'Worktables created / s','performance', 'advanced', '/s', 'Temp worktables allocated per second.',              { baseValue: 18, range: 12 }),
    m('mssql.perf.connection_resets', 'Login attempts / sec','performance', 'intermediate', '/s', 'Total login attempts per second.',              { baseValue: 142, range: 40 }),
    m('mssql.perf.failed_auto_param','Failed auto-params / s', 'performance', 'advanced', '/s', 'Parameterizations that failed.',                  { baseValue: 4, range: 2 }),

    /* ── Wait Stats (intermediate-heavy) ─────────────────────────────── */
    m('mssql.wait.pageiolatch_sh',  'PAGEIOLATCH_SH',        'waits', 'intermediate', 'ms', 'Reading data page from disk.',                       { format: 'duration', source: 'sys.dm_os_wait_stats', baseValue: 412000, range: 80000 }),
    m('mssql.wait.pageiolatch_ex',  'PAGEIOLATCH_EX',        'waits', 'intermediate', 'ms', 'Exclusive page latch I/O.',                          { format: 'duration', baseValue: 32000, range: 12000 }),
    m('mssql.wait.lck_m_s',         'LCK_M_S',               'waits', 'intermediate', 'ms', 'Shared lock wait.',                                  { format: 'duration', baseValue: 98120, range: 30000 }),
    m('mssql.wait.lck_m_x',         'LCK_M_X',               'waits', 'advanced', 'ms', 'Exclusive lock wait.',                                  { format: 'duration', baseValue: 18400, range: 8000 }),
    m('mssql.wait.cxpacket',        'CXPACKET',              'waits', 'intermediate', 'ms', 'Parallel query synchronization.',                    { format: 'duration', baseValue: 71400, range: 22000 }),
    m('mssql.wait.cxconsumer',      'CXCONSUMER',            'waits', 'advanced', 'ms', 'Parallel consumer wait (>= SQL 2016 SP2).',             { format: 'duration', baseValue: 28000, range: 12000 }),
    m('mssql.wait.async_network_io','ASYNC_NETWORK_IO',      'waits', 'intermediate', 'ms', 'Client not consuming results fast enough.',          { format: 'duration', baseValue: 14200, range: 6000 }),
    m('mssql.wait.writelog',        'WRITELOG',              'waits', 'intermediate', 'ms', 'Transaction log write wait.',                        { format: 'duration', baseValue: 32800, range: 9000 }),
    m('mssql.wait.sos_scheduler_yield','SOS_SCHEDULER_YIELD','waits', 'intermediate', 'ms', 'CPU pressure indicator.',                           { format: 'duration', baseValue: 18600, range: 6000 }),
    m('mssql.wait.latch_ex',        'LATCH_EX',              'waits', 'advanced', 'ms', 'Non-page latch exclusive wait.',                         { format: 'duration', baseValue: 8600, range: 3000 }),
    m('mssql.wait.memory_alloc',    'MEMORY_ALLOCATION_EXT', 'waits', 'advanced', 'ms', 'Large memory allocation wait.',                          { format: 'duration', baseValue: 1200, range: 800 }),
    m('mssql.wait.resource_semaphore','RESOURCE_SEMAPHORE',  'waits', 'advanced', 'ms', 'Workspace memory grant wait.',                           { format: 'duration', baseValue: 4200, range: 1800 }),
    m('mssql.wait.threadpool',      'THREADPOOL',            'waits', 'advanced', 'ms', 'Worker thread exhaustion.',                              { format: 'duration', baseValue: 0, range: 200 }),
    m('mssql.wait.lock_escalation', 'LCK_M_IX (escalation)', 'waits', 'advanced', 'ms', 'Intent-exclusive lock waiting for escalation.',         { format: 'duration', baseValue: 6400, range: 2200 }),
    m('mssql.wait.preemptive_os',   'PREEMPTIVE_OS_*',       'waits', 'advanced', 'ms', 'Aggregate of preemptive OS waits.',                      { format: 'duration', baseValue: 8200, range: 3200 }),
    m('mssql.wait.hadr_sync',       'HADR_SYNC_COMMIT',      'waits', 'advanced', 'ms', 'Always-On synchronous commit wait.',                     { format: 'duration', baseValue: 12800, range: 4400 }),
    m('mssql.wait.tracewrite',      'TRACEWRITE',            'waits', 'advanced', 'ms', 'Trace/Audit/XEvent file write wait.',                    { format: 'duration', baseValue: 920, range: 400 }),

    /* ── Query Store ─────────────────────────────────────────────────── */
    m('mssql.qs.queries_tracked',   'Queries tracked',       'querystore', 'intermediate', '', 'Total queries in Query Store.',                  { format: 'count', baseValue: 18420, range: 4000 }),
    m('mssql.qs.regressed_24h',     'Regressed plans (24h)', 'querystore', 'intermediate', '', 'Plans with > 50% regression last day.',         { format: 'count', baseValue: 8, range: 4 }),
    m('mssql.qs.forced_plans',      'Forced plans',          'querystore', 'advanced', '', 'sys.query_store_plan force_failure_count = 0.',     { format: 'count', baseValue: 12, range: 4 }),
    m('mssql.qs.size_mb',           'Store size',            'querystore', 'intermediate', 'MB', 'Current Query Store size on disk.',              { format: 'number', baseValue: 612, range: 80 }),
    m('mssql.qs.capture_pct',       'Capture %',             'querystore', 'advanced', '%', 'Percentage of statements captured.',                  { format: 'percent', baseValue: 92, range: 5, higherIsBetter: true }),
    m('mssql.qs.stale_threshold',   'Stale threshold',       'querystore', 'advanced', 'd',  'CLEANUP_POLICY stale_query_threshold_days.',         { baseValue: 30, range: 0 }),
    m('mssql.qs.avg_cpu_top10',     'Avg CPU (top 10)',      'querystore', 'basic', 'ms', 'Average CPU for top-10 queries.',                     { format: 'duration', baseValue: 412, range: 120 }),
    m('mssql.qs.avg_dur_top10',     'Avg duration (top 10)', 'querystore', 'basic', 'ms', 'Average elapsed duration for top-10.',                 { format: 'duration', baseValue: 842, range: 280 }),
    m('mssql.qs.execution_top10',   'Top-10 execs / hour',   'querystore', 'intermediate', '/h', 'Hourly executions of top-10 queries.',           { format: 'count', baseValue: 48210, range: 12000 }),
    m('mssql.qs.io_top10',          'Top-10 logical reads',  'querystore', 'advanced', 'pages', 'Logical reads from top-10 queries.',             { baseValue: 18400000, range: 4000000 }),

    /* ── Indexes ─────────────────────────────────────────────────────── */
    m('mssql.idx.total_indexes',    'Total indexes',         'indexes', 'basic', '',  'sys.indexes COUNT(*) for user DBs.',                    { format: 'count', baseValue: 1842, range: 200 }),
    m('mssql.idx.clustered',        'Clustered indexes',     'indexes', 'intermediate', '', 'index_id = 1 count.',                              { format: 'count', baseValue: 412, range: 40 }),
    m('mssql.idx.nonclustered',     'Non-clustered',         'indexes', 'intermediate', '', 'index_id > 1 count.',                              { format: 'count', baseValue: 1430, range: 180 }),
    m('mssql.idx.columnstore',      'Columnstore indexes',   'indexes', 'advanced', '', 'CCI / NCCI count.',                                   { format: 'count', baseValue: 18, range: 6 }),
    m('mssql.idx.fragmented_30',    'Fragmented (> 30%)',    'indexes', 'intermediate', '', 'Indexes with avg_fragmentation > 30%.',           { format: 'count', baseValue: 84, range: 22 }),
    m('mssql.idx.unused',           'Unused (90d)',          'indexes', 'advanced', '', 'sys.dm_db_index_usage_stats with zero reads in 90d.', { format: 'count', baseValue: 22, range: 8 }),
    m('mssql.idx.missing_top5_imp', 'Missing index impact',  'indexes', 'intermediate', '%', 'sys.dm_db_missing_index_details avg_user_impact top 5 avg.', { format: 'percent', baseValue: 78, range: 14 }),
    m('mssql.idx.scan_to_seek',     'Scan-to-seek ratio',    'indexes', 'advanced', '', 'Range/full scans vs seeks ratio.',                   { baseValue: 0.18, range: 0.06 }),
    m('mssql.idx.rebuilds_24h',     'Rebuilds (24h)',        'indexes', 'intermediate', '', 'ALTER INDEX REBUILD events past 24h.',           { format: 'count', baseValue: 36, range: 14 }),
    m('mssql.idx.reorganizes_24h',  'Reorganizes (24h)',     'indexes', 'intermediate', '', 'ALTER INDEX REORGANIZE events past 24h.',         { format: 'count', baseValue: 142, range: 40 }),
    m('mssql.idx.avg_fill_factor',  'Avg fill factor',       'indexes', 'advanced', '%', 'sys.indexes fill_factor average.',                  { format: 'percent', baseValue: 87, range: 6 }),
    m('mssql.idx.duplicate_count',  'Duplicate indexes',     'indexes', 'advanced', '', 'Indexes with overlapping key columns.',              { format: 'count', baseValue: 14, range: 6 }),

    /* ── Locks & Blocking ────────────────────────────────────────────── */
    m('mssql.lock.total_locks',     'Total locks',           'locks', 'basic', '', 'sys.dm_tran_locks COUNT(*).',                            { format: 'count', baseValue: 18400, range: 4200 }),
    m('mssql.lock.blocked_processes','Blocked processes',    'locks', 'basic', '', 'sys.sysprocesses WITH (blocked > 0).',                  { format: 'count', baseValue: 1, range: 4 }),
    m('mssql.lock.deadlocks_hour',  'Deadlocks / hour',      'locks', 'intermediate', '/h', 'SQLServer:Locks Number of Deadlocks/sec * 3600.', { format: 'count', baseValue: 2, range: 3 }),
    m('mssql.lock.lock_waits_sec',  'Lock waits / sec',      'locks', 'intermediate', '/s', 'Lock Waits/sec performance counter.',           { baseValue: 14, range: 6 }),
    m('mssql.lock.avg_wait_time',   'Avg lock wait',         'locks', 'intermediate', 'ms', 'sys.dm_os_wait_stats LCK_* avg.',              { format: 'duration', baseValue: 124, range: 60 }),
    m('mssql.lock.escalations_sec', 'Lock escalations / sec','locks', 'advanced', '/s', 'Lock Escalations/sec counter.',                  { baseValue: 0.4, range: 0.6 }),
    m('mssql.lock.timeouts_sec',    'Lock timeouts / sec',   'locks', 'advanced', '/s', 'Lock Timeouts/sec counter.',                     { baseValue: 0.1, range: 0.2 }),
    m('mssql.lock.exclusive_locks', 'Exclusive (X) locks',   'locks', 'intermediate', '', 'sys.dm_tran_locks request_mode = X count.',     { format: 'count', baseValue: 412, range: 80 }),
    m('mssql.lock.intent_locks',    'Intent locks',          'locks', 'advanced', '', 'IS / IX request modes.',                          { format: 'count', baseValue: 1840, range: 320 }),
    m('mssql.lock.head_blocker_dur','Head blocker duration', 'locks', 'advanced', 's', 'Longest blocking chain head session duration.', { format: 'count', baseValue: 12, range: 18 }),

    /* ── Always-On ───────────────────────────────────────────────────── */
    m('mssql.ag.role',              'AG role',               'alwayson', 'basic', '', 'PRIMARY or SECONDARY (mapped to 1/0).',           { baseValue: 1, range: 0 }),
    m('mssql.ag.synchronized',      'Synchronized replicas', 'alwayson', 'basic', '', 'sys.dm_hadr_database_replica_states synchronization_state = SYNCHRONIZED.', { format: 'count', baseValue: 2, range: 0 }),
    m('mssql.ag.synchronizing',     'Synchronizing replicas','alwayson', 'intermediate', '', 'Async secondaries in SYNCHRONIZING state.',     { format: 'count', baseValue: 1, range: 1 }),
    m('mssql.ag.send_queue_kb',     'Send queue (sec-west)', 'alwayson', 'intermediate', 'KB', 'log_send_queue_size for async replica.',     { format: 'number', baseValue: 4200, range: 1800 }),
    m('mssql.ag.redo_queue_kb',     'Redo queue (sec-west)', 'alwayson', 'intermediate', 'KB', 'redo_queue_size for async replica.',          { format: 'number', baseValue: 1800, range: 900 }),
    m('mssql.ag.redo_rate_kbps',    'Redo rate',             'alwayson', 'intermediate', 'KB/s', 'redo_rate for secondary.',                  { format: 'number', baseValue: 12400, range: 3200 }),
    m('mssql.ag.estimated_lag_sec', 'Estimated lag',         'alwayson', 'basic', 's',  'estimated_data_loss_in_seconds for async replica.', { baseValue: 1.2, range: 0.8 }),
    m('mssql.ag.last_commit',       'Last commit age',       'alwayson', 'intermediate', 's', 'GETDATE() - last_commit_time.',                 { baseValue: 2.4, range: 1.2 }),
    m('mssql.ag.failover_ready',    'Failover-ready secondaries', 'alwayson', 'intermediate', '', 'Sync replicas that are FAILOVER_READY.', { format: 'count', baseValue: 1, range: 0 }),
    m('mssql.ag.cluster_state',     'WSFC quorum healthy',   'alwayson', 'basic', '',  'cluster_state from sys.dm_hadr_cluster.',           { baseValue: 1, range: 0 }),

    /* ── Buffer Pool ─────────────────────────────────────────────────── */
    m('mssql.bp.buffer_hit',        'Buffer cache hit',      'bufferpool', 'basic', '%', 'Buffer Cache Hit Ratio counter.',                 { format: 'percent', baseValue: 99.7, range: 0.3, higherIsBetter: true }),
    m('mssql.bp.ple_seconds',       'Page Life Expectancy',  'bufferpool', 'basic', 's', 'Buffer Manager Page Life Expectancy.',           { baseValue: 8214, range: 2200, higherIsBetter: true }),
    m('mssql.bp.target_pages',      'Target pages',          'bufferpool', 'intermediate', '', 'Buffer Manager target pages.',              { format: 'count', baseValue: 6500000, range: 200000 }),
    m('mssql.bp.total_pages',       'Total pages',           'bufferpool', 'intermediate', '', 'Buffer Manager total pages.',              { format: 'count', baseValue: 6480000, range: 250000 }),
    m('mssql.bp.free_pages',        'Free pages',            'bufferpool', 'intermediate', '', 'Buffer Manager free pages.',                { format: 'count', baseValue: 24800, range: 8200 }),
    m('mssql.bp.stolen_pages',      'Stolen pages',          'bufferpool', 'advanced', '', 'Pages stolen by non-data structures.',         { format: 'count', baseValue: 412000, range: 60000 }),
    m('mssql.bp.checkpoint_pages',  'Checkpoint pages / s',  'bufferpool', 'intermediate', '/s', 'Pages flushed by checkpoint.',           { baseValue: 4200, range: 1200 }),
    m('mssql.bp.lazy_writes',       'Lazy writes / sec',     'bufferpool', 'intermediate', '/s', 'Pages flushed by lazy writer.',          { baseValue: 320, range: 120 }),
    m('mssql.bp.readahead_pages',   'Read-ahead pages / s',  'bufferpool', 'advanced', '/s', 'Buffer Manager read-ahead pages/sec.',     { baseValue: 14800, range: 3200 }),
    m('mssql.bp.database_pages',    'Database pages',        'bufferpool', 'advanced', '', 'Pages cached for user databases.',           { format: 'count', baseValue: 6200000, range: 180000 }),

    /* ── TempDB ──────────────────────────────────────────────────────── */
    m('mssql.tempdb.size_gb',       'TempDB size',           'tempdb', 'basic', 'GB', 'Sum of tempdb file sizes.',                       { format: 'number', baseValue: 48, range: 12 }),
    m('mssql.tempdb.used_gb',       'TempDB used',           'tempdb', 'basic', 'GB', 'sys.dm_db_file_space_usage allocated extents.',  { format: 'number', baseValue: 24, range: 12, higherIsBetter: false }),
    m('mssql.tempdb.pct_full',      'TempDB used %',         'tempdb', 'basic', '%',  'Used / size %.',                                 { format: 'percent', baseValue: 52, range: 25 }),
    m('mssql.tempdb.version_store', 'Version store size',    'tempdb', 'intermediate', 'MB', 'sys.dm_tran_version_store_space_usage.', { format: 'number', baseValue: 1842, range: 400 }),
    m('mssql.tempdb.long_running_tx','Long-running version tx','tempdb', 'advanced', '', 'Active tx older than 5 minutes.',           { format: 'count', baseValue: 2, range: 3 }),
    m('mssql.tempdb.contention_pfs','PFS contention',        'tempdb', 'advanced', '%', 'PAGELATCH 2:1:1 contention.',                  { format: 'percent', baseValue: 1.2, range: 1.4 }),
    m('mssql.tempdb.contention_gam','GAM/SGAM contention',   'tempdb', 'advanced', '%', 'PAGELATCH on alloc bitmaps.',                  { format: 'percent', baseValue: 0.8, range: 0.7 }),
    m('mssql.tempdb.file_count',    'TempDB files',          'tempdb', 'intermediate', '', 'Number of tempdb data files.',              { format: 'count', baseValue: 8, range: 0 }),
    m('mssql.tempdb.autogrowth_24h','Autogrowth events (24h)','tempdb', 'intermediate', '', 'fn_trace_gettable autogrowth count.',     { format: 'count', baseValue: 4, range: 6 }),

    /* ── Backup & Recovery ───────────────────────────────────────────── */
    m('mssql.bk.last_full_age_h',   'Last full backup',      'backup', 'basic', 'h', 'Hours since last full backup completed.',         { baseValue: 14, range: 6, higherIsBetter: false }),
    m('mssql.bk.last_diff_age_h',   'Last diff backup',      'backup', 'intermediate', 'h', 'Hours since last differential.',           { baseValue: 4, range: 2 }),
    m('mssql.bk.last_log_age_min',  'Last log backup',       'backup', 'basic', 'min', 'Minutes since last log backup.',                { baseValue: 8, range: 4 }),
    m('mssql.bk.size_full_gb',      'Last full size',        'backup', 'intermediate', 'GB', 'backup_size from msdb..backupset.',       { format: 'number', baseValue: 184, range: 40 }),
    m('mssql.bk.compression_ratio', 'Compression ratio',     'backup', 'advanced', 'x',  'Compressed / uncompressed ratio.',           { baseValue: 3.4, range: 0.6 }),
    m('mssql.bk.rpo_seconds',       'RPO (log chain)',       'backup', 'intermediate', 's', 'Recovery Point Objective from log chain.', { baseValue: 30, range: 8 }),
    m('mssql.bk.rto_minutes',       'Estimated RTO',         'backup', 'advanced', 'min','Estimated Recovery Time Objective.',          { baseValue: 12, range: 6 }),
    m('mssql.bk.failed_jobs_24h',   'Failed backup jobs',    'backup', 'basic', '',   'SQL Agent backup jobs failed in 24h.',          { format: 'count', baseValue: 0, range: 2 }),
    m('mssql.bk.databases_no_backup','DBs w/o backup 7d',    'backup', 'advanced', '', 'User DBs with no successful backup in 7 days.', { format: 'count', baseValue: 1, range: 1 }),

    /* ── Security ────────────────────────────────────────────────────── */
    m('mssql.sec.failed_logins_24h','Failed logins (24h)',   'security', 'basic', '',  'sys.event_log errors 18456 count.',             { format: 'count', baseValue: 18, range: 12 }),
    m('mssql.sec.locked_accounts',  'Locked accounts',       'security', 'intermediate', '', 'LOGINPROPERTY IsLocked = 1.',             { format: 'count', baseValue: 2, range: 2 }),
    m('mssql.sec.sysadmin_logins',  'sysadmin role members', 'security', 'advanced', '', 'fixed server role sysadmin count.',          { format: 'count', baseValue: 4, range: 1 }),
    m('mssql.sec.tde_databases',    'TDE-encrypted DBs',     'security', 'intermediate', '', 'sys.dm_database_encryption_keys count.', { format: 'count', baseValue: 6, range: 0 }),
    m('mssql.sec.audit_failures',   'Audit failures',        'security', 'advanced', '/d','sys.fn_get_audit_file failure rows.',       { format: 'count', baseValue: 1, range: 2 }),
    m('mssql.sec.permissions_grants','Permission grants 24h','security', 'advanced', '/d', 'GRANT events past 24h.',                 { format: 'count', baseValue: 12, range: 6 }),
    m('mssql.sec.contained_dbs',    'Contained DBs',         'security', 'advanced', '',  'Databases with containment = PARTIAL.',     { format: 'count', baseValue: 2, range: 1 }),

    /* ── Storage & I/O ───────────────────────────────────────────────── */
    m('mssql.io.data_size_gb',      'Data files size',       'storage', 'basic', 'GB',  'Sum of data file sizes.',                       { format: 'number', baseValue: 1842, range: 200 }),
    m('mssql.io.log_size_gb',       'Log files size',        'storage', 'basic', 'GB',  'Sum of log file sizes.',                        { format: 'number', baseValue: 142, range: 30 }),
    m('mssql.io.disk_reads_sec',    'Disk reads / sec',      'storage', 'intermediate', '/s', 'PhysicalDisk Disk Reads/sec counter.',   { baseValue: 1840, range: 420 }),
    m('mssql.io.disk_writes_sec',   'Disk writes / sec',     'storage', 'intermediate', '/s', 'PhysicalDisk Disk Writes/sec counter.', { baseValue: 920, range: 220 }),
    m('mssql.io.avg_read_latency',  'Avg read latency',      'storage', 'intermediate', 'ms', 'sys.dm_io_virtual_file_stats avg read.', { format: 'duration', baseValue: 4.2, range: 1.8 }),
    m('mssql.io.avg_write_latency', 'Avg write latency',     'storage', 'intermediate', 'ms', 'avg write latency from DMV.',           { format: 'duration', baseValue: 2.4, range: 1.2 }),
    m('mssql.io.read_throughput',   'Read throughput',       'storage', 'intermediate', 'MB/s', 'PhysicalDisk read bytes/sec.',         { format: 'number', baseValue: 184, range: 60 }),
    m('mssql.io.write_throughput',  'Write throughput',      'storage', 'intermediate', 'MB/s', 'PhysicalDisk write bytes/sec.',        { format: 'number', baseValue: 92, range: 30 }),
    m('mssql.io.iops',              'IOPS',                  'storage', 'advanced', 'ops/s', 'Total IOPS across data drives.',           { baseValue: 2760, range: 600 }),
    m('mssql.io.queue_length',      'Queue length',          'storage', 'advanced', '', 'PhysicalDisk Current Disk Queue Length.',     { baseValue: 0.4, range: 0.6 }),
    m('mssql.io.tempdb_iops',       'TempDB IOPS',           'storage', 'advanced', 'ops/s', 'TempDB-specific IOPS.',                    { baseValue: 920, range: 240 }),
    m('mssql.io.log_growth_24h',    'Log growth (24h)',      'storage', 'intermediate', 'MB', 'Total log file growth past 24h.',         { format: 'number', baseValue: 240, range: 120 }),
];

const catalog: MetricCatalog = {
    engineId: 'demo-mssql',
    engineLabel: 'Microsoft SQL Server',
    accentColor: SQL_RED,
    sections,
    metrics,
};

export default catalog;
