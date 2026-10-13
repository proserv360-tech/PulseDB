# FATHOM — Phase 2 Deliverables

Phase 2 closes two competitive gaps identified in the strategic roadmap:

1. **Multi-language SDK coverage** — the JS SDK gets production-ready Python
   and Go siblings at feature parity, stitched together by a shared OpenAPI
   spec that is the wire contract.
2. **Postgres depth** — on top of the existing `/explain/diff` plan diff,
   FATHOM now ships an **index advisor** (unused / redundant / missing) and a
   **bloat & vacuum watcher** (table + index bloat, autovacuum lag).

Everything below is shipped and tested.

## SDKs

### Shared OpenAPI spec

`sdk/openapi/fathom-sdk.yaml` — 443 lines, OpenAPI 3.0.3, validated with
`openapi-spec-validator`. Defines the `SdkEvent` base type plus
`ApiCallEvent`, `ErrorEvent`, `AuditEvent`, `MetricEvent` via `allOf`. Includes
the three SDK endpoints:

```
POST /api/sdk/ingest       (max 100 events, X-SDK-Key header)
POST /api/sdk/heartbeat
GET  /api/sdk/health
```

Every new SDK is tested against the same response fixtures — the spec is the
source of truth.

### Python SDK — `sdk/python/`

- Pure-Python, single hard dependency (`httpx>=0.25`).
- API: `FathomSDK.track_api`, `track_error`, `track_audit`, `track_metric`,
  `track`, `heartbeat`, `flush`, `shutdown`, `capture_uncaught_exceptions`.
- Thread-safe batcher, auto-retry with backoff, failed batches re-queue to the
  front.
- Framework integrations: FastAPI, Django, generic WSGI.
- **39 tests passing.**

### Go SDK — `sdk/go/`

- Multi-module monorepo stitched with `go.work`:
    - Root module: `github.com/fathom/fathom-go` (client, events, transport,
      batcher)
    - `middleware/nethttp` — standard library wrapper
    - `middleware/gin` — Gin framework wrapper
    - `examples/{nethttp,gin}` — runnable samples
- Zero external dependencies in the core client.
- **All tests pass under `go test -race`** across root + middleware modules.
  The race detector caught two real bugs during development (a `Stop()`
  deadlock and a channel drain on shutdown) which are now covered by tests.

## Postgres depth

### Index advisor — `backend/services/indexAdvisor.js`

Three capabilities on top of `pg_stat_user_indexes`, `pg_indexes`, and
`pg_stat_statements`:

- **Unused**: `idx_scan = 0` and not a PK / unique-supporting index.
- **Redundant**: one index's leading columns prefix another on the same table.
- **Missing**: query-predicate columns from `pg_stat_statements` that no
  existing index covers; ranked by `calls × meanTimeMs`.

Every suggestion comes with a generated `CREATE INDEX CONCURRENTLY` /
`DROP INDEX CONCURRENTLY` statement. The service never executes DDL.

Graceful degradation: if `pg_stat_statements` is not installed, the
`/suggestions` endpoint returns an empty array and an `advisory` string
explaining how to enable it instead of 500-ing.

Routes: `routes/advisorRoutes.js` — 4 endpoints, gated by
`requireWorkspaceRole('viewer')`.

Tests: `tests/indexAdvisor.test.js` — **34 passing** (pure unit tests over
SQL-parsing, prefix-coverage, DDL generation, and impact scoring; no live DB
required).

Docs: [`backend/docs/INDEX_ADVISOR.md`](../backend/docs/INDEX_ADVISOR.md).

### Bloat + vacuum watcher — `backend/services/bloatWatcher.js`

- **Table bloat** via `pgstattuple_approx()` when the extension is available,
  falling back to a statistics-based page-math heuristic (ioguix /
  check_postgres style) on stock Postgres.
- **Index bloat** via the same dual-strategy approach.
- **Autovacuum lag** derived from `pg_stat_user_tables`, with per-row
  `recommendation` explaining whether to run `VACUUM`, `VACUUM ANALYZE`,
  `VACUUM (FULL, ANALYZE)`, or nothing. `VACUUM FULL` is only recommended
  above `bloatRatio > 0.4` and `sizeBytes > 1 GiB` — it's expensive, the
  watcher is conservative about suggesting it.
- **DDL preview** endpoint (admin-only). Never executes.

Routes: `routes/bloatRoutes.js` — 4 endpoints.

Tests: `tests/bloatWatcher.test.js` — **28 passing** over the heuristic bloat
math, byte formatting, recommendation branches, and DDL generation.

Docs: [`backend/docs/BLOAT_WATCHER.md`](../backend/docs/BLOAT_WATCHER.md).

## Running Phase 2 tests

```bash
# Backend
cd backend
node --test tests/indexAdvisor.test.js tests/bloatWatcher.test.js

# Python SDK
cd sdk/python
pytest

# Go SDK (from each module)
cd sdk/go           && go test ./... -race
cd sdk/go/middleware/gin && go test ./... -race
```

## What ships next (Phase 3 preview)

The roadmap calls for: RUM-lite frontend SDK, a per-org audit of sensitive
operations with redaction policies, and deeper MongoDB / MySQL plan diffing.
See `docs/FATHOM_Strategic_Competitive_Roadmap.docx` for the full plan.
