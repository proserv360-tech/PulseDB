// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
// ==========================================================================
//  PulseDB — Database Pool  (db.js)
//
//  NOTE: server.js creates and owns the primary connection pool using the
//  individual PG* environment variables (PGHOST, PGUSER, etc.).  This file
//  provides a secondary convenience pool that can be used in standalone
//  scripts (e.g. migrations) or unit tests via DATABASE_URL.
//
//  If DATABASE_URL is not set, it falls back to the same PG* variables that
//  server.js uses, so both pools will connect to the same database.
// ==========================================================================

import pg from 'pg';
import { poolerConnectionString } from './core/poolerUrl.js';

const { Pool } = pg;

// Resolve SSL config from environment.
// Set DB_SSL=true to enable SSL. By default we validate the server's certificate
// (strict TLS). To opt into accepting self-signed certs (non-production use):
//   PULSEDB_TLS_ALLOW_SELF_SIGNED=true
// To trust a private CA, set PULSEDB_TLS_CA_CERT to the PEM bundle contents.
function resolveSsl() {
    if (process.env.DB_SSL !== 'true') return false;
    const isProd = process.env.NODE_ENV === 'production';
    const allowSelfSigned =
        process.env.PULSEDB_TLS_ALLOW_SELF_SIGNED === 'true' || (!isProd && process.env.PULSEDB_TLS_STRICT !== 'true');
    const ca = process.env.PULSEDB_TLS_CA_CERT;
    const opt = { rejectUnauthorized: !allowSelfSigned };
    if (ca) opt.ca = ca;
    return opt;
}

// Build a connection config that works whether DATABASE_URL is set or not.
function buildPoolConfig() {
    const ssl = resolveSsl();
    if (process.env.DATABASE_URL) {
        return {
            connectionString: poolerConnectionString(process.env.DATABASE_URL),
            ssl,
        };
    }
    // Fall back to the same individual variables used by server.js
    return {
        user: process.env.PGUSER || 'postgres',
        host: process.env.PGHOST,
        database: process.env.PGDATABASE || 'postgres',
        password: process.env.PGPASSWORD,
        port: Number(process.env.PGPORT) || 5432,
        ssl,
    };
}

// Serverless (Vercel): every instance owns its own pool, so keep it tiny and hand
// idle sockets back quickly — see core/poolerUrl.ts and core/adminPool.ts.
const SERVERLESS = process.env.VERCEL === '1';
export const pool = new Pool({
    ...buildPoolConfig(),
    max: SERVERLESS ? 2 : 10,
    idleTimeoutMillis: SERVERLESS ? 5_000 : 30_000,
    connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
    console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Convenience wrapper — runs a single query and returns the result.
 * @param {string} text
 * @param {any[]}  params
 */

// Test seam: unit tests can swap the query implementation so middleware that
// imports `query` from this module (e.g. resolveWorkspace) can be exercised
// hermetically without a real database. No-op in production.
let _queryImpl = (text, params) => pool.query(text, params);
export const query = (text, params) => _queryImpl(text, params);

/** @internal test-only — override the query implementation. Returns a restore fn. */
export function __setQueryForTests(fn) {
    const prev = _queryImpl;
    _queryImpl = fn;
    return () => {
        _queryImpl = prev;
    };
}
