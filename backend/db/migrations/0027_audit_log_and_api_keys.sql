-- 0027_audit_log_and_api_keys.sql ────────────────────────────────────────────
-- Closes the last two silent write failures from DB_STATE_AND_PLAN.md:
--
--   • audit_log      — every write fails, table has 0 rows next to 55 logins.
--                      Callers wrap writeAudit() in .catch(() => {}), so there
--                      is no error anywhere and no audit trail at all.
--   • user_api_keys  — table absent, so every X-API-Key request 401s. The
--                      API-key scope enforcement added in an earlier pass is
--                      correct but inert until this exists.
--
-- Sessions and v_active_sessions are NOT here — 0024_session_schema_reconcile
-- already covers revoked_at/revoked_by, the stale-session expiry and the view.
-- Apply 0024 first if it has not run on this database.
--
-- ADDITIVE and IDEMPOTENT. No drops, no retypes, safe to re-run.
--
--   ⚠ DO NOT APPLY VIA `npm run migrate` — schema_migrations does not exist,
--     so the runner would mark 0000–0026 applied without executing them.
--
--     npm run sql -- db/migrations/0027_audit_log_and_api_keys.sql

BEGIN;

CREATE SCHEMA IF NOT EXISTS pgmonitoringtool;

-- ── 1. audit_log ─────────────────────────────────────────────────────────────
-- services/auditService.ts:43 inserts:
--   (actor_id, actor_username, action, resource_type, resource_id,
--    level, detail, metadata, ip_address)
-- The live table is an older generation missing the last three.
--
-- Note on `ip_address` vs `ip`: the live table already has an `ip` column. The
-- code writes `ip_address` and casts to ::inet, so that is the column added
-- here. `ip` is left untouched — it may hold historic values — but it is now
-- unwritten. Consolidating the two is a follow-up, not a blocker.
ALTER TABLE IF EXISTS pgmonitoringtool.audit_log
    ADD COLUMN IF NOT EXISTS resource_id TEXT,
    ADD COLUMN IF NOT EXISTS metadata    JSONB,
    ADD COLUMN IF NOT EXISTS ip_address  INET;

-- Defensive: these should already exist, but a partial older generation may be
-- missing them and the insert names all nine columns.
ALTER TABLE IF EXISTS pgmonitoringtool.audit_log
    ADD COLUMN IF NOT EXISTS actor_id       INTEGER,
    ADD COLUMN IF NOT EXISTS actor_username VARCHAR(120),
    ADD COLUMN IF NOT EXISTS action         VARCHAR(120),
    ADD COLUMN IF NOT EXISTS resource_type  VARCHAR(64),
    ADD COLUMN IF NOT EXISTS level          VARCHAR(16) DEFAULT 'info',
    ADD COLUMN IF NOT EXISTS detail         TEXT,
    ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS audit_log_created_idx
    ON pgmonitoringtool.audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_actor_idx
    ON pgmonitoringtool.audit_log (actor_id) WHERE actor_id IS NOT NULL;

-- Resource lookups are always "what happened to this thing", so both parts
-- together rather than two single-column indexes.
CREATE INDEX IF NOT EXISTS audit_log_resource_idx
    ON pgmonitoringtool.audit_log (resource_type, resource_id)
    WHERE resource_type IS NOT NULL;

-- ── 2. user_api_keys ─────────────────────────────────────────────────────────
-- Shape taken from db/schema.ts, cross-checked against the four queries in
-- services/sessionService.ts (create, list, revoke, authenticateApiKey).
--
-- Only the SHA-256 hash is stored; the raw key is returned once at creation and
-- never persisted. `key_prefix` is the displayable head used to identify a key
-- in the UI without revealing it.
CREATE TABLE IF NOT EXISTS pgmonitoringtool.user_api_keys (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER      NOT NULL,
    name        VARCHAR(100) NOT NULL,
    key_prefix  VARCHAR(20)  NOT NULL,
    key_hash    VARCHAR(64)  NOT NULL,
    scope       VARCHAR(50)  DEFAULT 'read:all',
    total_calls INTEGER      NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    status      VARCHAR(20)  NOT NULL DEFAULT 'active',
    revoked_at  TIMESTAMPTZ,
    revoked_by  INTEGER,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF to_regclass('pgmonitoringtool.users') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint
                       WHERE conname = 'user_api_keys_user_id_fkey')
    THEN
        ALTER TABLE pgmonitoringtool.user_api_keys
            ADD CONSTRAINT user_api_keys_user_id_fkey
            FOREIGN KEY (user_id)
            REFERENCES pgmonitoringtool.users(id) ON DELETE CASCADE;
        RAISE NOTICE 'attached user_api_keys.user_id foreign key';
    ELSE
        RAISE NOTICE 'users absent or FK present — user_id left unconstrained';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS apikeys_user_idx
    ON pgmonitoringtool.user_api_keys (user_id);

-- authenticateApiKey() looks the key up by hash on every X-API-Key request, so
-- this one is on the hot path. Unique because a hash collision would let one
-- key authenticate as another user.
CREATE UNIQUE INDEX IF NOT EXISTS apikeys_hash_unique
    ON pgmonitoringtool.user_api_keys (key_hash);

CREATE INDEX IF NOT EXISTS apikeys_active_idx
    ON pgmonitoringtool.user_api_keys (status, created_at DESC)
    WHERE status = 'active';

COMMIT;

-- ── Verify ───────────────────────────────────────────────────────────────────
--   npm run sql -- scripts/inspect-step1.sql
--
-- Then, in the app:
--   • Perform any admin action → audit_log should gain a row (it has had none).
--   • Admin → API Keys → create one → the X-API-Key request should stop 401ing.
--
-- Still outstanding after this (tracked in DB_STATE_AND_PLAN.md):
--   • ~55 tables from the newer generation remain absent — SAML, SCIM,
--     workspace RBAC, dashboards, workbooks, query history, OTLP ingest.
--   • Migration 0000 describes a schema that has never existed anywhere; the
--     honest baseline is a dump of live DDL, not a replay of 0000.
