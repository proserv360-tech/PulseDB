// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Persistence for saved connections (pgmonitoringtool.pulsedb_connections) and the in-memory cache.
// Extracted from server.ts.

import { decrypt, encrypt, isEncrypted } from '../services/encryptionService.js';
import { log } from '../services/logger.js';
import { pool } from './adminPool.js';

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTIONS — persisted in the app database (pulsedb_connections table)
// Using the DB instead of a JSON file ensures data survives Vercel cold-starts,
// is scoped per-user, and is never accidentally recreated after deletion.
// ─────────────────────────────────────────────────────────────────────────────

/** Ensure the pulsedb_connections table exists (idempotent) */
export async function ensureConnectionsTable() {
    if (!pool) throw new Error('Admin database not configured');
    // 1. Guarantee the schema exists before touching any table inside it.
    await pool.query(`CREATE SCHEMA IF NOT EXISTS pgmonitoringtool`);

    // 2. Create the table with user_id as a plain INTEGER so this succeeds even
    //    when the users table hasn't been provisioned yet.  The FK is added as a
    //    separate best-effort step below so it never blocks table creation.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS pgmonitoringtool.pulsedb_connections (
            id          SERIAL      PRIMARY KEY,
            user_id     INTEGER,
            name        TEXT        NOT NULL,
            host        TEXT        NOT NULL DEFAULT '',
            port        INTEGER     NOT NULL DEFAULT 5432,
            db_name     TEXT        NOT NULL DEFAULT 'postgres',
            username    TEXT        NOT NULL DEFAULT 'postgres',
            password    TEXT        NOT NULL DEFAULT '',
            ssl         BOOLEAN     NOT NULL DEFAULT false,
            ssh_enabled BOOLEAN     NOT NULL DEFAULT false,
            ssh_host    TEXT        NOT NULL DEFAULT '',
            ssh_port    INTEGER     NOT NULL DEFAULT 22,
            ssh_user    TEXT        NOT NULL DEFAULT '',
            ssh_auth_type   TEXT    NOT NULL DEFAULT 'key',
            ssh_private_key TEXT    NOT NULL DEFAULT '',
            ssh_passphrase  TEXT    NOT NULL DEFAULT '',
            ssh_password    TEXT    NOT NULL DEFAULT '',
            is_default  BOOLEAN     NOT NULL DEFAULT false,
            status      TEXT,
            last_tested TIMESTAMPTZ,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (user_id, name)
        )
    `);

    // 3. Best-effort: attach FK to users only when that table already exists.
    //    A missing users table (fresh DB, different init order) must never
    //    prevent pulsedb_connections from being usable.
    try {
        await pool.query(`
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'pgmonitoringtool' AND table_name = 'users'
                ) AND NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE table_schema   = 'pgmonitoringtool'
                      AND table_name     = 'pulsedb_connections'
                      AND constraint_type = 'FOREIGN KEY'
                      AND constraint_name = 'pulsedb_connections_user_id_fkey'
                ) THEN
                    ALTER TABLE pgmonitoringtool.pulsedb_connections
                        ADD CONSTRAINT pulsedb_connections_user_id_fkey
                        FOREIGN KEY (user_id)
                        REFERENCES pgmonitoringtool.users(id)
                        ON DELETE CASCADE;
                END IF;
            END $$
        `);
    } catch {
        /* users table not yet available — FK will be added on next startup */
    }

    // 4. Add db_type column if it doesn't exist (backward compatibility)
    try {
        await pool.query(`
            ALTER TABLE pgmonitoringtool.pulsedb_connections
            ADD COLUMN IF NOT EXISTS db_type TEXT NOT NULL DEFAULT 'postgresql'
        `);
    } catch {
        /* Column may already exist */
    }
}

/** Convert a DB row → the shape the rest of the code (and frontend) expects */
function rowToConn(row) {
    // Decrypt sensitive fields if they are encrypted; handle backward compatibility
    let password = row.password;
    let sshPrivateKey = row.ssh_private_key;
    let sshPassphrase = row.ssh_passphrase;
    let sshPassword = row.ssh_password;

    try {
        if (password && isEncrypted(password)) {
            password = decrypt(password);
        }
        if (sshPrivateKey && isEncrypted(sshPrivateKey)) {
            sshPrivateKey = decrypt(sshPrivateKey);
        }
        if (sshPassphrase && isEncrypted(sshPassphrase)) {
            sshPassphrase = decrypt(sshPassphrase);
        }
        if (sshPassword && isEncrypted(sshPassword)) {
            sshPassword = decrypt(sshPassword);
        }
    } catch (error) {
        log('WARN', 'Decryption failed for connection, credentials need re-entry', { error: error.message });
        password = null;
        sshPrivateKey = null;
        sshPassphrase = null;
        sshPassword = null;
    }

    return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        host: row.host,
        port: row.port,
        database: row.db_name,
        username: row.username,
        password: password,
        ssl: row.ssl,
        sshEnabled: row.ssh_enabled,
        sshHost: row.ssh_host,
        sshPort: row.ssh_port,
        sshUser: row.ssh_user,
        sshAuthType: row.ssh_auth_type,
        sshPrivateKey: sshPrivateKey,
        sshPassphrase: sshPassphrase,
        sshPassword: sshPassword,
        isDefault: row.is_default,
        status: row.status,
        lastTested: row.last_tested,
        createdAt: row.created_at,
        dbType: row.db_type || 'postgresql',
    };
}

/** Load all connections for a specific user from the database.
 *  Admin / super_admin pass userId=null to load all connections.
 */
export async function dbLoadConnections(userId, role) {
    // Always scope to the user's own connections — admins see all connections
    // only through the /api/admin/connections endpoint, not in their personal pool
    const { rows } = await pool.query(
        'SELECT * FROM pgmonitoringtool.pulsedb_connections WHERE user_id = $1 ORDER BY id',
        [userId],
    );
    return rows.map(rowToConn);
}

/** Admin-only: load ALL connections across all users (for admin panel) */
async function dbLoadAllConnections() {
    const { rows } = await pool.query('SELECT * FROM pgmonitoringtool.pulsedb_connections ORDER BY id');
    return rows.map(rowToConn);
}

/** Persist a new connection; returns the saved row as a conn object */
export async function dbInsertConnection(conn) {
    // Encrypt sensitive fields before storing
    const encryptedPassword = conn.password ? encrypt(conn.password) : null;
    const encryptedSshPrivateKey = conn.sshPrivateKey && conn.sshPrivateKey.trim() ? encrypt(conn.sshPrivateKey) : '';
    const encryptedSshPassphrase = conn.sshPassphrase && conn.sshPassphrase.trim() ? encrypt(conn.sshPassphrase) : '';
    const encryptedSshPassword = conn.sshPassword && conn.sshPassword.trim() ? encrypt(conn.sshPassword) : '';

    const { rows } = await pool.query(
        `
        INSERT INTO pgmonitoringtool.pulsedb_connections
            (user_id, name, host, port, db_name, username, password, ssl,
             ssh_enabled, ssh_host, ssh_port, ssh_user, ssh_auth_type,
             ssh_private_key, ssh_passphrase, ssh_password, is_default, status, last_tested, db_type)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        RETURNING *
    `,
        [
            conn.userId ?? null,
            conn.name,
            conn.host,
            conn.port,
            conn.database,
            conn.username,
            encryptedPassword,
            conn.ssl,
            conn.sshEnabled,
            conn.sshHost,
            conn.sshPort,
            conn.sshUser,
            conn.sshAuthType,
            encryptedSshPrivateKey,
            encryptedSshPassphrase,
            encryptedSshPassword,
            conn.isDefault,
            conn.status ?? null,
            conn.lastTested ?? null,
            conn.dbType ?? 'postgresql',
        ],
    );
    return rowToConn(rows[0]);
}

/** Update mutable fields of an existing connection */
export async function dbUpdateConnection(id, fields) {
    // Encrypt sensitive fields before storing
    const encryptedPassword = fields.password ? encrypt(fields.password) : null;
    const encryptedSshPrivateKey =
        fields.sshPrivateKey && fields.sshPrivateKey.trim() ? encrypt(fields.sshPrivateKey) : null;
    const encryptedSshPassphrase =
        fields.sshPassphrase && fields.sshPassphrase.trim() ? encrypt(fields.sshPassphrase) : null;
    const encryptedSshPassword = fields.sshPassword && fields.sshPassword.trim() ? encrypt(fields.sshPassword) : null;
    // Note: null here is intentional for UPDATE — COALESCE($14, ssh_private_key) preserves existing value

    const { rows } = await pool.query(
        `
        UPDATE pgmonitoringtool.pulsedb_connections SET
            name        = COALESCE($2, name),
            host        = COALESCE($3, host),
            port        = COALESCE($4, port),
            db_name     = COALESCE($5, db_name),
            username    = COALESCE($6, username),
            password    = COALESCE($7, password),
            ssl         = COALESCE($8, ssl),
            ssh_enabled = COALESCE($9,  ssh_enabled),
            ssh_host    = COALESCE($10, ssh_host),
            ssh_port    = COALESCE($11, ssh_port),
            ssh_user    = COALESCE($12, ssh_user),
            ssh_auth_type    = COALESCE($13, ssh_auth_type),
            ssh_private_key  = COALESCE($14, ssh_private_key),
            ssh_passphrase   = COALESCE($15, ssh_passphrase),
            ssh_password     = COALESCE($16, ssh_password),
            is_default  = COALESCE($17, is_default),
            status      = $18,
            last_tested = $19,
            db_type     = COALESCE($20, db_type)
        WHERE id = $1
        RETURNING *
    `,
        [
            id,
            fields.name ?? null,
            fields.host ?? null,
            fields.port ?? null,
            fields.database ?? null,
            fields.username ?? null,
            encryptedPassword,
            fields.ssl ?? null,
            fields.sshEnabled ?? null,
            fields.sshHost ?? null,
            fields.sshPort ?? null,
            fields.sshUser ?? null,
            fields.sshAuthType ?? null,
            encryptedSshPrivateKey,
            encryptedSshPassphrase,
            encryptedSshPassword,
            fields.isDefault ?? null,
            fields.status ?? null,
            fields.lastTested ?? null,
            fields.dbType ?? null,
        ],
    );
    return rows[0] ? rowToConn(rows[0]) : null;
}

/** Delete a connection by ID */
export async function dbDeleteConnection(id, userId) {
    // Safety: always scope delete by user_id to prevent cross-user deletion
    const result = await pool.query(
        'DELETE FROM pgmonitoringtool.pulsedb_connections WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, userId],
    );
    if (result.rowCount === 0) {
        throw new Error('Connection not found or not owned by user');
    }
}

/** Clear is_default for all connections belonging to a user, then set one */
export async function dbSetDefault(userId, role, newDefaultId) {
    // Always scope by user_id — each user manages their own default connection
    await pool.query('UPDATE pgmonitoringtool.pulsedb_connections SET is_default = (id = $1) WHERE user_id = $2', [
        newDefaultId,
        userId,
    ]);
}

// In-memory cache rebuilt from DB on every request (no more stale global state)
// CONNECTIONS is kept for getPool() lookups — always refreshed from DB before use.
let CONNECTIONS = [];

/** Sync in-memory CONNECTIONS cache from DB for all connections (used by getPool) */
export async function syncConnectionsCache() {
    if (!pool) return; // no admin DB — nothing to sync
    try {
        const { rows } = await pool.query('SELECT * FROM pgmonitoringtool.pulsedb_connections ORDER BY id');
        CONNECTIONS = rows.map(rowToConn);
    } catch {
        /* DB not reachable yet — leave cache as-is */
    }
}

/** Called once at startup to ensure table exists and warm the cache */
export async function initConnections() {
    try {
        await ensureConnectionsTable();
        await syncConnectionsCache();
    } catch (e) {
        log('WARN', 'Could not initialise connections table', { error: e.message });
    }
}

// Track whether the table has been created in this process instance.
// On Vercel serverless, startup() is never called so we lazily create the
// table on the first incoming connection-API request instead.
let _connectionsTableReady = false;

// Middleware: ensure table exists (lazy, idempotent) then refresh cache
export const ensureConnections = async (req, res, next) => {
    try {
        if (!_connectionsTableReady) {
            await ensureConnectionsTable();
            await syncConnectionsCache();
            _connectionsTableReady = true;
        }
        // Skip redundant sync — dbLoadConnections() queries fresh data anyway,
        // and resolveConnection() falls back to sync when a conn isn't in cache.
        next();
    } catch (err) {
        next(err);
    }
};

/** Current snapshot of the in-memory connection cache. */
export function getConnections() {
    return CONNECTIONS;
}
