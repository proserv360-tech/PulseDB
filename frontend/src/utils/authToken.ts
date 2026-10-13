/**
 * utils/authToken.ts
 * ------------------
 * Single source of truth for reading/writing the auth JWT on the client.
 *
 * Migration goal: move auth off localStorage (readable by any XSS) and onto an
 * httpOnly cookie set by the backend on login. During the transition the token
 * may live in BOTH places, so every component should go through these helpers
 * instead of touching localStorage directly. Once all callers are migrated and
 * the cookie is the sole carrier, the localStorage branch here can be deleted
 * in ONE place rather than across ~15 files.
 *
 * Note: when the JWT is in an httpOnly cookie it is (by design) NOT readable
 * here -- getToken() will return null and requests should rely on the cookie
 * being sent automatically with `credentials: 'include'`. getToken() therefore
 * exists mainly for legacy header-based calls during migration.
 */

const TOKEN_KEY = 'pulsedb_token';

/** Read the token if it is still in localStorage (legacy/header path). */
export function getToken(): string | null {
    try {
        return localStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

/** Persist the token (legacy path). No-op-safe if storage is unavailable. */
export function setToken(token: string): void {
    try {
        localStorage.setItem(TOKEN_KEY, token);
    } catch {
        /* storage disabled (private mode / cookie-only) -- cookie carries auth */
    }
}

/** Remove the locally-stored token (the cookie is cleared server-side on logout). */
export function clearToken(): void {
    try {
        localStorage.removeItem(TOKEN_KEY);
    } catch {
        /* ignore */
    }
}

/** Authorization header for the legacy header-based path. Empty when cookie-only. */
export function authHeader(): Record<string, string> {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}
