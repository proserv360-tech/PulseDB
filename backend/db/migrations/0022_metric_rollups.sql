-- 0022_metric_rollups.sql ───────────────────────────────────────────────────
-- Tiered metric rollups (B-3). Long-term history at lower resolution instead of
-- deletion. Populated incrementally by services/metricRollupService.ts from
-- pgmonitoringtool.otel_metrics.
--
--   raw (otel_metrics) → hourly (metric_rollups_1h) → daily (metric_rollups_1d)

CREATE SCHEMA IF NOT EXISTS pgmonitoringtool;

CREATE TABLE IF NOT EXISTS pgmonitoringtool.metric_rollups_1h (
    name    TEXT             NOT NULL,
    bucket  TIMESTAMPTZ      NOT NULL,
    samples BIGINT           NOT NULL,
    sum     DOUBLE PRECISION NOT NULL,
    min     DOUBLE PRECISION NOT NULL,
    max     DOUBLE PRECISION NOT NULL,
    avg     DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (name, bucket)
);
CREATE INDEX IF NOT EXISTS metric_rollups_1h_bucket_idx
    ON pgmonitoringtool.metric_rollups_1h (bucket DESC);

CREATE TABLE IF NOT EXISTS pgmonitoringtool.metric_rollups_1d (
    name    TEXT             NOT NULL,
    bucket  TIMESTAMPTZ      NOT NULL,
    samples BIGINT           NOT NULL,
    sum     DOUBLE PRECISION NOT NULL,
    min     DOUBLE PRECISION NOT NULL,
    max     DOUBLE PRECISION NOT NULL,
    avg     DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (name, bucket)
);
CREATE INDEX IF NOT EXISTS metric_rollups_1d_bucket_idx
    ON pgmonitoringtool.metric_rollups_1d (bucket DESC);
