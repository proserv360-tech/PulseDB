# FATHOM — Postgres Bloat & Vacuum Watcher

The bloat watcher estimates dead-tuple bloat on tables and indexes, surfaces
autovacuum lag, and generates vacuum DDL on demand. It **never runs
`VACUUM`** — admins inspect the preview and execute it themselves.

Two estimation strategies are supported, with automatic fallback:

1. **`pgstattuple_approx`** — accurate, extension-based. Used automatically
   when the `pgstattuple` extension is installed.
2. **Statistics-based heuristic** — page math over `pg_class.reltuples`,
   `pg_class.relpages`, and `pg_stats.avg_width`. Used on stock Postgres.

Every response labels which method produced it via `bloatMethod`.

## Endpoints

All endpoints are gated by `authenticate` + `resolveWorkspace`. Reads require
`viewer`; the vacuum-preview endpoint requires `admin`.

### `GET /advisor/bloat/tables`

```
GET /advisor/bloat/tables?connectionId=<id>&schema=public
```

Returns tables sorted by `bloatBytes` descending, filtered to `bloatBytes > 0`
and `relpages >= 128` (ignore tiny tables that can't really be bloated).

```json
{
    "schema": "public",
    "connectionId": "prod-primary",
    "tables": [
        {
            "schema": "public",
            "table": "events",
            "sizeBytes": 4.12e10,
            "liveBytes": 2.78e10,
            "deadBytes": 1.34e10,
            "bloatBytes": 1.34e10,
            "bloatRatio": 0.325,
            "bloatMethod": "pgstattuple"
        }
    ],
    "summary": {
        "totalTables": 12,
        "totalBloatBytes": 28471234,
        "maxBloatRatio": 0.42
    }
}
```

### `GET /advisor/bloat/indexes`

Same shape for indexes. The heuristic here is the standard index-bloat formula
over `pg_index` + `pg_statio_user_indexes` + `pg_stats`.

### `GET /advisor/bloat/autovacuum`

Surfaces tables where autovacuum is falling behind:

- `n_dead_tup > autovacuum_vacuum_threshold + autovacuum_vacuum_scale_factor * reltuples`, **OR**
- `last_autovacuum` older than 24 h AND `n_dead_tup > 1000`.

Each row is enriched with a `recommendation`:

```json
{
    "tables": [
        {
            "schema": "public",
            "table": "events",
            "nLiveTup": 8431022,
            "nDeadTup": 1240332,
            "deadTupRatio": 0.128,
            "lastVacuum": null,
            "lastAutovacuum": "2026-04-21T02:14:09.000Z",
            "lastAnalyze": null,
            "lastAutoanalyze": "2026-04-21T02:14:09.000Z",
            "recommendation": {
                "action": "VACUUM ANALYZE",
                "reason": "dead tuple ratio 12.8% above threshold, last autovacuum >24h ago"
            }
        }
    ],
    "summary": { "totalTables": 4, "totalDeadTups": 1_240_332, "tablesNeedingVacuum": 3 }
}
```

`recommendation.action` is one of:

| Action                   | When                                                  |
| ------------------------ | ----------------------------------------------------- |
| `none`                   | Autovacuum keeping up.                                |
| `ANALYZE`                | Stats stale but no meaningful bloat.                  |
| `VACUUM ANALYZE`         | Default suggestion when bloat or lag warrants vacuum. |
| `VACUUM (FULL, ANALYZE)` | Only when `bloatRatio > 0.4` AND `sizeBytes > 1 GiB`. |

`VACUUM FULL` takes an exclusive lock and rewrites the table; the watcher only
suggests it when the payoff is substantial.

### `POST /advisor/bloat/preview-vacuum`

Admin-only. Returns the DDL that would vacuum a given table — the service does
not execute it.

```
POST /advisor/bloat/preview-vacuum
{ "schema": "public", "table": "events", "full": false, "analyze": true }
```

Response:

```json
{
    "schema": "public",
    "table": "events",
    "full": false,
    "analyze": true,
    "ddl": "VACUUM (ANALYZE) \"public\".\"events\";",
    "warning": "Preview only. DDL is NOT executed automatically."
}
```

`400` if `table` is missing.

## Heuristic accuracy

The statistics-based fallback is a _lower bound_ on bloat. It assumes
worst-case fillfactor and uniform row width and tends to under-estimate on
tables with wide `TEXT`/`BYTEA` columns. If accuracy matters for a large
production database, install `pgstattuple`:

```sql
CREATE EXTENSION pgstattuple;
```

Thereafter the watcher automatically uses `pgstattuple_approx()` — accurate
within a few percent, cheap because it samples pages rather than reading all
of them.

## Safety

- `VACUUM` statements are never executed by the service.
- `VACUUM FULL` is only suggested above conservative thresholds.
- Schema/table identifiers are double-quoted in all generated DDL.
- `pg_catalog` / `information_schema` are excluded.
