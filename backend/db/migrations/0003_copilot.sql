-- 0003_copilot.sql ───────────────────────────────────────────────────────────
-- AI SQL copilot conversation history.
--
-- Turns are kept for replay / audit / future fine-tuning corpus export. Input
-- is capped server-side to 8k chars, output to 16k.
--
-- APPLY ORDER
-- ───────────
-- Migrations in this directory are forward-only and are applied in strict
-- lexicographic (filename-ASC) order by backend/db/migrate.js. This file
-- MUST run after 0001_saml_sso_rbac.sql (which creates pgmonitoringtool.users
-- and pgmonitoringtool.workspaces — the two FK targets below) and BEFORE
-- 0004_security_hardening.sql (which adds copilot_turns.input_redacted). Do
-- not renumber or re-order: the migration runner records filenames verbatim
-- and will refuse to replay an already-applied migration under a new number.

CREATE TABLE IF NOT EXISTS pgmonitoringtool.copilot_turns (
    id            BIGSERIAL PRIMARY KEY,
    workspace_id  BIGINT REFERENCES pgmonitoringtool.workspaces(id) ON DELETE SET NULL,
    user_id       BIGINT REFERENCES pgmonitoringtool.users(id) ON DELETE SET NULL,
    kind          TEXT NOT NULL CHECK (kind IN ('sql','explain','rca')),
    input         TEXT NOT NULL,
    output        TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS copilot_turns_ws_time_idx
    ON pgmonitoringtool.copilot_turns(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS copilot_turns_kind_idx
    ON pgmonitoringtool.copilot_turns(kind);
