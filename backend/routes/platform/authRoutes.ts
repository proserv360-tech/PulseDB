// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Login, logout, session recovery, CSRF token and password management.
// Extracted from server.ts.

import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { v4 as uuid } from 'uuid';
import { pool } from '../../core/adminPool.js';
import { authenticate, issueSession } from '../../core/auth.js';
import { IS_PROD } from '../../core/config.js';
import { isLoginLocked, recordLoginAttempt } from '../../core/loginLockout.js';
import { invalidatePasswordChangeCache } from '../../middleware/authenticate.js';
import { CSRF_TOKEN_MAX, csrfTokens, strictRateLimiter, trimMapToCap } from '../../middleware/httpSecurity.js';
import { writeAudit } from '../../services/auditService.js';
import { clearAuthCookie, readAuthCookie, setAuthCookie } from '../../services/authCookie.js';
import { swallow } from '../../services/errorHandling.js';
import { log } from '../../services/logger.js';
import { recordFailedLogin, revokeSession } from '../../services/sessionService.js';
import { getUserByUsername } from '../../services/userService.js';

export default function registerAuthRoutes(app) {
    // ─────────────────────────────────────────────────────────────────────────────
    // AUTH — POST /api/auth/logout
    // Revokes the current session (so the JWT can no longer pass the revocation
    // check) and clears the httpOnly auth cookie. Safe to call with either cookie
    // or header auth.
    // ─────────────────────────────────────────────────────────────────────────────
    // ── GET /api/auth/me — cookie-based session recovery ─────────────────────────
    // Called on page load when localStorage token is absent/expired but the
    // httpOnly session cookie may still be valid. Returns fresh user + token.
    app.get('/api/auth/me', authenticate, async (req, res) => {
        try {
            const { rows } = await pool.query(
                'SELECT id, username, email, role, allowed_screens FROM pgmonitoringtool.users WHERE id = $1 LIMIT 1',
                [req.user.id],
            );
            if (!rows[0]) return res.status(404).json({ error: 'User not found' });
            const user = rows[0];

            // SEC: this endpoint used to mint its OWN token, and got four things
            // wrong doing it — it signed with `process.env.JWT_SECRET || 'changeme'`
            // (bypassing the startup guard above), omitted the audience/issuer
            // claims that authenticate() verifies, omitted the `sid` claim that the
            // revocation check requires, and wrote the result to a cookie named
            // `fathom_session` which readAuthCookie() never reads. The token it
            // returned could therefore never authenticate a subsequent request.
            //
            // The correct behaviour: this request ALREADY carried a valid, non-
            // revoked token (authenticate ran ahead of us). Echo that same token
            // back and refresh its cookie — do not mint a new one, and do not
            // create a second session row on every page load.
            const header = req.headers.authorization;
            const token = (header?.startsWith('Bearer ') ? header.slice(7) : null) || readAuthCookie(req);

            if (!token) {
                // Reached when the caller authenticated with an X-API-Key rather
                // than a JWT. There is no session token to echo or refresh, so
                // return the profile alone instead of a null credential.
                return res.json({ user, token: null });
            }

            // Refresh the httpOnly cookie so an active user's cookie TTL tracks the
            // JWT's remaining lifetime rather than expiring earlier.
            const remainingMs = req.user?.exp ? req.user.exp * 1000 - Date.now() : undefined;
            setAuthCookie(res, token, Number.isFinite(remainingMs) && remainingMs > 0 ? remainingMs : undefined);

            res.json({ user, token });
        } catch (e) {
            log('ERROR', '/api/auth/me error', { error: e.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.post('/api/auth/logout', authenticate, async (req, res) => {
        // Server-side revocation is the part that makes logout mean anything: the
        // JWT stays cryptographically valid until it expires, so if the session row
        // is not marked inactive the token keeps working after "logout".
        //
        // This used to be `.catch(() => {})` and still returned `{success: true}`.
        // On the deployed database revokeSession throws 42703 (revoked_at/revoked_by
        // do not exist), so every logout has been silently failing while reporting
        // success. 11 of 12 sessions sit flagged is_active with expiry in the past —
        // the signature of revocation never once running.
        let revoked = false;
        try {
            if (pool && req.user?.sid) {
                revoked = await revokeSession(pool, req.user.sid, req.user.id);
            }
        } catch (err) {
            swallow(err, { component: 'session', op: 'revokeSession', sid: req.user?.sid, userId: req.user?.id });
        } finally {
            // Always clear the cookie: the local credential goes regardless of
            // whether the server-side row could be updated.
            clearAuthCookie(res);
        }

        // Report honestly. The client still treats this as a successful logout —
        // the cookie is gone — but `revoked` tells the caller (and anyone reading
        // logs or tests) whether the session was actually killed server-side.
        res.json({ success: true, revoked });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // CSRF Token Endpoint
    // ─────────────────────────────────────────────────────────────────────────────
    app.get('/api/csrf-token', authenticate, (req, res) => {
        // Generate a random CSRF token
        trimMapToCap(csrfTokens, CSRF_TOKEN_MAX);
        const token = randomUUID();
        csrfTokens.set(token, { createdAt: Date.now() });
        res.json({ csrfToken: token });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // AUTH — POST /api/auth/login
    // ─────────────────────────────────────────────────────────────────────────────
    app.post('/api/auth/login', strictRateLimiter(15 * 60_000, 10), async (req, res) => {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'username and password are required' });
        }
        if (typeof username !== 'string' || username.length > 128) {
            return res.status(400).json({ error: 'Invalid username' });
        }
        if (typeof password !== 'string' || password.length > 256) {
            return res.status(400).json({ error: 'Invalid password' });
        }

        // If no admin database pool is available, authentication is impossible
        if (!pool && IS_PROD) {
            return res.status(503).json({
                error: 'Authentication service unavailable',
                detail: 'Admin database is not configured. Set DATABASE_URL in environment variables.',
            });
        }

        if (isLoginLocked(username)) {
            return res.status(429).json({ error: 'Too many failed login attempts. Try again in 15 minutes.' });
        }

        try {
            // SEC-02 (audit): The hardcoded admin/admin123 demo-login fallback was
            // removed. Authentication ALWAYS goes through the admin database; if
            // DATABASE_URL is unset the request returns 503 above.
            const user = await getUserByUsername(pool, username);

            if (!user || !(await bcrypt.compare(password, user.password_hash))) {
                recordLoginAttempt(username, false);
                if (user) {
                    await recordFailedLogin(pool, user.id).catch((err) =>
                        log('WARN', 'recordFailedLogin failed', { userId: user.id, error: err.message }),
                    );
                    await writeAudit(pool, {
                        actorId: user.id,
                        actorUsername: username,
                        action: 'LOGIN_FAILED',
                        level: 'warn',
                        detail: 'Invalid credentials',
                        ip: req.ip,
                    }).catch((err) =>
                        log('WARN', 'writeAudit LOGIN_FAILED failed', { userId: user.id, error: err.message }),
                    );
                }
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            if (user.status !== 'active') {
                return res.status(403).json({ error: `Account is ${user.status}` });
            }

            recordLoginAttempt(username, true);
            const { token, payload } = await issueSession({
                user,
                req,
                source: 'password',
            });

            // Also set the JWT as an httpOnly cookie so the frontend can stop
            // storing it in localStorage (XSS-exfiltratable). The token is still
            // returned in the body for backward compatibility during migration.
            setAuthCookie(res, token);

            res.json({
                token,
                user: payload,
                mustChangePassword: user.must_change_password || user.password_changed_at == null || false,
            });
        } catch (err) {
            // The real error (message, stack, pg code) is logged server-side; the
            // response deliberately omits `detail` — this is an UNAUTHENTICATED
            // endpoint and echoing err.message here leaked Postgres internals to any
            // caller (audit 2026-07-02 M-2 / 2026-07-24). requestId lets an operator
            // correlate the client-visible failure with the server log.
            log('ERROR', 'Login error', { error: err.message, stack: err.stack, code: err.code, requestId: req.id });
            res.status(500).json({ error: 'Login failed', requestId: req.id });
        }
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // SSO — removed. The legacy /api/auth/sso/:provider* routes and the
    // /api/auth/sso/exchange endpoint used to log anyone in as the local `admin`
    // user (the callback hardcoded { email: 'admin@company.com' } and did no IdP
    // roundtrip). Production SSO lives in routes/samlRoutes.js (mounted at
    // /api/saml/...). If you need an OIDC fallback, add a route here that fully
    // validates the provider's code/state and never returns a token tied to a
    // hardcoded local account.
    // ─────────────────────────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────────────────────────
    // PASSWORD MANAGEMENT — Change Password
    // ─────────────────────────────────────────────────────────────────────────────
    app.post('/api/auth/change-password', strictRateLimiter(15 * 60_000, 10), authenticate, async (req, res) => {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'currentPassword and newPassword are required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
            return res.status(400).json({ error: 'Password must contain lowercase, uppercase, and numbers' });
        }

        try {
            const user = await getUserByUsername(pool, req.user.username);
            if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
                return res.status(401).json({ error: 'Current password is incorrect' });
            }

            // bcrypt cost 12 matches services/userService.js — keep all password
            // hashing across the codebase at the same cost factor.
            const newPasswordHash = await bcrypt.hash(newPassword, 12);
            const result = await pool.query(
                'UPDATE pgmonitoringtool.users SET password_hash = $1, must_change_password = false, password_changed_at = NOW() WHERE id = $2 RETURNING id, username, email',
                [newPasswordHash, userId],
            );
            // The flag this clears is cached per user in enforcePasswordChange;
            // without this the block would persist for up to the TTL after the
            // user has done exactly what it asked.
            invalidatePasswordChangeCache(userId);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            log('INFO', 'Password changed', { userId, username: req.user.username });
            await writeAudit(pool, {
                actorId: userId,
                actorUsername: req.user.username,
                action: 'PASSWORD_CHANGED',
                level: 'info',
                detail: 'User changed their password',
                ip: req.ip,
            }).catch((err) => log('WARN', 'writeAudit PASSWORD_CHANGED failed', { userId, error: err.message }));

            res.json({ success: true, message: 'Password changed successfully' });
        } catch (err) {
            log('ERROR', 'Change password error', { error: err.message, userId });
            res.status(500).json({ error: 'Failed to change password' });
        }
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // PASSWORD MANAGEMENT — Forgot Password (Request Reset) — DB-backed tokens
    // ─────────────────────────────────────────────────────────────────────────────

    // Rate-limit: 5 attempts per 15 minutes per IP+path. Even if an attacker
    // rotates user identifiers, they can't grind through a list quickly.
    app.post('/api/auth/forgot-password', strictRateLimiter(15 * 60_000, 5), async (req, res) => {
        const { email, username } = req.body || {};

        if (!email && !username) {
            return res.status(400).json({ error: 'Email or username is required' });
        }

        // SEC: equalize response timing between "user exists" (DB insert) and
        // "user does not exist" (no insert) so an attacker can't enumerate
        // accounts by measuring response latency. We always do the DB lookup,
        // and when the user is missing we still wait at least as long as the
        // typical insert path would take before returning.
        const MIN_RESPONSE_MS = 250;
        const startedAt = Date.now();

        const finishWithGenericSuccess = async (devToken) => {
            const elapsed = Date.now() - startedAt;
            if (elapsed < MIN_RESPONSE_MS) {
                await new Promise((r) => setTimeout(r, MIN_RESPONSE_MS - elapsed));
            }
            res.json({
                success: true,
                message: 'If the account exists, a reset link has been sent.',
                // Debug only — never exposed in production. The dev convenience
                // also leaks the existence of the account in non-prod environments;
                // do not log it anywhere else.
                ...(devToken && process.env.NODE_ENV !== 'production' && { resetToken: devToken }),
            });
        };

        try {
            // Find user by email or username
            let user;
            if (email) {
                const result = await pool.query(
                    'SELECT id, username, email FROM pgmonitoringtool.users WHERE email = $1 AND status = $2',
                    [email, 'active'],
                );
                user = result.rows[0];
            } else {
                user = await getUserByUsername(pool, username);
            }

            if (!user) {
                log('INFO', 'Password reset requested for non-existent account', { email, username });
                return finishWithGenericSuccess(null);
            }

            // Generate reset token and persist to DB
            const token = uuid();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
            await pool.query(
                `INSERT INTO pgmonitoringtool.password_reset_tokens (user_id, token, expires_at)
             VALUES ($1, $2, $3)`,
                [user.id, token, expiresAt],
            );

            log('INFO', 'Password reset token generated (DB)', { userId: user.id, username: user.username });

            // In production, send email here with reset link
            return finishWithGenericSuccess(token);
        } catch (err) {
            log('ERROR', 'Forgot password error', { error: err.message });
            res.status(500).json({ error: 'Failed to process reset request' });
        }
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // PASSWORD MANAGEMENT — Reset Password (Using DB-backed Token)
    // ─────────────────────────────────────────────────────────────────────────────
    app.post('/api/auth/reset-password', strictRateLimiter(15 * 60_000, 5), async (req, res) => {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'token and newPassword are required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
            return res.status(400).json({ error: 'Password must contain lowercase, uppercase, and numbers' });
        }

        try {
            // Look up token in DB (unused + not expired)
            const tokenResult = await pool.query(
                `SELECT id, user_id, expires_at FROM pgmonitoringtool.password_reset_tokens
             WHERE token = $1 AND used = false`,
                [token],
            );
            const tokenData = tokenResult.rows[0];

            if (!tokenData) {
                log('WARN', 'Invalid password reset token', {});
                return res.status(400).json({ error: 'Invalid or expired reset token' });
            }

            if (new Date() > new Date(tokenData.expires_at)) {
                // Mark as used so it can't be retried
                await pool.query('UPDATE pgmonitoringtool.password_reset_tokens SET used = true WHERE id = $1', [
                    tokenData.id,
                ]);
                log('WARN', 'Password reset token expired', { userId: tokenData.user_id });
                return res.status(400).json({ error: 'Reset token has expired' });
            }

            // Update password — bcrypt cost 12 (matches services/userService.js).
            const newPasswordHash = await bcrypt.hash(newPassword, 12);
            const result = await pool.query(
                'UPDATE pgmonitoringtool.users SET password_hash = $1, must_change_password = false, password_changed_at = NOW() WHERE id = $2 RETURNING id, username',
                [newPasswordHash, tokenData.user_id],
            );
            invalidatePasswordChangeCache(tokenData.user_id);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Invalidate token in DB
            await pool.query('UPDATE pgmonitoringtool.password_reset_tokens SET used = true WHERE id = $1', [
                tokenData.id,
            ]);

            log('INFO', 'Password reset completed', { userId: tokenData.user_id, username: result.rows[0].username });
            await writeAudit(pool, {
                actorId: tokenData.user_id,
                actorUsername: result.rows[0].username,
                action: 'PASSWORD_RESET',
                level: 'info',
                detail: 'Password reset via token',
                ip: req.ip,
            }).catch((err) =>
                log('WARN', 'writeAudit PASSWORD_RESET failed', { userId: tokenData.user_id, error: err.message }),
            );

            res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
        } catch (err) {
            log('ERROR', 'Reset password error', { error: err.message });
            res.status(500).json({ error: 'Failed to reset password' });
        }
    });
}
