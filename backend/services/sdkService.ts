// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
import crypto from 'crypto';

const S = 'pgmonitoringtool';

/**
 * Generate a unique SDK API key in the format: sk_live_<random>
 * @returns {string} The raw API key (to be shown once to user)
 */
function generateSdkKey() {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  return `sk_live_${randomBytes}`;
}

/**
 * Hash an SDK API key using SHA256
 * @param {string} rawKey - The raw API key
 * @returns {string} The SHA256 hash of the key
 */
function hashSdkKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Extract the first 12 characters of the API key for display
 * @param {string} rawKey - The raw API key
 * @returns {string} First 12 characters
 */
function getKeyPrefix(rawKey) {
  return rawKey.substring(0, 12);
}

/**
 * Register a new external application with the SDK
 * Generates a unique API key and stores the hash
 *
 * @param {Pool} pool - Database connection pool
 * @param {Object} params - Registration parameters
 * @param {string} params.name - Application name
 * @param {string} params.appType - Type of app (salesforce, mulesoft, nodejs, java, python, custom)
 * @param {string} [params.environment='production'] - Environment (production, staging, dev)
 * @param {Object} [params.config={}] - Application-specific configuration
 * @param {number} params.createdBy - User ID of the registrant
 * @returns {Promise<{key: string, record: Object}>} Raw API key (shown once) and the created app record
 */
export async function registerApp(pool, { name, appType, environment = 'production', config = {}, createdBy }) {
  const rawKey = generateSdkKey();
  const keyHash = hashSdkKey(rawKey);
  const keyPrefix = getKeyPrefix(rawKey);

  const query = `
    INSERT INTO ${S}.sdk_applications
      (name, app_type, environment, api_key_hash, api_key_prefix, status, config, created_by, created_at, updated_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
    RETURNING id, name, app_type, environment, api_key_prefix, status, config, last_heartbeat_at, created_by, created_at, updated_at
  `;

  const result = await pool.query(query, [
    name,
    appType,
    environment,
    keyHash,
    keyPrefix,
    'active',
    JSON.stringify(config),
    createdBy
  ]);

  return {
    key: rawKey,
    record: result.rows[0]
  };
}

/**
 * Authenticate an SDK API key
 * Looks up the app by key hash and updates last_heartbeat_at
 *
 * @param {Pool} pool - Database connection pool
 * @param {string} rawKey - The raw API key to authenticate
 * @returns {Promise<Object|null>} The authenticated app record or null if key is invalid
 */
export async function authenticateSdkKey(pool, rawKey) {
  const keyHash = hashSdkKey(rawKey);

  const query = `
    UPDATE ${S}.sdk_applications
    SET last_heartbeat_at = now()
    WHERE api_key_hash = $1 AND status = 'active'
    RETURNING id, name, app_type, environment, api_key_prefix, status, config, last_heartbeat_at, created_by, created_at, updated_at
  `;

  const result = await pool.query(query, [keyHash]);
  return result.rows[0] || null;
}

/**
 * Bulk ingest events from an SDK application
 * Uses a single INSERT statement for performance
 *
 * @param {Pool} pool - Database connection pool
 * @param {number} appId - The application ID
 * @param {Array<Object>} events - Array of events to ingest
 * @param {string} events[].eventType - Event type (api_call, error, audit, metric, heartbeat, custom)
 * @param {string} [events[].severity='info'] - Severity level (debug, info, warn, error, critical)
 * @param {string} events[].title - Event title
 * @param {string} [events[].message] - Event message/description
 * @param {Object} [events[].metadata={}] - Additional metadata
 * @param {string[]} [events[].tags=[]] - Event tags
 * @param {number} [events[].durationMs] - Duration in milliseconds (for api_call events)
 * @param {number} [events[].statusCode] - HTTP status code (for api_call events)
 * @param {string} [events[].endpoint] - API endpoint (for api_call events)
 * @param {string} [events[].httpMethod] - HTTP method (for api_call events)
 * @param {string} [events[].errorType] - Error type (for error events)
 * @param {string} [events[].stackTrace] - Stack trace (for error events)
 * @param {string} [events[].fingerprint] - Deduplication fingerprint
 * @returns {Promise<{count: number}>} Number of events inserted
 */
export async function ingestEvents(pool, appId, events) {
  if (!events || events.length === 0) {
    return { count: 0 };
  }

  const values = [];
  const placeholders = [];
  let paramIndex = 1;

  events.forEach((event, index) => {
    const severity = event.severity || 'info';
    const metadata = event.metadata || {};
    const tags = event.tags || [];

    values.push(
      appId,
      event.eventType,
      severity,
      event.title,
      event.message || null,
      JSON.stringify(metadata),
      tags,
      event.durationMs || null,
      event.statusCode || null,
      event.endpoint || null,
      event.httpMethod || null,
      event.errorType || null,
      event.stackTrace || null,
      event.fingerprint || null
    );

    placeholders.push(
      `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12}, $${paramIndex + 13})`
    );

    paramIndex += 14;
  });

  const query = `
    INSERT INTO ${S}.sdk_events
      (app_id, event_type, severity, title, message, metadata, tags, duration_ms, status_code, endpoint, http_method, error_type, stack_trace, fingerprint)
    VALUES
      ${placeholders.join(', ')}
    RETURNING id
  `;

  const result = await pool.query(query, values);
  return { count: result.rows.length };
}

/**
 * List registered applications with event counts
 *
 * @param {Pool} pool - Database connection pool
 * @param {Object} filters - Filter parameters
 * @param {number} [filters.createdBy] - Filter by creator user ID
 * @param {string} [filters.status] - Filter by status (active, paused, disabled)
 * @returns {Promise<Array<Object>>} List of applications with event counts
 */
export async function listApps(pool, filters = {}) {
  let whereClause = `WHERE a.status != 'disabled'`;
  const params = [];
  let paramIndex = 1;

  if (filters.createdBy) {
    whereClause += ` AND a.created_by = $${paramIndex}`;
    params.push(filters.createdBy);
    paramIndex++;
  }

  if (filters.status) {
    whereClause += ` AND a.status = $${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }

  const query = `
    SELECT
      a.id,
      a.name,
      a.app_type,
      a.environment,
      a.api_key_prefix,
      a.status,
      a.config,
      a.last_heartbeat_at,
      a.created_by,
      a.created_at,
      a.updated_at,
      COUNT(e.id)::INTEGER as event_count,
      COUNT(CASE WHEN e.event_type = 'error' THEN 1 END)::INTEGER as error_count,
      COUNT(CASE WHEN e.severity = 'critical' THEN 1 END)::INTEGER as critical_count
    FROM ${S}.sdk_applications a
    LEFT JOIN ${S}.sdk_events e ON a.id = e.app_id
    ${whereClause}
    GROUP BY a.id
    ORDER BY a.updated_at DESC
  `;

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Get a single application by ID
 *
 * @param {Pool} pool - Database connection pool
 * @param {number} appId - The application ID
 * @returns {Promise<Object|null>} The application record or null if not found
 */
export async function getAppById(pool, appId) {
  const query = `
    SELECT
      a.id,
      a.name,
      a.app_type,
      a.environment,
      a.api_key_prefix,
      a.status,
      a.config,
      a.last_heartbeat_at,
      a.created_by,
      a.created_at,
      a.updated_at,
      COUNT(e.id)::INTEGER as event_count
    FROM ${S}.sdk_applications a
    LEFT JOIN ${S}.sdk_events e ON a.id = e.app_id
    WHERE a.id = $1
    GROUP BY a.id
  `;

  const result = await pool.query(query, [appId]);
  return result.rows[0] || null;
}

/**
 * Update application settings
 *
 * @param {Pool} pool - Database connection pool
 * @param {number} appId - The application ID
 * @param {Object} updates - Fields to update
 * @param {string} [updates.name] - Application name
 * @param {string} [updates.environment] - Environment (production, staging, dev)
 * @param {string} [updates.status] - Status (active, paused, disabled)
 * @param {Object} [updates.config] - Configuration object
 * @returns {Promise<Object|null>} The updated application record or null if not found
 */
export async function updateApp(pool, appId, updates) {
  const fields = [];
  const values = [appId];
  let paramIndex = 2;

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex}`);
    values.push(updates.name);
    paramIndex++;
  }

  if (updates.environment !== undefined) {
    fields.push(`environment = $${paramIndex}`);
    values.push(updates.environment);
    paramIndex++;
  }

  if (updates.status !== undefined) {
    fields.push(`status = $${paramIndex}`);
    values.push(updates.status);
    paramIndex++;
  }

  if (updates.config !== undefined) {
    fields.push(`config = $${paramIndex}`);
    values.push(JSON.stringify(updates.config));
    paramIndex++;
  }

  if (fields.length === 0) {
    return getAppById(pool, appId);
  }

  fields.push(`updated_at = now()`);

  const query = `
    UPDATE ${S}.sdk_applications
    SET ${fields.join(', ')}
    WHERE id = $1
    RETURNING id, name, app_type, environment, api_key_prefix, status, config, last_heartbeat_at, created_by, created_at, updated_at
  `;

  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

/**
 * Soft-delete an application (sets status to 'disabled')
 *
 * @param {Pool} pool - Database connection pool
 * @param {number} appId - The application ID
 * @returns {Promise<Object|null>} The updated application record or null if not found
 */
export async function deleteApp(pool, appId) {
  // Hard delete — also cascades to sdk_events via ON DELETE CASCADE
  const query = `
    DELETE FROM ${S}.sdk_applications
    WHERE id = $1
    RETURNING id, name
  `;

  const result = await pool.query(query, [appId]);
  return result.rows[0] || null;
}

/**
 * List events with filtering and pagination
 *
 * @param {Pool} pool - Database connection pool
 * @param {Object} filters - Filter parameters
 * @param {number} [filters.appId] - Filter by application ID
 * @param {string} [filters.eventType] - Filter by event type
 * @param {string} [filters.severity] - Filter by severity
 * @param {string} [filters.search] - Search in title and message
 * @param {Date|string} [filters.fromDate] - Start date (inclusive)
 * @param {Date|string} [filters.toDate] - End date (inclusive)
 * @param {number} [filters.limit=50] - Maximum results to return
 * @param {number} [filters.offset=0] - Number of results to skip
 * @returns {Promise<{rows: Array<Object>, total: number}>} Paginated event results with total count
 */
export async function listEvents(pool, filters = {}) {
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  let whereClause = 'WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (filters.appId) {
    whereClause += ` AND app_id = $${paramIndex}`;
    params.push(filters.appId);
    paramIndex++;
  }

  if (filters.eventType) {
    whereClause += ` AND event_type = $${paramIndex}`;
    params.push(filters.eventType);
    paramIndex++;
  }

  if (filters.severity) {
    whereClause += ` AND severity = $${paramIndex}`;
    params.push(filters.severity);
    paramIndex++;
  }

  if (filters.search) {
    whereClause += ` AND (title ILIKE $${paramIndex} OR message ILIKE $${paramIndex})`;
    params.push(`%${filters.search}%`);
    params.push(`%${filters.search}%`);
    paramIndex += 2;
  }

  if (filters.fromDate) {
    whereClause += ` AND created_at >= $${paramIndex}`;
    params.push(filters.fromDate);
    paramIndex++;
  }

  if (filters.toDate) {
    whereClause += ` AND created_at <= $${paramIndex}`;
    params.push(filters.toDate);
    paramIndex++;
  }

  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM ${S}.sdk_events ${whereClause}`;
  const countResult = await pool.query(countQuery, params);
  const total = parseInt(countResult.rows[0].total, 10);

  // Get paginated results
  const query = `
    SELECT
      id,
      app_id,
      event_type,
      severity,
      title,
      message,
      metadata,
      tags,
      duration_ms,
      status_code,
      endpoint,
      http_method,
      error_type,
      stack_trace,
      fingerprint,
      created_at
    FROM ${S}.sdk_events
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const dataParams = [...params, limit, offset];
  const result = await pool.query(query, dataParams);

  return {
    rows: result.rows,
    total
  };
}

/**
 * Get aggregated statistics for events
 *
 * @param {Pool} pool - Database connection pool
 * @param {Object} filters - Filter parameters
 * @param {number} filters.appId - Application ID (required)
 * @param {Date|string} [filters.fromDate] - Start date
 * @param {Date|string} [filters.toDate] - End date
 * @param {string} [filters.groupBy='day'] - Time grouping (hour, day, minute)
 * @returns {Promise<Object>} Aggregated statistics
 */
export async function getEventStats(pool, { appId, fromDate, toDate, groupBy = 'day' }) {
  let dateFilter = '';
  const params = [appId];
  let paramIndex = 2;

  if (fromDate) {
    dateFilter += ` AND created_at >= $${paramIndex}`;
    params.push(fromDate);
    paramIndex++;
  }

  if (toDate) {
    dateFilter += ` AND created_at <= $${paramIndex}`;
    params.push(toDate);
    paramIndex++;
  }

  // Determine time bucket function
  let timeBucket = 'DATE(created_at)';
  if (groupBy === 'hour') {
    timeBucket = 'DATE_TRUNC(\'hour\', created_at)';
  } else if (groupBy === 'minute') {
    timeBucket = 'DATE_TRUNC(\'minute\', created_at)';
  }

  // Count by event type
  const eventTypeQuery = `
    SELECT event_type, COUNT(*)::INTEGER as count
    FROM ${S}.sdk_events
    WHERE app_id = $1 ${dateFilter}
    GROUP BY event_type
    ORDER BY count DESC
  `;
  const eventTypeResult = await pool.query(eventTypeQuery, params);

  // Count by severity
  const severityQuery = `
    SELECT severity, COUNT(*)::INTEGER as count
    FROM ${S}.sdk_events
    WHERE app_id = $1 ${dateFilter}
    GROUP BY severity
    ORDER BY count DESC
  `;
  const severityResult = await pool.query(severityQuery, params);

  // Average duration for API calls
  const durationQuery = `
    SELECT
      AVG(duration_ms)::NUMERIC as avg_duration_ms,
      MIN(duration_ms)::INTEGER as min_duration_ms,
      MAX(duration_ms)::INTEGER as max_duration_ms
    FROM ${S}.sdk_events
    WHERE app_id = $1 AND event_type = 'api_call' AND duration_ms IS NOT NULL ${dateFilter}
  `;
  const durationResult = await pool.query(durationQuery, params);

  // Error rate
  const errorRateQuery = `
    SELECT
      COUNT(CASE WHEN event_type = 'error' THEN 1 END)::INTEGER as error_count,
      COUNT(*)::INTEGER as total_count
    FROM ${S}.sdk_events
    WHERE app_id = $1 ${dateFilter}
  `;
  const errorRateResult = await pool.query(errorRateQuery, params);

  const errorRateData = errorRateResult.rows[0];
  const errorRate = errorRateData.total_count > 0
    ? (errorRateData.error_count / errorRateData.total_count * 100).toFixed(2)
    : 0;

  // Timeline data (grouped by time bucket)
  const timelineQuery = `
    SELECT
      ${timeBucket} as time_bucket,
      COUNT(*)::INTEGER as count,
      COUNT(CASE WHEN event_type = 'error' THEN 1 END)::INTEGER as error_count
    FROM ${S}.sdk_events
    WHERE app_id = $1 ${dateFilter}
    GROUP BY ${timeBucket}
    ORDER BY ${timeBucket} ASC
  `;
  const timelineResult = await pool.query(timelineQuery, params);

  return {
    byEventType: eventTypeResult.rows,
    bySeverity: severityResult.rows,
    avgDuration: durationResult.rows[0],
    errorRate: parseFloat(errorRate),
    errorCount: errorRateData.error_count,
    totalCount: errorRateData.total_count,
    timeline: timelineResult.rows
  };
}

/**
 * Get comprehensive dashboard data for an application
 *
 * @param {Pool} pool - Database connection pool
 * @param {number} appId - The application ID
 * @returns {Promise<Object>} Dashboard data including metrics, errors, and timeline
 */
export async function getAppDashboard(pool, appId) {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Get app details
  const appQuery = `
    SELECT
      id,
      name,
      app_type,
      environment,
      status,
      last_heartbeat_at,
      created_at
    FROM ${S}.sdk_applications
    WHERE id = $1
  `;
  const appResult = await pool.query(appQuery, [appId]);
  if (!appResult.rows[0]) {
    return null;
  }

  const app = appResult.rows[0];

  // Total events in last 24h
  const totalEventsQuery = `
    SELECT COUNT(*)::INTEGER as count
    FROM ${S}.sdk_events
    WHERE app_id = $1 AND created_at >= $2
  `;
  const totalEventsResult = await pool.query(totalEventsQuery, [appId, oneDayAgo]);

  // Error count
  const errorCountQuery = `
    SELECT COUNT(*)::INTEGER as count
    FROM ${S}.sdk_events
    WHERE app_id = $1 AND event_type = 'error' AND created_at >= $2
  `;
  const errorCountResult = await pool.query(errorCountQuery, [appId, oneDayAgo]);

  // Average API latency
  const avgLatencyQuery = `
    SELECT AVG(duration_ms)::NUMERIC as avg_duration
    FROM ${S}.sdk_events
    WHERE app_id = $1 AND event_type = 'api_call' AND duration_ms IS NOT NULL AND created_at >= $2
  `;
  const avgLatencyResult = await pool.query(avgLatencyQuery, [appId, oneDayAgo]);

  // Top endpoints
  const topEndpointsQuery = `
    SELECT
      endpoint,
      COUNT(*)::INTEGER as count,
      AVG(duration_ms)::NUMERIC as avg_duration,
      COUNT(CASE WHEN status_code >= 400 THEN 1 END)::INTEGER as error_count
    FROM ${S}.sdk_events
    WHERE app_id = $1 AND event_type = 'api_call' AND endpoint IS NOT NULL AND created_at >= $2
    GROUP BY endpoint
    ORDER BY count DESC
    LIMIT 10
  `;
  const topEndpointsResult = await pool.query(topEndpointsQuery, [appId, oneDayAgo]);

  // Recent errors
  const recentErrorsQuery = `
    SELECT
      id,
      event_type,
      severity,
      title,
      message,
      error_type,
      stack_trace,
      metadata,
      created_at
    FROM ${S}.sdk_events
    WHERE app_id = $1 AND severity IN ('error', 'critical') AND created_at >= $2
    ORDER BY created_at DESC
    LIMIT 10
  `;
  const recentErrorsResult = await pool.query(recentErrorsQuery, [appId, oneDayAgo]);

  // Event timeline (24h, hourly)
  const timelineQuery = `
    SELECT
      DATE_TRUNC('hour', created_at) as hour,
      COUNT(*)::INTEGER as count,
      COUNT(CASE WHEN event_type = 'error' THEN 1 END)::INTEGER as error_count,
      COUNT(CASE WHEN severity = 'critical' THEN 1 END)::INTEGER as critical_count
    FROM ${S}.sdk_events
    WHERE app_id = $1 AND created_at >= $2
    GROUP BY DATE_TRUNC('hour', created_at)
    ORDER BY hour ASC
  `;
  const timelineResult = await pool.query(timelineQuery, [appId, oneDayAgo]);

  return {
    app,
    metrics: {
      totalEvents24h: totalEventsResult.rows[0]?.count || 0,
      errorCount24h: errorCountResult.rows[0]?.count || 0,
      avgApiLatencyMs: avgLatencyResult.rows[0]?.avg_duration ? parseFloat(avgLatencyResult.rows[0].avg_duration) : null
    },
    topEndpoints: topEndpointsResult.rows,
    recentErrors: recentErrorsResult.rows,
    timeline: timelineResult.rows
  };
}

/**
 * Delete events older than the retention period
 *
 * @param {Pool} pool - Database connection pool
 * @param {number} [retentionDays=30] - Number of days to retain (default 30)
 * @returns {Promise<{count: number}>} Number of events deleted
 */
export async function cleanupOldEvents(pool, retentionDays = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const query = `
    DELETE FROM ${S}.sdk_events
    WHERE created_at < $1
  `;

  const result = await pool.query(query, [cutoffDate]);
  return { count: result.rowCount };
}
