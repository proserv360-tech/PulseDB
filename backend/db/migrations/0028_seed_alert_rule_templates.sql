-- 0028_seed_alert_rule_templates.sql ─────────────────────────────────────────
-- Seeds pgmonitoringtool.alert_rules with the eleven rules that alertService
-- currently evaluates from a hardcoded array in initializeAlertRules().
--
-- WHY
-- ---
-- The Alert Rules screen reads from alert_rules, which has been empty — so the
-- rules that actually fire were invisible and untunable. Seeding them makes the
-- running configuration something you can see and edit.
--
-- IMPORTANT — these are editable copies, not yet the source of truth.
-- alertService still evaluates its hardcoded array, because each rule carries a
-- `condition(metrics)` function that cannot be expressed as a threshold alone
-- (slow_queries checks array length, blocking_locks inspects lock trees, and so
-- on). Changing a threshold here does NOT yet change what fires. Wiring the
-- engine to read from this table is a separate, larger change — the shape below
-- is designed to support it.
--
-- Thresholds mirror CONFIG.ALERT_THRESHOLDS in server.ts:199 so the seeded
-- values match live behaviour rather than inventing new numbers:
--   CONNECTION_USAGE_PCT 80 · LONG_QUERY_SEC 300 · DEAD_TUPLE_RATIO 20
--   REPLICATION_LAG_MB 100 · CACHE_HIT_RATIO 90 · LOCK_COUNT 5
--
-- Idempotent: keyed on `name`, so re-running updates the description and
-- metadata but preserves any threshold, severity or enabled flag you have
-- changed. Your edits survive a re-run.
--
--   npm run sql -- db/migrations/0028_seed_alert_rule_templates.sql

BEGIN;

-- Needed for the ON CONFLICT below. alert_rules has no unique constraint on
-- name from 0026, so add one — two rules sharing a name would be ambiguous in
-- the UI anyway.
CREATE UNIQUE INDEX IF NOT EXISTS alert_rules_name_unique
    ON pgmonitoringtool.alert_rules (lower(name));

INSERT INTO pgmonitoringtool.alert_rules
    (name, description, metric, condition, threshold, severity, enabled,
     cooldown_minutes, notify_email, notify_slack)
VALUES
    -- ── Resources ───────────────────────────────────────────────────────────
    ('High connections',
     'Connection count is approaching max_connections. Investigate before new connections start being refused.',
     'connection_usage_pct', '>', 80, 'warning', true, 15, false, true),

    ('Critical connections',
     'Connection count is at the point where the database will begin refusing new clients.',
     'connection_usage_pct', '>', 95, 'critical', true, 5, true, true),

    ('Disk space warning',
     'Free space on the data volume is running low. Postgres cannot write once the volume fills.',
     'disk_free_pct', '<', 20, 'warning', true, 30, true, true),

    -- ── Performance ─────────────────────────────────────────────────────────
    ('Slow queries',
     'One or more queries have been running longer than the long-query threshold.',
     'long_query_sec', '>', 300, 'warning', true, 15, false, true),

    ('Low cache hit ratio',
     'Buffer cache hit ratio has dropped below target, so reads are going to disk more often than they should.',
     'cache_hit_ratio', '<', 90, 'warning', true, 30, false, true),

    ('Query plan regression',
     'A previously fast query has switched to a materially slower plan.',
     'plan_cost_increase_pct', '>', 50, 'warning', true, 60, false, true),

    -- ── Maintenance ─────────────────────────────────────────────────────────
    ('High table bloat',
     'Dead tuple ratio has exceeded the threshold on one or more tables. Vacuum is not keeping up.',
     'dead_tuple_ratio', '>', 20, 'warning', true, 720, false, true),

    ('Vacuum overdue',
     'A table has not been vacuumed within the expected window, risking bloat and transaction-ID wraparound.',
     'hours_since_vacuum', '>', 24, 'warning', true, 720, false, true),

    -- ── Reliability ─────────────────────────────────────────────────────────
    ('Replication lag',
     'A replica has fallen behind the primary by more than the allowed margin. Failover would lose data.',
     'replication_lag_mb', '>', 100, 'critical', true, 10, true, true),

    ('Blocking locks',
     'Sessions are blocked waiting on locks held by other sessions. Sustained blocking stalls the application.',
     'blocking_lock_count', '>', 5, 'critical', true, 10, true, true),

    ('PITR RPO breach',
     'Point-in-time-recovery is further behind than the recovery point objective allows.',
     'pitr_lag_minutes', '>', 15, 'critical', true, 30, true, true)

ON CONFLICT (lower(name)) DO UPDATE
SET description = EXCLUDED.description,
    metric      = EXCLUDED.metric,
    updated_at  = now();
    -- Deliberately NOT overwriting threshold, condition, severity, enabled,
    -- cooldown_minutes or the notify_* flags — those are yours to tune, and a
    -- re-run must not silently reset them.

COMMIT;

\echo ''
\echo '=== Seeded rules ==============================================='
SELECT id, name, metric, condition, threshold, severity, enabled,
       cooldown_minutes AS cooldown_min,
       notify_email AS email, notify_slack AS slack
FROM pgmonitoringtool.alert_rules
ORDER BY
    CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
    name;

\echo ''
\echo 'Note: alertService still evaluates its hardcoded rules. Editing a'
\echo 'threshold here does not yet change what fires — see the header.'
\echo ''
