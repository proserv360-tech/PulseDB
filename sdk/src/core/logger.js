/**
 * Logger - Structured logging system for FATHOM SDK
 * Supports multiple log levels and optional external log sink
 */

/**
 * @typedef {('debug'|'info'|'warn'|'error')} LogLevel
 */

/**
 * @typedef {Object} LogEntry
 * @property {string} level - Log level
 * @property {string} message - Log message
 * @property {*} [data] - Additional data
 * @property {string} timestamp - ISO timestamp
 */

export class Logger {
  /**
   * Log level priorities
   * @static
   */
  static LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  /**
   * Creates a new Logger instance
   *
   * @param {Object} options - Logger options
   * @param {string} [options.name='FATHOM'] - Logger name
   * @param {LogLevel} [options.level='info'] - Minimum log level
   * @param {Function} [options.sink] - External sink function for custom logging
   * @param {boolean} [options.colors=true] - Enable colored console output
   *
   * @example
   * const logger = new Logger({
   *   name: 'MyApp',
   *   level: 'debug',
   *   sink: (entry) => sendToLoggingService(entry)
   * });
   */
  constructor(options = {}) {
    this.name = options.name || 'FATHOM';
    this.level = Logger.LEVELS[options.level] !== undefined ? Logger.LEVELS[options.level] : Logger.LEVELS.info;
    this.sink = options.sink || null;
    this.colors = options.colors !== false;
    this.history = [];
    this.maxHistory = options.maxHistory || 1000;
  }

  /**
   * Format a log entry for console output
   *
   * @private
   * @param {string} level - Log level
   * @param {string} message - Message
   * @returns {string} - Formatted message
   */
  _formatMessage(level, message) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] ${this.name} [${level.toUpperCase()}]`;

    if (this.colors) {
      const colors = {
        debug: '\x1b[36m', // cyan
        info: '\x1b[32m', // green
        warn: '\x1b[33m', // yellow
        error: '\x1b[31m', // red
        reset: '\x1b[0m',
      };
      return `${colors[level]}${prefix}${colors.reset} ${message}`;
    }

    return `${prefix} ${message}`;
  }

  /**
   * Log an entry at the specified level
   *
   * @private
   * @param {LogLevel} levelName - Log level name
   * @param {string} message - Log message
   * @param {*} [data] - Additional data
   */
  _log(levelName, message, data) {
    const levelNum = Logger.LEVELS[levelName];

    // Check if this level should be logged
    if (levelNum < this.level) {
      return;
    }

    const timestamp = new Date().toISOString();
    const entry = {
      level: levelName,
      message,
      timestamp,
    };

    if (data !== undefined) {
      entry.data = data;
    }

    // Add to history
    this.history.push(entry);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Send to external sink
    if (this.sink && typeof this.sink === 'function') {
      try {
        this.sink(entry);
      } catch (error) {
        console.error('Error in logger sink:', error);
      }
    }

    // Console output
    const formatted = this._formatMessage(levelName, message);
    if (data !== undefined) {
      console.log(formatted, data);
    } else {
      console.log(formatted);
    }
  }

  /**
   * Log at debug level
   *
   * @param {string} message - Log message
   * @param {*} [data] - Optional data
   *
   * @example
   * logger.debug('Processing request', { id: 123 });
   */
  debug(message, data) {
    this._log('debug', message, data);
  }

  /**
   * Log at info level
   *
   * @param {string} message - Log message
   * @param {*} [data] - Optional data
   *
   * @example
   * logger.info('Client connected', { ip: '192.168.1.1' });
   */
  info(message, data) {
    this._log('info', message, data);
  }

  /**
   * Log at warn level
   *
   * @param {string} message - Log message
   * @param {*} [data] - Optional data
   *
   * @example
   * logger.warn('High memory usage', { usage: '85%' });
   */
  warn(message, data) {
    this._log('warn', message, data);
  }

  /**
   * Log at error level
   *
   * @param {string} message - Log message
   * @param {*} [data] - Optional data or Error object
   *
   * @example
   * logger.error('Connection failed', new Error('ECONNREFUSED'));
   */
  error(message, data) {
    this._log('error', message, data);
  }

  /**
   * Set the log level
   *
   * @param {LogLevel} level - New log level
   * @throws {Error} If level is invalid
   */
  setLevel(level) {
    if (Logger.LEVELS[level] === undefined) {
      throw new Error(`Invalid log level: ${level}`);
    }
    this.level = Logger.LEVELS[level];
  }

  /**
   * Get the current log level
   *
   * @returns {LogLevel} - Current log level
   */
  getLevel() {
    for (const [name, value] of Object.entries(Logger.LEVELS)) {
      if (value === this.level) {
        return name;
      }
    }
  }

  /**
   * Get log history
   *
   * @param {LogLevel} [level] - Filter by level (optional)
   * @returns {LogEntry[]} - Array of log entries
   */
  getHistory(level) {
    if (!level) {
      return [...this.history];
    }

    return this.history.filter((entry) => entry.level === level);
  }

  /**
   * Clear log history
   */
  clearHistory() {
    this.history = [];
  }

  /**
   * Export history as JSON
   *
   * @returns {string} - JSON string of history
   */
  exportHistory() {
    return JSON.stringify(this.history, null, 2);
  }
}
