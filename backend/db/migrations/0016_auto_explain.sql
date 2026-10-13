-- 0016_auto_explain.sql — C6 auto_explain log ingest.
--
-- The Postgres auto_explain extension writes the JSON plan of every
-- statement that exceeds log_min_duration_statement (or the auto_explain
-- threshold) to the server log. A log shipper (Vector / Filebeat / the
-- forthcoming FATHOM agent) parses each entry and POSTs it to
-- /api/auto-explain/ingest. We store the parsed plan alongside the
-- (redacted) SQL text and surface it next to the live "EXPLAIN now"
-- output so the operator sees the plan that actually ran in production.
--
-- Retention: pruned by retentionService (extended for this table in C6).

CREATE TABLE IF NOT EXISTS pgmonitoringtool.auto_explain_events (
    id              BIGSERIAL PRIMARY KEY,
    workspace_id    INTEGER     NOT NULL,
    connection_id   INTEGER     NOT NULL,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_ms     NUMERIC,
    -- The SQL is redacted before insert by the ingest route via
    -- services/copilotService.redact(). Original literals + identifiers
    -- already in the log line are scrubbed by the shipper; we apply our
    -- secrets redaction matrix as belt-and-braces.
    statement       TEXT        NOT NULL,
    query_id        BIGINT,           -- pg_stat_statements normalized id (if available)
    database_name   TEXT,
    user_name       TEXT,
    application     TEXT,
    plan_json       JSONB,
    -- Source labels (host, log file, line) so the operator can grep back
    -- to the raw log if needed.
    source          JSONB
);

CREATE INDEX IF NOT EXISTS auto_explain_events_ws_time_idx
    ON pgmonitoringtool.auto_explain_events (workspace_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS auto_explain_events_conn_time_idx
    ON pgmonitoringtool.auto_explain_events (connection_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS auto_explain_events_query_idx
    ON pgmonitoringtool.auto_explain_events (workspace_id, query_id)
    WHERE query_id IS NOT NULL;
