-- 0030_availability_alert_rule_templates.sql ─────────────────────────────────
-- Availability rules — "is my database up?" — to sit alongside the threshold
-- templates from 0028 and 0029.
--
-- DIFFERENT SOURCE TO 0029
-- ------------------------
-- 0029's rules came from services/metricsRegistry.ts, which collects metrics
-- from a database that is already answering. These three come from
-- services/connectionHealthService.ts, which probes each row in
-- fathom_connections directly and fires on state transitions.
--
-- That distinction matters: every rule in 0028 and 0029 is unmeasurable when the
-- database is unreachable, because the collector cannot run. Before the health
-- monitor existed, an unreachable database produced complete silence —
-- collectMetrics() caught the error, returned null, and the caller returned [].
--
-- The `metric` values below match the `rule` field the monitor stamps into each
-- alert's data payload, so a rule row and the alerts it explains can be joined.
--
-- THRESHOLD SEMANTICS
-- -------------------
-- These are not gauge comparisons like "cache hit < 90". They record the
-- monitor's configured trip points so the values are visible and auditable in
-- one place:
--
--   connection_unreachable  threshold 2     — consecutive failed probes before
--                                             alerting (FATHOM_HEALTH_FAILURES).
--                                             One dropped packet must not page.
--   connection_slow         threshold 2000  — round-trip ms for SELECT 1
--                                             (FATHOM_HEALTH_SLOW_MS).
--   connection_recovered    threshold 1     — one successful probe closes it out.
--
-- Changing a value here does not change the monitor's behaviour — it reads the
-- env vars. Same caveat as 0028 and 0029: these rows are documentation and a
-- UI surface until the engine is wired to read from this table.
--
--   npm run sql -- db/migrations/0030_availability_alert_rule_templates.sql

BEGIN;

-- The ON CONFLICT below needs this index. 0028 creates it too, but repeating it
-- here (IF NOT EXISTS) means these seed files can be applied in any order, or
-- individually, without a silent dependency on having run 0028 first.
CREATE UNIQUE INDEX IF NOT EXISTS alert_rules_name_unique
    ON pgmonitoringtool.alert_rules (lower(name));

INSERT INTO pgmonitoringtool.alert_rules
    (name, description, metric, condition, threshold, severity, enabled,
     cooldown_minutes, notify_email, notify_slack)
VALUES
    ('Database unreachable',
     'A monitored database failed consecutive connection probes. This is the alert that matters most and the one the tool could not previously produce — every threshold rule goes quiet when the database stops answering, so its absence looked identical to everything being fine.',
     'connection_unreachable', '>', 2, 'critical', true, 5, true, true),

    ('Database slow to respond',
     'SELECT 1 round-trip exceeded the latency budget. Usually saturation, a noisy neighbour, or network degradation between the collector and the database — it fires before an outage, not after.',
     'connection_slow', '>', 2000, 'warning', true, 15, false, true),

    ('Database recovered',
     'A previously unreachable database answered again. Fired so an incident closes itself out rather than leaving someone to check manually whether it came back.',
     'connection_recovered', '>', 1, 'info', true, 0, false, true)

ON CONFLICT (lower(name)) DO UPDATE
SET description = EXCLUDED.description,
    metric      = EXCLUDED.metric,
    updated_at  = now();

COMMIT;

\echo ''
\echo '=== Availability rules ========================================='
SELECT id, name, metric, threshold, severity, enabled,
       notify_email AS email, notify_slack AS slack
FROM pgmonitoringtool.alert_rules
WHERE metric LIKE 'connection\_%'
ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END;

\echo ''
\echo '=== Full catalogue, by source =================================='
SELECT CASE
         WHEN metric LIKE 'connection\_%' THEN '0030 availability (health probe)'
         WHEN metric IN ('idle_in_transaction','waiting_connections','idle_connections',
                         'longest_transaction','deadlock_count','blocked_queries','rollbacks',
                         'commit_ratio','exclusive_locks','conflicts','buffers_backend_fsync',
                         'last_analyze_age_hours','tables_needing_vacuum','unused_indexes',
                         'autovacuum_count','index_hit_ratio','checkpoint_sync_time',
                         'checkpoints_req','seq_to_idx_scan_ratio','temp_files_size',
                         'wal_archive_fail','replication_slots')
              THEN '0029 metricsRegistry'
         ELSE '0028 alertService (hardcoded)'
       END AS source,
       count(*) AS rules,
       count(*) FILTER (WHERE severity = 'critical') AS critical,
       count(*) FILTER (WHERE notify_slack)          AS to_slack
FROM pgmonitoringtool.alert_rules
GROUP BY 1
ORDER BY 1;
\echo ''
