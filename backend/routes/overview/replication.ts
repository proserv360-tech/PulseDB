// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
// ==========================================================================
//  PulseDB — /api/overview/replication
//  Returns: primary info, replica list with lag, lock stats, blocked queries
// ==========================================================================

import { Router } from 'express';
import { query }  from '../../db.js';

const router = Router();

router.get('/', async (_req, res, next) => {
    try {
        const [
            replicaResult,
            lockResult,
            blockedResult,
            deadlockResult,
            recoveryResult,
        ] = await Promise.all([

            // ── Replica lag (from primary) ──
            query(`
                SELECT
                    application_name,
                    client_addr::text AS client_addr,
                    state,
                    sync_state,
                    EXTRACT(EPOCH FROM write_lag)  * 1000 AS write_lag_ms,
                    EXTRACT(EPOCH FROM flush_lag)  * 1000 AS flush_lag_ms,
                    EXTRACT(EPOCH FROM replay_lag) * 1000 AS replay_lag_ms,
                    pg_wal_lsn_diff(sent_lsn, replay_lsn) AS byte_lag
                FROM pg_stat_replication
                ORDER BY application_name
            `),

            // ── Lock contention ──
            query(`
                SELECT
                    mode,
                    granted,
                    COUNT(*) AS cnt
                FROM pg_locks
                WHERE relation IS NOT NULL
                GROUP BY mode, granted
                ORDER BY cnt DESC
            `),

            // ── Blocked queries ──
            query(`
                SELECT COUNT(*) AS blocked_count
                FROM pg_stat_activity
                WHERE wait_event_type = 'Lock'
                  AND state = 'active'
            `),

            // ── Deadlocks in current DB ──
            query(`
                SELECT deadlocks
                FROM pg_stat_database
                WHERE datname = current_database()
            `),

            // ── Is this a standby? ──
            query(`SELECT pg_is_in_recovery() AS is_replica`),
        ]);

        const isReplica    = recoveryResult.rows[0]?.is_replica ?? false;
        const replicas     = replicaResult.rows;
        const blockedCount = Number(blockedResult.rows[0]?.blocked_count || 0);
        const deadlocks    = Number(deadlockResult.rows[0]?.deadlocks    || 0);

        // Determine overall lock contention level
        const waitingLocks = lockResult.rows
            .filter(r => !r.granted)
            .reduce((sum, r) => sum + Number(r.cnt), 0);

        const lockContention =
            waitingLocks === 0  ? 'None'     :
                waitingLocks <= 3   ? 'Low'      :
                    waitingLocks <= 10  ? 'Elevated' : 'High';

        res.json({
            isReplica,

            primary: isReplica ? null : {
                name  : 'primary-1',
                lagMs : 0,
                state : 'streaming',
            },

            replicas: replicas.map(r => ({
                name       : r.application_name,
                clientAddr : r.client_addr,
                state      : r.state,
                syncState  : r.sync_state,
                writeLagMs : Math.round(Number(r.write_lag_ms  || 0)),
                flushLagMs : Math.round(Number(r.flush_lag_ms  || 0)),
                replayLagMs: Math.round(Number(r.replay_lag_ms || 0)),
                // UI uses replayLagMs as the primary "lagMs"
                lagMs      : Math.round(Number(r.replay_lag_ms || 0)),
                byteLag    : Number(r.byte_lag || 0),
            })),

            blockedQueries : blockedCount,
            lockContention,
            waitingLocks,
            deadlocks5m    : deadlocks,   // cumulative — reset on pg restart

            lockBreakdown  : lockResult.rows.map(r => ({
                mode   : r.mode,
                granted: r.granted,
                count  : Number(r.cnt),
            })),
        });
    } catch (err) {
        next(err);
    }
});

export default router;