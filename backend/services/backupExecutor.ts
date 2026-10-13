/**
 * services/backupExecutor.ts
 * ──────────────────────────
 * Backup orchestration v1 (gap-analysis P0-3) — completes the B8 scaffold.
 *
 * Logical Postgres backups via pg_dump (custom format, compressed), stored
 * under FATHOM_BACKUP_DIR (default ./backups). Schedules and run history
 * come from backupService (pgmonitoringtool.backup_schedules / backup_runs);
 * this module adds the execution layer:
 *
 *   pgDumpAvailable()                    — tool present on this host?
 *   isDue(schedule, now)                 — pure; cadence check
 *   runBackup({ conn, schedule })        — one pg_dump run + history row
 *   runDueBackups({ schedules, resolveConn }) — sweep for worker/cron
 *   restoreCommandFor(run, conn)         — pg_restore command generation
 *
 * Stays inert unless FATHOM_BACKUPS_ENABLED=1 (same flag as the scaffold).
 * MySQL/Mongo executors can register later via the same interface.
 */

import { spawn } from 'node:child_process';
import { mkdir, stat, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { isEnabled, recordRun as _recordRun } from './backupService.js';

// backupService is still checkJS-era JS; its default-null params infer as
// `null | undefined`. Wrap with an honest signature until it's typed.
const recordRun = _recordRun as (args: {
    scheduleId: number | string;
    status: string;
    artifactUri?: string | null;
    sizeBytes?: number | null;
    error?: string | null;
}) => Promise<void>;
import { log } from './logger.js';
import { swallow } from './errorHandling.js';

const BACKUP_DIR = process.env.FATHOM_BACKUP_DIR || path.resolve(process.cwd(), 'backups');
// Keep this many most-recent artifacts per schedule (audit 2026-06-10, LOW-2:
// unbounded disk growth). Override with FATHOM_BACKUP_KEEP.
const BACKUP_KEEP = Math.max(1, Number(process.env.FATHOM_BACKUP_KEEP) || 7);

const CADENCE_MS: Record<string, number> = {
    hourly: 60 * 60 * 1000,
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
};

export function toolAvailable(tool: string): Promise<boolean> {
    return new Promise((resolve) => {
        const p = spawn(tool, ['--version'], { stdio: 'ignore' });
        p.on('error', () => resolve(false));
        p.on('exit', (code) => resolve(code === 0));
    });
}
export const pgDumpAvailable = () => toolAvailable('pg_dump');

/** Dump tool + args + env per engine. conn: {dbType, host, port, database, username, password, ssl}. */
export function dumpCommandFor(
    conn: any,
    artifact: string,
): { tool: string; args: string[]; env: Record<string, string> } {
    const dbType = String(conn.dbType || conn.db_type || 'postgresql').toLowerCase();
    if (dbType === 'mysql' || dbType === 'mariadb') {
        return {
            tool: 'mysqldump',
            args: [
                `--host=${conn.host}`,
                `--port=${String(conn.port || 3306)}`,
                `--user=${conn.username || conn.user}`,
                '--single-transaction',
                '--routines',
                `--result-file=${artifact}`,
                conn.database,
            ],
            env: { MYSQL_PWD: String(conn.password ?? '') },
        };
    }
    if (dbType === 'mongodb') {
        const auth = conn.username
            ? `${encodeURIComponent(conn.username)}:${encodeURIComponent(conn.password ?? '')}@`
            : '';
        return {
            tool: 'mongodump',
            args: [
                `--uri=mongodb://${auth}${conn.host}:${String(conn.port || 27017)}/${conn.database}`,
                `--archive=${artifact}`,
                '--gzip',
            ],
            env: {},
        };
    }
    return {
        tool: 'pg_dump',
        args: [
            '--format=custom',
            '--compress=6',
            '--no-password',
            `--file=${artifact}`,
            `--host=${conn.host}`,
            `--port=${String(conn.port || 5432)}`,
            `--username=${conn.username || conn.user}`,
            conn.database,
        ],
        env: {
            PGPASSWORD: String(conn.password ?? ''),
            ...(conn.ssl ? { PGSSLMODE: 'require' } : {}),
        },
    };
}

/** Pure cadence check: due when never run, or last run older than the cadence. */
export function isDue(
    schedule: { cadence: string; last_run_at?: string | Date | null; enabled?: boolean },
    now: Date = new Date(),
): boolean {
    if (schedule.enabled === false) return false;
    const interval = CADENCE_MS[schedule.cadence];
    if (!interval) return false;
    if (!schedule.last_run_at) return true;
    const last = new Date(schedule.last_run_at).getTime();
    return now.getTime() - last >= interval;
}

function artifactNameFor(conn: { database?: string }, scheduleId: number | string, now: Date): string {
    const db = String(conn.database || 'db').replace(/[^\w-]/g, '_');
    const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `${db}-schedule${scheduleId}-${stamp}.dump`;
}

/**
 * Run one pg_dump for `conn` (shape: { host, port, database, username,
 * password, ssl }). Records a run row either way; returns the outcome.
 */
export async function runBackup({ conn, schedule }: any) {
    if (!isEnabled()) return { status: 'skipped', reason: 'FATHOM_BACKUPS_ENABLED != 1' };

    await mkdir(BACKUP_DIR, { recursive: true });
    const started = new Date();
    const artifact = path.join(BACKUP_DIR, artifactNameFor(conn, schedule.id, started));
    const cmd = dumpCommandFor(conn, artifact);

    if (!(await toolAvailable(cmd.tool))) {
        await recordRun({ scheduleId: schedule.id, status: 'failed', error: `${cmd.tool} not found on host` });
        return { status: 'failed', error: `${cmd.tool} not found on host` };
    }
    const args = cmd.args;
    const env = { ...process.env, ...cmd.env };

    const outcome: { status: string; error?: string; sizeBytes?: number; artifact?: string } = await new Promise(
        (resolve) => {
            let stderr = '';
            const p = spawn(cmd.tool, args, { env, stdio: ['ignore', 'ignore', 'pipe'] });
            p.stderr.on('data', (d) => {
                stderr += d.toString();
            });
            p.on('error', (e) => resolve({ status: 'failed', error: e.message }));
            p.on('exit', (code) =>
                code === 0
                    ? resolve({ status: 'succeeded', artifact })
                    : resolve({ status: 'failed', error: stderr.slice(-2000) || `${cmd.tool} exited ${code}` }),
            );
        },
    );

    if (outcome.status === 'succeeded') {
        try {
            outcome.sizeBytes = (await stat(artifact)).size;
        } catch {
            /* best effort */
        }
        await pruneOldArtifacts(schedule.id);
    }
    await recordRun({
        scheduleId: schedule.id,
        status: outcome.status,
        artifactUri: outcome.artifact ?? null,
        sizeBytes: outcome.sizeBytes ?? null,
        error: outcome.error ?? null,
    });
    log(outcome.status === 'succeeded' ? 'INFO' : 'WARN', `backup ${outcome.status} for schedule ${schedule.id}`, {
        artifact: outcome.artifact,
        error: outcome.error,
    });
    return outcome;
}

/**
 * Delete all but the newest BACKUP_KEEP artifacts for a schedule. Best-effort:
 * filesystem errors are swallowed so a prune failure never fails the backup.
 */
export async function pruneOldArtifacts(scheduleId: number | string): Promise<number> {
    try {
        const prefix = `-schedule${scheduleId}-`;
        const files = (await readdir(BACKUP_DIR))
            .filter((f) => f.includes(prefix))
            .sort()
            .reverse(); // names are timestamp-suffixed, so lexical desc = newest first
        const stale = files.slice(BACKUP_KEEP);
        let removed = 0;
        for (const f of stale) {
            try {
                await unlink(path.join(BACKUP_DIR, f));
                removed += 1;
            } catch {
                /* ignore */
            }
        }
        return removed;
    } catch {
        return 0;
    }
}

/** Sweep all schedules; run the due ones. `resolveConn(connectionId)` maps to a conn object. */
export async function runDueBackups({ schedules, resolveConn }: any) {
    if (!isEnabled()) return { ran: 0, skipped: 'disabled' };
    let ran = 0;
    const results: any[] = [];
    for (const s of schedules || []) {
        if (!isDue(s)) continue;
        try {
            const conn = await resolveConn(s.connection_id);
            results.push({ scheduleId: s.id, ...(await runBackup({ conn, schedule: s })) });
            ran += 1;
        } catch (e: any) {
            // Double failure: the backup failed AND we could not record that it
            // failed. Swallowing this silently means a broken backup schedule
            // looks identical to one that never ran — the worst possible state
            // for a backup system to be in undetected.
            await recordRun({ scheduleId: s.id, status: 'failed', error: e.message }).catch((recErr) =>
                swallow(recErr, {
                    component: 'backup',
                    op: 'recordRun',
                    scheduleId: s.id,
                    originalError: e.message,
                }),
            );
            results.push({ scheduleId: s.id, status: 'failed', error: e.message });
        }
    }
    return { ran, results };
}

/** pg_restore command for an artifact (shown in the UI; never auto-executed). */
export function restoreCommandFor(run: { artifact_uri?: string | null }, conn: any = {}): string | null {
    if (!run?.artifact_uri) return null;
    const dbType = String(conn.dbType || conn.db_type || 'postgresql').toLowerCase();
    if (dbType === 'mysql' || dbType === 'mariadb') {
        return `mysql --host=${conn.host || 'localhost'} --port=${conn.port || 3306} --user=${conn.username || conn.user || 'root'} -p ${conn.database || ''} < "${run.artifact_uri}"`;
    }
    if (dbType === 'mongodb') {
        return `mongorestore --uri=mongodb://${conn.host || 'localhost'}:${conn.port || 27017} --archive="${run.artifact_uri}" --gzip --drop`;
    }
    const host = conn.host
        ? ` --host=${conn.host} --port=${conn.port || 5432} --username=${conn.username || conn.user || 'postgres'}`
        : '';
    return `pg_restore --clean --if-exists --no-owner${host} --dbname=${conn.database || 'postgres'} "${run.artifact_uri}"`;
}
