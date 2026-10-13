-- inspect-alert-schema.sql ────────────────────────────────────────────────────
-- READ ONLY. Run before 0025_slack_alert_destinations.sql to see what the org
-- database actually looks like, and again afterwards to confirm the result.
--
--   psql "$DATABASE_URL" -f scripts/inspect-alert-schema.sql
--
-- Nothing here writes, locks or changes a setting.

\echo ''
\echo '=== 1. Does the alerting chain have its tables? ==================='
SELECT
    'pgmonitoringtool.alerts'                    AS object,
    to_regclass('pgmonitoringtool.alerts')::text AS exists
UNION ALL SELECT 'public.alerts',
    to_regclass('public.alerts')::text
UNION ALL SELECT 'pgmonitoringtool.notification_destinations',
    to_regclass('pgmonitoringtool.notification_destinations')::text
UNION ALL SELECT 'pgmonitoringtool.organizations  (FK parent)',
    to_regclass('pgmonitoringtool.organizations')::text
UNION ALL SELECT 'pgmonitoringtool.users          (FK parent)',
    to_regclass('pgmonitoringtool.users')::text;

\echo ''
\echo '=== 2. The two alerts tables, side by side ======================='
\echo '    alertService.ts inserts: id, timestamp, severity, category,'
\echo '                             message, data, acknowledged'
\echo '    server.ts     inserts:   alert_type, severity, message, details,'
\echo '                             acknowledged'
SELECT table_schema, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'alerts'
  AND table_schema IN ('public', 'pgmonitoringtool')
ORDER BY table_schema, ordinal_position;

\echo ''
\echo '=== 3. Which table does an UNQUALIFIED "alerts" resolve to? ======'
\echo '    This is what alertService.ts:203 actually writes to.'
SELECT current_setting('search_path') AS search_path,
       to_regclass('alerts')::text    AS unqualified_alerts_resolves_to;

\echo ''
\echo '=== 4. Row counts ================================================'
SELECT 'public.alerts' AS tbl, count(*) FROM public.alerts
UNION ALL
SELECT 'pgmonitoringtool.alerts', count(*) FROM pgmonitoringtool.alerts;

\echo ''
\echo '=== 5. Configured destinations (empty until one is added in UI) =='
SELECT id, name, provider, min_severity, enabled,
       last_status, last_used_at,
       left(coalesce(last_error, ''), 60) AS last_error_head,
       (secret_enc IS NOT NULL)           AS has_secret
FROM pgmonitoringtool.notification_destinations
ORDER BY id;

\echo ''
\echo '=== 6. Post-migration check ======================================'
\echo '    After 0025 both flags below should read t.'
SELECT
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'pgmonitoringtool' AND table_name = 'alerts'
              AND column_name = 'alert_type')          AS alerts_has_alert_type,
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'pgmonitoringtool' AND table_name = 'alerts'
              AND column_name = 'details')             AS alerts_has_details,
    to_regclass('pgmonitoringtool.notification_destinations') IS NOT NULL
                                                       AS destinations_table_exists;
\echo ''
