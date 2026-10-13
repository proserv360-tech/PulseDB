-- inspect-users-schema.sql ───────────────────────────────────────────────────
-- READ ONLY. Diagnoses "Internal server error" on user creation by comparing
-- the columns services/userService.ts:117 inserts against what actually exists.
--
--   npm run sql -- scripts/inspect-users-schema.sql

\echo ''
\echo '=== 1. Columns the INSERT names — any false is the cause ========'
SELECT c.expected AS column_name,
       (EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'pgmonitoringtool'
                  AND table_name   = 'users'
                  AND column_name  = c.expected)) AS present
FROM (VALUES
    ('username'), ('password_hash'), ('name'), ('email'), ('role'),
    ('access_level'), ('allowed_screens'), ('data_access'), ('department'),
    ('location'), ('mfa_enabled'), ('api_access'), ('status')
) AS c(expected);

\echo ''
\echo '=== 2. NOT NULL columns the INSERT does NOT supply =============='
\echo '    Anything listed here fails the insert the same way alerts.title did.'
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'pgmonitoringtool'
  AND table_name   = 'users'
  AND is_nullable  = 'NO'
  AND column_default IS NULL
  AND column_name NOT IN (
      'id', 'username', 'password_hash', 'name', 'email', 'role',
      'access_level', 'allowed_screens', 'data_access', 'department',
      'location', 'mfa_enabled', 'api_access', 'status'
  )
ORDER BY ordinal_position;

\echo ''
\echo '=== 3. CHECK constraints — a rejected role or status lands here =='
SELECT con.conname AS constraint_name,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = rel.relnamespace
WHERE ns.nspname = 'pgmonitoringtool'
  AND rel.relname = 'users'
  AND con.contype IN ('c', 'u')
ORDER BY con.conname;

\echo ''
\echo '=== 4. Full live shape, for reference ==========================='
SELECT ordinal_position AS pos, column_name, data_type,
       is_nullable AS nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'pgmonitoringtool' AND table_name = 'users'
ORDER BY ordinal_position;

\echo ''
\echo '=== 5. Existing roles in use ==================================='
\echo '    The audit found super_admin vs superadmin drift here.'
SELECT role, status, count(*) AS users
FROM pgmonitoringtool.users
GROUP BY role, status
ORDER BY role, status;
\echo ''
