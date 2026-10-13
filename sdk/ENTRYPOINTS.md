# FATHOM JS SDK — Two Entry Points

This package ships **two separate clients** with different wire contracts. They
are not interchangeable; pick the one that matches your task.

## 1. `FathomSDK` — telemetry / ingest client (canonical for app instrumentation)

- **Source:** `src/index.js`
- **Import:** `import FathomSDK from '@fathom/sdk';`
- **Auth header:** `X-SDK-Key`
- **Endpoints:**
    - `POST /api/sdk/ingest` — batched events
    - `POST /api/sdk/heartbeat` — liveness
    - `POST /api/otlp/v1/traces` — OTLP spans
- **Use it for:** sending events, errors, metrics, audits, traces, and Express
  request auto-capture from your application.

```js
import FathomSDK from '@fathom/sdk';

const sdk = new FathomSDK({
    apiKey: 'sk_live_xxx',
    endpoint: 'https://fathom.example.com',
    appName: 'my-api',
});

app.use(sdk.expressMiddleware());
sdk.trackMetric({ title: 'queue_depth', value: 42, unit: 'jobs' });
```

The flush timer starts automatically in the constructor (unref'd, so it won't
keep your process alive). Call `await sdk.shutdown()` on exit to drain.

### Reliability behavior

- Flushes retry with exponential backoff + jitter on network errors, `5xx`,
  and `429` (configurable via `maxRetries`, default 3).
- The event and span queues are bounded (`maxQueueSize`, default 10000). When
  full, the **oldest** events are dropped and a `dropped` event is emitted.
- `flush()` is guarded against concurrent (timer + overflow) invocations.

## 2. `FathomClient` — management / control-plane client

- **Source:** `src/core/client.js`
- **Import:** `import { FathomClient } from '@fathom/sdk/core/client.js';`
- **Auth header:** `X-API-Key` (plus optional JWT bearer + refresh)
- **Endpoints:** `/api/v1/*` (health, metrics, connections, query, ...)
- **Use it for:** programmatic control-plane operations — querying metrics,
  managing connections, running queries against the FATHOM API.

```js
import { FathomClient } from '@fathom/sdk/core/client.js';

const client = new FathomClient({
    baseUrl: 'https://api.fathom.example.com',
    apiKey: 'sk_test_xxx',
    orgId: 'org_123',
});
await client.connect();
const metrics = await client.getMetrics('postgresql', { timeRange: 3600 });
```

## Which one do I want?

| You want to...                          | Use            |
| --------------------------------------- | -------------- |
| Instrument an app, send events/traces   | `FathomSDK`    |
| Read metrics, manage connections, query | `FathomClient` |

If you import the wrong one you'll get a different auth header (`X-SDK-Key` vs
`X-API-Key`) and a different URL scheme, and requests will be rejected.
