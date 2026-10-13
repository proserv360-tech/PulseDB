-- 0006_otlp_traces.sql ─────────────────────────────────────────────────────────
-- OpenTelemetry span and trace storage for distributed tracing.
--
-- otlp_traces: Aggregate trace records (one per traceId per org)
-- otlp_spans: Individual spans within a trace
-- otlp_trace_settings: Per-org trace ingestion and retention configuration

CREATE TABLE IF NOT EXISTS pgmonitoringtool.otlp_traces (
    trace_id           BYTEA PRIMARY KEY,
    org_id             INTEGER NOT NULL
        REFERENCES pgmonitoringtool.organizations(id) ON DELETE CASCADE,
    root_span_id       BYTEA,
    service_name       TEXT,
    start_time         TIMESTAMPTZ,
    end_time           TIMESTAMPTZ,
    duration_ms        DOUBLE PRECISION,
    span_count         INTEGER,
    error_count        INTEGER,
    status             TEXT CHECK (status IN ('ok', 'error', 'unset')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS otlp_traces_org_start_idx
    ON pgmonitoringtool.otlp_traces(org_id, start_time DESC);

CREATE INDEX IF NOT EXISTS otlp_traces_service_idx
    ON pgmonitoringtool.otlp_traces(service_name, start_time DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- otlp_spans: individual spans with full context and attributes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pgmonitoringtool.otlp_spans (
    span_id             BYTEA NOT NULL,
    trace_id            BYTEA NOT NULL,
    parent_span_id      BYTEA,
    org_id              INTEGER NOT NULL,
    service_name        TEXT,
    operation_name      TEXT,
    span_kind           TEXT,
    start_time          TIMESTAMPTZ,
    end_time            TIMESTAMPTZ,
    duration_ms         DOUBLE PRECISION,
    status_code         TEXT,
    status_message      TEXT,
    attributes          JSONB DEFAULT '{}',
    resource_attributes JSONB DEFAULT '{}',
    events              JSONB DEFAULT '[]',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (trace_id, span_id),
    CONSTRAINT otlp_spans_trace_fk
        FOREIGN KEY (trace_id)
        REFERENCES pgmonitoringtool.otlp_traces(trace_id)
        ON DELETE CASCADE,
    CONSTRAINT otlp_spans_org_fk
        FOREIGN KEY (org_id)
        REFERENCES pgmonitoringtool.organizations(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS otlp_spans_org_start_idx
    ON pgmonitoringtool.otlp_spans(org_id, start_time DESC);

CREATE INDEX IF NOT EXISTS otlp_spans_service_start_idx
    ON pgmonitoringtool.otlp_spans(service_name, start_time DESC);

CREATE INDEX IF NOT EXISTS otlp_spans_operation_idx
    ON pgmonitoringtool.otlp_spans(operation_name);

CREATE INDEX IF NOT EXISTS otlp_spans_attributes_gin
    ON pgmonitoringtool.otlp_spans USING GIN (attributes);

CREATE INDEX IF NOT EXISTS otlp_spans_trace_idx
    ON pgmonitoringtool.otlp_spans(trace_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- otlp_trace_settings: per-org configuration
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pgmonitoringtool.otlp_trace_settings (
    org_id                  INTEGER PRIMARY KEY
        REFERENCES pgmonitoringtool.organizations(id) ON DELETE CASCADE,
    sampling_rate           DOUBLE PRECISION DEFAULT 1.0
        CHECK (sampling_rate BETWEEN 0 AND 1),
    retention_days          INTEGER DEFAULT 7
        CHECK (retention_days BETWEEN 1 AND 90),
    max_spans_per_trace     INTEGER DEFAULT 2000,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS otlp_trace_settings_updated_idx
    ON pgmonitoringtool.otlp_trace_settings(updated_at DESC);
