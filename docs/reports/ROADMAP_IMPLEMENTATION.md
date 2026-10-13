# VIGIL Roadmap Implementation

This document indexes the work landed in response to the competitive gap
analysis. It is grouped by wave and cross-references every new file, route,
migration, test, and public-facing page.

All new routes are mounted in `backend/server.js` inside the
`modularMounts` loop (`/api` and `/api/v1` prefixes). SCIM is mounted at
`/scim/v2` with its own Bearer-token auth. IP allow-list runs as a gate
before any `/api` handler.

---

## Wave 1 — 90-day must-dos

### 1. SAML SSO + workspace RBAC

- Migration — `backend/db/migrations/0001_saml_sso_rbac.sql`
- Service — `backend/services/samlService.js`
- Routes — `backend/routes/samlRoutes.js` (`GET /saml/:workspaceId/metadata`, `/login`, `POST /acs`, `GET/PUT /config`)
- RBAC middleware — `backend/middleware/workspaceRbac.js` (`resolveWorkspace`, `requireWorkspaceRole`)
- UI — `frontend/src/pages/SsoSettings.tsx`
- Role map — `vigil-owner`/`admin`/`editor` SAML groups → workspace roles.

### 2. EXPLAIN-plan capture + visualizer

- Service — `backend/services/explainService.js` (`capturePostgresPlan`, `flattenPostgresPlan`, `diffPostgresPlans`, `fingerprintSql`, `isSafeForAnalyze`)
- Parsers — `backend/services/explainParsers.js` (MySQL + Mongo parity)
- Routes — `backend/routes/explainRoutes.js` (`/explain/postgres|mysql|mongo`, `/explain/plans/:id`, `/explain/history`, `/explain/diff`)
- UI — `frontend/src/components/ExplainVisualizer.tsx`
- Tests — `backend/tests/explainParsers.test.js` (2 tests pass)

### 3. Alert DSL + Slack/PagerDuty

- Parser — `backend/services/alertDsl.js` (tokenizer + recursive-descent parser + evaluator)
- Functions supported — `avg`, `max`, `min`, `rate`, `delta`, `pct_change`, `sustained`
- Notifiers — `backend/services/alertNotifiers.js` (Slack Block Kit, PagerDuty Events API v2)
- Routes — `backend/routes/alertDslRoutes.js` (`/alerts/dsl/validate`, `/parse`, `/evaluate`, `/rules` CRUD, `/test-notify`)
- Tests — `backend/tests/alertDsl.test.js` (10 tests pass)

### 4. Scalability benchmark harness

- Scripts — `scripts/bench/ingest-load.js`, `ws-load.js`, `dashboard-latency.js`, `alert-load.js`
- README — `scripts/bench/README.md`
- Published numbers — `docs/scalability.md` (287k alert evals/sec on sandbox core, RPO ≤15m / RTO ≤60m)

### 5. Trust center page

- `frontend/public/trust-center.html` — Compliance / Security / Privacy / Data / Availability sections.

---

## Wave 2 — 12-month priorities

### 6. Anomaly detection

- Python service — `python/api/routes/anomaly.py` (FastAPI router, `/detect`, `/baseline`, `/forecast`)
- Methods — rolling z-score, EWMA, seasonal (hour-of-week) residuals
- Node client — `backend/services/anomaly/anomalyClient.js` (HTTP client with local z-score fallback)
- Route — `backend/routes/anomalyRoutes.js` (`POST /anomaly/detect`)

### 7. MySQL / Mongo plan parity

- `backend/services/explainParsers.js` — `flattenMysqlPlan` (nested_loop/table/grouping/ordering), `flattenMongoPlan` (queryPlanner.winningPlan + executionStats)
- `flattenPlanForEngine` dispatcher feeds the same visualizer component.

### 8. Plugin API + marketplace

- Migration — `backend/db/migrations/0002_plugins_marketplace.sql` (`plugins`, `workspace_plugins`, `shared_dashboards`)
- Manifest types — `shared/types/plugin.ts` (`PluginManifest`, `PluginContribution`, `DashboardDefinition`)
- Registry — `backend/services/pluginRegistry.js` (`validateManifest`, `publishPlugin`, `listPublicPlugins`, `installPlugin`, `listWorkspacePlugins`)
- Routes — `backend/routes/pluginRoutes.js` (public marketplace + install/publish)
- **Security posture** — manifests are declarative only; no server-side code execution.

### 9. SCIM + IP allow-list + audit export

- SCIM — `backend/routes/scimRoutes.js` (Users + Groups + ServiceProviderConfig, mounted at `/scim/v2`)
- IP allow-list — `backend/middleware/ipAllowList.js` (pure-JS CIDR match, IPv4+IPv6, 30s cache)
    - Tests — `backend/tests/ipAllowList.test.js` (6 tests pass)
- Audit export — `backend/services/auditExport.js` (NDJSON, gzipped, S3-compatible: AWS / R2 / B2 / Wasabi / MinIO)
- Governance CRUD — `backend/routes/governanceRoutes.js` (IP allow-list, SCIM token issue/rotate/revoke, audit-export trigger)
- Schedule — `scheduleAuditExport()` wired in `server.js`; no-op when `AUDIT_EXPORT_BUCKET` is unset.

### 10. Pricing page

- `frontend/public/pricing.html` — 4 tiers (Free $0, Team $19/user, Business $49/user, Enterprise custom), feature matrix, interactive monthly/annual calculator, market comparison.

---

## Wave 3 — moonshots

### 11. AI SQL copilot

- Migration — `backend/db/migrations/0003_copilot.sql` (`copilot_turns` history)
- Service — `backend/services/copilotService.js`
    - LLM-agnostic provider adapter: `openai` / `anthropic` / `local` stub (default)
    - `buildSchemaContext` — live schema snapshot, hint-ranked, capped at 40 tables × 24 columns
    - `redact` — strips DSNs, bearer tokens, password= forms
    - `isSafeToRun` — allow-list guard (SELECT/WITH only; no mutations or multi-statements)
    - Actions: `generateSql`, `explainPlan`, `draftIncidentRca`
- Routes — `backend/routes/copilotRoutes.js` (`/copilot/sql`, `/explain`, `/rca`, `/history`, `/provider`, `/validate-sql`)
- UI — `frontend/src/components/Copilot.tsx` (three-mode chat: SQL / Explain / RCA)
- Tests — `backend/tests/copilot.test.js` (6 tests pass)

### 12. Migration review GitHub Action

- `.github/actions/db-migration-review/action.yml` — composite action
- `lint.mjs` — 10 rules (destructive drop, drop column, non-concurrent index, set-not-null, type change, add-column-default, truncate, grant/revoke, mongo-drop, concurrent-in-tx); dependency-free statement splitter
- `comment.mjs` — idempotent PR comment (marker-based upsert via gh CLI or fetch)
- `report.mjs` — optional shipment to a VIGIL workspace
- README — `.github/actions/db-migration-review/README.md`
- Verified end-to-end against synthetic fixtures — catches 6/6 expected findings.

### 13. VIGIL Cloud landing page

- `frontend/public/cloud.html` — hero, three-way run-modes comparison, architecture ASCII diagram, SLO table, FAQ, signup CTA. Links to pricing and trust-center.

---

## Server integration (Task 14)

`backend/server.js`:

- Added imports for all new route modules, `ipAllowListMiddleware`, and `scheduleAuditExport`.
- Mounted IP allow-list gate at `/api` **before** the modular route loop.
- Mounted SCIM at its own path (no `/api` prefix) since Bearer token auth is independent.
- Added all seven new route modules inside the `modularMounts` loop so they are available at both `/api` and `/api/v1`.
- Starts `scheduleAuditExport()` at boot unless disabled.

## Tests — cumulative

```
node --test backend/tests/copilot.test.js \
            backend/tests/ipAllowList.test.js \
            backend/tests/alertDsl.test.js \
            backend/tests/explainParsers.test.js
# tests 24   pass 24   fail 0
```

## Migrations — apply order

```
0001_saml_sso_rbac.sql
0002_plugins_marketplace.sql
0003_copilot.sql
```

## Environment variables added

| Variable                        | Purpose                                 | Default          |
| ------------------------------- | --------------------------------------- | ---------------- |
| `COPILOT_PROVIDER`              | `openai` / `anthropic` / `local`        | `local`          |
| `COPILOT_MODEL`                 | Provider-specific model override        | provider default |
| `OPENAI_API_KEY`                | If `COPILOT_PROVIDER=openai`            | —                |
| `ANTHROPIC_API_KEY`             | If `COPILOT_PROVIDER=anthropic`         | —                |
| `AUDIT_EXPORT_BUCKET`           | S3-compatible bucket for audit exports  | —                |
| `AUDIT_EXPORT_REGION`           | Region for the export bucket            | `us-east-1`      |
| `AUDIT_EXPORT_PREFIX`           | Key prefix in bucket                    | `vigil/audit`    |
| `AUDIT_EXPORT_ENDPOINT`         | Set for R2/B2/MinIO                     | —                |
| `AUDIT_EXPORT_ACCESS_KEY`       | Access key for the export bucket        | —                |
| `AUDIT_EXPORT_SECRET_KEY`       | Secret key                              | —                |
| `AUDIT_EXPORT_FORCE_PATH_STYLE` | `true` for MinIO-style path URLs        | `false`          |
| `AUDIT_EXPORT_ENABLED`          | Set to `false` to disable the scheduler | enabled          |

## Public-facing pages

- `frontend/public/trust-center.html` — Wave 1
- `frontend/public/pricing.html` — Wave 2
- `frontend/public/cloud.html` — Wave 3

## Artifacts & companion docs

- `VIGIL_Competitive_Gap_Analysis.docx` — 8-section competitive gap analysis that drove this plan.
- `docs/scalability.md` — Published throughput and RPO/RTO numbers.
- `scripts/bench/README.md` — How to reproduce the benchmarks.

---

_Generated as part of the Wave 1–3 implementation rollout._
