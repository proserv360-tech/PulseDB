# PulseDB managed agent (Wave C — task C1)

A thin Go binary that runs on a host close to the monitored Postgres
instance, samples wait events and pg_stat_statements at a configurable
cadence, and forwards the data via the existing PulseDB SDK transport.

This closes the productisation gap with Datadog Agent / Percona PMM
client / pganalyze collector identified in the 2 June 2026 gap analysis.

## What's in this scaffold

- `agent/config.go` — runtime configuration, defaults + ENV + flags.
- `agent/runner.go` — collector lifecycle, shutdown handling.
- `agent/collectors/postgres/wait_events.go` — `pg_stat_activity` poller.
- `agent/collectors/postgres/query_stats.go` — `pg_stat_statements`
  poller with graceful no-op when the extension is missing.
- `cmd/pulsedb-agent/main.go` — binary entrypoint.
- `cmd/pulsedb-agent/forwarder.go` — SDK Transport adaptor.
- `agent/dist/pulsedb-agent.service` — SystemD unit.
- `agent/dist/agent.yaml.example` — config template.

## Out of scope (tracked separately)

- MySQL / MongoDB / host (cpu/mem/disk) collectors.
- Auto-update channel (cosign-signed binary, channel: stable | beta).
- Privilege drop after the initial pg_stat_statements scan.
- Per-cluster topology auto-discovery (B2 cluster member registration).

## Building

```sh
cd sdk/go
go build -o bin/pulsedb-agent ./cmd/pulsedb-agent
```

The binary is a single static file; the official release artifacts are
cosign-signed and ship for linux/{amd64, arm64} + darwin/{amd64, arm64}.

## Backend endpoints

The agent calls two new backend routes (added under C1):

```
POST /api/agent/wait-events   { samples: [...] }
POST /api/agent/query-stats   { stats:   [...] }
```

Both require the `x-sdk-key` header. The wait-event payload populates
`pgmonitoringtool.wait_event_samples`; the rollup task (A3) folds them
into the same `wait_event_rollups_5m` table the in-process sampler uses.
