# Go — OTel to FATHOM

Targets `pgx` v5 (native) and `database/sql`-wrapped drivers. Requires
`go.opentelemetry.io/otel` ≥ 1.24.

## Option A — application_name (recommended)

`pgx.Pool` calls `BeforeAcquire` every time a caller checks out a
connection — the perfect hook for rotating the traceparent:

```go
import (
    "context"
    "fmt"

    "github.com/jackc/pgx/v5"
    "github.com/jackc/pgx/v5/pgxpool"
    "go.opentelemetry.io/otel/trace"
)

func traceparent(ctx context.Context) string {
    sc := trace.SpanContextFromContext(ctx)
    if !sc.IsValid() {
        return "00-unknown-unknown-00"
    }
    return fmt.Sprintf("00-%s-%s-%02x",
        sc.TraceID().String(), sc.SpanID().String(), sc.TraceFlags())
}

func newPool(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
    cfg, err := pgxpool.ParseConfig(dsn)
    if err != nil {
        return nil, err
    }
    cfg.BeforeAcquire = func(ctx context.Context, c *pgx.Conn) bool {
        _, _ = c.Exec(ctx, "SET application_name = $1",
            "traceparent:"+traceparent(ctx))
        return true
    }
    return pgxpool.NewWithConfig(ctx, cfg)
}
```

For `database/sql` + pgx stdlib, the same approach goes into a
`driver.Connector` wrapper; the pattern is the same, just plumbed
through the stdlib interface.

## Option B — SQL comment

Prepend a comment at call sites. If you prefer library support:

```go
import "github.com/google/sqlcommenter/go/core"

query := core.AddComment(ctx, "SELECT * FROM orders WHERE id = $1",
    core.Options{IncludeTraceparent: true})
rows, err := pool.Query(ctx, query, id)
```

The comment shape matches what FATHOM's log parser expects:

```sql
/*traceparent='00-...-...-01'*/ SELECT * FROM orders WHERE id = $1
```

## `context.Context` propagation

Both options depend on the calling goroutine having an OTel-aware
`context.Context`. If you acquire connections from a goroutine that
doesn't carry request context (background workers, cron jobs), use
`trace.ContextWithSpan(ctx, span)` to attach the worker's span before
calling `pool.Acquire`.

## Verify

```
SELECT application_name, pid, state
  FROM pg_stat_activity
 WHERE usename = current_user;
```

`application_name` should begin with `traceparent:`. Then in FATHOM →
Query Details, slow queries will render a "Trace" column link.
