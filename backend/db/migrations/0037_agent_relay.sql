-- 0037_agent_relay.sql
-- ---------------------------------------------------------------------------
-- PulseDB Agent relay: lets a cloud deployment work with databases it cannot
-- reach (a SQL Server on someone's PC or LAN). The agent runs next to the
-- database, keeps its credentials locally, and talks to PulseDB outbound only:
--
--   PulseDB ── INSERT agent_jobs ──► agent claims (POST /api/agent/jobs/claim)
--           ◄─ UPDATE result ───────  agent runs it locally, posts the result
--
-- Postgres is the broker so it works on serverless hosts (no long-lived
-- sockets between PulseDB instances and the agent). Jobs are short-lived:
-- the requester deletes a job once it has read the result.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pgmonitoringtool.agent_jobs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id      INTEGER     NOT NULL REFERENCES pgmonitoringtool.sdk_applications(id) ON DELETE CASCADE,
    target      TEXT        NOT NULL,
    op          TEXT        NOT NULL,              -- 'ping' | 'query'
    payload     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    status      TEXT        NOT NULL DEFAULT 'queued',  -- queued | running | done | error
    result      JSONB,
    error       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    claimed_at  TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_agent_jobs_queue
    ON pgmonitoringtool.agent_jobs (app_id, status, created_at);
--> statement-breakpoint

-- A connection served by an agent: which agent (SDK application) and which of
-- its locally configured targets. Host/port are informational for these rows.
ALTER TABLE pgmonitoringtool.pulsedb_connections
    ADD COLUMN IF NOT EXISTS agent_app_id INTEGER
        REFERENCES pgmonitoringtool.sdk_applications(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS agent_target TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS pulsedb_connections_agent_target_key
    ON pgmonitoringtool.pulsedb_connections (agent_app_id, agent_target)
    WHERE agent_app_id IS NOT NULL;
