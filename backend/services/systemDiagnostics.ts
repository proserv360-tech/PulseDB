// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
// ─────────────────────────────────────────────────────────────────────────────
// FATHOM — System Diagnostics
//
// Single source of truth for "is the backend configured correctly" checks.
// Powers three callers:
//   1. POST /api/connections — map known misconfigurations to structured 503s
//      instead of an opaque 500 that forces operators into the log viewer.
//   2. GET  /api/health       — expose the same status so a cheap probe tells
//      operators whether the app is actually usable.
//   3. scripts/doctor.js      — CLI that prints a verdict and exits non-zero
//      on failure, suitable for CI / post-deploy smoke checks.
//
// Every check is defensive: a check *throws* only when a programming error
// occurs. A misconfigured environment produces an `{ ok: false, code, hint }`
// object, never an exception, so the caller can always shape a clean response.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read a Postgres connection string from either `DATABASE_URL` or the
 * classic discrete `PGHOST` / `PGUSER` / `PGDATABASE` / `PGPORT` /
 * `PGPASSWORD` vars (node-postgres natively accepts both). Returns true if
 * enough is present to attempt a connection.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @returns {boolean}
 */
export function hasDatabaseConfig(env = process.env) {
    if (env.DATABASE_URL) return true;
    // PGHOST + PGDATABASE is the minimum — PGUSER defaults to the OS user,
    // PGPORT defaults to 5432, PGPASSWORD can be empty.
    return Boolean(env.PGHOST && env.PGDATABASE);
}

/** Well-known structured codes. Keep in sync with frontend error handling. */
export const DiagnosticCodes = Object.freeze({
    OK: 'OK',
    ENCRYPTION_NOT_CONFIGURED: 'ENCRYPTION_NOT_CONFIGURED',
    ENCRYPTION_WEAK: 'ENCRYPTION_WEAK',
    ENCRYPTION_COLLIDES: 'ENCRYPTION_COLLIDES',
    DB_NOT_CONFIGURED: 'DB_NOT_CONFIGURED',
    DB_UNREACHABLE: 'DB_UNREACHABLE',
    SCHEMA_NOT_MIGRATED: 'SCHEMA_NOT_MIGRATED',
    DB_TLS_RECOMMENDED: 'DB_TLS_RECOMMENDED',
    DB_POOLER_FOR_MIGRATION: 'DB_POOLER_FOR_MIGRATION',
    UNKNOWN: 'UNKNOWN',
});

/**
 * Check that ENCRYPTION_KEY is set, long enough, and distinct from JWT_SECRET.
 * Inspects process.env directly so it runs without touching crypto primitives.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @returns {{ ok: boolean, code: string, hint?: string }}
 */
export function checkEncryptionConfig(env = process.env) {
    const key = env.ENCRYPTION_KEY;
    if (!key) {
        return {
            ok: false,
            code: DiagnosticCodes.ENCRYPTION_NOT_CONFIGURED,
            hint:
                'Set ENCRYPTION_KEY on the host. Generate with: ' +
                "node -e \"console.log(require('crypto').randomBytes(48).toString('base64'))\"",
        };
    }
    if (key.length < 32) {
        return {
            ok: false,
            code: DiagnosticCodes.ENCRYPTION_WEAK,
            hint:
                'ENCRYPTION_KEY must be >=32 chars of entropy. Regenerate with ' +
                "`node -e \"console.log(require('crypto').randomBytes(48).toString('base64'))\"`.",
        };
    }
    if (env.JWT_SECRET && key === env.JWT_SECRET) {
        return {
            ok: false,
            code: DiagnosticCodes.ENCRYPTION_COLLIDES,
            hint: 'ENCRYPTION_KEY must NOT equal JWT_SECRET. Use two distinct random values.',
        };
    }
    return { ok: true, code: DiagnosticCodes.OK };
}

/**
 * Verify the control-plane DB is reachable and the minimum schema needed to
 * create new connections exists. Fast — two tiny queries with a hard timeout
 * so the health endpoint stays cheap.
 *
 * @param {{ query: Function } | null | undefined} pool  pg.Pool or compatible
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=2500]
 * @returns {Promise<{
 *   ok: boolean,
 *   code: string,
 *   hint?: string,
 *   missing?: string[],
 * }>}
 */
export async function checkControlPlaneSchema(pool, { timeoutMs = 2500 } = {}) {
    if (!pool) {
        return {
            ok: false,
            code: DiagnosticCodes.DB_NOT_CONFIGURED,
            hint: 'DATABASE_URL is not set. Point it at the FATHOM control-plane Postgres.',
        };
    }

    // Ping first — distinguish "DB down" from "schema missing"
    try {
        await withTimeout(pool.query('SELECT 1'), timeoutMs, 'pool.query(SELECT 1)');
    } catch (err) {
        return {
            ok: false,
            code: DiagnosticCodes.DB_UNREACHABLE,
            hint: `Control-plane DB is unreachable: ${err.message}. Check DATABASE_URL and network egress.`,
        };
    }

    // Minimum table set a working install needs to create connections.
    // Anything beyond this is a feature-specific concern, not a boot blocker.
    const REQUIRED = ['fathom_connections', 'users'];
    let rows;
    try {
        const res = await withTimeout(
            pool.query(
                `SELECT table_name
                   FROM information_schema.tables
                  WHERE table_schema = 'pgmonitoringtool'
                    AND table_name   = ANY($1::text[])`,
                [REQUIRED],
            ),
            timeoutMs,
            'information_schema.tables lookup',
        );
        rows = res.rows;
    } catch (err) {
        return {
            ok: false,
            code: DiagnosticCodes.DB_UNREACHABLE,
            hint: `information_schema query failed: ${err.message}`,
        };
    }

    const present = new Set(rows.map((r) => r.table_name));
    const missing = REQUIRED.filter((t) => !present.has(t));
    if (missing.length > 0) {
        return {
            ok: false,
            code: DiagnosticCodes.SCHEMA_NOT_MIGRATED,
            missing,
            hint: `Missing tables: ${missing.join(', ')}. Run migrations: ` + '`npm run migrate --workspace=backend`.',
        };
    }

    return { ok: true, code: DiagnosticCodes.OK };
}

/**
 * Combined check — returns a structured report suitable for /api/health and
 * for mapping to HTTP responses in the create-connection handler.
 *
 * @param {object} deps
 * @param {{ query: Function } | null | undefined} deps.pool
 * @param {NodeJS.ProcessEnv}                     [deps.env=process.env]
 * @returns {Promise<{
 *   ok: boolean,
 *   encryption: ReturnType<typeof checkEncryptionConfig>,
 *   schema:     Awaited<ReturnType<typeof checkControlPlaneSchema>>,
 *   blockers:   Array<{ component: string, code: string, hint?: string }>,
 * }>}
 */
/**
 * Identify the control-plane Postgres provider and connection style from the
 * connection string. Pure — no IO. Used to surface Supabase/Neon-specific
 * configuration warnings in diagnostics.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @returns {{
 *   provider: 'supabase'|'neon'|'postgres'|'unknown',
 *   pooled: boolean,        // true if using a pooler host/port (6543)
 *   tls: boolean,           // true if TLS is requested (sslmode=require or DB_SSL)
 *   host: string|null,
 * }}
 */
export function detectDbProvider(env = process.env) {
    const url = env.DATABASE_URL || '';
    let host = null;
    try {
        host = url ? new URL(url).hostname : null;
    } catch {
        host = null;
    }

    const h = (host || '').toLowerCase();
    let provider = 'unknown';
    if (!url && (env.PGHOST || env.PGDATABASE)) provider = 'postgres';
    else if (h.includes('supabase.')) provider = 'supabase';
    else if (h.includes('neon.tech')) provider = 'neon';
    else if (url) provider = 'postgres';

    const pooled = /pooler\./i.test(h) || /:6543(\/|$|\?)/.test(url);
    const tls = /sslmode=require/i.test(url) || env.DB_SSL === 'true' || env.PGSSL === 'true';

    return { provider, pooled, tls, host };
}

/**
 * Provider-aware connection health: confirms reachability and flags the common
 * Supabase/Neon misconfigurations (missing TLS; using the transaction pooler
 * for migrations). Returns ok:true with optional non-blocking warnings.
 *
 * @returns {Promise<{ ok: boolean, code: string, provider: string, warnings: Array<{code:string,hint:string}>, hint?: string }>}
 */
export async function checkDbProvider(pool, { env = process.env, timeoutMs = 2500 } = {}) {
    const info = detectDbProvider(env);
    const warnings = [];

    // Supabase (and any hosted PG) requires TLS. Flag if not requested.
    if ((info.provider === 'supabase' || info.provider === 'neon') && !info.tls) {
        warnings.push({
            code: DiagnosticCodes.DB_TLS_RECOMMENDED,
            hint: `${info.provider} requires TLS. Add sslmode=require to DATABASE_URL or set DB_SSL=true.`,
        });
    }

    // The pooler (6543) is correct for serverless runtime but breaks pg_restore;
    // only warn when this process is the migrator (npm run migrate sets this).
    if (info.pooled && env.FATHOM_RUNNING_MIGRATION === 'true') {
        warnings.push({
            code: DiagnosticCodes.DB_POOLER_FOR_MIGRATION,
            hint: 'Migrations should use the DIRECT connection (port 5432), not the transaction pooler (6543).',
        });
    }

    if (!pool) {
        return {
            ok: false,
            code: DiagnosticCodes.DB_NOT_CONFIGURED,
            provider: info.provider,
            warnings,
            hint: 'DATABASE_URL is not set.',
        };
    }
    try {
        await withTimeout(pool.query('SELECT 1'), timeoutMs, 'pool.query(SELECT 1)');
    } catch (err) {
        return {
            ok: false,
            code: DiagnosticCodes.DB_UNREACHABLE,
            provider: info.provider,
            warnings,
            hint: `Control-plane DB unreachable on ${info.provider}: ${err.message}`,
        };
    }
    return { ok: true, code: DiagnosticCodes.OK, provider: info.provider, warnings };
}

export async function runSystemDiagnostics({ pool, env = process.env } = {}) {
    const encryption = checkEncryptionConfig(env);
    const schema = await checkControlPlaneSchema(pool);
    const provider = await checkDbProvider(pool, { env });

    const blockers = [];
    if (!encryption.ok) {
        blockers.push({ component: 'encryption', code: encryption.code, hint: encryption.hint });
    }
    if (!schema.ok) {
        blockers.push({ component: 'schema', code: schema.code, hint: schema.hint });
    }

    return {
        ok: blockers.length === 0,
        encryption,
        schema,
        provider,
        warnings: provider.warnings || [],
        blockers,
    };
}

/**
 * Classify a thrown error from the create-connection path into a structured
 * code. Pure — safe for the HTTP handler to call in its catch block.
 *
 * @param {Error & { code?: string }} err
 * @returns {{ status: number, code: string, hint?: string }}
 */
export function classifyConnectionError(err) {
    const msg = String(err?.message || '');

    // pg error codes — https://www.postgresql.org/docs/current/errcodes-appendix.html
    if (err?.code === '42P01') {
        return {
            status: 503,
            code: DiagnosticCodes.SCHEMA_NOT_MIGRATED,
            hint: 'Control-plane schema is missing. Run `npm run migrate --workspace=backend`.',
        };
    }
    if (err?.code === '3D000' || err?.code === '3F000') {
        return {
            status: 503,
            code: DiagnosticCodes.DB_NOT_CONFIGURED,
            hint: 'DATABASE_URL points at a database or schema that does not exist.',
        };
    }
    if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.code === 'ETIMEDOUT') {
        return {
            status: 503,
            code: DiagnosticCodes.DB_UNREACHABLE,
            hint: `Control-plane DB unreachable (${err.code}). Check DATABASE_URL + network.`,
        };
    }

    // Encryption service throws `FATAL: ENCRYPTION_KEY …` — sniff by prefix so
    // we stay resilient to exact wording tweaks.
    if (msg.startsWith('FATAL: ENCRYPTION_KEY')) {
        if (msg.includes('must NOT equal JWT_SECRET')) {
            return { status: 503, code: DiagnosticCodes.ENCRYPTION_COLLIDES, hint: msg };
        }
        if (msg.includes('at least 32')) {
            return { status: 503, code: DiagnosticCodes.ENCRYPTION_WEAK, hint: msg };
        }
        return { status: 503, code: DiagnosticCodes.ENCRYPTION_NOT_CONFIGURED, hint: msg };
    }

    return { status: 500, code: DiagnosticCodes.UNKNOWN };
}

// ── internals ───────────────────────────────────────────────────────────────
function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
        Promise.resolve(promise)
            .then((v) => {
                clearTimeout(timer);
                resolve(v);
            })
            .catch((e) => {
                clearTimeout(timer);
                reject(e);
            });
    });
}

export default {
    DiagnosticCodes,
    checkEncryptionConfig,
    checkControlPlaneSchema,
    runSystemDiagnostics,
    classifyConnectionError,
};
