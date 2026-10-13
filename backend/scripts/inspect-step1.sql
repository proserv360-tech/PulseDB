-- inspect-step1.sql ──────────────────────────────────────────────────────────
-- READ ONLY. Checks the Step 1 remediation from DB_STATE_AND_PLAN.md — the
-- writes that were failing silently. Run before and after 0024 + 0027.
--
--   npm run sql -- scripts/inspect-step1.sql

\echo ''
\echo '=== 1. Do the Step 1 objects exist? ============================='
SELECT 'pgmonitoringtool.audit_log'        AS object,
       to_regclass('pgmonitoringtool.audit_log')::text        AS exists
UNION ALL SELECT 'pgmonitoringtool.user_sessions',
       to_regclass('pgmonitoringtool.user_sessions')::text
UNION ALL SELECT 'pgmonitoringtool.user_api_keys   (0027)',
       to_regclass('pgmonitoringtool.user_api_keys')::text
UNION ALL SELECT 'pgmonitoringtool.v_active_sessions (0024, view)',
       to_regclass('pgmonitoringtool.v_active_sessions')::text;

\echo ''
\echo '=== 2. Columns the code writes but the DB was missing ==========='
\echo '    auditService.ts:43 names all nine of these in one INSERT.'
SELECT c.expected AS column_name,
       (EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'pgmonitoringtool'
                  AND table_name = 'audit_log'
                  AND column_name = c.expected)) AS present
FROM (VALUES ('actor_id'), ('actor_username'), ('action'), ('resource_type'),
             ('resource_id'), ('level'), ('detail'), ('metadata'),
             ('ip_address')) AS c(expected);

\echo ''
\echo '=== 3. Session revocation columns (0024) ========================'
SELECT c.expected AS column_name,
       (EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'pgmonitoringtool'
                  AND table_name = 'user_sessions'
                  AND column_name = c.expected)) AS present
FROM (VALUES ('revoked_at'), ('revoked_by')) AS c(expected);

\echo ''
\echo '=== 4. Is anything actually being written? ======================'
\echo '    audit_log sat at 0 rows against 55 logins. After 0027 it should'
\echo '    start climbing as soon as an admin action is performed.'
-- Counted via query_to_xml so a missing table reports NULL instead of
-- aborting the whole script — this runs before the migration too.
SELECT t.tbl,
       CASE WHEN to_regclass('pgmonitoringtool.' || t.tbl) IS NULL THEN NULL
            ELSE (xpath('/row/c/text()',
                   query_to_xml('SELECT count(*) AS c FROM pgmonitoringtool.' || t.tbl,
                                false, true, '')))[1]::text::bigint
       END AS rows,
       (to_regclass('pgmonitoringtool.' || t.tbl) IS NOT NULL) AS table_exists
FROM (VALUES ('audit_log'), ('user_sessions'), ('user_api_keys')) AS t(tbl);

\echo ''
\echo '=== 5. Stale sessions ==========================================='
\echo '    11 of 12 were flagged active but already expired — nothing had'
\echo '    ever successfully revoked one. 0024 expires them.'
-- revoked_at only exists after 0024, so it is referenced dynamically.
SELECT (xpath('/row/c/text()', query_to_xml(
          'SELECT count(*) AS c FROM pgmonitoringtool.user_sessions'
          || ' WHERE is_active AND expires_at < now()', false, true, '')))[1]::text::bigint
           AS active_but_expired,
       (xpath('/row/c/text()', query_to_xml(
          'SELECT count(*) AS c FROM pgmonitoringtool.user_sessions WHERE is_active',
          false, true, '')))[1]::text::bigint AS flagged_active,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema='pgmonitoringtool'
                           AND table_name='user_sessions'
                           AND column_name='revoked_at')
            THEN (xpath('/row/c/text()', query_to_xml(
                   'SELECT count(*) AS c FROM pgmonitoringtool.user_sessions'
                   || ' WHERE revoked_at IS NOT NULL', false, true, '')))[1]::text::bigint
       END AS ever_revoked,
       (xpath('/row/c/text()', query_to_xml(
          'SELECT count(*) AS c FROM pgmonitoringtool.user_sessions',
          false, true, '')))[1]::text::bigint AS total;

\echo ''
\echo '=== 6. Summary — all should read t ============================='
SELECT
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='pgmonitoringtool' AND table_name='audit_log'
              AND column_name='metadata')            AS audit_log_ready,
    to_regclass('pgmonitoringtool.user_api_keys')    IS NOT NULL AS api_keys_ready,
    to_regclass('pgmonitoringtool.v_active_sessions') IS NOT NULL AS sessions_view_ready,
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='pgmonitoringtool' AND table_name='user_sessions'
              AND column_name='revoked_at')          AS logout_ready;
\echo ''
