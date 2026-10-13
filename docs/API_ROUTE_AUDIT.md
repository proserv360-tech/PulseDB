# API route audit

Static audit of every backend route declaration against every frontend call
site. 781 endpoint registrations across 56 route modules, 362 frontend call
sites, 285 distinct paths.

Two real defects, one design smell. Everything else checks out.

---

## 1. Double `/api` prefix — 58 endpoints unreachable

**Severity: high. Entire feature tabs are returning 404.**

Seven route modules declare paths that already begin with `/api/`, and are then
mounted under the `/api` prefix. Express concatenates, so the live path is
`/api/api/…`.

```js
// routes/mongoRoutes.ts
router.get('/api/mongodb/overview', authenticate, …)

// server.ts:2617 — prefix is '/api' and '/api/v1'
app.use(prefix, mongoRoutes(pool, authenticate, getMongoClient, CONNECTIONS));

// live path:     /api/api/mongodb/overview
// frontend calls: /api/mongodb/overview     → 404
```

| Module | Endpoints | Mounted | Frontend callers |
|---|---|---|---|
| `mongoRoutes.ts` | 33 | server.ts:2617 | 6 files |
| `mysqlRoutes.ts` | 10 | server.ts:2616 | 3 files |
| `syntheticRoutes.ts` | 6 | server.ts:2669 | none |
| `kmsRoutes.ts` | 3 | server.ts:2671 | none |
| `traceRoutes.ts` | 3 | **not mounted at all** | 2 files |
| `engineConsoleRoutes.ts` | 2 | server.ts:2714 | 1 file |
| `erdRoutes.ts` | 1 | server.ts:2673 | none |

The remaining 49 route modules declare relative paths (`/incidents`,
`/alerts/rules`) and mount correctly. These seven are the exception, not the
pattern — which is why it went unnoticed.

`traceRoutes.ts` is a separate case: never imported, never mounted. Its 3
endpoints do not exist at any path, while 2 frontend files call them.

`observabilityIngestRoutes.ts` turned out to have the same defect — its
`/api/v1/errors`, `/api/v1/rum/beacon` and `/api/v1/prom/metrics` were
answering at `/api/api/v1/…`, and `/otlp/v1/logs` at `/api/otlp/v1/logs`. That
brings the total to **55 endpoints across 6 mounted modules**, plus 3 in the
unmounted `traceRoutes`.

### Fix — applied

**Mounted at the root instead of rewriting the paths.** The first instinct was
to strip `/api` from the declarations so they match the other 49 modules, but
the absolute form is load-bearing:

- `/otlp/v1/logs` is fixed by the OTLP spec and cannot live under `/api`.
- The SDK posts errors to `/api/v1/errors` and spans to
  `/api/otlp/v1/traces` (`sdk/src/core/spanBatcher.js:95`).
- `tests/gapClose.test.ts` mounts these routers at the root and asserts those
  exact paths — the clearest available statement of intent.

Rewriting the paths would have broken all three. So `server.ts` now mounts the
six outside the `modularMounts` loop:

```diff
 for (const prefix of modularMounts) {
-    app.use(prefix, mongoRoutes(pool, authenticate, getMongoClient, CONNECTIONS));
     …
 }
+app.use(mongoRoutes(pool, authenticate, getMongoClient, CONNECTIONS));
```

**What this gives up:** no `/api/v1` twin for these endpoints, because the
version lives inside their own path strings. Anything added here needs its
versioned alias written by hand.

**What it does not give up:** middleware. `app.use('/api', …)` gates match on
the request URL, not on where a router was mounted, so the IP allow-list and
`X-API-Version` header still apply to every `/api/*` request.

### `otlpTraceRoutes` — correct already, left alone

It declares both `/otlp/v1/traces` and `/traces` while mounted at `prefix`,
which looks like the same bug. It is not: the SDK posts to
`${endpoint}/api/otlp/v1/traces` and the frontend calls `/api/traces`, so both
resolve correctly today. Changing it would have broken working endpoints.

### `traceRoutes` — deliberately left unmounted

Mounting it was the original plan; inspection says don't:

- Its two GETs duplicate `/api/enterprise/trace/:traceId/queries|summary` in
  `enterpriseUIRoutes.ts`, which are gated by `requireFeature('trace_correlation')`.
- It takes no `authenticate` parameter and applies no auth to its routes, so
  mounting it under `/api` would expose unauthenticated database queries.
- Nothing calls its paths. The frontend calls `/api/traces` (served by
  `otlpTraceRoutes`) and `/api/traces/:traceId/correlate` (see §2a).

It is dead code. Deleting it is the honest resolution, but that is a call for
whoever owns the trace feature.

### Verified after the change

- All previously-unreachable paths now resolve; the audit's unmatched-call list
  no longer contains any `/api/mongodb`, `/api/mysql`, `/api/synthetic`,
  `/api/kms`, `/api/schema/erd` or `/api/engine-console` entry.
- `tests/gapClose.test.ts` — 25 passed, which is the suite that mounts these
  routers and asserts the absolute paths.

---

## 2a. `/api/traces/:traceId/correlate` does not exist

**Severity: medium. Called by the frontend, defined nowhere.**

`frontend/src/components/TraceCorrelationView.tsx:103` requests
`/api/traces/${traceId}/correlate`. No route matches it. `otlpTraceRoutes`
serves `/traces` but has no `:traceId/correlate`, and the closest equivalents
live at `/api/enterprise/trace/:traceId/queries` and `…/summary`.

Either the view points at the wrong path, or the endpoint was never written.
Someone who knows the intended shape of the correlated-span response should
decide which.

---

## 3. Eleven shadowed inline handlers in `server.ts`

**Severity: medium. Dead code that reads as live.**

Eleven paths are registered twice — once in a route module, once inline in
`server.ts`. Express uses first-registered-wins, and the module mounts run at
line 2590 while the inline handlers start at 6763. **The inline versions never
execute.**

| Path | Live (wins) | Dead |
|---|---|---|
| `GET /api/otel/services` | otelRoutes.ts:106 | server.ts:6842 |
| `GET /api/otel/metrics/names` | otelRoutes.ts:94 | server.ts:6858 |
| `GET /api/retention/policy` | retentionRoutes.ts:31 | server.ts:6900 |
| `GET /api/retention/stats` | retentionRoutes.ts:72 | server.ts:6910 |
| `GET /api/retention/growth` | retentionRoutes.ts:105 | server.ts:6923 |
| `POST /api/retention/cleanup` | retentionRoutes.ts:84 | server.ts:6934 |
| `GET /api/observability/api-metrics` | observabilityRoutes.ts:191 | server.ts:6763 |
| `GET /api/observability/exceptions` | observabilityRoutes.ts:248 | server.ts:6778 |
| `GET /api/observability/uptime` | observabilityRoutes.ts:261 | server.ts:6791 |
| `GET /api/observability/audit-log` | observabilityRoutes.ts:275 | server.ts:6804 |
| `GET /api/observability/jobs` | observabilityRoutes.ts:310 | server.ts:6836 |

This is the residue of an extraction that moved handlers into modules without
deleting the originals. It is not currently breaking anything, but it is a trap:
editing the `server.ts` copy produces no behaviour change, and the two
implementations can drift apart silently.

### Fix

Delete the eleven inline handlers. Diff each against its module twin first —
where they have diverged, the module version is the one in production, so that
is the behaviour to preserve.

---

## 4. Demo strings picked up as call sites

Not a defect — recorded so the next audit does not re-flag them.

`DemoDataTab.tsx`, `DemoPostgresTab.tsx` and `DemoMySQLTab.tsx` contain literals
like `/api/orders`, `/api/products`, `/api/v1/search` used as sample content in
the demo UI. They are display strings, never fetched. Any route audit will
surface them as unmatched calls.

---

## 5. Method mismatches — none confirmed

The first pass flagged 40. All sampled cases were false positives from the
detector defaulting to `GET` when no literal `method:` appears within a few
lines — the codebase mostly calls through helpers:

```js
const r = await postData(`/api/incidents/${id}/acknowledge`, {});
```

`postData`, `api.post` and similar wrappers set the method internally. A future
audit should resolve helper identifiers rather than scanning for `method:`.

---

## 6. Reproducing

The audit scripts are not committed — they were throwaway. To redo it:

1. Parse `app.use(prefix, xRoutes(…))` in `server.ts`, expanding `prefix`
   against `modularMounts = ['/api', '/api/v1']`.
2. For each mounted module, collect `router.METHOD('path')` and concatenate.
3. Collect `'/api/…'` literals under `frontend/src`, replacing `${…}` with a
   wildcard segment.
4. Match, accounting for `:param` segments.

The one trap worth repeating: `prefix` is a loop variable, not a constant. Treat
it as a literal and every modular route silently disappears from the table.
