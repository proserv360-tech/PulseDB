-- 0015_backups.sql — B8 backup orchestration scaffold.
--
-- This schema is in-place but the execution layer is gated behind
-- FATHOM_BACKUPS_ENABLED=1. Until that env is set, the UI tab shows the
-- schedules in "preview" state and the orchestrator never runs.
--
-- Real execution arrives once the worker tier (B1) consumes the
-- 'backup.run' queue with pgBackRest / mongodump bindings.

CREATE TABLE IF NOT EXISTS pgmonitoringtool.backup_schedules (
    id            SERIAL PRIMARY KEY,
    workspace_id  INTEGER     NOT NULL,
    connection_id INTEGER     NOT NULL,
    cadence       TEXT        NOT NULL,                 -- hourly | daily | weekly
    target        TEXT        NOT NULL DEFAULT 's3',     -- s3 | local
    target_uri    TEXT,
    enabled       BOOLEAN     NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_run_at   TIMESTAMPTZ,
    UNIQUE (workspace_id, connection_id, cadence)
);

CREATE TABLE IF NOT EXISTS pgmonitoringtool.backup_runs (
    id           SERIAL PRIMARY KEY,
    schedule_id  INTEGER     NOT NULL REFERENCES pgmonitoringtool.backup_schedules(id) ON DELETE CASCADE,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at  TIMESTAMPTZ,
    status       TEXT        NOT NULL DEFAULT 'pending', -- pending | running | succeeded | failed
    artifact_uri TEXT,
    size_bytes   BIGINT,
    error        TEXT
);
CREATE INDEX IF NOT EXISTS backup_runs_schedule_idx
    ON pgmonitoringtool.backup_runs (schedule_id, started_at DESC);
