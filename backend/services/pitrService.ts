// @ts-nocheck — TODO type this module (added 2026-07; see docs/TS_MIGRATION.md)
/**
 * services/pitrService.ts
 * ───────────────────────
 * Point-in-time-recovery planning (B-2). Given a catalog of base backups and
 * archived WAL segments, this computes:
 *   - the recoverable WINDOW (earliest…latest time you can restore to), and
 *   - a RECOVERY PLAN for a target timestamp (which base backup + which WAL
 *     segments to replay), including whether the target is actually reachable.
 *
 * The planning math is pure (unit-testable). The execution of pg_basebackup /
 * WAL archiving is out of scope here — this is the catalog + planner that a
 * restore workflow (or an operator) drives. Catalog tables: base_backups,
 * wal_archive (migration 0023).
 */

import { query } from '../db.js';

// Tolerate small gaps between consecutively-archived WAL segments (clock skew,
// archive latency). A gap larger than this breaks recovery continuity.
const GAP_MS = 60_000;

const toMs = (v) => (v == null ? NaN : new Date(v).getTime());

/**
 * Pure: earliest…latest timestamp recoverable from this catalog.
 * @param {Array<{backupTime:string, status?:string}>} baseBackups
 * @param {Array<{startTime:string, endTime:string}>} walSegments
 */
export function computeRecoveryWindow(baseBackups = [], walSegments = []) {
    const bases = baseBackups
        .filter((b) => (b.status ? b.status === 'succeeded' : true))
        .map((b) => ({ ...b, t: toMs(b.backupTime) }))
        .filter((b) => !isNaN(b.t))
        .sort((a, b) => a.t - b.t);
    if (!bases.length) return { feasible: false, earliest: null, latest: null, reason: 'no base backups' };

    const wals = walSegments
        .map((w) => ({ ...w, s: toMs(w.startTime), e: toMs(w.endTime) }))
        .filter((w) => !isNaN(w.s) && !isNaN(w.e))
        .sort((a, b) => a.s - b.s);

    const earliest = bases[0].t;
    let latest = earliest;
    for (const w of wals) {
        if (w.s <= latest + GAP_MS) latest = Math.max(latest, w.e);
    }
    return { feasible: true, earliest: new Date(earliest).toISOString(), latest: new Date(latest).toISOString() };
}

/**
 * Pure: build a recovery plan for a target timestamp.
 * @param {{baseBackups:Array, walSegments:Array, targetTs:string}} args
 */
export function planRecovery({ baseBackups = [], walSegments = [], targetTs }) {
    const target = toMs(targetTs);
    if (isNaN(target)) return { feasible: false, reason: 'invalid targetTs' };

    const base = baseBackups
        .filter((b) => (b.status ? b.status === 'succeeded' : true))
        .map((b) => ({ ...b, t: toMs(b.backupTime) }))
        .filter((b) => !isNaN(b.t) && b.t <= target)
        .sort((a, b) => b.t - a.t)[0];
    if (!base)
        return {
            feasible: false,
            targetTs: new Date(target).toISOString(),
            reason: 'no base backup at or before target time',
        };

    const wals = walSegments
        .map((w) => ({ ...w, s: toMs(w.startTime), e: toMs(w.endTime) }))
        .filter((w) => !isNaN(w.s) && !isNaN(w.e))
        .sort((a, b) => a.s - b.s);
    const needed = wals.filter((w) => w.e >= base.t && w.s <= target);

    let covered = base.t;
    for (const w of needed) {
        if (w.s <= covered + GAP_MS) covered = Math.max(covered, w.e);
    }
    const feasible = covered >= target;

    return {
        feasible,
        targetTs: new Date(target).toISOString(),
        baseBackup: {
            id: base.id ?? null,
            backupTime: new Date(base.t).toISOString(),
            artifactUri: base.artifactUri ?? null,
        },
        walSegments: needed.map((w) => ({
            segment: w.segment,
            startTime: new Date(w.s).toISOString(),
            endTime: new Date(w.e).toISOString(),
        })),
        reason: feasible
            ? null
            : needed.length
              ? `WAL coverage ends at ${new Date(covered).toISOString()} — cannot reach target`
              : 'no WAL segments after the base backup',
    };
}

/* ── Catalog: writers ──────────────────────────────────────────────────────── */

export async function recordBaseBackup({
    connectionId,
    workspaceId = null,
    backupTime,
    stopLsn = null,
    artifactUri = null,
    sizeBytes = null,
    status = 'succeeded',
}) {
    if (!connectionId) throw new Error('connectionId required');
    const t = backupTime ? new Date(backupTime) : new Date();
    if (isNaN(t.getTime())) throw new Error('invalid backupTime');
    const { rows } = await query(
        `INSERT INTO pgmonitoringtool.base_backups
            (connection_id, workspace_id, backup_time, stop_lsn, artifact_uri, size_bytes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [connectionId, workspaceId, t, stopLsn, artifactUri, sizeBytes, status],
    );
    return rows[0];
}

export async function recordWalSegment({
    connectionId,
    segment,
    startLsn = null,
    endLsn = null,
    startTime,
    endTime,
    sizeBytes = null,
}) {
    if (!connectionId) throw new Error('connectionId required');
    if (!segment) throw new Error('segment required');
    const s = new Date(startTime),
        e = new Date(endTime);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) throw new Error('invalid segment time range');
    const { rows } = await query(
        `INSERT INTO pgmonitoringtool.wal_archive
            (connection_id, segment, start_lsn, end_lsn, start_time, end_time, size_bytes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (connection_id, segment) DO UPDATE
            SET start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time,
                start_lsn = EXCLUDED.start_lsn, end_lsn = EXCLUDED.end_lsn, size_bytes = EXCLUDED.size_bytes
         RETURNING id`,
        [connectionId, segment, startLsn, endLsn, s, e, sizeBytes],
    );
    return rows[0];
}

/* ── Catalog: readers ──────────────────────────────────────────────────────── */

async function loadCatalog(connectionId) {
    const [bb, wal] = await Promise.all([
        query(
            `SELECT id, backup_time AS "backupTime", artifact_uri AS "artifactUri", status
               FROM pgmonitoringtool.base_backups WHERE connection_id = $1 ORDER BY backup_time ASC`,
            [connectionId],
        ).catch((e) => (/relation .* does not exist/i.test(e.message) ? { rows: [] } : Promise.reject(e))),
        query(
            `SELECT segment, start_time AS "startTime", end_time AS "endTime"
               FROM pgmonitoringtool.wal_archive WHERE connection_id = $1 ORDER BY start_time ASC`,
            [connectionId],
        ).catch((e) => (/relation .* does not exist/i.test(e.message) ? { rows: [] } : Promise.reject(e))),
    ]);
    return { baseBackups: bb.rows, walSegments: wal.rows };
}

export async function getRecoveryWindow(connectionId) {
    const { baseBackups, walSegments } = await loadCatalog(connectionId);
    return {
        connectionId,
        baseBackups: baseBackups.length,
        walSegments: walSegments.length,
        ...computeRecoveryWindow(baseBackups, walSegments),
    };
}

export async function getRecoveryPlan(connectionId, targetTs) {
    const { baseBackups, walSegments } = await loadCatalog(connectionId);
    return { connectionId, ...planRecovery({ baseBackups, walSegments, targetTs }) };
}
