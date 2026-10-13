# fathom-collector

Managed monitoring agent for FATHOM. Installs once per host, auto-discovers
Postgres targets, and ships wait-event samples + pg_stat_statements snapshots
to your FATHOM instance over HTTPS (`x-sdk-key` auth).

## Quick start

```sh
npm install            # installs the single dependency (pg)
FATHOM_URL=https://your-fathom.example \
FATHOM_SDK_KEY=sk_your_key \
node fathom-collector.mjs --dsn postgres://user:pass@db-host:5432/app
```

## Configuration

| Env var                | Default      | Purpose                           |
| ---------------------- | ------------ | --------------------------------- |
| `FATHOM_URL`           | — (required) | Base URL of your FATHOM backend   |
| `FATHOM_SDK_KEY`       | — (required) | SDK key (Admin → SDK Integration) |
| `FATHOM_TARGETS`       | auto         | Comma-separated Postgres DSNs     |
| `FATHOM_CONNECTION_ID` | host:port/db | Connection label in FATHOM        |
| `FATHOM_INTERVAL_MS`   | 10000        | Wait-event sampling interval      |
| `FATHOM_STATS_EVERY`   | 6            | Ship query stats every N ticks    |

Without flags or `FATHOM_TARGETS`, the collector falls back to
`DATABASE_URL`, then the libpq env vars (`PGHOST`/`PGPORT`/...), then
`localhost:5432`.

## systemd

```ini
[Unit]
Description=FATHOM collector
After=network-online.target

[Service]
Environment=FATHOM_URL=https://your-fathom.example
Environment=FATHOM_SDK_KEY=sk_your_key
ExecStart=/usr/bin/node /opt/fathom-collector/fathom-collector.mjs
Restart=always

[Install]
WantedBy=multi-user.target
```
