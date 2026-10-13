-- 0033_missing_tables.sql ────────────────────────────────────────────────────
-- Creates four tables that application code has always read and written but
-- that no migration has ever created.
--
-- Each failed the same silent way the incidents table did: the query throws,
-- a catch turns it into a 500 or an empty list, and the feature looks merely
-- unused rather than broken. The worst of them is password reset — you find
-- out about that from a locked-out user.
--
-- Columns are derived from the queries that use them, not invented:
--   password_reset_tokens  server.ts forgot-password / reset-password
--   user_feedback          routes/feedbackRoutes.ts
--   vacuum_snapshots       routes/bloatRoutes.ts (dead-tuple timeline)
--   database_connections   services/terraformService.ts (HCL export)
--
-- ADDITIVE and IDEMPOTENT. Safe to re-run.
--
--   ⚠ DO NOT APPLY VIA `npm run migrate` — schema_migrations does not exist.
--
--     npm run sql -- db/migrations/0033_missing_tables.sql

BEGIN;

CREATE SCHEMA IF NOT EXISTS pgmonitoringtool;

-- ── 1. password_reset_tokens ─────────────────────────────────────────────────
-- server.ts inserts (user_id, token, expires_at) and selects on
-- `token = $1 AND used = false`, then flips `used`.
--
-- `token` is the raw secret sent by email. Stored as-is because the reset
-- endpoint looks it up directly; that is a weaker design than storing a hash
-- (anyone with read access to this table can reset any account inside the
-- validity window) but changing it means changing the lookup, which is a
-- behavioural change rather than a missing table. Mitigated here by the
-- retention sweep below and a short default expiry set by the caller.
CREATE TABLE IF NOT EXISTS pgmonitoringtool.password_reset_tokens (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER     NOT NULL,
    token       TEXT        NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used        BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique so a token can never match two rows, and because the lookup is by
-- token alone — a duplicate would make the reset non-deterministic.
CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_token_uniq
    ON pgmonitoringtool.password_reset_tokens (token);

-- Partial: the only rows ever queried are unused ones.
CREATE INDEX IF NOT EXISTS password_reset_tokens_live_idx
    ON pgmonitoringtool.password_reset_tokens (user_id, expires_at)
    WHERE used = false;

DO $$
BEGIN
    IF to_regclass('pgmonitoringtool.users') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'password_reset_tokens_user_fk')
    THEN
        ALTER TABLE pgmonitoringtool.password_reset_tokens
            ADD CONSTRAINT password_reset_tokens_user_fk
            FOREIGN KEY (user_id) REFERENCES pgmonitoringtool.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ── 2. user_feedback ─────────────────────────────────────────────────────────
-- feedbackRoutes inserts all ten columns and later updates `status`.
-- `username` rather than user_id: that is what the route writes and filters on.
CREATE TABLE IF NOT EXISTS pgmonitoringtool.user_feedback (
    id               SERIAL PRIMARY KEY,
    username         VARCHAR(120) NOT NULL,
    feedback_type    VARCHAR(40)  NOT NULL,
    rating           INTEGER      CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
    comment          TEXT,
    remarks          TEXT,
    section          VARCHAR(120),
    feature_title    TEXT,
    feature_priority VARCHAR(20),
    status           VARCHAR(20)  NOT NULL DEFAULT 'new',
    user_metadata    JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Both list queries order by created_at DESC; the "mine" view filters on
-- username first.
CREATE INDEX IF NOT EXISTS user_feedback_created_idx
    ON pgmonitoringtool.user_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS user_feedback_user_idx
    ON pgmonitoringtool.user_feedback (username, created_at DESC);
CREATE INDEX IF NOT EXISTS user_feedback_status_idx
    ON pgmonitoringtool.user_feedback (status)
    WHERE status <> 'closed';

-- ── 3. vacuum_snapshots ──────────────────────────────────────────────────────
-- bloatRoutes builds a dead-tuple timeline from this: it groups by
-- date_trunc('day', captured_at), filters on (schemaname, relname), and uses
-- a window function over captured_at to count autovacuum events.
--
-- Nothing writes it yet. That is deliberate — the reader is real and was
-- failing, and a table that exists and is empty produces an honest empty
-- timeline instead of a swallowed error. Populating it is a collector change.
CREATE TABLE IF NOT EXISTS pgmonitoringtool.vacuum_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    connection_id   INTEGER,
    schemaname      TEXT        NOT NULL,
    relname         TEXT        NOT NULL,
    n_dead_tup      BIGINT      NOT NULL DEFAULT 0,
    n_live_tup      BIGINT      NOT NULL DEFAULT 0,
    last_autovacuum TIMESTAMPTZ,
    last_autoanalyze TIMESTAMPTZ,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Matches the query's filter and its ORDER BY captured_at inside the window.
CREATE INDEX IF NOT EXISTS vacuum_snapshots_table_time_idx
    ON pgmonitoringtool.vacuum_snapshots (schemaname, relname, captured_at DESC);

-- ── 4. database_connections ──────────────────────────────────────────────────
-- terraformService exports HCL from this. Distinct from fathom_connections:
-- that one is the live monitored-connection registry keyed to a user; this is
-- the org-scoped declarative inventory the Terraform export describes. The
-- export deliberately never reads a password — it emits a tfvars reference.
CREATE TABLE IF NOT EXISTS pgmonitoringtool.database_connections (
    id            SERIAL PRIMARY KEY,
    org_id        INTEGER,
    name          VARCHAR(200) NOT NULL,
    host          TEXT         NOT NULL,
    port          INTEGER      NOT NULL DEFAULT 5432,
    database_name TEXT         NOT NULL,
    username      TEXT,
    enabled       BOOLEAN      NOT NULL DEFAULT true,
    metadata      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS database_connections_org_name_uniq
    ON pgmonitoringtool.database_connections (COALESCE(org_id, 0), name);

-- ── Housekeeping ─────────────────────────────────────────────────────────────
-- Reset tokens are single-use secrets with an expiry; keeping spent ones
-- forever is a liability with no benefit. Retention sweeps can call this, and
-- it is safe to run by hand.
CREATE OR REPLACE FUNCTION pgmonitoringtool.purge_expired_reset_tokens()
RETURNS integer AS $$
DECLARE
    removed integer;
BEGIN
    DELETE FROM pgmonitoringtool.password_reset_tokens
     WHERE used = true OR expires_at < now() - interval '1 day';
    GET DIAGNOSTICS removed = ROW_COUNT;
    RETURN removed;
END;
$$ LANGUAGE plpgsql;

COMMIT;
