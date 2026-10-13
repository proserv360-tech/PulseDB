# FATHOM

FATHOM is a multi-tenant database monitoring and administration platform. It ships
a unified operator UI over PostgreSQL, MySQL/MariaDB, and MongoDB with live
metrics, alerting, schema exploration, log analysis, and a lightweight SDK that
customer apps can use to stream their own API logs, errors, and audit events
into the same dashboard.

## Repository layout

```
backend/    Node.js (Express 5) control-plane API and WebSocket server.
frontend/   React 19 + Vite SPA.
api/        Vercel serverless entrypoint that re-exports backend/server.js.
python/     FastAPI analytics and ML worker.
sdk/        Zero-dep JS client library (@fathom/sdk) for customer apps.
shared/     Cross-workspace types and contracts.
demo/       Stand-alone demo app used by docs and screenshots.
```

This is an npm workspaces monorepo; `package.json` declares `frontend`,
`backend`, and `shared/*` as workspaces. Turbo is used for cross-workspace
scripts.

## Requirements

- Node.js 18 or newer (Node 20 recommended; see `engines` in `sdk/package.json`).
- Python 3.11+ for the analytics worker (`python/pyproject.toml`).
- A PostgreSQL 14+ database for the FATHOM control plane (users, sessions,
  connection metadata, audit log, feedback, etc.). Neon, Supabase, or any
  standard Postgres work. For Supabase use the **direct** connection (port
  `5432`) for migrations and the **transaction pooler** (port `6543`) for
  serverless runtime, and set `DB_SSL=true`. Moving an existing control plane
  from Neon to Supabase? See
  [`backend/docs/NEON_TO_SUPABASE_MIGRATION.md`](backend/docs/NEON_TO_SUPABASE_MIGRATION.md)
  and the scripts in `backend/scripts/` (`migrate-neon-to-supabase.sh`,
  `verify-migration.sh`, `migrate-schema-only.sh`).

## Environment

The backend refuses to start unless the following secrets are configured.
Generate each one with a separate random source.

| Name                                                         | Required | Purpose                                                                                                     |
| ------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                               | yes      | Connection string for the FATHOM control-plane DB.                                                          |
| `JWT_SECRET`                                                 | yes      | Signs session JWTs. At least 32 bytes of entropy.                                                           |
| `ENCRYPTION_KEY`                                             | yes      | AES-256-GCM key used to encrypt connection secrets at rest. Must NOT equal `JWT_SECRET`.                    |
| `JWT_AUDIENCE`                                               | no       | JWT `aud` claim (default `fathom-api`).                                                                     |
| `JWT_ISSUER`                                                 | no       | JWT `iss` claim (default `fathom-auth`).                                                                    |
| `CRON_SECRET`                                                | prod     | Bearer credential required by `/api/alerts/run-monitoring`. If unset, the cron endpoint is disabled.        |
| `FATHOM_TLS_ALLOW_SELF_SIGNED`                               | no       | Set to `true` to accept self-signed TLS certs on user-added DB connections (default: strict in production). |
| `FATHOM_TLS_CA_CERT`                                         | no       | Extra CA bundle (PEM) added to the trust store for DB TLS.                                                  |
| `FATHOM_ANOMALY_MODE`                                        | no       | `off` (default), `suggest`, or `page`. Enables statistical anomaly alerts during monitoring.                |
| `FATHOM_ANOMALY_TYPE`                                        | no       | Detector for anomaly mode: `zscore` (default), `ewma`, or `mad`.                                            |
| `FATHOM_ANOMALY_WINDOW`                                      | no       | Rolling window size (samples) for the anomaly detector (default 60).                                        |
| `COPILOT_PROVIDER`                                           | no       | `local` (default stub), `openai`, or `anthropic`. Enables real + streaming copilot completions.             |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`                       | no       | Provider key for the copilot when `COPILOT_PROVIDER` is set accordingly.                                    |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` | no       | Fallback RDS/Aurora CloudWatch creds when a workspace has no stored cloud credential.                       |

Generate secrets with:

```
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

## Bootstrap

```
npm ci
npm run migrate --workspace=backend   # creates control-plane schema
npm run dev                           # runs frontend + backend
```

The first migration run creates an `admin` user with a randomly generated
password, prints it ONCE to stdout, and sets `must_change_password=true`.
Record the password immediately — it is not stored anywhere else. You can
override it for automated CI setups via `FATHOM_INITIAL_ADMIN_PASSWORD`.

## Deployment

The repository is set up for split deployment:

- **Frontend + serverless API** → Vercel (`vercel.json`, `api/index.js`).
- **Long-lived backend + WebSocket** → Railway, Fly.io, Render, or any Node host.

`vercel.json` pins `installCommand` to `npm ci` (audit SEC-09) and the
serverless function `maxDuration` to 30 s (audit PRF-04).

## Enterprise features

- **Per-organization alert fan-out** — Slack, PagerDuty, Opsgenie, Microsoft
  Teams, and signed generic webhooks configured per tenant through
  `/api/integrations`. At-rest secret encryption via `ENCRYPTION_KEY`.
  See [`backend/docs/INTEGRATIONS.md`](backend/docs/INTEGRATIONS.md).
- **SAML 2.0 SSO (SP-initiated)** — per-workspace IdP metadata; encrypted SP
  private keys; configured through `/api/saml/*`.
- **Streaming audit log export** — admin-only `GET /api/audit/export` returns
  NDJSON or CSV with keyset pagination. See
  [`backend/docs/AUDIT_EXPORT.md`](backend/docs/AUDIT_EXPORT.md).
- **Postgres index advisor** — unused, redundant, and missing-index detection
  over `pg_stat_user_indexes` and `pg_stat_statements`. Generates
  `CREATE / DROP INDEX CONCURRENTLY` DDL; never executes it. See
  [`backend/docs/INDEX_ADVISOR.md`](backend/docs/INDEX_ADVISOR.md).
- **Postgres bloat & vacuum watcher** — table + index bloat estimation
  (pgstattuple when available, statistics heuristic otherwise) and autovacuum
  lag surfacing with conservative VACUUM recommendations. See
  [`backend/docs/BLOAT_WATCHER.md`](backend/docs/BLOAT_WATCHER.md).
- **Multi-language SDKs** — the `sdk/` tree ships JS, Python, and Go clients
  at feature parity, driven by a shared OpenAPI contract at
  `sdk/openapi/fathom-sdk.yaml`. The Go SDK ships Gin and `net/http`
  middlewares; the Python SDK ships FastAPI, Django, and WSGI integrations.
- **Distributed tracing** — OTLP/HTTP ingest at `/api/otlp/v1/traces`,
  deterministic per-trace sampling, per-org retention, and pivots from any
  span into its SQL query history. All three SDKs expose language-native
  span APIs with W3C traceparent propagation. See
  [`backend/docs/TRACING.md`](backend/docs/TRACING.md).
- **Query workbench** — server-persisted multi-tab editor state, per-user
  query history, workspace-shared saved queries and snippets (with
  recursive `$snippet:name$` expansion). See
  [`backend/docs/QUERY_WORKBENCH.md`](backend/docs/QUERY_WORKBENCH.md).
- **Schema diff** — compare two Postgres connections and get a reviewable
  migration script; works on any Postgres 12+ with no extensions. See
  [`backend/docs/SCHEMA_DIFF.md`](backend/docs/SCHEMA_DIFF.md).
- **Cloud-managed DB insights** — per-workspace cloud credentials (encrypted
  at rest with `ENCRYPTION_KEY`) drive metric collection from managed
  databases: Amazon RDS / Aurora via CloudWatch (SigV4, no AWS SDK) and
  MongoDB Atlas via the Atlas Administration API (HTTP Digest auth). Managed
  through `/api/cloud/*`; credentials are stored in
  `pgmonitoringtool.cloud_provider_credentials` and resolved per request so a
  workspace can never read another tenant's keys. AWS falls back to the legacy
  process-env vars when no workspace credential exists.
- **Statistical anomaly detection** — scalar metrics (connections, cache-hit
  ratio, replication lag, blocking locks, disk, slow-query count) are fed
  through the rolling z-score / EWMA / MAD detectors during each monitoring
  pass, catching values that are anomalous relative to their own baseline even
  when within static thresholds. Off by default; enable with
  `FATHOM_ANOMALY_MODE=suggest|page` (`suggest` records an informational
  alert; `page` fires a warning that fans out to integrations). Tunable via
  `FATHOM_ANOMALY_TYPE` (zscore|ewma|mad) and `FATHOM_ANOMALY_WINDOW`.
- **Streaming AI copilot** — the SQL copilot and EXPLAIN-plan reviewer support
  token-by-token Server-Sent Events at `POST /api/copilot/sql/stream` and
  `POST /api/copilot/explain/stream` (OpenAI and Anthropic providers stream
  natively; the local stub chunks its deterministic output for dev). Each
  stream emits `data: {"delta":"..."}` chunks followed by a
  `data: {"done":true,...}` sentinel carrying the final SQL + safety guard
  (or plan review).
- **Predictive VACUUM advisor** — beyond reporting current bloat, forecasts
  _when_ autovacuum will next fire on each table. It estimates the dead-tuple
  growth rate from the time since the last (auto)vacuum and the computed trigger
  threshold (`autovacuum_vacuum_threshold + scale_factor * n_live_tup`), then
  ranks tables **overdue / soon / watch / ok** with an ETA. Endpoint:
  `GET /api/advisor/bloat/forecast?connectionId=&schema=`.
- **Plan-regression detection (auto_explain Log Insights)** — fingerprints each
  captured plan by its structure (node types, relations, index/join kinds;
  costs and timings ignored) and flags queries whose current plan is materially
  slower than a faster plan they used earlier in the window, reporting baseline
  vs. current mean times and the slowdown percentage. Endpoint:
  `GET /api/auto-explain/regressions?connectionId=&from=&to=` (alongside the
  ingest, `recent`, and `summary` endpoints).
- **Tiered metric retention + rollups** — keeps long history at lower resolution
  instead of deleting it. Raw `otel_metrics` are downsampled hourly then daily
  (`metric_rollups_1h` / `_1d`), and reads auto-select the coarsest tier that
  covers the requested window. Tiers are env-tunable
  (`FATHOM_METRICS_RAW_DAYS`=7, `FATHOM_METRICS_HOURLY_DAYS`=90,
  `FATHOM_METRICS_DAILY_DAYS`=730). Rollups run hourly and pruning daily; trigger
  manually via `POST /api/retention/rollup` and read via
  `GET /api/retention/rollup/metrics?name=&from=&to=`.
- **Point-in-time-recovery planning** — a catalog of base backups
  (`base_backups`) and archived WAL segments (`wal_archive`) drives a recovery
  planner: `GET /api/backups/pitr/window` returns the earliest-to-latest
  restorable time, and `GET /api/backups/pitr/plan?connectionId=&target=` returns
  the exact base backup plus WAL segments to replay (and whether the target time
  is reachable). Catalog writers: `POST /api/backups/pitr/base` and `/wal`. The
  pg_basebackup / WAL-archiving execution is driven separately; this is the
  catalog and planner a restore workflow builds on.
