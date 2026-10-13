// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * BaseAdapter.js
 *
 * Abstract base class for database adapters. All database-specific adapters inherit from this
 * and implement the required methods to provide a standardized monitoring interface.
 *
 * All methods return standardized shapes for database-agnostic consumption by the frontend and
 * alert engine.
 */

export class BaseAdapter {
    /**
     * Initialize the adapter with a connection configuration
     * @param {Object} config - Database connection configuration
     */
    constructor(config) {
        this.config = config;
        this.dbType = 'unknown';
        this.connected = false;
    }

    /**
     * Establish a connection to the database
     * @returns {Promise<void>}
     * @throws {Error} If connection fails
     */
    async connect() {
        throw new Error('Not implemented');
    }

    /**
     * Close the database connection
     * @returns {Promise<void>}
     */
    async disconnect() {
        throw new Error('Not implemented');
    }

    /**
     * Get overview statistics about the database server
     * @returns {Promise<Object>} Overview stats
     */
    async getOverviewStats() {
        throw new Error('Not implemented');
    }

    /**
     * Get performance-related statistics
     * @returns {Promise<Object>} Performance stats
     */
    async getPerformanceStats() {
        throw new Error('Not implemented');
    }

    /**
     * Get statistics for all tables in the database
     * @returns {Promise<Array>} Array of table stat objects
     */
    async getTableStats() {
        throw new Error('Not implemented');
    }

    /**
     * Get statistics for all indexes in the database
     * @returns {Promise<Array>} Array of index stat objects
     */
    async getIndexStats() {
        throw new Error('Not implemented');
    }

    /**
     * Get list of currently active connections
     * @returns {Promise<Array>} Array of connection objects
     */
    async getActiveConnections() {
        throw new Error('Not implemented');
    }

    /**
     * Get information about locks held or waited on
     * @returns {Promise<Array>} Array of lock objects
     */
    async getLockInfo() {
        throw new Error('Not implemented');
    }

    /**
     * Get replication status (if applicable)
     * @returns {Promise<Object>} Replication status
     */
    async getReplicationStatus() {
        throw new Error('Not implemented');
    }

    /**
     * Get list of databases/schemas on the server
     * @returns {Promise<Array>} Array of database objects
     */
    async getDatabaseList() {
        throw new Error('Not implemented');
    }

    /**
     * Get the database server version
     * @returns {Promise<Object>} Version information
     */
    async getServerVersion() {
        throw new Error('Not implemented');
    }

    /**
     * Execute an arbitrary SQL query
     * @param {string} sql - The SQL to execute
     * @param {Array} params - Optional parameters for prepared statement
     * @returns {Promise<Object>} Query result with rows, fields, rowCount, and duration
     */
    async executeQuery(sql, params = []) {
        throw new Error('Not implemented');
    }

    /**
     * Get key metrics specific to this database type
     * Each adapter returns its own set of database-specific metrics
     * @returns {Promise<Array>} Array of metric objects
     *
     * Metric object shape:
     * {
     *   id: string,                              // unique identifier
     *   label: string,                           // display name
     *   value: number|string,                    // metric value
     *   unit: string,                            // unit of measurement
     *   category: string,                        // 'performance' | 'connections' | 'storage' | 'replication'
     *   severity: string,                        // 'ok' | 'warning' | 'critical'
     *   thresholds: {warning: number, critical: number},
     *   description: string,                     // human-readable description
     *   dbSpecific: boolean,                     // true if not available on all db types
     * }
     */
    async getKeyMetrics() {
        throw new Error('Not implemented');
    }

    /**
     * Get the capabilities/features supported by this database
     * @returns {Object} Capabilities object
     *
     * Shape:
     * {
     *   replication: boolean,
     *   vacuum: boolean,               // PostgreSQL-specific
     *   indexes: boolean,
     *   locks: boolean,
     *   queryPlan: boolean,
     *   wal: boolean,                  // PostgreSQL-specific (Write-Ahead Log)
     *   schemas: boolean,
     *   storedProcedures: boolean,
     *   partitioning: boolean,
     *   sharding: boolean,             // MongoDB-specific
     * }
     */
    /**
     * Default capability matrix. Adapters override the keys they support.
     * Keep in lock-step with shared/contracts/capabilities — the FE uses
     * this shape to drive tab visibility (B6 + future capability-aware
     * UIs). New keys default to false here so a missing override never
     * accidentally enables a feature the adapter cannot support.
     */
    getCapabilities() {
        return {
            // Storage / structure
            replication: false,
            schemas: false,
            partitioning: false,
            sharding: false,
            // Maintenance
            vacuum: false,
            wal: false,
            // Query analysis
            queryPlan: false, // generic plan capture
            explain: false, // EXPLAIN (ANALYZE, BUFFERS, ...)
            indexes: false, // index stats + advisor
            locks: false,
            // Monitoring depth
            waitEvents: false, // pg_stat_activity-style wait sampling
            queryHistory: false, // pg_stat_statements-style aggregates
            slowQueryLog: false,
            // Procedural / objects
            storedProcedures: false,
            triggers: false,
            // Data ops
            backup: false,
            restore: false,
        };
    }

    /**
     * Helper: Format a timestamp in a standard way across adapters
     * @param {Date|string|number} timestamp
     * @returns {string} ISO 8601 formatted timestamp
     */
    formatTimestamp(timestamp) {
        if (!timestamp) return null;
        if (typeof timestamp === 'string') return timestamp;
        if (timestamp instanceof Date) return timestamp.toISOString();
        return new Date(timestamp).toISOString();
    }

    /**
     * Helper: Normalize a number to 2 decimal places
     * @param {number} value
     * @returns {number}
     */
    round(value, decimals = 2) {
        if (value === null || value === undefined) return null;
        return Number(Number(value).toFixed(decimals));
    }

    /**
     * Helper: Safely get a numeric value, defaulting to 0 if null/undefined
     * @param {any} value
     * @returns {number}
     */
    toNumber(value, defaultValue = 0) {
        const num = Number(value);
        return isNaN(num) ? defaultValue : num;
    }

    /**
     * Helper: Get driver name for error messages
     * @returns {string}
     */
    getDriverName() {
        return 'Unknown Database';
    }

    // ── Optional extended methods ────────────────────────────────────────
    // Adapters may override these to surface engine-specific signals in
    // the Plan / Wait / Bloat panels. Default implementations return a
    // structured "not implemented" shape so the UI can branch cleanly
    // instead of calling a missing method.

    /**
     * Capture an execution plan for a query.
     * @param {string} queryOrId  SQL / PartiQL / CQL, or a native query id.
     * @returns {Promise<{engine: string, plan?: any, error?: string}>}
     */
    async getPlanForQuery(_queryOrId) {
        return {
            engine: this.dbType,
            plan: null,
            note: `Plan capture is not implemented for ${this.dbType}.`,
        };
    }

    /**
     * Engine-native wait-event breakdown for the last hour.
     * @returns {Promise<{window: string, events: Array<{event: string, ms?: number, micros?: number}>, note?: string}>}
     */
    async getWaitEvents() {
        return {
            window: '1h',
            events: [],
            note: `Wait-event introspection is not implemented for ${this.dbType}.`,
        };
    }

    /**
     * Engine-native bloat-equivalent data (PG: dead tuples; RS: unsorted%;
     * Snowflake: time-travel overhead; BQ: cold tables; Dynamo: cold tables).
     */
    async getBloatInfo() {
        return [];
    }

    /**
     * List the schemas visible in the current database. Used by the schema
     * switcher. Default: no schemas (engine has no schema layer we can list).
     * @returns {Promise<Array<{name: string, tableCount?: number}>>}
     */
    async getSchemas() {
        return [];
    }

    /**
     * Set the session's default schema so unqualified names in the SQL console
     * resolve to it. Returns true if the switch was actually applied. Default:
     * not applied (engine has no per-session schema switch).
     * @param {string} _schema
     * @returns {Promise<boolean>}
     */
    async useSchema(_schema) {
        return false;
    }
}

export default BaseAdapter;
