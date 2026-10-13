# OpenTelemetry Instrumentation for FATHOM Trace Correlation

FATHOM's trace-correlation feature ties a slow SQL query back to the HTTP
request that issued it. For that to work, your application must propagate
a W3C `traceparent` down to Postgres. There are two supported mechanisms,
either of which is enough on its own:

1. **`application_name` encoding** — the app sets
   `application_name='traceparent:<traceparent>'` on the session.
   FATHOM reads `pg_stat_activity.application_name` and extracts the
   traceparent. Cheapest, works on managed Postgres, no SQL changes.

2. **SQL-comment encoding** — the app prepends a SQL comment of the form
   `/* traceparent='00-...-...-01' */ SELECT ...` to each query. FATHOM's
   log parser reads the comment off `pg_stat_statements.query`. Works
   even when `application_name` is used for something else, and gives
   per-query (not per-session) correlation.

Both encodings are understood by `parseTraceparent` and
`resolveTraceContext` in `backend/services/traceContext.js`.

The language-specific guides in this folder show how to wire both into
Node, Python, Java, and Go applications. They are each one page so
customers can paste them into their app teams' onboarding docs without
repackaging.

| Language | Guide                      |
| -------- | -------------------------- |
| Node.js  | [`node.md`](./node.md)     |
| Python   | [`python.md`](./python.md) |
| Java     | [`java.md`](./java.md)     |
| Go       | [`go.md`](./go.md)         |

All guides assume the application is already emitting OpenTelemetry spans
to _some_ collector; we are not introducing OTel here, only teaching the
app to propagate the active traceparent into Postgres.
