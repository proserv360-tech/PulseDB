// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
// ==========================================================================
//  PulseDB — /api/overview/top-tables
//  Returns: top N tables ranked by total I/O (reads + writes)
// ==========================================================================

import { Router } from 'express';
import { query }  from '../../db.js';

const router = Router();

router.get('/', async (req, res, next) => {
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    try {
        const result = await query(`
            SELECT
                schemaname || '.' || relname      AS name,
                schemaname,
                relname,
                seq_scan,
                seq_tup_read                      AS reads,
                n_tup_ins + n_tup_upd + n_tup_del AS writes,
                n_tup_ins                         AS inserts,
                n_tup_upd                         AS updates,
                n_tup_del                         AS deletes,
                n_live_tup                        AS live_tuples,
                n_dead_tup                        AS dead_tuples,
                CASE
                    WHEN n_live_tup + n_dead_tup = 0 THEN 0
                    ELSE ROUND(
                        100.0 * n_dead_tup / (n_live_tup + n_dead_tup),
                        2
                    )
                END                               AS dead_ratio_pct,
                pg_total_relation_size(schemaname || '.' || quote_ident(relname)) AS total_bytes,
                ROUND(pg_total_relation_size(schemaname || '.' || quote_ident(relname)) / 1048576.0, 2) AS total_mb,
                last_autovacuum,
                last_autoanalyze,
                last_vacuum,
                last_analyze
            FROM pg_stat_user_tables
            ORDER BY (seq_tup_read + n_tup_ins + n_tup_upd + n_tup_del) DESC
            LIMIT $1
        `, [limit]);

        res.json(result.rows.map(r => ({
            name          : r.name,
            schema        : r.schemaname,
            table         : r.relname,
            reads         : Number(r.reads),
            writes        : Number(r.writes),
            inserts       : Number(r.inserts),
            updates       : Number(r.updates),
            deletes       : Number(r.deletes),
            liveTuples    : Number(r.live_tuples),
            deadTuples    : Number(r.dead_tuples),
            deadRatioPct  : Number(r.dead_ratio_pct),
            totalBytes    : Number(r.total_bytes),
            totalMb       : Number(r.total_mb),
            seqScans      : Number(r.seq_scan),
            lastAutovacuum : r.last_autovacuum,
            lastAutoanalyze: r.last_autoanalyze,
            lastVacuum    : r.last_vacuum,
            lastAnalyze   : r.last_analyze,
        })));
    } catch (err) {
        next(err);
    }
});

export default router;