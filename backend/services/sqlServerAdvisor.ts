// @ts-nocheck — new module 2026-10 (see docs/TS_MIGRATION.md)
/**
 * SQL Server advisor: turns what a monitoring screen collected into concrete,
 * prioritised recommendations, each with a T-SQL script where one applies.
 *
 * Deterministic rules (no AI needed). Scripts are suggestions for a DBA to
 * review and run — PulseDB never runs them, and the PulseDB Agent is
 * read-only. The AI review (sqlServerAiAdvisor.ts) builds on these.
 *
 * @returns {{ id, severity: 'high'|'medium'|'low', category, title, detail, sql?, caution? }[]}
 */

const q = (name) => `[${String(name ?? '').replace(/]/g, ']]')}]`;
const s = (text) => `N'${String(text ?? '').replace(/'/g, "''")}'`;
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const mb = (v) => `${Math.round(Number(v)).toLocaleString('en-US')} MB`;
const SYSTEM_DBS = new Set(['master', 'model', 'msdb', 'tempdb']);
const EXPRESS = 4; // SERVERPROPERTY('EngineEdition')

function rec(list, r) {
    list.push(r);
}

/* ── Tables & Indexes ─────────────────────────────────────────────────── */
function storage(d, out) {
    // Scripts for the selected database's indexes run in that database.
    const current = d.databaseList?.find((x) => num(x.is_current))?.database_name || d.indexSummary?.[0]?.database_name;
    const use = current ? `USE ${q(current)};\n` : '';

    // Missing indexes the optimizer asked for, across every database (the
    // table name is [database].[schema].[table], so the script runs anywhere).
    // The optimizer often suggests the same keys several times with different
    // INCLUDE columns; keep the best-scoring one (rows come best first) — two
    // would also get the same index name.
    const seen = new Set();
    for (const m of (d.missingIndexes || []).filter((x) => num(x.avg_user_impact) >= 25)) {
        if (seen.size >= 15) break;
        const parts = String(m.table_name || '').split('.').map((p) => p.replace(/^\[|\]$/g, ''));
        const table = parts[parts.length - 1] || 'table';
        const db = m.database_name || (parts.length === 3 ? parts[0] : '');
        const keyCols = [m.equality_columns, m.inequality_columns].filter(Boolean).join(', ');
        if (!keyCols || seen.has(`${m.table_name}:${keyCols}`)) continue;
        seen.add(`${m.table_name}:${keyCols}`);
        const colNames = keyCols.replace(/[[\]\s]/g, '').split(',').slice(0, 3).join('_');
        const name = `IX_${table}_${colNames}`.slice(0, 120);
        const include = m.included_columns ? `\n    INCLUDE (${m.included_columns})` : '';
        const high = num(m.avg_user_impact) >= 80 && num(m.user_seeks) >= 1000;
        rec(out, {
            id: `missing-index:${m.table_name}:${keyCols}`,
            severity: high ? 'high' : 'medium',
            category: 'Indexes',
            title: `Create an index on ${table} (${keyCols.replace(/[[\]]/g, '')})${db ? ` in ${db}` : ''}`,
            detail: `The optimizer estimates queries would be ${Math.round(num(m.avg_user_impact))}% cheaper; they wanted it ${num(m.user_seeks).toLocaleString('en-US')} times since the last restart.`,
            sql: `CREATE NONCLUSTERED INDEX ${q(name)}\n    ON ${m.table_name} (${keyCols})${include};`,
            caution: 'Check it does not duplicate an existing index, and create it outside busy hours on large tables.',
        });
    }

    // Fragmentation
    const frag = (d.fragmentation || []).filter((f) => f.action);
    if (frag.length) {
        const rebuild = frag.filter((f) => f.action === 'REBUILD');
        rec(out, {
            id: 'fragmentation',
            severity: rebuild.length ? 'medium' : 'low',
            category: 'Indexes',
            title: `${frag.length} fragmented index${frag.length > 1 ? 'es' : ''} (${rebuild.length} need a rebuild)`,
            detail: 'Rebuild indexes above 30% fragmentation and reorganize those between 10% and 30%. Fragmentation mostly matters for large range scans.',
            sql:
                use +
                frag
                .slice(0, 25)
                .map(
                    (f) =>
                        `ALTER INDEX ${q(f.index_name)} ON ${q(f.schema_name)}.${q(f.table_name)} ${f.action};  -- ${Number(f.fragmentation_pct).toFixed(0)}%, ${num(f.page_count).toLocaleString('en-US')} pages`,
                )
                .join('\n'),
            caution: 'REBUILD locks the table on Standard/Express edition; schedule it in a maintenance window.',
        });
    }

    // Indexes written to but never read
    const unused = (d.indexUsage || []).filter(
        (i) =>
            i.type_desc === 'NONCLUSTERED' &&
            !i.is_primary_key &&
            !i.is_unique &&
            !num(i.seeks) &&
            !num(i.scans) &&
            !num(i.lookups) &&
            num(i.updates) > 0,
    );
    if (unused.length) {
        rec(out, {
            id: 'unused-indexes',
            severity: 'low',
            category: 'Indexes',
            title: `${unused.length} index${unused.length > 1 ? 'es are' : ' is'} maintained but never read`,
            detail: 'Every insert and update pays for these indexes, but no query has used them since SQL Server last started.',
            sql:
                use +
                unused
                .slice(0, 20)
                .map(
                    (i) =>
                        `DROP INDEX ${q(i.index_name)} ON ${q(i.schema_name)}.${q(i.table_name)};  -- ${num(i.updates).toLocaleString('en-US')} writes, 0 reads`,
                )
                .join('\n'),
            caution: 'Usage counters reset at every restart. Only drop after the server has run through a full business cycle (month-end, reports).',
        });
    }

    // Duplicate indexes
    const dups = d.duplicates || [];
    if (dups.length) {
        rec(out, {
            id: 'duplicate-indexes',
            severity: 'medium',
            category: 'Indexes',
            title: `${dups.length} duplicate index${dups.length > 1 ? 'es' : ''}`,
            detail: 'These have exactly the same key columns as another index on the same table, so they cost writes and space for no benefit.',
            sql:
                use +
                dups
                .slice(0, 20)
                .map((x) => `DROP INDEX ${q(x.index_name)} ON ${q(x.schema_name)}.${q(x.table_name)};  -- same keys as ${x.duplicate_of}`)
                .join('\n'),
            caution: 'Keep the one that is a primary key, unique, or has the INCLUDE columns your queries need.',
        });
    }

    // Large heaps
    const heaps = (d.tables || []).filter((t) => t.is_heap && num(t.row_count) >= 100000);
    if (heaps.length) {
        rec(out, {
            id: 'heaps',
            severity: 'low',
            category: 'Indexes',
            title: `${heaps.length} large table${heaps.length > 1 ? 's have' : ' has'} no clustered index`,
            detail: `${heaps
                .slice(0, 5)
                .map((t) => `${t.schema_name}.${t.table_name} (${num(t.row_count).toLocaleString('en-US')} rows)`)
                .join(', ')}. Heaps suffer forwarded records and slow scans; most tables benefit from a clustered index on a narrow, ever-increasing key.`,
        });
    }
}

/* ── Performance & Waits ──────────────────────────────────────────────── */
function performance(d, live, out) {
    const cfg = d.serverConfig?.[0] || {};
    const cats = Object.fromEntries((d.waitCategories || []).map((c) => [c.category, num(c.wait_ms)]));
    const total = Object.values(cats).reduce((a, b) => a + (b || 0), 0) || 1;
    const share = (cat) => (100 * (cats[cat] || 0)) / total;
    const cpus = num(cfg.cpu_count) || 1;
    const perNode = Math.max(1, Math.round(cpus / Math.max(1, num(cfg.numa_nodes) || 1)));
    const suggestedMaxdop = Math.min(8, perNode);

    if (num(cfg.maxdop) === 0 && cpus > 8) {
        rec(out, {
            id: 'maxdop',
            severity: share('Parallelism') > 25 ? 'high' : 'medium',
            category: 'Configuration',
            title: `Set max degree of parallelism to ${suggestedMaxdop}`,
            detail: `MAXDOP is 0 (unlimited) on ${cpus} CPUs${share('Parallelism') ? `; parallelism is ${share('Parallelism').toFixed(0)}% of wait time` : ''}. Microsoft recommends at most 8, and no more than the cores per NUMA node.`,
            sql: `EXEC sp_configure 'show advanced options', 1; RECONFIGURE;\nEXEC sp_configure 'max degree of parallelism', ${suggestedMaxdop}; RECONFIGURE;`,
        });
    }
    if (num(cfg.cost_threshold) === 5) {
        rec(out, {
            id: 'cost-threshold',
            severity: 'medium',
            category: 'Configuration',
            title: 'Raise cost threshold for parallelism from 5 to 50',
            detail: 'The default of 5 makes even small queries go parallel, which wastes CPU and shows up as CX* waits.',
            sql: `EXEC sp_configure 'show advanced options', 1; RECONFIGURE;\nEXEC sp_configure 'cost threshold for parallelism', 50; RECONFIGURE;`,
        });
    }
    const batch = num(live?.batchPerSec);
    const comp = num(live?.compilationsPerSec);
    if (batch > 10 && comp / batch > 0.3 && num(cfg.optimize_adhoc) === 0) {
        rec(out, {
            id: 'adhoc',
            severity: 'medium',
            category: 'Configuration',
            title: 'Enable "optimize for ad hoc workloads"',
            detail: `${Math.round((100 * comp) / batch)}% of batches are compiled: queries are not being reused. This setting stores a small stub until a plan is used twice, saving plan-cache memory.`,
            sql: `EXEC sp_configure 'show advanced options', 1; RECONFIGURE;\nEXEC sp_configure 'optimize for ad hoc workloads', 1; RECONFIGURE;`,
            caution: 'Also parameterize the application queries; this setting only limits the damage.',
        });
    }
    const signal = num(live?.signalWaitPct);
    if (signal > 25) {
        rec(out, {
            id: 'cpu-pressure',
            severity: 'high',
            category: 'Performance',
            title: `CPU pressure: ${signal.toFixed(0)}% of waiting is queueing for CPU`,
            detail: 'Tasks are ready to run but waiting for a scheduler. Tune the top CPU queries (see the table below) before adding cores.',
        });
    }
    if (share('Disk I/O') > 30) {
        rec(out, {
            id: 'io-waits',
            severity: 'medium',
            category: 'Performance',
            title: `Reading from disk is ${share('Disk I/O').toFixed(0)}% of wait time`,
            detail: 'Data is not staying in memory. Look for scans in the top queries by reads, missing indexes, and check Memory & TempDB for memory pressure.',
        });
    }
    if (share('Lock') > 20) {
        rec(out, {
            id: 'lock-waits',
            severity: 'medium',
            category: 'Performance',
            title: `Blocking is ${share('Lock').toFixed(0)}% of wait time`,
            detail: 'Sessions wait on each other’s locks. Keep transactions short, index the columns used to find rows to update, and consider READ_COMMITTED_SNAPSHOT for read-heavy databases.',
            sql: cfg.current_database
                ? `-- Readers stop blocking writers (test first; uses tempdb version store):\nALTER DATABASE ${q(cfg.current_database)} SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;`
                : undefined,
            caution: 'READ_COMMITTED_SNAPSHOT changes read behaviour; test the application first.',
        });
    }
    if (share('Log write') > 20) {
        rec(out, {
            id: 'log-writes',
            severity: 'medium',
            category: 'Performance',
            title: `Writing the transaction log is ${share('Log write').toFixed(0)}% of wait time`,
            detail: 'Commits wait for the log disk. Put the log on fast storage and batch many small commits into fewer transactions.',
        });
    }
    const heavy = (d.topQueries || []).filter((x) => num(x.avg_logical_reads) >= 100000).sort((a, b) => num(b.total_logical_reads) - num(a.total_logical_reads));
    if (heavy.length) {
        rec(out, {
            id: 'heavy-queries',
            severity: 'medium',
            category: 'Queries',
            title: `${heavy.length} quer${heavy.length > 1 ? 'ies read' : 'y reads'} over 100,000 pages per run`,
            detail: 'Usually a scan where an index seek was expected. Use “Tune with AI” on these rows, or compare with the missing-index suggestions on Tables & Indexes.',
        });
    }
}

/* ── Query Store ──────────────────────────────────────────────────────── */
function querystore(d, out) {
    const o = d.options?.[0];
    if (o && o.actual_state_desc === 'OFF') {
        rec(out, {
            id: 'qs-off',
            severity: 'medium',
            category: 'Query Store',
            title: `Turn on Query Store for ${o.database_name}`,
            detail: 'Query Store keeps query history and plans, so regressions can be found and fixed by forcing the last good plan.',
            sql: `ALTER DATABASE ${q(o.database_name)} SET QUERY_STORE = ON\n    (OPERATION_MODE = READ_WRITE, QUERY_CAPTURE_MODE = AUTO, MAX_STORAGE_SIZE_MB = 1024);`,
        });
    } else if (o && o.actual_state_desc === 'READ_ONLY') {
        rec(out, {
            id: 'qs-readonly',
            severity: 'medium',
            category: 'Query Store',
            title: 'Query Store stopped collecting (read-only)',
            detail: `It is using ${num(o.current_storage_size_mb)} of ${num(o.max_storage_size_mb)} MB. Give it more room so it records again.`,
            sql: `ALTER DATABASE ${q(o.database_name)} SET QUERY_STORE (MAX_STORAGE_SIZE_MB = ${Math.max(1024, num(o.max_storage_size_mb) * 2)}, OPERATION_MODE = READ_WRITE);`,
        });
    }
    for (const r of (d.regressed || []).slice(0, 10)) {
        rec(out, {
            id: `regressed:${r.query_id}`,
            severity: num(r.regression_pct) > 200 ? 'high' : 'medium',
            category: 'Query Store',
            title: `Query ${r.query_id} got ${Math.round(num(r.regression_pct))}% slower after a plan change`,
            detail: `Current plan ${r.current_plan_id} averages ${num(r.current_avg_ms)} ms; plan ${r.best_plan_id} averaged ${num(r.best_avg_ms)} ms. Forcing the faster plan restores it.`,
            sql: `EXEC sp_query_store_force_plan @query_id = ${num(r.query_id)}, @plan_id = ${num(r.best_plan_id)};\n-- Undo later with: EXEC sp_query_store_unforce_plan @query_id = ${num(r.query_id)}, @plan_id = ${num(r.best_plan_id)};`,
            caution: 'A forced plan is a fix for now; also update statistics and check why the plan changed.',
        });
    }
}

/* ── Sessions & Locks ─────────────────────────────────────────────────── */
function sessions(d, out) {
    const blocking = d.blocking || [];
    const blocked = new Set(blocking.map((b) => String(b.blocked_session)));
    const heads = [...new Set(blocking.map((b) => String(b.blocking_session)))].filter((s) => !blocked.has(s));
    const longest = Math.max(0, ...blocking.map((b) => num(b.wait_ms) || 0));
    if (heads.length && longest > 30000) {
        rec(out, {
            id: 'blocking',
            severity: longest > 300000 ? 'high' : 'medium',
            category: 'Sessions',
            title: `Session ${heads.join(', ')} is blocking ${blocking.length} other${blocking.length > 1 ? 's' : ''} (longest ${Math.round(longest / 1000)} s)`,
            detail: 'Find what the head blocker is doing (see Blocking chains). If it is an abandoned transaction, ending the session rolls its work back.',
            sql: heads.map((h) => `-- KILL ${h};  -- rolls back that session's open transaction`).join('\n'),
            caution: 'KILL rolls back the session’s work and can take as long as the work itself. Confirm with the owner first.',
        });
    }
    const longTx = (d.transactions || []).filter((t) => num(t.duration_sec) > 600);
    if (longTx.length) {
        rec(out, {
            id: 'long-transactions',
            severity: 'medium',
            category: 'Sessions',
            title: `${longTx.length} transaction${longTx.length > 1 ? 's have' : ' has'} been open over 10 minutes`,
            detail: `Sessions ${longTx.map((t) => t.session_id).join(', ')}. Open transactions hold locks and stop the log from being reused.`,
        });
    }
    const dl = (d.deadlocks || []).length;
    if (dl) {
        rec(out, {
            id: 'deadlocks',
            severity: dl >= 5 ? 'high' : 'medium',
            category: 'Sessions',
            title: `${dl} recent deadlock${dl > 1 ? 's' : ''}`,
            detail: 'Make transactions touch tables in the same order, keep them short, and index the lookup columns used by the UPDATE/DELETE statements in the deadlock graph.',
        });
    }
}

/* ── Memory & TempDB ──────────────────────────────────────────────────── */
function memory(d, live, out) {
    const cfg = d.serverConfig?.[0] || {};
    const m = d.memory?.[0] || {};
    const totalMb = num(m.total_physical_memory_kb) / 1024 || num(cfg.physical_memory_kb) / 1024;
    if (num(cfg.max_server_memory_mb) >= 2147483647 && totalMb) {
        const reserve = Math.max(2048, Math.round(totalMb * 0.1));
        const target = Math.max(1024, Math.round((totalMb - reserve) / 512) * 512);
        rec(out, {
            id: 'max-memory',
            severity: 'medium',
            category: 'Configuration',
            title: `Set max server memory to ${mb(target)}`,
            detail: `It is unlimited, so SQL Server can take memory Windows and other programs need. ${mb(totalMb)} installed; leave about ${mb(reserve)} for the OS.`,
            sql: `EXEC sp_configure 'show advanced options', 1; RECONFIGURE;\nEXEC sp_configure 'max server memory (MB)', ${target}; RECONFIGURE;`,
            caution: 'Leave more for the OS if other services (SSRS, SSIS, applications) run on this machine.',
        });
    }
    const plans = d.planCache || [];
    const planMb = plans.reduce((a, p) => a + (num(p.size_mb) || 0), 0);
    const singleMb = plans.reduce((a, p) => a + (num(p.single_use_mb) || 0), 0);
    if (planMb > 200 && singleMb / planMb > 0.3 && num(cfg.optimize_adhoc) === 0) {
        rec(out, {
            id: 'adhoc-plans',
            severity: 'medium',
            category: 'Configuration',
            title: `${Math.round(singleMb)} MB of the plan cache is single-use plans`,
            detail: '"Optimize for ad hoc workloads" stores a small stub the first time a query runs, so one-off queries stop filling memory.',
            sql: `EXEC sp_configure 'show advanced options', 1; RECONFIGURE;\nEXEC sp_configure 'optimize for ad hoc workloads', 1; RECONFIGURE;`,
        });
    }
    const dataFiles = (d.tempdbFiles || []).filter((f) => f.type_desc === 'ROWS');
    const cpus = num(cfg.cpu_count) || 1;
    const want = Math.min(8, cpus);
    if (dataFiles.length && dataFiles.length < want && dataFiles.length < 4) {
        const first = dataFiles[0];
        const dir = String(first.physical_name || '').replace(/[^\\/]+$/, '');
        const size = Math.max(64, Math.round(num(first.size_mb) || 64));
        const adds = [];
        for (let i = dataFiles.length + 1; i <= want; i++) {
            adds.push(
                `ALTER DATABASE tempdb ADD FILE (NAME = N'tempdev${i}', FILENAME = ${s(`${dir}tempdb_mssql_${i}.ndf`)}, SIZE = ${size}MB, FILEGROWTH = 64MB);`,
            );
        }
        rec(out, {
            id: 'tempdb-files',
            severity: 'low',
            category: 'TempDB',
            title: `Add TempDB data files (${dataFiles.length} → ${want})`,
            detail: 'Several equally sized TempDB data files (up to 8, one per CPU) reduce allocation contention on busy servers.',
            sql: adds.join('\n'),
            caution: 'Keep all TempDB data files the same size and growth.',
        });
    }
    if (num(live?.pageLifeExpectancy) !== null && num(live.pageLifeExpectancy) < 300) {
        rec(out, {
            id: 'ple',
            severity: 'medium',
            category: 'Memory',
            title: `Pages stay in memory only ${num(live.pageLifeExpectancy)} s`,
            detail: 'The buffer pool is under pressure. Reduce large scans (missing indexes, top queries by reads) or give SQL Server more memory.',
        });
    }
    if (num(live?.memoryGrantsPending) > 0) {
        rec(out, {
            id: 'grants-pending',
            severity: 'high',
            category: 'Memory',
            title: `${num(live.memoryGrantsPending)} queries are waiting for memory to start`,
            detail: 'Large sorts and hashes are queueing for workspace memory. Look at the Memory grants table for the queries asking for the most.',
        });
    }
}

/* ── Storage & I/O ────────────────────────────────────────────────────── */
function io(d, out) {
    const pct = (d.files || []).filter((f) => String(f.growth).endsWith('%'));
    if (pct.length) {
        rec(out, {
            id: 'percent-growth',
            severity: 'low',
            category: 'Storage',
            title: `${pct.length} file${pct.length > 1 ? 's grow' : ' grows'} by a percentage`,
            detail: 'Percentage growth makes each growth bigger and slower as the file grows, and log files grown this way get many small virtual log files.',
            sql: pct
                .slice(0, 25)
                .map(
                    (f) =>
                        `ALTER DATABASE ${q(f.database_name)} MODIFY FILE (NAME = ${s(f.file_name)}, FILEGROWTH = ${f.type_desc === 'LOG' ? 128 : 256}MB);`,
                )
                .join('\n'),
        });
    }
    for (const l of (d.logUsage || []).filter((x) => x.log_reuse_wait_desc === 'LOG_BACKUP' && !SYSTEM_DBS.has(x.database_name))) {
        rec(out, {
            id: `log-backup:${l.database_name}`,
            severity: num(l.log_used_pct) > 70 ? 'high' : 'medium',
            category: 'Storage',
            title: `${l.database_name}: transaction log is waiting for a log backup (${num(l.log_used_pct)}% used)`,
            detail: 'The database is in FULL recovery, so the log only frees space after a log backup. Back it up regularly, or switch to SIMPLE if point-in-time restore is not needed.',
            sql: `BACKUP LOG ${q(l.database_name)} TO DISK = ${s(`${l.database_name}_log.trn`)} WITH CHECKSUM;\n-- or, if point-in-time restore is not needed:\n-- ALTER DATABASE ${q(l.database_name)} SET RECOVERY SIMPLE;`,
        });
    }
    const slow = (d.files || []).filter((f) => num(f.num_of_reads) > 1000 && num(f.avg_read_ms) > 20);
    if (slow.length) {
        rec(out, {
            id: 'slow-reads',
            severity: slow.some((f) => num(f.avg_read_ms) > 50) ? 'high' : 'medium',
            category: 'Storage',
            title: `${slow.length} file${slow.length > 1 ? 's have' : ' has'} slow reads (over 20 ms on average)`,
            detail: `${slow
                .slice(0, 5)
                .map((f) => `${f.database_name}/${f.file_name} ${Number(f.avg_read_ms).toFixed(0)} ms`)
                .join(', ')}. Check the disk, or reduce reads with better indexes.`,
        });
    }
    for (const v of (d.volumes || []).filter((x) => num(x.free_pct) < 15)) {
        rec(out, {
            id: `disk-space:${v.volume_mount_point}`,
            severity: num(v.free_pct) < 5 ? 'high' : 'medium',
            category: 'Storage',
            title: `Drive ${v.volume_mount_point} is ${100 - num(v.free_pct)}% full`,
            detail: `${num(v.free_gb)} GB free of ${num(v.total_gb)} GB. Databases stop when a file cannot grow.`,
        });
    }
}

/* ── Backups & Jobs ───────────────────────────────────────────────────── */
function backups(d, out) {
    const st = d.settings?.[0] || {};
    const dir = st.backup_path ? String(st.backup_path).replace(/[\\/]?$/, '\\') : '';
    const compression = num(st.engine_edition) === EXPRESS ? '' : ', COMPRESSION';
    const now = Date.now();
    const user = (d.backups || []).filter((b) => b.state_desc === 'ONLINE' && !SYSTEM_DBS.has(b.database_name));
    const stale = user.filter((b) => !b.last_full || now - new Date(b.last_full).getTime() > 7 * 86400000);
    if (stale.length) {
        rec(out, {
            id: 'full-backups',
            severity: stale.some((b) => !b.last_full) ? 'high' : 'medium',
            category: 'Backups',
            title: `${stale.length} database${stale.length > 1 ? 's have' : ' has'} no full backup in 7 days`,
            detail: stale.map((b) => `${b.database_name} (${b.last_full ? 'last ' + new Date(b.last_full).toLocaleDateString() : 'never'})`).join(', '),
            sql: stale
                .map(
                    (b) =>
                        `BACKUP DATABASE ${q(b.database_name)} TO DISK = ${s(`${dir}${b.database_name}_FULL.bak`)} WITH CHECKSUM, INIT${compression};`,
                )
                .join('\n'),
            caution: 'Schedule these (SQL Agent job or Windows Task Scheduler) and copy backups off this machine.',
        });
    }
    const noLog = user.filter((b) => b.recovery_model_desc === 'FULL' && (!b.last_log || now - new Date(b.last_log).getTime() > 86400000));
    if (noLog.length) {
        rec(out, {
            id: 'log-backups',
            severity: 'medium',
            category: 'Backups',
            title: `${noLog.length} database${noLog.length > 1 ? 's are' : ' is'} in FULL recovery without log backups`,
            detail: 'Without log backups the transaction log grows until the disk fills. Back up the log every 15–60 minutes, or use SIMPLE recovery.',
            sql: noLog
                .map(
                    (b) =>
                        `BACKUP LOG ${q(b.database_name)} TO DISK = ${s(`${dir}${b.database_name}_LOG.trn`)} WITH CHECKSUM${compression};\n-- or: ALTER DATABASE ${q(b.database_name)} SET RECOVERY SIMPLE;`,
                )
                .join('\n'),
        });
    }
    const agent = (d.services || []).find((x) => /agent/i.test(x.servicename));
    if (agent && agent.status_desc !== 'Running' && num(st.engine_edition) !== EXPRESS) {
        rec(out, {
            id: 'agent-stopped',
            severity: 'medium',
            category: 'Backups',
            title: 'SQL Server Agent is not running',
            detail: `Scheduled jobs (including backups) do not run. Startup type: ${agent.startup_type_desc}. Start it and set it to Automatic in SQL Server Configuration Manager.`,
        });
    }
    const failing = (d.jobs || []).filter((j) => num(j.failures_24h) > 0);
    if (failing.length) {
        rec(out, {
            id: 'failed-jobs',
            severity: 'high',
            category: 'Backups',
            title: `${failing.length} SQL Agent job${failing.length > 1 ? 's' : ''} failed in the last 24 hours`,
            detail: failing.map((j) => `${j.job_name}: ${String(j.last_message || '').slice(0, 120)}`).join(' · '),
        });
    }
}

/* ── Security ─────────────────────────────────────────────────────────── */
function security(d, out) {
    const sum = d.summary?.[0] || {};
    if (sum.sa_disabled === 0 && !num(sum.windows_auth_only)) {
        rec(out, {
            id: 'sa',
            severity: 'high',
            category: 'Security',
            title: `Disable the built-in "${sum.sa_name}" login`,
            detail: 'It is the first account attackers try. Use named administrator logins instead.',
            sql: `ALTER LOGIN ${q(sum.sa_name)} DISABLE;`,
            caution: 'Make sure another sysadmin login works before disabling it.',
        });
    }
    for (const l of d.sqlLogins || []) {
        if (num(l.is_disabled)) continue;
        if (num(l.blank_password) || num(l.password_is_login_name)) {
            rec(out, {
                id: `weak-password:${l.name}`,
                severity: 'high',
                category: 'Security',
                title: `Login "${l.name}" has ${num(l.blank_password) ? 'a blank password' : 'its own name as password'}`,
                detail: 'Anyone can sign in with it. Set a strong password (and update the applications that use it).',
                sql: `ALTER LOGIN ${q(l.name)} WITH PASSWORD = N'<new strong password>', CHECK_POLICY = ON;`,
            });
        } else if (!num(l.is_policy_checked)) {
            rec(out, {
                id: `policy:${l.name}`,
                severity: 'medium',
                category: 'Security',
                title: `Password policy is off for "${l.name}"`,
                detail: 'Windows password complexity and lockout rules are not applied to this login.',
                sql: `ALTER LOGIN ${q(l.name)} WITH CHECK_POLICY = ON;`,
            });
        }
    }
    for (const c of (d.config || []).filter((x) => x.at_risk)) {
        rec(out, {
            id: `config:${c.name}`,
            severity: c.name === 'xp_cmdshell' ? 'high' : 'medium',
            category: 'Security',
            title: `Set "${c.name}" to ${c.recommended}`,
            detail: c.why || '',
            sql: `EXEC sp_configure 'show advanced options', 1; RECONFIGURE;\nEXEC sp_configure ${s(c.name).slice(1)}, ${c.recommended}; RECONFIGURE;`,
            caution: 'Check nothing depends on the current setting before changing it.',
        });
    }
    for (const db of (d.databases || []).filter((x) => num(x.is_trustworthy_on) && x.database_name !== 'msdb')) {
        rec(out, {
            id: `trustworthy:${db.database_name}`,
            severity: 'medium',
            category: 'Security',
            title: `Turn off TRUSTWORTHY on ${db.database_name}`,
            detail: 'With TRUSTWORTHY on, code in the database can act with its owner’s server-level permissions.',
            sql: `ALTER DATABASE ${q(db.database_name)} SET TRUSTWORTHY OFF;`,
            caution: 'Some CLR assemblies or cross-database procedures rely on it; sign them with a certificate instead.',
        });
    }
    if ((d.failedLogins || []).length >= 20) {
        rec(out, {
            id: 'failed-logins',
            severity: 'medium',
            category: 'Security',
            title: `${(d.failedLogins || []).length}+ failed logins in the current error log`,
            detail: 'Check the client addresses in the messages; repeated failures from one address look like password guessing.',
        });
    }
}

/* ── Always On ────────────────────────────────────────────────────────── */
function alwayson(d, out) {
    for (const r of (d.replicas || []).filter((x) => x.synchronization_health_desc && x.synchronization_health_desc !== 'HEALTHY')) {
        rec(out, {
            id: `replica:${r.replica_server_name}`,
            severity: 'high',
            category: 'Always On',
            title: `Replica ${r.replica_server_name} is ${r.synchronization_health_desc}`,
            detail: `Connected: ${r.connected_state_desc || 'unknown'}. Check the network and the SQL Server error log on that replica.`,
        });
    }
    for (const db of (d.databases || []).filter((x) => num(x.is_suspended))) {
        rec(out, {
            id: `suspended:${db.database_name}:${db.replica_server_name}`,
            severity: 'high',
            category: 'Always On',
            title: `Data movement is suspended for ${db.database_name} on ${db.replica_server_name}`,
            detail: `Reason: ${db.suspend_reason_desc || 'unknown'}. The secondary falls further behind until it is resumed.`,
            sql: `ALTER DATABASE ${q(db.database_name)} SET HADR RESUME;  -- run on ${db.replica_server_name}`,
        });
    }
}

const RANK = { high: 0, medium: 1, low: 2 };

export function buildRecommendations(view, data, live) {
    const out = [];
    try {
        if (view === 'storage') storage(data, out);
        else if (view === 'performance') performance(data, live, out);
        else if (view === 'querystore') querystore(data, out);
        else if (view === 'sessions') sessions(data, out);
        else if (view === 'memory') memory(data, live, out);
        else if (view === 'io') io(data, out);
        else if (view === 'backups') backups(data, out);
        else if (view === 'security') security(data, out);
        else if (view === 'alwayson') alwayson(data, out);
    } catch (e) {
        out.push({ id: 'advisor-error', severity: 'low', category: 'Advisor', title: 'Some recommendations could not be worked out', detail: e.message });
    }
    return out.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}
