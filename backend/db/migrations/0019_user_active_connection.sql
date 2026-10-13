-- 0019_user_active_connection.sql
-- Persist per-user active connection so backend restarts (Railway redeploy,
-- Vercel cold start) don't leave users stuck on "Connecting…" after re-login.
--
-- Why a side table: pgmonitoringtool.users is the global identity row;
-- "active connection" is a workspace-scoped UI state that wants to live
-- next to the user but not modify the auth table.

CREATE TABLE IF NOT EXISTS pgmonitoringtool.user_active_connection (
    user_id          INTEGER PRIMARY KEY,
    connection_id    INTEGER NOT NULL,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_active_connection_conn_idx
    ON pgmonitoringtool.user_active_connection (connection_id);
