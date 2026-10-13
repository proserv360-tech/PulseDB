// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/backupService.js
 *
 * B8 — Backup orchestration scaffold.
 *
 * Execution layer is intentionally inert until PULSEDB_BACKUPS_ENABLED=1
 * and the corresponding tools (pgBackRest / mongodump) are wired into
 * the worker tier. The schema layer (schedules, runs) and the API are
 * live, so the UI can show schedules even before the orchestrator runs.
 *
 * Public surface:
 *   isEnabled()                                  → boolean
 *   listSchedules({ workspaceId })
 *   createSchedule({ workspaceId, connectionId, cadence, target, targetUri })
 *   deleteSchedule({ workspaceId, scheduleId })
 *   recordRun({ scheduleId, status, artifactUri, sizeBytes, error })
 */

import { query } from '../db.js';

export function isEnabled() {
    return process.env.PULSEDB_BACKUPS_ENABLED === '1';
}

export async function listSchedules({ workspaceId }) {
    try {
        const { rows } = await query(
            `SELECT id, connection_id, cadence, target, target_uri,
                    enabled, created_at, last_run_at
               FROM pgmonitoringtool.backup_schedules
              WHERE workspace_id = $1
              ORDER BY created_at DESC`,
            [workspaceId]
        );
        return rows;
    } catch (err) {
        if (/relation .* does not exist/i.test(err.message)) return [];
        throw err;
    }
}

export async function createSchedule({ workspaceId, connectionId, cadence, target = 's3', targetUri = null }) {
    if (!['hourly','daily','weekly'].includes(cadence)) throw new Error(`unsupported cadence: ${cadence}`);
    const { rows } = await query(
        `INSERT INTO pgmonitoringtool.backup_schedules
            (workspace_id, connection_id, cadence, target, target_uri)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (workspace_id, connection_id, cadence) DO UPDATE
            SET target = EXCLUDED.target,
                target_uri = EXCLUDED.target_uri,
                enabled = true
         RETURNING id, created_at`,
        [workspaceId, connectionId, cadence, target, targetUri]
    );
    return rows[0];
}

export async function deleteSchedule({ workspaceId, scheduleId }) {
    const r = await query(
        `DELETE FROM pgmonitoringtool.backup_schedules
          WHERE id = $1 AND workspace_id = $2`,
        [scheduleId, workspaceId]
    );
    return r.rowCount;
}

export async function recordRun({ scheduleId, status, artifactUri = null, sizeBytes = null, error = null }) {
    await query(
        `INSERT INTO pgmonitoringtool.backup_runs
            (schedule_id, status, artifact_uri, size_bytes, error, finished_at)
         VALUES ($1, $2, $3, $4, $5, CASE WHEN $2 IN ('succeeded','failed') THEN now() ELSE NULL END)`,
        [scheduleId, status, artifactUri, sizeBytes, error]
    );
    if (status === 'succeeded') {
        await query(
            `UPDATE pgmonitoringtool.backup_schedules SET last_run_at = now() WHERE id = $1`,
            [scheduleId]
        );
    }
}
