# FATHOM SDK Framework - Complete Index

## Quick Navigation

### Getting Started

1. **Installation**: See `README.md` - Installation section
2. **Quick Start**: See `QUICK_REFERENCE.md` for fast setup
3. **Examples**: See `README.md` - Examples sections for each connector

### Documentation Files

| Document                                        | Purpose                           | Best For                               |
| ----------------------------------------------- | --------------------------------- | -------------------------------------- |
| [README.md](./README.md)                        | Comprehensive guide with examples | Learning, integration, troubleshooting |
| [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)      | Fast lookup guide                 | Quick reference, copy-paste examples   |
| [SDK_BUILD_SUMMARY.md](../SDK_BUILD_SUMMARY.md) | Architecture & design details     | Understanding the system               |
| [INDEX.md](./INDEX.md) (this file)              | Navigation guide                  | Finding what you need                  |

### Source Code Structure

```
sdk/
├── src/
│   ├── index.js                    # Main entry point - exports all classes
│   ├── core/                       # Core SDK components
│   │   ├── client.js              # FathomClient - main API client
│   │   ├── auth.js                # AuthManager - authentication
│   │   ├── logger.js              # Logger - structured logging
│   │   └── events.js              # EventEmitter - event system
│   └── connectors/                 # Platform connectors
│       ├── salesforce.js          # SalesforceConnector
│       ├── mulesoft.js            # MulesoftConnector
│       └── database.js            # DatabaseConnector
├── package.json                    # NPM package configuration
└── README.md                       # Full documentation
```

## File Reference

### Core Components

#### index.js (14 lines)

Main SDK entry point. Exports all classes.

**Exports:**

- `FathomClient`
- `SalesforceConnector`
- `MulesoftConnector`
- `DatabaseConnector`
- `EventEmitter`
- `Logger`
- `AuthManager`

---

#### core/client.js (486 lines)

**FathomClient** - Main API client for FATHOM monitoring platform

**Key Methods:**

- `connect()` / `disconnect()`
- `getMetrics()` / `query()`
- `subscribe()` / `unsubscribe()`
- `getConnections()` / `healthCheck()`

**Events Emitted:**

- `connected`, `disconnected`, `error`, `metrics`, `alert`

**Configuration:**

```javascript
{
  baseUrl: 'https://api.fathom.example.com',
  apiKey: 'sk_test_...',
  orgId: 'org_123',
  options: { timeout, retryAttempts, logLevel }
}
```

---

#### core/auth.js (255 lines)

**AuthManager** - Handles authentication (API keys, JWT tokens)

**Key Methods:**

- `getHeaders()` - Get auth headers for requests
- `isExpired()` - Check token expiration
- `refreshJWT()` - Refresh JWT tokens
- `updateAuth()` - Update credentials
- `clear()` - Clear auth data

**Supported Types:**

- `apiKey` - Static API key
- `jwt` - JWT token with refresh

---

#### core/logger.js (239 lines)

**Logger** - Structured logging with levels and history

**Key Methods:**

- `debug()` / `info()` / `warn()` / `error()`
- `setLevel()` / `getLevel()`
- `getHistory()` / `clearHistory()`
- `exportHistory()` - Export as JSON

**Features:**

- 4 log levels
- Colored output
- External sinks
- History tracking (1000 entries)

---

#### core/events.js (199 lines)

**EventEmitter** - Event management system

**Key Methods:**

- `on()` / `once()` / `off()`
- `emit()` - Trigger events
- `listenerCount()` - Count listeners
- `removeAllListeners()`
- `eventNames()` - List all events

---

#### connectors/salesforce.js (543 lines)

**SalesforceConnector** - Salesforce platform integration

**Key Methods:**

- `authenticate()` - OAuth 2.0 (password or JWT)
- `query()` - SOQL queries
- `getMetrics()` - API limits & usage
- `getOrgs()` / `getObjects()`
- `getAuditTrail()`
- `subscribeToEvents()`
- `syncToFathom()`

**Configuration:**

```javascript
{
  instanceUrl: 'https://login.salesforce.com',
  clientId: 'xxx',
  clientSecret: 'xxx',
  username: 'user@example.com',
  password: 'xxx',
  securityToken: 'xxx',
  apiVersion: 'v60.0'
}
```

---

#### connectors/mulesoft.js (532 lines)

**MulesoftConnector** - Mulesoft Anypoint Platform integration

**Key Methods:**

- `authenticate()` - OAuth 2.0 client credentials
- `getApps()` - List applications
- `getAppMetrics()` - App performance metrics
- `getApiManagerApis()`
- `getApiAnalytics()`
- `getAlerts()` / `getAuditLogs()`
- `syncToFathom()`

**Configuration:**

```javascript
{
  anyPointUrl: 'https://anypoint.mulesoft.com',
  clientId: 'xxx',
  clientSecret: 'xxx',
  orgId: 'xxx',
  envId: 'xxx' // optional
}
```

---

#### connectors/database.js (652 lines)

**DatabaseConnector** - Multi-database support

**Supported Types:**

- PostgreSQL (port 5432)
- MySQL (port 3306)
- MariaDB (port 3306)
- MongoDB (port 27017)
- Oracle (port 1521)

**Key Methods:**

- `connect()` / `disconnect()`
- `getOverview()` - Database info
- `getPerformance()` - Metrics
- `executeQuery()` - Run queries
- `getReplicationStatus()`
- `getQueryHistory()`
- `getStatus()` / `getCachedMetrics()`

**Configuration:**

```javascript
{
  type: 'postgresql',
  host: 'db.example.com',
  port: 5432,
  username: 'postgres',
  password: 'xxx',
  database: 'mydb',
  options: { ssl, timeout, maxConnections }
}
```

---

### Configuration Files

#### package.json (55 lines)

NPM package configuration

**Key Details:**

- Name: `@fathom/sdk`
- Version: `1.0.0`
- Type: ES Module
- Node.js: >= 18.0.0
- Main: `src/index.js`

**Export Points:**

```javascript
import { FathomClient } from '@fathom/sdk';
import { FathomClient } from '@fathom/sdk/client';
import { SalesforceConnector } from '@fathom/sdk/salesforce';
import { MulesoftConnector } from '@fathom/sdk/mulesoft';
import { DatabaseConnector } from '@fathom/sdk/database';
```

---

## Usage Patterns

### Basic Client Setup

```javascript
import { FathomClient } from '@fathom/sdk';

const client = new FathomClient({
    baseUrl: 'https://api.fathom.example.com',
    apiKey: 'sk_test_...',
    orgId: 'org_123',
});

await client.connect();
```

### Salesforce Integration

```javascript
import { SalesforceConnector } from '@fathom/sdk';

const sf = new SalesforceConnector({
    /* config */
});
await sf.authenticate();
const metrics = await sf.getMetrics();
```

### Mulesoft Integration

```javascript
import { MulesoftConnector } from '@fathom/sdk';

const mule = new MulesoftConnector({
    /* config */
});
await mule.authenticate();
const apps = await mule.getApps();
```

### Database Monitoring

```javascript
import { DatabaseConnector } from '@fathom/sdk';

const db = new DatabaseConnector({
    /* config */
});
await db.connect();
const perf = await db.getPerformance();
```

### Event Handling

```javascript
client.subscribe('alert', (alert) => {
    console.log('Alert:', alert);
});

client.on('error', (error) => {
    console.error('Error:', error.type, error.error);
});
```

---

## Common Tasks

### Task: Get Database Metrics

**File:** connectors/database.js
**Methods:**

1. Create DatabaseConnector
2. Call `connect()`
3. Call `getOverview()` for database info
4. Call `getPerformance()` for metrics

### Task: Monitor Salesforce API Limits

**File:** connectors/salesforce.js
**Methods:**

1. Create SalesforceConnector
2. Call `authenticate()`
3. Call `getMetrics()` to check limits
4. Subscribe to `metrics_updated` event

### Task: Monitor Mulesoft Applications

**File:** connectors/mulesoft.js
**Methods:**

1. Create MulesoftConnector
2. Call `authenticate()`
3. Call `getApps()` to list applications
4. Call `getAppMetrics()` for each app

### Task: Setup Logging

**File:** core/logger.js
**Methods:**

1. Create Logger instance
2. Call `debug()`, `info()`, `warn()`, `error()`
3. Optionally provide external sink

### Task: Handle Authentication

**File:** core/auth.js
**Methods:**

1. Create AuthManager with credentials
2. Call `getHeaders()` to get auth headers
3. Call `isExpired()` to check token
4. Call `refreshJWT()` if needed

---

## API Reference Quick Links

### FathomClient Methods

- `connect()` → Promise
- `disconnect()` → Promise
- `getMetrics(dbType, options)` → Promise
- `subscribe(event, callback)` → string (subscriptionId)
- `unsubscribe(event, subscriptionId)` → boolean
- `query(sql, options)` → Promise
- `getConnections()` → Promise
- `healthCheck()` → Promise
- `getLogger()` → Logger
- `getAuthManager()` → AuthManager

### SalesforceConnector Methods

- `authenticate(flowType)` → Promise
- `query(soql)` → Promise
- `getOrgs()` → Promise
- `getObjects()` → Promise
- `getMetrics()` → Promise
- `getAuditTrail(options)` → Promise
- `subscribeToEvents(channel, callback)` → string
- `syncToFathom(client, options)` → Promise

### MulesoftConnector Methods

- `authenticate()` → Promise
- `getApps()` → Promise
- `getAppMetrics(appId)` → Promise
- `getApiManagerApis()` → Promise
- `getApiAnalytics(apiId, options)` → Promise
- `getAlerts(options)` → Promise
- `getAuditLogs(options)` → Promise
- `syncToFathom(client, options)` → Promise

### DatabaseConnector Methods

- `connect()` → Promise
- `disconnect()` → Promise
- `getOverview()` → Promise
- `getPerformance()` → Promise
- `executeQuery(sql, params)` → Promise
- `getReplicationStatus()` → Promise
- `getQueryHistory(limit)` → Array
- `getStatus()` → Object
- `getCachedMetrics(key)` → Object

### EventEmitter Methods

- `on(event, callback)` → EventEmitter
- `once(event, callback)` → EventEmitter
- `off(event, callback)` → EventEmitter
- `emit(event, ...args)` → boolean
- `listenerCount(event)` → number
- `removeAllListeners(event)` → EventEmitter
- `eventNames()` → Array

### Logger Methods

- `debug(message, data)` → void
- `info(message, data)` → void
- `warn(message, data)` → void
- `error(message, data)` → void
- `setLevel(level)` → void
- `getLevel()` → string
- `getHistory(level)` → Array
- `clearHistory()` → void
- `exportHistory()` → string

### AuthManager Methods

- `getHeaders()` → Object
- `isExpired()` → boolean
- `refreshJWT()` → Promise
- `updateAuth(config)` → void
- `getAuthType()` → string
- `isConfigured()` → boolean
- `clear()` → void

---

## Troubleshooting

### Connection Issues

**See:** README.md - Error Handling section
**Files Involved:** core/client.js, core/auth.js

### Authentication Errors

**See:** QUICK_REFERENCE.md - Error Handling Patterns
**Files Involved:** core/auth.js, connectors/\*.js

### Metrics Not Updating

**See:** README.md - Advanced Usage section
**Files Involved:** connectors/\*.js, core/events.js

### Logging Issues

**See:** QUICK_REFERENCE.md - Custom Logger section
**Files Involved:** core/logger.js

---

## Next Steps

1. **Install the SDK**

    ```bash
    npm install @fathom/sdk
    ```

2. **Review README.md** for comprehensive guide

3. **Check QUICK_REFERENCE.md** for quick examples

4. **Review SDK_BUILD_SUMMARY.md** for architecture details

5. **Start with basic client setup**, then add connectors

6. **Reference JSDoc comments** in source code for detailed API docs

---

## Support

- Full Documentation: `README.md`
- Quick Reference: `QUICK_REFERENCE.md`
- Architecture: `SDK_BUILD_SUMMARY.md`
- API Docs: See JSDoc comments in source files
- Examples: See README.md sections for each connector

---

**Last Updated:** March 29, 2026
**SDK Version:** 1.0.0
**Node.js Requirement:** >= 18.0.0
