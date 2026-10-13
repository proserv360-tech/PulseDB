-- 0018_agent_ingest.sql — C1 agent ingest tables.
--
-- The wait-event ingest from the agent reuses the existing
-- wait_event_samples table (migration 0011), so this migration only
-- adds the new agent_query_stats blob store.

CREATE TABLE IF NOT EXISTS pgmonitoringtool.agent_query_stats (
    id            BIGSERIAL PRIMARY KEY,
    connection_id UUID        NOT NULL,
    captured_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    snapshot      JSONB       NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_query_stats_conn_time_idx
    ON pgmonitoringtool.agent_query_stats (connection_id, captured_at DESC);
