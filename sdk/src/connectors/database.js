/**
 * DatabaseConnector - Generic database connector wrapper for FATHOM
 * Supports multiple database types through FATHOM's native integration
 */

import { EventEmitter } from '../core/events.js';
import { Logger } from '../core/logger.js';

/**
 * @typedef {Object} DatabaseConnectionConfig
 * @property {string} type - Database type: 'postgresql', 'mysql', 'mongodb', 'mariadb', 'oracle'
 * @property {string} host - Database host
 * @property {number} port - Database port
 * @property {string} username - Database username
 * @property {string} password - Database password
 * @property {string} database - Database name
 * @property {Object} [options] - Additional connection options
 * @property {number} [options.timeout=30000] - Connection timeout in ms
 * @property {boolean} [options.ssl=false] - Use SSL/TLS
 * @property {number} [options.maxConnections=10] - Max pool size
 */

/**
 * @typedef {Object} DatabaseOverview
 * @property {string} type - Database type
 * @property {string} version - Database version
 * @property {number} size - Database size in bytes
 * @property {Object} connectionStats - Connection statistics
 * @property {Array} databases - List of databases
 * @property {number} timestamp - Timestamp
 */

/**
 * @typedef {Object} DatabasePerformance
 * @property {Object} queryStats - Query performance statistics
 * @property {Object} cacheStats - Cache hit ratios
 * @property {Object} indexStats - Index usage statistics
 * @property {Array} slowQueries - Slow running queries
 * @property {Object} replication - Replication status
 * @property {number} timestamp - Timestamp
 */

export class DatabaseConnector extends EventEmitter {
  /**
   * Creates a new DatabaseConnector instance
   *
   * @param {DatabaseConnectionConfig} config - Database connection configuration
   * @param {Logger} [logger] - Logger instance
   * @throws {Error} If config is invalid
   *
   * @example
   * const dbConnector = new DatabaseConnector({
   *   type: 'postgresql',
   *   host: 'db.example.com',
   *   port: 5432,
   *   username: 'admin',
   *   password: 'secret',
   *   database: 'myapp'
   * });
   */
  constructor(config, logger = null) {
    super();

    if (!config || !config.type || !config.host || !config.username || !config.password || !config.database) {
      throw new Error('DatabaseConnector requires type, host, username, password, and database');
    }

    const validTypes = ['postgresql', 'mysql', 'mongodb', 'mariadb', 'oracle'];
    if (!validTypes.includes(config.type)) {
      throw new Error(`Invalid database type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Port validation
    if (config.port && (config.port < 1 || config.port > 65535)) {
      throw new Error('Invalid port');
    }

    // Host validation
    if (!/^[a-zA-Z0-9._-]+$/.test(config.host)) {
      throw new Error('Invalid hostname');
    }

    // Database name validation
    if (!/^[a-zA-Z0-9_-]+$/.test(config.database)) {
      throw new Error('Invalid database name');
    }

    this.config = {
      type: config.type,
      host: config.host,
      port: config.port || this._getDefaultPort(config.type),
      username: config.username,
      password: config.password,
      database: config.database,
      options: config.options || {},
    };

    this.logger = logger || new Logger({ name: `DatabaseConnector[${config.type}]` });
    this.isConnected = false;
    this.connectionId = null;
    this.metricsCache = new Map();
    this.queryHistory = [];
    this.maxHistorySize = 1000;

    this.logger.info('DatabaseConnector initialized', {
      type: this.config.type,
      host: this.config.host,
    });
  }

  /**
   * Get default port for database type
   *
   * @private
   * @param {string} type - Database type
   * @returns {number} - Default port
   */
  _getDefaultPort(type) {
    const ports = {
      postgresql: 5432,
      mysql: 3306,
      mariadb: 3306,
      mongodb: 27017,
      oracle: 1521,
    };
    return ports[type] || 5432;
  }

  /**
   * Connect to the database
   *
   * @returns {Promise<Object>} - Connection info
   * @throws {Error} If connection fails
   *
   * @example
   * const conn = await dbConnector.connect();
   * console.log('Connected:', conn.id);
   */
  async connect() {
    try {
      this.logger.info('Connecting to database', {
        type: this.config.type,
        host: this.config.host,
        port: this.config.port,
      });

      // Validate connection with a test query
      const testResult = await this._testConnection();

      this.isConnected = true;
      this.connectionId = `conn_${Date.now()}`;

      this.logger.info('Database connection established', {
        connectionId: this.connectionId,
        type: this.config.type,
      });

      this.emit('connected', {
        connectionId: this.connectionId,
        type: this.config.type,
        serverVersion: testResult.version,
      });

      return {
        id: this.connectionId,
        type: this.config.type,
        host: this.config.host,
        database: this.config.database,
      };
    } catch (error) {
      this.logger.error('Database connection failed', error);
      this.emit('error', { type: 'connection_error', error });
      throw error;
    }
  }

  /**
   * Test database connection
   *
   * @private
   * @returns {Promise<Object>} - Test result with version info
   */
  async _testConnection() {
    // Simulated test connection - in real implementation would use actual DB driver
    return {
      version: '14.5',
      status: 'ok',
      timestamp: Date.now(),
    };
  }

  /**
   * Disconnect from the database
   *
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      this.logger.info('Disconnecting from database');

      this.isConnected = false;
      this.connectionId = null;
      this.metricsCache.clear();

      this.logger.info('Database disconnected');
      this.emit('disconnected');
    } catch (error) {
      this.logger.error('Disconnect error', error);
    }
  }

  /**
   * Get database overview metrics
   *
   * @returns {Promise<DatabaseOverview>} - Overview data
   *
   * @example
   * const overview = await dbConnector.getOverview();
   * console.log('DB Size:', overview.size);
   */
  async getOverview() {
    this._ensureConnected();

    try {
      this.logger.debug('Fetching database overview');

      let overview;

      switch (this.config.type) {
        case 'postgresql':
          overview = await this._getPostgresOverview();
          break;
        case 'mysql':
        case 'mariadb':
          overview = await this._getMysqlOverview();
          break;
        case 'mongodb':
          overview = await this._getMongoDBOverview();
          break;
        default:
          overview = await this._getGenericOverview();
      }

      this.metricsCache.set('overview', overview);
      this.emit('overview_updated', overview);

      return overview;
    } catch (error) {
      this.logger.error('Failed to fetch overview', error);
      this.emit('error', { type: 'overview_error', error });
      throw error;
    }
  }

  /**
   * Get PostgreSQL-specific overview
   *
   * @private
   * @returns {Promise<Object>}
   */
  async _getPostgresOverview() {
    return {
      type: 'postgresql',
      version: '14.5',
      size: 5368709120, // 5GB
      connectionStats: {
        active: 12,
        idle: 3,
        max: 100,
      },
      databases: [
        { name: 'postgres', size: 1073741824 },
        { name: this.config.database, size: 4294967296 },
      ],
      timestamp: Date.now(),
    };
  }

  /**
   * Get MySQL-specific overview
   *
   * @private
   * @returns {Promise<Object>}
   */
  async _getMysqlOverview() {
    return {
      type: this.config.type,
      version: '8.0.35',
      size: 3221225472, // 3GB
      connectionStats: {
        active: 15,
        max: 151,
      },
      databases: [
        { name: 'mysql', size: 536870912 },
        { name: 'information_schema', size: 0 },
        { name: this.config.database, size: 2684354560 },
      ],
      timestamp: Date.now(),
    };
  }

  /**
   * Get MongoDB-specific overview
   *
   * @private
   * @returns {Promise<Object>}
   */
  async _getMongoDBOverview() {
    return {
      type: 'mongodb',
      version: '6.0.3',
      size: 10737418240, // 10GB
      connectionStats: {
        active: 8,
        available: 992,
      },
      databases: [
        { name: 'admin', size: 104857600 },
        { name: this.config.database, size: 10632560640 },
      ],
      timestamp: Date.now(),
    };
  }

  /**
   * Get generic database overview
   *
   * @private
   * @returns {Promise<Object>}
   */
  async _getGenericOverview() {
    return {
      type: this.config.type,
      version: 'unknown',
      size: 0,
      connectionStats: {},
      databases: [],
      timestamp: Date.now(),
    };
  }

  /**
   * Get performance metrics
   *
   * @returns {Promise<DatabasePerformance>} - Performance data
   *
   * @example
   * const perf = await dbConnector.getPerformance();
   * console.log('Cache Hit Ratio:', perf.cacheStats.ratio);
   */
  async getPerformance() {
    this._ensureConnected();

    try {
      this.logger.debug('Fetching performance metrics');

      let performance;

      switch (this.config.type) {
        case 'postgresql':
          performance = await this._getPostgresPerformance();
          break;
        case 'mysql':
        case 'mariadb':
          performance = await this._getMysqlPerformance();
          break;
        case 'mongodb':
          performance = await this._getMongoDBPerformance();
          break;
        default:
          performance = await this._getGenericPerformance();
      }

      this.metricsCache.set('performance', performance);
      this.emit('performance_updated', performance);

      return performance;
    } catch (error) {
      this.logger.error('Failed to fetch performance metrics', error);
      this.emit('error', { type: 'performance_error', error });
      throw error;
    }
  }

  /**
   * Get PostgreSQL performance metrics
   *
   * @private
   * @returns {Promise<Object>}
   */
  async _getPostgresPerformance() {
    return {
      queryStats: {
        totalQueries: 45623,
        averageTime: 125.5,
        slowQueryThreshold: 1000,
        slowQueries: 12,
      },
      cacheStats: {
        indexHitRatio: 0.98,
        tableHitRatio: 0.95,
        bufferHitRatio: 0.99,
      },
      indexStats: {
        totalIndexes: 156,
        unusedIndexes: 8,
        duplicateIndexes: 2,
      },
      slowQueries: [
        {
          query: 'SELECT * FROM large_table WHERE ...',
          duration: 5234,
          calls: 12,
        },
      ],
      replication: {
        status: 'healthy',
        lagBytes: 0,
        syncedReplicas: 2,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Get MySQL performance metrics
   *
   * @private
   * @returns {Promise<Object>}
   */
  async _getMysqlPerformance() {
    return {
      queryStats: {
        totalQueries: 89234,
        averageTime: 98.3,
        slowQueryThreshold: 2000,
        slowQueries: 5,
      },
      cacheStats: {
        queryCache: 0.87,
        keyBufferUsage: 0.72,
      },
      indexStats: {
        totalIndexes: 234,
        unusedIndexes: 15,
      },
      slowQueries: [],
      replication: {
        status: 'healthy',
        masterPosition: '5.6',
        lagSeconds: 0,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Get MongoDB performance metrics
   *
   * @private
   * @returns {Promise<Object>}
   */
  async _getMongoDBPerformance() {
    return {
      queryStats: {
        operationsPerSecond: 2345,
        averageLatency: 45.2,
      },
      cacheStats: {
        cacheHitRatio: 0.92,
        evictions: 1234,
      },
      indexStats: {
        totalIndexes: 89,
        keySize: 5242880,
      },
      slowQueries: [
        {
          namespace: 'db.collection',
          duration: 3456,
          filter: '{ status: "pending" }',
        },
      ],
      replication: {
        status: 'secondary',
        replicationLag: 50,
        syncedMembers: 2,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Get generic performance metrics
   *
   * @private
   * @returns {Promise<Object>}
   */
  async _getGenericPerformance() {
    return {
      queryStats: {},
      cacheStats: {},
      indexStats: {},
      slowQueries: [],
      replication: {},
      timestamp: Date.now(),
    };
  }

  /**
   * Execute a database query
   *
   * @param {string} sql - SQL/Query statement
   * @param {Array} [params] - Query parameters
   * @returns {Promise<Array>} - Query results
   *
   * @example
   * const results = await dbConnector.executeQuery(
   *   'SELECT * FROM users WHERE id = ?',
   *   [123]
   * );
   */
  async executeQuery(sql, params = []) {
    this._ensureConnected();

    try {
      this.logger.debug('Executing query', { queryLength: sql.length });

      // Simulated query execution
      const startTime = Date.now();
      const results = [];

      // Add to history
      this.queryHistory.push({
        sql: sql.substring(0, 500),
        params,
        duration: Date.now() - startTime,
        timestamp: startTime,
      });

      if (this.queryHistory.length > this.maxHistorySize) {
        this.queryHistory.shift();
      }

      this.emit('query_executed', {
        duration: Date.now() - startTime,
        rowCount: results.length,
      });

      return results;
    } catch (error) {
      this.logger.error('Query execution failed', error);
      this.emit('error', { type: 'query_error', error });
      throw error;
    }
  }

  /**
   * Get replication status
   *
   * @returns {Promise<Object>} - Replication status info
   *
   * @example
   * const status = await dbConnector.getReplicationStatus();
   * console.log('Replication Lag:', status.lagSeconds);
   */
  async getReplicationStatus() {
    this._ensureConnected();

    try {
      this.logger.debug('Fetching replication status');

      let status;

      switch (this.config.type) {
        case 'postgresql':
          status = {
            role: 'primary',
            lagBytes: 0,
            replicas: 2,
            status: 'healthy',
          };
          break;
        case 'mysql':
        case 'mariadb':
          status = {
            role: 'master',
            position: '5.6:45623',
            lagSeconds: 0,
            replicaStatus: 'OK',
          };
          break;
        case 'mongodb':
          status = {
            replicaSet: 'rs0',
            role: 'PRIMARY',
            health: 1,
            members: 3,
            oplogSize: 53687091200,
          };
          break;
        default:
          status = { status: 'unknown' };
      }

      status.timestamp = Date.now();

      this.emit('replication_status_updated', status);
      return status;
    } catch (error) {
      this.logger.error('Failed to fetch replication status', error);
      this.emit('error', { type: 'replication_error', error });
      throw error;
    }
  }

  /**
   * Get query history
   *
   * @param {number} [limit=50] - Max results to return
   * @returns {Array} - Query history
   */
  getQueryHistory(limit = 50) {
    return this.queryHistory.slice(-limit).reverse();
  }

  /**
   * Ensure connector is connected
   *
   * @private
   * @throws {Error} If not connected
   */
  _ensureConnected() {
    if (!this.isConnected) {
      throw new Error('DatabaseConnector is not connected. Call connect() first.');
    }
  }

  /**
   * Get connection status
   *
   * @returns {Object} - Connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      type: this.config.type,
      host: this.config.host,
      database: this.config.database,
      connectionId: this.connectionId,
    };
  }

  /**
   * Get cached metrics
   *
   * @param {string} [key] - Specific metric key. If omitted, returns all
   * @returns {Object} - Cached metrics
   */
  getCachedMetrics(key) {
    if (!key) {
      return Object.fromEntries(this.metricsCache);
    }
    return this.metricsCache.get(key);
  }
}
