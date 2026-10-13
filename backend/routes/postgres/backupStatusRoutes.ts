// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Extracted from server.ts.

import { authenticate } from '../../core/auth.js';
import { reqPool } from '../../core/connectionPools.js';
import { cached } from '../../core/responseCache.js';
import { log } from '../../services/logger.js';

export default function registerBackupStatusRoutes(app) {
    // ─────────────────────────────────────────────────────────────────────────────
    // BACKUP & RECOVERY
    // ─────────────────────────────────────────────────────────────────────────────
    app.get('/api/backup/status', authenticate, cached('bk:status', 30_000), async (req, res) => {
        try {
            const _p = await reqPool(req);
            const [archiver, walInfo, recoveryInfo] = await Promise.all([
                _p.query(`
                SELECT archived_count, last_archived_wal, last_archived_time,
                       failed_count, last_failed_wal, last_failed_time, stats_reset
                FROM pg_stat_archiver
            `),
                _p.query(`
                SELECT pg_current_wal_lsn()::text        AS current_lsn,
                       pg_walfile_name(pg_current_wal_lsn()) AS current_wal,
                       pg_is_in_recovery()               AS in_recovery,
                       pg_postmaster_start_time()::text  AS started_at
            `),
                _p.query(`
                SELECT name, setting
                FROM pg_settings
                WHERE name IN ('wal_level','archive_mode','archive_command','restore_command',
                               'recovery_target_timeline','max_wal_senders','wal_keep_size')
                ORDER BY name
            `),
            ]);
            res.json({
                archiver: archiver.rows[0],
                wal: walInfo.rows[0],
                settings: recoveryInfo.rows,
            });
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({});
        }
    });
}
