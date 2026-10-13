// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Per-user active connection / database / schema selections (memory-first, DB-backed).
// Extracted from server.ts.

import { log } from '../services/logger.js';
import { pool } from './adminPool.js';

// Per-user active connection map: in-memory cache backed by
// pgmonitoringtool.user_active_connection (migration 0019). Cache is the
// hot path; DB is the source of truth across restarts.
//
// Why a cache at all: every metric request calls getUserActiveConnectionId
// (via reqPool) — adding a DB round-trip per request would re-introduce
// the slow load times we just fixed.
const userActiveConnections = new Map();
let _userActiveLoaded = false;

export async function loadUserActiveConnections() {
    if (_userActiveLoaded) return;
    try {
        const r = await pool.query(`SELECT user_id, connection_id FROM pgmonitoringtool.user_active_connection`);
        for (const row of r.rows) {
            userActiveConnections.set(row.user_id, row.connection_id);
        }
        _userActiveLoaded = true;
        log('INFO', `Hydrated ${r.rows.length} user-active-connection rows`);
    } catch (err) {
        // Table may not exist on a fresh DB — that's fine; the in-memory
        // map will populate on first use and persist from there.
        if (!/relation .* does not exist/i.test(err.message)) {
            log('WARN', 'loadUserActiveConnections failed', { error: err.message });
        }
    }
}

/** Get the active connectionId for a specific user (cached + DB-backed) */
export function getUserActiveConnectionId(userId) {
    return userId ? (userActiveConnections.get(userId) ?? null) : null;
}

/**
 * Set the active connectionId for a specific user. Write-through: cache
 * updates immediately so the next request sees it; DB write is fire-and-
 * forget so the caller doesn't pay the round-trip on the critical path.
 */
export function setUserActiveConnectionId(userId, connectionId) {
    if (!userId) return;
    if (connectionId == null) {
        userActiveConnections.delete(userId);
        pool.query(`DELETE FROM pgmonitoringtool.user_active_connection WHERE user_id = $1`, [userId]).catch((err) => {
            if (!/relation .* does not exist/i.test(err.message)) {
                log('WARN', 'setUserActiveConnectionId DELETE failed', { error: err.message });
            }
        });
        return;
    }
    userActiveConnections.set(userId, connectionId);
    pool.query(
        `INSERT INTO pgmonitoringtool.user_active_connection (user_id, connection_id, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (user_id) DO UPDATE
            SET connection_id = EXCLUDED.connection_id, updated_at = now()`,
        [userId, connectionId],
    ).catch((err) => {
        if (!/relation .* does not exist/i.test(err.message)) {
            log('WARN', 'setUserActiveConnectionId UPSERT failed', { error: err.message });
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE DATABASE OVERRIDE (per user, per connection)
// A connection record points at one database, but a single server usually hosts
// many. Rather than force the user to register a new connection per database, we
// let them pick a different database on the SAME server. Because a PG/MySQL pool
// is bound to one database, "switching" means opening a second pool that reuses
// the connection's host/creds with a different `database`. Mongo is cheaper — one
// client can serve many databases via client.db(name).
// State is memory-first (hot path) and persisted to user_active_database so the
// choice survives restarts, mirroring user_active_connection above.
// ─────────────────────────────────────────────────────────────────────────────
const userActiveDatabase = new Map(); // `${userId}:${connectionId}` -> database
const activeDbKey = (userId, connectionId) => `${userId}:${connectionId}`;

export function getUserActiveDatabaseId(userId, connectionId) {
    if (!userId || !connectionId) return null;
    return userActiveDatabase.get(activeDbKey(userId, connectionId)) ?? null;
}

export function setUserActiveDatabase(userId, connectionId, database) {
    if (!userId || !connectionId) return;
    const key = activeDbKey(userId, connectionId);
    if (!database) {
        userActiveDatabase.delete(key);
        pool.query(`DELETE FROM pgmonitoringtool.user_active_database WHERE user_id=$1 AND connection_id=$2`, [
            userId,
            connectionId,
        ]).catch((err) => {
            if (!/relation .* does not exist/i.test(err.message)) {
                log('WARN', 'setUserActiveDatabase DELETE failed', { error: err.message });
            }
        });
        return;
    }
    userActiveDatabase.set(key, database);
    pool.query(
        `INSERT INTO pgmonitoringtool.user_active_database (user_id, connection_id, database, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (user_id, connection_id) DO UPDATE
            SET database = EXCLUDED.database, updated_at = now()`,
        [userId, connectionId, database],
    ).catch((err) => {
        if (!/relation .* does not exist/i.test(err.message)) {
            log('WARN', 'setUserActiveDatabase UPSERT failed', { error: err.message });
        }
    });
}

export async function loadUserActiveDatabases() {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS pgmonitoringtool.user_active_database (
            user_id       integer     NOT NULL,
            connection_id integer     NOT NULL,
            database      text        NOT NULL,
            updated_at    timestamptz DEFAULT now(),
            PRIMARY KEY (user_id, connection_id)
        )`);
        const r = await pool.query(
            `SELECT user_id, connection_id, database FROM pgmonitoringtool.user_active_database`,
        );
        for (const row of r.rows) {
            userActiveDatabase.set(activeDbKey(row.user_id, row.connection_id), row.database);
        }
        if (r.rows.length) log('INFO', `Hydrated ${r.rows.length} user-active-database rows`);
    } catch (err) {
        if (!/relation .* does not exist/i.test(err.message)) {
            log('WARN', 'loadUserActiveDatabases failed', { error: err.message });
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE SCHEMA OVERRIDE (Postgres only, per user, per connection)
// A database contains many schemas. Selecting one scopes the table-level panels
// (top tables, vacuum, bloat, index advisor) via a schemaname filter and pins
// the SQL console's search_path. Postgres-specific: MySQL "schema" == database
// (already covered by the database switcher) and Mongo has no schemas.
// ─────────────────────────────────────────────────────────────────────────────
const userActiveSchema = new Map(); // `${userId}:${connectionId}` -> schema

export function getUserActiveSchema(userId, connectionId) {
    if (!userId || !connectionId) return null;
    return userActiveSchema.get(activeDbKey(userId, connectionId)) ?? null;
}

export function setUserActiveSchema(userId, connectionId, schema) {
    if (!userId || !connectionId) return;
    const key = activeDbKey(userId, connectionId);
    if (!schema) {
        userActiveSchema.delete(key);
        pool.query(`DELETE FROM pgmonitoringtool.user_active_schema WHERE user_id=$1 AND connection_id=$2`, [
            userId,
            connectionId,
        ]).catch((err) => {
            if (!/relation .* does not exist/i.test(err.message)) {
                log('WARN', 'setUserActiveSchema DELETE failed', { error: err.message });
            }
        });
        return;
    }
    userActiveSchema.set(key, schema);
    pool.query(
        `INSERT INTO pgmonitoringtool.user_active_schema (user_id, connection_id, schema, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (user_id, connection_id) DO UPDATE
            SET schema = EXCLUDED.schema, updated_at = now()`,
        [userId, connectionId, schema],
    ).catch((err) => {
        if (!/relation .* does not exist/i.test(err.message)) {
            log('WARN', 'setUserActiveSchema UPSERT failed', { error: err.message });
        }
    });
}

export async function loadUserActiveSchemas() {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS pgmonitoringtool.user_active_schema (
            user_id       integer     NOT NULL,
            connection_id integer     NOT NULL,
            schema        text        NOT NULL,
            updated_at    timestamptz DEFAULT now(),
            PRIMARY KEY (user_id, connection_id)
        )`);
        const r = await pool.query(`SELECT user_id, connection_id, schema FROM pgmonitoringtool.user_active_schema`);
        for (const row of r.rows) {
            userActiveSchema.set(activeDbKey(row.user_id, row.connection_id), row.schema);
        }
        if (r.rows.length) log('INFO', `Hydrated ${r.rows.length} user-active-schema rows`);
    } catch (err) {
        if (!/relation .* does not exist/i.test(err.message)) {
            log('WARN', 'loadUserActiveSchemas failed', { error: err.message });
        }
    }
}
