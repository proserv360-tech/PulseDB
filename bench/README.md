# FATHOM benchmark harness (C7)

Reproducible load tests against a running FATHOM web tier. Three
scenarios cover the hot paths identified by the gap analysis:

| Scenario            | What it loads                                    | Target                               |
| ------------------- | ------------------------------------------------ | ------------------------------------ |
| `otlp_ingest.js`    | `POST /api/otlp/v1/traces` with a 100-span batch | 1 000 spans/s sustained, p99 < 50 ms |
| `alerts_fire.js`    | `POST /api/alerts/run-monitoring` (cron path)    | Median dispatch < 2 s                |
| `dashboard_read.js` | Cycles a representative dashboard endpoint       | p95 < 250 ms                         |

Targets come from `FATHOM_Implementation_Plan_2026-06-02.docx` §7. They
are the public numbers we want to defend; CI runs a smaller smoke
version of each on every PR (commented in `bench/k6/smoke.js`).

## Running locally

```
# Install k6 (https://k6.io/docs/get-started/installation/)
brew install k6      # or apt-get / scoop equivalent

# Smoke a single scenario
k6 run \
  -e BASE_URL=http://localhost:5000 \
  -e SDK_KEY=$FATHOM_SDK_KEY \
  bench/k6/otlp_ingest.js

# Full sustained run (10 minutes per scenario)
k6 run -e DURATION=10m bench/k6/otlp_ingest.js
```

## CI gate

`.github/workflows/perf.yml` runs the smoke variants nightly against a
staging deployment. Failure to hit thresholds posts to Slack and creates
a tracking issue. Production load runs are manual — see the runbook
linked from `backend/docs/ARCHITECTURE.md`.

## Reporting

k6 emits a JSON summary and a Prometheus push. The dashboards live in
`bench/grafana/` (forthcoming). For one-off runs, the terminal output
plus k6's built-in textual summary is enough.
