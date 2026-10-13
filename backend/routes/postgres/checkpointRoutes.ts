// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Extracted from server.ts.

import { authenticate } from '../../core/auth.js';
import { CONFIG } from '../../core/config.js';
import { reqPool } from '../../core/connectionPools.js';
import { cached } from '../../core/responseCache.js';
import { log } from '../../services/logger.js';

export default function registerCheckpointRoutes(app) {
    // ─────────────────────────────────────────────────────────────────────────────
    // CHECKPOINT MONITOR
    // ─────────────────────────────────────────────────────────────────────────────
    app.get('/api/checkpoint/stats', authenticate, cached('chk:stats', CONFIG.CACHE_TTL.STATS), async (req, res) => {
        try {
            const _p = await reqPool(req);
            const [bgwriter, walLsn, walSettings] = await Promise.all([
                _p.query(`
                SELECT
                    -- PG 17+ splits checkpoint stats into pg_stat_checkpointer;
                    -- fall back to pg_stat_bgwriter for older versions.
                    COALESCE(
                        (SELECT num_timed    FROM pg_stat_checkpointer LIMIT 1),
                        (SELECT checkpoints_timed FROM pg_stat_bgwriter LIMIT 1), 0
                    ) AS checkpoints_timed,
                    COALESCE(
                        (SELECT num_requested FROM pg_stat_checkpointer LIMIT 1),
                        (SELECT checkpoints_req   FROM pg_stat_bgwriter LIMIT 1), 0
                    ) AS checkpoints_req,
                    COALESCE(
                        (SELECT write_time   FROM pg_stat_checkpointer LIMIT 1),
                        (SELECT checkpoint_write_time FROM pg_stat_bgwriter LIMIT 1), 0
                    )::numeric AS checkpoint_write_ms,
                    COALESCE(
                        (SELECT sync_time    FROM pg_stat_checkpointer LIMIT 1),
                        (SELECT checkpoint_sync_time  FROM pg_stat_bgwriter LIMIT 1), 0
                    )::numeric AS checkpoint_sync_ms,
                    COALESCE(
                        (SELECT buffers_written FROM pg_stat_checkpointer LIMIT 1),
                        (SELECT buffers_checkpoint    FROM pg_stat_bgwriter LIMIT 1), 0
                    ) AS buffers_checkpoint,
                    b.buffers_clean,
                    b.maxwritten_clean,
                    b.buffers_backend,
                    b.buffers_backend_fsync,
                    b.buffers_alloc,
                    b.stats_reset
                FROM pg_stat_bgwriter b
            `),
                _p.query(`
                SELECT pg_current_wal_lsn()::text AS current_lsn,
                    pg_walfile_name(pg_current_wal_lsn()) AS current_wal_file,
                       (SELECT setting::int FROM pg_settings WHERE name = 'checkpoint_completion_target') AS completion_target,
                       (SELECT setting::int FROM pg_settings WHERE name = 'max_wal_size') AS max_wal_mb,
                       (SELECT setting::int FROM pg_settings WHERE name = 'min_wal_size') AS min_wal_mb,
                       (SELECT setting::int FROM pg_settings WHERE name = 'checkpoint_timeout') AS checkpoint_timeout_sec
            `),
                _p.query(`
                SELECT name, setting, unit, short_desc
                FROM pg_settings
                WHERE name IN (
                               'checkpoint_completion_target','checkpoint_timeout',
                               'max_wal_size','min_wal_size','wal_buffers',
                               'bgwriter_delay','bgwriter_lru_maxpages','bgwriter_lru_multiplier'
                    )
                ORDER BY name
            `),
            ]);
            res.json({ bgwriter: bgwriter.rows[0], wal: walLsn.rows[0], settings: walSettings.rows });
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({});
        }
    });
}
