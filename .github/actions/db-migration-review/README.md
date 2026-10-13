# FATHOM DB Migration Review Action

Scan SQL migration files changed in a pull request and post a consolidated
review comment on the PR. Built and maintained by
[FATHOM](https://fathom.example.com).

## What it catches

| Rule ID                | Engines        | Why it matters                                                  |
| ---------------------- | -------------- | --------------------------------------------------------------- |
| `destructive-drop`     | postgres/mysql | `DROP` without `IF EXISTS` breaks idempotency.                  |
| `drop-column`          | postgres/mysql | Takes AccessExclusiveLock; can stall traffic on big tables.     |
| `non-concurrent-index` | postgres       | `CREATE INDEX` without `CONCURRENTLY` blocks writes.            |
| `concurrent-in-tx`     | postgres       | Heads-up that `CONCURRENTLY` must not run inside a transaction. |
| `set-not-null`         | postgres       | Full-table scan + AccessExclusiveLock unless staged.            |
| `type-change`          | postgres/mysql | Type change may rewrite the table.                              |
| `add-column-default`   | postgres       | Safe on PG11+ **only** with immutable default.                  |
| `truncate`             | postgres/mysql | Never truncate from a migration.                                |
| `grant-revoke`         | postgres/mysql | Privilege drift heads-up.                                       |
| `mongo-drop`           | mongo          | Destructive Mongo collection/db drop.                           |

## Usage

```yaml
name: DB migration review
on: pull_request
jobs:
    review:
        runs-on: ubuntu-latest
        permissions:
            contents: read
            pull-requests: write
        steps:
            - uses: actions/checkout@v4
              with: { fetch-depth: 0 }
            - uses: fathom-io/fathom/.github/actions/db-migration-review@main
              with:
                  migrations-glob: 'db/migrations/**/*.sql'
                  engine: postgres
                  block-on-error: 'true'
```

## Options

| Input              | Default                  | Description                                            |
| ------------------ | ------------------------ | ------------------------------------------------------ |
| `migrations-glob`  | `db/migrations/**/*.sql` | Which files to scan.                                   |
| `engine`           | `postgres`               | `postgres`, `mysql`, or `mongo`.                       |
| `block-on-error`   | `false`                  | Fail the job when any ERROR-level finding is produced. |
| `fathom-api-url`   | _(empty)_                | Optional — also ship findings to a FATHOM workspace.   |
| `fathom-api-token` | _(empty)_                | Paired with `fathom-api-url`.                          |

## Output

The action writes `/tmp/findings.json` in this shape:

```json
{
    "engine": "postgres",
    "generatedAt": "2026-04-21T14:10:03Z",
    "fileCount": 3,
    "counts": { "error": 1, "warn": 2 },
    "findings": [
        {
            "file": "db/migrations/0042_add_index.sql",
            "statementIndex": 1,
            "ruleId": "non-concurrent-index",
            "level": "error",
            "message": "CREATE INDEX without CONCURRENTLY locks writes on the table.",
            "fix": "Use CREATE INDEX CONCURRENTLY (cannot be inside a transaction block).",
            "snippet": "CREATE INDEX events_ts_idx ON events (ts)"
        }
    ]
}
```

## Local dry-run

```bash
cd .github/actions/db-migration-review
printf '%s\n' db/migrations/*.sql > /tmp/targets.txt
node lint.mjs --engine=postgre
```
