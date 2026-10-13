# FATHOM SDK - Deployment & Integration Guide

## Package Overview

**@fathom/sdk** is a lightweight, zero-dependency JavaScript SDK for integrating applications with the FATHOM observability platform.

- **Location**: `/sessions/zealous-dazzling-mendel/mnt/PostgresTool/sdk/`
- **Package Size**: ~136 KB (source + docs)
- **Node.js**: >=18.0.0
- **Dependencies**: 0 (zero external packages)
- **License**: MIT

---

## Quick Integration Guide

### 1. Install the SDK

```bash
npm install @fathom/sdk
```

### 2. Initialize in Your Application

```javascript
import FathomSDK from '@fathom/sdk';

const fathom = new FathomSDK({
    apiKey: process.env.FATHOM_API_KEY,
    endpoint: process.env.FATHOM_ENDPOINT,
    appName: 'my-app',
    environment: process.env.NODE_ENV || 'production',
    debug: false,
});

fathom.start();
```

### 3. Add Express Middleware (if using Express)

```javascript
import express from 'express';

const app = express();
app.use(fathom.expressMiddleware());
// All routes now auto-tracked!
```

### 4. Graceful Shutdown

```javascript
process.on('SIGTERM', async () => {
    await fathom.shutdown();
    process.exit(0);
});
```

---

## Core Methods Reference

### API Tracking

```javascript
fathom.trackAPI({
    method: 'GET',
    endpoint: '/api/users',
    statusCode: 200,
    durationMs: 145,
    metadata: { cached: true },
});
```

### Error Tracking

```javascript
try {
    await risky();
} catch (error) {
    fathom.trackError({
        error,
        severity: 'error',
        metadata: { context: 'payment' },
    });
}
```

### Audit Events

```javascript
fathom.trackAudit({
    title: 'User Permission Changed',
    message: 'Admin elevated user to manager role',
    metadata: { userId: 'user_123', role: 'manager' },
});
```

### Metrics

```javascript
fathom.trackMetric({
    title: 'Database Pool Usage',
    value: 87,
    unit: '%',
});
```

### Custom Events

```javascript
fathom.track('payment.completed', {
    title: 'Payment Processed',
    metadata: { transactionId: 'txn_789', amount: 99.99 },
});
```

---

## Environment Configuration

Create a `.env` file in your application root:

```
FATHOM_API_KEY=sk_live_your_key_here
FATHOM_ENDPOINT=https://fathom.example.com
APP_NAME=my-service
NODE_ENV=production
DEBUG=false
```

Load in your app:

```javascript
import dotenv from 'dotenv';
dotenv.config();

const fathom = new FathomSDK({
    apiKey: process.env.FATHOM_API_KEY,
    endpoint: process.env.FATHOM_ENDPOINT,
    appName: process.env.APP_NAME,
    environment: process.env.NODE_ENV,
    debug: process.env.DEBUG === 'true',
});
```

---

## Performance Tuning

### For High-Volume Applications

```javascript
const fathom = new FathomSDK({
    apiKey: process.env.FATHOM_API_KEY,
    endpoint: process.env.FATHOM_ENDPOINT,
    batchSize: 200, // Larger batches = fewer requests
    flushInterval: 30000, // Longer intervals = better latency
    appName: 'high-volume-api',
});
```

### For Real-Time Monitoring

```javascript
const fathom = new FathomSDK({
    apiKey: process.env.FATHOM_API_KEY,
    endpoint: process.env.FATHOM_ENDPOINT,
    batchSize: 20, // Smaller batches = faster delivery
    flushInterval: 5000, // Shorter intervals = more timely
    appName: 'realtime-service',
});
```

---

## Integration Patterns

### Express.js Application

```javascript
import express from 'express';
import FathomSDK from '@fathom/sdk';

const fathom = new FathomSDK({
    apiKey: process.env.FATHOM_API_KEY,
    endpoint: process.env.FATHOM_ENDPOINT,
    appName: 'express-api',
});

const app = express();

// Middleware setup (IMPORTANT: before routes)
app.use(fathom.expressMiddleware());
fathom.captureUncaughtExceptions();

// Your routes
app.get('/api/users', (req, res) => {
    res.json({ users: [] });
});

// Start services
fathom.start();
app.listen(3000);

// Graceful shutdown
process.on('SIGTERM', async () => {
    await fathom.shutdown();
    process.exit(0);
});
```

### Fastify Application

```javascript
import Fastify from 'fastify';
import FathomSDK from '@fathom/sdk';

const fathom = new FathomSDK({
    apiKey: process.env.FATHOM_API_KEY,
    endpoint: process.env.FATHOM_ENDPOINT,
    appName: 'fastify-api',
});

const fastify = Fastify();

// Hook into requests
fastify.addHook('onResponse', async (request, reply) => {
    fathom.trackAPI({
        method: request.method,
        endpoint: request.url,
        statusCode: reply.statusCode,
        durationMs: reply.getResponseTime(),
    });
});

fastify.get('/api/users', async () => {
    return { users: [] };
});

fathom.start();
await fastify.listen({ port: 3000 });
```

### Database Operations

```javascript
import pg from 'pg';
import FathomSDK from '@fathom/sdk';

const fathom = new FathomSDK({
    apiKey: process.env.FATHOM_API_KEY,
    endpoint: process.env.FATHOM_ENDPOINT,
    appName: 'db-service',
});

const pool = new pg.Pool();

async function queryUsers() {
    const start = Date.now();
    try {
        const result = await pool.query('SELECT * FROM users');
        const duration = Date.now() - start;

        fathom.trackMetric({
            title: 'Database Query Time',
            value: duration,
            unit: 'ms',
            metadata: { query: 'SELECT users', rows: result.rowCount },
        });

        return result.rows;
    } catch (error) {
        fathom.trackError({
            error,
            severity: 'error',
            metadata: { query: 'SELECT users' },
        });
        throw error;
    }
}

fathom.start();
```

### Lambda Function

```javascript
import FathomSDK from '@fathom/sdk';

const fathom = new FathomSDK({
    apiKey: process.env.FATHOM_API_KEY,
    endpoint: process.env.FATHOM_ENDPOINT,
    appName: 'lambda-function',
});

export const handler = async (event) => {
    const start = Date.now();

    try {
        // Your Lambda logic
        const result = await processOrder(event);

        fathom.trackAPI({
            method: 'LAMBDA',
            endpoint: context.functionName,
            statusCode: 200,
            durationMs: Date.now() - start,
            metadata: {
                requestId: context.requestId,
                orderId: event.orderId,
            },
        });

        // Flush before Lambda freeze
        await fathom.flush();

        return result;
    } catch (error) {
        fathom.trackError({
            error,
            severity: 'error',
            metadata: { orderId: event.orderId },
        });

        await fathom.flush();
        throw error;
    }
};
```

---

## Deployment Checklist

- [ ] **Create API Key**: Generate `sk_live_xxx` key in FATHOM dashboard
- [ ] **Set Environment Variables**: `FATHOM_API_KEY`, `FATHOM_ENDPOINT`
- [ ] **Install Package**: `npm install @fathom/sdk`
- [ ] **Add Middleware**: `app.use(fathom.expressMiddleware())`
- [ ] **Start Auto-Flush**: `fathom.start()`
- [ ] **Handle Shutdown**: Implement graceful shutdown with `fathom.shutdown()`
- [ ] **Test Integration**: Send test events and verify in FATHOM dashboard
- [ ] **Monitor**: Watch dashboard for incoming events
- [ ] **Tune Batch Settings**: Adjust `batchSize` and `flushInterval` for performance
- [ ] **Error Handling**: Implement `captureUncaughtExceptions()` if needed

---

## Troubleshooting

### Events Not Appearing in Dashboard

1. **Check API Key**: Ensure `FATHOM_API_KEY` is valid
2. **Check Endpoint**: Ensure `FATHOM_ENDPOINT` is correct and reachable
3. **Check Network**: Verify outbound HTTPS connectivity
4. **Enable Debug**: Set `debug: true` to see console logs
5. **Manual Flush**: Call `await fathom.flush()` to send immediately

### High Network Usage

1. **Increase batchSize**: Reduce number of HTTP requests
2. **Increase flushInterval**: Wait longer before sending
3. **Filter Events**: Only track important events

### Memory Concerns

1. **Reduce batchSize**: Send events more frequently
2. **Enable Flush**: Call `fathom.flush()` periodically
3. **Monitor Queue**: Check `fathom.queue.length` in debug logs

---

## API Endpoint Specification

### Event Ingestion

**POST** `/api/sdk/ingest`

Headers:

```
X-SDK-Key: sk_live_xxx
Content-Type: application/json
```

Body:

```json
{
    "events": [
        {
            "type": "api",
            "title": "GET /api/users",
            "severity": "info",
            "metadata": {
                "method": "GET",
                "endpoint": "/api/users",
                "statusCode": 200,
                "durationMs": 145
            },
            "timestamp": "2026-03-31T12:00:00Z",
            "sessionId": "session_123",
            "appName": "my-app",
            "environment": "production"
        }
    ]
}
```

### Heartbeat

**POST** `/api/sdk/heartbeat`

Headers:

```
X-SDK-Key: sk_live_xxx
Content-Type: application/json
```

Body:

```json
{
    "status": "healthy",
    "sessionId": "session_123",
    "appName": "my-app",
    "environment": "production",
    "queueSize": 10,
    "timestamp": "2026-03-31T12:00:00Z",
    "metadata": {
        "uptime": 3600,
        "memoryUsage": 50000000
    }
}
```

---

## Support & Resources

- **Dashboard**: https://fathom.example.com
- **Documentation**: See README.md
- **Examples**: See `examples/` directory
- **Tests**: Run `npm test`

---

## License

MIT - See LICENSE file for details
