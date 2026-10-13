# Database Adapters for FATHOM

This directory contains a unified database monitoring abstraction layer that allows FATHOM to support multiple database engines while maintaining a single, standardized interface.

## Quick Start

```javascript
import { getAdapter, detectDbType, SUPPORTED_DB_TYPES } from './index.js';

// Option 1: Auto-detect from connection string
const dbType = detectDbType('postgres://user:pass@localhost/mydb');
const adapter = getAdapter(dbType, { host: 'localhost', user: 'user', password: 'pass', database: 'mydb' });

// Option 2: Instantiate directly
const adapter = getAdapter('postgresql', { host: 'localhost', user: 'user', password: 'pass', database: 'mydb' });

// Connect and use
await adapter.connect();
const stats = await adapter.getOverviewStats();
const metrics = await adapter.getKeyMetrics();
await adapter.disconnect();
```

## Supported Databases

| Database      | Driver Package  | Status     | Connection URL                      |
| ------------- | --------------- | ---------- | ----------------------------------- |
| PostgreSQL    | `pg` (built-in) | ✓ Complete | `postgres://user:pass@host:5432/db` |
| MySQL/MariaDB | `mysql2`        | ✓ Complete | `mysql://user:pass@host:3306/db`    |
| SQL Server    | `mssql`         | ✓ Complete | `mssql://user:pass@host:1433/db`    |
| Oracle        | `oracledb`      | ✓ Complete | `oracle://user:pass@host:1521/SID`  |
| MongoDB       | `mongodb`       | ✓ Complete | `mongodb://user:pass@host:27017/db` |

## Architecture

### BaseAdapter (Abstract Base Class)

All adapters inherit from `BaseAdapter` and implement these methods:

#### Connection Management

- `async connect()` - Establish database connection
- `async disconnect()` - Close database connection

#### Monitoring Methods (return standardized data)

- `async getOverviewStats()` - Server overview (connections, size, uptime, etc.)
- `async getPerformanceStats()` - Performance metrics (query times, cache hit ratio, etc.)
- `async getTableStats()` - Array of table statistics
- `async getIndexStats()` - Array of index statistics
- `async getActiveConnections()` - Array of active database connections/sessions
- `async getLockInfo()` - Array of lock information
- `async getReplicationStatus()` - Replication status (if applicable)
- `async getDatabaseList()` - Array of available databases/schemas
- `async getServerVersion()` - Version information
- `async executeQuery(sql, params)` - Execute arbitrary query

#### Capability Detection

- `getCapabilities()` - Returns feature support matrix for this database
- `async getKeyMetrics()` - Returns array of database-specific key metrics

#### Helper Methods

- `formatTimestamp(timestamp)` - Normalize timestamps to ISO 8601
- `round(value, decimals)` - Round numbers to N decimal places
- `toNumber(value, default)` - Safe numeric conversion

## Factory Pattern

### `detectDbType(connectionString)`

Auto-detects database type from connection string.

```javascript
const type = detectDbType('mysql://user:pass@localhost/db'); // Returns 'mysql'
```

### `getAdapter(dbType, config)`

Returns an instantiated adapter for the specified database type.

```javascript
const adapter = getAdapter('postgresql', {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'secret',
    database: 'mydb',
});
```

### `getAdapterFromString(connectionString, config)`

One-shot method that detects type and instantiates adapter.

```javascript
const adapter = getAdapterFromString('postgres://user:pass@localhost/mydb');
```

## Standardized Return Shapes

### Overview Stats

```javascript
{
  activeConnections: number,
  totalConnections: number,
  dbSizeBytes: number,
  uptimeSeconds: number,
  version: string,
  cacheHitRatio: number,        // 0-100
  transactionsPerSec: number,
  tuplesInserted: number,
  tuplesUpdated: number,
  tuplesDeleted: number,
  tuplesFetched: number
}
```

### Key Metrics

```javascript
[
    {
        id: string, // Unique identifier (e.g., 'cache_hit_ratio')
        label: string, // Display name (e.g., 'Cache Hit Ratio')
        value: number | string, // Current value
        unit: string, // Unit of measurement (%, count, MB, etc.)
        category: string, // 'performance' | 'connections' | 'storage' | 'replication'
        severity: string, // 'ok' | 'warning' | 'critical'
        thresholds: {
            warning: number,
            critical: number,
        },
        description: string, // Human-readable explanation
        dbSpecific: boolean, // true if not available on all databases
    },
];
```

### Capabilities

```javascript
{
  replication: boolean,          // Replication monitoring supported
  vacuum: boolean,               // PostgreSQL VACUUM command
  indexes: boolean,              // Index monitoring available
  locks: boolean,                // Lock monitoring available
  queryPlan: boolean,            // Query plan analysis available
  wal: boolean,                  // Write-Ahead Log (PostgreSQL)
  schemas: boolean,              // Schema-aware monitoring
  storedProcedures: boolean,     // Stored procedure monitoring
  partitioning: boolean,         // Table partitioning support
  sharding: boolean              // Sharding support (MongoDB)
}
```

## Database-Specific Notes

### PostgreSQL

- ✓ Uses `pg` driver (already installed)
- ✓ Full feature support including vacuum, WAL, replication
- ✓ Comprehensive pg*stat*\* views for detailed metrics
- ✓ All methods fully implemented

### MySQL/MariaDB

- Uses `mysql2` package (must be installed)
- Key metrics from SHOW GLOBAL STATUS
- Table stats from information_schema
- Limited index statistics compared to PostgreSQL
- Replication via SHOW SLAVE STATUS

### SQL Server

- Uses `mssql` package (must be installed)
- Performance metrics from sys.dm\_\* dynamic management views
- Table/index stats from sys.databases and sys.indexes
- Key metrics: buffer cache hit ratio, batch requests/sec

### Oracle

- Uses `oracledb` package (must be installed)
- Session info from V$SESSION
- Metrics from V$SYSSTAT
- Detailed: SGA hit ratio, redo log switches, PGA usage
- Limited replication support

### MongoDB

- Uses `mongodb` package (must be installed)
- No traditional SQL — executeQuery returns empty
- Operates on collections instead of tables
- Replica set monitoring supported
- Key metrics: ops/sec, connection count, cache hit ratio

## Error Handling

All adapters gracefully handle:

- Missing database drivers (throws informative error)
- Connection failures (throws with details)
- Missing statistics views/features (returns empty/zero)
- Query timeouts and syntax errors (caught and logged)

Example:

```javascript
try {
    await adapter.connect();
} catch (error) {
    if (error.message.includes('not installed')) {
        console.error('Database driver missing:', error.message);
    } else {
        console.error('Connection failed:', error.message);
    }
}
```

## Integration with Existing Code

The adapter layer is designed to integrate incrementally with existing server.js code:

1. **No breaking changes** - All existing routes continue to work
2. **Database-agnostic** - New routes can use adapters for multi-DB support
3. **Backward compatible** - Default to PostgreSQL for existing connections
4. **Incremental migration** - Replace old queries one route at a time

### Future Integration Example

```javascript
// Before: Direct pool query
const result = await pool.query('SELECT ... FROM pg_stat_user_tables');

// After: Using adapter
const adapter = getAdapter('postgresql', config);
await adapter.connect();
const tables = await adapter.getTableStats();
await adapter.disconnect();
```

## Installing Drivers

```bash
# PostgreSQL (already installed)
npm list pg

# Add other drivers
npm install mysql2 mssql oracledb mongodb
```

## Testing

Test connection detection:

```bash
node -e "
import('./index.js').then(m => {
  console.log(m.detectDbType('postgres://localhost'));
  console.log(m.detectDbType('mysql://localhost'));
  console.log(m.detectDbType('mongodb://localhost'));
});
"
```

Test adapter instantiation:

```bash
node -e "
import('./index.js').then(m => {
  const adapter = m.getAdapter('postgresql', { host: 'localhost' });
  console.log('Capabilities:', adapter.getCapabilities());
});
"
```

## File Structure

```
dbAdapters/
├── README.md                 # This file
├── index.js                  # Factory pattern & type detection
├── BaseAdapter.js            # Abstract base class
├── PostgresAdapter.js        # PostgreSQL implementation
├── MySQLAdapter.js           # MySQL/MariaDB implementation
├── MSSQLAdapter.js           # SQL Server implementation
├── OracleAdapter.js          # Oracle Database implementation
└── MongoDBAdapter.js         # MongoDB implementation
```

## License

Part of the FATHOM monitoring system.
