// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/backupRoutes.js — B8 backup orchestration scaffold.
 *
 * Even when FATHOM_BACKUPS_ENABLED=0, the read endpoints serve so the UI
 * can show "no schedules yet" instead of a 404; write endpoints return
 * 503 until the feature flag flips. Restore is always 503 — it's the most
 * destructive operation and we do not ship a half-built path for it.
 */
import { Router } from 'express';
import { isEnabled, listSchedules, createSchedule, deleteSchedule } from '../services/backupService.js';
import { resolveWorkspace, requireWorkspaceRole } from '../middleware/workspaceRbac.js';
import { getRecoveryWindow, getRecoveryPlan, recordBaseBackup, recordWalSegment } from '../services/pitrService.js';

export default function backupRoutes(pool, authenticate, resolveConn = null) {
    const router = Router();

    router.get(
        '/backups/schedules',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const rows = await listSchedules({ workspaceId: req.workspace.id });
                res.json({ enabled: isEnabled(), schedules: rows });
            } catch (err) {
                next(err);
            }
        },
    );

    router.post(
        '/backups/schedules',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res, next) => {
            if (!isEnabled())
                return res.status(503).json({
                    error: 'backups_disabled',
                    detail: 'Set FATHOM_BACKUPS_ENABLED=1 in the backend env to enable.',
                });
            try {
                const { connectionId, cadence, target, targetUri } = req.body || {};
                if (!connectionId || !cadence)
                    return res.status(400).json({ error: 'connectionId and cadence required' });
                const row = await createSchedule({
                    workspaceId: req.workspace.id,
                    connectionId,
                    cadence,
                    target,
                    targetUri,
                });
                res.status(201).json(row);
            } catch (err) {
                next(err);
            }
        },
    );

    router.delete(
        '/backups/schedules/:id',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const id = Number(req.params.id);
                if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
                const n = await deleteSchedule({ workspaceId: req.workspace.id, scheduleId: id });
                if (n === 0) return res.status(404).json({ error: 'Not found' });
                res.status(204).end();
            } catch (err) {
                next(err);
            }
        },
    );

    // ── Run a schedule's backup immediately (executor v1, P0-3) ──────────
    router.post(
        '/backups/schedules/:id/run',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res, next) => {
            if (!isEnabled())
                return res.status(503).json({
                    error: 'backups_disabled',
                    detail: 'Set FATHOM_BACKUPS_ENABLED=1 in the backend env to enable.',
                });
            if (!resolveConn) return res.status(503).json({ error: 'resolver_unavailable' });
            try {
                const id = Number(req.params.id);
                const schedules = await listSchedules({ workspaceId: req.workspace.id });
                const schedule = schedules.find((x) => Number(x.id) === id);
                if (!schedule) return res.status(404).json({ error: 'Not found' });
                const { runBackup } = await import('../services/backupExecutor.js');
                const conn = await resolveConn(schedule.connection_id);
                res.json(await runBackup({ conn, schedule }));
            } catch (err) {
                next(err);
            }
        },
    );

    // Restore is never executed automatically — the API returns the exact
    // pg_restore command for an operator to run, which is as far as a
    // monitoring control plane should go with the most destructive op.
    router.get(
        '/backups/schedules/:id/restore-command',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('owner'),
        async (req, res, next) => {
            try {
                const id = Number(req.params.id);
                const { rows } = await pool.query(
                    `SELECT r.artifact_uri FROM pgmonitoringtool.backup_runs r
                      WHERE r.schedule_id = $1 AND r.status = 'succeeded'
                      ORDER BY r.finished_at DESC LIMIT 1`,
                    [id],
                );
                if (!rows.length) return res.status(404).json({ error: 'no_successful_runs' });
                const { restoreCommandFor } = await import('../services/backupExecutor.js');
                const schedules = await listSchedules({ workspaceId: req.workspace.id });
                const schedule = schedules.find((x) => Number(x.id) === id);
                const conn = resolveConn && schedule ? await resolveConn(schedule.connection_id).catch(() => ({})) : {};
                res.json({ command: restoreCommandFor(rows[0], conn) });
            } catch (err) {
                next(err);
            }
        },
    );

    // ── PITR: recoverable window (earliest…latest restore time) ──────────────
    router.get(
        '/backups/pitr/window',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const connectionId = Number(req.query.connectionId);
                if (!connectionId) return res.status(400).json({ error: 'connectionId required' });
                res.json(await getRecoveryWindow(connectionId));
            } catch (err) {
                next(err);
            }
        },
    );

    // ── PITR: recovery plan for a target timestamp ───────────────────────────
    router.get(
        '/backups/pitr/plan',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const connectionId = Number(req.query.connectionId);
                const target = req.query.target;
                if (!connectionId || !target)
                    return res.status(400).json({ error: 'connectionId and target required' });
                res.json(await getRecoveryPlan(connectionId, String(target)));
            } catch (err) {
                next(err);
            }
        },
    );

    // ── PITR catalog writers (base backup + WAL segment) ─────────────────────
    router.post(
        '/backups/pitr/base',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const { connectionId, backupTime, stopLsn, artifactUri, sizeBytes, status } = req.body || {};
                if (!connectionId) return res.status(400).json({ error: 'connectionId required' });
                const row = await recordBaseBackup({
                    connectionId,
                    workspaceId: req.workspace.id,
                    backupTime,
                    stopLsn,
                    artifactUri,
                    sizeBytes,
                    status,
                });
                res.status(201).json({ success: true, ...row });
            } catch (err) {
                next(err);
            }
        },
    );

    router.post(
        '/backups/pitr/wal',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const { connectionId, segment, startLsn, endLsn, startTime, endTime, sizeBytes } = req.body || {};
                if (!connectionId || !segment)
                    return res.status(400).json({ error: 'connectionId and segment required' });
                const row = await recordWalSegment({
                    connectionId,
                    segment,
                    startLsn,
                    endLsn,
                    startTime,
                    endTime,
                    sizeBytes,
                });
                res.status(201).json({ success: true, ...row });
            } catch (err) {
                next(err);
            }
        },
    );

    return router;
}
