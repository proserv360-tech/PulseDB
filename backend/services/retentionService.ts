// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/retentionService.js
 * ────────────────────────────
 * Historical data retention management.
 * Manages retention policies and executes cleanup based on retention settings.
 */

const S = 'pgmonitoringtool';

function log(level, message, meta = {}) {
    const entry = { ts: new Date().toISOString(), level, msg: message, ...meta };
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(JSON.stringify(entry));
}

/**
 * Get current retention policy for an organization.
 * @param {import('pg').Pool} pool
 * @param {number} orgId
 * @returns {Promise<{
 *   orgId: number,
 *   metricsRetentionDays: number,
 *   logsRetentionDays: number,
 *   alertsRetentionDays: number,
 *   auditRetentionDays: number,
 *   updatedAt: Date
 * }>}
 */
export async function getRetentionPolicy(pool, orgId) {
    const defaults = {
        orgId,
        metricsRetentionDays: 30,
        logsRetentionDays: 7,
        alertsRetentionDays: 90,
        auditRetentionDays: 365,
        updatedAt: new Date(),
    };

    let res;
    try {
        res = await pool.query(
            `SELECT org_id, metrics_retention_days, logs_retention_days,
                    alerts_retention_days, audit_retention_days, updated_at
             FROM   ${S}.retention_policies
             WHERE  org_id = $1`,
            [orgId]
        );
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) {
            // Table doesn't exist yet — try to create it
            try {
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS ${S}.retention_policies (
                        id               SERIAL PRIMARY KEY,
                        org_id           INTEGER NOT NULL DEFAULT 1,
                        metrics_retention_days  INTEGER NOT NULL DEFAULT 30,
                        logs_retention_days     INTEGER NOT NULL DEFAULT 7,
                        alerts_retention_days   INTEGER NOT NULL DEFAULT 90,
                        audit_retention_days    INTEGER NOT NULL DEFAULT 365,
                        created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
                        updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
                        UNIQUE (org_id)
                    )
                `);
                await pool.query(
                    `INSERT INTO ${S}.retention_policies (org_id) VALUES ($1) ON CONFLICT (org_id) DO NOTHING`,
                    [orgId]
                );
                res = await pool.query(
                    `SELECT org_id, metrics_retention_days, logs_retention_days,
                            alerts_retention_days, audit_retention_days, updated_at
                     FROM   ${S}.retention_policies WHERE org_id = $1`,
                    [orgId]
                );
            } catch {
                return defaults;
            }
        } else {
            throw err;
        }
    }

    if (!res || res.rows.length === 0) return defaults;

    const row = res.rows[0];
    return {
        orgId: row.org_id,
        metricsRetentionDays: row.metrics_retention_days,
        logsRetentionDays: row.logs_retention_days,
        alertsRetentionDays: row.alerts_retention_days,
        auditRetentionDays: row.audit_retention_days,
        updatedAt: row.updated_at,
    };
}

/**
 * Update retention policy for an organization.
 * @param {import('pg').Pool} pool
 * @param {number} orgId
 * @param {{
 *   metricsRetentionDays?: number,
 *   logsRetentionDays?: number,
 *   alertsRetentionDays?: number,
 *   auditRetentionDays?: number
 * }} policy
 * @returns {Promise<void>}
 */
export async function updateRetentionPolicy(pool, orgId, policy) {
    const {
        metricsRetentionDays = 30,
        logsRetentionDays = 90,
        alertsRetentionDays = 90,
        auditRetentionDays = 365,
    } = policy;

    // Validate
    if (metricsRetentionDays <= 0 || logsRetentionDays <= 0 || alertsRetentionDays <= 0 || auditRetentionDays <= 0) {
        throw new Error('All retention days must be positive');
    }

    await pool.query(
        `INSERT INTO ${S}.retention_policies
            (org_id, metrics_retention_days, logs_retention_days, alerts_retention_days, audit_retention_days)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (org_id) DO UPDATE
         SET metrics_retention_days = $2,
             logs_retention_days = $3,
             alerts_retention_days = $4,
             audit_retention_days = $5,
             updated_at = NOW()`,
        [orgId, metricsRetentionDays, logsRetentionDays, alertsRetentionDays, auditRetentionDays]
    );

    log('INFO', 'Updated retention policy', { orgId, ...policy });
}

/**
 * Get current data sizes and row counts for all timeseries tables.
 * @param {import('pg').Pool} pool
 * @returns {Promise<Array<{tableName: string, rowCount: number, sizeBytes: number, sizeMb: string}>>}
 */
export async function getRetentionStats(pool) {
    const tables = ['otel_metrics', 'timeseries', 'audit_log', 'alert_history'];
    const stats = [];

    for (const table of tables) {
        try {
            const countRes = await pool.query(
                `SELECT COUNT(*) as cnt FROM ${S}.${table}`
            );
            const sizeRes = await pool.query(
                `SELECT pg_total_relation_size('${S}.${table}'::regclass) as bytes`
            );

            const rowCount = Number(countRes.rows[0].cnt);
            const sizeBytes = Number(sizeRes.rows[0].bytes);
            const sizeMb = (sizeBytes / 1024 / 1024).toFixed(2);

            stats.push({
                tableName: table,
                rowCount,
                sizeBytes,
                sizeMb: `${sizeMb} MB`,
            });
        } catch (err) {
            log('WARN', `Failed to get stats for table ${table}`, { error: err.message });
        }
    }

    return stats;
}

/**
 * Execute retention cleanup for an organization based on its policy.
 * @param {import('pg').Pool} pool
 * @param {number} orgId
 * @returns {Promise<{deleted: {[key: string]: number}}>}
 */
export async function runRetentionCleanup(pool, orgId) {
    const policy = await getRetentionPolicy(pool, orgId);
    const deleted = {};

    try {
        // Delete old metrics
        const metricsRes = await pool.query(
            `DELETE FROM ${S}.otel_metrics
             WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
            [policy.metricsRetentionDays]
        );
        deleted.otel_metrics = metricsRes.rowCount;

        // Delete old timeseries
        const timeseriesRes = await pool.query(
            `DELETE FROM ${S}.timeseries
             WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
            [policy.metricsRetentionDays]
        );
        deleted.timeseries = timeseriesRes.rowCount;

        // Delete old audit logs
        const auditRes = await pool.query(
            `DELETE FROM ${S}.audit_log
             WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
            [policy.auditRetentionDays]
        );
        deleted.audit_log = auditRes.rowCount;

        // Delete old alert history
        const alertRes = await pool.query(
            `DELETE FROM ${S}.alert_history
             WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
            [policy.alertsRetentionDays]
        );
        deleted.alert_history = alertRes.rowCount;

        // A3: wait-event sampler tables. Both are global (no org_id) so we
        // prune unconditionally on every pass — rowCount stays 0 on orgs
        // that don't sample. Raw kept 24h; rollups kept 14 days.
        try {
            const rawRes = await pool.query(
                `DELETE FROM ${S}.wait_event_samples WHERE sampled_at < NOW() - INTERVAL '1 day'`
            );
            deleted.wait_event_samples = rawRes.rowCount;
        } catch (err) { if (!/relation .* does not exist/i.test(err.message)) throw err; }
        try {
            const rollRes = await pool.query(
                `DELETE FROM ${S}.wait_event_rollups_5m WHERE bucket_start < NOW() - INTERVAL '14 days'`
            );
            deleted.wait_event_rollups_5m = rollRes.rowCount;
        } catch (err) { if (!/relation .* does not exist/i.test(err.message)) throw err; }

        // C6 — auto_explain events are noisy on busy DBs. Default TTL 14d.
        try {
            const aeRes = await pool.query(
                `DELETE FROM ${S}.auto_explain_events WHERE captured_at < NOW() - ($1 || ' days')::interval`,
                [String(Number(process.env.FATHOM_AUTO_EXPLAIN_DAYS) || 14)]
            );
            deleted.auto_explain_events = aeRes.rowCount;
        } catch (err) { if (!/relation .* does not exist/i.test(err.message)) throw err; }

        const totalDeleted = Object.values(deleted).reduce((a, b) => a + b, 0);
        log('INFO', 'Retention cleanup completed', { orgId, ...deleted });

        return { deleted };
    } catch (err) {
        log('ERROR', 'Retention cleanup failed', { orgId, error: err.message });
        throw err;
    }
}

/**
 * Estimate daily data growth rate over the past N days.
 * @param {import('pg').Pool} pool
 * @param {number} days
 * @returns {Promise<{
 *   days: number,
 *   totalRows: number,
 *   estimatedDailyRows: number,
 *   estimatedDailyMb: string
 * }>}
 */
export async function getDataGrowthTrend(pool, days = 7) {
    if (days <= 0) {
        throw new Error('days must be positive');
    }

    try {
        const res = await pool.query(
            `SELECT
                COUNT(*) as total_rows,
                pg_total_relation_size('${S}.otel_metrics'::regclass) +
                pg_total_relation_size('${S}.timeseries'::regclass) +
                pg_total_relation_size('${S}.alert_history'::regclass) as total_bytes
             FROM ${S}.otel_metrics
             WHERE created_at >= NOW() - INTERVAL '1 day' * $1`,
            [days]
        );

        const totalRows = Number(res.rows[0].total_rows);
        const totalBytes = Number(res.rows[0].total_bytes);
        const estimatedDailyRows = Math.round(totalRows / days);
        const estimatedDailyMb = (totalBytes / 1024 / 1024 / days).toFixed(2);

        return {
            days,
            totalRows,
            estimatedDailyRows,
            estimatedDailyMb: `${estimatedDailyMb} MB`,
        };
    } catch (err) {
        log('WARN', 'Failed to calculate growth trend', { error: err.message });
        return {
            days,
            totalRows: 0,
            estimatedDailyRows: 0,
            estimatedDailyMb: '0.00 MB',
        };
    }
}
