# PulseDB SDK

Lightweight JavaScript SDK for integrating your applications with the PulseDB observability platform. Send API logs, errors, metrics, and audit events directly to your PulseDB dashboard.

**Zero dependencies • ESM + CJS • Browser & Node.js compatible**

---

## Quick Start

### Installation

```bash
npm install @pulsedb/sdk
```

### Basic Setup

```javascript
import PulseDBSDK from '@pulsedb/sdk';

const pulsedb = new PulseDBSDK({
    apiKey: 'sk_live_your_api_key_here',
    endpoint: 'https://pulsedb.example.com',
    appName: 'my-app',
    environment: 'production',
    debug: false,
});

// Start auto-flush timer
pulsedb.start();

// Track an API call
pulsedb.trackAPI({
    method: 'GET',
    endpoint: '/api/users',
    statusCode: 200,
    durationMs: 145,
});

// Gracefully shutdown
await pulsedb.shutdown();
```

---

## Configuration Options

```javascript
const pulsedb = new PulseDBSDK({
    // ─── Required ───────────────────────────────────────
    apiKey: 'sk_live_xxx', // PulseDB API key (from dashboard)
    endpoint: 'https://pulsedb.app', // PulseDB instance URL

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
pulsedb.trackAPI({
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
    pulsedb.trackError({
        error,
        severity: 'error',
        metadata: { context: 'payment-processing' },
    });
}

// From a string or object
pulsedb.trackError({
    error: 'Database connection timeout',
    title: 'DB Connection Failed',
    severity: 'critical',
});
```

#### Track Audit Events

```javascript
pulsedb.trackAudit({
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
pulsedb.trackMetric({
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
pulsedb.track('payment.completed', {
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
import PulseDBSDK from '@pulsedb/sdk';

const app = express();
const pulsedb = new PulseDBSDK({
    apiKey: 'sk_live_xxx',
    endpoint: 'https://pulsedb.app',
    appName: 'api-server',
    debug: true,
});

// Add PulseDB middleware
app.use(pulsedb.expressMiddleware());

// Your routes
app.get('/api/users', (req, res) => {
    res.json({ users: [] });
});

pulsedb.start();
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
pulsedb.captureUncaughtExceptions();

// Now all crashes are tracked
throw new Error('Something went very wrong!');
```

---

## Advanced Usage

### Manual Flushing

```javascript
// Manually flush the queue
await pulsedb.flush();
```

### Heartbeats

Send periodic health checks to PulseDB:

```javascript
// Send a heartbeat
await pulsedb.heartbeat('healthy', {
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
});

// Periodic heartbeats every 30 seconds
setInterval(() => {
    pulsedb.heartbeat('healthy');
}, 30000);
```

### Event Listeners

```javascript
// Listen to flush events
pulsedb.on('flush', ({ count, timestamp }) => {
    console.log(`Flushed ${count} events`);
});

// Listen to errors
pulsedb.on('error', ({ error, batch }) => {
    console.error('Failed to send batch:', error);
});

// Listen to shutdown
pulsedb.on('shutdown', ({ timestamp }) => {
    console.log('SDK shutdown complete');
});
```

### Graceful Shutdown

```javascript
process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await pulsedb.shutdown();
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
  doc:name="Send to PulseDB">
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
public class PulseDBCallout {
  public static void trackEvent(String title, String severity, Map<String, Object> metadata) {
    HttpRequest req = new HttpRequest();
    req.setEndpoint('https://pulsedb.app/api/sdk/ingest');
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
PulseDBCallout.trackEvent(
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
3. **Manual flush**: Call `pulsedb.flush()` at any time

Default behavior: 50 events per batch, flush every 10 seconds.

Tune for your use case:

```javascript
const pulsedb = new PulseDBSDK({
    apiKey: 'sk_live_xxx',
    endpoint: 'https://pulsedb.app',
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
    await pulsedb.flush();
} catch (error) {
    console.error('Failed to flush:', error.message);
    // Events are automatically re-queued
}
```

---

## Environment Variables

Load configuration from environment:

```javascript
const pulsedb = new PulseDBSDK({
    apiKey: process.env.PULSEDB_API_KEY,
    endpoint: process.env.PULSEDB_ENDPOINT || 'https://pulsedb.app',
    appName: process.env.APP_NAME || 'my-app',
    environment: process.env.NODE_ENV || 'production',
    debug: process.env.DEBUG === 'true',
});
```

**.env example:**

```
PULSEDB_API_KEY=sk_live_xxx
PULSEDB_ENDPOINT=https://pulsedb.example.com
APP_NAME=api-server
NODE_ENV=production
```

---

## Browser Support

The SDK works in modern browsers (with `fetch` support):

```javascript
// In a browser app
const pulsedb = new PulseDBSDK({
    apiKey: 'sk_live_xxx',
    endpoint: 'https://pulsedb.app',
    appName: 'web-app',
});

// Track user interactions
document.addEventListener('click', (event) => {
    pulsedb.track('user.interaction', {
        title: 'User Click',
        metadata: { target: event.target.tagName },
    });
});
```

---

## API Reference

### Constructor

```javascript
new PulseDBSDK(options);
```

| Option          | Type    | Required | Default         | Description         |
| --------------- | ------- | -------- | --------------- | ------------------- |
| `apiKey`        | string  | Yes      | -               | PulseDB API key      |
| `endpoint`      | string  | Yes      | -               | PulseDB instance URL |
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
app.use(pulsedb.expressMiddleware());
```

#### `captureUncaughtExceptions()`

Automatically capture uncaught exceptions and unhandled rejections.

```javascript
pulsedb.captureUncaughtExceptions();
```

#### `start()`

Start the auto-flush timer.

```javascript
pulsedb.start();
```

#### `flush()`

Manually flush the event queue.

```javascript
await pulsedb.flush();
```

#### `heartbeat(status, metadata)`

Send a heartbeat to PulseDB.

```javascript
await pulsedb.heartbeat('healthy', { uptime: 3600 });
```

#### `shutdown()`

Stop auto-flush and flush remaining events.

```javascript
await pulsedb.shutdown();
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

- **Dashboard**: https://pulsedb.app
- **Docs**: https://docs.pulsedb.app
- **Email**: support@pulsedb.app
