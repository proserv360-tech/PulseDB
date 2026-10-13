// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Extracted from server.ts.

import { authenticate } from '../../core/auth.js';
import { CONFIG } from '../../core/config.js';
import { reqPool } from '../../core/connectionPools.js';
import { cached } from '../../core/responseCache.js';
import { log } from '../../services/logger.js';

export default function registerReplicationRoutes(app) {
    // ─────────────────────────────────────────────────────────────────────────────
    // REPLICATION & WAL
    // ─────────────────────────────────────────────────────────────────────────────
    app.get('/api/replication/status', authenticate, cached('repl:status', CONFIG.CACHE_TTL.WAL), async (req, res) => {
        try {
            const _p = await reqPool(req);
            const [replicas, slots, walReceiver, walSender, walSettings] = await Promise.all([
                _p.query(`
                SELECT pid, usename, application_name, client_addr::text,
                    state, sync_state,
                       sent_lsn::text, write_lsn::text, flush_lsn::text, replay_lsn::text,
                    pg_wal_lsn_diff(sent_lsn,  write_lsn)  AS write_lag_bytes,
                       pg_wal_lsn_diff(write_lsn, flush_lsn)  AS flush_lag_bytes,
                       pg_wal_lsn_diff(flush_lsn, replay_lsn) AS replay_lag_bytes,
                       pg_wal_lsn_diff(sent_lsn,  replay_lsn) AS total_lag_bytes,
                       EXTRACT(EPOCH FROM write_lag)::int       AS write_lag_sec,
                    EXTRACT(EPOCH FROM flush_lag)::int       AS flush_lag_sec,
                    EXTRACT(EPOCH FROM replay_lag)::int      AS replay_lag_sec,
                    reply_time::text
                FROM pg_stat_replication
                ORDER BY total_lag_bytes DESC NULLS LAST
            `),
                _p.query(`
                SELECT slot_name, plugin, slot_type, database, active, active_pid,
                       pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn) AS lag_bytes,
                       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)) AS lag_pretty,
                       wal_status, safe_wal_size, two_phase
                FROM pg_replication_slots
                ORDER BY lag_bytes DESC NULLS LAST
            `),
                _p
                    .query(
                        `
                SELECT status, receive_start_lsn::text, received_tli,
                       last_msg_send_time::text, last_msg_receipt_time::text,
                    latest_end_lsn::text, latest_end_time::text,
                    sender_host, sender_port, slot_name, conninfo
                FROM pg_stat_wal_receiver
            `,
                    )
                    .catch(() => ({ rows: [] })),
                _p.query(`
                SELECT pg_current_wal_lsn()::text                    AS current_lsn,
                    pg_walfile_name(pg_current_wal_lsn())          AS current_wal,
                       pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0')  AS total_bytes_generated,
                       (SELECT count(*) FROM pg_stat_replication)      AS replica_count,
                       pg_is_in_recovery()                            AS in_recovery
            `),
                _p.query(`
                SELECT name, setting, unit
                FROM pg_settings
                WHERE name IN ('wal_level','max_wal_senders','max_replication_slots',
                               'wal_keep_size','synchronous_standby_names','wal_sender_timeout')
                ORDER BY name
            `),
            ]);
            res.json({
                replicas: replicas.rows,
                slots: slots.rows,
                walReceiver: walReceiver.rows[0] || null,
                walSender: walSender.rows[0],
                settings: walSettings.rows,
            });
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({});
        }
    });
}
