// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/auditService.js
 * ────────────────────────
 * Append-only audit log. Never UPDATE or DELETE rows here.
 * Call log() from any route after a significant action.
 */

import { swallow } from './errorHandling.js';

const S = 'pgmonitoringtool';

/**
 * Append one audit event.
 *
 * @param {import('pg').Pool} pool
 * @param {{
 *   actorId?:      number|null,
 *   actorUsername: string,
 *   action:        string,          // e.g. 'USER_CREATED', 'ROLE_CHANGED'
 *   resourceType?: string,          // e.g. 'user', 'api_key', 'session'
 *   resourceId?:   string|number,
 *   level?:        'info'|'warn'|'critical'|'success',
 *   detail?:       string,
 *   metadata?:     object,
 *   ip?:           string,
 * }} event
 */
export async function writeAudit(pool, event) {
    const {
        actorId      = null,
        actorUsername,
        action,
        resourceType = null,
        resourceId   = null,
        level        = 'info',
        detail       = null,
        metadata     = null,
        ip           = null,
    } = event;

    await pool.query(
        `INSERT INTO ${S}.audit_log
            (actor_id, actor_username, action, resource_type, resource_id,
             level, detail, metadata, ip_address)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::inet)`,
        [
            actorId,
            actorUsername,
            action,
            resourceType,
            resourceId !== null ? String(resourceId) : null,
            level,
            detail,
            metadata ? JSON.stringify(metadata) : null,
            ip,
        ]
    ).catch(err => {
        // Audit failures must never crash the main request — but they must not
        // be invisible either. This previously wrote to console.error only,
        // which is why the audit table sat at 0 rows next to 55 recorded logins
        // without anyone noticing: the columns resource_id, metadata and
        // ip_address do not exist on the deployed database, so EVERY audit
        // write has been failing with 42703 (undefined_column).
        swallow(err, {
            component: 'audit',
            op: 'writeAudit',
            action,
            actorId,
            resourceType,
        });
    });
}

/**
 * Paginated audit log for the UI.
 *
 * @param {import('pg').Pool} pool
 * @param {{ level?: string, action?: string, limit?: number, offset?: number }} opts
 */
export async function listAuditEvents(pool, opts = {}) {
    const limit  = Math.min(Number(opts.limit)  || 50,  500);
    const offset = Math.max(Number(opts.offset) || 0,   0);

    const conditions = [];
    const params     = [];

    if (opts.level) {
        params.push(opts.level);
        conditions.push(`level = $${params.length}`);
    }
    if (opts.action) {
        params.push(`%${opts.action}%`);
        conditions.push(`action ILIKE $${params.length}`);
    }
    if (opts.username) {
        params.push(`%${opts.username}%`);
        conditions.push(`actor_username ILIKE $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);

    // Try with resource_type column first; fall back without it if column doesn't exist yet
    let dataRes, countRes;
    try {
        [dataRes, countRes] = await Promise.all([
            pool.query(
                `SELECT id, actor_id, actor_username, action, resource_type, resource_id,
                        level, detail, metadata, ip_address, created_at
                 FROM   ${S}.audit_log
                 ${where}
                 ORDER  BY created_at DESC
                 LIMIT  $${params.length - 1} OFFSET $${params.length}`,
                params
            ),
            pool.query(
                `SELECT COUNT(*) AS total FROM ${S}.audit_log ${where}`,
                params.slice(0, -2)
            ),
        ]);
    } catch (err) {
        if (err.message && err.message.includes('resource_type')) {
            // Column doesn't exist yet — query without it
            [dataRes, countRes] = await Promise.all([
                pool.query(
                    `SELECT id, actor_id, actor_username, action, NULL AS resource_type, resource_id,
                            level, detail, metadata, ip_address, created_at
                     FROM   ${S}.audit_log
                     ${where}
                     ORDER  BY created_at DESC
                     LIMIT  $${params.length - 1} OFFSET $${params.length}`,
                    params
                ),
                pool.query(
                    `SELECT COUNT(*) AS total FROM ${S}.audit_log ${where}`,
                    params.slice(0, -2)
                ),
            ]);
        } else {
            throw err;
        }
    }

    return {
        rows:   dataRes.rows,
        total:  Number(countRes.rows[0].total),
        limit,
        offset,
    };
}

/* ─── Streaming export ─────────────────────────────────────────────────── */

/**
 * Async generator that yields audit rows in fixed-size pages, oldest first.
 * Designed to back a streaming HTTP export so memory usage stays bounded
 * regardless of result-set size.
 *
 * Supported filters: from, to (ISO strings or Date), action (ILIKE),
 * username (ILIKE), level (exact match).
 *
 * @param {import('pg').Pool} pool
 * @param {object} opts
 * @param {string|Date} [opts.from]      — inclusive lower bound
 * @param {string|Date} [opts.to]        — exclusive upper bound
 * @param {string}      [opts.action]
 * @param {string}      [opts.username]
 * @param {string}      [opts.level]
 * @param {number}      [opts.pageSize=1000]
 * @param {number}      [opts.maxRows=100_000] — safety valve
 */
export async function* streamAuditEvents(pool, opts = {}) {
    // pageSize: cap at 5000 so one page can't DoS the DB. No minimum — tiny
    // values are fine, they just make more round-trips.
    const pageSize = Math.min(Math.max(Number(opts.pageSize) || 1000, 1), 5000);
    // maxRows: safety valve. Respect the caller's wishes; if they asked for
    // 4 rows we yield 4, even if pageSize is bigger.
    const maxRows = Math.max(Number(opts.maxRows) || 100_000, 1);

    const conditions = [];
    const params = [];
    if (opts.from) {
        params.push(new Date(opts.from));
        conditions.push(`created_at >= $${params.length}`);
    }
    if (opts.to) {
        params.push(new Date(opts.to));
        conditions.push(`created_at < $${params.length}`);
    }
    if (opts.level) {
        params.push(opts.level);
        conditions.push(`level = $${params.length}`);
    }
    if (opts.action) {
        params.push(`%${opts.action}%`);
        conditions.push(`action ILIKE $${params.length}`);
    }
    if (opts.username) {
        params.push(`%${opts.username}%`);
        conditions.push(`actor_username ILIKE $${params.length}`);
    }

    // Keyset pagination on (created_at, id) so large exports don't drift as
    // new rows arrive. First page has no cursor; subsequent pages filter by
    // the last-seen timestamp and tie-break on id.
    let cursorTs = null;
    let cursorId = null;
    let emitted = 0;

    while (emitted < maxRows) {
        const pageParams = [...params];
        const pageConditions = [...conditions];
        if (cursorTs != null) {
            pageParams.push(cursorTs);
            pageParams.push(cursorId);
            pageConditions.push(
                `(created_at, id) > ($${pageParams.length - 1}, $${pageParams.length})`
            );
        }
        const where = pageConditions.length ? `WHERE ${pageConditions.join(' AND ')}` : '';
        pageParams.push(pageSize);

        let result;
        try {
            result = await pool.query(
                `SELECT id, actor_id, actor_username, action, resource_type, resource_id,
                        level, detail, metadata, ip_address, created_at
                 FROM   ${S}.audit_log
                 ${where}
                 ORDER  BY created_at ASC, id ASC
                 LIMIT  $${pageParams.length}`,
                pageParams
            );
        } catch (err) {
            // Legacy deployments without resource_type — try again without it.
            if (err.message && err.message.includes('resource_type')) {
                result = await pool.query(
                    `SELECT id, actor_id, actor_username, action,
                            NULL AS resource_type, resource_id,
                            level, detail, metadata, ip_address, created_at
                     FROM   ${S}.audit_log
                     ${where}
                     ORDER  BY created_at ASC, id ASC
                     LIMIT  $${pageParams.length}`,
                    pageParams
                );
            } else {
                throw err;
            }
        }
        const rows = result.rows;
        if (rows.length === 0) return;
        for (const row of rows) {
            if (emitted >= maxRows) return;
            yield row;
            emitted += 1;
        }
        if (rows.length < pageSize) return;
        const last = rows[rows.length - 1];
        cursorTs = last.created_at;
        cursorId = last.id;
    }
}

/**
 * CSV-escape one cell. Quotes the value if it contains a comma, quote, or
 * newline; doubles interior quotes per RFC 4180.
 */
function csvCell(v) {
    if (v === null || v === undefined) return '';
    const s = (v instanceof Date) ? v.toISOString()
            : typeof v === 'object' ? JSON.stringify(v)
            : String(v);
    if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

export const AUDIT_EXPORT_COLUMNS = [
    'id', 'created_at', 'actor_id', 'actor_username', 'action',
    'resource_type', 'resource_id', 'level', 'detail', 'ip_address', 'metadata',
];

/**
 * Render one row as a CSV line (no trailing newline).
 */
export function rowToCsv(row) {
    return AUDIT_EXPORT_COLUMNS.map(c => csvCell(row[c])).join(',');
}

/**
 * Render the standard CSV header line.
 */
export function csvHeader() {
    return AUDIT_EXPORT_COLUMNS.join(',');
}