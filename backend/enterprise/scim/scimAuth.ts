// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * scim/scimAuth.js
 * ─────────────────
 * Tenant-scoped bearer-token authentication for the SCIM surface.
 *
 * SCIM clients (Okta, Entra ID) authenticate with a long-lived bearer token
 * minted per tenant at setup time. The token is never stored in the clear —
 * we keep only its SHA-256 hash in scim_tokens. On each request we hash the
 * presented token, look up the row, and attach tenantId to req.
 *
 * Why SHA-256 and not argon2 for this specific case:
 *   SCIM tokens are ≥32 bytes of cryptographic randomness (128+ bits of
 *   entropy). They are not human-memorable secrets vulnerable to dictionary
 *   attack, so a fast hash is appropriate and keeps the per-request cost
 *   low. Argon2 would add ~100ms per SCIM request for no security gain when
 *   the plaintext is already high-entropy.
 *
 * The returned middleware emits SCIM-shaped 401 errors (RFC 7644 §3.12) on
 * failure so Okta/Entra clients see a correct error envelope, not plain HTML.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const S = 'pgmonitoringtool';
const SCIM_CONTENT_TYPE = 'application/scim+json';

// ── DDL ──────────────────────────────────────────────────────────────────
export const SCIM_TOKENS_DDL = `
CREATE TABLE IF NOT EXISTS ${S}.scim_tokens (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       TEXT        NOT NULL,
    token_hash      CHAR(64)    NOT NULL UNIQUE,
    label           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at    TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS scim_tokens_tenant_idx
    ON ${S}.scim_tokens (tenant_id)
    WHERE revoked_at IS NULL;
`;

// ── Helpers ──────────────────────────────────────────────────────────────
function sha256Hex(s) {
    return createHash('sha256').update(s).digest('hex');
}

function sendScimError(res, status, detail) {
    res.status(status)
        .type(SCIM_CONTENT_TYPE)
        .send(JSON.stringify({
            schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
            status: String(status),
            detail,
        }));
}

function parseBearer(header) {
    if (!header || typeof header !== 'string') return null;
    const m = /^Bearer\s+(\S+)$/i.exec(header);
    return m ? m[1] : null;
}

// ── Token issuance / revocation ──────────────────────────────────────────
/**
 * Mint a new SCIM token for a tenant.
 * Returns { plaintext, id } — the plaintext is shown once; the hash is stored.
 *
 * @param {import('pg').Pool} pool
 * @param {string} tenantId
 * @param {string} [label] — human-readable label (e.g. "okta-prod")
 */
export async function issueScimToken(pool, tenantId, label = null) {
    if (!tenantId) throw new Error('issueScimToken: tenantId is required');
    // 32 bytes → 256 bits of entropy, base64url-encoded.
    const plaintext = randomBytes(32).toString('base64url');
    const tokenHash = sha256Hex(plaintext);
    const { rows } = await pool.query(
        `INSERT INTO ${S}.scim_tokens (tenant_id, token_hash, label)
         VALUES ($1, $2, $3)
         RETURNING id, created_at`,
        [tenantId, tokenHash, label],
    );
    // Prefix so humans can spot the token type at a glance.
    return { plaintext: `pulsedb_scim_${plaintext}`, id: rows[0].id, createdAt: rows[0].created_at };
}

/** Revoke a token by id. Idempotent. */
export async function revokeScimToken(pool, tokenId) {
    await pool.query(
        `UPDATE ${S}.scim_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`,
        [tokenId],
    );
}

/** List live tokens for a tenant (returns hash prefixes only, never plaintext). */
export async function listScimTokens(pool, tenantId) {
    const { rows } = await pool.query(
        `SELECT id, label, created_at, last_used_at,
                substring(token_hash, 1, 8) AS hash_prefix
           FROM ${S}.scim_tokens
          WHERE tenant_id = $1 AND revoked_at IS NULL
          ORDER BY created_at DESC`,
        [tenantId],
    );
    return rows;
}

// ── Middleware factory ───────────────────────────────────────────────────
/**
 * Express middleware that authenticates a SCIM request via bearer token.
 *
 * @param {import('pg').Pool} pool
 * @param {object} [opts]
 * @param {number} [opts.touchEveryMs=60_000] — throttle last_used_at updates
 */
export function createScimAuth(pool, { touchEveryMs = 60_000 } = {}) {
    const lastTouch = new Map(); // id → ts

    return async function scimAuth(req, res, next) {
        const raw = parseBearer(req.headers.authorization);
        if (!raw) return sendScimError(res, 401, 'missing bearer token');

        // Strip the non-secret prefix before hashing.
        const token = raw.startsWith('pulsedb_scim_') ? raw.slice('pulsedb_scim_'.length) : raw;
        const tokenHash = sha256Hex(token);

        try {
            const { rows } = await pool.query(
                `SELECT id, tenant_id, token_hash FROM ${S}.scim_tokens
                  WHERE token_hash = $1 AND revoked_at IS NULL
                  LIMIT 1`,
                [tokenHash],
            );
            if (rows.length === 0) {
                return sendScimError(res, 401, 'invalid or revoked token');
            }
            // Constant-time equality as a belt-and-braces check.
            const stored = Buffer.from(rows[0].token_hash, 'hex');
            const presented = Buffer.from(tokenHash, 'hex');
            if (stored.length !== presented.length || !timingSafeEqual(stored, presented)) {
                return sendScimError(res, 401, 'invalid or revoked token');
            }

            req.tenantId = rows[0].tenant_id;
            req.scimTokenId = rows[0].id;

            // Throttled last_used_at update so we don't hammer the table.
            const now = Date.now();
            const prev = lastTouch.get(rows[0].id) || 0;
            if (now - prev >= touchEveryMs) {
                lastTouch.set(rows[0].id, now);
                pool.query(
                    `UPDATE ${S}.scim_tokens SET last_used_at = now() WHERE id = $1`,
                    [rows[0].id],
                ).catch(() => { /* best-effort only */ });
            }
            next();
        } catch (err) {
            return sendScimError(res, 500, err?.message || 'auth lookup failed');
        }
    };
}

export default createScimAuth;
