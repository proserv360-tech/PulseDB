# PulseDB SDK - Deployment & Integration Guide

## Package Overview

**@pulsedb/sdk** is a lightweight, zero-dependency JavaScript SDK for integrating applications with the PulseDB observability platform.

- **Location**: `/sessions/zealous-dazzling-mendel/mnt/PostgresTool/sdk/`
- **Package Size**: ~136 KB (source + docs)
- **Node.js**: >=18.0.0
- **Dependencies**: 0 (zero external packages)
- **License**: MIT

---

## Quick Integration Guide

### 1. Install the SDK

```bash
npm install @pulsedb/sdk
```

### 2. Initialize in Your Application

```javascript
import PulseDBSDK from '@pulsedb/sdk';

const pulsedb = new PulseDBSDK({
    apiKey: process.env.PULSEDB_API_KEY,
    endpoint: process.env.PULSEDB_ENDPOINT,
    appName: 'my-app',
    environment: process.env.NODE_ENV || 'production',
    debug: false,
});

pulsedb.start();
```

### 3. Add Express Middleware (if using Express)

```javascript
import express from 'express';

const app = express();
app.use(pulsedb.expressMiddleware());
// All routes now auto-tracked!
```

### 4. Graceful Shutdown

```javascript
process.on('SIGTERM', async () => {
    await pulsedb.shutdown();
    process.exit(0);
});
```

---

## Core Methods Reference

### API Tracking

```javascript
pulsedb.trackAPI({
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
    pulsedb.trackError({
        error,
        severity: 'error',
        metadata: { context: 'payment' },
    });
}
```

### Audit Events

```javascript
pulsedb.trackAudit({
    title: 'User Permission Changed',
    message: 'Admin elevated user to manager role',
    metadata: { userId: 'user_123', role: 'manager' },
});
```

### Metrics

```javascript
pulsedb.trackMetric({
    title: 'Database Pool Usage',
    value: 87,
    unit: '%',
});
```

### Custom Events

```javascript
pulsedb.track('payment.completed', {
    title: 'Payment Processed',
    metadata: { transactionId: 'txn_789', amount: 99.99 },
});
```

---

## Environment Configuration

Create a `.env` file in your application root:

```
PULSEDB_API_KEY=sk_live_your_key_here
PULSEDB_ENDPOINT=https://pulsedb.example.com
APP_NAME=my-service
NODE_ENV=production
DEBUG=false
```

Load in your app:

```javascript
import dotenv from 'dotenv';
dotenv.config();

const pulsedb = new PulseDBSDK({
    apiKey: process.env.PULSEDB_API_KEY,
    endpoint: process.env.PULSEDB_ENDPOINT,
    appName: process.env.APP_NAME,
    environment: process.env.NODE_ENV,
    debug: process.env.DEBUG === 'true',
});
```

---

## Performance Tuning

### For High-Volume Applications

```javascript
const pulsedb = new PulseDBSDK({
    apiKey: process.env.PULSEDB_API_KEY,
    endpoint: process.env.PULSEDB_ENDPOINT,
    batchSize: 200, // Larger batches = fewer requests
    flushInterval: 30000, // Longer intervals = better latency
    appName: 'high-volume-api',
});
```

### For Real-Time Monitoring

```javascript
const pulsedb = new PulseDBSDK({
    apiKey: process.env.PULSEDB_API_KEY,
    endpoint: process.env.PULSEDB_ENDPOINT,
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
import PulseDBSDK from '@pulsedb/sdk';

const pulsedb = new PulseDBSDK({
    apiKey: process.env.PULSEDB_API_KEY,
    endpoint: process.env.PULSEDB_ENDPOINT,
    appName: 'express-api',
});

const app = express();

// Middleware setup (IMPORTANT: before routes)
app.use(pulsedb.expressMiddleware());
pulsedb.captureUncaughtExceptions();

// Your routes
app.get('/api/users', (req, res) => {
    res.json({ users: [] });
});

// Start services
pulsedb.start();
app.listen(3000);

// Graceful shutdown
process.on('SIGTERM', async () => {
    await pulsedb.shutdown();
    process.exit(0);
});
```

### Fastify Application

```javascript
import Fastify from 'fastify';
import PulseDBSDK from '@pulsedb/sdk';

const pulsedb = new PulseDBSDK({
    apiKey: process.env.PULSEDB_API_KEY,
    endpoint: process.env.PULSEDB_ENDPOINT,
    appName: 'fastify-api',
});

const fastify = Fastify();

// Hook into requests
fastify.addHook('onResponse', async (request, reply) => {
    pulsedb.trackAPI({
        method: request.method,
        endpoint: request.url,
        statusCode: reply.statusCode,
        durationMs: reply.getResponseTime(),
    });
});

fastify.get('/api/users', async () => {
    return { users: [] };
});

pulsedb.start();
await fastify.listen({ port: 3000 });
```

### Database Operations

```javascript
import pg from 'pg';
import PulseDBSDK from '@pulsedb/sdk';

const pulsedb = new PulseDBSDK({
    apiKey: process.env.PULSEDB_API_KEY,
    endpoint: process.env.PULSEDB_ENDPOINT,
    appName: 'db-service',
});

const pool = new pg.Pool();

async function queryUsers() {
    const start = Date.now();
    try {
        const result = await pool.query('SELECT * FROM users');
        const duration = Date.now() - start;

        pulsedb.trackMetric({
            title: 'Database Query Time',
            value: duration,
            unit: 'ms',
            metadata: { query: 'SELECT users', rows: result.rowCount },
        });

        return result.rows;
    } catch (error) {
        pulsedb.trackError({
            error,
            severity: 'error',
            metadata: { query: 'SELECT users' },
        });
        throw error;
    }
}

pulsedb.start();
```

### Lambda Function

```javascript
import PulseDBSDK from '@pulsedb/sdk';

const pulsedb = new PulseDBSDK({
    apiKey: process.env.PULSEDB_API_KEY,
    endpoint: process.env.PULSEDB_ENDPOINT,
    appName: 'lambda-function',
});

export const handler = async (event) => {
    const start = Date.now();

    try {
        // Your Lambda logic
        const result = await processOrder(event);

        pulsedb.trackAPI({
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
        await pulsedb.flush();

        return result;
    } catch (error) {
        pulsedb.trackError({
            error,
            severity: 'error',
            metadata: { orderId: event.orderId },
        });

        await pulsedb.flush();
        throw error;
    }
};
```

---

## Deployment Checklist

- [ ] **Create API Key**: Generate `sk_live_xxx` key in PulseDB dashboard
- [ ] **Set Environment Variables**: `PULSEDB_API_KEY`, `PULSEDB_ENDPOINT`
- [ ] **Install Package**: `npm install @pulsedb/sdk`
- [ ] **Add Middleware**: `app.use(pulsedb.expressMiddleware())`
- [ ] **Start Auto-Flush**: `pulsedb.start()`
- [ ] **Handle Shutdown**: Implement graceful shutdown with `pulsedb.shutdown()`
- [ ] **Test Integration**: Send test events and verify in PulseDB dashboard
- [ ] **Monitor**: Watch dashboard for incoming events
- [ ] **Tune Batch Settings**: Adjust `batchSize` and `flushInterval` for performance
- [ ] **Error Handling**: Implement `captureUncaughtExceptions()` if needed

---

## Troubleshooting

### Events Not Appearing in Dashboard

1. **Check API Key**: Ensure `PULSEDB_API_KEY` is valid
2. **Check Endpoint**: Ensure `PULSEDB_ENDPOINT` is correct and reachable
3. **Check Network**: Verify outbound HTTPS connectivity
4. **Enable Debug**: Set `debug: true` to see console logs
5. **Manual Flush**: Call `await pulsedb.flush()` to send immediately

### High Network Usage

1. **Increase batchSize**: Reduce number of HTTP requests
2. **Increase flushInterval**: Wait longer before sending
3. **Filter Events**: Only track important events

### Memory Concerns

1. **Reduce batchSize**: Send events more frequently
2. **Enable Flush**: Call `pulsedb.flush()` periodically
3. **Monitor Queue**: Check `pulsedb.queue.length` in debug logs

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

- **Dashboard**: https://pulsedb.example.com
- **Documentation**: See README.md
- **Examples**: See `examples/` directory
- **Tests**: Run `npm test`

---

## License

MIT - See LICENSE file for details
