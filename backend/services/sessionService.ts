/**
 * services/sessionService.ts
 * ──────────────────────────
 * DB operations for user_sessions and user_api_keys.
 * Also handles login_activity stamping on every auth event.
 */

import crypto from 'crypto';
import { swallowWith } from './errorHandling.js';

const S = 'pgmonitoringtool';

/**
 * Minimal structural type for anything we can run a query against — a pg Pool,
 * a checked-out PoolClient, or a per-request pool wrapper. Kept structural
 * (rather than importing pg's Pool) so the many call sites that pass a
 * request-scoped pool wrapper type-check without casts.
 */
export interface Queryable {
    query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>;
}

interface ClientSession {
    id: string;
    userId: number | string;
    user: string | undefined;
    ip: string | null;
    device: string | null;
    location: string | null;
    risk: string | null;
    active: boolean;
    expiresAt: string | Date;
    createdAt: string | Date;
}

interface ClientApiKey {
    id: number | string;
    userId: number | string;
    name: string;
    prefix: string;
    scope: string;
    totalCalls: number;
    lastUsedAt: string | Date | null;
    status: string;
    createdAt: string | Date;
}

interface CreateSessionInput {
    userId: number | string;
    ip?: string | null;
    userAgent?: string | null;
    deviceLabel?: string | null;
    location?: string | null;
    riskLevel?: string;
}

// ── Session-active cache ─────────────────────────────────────────────────────
// PERF: the authenticate middleware calls isSessionActive() on EVERY request,
// which was a control-plane DB round-trip per API call — slowing every screen,
// especially on serverless (cold pooler connects). Cache the boolean result
// briefly so revocation still propagates within SESSION_CACHE_TTL_MS but the
// common (unchanged) case is served from memory. Revoke paths bust the entry.
const SESSION_CACHE_TTL_MS = Number(process.env.FATHOM_SESSION_CACHE_TTL_MS) || 30_000;
const _sessionActiveCache = new Map<string, { active: boolean; expiresAt: number }>();

export function invalidateSessionCache(sessionId?: string | null): void {
    if (sessionId) _sessionActiveCache.delete(sessionId);
    else _sessionActiveCache.clear();
}

/* ─── SESSION HELPERS ──────────────────────────────────────────────────────── */

function toClientSession(row: any): ClientSession {
    return {
        id: row.id,
        userId: row.user_id,
        user: row.user_name ?? row.username,
        ip: row.ip_address,
        device: row.device_label,
        location: row.location,
        risk: row.risk_level,
        active: row.is_active,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
    };
}

// How long a session row stays valid. Kept deliberately >= the JWT lifetime
// (JWT_EXPIRES_IN, default 8h) so the JWT expires before the session row does;
// the session row is the revocation handle, not a second, shorter clock.
const SESSION_TTL_HOURS = Number(process.env.FATHOM_SESSION_TTL_HOURS) || 24;

/**
 * Create a session record when a user logs in.
 * Returns the UUID session id (store in JWT as `sid` for revocation checks).
 *
 * expires_at is set EXPLICITLY rather than left to the column default. The
 * committed migration (db/migrations/0000) declares `expires_at timestamp
 * DEFAULT now()`, while the deployed database has `DEFAULT now() + 24h`. Under
 * the migration's default every session was born already expired, so
 * `expires_at > NOW()` in isSessionActive() failed on the very next request and
 * nobody could stay logged in on a freshly-migrated database. Setting it here
 * makes the behaviour independent of which default the target DB happens to
 * carry. Migration 0024 aligns the default as well.
 */
export async function createSession(
    pool: Queryable,
    { userId, ip, userAgent, deviceLabel, location, riskLevel = 'low' }: CreateSessionInput,
): Promise<string> {
    const { rows } = await pool.query(
        `INSERT INTO ${S}.user_sessions
            (user_id, ip_address, user_agent, device_label, location, risk_level, expires_at)
         VALUES ($1, $2::inet, $3, $4, $5, $6, NOW() + ($7::text || ' hours')::interval)
         RETURNING id`,
        [
            userId,
            ip ?? null,
            userAgent ?? null,
            deviceLabel ?? null,
            location ?? null,
            riskLevel,
            String(SESSION_TTL_HOURS),
        ],
    );
    return rows[0].id;
}

/**
 * Verify a session is still active and not expired.
 * Call this in the authenticate middleware for revocation support.
 */
export async function isSessionActive(pool: Queryable, sessionId: string): Promise<boolean> {
    const now = Date.now();
    const hit = _sessionActiveCache.get(sessionId);
    if (hit && hit.expiresAt > now) return hit.active;

    // SEC-05: this lookup MUST fail closed. It previously caught its own DB
    // errors and returned `true` (caching a synthetic positive for 5s), which
    // silently defeated the fail-closed contract that authenticate() documents
    // and implements — the try/catch there could never fire, so a revoked token
    // kept working for the duration of any DB blip.
    //
    // We now let the error propagate. authenticate() catches it, logs it, and
    // returns 503 "Session validation unavailable, try again". That is the
    // correct trade: a brief outage degrades availability, never authorization.
    //
    // Note we deliberately do NOT fall back to a stale cached positive either.
    // On a multi-instance deploy the cache is per-process, so a session revoked
    // on another instance can still be cached as active here; trusting that
    // entry precisely when we cannot reach the DB to check is the same
    // fail-open hole in a smaller window.
    const { rows } = await pool.query(
        `SELECT 1 FROM ${S}.user_sessions
         WHERE id = $1 AND is_active = TRUE AND expires_at > NOW()`,
        [sessionId],
    );
    const active = rows.length > 0;
    // Cache positives for the full TTL; cache negatives briefly so a freshly
    // revoked/expired session is re-checked sooner.
    _sessionActiveCache.set(sessionId, {
        active,
        expiresAt: now + (active ? SESSION_CACHE_TTL_MS : Math.min(5_000, SESSION_CACHE_TTL_MS)),
    });
    return active;
}

/** All active sessions for admin Security panel. */
export async function listActiveSessions(pool: Queryable): Promise<ClientSession[]> {
    const { rows } = await pool.query(`SELECT * FROM ${S}.v_active_sessions ORDER BY created_at DESC`);
    return rows.map(toClientSession);
}

/** Active sessions for a specific user (User detail drawer). */
export async function listUserSessions(pool: Queryable, userId: number | string): Promise<ClientSession[]> {
    const { rows } = await pool.query(
        `SELECT * FROM ${S}.user_sessions
         WHERE user_id = $1 AND is_active = TRUE AND expires_at > NOW()
         ORDER BY created_at DESC`,
        [userId],
    );
    return rows.map(toClientSession);
}

/** Revoke a single session by UUID. Returns true if it was active. */
export async function revokeSession(
    pool: Queryable,
    sessionId: string,
    revokedBy: number | string | null = null,
): Promise<boolean> {
    const { rowCount } = await pool.query(
        `UPDATE ${S}.user_sessions
         SET is_active  = FALSE,
             revoked_at = NOW(),
             revoked_by = $2
         WHERE id = $1 AND is_active = TRUE`,
        [sessionId, revokedBy],
    );
    invalidateSessionCache(sessionId);
    return (rowCount ?? 0) > 0;
}

/** Revoke all active sessions for a user (admin action or user logout-all). */
export async function revokeAllUserSessions(
    pool: Queryable,
    userId: number | string,
    revokedBy: number | string | null = null,
): Promise<number | null> {
    const { rowCount } = await pool.query(
        `UPDATE ${S}.user_sessions
         SET is_active  = FALSE,
             revoked_at = NOW(),
             revoked_by = $2
         WHERE user_id = $1 AND is_active = TRUE`,
        [userId, revokedBy],
    );
    invalidateSessionCache(); // clear all — a user's sids aren't tracked here
    return rowCount;
}

/** Revoke every active session across all users (admin emergency action). */
export async function revokeAllSessions(
    pool: Queryable,
    revokedBy: number | string | null = null,
): Promise<number | null> {
    const { rowCount } = await pool.query(
        `UPDATE ${S}.user_sessions
         SET is_active  = FALSE,
             revoked_at = NOW(),
             revoked_by = $1
         WHERE is_active = TRUE`,
        [revokedBy],
    );
    // This is the emergency "log everybody out" action and was the only revoke
    // path that did not bust the cache — meaning it took up to
    // SESSION_CACHE_TTL_MS for the revocation to bite. Clear everything.
    invalidateSessionCache();
    return rowCount;
}

/* ─── LOGIN ACTIVITY ───────────────────────────────────────────────────────── */

/**
 * Increment the daily login counter for a user.
 * Call after every successful authentication.
 */
export async function recordLogin(pool: Queryable, userId: number | string): Promise<void> {
    await pool.query(
        `INSERT INTO ${S}.user_login_activity (user_id, day, login_count, failed_count)
         VALUES ($1, CURRENT_DATE, 1, 0)
         ON CONFLICT (user_id, day)
         DO UPDATE SET login_count = ${S}.user_login_activity.login_count + 1`,
        [userId],
    );
}

/**
 * Increment the daily failed-login counter.
 * Call after every failed authentication attempt.
 */
export async function recordFailedLogin(pool: Queryable, userId: number | string): Promise<void> {
    await pool.query(
        `INSERT INTO ${S}.user_login_activity (user_id, day, login_count, failed_count)
         VALUES ($1, CURRENT_DATE, 0, 1)
         ON CONFLICT (user_id, day)
         DO UPDATE SET failed_count = ${S}.user_login_activity.failed_count + 1`,
        [userId],
    );
}

/**
 * 28-day heatmap data for a single user.
 * Returns array of 28 numbers (0-padded if day has no record).
 */
export async function getLoginHeatmap(pool: Queryable, userId: number | string): Promise<number[]> {
    const { rows } = await pool.query(
        `SELECT day, login_count
         FROM   ${S}.user_login_activity
         WHERE  user_id = $1
           AND  day >= CURRENT_DATE - INTERVAL '27 days'
         ORDER  BY day ASC`,
        [userId],
    );

    // Build a full 28-slot array padded with 0 for missing days
    const map: Record<string, number> = Object.fromEntries(
        rows.map((r: any) => [new Date(r.day).toISOString().slice(0, 10), Number(r.login_count)]),
    );
    return Array.from({ length: 28 }, (_, i) => {
        const d = new Date(Date.now() - (27 - i) * 86_400_000).toISOString().slice(0, 10);
        return map[d] ?? 0;
    });
}

/* ─── API KEYS ─────────────────────────────────────────────────────────────── */

function toClientKey(row: any): ClientApiKey {
    return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        prefix: row.key_prefix,
        scope: row.scope,
        totalCalls: Number(row.total_calls),
        lastUsedAt: row.last_used_at ?? null,
        status: row.status,
        createdAt: row.created_at,
    };
}

/**
 * Generate a new API key.
 * Returns { key, record } — `key` is the full plaintext shown ONCE to the user.
 */
export async function createApiKey(
    pool: Queryable,
    userId: number | string,
    name: string,
    scope = 'read:all',
): Promise<{ key: string; record: ClientApiKey }> {
    const rawKey = `pk_live_${crypto.randomBytes(18).toString('base64url')}`;
    const prefix = rawKey.slice(0, 12);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const { rows } = await pool.query(
        `INSERT INTO ${S}.user_api_keys (user_id, name, key_prefix, key_hash, scope)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, name, prefix, keyHash, scope],
    );
    return { key: rawKey, record: toClientKey(rows[0]) };
}

/** List active API keys for a user (prefix shown, hash never returned). */
export async function listApiKeys(
    pool: Queryable,
    userId: number | string | null = null,
): Promise<ClientApiKey[]> {
    const { rows } = await pool.query(
        `SELECT * FROM ${S}.user_api_keys
         WHERE status = 'active'
           AND ($1::int IS NULL OR user_id = $1)
         ORDER BY created_at DESC`,
        [userId],
    );
    return rows.map(toClientKey);
}

/** Revoke an API key. Returns true if it was active. */
export async function revokeApiKey(
    pool: Queryable,
    keyId: number | string,
    revokedBy: number | string | null = null,
): Promise<boolean> {
    const { rowCount } = await pool.query(
        `UPDATE ${S}.user_api_keys
         SET status     = 'revoked',
             revoked_at = NOW(),
             revoked_by = $2
         WHERE id = $1 AND status = 'active'`,
        [keyId, revokedBy],
    );
    return (rowCount ?? 0) > 0;
}

/* ─── API KEY SCOPES ───────────────────────────────────────────────────────── */

/**
 * Recognised API-key scopes, least → most privileged.
 *   read:all   — safe (GET/HEAD/OPTIONS) requests only
 *   write:all  — any method the owning user's role permits
 *   admin:all  — same as write:all today; reserved for future separation
 *
 * The scope narrows what a key can do; it never widens it. The owning user's
 * role and allowed_screens still apply on top.
 */
export const API_KEY_SCOPES = ['read:all', 'write:all', 'admin:all'];

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isValidApiKeyScope(scope: unknown): scope is string {
    return typeof scope === 'string' && API_KEY_SCOPES.includes(scope);
}

/**
 * Is `method` permitted for a key issued with `scope`?
 *
 * Unknown/legacy scope strings are treated as read-only. That is the safe
 * direction: keys predating validation were created with arbitrary body input,
 * and silently granting them write access is how a scope column that is stored
 * but not enforced turns into a privilege-escalation path.
 */
export function scopeAllowsMethod(scope: string | null | undefined, method: string): boolean {
    if (scope === 'write:all' || scope === 'admin:all') return true;
    return SAFE_METHODS.has(String(method).toUpperCase());
}

/**
 * Authenticate an API key from a request.
 * Returns the associated user row (with `api_key_scope` attached) or null.
 */
export async function authenticateApiKey(pool: Queryable, rawKey: string): Promise<any | null> {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const { rows } = await pool.query(
        `SELECT u.*, k.scope AS api_key_scope, k.key_prefix AS api_key_prefix
           FROM ${S}.user_api_keys k
           JOIN ${S}.users u ON u.id = k.user_id
          WHERE k.key_hash = $1
            AND k.status   = 'active'
            AND u.deleted_at IS NULL`,
        [keyHash],
    );
    if (!rows[0]) return null;

    // Bump call counter asynchronously (don't await — don't slow the request).
    // Failure here must not fail auth, but it must not be silent either: a
    // broken counter update was one of the subsystems the silent-failure sweep
    // found dead against the live DB. Log it via swallow() instead of dropping.
    pool.query(
        `UPDATE ${S}.user_api_keys
         SET total_calls = total_calls + 1, last_used_at = NOW()
         WHERE key_hash = $1`,
        [keyHash],
    ).catch(swallowWith({ component: 'session', op: 'bumpApiKeyUsage' }));

    return rows[0];
}
