# Merge Plan — API Tracing → Observability Hub

**Date:** 2026-06-04
**Scope:** Consolidate `ApiQueriesTab` ("API Tracing") into `ObservabilityHub` so the project has one observability surface instead of two overlapping ones.

---

## 1. What we're merging

|                | **ApiQueriesTab** ("API Tracing")                                      | **ObservabilityHub**                                                                                               |
| -------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| File           | `frontend/src/components/views/admin/ApiQueriesTab.tsx` (~1,056 lines) | `frontend/src/components/views/monitoring/ObservabilityHub.tsx` (~861 lines)                                       |
| Nav section    | Developer Tools → "API Tracing"                                        | Observability → "Observability Hub"                                                                                |
| Internal label | v8 — Apex Observability                                                | Observability Hub                                                                                                  |
| Scope          | One request, deep                                                      | Whole system, broad                                                                                                |
| Tabs           | Trace, Logs, Payload, RUM, Security                                    | API Monitoring, Exception Tracker, Uptime Monitor, Audit Log, Job Monitor, API Tracing                             |
| Data sources   | Mostly `/api/performance/stats` (synthetic spans + mock logs)          | 6 live endpoints: `/api/observability/api-metrics`, `/exceptions`, `/uptime`, `/audit-log`, `/jobs`, `/api/traces` |

**Overlap:** Both have a tracing view. ObservabilityHub's "API Tracing" tab reads real spans from `/api/traces`; ApiQueriesTab's "Trace" tab synthesizes a waterfall from a single `/performance/stats` call. Everything else is complementary, not duplicate.

---

## 2. Target architecture

The merge is not a fusion of equals — it's **folding ApiQueriesTab into ObservabilityHub as the drill-down layer.** ObservabilityHub stays the host (real endpoints, broader scope, already owns the Observability section). ApiQueriesTab becomes the per-trace detail view.

```
Observability Hub
├── API Monitoring        (unchanged — fleet metrics)
├── Exception Tracker     (unchanged)
├── Uptime Monitor        (unchanged)
├── Audit Log             (unchanged)
├── Job Monitor           (unchanged)
└── API Tracing           (list of traces from /api/traces)
        └── [click a trace] ──▶ Trace Detail  (← ApiQueriesTab content)
                 ├── Trace    (waterfall spans)
                 ├── Logs
                 ├── Payload  (JSON inspector — unique to ApiQueriesTab)
                 ├── RUM      (unique to ApiQueriesTab)
                 └── Security (per-request — unique to ApiQueriesTab)
```

The Hub's "API Tracing" tab becomes a **master list**; selecting a row opens the ApiQueriesTab five-tab deep-dive as a **detail panel**. Payload, RUM, and per-request Security have no equivalent in the Hub, so they carry over wholesale.

---

## 3. The one real piece of work

ApiQueriesTab's **Trace** tab runs on synthetic spans derived from `/api/performance/stats` — Nginx → JWT → Redis → Postgres are hand-built in the component, not fetched. Embedding that mock visual inside a live dashboard would be misleading.

**Fix:** repoint the Trace tab to read real spans from `/api/traces` (already consumed by the Hub). The endpoint exists; the work is mapping its span shape onto the waterfall renderer ApiQueriesTab already has. This is the only non-trivial item — the UI consolidation itself is mechanical.

---

## 4. Migration steps

1. **Extract the deep-dive.** Pull ApiQueriesTab's five-tab body into a `TraceDetail` component that takes a `traceId` prop. Keep its Trace/Logs/Payload/RUM/Security tab bar intact.
2. **Wire the master-detail.** In ObservabilityHub's "API Tracing" tab, make each trace row open `<TraceDetail traceId={...} />` (side panel or routed sub-view).
3. **Repoint Trace to real data.** Replace the synthetic `/performance/stats` waterfall with spans from `/api/traces/:id` (or the per-trace shape already returned by `/api/traces`). Keep the existing P50/P95/P99 visuals.
4. **Carry over the unique tabs.** Payload, RUM, Security move as-is; they have no Hub counterpart.
5. **Update nav (`tabConfig.ts`).** Remove the standalone `{ id: 'api', label: 'API Tracing', component: ApiQueriesTab }` from Developer Tools. Optionally keep a redirect from the old tab id to `observability-hub` so existing links don't break.
6. **Clean up `App.tsx`.** Drop the separate `ApiQueriesTab` lazy import once it's only referenced internally by the Hub.
7. **Verify.** Confirm `/api/traces` returns enough per-span detail for the waterfall; check role gating (Audit Log is `isAdmin`, the rest `isViewer`) survives the move; smoke-test the master-detail flow.

---

## 5. Risks / watch-items

- **Trace data fidelity** — if `/api/traces` doesn't return span-level breakdown (Nginx/JWT/Redis/PG timings), the Trace tab degrades. Confirm the payload before deleting the synthetic path.
- **Role gating** — ApiQueriesTab is under Developer Tools today; the Hub's Audit Log is admin-only. Make sure folding in the deep-dive doesn't expose admin data to viewers.
- **Bundle size** — ApiQueriesTab is ~1,056 lines and currently lazy-loaded on its own. Folded into the Hub it should stay lazy as `TraceDetail` so the Hub's first paint isn't slowed.
- **Lost discoverability** — "API Tracing" under Developer Tools is where devs look today. The redirect (step 5) covers muscle memory.

---

## 6. Recommendation

Worth doing. The two are 80% complementary and 20% redundant (tracing). Consolidating gives one observability home, removes the duplicate trace view, and surfaces ApiQueriesTab's strong Payload/RUM/Security inspectors to a wider audience. Budget the effort almost entirely against step 3 (real trace data); the rest is wiring.
