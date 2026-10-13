// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
// ==========================================================================
//  PulseDB — /api/overview/vacuum
//  Returns: urgentCount, warnCount, healthyCount, bloat, dead tuples,
//           last autovacuum run, per-table breakdown
// ==========================================================================

import { Router } from 'express';
import { query }  from '../../db.js';

const router = Router();

// Thresholds (tunable via env)
const URGENT_DEAD_RATIO = Number(process.env.VACUUM_URGENT_DEAD_RATIO || 20); // %
const WARN_DEAD_RATIO   = Number(process.env.VACUUM_WARN_DEAD_RATIO   || 10); // %
const URGENT_NO_VACUUM_DAYS = Number(process.env.VACUUM_URGENT_DAYS   || 7);
const WARN_NO_VACUUM_DAYS   = Number(process.env.VACUUM_WARN_DAYS     || 3);

router.get('/', async (_req, res, next) => {
    try {
        const result = await query(`
            SELECT
                schemaname || '.' || relname AS name,
                n_live_tup                   AS live_tuples,
                n_dead_tup                   AS dead_tuples,
                CASE
                    WHEN n_live_tup + n_dead_tup = 0 THEN 0
                    ELSE ROUND(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2)
                END                          AS dead_ratio_pct,
                last_autovacuum,
                last_vacuum,
                EXTRACT(DAY FROM now() - COALESCE(last_autovacuum, last_vacuum)) AS days_since_vacuum,
                pg_total_relation_size(schemaname || '.' || quote_ident(relname)) AS total_bytes
            FROM pg_stat_user_tables
            WHERE n_live_tup + n_dead_tup > 0
            ORDER BY dead_tuples DESC
        `);

        const tables = result.rows;

        let urgentCount  = 0;
        let warnCount    = 0;
        let healthyCount = 0;
        let totalDeadTuples = 0;
        let totalBloatBytes = 0;
        let lastRunTable    = null;
        let lastRunTime     = null;

        const tableDetails = tables.map(t => {
            const deadRatio   = Number(t.dead_ratio_pct);
            const daysSince   = Number(t.days_since_vacuum ?? 999);
            const deadTuples  = Number(t.dead_tuples);
            const totalBytes  = Number(t.total_bytes);

            totalDeadTuples += deadTuples;
            // Rough bloat estimate: dead_ratio of total size
            totalBloatBytes += Math.round(totalBytes * deadRatio / 100);

            const isUrgent =
                deadRatio >= URGENT_DEAD_RATIO ||
                daysSince >= URGENT_NO_VACUUM_DAYS;

            const isWarn =
                !isUrgent && (
                    deadRatio >= WARN_DEAD_RATIO ||
                    daysSince >= WARN_NO_VACUUM_DAYS
                );

            if (isUrgent)      urgentCount++;
            else if (isWarn)   warnCount++;
            else               healthyCount++;

            // Track most recent vacuum
            const vacuumTime = t.last_autovacuum || t.last_vacuum;
            if (vacuumTime && (!lastRunTime || vacuumTime > lastRunTime)) {
                lastRunTime  = vacuumTime;
                lastRunTable = t.name;
            }

            return {
                name          : t.name,
                liveTuples    : Number(t.live_tuples),
                deadTuples,
                deadRatioPct  : deadRatio,
                daysSinceVacuum: daysSince,
                lastAutovacuum: t.last_autovacuum,
                lastVacuum    : t.last_vacuum,
                status        : isUrgent ? 'urgent' : isWarn ? 'warn' : 'healthy',
                totalBytes,
            };
        });

        // Overall bloat %
        const totalSizeBytes = tables.reduce((s, t) => s + Number(t.total_bytes), 0);
        const bloatPct = totalSizeBytes > 0
            ? Number((totalBloatBytes / totalSizeBytes * 100).toFixed(2))
            : 0;

        // Relative time for last run
        const lastRunAgo = lastRunTime
            ? fmtRelTime(lastRunTime)
            : 'Never';

        res.json({
            urgentCount,
            warnCount,
            healthyCount,
            totalTracked : tables.length,
            deadTuples   : totalDeadTuples,
            bloatPct,
            bloatBytes   : totalBloatBytes,
            lastRunTable,
            lastRunTime,
            lastRunAgo,
            tables       : tableDetails,   // full breakdown for drill-down
        });
    } catch (err) {
        next(err);
    }
});

function fmtRelTime(isoStr) {
    const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
    if (diff < 60)    return `${Math.round(diff)}s ago`;
    if (diff < 3600)  return `${Math.round(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
    return `${Math.round(diff / 86400)}d ago`;
}

export default router;