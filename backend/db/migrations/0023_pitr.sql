-- 0023_pitr.sql — Point-in-time-recovery catalog (B-2).
--
-- base_backups + wal_archive feed services/pitrService.ts, which computes the
-- recoverable window and a restore plan (base backup + WAL replay) for a target
-- timestamp. Execution of pg_basebackup / WAL archiving is driven separately;
-- these tables are the catalog the planner reads.

CREATE SCHEMA IF NOT EXISTS pgmonitoringtool;

CREATE TABLE IF NOT EXISTS pgmonitoringtool.base_backups (
    id            BIGSERIAL   PRIMARY KEY,
    connection_id INTEGER     NOT NULL,
    workspace_id  INTEGER,
    backup_time   TIMESTAMPTZ NOT NULL,             -- consistency point of the base backup
    stop_lsn      TEXT,
    artifact_uri  TEXT,
    size_bytes    BIGINT,
    status        TEXT        NOT NULL DEFAULT 'succeeded',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS base_backups_conn_time_idx
    ON pgmonitoringtool.base_backups (connection_id, backup_time DESC);

CREATE TABLE IF NOT EXISTS pgmonitoringtool.wal_archive (
    id            BIGSERIAL   PRIMARY KEY,
    connection_id INTEGER     NOT NULL,
    segment       TEXT        NOT NULL,             -- WAL file name
    start_lsn     TEXT,
    end_lsn       TEXT,
    start_time    TIMESTAMPTZ NOT NULL,
    end_time      TIMESTAMPTZ NOT NULL,
    size_bytes    BIGINT,
    archived_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (connection_id, segment)
);
CREATE INDEX IF NOT EXISTS wal_archive_conn_time_idx
    ON pgmonitoringtool.wal_archive (connection_id, start_time ASC);
