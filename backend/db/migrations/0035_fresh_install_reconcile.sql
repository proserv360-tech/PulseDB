-- 0035_fresh_install_reconcile.sql
-- ---------------------------------------------------------------------------
-- Makes a database built purely from db/migrations match what the code writes.
--
-- 0000 describes a newer generation of three tables than the one the code (and
-- every deployed database) actually uses. A fresh install therefore broke on:
--   * users                — no must_change_password / password_changed_at, so
--                            login always demanded a password change and the
--                            change itself then failed on the missing column.
--   * pulsedb_connections  — 0000's shape (password_encrypted, color, ...) lacks
--                            the columns core/connectionStore.ts writes, so
--                            saving any connection failed.
--   * sdk_applications / sdk_events — never created by any migration.
--
-- Column definitions are taken from the previously deployed schema
-- (supabase_backup_tool_monitoring/pgmonitoringtool/schema.sql). Everything is
-- IF NOT EXISTS, so this is a no-op on databases that already have them.
-- ---------------------------------------------------------------------------

ALTER TABLE pgmonitoringtool.users
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
--> statement-breakpoint

ALTER TABLE pgmonitoringtool.pulsedb_connections
    ADD COLUMN IF NOT EXISTS password TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS ssh_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS ssh_host TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS ssh_port INTEGER DEFAULT 22,
    ADD COLUMN IF NOT EXISTS ssh_user TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS ssh_auth_type TEXT DEFAULT 'key',
    ADD COLUMN IF NOT EXISTS ssh_private_key TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS ssh_passphrase TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS ssh_password TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS status TEXT,
    ADD COLUMN IF NOT EXISTS last_tested TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS db_type TEXT DEFAULT 'postgresql';
--> statement-breakpoint

-- Connection names are unique per user in every deployed schema.
CREATE UNIQUE INDEX IF NOT EXISTS pulsedb_connections_user_name_key
    ON pgmonitoringtool.pulsedb_connections (user_id, name);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS pgmonitoringtool.sdk_applications (
    id                SERIAL PRIMARY KEY,
    name              TEXT NOT NULL,
    app_type          TEXT DEFAULT 'custom',
    environment       TEXT DEFAULT 'production',
    api_key_hash      TEXT NOT NULL UNIQUE,
    api_key_prefix    TEXT NOT NULL,
    status            TEXT DEFAULT 'active',
    config            JSONB DEFAULT '{}'::jsonb,
    last_heartbeat_at TIMESTAMPTZ,
    created_by        INTEGER REFERENCES pgmonitoringtool.users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_sdk_apps_key ON pgmonitoringtool.sdk_applications (api_key_hash);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_sdk_apps_status ON pgmonitoringtool.sdk_applications (status);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS pgmonitoringtool.sdk_events (
    id          BIGSERIAL PRIMARY KEY,
    app_id      INTEGER NOT NULL REFERENCES pgmonitoringtool.sdk_applications(id) ON DELETE CASCADE,
    event_type  TEXT NOT NULL,
    severity    TEXT DEFAULT 'info',
    title       TEXT NOT NULL,
    message     TEXT,
    metadata    JSONB DEFAULT '{}'::jsonb,
    tags        TEXT[] DEFAULT '{}',
    duration_ms INTEGER,
    status_code INTEGER,
    endpoint    TEXT,
    http_method TEXT,
    error_type  TEXT,
    stack_trace TEXT,
    fingerprint TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_sdk_events_app ON pgmonitoringtool.sdk_events (app_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_sdk_events_created ON pgmonitoringtool.sdk_events (created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_sdk_events_fingerprint ON pgmonitoringtool.sdk_events (fingerprint);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_sdk_events_severity ON pgmonitoringtool.sdk_events (severity);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_sdk_events_type ON pgmonitoringtool.sdk_events (event_type);
