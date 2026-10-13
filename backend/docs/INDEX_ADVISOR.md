# FATHOM — Postgres Index Advisor

The index advisor inspects a monitored Postgres connection and surfaces three
categories of index problems: **unused** indexes (wasting disk + write I/O),
**redundant** indexes (one index's leading columns are a prefix of another on
the same table), and **missing** indexes (expensive queries from
`pg_stat_statements` whose predicates have no matching index).

It **never executes DDL**. Every endpoint returns a generated statement that an
admin can review and run manually — the service is a read + recommend surface
only.

## Endpoints

All endpoints are mounted under the standard API prefix and gated by
`authenticate` + `resolveWorkspace` + `requireWorkspaceRole('viewer')` for
reads. They accept the same `connectionId` the rest of FATHOM uses to select a
monitored Postgres pool.

### `GET /advisor/indexes/unused`

Lists indexes whose `pg_stat_user_indexes.idx_scan` is `0` and that are **not**
backing a primary key or unique constraint. Primary keys and unique
constraint-supporting indexes are always retained — dropping them would break
schema invariants.

```
GET /advisor/indexes/unused?connectionId=<id>
```

Response:

```json
{
    "unused": [
        {
            "schema": "public",
            "table": "events",
            "name": "idx_events_legacy_user",
            "sizeBytes": 8523776,
            "estimatedRows": 120340,
            "dropStatement": "DROP INDEX CONCURRENTLY IF EXISTS \"public\".\"idx_events_legacy_user\";"
        }
    ]
}
```

### `GET /advisor/indexes/redundant`

Returns pairs where one index's leading columns form a prefix of another's on
the same table. The smaller/narrower index is the drop candidate.

```
GET /advisor/indexes/redundant?connectionId=<id>
```

Each row includes `covers` (the superset index name) and a generated
`dropStatement` for the redundant one.

### `GET /advisor/indexes/suggestions`

Reads `pg_stat_statements`, parses `WHERE` and `JOIN` predicates heuristically,
and recommends new indexes for high-cost queries whose predicate columns are
not already covered by an existing index. Requires the `pg_stat_statements`
extension; if missing, the response includes an `advisory` field explaining how
to enable it and returns an empty `suggestions` array instead of erroring.

```
GET /advisor/indexes/suggestions?connectionId=<id>&minCalls=50&minMeanMs=100
```

| Param       | Default | Meaning                                             |
| ----------- | ------- | --------------------------------------------------- |
| `minCalls`  | `50`    | Ignore queries called fewer than N times.           |
| `minMeanMs` | `100`   | Ignore queries with mean execution time below N ms. |

Response:

```json
{
    "suggestions": [
        {
            "table": "orders",
            "columns": ["user_id", "created_at"],
            "reason": "WHERE user_id = $1 AND created_at > $2 — no matching index",
            "exampleQuery": "SELECT ... FROM orders WHERE user_id = ? AND created_at > ?",
            "calls": 1840,
            "meanTimeMs": 220,
            "estImpact": 0.87,
            "createStatement": "CREATE INDEX CONCURRENTLY ON \"orders\" (\"user_id\", \"created_at\");"
        }
    ],
    "advisory": null
}
```

`estImpact` is `calls * meanTimeMs` normalized across the result set.

### `POST /advisor/indexes/preview`

Generates a `CREATE INDEX CONCURRENTLY` statement for arbitrary inputs without
touching `pg_stat_statements`. Useful for building an ad-hoc suggestion from
the UI.

```
POST /advisor/indexes/preview
{
  "table": "orders",
  "columns": ["customer_id", "status"],
  "unique": false,
  "using": "btree"
}
```

Response echoes the inputs plus `createStatement`. Returns `400` if `table` is
missing or `columns` is empty.

## Safety

- Every DDL the service generates uses `CONCURRENTLY` (both `CREATE` and
  `DROP`) to avoid long exclusive locks.
- All identifiers are double-quoted to tolerate mixed-case and reserved words.
- The service **never** runs DDL. A human must execute the statements.
- `pg_catalog` and `information_schema` are excluded from every scan.

## Extensions used

| Extension            | Required? | Behaviour if missing                     |
| -------------------- | --------- | ---------------------------------------- |
| `pg_stat_statements` | optional  | `/suggestions` returns empty + advisory. |

No extra privileges beyond normal connection grants are required for the
`unused` / `redundant` scans — `pg_stat_user_indexes` and `pg_indexes` are
readable by any role with `USAGE` on the target schemas.
