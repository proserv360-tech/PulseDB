-- 0012_clusters.sql ─────────────────────────────────────────────────────────
-- B2: Postgres cluster grouping for cluster-aware index advisor.
--
-- A "cluster" is a primary + N replicas that share a workload. The advisor
-- needs to know about all members so it can decide that an index unused on
-- the primary is still kept if it's used by the replica (read-only replica
-- query patterns).
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS pgmonitoringtool.connection_clusters (
    id            SERIAL PRIMARY KEY,
    workspace_id  INTEGER     NOT NULL,
    name          TEXT        NOT NULL,
    description   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS pgmonitoringtool.connection_cluster_members (
    cluster_id    INTEGER NOT NULL REFERENCES pgmonitoringtool.connection_clusters(id) ON DELETE CASCADE,
    connection_id INTEGER NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'replica',  -- 'primary' | 'replica'
    PRIMARY KEY (cluster_id, connection_id)
);

CREATE INDEX IF NOT EXISTS connection_cluster_members_conn_idx
    ON pgmonitoringtool.connection_cluster_members (connection_id);
