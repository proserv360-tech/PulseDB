-- 0020_otel_metrics.sql ─────────────────────────────────────────────────────────
-- OpenTelemetry metrics ingestion store.
--
-- otelService.js writes/reads pgmonitoringtool.otel_metrics, but no prior
-- migration created the table — producing the runtime error:
--   relation "pgmonitoringtool.otel_metrics" does not exist
-- This migration creates it with the columns and access patterns the service uses.

CREATE SCHEMA IF NOT EXISTS pgmonitoringtool;

CREATE TABLE IF NOT EXISTS pgmonitoringtool.otel_metrics (
    id          BIGSERIAL    PRIMARY KEY,
    name        TEXT         NOT NULL,
    value       DOUBLE PRECISION NOT NULL,
    timestamp   TIMESTAMPTZ  NOT NULL,
    labels      JSONB        NOT NULL DEFAULT '{}',
    resource    JSONB        NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- queryMetrics() / getMetricStats() order by timestamp DESC and filter by name + time range
CREATE INDEX IF NOT EXISTS otel_metrics_name_ts_idx
    ON pgmonitoringtool.otel_metrics (name, timestamp DESC);

CREATE INDEX IF NOT EXISTS otel_metrics_ts_idx
    ON pgmonitoringtool.otel_metrics (timestamp DESC);

-- queryMetrics() supports labels @> $n::jsonb containment filters
CREATE INDEX IF NOT EXISTS otel_metrics_labels_gin
    ON pgmonitoringtool.otel_metrics USING GIN (labels);

-- getServiceMap() reads resource->>'service.name'
CREATE INDEX IF NOT EXISTS otel_metrics_resource_gin
    ON pgmonitoringtool.otel_metrics USING GIN (resource);
