-- ─────────────────────────────────────────────────────────────────────────
-- 0010_observability_ingest.sql
--
-- Adds storage for the observability "long tail": application logs, error
-- events, RUM beacons, ingested metrics, deploy markers, and synthetic-check
-- configurations + results.
--
-- Design notes:
--   • Every table uses a BIGSERIAL id for FK clarity.
--   • `ts` columns are TIMESTAMPTZ with an index for time-ordered reads.
--   • JSON attributes are stored as JSONB so PK/JIT queries can project into
--     them without runtime reparsing.
--   • No FKs to other tenant tables — ingest paths must not hard-fail when a
--     workspace is being migrated.
-- ─────────────────────────────────────────────────────────────────────────

SET search_path = pgmonitoringtool, public;

-- ── OTLP logs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otel_logs (
    id               BIGSERIAL PRIMARY KEY,
    ts               TIMESTAMPTZ NOT NULL DEFAULT now(),
    severity_number  INT          NOT NULL DEFAULT 0,
    severity_text    TEXT,
    body             TEXT,
    trace_id         TEXT,
    span_id          TEXT,
    resource_attrs   JSONB DEFAULT '{}'::jsonb,
    log_attrs        JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_otel_logs_ts       ON otel_logs (ts DESC);
CREATE INDEX IF NOT EXISTS idx_otel_logs_severity ON otel_logs (severity_number);
CREATE INDEX IF NOT EXISTS idx_otel_logs_trace    ON otel_logs (trace_id) WHERE trace_id IS NOT NULL;

-- ── Error events ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS error_events (
    id            BIGSERIAL PRIMARY KEY,
    event_id      TEXT UNIQUE NOT NULL,
    ts            TIMESTAMPTZ NOT NULL DEFAULT now(),
    message       TEXT,
    level         TEXT,
    environment   TEXT,
    release_tag   TEXT,
    exception     JSONB,
    stack_trace   JSONB,
    user_ctx      JSONB,
    request_ctx   JSONB,
    tags          JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_error_events_ts    ON error_events (ts DESC);
CREATE INDEX IF NOT EXISTS idx_error_events_env   ON error_events (environment);
CREATE INDEX IF NOT EXISTS idx_error_events_level ON error_events (level);

-- ── RUM beacons (Core Web Vitals + nav timing) ────────────────────────────
CREATE TABLE IF NOT EXISTS rum_events (
    id          BIGSERIAL PRIMARY KEY,
    session_id  TEXT,
    page_url    TEXT,
    referrer    TEXT,
    user_agent  TEXT,
    ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
    nav_type    TEXT,
    lcp_ms      DOUBLE PRECISION,
    fid_ms      DOUBLE PRECISION,
    cls         DOUBLE PRECISION,
    inp_ms      DOUBLE PRECISION,
    ttfb_ms     DOUBLE PRECISION,
    custom      JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_rum_events_ts      ON rum_events (ts DESC);
CREATE INDEX IF NOT EXISTS idx_rum_events_session ON rum_events (session_id);

-- ── Ingested Prometheus-style metrics ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingested_metrics (
    id      BIGSERIAL PRIMARY KEY,
    name    TEXT NOT NULL,
    labels  JSONB DEFAULT '{}'::jsonb,
    ts      TIMESTAMPTZ NOT NULL DEFAULT now(),
    value   DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ingested_metrics_name_ts ON ingested_metrics (name, ts DESC);

-- ── Deploy markers (GitHub / GitLab webhooks) ─────────────────────────────
CREATE TABLE IF NOT EXISTS deploy_markers (
    id          BIGSERIAL PRIMARY KEY,
    provider    TEXT NOT NULL,     -- 'github' | 'gitlab'
    event_type  TEXT NOT NULL,     -- 'deployment' | 'push' | 'release' | …
    ref         TEXT,
    sha         TEXT,
    actor       TEXT,
    environment TEXT,
    repo        TEXT,
    url         TEXT,
    ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
    payload     JSONB
);
CREATE INDEX IF NOT EXISTS idx_deploy_markers_ts  ON deploy_markers (ts DESC);
CREATE INDEX IF NOT EXISTS idx_deploy_markers_env ON deploy_markers (environment);

-- ── Synthetic monitoring ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS synthetic_checks (
    id              BIGSERIAL PRIMARY KEY,
    workspace_id    UUID,
    name            TEXT NOT NULL,
    kind            TEXT NOT NULL DEFAULT 'http',   -- 'http' | 'tcp'
    target          TEXT NOT NULL,                   -- URL or host:port
    method          TEXT DEFAULT 'GET',
    headers         JSONB DEFAULT '{}'::jsonb,
    body            TEXT,
    expected_status INT  DEFAULT 200,
    timeout_ms      INT  DEFAULT 10000,
    interval_sec    INT  DEFAULT 60,
    enabled         BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_synthetic_checks_enabled ON synthetic_checks (enabled);

CREATE TABLE IF NOT EXISTS synthetic_results (
    id           BIGSERIAL PRIMARY KEY,
    check_id     BIGINT NOT NULL REFERENCES synthetic_checks(id) ON DELETE CASCADE,
    ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
    ok           BOOLEAN NOT NULL,
    status_code  INT,
    latency_ms   DOUBLE PRECISION,
    error        TEXT,
    body_excerpt TEXT
);
CREATE INDEX IF NOT EXISTS idx_synthetic_results_check_ts
    ON synthetic_results (check_id, ts DESC);

-- ── KMS-wrapped tenant keys (BYOK) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_keys (
    id              BIGSERIAL PRIMARY KEY,
    workspace_id    UUID NOT NULL,
    kms_backend     TEXT NOT NULL,      -- 'aws-kms' | 'gcp-kms' | 'azure-kv' | 'vault' | 'local'
    kms_key_id      TEXT,
    wrapped_dek     BYTEA NOT NULL,     -- wrapped data-encryption key
    version         INT  NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT now(),
    rotated_from_id BIGINT REFERENCES tenant_keys(id),
    retired_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tenant_keys_ws ON tenant_keys (workspace_id, version DESC);
