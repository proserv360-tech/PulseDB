# FATHOM — Distributed Tracing (OTLP)

FATHOM ingests OpenTelemetry spans over OTLP/HTTP, stores them with per-org
sampling + retention controls, and exposes a trace-viewer API that pivots
from any span into the SQL queries it triggered.

## Wire contract

```
POST /api/otlp/v1/traces
Content-Type: application/json
X-SDK-Key: sk_live_…

{ "resourceSpans": [ … ] }          // standard OTLP/HTTP JSON
```

The payload is the OTLP/HTTP JSON shape
(https://opentelemetry.io/docs/specs/otlp/#otlphttp). FATHOM normalises into
`pgmonitoringtool.otlp_spans` and rolls up each trace into
`pgmonitoringtool.otlp_traces`.

Response:

```json
{ "accepted": 48, "dropped": 2 }
```

Spans may be dropped for three reasons:

1. The trace was not sampled (per-org `sampling_rate`).
2. The trace already has `max_spans_per_trace` spans stored; further spans are
   dropped to bound memory.
3. A malformed span (missing required IDs or timestamps).

## Per-org controls

```
GET  /api/traces/settings
PUT  /api/traces/settings
```

Body for PUT (admin only):

```json
{
    "samplingRate": 0.1,
    "retentionDays": 14,
    "maxSpansPerTrace": 2000
}
```

| Field              | Range      | Default |
| ------------------ | ---------- | ------- |
| `samplingRate`     | 0.0 – 1.0  | 1.0     |
| `retentionDays`    | 1 – 90     | 7       |
| `maxSpansPerTrace` | 1 – 10 000 | 2000    |

Sampling is **deterministic** per `traceId`: the same trace is either fully
sampled or fully dropped across every span the SDK emits. This prevents
partial-trace corruption where a parent span arrives but its children don't.

Retention runs as a scheduled purge job — see
`otlpTraceService.purgeExpiredTraces()`. A daily cron should call it.

## Reader endpoints

All reader endpoints require `authenticate` + `resolveWorkspace` +
`requireWorkspaceRole('viewer')`.

### `GET /api/traces`

List traces, newest first.

| Query param     | Meaning                                   |
| --------------- | ----------------------------------------- |
| `service`       | Filter by `service_name`.                 |
| `minDurationMs` | Only traces slower than N ms.             |
| `status`        | `ok` \| `error` \| `unset`.               |
| `limit`         | Default 50, max 500.                      |
| `before`        | ISO 8601 `start_time` — keyset-paginated. |

### `GET /api/traces/:traceId`

Returns the full span tree for a trace:

```json
{
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "rootSpan": { "spanId": "…", "operationName": "GET /api/orders", … },
  "spans":    [ … ],
  "tree":     { "span": { … }, "children": [ … ] }
}
```

Orphaned spans (whose parent is missing from the batch — e.g. the root came
in a later ingest call) are attached to the tree root so they're still
renderable.

### `GET /api/traces/:traceId/pivot`

Returns the DB queries correlated with this trace, by joining the existing
FATHOM query log on `trace_id`. Useful for "why is this request slow" —
click a span, land on the culprit query's plan history.

## Trace ID validation

Trace IDs must be 32-hex (128-bit). Span IDs are 16-hex (64-bit). Both are
stored as `BYTEA`. Invalid IDs return `400`.

## Jaeger / Tempo

Any tool that speaks OTLP/HTTP can push to `/api/otlp/v1/traces`. To import
from Jaeger or Tempo, configure their OTLP exporters to point at the FATHOM
endpoint with the tenant's SDK key. No special Jaeger-format adapter is
needed — OTLP is the lingua franca.

## SDK usage

All three SDKs expose the same conceptual surface. Context propagation is
idiomatic per language (async-local in JS, `contextvars` in Python,
`context.Context` in Go).

### JavaScript

```js
import { FathomSDK } from '@fathom/sdk';
const sdk = new FathomSDK({ apiKey, endpoint });

const span = sdk.startSpan('GET /api/orders', {
    attributes: { 'http.method': 'GET' },
});
try {
    // … work …
    span.end();
} catch (err) {
    span.recordException(err);
    span.end({ status: 'error' });
}

// Propagate across services
sdk.tracing.injectHeaders(outgoingHeaders);
```

### Python

```python
from fathom_sdk import FathomSDK

client = FathomSDK(api_key=..., endpoint=...)
with client.start_span("GET /api/orders", attributes={"http.method": "GET"}) as span:
    span.set_attribute("user.id", "u123")
    # … work …
```

### Go

```go
client, _ := fathom.New(fathom.Config{APIKey: "...", Endpoint: "..."})

ctx, span := client.StartSpan(ctx, "GET /api/orders")
defer span.End()

span.SetAttribute("user.id", "u123")
client.Tracing().InjectHeaders(outgoing.Header)
```

## Storage model

Migration `0006_otlp_traces.sql` creates three tables under
`pgmonitoringtool`:

- **`otlp_traces`** — one row per trace; rollup of span_count, duration,
  error_count, status.
- **`otlp_spans`** — one row per span; includes attributes, resource
  attributes, and span events as JSONB. GIN index on attributes allows
  attribute-filtering in future UI iterations.
- **`otlp_trace_settings`** — per-org sampling + retention.

All three tables cascade-delete from `organizations(id)`.

## Safety

- Trace + span IDs are stored as `BYTEA`; ids are never interpolated into
  SQL string literals.
- The ingest endpoint bounds each trace to `max_spans_per_trace` to prevent
  a runaway client from exhausting the DB.
- Reader endpoints are workspace-scoped; cross-tenant trace access is
  impossible through the API.
