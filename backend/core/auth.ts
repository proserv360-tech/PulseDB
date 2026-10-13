// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// The composed `authenticate` middleware and session issuance.
// Extracted from server.ts.

import jwt from 'jsonwebtoken';
import { buildAuthenticate, buildEnforcePasswordChange } from '../middleware/authenticate.js';
import { writeAudit } from '../services/auditService.js';
import { log } from '../services/logger.js';
import { createSession, recordLogin } from '../services/sessionService.js';
import { touchLastLogin } from '../services/userService.js';
import { pool } from './adminPool.js';
import { CONFIG } from './config.js';

// Build the raw JWT/API-key authenticator, then wrap it so every protected
// route also enforces the "must change password" flag. We expose the wrapped
// version under the name `authenticate` — every existing `app.get(...,
// authenticate, ...)` in this file picks up the password gate for free.
const _rawAuthenticate = buildAuthenticate(pool, CONFIG);
const _enforcePwChange = pool ? buildEnforcePasswordChange(pool) : (_req, _res, next) => next();
export const authenticate = function authenticate(req, res, next) {
    _rawAuthenticate(req, res, (err) => {
        if (err) return next(err);
        if (res.headersSent) return; // 401/403 already sent
        _enforcePwChange(req, res, next);
    });
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTH HELPERS — shared by /api/auth/login and future SSO callbacks
// ─────────────────────────────────────────────────────────────────────────────
// Note: a hardcoded NEW_SCREENS union used to be applied here, granting every
// authenticated user implicit access to ~80 admin/demo screens regardless of
// role. That broke requireScreen() RBAC. The list has been removed — a user's
// allowed_screens column is now the sole source of truth. To grant a user
// access to a new screen, update their row in pgmonitoringtool.users (see
// userService.updateUser → allowedScreens).

/**
 * Create a session row, build a JWT payload, sign the JWT, and run the
 * post-login bookkeeping tasks (touchLastLogin, recordLogin, writeAudit).
 * Failures in the bookkeeping tasks are logged but do not fail the login.
 *
 * @param {{
 *   user: any,
 *   req: import('express').Request,
 *   source: 'password' | 'sso',
 *   provider?: string,           // SSO provider name when source === 'sso'
 *   deviceLabelFallback?: string // device label when no UA header is present
 * }} args
 * @returns {Promise<{ token: string, payload: any, sessionId: string }>}
 */
export async function issueSession({ user, req, source, provider, deviceLabelFallback }) {
    const sessionId = await createSession(pool, {
        userId: user.id,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        deviceLabel: req.headers['user-agent']?.slice(0, 255) ?? (deviceLabelFallback || 'Unknown'),
        location: null,
    });

    const allowedScreens = [...new Set(user.allowed_screens ?? [])];

    const payload = {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        accessLevel: user.access_level,
        allowedScreens,
        sid: sessionId,
    };

    const token = jwt.sign(payload, CONFIG.JWT_SECRET, {
        expiresIn: CONFIG.JWT_EXPIRES_IN,
        audience: CONFIG.JWT_AUDIENCE,
        issuer: CONFIG.JWT_ISSUER,
    });

    const auditAction = source === 'sso' ? 'SSO_LOGIN_SUCCESS' : 'LOGIN_SUCCESS';
    const auditDetail =
        source === 'sso' ? `Logged in via ${provider || 'unknown'}` : req.headers['user-agent']?.slice(0, 120) || '';

    const postTasks = [
        ['touchLastLogin', touchLastLogin(pool, user.id)],
        ['recordLogin', recordLogin(pool, user.id)],
        [
            'writeAudit',
            writeAudit(pool, {
                actorId: user.id,
                actorUsername: user.username,
                action: auditAction,
                level: 'info',
                detail: auditDetail,
                ip: req.ip,
            }),
        ],
    ];
    const results = await Promise.allSettled(postTasks.map(([, p]) => p));
    results.forEach((r, i) => {
        if (r.status === 'rejected') {
            const [name] = postTasks[i];
            log('WARN', `Post-login task '${name}' failed`, {
                task: name,
                source,
                provider,
                error: r.reason?.message,
                userId: user.id,
            });
        }
    });

    return { token, payload, sessionId };
}
