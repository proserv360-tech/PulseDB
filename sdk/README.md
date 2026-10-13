# FATHOM SDK

Lightweight JavaScript SDK for integrating your applications with the FATHOM observability platform. Send API logs, errors, metrics, and audit events directly to your FATHOM dashboard.

**Zero dependencies • ESM + CJS • Browser & Node.js compatible**

---

## Quick Start

### Installation

```bash
npm install @fathom/sdk
```

### Basic Setup

```javascript
import FathomSDK from '@fathom/sdk';

const fathom = new FathomSDK({
    apiKey: 'sk_live_your_api_key_here',
    endpoint: 'https://fathom.example.com',
    appName: 'my-app',
    environment: 'production',
    debug: false,
});

// Start auto-flush timer
fathom.start();

// Track an API call
fathom.trackAPI({
    method: 'GET',
    endpoint: '/api/users',
    statusCode: 200,
    durationMs: 145,
});

// Gracefully shutdown
await fathom.shutdown();
```

---

## Configuration Options

```javascript
const fathom = new FathomSDK({
    // ─── Required ───────────────────────────────────────
    apiKey: 'sk_live_xxx', // FATHOM API key (from dashboard)
    endpoint: 'https://fathom.app', // FATHOM instance URL

    // ─── Optional ───────────────────────────────────────
    appName: 'my-service', // App name (default: 'unnamed-app')
    environment: 'production', // 'production', 'staging', 'dev' (default: 'production')
    batchSize: 50, // Max events before auto-flush (default: 50)
    flushInterval: 10000, // Auto-flush interval in ms (default: 10000)
    debug: false, // Enable console logs (default: false)
});
```

---

## Usage

### Manual Event Tracking

#### Track API Calls

```javascript
fathom.trackAPI({
    method: 'POST',
    endpoint: '/api/orders',
    statusCode: 201,
    durationMs: 234,
    metadata: {
        userId: 'user_123',
        orderId: 'order_456',
    },
});
```

#### Track Errors

```javascript
// From an Error object
try {
    await riskyOperation();
} catch (error) {
    fathom.trackError({
        error,
        severity: 'error',
        metadata: { context: 'payment-processing' },
    });
}

// From a string or object
fathom.trackError({
    error: 'Database connection timeout',
    title: 'DB Connection Failed',
    severity: 'critical',
});
```

#### Track Audit Events

```javascript
fathom.trackAudit({
    title: 'User Permission Changed',
    message: 'Admin elevated user_123 to manager role',
    metadata: {
        adminId: 'admin_001',
        targetUser: 'user_123',
        previousRole: 'user',
        newRole: 'manager',
    },
    severity: 'info',
});
```

#### Track Metrics

```javascript
fathom.trackMetric({
    title: 'Database Connection Pool',
    value: 87,
    unit: '%',
    metadata: {
        maxConnections: 100,
        activeConnections: 87,
    },
});
```

#### Track Custom Events

```javascript
fathom.track('payment.completed', {
    title: 'Payment Processed',
    severity: 'info',
    message: 'Payment of $99.99 processed successfully',
    metadata: {
        transactionId: 'txn_789',
        amount: 99.99,
        currency: 'USD',
    },
    tags: ['payment', 'revenue'],
});
```

### Auto-Capture with Express

Use the built-in Express middleware to automatically track all HTTP requests:

```javascript
import express from 'express';
import FathomSDK from '@fathom/sdk';

const app = express();
const fathom = new FathomSDK({
    apiKey: 'sk_live_xxx',
    endpoint: 'https://fathom.app',
    appName: 'api-server',
    debug: true,
});

// Add FATHOM middleware
app.use(fathom.expressMiddleware());

// Your routes
app.get('/api/users', (req, res) => {
    res.json({ users: [] });
});

fathom.start();
app.listen(3000);
```

The middleware automatically captures:

- HTTP method and endpoint
- Response status code
- Request duration
- User-Agent
- Client IP address

### Uncaught Exception Handling

Automatically capture uncaught exceptions and unhandled promise rejections:

```javascript
fathom.captureUncaughtExceptions();

// Now all crashes are tracked
throw new Error('Something went very wrong!');
```

---

## Advanced Usage

### Manual Flushing

```javascript
// Manually flush the queue
await fathom.flush();
```

### Heartbeats

Send periodic health checks to FATHOM:

```javascript
// Send a heartbeat
await fathom.heartbeat('healthy', {
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
});

// Periodic heartbeats every 30 seconds
setInterval(() => {
    fathom.heartbeat('healthy');
}, 30000);
```

### Event Listeners

```javascript
// Listen to flush events
fathom.on('flush', ({ count, timestamp }) => {
    console.log(`Flushed ${count} events`);
});

// Listen to errors
fathom.on('error', ({ error, batch }) => {
    console.error('Failed to send batch:', error);
});

// Listen to shutdown
fathom.on('shutdown', ({ timestamp }) => {
    console.log('SDK shutdown complete');
});
```

### Graceful Shutdown

```javascript
process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await fathom.shutdown();
    process.exit(0);
});
```

---

## Integration Patterns

### MuleSoft Integration

Send events from a MuleSoft flow using HTTP request:

```xml
<http:request
  method="POST"
  config-ref="HTTP_Config"
  path="/api/sdk/ingest"
  doc:name="Send to FATHOM">
  <http:body>
    <![CDATA[
    %dw 2.0
    output application/json
    ---
    {
      events: [
        {
          type: "api",
          title: "MuleSoft Flow Executed",
          severity: "info",
          metadata: {
            flowName: vars.flowName,
            duration: vars.duration,
            status: payload.status
          },
          timestamp: now() as String { format: "yyyy-MM-dd'T'HH:mm:ss.SSSZ" }
        }
      ]
    }
    ]]>
  </http:body>
  <http:headers>
    <http:header headerName="X-SDK-Key"><![CDATA[sk_live_xxx]]></http:header>
    <http:header headerName="Content-Type">application/json</http:header>
  </http:headers>
</http:request>
```

### Salesforce Apex REST Callout

Send events from Salesforce using HTTP callouts:

```apex
public class FathomCallout {
  public static void trackEvent(String title, String severity, Map<String, Object> metadata) {
    HttpRequest req = new HttpRequest();
    req.setEndpoint('https://fathom.app/api/sdk/ingest');
    req.setMethod('POST');
    req.setHeader('Content-Type', 'application/json');
    req.setHeader('X-SDK-Key', 'sk_live_xxx');

    Map<String, Object> event = new Map<String, Object>{
      'type' => 'audit',
      'title' => title,
      'severity' => severity,
      'metadata' => metadata,
      'timestamp' => DateTime.now().formatGmt('yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\'')
    };

    Map<String, Object> body = new Map<String, Object>{
      'events' => new List<Map<String, Object>>{ event }
    };

    req.setBody(JSON.serialize(body));
    Http http = new Http();
    HttpResponse res = http.send(req);
    System.debug('Response: ' + res.getStatusCode());
  }
}
```

Usage in Apex:

```apex
FathomCallout.trackEvent(
  'Opportunity Closed',
  'info',
  new Map<String, Object>{
    'opportunityId' => opp.Id,
    'amount' => opp.Amount,
    'stage' => opp.StageName
  }
);
```

---

## Batching and Performance

Events are batched for performance:

1. **Auto-flush by count**: When `batchSize` events accumulate, they flush immediately
2. **Auto-flush by time**: Events flush periodically (every `flushInterval` ms)
3. **Manual flush**: Call `fathom.flush()` at any time

Default behavior: 50 events per batch, flush every 10 seconds.

Tune for your use case:

```javascript
const fathom = new FathomSDK({
    apiKey: 'sk_live_xxx',
    endpoint: 'https://fathom.app',
    batchSize: 100, // Larger batches = fewer requests
    flushInterval: 20000, // Longer intervals = better latency
});
```

---

## Error Handling

The SDK handles network errors gracefully:

- **Failed flush**: Events remain in queue and retry on next flush
- **Network timeout**: Warning logged, queue preserved
- **Invalid config**: Error thrown at initialization

Example with retry logic:

```javascript
try {
    await fathom.flush();
} catch (error) {
    console.error('Failed to flush:', error.message);
    // Events are automatically re-queued
}
```

---

## Environment Variables

Load configuration from environment:

```javascript
const fathom = new FathomSDK({
    apiKey: process.env.FATHOM_API_KEY,
    endpoint: process.env.FATHOM_ENDPOINT || 'https://fathom.app',
    appName: process.env.APP_NAME || 'my-app',
    environment: process.env.NODE_ENV || 'production',
    debug: process.env.DEBUG === 'true',
});
```

**.env example:**

```
FATHOM_API_KEY=sk_live_xxx
FATHOM_ENDPOINT=https://fathom.example.com
APP_NAME=api-server
NODE_ENV=production
```

---

## Browser Support

The SDK works in modern browsers (with `fetch` support):

```javascript
// In a browser app
const fathom = new FathomSDK({
    apiKey: 'sk_live_xxx',
    endpoint: 'https://fathom.app',
    appName: 'web-app',
});

// Track user interactions
document.addEventListener('click', (event) => {
    fathom.track('user.interaction', {
        title: 'User Click',
        metadata: { target: event.target.tagName },
    });
});
```

---

## API Reference

### Constructor

```javascript
new FathomSDK(options);
```

| Option          | Type    | Required | Default         | Description         |
| --------------- | ------- | -------- | --------------- | ------------------- |
| `apiKey`        | string  | Yes      | -               | FATHOM API key      |
| `endpoint`      | string  | Yes      | -               | FATHOM instance URL |
| `appName`       | string  | No       | `'unnamed-app'` | Application name    |
| `environment`   | string  | No       | `'production'`  | Environment name    |
| `batchSize`     | number  | No       | `50`            | Events per batch    |
| `flushInterval` | number  | No       | `10000`         | Flush interval (ms) |
| `debug`         | boolean | No       | `false`         | Enable logging      |

### Methods

#### `trackAPI(options)`

Track an API request/response.

```javascript
trackAPI({
    method: 'GET', // HTTP method
    endpoint: '/api/users', // URL/path
    statusCode: 200, // Response status
    durationMs: 145, // Request duration (ms)
    metadata: {}, // Additional data
});
```

#### `trackError(options)`

Track an error or exception.

```javascript
trackError({
    error: Error | string, // Error object or message
    title: 'string', // Event title
    severity: 'error', // 'info', 'warning', 'error', 'critical'
    metadata: {}, // Additional data
});
```

#### `trackAudit(options)`

Track an audit event (e.g., permission changes, logins).

```javascript
trackAudit({
    title: 'string', // Event title
    message: 'string', // Detailed message
    severity: 'info', // Event severity
    metadata: {}, // Additional data
});
```

#### `trackMetric(options)`

Track a numeric metric.

```javascript
trackMetric({
    title: 'string', // Metric name
    value: 87, // Numeric value
    unit: '%', // Unit (optional)
    metadata: {}, // Additional data
});
```

#### `track(eventType, options)`

Track a custom event.

```javascript
track('payment.completed', {
    title: 'string',
    severity: 'info',
    message: 'string',
    metadata: {},
    tags: [],
});
```

#### `expressMiddleware()`

Returns Express middleware for auto-tracking HTTP requests.

```javascript
app.use(fathom.expressMiddleware());
```

#### `captureUncaughtExceptions()`

Automatically capture uncaught exceptions and unhandled rejections.

```javascript
fathom.captureUncaughtExceptions();
```

#### `start()`

Start the auto-flush timer.

```javascript
fathom.start();
```

#### `flush()`

Manually flush the event queue.

```javascript
await fathom.flush();
```

#### `heartbeat(status, metadata)`

Send a heartbeat to FATHOM.

```javascript
await fathom.heartbeat('healthy', { uptime: 3600 });
```

#### `shutdown()`

Stop auto-flush and flush remaining events.

```javascript
await fathom.shutdown();
```

---

## Event Types

Built-in event types:

- `api` — HTTP API calls
- `error` — Exceptions and errors
- `audit` — Audit trail events
- `metric` — Numeric metrics
- Custom types — Any string you define

All events include:

- `timestamp` — ISO 8601 timestamp
- `severity` — 'info', 'warning', 'error', 'critical'
- `sessionId` — Unique session identifier
- `appName` — Application name
- `environment` — Environment name
- `metadata` — Event-specific data

---

## License

MIT

---

## Support

For issues, feature requests, or integrations, visit:

- **Dashboard**: https://fathom.app
- **Docs**: https://docs.fathom.app
- **Email**: support@fathom.app
