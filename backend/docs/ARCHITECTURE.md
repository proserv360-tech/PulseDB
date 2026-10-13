# FATHOM — Architecture

This document describes the current FATHOM process topology and the target
topology we are moving towards. It is the reference reviewers should cite
when refusing PRs that put long-running or bursty work in the web tier.

Last updated: 2026-06-02 (Wave A, task A6).

## Components

```
┌──────────────────────────────────────────────────────────────────────┐
│                              FATHOM                                  │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐   │
│  │   Frontend      │    │    Backend      │    │  Python worker  │   │
│  │   React 19 SPA  │◄──►│   Express 5     │◄──►│   FastAPI       │   │
│  │   Vite          │    │   WebSocket     │    │   Anomaly / ML  │   │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘   │
│                                  │                                   │
│                                  ▼                                   │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │             Control-plane Postgres (DATABASE_URL)            │    │
│  │  users, sessions, connections, audit, alerts, traces, …      │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                  │                                   │
│                                  ▼                                   │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │   Customer-monitored databases (PG, MySQL, Mongo, … 14×)     │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

## Today: single Node process

`backend/server.js` runs everything in one Node process:

- **Synchronous (per request)**: REST routes under `backend/routes/*`,
  WebSocket sessions in `services/sessionService.js`.
- **Cron-driven**: `node-cron` jobs for `alertService` (monitoring runs),
  `auditExport` (S3 dump), `retentionService` (sweep), `syntheticMonitor`
  (HTTP checks). All defined in `server.js`.
- **Streaming ingest**: `routes/otlpTraceRoutes.js` accepts OTLP/HTTP
  traces and inserts them synchronously via `services/otlpTraceService.js`.
- **In-process state**: rate-limit buckets (`middleware/rateLimiter.js`),
  cached IP allow-lists, alert dedup map.

### Source layout

`server.ts` is bootstrap only: it builds the Express app, registers
middleware and routes **in order**, and owns startup/shutdown. Everything
else lives in:

| Path | Contents |
| --- | --- |
| `core/` | Shared state and helpers: `config`, `adminPool` (control-plane DB), `connectionStore` (saved connections), `connectionPools` (pools for user DBs, `reqPool`/`getPool`), `activeSelection`, `auth` (`authenticate`, `issueSession`), `alerting`, `responseCache` (`cached`), `sqlGuard`, `loginLockout`, `queryHistory`, `backgroundJobs`, `websocket` |
| `middleware/` | `httpSecurity` (headers, rate limits, CSRF), `pgOnlyGuard`, `errorHandlers`, plus the pre-existing auth/RBAC middleware |
| `routes/index.ts` | Mounts the feature modules (`routes/*Routes.ts`) at `/api` and `/api/v1` |
| `routes/platform/` | Control-plane endpoints: auth, health, connections, fleet health, SQL console, alerts, AI proxy, CloudWatch |
| `routes/postgres/` | Postgres monitoring endpoints (tables, indexes, bloat, vacuum, optimizer, …), registered after `pgOnlyGuard` |

Registration order is significant: Express matches first-registered-wins,
and the `/api` middlewares (version header, IP allow-list, `pgOnlyGuard`)
only cover routes registered after them. Add new routes in the matching
slot in `server.ts`.

That topology is correct for development and for a single-tenant
deployment. It does not scale horizontally:

- The rate limiter is per process, so N replicas give N × the budget.
- `node-cron` fires in every replica, so monitoring runs and exports
  duplicate unless something else deduplicates them.
- A burst of OTLP traffic blocks the event loop, slowing REST responses
  for the same process.
- Killing the web tier loses any in-flight alert dispatches that
  haven't yet been recorded to Postgres.

## Target: web tier + worker tier + Python tier

```
                ┌────────────────────────────────────┐
                │           Load balancer            │
                └────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
   ┌────────────────────────┐    ┌────────────────────────┐
   │      web tier (N)      │    │     web tier (N)       │
   │  Express + WebSocket   │    │  Express + WebSocket   │
   │  Stateless, autoscale  │    │  Stateless, autoscale  │
   └────────────────────────┘    └────────────────────────┘
                │                               │
                └───────────────┬───────────────┘
                                │ enqueue
                                ▼
                ┌────────────────────────────────────┐
                │   Redis (queue + rate limit + LRU) │
                └────────────────────────────────────┘
                                │ consume
                ┌───────────────┴───────────────┐
                ▼                               ▼
   ┌────────────────────────┐    ┌────────────────────────┐
   │     worker tier (M)    │    │     worker tier (M)    │
   │  node-cron leader      │    │  OTLP ingest, alerts   │
   │  alerts, retention,    │    │  synthetic checks,     │
   │  audit export, copilot │    │  wait-event sampler    │
   │  purge                 │    │                        │
   └────────────────────────┘    └────────────────────────┘
                │
                ▼
   ┌────────────────────────┐
   │     Python worker      │
   │  Anomaly / ML / RCA    │
   │  (FastAPI, autoscale)  │
   └────────────────────────┘
```

### Web tier (`backend/server.js`)

- Stateless. No timers. No cron.
- Accepts REST + WebSocket.
- Validates input, applies RBAC, then either reads/writes Postgres
  directly (cheap, < 50 ms work) or **enqueues** a job and returns 202.
- The web tier is the only tier that talks to the browser. Frontend
  knows about no other URL.

### Worker tier (`backend/worker.js`, NEW)

- One leader per cluster runs scheduled jobs (`node-cron` with a Redis
  lock so only one replica fires per minute).
- All replicas consume work queues:
    - `otlp.ingest` — parse-and-insert spans.
    - `alerts.dispatch` — fan out to Slack / PagerDuty / webhook.
    - `synthetic.run` — execute a synthetic check.
    - `wait-events.sample` — poll a monitored Postgres connection.
    - `audit.export` — dump NDJSON to S3.
    - `copilot.purge` — purge conversation history past TTL.
- Workers can be killed at any time; jobs replay on restart.

### Python tier (`python/`)

- Anomaly detection, capacity forecast, ML-assisted RCA.
- Invoked from the worker tier via HTTP. Stateless except for the model
  artifacts it loads at startup.
- Autoscales independently — ML jobs are CPU/RAM-heavy and bursty.

### Queue and shared state

- **Redis** is the boundary between tiers. Used for:
    - **BullMQ queues** (or NATS JetStream if BullMQ becomes a bottleneck).
    - **Distributed rate limit** (Lua-atomic token bucket; see
      `middleware/rateLimiter.js`).
    - **Cron leader election** (SET NX EX).
    - **Short-lived caches** (IP allow-list, feature flags).
- Required in production. In dev, the queue falls back to in-process so
  `npm run dev` still works with one process.

## Migration sequencing

Mapped to the Wave plan in
`FATHOM_Implementation_Plan_2026-06-02.docx`:

1. **A1** — replace in-memory rate limiter with Redis-backed.
   _Unlocks the queue work that follows because Redis is now a hard
   dependency in prod._
2. **A3** — wait-event sampler runs in the current single process as a
   bare interval, with a `TODO` to migrate to the worker tier in B1.
3. **B1** — introduce `backend/worker.js` + `services/queue.js`. Move
   cron, alert dispatch, retention, audit export.
4. **B9** — move OTLP ingest behind the queue.
5. **C5** — proactive RCA: web tier enqueues `alerts.rca`, worker calls
   the Python tier, result is written back to the alert row.

## What goes where — quick reference

When reviewing a PR, ask: _would this be a problem if it ran in 10
replicas simultaneously?_ If yes, it belongs in a queue.

| Work                                             | Tier        |
| ------------------------------------------------ | ----------- |
| Returning data the browser is waiting on         | web         |
| Authentication, RBAC checks                      | web         |
| Reading or writing one row from control-plane DB | web         |
| Validating a connection at create-time (≤ 5 s)   | web         |
| Anything looped on a timer / cron                | worker      |
| Fan-out to Slack/Pager/webhook                   | worker      |
| Synthetic monitor polling                        | worker      |
| Wait-event sampling                              | worker      |
| OTLP / metrics ingest insertion                  | worker      |
| Audit log NDJSON export to S3                    | worker      |
| Copilot conversation purge                       | worker      |
| Anomaly detection, capacity forecast, ML RCA     | Python tier |
| Anything > 1 s of CPU time per call              | worker      |

## Open questions tracked elsewhere

- **Backups** — `BackupRecoveryTab.tsx` exists in the UI with no
  backend. Decision tracked in plan task B8.
- **Adapter capability negotiation** — the frontend currently switches
  on engine string; should switch on a declared capability set. Tracked
  as B6.
- **Engine focus** — supporting 14 adapters at depth is expensive.
  Tracked as C4.
