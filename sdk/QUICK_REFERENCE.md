# FATHOM SDK Quick Reference Guide

## Installation

```bash
npm install @fathom/sdk
```

## Core Components at a Glance

### 1. FathomClient - Main API Interface

```javascript
import { FathomClient } from '@fathom/sdk';

const client = new FathomClient({
    baseUrl: 'https://api.fathom.example.com',
    apiKey: 'sk_test_...',
    orgId: 'org_123',
});

// Connection
await client.connect();
await client.disconnect();

// Data Operations
await client.getMetrics('postgresql');
await client.query('SELECT * FROM table');
await client.getConnections();
await client.healthCheck();

// Events
client.subscribe('alert', callback);
client.unsubscribe('alert', subscriptionId);
```

### 2. SalesforceConnector - Salesforce Integration

```javascript
import { SalesforceConnector } from '@fathom/sdk';

const sf = new SalesforceConnector({
    instanceUrl: 'https://login.salesforce.com',
    clientId: 'xxx',
    clientSecret: 'xxx',
    username: 'user@example.com',
    password: 'xxx',
    securityToken: 'token',
});

// Authentication
await sf.authenticate('password'); // or 'jwt'

// Operations
await sf.query('SELECT Id, Name FROM Account');
await sf.getMetrics();
await sf.getAuditTrail();
await sf.getOrgs();
await sf.getObjects();

// Sync to FATHOM
await sf.syncToFathom(client, { includeAuditTrail: true });
```

### 3. MulesoftConnector - Mulesoft Integration

```javascript
import { MulesoftConnector } from '@fathom/sdk';

const mule = new MulesoftConnector({
    anyPointUrl: 'https://anypoint.mulesoft.com',
    clientId: 'xxx',
    clientSecret: 'xxx',
    orgId: 'xxx',
});

// Authentication
await mule.authenticate();

// Operations
await mule.getApps();
await mule.getAppMetrics('app_id');
await mule.getApiManagerApis();
await mule.getApiAnalytics('api_id');
await mule.getAlerts();
await mule.getAuditLogs();

// Sync to FATHOM
await mule.syncToFathom(client, {
    includeApps: true,
    includeApis: true,
});
```

### 4. DatabaseConnector - Multi-Database Support

```javascript
import { DatabaseConnector } from '@fathom/sdk';

const db = new DatabaseConnector({
    type: 'postgresql', // mysql, mongodb, mariadb, oracle
    host: 'db.example.com',
    port: 5432,
    username: 'postgres',
    password: 'xxx',
    database: 'mydb',
});

// Connection
await db.connect();
await db.disconnect();

// Metrics
await db.getOverview();
await db.getPerformance();
await db.getReplicationStatus();

// Queries
await db.executeQuery('SELECT * FROM table');
db.getQueryHistory(10);

// Status
db.getStatus();
db.getCachedMetrics('performance');
```

### 5. EventEmitter - Event Management

```javascript
import { EventEmitter } from '@fathom/sdk';

const emitter = new EventEmitter();

// Listeners
emitter.on('data', (d) => console.log(d));
emitter.once('init', () => console.log('initialized'));
emitter.off('data', callback);

// Emit
emitter.emit('data', { id: 1 });

// Management
emitter.listenerCount('data');
emitter.removeAllListeners('data');
emitter.eventNames();
```

### 6. Logger - Structured Logging

```javascript
import { Logger } from '@fathom/sdk';

const logger = new Logger({
    name: 'MyApp',
    level: 'debug',
    sink: (entry) => sendToService(entry),
});

// Logging
logger.debug('Debug message', { data: 123 });
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message', new Error());

// Management
logger.setLevel('info');
logger.getLevel();
logger.getHistory();
logger.clearHistory();
logger.exportHistory();
```

### 7. AuthManager - Authentication

```javascript
import { AuthManager } from '@fathom/sdk';

// API Key Auth
const apiAuth = new AuthManager({
    type: 'apiKey',
    value: 'sk_test_...',
});

// JWT Auth
const jwtAuth = new AuthManager({
    type: 'jwt',
    value: 'eyJhbGc...',
    refreshUrl: 'https://api.example.com/refresh',
    refreshToken: 'refresh_...',
});

// Operations
apiAuth.getHeaders(); // { 'X-API-Key': '...' }
jwtAuth.getHeaders(); // { 'Authorization': 'Bearer ...' }
await jwtAuth.refreshJWT();
jwtAuth.isExpired();
jwtAuth.setTokenExpiration(3600);
```

---

## Common Workflows

### Workflow 1: Monitor PostgreSQL Performance

```javascript
const client = new FathomClient({
    /* config */
});
const db = new DatabaseConnector({ type: 'postgresql' /* ... */ });

await client.connect();
await db.connect();

const performance = await db.getPerformance();
console.log('Cache Hit Ratio:', performance.cacheStats.indexHitRatio);
console.log('Slow Queries:', performance.slowQueries);

const overview = await db.getOverview();
console.log('Database Size:', overview.size / 1024 / 1024 + ' MB');

db.on('performance_updated', (perf) => {
    console.log('Performance metrics updated');
});
```

### Workflow 2: Monitor Salesforce API Usage

```javascript
const sf = new SalesforceConnector({
    /* config */
});
const client = new FathomClient({
    /* config */
});

await sf.authenticate();
const metrics = await sf.getMetrics();

const usagePercent = (metrics.limits.ApiCalls.Used / metrics.limits.ApiCalls.Max) * 100;
console.log('API Usage:', usagePercent + '%');

sf.on('metrics_updated', (m) => {
    if (usagePercent > 80) {
        console.warn('High API usage detected');
    }
});

// Sync to FATHOM dashboard
await sf.syncToFathom(client);
```

### Workflow 3: Monitor Mulesoft Applications

```javascript
const mule = new MulesoftConnector({
    /* config */
});

await mule.authenticate();
const apps = await mule.getApps();

for (const app of apps) {
    const metrics = await mule.getAppMetrics(app.id);
    console.log(`${app.name}: CPU ${metrics.cpu}%, Memory ${metrics.memory}%`);
}

const alerts = await mule.getAlerts({ activeOnly: true });
console.log('Active Alerts:', alerts.length);
```

### Workflow 4: Multi-Database Monitoring

```javascript
const postgres = new DatabaseConnector({ type: 'postgresql' /* ... */ });
const mysql = new DatabaseConnector({ type: 'mysql' /* ... */ });
const mongo = new DatabaseConnector({ type: 'mongodb' /* ... */ });

await Promise.all([postgres.connect(), mysql.connect(), mongo.connect()]);

const metrics = await Promise.all([postgres.getPerformance(), mysql.getPerformance(), mongo.getPerformance()]);

console.log('All databases monitored');
```

### Workflow 5: Real-Time Alert Handling

```javascript
const client = new FathomClient({
    /* config */
});

await client.connect();

client.subscribe('alert', (alert) => {
    console.log('Alert:', alert.name);
    console.log('Severity:', alert.severity);

    switch (alert.type) {
        case 'high_cpu':
            // Handle high CPU
            break;
        case 'connection_pool_exhausted':
            // Handle connection pool
            break;
        case 'slow_query':
            // Handle slow query
            break;
    }
});

client.subscribe('error', (error) => {
    console.error('Error type:', error.type);
    // Error recovery logic
});
```

---

## Error Handling Patterns

### Pattern 1: Try-Catch

```javascript
try {
    await client.connect();
} catch (error) {
    console.error('Connection failed:', error.message);
}
```

### Pattern 2: Error Events

```javascript
client.on('error', (errorInfo) => {
    console.error(errorInfo.type, errorInfo.error);
});
```

### Pattern 3: Error Recovery

```javascript
async function connectWithRetry(maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await client.connect();
            return;
        } catch (error) {
            console.warn(`Attempt ${i + 1} failed, retrying...`);
            await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
        }
    }
    throw new Error('Failed to connect after retries');
}
```

---

## Configuration Examples

### Production Environment

```javascript
const client = new FathomClient({
    baseUrl: process.env.FATHOM_API_URL,
    apiKey: process.env.FATHOM_API_KEY,
    orgId: process.env.FATHOM_ORG_ID,
    options: {
        logLevel: 'warn',
        retryAttempts: 5,
        timeout: 60000,
    },
});

const logger = new Logger({
    name: 'ProductionApp',
    level: 'warn',
    sink: (entry) => sendToLoggingService(entry),
});
```

### Development Environment

```javascript
const client = new FathomClient({
    baseUrl: 'http://localhost:3000',
    apiKey: 'dev_key_123',
    orgId: 'dev_org',
    options: {
        logLevel: 'debug',
        retryAttempts: 1,
        timeout: 10000,
    },
});

const logger = new Logger({
    name: 'DevApp',
    level: 'debug',
    colors: true,
});
```

---

## Performance Tips

1. **Cache Metrics**: Metrics are automatically cached to reduce API calls

    ```javascript
    const cached = db.getCachedMetrics('performance');
    ```

2. **Batch Operations**: Use Promise.all() for parallel requests

    ```javascript
    const [sf, mule, db] = await Promise.all([sf.getMetrics(), mule.getApps(), db.getOverview()]);
    ```

3. **Event Subscriptions**: Subscribe once and reuse callbacks

    ```javascript
    client.subscribe('alert', alertHandler); // Reuse same callback
    ```

4. **Connection Pooling**: Keep connectors alive for reuse
    ```javascript
    // Don't reconnect repeatedly
    const db = new DatabaseConnector(config);
    await db.connect(); // Once
    // Reuse throughout application lifetime
    ```

---

## File Locations

```
sdk/
├── src/index.js                  # Main exports
├── src/core/
│   ├── client.js                 # FathomClient
│   ├── auth.js                   # AuthManager
│   ├── logger.js                 # Logger
│   └── events.js                 # EventEmitter
├── src/connectors/
│   ├── salesforce.js             # SalesforceConnector
│   ├── mulesoft.js               # MulesoftConnector
│   └── database.js               # DatabaseConnector
├── package.json
└── README.md
```

---

## Next Steps

1. Review `/sessions/zealous-dazzling-mendel/mnt/PostgresTool/sdk/README.md` for complete documentation
2. Check `/sessions/zealous-dazzling-mendel/mnt/PostgresTool/SDK_BUILD_SUMMARY.md` for architecture details
3. Review the JSDoc comments in each class for detailed API reference
4. Start with basic client setup and gradually add connectors

---

## Support Resources

- Full Documentation: `README.md`
- Build Summary: `SDK_BUILD_SUMMARY.md`
- Code Examples: See inline JSDoc comments
- API Reference: Check individual class definitions
