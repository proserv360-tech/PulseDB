/**
 * EventEmitter - Core event management system for FATHOM SDK
 * Provides typed events for monitoring alerts, metric updates, and connection changes
 */

export class EventEmitter {
  /**
   * Creates a new EventEmitter instance
   */
  constructor() {
    /** @type {Map<string, Array<Function>>} */
    this._listeners = new Map();
    /** @type {Map<string, Array<Function>>} */
    this._onceListeners = new Map();
  }

  /**
   * Register an event listener
   *
   * @param {string} eventName - Name of the event to listen for
   * @param {Function} callback - Callback function to execute when event is emitted
   * @returns {EventEmitter} - Returns this for chaining
   *
   * @example
   * emitter.on('metrics', (data) => {
   *   console.log('New metrics:', data);
   * });
   */
  on(eventName, callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }

    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, []);
    }

    this._listeners.get(eventName).push(callback);
    return this;
  }

  /**
   * Register a one-time event listener
   *
   * @param {string} eventName - Name of the event to listen for
   * @param {Function} callback - Callback function to execute once
   * @returns {EventEmitter} - Returns this for chaining
   *
   * @example
   * emitter.once('connected', () => {
   *   console.log('Connection established');
   * });
   */
  once(eventName, callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }

    if (!this._onceListeners.has(eventName)) {
      this._onceListeners.set(eventName, []);
    }

    this._onceListeners.get(eventName).push(callback);
    return this;
  }

  /**
   * Remove an event listener
   *
   * @param {string} eventName - Name of the event
   * @param {Function} [callback] - Specific callback to remove. If omitted, all listeners are removed
   * @returns {EventEmitter} - Returns this for chaining
   */
  off(eventName, callback) {
    if (!callback) {
      this._listeners.delete(eventName);
      this._onceListeners.delete(eventName);
      return this;
    }

    if (this._listeners.has(eventName)) {
      const listeners = this._listeners.get(eventName);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }

    if (this._onceListeners.has(eventName)) {
      const listeners = this._onceListeners.get(eventName);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }

    return this;
  }

  /**
   * Emit an event, triggering all registered listeners
   *
   * @param {string} eventName - Name of the event to emit
   * @param {...*} args - Arguments to pass to the callbacks
   * @returns {boolean} - Returns true if event had listeners, false otherwise
   *
   * @example
   * emitter.emit('metrics', { cpu: 45, memory: 60 });
   */
  emit(eventName, ...args) {
    let hasListeners = false;

    // Call regular listeners
    if (this._listeners.has(eventName)) {
      hasListeners = true;
      const listeners = [...this._listeners.get(eventName)];
      for (const callback of listeners) {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in listener for event '${eventName}':`, error);
          // Emit error event with guard to prevent infinite recursion
          if (eventName !== 'error') {
            this.emit('error', { originalEvent: eventName, error });
          }
        }
      }
    }

    // Call and remove once listeners
    if (this._onceListeners.has(eventName)) {
      hasListeners = true;
      const listeners = this._onceListeners.get(eventName);
      while (listeners.length > 0) {
        const callback = listeners.pop();
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in once listener for event '${eventName}':`, error);
          // Emit error event with guard to prevent infinite recursion
          if (eventName !== 'error') {
            this.emit('error', { originalEvent: eventName, error });
          }
        }
      }
      this._onceListeners.delete(eventName);
    }

    return hasListeners;
  }

  /**
   * Get the count of listeners for an event
   *
   * @param {string} [eventName] - Event name. If omitted, returns total listener count
   * @returns {number} - Number of listeners
   */
  listenerCount(eventName) {
    if (!eventName) {
      let count = 0;
      for (const listeners of this._listeners.values()) {
        count += listeners.length;
      }
      for (const listeners of this._onceListeners.values()) {
        count += listeners.length;
      }
      return count;
    }

    const regular = this._listeners.has(eventName) ? this._listeners.get(eventName).length : 0;
    const once = this._onceListeners.has(eventName) ? this._onceListeners.get(eventName).length : 0;
    return regular + once;
  }

  /**
   * Remove all listeners
   *
   * @param {string} [eventName] - Event name. If omitted, removes all listeners
   * @returns {EventEmitter} - Returns this for chaining
   */
  removeAllListeners(eventName) {
    if (!eventName) {
      this._listeners.clear();
      this._onceListeners.clear();
    } else {
      this._listeners.delete(eventName);
      this._onceListeners.delete(eventName);
    }
    return this;
  }

  /**
   * Get all event names that have listeners
   *
   * @returns {string[]} - Array of event names
   */
  eventNames() {
    const events = new Set();
    for (const eventName of this._listeners.keys()) {
      events.add(eventName);
    }
    for (const eventName of this._onceListeners.keys()) {
      events.add(eventName);
    }
    return Array.from(events);
  }
}
