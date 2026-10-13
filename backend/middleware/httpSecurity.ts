// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Rate limiting, security headers and CSRF protection.
// Extracted from server.ts.

import { CONFIG, IS_PROD } from '../core/config.js';
import { log } from '../services/logger.js';
import { rateLimiter as buildRateLimiter } from './rateLimiter.js';

// ── Rate limiting (A1: Redis-backed, in-memory fallback) ────────────────
// The implementation lives in backend/middleware/rateLimiter.js so the
// web tier and the upcoming worker tier share one budget per key when
// REDIS_URL is set. When unset (local dev, Vercel without Upstash), the
// limiter falls back transparently to the prior in-process behaviour.
export const rateLimiter = buildRateLimiter({
    windowMs: CONFIG.RATE_LIMIT.WINDOW_MS,
    maxRequests: CONFIG.RATE_LIMIT.MAX_REQUESTS,
    keyFn: (req) => req.ip || 'unknown',
    prefix: 'pulsedb:rl:global',
});

// strictRateLimiter is a factory used by sensitive endpoints (login,
// password reset). It keys on ip+path so a brute-force attempt against
// /login doesn't share a budget with /forgot-password.
export function strictRateLimiter(windowMs = 60_000, maxReqs = 10) {
    return buildRateLimiter({
        windowMs,
        maxRequests: maxReqs,
        keyFn: (req) => `${req.ip || 'unknown'}:${req.path}`,
        prefix: 'pulsedb:rl:strict',
    });
}

export function securityHeaders(_req, res, next) {
    // ── Equivalent to helmet.js defaults + hardened extras ──────────────
    res.removeHeader('X-Powered-By');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '0'); // Modern best-practice: disable legacy XSS filter
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Download-Options', 'noopen'); // IE-specific download guard
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Origin-Agent-Cluster', '?1');

    // Proper Content Security Policy for API backend
    // Disallow all content embedding and enforce strict policies
    const csp = [
        "default-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        'upgrade-insecure-requests',
    ].join('; ');
    res.setHeader('Content-Security-Policy', csp);

    if (IS_PROD) {
        res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), interest-cohort=()');
    next();
}

// ─────────────────────────────────────────────────────────────────────────────
// CSRF Token Storage (in-memory with TTL, for double-submit cookie pattern)
// ─────────────────────────────────────────────────────────────────────────────
// NOTE (audit H-2): this store is per-process and does NOT survive Vercel's
// serverless instances. The CSRF middleware below therefore treats a token
// MISS as "not presented" (falling back to Origin/Referer proof) rather than a
// hard 403, so cross-instance token misses don't lock out legitimate users.
// For strong, store-independent CSRF, back this with Redis or move to a
// stateless signed double-submit token (HMAC of sid+expiry).
export const csrfTokens = new Map();
const CSRF_TOKEN_TTL = 1 * 60 * 60 * 1000; // 1 hour
// Hard size cap so an unbounded flood of token requests (or a long-lived
// Vercel instance with no sweep) can't grow this Map without bound. Map
// iteration order is insertion order, so we drop the oldest first.
export const CSRF_TOKEN_MAX = 10_000;

/**
 * Drop oldest entries from a Map until its size is at or below `cap`.
 * Safe to call after every insertion as a cheap upper bound — Map iteration
 * is O(n) only in the size of the overflow, not the whole map.
 */
export function trimMapToCap(map, cap) {
    if (map.size <= cap) return;
    const toDrop = map.size - cap;
    let i = 0;
    for (const k of map.keys()) {
        if (i >= toDrop) break;
        map.delete(k);
        i++;
    }
}

// Cleanup stale CSRF tokens every 10 minutes
if (process.env.VERCEL !== '1') {
    setInterval(
        () => {
            const now = Date.now();
            for (const [token, metadata] of csrfTokens) {
                if (now - metadata.createdAt > CSRF_TOKEN_TTL) {
                    csrfTokens.delete(token);
                }
            }
        },
        10 * 60 * 1000,
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CSRF Protection for state-changing requests
// ─────────────────────────────────────────────────────────────────────────────
// Threat model (audit H-1/H-2): the API now supports BOTH `Authorization: Bearer`
// and an httpOnly auth cookie. Browsers attach the cookie automatically on
// cross-site requests, so cookie-authenticated state changes need real CSRF
// protection. Bearer-header requests are inherently CSRF-safe because a
// cross-site page cannot set a custom request header (CORS forbids it without a
// preflight the attacker can't satisfy).
//
// Rule for POST/PUT/PATCH/DELETE:
//   1. If an Origin header is present, it MUST be an allowed origin.
//   2. If the request is authenticated by COOKIE (and not by a Bearer header),
//      require proof of same-origin intent: a trusted Origin/Referer OR a valid
//      X-CSRF-Token. Reject when BOTH are absent.
//   3. Bearer-header requests pass (header itself is the anti-CSRF proof).
//
// The CSRF token store is per-process and does not survive Vercel's serverless
// instances, so a token MISS is treated as "not presented" rather than a hard
// failure — Origin/Referer is the reliable signal in that environment. The
// token path still adds defense-in-depth for same-process clients.
const CSRF_SAFE_PATHS = new Set([
    'POST /api/auth/login', // pre-auth; no cookie/session yet
]);

function isTrustedOrigin(value) {
    if (!value) return false;
    try {
        // Origin is a bare origin; Referer is a full URL — normalise both.
        const u = new URL(value);
        const origin = `${u.protocol}//${u.host}`;
        return CONFIG.CORS_ORIGINS.includes(origin);
    } catch {
        return false;
    }
}

export function csrfProtection(req, res, next) {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    if (CSRF_SAFE_PATHS.has(`${req.method} ${req.path}`)) return next();

    const origin = req.headers.origin;
    // (1) An explicit, disallowed Origin is always rejected.
    if (origin && !CONFIG.CORS_ORIGINS.includes(origin)) {
        return res.status(403).json({ error: 'CSRF: Origin not allowed' });
    }

    const hasBearer = req.headers.authorization?.startsWith('Bearer ');
    const hasAuthCookie = typeof req.headers.cookie === 'string' && req.headers.cookie.includes('pulsedb_token=');
    const csrfToken = req.headers['x-csrf-token'];

    // (2) Validate the CSRF token if one is supplied (double-submit pattern).
    // A miss is non-fatal on serverless (store isn't shared); see note above.
    let csrfTokenValid = false;
    if (csrfToken) {
        const metadata = csrfTokens.get(csrfToken);
        if (metadata && Date.now() - metadata.createdAt <= CSRF_TOKEN_TTL) {
            csrfTokenValid = true;
            csrfTokens.delete(csrfToken); // single-use
        }
    }

    // (3) Cookie-authenticated (and NOT bearer): require same-origin proof.
    if (hasAuthCookie && !hasBearer) {
        const sameOriginProof = isTrustedOrigin(origin) || isTrustedOrigin(req.headers.referer) || csrfTokenValid;
        if (!sameOriginProof) {
            log('WARN', 'CSRF: cookie-auth state change without same-origin proof', {
                ip: req.ip,
                path: req.path,
                method: req.method,
            });
            return res.status(403).json({
                error: 'CSRF check failed: missing Origin/Referer or CSRF token',
            });
        }
    }

    next();
}
