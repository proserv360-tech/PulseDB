// ==========================================================================
//  FATHOM — Auth Context  (v2.0 — aligned with actual server.js)
// ==========================================================================
//  Server endpoints used:
//    • POST /api/auth/login → { user, token }
//    • GET /api/auth/sso/:provider → Initiates SSO redirect
//    • GET /api/auth/me → { user, token } for cookie-based session recovery.
//      (It does exist — the previous note here said it didn't. It returns the
//      caller's existing token and refreshes the httpOnly cookie; it does not
//      mint a new session. `token` is null when authenticating via X-API-Key.)
// ==========================================================================

import { authHeader } from '../utils/authToken';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const API_BASE =
    import.meta.env.VITE_API_URL ||
    (() => {
        console.warn('VITE_API_URL not set, using relative URLs');
        return '';
    })();
const STORAGE_KEYS = {
    TOKEN: 'fathom_token',
    USER: 'fathom_user',
    // Why the user is looking at the login page. Written on the way out, read
    // once by LoginPage, then cleared. Survives the unmount that React state
    // would not: logout() clears currentUser, which immediately routes to
    // /login and destroys the provider's in-memory reason before anything
    // renders it.
    EXIT_REASON: 'fathom_exit_reason',
    // Last username to sign in successfully. Deliberately NOT cleared on
    // logout — someone signing out is usually about to sign back in, often as
    // a different person, and retyping the address is the tax on that.
    LAST_USER: 'fathom_last_username',
};

// Exit reasons, in ascending order of "this was not your fault".
export const EXIT_REASONS = {
    SIGNED_OUT: 'signed_out', // clicked Sign Out
    EXPIRED: 'expired',       // token ran out
    REVOKED: 'revoked',       // server rejected the session (401)
};

// ═══════════════════════════════════════════════════════════════════════════
//  SEC-002: Dual-mode auth storage
//  Primary: httpOnly cookie (set by server on login/SSO — not readable by JS)
//  Fallback: localStorage for token expiry checks and user object caching
//  The JWT in localStorage is used ONLY for client-side expiry checks;
//  the actual auth credential sent to the server is the httpOnly cookie.
// ═══════════════════════════════════════════════════════════════════════════
const secureStorage = {
    getItem(key) {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    },
    setItem(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn('[Auth] Storage write failed:', e?.message);
        }
    },
    removeItem(key) {
        try {
            localStorage.removeItem(key);
        } catch {}
    },
};

// ═══════════════════════════════════════════════════════════════════════════
//  JWT HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function parseJWT(token) {
    try {
        const base64 = token.split('.')[1];
        return JSON.parse(atob(base64.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
        return null;
    }
}

function isTokenExpired(token) {
    const payload = parseJWT(token);
    return !payload?.exp || Date.now() >= payload.exp * 1000;
}

function tokenExpiresIn(token) {
    const payload = parseJWT(token);
    return payload?.exp ? Math.max(0, payload.exp * 1000 - Date.now()) : 0;
}

// ═══════════════════════════════════════════════════════════════════════════
//  CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const AuthContext = createContext(null);

// Survives a login-page remount within one page load; reset by a full refresh.
// See consumeExitReason().
let _consumedExitReason = null;

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true); // initial session restore
    const [authLoading, setAuthLoading] = useState(false); // login in progress
    const [error, setError] = useState(null);
    const [mustChangePassword, setMustChangePassword] = useState(
        () => secureStorage.getItem('fathom_must_change_password') === 'true',
    );

    // ── Restore session on mount ───────────────────────────────────────────
    // Try localStorage first (instant, no network). If token is expired or
    // absent, fall back to GET /api/auth/me which validates the httpOnly
    // cookie — this recovers sessions after a hard refresh where the cookie
    // is still valid but localStorage was cleared.
    useEffect(() => {
        (async () => {
            try {
                const token = secureStorage.getItem(STORAGE_KEYS.TOKEN);
                const stored = secureStorage.getItem(STORAGE_KEYS.USER);
                if (token && stored && !isTokenExpired(token)) {
                    setCurrentUser(JSON.parse(stored));
                    setLoading(false);
                    return;
                }
                // localStorage stale/absent — try cookie-based session recovery
                try {
                    // Bound the session-recovery request: a slow/hung backend
                    // must not pin the whole app on the loading spinner. On
                    // timeout we fall through to the login page (user can sign in).
                    const res = await fetch(`${API_BASE}/api/auth/me`, {
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        signal: AbortSignal.timeout(5000),
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.user && data.token) {
                            // Store token in localStorage for client-side expiry checks only.
                            // The actual auth credential is the httpOnly cookie set by the server.
                            secureStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
                            secureStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
                            setCurrentUser(data.user);
                        }
                    }
                } catch {
                    /* network unavailable — stay logged out */
                }
            } catch {
                secureStorage.removeItem(STORAGE_KEYS.TOKEN);
                secureStorage.removeItem(STORAGE_KEYS.USER);
            }
            setLoading(false);
        })();
    }, []);

    // ── Involuntary session end ────────────────────────────────────────────
    // Shared by the 401 listener and the expiry poll. Records why so the login
    // page can say something more useful than nothing. Note what it does NOT
    // clear: pg_monitor_active_tab survives, because being timed out should
    // not also cost you your place — see logout() for the deliberate case.
    const endSession = useCallback((reason) => {
        secureStorage.removeItem(STORAGE_KEYS.TOKEN);
        secureStorage.removeItem(STORAGE_KEYS.USER);
        secureStorage.setItem(STORAGE_KEYS.EXIT_REASON, reason);
        setCurrentUser(null);
        setError(
            reason === EXIT_REASONS.REVOKED
                ? 'Your session was ended. Sign in again to continue.'
                : 'Your session expired. Sign in again to continue.',
        );
    }, []);

    // ── Listen for forced logout (401 from api.js) ─────────────────────────
    useEffect(() => {
        const onLogout = () => {
            // A 401 on an already-expired token is an ordinary timeout. A 401
            // on a token that still looks valid means the server revoked it —
            // an admin ended the session, or the password changed elsewhere.
            const token = secureStorage.getItem(STORAGE_KEYS.TOKEN);
            endSession(
                !token || isTokenExpired(token) ? EXIT_REASONS.EXPIRED : EXIT_REASONS.REVOKED,
            );
        };
        window.addEventListener('auth:logout', onLogout);
        return () => window.removeEventListener('auth:logout', onLogout);
    }, [endSession]);

    // ── Periodic token expiry check ────────────────────────────────────────
    // 15s window so a token that expires mid-session is noticed quickly even
    // if the user is idle (and isn't making API calls that would 401 first).
    // The real source of truth is the 401 → auth:logout event from api.ts;
    // this is just a belt-and-suspenders client-side guard.
    useEffect(() => {
        if (!currentUser) return;
        const interval = setInterval(() => {
            const token = secureStorage.getItem(STORAGE_KEYS.TOKEN);
            if (!token || isTokenExpired(token)) {
                endSession(EXIT_REASONS.EXPIRED);
            }
        }, 15000);
        return () => clearInterval(interval);
    }, [currentUser, endSession]);

    // ── Standard Login ─────────────────────────────────────────────────────
    const login = useCallback(async (username, password) => {
        setAuthLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                credentials: 'include', // accept the httpOnly auth cookie set by the server
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || 'Login failed');
            }
            if (!data.user || !data.token) {
                throw new Error('Invalid server response');
            }

            // Clear previous user's cached data before setting new session
            // This prevents stale data from a different user leaking into the new session
            const prevUser = secureStorage.getItem(STORAGE_KEYS.USER);
            const prevParsed = prevUser ? JSON.parse(prevUser) : null;
            if (!prevParsed || prevParsed.username !== data.user.username) {
                secureStorage.removeItem('pg_monitor_active_tab');
                secureStorage.removeItem('fathom_active_connection_id');
                secureStorage.removeItem('fathom_custom_dashboards');
                secureStorage.removeItem('fathom_active_dashboard');
                secureStorage.removeItem('fathom_repos_v10');
                secureStorage.removeItem('fathom_recent_tabs');
                secureStorage.removeItem('fathom_last_feedback');
            }

            secureStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
            secureStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
            // Remember what they typed, not what the server echoed back — the
            // login form takes an email or a username and they may differ.
            secureStorage.setItem(STORAGE_KEYS.LAST_USER, username);
            secureStorage.removeItem(STORAGE_KEYS.EXIT_REASON);
            _consumedExitReason = null;
            if (data.mustChangePassword) {
                secureStorage.setItem('fathom_must_change_password', 'true');
                setMustChangePassword(true);
            } else {
                secureStorage.removeItem('fathom_must_change_password');
                setMustChangePassword(false);
            }
            setCurrentUser(data.user);
            return { ...data.user, mustChangePassword: data.mustChangePassword };
        } catch (err) {
            const msg = err instanceof TypeError ? 'Unable to reach server. Check your connection.' : err.message;
            setError(msg);
            throw err;
        } finally {
            setAuthLoading(false);
        }
    }, []);

    // ── SSO Login Initiation ───────────────────────────────────────────────
    const loginWithSSO = useCallback((provider = 'okta') => {
        // Redirects the browser to the backend endpoint that initiates the OAuth/SAML flow
        window.location.href = `${API_BASE}/api/auth/sso/${provider}`;
    }, []);

    // ── SSO Callback Handler ───────────────────────────────────────────────
    const handleSSOCallback = useCallback((token, user) => {
        // Clear previous user's cached data before setting new SSO session
        const prevUser = secureStorage.getItem(STORAGE_KEYS.USER);
        const prevParsed = prevUser
            ? (() => {
                  try {
                      return JSON.parse(prevUser);
                  } catch {
                      return null;
                  }
              })()
            : null;
        if (!prevParsed || prevParsed.username !== user.username) {
            secureStorage.removeItem('pg_monitor_active_tab');
            secureStorage.removeItem('fathom_active_connection_id');
            secureStorage.removeItem('fathom_custom_dashboards');
            secureStorage.removeItem('fathom_active_dashboard');
            secureStorage.removeItem('fathom_repos_v10');
            secureStorage.removeItem('fathom_recent_tabs');
            secureStorage.removeItem('fathom_last_feedback');
        }
        secureStorage.setItem(STORAGE_KEYS.TOKEN, token);
        secureStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        setCurrentUser(user);
    }, []);

    // ── Logout ─────────────────────────────────────────────────────────────
    const logout = useCallback(() => {
        // Server logout: revokes the session token in DB and instructs the
        // browser to clear the httpOnly cookie via Set-Cookie: Max-Age=0.
        // Fire-and-forget so UI logout is never blocked by network issues.
        try {
            fetch(`${API_BASE}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include', // sends the httpOnly cookie
                headers: { 'Content-Type': 'application/json', ...authHeader() },
            }).catch(() => {});
        } catch {
            /* ignore */
        }
        secureStorage.removeItem(STORAGE_KEYS.TOKEN);
        secureStorage.removeItem(STORAGE_KEYS.USER);
        // Deliberate sign-out starts fresh: next login opens Overview with no
        // connection selected. This is the branch that SHOULD clear these —
        // endSession() leaves them alone, because a timeout is not a request
        // to be put back at the beginning.
        secureStorage.removeItem('pg_monitor_active_tab');
        secureStorage.removeItem('fathom_active_connection_id');
        // Clear password-change flag so it's re-evaluated on next login
        secureStorage.removeItem('fathom_must_change_password');
        secureStorage.setItem(STORAGE_KEYS.EXIT_REASON, EXIT_REASONS.SIGNED_OUT);
        setMustChangePassword(false);
        setCurrentUser(null);
        setError(null);
    }, []);

    // ── Exit reason (read-once per page load) ──────────────────────────────
    // LoginPage calls this on mount. Taking the value clears storage, so a
    // full refresh doesn't keep re-announcing a sign-out from ten minutes ago.
    //
    // The module-scope cache is not an optimisation: StrictMode double-invokes
    // state initialisers in dev, and the login page can remount within one page
    // load (modal open/close). A naive read-and-delete returns the reason to
    // the first caller and null to the second, so the banner appears and then
    // silently vanishes. Hand the same value back until a NEW reason is
    // written, which is exactly what the next logout does.
    const consumeExitReason = useCallback(() => {
        const reason = secureStorage.getItem(STORAGE_KEYS.EXIT_REASON);
        if (reason) {
            secureStorage.removeItem(STORAGE_KEYS.EXIT_REASON);
            _consumedExitReason = reason;
            return reason;
        }
        return _consumedExitReason;
    }, []);

    const getLastUsername = useCallback(() => secureStorage.getItem(STORAGE_KEYS.LAST_USER) || '', []);

    const forgetLastUsername = useCallback(() => {
        secureStorage.removeItem(STORAGE_KEYS.LAST_USER);
    }, []);

    // ── RBAC helpers ───────────────────────────────────────────────────────
    const hasRole = useCallback((...roles) => (currentUser ? roles.includes(currentUser.role) : false), [currentUser]);

    const hasScreen = useCallback((screen) => currentUser?.allowedScreens?.includes(screen) ?? false, [currentUser]);

    const canWrite = useMemo(() => currentUser?.accessLevel === 'write', [currentUser]);

    const isAdmin = useMemo(() => currentUser?.role === 'super_admin', [currentUser]);

    // ── Token accessors ────────────────────────────────────────────────────
    const getToken = useCallback(() => secureStorage.getItem(STORAGE_KEYS.TOKEN), []);

    // Returns the base WS URL (no token in URL — client sends auth as first message)
    const getWSUrl = useCallback(() => {
        if (!getToken()) return null;
        const wsBase = API_BASE.replace(/^http/, 'ws');
        return `${wsBase}/ws`;
    }, [getToken]);

    // ── Session info ───────────────────────────────────────────────────────
    const sessionInfo = useMemo(() => {
        const token = secureStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) return null;
        const remaining = tokenExpiresIn(token);
        return {
            remainingMinutes: Math.floor(remaining / 60000),
            expiresAt: new Date(Date.now() + remaining),
        };
    }, [currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Context value ──────────────────────────────────────────────────────
    // Allow external code (e.g. ForcePasswordChangeModal) to clear the flag
    const clearMustChangePassword = useCallback(() => {
        secureStorage.removeItem('fathom_must_change_password');
        setMustChangePassword(false);
    }, []);

    const value = useMemo(
        () => ({
            currentUser,
            loading,
            authLoading,
            error,
            isAuthenticated: !!currentUser,
            sessionInfo,
            mustChangePassword,
            clearMustChangePassword,
            consumeExitReason,
            getLastUsername,
            forgetLastUsername,
            login,
            loginWithSSO,
            handleSSOCallback,
            logout,
            clearError: () => setError(null),
            hasRole,
            hasScreen,
            canWrite,
            isAdmin,
            getToken,
            getWSUrl,
        }),
        [
            currentUser,
            loading,
            authLoading,
            error,
            sessionInfo,
            mustChangePassword,
            clearMustChangePassword,
            consumeExitReason,
            getLastUsername,
            forgetLastUsername,
            login,
            loginWithSSO,
            handleSSOCallback,
            logout,
            hasRole,
            hasScreen,
            canWrite,
            isAdmin,
            getToken,
            getWSUrl,
        ],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
    return ctx;
};

export default AuthContext;
