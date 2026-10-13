-- 0011_wait_events.sql ──────────────────────────────────────────────────────
-- A3: Postgres wait-event sampling.
--
-- Closes the largest analytics gap versus Datadog DBM and Percona PMM 2026.
-- Background sampler polls pg_stat_activity at 1 Hz (default) and writes one
-- row per non-idle backend per sample. A separate 5-minute rollup table
-- aggregates the raw samples into wait-class buckets for long-term storage
-- and dashboard reads.
--
-- Retention:
--   wait_event_samples       — 24 hours.  Pruned by retentionService.
--   wait_event_rollups_5m    — 14 days.   Pruned by retentionService.
--
-- This migration is idempotent: re-applying it is a no-op (IF NOT EXISTS
-- everywhere). Safe to run with FATHOM_INITIAL_SETUP unset.

CREATE TABLE IF NOT EXISTS pgmonitoringtool.wait_event_samples (
    connection_id    UUID         NOT NULL,
    sampled_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    pid              INTEGER      NOT NULL,
    state            TEXT,
    wait_event_type  TEXT,                          -- NULL when on-cpu
    wait_event       TEXT,
    query_id         BIGINT,
    backend_type     TEXT,
    application_name TEXT
);

CREATE INDEX IF NOT EXISTS wait_event_samples_conn_time_idx
    ON pgmonitoringtool.wait_event_samples (connection_id, sampled_at DESC);

CREATE TABLE IF NOT EXISTS pgmonitoringtool.wait_event_rollups_5m (
    connection_id  UUID         NOT NULL,
    bucket_start   TIMESTAMPTZ  NOT NULL,
    wait_class     TEXT         NOT NULL,        -- 'CPU'|'IO'|'Lock'|'IPC'|'Client'|'BufferPin'|'Activity'|'Other'
    sample_count   INTEGER      NOT NULL DEFAULT 0,
    PRIMARY KEY (connection_id, bucket_start, wait_class)
);

CREATE INDEX IF NOT EXISTS wait_event_rollups_5m_conn_time_idx
    ON pgmonitoringtool.wait_event_rollups_5m (connection_id, bucket_start DESC);

-- Retention is enforced in code by retentionService — see
-- backend/services/retentionService.js (extended for wait_event_* in A3).
