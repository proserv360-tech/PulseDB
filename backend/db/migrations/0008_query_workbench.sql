-- 0008_query_workbench.sql ────────────────────────────────────────────────────
-- Query workbench tables: saved queries, history, snippets, and session tabs.
--
-- saved_queries: Team-saved SQL queries with metadata and favorites.
-- query_history: Audit log of executed queries with timing/status.
-- query_snippets: Reusable SQL chunks ("users_by_region" → snippet body).
-- query_sessions: Multi-tab state per user (one row per tab in the editor).

CREATE TABLE IF NOT EXISTS pgmonitoringtool.saved_queries (
    id              SERIAL PRIMARY KEY,
    workspace_id    INTEGER NOT NULL
        REFERENCES pgmonitoringtool.workspaces(id) ON DELETE CASCADE,
    connection_id   TEXT NOT NULL,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    sql             TEXT NOT NULL,
    tags            TEXT[] DEFAULT '{}',
    is_favorite     BOOLEAN DEFAULT false,
    created_by      INTEGER
        REFERENCES pgmonitoringtool.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, name, connection_id)
);

CREATE INDEX IF NOT EXISTS saved_queries_workspace_idx
    ON pgmonitoringtool.saved_queries(workspace_id);

CREATE INDEX IF NOT EXISTS saved_queries_favorite_idx
    ON pgmonitoringtool.saved_queries(workspace_id, is_favorite)
    WHERE is_favorite = true;

CREATE TABLE IF NOT EXISTS pgmonitoringtool.query_history (
    id              BIGSERIAL PRIMARY KEY,
    workspace_id    INTEGER NOT NULL
        REFERENCES pgmonitoringtool.workspaces(id) ON DELETE CASCADE,
    connection_id   TEXT NOT NULL,
    executed_by     INTEGER
        REFERENCES pgmonitoringtool.users(id) ON DELETE SET NULL,
    sql             TEXT NOT NULL,
    row_count       INTEGER,
    duration_ms     INTEGER,
    status          VARCHAR(16) NOT NULL DEFAULT 'ok'
        CHECK (status IN ('ok', 'error')),
    error           TEXT,
    executed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS query_history_workspace_time_idx
    ON pgmonitoringtool.query_history(workspace_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS query_history_connection_time_idx
    ON pgmonitoringtool.query_history(workspace_id, connection_id, executed_at DESC);

CREATE TABLE IF NOT EXISTS pgmonitoringtool.query_snippets (
    id              SERIAL PRIMARY KEY,
    workspace_id    INTEGER NOT NULL
        REFERENCES pgmonitoringtool.workspaces(id) ON DELETE CASCADE,
    shortcut        VARCHAR(40) NOT NULL,
    body            TEXT NOT NULL,
    description     TEXT,
    created_by      INTEGER
        REFERENCES pgmonitoringtool.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, shortcut)
);

CREATE INDEX IF NOT EXISTS query_snippets_workspace_idx
    ON pgmonitoringtool.query_snippets(workspace_id);

CREATE TABLE IF NOT EXISTS pgmonitoringtool.query_sessions (
    id              SERIAL PRIMARY KEY,
    workspace_id    INTEGER NOT NULL
        REFERENCES pgmonitoringtool.workspaces(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL
        REFERENCES pgmonitoringtool.users(id) ON DELETE CASCADE,
    connection_id   TEXT NOT NULL,
    tab_index       INTEGER NOT NULL,
    title           VARCHAR(120),
    sql             TEXT,
    cursor_pos      INTEGER DEFAULT 0,
    is_pinned       BOOLEAN DEFAULT false,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, user_id, tab_index)
);

CREATE INDEX IF NOT EXISTS query_sessions_user_idx
    ON pgmonitoringtool.query_sessions(workspace_id, user_id);
