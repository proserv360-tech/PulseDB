// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Long-running background jobs started with the web process.
// Extracted from server.ts.

import { scheduleAuditExport } from '../services/auditExport.js';
import { log } from '../services/logger.js';
import { pool } from './adminPool.js';
import { getPool } from './connectionPools.js';

export function startBackgroundJobs() {
    // ── Scheduled audit-log export (no-op when AUDIT_EXPORT_BUCKET unset) ────────
    if (process.env.AUDIT_EXPORT_ENABLED !== 'false') {
        scheduleAuditExport();
    }

    // ── A3: Postgres wait-event sampler ─────────────────────────────────────────
    // Polls pg_stat_activity at 1 Hz across registered Postgres connections.
    // Skipped on Vercel and in tests; moves to the worker tier in B1.
    if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'test' && process.env.FATHOM_WAIT_EVENTS !== 'off') {
        (async () => {
            try {
                const { startWaitEventSampler } = await import('../services/waitEventSampler.js');
                startWaitEventSampler({ pool, getPool });
            } catch (err) {
                log('WARN', `Wait-event sampler not started: ${err.message}`);
            }
        })();
    }

    // ── A5: copilot history retention sweep ─────────────────────────────────────
    // Even though saveConversationTurn redacts user input on write (HIGH-4),
    // no redactor is perfect. A time-bounded TTL caps exposure of any
    // regulated identifier that slipped through. See backend/docs/COPILOT_RETENTION.md.
    //
    // Runs daily at 04:07 UTC (odd minute avoids top-of-hour stampede with the
    // audit-export cron). Skipped on Vercel because we have no long-lived
    // process there — once B1 splits the worker tier, this moves to worker.js.
    if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'test') {
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        const scheduleCopilotPurge = async () => {
            try {
                const { purgeOldConversations, COPILOT_HISTORY_MAX_AGE_DAYS } =
                    await import('../services/copilotService.js');
                const tick = async () => {
                    try {
                        const removed = await purgeOldConversations();
                        if (removed > 0) {
                            log(
                                'INFO',
                                `Copilot retention sweep removed ${removed} turn(s) older than ${COPILOT_HISTORY_MAX_AGE_DAYS}d`,
                            );
                        }
                    } catch (err) {
                        log('WARN', `Copilot retention sweep failed: ${err.message}`);
                    }
                };
                // Fire once at startup (small lag) then daily after that.
                setTimeout(tick, 30_000).unref?.();
                const handle = setInterval(tick, ONE_DAY_MS);
                handle.unref?.();
            } catch (err) {
                log('WARN', `Copilot retention sweep not scheduled: ${err.message}`);
            }
        };
        scheduleCopilotPurge();
    }

    // ── Metric rollup + tiered retention sweep (B-3) ─────────────────────────────
    // Downsample raw otel_metrics into hourly/daily rollups so long history is kept
    // at lower resolution instead of deleted. Rollups run hourly; tier pruning
    // (which drops raw past its window, after it's rolled up) runs daily. Skipped on
    // Vercel (no long-lived process) and in test.
    if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'test') {
        (async () => {
            try {
                const { runMetricRollups, pruneTiers } = await import('../services/metricRollupService.js');
                const rollTick = async () => {
                    try {
                        await runMetricRollups(pool);
                    } catch (err) {
                        log('WARN', `Metric rollup failed: ${err.message}`);
                    }
                };
                const pruneTick = async () => {
                    try {
                        const pruned = await pruneTiers(pool);
                        log('INFO', 'Metric tier prune', pruned);
                    } catch (err) {
                        log('WARN', `Metric tier prune failed: ${err.message}`);
                    }
                };
                setTimeout(rollTick, 45_000).unref?.();
                setInterval(rollTick, 60 * 60 * 1000).unref?.();
                setInterval(pruneTick, 24 * 60 * 60 * 1000).unref?.();
            } catch (err) {
                log('WARN', `Metric rollup sweep not scheduled: ${err.message}`);
            }
        })();
    }

    // ── Enterprise routes (hidden — uncomment when ready) ────────────────────────
    // mountEnterpriseRoutes(app, pool, authenticate, requireRole, requireScreen);
}
