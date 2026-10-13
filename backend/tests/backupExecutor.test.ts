/**
 * tests/backupExecutor.test.ts — backup orchestration unit tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDue, restoreCommandFor, runDueBackups } from '../services/backupExecutor.js';

test('isDue: never-run schedule is due', () => {
    assert.equal(isDue({ cadence: 'daily', last_run_at: null }), true);
});

test('isDue: respects cadence windows', () => {
    const now = new Date('2026-06-10T12:00:00Z');
    assert.equal(isDue({ cadence: 'hourly', last_run_at: '2026-06-10T10:30:00Z' }, now), true);
    assert.equal(isDue({ cadence: 'hourly', last_run_at: '2026-06-10T11:30:00Z' }, now), false);
    assert.equal(isDue({ cadence: 'daily', last_run_at: '2026-06-09T11:00:00Z' }, now), true);
    assert.equal(isDue({ cadence: 'daily', last_run_at: '2026-06-10T01:00:00Z' }, now), false);
    assert.equal(isDue({ cadence: 'weekly', last_run_at: '2026-06-05T12:00:00Z' }, now), false);
});

test('isDue: disabled schedules and unknown cadences are never due', () => {
    assert.equal(isDue({ cadence: 'daily', last_run_at: null, enabled: false }), false);
    assert.equal(isDue({ cadence: 'fortnightly', last_run_at: null }), false);
});

test('restoreCommandFor builds a pg_restore command, never executes', () => {
    const cmd = restoreCommandFor(
        { artifact_uri: '/backups/app-schedule1.dump' },
        { host: 'db.example.com', port: 5433, username: 'admin', database: 'app' },
    );
    assert.ok(cmd!.startsWith('pg_restore --clean --if-exists --no-owner'));
    assert.ok(cmd!.includes('--host=db.example.com'));
    assert.ok(cmd!.includes('--dbname=app'));
    assert.equal(restoreCommandFor({ artifact_uri: null }), null);
});

test('runDueBackups is inert when PULSEDB_BACKUPS_ENABLED != 1', async () => {
    delete process.env.PULSEDB_BACKUPS_ENABLED;
    const out = await runDueBackups({
        schedules: [{ id: 1, cadence: 'daily', last_run_at: null }],
        resolveConn: async () => ({}),
    });
    assert.equal(out.skipped, 'disabled');
});

test('dumpCommandFor selects the right tool per engine', async () => {
    const { dumpCommandFor } = await import('../services/backupExecutor.js');
    const base = { host: 'h', port: null, database: 'app', username: 'u', password: 'p' };
    assert.equal(dumpCommandFor({ ...base, dbType: 'postgresql' }, '/a.dump').tool, 'pg_dump');
    const my = dumpCommandFor({ ...base, dbType: 'mysql' }, '/a.sql');
    assert.equal(my.tool, 'mysqldump');
    assert.equal(my.env.MYSQL_PWD, 'p');
    const mo = dumpCommandFor({ ...base, dbType: 'mongodb' }, '/a.archive');
    assert.equal(mo.tool, 'mongodump');
    assert.ok(mo.args[0].includes('mongodb://u:p@h:27017/app'));
});

test('restoreCommandFor matches engine', async () => {
    const { restoreCommandFor } = await import('../services/backupExecutor.js');
    assert.ok(
        restoreCommandFor({ artifact_uri: '/x' }, { dbType: 'mysql', host: 'h', database: 'app' })!.startsWith(
            'mysql ',
        ),
    );
    assert.ok(restoreCommandFor({ artifact_uri: '/x' }, { dbType: 'mongodb', host: 'h' })!.startsWith('mongorestore'));
});
