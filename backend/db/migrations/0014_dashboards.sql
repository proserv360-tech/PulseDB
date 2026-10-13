-- 0014_dashboards.sql — B7 user-built dashboards.

CREATE TABLE IF NOT EXISTS pgmonitoringtool.dashboards (
    id           SERIAL PRIMARY KEY,
    workspace_id INTEGER     NOT NULL,
    created_by   INTEGER,
    name         TEXT        NOT NULL,
    description  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dashboards_ws_idx ON pgmonitoringtool.dashboards (workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS pgmonitoringtool.dashboard_panels (
    id           SERIAL PRIMARY KEY,
    dashboard_id INTEGER     NOT NULL REFERENCES pgmonitoringtool.dashboards(id) ON DELETE CASCADE,
    title        TEXT        NOT NULL,
    position     JSONB       NOT NULL,   -- { x, y, w, h }
    spec         JSONB       NOT NULL,   -- { metricId, chartType, rangeMin, options }
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dashboard_panels_dash_idx ON pgmonitoringtool.dashboard_panels (dashboard_id);

CREATE TABLE IF NOT EXISTS pgmonitoringtool.dashboard_shares (
    dashboard_id INTEGER     NOT NULL REFERENCES pgmonitoringtool.dashboards(id) ON DELETE CASCADE,
    workspace_id INTEGER     NOT NULL,
    role         TEXT        NOT NULL DEFAULT 'viewer',  -- viewer | editor
    PRIMARY KEY (dashboard_id, workspace_id)
);
