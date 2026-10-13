// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
// ==========================================================================
//  PulseDB — /api/overview/long-transactions
//  Returns: queries/transactions running longer than THRESHOLD_SECONDS
// ==========================================================================

import { Router } from 'express';
import { query }  from '../../db.js';

const router = Router();

const THRESHOLD_SECONDS = Number(process.env.LONG_TXN_THRESHOLD_SECONDS || 60);

router.get('/', async (req, res, next) => {
    const threshold = Number(req.query.threshold ?? THRESHOLD_SECONDS);

    try {
        const result = await query(`
            SELECT
                pid,
                usename                                               AS username,
                application_name,
                client_addr::text                                     AS client_addr,
                state,
                wait_event_type,
                wait_event,
                query,
                xact_start,
                query_start,
                state_change,
                EXTRACT(EPOCH FROM (now() - xact_start))::int        AS txn_duration_sec,
                EXTRACT(EPOCH FROM (now() - query_start))::int       AS query_duration_sec,
                backend_type,
                -- Is there a lock blocking this process?
                EXISTS (
                    SELECT 1
                    FROM pg_locks l
                    WHERE l.pid = pg_stat_activity.pid
                      AND NOT l.granted
                )                                                     AS is_blocked
            FROM pg_stat_activity
            WHERE datname = current_database()
              AND state   != 'idle'
              AND pid     != pg_backend_pid()
              AND xact_start IS NOT NULL
              AND EXTRACT(EPOCH FROM (now() - xact_start)) > $1
            ORDER BY txn_duration_sec DESC
        `, [threshold]);

        const transactions = result.rows.map(r => {
            const sec = Number(r.txn_duration_sec);
            return {
                pid             : r.pid,
                username        : r.username,
                applicationName : r.application_name,
                clientAddr      : r.client_addr,
                state           : r.state,
                waitEventType   : r.wait_event_type,
                waitEvent       : r.wait_event,
                // truncate long queries for the overview card
                query           : r.query ? r.query.substring(0, 120) : null,
                xactStart       : r.xact_start,
                queryStart      : r.query_start,
                txnDurationSec  : sec,
                queryDurationSec: Number(r.query_duration_sec),
                // Human-readable duration matching the UI format
                duration        : fmtDuration(sec),
                backendType     : r.backend_type,
                isBlocked       : r.is_blocked,
            };
        });

        res.json(transactions);
    } catch (err) {
        next(err);
    }
});

function fmtDuration(totalSec) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
}

export default router;