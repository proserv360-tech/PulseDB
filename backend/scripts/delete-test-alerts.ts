/**
 * delete-test-alerts.ts — remove the alerts and incidents created by
 * `npm run alert:test --commit`.
 *
 *   Preview (default — nothing is deleted):
 *     npm run alert:clean
 *
 *   Actually delete:
 *     npm run alert:clean -- --commit
 *
 *   Options:
 *     --db <name>     database name that marks test rows (default: TestDB)
 *     --before <iso>  only rows older than this timestamp
 *     --incidents     incidents only, leave the alert rows
 *     --alerts        alert rows only, leave the incidents
 *     --commit        perform the delete
 *
 * Why not a plain DELETE: `alert:test --cleanup` only removes what that one run
 * wrote, and only the incidents — the rows in `alerts` are left behind by
 * design. Anything committed in an earlier run has to be found again, and the
 * obvious predicate (`severity = 'critical'`) would take real alerts with it.
 *
 * The discriminator used here is the database name. `alert:test` synthesises a
 * metrics snapshot for `process.env.PGDATABASE || 'TestDB'`, and that value is
 * written to `incidents.database_name` and to `alerts.data->>'database'`. Real
 * alerts from the monitoring loop carry the name of a real connection.
 *
 *   ⚠ If you actually monitor a database called TestDB, pass --db with
 *   something else or this will delete real rows. The preview exists so that
 *   is visible before anything happens.
 *
 * Deleting an incident cascades to `incident_audit_trail` (ON DELETE CASCADE),
 * so the acknowledgement history goes with it. That is intended for test data
 * and worth knowing before pointing this at anything else.
 */

import 'dotenv/config';
import { pool } from '../db.js';

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', B = '\x1b[1m', O = '\x1b[0m';

function arg(name: string): string | undefined {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const DB = arg('db') || process.env.PGDATABASE || 'TestDB';
const BEFORE = arg('before') || null;
const COMMIT = has('commit');
const ONLY_INCIDENTS = has('incidents');
const ONLY_ALERTS = has('alerts');
const DO_INCIDENTS = !ONLY_ALERTS;
const DO_ALERTS = !ONLY_INCIDENTS;

async function main() {
    console.log(`\n${B}Test data cleanup${O}`);
    console.log(`${D}  marker    database = ${DB}${O}`);
    if (BEFORE) console.log(`${D}  before    ${BEFORE}${O}`);
    console.log(`${D}  mode      ${COMMIT ? `${R}DELETE${O}` : `${G}preview only${O}`}${D}${O}\n`);

    let incidents: any[] = [];
    let alerts: any[] = [];

    if (DO_INCIDENTS) {
        const { rows } = await pool.query(
            `SELECT id, object_name, status, acknowledged_by, created_at
               FROM pgmonitoringtool.incidents
              WHERE database_name = $1
                AND ($2::timestamptz IS NULL OR created_at < $2::timestamptz)
              ORDER BY created_at`,
            [DB, BEFORE],
        );
        incidents = rows;
        console.log(`${B}Incidents (${rows.length})${O}`);
        for (const r of rows) {
            console.log(
                `  ${r.id}  ${String(r.object_name).padEnd(16)} ${String(r.status).padEnd(14)} ` +
                    `${D}${new Date(r.created_at).toISOString()}${O}` +
                    (r.acknowledged_by ? `  ack by ${r.acknowledged_by}` : ''),
            );
        }
        if (!rows.length) console.log(`${D}  none${O}`);
    }

    if (DO_ALERTS) {
        const { rows } = await pool.query(
            `SELECT id, severity, category, left(message, 50) AS message, timestamp
               FROM pgmonitoringtool.alerts
              WHERE (data->>'database' = $1 OR data->'structured'->>'database' = $1)
                AND ($2::timestamptz IS NULL OR timestamp < $2::timestamptz)
              ORDER BY timestamp`,
            [DB, BEFORE],
        );
        alerts = rows;
        console.log(`\n${B}Alerts (${rows.length})${O}`);
        for (const r of rows) {
            console.log(
                `  ${r.id}  ${String(r.severity).padEnd(9)} ${String(r.category).padEnd(13)} ` +
                    `${D}${new Date(r.timestamp).toISOString()}${O}`,
            );
        }
        if (!rows.length) console.log(`${D}  none${O}`);
    }

    const total = incidents.length + alerts.length;
    if (total === 0) {
        console.log(`\n${G}Nothing matches — already clean.${O}\n`);
        return;
    }

    if (!COMMIT) {
        console.log(
            `\n${Y}Preview only — nothing deleted.${O}\n` +
                `${D}  Re-run with --commit to delete these ${total} row(s).${O}\n` +
                `${D}  Deleting an incident also removes its audit trail (ON DELETE CASCADE).${O}\n`,
        );
        return;
    }

    // One transaction: a partial delete would leave alerts pointing at
    // incidents that no longer exist, which reads as data corruption rather
    // than an interrupted cleanup.
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let deletedIncidents = 0;
        let deletedAlerts = 0;

        if (incidents.length) {
            const r = await client.query(
                `DELETE FROM pgmonitoringtool.incidents WHERE id = ANY($1::text[])`,
                [incidents.map((i) => i.id)],
            );
            deletedIncidents = r.rowCount ?? 0;
        }
        if (alerts.length) {
            const r = await client.query(
                `DELETE FROM pgmonitoringtool.alerts WHERE id = ANY($1::text[])`,
                [alerts.map((a) => a.id)],
            );
            deletedAlerts = r.rowCount ?? 0;
        }

        await client.query('COMMIT');
        console.log(
            `\n${G}✔ deleted ${deletedIncidents} incident(s) and ${deletedAlerts} alert(s)${O}\n`,
        );
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

main()
    .then(() => pool.end())
    .catch(async (err) => {
        console.error(`\n${R}✖ ${err.message}${O}\n`);
        await pool.end();
        process.exit(1);
    });
