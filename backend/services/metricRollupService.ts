// @ts-nocheck — TODO type this module (added 2026-07; see docs/TS_MIGRATION.md)
/**
 * services/metricRollupService.ts
 * ───────────────────────────────
 * Tiered metric rollups (B-3): keep long history at lower resolution instead of
 * deleting it. Raw otel_metrics are downsampled into hourly then daily buckets;
 * reads auto-select the coarsest tier that still covers the requested window.
 *
 *   raw (otel_metrics)  → kept PULSEDB_METRICS_RAW_DAYS     (default 7)
 *   metric_rollups_1h   → kept PULSEDB_METRICS_HOURLY_DAYS  (default 90)
 *   metric_rollups_1d   → kept PULSEDB_METRICS_DAILY_DAYS   (default 730)
 *
 * Rollup upserts are incremental and idempotent (ON CONFLICT DO UPDATE), so a
 * re-run only re-aggregates recently-touched buckets and never double-counts.
 */

const S = 'pgmonitoringtool';

export const RAW_DAYS = Number(process.env.PULSEDB_METRICS_RAW_DAYS) || 7;
export const HOUR_DAYS = Number(process.env.PULSEDB_METRICS_HOURLY_DAYS) || 90;
export const DAY_DAYS = Number(process.env.PULSEDB_METRICS_DAILY_DAYS) || 730;

function log(level, message, meta = {}) {
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg: message, ...meta }));
}

const ROLLUP_COLS = `(
    name       TEXT             NOT NULL,
    bucket     TIMESTAMPTZ      NOT NULL,
    samples    BIGINT           NOT NULL,
    sum        DOUBLE PRECISION NOT NULL,
    min        DOUBLE PRECISION NOT NULL,
    max        DOUBLE PRECISION NOT NULL,
    avg        DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (name, bucket)
)`;

/** Idempotently create the rollup tables + bucket indexes. */
export async function ensureRollupTables(pool) {
    await pool.query(`CREATE TABLE IF NOT EXISTS ${S}.metric_rollups_1h ${ROLLUP_COLS}`);
    await pool.query(`CREATE INDEX IF NOT EXISTS metric_rollups_1h_bucket_idx ON ${S}.metric_rollups_1h (bucket DESC)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS ${S}.metric_rollups_1d ${ROLLUP_COLS}`);
    await pool.query(`CREATE INDEX IF NOT EXISTS metric_rollups_1d_bucket_idx ON ${S}.metric_rollups_1d (bucket DESC)`);
}

/**
 * Aggregate raw otel_metrics into hourly buckets. Re-aggregates the last
 * `sinceHours` window so late-arriving samples are folded in without a full scan.
 */
export async function rollupHourly(pool, { sinceHours = 3 } = {}) {
    const r = await pool.query(
        `INSERT INTO ${S}.metric_rollups_1h (name, bucket, samples, sum, min, max, avg)
         SELECT name, date_trunc('hour', "timestamp") AS bucket,
                count(*)::bigint, sum(value), min(value), max(value), avg(value)
         FROM   ${S}.otel_metrics
         WHERE  "timestamp" >= date_trunc('hour', now() - ($1 || ' hours')::interval)
         GROUP  BY name, date_trunc('hour', "timestamp")
         ON CONFLICT (name, bucket) DO UPDATE
            SET samples = EXCLUDED.samples, sum = EXCLUDED.sum,
                min = EXCLUDED.min, max = EXCLUDED.max, avg = EXCLUDED.avg`,
        [String(sinceHours)],
    );
    return r.rowCount;
}

/** Aggregate hourly rollups into daily buckets (weighted avg from sum/samples). */
export async function rollupDaily(pool, { sinceDays = 2 } = {}) {
    const r = await pool.query(
        `INSERT INTO ${S}.metric_rollups_1d (name, bucket, samples, sum, min, max, avg)
         SELECT name, date_trunc('day', bucket) AS d,
                sum(samples)::bigint, sum(sum), min(min), max(max),
                CASE WHEN sum(samples) > 0 THEN sum(sum) / sum(samples) ELSE 0 END
         FROM   ${S}.metric_rollups_1h
         WHERE  bucket >= date_trunc('day', now() - ($1 || ' days')::interval)
         GROUP  BY name, date_trunc('day', bucket)
         ON CONFLICT (name, bucket) DO UPDATE
            SET samples = EXCLUDED.samples, sum = EXCLUDED.sum,
                min = EXCLUDED.min, max = EXCLUDED.max, avg = EXCLUDED.avg`,
        [String(sinceDays)],
    );
    return r.rowCount;
}

/** Run both rollup tiers. Safe to call on a schedule. */
export async function runMetricRollups(pool) {
    await ensureRollupTables(pool);
    const hourly = await rollupHourly(pool, {});
    const daily = await rollupDaily(pool, {});
    log('INFO', 'Metric rollups complete', { hourly, daily });
    return { hourly, daily };
}

/**
 * Prune each tier to its retention window. Raw is only pruned AFTER it has been
 * rolled up, so no data is lost — it survives at coarser resolution.
 */
export async function pruneTiers(pool) {
    await runMetricRollups(pool); // ensure raw is captured before we drop it
    const out = {};
    const raw = await pool.query(
        `DELETE FROM ${S}.otel_metrics WHERE "timestamp" < now() - ($1 || ' days')::interval`,
        [String(RAW_DAYS)],
    );
    out.raw_deleted = raw.rowCount;
    const h = await pool.query(`DELETE FROM ${S}.metric_rollups_1h WHERE bucket < now() - ($1 || ' days')::interval`, [
        String(HOUR_DAYS),
    ]);
    out.hourly_deleted = h.rowCount;
    const d = await pool.query(`DELETE FROM ${S}.metric_rollups_1d WHERE bucket < now() - ($1 || ' days')::interval`, [
        String(DAY_DAYS),
    ]);
    out.daily_deleted = d.rowCount;
    log('INFO', 'Metric tier pruning complete', out);
    return out;
}

/** Pure: choose the resolution tier for a query window based on how old it is. */
export function pickTier(fromMs, nowMs = Date.now()) {
    const ageDays = (nowMs - Number(fromMs)) / 86_400_000;
    if (ageDays <= RAW_DAYS) return 'raw';
    if (ageDays <= HOUR_DAYS) return 'hourly';
    return 'daily';
}

/** Read a metric series at the best resolution for the requested window. */
export async function queryRolledMetrics(pool, { name, fromMs, toMs = Date.now(), limit = 2000 }) {
    if (!name) throw new Error('name is required');
    const tier = pickTier(fromMs, toMs);
    const from = new Date(Number(fromMs)).toISOString();
    const to = new Date(Number(toMs)).toISOString();
    const cap = Math.min(Number(limit) || 2000, 10_000);
    if (tier === 'raw') {
        const r = await pool.query(
            `SELECT "timestamp" AS bucket, value AS avg, value AS min, value AS max, 1::bigint AS samples
             FROM ${S}.otel_metrics
             WHERE name = $1 AND "timestamp" BETWEEN $2 AND $3
             ORDER BY "timestamp" ASC LIMIT $4`,
            [name, from, to, cap],
        );
        return { tier, resolution: 'raw', points: r.rows };
    }
    const table = tier === 'hourly' ? 'metric_rollups_1h' : 'metric_rollups_1d';
    const r = await pool.query(
        `SELECT bucket, avg, min, max, samples
         FROM ${S}.${table}
         WHERE name = $1 AND bucket BETWEEN $2 AND $3
         ORDER BY bucket ASC LIMIT $4`,
        [name, from, to, cap],
    );
    return { tier, resolution: tier === 'hourly' ? '1h' : '1d', points: r.rows };
}
