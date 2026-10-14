// @ts-nocheck — new module 2026-10 (see docs/TS_MIGRATION.md)
/**
 * Read-only T-SQL behind the SQL Server screens, grouped by screen ("view") and
 * panel. Everything reads DMVs, catalog views, msdb history or the error log;
 * nothing modifies the server. Written for SQL Server 2016+ (STRING_AGG and
 * other 2017+ syntax is avoided; panels that need newer DMVs fail on their own
 * and are reported per panel by the service).
 */

// Idle/background waits, after Paul Randal's widely used filter list.
export const BENIGN_WAITS = [
    'AZURE_IMDS_VERSIONS', 'BROKER_EVENTHANDLER', 'BROKER_RECEIVE_WAITFOR', 'BROKER_TASK_STOP', 'BROKER_TO_FLUSH', 'BROKER_TRANSMITTER',
    'CHECKPOINT_QUEUE', 'CHKPT', 'CLR_AUTO_EVENT', 'CLR_MANUAL_EVENT', 'CLR_SEMAPHORE', 'CXCONSUMER',
    'DBMIRROR_DBM_EVENT', 'DBMIRROR_EVENTS_QUEUE', 'DBMIRROR_WORKER_QUEUE', 'DBMIRRORING_CMD', 'DIRTY_PAGE_POLL',
    'DISPATCHER_QUEUE_SEMAPHORE', 'EXECSYNC', 'FSAGENT', 'FT_IFTS_SCHEDULER_IDLE_WAIT', 'FT_IFTSHC_MUTEX',
    'HADR_CLUSAPI_CALL', 'HADR_FILESTREAM_IOMGR_IOCOMPLETION', 'HADR_LOGCAPTURE_WAIT', 'HADR_NOTIFICATION_DEQUEUE',
    'HADR_TIMER_TASK', 'HADR_WORK_QUEUE', 'KSOURCE_WAKEUP', 'LAZYWRITER_SLEEP', 'LOGMGR_QUEUE',
    'MEMORY_ALLOCATION_EXT', 'ONDEMAND_TASK_QUEUE', 'PARALLEL_REDO_DRAIN_WORKER', 'PARALLEL_REDO_LOG_CACHE',
    'PARALLEL_REDO_TRAN_LIST', 'PARALLEL_REDO_WORKER_SYNC', 'PARALLEL_REDO_WORKER_WAIT_WORK',
    'PREEMPTIVE_HADR_LEASE_MECHANISM', 'PREEMPTIVE_OS_FLUSHFILEBUFFERS', 'PREEMPTIVE_SP_SERVER_DIAGNOSTICS',
    'PREEMPTIVE_XE_CALLBACKEXECUTE', 'PREEMPTIVE_XE_DISPATCHER', 'PREEMPTIVE_XE_GETTARGETSTATE',
    'PREEMPTIVE_XE_SESSIONCOMMIT', 'PREEMPTIVE_XE_TARGETFINALIZE', 'PREEMPTIVE_XE_TARGETINIT', 'PVS_PREALLOCATE', 'PWAIT_ALL_COMPONENTS_INITIALIZED',
    'PWAIT_DIRECTLOGCONSUMER_GETNEXT', 'PWAIT_EXTENSIBILITY_CLEANUP_TASK', 'QDS_ASYNC_QUEUE',
    'QDS_CLEANUP_STALE_QUERIES_TASK_MAIN_LOOP_SLEEP', 'QDS_PERSIST_TASK_MAIN_LOOP_SLEEP', 'QDS_SHUTDOWN_QUEUE',
    'REDO_THREAD_PENDING_WORK', 'REQUEST_FOR_DEADLOCK_SEARCH', 'RESOURCE_QUEUE', 'SERVER_IDLE_CHECK',
    'SNI_HTTP_ACCEPT', 'SOS_WORK_DISPATCHER', 'SP_SERVER_DIAGNOSTICS_SLEEP', 'SQLTRACE_BUFFER_FLUSH',
    'SQLTRACE_INCREMENTAL_FLUSH_SLEEP', 'SQLTRACE_WAIT_ENTRIES', 'VDI_CLIENT_OTHER', 'WAIT_FOR_RESULTS', 'WAITFOR',
    'WAITFOR_TASKSHUTDOWN', 'WAIT_XTP_CKPT_CLOSE', 'WAIT_XTP_HOST_WAIT', 'WAIT_XTP_OFFLINE_CKPT_NEW_LOG',
    'WAIT_XTP_RECOVERY', 'XE_BUFFERMGR_ALLPROCESSED_EVENT', 'XE_DISPATCHER_JOIN', 'XE_DISPATCHER_WAIT',
    'XE_LIVE_TARGET_TVF', 'XE_TIMER_EVENT',
];

const NOT_BENIGN = `wait_type NOT LIKE N'SLEEP%'
               AND wait_type NOT IN (${BENIGN_WAITS.map((w) => `N'${w}'`).join(', ')})`;

const WAIT_CATEGORY = `CASE
        WHEN wait_type LIKE N'LCK[_]%' THEN N'Lock'
        WHEN wait_type LIKE N'PAGEIOLATCH[_]%' OR wait_type IN (N'IO_COMPLETION', N'ASYNC_IO_COMPLETION', N'BACKUPIO') THEN N'Disk I/O'
        WHEN wait_type IN (N'WRITELOG', N'LOGBUFFER', N'LOG_RATE_GOVERNOR', N'HADR_SYNC_COMMIT') THEN N'Log write'
        WHEN wait_type LIKE N'PAGELATCH[_]%' OR wait_type LIKE N'LATCH[_]%' THEN N'Latch'
        WHEN wait_type LIKE N'CX%' OR wait_type = N'EXCHANGE' THEN N'Parallelism'
        WHEN wait_type IN (N'SOS_SCHEDULER_YIELD', N'THREADPOOL') THEN N'CPU'
        WHEN wait_type = N'ASYNC_NETWORK_IO' OR wait_type LIKE N'NET[_]%' THEN N'Network'
        WHEN wait_type IN (N'RESOURCE_SEMAPHORE', N'RESOURCE_SEMAPHORE_QUERY_COMPILE', N'CMEMTHREAD') OR wait_type LIKE N'MEMORY[_]%' THEN N'Memory'
        WHEN wait_type LIKE N'PREEMPTIVE[_]%' THEN N'Preemptive (OS)'
        WHEN wait_type LIKE N'HADR[_]%' THEN N'Always On'
        ELSE N'Other' END`;

// Current statement of a request/query-stats row: text between the offsets.
const STATEMENT = (text, req) => `SUBSTRING(${text}.text, (${req}.statement_start_offset / 2) + 1,
        ((CASE ${req}.statement_end_offset WHEN -1 THEN DATALENGTH(${text}.text)
          ELSE ${req}.statement_end_offset END - ${req}.statement_start_offset) / 2) + 1)`;

const MB = (pagesExpr) => `CAST(CAST(${pagesExpr} AS bigint) * 8 / 1024.0 AS decimal(18, 1))`;
const GROWTH = (alias) => `CASE WHEN ${alias}.is_percent_growth = 1 THEN CAST(${alias}.growth AS varchar(10)) + '%'
             WHEN ${alias}.growth = 0 THEN 'none'
             ELSE CAST(CAST(${alias}.growth * 8 / 1024.0 AS decimal(18, 1)) AS varchar(20)) + ' MB' END`;
const MAX_SIZE_MB = (alias) => `CASE ${alias}.max_size WHEN -1 THEN NULL WHEN 268435456 THEN NULL
             ELSE ${MB(`${alias}.max_size`)} END`;

/* ── pulse: cheap snapshot taken on every request, turned into rates/trends ── */
export const PULSE = {
    counters: `
        SELECT RTRIM(SUBSTRING(object_name, CHARINDEX(':', object_name) + 1, 128)) AS obj,
               RTRIM(counter_name) AS counter_name, cntr_value, cntr_type
          FROM sys.dm_os_performance_counters
         WHERE RTRIM(instance_name) IN (N'', N'_Total')
           AND (object_name LIKE N'%:Buffer Manager%' OR object_name LIKE N'%:SQL Statistics%'
                OR object_name LIKE N'%:General Statistics%' OR object_name LIKE N'%:Memory Manager%'
                OR object_name LIKE N'%:Access Methods%' OR object_name LIKE N'%:Locks%'
                OR object_name LIKE N'%:Databases%' OR object_name LIKE N'%:SQL Errors%'
                OR object_name LIKE N'%:Plan Cache%' OR object_name LIKE N'%:Transactions%')`,
    waits: `
        SELECT category, SUM(wait_time_ms) AS wait_ms, SUM(signal_wait_time_ms) AS signal_ms
          FROM (SELECT ${WAIT_CATEGORY} AS category, wait_time_ms, signal_wait_time_ms
                  FROM sys.dm_os_wait_stats
                 WHERE ${NOT_BENIGN}) w
         GROUP BY category`,
    io: `
        SELECT SUM(num_of_reads) AS reads, SUM(num_of_writes) AS writes,
               SUM(num_of_bytes_read) AS bytes_read, SUM(num_of_bytes_written) AS bytes_written,
               SUM(io_stall_read_ms) AS stall_read_ms, SUM(io_stall_write_ms) AS stall_write_ms
          FROM sys.dm_io_virtual_file_stats(NULL, NULL)`,
};

// Settings the advisor reasons about (MAXDOP, memory, ad-hoc plans, CPUs/NUMA).
const SERVER_CONFIG = `
    SELECT (SELECT CAST(value_in_use AS int) FROM sys.configurations WHERE name = N'max degree of parallelism') AS maxdop,
           (SELECT CAST(value_in_use AS int) FROM sys.configurations WHERE name = N'cost threshold for parallelism') AS cost_threshold,
           (SELECT CAST(value_in_use AS int) FROM sys.configurations WHERE name = N'optimize for ad hoc workloads') AS optimize_adhoc,
           (SELECT CAST(value_in_use AS bigint) FROM sys.configurations WHERE name = N'max server memory (MB)') AS max_server_memory_mb,
           (SELECT cpu_count FROM sys.dm_os_sys_info) AS cpu_count,
           (SELECT physical_memory_kb FROM sys.dm_os_sys_info) AS physical_memory_kb,
           (SELECT COUNT(*) FROM sys.dm_os_memory_nodes WHERE memory_node_id < 64) AS numa_nodes,
           CAST(SERVERPROPERTY('EngineEdition') AS int) AS engine_edition,
           CAST(SERVERPROPERTY('Edition') AS nvarchar(128)) AS edition,
           DB_NAME() AS current_database`;

/* ── screens ─────────────────────────────────────────────────────────────── */
/**
 * User databases for the database picker on the per-database screens (Tables &
 * Indexes, Query Store); is_current marks the one this connection is using.
 */
const DATABASE_LIST = `
            SELECT d.name AS database_name, d.state_desc, HAS_DBACCESS(d.name) AS has_access,
                   CAST(SUM(CAST(mf.size AS bigint)) * 8 / 1024.0 AS decimal(18, 1)) AS size_mb,
                   CASE WHEN d.name = DB_NAME() THEN 1 ELSE 0 END AS is_current
              FROM sys.databases d
              LEFT JOIN sys.master_files mf ON mf.database_id = d.database_id
             WHERE d.database_id > 4 OR d.name = DB_NAME()
             GROUP BY d.name, d.state_desc
             ORDER BY d.name`;

export const QUERIES = {
    overview: {
        server: `
            SELECT LEFT(@@VERSION, CHARINDEX(N' (', @@VERSION + N' (') - 1) AS product_name,
                   CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(128)) AS product_version,
                   CAST(SERVERPROPERTY('ProductLevel') AS nvarchar(128)) AS product_level,
                   CAST(SERVERPROPERTY('ProductUpdateLevel') AS nvarchar(128)) AS product_update_level,
                   CAST(SERVERPROPERTY('Edition') AS nvarchar(128)) AS edition,
                   CAST(SERVERPROPERTY('MachineName') AS nvarchar(128)) AS machine_name,
                   CAST(SERVERPROPERTY('InstanceName') AS nvarchar(128)) AS instance_name,
                   CAST(SERVERPROPERTY('Collation') AS nvarchar(128)) AS collation,
                   CAST(SERVERPROPERTY('IsClustered') AS int) AS is_clustered,
                   CAST(SERVERPROPERTY('IsHadrEnabled') AS int) AS is_hadr_enabled,
                   CAST(SERVERPROPERTY('IsIntegratedSecurityOnly') AS int) AS windows_auth_only,
                   @@SERVERNAME AS server_name, DB_NAME() AS current_database,
                   i.sqlserver_start_time AS start_time,
                   DATEDIFF(SECOND, i.sqlserver_start_time, SYSDATETIME()) AS uptime_seconds,
                   i.cpu_count, i.hyperthread_ratio, i.scheduler_count, i.max_workers_count,
                   i.physical_memory_kb, i.committed_kb, i.committed_target_kb, i.virtual_machine_type_desc
              FROM sys.dm_os_sys_info i`,
        host: `SELECT host_platform, host_distribution, host_release FROM sys.dm_os_host_info`,
        activity: `
            SELECT (SELECT COUNT(*) FROM sys.dm_exec_sessions WHERE is_user_process = 1) AS user_sessions,
                   (SELECT COUNT(*) FROM sys.dm_exec_sessions WHERE is_user_process = 0) AS system_sessions,
                   (SELECT COUNT(*) FROM sys.dm_exec_connections) AS connections,
                   (SELECT COUNT(*) FROM sys.dm_exec_requests r
                      JOIN sys.dm_exec_sessions s ON s.session_id = r.session_id
                     WHERE s.is_user_process = 1 AND r.session_id <> @@SPID) AS active_requests,
                   (SELECT COUNT(*) FROM sys.dm_exec_requests WHERE blocking_session_id <> 0) AS blocked_requests,
                   (SELECT ISNULL(MAX(wait_time), 0) FROM sys.dm_exec_requests WHERE blocking_session_id <> 0) AS longest_block_ms,
                   (SELECT SUM(runnable_tasks_count) FROM sys.dm_os_schedulers WHERE status = N'VISIBLE ONLINE') AS runnable_tasks,
                   (SELECT SUM(current_workers_count) FROM sys.dm_os_schedulers WHERE status = N'VISIBLE ONLINE') AS current_workers,
                   (SELECT SUM(active_workers_count) FROM sys.dm_os_schedulers WHERE status = N'VISIBLE ONLINE') AS active_workers,
                   (SELECT COUNT(*) FROM sys.databases WHERE database_id > 4) AS user_databases,
                   (SELECT COUNT(*) FROM sys.databases WHERE state <> 0) AS databases_not_online`,
        cpuHistory: `
            SELECT TOP 240
                   DATEADD(ms, -1 * (si.ms_ticks - x.[timestamp]), SYSDATETIME()) AS event_time,
                   x.record.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]', 'int') AS sql_cpu_pct,
                   x.record.value('(./Record/SchedulerMonitorEvent/SystemHealth/SystemIdle)[1]', 'int') AS system_idle_pct
              FROM (SELECT [timestamp], CONVERT(xml, record) AS record
                      FROM sys.dm_os_ring_buffers
                     WHERE ring_buffer_type = N'RING_BUFFER_SCHEDULER_MONITOR'
                       AND record LIKE N'%<SystemHealth>%') x
             CROSS JOIN sys.dm_os_sys_info si
             ORDER BY x.[timestamp] DESC`,
        memory: `
            SELECT pm.physical_memory_in_use_kb, pm.memory_utilization_percentage,
                   pm.process_physical_memory_low, pm.process_virtual_memory_low,
                   sm.total_physical_memory_kb, sm.available_physical_memory_kb, sm.system_memory_state_desc,
                   (SELECT CAST(value_in_use AS bigint) FROM sys.configurations WHERE name = N'max server memory (MB)') AS max_server_memory_mb,
                   (SELECT CAST(value_in_use AS bigint) FROM sys.configurations WHERE name = N'min server memory (MB)') AS min_server_memory_mb
              FROM sys.dm_os_process_memory pm
             CROSS JOIN sys.dm_os_sys_memory sm`,
        databases: `
            SELECT d.database_id, d.name, d.state_desc, d.recovery_model_desc, d.compatibility_level, d.create_date,
                   d.user_access_desc, d.is_read_only, d.log_reuse_wait_desc, d.is_auto_close_on, d.is_auto_shrink_on,
                   d.page_verify_option_desc,
                   CAST(f.data_pages * 8 / 1024.0 AS decimal(18, 1)) AS data_mb,
                   CAST(f.log_pages * 8 / 1024.0 AS decimal(18, 1)) AS log_mb
              FROM sys.databases d
             OUTER APPLY (SELECT SUM(CASE WHEN mf.type = 0 THEN CAST(mf.size AS bigint) ELSE 0 END) AS data_pages,
                                 SUM(CASE WHEN mf.type = 1 THEN CAST(mf.size AS bigint) ELSE 0 END) AS log_pages
                            FROM sys.master_files mf WHERE mf.database_id = d.database_id) f
             ORDER BY d.name`,
        backupAges: `
            SELECT bs.database_name COLLATE DATABASE_DEFAULT AS database_name,
                   MAX(CASE WHEN bs.type = 'D' THEN bs.backup_finish_date END) AS last_full,
                   MAX(CASE WHEN bs.type = 'L' THEN bs.backup_finish_date END) AS last_log
              FROM msdb.dbo.backupset bs
             GROUP BY bs.database_name`,
    },

    performance: {
        serverConfig: SERVER_CONFIG,
        waits: `
            SELECT TOP 20 wait_type, ${WAIT_CATEGORY} AS category, waiting_tasks_count, wait_time_ms, signal_wait_time_ms,
                   CAST(wait_time_ms * 1.0 / NULLIF(waiting_tasks_count, 0) AS decimal(18, 2)) AS avg_wait_ms,
                   CAST(100.0 * wait_time_ms / NULLIF(SUM(wait_time_ms) OVER (), 0) AS decimal(5, 2)) AS pct
              FROM sys.dm_os_wait_stats
             WHERE waiting_tasks_count > 0 AND ${NOT_BENIGN}
             ORDER BY wait_time_ms DESC`,
        waitCategories: `
            SELECT category, SUM(wait_time_ms) AS wait_ms, SUM(signal_wait_time_ms) AS signal_ms,
                   SUM(waiting_tasks_count) AS waits
              FROM (SELECT ${WAIT_CATEGORY} AS category, wait_time_ms, signal_wait_time_ms, waiting_tasks_count
                      FROM sys.dm_os_wait_stats WHERE ${NOT_BENIGN}) w
             GROUP BY category
             ORDER BY wait_ms DESC`,
        topQueries: `
            WITH qs AS (
                SELECT qs.*,
                       ROW_NUMBER() OVER (ORDER BY qs.total_worker_time DESC) AS r_cpu,
                       ROW_NUMBER() OVER (ORDER BY qs.total_elapsed_time DESC) AS r_dur,
                       ROW_NUMBER() OVER (ORDER BY qs.total_logical_reads DESC) AS r_reads,
                       ROW_NUMBER() OVER (ORDER BY qs.execution_count DESC) AS r_execs
                  FROM sys.dm_exec_query_stats qs)
            SELECT q.execution_count,
                   q.total_worker_time / 1000 AS total_cpu_ms,
                   q.total_elapsed_time / 1000 AS total_elapsed_ms,
                   CAST(q.total_worker_time / 1000.0 / NULLIF(q.execution_count, 0) AS decimal(18, 2)) AS avg_cpu_ms,
                   CAST(q.total_elapsed_time / 1000.0 / NULLIF(q.execution_count, 0) AS decimal(18, 2)) AS avg_elapsed_ms,
                   q.total_logical_reads,
                   CAST(q.total_logical_reads * 1.0 / NULLIF(q.execution_count, 0) AS decimal(18, 1)) AS avg_logical_reads,
                   q.total_physical_reads, q.total_logical_writes, q.total_rows,
                   q.creation_time AS plan_created, q.last_execution_time,
                   DB_NAME(st.dbid) AS database_name,
                   OBJECT_NAME(st.objectid, st.dbid) AS object_name,
                   LEFT(${STATEMENT('st', 'q')}, 4000) AS query_text
              FROM qs q
             CROSS APPLY sys.dm_exec_sql_text(q.sql_handle) st
             WHERE q.r_cpu <= 20 OR q.r_dur <= 20 OR q.r_reads <= 20 OR q.r_execs <= 20`,
    },

    querystore: {
        databaseList: DATABASE_LIST,
        options: `
            SELECT DB_NAME() AS database_name, actual_state_desc, desired_state_desc, readonly_reason,
                   current_storage_size_mb, max_storage_size_mb, query_capture_mode_desc,
                   stale_query_threshold_days, interval_length_minutes,
                   (SELECT COUNT(*) FROM sys.query_store_query) AS queries,
                   (SELECT COUNT(*) FROM sys.query_store_plan) AS plans,
                   (SELECT COUNT(*) FROM sys.query_store_plan WHERE is_forced_plan = 1) AS forced_plans
              FROM sys.database_query_store_options`,
        top: `
            SELECT TOP 25 q.query_id,
                   MAX(OBJECT_NAME(q.object_id)) AS object_name,
                   LEFT(MAX(qt.query_sql_text), 4000) AS query_text,
                   COUNT(DISTINCT p.plan_id) AS plan_count,
                   SUM(rs.count_executions) AS executions,
                   CAST(SUM(rs.avg_duration * rs.count_executions) / NULLIF(SUM(rs.count_executions), 0) / 1000.0 AS decimal(18, 2)) AS avg_duration_ms,
                   CAST(SUM(rs.avg_cpu_time * rs.count_executions) / NULLIF(SUM(rs.count_executions), 0) / 1000.0 AS decimal(18, 2)) AS avg_cpu_ms,
                   CAST(SUM(rs.avg_logical_io_reads * rs.count_executions) / NULLIF(SUM(rs.count_executions), 0) AS decimal(18, 1)) AS avg_logical_reads,
                   CAST(SUM(rs.avg_duration * rs.count_executions) / 1000.0 AS decimal(18, 0)) AS total_duration_ms,
                   MAX(rs.last_execution_time) AS last_execution_time,
                   MAX(CAST(p.is_forced_plan AS int)) AS has_forced_plan
              FROM sys.query_store_runtime_stats rs
              JOIN sys.query_store_runtime_stats_interval i ON i.runtime_stats_interval_id = rs.runtime_stats_interval_id
              JOIN sys.query_store_plan p ON p.plan_id = rs.plan_id
              JOIN sys.query_store_query q ON q.query_id = p.query_id
              JOIN sys.query_store_query_text qt ON qt.query_text_id = q.query_text_id
             WHERE i.end_time > DATEADD(HOUR, -24, SYSDATETIMEOFFSET())
             GROUP BY q.query_id
             ORDER BY total_duration_ms DESC`,
        regressed: `
            WITH per_plan AS (
                SELECT p.query_id, p.plan_id, SUM(rs.count_executions) AS execs,
                       SUM(rs.avg_duration * rs.count_executions) / NULLIF(SUM(rs.count_executions), 0) AS avg_us,
                       MAX(rs.last_execution_time) AS last_exec,
                       MAX(CAST(p.is_forced_plan AS int)) AS forced
                  FROM sys.query_store_runtime_stats rs
                  JOIN sys.query_store_runtime_stats_interval i ON i.runtime_stats_interval_id = rs.runtime_stats_interval_id
                  JOIN sys.query_store_plan p ON p.plan_id = rs.plan_id
                 WHERE i.end_time > DATEADD(DAY, -7, SYSDATETIMEOFFSET())
                 GROUP BY p.query_id, p.plan_id),
            ranked AS (
                SELECT *, ROW_NUMBER() OVER (PARTITION BY query_id ORDER BY last_exec DESC) AS rn_recent,
                       MIN(avg_us) OVER (PARTITION BY query_id) AS best_us,
                       COUNT(*) OVER (PARTITION BY query_id) AS plans
                  FROM per_plan)
            SELECT TOP 20 r.query_id, r.plan_id AS current_plan_id,
                   (SELECT TOP 1 b.plan_id FROM per_plan b WHERE b.query_id = r.query_id ORDER BY b.avg_us) AS best_plan_id,
                   r.plans AS plan_count,
                   CAST(r.best_us / 1000.0 AS decimal(18, 2)) AS best_avg_ms,
                   CAST(r.avg_us / 1000.0 AS decimal(18, 2)) AS current_avg_ms,
                   CAST(100.0 * (r.avg_us - r.best_us) / NULLIF(r.best_us, 0) AS decimal(18, 1)) AS regression_pct,
                   r.execs AS current_plan_execs, r.last_exec AS last_execution_time, r.forced,
                   LEFT(qt.query_sql_text, 4000) AS query_text
              FROM ranked r
              JOIN sys.query_store_query q ON q.query_id = r.query_id
              JOIN sys.query_store_query_text qt ON qt.query_text_id = q.query_text_id
             WHERE r.rn_recent = 1 AND r.plans > 1 AND r.avg_us > 1.5 * r.best_us AND r.avg_us > 1000
             ORDER BY (r.avg_us - r.best_us) * r.execs DESC`,
    },

    sessions: {
        sessions: `
            SELECT s.session_id, s.login_name, s.host_name, s.program_name,
                   DB_NAME(s.database_id) AS database_name,
                   s.status AS session_status, r.status AS request_status, r.command,
                   r.wait_type, r.wait_time AS wait_ms, r.blocking_session_id,
                   r.cpu_time AS cpu_ms, r.total_elapsed_time AS elapsed_ms, r.logical_reads,
                   s.open_transaction_count, s.login_time, s.last_request_end_time,
                   LEFT(${STATEMENT('t', 'r')}, 2000) AS current_statement
              FROM sys.dm_exec_sessions s
              LEFT JOIN sys.dm_exec_requests r ON r.session_id = s.session_id
             OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t
             WHERE s.is_user_process = 1 AND s.session_id <> @@SPID
             ORDER BY CASE WHEN r.session_id IS NULL THEN 1 ELSE 0 END, r.total_elapsed_time DESC, s.session_id`,
        blocking: `
            SELECT r.session_id AS blocked_session, r.blocking_session_id AS blocking_session,
                   r.wait_type, r.wait_time AS wait_ms, r.wait_resource, DB_NAME(r.database_id) AS database_name,
                   bs.login_name AS blocking_login, bs.host_name AS blocking_host, bs.program_name AS blocking_program,
                   LEFT(t.text, 2000) AS blocked_statement,
                   (SELECT TOP 1 LEFT(bt.text, 2000)
                      FROM sys.dm_exec_connections bc
                     CROSS APPLY sys.dm_exec_sql_text(bc.most_recent_sql_handle) bt
                     WHERE bc.session_id = r.blocking_session_id) AS blocking_statement
              FROM sys.dm_exec_requests r
              LEFT JOIN sys.dm_exec_sessions bs ON bs.session_id = r.blocking_session_id
             OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t
             WHERE r.blocking_session_id <> 0
             ORDER BY r.wait_time DESC`,
        locks: `
            SELECT resource_type, request_mode, request_status,
                   COUNT(*) AS lock_count, COUNT(DISTINCT request_session_id) AS sessions
              FROM sys.dm_tran_locks
             WHERE request_session_id <> @@SPID
             GROUP BY resource_type, request_mode, request_status
             ORDER BY lock_count DESC`,
        transactions: `
            SELECT TOP 25 st.session_id, s.login_name, s.host_name, s.program_name,
                   at.name AS transaction_name, at.transaction_begin_time,
                   DATEDIFF(SECOND, at.transaction_begin_time, GETDATE()) AS duration_sec,
                   CASE at.transaction_type WHEN 1 THEN 'Read/write' WHEN 2 THEN 'Read-only'
                        WHEN 3 THEN 'System' WHEN 4 THEN 'Distributed' END AS transaction_type,
                   CASE at.transaction_state WHEN 0 THEN 'Initializing' WHEN 1 THEN 'Initialized'
                        WHEN 2 THEN 'Active' WHEN 3 THEN 'Ended' WHEN 4 THEN 'Commit started'
                        WHEN 5 THEN 'Prepared' WHEN 6 THEN 'Committed' WHEN 7 THEN 'Rolling back'
                        WHEN 8 THEN 'Rolled back' END AS state,
                   (SELECT SUM(dt.database_transaction_log_bytes_used)
                      FROM sys.dm_tran_database_transactions dt
                     WHERE dt.transaction_id = at.transaction_id) AS log_bytes_used
              FROM sys.dm_tran_active_transactions at
              JOIN sys.dm_tran_session_transactions st ON st.transaction_id = at.transaction_id
              JOIN sys.dm_exec_sessions s ON s.session_id = st.session_id
             WHERE s.is_user_process = 1 AND st.session_id <> @@SPID
             ORDER BY at.transaction_begin_time`,
        deadlocks: `
            SELECT TOP 20 x.xed.value('@timestamp', 'datetime2') AS event_time,
                   CAST(x.xed.query('(data[@name="xml_report"]/value/deadlock)[1]') AS nvarchar(max)) AS deadlock_xml
              FROM (SELECT CAST(t.target_data AS xml) AS target_xml
                      FROM sys.dm_xe_session_targets t
                      JOIN sys.dm_xe_sessions s ON s.address = t.event_session_address
                     WHERE s.name = N'system_health' AND t.target_name = N'ring_buffer') d
             CROSS APPLY d.target_xml.nodes('RingBufferTarget/event[@name="xml_deadlock_report"]') AS x(xed)
             ORDER BY event_time DESC`,
    },

    storage: {
        databaseList: DATABASE_LIST,
        tables: `
            SELECT TOP 100 s.name AS schema_name, t.name AS table_name,
                   SUM(CASE WHEN p.index_id < 2 THEN p.row_count ELSE 0 END) AS row_count,
                   SUM(p.reserved_page_count) * 8 AS reserved_kb,
                   SUM(CASE WHEN p.index_id < 2
                            THEN p.in_row_data_page_count + p.lob_used_page_count + p.row_overflow_used_page_count
                            ELSE 0 END) * 8 AS data_kb,
                   SUM(CASE WHEN p.index_id >= 2 THEN p.used_page_count ELSE 0 END) * 8 AS index_kb,
                   MAX(CASE WHEN p.index_id = 0 THEN 1 ELSE 0 END) AS is_heap
              FROM sys.dm_db_partition_stats p
              JOIN sys.tables t  ON t.object_id = p.object_id
              JOIN sys.schemas s ON s.schema_id = t.schema_id
             WHERE t.is_ms_shipped = 0
             GROUP BY s.name, t.name
             ORDER BY reserved_kb DESC`,
        indexSummary: `
            SELECT DB_NAME() AS database_name, COUNT(*) AS total_indexes,
                   SUM(CASE WHEN i.type = 1 THEN 1 ELSE 0 END) AS clustered_indexes,
                   SUM(CASE WHEN i.type = 2 THEN 1 ELSE 0 END) AS nonclustered_indexes,
                   SUM(CASE WHEN i.type IN (5, 6) THEN 1 ELSE 0 END) AS columnstore_indexes,
                   SUM(CASE WHEN i.type = 0 THEN 1 ELSE 0 END) AS heaps,
                   SUM(CASE WHEN i.is_disabled = 1 THEN 1 ELSE 0 END) AS disabled,
                   SUM(CASE WHEN i.type = 2 AND i.is_primary_key = 0 AND i.is_unique_constraint = 0
                             AND ISNULL(us.user_seeks, 0) + ISNULL(us.user_scans, 0) + ISNULL(us.user_lookups, 0) = 0
                            THEN 1 ELSE 0 END) AS unused_since_restart,
                   CAST(AVG(CASE WHEN i.type IN (1, 2) THEN CASE i.fill_factor WHEN 0 THEN 100.0 ELSE i.fill_factor END END) AS decimal(5, 1)) AS avg_fill_factor,
                   SUM(ISNULL(us.user_seeks, 0)) AS total_seeks,
                   SUM(ISNULL(us.user_scans, 0)) AS total_scans,
                   SUM(ISNULL(us.user_lookups, 0)) AS total_lookups
              FROM sys.indexes i
              JOIN sys.objects o ON o.object_id = i.object_id
              LEFT JOIN sys.dm_db_index_usage_stats us
                     ON us.object_id = i.object_id AND us.index_id = i.index_id AND us.database_id = DB_ID()
             WHERE o.is_ms_shipped = 0 AND o.type = 'U' AND i.is_hypothetical = 0`,
        indexUsage: `
            SELECT TOP 100 OBJECT_SCHEMA_NAME(i.object_id) AS schema_name, OBJECT_NAME(i.object_id) AS table_name,
                   i.name AS index_name, i.type_desc, i.is_unique, i.is_primary_key,
                   ISNULL(us.user_seeks, 0) AS seeks, ISNULL(us.user_scans, 0) AS scans,
                   ISNULL(us.user_lookups, 0) AS lookups, ISNULL(us.user_updates, 0) AS updates,
                   us.last_user_seek, us.last_user_scan, ps.size_kb
              FROM sys.indexes i
              JOIN sys.objects o ON o.object_id = i.object_id
              LEFT JOIN (SELECT object_id, index_id, SUM(used_page_count) * 8 AS size_kb
                           FROM sys.dm_db_partition_stats GROUP BY object_id, index_id) ps
                     ON ps.object_id = i.object_id AND ps.index_id = i.index_id
              LEFT JOIN sys.dm_db_index_usage_stats us
                     ON us.object_id = i.object_id AND us.index_id = i.index_id AND us.database_id = DB_ID()
             WHERE o.is_ms_shipped = 0 AND o.type = 'U' AND i.index_id > 0 AND i.is_hypothetical = 0
             ORDER BY size_kb DESC`,
        missingIndexes: `
            SELECT TOP 50 DB_NAME(mid.database_id) AS database_name,
                   mid.statement AS table_name, mid.equality_columns, mid.inequality_columns, mid.included_columns,
                   migs.user_seeks, migs.user_scans, migs.avg_user_impact, migs.last_user_seek,
                   CAST(migs.user_seeks * migs.avg_total_user_cost * (migs.avg_user_impact / 100.0) AS decimal(18, 2)) AS improvement_score
              FROM sys.dm_db_missing_index_groups mig
              JOIN sys.dm_db_missing_index_group_stats migs ON migs.group_handle = mig.index_group_handle
              JOIN sys.dm_db_missing_index_details mid ON mid.index_handle = mig.index_handle
             WHERE mid.database_id > 4 -- every user database on the instance, not only the selected one
             ORDER BY improvement_score DESC`,
        fragmentation: `
            SELECT TOP 50 OBJECT_SCHEMA_NAME(ips.object_id) AS schema_name, OBJECT_NAME(ips.object_id) AS table_name,
                   i.name AS index_name, ips.index_type_desc,
                   CAST(ips.avg_fragmentation_in_percent AS decimal(5, 2)) AS fragmentation_pct, ips.page_count,
                   CASE WHEN ips.avg_fragmentation_in_percent >= 30 THEN 'REBUILD'
                        WHEN ips.avg_fragmentation_in_percent >= 10 THEN 'REORGANIZE' ELSE '' END AS action
              FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
              JOIN sys.indexes i ON i.object_id = ips.object_id AND i.index_id = ips.index_id
             WHERE ips.index_id > 0 AND ips.page_count >= 100 AND ips.alloc_unit_type_desc = N'IN_ROW_DATA'
             ORDER BY ips.avg_fragmentation_in_percent DESC`,
        duplicates: `
            WITH k AS (
                SELECT i.object_id, i.index_id, i.name,
                       (SELECT CAST(ic.column_id AS varchar(10)) + CASE WHEN ic.is_descending_key = 1 THEN 'd' ELSE 'a' END + ','
                          FROM sys.index_columns ic
                         WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.key_ordinal > 0
                         ORDER BY ic.key_ordinal FOR XML PATH('')) AS key_sig,
                       STUFF((SELECT N', ' + c.name
                                FROM sys.index_columns ic
                                JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                               WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.key_ordinal > 0
                               ORDER BY ic.key_ordinal FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, N'') AS key_columns
                  FROM sys.indexes i
                  JOIN sys.objects o ON o.object_id = i.object_id
                 WHERE o.is_ms_shipped = 0 AND o.type = 'U' AND i.type IN (1, 2) AND i.is_hypothetical = 0)
            SELECT TOP 50 OBJECT_SCHEMA_NAME(a.object_id) AS schema_name, OBJECT_NAME(a.object_id) AS table_name,
                   a.name AS index_name, b.name AS duplicate_of, a.key_columns
              FROM k a
              JOIN k b ON b.object_id = a.object_id AND b.key_sig = a.key_sig AND b.index_id < a.index_id`,
    },

    memory: {
        serverConfig: SERVER_CONFIG,
        memory: `
            SELECT pm.physical_memory_in_use_kb, pm.locked_page_allocations_kb, pm.memory_utilization_percentage,
                   pm.process_physical_memory_low, pm.process_virtual_memory_low,
                   sm.total_physical_memory_kb, sm.available_physical_memory_kb, sm.system_memory_state_desc,
                   (SELECT CAST(value_in_use AS bigint) FROM sys.configurations WHERE name = N'max server memory (MB)') AS max_server_memory_mb,
                   (SELECT CAST(value_in_use AS bigint) FROM sys.configurations WHERE name = N'min server memory (MB)') AS min_server_memory_mb
              FROM sys.dm_os_process_memory pm
             CROSS JOIN sys.dm_os_sys_memory sm`,
        clerks: `
            SELECT TOP 12 type AS clerk_type, CAST(SUM(pages_kb) / 1024.0 AS decimal(18, 1)) AS mb
              FROM sys.dm_os_memory_clerks
             GROUP BY type
             ORDER BY SUM(pages_kb) DESC`,
        bufferByDb: `
            SELECT CASE database_id WHEN 32767 THEN N'ResourceDb' ELSE DB_NAME(database_id) END AS database_name,
                   CAST(COUNT_BIG(*) * 8 / 1024.0 AS decimal(18, 1)) AS cached_mb,
                   CAST(SUM(CASE WHEN is_modified = 1 THEN 1 ELSE 0 END) * 8 / 1024.0 AS decimal(18, 1)) AS dirty_mb
              FROM sys.dm_os_buffer_descriptors
             GROUP BY database_id
             ORDER BY cached_mb DESC`,
        planCache: `
            SELECT objtype, COUNT_BIG(*) AS plans,
                   CAST(SUM(CAST(size_in_bytes AS bigint)) / 1048576.0 AS decimal(18, 1)) AS size_mb,
                   SUM(CASE WHEN usecounts = 1 THEN 1 ELSE 0 END) AS single_use_plans,
                   CAST(SUM(CASE WHEN usecounts = 1 THEN CAST(size_in_bytes AS bigint) ELSE 0 END) / 1048576.0 AS decimal(18, 1)) AS single_use_mb,
                   AVG(CAST(usecounts AS bigint)) AS avg_use_count
              FROM sys.dm_exec_cached_plans
             GROUP BY objtype
             ORDER BY size_mb DESC`,
        grants: `
            SELECT g.session_id, g.request_time, g.grant_time, g.requested_memory_kb, g.granted_memory_kb,
                   g.used_memory_kb, g.wait_time_ms, g.dop, LEFT(t.text, 1000) AS query_text
              FROM sys.dm_exec_query_memory_grants g
             OUTER APPLY sys.dm_exec_sql_text(g.sql_handle) t
             WHERE g.session_id <> @@SPID
             ORDER BY g.requested_memory_kb DESC`,
        tempdbFiles: `
            SELECT f.name AS file_name, f.type_desc, f.physical_name, ${MB('f.size')} AS size_mb,
                   ${MAX_SIZE_MB('f')} AS max_size_mb, ${GROWTH('f')} AS growth
              FROM tempdb.sys.database_files f
             ORDER BY f.type, f.file_id`,
        tempdbUsage: `
            SELECT ${MB('SUM(unallocated_extent_page_count)')} AS free_mb,
                   ${MB('SUM(user_object_reserved_page_count)')} AS user_objects_mb,
                   ${MB('SUM(internal_object_reserved_page_count)')} AS internal_objects_mb,
                   ${MB('SUM(version_store_reserved_page_count)')} AS version_store_mb,
                   ${MB('SUM(mixed_extent_page_count)')} AS mixed_extents_mb
              FROM tempdb.sys.dm_db_file_space_usage`,
        tempdbConsumers: `
            SELECT TOP 15 su.session_id, s.login_name, s.host_name, s.program_name,
                   ${MB('su.user_objects_alloc_page_count + ISNULL(t.user_alloc, 0)')} AS user_objects_mb,
                   ${MB('su.internal_objects_alloc_page_count + ISNULL(t.internal_alloc, 0)')} AS internal_objects_mb
              FROM sys.dm_db_session_space_usage su
              JOIN sys.dm_exec_sessions s ON s.session_id = su.session_id
              LEFT JOIN (SELECT session_id, SUM(user_objects_alloc_page_count) AS user_alloc,
                                SUM(internal_objects_alloc_page_count) AS internal_alloc
                           FROM sys.dm_db_task_space_usage GROUP BY session_id) t ON t.session_id = su.session_id
             WHERE s.is_user_process = 1
               AND su.user_objects_alloc_page_count + su.internal_objects_alloc_page_count
                   + ISNULL(t.user_alloc, 0) + ISNULL(t.internal_alloc, 0) > 0
             ORDER BY su.user_objects_alloc_page_count + su.internal_objects_alloc_page_count
                      + ISNULL(t.user_alloc, 0) + ISNULL(t.internal_alloc, 0) DESC`,
    },

    io: {
        files: `
            SELECT DB_NAME(vfs.database_id) AS database_name, mf.name AS file_name, mf.type_desc, mf.physical_name,
                   ${MB('mf.size')} AS size_mb, ${MAX_SIZE_MB('mf')} AS max_size_mb, ${GROWTH('mf')} AS growth,
                   vfs.num_of_reads, vfs.num_of_writes,
                   CAST(vfs.num_of_bytes_read / 1048576.0 AS decimal(18, 1)) AS mb_read,
                   CAST(vfs.num_of_bytes_written / 1048576.0 AS decimal(18, 1)) AS mb_written,
                   CAST(vfs.io_stall_read_ms * 1.0 / NULLIF(vfs.num_of_reads, 0) AS decimal(18, 2)) AS avg_read_ms,
                   CAST(vfs.io_stall_write_ms * 1.0 / NULLIF(vfs.num_of_writes, 0) AS decimal(18, 2)) AS avg_write_ms
              FROM sys.dm_io_virtual_file_stats(NULL, NULL) vfs
              JOIN sys.master_files mf ON mf.database_id = vfs.database_id AND mf.file_id = vfs.file_id
             ORDER BY vfs.io_stall_read_ms + vfs.io_stall_write_ms DESC`,
        volumes: `
            SELECT DISTINCT vs.volume_mount_point, vs.logical_volume_name, vs.file_system_type,
                   CAST(vs.total_bytes / 1073741824.0 AS decimal(18, 1)) AS total_gb,
                   CAST(vs.available_bytes / 1073741824.0 AS decimal(18, 1)) AS free_gb,
                   CAST(100.0 * vs.available_bytes / NULLIF(vs.total_bytes, 0) AS decimal(5, 1)) AS free_pct
              FROM sys.master_files mf
             CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.file_id) vs`,
        logUsage: `
            SELECT d.name AS database_name, d.recovery_model_desc, d.log_reuse_wait_desc,
                   CAST(MAX(CASE WHEN pc.counter_name = N'Log File(s) Size (KB)' THEN pc.cntr_value END) / 1024.0 AS decimal(18, 1)) AS log_size_mb,
                   CAST(MAX(CASE WHEN pc.counter_name = N'Log File(s) Used Size (KB)' THEN pc.cntr_value END) / 1024.0 AS decimal(18, 1)) AS log_used_mb,
                   MAX(CASE WHEN pc.counter_name = N'Percent Log Used' THEN pc.cntr_value END) AS log_used_pct
              FROM sys.databases d
              JOIN sys.dm_os_performance_counters pc
                ON pc.object_name LIKE N'%:Databases%'
               AND RTRIM(pc.instance_name) COLLATE DATABASE_DEFAULT = d.name COLLATE DATABASE_DEFAULT
               AND pc.counter_name IN (N'Log File(s) Size (KB)', N'Log File(s) Used Size (KB)', N'Percent Log Used')
             GROUP BY d.name, d.recovery_model_desc, d.log_reuse_wait_desc
             ORDER BY log_used_pct DESC`,
    },

    backups: {
        settings: `
            SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(512)) AS backup_path,
                   CAST(SERVERPROPERTY('EngineEdition') AS int) AS engine_edition,
                   CAST(SERVERPROPERTY('Edition') AS nvarchar(128)) AS edition`,
        backups: `
            SELECT d.name AS database_name, d.recovery_model_desc, d.state_desc,
                   b.last_full, b.last_diff, b.last_log,
                   DATEDIFF(HOUR, b.last_full, GETDATE()) AS hours_since_full,
                   DATEDIFF(MINUTE, b.last_log, GETDATE()) AS minutes_since_log,
                   CAST(lf.backup_size / 1048576.0 AS decimal(18, 1)) AS last_full_mb,
                   CAST(lf.compressed_backup_size / 1048576.0 AS decimal(18, 1)) AS last_full_compressed_mb
              FROM sys.databases d
             OUTER APPLY (SELECT MAX(CASE WHEN bs.type = 'D' THEN bs.backup_finish_date END) AS last_full,
                                 MAX(CASE WHEN bs.type = 'I' THEN bs.backup_finish_date END) AS last_diff,
                                 MAX(CASE WHEN bs.type = 'L' THEN bs.backup_finish_date END) AS last_log
                            FROM msdb.dbo.backupset bs
                           WHERE bs.database_name COLLATE DATABASE_DEFAULT = d.name COLLATE DATABASE_DEFAULT) b
             OUTER APPLY (SELECT TOP 1 bs.backup_size, bs.compressed_backup_size
                            FROM msdb.dbo.backupset bs
                           WHERE bs.database_name COLLATE DATABASE_DEFAULT = d.name COLLATE DATABASE_DEFAULT AND bs.type = 'D'
                           ORDER BY bs.backup_finish_date DESC) lf
             WHERE d.name <> N'tempdb'
             ORDER BY d.name`,
        recent: `
            SELECT TOP 25 bs.database_name,
                   CASE bs.type WHEN 'D' THEN 'Full' WHEN 'I' THEN 'Differential' WHEN 'L' THEN 'Log'
                        WHEN 'F' THEN 'File' ELSE bs.type END AS backup_type,
                   bs.backup_start_date, bs.backup_finish_date,
                   DATEDIFF(SECOND, bs.backup_start_date, bs.backup_finish_date) AS duration_sec,
                   CAST(bs.backup_size / 1048576.0 AS decimal(18, 1)) AS size_mb,
                   CAST(bs.compressed_backup_size / 1048576.0 AS decimal(18, 1)) AS compressed_mb,
                   bs.is_copy_only, bmf.physical_device_name
              FROM msdb.dbo.backupset bs
              LEFT JOIN msdb.dbo.backupmediafamily bmf
                     ON bmf.media_set_id = bs.media_set_id AND bmf.family_sequence_number = 1
             ORDER BY bs.backup_finish_date DESC`,
        services: `
            SELECT servicename, status_desc, startup_type_desc, last_startup_time, is_clustered
              FROM sys.dm_server_services`,
        jobs: `
            WITH last_run AS (
                SELECT jh.job_id, jh.run_status, jh.run_duration, jh.message,
                       DATEADD(SECOND, (jh.run_time / 10000) * 3600 + (jh.run_time / 100 % 100) * 60 + jh.run_time % 100,
                               CONVERT(datetime, CONVERT(char(8), jh.run_date), 112)) AS run_at,
                       ROW_NUMBER() OVER (PARTITION BY jh.job_id ORDER BY jh.instance_id DESC) AS rn
                  FROM msdb.dbo.sysjobhistory jh
                 WHERE jh.step_id = 0)
            SELECT j.name AS job_name, j.enabled, c.name AS category,
                   CASE lr.run_status WHEN 0 THEN 'Failed' WHEN 1 THEN 'Succeeded' WHEN 2 THEN 'Retry'
                        WHEN 3 THEN 'Canceled' WHEN 4 THEN 'In progress' END AS last_outcome,
                   lr.run_at AS last_run,
                   (lr.run_duration / 10000) * 3600 + (lr.run_duration / 100 % 100) * 60 + lr.run_duration % 100 AS last_duration_sec,
                   (SELECT COUNT(*) FROM msdb.dbo.sysjobhistory f
                     WHERE f.job_id = j.job_id AND f.step_id = 0 AND f.run_status = 0
                       AND f.run_date >= CONVERT(int, CONVERT(char(8), DATEADD(DAY, -1, GETDATE()), 112))) AS failures_24h,
                   LEFT(lr.message, 500) AS last_message
              FROM msdb.dbo.sysjobs j
              LEFT JOIN msdb.dbo.syscategories c ON c.category_id = j.category_id
              LEFT JOIN last_run lr ON lr.job_id = j.job_id AND lr.rn = 1
             ORDER BY CASE WHEN lr.run_status = 0 THEN 0 ELSE 1 END, j.name`,
    },

    security: {
        summary: `
            SELECT CAST(SERVERPROPERTY('IsIntegratedSecurityOnly') AS int) AS windows_auth_only,
                   (SELECT name FROM sys.server_principals WHERE sid = 0x01) AS sa_name,
                   (SELECT CAST(is_disabled AS int) FROM sys.server_principals WHERE sid = 0x01) AS sa_disabled,
                   (SELECT COUNT(*) FROM sys.server_role_members rm
                      JOIN sys.server_principals r ON r.principal_id = rm.role_principal_id
                     WHERE r.name = N'sysadmin') AS sysadmin_members,
                   (SELECT COUNT(*) FROM sys.server_principals
                     WHERE type IN ('S', 'U', 'G') AND name NOT LIKE N'##%') AS logins,
                   (SELECT COUNT(*) FROM sys.server_principals
                     WHERE type IN ('S', 'U', 'G') AND is_disabled = 1 AND name NOT LIKE N'##%') AS disabled_logins,
                   (SELECT COUNT(*) FROM sys.databases WHERE is_trustworthy_on = 1 AND name <> N'msdb') AS trustworthy_dbs,
                   (SELECT COUNT(*) FROM sys.databases WHERE is_encrypted = 1) AS encrypted_dbs`,
        sysadmins: `
            SELECT p.name, p.type_desc, CAST(p.is_disabled AS int) AS is_disabled, p.create_date, p.modify_date
              FROM sys.server_role_members rm
              JOIN sys.server_principals r ON r.principal_id = rm.role_principal_id
              JOIN sys.server_principals p ON p.principal_id = rm.member_principal_id
             WHERE r.name = N'sysadmin'
             ORDER BY p.name`,
        sqlLogins: `
            SELECT l.name, CAST(l.is_disabled AS int) AS is_disabled, CAST(l.is_policy_checked AS int) AS is_policy_checked,
                   CAST(l.is_expiration_checked AS int) AS is_expiration_checked, l.create_date, l.default_database_name,
                   CAST(LOGINPROPERTY(l.name, 'IsLocked') AS int) AS is_locked,
                   CAST(LOGINPROPERTY(l.name, 'IsExpired') AS int) AS is_expired,
                   CAST(LOGINPROPERTY(l.name, 'BadPasswordCount') AS int) AS bad_password_count,
                   CAST(LOGINPROPERTY(l.name, 'PasswordLastSetTime') AS datetime) AS password_last_set,
                   CASE WHEN PWDCOMPARE(N'', l.password_hash) = 1 THEN 1 ELSE 0 END AS blank_password,
                   CASE WHEN PWDCOMPARE(l.name, l.password_hash) = 1 THEN 1 ELSE 0 END AS password_is_login_name,
                   IS_SRVROLEMEMBER('sysadmin', l.name) AS is_sysadmin
              FROM sys.sql_logins l
             WHERE l.name NOT LIKE N'##%'
             ORDER BY l.name`,
        config: `
            SELECT name, CAST(value_in_use AS int) AS value_in_use, CAST(value AS int) AS configured_value
              FROM sys.configurations
             WHERE name IN (N'xp_cmdshell', N'clr enabled', N'clr strict security', N'Ole Automation Procedures',
                            N'remote admin connections', N'Ad Hoc Distributed Queries', N'cross db ownership chaining',
                            N'Database Mail XPs', N'scan for startup procs', N'contained database authentication',
                            N'remote access', N'default trace enabled')`,
        databases: `
            SELECT d.name AS database_name, SUSER_SNAME(d.owner_sid) AS owner,
                   CAST(d.is_trustworthy_on AS int) AS is_trustworthy_on, CAST(d.is_db_chaining_on AS int) AS is_db_chaining_on,
                   CAST(d.is_encrypted AS int) AS is_encrypted, d.containment_desc,
                   CASE ek.encryption_state WHEN 0 THEN 'No key' WHEN 1 THEN 'Unencrypted' WHEN 2 THEN 'Encrypting'
                        WHEN 3 THEN 'Encrypted' WHEN 4 THEN 'Key change' WHEN 5 THEN 'Decrypting'
                        WHEN 6 THEN 'Protection change' END AS tde_state
              FROM sys.databases d
              LEFT JOIN sys.dm_database_encryption_keys ek ON ek.database_id = d.database_id
             ORDER BY d.name`,
        failedLogins: `
            SET NOCOUNT ON;
            DECLARE @log TABLE (log_date datetime, process_info nvarchar(64), message nvarchar(max));
            INSERT INTO @log EXEC sys.xp_readerrorlog 0, 1, N'Login failed';
            SELECT TOP 50 log_date, message FROM @log ORDER BY log_date DESC;`,
        audits: `
            SELECT a.name, a.type_desc, CAST(a.is_state_enabled AS int) AS is_enabled, s.status_desc
              FROM sys.server_audits a
              LEFT JOIN sys.dm_server_audit_status s ON s.audit_id = a.audit_id`,
    },

    alwayson: {
        status: `
            SELECT CAST(SERVERPROPERTY('IsHadrEnabled') AS int) AS hadr_enabled,
                   (SELECT COUNT(*) FROM sys.availability_groups) AS ag_count,
                   (SELECT COUNT(*) FROM sys.database_mirroring WHERE mirroring_guid IS NOT NULL) AS mirrored_dbs`,
        groups: `
            SELECT ag.name AS ag_name, ags.primary_replica, ags.synchronization_health_desc,
                   ags.primary_recovery_health_desc, ag.automated_backup_preference_desc,
                   ag.failure_condition_level, ag.health_check_timeout
              FROM sys.availability_groups ag
              LEFT JOIN sys.dm_hadr_availability_group_states ags ON ags.group_id = ag.group_id`,
        replicas: `
            SELECT ag.name AS ag_name, ar.replica_server_name, ars.role_desc, ar.availability_mode_desc,
                   ar.failover_mode_desc, ars.connected_state_desc, ars.synchronization_health_desc,
                   ars.operational_state_desc, ar.secondary_role_allow_connections_desc
              FROM sys.availability_replicas ar
              JOIN sys.availability_groups ag ON ag.group_id = ar.group_id
              LEFT JOIN sys.dm_hadr_availability_replica_states ars ON ars.replica_id = ar.replica_id
             ORDER BY ag.name, CASE ars.role_desc WHEN N'PRIMARY' THEN 0 ELSE 1 END, ar.replica_server_name`,
        databases: `
            SELECT ag.name AS ag_name, ar.replica_server_name, DB_NAME(drs.database_id) AS database_name,
                   CAST(drs.is_local AS int) AS is_local, drs.synchronization_state_desc, drs.synchronization_health_desc,
                   CAST(drs.is_suspended AS int) AS is_suspended, drs.suspend_reason_desc,
                   drs.log_send_queue_size AS send_queue_kb, drs.log_send_rate AS send_rate_kbps,
                   drs.redo_queue_size AS redo_queue_kb, drs.redo_rate AS redo_rate_kbps,
                   drs.last_commit_time, drs.last_hardened_time,
                   CAST(drs.redo_queue_size * 1.0 / NULLIF(drs.redo_rate, 0) AS decimal(18, 1)) AS est_redo_sec
              FROM sys.dm_hadr_database_replica_states drs
              JOIN sys.availability_replicas ar ON ar.replica_id = drs.replica_id
              JOIN sys.availability_groups ag ON ag.group_id = drs.group_id
             ORDER BY ag.name, database_name, ar.replica_server_name`,
        mirroring: `
            SELECT DB_NAME(database_id) AS database_name, mirroring_role_desc, mirroring_state_desc,
                   mirroring_safety_level_desc, mirroring_partner_instance, mirroring_witness_state_desc
              FROM sys.database_mirroring
             WHERE mirroring_guid IS NOT NULL`,
    },
};
