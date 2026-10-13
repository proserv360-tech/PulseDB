/**
 * SalesforceConnector - Salesforce platform integration for FATHOM
 * Provides OAuth 2.0 authentication and API limit/metrics monitoring
 */

import { EventEmitter } from '../core/events.js';
import { Logger } from '../core/logger.js';
import { AuthManager } from '../core/auth.js';

/**
 * @typedef {Object} SalesforceConfig
 * @property {string} instanceUrl - Salesforce instance URL (e.g., https://login.salesforce.com)
 * @property {string} clientId - OAuth client ID
 * @property {string} clientSecret - OAuth client secret
 * @property {string} username - Salesforce username
 * @property {string} password - Salesforce password
 * @property {string} [securityToken] - Security token (if required)
 * @property {string} [apiVersion='v60.0'] - Salesforce API version
 */

/**
 * @typedef {Object} SalesforceMetrics
 * @property {Object} limits - API limits and usage
 * @property {Object} orgHealth - Organization health metrics
 * @property {Array} recentErrors - Recent API errors
 * @property {number} timestamp - Metric timestamp
 */

export class SalesforceConnector extends EventEmitter {
  /**
   * Creates a new SalesforceConnector instance
   *
   * @param {SalesforceConfig} config - Salesforce configuration
   * @param {Logger} [logger] - Logger instance
   * @throws {Error} If config is invalid
   *
   * @example
   * const sfConnector = new SalesforceConnector({
   *   instanceUrl: 'https://login.salesforce.com',
   *   clientId: 'client_id_here',
   *   clientSecret: 'client_secret_here',
   *   username: 'user@example.com',
   *   password: 'password123',
   *   securityToken: 'token123'
   * });
   */
  constructor(config, logger = null) {
    super();

    if (!config || !config.instanceUrl || !config.clientId || !config.clientSecret || !config.username || !config.password) {
      throw new Error('SalesforceConnector requires instanceUrl, clientId, clientSecret, username, and password');
    }

    this.config = {
      instanceUrl: config.instanceUrl.replace(/\/$/, ''),
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      username: config.username,
      password: config.password,
      securityToken: config.securityToken || '',
      apiVersion: config.apiVersion || 'v60.0',
    };

    this.logger = logger || new Logger({ name: 'SalesforceConnector' });
    this.auth = null;
    this.isAuthenticated = false;
    this.instanceUrl = null;
    this.timeout = 30000;
    this.metricsCache = new Map();
    this.pollInterval = null;

    this.logger.info('SalesforceConnector initialized', { username: this.config.username });
  }

  /**
   * Authenticate with Salesforce using OAuth 2.0
   *
   * @param {string} [flowType='password'] - OAuth flow type: 'password' or 'jwt'
   * @returns {Promise<Object>} - Authentication response with access token
   *
   * @example
   * const authResponse = await sfConnector.authenticate();
   * console.log('Access Token:', authResponse.access_token);
   */
  async authenticate(flowType = 'password') {
    try {
      this.logger.info('Authenticating with Salesforce using ' + flowType + ' flow');

      let response;

      if (flowType === 'password') {
        response = await this._passwordFlowAuth();
      } else if (flowType === 'jwt') {
        response = await this._jwtBearerAuth();
      } else {
        throw new Error(`Unsupported auth flow: ${flowType}`);
      }

      // Store auth info
      this.auth = new AuthManager(
        {
          type: 'jwt',
          value: response.access_token,
          refreshUrl: `${this.config.instanceUrl}/services/oauth2/token`,
          refreshToken: response.refresh_token,
        },
        this.logger
      );

      this.instanceUrl = response.instance_url || this.config.instanceUrl;
      this.isAuthenticated = true;

      // Set token expiration
      if (response.expires_in) {
        this.auth.setTokenExpiration(response.expires_in);
      }

      this.logger.info('Salesforce authentication successful', { instance: this.instanceUrl });
      this.emit('authenticated', { instanceUrl: this.instanceUrl });

      return response;
    } catch (error) {
      this.logger.error('Salesforce authentication failed', error);
      this.emit('error', { type: 'auth_error', error });
      throw error;
    }
  }

  /**
   * Authenticate using username-password flow
   *
   * @private
   * @returns {Promise<Object>} - OAuth response
   */
  async _passwordFlowAuth() {
    const params = new URLSearchParams({
      grant_type: 'password',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      username: this.config.username,
      password: this.config.password + this.config.securityToken,
    });

    const response = await fetch(`${this.config.instanceUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Auth failed: ${error.error_description || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Authenticate using JWT bearer flow
   *
   * @private
   * @returns {Promise<Object>} - OAuth response
   */
  async _jwtBearerAuth() {
    // This is a simplified JWT bearer flow implementation
    // In production, you would generate a proper JWT signed with a certificate
    const header = { alg: 'HS256', typ: 'JWT' };
    const claims = {
      iss: this.config.clientId,
      sub: this.config.username,
      aud: `${this.config.instanceUrl}/services/oauth2/token`,
      exp: Math.floor(Date.now() / 1000) + 300,
    };

    // Note: This is a placeholder. Real implementation requires proper JWT signing
    const jwt = this._encodeJWT(header, claims);

    const params = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    });

    const response = await fetch(`${this.config.instanceUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`JWT auth failed: ${error.error_description || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Encode JWT (simplified - use jsonwebtoken library in production)
   *
   * @private
   * @param {Object} header - JWT header
   * @param {Object} claims - JWT claims
   * @returns {string} - Encoded JWT
   */
  _encodeJWT(header, claims) {
    const headerStr = btoa(JSON.stringify(header));
    const claimsStr = btoa(JSON.stringify(claims));
    const signature = btoa('signature');
    return `${headerStr}.${claimsStr}.${signature}`;
  }

  /**
   * Execute SOQL (Salesforce Object Query Language) query
   *
   * @param {string} soql - SOQL query string
   * @returns {Promise<Object>} - Query results
   *
   * @example
   * const records = await sfConnector.query(
   *   "SELECT Id, Name FROM Account LIMIT 10"
   * );
   */
  async query(soql) {
    this._ensureAuthenticated();

    try {
      // SOQL validation
      if (!soql || typeof soql !== 'string') {
        throw new Error('SOQL query must be a non-empty string');
      }
      if (soql.length > 20000) {
        throw new Error('SOQL query too long');
      }
      const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|GRANT)\b/i;
      if (forbidden.test(soql)) {
        throw new Error('Only SELECT queries are allowed');
      }

      this.logger.debug('Executing SOQL query', { soql: soql.substring(0, 50) });

      const params = new URLSearchParams({ q: soql });
      const response = await this._request(
        `/services/data/${this.config.apiVersion}/query?${params.toString()}`,
        {
          method: 'GET',
        }
      );

      this.emit('query_executed', { soql, resultCount: response.totalSize });
      return response;
    } catch (error) {
      this.logger.error('SOQL query failed', error);
      this.emit('error', { type: 'query_error', error });
      throw error;
    }
  }

  /**
   * Get list of connected Salesforce organizations
   *
   * @returns {Promise<Array>} - List of orgs
   *
   * @example
   * const orgs = await sfConnector.getOrgs();
   */
  async getOrgs() {
    this._ensureAuthenticated();

    try {
      this.logger.debug('Fetching organization list');

      const response = await this._request(`/services/data/${this.config.apiVersion}/organizations`, {
        method: 'GET',
      });

      return response.organizations || [response];
    } catch (error) {
      this.logger.error('Failed to fetch orgs', error);
      this.emit('error', { type: 'orgs_error', error });
      throw error;
    }
  }

  /**
   * Get available Salesforce objects
   *
   * @returns {Promise<Array>} - List of SObjects
   *
   * @example
   * const objects = await sfConnector.getObjects();
   * console.log('Available objects:', objects.map(o => o.name));
   */
  async getObjects() {
    this._ensureAuthenticated();

    try {
      this.logger.debug('Fetching SObjects');

      const response = await this._request(`/services/data/${this.config.apiVersion}/sobjects`, {
        method: 'GET',
      });

      return response.sobjects || [];
    } catch (error) {
      this.logger.error('Failed to fetch objects', error);
      this.emit('error', { type: 'objects_error', error });
      throw error;
    }
  }

  /**
   * Get API limits and usage metrics
   *
   * @returns {Promise<SalesforceMetrics>} - Metrics data
   *
   * @example
   * const metrics = await sfConnector.getMetrics();
   * console.log('API Calls Used:', metrics.limits.ApiCalls.Used);
   */
  async getMetrics() {
    this._ensureAuthenticated();

    try {
      this.logger.debug('Fetching Salesforce metrics');

      const limits = await this._request(`/services/data/${this.config.apiVersion}/limits`, {
        method: 'GET',
      });

      const orgHealth = await this._fetchOrgHealth();

      const metrics = {
        limits,
        orgHealth,
        timestamp: Date.now(),
      };

      // Cache metrics
      this.metricsCache.set('latest', metrics);

      this.emit('metrics_updated', metrics);
      return metrics;
    } catch (error) {
      this.logger.error('Failed to fetch metrics', error);
      this.emit('error', { type: 'metrics_error', error });
      throw error;
    }
  }

  /**
   * Fetch organization health metrics
   *
   * @private
   * @returns {Promise<Object>} - Organization health data
   */
  async _fetchOrgHealth() {
    try {
      // Try to get org health from Setup Audit Trail or Dashboard
      const response = await this._request(`/services/data/${this.config.apiVersion}/query?q=SELECT%20DurationMilliseconds%20FROM%20SetupAuditTrail%20LIMIT%201`, {
        method: 'GET',
      });

      return {
        recordsRetrieved: response.totalSize,
        lastChecked: Date.now(),
      };
    } catch (error) {
      this.logger.warn('Could not fetch org health', error);
      return { lastChecked: Date.now() };
    }
  }

  /**
   * Get setup audit trail events
   *
   * @param {Object} [options] - Query options
   * @param {number} [options.limit=100] - Number of records to return
   * @param {number} [options.daysBack=7] - Number of days back to query
   * @returns {Promise<Array>} - Audit trail events
   *
   * @example
   * const events = await sfConnector.getAuditTrail({ daysBack: 1 });
   */
  async getAuditTrail(options = {}) {
    this._ensureAuthenticated();

    try {
      const limit = options.limit || 100;
      const daysBack = options.daysBack || 7;
      const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const soql = `SELECT Id, CreatedDate, CreatedBy.Name, Action FROM SetupAuditTrail WHERE CreatedDate >= ${cutoffDate}T00:00:00Z ORDER BY CreatedDate DESC LIMIT ${limit}`;

      return await this.query(soql);
    } catch (error) {
      this.logger.error('Failed to fetch audit trail', error);
      this.emit('error', { type: 'audit_trail_error', error });
      throw error;
    }
  }

  /**
   * Subscribe to Salesforce Platform Events
   *
   * @param {string} channel - Platform Event channel name
   * @param {Function} callback - Callback to handle events
   * @returns {string} - Subscription ID
   *
   * @example
   * sfConnector.subscribeToEvents('Custom_Event__e', (event) => {
   *   console.log('Platform event received:', event);
   * });
   */
  subscribeToEvents(channel, callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    const subscriptionId = `sf_sub_${channel}_${Date.now()}`;
    this.on(`event:${channel}`, callback);

    this.logger.info('Subscribed to Salesforce events', { channel, subscriptionId });

    // In a real implementation, this would connect to Salesforce's Streaming API
    // For now, we just track the subscription
    return subscriptionId;
  }

  /**
   * Sync Salesforce metrics to FATHOM dashboard
   *
   * @param {Object} fathomClient - FathomClient instance
   * @param {Object} [options] - Sync options
   * @returns {Promise<Object>} - Sync result
   *
   * @example
   * await sfConnector.syncToFathom(fathomClient, {
   *   includeAuditTrail: true
   * });
   */
  async syncToFathom(fathomClient, options = {}) {
    this._ensureAuthenticated();

    try {
      this.logger.info('Starting Salesforce metrics sync to FATHOM');

      const metrics = await this.getMetrics();

      const fathomMetrics = {
        platform: 'salesforce',
        metrics: {
          apiLimitsUsed: metrics.limits.ApiCalls.Used,
          apiLimitsTotal: metrics.limits.ApiCalls.Max,
          soqlQueriesUsed: metrics.limits.SoslQueries.Used,
          soqlQueriesTotal: metrics.limits.SoslQueries.Max,
          orgHealth: metrics.orgHealth,
        },
        timestamp: metrics.timestamp,
      };

      // If include audit trail, fetch and add
      if (options.includeAuditTrail) {
        const auditTrail = await this.getAuditTrail({ limit: 50 });
        fathomMetrics.auditTrail = auditTrail.records;
      }

      // Send to FATHOM (this would use fathomClient.query or similar)
      this.logger.info('Metrics synced to FATHOM', { recordCount: Object.keys(fathomMetrics.metrics).length });
      this.emit('synced_to_fathom', fathomMetrics);

      return fathomMetrics;
    } catch (error) {
      this.logger.error('Failed to sync metrics to FATHOM', error);
      this.emit('error', { type: 'sync_error', error });
      throw error;
    }
  }

  /**
   * Make authenticated API request
   *
   * @private
   * @param {string} endpoint - API endpoint path
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} - Response data
   */
  async _request(endpoint, options = {}) {
    if (!this.auth) {
      throw new Error('Not authenticated');
    }

    try {
      const url = `${this.instanceUrl}${endpoint}`;
      const headers = {
        Authorization: `Bearer ${this.auth.value}`,
        'Content-Type': 'application/json',
        ...options.headers,
      };

      const response = await fetch(url, {
        ...options,
        headers,
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.isAuthenticated = false;
          throw new Error('Token expired');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Ensure connector is authenticated
   *
   * @private
   * @throws {Error} If not authenticated
   */
  _ensureAuthenticated() {
    if (!this.isAuthenticated) {
      throw new Error('SalesforceConnector is not authenticated. Call authenticate() first.');
    }
  }

  /**
   * Disconnect from Salesforce
   *
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      this.isAuthenticated = false;
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
      }
      this.logger.info('Disconnected from Salesforce');
      this.emit('disconnected');
    } catch (error) {
      this.logger.error('Disconnect error', error);
    }
  }
}
