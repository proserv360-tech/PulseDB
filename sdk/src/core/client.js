/**
 * FathomClient - Core FATHOM SDK client
 * Universal database monitoring integration with external platform connectors
 */

import { EventEmitter } from './events.js';
import { Logger } from './logger.js';
import { AuthManager } from './auth.js';

/**
 * @typedef {Object} FathomClientConfig
 * @property {string} baseUrl - FATHOM API base URL
 * @property {string} apiKey - API key for authentication
 * @property {string} orgId - Organization ID
 * @property {Object} [options] - Additional options
 * @property {number} [options.timeout=30000] - Request timeout in ms
 * @property {number} [options.retryAttempts=3] - Max retry attempts
 * @property {number} [options.retryDelay=1000] - Initial retry delay in ms
 * @property {string} [options.logLevel='info'] - Log level
 */

/**
 * @typedef {Object} FathomMetrics
 * @property {string} dbType - Database type (postgresql, mysql, mongodb)
 * @property {string} connectionId - Connection ID
 * @property {Object} metrics - Performance metrics
 * @property {number} timestamp - Metric timestamp
 */

export class FathomClient extends EventEmitter {
  /**
   * Creates a new FathomClient instance
   *
   * @param {FathomClientConfig} config - Client configuration
   * @throws {Error} If config is invalid
   *
   * @example
   * const client = new FathomClient({
   *   baseUrl: 'https://api.fathom.example.com',
   *   apiKey: 'sk_test_...',
   *   orgId: 'org_123',
   *   options: {
   *     logLevel: 'debug',
   *     retryAttempts: 5
   *   }
   * });
   */
  constructor(config) {
    super();

    if (!config || !config.baseUrl || !config.apiKey || !config.orgId) {
      throw new Error('FathomClient requires baseUrl, apiKey, and orgId');
    }

    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.orgId = config.orgId;

    // Initialize options
    const opts = config.options || {};
    this.timeout = opts.timeout || 30000;
    this.retryAttempts = opts.retryAttempts || 3;
    this.retryDelay = opts.retryDelay || 1000;

    // Initialize core components
    this.logger = new Logger({
      name: 'FathomClient',
      level: opts.logLevel || 'info',
    });

    this.auth = new AuthManager(
      {
        type: 'apiKey',
        value: config.apiKey,
      },
      this.logger
    );

    // State management
    this.isConnected = false;
    this.connections = new Map();
    this.subscriptions = new Map();
    this.metrics = new Map();
    this.healthCheckInterval = null;
    this.metricsCollectionInterval = null;

    this.logger.info('FathomClient initialized', { baseUrl: this.baseUrl, orgId: this.orgId });
  }

  /**
   * Connect to FATHOM API
   *
   * @returns {Promise<void>}
   * @throws {Error} If connection fails
   *
   * @example
   * await client.connect();
   * console.log('Connected to FATHOM');
   */
  async connect() {
    try {
      this.logger.info('Connecting to FATHOM');

      const response = await this._request('/api/v1/health', {
        method: 'GET',
      });

      if (response.status !== 'ok') {
        throw new Error('FATHOM health check failed');
      }

      this.isConnected = true;
      this.logger.info('Connected to FATHOM successfully');
      this.emit('connected', { timestamp: Date.now() });

      // Start health checks and metrics collection
      this._startHealthChecks();
      return response;
    } catch (error) {
      this.logger.error('Connection failed', error);
      this.emit('error', { type: 'connection_error', error });
      throw error;
    }
  }

  /**
   * Disconnect from FATHOM API
   *
   * @returns {Promise<void>}
   *
   * @example
   * await client.disconnect();
   */
  async disconnect() {
    try {
      this.logger.info('Disconnecting from FATHOM');

      // Stop health checks
      this._stopHealthChecks();

      // Close all connections
      for (const [id, conn] of this.connections) {
        try {
          await this._request(`/api/v1/connections/${id}`, {
            method: 'DELETE',
          });
        } catch (error) {
          this.logger.warn(`Failed to close connection ${id}`, error);
        }
      }

      this.connections.clear();
      this.subscriptions.clear();
      this.metrics.clear();

      this.isConnected = false;
      this.logger.info('Disconnected from FATHOM');
      this.emit('disconnected', { timestamp: Date.now() });
    } catch (error) {
      this.logger.error('Disconnection error', error);
      throw error;
    }
  }

  /**
   * Get metrics for a specific database type
   *
   * @param {string} dbType - Database type (postgresql, mysql, mongodb)
   * @param {Object} [options] - Query options
   * @param {string} [options.connectionId] - Specific connection ID
   * @param {number} [options.timeRange] - Time range in seconds
   * @returns {Promise<Object>} - Metrics data
   *
   * @example
   * const metrics = await client.getMetrics('postgresql', {
   *   timeRange: 3600
   * });
   */
  async getMetrics(dbType, options = {}) {
    this._ensureConnected();

    try {
      this.logger.debug('Fetching metrics', { dbType, options });

      const params = new URLSearchParams({
        db_type: dbType,
        org_id: this.orgId,
        ...options,
      });

      const response = await this._request(`/api/v1/metrics?${params.toString()}`, {
        method: 'GET',
      });

      this.emit('metrics', response);
      return response;
    } catch (error) {
      this.logger.error('Failed to fetch metrics', error);
      this.emit('error', { type: 'metrics_error', error });
      throw error;
    }
  }

  /**
   * Subscribe to an event
   *
   * @param {string} event - Event name (alert, metric, connection, etc.)
   * @param {Function} callback - Callback function
   * @returns {string} - Subscription ID
   *
   * @example
   * const subId = client.subscribe('alert', (alert) => {
   *   console.log('Alert:', alert);
   * });
   */
  subscribe(event, callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    // Check subscription limit
    if (this.subscriptions.get(event)?.size >= 100) {
      throw new Error('Maximum subscribers exceeded for event');
    }

    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, new Map());
    }

    this.subscriptions.get(event).set(subscriptionId, callback);

    // Also register with EventEmitter
    this.on(event, callback);

    this.logger.debug('Subscription created', { event, subscriptionId });

    return subscriptionId;
  }

  /**
   * Unsubscribe from an event
   *
   * @param {string} event - Event name
   * @param {string} subscriptionId - Subscription ID from subscribe()
   * @returns {boolean} - True if subscription was removed
   */
  unsubscribe(event, subscriptionId) {
    if (!this.subscriptions.has(event)) {
      return false;
    }

    const callbacks = this.subscriptions.get(event);
    const callback = callbacks.get(subscriptionId);

    if (!callback) {
      return false;
    }

    callbacks.delete(subscriptionId);
    this.off(event, callback);

    this.logger.debug('Subscription removed', { event, subscriptionId });

    return true;
  }

  /**
   * Execute a raw SQL query
   *
   * @param {string} sql - SQL query
   * @param {Object} [options] - Query options
   * @param {string} [options.connectionId] - Connection ID
   * @param {Array} [options.params] - Query parameters
   * @returns {Promise<Array>} - Query results
   *
   * @example
   * const results = await client.query('SELECT * FROM users LIMIT 10', {
   *   connectionId: 'conn_123'
   * });
   */
  async query(sql, options = {}) {
    this._ensureConnected();

    try {
      this.logger.debug('Executing query', { connectionId: options.connectionId });

      const response = await this._request('/api/v1/query', {
        method: 'POST',
        body: JSON.stringify({
          sql,
          connection_id: options.connectionId,
          params: options.params || [],
        }),
      });

      return response.results || response;
    } catch (error) {
      this.logger.error('Query execution failed', error);
      this.emit('error', { type: 'query_error', error });
      throw error;
    }
  }

  /**
   * Get all active connections
   *
   * @returns {Promise<Array>} - Array of connections
   *
   * @example
   * const connections = await client.getConnections();
   * connections.forEach(conn => {
   *   console.log(`${conn.name}: ${conn.type}`);
   * });
   */
  async getConnections() {
    this._ensureConnected();

    try {
      this.logger.debug('Fetching connections');

      const response = await this._request(`/api/v1/organizations/${this.orgId}/connections`, {
        method: 'GET',
      });

      const connections = response.connections || response;

      // Cache connections
      for (const conn of connections) {
        this.connections.set(conn.id, conn);
      }

      return connections;
    } catch (error) {
      this.logger.error('Failed to fetch connections', error);
      this.emit('error', { type: 'connections_error', error });
      throw error;
    }
  }

  /**
   * Perform a health check
   *
   * @returns {Promise<Object>} - Health status
   *
   * @example
   * const health = await client.healthCheck();
   * console.log('API Status:', health.status);
   */
  async healthCheck() {
    try {
      const response = await this._request('/api/v1/health', {
        method: 'GET',
      });

      if (response.status === 'ok') {
        this.logger.debug('Health check passed');
      } else {
        this.logger.warn('Health check failed', response);
      }

      return response;
    } catch (error) {
      this.logger.error('Health check failed', error);
      this.isConnected = false;
      this.emit('error', { type: 'health_check_error', error });
      throw error;
    }
  }

  /**
   * Make an HTTP request with retry logic and exponential backoff
   *
   * @private
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} - Response data
   */
  async _request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    let lastError;

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        const headers = {
          'Content-Type': 'application/json',
          'X-Organization-ID': this.orgId,
          ...this.auth.getHeaders(),
          ...options.headers,
        };

        // Check if token needs refresh
        if (this.auth.isExpired()) {
          try {
            await this.auth.refreshJWT();
          } catch (error) {
            this.logger.warn('Token refresh failed', error);
          }
        }

        const fetchOptions = {
          ...options,
          headers,
          signal: AbortSignal.timeout(this.timeout),
        };

        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Unauthorized - Invalid API key');
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        lastError = error;

        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          this.logger.warn(`Request failed, retrying in ${delay}ms`, { attempt, error: error.message });
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Ensure client is connected
   *
   * @private
   * @throws {Error} If not connected
   */
  _ensureConnected() {
    if (!this.isConnected) {
      throw new Error('FathomClient is not connected. Call connect() first.');
    }
  }

  /**
   * Start periodic health checks
   *
   * @private
   */
  _startHealthChecks() {
    // Run health check every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.healthCheck().catch((error) => {
        this.logger.warn('Health check error', error);
      });
    }, 30000);
  }

  /**
   * Stop periodic health checks
   *
   * @private
   */
  _stopHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = null;
    }
  }

  /**
   * Get logger instance
   *
   * @returns {Logger} - Logger instance
   */
  getLogger() {
    return this.logger;
  }

  /**
   * Get authentication manager instance
   *
   * @returns {AuthManager} - AuthManager instance
   */
  getAuthManager() {
    return this.auth;
  }
}
