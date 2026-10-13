// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/otelService.js
 * ─────────────────────────
 * OpenTelemetry metrics ingestion and storage service.
 * Receives OTel-compatible metrics and stores them in pgmonitoringtool.otel_metrics.
 */

const S = 'pgmonitoringtool';

function log(level, message, meta = {}) {
    const entry = { ts: new Date().toISOString(), level, msg: message, ...meta };
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(JSON.stringify(entry));
}

// Runtime safety net: guarantees pgmonitoringtool.otel_metrics exists before any
// read/write, so a DB that hasn't had migrations applied self-heals instead of
// throwing `relation "pgmonitoringtool.otel_metrics" does not exist`.
let _tableReady = null;
export async function ensureMetricsTable(pool) {
    if (_tableReady) return _tableReady;
    _tableReady = (async () => {
        await pool.query(`CREATE SCHEMA IF NOT EXISTS ${S}`);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ${S}.otel_metrics (
                id          BIGSERIAL        PRIMARY KEY,
                name        TEXT             NOT NULL,
                value       DOUBLE PRECISION NOT NULL,
                timestamp   TIMESTAMPTZ      NOT NULL,
                labels      JSONB            NOT NULL DEFAULT '{}',
                resource    JSONB            NOT NULL DEFAULT '{}',
                created_at  TIMESTAMPTZ      NOT NULL DEFAULT now()
            )`);
        await pool.query(`CREATE INDEX IF NOT EXISTS otel_metrics_name_ts_idx ON ${S}.otel_metrics (name, timestamp DESC)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS otel_metrics_ts_idx ON ${S}.otel_metrics (timestamp DESC)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS otel_metrics_labels_gin ON ${S}.otel_metrics USING GIN (labels)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS otel_metrics_resource_gin ON ${S}.otel_metrics USING GIN (resource)`);
    })().catch((err) => {
        _tableReady = null; // allow retry on next call
        throw err;
    });
    return _tableReady;
}

/**
 * Store an array of OTel metrics into the database.
 * @param {import('pg').Pool} pool
 * @param {Array<{name: string, value: number, timestamp: number, labels?: object, resource?: object}>} metrics
 * @returns {Promise<number>} Number of metrics inserted
 */
export async function ingestMetrics(pool, metrics) {
    if (!Array.isArray(metrics) || metrics.length === 0) {
        return 0;
    }

    await ensureMetricsTable(pool);

    let inserted = 0;
    for (const metric of metrics) {
        try {
            const { name, value, timestamp, labels = {}, resource = {} } = metric;

            const res = await pool.query(
                `INSERT INTO ${S}.otel_metrics
                    (name, value, timestamp, labels, resource)
                 VALUES ($1, $2, to_timestamp($3::double precision / 1000), $4, $5)
                 ON CONFLICT DO NOTHING`,
                [
                    name,
                    value,
                    timestamp || Date.now(),
                    JSON.stringify(labels),
                    JSON.stringify(resource),
                ]
            );
            if (res.rowCount > 0) inserted++;
        } catch (err) {
            log('WARN', 'Failed to ingest metric', { metric: metric.name, error: err.message });
        }
    }

    return inserted;
}

/**
 * Query stored metrics with filters.
 * @param {import('pg').Pool} pool
 * @param {{
 *   name?: string,
 *   startTime?: number,
 *   endTime?: number,
 *   labels?: object,
 *   limit?: number,
 *   offset?: number
 * }} opts
 * @returns {Promise<{rows: any[], total: number, limit: number, offset: number}>}
 */
export async function queryMetrics(pool, opts = {}) {
    await ensureMetricsTable(pool);

    const limit = Math.min(Number(opts.limit) || 100, 1000);
    const offset = Math.max(Number(opts.offset) || 0, 0);

    const conditions = [];
    const params = [];

    if (opts.name) {
        params.push(opts.name);
        conditions.push(`name = $${params.length}`);
    }
    if (opts.startTime) {
        params.push(opts.startTime);
        conditions.push(`timestamp >= to_timestamp($${params.length}::double precision / 1000)`);
    }
    if (opts.endTime) {
        params.push(opts.endTime);
        conditions.push(`timestamp <= to_timestamp($${params.length}::double precision / 1000)`);
    }
    if (opts.labels && Object.keys(opts.labels).length > 0) {
        params.push(JSON.stringify(opts.labels));
        conditions.push(`labels @> $${params.length}::jsonb`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);

    const [dataRes, countRes] = await Promise.all([
        pool.query(
            `SELECT id, name, value, timestamp, labels, resource, created_at
             FROM   ${S}.otel_metrics
             ${where}
             ORDER  BY timestamp DESC
             LIMIT  $${params.length - 1} OFFSET $${params.length}`,
            params
        ),
        pool.query(
            `SELECT COUNT(*) AS total FROM ${S}.otel_metrics ${where}`,
            params.slice(0, -2)
        ),
    ]);

    return {
        rows: dataRes.rows,
        total: Number(countRes.rows[0].total),
        limit,
        offset,
    };
}

/**
 * Get all distinct metric names stored in the database.
 * @param {import('pg').Pool} pool
 * @returns {Promise<string[]>}
 */
export async function getMetricNames(pool) {
    await ensureMetricsTable(pool);
    const res = await pool.query(
        `SELECT DISTINCT name FROM ${S}.otel_metrics ORDER BY name`
    );
    return res.rows.map(r => r.name);
}

/**
 * Get unique service names from resource labels.
 * @param {import('pg').Pool} pool
 * @returns {Promise<string[]>}
 */
export async function getServiceMap(pool) {
    await ensureMetricsTable(pool);
    const res = await pool.query(
        `SELECT DISTINCT resource->>'service.name' as service_name
         FROM   ${S}.otel_metrics
         WHERE  resource->>'service.name' IS NOT NULL
         ORDER  BY service_name`
    );
    return res.rows.map(r => r.service_name).filter(Boolean);
}

/**
 * Delete metrics older than specified retention days.
 * @param {import('pg').Pool} pool
 * @param {number} retentionDays
 * @returns {Promise<number>} Number of rows deleted
 */
export async function deleteOldMetrics(pool, retentionDays) {
    if (retentionDays <= 0) {
        throw new Error('retentionDays must be positive');
    }

    const res = await pool.query(
        `DELETE FROM ${S}.otel_metrics
         WHERE timestamp < NOW() - INTERVAL '1 day' * $1`,
        [retentionDays]
    );

    log('INFO', 'Deleted old metrics', { deleted: res.rowCount, retentionDays });
    return res.rowCount;
}

/**
 * Get aggregated statistics for a metric grouped by time interval.
 * @param {import('pg').Pool} pool
 * @param {string} metricName
 * @param {string} interval - e.g. '1 minute', '5 minutes', '1 hour'
 * @param {{startTime?: number, endTime?: number}} opts
 * @returns {Promise<Array<{bucket: Date, avg: number, min: number, max: number, p95: number, count: number}>>}
 */
export async function getMetricStats(pool, metricName, interval = '5 minutes', opts = {}) {
    if (!metricName || typeof metricName !== 'string') {
        throw new Error('metricName is required');
    }

    const conditions = ['name = $1'];
    const params = [metricName];

    if (opts.startTime) {
        params.push(opts.startTime);
        conditions.push(`timestamp >= to_timestamp($${params.length}::double precision / 1000)`);
    }
    if (opts.endTime) {
        params.push(opts.endTime);
        conditions.push(`timestamp <= to_timestamp($${params.length}::double precision / 1000)`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const res = await pool.query(
        `SELECT
            date_trunc('${interval}'::text, timestamp) as bucket,
            ROUND(AVG(value)::numeric, 2) as avg,
            MIN(value) as min,
            MAX(value) as max,
            ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value)::numeric, 2) as p95,
            COUNT(*) as count
         FROM   ${S}.otel_metrics
         ${where}
         GROUP  BY bucket
         ORDER  BY bucket DESC`,
        params
    );

    return res.rows;
}
