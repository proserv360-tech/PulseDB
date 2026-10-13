// @ts-nocheck — new script 2026-06 (see docs/TS_MIGRATION.md)
/**
 * scripts/seed-demo-users.js
 * ──────────────────────────
 * Creates the public demo accounts used by "Try the live demo" on the login
 * page: demo_user1 … demo_user5, all with password "Testing123!".
 *
 * Idempotent — re-running skips users that already exist. Pass FORCE_RESET=true
 * to reset existing demo users' password back to the default.
 *
 * Run:  npm run seed:demo --workspace=backend
 *       FORCE_RESET=true npm run seed:demo --workspace=backend
 */

import 'dotenv/config';
import { pool } from '../db.js';
import { createUser, usernameExists, getUserByUsername, resetUserPassword } from '../services/userService.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || 'Testing123!';
const COUNT = 5;
const FORCE_RESET = String(process.env.FORCE_RESET || '').toLowerCase() === 'true';
const S = 'pgmonitoringtool';

/**
 * Best-effort: if the users table has must_change_password / password_changed_at
 * columns, mark demo accounts as not-needing a password change so they log
 * straight into the workspace. Safe no-op if the columns don't exist.
 */
async function clearPwChangeFlag(username) {
    const stmts = [
        `UPDATE ${S}.users SET must_change_password = FALSE WHERE username = $1`,
        `UPDATE ${S}.users SET password_changed_at = NOW() WHERE username = $1`,
    ];
    for (const sql of stmts) {
        try {
            await pool.query(sql, [username]);
        } catch {
            /* column may not exist */
        }
    }
}

async function main() {
    let created = 0,
        skipped = 0,
        reset = 0;

    for (let i = 1; i <= COUNT; i++) {
        const username = `demo_user${i}`;
        const exists = await usernameExists(pool, username);

        if (exists) {
            if (FORCE_RESET) {
                const u = await getUserByUsername(pool, username);
                if (u?.id) {
                    await resetUserPassword(pool, u.id, DEMO_PASSWORD);
                    await clearPwChangeFlag(username);
                    reset += 1;
                    console.log(`reset password   ${username}`);
                    continue;
                }
            }
            await clearPwChangeFlag(username); // ensure existing demo users don't get forced to reset
            skipped += 1;
            console.log(`already exists    ${username} (skipped)`);
            continue;
        }

        await createUser(pool, {
            username,
            password: DEMO_PASSWORD,
            name: `Demo User ${i}`,
            email: `${username}@demo.fathom`,
            role: 'viewer',
            mfa: false, // demo accounts shouldn't require MFA
            dataAccess: 'internal',
            status: 'active',
        });
        await clearPwChangeFlag(username);
        created += 1;
        console.log(`created          ${username}`);
    }

    console.log(`\nDone. created=${created} reset=${reset} skipped=${skipped} (password: ${DEMO_PASSWORD})`);
    await pool.end();
}

main().catch((err) => {
    console.error('seed-demo-users failed:', err.message);
    process.exit(1);
});
