// @ts-nocheck — new module 2026-10 (see docs/TS_MIGRATION.md)
/**
 * SQL Server monitoring views for the "SQL Server" UI section.
 *
 * Every query here is read-only and uses the DMVs/catalog views SQL Server
 * documents for monitoring (needs VIEW SERVER STATE, or sysadmin). Each panel
 * query runs independently: one failing (permissions, timeout) does not blank
 * the rest of the screen — its message is returned under `errors[panel]`.
 *
 * The generic MSSQLAdapter's getTableStats/getIndexStats/getPerformanceStats
 * are not used: they reference an undefined alias, misuse
 * sys.dm_db_page_info, and read the buffer cache hit ratio without its base
 * counter.
 */

// Waits that are idle/background noise, after the widely used Paul Randal list.
const BENIGN_WAITS = [
    'BROKER_EVENTHANDLER', 'BROKER_RECEIVE_WAITFOR', 'BROKER_TASK_STOP', 'BROKER_TO_FLUSH', 'BROKER_TRANSMITTER',
    'CHECKPOINT_QUEUE', 'CHKPT', 'CLR_AUTO_EVENT', 'CLR_MANUAL_EVENT', 'CLR_SEMAPHORE', 'DBMIRROR_DBM_EVENT',
    'DBMIRROR_EVENTS_QUEUE', 'DBMIRROR_WORKER_QUEUE', 'DBMIRRORING_CMD', 'DIRTY_PAGE_POLL', 'DISPATCHER_QUEUE_SEMAPHORE',
    'EXECSYNC', 'FSAGENT', 'FT_IFTS_SCHEDULER_IDLE_WAIT', 'FT_IFTSHC_MUTEX', 'KSOURCE_WAKEUP', 'LAZYWRITER_SLEEP',
    'LOGMGR_QUEUE', 'MEMORY_ALLOCATION_EXT', 'ONDEMAND_TASK_QUEUE', 'PARALLEL_REDO_DRAIN_WORKER',
    'PARALLEL_REDO_LOG_CACHE', 'PARALLEL_REDO_TRAN_LIST', 'PARALLEL_REDO_WORKER_SYNC', 'PARALLEL_REDO_WORKER_WAIT_WORK',
    'PREEMPTIVE_OS_FLUSHFILEBUFFERS', 'PREEMPTIVE_XE_GETTARGETSTATE', 'PVS_PREALLOCATE', 'PWAIT_ALL_COMPONENTS_INITIALIZED',
    'PWAIT_DIRECTLOGCONSUMER_GETNEXT', 'PWAIT_EXTENSIBILITY_CLEANUP_TASK', 'QDS_PERSIST_TASK_MAIN_LOOP_SLEEP',
    'QDS_ASYNC_QUEUE', 'QDS_CLEANUP_STALE_QUERIES_TASK_MAIN_LOOP_SLEEP', 'QDS_SHUTDOWN_QUEUE', 'REDO_THREAD_PENDING_WORK',
    'REQUEST_FOR_DEADLOCK_SEARCH', 'RESOURCE_QUEUE', 'SERVER_IDLE_CHECK', 'SNI_HTTP_ACCEPT', 'SOS_WORK_DISPATCHER',
    'SP_SERVER_DIAGNOSTICS_SLEEP', 'SQLTRACE_BUFFER_FLUSH', 'SQLTRACE_INCREMENTAL_FLUSH_SLEEP',
    'SQLTRACE_WAIT_ENTRIES', 'VDI_CLIENT_OTHER', 'WAIT_FOR_RESULTS', 'WAITFOR', 'WAITFOR_TASKSHUTDOWN',
    'WAIT_XTP_RECOVERY', 'WAIT_XTP_HOST_WAIT', 'WAIT_XTP_OFFLINE_CKPT_NEW_LOG', 'WAIT_XTP_CKPT_CLOSE',
    'XE_DISPATCHER_JOIN', 'XE_DISPATCHER_WAIT', 'XE_TIMER_EVENT',
];

const STATEMENT_TEXT = (alias, req) => `SUBSTRING(${alias}.text, (${req}.statement_start_offset / 2) + 1,
    ((CASE ${req}.statement_end_offset WHEN -1 THEN DATALENGTH(${alias}.text)
      ELSE ${req}.statement_end_offset END - ${req}.statement_start_offset) / 2) + 1)`;

const QUERIES = {
    overview: {
        server: `
            SELECT CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(128)) AS product_version,
                   CAST(SERVERPROPERTY('ProductLevel')   AS nvarchar(128)) AS product_level,
                   CAST(SERVERPROPERTY('Edition')        AS nvarchar(128)) AS edition,
                   @@SERVERNAME AS server_name,
                   DB_NAME() AS current_database,
                   i.sqlserver_start_time AS start_time,
                   DATEDIFF(SECOND, i.sqlserver_start_time, SYSDATETIME()) AS uptime_seconds,
                   i.cpu_count,
                   i.physical_memory_kb,
                   i.committed_kb,
                   i.committed_target_kb,
                   (SELECT COUNT(*) FROM sys.dm_exec_sessions WHERE is_user_process = 1) AS user_sessions,
                   (SELECT COUNT(*) FROM sys.dm_exec_requests r
                      JOIN sys.dm_exec_sessions s ON s.session_id = r.session_id
                     WHERE s.is_user_process = 1 AND r.session_id <> @@SPID) AS active_requests,
                   (SELECT COUNT(*) FROM sys.dm_exec_requests WHERE blocking_session_id <> 0) AS blocked_requests
              FROM sys.dm_os_sys_info i`,
        counters: `
            SELECT RTRIM(counter_name) AS counter_name, cntr_value
              FROM sys.dm_os_performance_counters
             WHERE (object_name LIKE '%Buffer Manager%'
                    AND counter_name IN ('Buffer cache hit ratio', 'Buffer cache hit ratio base', 'Page life expectancy'))
                OR (object_name LIKE '%SQL Statistics%' AND counter_name IN ('Batch Requests/sec', 'SQL Compilations/sec'))
                OR (object_name LIKE '%Memory Manager%'
                    AND counter_name IN ('Memory Grants Pending', 'Total Server Memory (KB)', 'Target Server Memory (KB)'))`,
        cpu: `
            SELECT TOP 1
                   x.record.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]', 'int') AS sql_cpu_pct,
                   x.record.value('(./Record/SchedulerMonitorEvent/SystemHealth/SystemIdle)[1]', 'int') AS system_idle_pct
              FROM (SELECT CONVERT(xml, record) AS record, [timestamp]
                      FROM sys.dm_os_ring_buffers
                     WHERE ring_buffer_type = N'RING_BUFFER_SCHEDULER_MONITOR'
                       AND record LIKE N'%<SystemHealth>%') AS x
             ORDER BY x.[timestamp] DESC`,
        databases: `
            SELECT d.name, d.state_desc, d.recovery_model_desc, d.compatibility_level, d.create_date,
                   CAST(SUM(CASE WHEN mf.type = 0 THEN mf.size ELSE 0 END) * 8.0 / 1024 AS decimal(18, 2)) AS data_mb,
                   CAST(SUM(CASE WHEN mf.type = 1 THEN mf.size ELSE 0 END) * 8.0 / 1024 AS decimal(18, 2)) AS log_mb
              FROM sys.databases d
              LEFT JOIN sys.master_files mf ON mf.database_id = d.database_id
             GROUP BY d.name, d.state_desc, d.recovery_model_desc, d.compatibility_level, d.create_date
             ORDER BY d.name`,
    },
    performance: {
        topQueries: `
            SELECT TOP 25
                   qs.execution_count,
                   qs.total_worker_time / 1000 AS total_cpu_ms,
                   qs.total_elapsed_time / 1000 AS total_elapsed_ms,
                   CAST(qs.total_worker_time / 1000.0 / NULLIF(qs.execution_count, 0) AS decimal(18, 2)) AS avg_cpu_ms,
                   CAST(qs.total_elapsed_time / 1000.0 / NULLIF(qs.execution_count, 0) AS decimal(18, 2)) AS avg_elapsed_ms,
                   qs.total_logical_reads,
                   qs.last_execution_time,
                   DB_NAME(st.dbid) AS database_name,
                   LEFT(${STATEMENT_TEXT('st', 'qs')}, 2000) AS query_text
              FROM sys.dm_exec_query_stats qs
             CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
             ORDER BY qs.total_worker_time DESC`,
        waits: `
            SELECT TOP 15 wait_type, waiting_tasks_count, wait_time_ms, signal_wait_time_ms,
                   CAST(100.0 * wait_time_ms / NULLIF(SUM(wait_time_ms) OVER (), 0) AS decimal(5, 2)) AS pct
              FROM sys.dm_os_wait_stats
             WHERE waiting_tasks_count > 0
               AND wait_type NOT LIKE 'SLEEP%'
               AND wait_type NOT IN (${BENIGN_WAITS.map((w) => `N'${w}'`).join(', ')})
             ORDER BY wait_time_ms DESC`,
    },
    sessions: {
        sessions: `
            SELECT s.session_id, s.login_name, s.host_name, s.program_name,
                   DB_NAME(s.database_id) AS database_name,
                   s.status AS session_status, r.status AS request_status, r.command,
                   r.wait_type, r.wait_time AS wait_ms, r.blocking_session_id,
                   r.cpu_time AS cpu_ms, r.total_elapsed_time AS elapsed_ms,
                   s.login_time, s.last_request_end_time,
                   LEFT(${STATEMENT_TEXT('t', 'r')}, 2000) AS current_statement
              FROM sys.dm_exec_sessions s
              LEFT JOIN sys.dm_exec_requests r ON r.session_id = s.session_id
             OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t
             WHERE s.is_user_process = 1 AND s.session_id <> @@SPID
             ORDER BY CASE WHEN r.session_id IS NULL THEN 1 ELSE 0 END, r.total_elapsed_time DESC, s.session_id`,
        blocking: `
            SELECT r.session_id AS blocked_session, r.blocking_session_id AS blocking_session,
                   r.wait_type, r.wait_time AS wait_ms, r.wait_resource, DB_NAME(r.database_id) AS database_name,
                   LEFT(t.text, 2000) AS blocked_statement,
                   (SELECT TOP 1 LEFT(bt.text, 2000)
                      FROM sys.dm_exec_connections bc
                     CROSS APPLY sys.dm_exec_sql_text(bc.most_recent_sql_handle) bt
                     WHERE bc.session_id = r.blocking_session_id) AS blocking_statement
              FROM sys.dm_exec_requests r
             OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t
             WHERE r.blocking_session_id <> 0
             ORDER BY r.wait_time DESC`,
    },
    storage: {
        tables: `
            SELECT TOP 100 s.name AS schema_name, t.name AS table_name,
                   SUM(CASE WHEN p.index_id < 2 THEN p.row_count ELSE 0 END) AS row_count,
                   SUM(p.reserved_page_count) * 8 AS reserved_kb,
                   SUM(CASE WHEN p.index_id < 2
                            THEN p.in_row_data_page_count + p.lob_used_page_count + p.row_overflow_used_page_count
                            ELSE 0 END) * 8 AS data_kb,
                   SUM(CASE WHEN p.index_id >= 2 THEN p.used_page_count ELSE 0 END) * 8 AS index_kb
              FROM sys.dm_db_partition_stats p
              JOIN sys.tables t  ON t.object_id = p.object_id
              JOIN sys.schemas s ON s.schema_id = t.schema_id
             WHERE t.is_ms_shipped = 0
             GROUP BY s.name, t.name
             ORDER BY reserved_kb DESC`,
        indexUsage: `
            SELECT TOP 100 OBJECT_SCHEMA_NAME(i.object_id) AS schema_name, OBJECT_NAME(i.object_id) AS table_name,
                   i.name AS index_name, i.type_desc,
                   ISNULL(us.user_seeks, 0) AS seeks, ISNULL(us.user_scans, 0) AS scans,
                   ISNULL(us.user_lookups, 0) AS lookups, ISNULL(us.user_updates, 0) AS updates,
                   (SELECT SUM(ps.used_page_count) * 8 FROM sys.dm_db_partition_stats ps
                     WHERE ps.object_id = i.object_id AND ps.index_id = i.index_id) AS size_kb
              FROM sys.indexes i
              JOIN sys.objects o ON o.object_id = i.object_id
              LEFT JOIN sys.dm_db_index_usage_stats us
                     ON us.object_id = i.object_id AND us.index_id = i.index_id AND us.database_id = DB_ID()
             WHERE o.is_ms_shipped = 0 AND o.type = 'U' AND i.index_id > 0
             ORDER BY size_kb DESC`,
        missingIndexes: `
            SELECT TOP 20 mid.statement AS table_name, mid.equality_columns, mid.inequality_columns, mid.included_columns,
                   migs.user_seeks, migs.avg_user_impact,
                   CAST(migs.user_seeks * migs.avg_total_user_cost * (migs.avg_user_impact / 100.0) AS decimal(18, 2)) AS improvement_score
              FROM sys.dm_db_missing_index_groups mig
              JOIN sys.dm_db_missing_index_group_stats migs ON migs.group_handle = mig.index_group_handle
              JOIN sys.dm_db_missing_index_details mid ON mid.index_handle = mig.index_handle
             WHERE mid.database_id = DB_ID()
             ORDER BY improvement_score DESC`,
        fragmentation: `
            SELECT TOP 50 OBJECT_SCHEMA_NAME(ips.object_id) AS schema_name, OBJECT_NAME(ips.object_id) AS table_name,
                   i.name AS index_name, ips.index_type_desc,
                   CAST(ips.avg_fragmentation_in_percent AS decimal(5, 2)) AS fragmentation_pct, ips.page_count
              FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
              JOIN sys.indexes i ON i.object_id = ips.object_id AND i.index_id = ips.index_id
             WHERE ips.index_id > 0 AND ips.page_count >= 100
             ORDER BY ips.avg_fragmentation_in_percent DESC`,
    },
};

export const SQL_SERVER_VIEWS = Object.keys(QUERIES);

// Cumulative "/sec" counters need two samples; keep the previous one per connection.
const lastCounterSample = new Map(); // connectionId -> { at, batch, compilations }

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

function shapeOverview(r, connectionId) {
    const counters = Object.fromEntries((r.counters || []).map((c) => [c.counter_name, num(c.cntr_value)]));
    const hit = counters['Buffer cache hit ratio'];
    const base = counters['Buffer cache hit ratio base'];
    const now = Date.now();
    const batch = counters['Batch Requests/sec'];
    const comp = counters['SQL Compilations/sec'];
    const prev = lastCounterSample.get(connectionId);
    let batchPerSec = null;
    let compilationsPerSec = null;
    if (prev && batch !== null && now > prev.at) {
        const secs = (now - prev.at) / 1000;
        batchPerSec = Math.max(0, (batch - prev.batch) / secs);
        compilationsPerSec = Math.max(0, (comp - prev.compilations) / secs);
    }
    if (batch !== null) lastCounterSample.set(connectionId, { at: now, batch, compilations: comp });

    return {
        server: r.server?.[0] || null,
        cpu: r.cpu?.[0] || null,
        metrics: {
            bufferCacheHitPct: hit !== null && base ? Math.min(100, (100 * hit) / base) : null,
            pageLifeExpectancySec: counters['Page life expectancy'] ?? null,
            memoryGrantsPending: counters['Memory Grants Pending'] ?? null,
            totalServerMemoryKb: counters['Total Server Memory (KB)'] ?? null,
            targetServerMemoryKb: counters['Target Server Memory (KB)'] ?? null,
            batchRequestsPerSec: batchPerSec,
            compilationsPerSec,
        },
        databases: r.databases || [],
    };
}

/**
 * Run one view's queries through a connected engine adapter.
 * @returns {Promise<{ view: string, data: object, errors: object, collectedAt: string }>}
 */
export async function collectSqlServerView(adapter, view, connectionId) {
    const queries = QUERIES[view];
    if (!queries) throw Object.assign(new Error(`Unknown SQL Server view "${view}"`), { status: 404 });
    const raw = {};
    const errors = {};
    await Promise.all(
        Object.entries(queries).map(async ([panel, sql]) => {
            try {
                raw[panel] = (await adapter.query(sql)).rows || [];
            } catch (e) {
                errors[panel] = e.message;
                raw[panel] = null;
            }
        }),
    );
    const data = view === 'overview' ? shapeOverview(raw, connectionId) : raw;
    return { view, data, errors, collectedAt: new Date().toISOString() };
}
