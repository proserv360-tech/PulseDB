// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
// ==========================================================================
//  FATHOM — Doctor  (scripts/doctor.js)
//
//  Post-deploy smoke check. Verifies that the environment required for the
//  backend to serve write traffic is in place. Safe to run from CI: exits 0
//  on a clean bill of health, non-zero on any blocker, with a human-readable
//  table and actionable hints.
//
//    npm run doctor --workspace=backend
//    node backend/scripts/doctor.js
// ==========================================================================
import 'dotenv/config';
import { Pool } from 'pg';
import {
    runSystemDiagnostics,
    DiagnosticCodes,
    hasDatabaseConfig,
} from '../services/systemDiagnostics.js';

const OK_MARK   = '[ OK ]';
const FAIL_MARK = '[FAIL]';
const WARN_MARK = '[WARN]';

function formatRow(label, verdict, code, hint) {
    const padded = (label + '                              ').slice(0, 30);
    const line   = `${verdict}  ${padded}  ${code}`;
    return hint ? `${line}\n         hint: ${hint}` : line;
}

async function main() {
    console.log('');
    console.log('FATHOM doctor — checking configuration…');
    console.log('-'.repeat(72));

    // pg natively reads either DATABASE_URL or the discrete PG* vars. Build
    // the pool accordingly so the doctor matches what the server actually uses.
    let pool = null;
    let dbSource = null;
    if (process.env.DATABASE_URL) {
        pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
        dbSource = 'DATABASE_URL';
    } else if (hasDatabaseConfig()) {
        // Pool() with no args picks up PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD.
        pool = new Pool({ connectionTimeoutMillis: 5000 });
        dbSource = 'PG* vars';
    }

    const report = await runSystemDiagnostics({ pool });

    // Encryption
    console.log(formatRow(
        'ENCRYPTION_KEY',
        report.encryption.ok ? OK_MARK : FAIL_MARK,
        report.encryption.code,
        report.encryption.ok ? undefined : report.encryption.hint,
    ));

    // DB + schema
    if (!pool) {
        console.log(formatRow(
            'Database config',
            FAIL_MARK,
            DiagnosticCodes.DB_NOT_CONFIGURED,
            'Set either DATABASE_URL, or all of PGHOST / PGDATABASE / PGUSER / PGPASSWORD.',
        ));
    } else {
        console.log(formatRow(
            `Database config (${dbSource})`,
            report.schema.code !== DiagnosticCodes.DB_UNREACHABLE ? OK_MARK : FAIL_MARK,
            report.schema.code === DiagnosticCodes.DB_UNREACHABLE ? DiagnosticCodes.DB_UNREACHABLE : DiagnosticCodes.OK,
            report.schema.code === DiagnosticCodes.DB_UNREACHABLE ? report.schema.hint : undefined,
        ));
        console.log(formatRow(
            'Control-plane schema',
            report.schema.ok ? OK_MARK : FAIL_MARK,
            report.schema.ok ? 'OK' : report.schema.code,
            (report.schema.missing && report.schema.missing.length)
                ? `missing: ${report.schema.missing.join(', ')} — run \`npm run migrate --workspace=backend\``
                : undefined,
        ));
    }

    // JWT sanity — not strictly a blocker, but flag common mistakes
    if (!process.env.JWT_SECRET) {
        console.log(formatRow('JWT_SECRET', WARN_MARK, 'NOT_SET',
            'Set JWT_SECRET to a random 32+ char value for session signing.'));
    } else if (process.env.JWT_SECRET.length < 32) {
        console.log(formatRow('JWT_SECRET', WARN_MARK, 'WEAK',
            'JWT_SECRET should be >=32 chars of entropy.'));
    } else {
        console.log(formatRow('JWT_SECRET', OK_MARK, 'OK'));
    }

    console.log('-'.repeat(72));

    const clean = report.ok && pool && process.env.JWT_SECRET;
    if (clean) {
        console.log('All checks passed. Backend should start cleanly.');
        console.log('');
        if (pool) await pool.end().catch(() => undefined);
        process.exit(0);
    }

    const blockerCount = report.blockers.length + (pool ? 0 : 1);
    console.log(`${blockerCount} blocker(s) — fix the items above and re-run \`npm run doctor\`.`);
    console.log('');
    if (pool) await pool.end().catch(() => undefined);
    process.exit(clean ? 0 : 1);
}

main().catch(err => {
    console.error('doctor failed unexpectedly:', err.stack || err.message);
    process.exit(2);
});
