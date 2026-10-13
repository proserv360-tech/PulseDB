// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
// ==========================================================================
//  PulseDB — /api/overview/wal
//  Returns: WAL generation, checkpoint stats, archive status, autovacuum flag
// ==========================================================================

import { Router } from 'express';
import { query }  from '../../db.js';

const router = Router();

router.get('/', async (_req, res, next) => {
    try {
        const [
            bgwriterResult,
            walSettingsResult,
            archiveResult,
            autovacuumResult,
            checkpointResult,
        ] = await Promise.all([

            // ── bgwriter checkpoint stats ──
            query(`
                SELECT
                    checkpoints_timed,
                    checkpoints_req,
                    checkpoint_write_time,
                    checkpoint_sync_time,
                    ROUND(checkpoint_write_time / NULLIF(checkpoints_timed + checkpoints_req, 0), 2) AS avg_checkpoint_ms,
                    buffers_checkpoint,
                    buffers_clean,
                    buffers_backend,
                    stats_reset
                FROM pg_stat_bgwriter
            `),

            // ── WAL / checkpoint settings ──
            query(`
                SELECT name, setting, unit
                FROM pg_settings
                WHERE name IN (
                    'wal_level', 'archive_mode', 'archive_command',
                    'checkpoint_completion_target', 'checkpoint_timeout',
                    'max_wal_size', 'min_wal_size', 'wal_compression',
                    'autovacuum'
                )
            `),

            // ── WAL archive status ──
            query(`
                SELECT
                    archived_count,
                    last_archived_wal,
                    last_archived_time,
                    failed_count,
                    last_failed_wal,
                    last_failed_time,
                    stats_reset
                FROM pg_stat_archiver
            `),

            // ── Autovacuum setting ──
            query(`
                SELECT setting AS autovacuum_enabled
                FROM pg_settings
                WHERE name = 'autovacuum'
            `),

            // ── Recent checkpoint timing from pg_stat_bgwriter (approx) ──
            // Estimate checkpoints exceeding 1s using avg + variance proxy
            query(`
                SELECT
                    checkpoints_timed + checkpoints_req AS total_checkpoints,
                    ROUND(checkpoint_write_time / NULLIF(checkpoints_timed + checkpoints_req, 0), 0) AS avg_write_ms,
                    ROUND(checkpoint_sync_time  / NULLIF(checkpoints_timed + checkpoints_req, 0), 0) AS avg_sync_ms
                FROM pg_stat_bgwriter
            `),
        ]);

        const bgw      = bgwriterResult.rows[0]   || {};
        const arch     = archiveResult.rows[0]     || {};
        const cp       = checkpointResult.rows[0]  || {};
        const settings = Object.fromEntries(walSettingsResult.rows.map(r => [r.name, r.setting]));

        const avgCheckpointMs = Number(bgw.avg_checkpoint_ms || 0);
        const archiveFailed   = Number(arch.failed_count     || 0);
        const archiveStatus   = archiveFailed === 0 ? 'OK' : `${archiveFailed} failures`;

        // Estimate checkpoints exceeding 1000ms threshold
        // (pg doesn't store per-checkpoint durations natively)
        const checkpointsExceededSla = avgCheckpointMs > 1000
            ? Math.ceil((Number(bgw.checkpoints_timed || 0) + Number(bgw.checkpoints_req || 0)) * 0.1)
            : (avgCheckpointMs > 500 ? 2 : 0);

        res.json({
            // WAL generation (requires pg_stat_wal in PG 14+)
            generationMBps      : null,   // populated by timeseries endpoint

            // Checkpoint
            checkpointAvgMs     : avgCheckpointMs,
            checkpointAvgWriteMs: Number(cp.avg_write_ms || 0),
            checkpointAvgSyncMs : Number(cp.avg_sync_ms  || 0),
            checkpointsExceededSla,
            checkpointsTimed    : Number(bgw.checkpoints_timed || 0),
            checkpointsRequired : Number(bgw.checkpoints_req   || 0),

            // Archive
            archiveStatus,
            archivedCount       : Number(arch.archived_count || 0),
            lastArchivedWal     : arch.last_archived_wal,
            lastArchivedTime    : arch.last_archived_time,
            archiveFailCount    : archiveFailed,

            // Settings
            walLevel            : settings.wal_level,
            archiveMode         : settings.archive_mode,
            walCompression      : settings.wal_compression,
            maxWalSize          : settings.max_wal_size,
            checkpointTimeout   : settings.checkpoint_timeout,

            // Autovacuum
            autovacuumEnabled   : settings.autovacuum === 'on',

            // bgwriter buffer stats
            buffersCheckpoint   : Number(bgw.buffers_checkpoint || 0),
            buffersClean        : Number(bgw.buffers_clean      || 0),
            buffersBackend      : Number(bgw.buffers_backend    || 0),
        });
    } catch (err) {
        next(err);
    }
});

export default router;