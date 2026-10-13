-- purge-deleted-users.sql ────────────────────────────────────────────────────
-- Removes users that were soft-deleted before deletion became a hard delete.
--
-- Those rows are invisible in the UI but still hold their usernames, and
-- `users_username_key UNIQUE (username)` does not exclude them — so recreating
-- any of those accounts fails with a unique violation.
--
--   npm run sql -- scripts/purge-deleted-users.sql
--
-- The listing runs first, so you see exactly what is about to go. Everything is
-- in one transaction: if the delete fails, nothing is removed.
--
-- ⚠ Every foreign key referencing users on this database is ON DELETE CASCADE,
--   so this also removes each user's sessions, login activity and API keys.
--   Audit rows survive — audit_log.actor_id has no foreign key, and
--   actor_username is denormalised so the trail stays readable.
--
--   The system administrator (id 1) is excluded unconditionally.

BEGIN;

\echo ''
\echo '=== Users about to be purged =================================='
SELECT id, username, name, email, role, status,
       deleted_at,
       date_trunc('second', now() - deleted_at) AS deleted_ago
FROM pgmonitoringtool.users
WHERE deleted_at IS NOT NULL
  AND id <> 1
ORDER BY deleted_at;

\echo ''
\echo '=== What cascades with them ==================================='
SELECT 'user_sessions' AS table_name,
       count(*)        AS rows_removed
FROM pgmonitoringtool.user_sessions s
WHERE s.user_id IN (SELECT id FROM pgmonitoringtool.users
                    WHERE deleted_at IS NOT NULL AND id <> 1)
UNION ALL
SELECT 'user_api_keys',
       count(*)
FROM pgmonitoringtool.user_api_keys k
WHERE k.user_id IN (SELECT id FROM pgmonitoringtool.users
                    WHERE deleted_at IS NOT NULL AND id <> 1);

\echo ''
\echo '=== Purging ==================================================='
DO $$
DECLARE
    removed INTEGER := 0;
    names   TEXT;
BEGIN
    SELECT string_agg(username, ', ' ORDER BY username) INTO names
    FROM pgmonitoringtool.users
    WHERE deleted_at IS NOT NULL AND id <> 1;

    DELETE FROM pgmonitoringtool.users
    WHERE deleted_at IS NOT NULL AND id <> 1;

    GET DIAGNOSTICS removed = ROW_COUNT;

    IF removed = 0 THEN
        RAISE NOTICE 'nothing to purge — no soft-deleted users';
    ELSE
        RAISE NOTICE 'purged % user(s): %', removed, names;
        RAISE NOTICE 'those usernames are now free to reuse';
    END IF;
END $$;

COMMIT;

\echo ''
\echo '=== Remaining users ==========================================='
SELECT id, username, role, status,
       (deleted_at IS NOT NULL) AS still_flagged_deleted
FROM pgmonitoringtool.users
ORDER BY id;
\echo ''
