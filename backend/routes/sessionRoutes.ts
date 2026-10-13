// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/sessionRoutes.js
 * ───────────────────────
 * Session management and API key endpoints for the Security panel.
 * Mount with:
 *   app.use('/api', sessionRoutes(pool, authenticate, requireScreen));
 */

import { Router }            from 'express';
import {
    listActiveSessions,
    listUserSessions,
    revokeSession,
    revokeAllUserSessions,
    revokeAllSessions,
    createApiKey,
    listApiKeys,
    revokeApiKey,
    getLoginHeatmap,
    isValidApiKeyScope,
    API_KEY_SCOPES,
} from '../services/sessionService.js';
import { writeAudit }        from '../services/auditService.js';

function log(level, message, meta = {}) {
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg: message, ...meta }));
}

export default function sessionRoutes(pool, authenticate, requireScreen, requireRole) {
    const router  = Router();
    // Guard: must be authenticated AND have the 'admin' or 'super_admin' role.
    // requireScreen('UserManagement') is intentionally NOT used here because
    // session management is a role-level privilege, not a screen-visibility one.
    const isAdmin = [authenticate, requireRole('admin', 'super_admin')];

    /* ── GET /api/sessions ─────────────────────────────────────────────────
       Admin: list all active sessions across all users.                      */
    router.get('/sessions', ...isAdmin, async (req, res) => {
        try {
            const sessions = await listActiveSessions(pool);
            res.json(sessions);
        } catch (err) {
            log('ERROR', 'Failed to list sessions', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── GET /api/sessions/me ──────────────────────────────────────────────
       Current user's own sessions.                                           */
    router.get('/sessions/me', authenticate, async (req, res) => {
        try {
            const sessions = await listUserSessions(pool, req.user.id);
            res.json(sessions);
        } catch (err) {
            log('ERROR', 'Failed to list own sessions', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── GET /api/sessions/user/:userId ────────────────────────────────────
       Admin: sessions for a specific user (User detail drawer).              */
    router.get('/sessions/user/:userId', ...isAdmin, async (req, res) => {
        try {
            const sessions = await listUserSessions(pool, parseInt(req.params.userId));
            res.json(sessions);
        } catch (err) {
            log('ERROR', 'Failed to list user sessions', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── DELETE /api/sessions/:sessionId ───────────────────────────────────
       Admin: revoke a specific session by UUID.                              */
    router.delete('/sessions/:sessionId', ...isAdmin, async (req, res) => {
        try {
            const ok = await revokeSession(pool, req.params.sessionId, req.user.id);
            if (!ok) return res.status(404).json({ error: 'Session not found or already revoked' });

            await writeAudit(pool, {
                actorId:       req.user.id,
                actorUsername: req.user.username,
                action:        'SESSION_REVOKED',
                resourceType:  'session',
                resourceId:    req.params.sessionId,
                level:         'warn',
                ip:            req.ip,
            });

            res.json({ success: true });
        } catch (err) {
            log('ERROR', 'Failed to revoke session', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── DELETE /api/sessions ──────────────────────────────────────────────
       Admin: revoke ALL active sessions (emergency kill-switch).             */
    router.delete('/sessions', ...isAdmin, async (req, res) => {
        try {
            const count = await revokeAllSessions(pool, req.user.id);

            await writeAudit(pool, {
                actorId:       req.user.id,
                actorUsername: req.user.username,
                action:        'ALL_SESSIONS_REVOKED',
                level:         'critical',
                detail:        `${count} sessions revoked`,
                ip:            req.ip,
            });

            log('WARN', 'All sessions revoked', { by: req.user.username, count });
            res.json({ success: true, revoked: count });
        } catch (err) {
            log('ERROR', 'Failed to revoke all sessions', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── DELETE /api/sessions/user/:userId ─────────────────────────────────
       Admin: revoke all sessions for one user.                               */
    router.delete('/sessions/user/:userId', ...isAdmin, async (req, res) => {
        try {
            const userId = parseInt(req.params.userId);
            const count  = await revokeAllUserSessions(pool, userId, req.user.id);

            await writeAudit(pool, {
                actorId:       req.user.id,
                actorUsername: req.user.username,
                action:        'USER_SESSIONS_REVOKED',
                resourceType:  'user',
                resourceId:    userId,
                level:         'warn',
                detail:        `${count} sessions revoked`,
                ip:            req.ip,
            });

            res.json({ success: true, revoked: count });
        } catch (err) {
            log('ERROR', 'Failed to revoke user sessions', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── GET /api/users/:userId/heatmap ────────────────────────────────────
       28-day login activity array for a user's detail drawer.                */
    router.get('/users/:userId/heatmap', authenticate, async (req, res) => {
        try {
            const userId = parseInt(req.params.userId);
            // Users can fetch their own; admins can fetch any
            if (req.user.id !== userId && !['admin', 'super_admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Access denied' });
            }
            const data = await getLoginHeatmap(pool, userId);
            res.json(data);
        } catch (err) {
            log('ERROR', 'Failed to fetch heatmap', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── GET /api/api-keys ─────────────────────────────────────────────────
       Admin: list all active API keys.                                       */
    router.get('/api-keys', ...isAdmin, async (req, res) => {
        try {
            const keys = await listApiKeys(pool);
            res.json(keys);
        } catch (err) {
            log('ERROR', 'Failed to list API keys', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── GET /api/api-keys/mine ─────────────────────────────────────────────
       Current user's own API keys.                                           */
    router.get('/api-keys/mine', authenticate, async (req, res) => {
        try {
            const keys = await listApiKeys(pool, req.user.id);
            res.json(keys);
        } catch (err) {
            log('ERROR', 'Failed to list own API keys', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── POST /api/api-keys ─────────────────────────────────────────────────
       Generate a new API key for the requesting user.
       The full key is returned ONCE — it is never stored in plaintext.       */
    router.post('/api-keys', authenticate, async (req, res) => {
        try {
            const { name, scope } = req.body;
            if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
            if (!req.user.apiAccess && req.user.role !== 'super_admin') {
                return res.status(403).json({ error: 'API key generation not permitted for this account' });
            }

            // `scope` used to be stored verbatim from the request body and never
            // read again. It is now enforced in the authenticate middleware, so
            // it has to be one of the known values — an unrecognised string is
            // treated as read-only at request time and would silently produce a
            // key that cannot write.
            const requestedScope = scope ?? 'read:all';
            if (!isValidApiKeyScope(requestedScope)) {
                return res.status(400).json({
                    error: 'Invalid scope',
                    detail: `scope must be one of: ${API_KEY_SCOPES.join(', ')}`,
                });
            }

            const { key, record } = await createApiKey(pool, req.user.id, name.trim(), requestedScope);

            await writeAudit(pool, {
                actorId:       req.user.id,
                actorUsername: req.user.username,
                action:        'API_KEY_GENERATED',
                resourceType:  'api_key',
                resourceId:    record.id,
                level:         'info',
                detail:        `Key: ${record.prefix}… scope: ${record.scope}`,
                ip:            req.ip,
            });

            log('INFO', 'API key generated', { by: req.user.username, keyId: record.id });
            // key is returned in plaintext ONCE — save it immediately
            res.status(201).json({ key, record });
        } catch (err) {
            log('ERROR', 'Failed to generate API key', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── DELETE /api/api-keys/:id ───────────────────────────────────────────
       Revoke an API key. Admins can revoke any; users can only revoke their own. */
    router.delete('/api-keys/:id', authenticate, async (req, res) => {
        try {
            const keyId = parseInt(req.params.id);
            const ok    = await revokeApiKey(pool, keyId, req.user.id);
            if (!ok) return res.status(404).json({ error: 'Key not found or already revoked' });

            await writeAudit(pool, {
                actorId:       req.user.id,
                actorUsername: req.user.username,
                action:        'API_KEY_REVOKED',
                resourceType:  'api_key',
                resourceId:    keyId,
                level:         'warn',
                ip:            req.ip,
            });

            res.json({ success: true });
        } catch (err) {
            log('ERROR', 'Failed to revoke API key', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    return router;
}