// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
// ==========================================================================
//  FATHOM — /api/overview/traffic
//  Returns: tup_fetched, tup_inserted, tup_updated, tup_deleted + blk stats
// ==========================================================================

import { Router } from 'express';
import { query }  from '../../db.js';

const router = Router();

router.get('/', async (_req, res, next) => {
    try {
        const result = await query(`
            SELECT
                tup_fetched,
                tup_inserted,
                tup_updated,
                tup_deleted,
                tup_returned,
                blks_read,
                blks_hit,
                xact_commit,
                xact_rollback,
                conflicts,
                deadlocks,
                temp_files,
                temp_bytes,
                ROUND(
                    100.0 * blks_hit / NULLIF(blks_hit + blks_read, 0),
                    2
                ) AS buffer_hit_ratio
            FROM pg_stat_database
            WHERE datname = current_database()
        `);

        const row = result.rows[0];

        res.json({
            tup_fetched  : Number(row.tup_fetched),
            tup_inserted : Number(row.tup_inserted),
            tup_updated  : Number(row.tup_updated),
            tup_deleted  : Number(row.tup_deleted),
            tup_returned : Number(row.tup_returned),

            blks_read    : Number(row.blks_read),
            blks_hit     : Number(row.blks_hit),
            bufferHitRatio: Number(row.buffer_hit_ratio || 0),

            xact_commit  : Number(row.xact_commit),
            xact_rollback: Number(row.xact_rollback),
            conflicts    : Number(row.conflicts),
            deadlocks    : Number(row.deadlocks),

            temp_files   : Number(row.temp_files),
            temp_bytes   : Number(row.temp_bytes),
        });
    } catch (err) {
        next(err);
    }
});

export default router;