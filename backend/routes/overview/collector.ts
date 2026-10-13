// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

import { query } from '../../db.js';
import { recordSnapshot } from './timeseries.js';
import { swallow } from '../../services/errorHandling.js';

const COLLECT_INTERVAL_MS  = Number(process.env.COLLECT_INTERVAL_MS  || 30_000);
const ALERT_CHECK_INTERVAL = Number(process.env.ALERT_CHECK_INTERVAL || 60_000);
const SNAPSHOT_RETENTION_HOURS = Number(process.env.SNAPSHOT_RETENTION_HOURS || 48);

let collectTimer = null;
let alertTimer   = null;

export function startCollector() {
    console.log('[collector] Starting — interval:', COLLECT_INTERVAL_MS, 'ms');

    // Run immediately on startup, then on interval
    collectMetrics();
    collectTimer = setInterval(collectMetrics, COLLECT_INTERVAL_MS);

    checkAlerts();
    alertTimer = setInterval(checkAlerts, ALERT_CHECK_INTERVAL);

    // Prune old snapshots once per hour
    setInterval(pruneOldSnapshots, 3_600_000);
}

export function stopCollector() {
    if (collectTimer) clearInterval(collectTimer);
    if (alertTimer)   clearInterval(alertTimer);
    console.log('[collector] Stopped.');
}

/* ══════════════════════════════════════════════════════════════════════════
   METRIC SNAPSHOT
   ══════════════════════════════════════════════════════════════════════════ */
async function collectMetrics() {
    try {
        await recordSnapshot();
    } catch (err) {
        console.error('[collector] Snapshot error:', err.message);
    }
}

/* ══════════════════════════════════════════════════════════════════════════
   ALERT CHECKS → writes to pulsedb_alerts
   ══════════════════════════════════════════════════════════════════════════ */
async function checkAlerts() {
    try {
        await ensureAlertsTable();
        const alerts = await gatherAlerts();

        for (const alert of alerts) {
            // Upsert by fingerprint — don't spam duplicates
            await query(`
                INSERT INTO pulsedb_alerts (severity, title, message, fingerprint, read, dismissed)
                VALUES ($1, $2, $3, $4, false, false)
                ON CONFLICT (fingerprint)
                DO UPDATE SET
                    severity  = EXCLUDED.severity,
                    title     = EXCLUDED.title,
                    message   = EXCLUDED.message,
                    -- only reset read state if severity escalated
                    read      = CASE WHEN EXCLUDED.severity = 'critical' AND pulsedb_alerts.severity != 'critical'
                                     THEN false ELSE pulsedb_alerts.read END,
                    created_at = CASE WHEN pulsedb_alerts.dismissed THEN now() ELSE pulsedb_alerts.created_at END,
                    dismissed  = false
            `);
        }

        // Auto-resolve alerts that are no longer triggered
        await query(`
            DELETE FROM pulsedb_alerts
            WHERE source = 'auto'
              AND fingerprint = ANY($1::text[])
        `, [
            // fingerprints NOT in current alert set
            []   // placeholder — real implementation would diff current vs. previous
        ]);

    } catch (err) {
        console.error('[collector] Alert check error:', err.message);
    }
}

async function gatherAlerts() {
    const alerts = [];

    // ── Replication lag ──
    try {
        const r = await query(`
            SELECT application_name, EXTRACT(EPOCH FROM replay_lag)*1000 AS lag_ms
            FROM pg_stat_replication WHERE replay_lag IS NOT NULL
        `);
        for (const row of r.rows) {
            const ms = Number(row.lag_ms);
            if (ms > 5000) alerts.push({ severity: 'critical', title: `High replication lag on ${row.application_name}`, message: `${Math.round(ms)}ms replay lag`, fingerprint: `repl-lag-${row.application_name}` });
            else if (ms > 1000) alerts.push({ severity: 'warning', title: `Replication lag on ${row.application_name}`, message: `${Math.round(ms)}ms replay lag`, fingerprint: `repl-lag-${row.application_name}` });
        }
    } catch (err) { swallow(err, { component: 'collector', op: 'gatherAlerts.probe' }); }

    // ── Urgent vacuum ──
    try {
        const r = await query(`
            SELECT COUNT(*) AS cnt FROM pg_stat_user_tables
            WHERE n_live_tup + n_dead_tup > 0
              AND (100.0 * n_dead_tup / NULLIF(n_live_tup+n_dead_tup,0) > 20
                   OR EXTRACT(DAY FROM now() - COALESCE(last_autovacuum,last_vacuum)) > 7)
        `);
        const cnt = Number(r.rows[0]?.cnt || 0);
        if (cnt > 0) alerts.push({ severity: cnt >= 5 ? 'critical' : 'warning', title: `${cnt} table${cnt > 1 ? 's' : ''} require urgent VACUUM`, message: 'Dead tuple ratio or vacuum age threshold exceeded.', fingerprint: 'vacuum-urgent' });
    } catch (err) { swallow(err, { component: 'collector', op: 'gatherAlerts.probe' }); }

    // ── Checkpoint duration ──
    try {
        const r = await query(`
            SELECT ROUND(checkpoint_write_time / NULLIF(checkpoints_timed+checkpoints_req,0),0) AS avg_ms
            FROM pg_stat_bgwriter
        `);
        const ms = Number(r.rows[0]?.avg_ms || 0);
        if (ms > 1000) alerts.push({ severity: 'warning', title: `Checkpoint duration exceeded 1s (avg ${ms}ms)`, message: 'High checkpoint_write_time may indicate I/O pressure.', fingerprint: 'checkpoint-slow' });
    } catch (err) { swallow(err, { component: 'collector', op: 'gatherAlerts.probe' }); }

    // ── Connection saturation ──
    try {
        const r = await query(`
            SELECT COUNT(*) AS active,
                   (SELECT setting::int FROM pg_settings WHERE name='max_connections') AS max_c
            FROM pg_stat_activity WHERE datname = current_database()
        `);
        const pct = Number(r.rows[0].active) / Number(r.rows[0].max_c) * 100;
        if (pct > 90) alerts.push({ severity: 'critical', title: `Connection pool at ${Math.round(pct)}% capacity`, message: `${r.rows[0].active} of ${r.rows[0].max_c} connections.`, fingerprint: 'conn-saturation' });
        else if (pct > 75) alerts.push({ severity: 'warning', title: `High connection usage: ${Math.round(pct)}%`, message: `${r.rows[0].active} of ${r.rows[0].max_c} connections.`, fingerprint: 'conn-high' });
    } catch (err) { swallow(err, { component: 'collector', op: 'gatherAlerts.probe' }); }

    // ── Blocked queries ──
    try {
        const r = await query(`SELECT COUNT(*) AS cnt FROM pg_stat_activity WHERE wait_event_type='Lock' AND state='active'`);
        const cnt = Number(r.rows[0]?.cnt || 0);
        if (cnt > 0) alerts.push({ severity: cnt >= 5 ? 'critical' : 'warning', title: `${cnt} quer${cnt > 1 ? 'ies' : 'y'} blocked by locks`, message: `Lock contention detected.`, fingerprint: 'blocked-queries' });
    } catch (err) { swallow(err, { component: 'collector', op: 'gatherAlerts.probe' }); }

    return alerts.map(a => ({ ...a, source: 'auto' }));
}

/* ══════════════════════════════════════════════════════════════════════════
   MAINTENANCE
   ══════════════════════════════════════════════════════════════════════════ */
async function pruneOldSnapshots() {
    try {
        const r = await query(`
            DELETE FROM pulsedb_metric_snapshots
            WHERE time_bucket < now() - ($1 || ' hours')::interval
        `, [SNAPSHOT_RETENTION_HOURS]);
        if (r.rowCount > 0) {
            console.log(`[collector] Pruned ${r.rowCount} old snapshots`);
        }
    } catch (err) {
        console.error('[collector] Prune error:', err.message);
    }
}

async function ensureAlertsTable() {
    await query(`
        CREATE TABLE IF NOT EXISTS pulsedb_alerts (
            id          BIGSERIAL PRIMARY KEY,
            severity    TEXT        NOT NULL DEFAULT 'info',
            title       TEXT        NOT NULL,
            message     TEXT,
            fingerprint TEXT        UNIQUE,
            source      TEXT        DEFAULT 'auto',
            read        BOOLEAN     NOT NULL DEFAULT false,
            dismissed   BOOLEAN     NOT NULL DEFAULT false,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);
}

/* ── Standalone mode ── */
if (process.argv[1].endsWith('collector.js')) {
    startCollector();
    console.log('[collector] Running standalone. Ctrl+C to stop.');
}