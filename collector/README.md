# pulsedb-collector

Managed monitoring agent for PulseDB. Installs once per host, auto-discovers
Postgres targets, and ships wait-event samples + pg_stat_statements snapshots
to your PulseDB instance over HTTPS (`x-sdk-key` auth).

## Quick start

```sh
npm install            # installs the single dependency (pg)
PULSEDB_URL=https://your-pulsedb.example \
PULSEDB_SDK_KEY=sk_your_key \
node pulsedb-collector.mjs --dsn postgres://user:pass@db-host:5432/app
```

## Configuration

| Env var                | Default      | Purpose                           |
| ---------------------- | ------------ | --------------------------------- |
| `PULSEDB_URL`           | — (required) | Base URL of your PulseDB backend   |
| `PULSEDB_SDK_KEY`       | — (required) | SDK key (Admin → SDK Integration) |
| `PULSEDB_TARGETS`       | auto         | Comma-separated Postgres DSNs     |
| `PULSEDB_CONNECTION_ID` | host:port/db | Connection label in PulseDB        |
| `PULSEDB_INTERVAL_MS`   | 10000        | Wait-event sampling interval      |
| `PULSEDB_STATS_EVERY`   | 6            | Ship query stats every N ticks    |

Without flags or `PULSEDB_TARGETS`, the collector falls back to
`DATABASE_URL`, then the libpq env vars (`PGHOST`/`PGPORT`/...), then
`localhost:5432`.

## systemd

```ini
[Unit]
Description=PulseDB collector
After=network-online.target

[Service]
Environment=PULSEDB_URL=https://your-pulsedb.example
Environment=PULSEDB_SDK_KEY=sk_your_key
ExecStart=/usr/bin/node /opt/pulsedb-collector/pulsedb-collector.mjs
Restart=always

[Install]
WantedBy=multi-user.target
```
