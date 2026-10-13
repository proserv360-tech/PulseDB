// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/userService.js
 * ───────────────────────
 * Every database operation for pgmonitoringtool.users.
 * Route handlers import these — no raw SQL lives in routes.
 */

import bcrypt from 'bcryptjs';

const S = 'pgmonitoringtool';

/* ─── Row normaliser ───────────────────────────────────────────────────────── */
function toClient(row) {
    if (!row) return null;
    return {
        id:             row.id,
        username:       row.username,
        name:           row.name,
        email:          row.email,
        role:           row.role,
        accessLevel:    row.access_level,
        allowedScreens: row.allowed_screens  ?? [],
        dataAccess:     row.data_access,
        department:     row.department       ?? null,
        location:       row.location         ?? null,
        mfa:            row.mfa_enabled,
        apiAccess:      row.api_access,
        status:         row.status,
        createdAt:      row.created_at,
        updatedAt:      row.updated_at,
        lastLoginAt:    row.last_login_at    ?? null,
        loginActivity:  row.login_activity   ?? [],
        failedLogins:   Number(row.failed_logins  ?? 0),
        riskScore:      Number(row.risk_score     ?? 0),
        sessions:       Number(row.session_count  ?? 0),
    };
}

function accessLevelFor(role) {
    return ['super_admin', 'admin'].includes(role) ? 'write' : 'read';
}

/* ─── READ ─────────────────────────────────────────────────────────────────── */

/**
 * Full user list enriched with 28-day login activity, failed-login count,
 * computed risk score and active session count — everything the UI needs.
 */
export async function listUsers(pool) {
    const { rows } = await pool.query(`
        SELECT
            u.*,
            COALESCE((
                SELECT json_agg(login_count ORDER BY day ASC)
                FROM   ${S}.user_login_activity
                WHERE  user_id = u.id
                  AND  day >= CURRENT_DATE - INTERVAL '27 days'
            ), '[]'::json) AS login_activity,

            COALESCE((
                SELECT SUM(failed_count)
                FROM   ${S}.user_login_activity
                WHERE  user_id = u.id
                  AND  day >= CURRENT_DATE - INTERVAL '30 days'
            ), 0) AS failed_logins,

            (
                SELECT COUNT(*)
                FROM   ${S}.user_sessions
                WHERE  user_id   = u.id
                  AND  is_active = TRUE
                  AND  expires_at > NOW()
            ) AS session_count

        FROM ${S}.users u
        WHERE u.deleted_at IS NULL
        ORDER BY u.created_at ASC
    `);

    return rows.map(row => {
        const daysSince = row.last_login_at
            ? (Date.now() - new Date(row.last_login_at).getTime()) / 86_400_000
            : 30;
        row.risk_score = Math.min(100, Number(row.failed_logins) * 7 + (daysSince > 14 ? 20 : 0));
        return toClient(row);
    });
}

/** Fetch one user with password_hash — for internal auth only, never send to client. */
export async function getUserById(pool, id) {
    const { rows } = await pool.query(
        `SELECT * FROM ${S}.users WHERE id = $1 AND deleted_at IS NULL`, [id]
    );
    return rows[0] ?? null;
}

export async function getUserByUsername(pool, username) {
    const { rows } = await pool.query(
        `SELECT * FROM ${S}.users WHERE username = $1 AND deleted_at IS NULL`, [username]
    );
    return rows[0] ?? null;
}

/* ─── CREATE ───────────────────────────────────────────────────────────────── */

export async function createUser(pool, data) {
    const {
        username, password, name, email, role,
        allowedScreens = [], status = 'active',
        department = null, location = null,
        mfa = true, apiAccess = false, dataAccess = 'internal',
    } = data;

    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
        `INSERT INTO ${S}.users
            (username, password_hash, name, email, role, access_level,
             allowed_screens, data_access, department, location,
             mfa_enabled, api_access, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING *`,
        [username, passwordHash, name, email, role, accessLevelFor(role),
            allowedScreens, dataAccess, department, location, mfa, apiAccess, status]
    );
    return toClient(rows[0]);
}

/* ─── UPDATE ───────────────────────────────────────────────────────────────── */

export async function updateUser(pool, id, data) {
    const existing = await getUserById(pool, id);
    if (!existing) return null;

    /* Build SET clause dynamically — only touch columns that were provided.
       This avoids the COALESCE pattern which can mask issues when the pg
       driver sends values that PostgreSQL treats as NULL.                     */
    const role = data.role ?? existing.role;
    const sets  = [];
    const vals  = [];

    function add(col, val) {
        if (val !== undefined) { vals.push(val); sets.push(`${col} = $${vals.length}`); }
    }

    add('name',            data.name);
    add('email',           data.email);
    // role & access_level always get set (either from data or existing)
    vals.push(role);              sets.push(`role = $${vals.length}`);
    vals.push(accessLevelFor(role)); sets.push(`access_level = $${vals.length}`);
    add('allowed_screens', data.allowedScreens);
    add('status',          data.status);
    add('department',      data.department);
    add('location',        data.location);
    add('mfa_enabled',     data.mfa ?? data.mfaEnabled);
    add('api_access',      data.apiAccess);
    add('data_access',     data.dataAccess);
    sets.push('updated_at = NOW()');

    vals.push(id);
    const idIdx = vals.length;

    const sql = `UPDATE ${S}.users SET ${sets.join(', ')}
                 WHERE id = $${idIdx} AND deleted_at IS NULL
                 RETURNING *`;

    const { rows } = await pool.query(sql, vals);
    return rows[0] ? toClient(rows[0]) : null;
}

/* ─── DELETE ───────────────────────────────────────────────────────────────────
 * These are HARD deletes: the row is removed, not flagged.
 *
 * Previously this set `deleted_at` and left the row in place. That conflicted
 * with `users_username_key UNIQUE (username)`, which does not exclude deleted
 * rows — so usernameExists() (which filters on deleted_at IS NULL) reported a
 * deleted user's name as free, the route skipped its 409, and the INSERT then
 * failed on the unique constraint as an unhandled 23505 → HTTP 500. Recreating
 * a just-deleted user failed every time.
 *
 * Consequence to be aware of: every foreign key referencing users on this
 * database is ON DELETE CASCADE, so removing a user also removes their
 * sessions, login activity and API keys. Audit rows survive — audit_log.actor_id
 * carries no foreign key — but they will point at an id that no longer resolves
 * to a user. `actor_username` is denormalised onto each audit row precisely so
 * the trail stays readable after the account is gone.
 * ──────────────────────────────────────────────────────────────────────────── */

export async function deleteUser(pool, id) {
    const { rowCount } = await pool.query(
        `DELETE FROM ${S}.users WHERE id = $1`, [id]
    );
    return rowCount > 0;
}

export async function bulkDeleteUsers(pool, ids) {
    // id 1 is the system administrator and is never deletable.
    const safe = [...new Set(ids)].filter(id => id !== 1);
    if (!safe.length) return 0;
    const { rowCount } = await pool.query(
        `DELETE FROM ${S}.users WHERE id = ANY($1::int[])`, [safe]
    );
    return rowCount;
}

/* ─── PASSWORD ─────────────────────────────────────────────────────────────── */

export async function resetUserPassword(pool, id, newPassword) {
    const hash = await bcrypt.hash(newPassword, 12);
    const { rowCount } = await pool.query(
        `UPDATE ${S}.users SET password_hash = $1 WHERE id = $2 AND deleted_at IS NULL`,
        [hash, id]
    );
    return rowCount > 0;
}

/* ─── LAST LOGIN ───────────────────────────────────────────────────────────── */

export async function touchLastLogin(pool, id) {
    await pool.query(`UPDATE ${S}.users SET last_login_at = NOW() WHERE id = $1`, [id]);
}

/* ─── UNIQUENESS GUARDS ────────────────────────────────────────────────────── */

export async function usernameExists(pool, username, excludeId = null) {
    const { rows } = await pool.query(
        `SELECT 1 FROM ${S}.users
         WHERE username = $1 AND deleted_at IS NULL
           AND ($2::int IS NULL OR id <> $2)`,
        [username, excludeId]
    );
    return rows.length > 0;
}

export async function emailExists(pool, email, excludeId = null) {
    const { rows } = await pool.query(
        `SELECT 1 FROM ${S}.users
         WHERE email = $1 AND deleted_at IS NULL
           AND ($2::int IS NULL OR id <> $2)`,
        [email, excludeId]
    );
    return rows.length > 0;
}