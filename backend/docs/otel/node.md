# Node.js — OTel to FATHOM

Targets `pg` ≥ 8 and `@opentelemetry/api` ≥ 1.7. Works with `pg-pool`,
`pg-promise`, and `drizzle-orm` (they all delegate to `pg`).

## Option A — application_name (recommended)

Set the session's `application_name` to the active W3C traceparent whenever
a new connection is checked out. FATHOM decodes this off `pg_stat_activity`.

```js
import pg from 'pg';
import { trace, context } from '@opentelemetry/api';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function currentTraceparent() {
    const span = trace.getSpan(context.active());
    if (!span) return null;
    const ctx = span.spanContext();
    if (!ctx.traceId || !ctx.spanId) return null;
    const flags = (ctx.traceFlags ?? 0).toString(16).padStart(2, '0');
    return `00-${ctx.traceId}-${ctx.spanId}-${flags}`;
}

pool.on('connect', (client) => {
    // One-shot per new physical connection. The session-level SET persists
    // until the connection is recycled, which is fine — FATHOM only needs the
    // most recent traceparent during the slow-query window.
    client
        .query('SET application_name = $1', [`traceparent:${currentTraceparent() ?? '00-unknown-unknown-00'}`])
        .catch(() => {
            /* best-effort */
        });
});
```

If your pool is long-lived (typical in web apps), you'll want to refresh
the `application_name` on every `pool.query()` rather than once per
connect — wrap `query` in a helper that issues a `SET LOCAL
application_name = ...` inside a transaction, or use Option B below.

## Option B — SQL comment

Prepend a comment to each query. Works for one-off queries and for ORMs
that accept a query hook.

```js
import { trace, context } from '@opentelemetry/api';

function tag(sql) {
    const span = trace.getSpan(context.active());
    if (!span) return sql;
    const { traceId, spanId, traceFlags } = span.spanContext();
    const flags = (traceFlags ?? 0).toString(16).padStart(2, '0');
    return `/* traceparent='00-${traceId}-${spanId}-${flags}' */ ${sql}`;
}

// Example
const { rows } = await pool.query(tag('SELECT * FROM orders WHERE id = $1'), [id]);
```

### Drizzle

```js
import { sql } from 'drizzle-orm';
await db.execute(sql.raw(tag('SELECT ...')));
```

### pg-promise

```js
db.query(tag('SELECT ...'), params);
```

## Verify

1. Issue a request that hits the database.
2. In FATHOM → Query Details, the slow query's row should show a
   "Trace" column with a link that matches the span in your APM.
3. If not, check `pg_stat_activity.application_name` — it should begin
   with `traceparent:`.
