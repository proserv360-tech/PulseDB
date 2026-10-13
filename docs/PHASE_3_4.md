# FATHOM — Phase 3 + 4 Deliverables

Phase 3 + 4 operationalise section 7 of the strategic roadmap: distributed
tracing plus desktop-grade query-editor features. Everything below is shipped
and tested.

## Phase 3 — Distributed tracing (roadmap 7.1)

### OTLP/HTTP ingest — `POST /api/otlp/v1/traces`

- Accepts the OTLP/HTTP JSON shape (`resourceSpans[].scopeSpans[].spans[]`).
- Authenticated via `X-SDK-Key`; orgs resolved through the existing SDK
  service path.
- Deterministic per-trace sampling (hash of `traceId` vs `sampling_rate`) —
  a trace is either fully sampled or fully dropped, never partial.
- `max_spans_per_trace` caps run-away clients.

### Storage — migration `0006_otlp_traces.sql`

Three tables under `pgmonitoringtool`:

- `otlp_traces` — one row per trace; rollup of duration, span_count,
  error_count, status.
- `otlp_spans` — one row per span; JSONB for attributes, resource
  attributes, and span events; GIN index on attributes.
- `otlp_trace_settings` — per-org sampling + retention.

### Reader API

```
GET  /api/traces                     list traces, keyset-paginated
GET  /api/traces/:traceId            full span tree + orphan attachment
GET  /api/traces/:traceId/pivot      DB queries correlated to this trace
GET  /api/traces/settings            per-org config
PUT  /api/traces/settings            admin only
```

### SDK span APIs

Feature-parity surface across JS, Python, Go. Each ships:

- `startSpan(name, opts)` returning a span with `setAttribute`,
  `recordException`, `end(status)`.
- Language-native context propagation — async-local in JS, `contextvars` in
  Python, `context.Context` in Go — so nested spans auto-parent.
- `injectHeaders(headers)` / `extractContext(headers)` for W3C traceparent
  propagation across service boundaries.
- A dedicated span batcher that targets `/api/otlp/v1/traces` (separate
  from the existing event batcher) and unrefs its flush timer so the
  process exits cleanly in tests and short-lived scripts.

OpenAPI spec extended with `POST /api/otlp/v1/traces` + `OtlpTracesRequest`,
`ResourceSpans`, `ScopeSpans`, `OtlpSpan`, `SpanKind`, `StatusCode` schemas.

### Tests

- Backend: `tests/otlpTraceService.test.js` — **22 tests, 65 assertions,
  all passing**. Covers realistic OTLP payloads, deterministic sampling,
  span-tree assembly with orphan handling, summary aggregation.
- SDKs: 9 JS, 19 Python, 14 Go tracer tests, all passing (Go under
  `-race`).

### Docs

[`backend/docs/TRACING.md`](../backend/docs/TRACING.md).

## Phase 4 — Query workbench (roadmap 7.2)

### Workbench — migration `0008_query_workbench.sql`

Four tables scoped to `workspace_id` (no cross-workspace leakage):

- `saved_queries` — named + tagged + optionally favorited.
- `query_history` — every executed statement with duration, rows, status.
- `query_snippets` — reusable SQL chunks addressed by shortcut.
- `query_sessions` — per-user tab state (title, sql, cursor, pinned).

### Routes — `/workbench/*`

17 endpoints across the four resources, gated by
`requireWorkspaceRole('viewer'|'editor'|'admin')` depending on operation.
Identifier validation on snippet shortcuts (`^[a-z][a-z0-9_]{1,39}$`).
Snippet expansion is a pure helper with an 8-deep recursion limit + cycle
detection — unit-testable without the DB.

### Schema diff — `/schema/*`

Service that snapshots `information_schema` + `pg_catalog` into a
deterministic JSON shape, diffs two snapshots, and generates a best-effort
migration script wrapped in a single `BEGIN/COMMIT`. Handles tables,
columns, primary keys, indexes (`CREATE INDEX CONCURRENTLY`), foreign
keys, views, sequences, and enum additions. Enum removals emit a warning
(Postgres limitation). Type changes emit `USING` stubs and review
comments.

Endpoints: `POST /schema/snapshot`, `POST /schema/diff`,
`POST /schema/diff/migration`.

### Tests

- `tests/workbench.test.js` — **20 tests** on snippet expansion, cycle
  detection, shortcut validation.
- `tests/schemaDiffService.test.js` — **44 tests** on diff determinism
  and migration-SQL generation (CREATE TABLE, ALTER COLUMN TYPE with
  USING, CREATE INDEX CONCURRENTLY, FK add/drop, enum ADD VALUE).

### Docs

- [`backend/docs/QUERY_WORKBENCH.md`](../backend/docs/QUERY_WORKBENCH.md)
- [`backend/docs/SCHEMA_DIFF.md`](../backend/docs/SCHEMA_DIFF.md)

## Running Phase 3 + 4 tests

```bash
# Backend
cd backend
node --test tests/otlpTraceService.test.js \
            tests/workbench.test.js \
            tests/schemaDiffService.test.js

# SDKs
cd sdk            && node --test tests/fathom.test.js tests/tracer.test.js
cd sdk/python     && pytest -q
cd sdk/go         && go test ./... -race -count=1
cd sdk/go/middleware/gin && go test ./... -race -count=1
```

Final tally:

| Suite                          | Tests | Status |
| ------------------------------ | ----- | ------ |
| Backend Phase 3 (OTLP)         | 22    | green  |
| Backend Phase 4 (workbench)    | 20    | green  |
| Backend Phase 4 (schema diff)  | 44    | green  |
| JS SDK (client + tracer)       | 14    | green  |
| Python SDK (client + tracer)   | 58    | green  |
| Go SDK root (under `-race`)    | all   | green  |
| Go SDK nethttp + gin (`-race`) | all   | green  |

## What's next

The roadmap's exit criteria for Phase 3 — "trace-based alerting live" — is
a follow-on item that builds on the ingest + reader API shipped here.
Likewise the front-end trace viewer and multi-tab editor UI are shipped as
APIs only; the React surfaces consume them.
