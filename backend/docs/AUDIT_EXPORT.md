# FATHOM — On-Demand Audit Log Export

FATHOM's audit log is append-only and covers every security-relevant action:
login / logout, role changes, integration mutations, SSO configuration, API
key issuance, retention edits, plugin installs, and so on.

For SIEM pulls, compliance archival, and ad-hoc investigations, FATHOM exposes
a streaming export endpoint. Unlike the paginated UI endpoint, the export
endpoint streams rows straight to the socket with bounded memory and without
loading the full result set server-side.

## Endpoint

```
GET /api/audit/export
```

- **Auth:** `Authorization: Bearer <JWT>` and the caller must have
  `admin` role (enforced by the `requireScreen('admin')` middleware).
- **Output:** newline-delimited JSON (NDJSON) or CSV — selectable via
  `format`. One HTTP response, one row per line. No pagination envelope.

## Query parameters

| Param      | Type                 | Default | Notes                                                                 |
| ---------- | -------------------- | ------- | --------------------------------------------------------------------- |
| `format`   | `json` \| `csv`      | `json`  | JSON = NDJSON (`application/x-ndjson`); CSV is RFC-4180 with header.  |
| `from`     | ISO 8601 timestamp   | —       | Inclusive lower bound on `created_at`.                                |
| `to`       | ISO 8601 timestamp   | —       | Exclusive upper bound on `created_at`. Must be strictly after `from`. |
| `level`    | string (exact match) | —       | `info` \| `warn` \| `critical` \| `success`.                          |
| `action`   | string               | —       | Case-insensitive substring match (`ILIKE %…%`).                       |
| `username` | string               | —       | Case-insensitive substring match on `actor_username`.                 |
| `maxRows`  | integer              | 100 000 | Safety cap. Hard maximum: 500 000.                                    |

Invalid inputs return `400` with a JSON error body (`{ error: "…" }`) before
streaming begins. Examples: `format=xml`, `from=not-a-date`, `from >= to`.

## Response headers

```
Content-Type:        application/x-ndjson; charset=utf-8   (or text/csv; charset=utf-8)
Content-Disposition: attachment; filename="fathom-audit-<from>_<to>.<ext>"
X-Content-Type-Options: nosniff
Cache-Control:       no-store
```

The filename encodes the requested range — `all` / `now` are used when `from`
or `to` is omitted. `:` and `.` in the ISO timestamps are replaced with `-` so
the filename is safe on every filesystem.

## Row shape

Every row — both in NDJSON and CSV — reflects the `pgmonitoringtool.audit_log`
table columns in this exact order:

```
id, created_at, actor_id, actor_username, action,
resource_type, resource_id, level, detail, ip_address, metadata
```

### NDJSON example

```json
{
    "id": 42,
    "created_at": "2026-04-22T10:00:00.000Z",
    "actor_id": 7,
    "actor_username": "ada",
    "action": "integration.create",
    "resource_type": "integration",
    "resource_id": "12",
    "level": "info",
    "detail": "created destination ops-slack",
    "ip_address": "10.0.0.1",
    "metadata": { "provider": "slack" }
}
```

### CSV example

```
id,created_at,actor_id,actor_username,action,resource_type,resource_id,level,detail,ip_address,metadata
42,2026-04-22T10:00:00.000Z,7,ada,integration.create,integration,12,info,created destination ops-slack,10.0.0.1,"{""provider"":""slack""}"
```

CSV cells containing commas, double quotes, or newlines are wrapped in double
quotes; interior double quotes are doubled per RFC 4180. `null` / `undefined`
cells emit an empty field. `Date` values serialise as ISO 8601 strings; object
values are compact `JSON.stringify`-ed.

## Sample invocations

```bash
# Full export of the last 24h as NDJSON
curl -fSL \
  -H "Authorization: Bearer $FATHOM_JWT" \
  "https://fathom.example.com/api/audit/export?from=2026-04-21T00:00:00Z&to=2026-04-22T00:00:00Z" \
  -o fathom-audit.ndjson

# CSV export of critical events for one user in April
curl -fSL \
  -H "Authorization: Bearer $FATHOM_JWT" \
  "https://fathom.example.com/api/audit/export?format=csv&level=critical&username=ada&from=2026-04-01T00:00:00Z&to=2026-05-01T00:00:00Z" \
  -o critical-ada.csv

# Stream to jq for a quick filter
curl -fsSL -H "Authorization: Bearer $FATHOM_JWT" \
  "https://fathom.example.com/api/audit/export?action=integration" \
  | jq -c 'select(.level=="critical")'
```

## Streaming & paging internals

The endpoint is backed by `streamAuditEvents()` in
`services/auditService.js`, which performs keyset pagination on
`(created_at, id)` so that concurrent writes don't cause rows to be skipped or
duplicated mid-export:

1. First page: `ORDER BY created_at ASC, id ASC LIMIT 1000`.
2. Each subsequent page uses
   `WHERE (created_at, id) > ($cursorTs, $cursorId)` seeded from the last row
   of the previous page.
3. The loop exits when a page returns fewer rows than `pageSize`, or when
   `maxRows` has been yielded.

Because the generator yields one row at a time and the route `res.write`s each
row immediately, steady-state memory stays bounded regardless of result-set
size. The default page size of 1000 balances throughput against per-query
cost; operators can tune it in `auditRoutes.js` if needed.

## Failure behaviour

- **Pre-stream error** (bad param, auth failure) — returns a normal JSON
  error with the appropriate status code (`400`, `401`, `403`).
- **Mid-stream error** — headers are already sent, so the server logs the
  failure with row count and terminates the connection. Clients see a
  truncated body; they should retry or use a narrower `from`/`to` window.
  Every completed and aborted export is logged with actor, row count, and
  elapsed ms via the JSON logger.

## Legacy schema compatibility

Older deployments don't have a `resource_type` column on `audit_log`. The
service transparently falls back to a query that emits
`NULL AS resource_type`, so the output shape is stable across schema versions
and no migration is required before enabling the endpoint.

## Retention considerations

The export endpoint reads whatever is currently in `audit_log`. FATHOM's
retention service (`services/retentionService.js`) is responsible for
periodically trimming rows past their policy horizon — exports pulled after
retention has run will not include rows that have already been purged. Pair
the export endpoint with an external archival job (daily NDJSON dump into
object storage, cron-driven SIEM sync, etc.) if regulators require older
history than your retention policy keeps online.
