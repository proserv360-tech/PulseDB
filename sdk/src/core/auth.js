/**
 * AuthManager - Authentication and authorization management for FATHOM SDK
 * Supports API key and JWT token authentication with automatic refresh
 */

/**
 * @typedef {Object} AuthConfig
 * @property {'apiKey'|'jwt'} type - Authentication type
 * @property {string} value - API key or JWT token
 * @property {string} [refreshUrl] - URL to refresh JWT tokens
 * @property {string} [refreshToken] - Refresh token for JWT flow
 */

/**
 * @typedef {Object} AuthHeaders
 * @property {string} Authorization - Authorization header value
 * @property {'X-API-Key'|'Bearer'} [type] - Header type
 */

export class AuthManager {
  /**
   * Creates a new AuthManager instance
   *
   * @param {AuthConfig} config - Authentication configuration
   * @param {Logger} [logger] - Logger instance for debug output
   *
   * @example
   * const auth = new AuthManager({
   *   type: 'apiKey',
   *   value: 'sk_test_...'
   * });
   *
   * @example
   * const auth = new AuthManager({
   *   type: 'jwt',
   *   value: 'eyJhbGc...',
   *   refreshUrl: 'https://api.example.com/auth/refresh',
   *   refreshToken: 'refresh_...'
   * });
   */
  constructor(config, logger = null) {
    if (!config || !config.type || !config.value) {
      throw new Error('AuthManager requires config with type and value');
    }

    if (!['apiKey', 'jwt'].includes(config.type)) {
      throw new Error("Invalid auth type. Must be 'apiKey' or 'jwt'");
    }

    this.type = config.type;
    this.value = config.value;
    this.refreshUrl = config.refreshUrl || null;
    this.refreshToken = config.refreshToken || null;
    this.logger = logger;
    this.tokenExpiresAt = null;
    this.isRefreshing = false;
    this.refreshPromise = null;
  }

  /**
   * Get the authentication headers for HTTP requests
   *
   * @returns {Object} - Headers object with authorization
   *
   * @example
   * const headers = auth.getHeaders();
   * // { 'X-API-Key': 'sk_test_...' }
   */
  getHeaders() {
    const headers = {};

    if (this.type === 'apiKey') {
      headers['X-API-Key'] = this.value;
    } else if (this.type === 'jwt') {
      headers['Authorization'] = `Bearer ${this.value}`;
    }

    return headers;
  }

  /**
   * Check if the current token is expired
   *
   * @returns {boolean} - True if token is expired or expiring soon
   */
  isExpired() {
    if (!this.tokenExpiresAt) {
      return false;
    }

    // Consider token expired if it expires within the next 5 minutes
    const buffer = 5 * 60 * 1000;
    return Date.now() >= this.tokenExpiresAt - buffer;
  }

  /**
   * Set token expiration time
   *
   * @param {number} expiresInSeconds - Seconds until token expires
   */
  setTokenExpiration(expiresInSeconds) {
    this.tokenExpiresAt = Date.now() + expiresInSeconds * 1000;
  }

  /**
   * Refresh JWT token
   *
   * @returns {Promise<string>} - New token value
   * @throws {Error} If refresh fails or not configured
   *
   * @example
   * const newToken = await auth.refreshJWT();
   * console.log('Token refreshed:', newToken);
   */
  async refreshJWT() {
    if (this.type !== 'jwt') {
      throw new Error('Token refresh only available for JWT authentication');
    }

    if (!this.refreshUrl || !this.refreshToken) {
      throw new Error('JWT refresh requires refreshUrl and refreshToken');
    }

    // If already refreshing, wait for the existing promise
    if (this.isRefreshing) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this._performRefresh();

    try {
      const newToken = await this.refreshPromise;
      this.isRefreshing = false;
      this.refreshPromise = null;
      return newToken;
    } catch (error) {
      this.isRefreshing = false;
      this.refreshPromise = null;
      throw error;
    }
  }

  /**
   * Perform the actual token refresh request
   *
   * @private
   * @returns {Promise<string>} - New token
   */
  async _performRefresh() {
    try {
      if (this.logger) {
        this.logger.debug('Refreshing JWT token');
      }

      const response = await fetch(this.refreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.refreshToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.token && !data.access_token) {
        throw new Error('Token refresh response missing token');
      }

      const newToken = data.token || data.access_token;
      this.value = newToken;

      if (data.expires_in) {
        this.setTokenExpiration(data.expires_in);
      }

      if (data.refresh_token) {
        this.refreshToken = data.refresh_token;
      }

      if (this.logger) {
        this.logger.debug('JWT token refreshed successfully');
      }

      return newToken;
    } catch (error) {
      if (this.logger) {
        this.logger.error('JWT token refresh failed', error);
      }
      throw error;
    }
  }

  /**
   * Update authentication credentials
   *
   * @param {AuthConfig} config - New authentication config
   * @throws {Error} If config is invalid
   */
  updateAuth(config) {
    if (!config || !config.type || !config.value) {
      throw new Error('Invalid auth config');
    }

    if (!['apiKey', 'jwt'].includes(config.type)) {
      throw new Error("Invalid auth type. Must be 'apiKey' or 'jwt'");
    }

    this.type = config.type;
    this.value = config.value;
    this.tokenExpiresAt = null;
    this.isRefreshing = false;
    this.refreshPromise = null;

    if (config.refreshUrl) {
      this.refreshUrl = config.refreshUrl;
    }
    if (config.refreshToken) {
      this.refreshToken = config.refreshToken;
    }
  }

  /**
   * Get authentication type
   *
   * @returns {string} - Current auth type
   */
  getAuthType() {
    return this.type;
  }

  /**
   * Check if authentication is configured
   *
   * @returns {boolean} - True if auth is ready
   */
  isConfigured() {
    return !!this.value;
  }

  /**
   * Clear all authentication data
   */
  clear() {
    this.value = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;
    this.isRefreshing = false;
    this.refreshPromise = null;
  }
}
