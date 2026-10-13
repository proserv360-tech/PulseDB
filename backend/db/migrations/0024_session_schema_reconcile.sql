-- 0024_session_schema_reconcile.sql
-- ---------------------------------------------------------------------------
-- Reconciles pgmonitoringtool.user_sessions between the committed migrations
-- and the deployed database, and adds the missing v_active_sessions view.
--
-- Background: db/migrations/0000 and db/schema.ts describe a user_sessions
-- table that differs from the one captured in
-- supabase_backup_tool_monitoring/pgmonitoringtool/schema.sql:
--
--   column        | 0000 / schema.ts              | deployed (backup dump)
--   --------------+-------------------------------+---------------------------
--   expires_at    | timestamp DEFAULT now()       | timestamptz DEFAULT now()+24h
--   revoked_at    | present                       | ABSENT
--   revoked_by    | present                       | ABSENT
--   device_label  | varchar(100)                  | text
--   location      | varchar(100)                  | text
--
-- Two live defects follow from that drift:
--   1. Under the migration's `DEFAULT now()`, every session row is created
--      already expired, so isSessionActive()'s `expires_at > NOW()` predicate
--      fails immediately and no user can stay logged in on a freshly-migrated
--      database.
--   2. revokeSession() writes revoked_at/revoked_by. If those columns are
--      absent the UPDATE throws, and the logout route swallows it with
--      `.catch(() => {})` — so logout fails silently.
--
-- This migration is written to be safe to run against EITHER variant, and to
-- be re-runnable. It was authored without access to the live database (both
-- Supabase projects were paused at the time), so every statement is guarded.
-- ---------------------------------------------------------------------------

-- NOTE ON PRECONDITIONS
-- This migration reconciles an EXISTING user_sessions table; it does not
-- create one. If the table is absent the whole body no-ops with a NOTICE
-- rather than failing the migration run. (Separately worth knowing: neither
-- scripts/migrate.ts nor scripts/migrate-enterprise.ts creates
-- pgmonitoringtool.users or user_sessions — provisioning a genuinely fresh
-- database is a gap that predates this file.)

CREATE SCHEMA IF NOT EXISTS pgmonitoringtool;
--> statement-breakpoint

DO $$
BEGIN
    IF to_regclass('pgmonitoringtool.user_sessions') IS NULL THEN
        RAISE NOTICE '0024: pgmonitoringtool.user_sessions not present — skipping session reconcile.';
        RETURN;
    END IF;

    -- ── 1. Revocation columns ───────────────────────────────────────────────
    -- Needed by revokeSession / revokeAllUserSessions / revokeAllSessions.
    -- Absent from the deployed schema dump, so those UPDATEs would throw — and
    -- the logout route swallows the error with `.catch(() => {})`.
    ALTER TABLE pgmonitoringtool.user_sessions
        ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS revoked_by INTEGER;

    -- ── 2. expires_at default ───────────────────────────────────────────────
    -- createSession() now always supplies expires_at explicitly, so this is a
    -- backstop for any other writer. now() + 24h matches the deployed default.
    ALTER TABLE pgmonitoringtool.user_sessions
        ALTER COLUMN expires_at SET DEFAULT (now() + interval '24 hours');

    -- Repair rows written under the broken `DEFAULT now()` — still flagged
    -- active but with expires_at at or before their own creation time. Left
    -- alone these are permanently unusable sessions.
    UPDATE pgmonitoringtool.user_sessions
       SET expires_at = created_at + interval '24 hours'
     WHERE is_active = TRUE
       AND expires_at <= created_at;

    -- ── 3. Indexes ──────────────────────────────────────────────────────────
    CREATE INDEX IF NOT EXISTS idx_sessions_expires
        ON pgmonitoringtool.user_sessions (expires_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_active
        ON pgmonitoringtool.user_sessions (user_id, is_active);

    -- ── 4. v_active_sessions ────────────────────────────────────────────────
    -- listActiveSessions() selects from this view, which existed in NEITHER the
    -- migrations nor the deployed schema dump — so the admin Security panel
    -- threw at runtime. Column names match toClientSession().
    IF to_regclass('pgmonitoringtool.users') IS NULL THEN
        RAISE NOTICE '0024: pgmonitoringtool.users not present — skipping v_active_sessions.';
        RETURN;
    END IF;

    EXECUTE $view$
        CREATE OR REPLACE VIEW pgmonitoringtool.v_active_sessions AS
        SELECT s.id,
               s.user_id,
               u.username,
               u.name AS user_name,
               s.ip_address,
               s.device_label,
               s.location,
               s.risk_level,
               s.is_active,
               s.expires_at,
               s.created_at
          FROM pgmonitoringtool.user_sessions s
          JOIN pgmonitoringtool.users u ON u.id = s.user_id
         WHERE s.is_active = TRUE
           AND s.expires_at > now()
           AND u.deleted_at IS NULL
    $view$;
END $$;
--> statement-breakpoint
