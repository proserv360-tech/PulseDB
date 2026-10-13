# Python — OTel to FATHOM

Targets `psycopg` (≥ 3) and `psycopg2`, with examples for SQLAlchemy and
Django. Requires `opentelemetry-api` ≥ 1.24.

## Option A — application_name (recommended)

The simplest place to set this is on every checkout from the connection
pool. With `psycopg_pool.ConnectionPool`:

```python
from opentelemetry import trace
import psycopg_pool

def _current_traceparent() -> str:
    span = trace.get_current_span()
    ctx = span.get_span_context()
    if not ctx.is_valid:
        return "00-unknown-unknown-00"
    flags = f"{ctx.trace_flags:02x}"
    return f"00-{ctx.trace_id:032x}-{ctx.span_id:016x}-{flags}"

def on_check_out(conn):
    with conn.cursor() as cur:
        cur.execute("SET application_name = %s",
                    (f"traceparent:{_current_traceparent()}",))

pool = psycopg_pool.ConnectionPool(
    conninfo=DATABASE_URL,
    configure=on_check_out,
    min_size=2,
    max_size=10,
)
```

For `psycopg2` + SQLAlchemy, use the `do_connect` event:

```python
from sqlalchemy import event

@event.listens_for(engine, "connect")
def set_app_name(dbapi_conn, _):
    with dbapi_conn.cursor() as cur:
        cur.execute("SET application_name = %s",
                    (f"traceparent:{_current_traceparent()}",))
```

## Option B — SQL comment

Wrap queries with a tagger function. This is what `sqlcommenter` does, and
you can use that library directly if you're already on
`opentelemetry-instrumentation-sqlcommenter-*`:

```python
# pip install opentelemetry-instrumentation-psycopg
from opentelemetry.instrumentation.psycopg import PsycopgInstrumentor

PsycopgInstrumentor().instrument(
    enable_commenter=True,
    commenter_options={"opentelemetry_values": True},
)
```

This produces queries like:

```sql
SELECT * FROM orders /*traceparent='00-...-...-01'*/
```

FATHOM's parser handles both leading and trailing comments.

### Django

`django.db.backends.postgresql` with the instrumentation above works
out of the box; no per-view changes needed.

## Verify

After enabling, issue a request. In FATHOM the corresponding slow query
should render with its traceparent. If the comment is not appearing,
confirm your `OTEL_PYTHON_LOG_CORRELATION=true` env var and that the
tracer provider is initialised _before_ engine creation.
