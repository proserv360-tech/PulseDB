// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
// ==========================================================================
//  FATHOM — /api/overview/backup
//
//  Two strategies (auto-detected):
//  1. If backup_history table exists → read from it  (preferred)
//  2. Fallback: read pg_stat_archiver + estimate from WAL activity
//
//  To use strategy 1, create the table (see migration at bottom of file).
// ==========================================================================

import { Router } from 'express';
import { query }  from '../../db.js';

const router = Router();

router.get('/', async (_req, res, next) => {
    try {
        // ── Check if backup_history table exists ──
        const tableCheck = await query(`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name   = 'fathom_backup_history'
            ) AS exists
        `);

        if (tableCheck.rows[0].exists) {
            return res.json(await fromBackupTable());
        }

        // ── Fallback: derive from pg_stat_archiver + WAL ──
        return res.json(await fromArchiver());

    } catch (err) {
        next(err);
    }
});

/* ── Strategy 1: custom backup_history table ── */
async function fromBackupTable() {
    const result = await query(`
        SELECT
            id,
            backup_type,
            status,
            started_at,
            finished_at,
            size_bytes,
            ROUND(size_bytes / 1073741824.0, 2) AS size_gb,
            EXTRACT(EPOCH FROM (finished_at - started_at))::int AS duration_sec,
            label,
            next_scheduled_at,
            notes
        FROM fathom_backup_history
        ORDER BY started_at DESC
        LIMIT 1
    `);

    if (!result.rows.length) {
        return { status: 'unknown', message: 'No backup records found' };
    }

    const r = result.rows[0];
    const durationSec = Number(r.duration_sec);

    return {
        id            : r.id,
        timestamp     : r.finished_at,
        sizeGB        : Number(r.size_gb),
        type          : r.backup_type,    // 'Full', 'Incremental', 'Differential'
        status        : r.status,         // 'success', 'failed', 'running'
        duration      : fmtDuration(durationSec),
        durationSec,
        label         : r.label,
        nextScheduled : r.next_scheduled_at
            ? new Date(r.next_scheduled_at).toISOString()
            : null,
        nextScheduledFormatted: r.next_scheduled_at
            ? formatUTC(new Date(r.next_scheduled_at))
            : null,
        notes         : r.notes,
    };
}

/* ── Strategy 2: fallback via pg_stat_archiver ── */
async function fromArchiver() {
    const result = await query(`
        SELECT
            archived_count,
            last_archived_wal,
            last_archived_time,
            failed_count,
            last_failed_wal,
            last_failed_time
        FROM pg_stat_archiver
    `);

    const r = result.rows[0] || {};

    // Rough size estimate: each WAL segment is typically 16 MB
    const walSize   = 16 * 1024 * 1024; // bytes per segment (default wal_segment_size)
    const archivedCount = Number(r.archived_count || 0);
    const estimatedBytes = archivedCount * walSize;

    return {
        timestamp  : r.last_archived_time || null,
        sizeGB     : Number((estimatedBytes / 1073741824).toFixed(2)),
        type       : 'WAL Archive',
        status     : Number(r.failed_count || 0) === 0 ? 'success' : 'warning',
        duration   : 'N/A',
        durationSec: null,
        nextScheduled: null,
        nextScheduledFormatted: 'Continuous',
        archivedSegments : archivedCount,
        failedSegments   : Number(r.failed_count || 0),
        lastFailedWal    : r.last_failed_wal,
        note: 'Derived from pg_stat_archiver — install fathom_backup_history for full details',
    };
}

/* ── Helpers ── */
function fmtDuration(totalSec) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
}

function formatUTC(date) {
    return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')} UTC`;
}

export default router;

/* ══════════════════════════════════════════════════════════════════════════
   MIGRATION — run this in your database to enable strategy 1:

   CREATE TABLE IF NOT EXISTS fathom_backup_history (
       id               BIGSERIAL PRIMARY KEY,
       backup_type      TEXT      NOT NULL DEFAULT 'Full',  -- Full | Incremental | Differential
       status           TEXT      NOT NULL DEFAULT 'success', -- success | failed | running
       started_at       TIMESTAMPTZ NOT NULL,
       finished_at      TIMESTAMPTZ,
       size_bytes       BIGINT    DEFAULT 0,
       label            TEXT,
       next_scheduled_at TIMESTAMPTZ,
       notes            TEXT,
       created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
   );

   -- Example insert after a successful backup:
   INSERT INTO fathom_backup_history (backup_type, status, started_at, finished_at, size_bytes, next_scheduled_at)
   VALUES ('Full', 'success', now() - interval '5 minutes', now(), 13319585792, now() + interval '1 day');

   ══════════════════════════════════════════════════════════════════════════ */