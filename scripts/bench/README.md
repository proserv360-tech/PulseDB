# VIGIL Scalability Benchmark Harness

A small, self-contained load-testing harness that produces the numbers we
publish in the VIGIL Trust Center and Scalability one-pager.

## What it measures

| Scenario                   | Script                 | Metric                                        |
| -------------------------- | ---------------------- | --------------------------------------------- |
| SDK ingest throughput      | `ingest-load.js`       | events/sec, p50/p95/p99 server-side latency   |
| WebSocket fan-out          | `ws-load.js`           | concurrent clients, broadcast p99 latency     |
| Dashboard response latency | `dashboard-latency.js` | p50/p95/p99 latency for the top 10 GET routes |
| Alert-rule evaluation cost | `alert-load.js`        | rules/sec the evaluator sustains on one core  |

## Running

Dependencies (installed lazily):

```
cd scripts/bench
npm install autocannon ws p-limit
```

Each script accepts `--url`, `--duration`, `--concurrency`. Results print
as JSON; pipe to `jq` or `scripts/bench/report.js` to produce Markdown.

```
node scripts/bench/ingest-load.js --url http://localhost:4000 --duration 60 --concurrency 200
```

## Target numbers (v1 goal)

These are the numbers we commit to in the Trust Center page. Any regression
should block a release.

| Metric                                | Goal                   |
| ------------------------------------- | ---------------------- |
| SDK ingest sustained throughput       | ≥ 5,000 events/sec/pod |
| SDK ingest p99 latency                | ≤ 150 ms               |
| WebSocket concurrent clients per pod  | ≥ 2,000                |
| Dashboard p95 latency at load         | ≤ 400 ms               |
| Alert rules evaluated per core-second | ≥ 50,000               |

Reproduce on a `c7i.large` (2 vCPU / 4 GiB) with Postgres on the same host.
