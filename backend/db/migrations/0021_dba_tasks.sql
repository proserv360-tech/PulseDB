-- 0021_dba_tasks.sql
-- Persistent store for the DBA Task Scheduler (audit M-2).
-- Previously these tasks lived in an in-memory Map, which is lost between
-- Vercel serverless invocations and not shared across instances. This table
-- makes the scheduler durable and multi-instance safe.

CREATE SCHEMA IF NOT EXISTS pgmonitoringtool;

CREATE TABLE IF NOT EXISTS pgmonitoringtool.dba_tasks (
    id           BIGSERIAL    PRIMARY KEY,
    title        TEXT         NOT NULL,
    category     TEXT         NOT NULL DEFAULT 'Daily',
    priority     TEXT         NOT NULL DEFAULT 'medium',
    recurrence   TEXT         NOT NULL DEFAULT 'daily',
    notes        TEXT         NOT NULL DEFAULT '',
    due_date     TIMESTAMPTZ,
    assignee     TEXT         NOT NULL DEFAULT '',
    done         BOOLEAN      NOT NULL DEFAULT FALSE,
    is_default   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS dba_tasks_category_idx ON pgmonitoringtool.dba_tasks (category);
CREATE INDEX IF NOT EXISTS dba_tasks_done_idx     ON pgmonitoringtool.dba_tasks (done);
