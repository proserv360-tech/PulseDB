-- 0017_alert_rca.sql — C5 proactive AI-driven RCA results.
--
-- When an alert fires, the worker tier assembles a context bundle
-- (wait-event burst, top queries, recent OTLP traces, recent deploys),
-- calls copilot's draftIncidentRca(), and writes the result here. The
-- alert detail page surfaces 'Probable cause' from this table.
--
-- One row per (alert_id, signature) — signature is a hash of the
-- assembled context so identical alerts share the LLM cost.

CREATE TABLE IF NOT EXISTS pgmonitoringtool.alert_rca (
    id          BIGSERIAL PRIMARY KEY,
    alert_id    TEXT        NOT NULL,
    signature   TEXT        NOT NULL,
    workspace_id INTEGER,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    context     JSONB       NOT NULL,
    narrative   TEXT,
    provider    TEXT,
    model       TEXT,
    feedback    TEXT,        -- 'up' | 'down' | NULL
    UNIQUE (alert_id, signature)
);

CREATE INDEX IF NOT EXISTS alert_rca_alert_idx
    ON pgmonitoringtool.alert_rca (alert_id, created_at DESC);
