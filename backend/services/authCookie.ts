/**
 * services/authCookie.ts
 * ----------------------
 * httpOnly cookie helpers for the auth JWT.
 *
 * Why: storing the JWT in localStorage exposes it to any XSS on the page. An
 * httpOnly cookie is unreadable from JavaScript, so a script injection can no
 * longer exfiltrate the token. We issue the SAME JWT both ways during the
 * migration -- the cookie is set on login and the middleware accepts it as a
 * fallback to the Authorization header -- so existing header-based clients keep
 * working while we move the frontend off localStorage.
 *
 * No new dependency: we read the single cookie we care about straight off the
 * Cookie header (avoids adding cookie-parser and the lockfile churn that comes
 * with it). res.cookie()/res.clearCookie() are built into Express.
 */

import type { Request, Response, CookieOptions } from 'express';

export const AUTH_COOKIE_NAME = 'pulsedb_token';

/**
 * Cookie options for the auth token.
 * - httpOnly: not readable by JS (the whole point)
 * - secure:   only over HTTPS in production
 * - sameSite: 'lax' is a good default that still allows top-level navigations;
 *             use 'none' (with secure) only if the API is on a different site
 *             than the app and cross-site XHR must carry the cookie.
 */
export function authCookieOptions(maxAgeMs?: number): CookieOptions {
    const isProd = process.env.NODE_ENV === 'production';
    const crossSite = process.env.AUTH_COOKIE_SAMESITE === 'none';
    return {
        httpOnly: true,
        secure: isProd || crossSite,
        sameSite: crossSite ? 'none' : 'lax',
        path: '/',
        ...(typeof maxAgeMs === 'number' && Number.isFinite(maxAgeMs) ? { maxAge: maxAgeMs } : {}),
    };
}

/** Set the auth JWT as an httpOnly cookie on the response. */
export function setAuthCookie(res: Response, token: string, maxAgeMs?: number): void {
    res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions(maxAgeMs));
}

/** Clear the auth cookie (logout). */
export function clearAuthCookie(res: Response): void {
    // clearCookie must be given matching attributes to reliably expire the cookie.
    const { maxAge: _maxAge, ...opts } = authCookieOptions();
    res.clearCookie(AUTH_COOKIE_NAME, opts);
}

/**
 * Read the auth JWT from the request's Cookie header, if present.
 * Minimal parser -- only extracts AUTH_COOKIE_NAME, no full cookie-jar logic.
 * Returns the raw token string or null.
 */
export function readAuthCookie(req: Request): string | null {
    // If cookie-parser is ever added, prefer its parsed object.
    const parsed = (req as Request & { cookies?: Record<string, string> }).cookies;
    if (parsed && parsed[AUTH_COOKIE_NAME]) {
        return parsed[AUTH_COOKIE_NAME];
    }
    const header = req.headers?.cookie;
    if (!header) return null;
    for (const part of header.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        const name = part.slice(0, idx).trim();
        if (name === AUTH_COOKIE_NAME) {
            return decodeURIComponent(part.slice(idx + 1).trim());
        }
    }
    return null;
}
