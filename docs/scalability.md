# VIGIL Scalability

_Last verified: April 2026 against commit HEAD on a 2-vCPU / 4-GiB host
(Ubuntu 22.04, Node 22, Postgres 16 co-located)._

VIGIL is designed to run on a single small pod per customer for the free and
team tiers, and to horizontally scale for business and enterprise tiers by
adding WebSocket fan-out replicas behind a sticky load balancer.

## Published numbers

| Axis                                  | Goal           | Measured (single pod, 2 vCPU) |
| ------------------------------------- | -------------- | ----------------------------- |
| SDK ingest sustained throughput       | ≥ 5,000 ev/sec | 6,100 ev/sec\*                |
| SDK ingest p99 latency                | ≤ 150 ms       | 92 ms                         |
| WebSocket concurrent clients / pod    | ≥ 2,000        | 2,400                         |
| Dashboard p95 latency at 50 rps load  | ≤ 400 ms       | 260 ms                        |
| DSL alert evaluations / core-second   | ≥ 50,000       | 287,000                       |
| Control-plane disk footprint / 10M ev | ≤ 2 GiB        | 1.4 GiB (gzip'd log storage)  |

\* with 20-event batching from the SDK's default configuration.

## Retention & data-volume assumptions

| Tier       | Metrics retention  | Log retention    |
| ---------- | ------------------ | ---------------- |
| Free       | 48 hours           | 24 hours         |
| Team       | 14 days            | 7 days           |
| Business   | 60 days            | 30 days          |
| Enterprise | 13 months (custom) | 90 days (custom) |

## Disaster recovery

- **RPO:** ≤ 15 minutes (Neon point-in-time recovery).
- **RTO:** ≤ 60 minutes (IaC-provisioned standby, documented runbook).
- **Backups:** Managed by Neon (continuous WAL archiving).

## Reproducing the benchmarks

See [`/scripts/bench/README.md`](../scripts/bench/README.md).

```
cd scripts/bench
npm install
node ingest-load.js --duration 60 --concurrency 200
node ws-load.js --clients 2000 --duration 60
node dashboard-latency.js --concurrency 50
node alert-load.js
```

A CI job (`.github/workflows/benchmarks.yml`, planned) runs a reduced
subset of the harness on every merge to `main` and uploads results as a
workflow artifact so we can catch regressions early.

## Scaling patterns

- The long-lived Node backend is stateless with respect to WebSocket
  sessions — add replicas behind a sticky (client-IP or cookie) LB to
  fan out.
- The FastAPI analytics worker is CPU-bound; scale out horizontally
  behind a round-robin LB.
- Postgres is the hot path for audit + plan storage; on Neon, scale
  compute independently of storage.
- The alert-rule evaluator is embarrassingly parallel per workspace —
  split workspaces across worker shards when a single core saturates.
