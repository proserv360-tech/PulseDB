// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Short-circuits Postgres-only endpoints when the active connection is another engine.
// Extracted from server.ts.

import path from 'path';
import { reqDbType } from '../core/connectionPools.js';

// ─────────────────────────────────────────────────────────────────────────────
// POSTGRES MONITORING ROUTES
//
// These endpoints query PostgreSQL-specific system tables (pg_stat_*, pg_locks,
// pg_settings, pg_extension, etc.).  When the active connection is MySQL or
// MongoDB these queries are meaningless, so we intercept early and return
// sensible empty responses so the frontend degrades gracefully.
// ─────────────────────────────────────────────────────────────────────────────

/** Paths that are PG-specific and should return empty for other DB types */
const PG_ONLY_PREFIXES = [
    '/api/overview/',
    '/api/performance/',
    '/api/reliability/',
    '/api/resources/',
    '/api/bloat/',
    '/api/regression/',
    '/api/logs/',
    '/api/tables/',
    '/api/indexes/',
    '/api/optimizer/',
    '/api/admin/settings',
    '/api/admin/extensions',
    '/api/admin/hba',
    '/api/admin/connections',
    '/api/pool/',
    '/api/replication/',
    '/api/security/',
    '/api/schema/',
    '/api/observability/',
    '/api/checkpoint/',
    '/api/maintenance/',
    '/api/backup/',
    '/api/capacity/',
    '/api/wal/',
    '/api/vacuum/',
];

/**
 * Middleware: for PG-specific endpoints, check the connection dbType.
 * If not PostgreSQL, return an appropriate empty response instead of
 * crashing with PG system-table queries on MySQL/MongoDB.
 */
export async function pgOnlyGuard(req, res, next) {
    // Only guard GET/POST to PG-specific paths
    const path = req.path; // path relative to /api mount = /overview/stats etc.
    const fullPath = '/api' + path;
    const isPgOnly = PG_ONLY_PREFIXES.some((p) => fullPath.startsWith(p));
    if (!isPgOnly) return next();

    try {
        const dbType = await reqDbType(req);
        if (dbType === 'postgresql') return next();
        // Non-PG connection → return empty (matches frontend .catch(() => null) pattern)
        const method = req.method.toUpperCase();
        if (method === 'GET') return res.json([]);
        return res.json({ error: `This endpoint is PostgreSQL-specific. Connected database type: ${dbType}` });
    } catch {
        return next(); // Can't determine type — let the handler try
    }
}
