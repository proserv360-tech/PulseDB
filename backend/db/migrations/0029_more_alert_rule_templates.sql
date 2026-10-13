-- 0029_more_alert_rule_templates.sql ─────────────────────────────────────────
-- Adds 22 more alert rule templates, derived from services/metricsRegistry.ts.
--
-- WHERE THESE COME FROM
-- ---------------------
-- metricsRegistry defines 57 PostgreSQL metrics, each already carrying
-- `thresholds: { warning, critical }` and a SQL query that collects it. Those
-- thresholds are what the tool already considers concerning — so the rules
-- below reuse them verbatim rather than inventing new numbers.
--
-- `metric` values match the registry `id` exactly. That matters: when the
-- engine is eventually wired to evaluate rules from this table, the metric name
-- is what will join a rule to its collector.
--
-- Only metrics with a meaningful threshold are included. The registry has
-- several with warning=0/critical=0 (checkpoints_timed, idx_scan_count,
-- blocks_hit_per_sec, streaming_replicas…) — those are informational counters
-- for dashboards, not alertable conditions, so they are deliberately omitted.
--
-- Severity follows the registry: a rule seeded at the `warning` threshold gets
-- severity 'warning'; the four conditions that mean active damage are seeded at
-- the `critical` threshold instead.
--
-- Idempotent and edit-preserving, same as 0028 — keyed on lower(name), and the
-- DO UPDATE refreshes only description and metric.
--
--   npm run sql -- db/migrations/0029_more_alert_rule_templates.sql

BEGIN;

INSERT INTO pgmonitoringtool.alert_rules
    (name, description, metric, condition, threshold, severity, enabled,
     cooldown_minutes, notify_email, notify_slack)
VALUES
    -- ── Connections ─────────────────────────────────────────────────────────
    ('Idle in transaction',
     'Sessions are holding open transactions while doing nothing. These block vacuum and hold locks — a common cause of runaway bloat.',
     'idle_in_transaction', '>', 5, 'warning', true, 15, false, true),

    ('Waiting connections',
     'Connections are queued waiting on a lock rather than doing work.',
     'waiting_connections', '>', 5, 'warning', true, 10, false, true),

    ('Idle connection pileup',
     'A large number of idle connections. Usually a pooler that is not releasing, and each one still consumes backend memory.',
     'idle_connections', '>', 50, 'warning', true, 30, false, true),

    -- ── Health ──────────────────────────────────────────────────────────────
    ('Long-running transaction',
     'A transaction has been open beyond the expected window. Blocks vacuum cleanup and pins WAL.',
     'longest_transaction', '>', 300, 'warning', true, 15, false, true),

    ('Deadlocks detected',
     'The database has had to abort transactions to break a deadlock. Points at conflicting lock ordering in the application.',
     'deadlock_count', '>', 1, 'warning', true, 15, false, true),

    ('Blocked queries',
     'Queries are stalled waiting on locks held elsewhere.',
     'blocked_queries', '>', 3, 'warning', true, 10, false, true),

    ('Excessive rollbacks',
     'A high proportion of transactions are rolling back, which usually means application errors rather than database faults.',
     'rollbacks', '>', 10, 'warning', true, 30, false, true),

    ('Low commit ratio',
     'Fewer commits relative to rollbacks than expected — the inverse view of the rollback rule, useful on write-heavy systems.',
     'commit_ratio', '<', 95, 'warning', true, 30, false, true),

    ('Exclusive locks held',
     'An unusual number of exclusive locks. DDL or maintenance may be blocking normal traffic.',
     'exclusive_locks', '>', 10, 'warning', true, 15, false, true),

    ('Recovery conflicts',
     'A replica is cancelling queries because they conflict with replay from the primary.',
     'conflicts', '>', 1, 'warning', true, 20, false, true),

    ('Backend fsyncs',
     'Backends are performing their own fsyncs because the background writer cannot keep up — a direct latency cost on writes.',
     'buffers_backend_fsync', '>', 1, 'warning', true, 30, false, true),

    -- ── Maintenance ─────────────────────────────────────────────────────────
    ('Analyze overdue',
     'Statistics have not been refreshed recently. The planner is choosing plans from stale data.',
     'last_analyze_age_hours', '>', 168, 'warning', true, 720, false, true),

    ('Tables needing vacuum',
     'Several tables have crossed the autovacuum threshold and are waiting their turn.',
     'tables_needing_vacuum', '>', 5, 'warning', true, 360, false, true),

    ('Unused indexes',
     'Indexes that are never scanned. They cost write throughput and disk for nothing.',
     'unused_indexes', '>', 10, 'warning', true, 1440, false, true),

    ('Autovacuum workers saturated',
     'All autovacuum workers are busy. Vacuum is falling behind the write rate.',
     'autovacuum_count', '>', 3, 'warning', true, 60, false, true),

    -- ── Performance ─────────────────────────────────────────────────────────
    ('Low index hit ratio',
     'Index blocks are being read from disk rather than cache. Often the first sign that the working set has outgrown shared_buffers.',
     'index_hit_ratio', '<', 95, 'warning', true, 30, false, true),

    ('Slow checkpoint sync',
     'Checkpoint sync is taking long enough to stall writes. Usually storage latency or checkpoint_completion_target.',
     'checkpoint_sync_time', '>', 10000, 'warning', true, 30, false, true),

    ('Frequent requested checkpoints',
     'Checkpoints are being forced by WAL volume rather than time. max_wal_size is likely too small.',
     'checkpoints_req', '>', 10, 'warning', true, 60, false, true),

    ('Sequential scan pressure',
     'Sequential scans are outweighing index scans. Either an index is missing or one has stopped being used.',
     'seq_to_idx_scan_ratio', '>', 0.5, 'warning', true, 60, false, true),

    ('Temp file spill',
     'Queries are spilling to temporary files instead of sorting in memory. work_mem is too low for the workload.',
     'temp_files_size', '>', 1073741824, 'warning', true, 30, false, true),

    -- ── Replication & WAL ───────────────────────────────────────────────────
    ('WAL archive failures',
     'WAL segments are failing to archive. Point-in-time recovery is silently degrading and pg_wal will grow.',
     'wal_archive_fail', '>', 1, 'critical', true, 10, true, true),

    ('Inactive replication slots',
     'Replication slots exist that no consumer is reading. Each one pins WAL indefinitely and will eventually fill the disk.',
     'replication_slots', '>', 5, 'critical', true, 30, true, true)

ON CONFLICT (lower(name)) DO UPDATE
SET description = EXCLUDED.description,
    metric      = EXCLUDED.metric,
    updated_at  = now();

COMMIT;

\echo ''
\echo '=== All rules, by severity ====================================='
SELECT severity, count(*) AS rules,
       count(*) FILTER (WHERE enabled)      AS enabled,
       count(*) FILTER (WHERE notify_slack) AS to_slack,
       count(*) FILTER (WHERE notify_email) AS to_email
FROM pgmonitoringtool.alert_rules
GROUP BY severity
ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END;

\echo ''
\echo '=== Full catalogue ============================================='
SELECT id, name, metric, condition, threshold, severity, enabled
FROM pgmonitoringtool.alert_rules
ORDER BY
    CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
    name;

\echo ''
\echo '=== Rules whose metric is NOT a metricsRegistry id ============='
\echo '    These came from 0028 and predate the registry alignment. They are'
\echo '    valid rules, but nothing will collect them once the engine reads'
\echo '    metric names from the registry — worth reconciling before then.'
SELECT name, metric, threshold, severity
FROM pgmonitoringtool.alert_rules
WHERE metric NOT IN (
    'idle_in_transaction','waiting_connections','idle_connections',
    'longest_transaction','deadlock_count','blocked_queries','rollbacks',
    'commit_ratio','exclusive_locks','conflicts','buffers_backend_fsync',
    'last_analyze_age_hours','tables_needing_vacuum','unused_indexes',
    'autovacuum_count','index_hit_ratio','checkpoint_sync_time',
    'checkpoints_req','seq_to_idx_scan_ratio','temp_files_size',
    'wal_archive_fail','replication_slots','cache_hit_ratio',
    'connection_utilization_pct','active_connections','replication_lag',
    'bloat_ratio','dead_tuples_ratio','last_vacuum_age_hours','db_size'
)
ORDER BY name;
\echo ''
