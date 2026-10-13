-- 0013_workbooks.sql — B3 query-rewrite workbench (A/B EXPLAIN).
--
-- Operators record a baseline query and one or more rewrite variants,
-- then run each variant against the same connection. Each run captures
-- the EXPLAIN (ANALYZE) plan + wall-clock for side-by-side comparison.
--
-- Read-only mode is enforced in code (workbookService.runVariants) by
-- reusing copilot's isSafeToRun() check.

CREATE TABLE IF NOT EXISTS pgmonitoringtool.workbooks (
    id            SERIAL PRIMARY KEY,
    workspace_id  INTEGER     NOT NULL,
    created_by    INTEGER,
    connection_id INTEGER     NOT NULL,
    description   TEXT,
    base_query    TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workbooks_ws_idx ON pgmonitoringtool.workbooks (workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS pgmonitoringtool.workbook_variants (
    id           SERIAL PRIMARY KEY,
    workbook_id  INTEGER     NOT NULL REFERENCES pgmonitoringtool.workbooks(id) ON DELETE CASCADE,
    label        TEXT        NOT NULL,
    sql          TEXT        NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workbook_variants_wb_idx ON pgmonitoringtool.workbook_variants (workbook_id);

CREATE TABLE IF NOT EXISTS pgmonitoringtool.workbook_runs (
    id           SERIAL PRIMARY KEY,
    workbook_id  INTEGER     NOT NULL REFERENCES pgmonitoringtool.workbooks(id) ON DELETE CASCADE,
    variant_id   INTEGER     REFERENCES pgmonitoringtool.workbook_variants(id) ON DELETE CASCADE, -- NULL = baseline run
    ran_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_ms  NUMERIC,
    plan_json    JSONB,
    error        TEXT
);
CREATE INDEX IF NOT EXISTS workbook_runs_wb_idx ON pgmonitoringtool.workbook_runs (workbook_id, ran_at DESC);
