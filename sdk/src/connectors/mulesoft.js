/**
 * MulesoftConnector - Mulesoft Anypoint Platform integration for FATHOM
 * Provides OAuth authentication and application/API metrics monitoring
 */

import { EventEmitter } from '../core/events.js';
import { Logger } from '../core/logger.js';
import { AuthManager } from '../core/auth.js';

/**
 * @typedef {Object} MulesoftConfig
 * @property {string} anyPointUrl - Anypoint Platform URL (e.g., https://anypoint.mulesoft.com)
 * @property {string} clientId - Connected App client ID
 * @property {string} clientSecret - Connected App client secret
 * @property {string} orgId - Organization ID
 * @property {string} [envId] - Environment ID (optional, defaults to production)
 */

/**
 * @typedef {Object} MulesoftMetrics
 * @property {Array} applications - Deployed applications with metrics
 * @property {Array} apis - Managed APIs with analytics
 * @property {Array} alerts - Active alerts
 * @property {Object} cloudHubMetrics - CloudHub resource metrics
 * @property {number} timestamp - Metric timestamp
 */

export class MulesoftConnector extends EventEmitter {
  /**
   * Creates a new MulesoftConnector instance
   *
   * @param {MulesoftConfig} config - Mulesoft configuration
   * @param {Logger} [logger] - Logger instance
   * @throws {Error} If config is invalid
   *
   * @example
   * const muleConnector = new MulesoftConnector({
   *   anyPointUrl: 'https://anypoint.mulesoft.com',
   *   clientId: 'client_id_here',
   *   clientSecret: 'client_secret_here',
   *   orgId: 'org_id_here'
   * });
   */
  constructor(config, logger = null) {
    super();

    if (!config || !config.anyPointUrl || !config.clientId || !config.clientSecret || !config.orgId) {
      throw new Error('MulesoftConnector requires anyPointUrl, clientId, clientSecret, and orgId');
    }

    this.config = {
      anyPointUrl: config.anyPointUrl.replace(/\/$/, ''),
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      orgId: config.orgId,
      envId: config.envId || null,
    };

    this.logger = logger || new Logger({ name: 'MulesoftConnector' });
    this.auth = null;
    this.isAuthenticated = false;
    this.timeout = 30000;
    this.metricsCache = new Map();
    this.pollInterval = null;

    this.logger.info('MulesoftConnector initialized', { orgId: this.config.orgId });
  }

  /**
   * Authenticate with Mulesoft Anypoint Platform
   *
   * @returns {Promise<Object>} - Authentication response with access token
   *
   * @example
   * const authResponse = await muleConnector.authenticate();
   * console.log('Access Token:', authResponse.access_token);
   */
  async authenticate() {
    try {
      this.logger.info('Authenticating with Mulesoft Anypoint Platform');

      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      });

      const response = await fetch(`${this.config.anyPointUrl}/accounts/api/v2/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Auth failed: ${error.error || response.statusText}`);
      }

      const data = await response.json();

      // Initialize auth manager
      this.auth = new AuthManager(
        {
          type: 'jwt',
          value: data.access_token,
          refreshUrl: `${this.config.anyPointUrl}/accounts/api/v2/oauth2/token`,
          refreshToken: data.refresh_token,
        },
        this.logger
      );

      this.isAuthenticated = true;

      // Set token expiration
      if (data.expires_in) {
        this.auth.setTokenExpiration(data.expires_in);
      }

      this.logger.info('Mulesoft authentication successful');
      this.emit('authenticated', { orgId: this.config.orgId });

      return data;
    } catch (error) {
      this.logger.error('Mulesoft authentication failed', error);
      this.emit('error', { type: 'auth_error', error });
      throw error;
    }
  }

  /**
   * Get list of deployed Mule applications
   *
   * @returns {Promise<Array>} - Array of applications
   *
   * @example
   * const apps = await muleConnector.getApps();
   * apps.forEach(app => {
   *   console.log(`${app.name}: ${app.status}`);
   * });
   */
  async getApps() {
    this._ensureAuthenticated();

    try {
      this.logger.debug('Fetching Mule applications');

      const response = await this._request(
        `/hybrid/api/v1/applications?orgId=${this.config.orgId}${this.config.envId ? `&envId=${this.config.envId}` : ''}`,
        {
          method: 'GET',
        }
      );

      const apps = response.data || [];

      this.emit('apps_fetched', { count: apps.length });
      return apps;
    } catch (error) {
      this.logger.error('Failed to fetch applications', error);
      this.emit('error', { type: 'apps_error', error });
      throw error;
    }
  }

  /**
   * Get metrics for a specific application
   *
   * @param {string} appId - Application ID
   * @returns {Promise<Object>} - Application metrics
   *
   * @example
   * const metrics = await muleConnector.getAppMetrics('app_123');
   * console.log('CPU:', metrics.cpu);
   * console.log('Memory:', metrics.memory);
   */
  async getAppMetrics(appId) {
    this._ensureAuthenticated();

    try {
      this.logger.debug('Fetching app metrics', { appId });

      // Fetch application stats
      const response = await this._request(
        `/hybrid/api/v1/applications/${appId}/statistics?orgId=${this.config.orgId}${this.config.envId ? `&envId=${this.config.envId}` : ''}`,
        {
          method: 'GET',
        }
      );

      const metrics = {
        appId,
        cpu: response.cpuUsage || 0,
        memory: response.memoryUsage || 0,
        threads: response.threadCount || 0,
        messageCount: response.messages || 0,
        errorRate: response.errorRate || 0,
        uptime: response.uptime || 0,
        timestamp: Date.now(),
      };

      this.metricsCache.set(appId, metrics);
      this.emit('app_metrics_updated', metrics);

      return metrics;
    } catch (error) {
      this.logger.error('Failed to fetch app metrics', error);
      this.emit('error', { type: 'app_metrics_error', error });
      throw error;
    }
  }

  /**
   * Get list of managed APIs
   *
   * @returns {Promise<Array>} - Array of managed APIs
   *
   * @example
   * const apis = await muleConnector.getApiManagerApis();
   * apis.forEach(api => {
   *   console.log(`${api.name}: v${api.version}`);
   * });
   */
  async getApiManagerApis() {
    this._ensureAuthenticated();

    try {
      this.logger.debug('Fetching API Manager APIs');

      const response = await this._request(`/apimanager/api/v1/organizations/${this.config.orgId}/apis`, {
        method: 'GET',
      });

      const apis = response.apis || response;

      this.emit('apis_fetched', { count: apis.length });
      return apis;
    } catch (error) {
      this.logger.error('Failed to fetch APIs', error);
      this.emit('error', { type: 'apis_error', error });
      throw error;
    }
  }

  /**
   * Get analytics and metrics for a managed API
   *
   * @param {string} apiId - API ID
   * @param {Object} [options] - Query options
   * @param {number} [options.duration=3600] - Duration in seconds
   * @returns {Promise<Object>} - API analytics
   *
   * @example
   * const analytics = await muleConnector.getApiAnalytics('api_456', {
   *   duration: 86400 // Last 24 hours
   * });
   */
  async getApiAnalytics(apiId, options = {}) {
    this._ensureAuthenticated();

    try {
      const duration = options.duration || 3600;
      const endTime = Date.now();
      const startTime = endTime - duration * 1000;

      this.logger.debug('Fetching API analytics', { apiId, duration });

      const response = await this._request(
        `/analytics/1.0/metrics/organizations/${this.config.orgId}/apis/${apiId}?from=${startTime}&to=${endTime}`,
        {
          method: 'GET',
        }
      );

      const analytics = {
        apiId,
        requestCount: response.total_requests || 0,
        errorCount: response.total_errors || 0,
        averageLatency: response.average_latency || 0,
        peakLatency: response.peak_latency || 0,
        minLatency: response.min_latency || 0,
        successRate: response.success_rate || 0,
        timestamp: Date.now(),
      };

      this.emit('api_analytics_updated', analytics);
      return analytics;
    } catch (error) {
      this.logger.error('Failed to fetch API analytics', error);
      this.emit('error', { type: 'api_analytics_error', error });
      throw error;
    }
  }

  /**
   * Get active alerts
   *
   * @param {Object} [options] - Query options
   * @param {boolean} [options.activeOnly=true] - Only return active alerts
   * @param {number} [options.limit=100] - Max number of alerts
   * @returns {Promise<Array>} - Alert list
   *
   * @example
   * const alerts = await muleConnector.getAlerts({ activeOnly: true });
   */
  async getAlerts(options = {}) {
    this._ensureAuthenticated();

    try {
      const activeOnly = options.activeOnly !== false;
      const limit = options.limit || 100;

      this.logger.debug('Fetching alerts', { activeOnly, limit });

      const response = await this._request(
        `/alerts/api/v2/organizations/${this.config.orgId}/alerts?active=${activeOnly}&limit=${limit}`,
        {
          method: 'GET',
        }
      );

      const alerts = response.alerts || response.data || [];

      this.emit('alerts_fetched', { count: alerts.length, activeOnly });
      return alerts;
    } catch (error) {
      this.logger.error('Failed to fetch alerts', error);
      this.emit('error', { type: 'alerts_error', error });
      throw error;
    }
  }

  /**
   * Get audit log events
   *
   * @param {Object} [options] - Query options
   * @param {number} [options.daysBack=7] - Number of days to query
   * @param {number} [options.limit=100] - Max number of records
   * @returns {Promise<Array>} - Audit log events
   *
   * @example
   * const events = await muleConnector.getAuditLogs({ daysBack: 1 });
   */
  async getAuditLogs(options = {}) {
    this._ensureAuthenticated();

    try {
      const daysBack = options.daysBack || 7;
      const limit = options.limit || 100;
      const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

      this.logger.debug('Fetching audit logs', { daysBack, limit });

      const response = await this._request(
        `/audit/api/v1/organizations/${this.config.orgId}/logs?startDate=${startDate}&limit=${limit}`,
        {
          method: 'GET',
        }
      );

      const logs = response.logs || response.data || [];

      this.emit('audit_logs_fetched', { count: logs.length });
      return logs;
    } catch (error) {
      this.logger.error('Failed to fetch audit logs', error);
      this.emit('error', { type: 'audit_logs_error', error });
      throw error;
    }
  }

  /**
   * Sync Mulesoft metrics to FATHOM dashboard
   *
   * @param {Object} fathomClient - FathomClient instance
   * @param {Object} [options] - Sync options
   * @param {boolean} [options.includeApps=true] - Include application metrics
   * @param {boolean} [options.includeApis=true] - Include API metrics
   * @param {boolean} [options.includeAlerts=true] - Include alerts
   * @returns {Promise<Object>} - Sync result
   *
   * @example
   * await muleConnector.syncToFathom(fathomClient, {
   *   includeApps: true,
   *   includeApis: true
   * });
   */
  async syncToFathom(fathomClient, options = {}) {
    this._ensureAuthenticated();

    try {
      this.logger.info('Starting Mulesoft metrics sync to FATHOM');

      const fathomMetrics = {
        platform: 'mulesoft',
        orgId: this.config.orgId,
        metrics: {},
        timestamp: Date.now(),
      };

      // Fetch application metrics if enabled
      if (options.includeApps !== false) {
        try {
          const apps = await this.getApps();
          const appMetrics = [];

          for (const app of apps) {
            const metrics = await this.getAppMetrics(app.id);
            appMetrics.push(metrics);
          }

          fathomMetrics.metrics.applications = appMetrics;
          fathomMetrics.metrics.appCount = apps.length;
        } catch (error) {
          this.logger.warn('Failed to sync app metrics', error);
        }
      }

      // Fetch API metrics if enabled
      if (options.includeApis !== false) {
        try {
          const apis = await this.getApiManagerApis();
          const apiMetrics = [];

          for (const api of apis.slice(0, 10)) {
            // Limit to first 10 APIs
            const analytics = await this.getApiAnalytics(api.id);
            apiMetrics.push(analytics);
          }

          fathomMetrics.metrics.apis = apiMetrics;
          fathomMetrics.metrics.apiCount = apis.length;
        } catch (error) {
          this.logger.warn('Failed to sync API metrics', error);
        }
      }

      // Fetch alerts if enabled
      if (options.includeAlerts !== false) {
        try {
          const alerts = await this.getAlerts();
          fathomMetrics.metrics.activeAlerts = alerts.filter((a) => a.active).length;
          fathomMetrics.metrics.totalAlerts = alerts.length;
        } catch (error) {
          this.logger.warn('Failed to sync alerts', error);
        }
      }

      this.logger.info('Metrics synced to FATHOM', { metrics: Object.keys(fathomMetrics.metrics) });
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
      const url = `${this.config.anyPointUrl}${endpoint}`;
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
      throw new Error('MulesoftConnector is not authenticated. Call authenticate() first.');
    }
  }

  /**
   * Disconnect from Mulesoft
   *
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      this.isAuthenticated = false;
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
      }
      this.logger.info('Disconnected from Mulesoft');
      this.emit('disconnected');
    } catch (error) {
      this.logger.error('Disconnect error', error);
    }
  }
}
