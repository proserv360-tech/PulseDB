// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
// ==========================================================================
//  FATHOM — /api/overview/alerts
//
//  Two modes:
//  1. Read from fathom_alerts table (if exists) — persistent, dismissable
//  2. Auto-generate alerts by inspecting live pg metrics (always available)
//
//  Both modes are merged and deduplicated by fingerprint.
// ==========================================================================

import { Router } from 'express';
import { query }  from '../../db.js';

const router = Router();

/* ── GET all alerts ── */
router.get('/', async (_req, res, next) => {
    try {
        const [stored, live] = await Promise.all([
            fetchStoredAlerts(),
            generateLiveAlerts(),
        ]);

        // Merge: stored alerts take precedence (they carry read/dismiss state)
        const storedFingerprints = new Set(stored.map(a => a.fingerprint));
        const merged = [
            ...stored,
            ...live.filter(a => !storedFingerprints.has(a.fingerprint)),
        ].sort((a, b) => {
            const sev = { critical: 0, warning: 1, info: 2 };
            return (sev[a.severity] ?? 3) - (sev[b.severity] ?? 3);
        });

        res.json(merged);
    } catch (err) {
        next(err);
    }
});

/* ── PATCH /:id/read — mark an alert as read ── */
router.patch('/:id/read', async (req, res, next) => {
    try {
        await ensureAlertsTable();
        await query(`UPDATE fathom_alerts SET read = true WHERE id = $1`, [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

/* ── DELETE /:id — dismiss an alert ── */
router.delete('/:id', async (req, res, next) => {
    try {
        await ensureAlertsTable();
        await query(`UPDATE fathom_alerts SET dismissed = true WHERE id = $1`, [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

/* ── PATCH /read-all — mark all as read ── */
router.patch('/read-all', async (_req, res, next) => {
    try {
        await ensureAlertsTable();
        await query(`UPDATE fathom_alerts SET read = true WHERE read = false`);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

/* ══════════════════════════════════════════════════════════════════════════
   INTERNAL HELPERS
   ══════════════════════════════════════════════════════════════════════════ */

async function fetchStoredAlerts() {
    const exists = await tableExists('fathom_alerts');
    if (!exists) return [];

    const result = await query(`
        SELECT
            id, severity, title, message, fingerprint,
            read, dismissed, created_at
        FROM fathom_alerts
        WHERE dismissed = false
          AND created_at > now() - interval '24 hours'
        ORDER BY created_at DESC
        LIMIT 50
    `);

    return result.rows.map(r => ({
        id         : r.id,
        severity   : r.severity,
        title      : r.title,
        message    : r.message,
        fingerprint: r.fingerprint,
        read       : r.read,
        time       : fmtRelTime(r.created_at),
        timestamp  : r.created_at,
        source     : 'stored',
    }));
}

async function generateLiveAlerts() {
    const alerts = [];

    try {
        // ── Replication lag ──
        const repResult = await query(`
            SELECT application_name,
                   EXTRACT(EPOCH FROM replay_lag) * 1000 AS lag_ms
            FROM pg_stat_replication
            WHERE replay_lag IS NOT NULL
        `);
        for (const r of repResult.rows) {
            const lagMs = Number(r.lag_ms);
            if (lagMs > 5000) {
                alerts.push(makeAlert(
                    'critical',
                    `High replication lag on ${r.application_name}`,
                    `Replay lag is ${Math.round(lagMs)}ms — exceeds 5s threshold.`,
                    `repl-lag-${r.application_name}`,
                ));
            } else if (lagMs > 1000) {
                alerts.push(makeAlert(
                    'warning',
                    `Replication lag on ${r.application_name}`,
                    `Replay lag is ${Math.round(lagMs)}ms.`,
                    `repl-lag-${r.application_name}`,
                ));
            }
        }

        // ── Vacuum urgency ──
        const vacResult = await query(`
            SELECT COUNT(*) AS urgent
            FROM pg_stat_user_tables
            WHERE n_live_tup + n_dead_tup > 0
              AND (
                100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0) > 20
                OR EXTRACT(DAY FROM now() - COALESCE(last_autovacuum, last_vacuum)) > 7
              )
        `);
        const urgentVacuum = Number(vacResult.rows[0]?.urgent || 0);
        if (urgentVacuum > 0) {
            alerts.push(makeAlert(
                urgentVacuum >= 5 ? 'critical' : 'warning',
                `${urgentVacuum} table${urgentVacuum > 1 ? 's' : ''} require urgent VACUUM`,
                `Dead tuple ratio or vacuum age threshold exceeded.`,
                'vacuum-urgent',
            ));
        }

        // ── Long running transactions ──
        const txnResult = await query(`
            SELECT COUNT(*) AS cnt
            FROM pg_stat_activity
            WHERE datname = current_database()
              AND state != 'idle'
              AND pid   != pg_backend_pid()
              AND EXTRACT(EPOCH FROM (now() - xact_start)) > 300
        `);
        const longTxns = Number(txnResult.rows[0]?.cnt || 0);
        if (longTxns > 0) {
            alerts.push(makeAlert(
                'warning',
                `${longTxns} transaction${longTxns > 1 ? 's' : ''} running > 5 minutes`,
                `Long-running transactions may cause lock contention and bloat.`,
                'long-txn',
            ));
        }

        // ── Blocked queries ──
        const blockResult = await query(`
            SELECT COUNT(*) AS cnt
            FROM pg_stat_activity
            WHERE wait_event_type = 'Lock'
              AND state = 'active'
        `);
        const blocked = Number(blockResult.rows[0]?.cnt || 0);
        if (blocked > 0) {
            alerts.push(makeAlert(
                blocked >= 5 ? 'critical' : 'warning',
                `${blocked} quer${blocked > 1 ? 'ies' : 'y'} blocked by locks`,
                `Lock contention detected — check pg_blocking_pids().`,
                'blocked-queries',
            ));
        }

        // ── Cache hit ratio ──
        const cacheResult = await query(`
            SELECT ROUND(
                100.0 * SUM(idx_blks_hit)
                / NULLIF(SUM(idx_blks_hit) + SUM(idx_blks_read), 0), 2
            ) AS ratio
            FROM pg_statio_user_tables
        `);
        const cacheRatio = Number(cacheResult.rows[0]?.ratio || 100);
        if (cacheRatio < 95) {
            alerts.push(makeAlert(
                'warning',
                `Cache hit ratio dipped to ${cacheRatio}%`,
                `Index cache hit ratio is below 95% — consider increasing shared_buffers.`,
                'cache-hit-low',
            ));
        }

        // ── Connection saturation ──
        const connResult = await query(`
            SELECT
                COUNT(*) AS active,
                (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_conns
            FROM pg_stat_activity
            WHERE datname = current_database()
        `);
        const connRow   = connResult.rows[0];
        const connPct   = (Number(connRow.active) / Number(connRow.max_conns)) * 100;
        if (connPct > 90) {
            alerts.push(makeAlert(
                'critical',
                `Connection pool at ${Math.round(connPct)}% capacity`,
                `${connRow.active} of ${connRow.max_conns} connections in use.`,
                'conn-saturation',
            ));
        } else if (connPct > 75) {
            alerts.push(makeAlert(
                'warning',
                `High connection usage: ${Math.round(connPct)}%`,
                `${connRow.active} of ${connRow.max_conns} connections in use.`,
                'conn-high',
            ));
        }

        // ── Checkpoint warnings ──
        const bgwResult = await query(`
            SELECT
                ROUND(checkpoint_write_time / NULLIF(checkpoints_timed + checkpoints_req, 0), 0) AS avg_ms
            FROM pg_stat_bgwriter
        `);
        const avgCpMs = Number(bgwResult.rows[0]?.avg_ms || 0);
        if (avgCpMs > 1000) {
            alerts.push(makeAlert(
                'warning',
                `Checkpoint duration exceeded 1s (avg ${avgCpMs}ms)`,
                `High checkpoint_write_time may indicate I/O pressure.`,
                'checkpoint-slow',
            ));
        }

    } catch (alertErr) {
        console.error('[alerts] Error generating live alerts:', alertErr.message);
    }

    return alerts;
}

function makeAlert(severity, title, message, fingerprint) {
    return {
        id         : `live-${fingerprint}`,
        severity,
        title,
        message,
        fingerprint,
        read       : false,
        time       : 'just now',
        timestamp  : new Date().toISOString(),
        source     : 'live',
    };
}

async function tableExists(name) {
    const r = await query(`
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = $1
        ) AS exists
    `, [name]);
    return r.rows[0]?.exists ?? false;
}

async function ensureAlertsTable() {
    await query(`
        CREATE TABLE IF NOT EXISTS fathom_alerts (
            id          BIGSERIAL PRIMARY KEY,
            severity    TEXT        NOT NULL DEFAULT 'info',
            title       TEXT        NOT NULL,
            message     TEXT,
            fingerprint TEXT,
            read        BOOLEAN     NOT NULL DEFAULT false,
            dismissed   BOOLEAN     NOT NULL DEFAULT false,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);
}

function fmtRelTime(isoStr) {
    const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
    if (diff < 60)    return `${Math.round(diff)}s ago`;
    if (diff < 3600)  return `${Math.round(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
    return `${Math.round(diff / 86400)}d ago`;
}

export default router;