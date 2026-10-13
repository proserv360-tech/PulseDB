// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/userRoutes.js
 * ────────────────────
 * All /api/users endpoints — replaces the in-memory USERS array in server.js.
 * Mount with:
 *   import userRoutes from './routes/userRoutes.js';
 *   app.use('/api', userRoutes(pool, authenticate, requireScreen));
 */

import { Router }            from 'express';
import {
    listUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    bulkDeleteUsers,
    resetUserPassword,
    usernameExists,
    emailExists,
} from '../services/userService.js';
import { validate } from '../middleware/validate.js';
import { CreateUserSchema, UpdateUserSchema, ResetPasswordSchema } from '../../shared/validators/index.js';
import { writeAudit }        from '../services/auditService.js';

function log(level, message, meta = {}) {
    const entry = { ts: new Date().toISOString(), level, msg: message, ...meta };
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(JSON.stringify(entry));
}

/**
 * Validates user input for creation and updates.
 * Returns an object with { valid: boolean, error?: string }
 */
function validateUserInput(userData) {
    const { username, password, name, email, role } = userData;

    // Email validation - simple regex
    if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { valid: false, error: 'Email must be in valid format (e.g., user@example.com)' };
        }
    }

    // Username validation - 3-50 chars, alphanumeric + underscore only
    if (username) {
        if (username.length < 3 || username.length > 50) {
            return { valid: false, error: 'Username must be between 3 and 50 characters' };
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
        }
    }

    // Password validation - minimum 8 characters
    if (password) {
        if (password.length < 8) {
            return { valid: false, error: 'Password must be at least 8 characters' };
        }
    }

    // Name validation - 1-100 characters
    if (name) {
        if (name.length < 1 || name.length > 100) {
            return { valid: false, error: 'Name must be between 1 and 100 characters' };
        }
    }

    // Role validation - must be one of allowed roles
    if (role) {
        const VALID_ROLES = ['super_admin', 'admin', 'developer', 'analyst', 'viewer'];
        if (!VALID_ROLES.includes(role)) {
            return { valid: false, error: `Role must be one of: ${VALID_ROLES.join(', ')}` };
        }
    }

    return { valid: true };
}

// ── Per-route rate limiter (used on password-reset) ─────────────────────────
const _pwResetBuckets = new Map();
function pwResetLimiter(req, res, next) {
    const key = `${req.ip || 'unknown'}:${req.params.id || ''}`;
    const now = Date.now();
    const WINDOW = 15 * 60_000; // 15 minutes
    const MAX    = 5;            // 5 attempts per IP per user per window
    let b = _pwResetBuckets.get(key);
    if (!b || now - b.windowStart > WINDOW) {
        b = { windowStart: now, count: 0 };
        _pwResetBuckets.set(key, b);
    }
    if (++b.count > MAX) {
        return res.status(429).json({ error: 'Too many password reset attempts. Try again later.' });
    }
    next();
}

/**
 * Validates password strength.
 * Returns an error string if invalid, or null if OK.
 */
function validatePasswordStrength(password) {
    if (!password || typeof password !== 'string') return 'Password is required';
    if (password.length < 10) return 'Password must be at least 10 characters';
    if (password.length > 256) return 'Password must not exceed 256 characters';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain at least one special character';
    return null;
}

/**
 * @param {import('pg').Pool} pool
 * @param {Function} authenticate  - middleware
 * @param {Function} requireScreen - middleware factory
 * @param {Function} requireRole   - middleware factory
 */
export default function userRoutes(pool, authenticate, requireScreen, requireRole) {
    const router = Router();
    const guard  = [authenticate, requireRole('super_admin'), requireScreen('UserManagement')];

    /* ── GET /api/user/profile ─────────────────────────────────────────────
       Self-service: returns the authenticated user's own profile.            */
    router.get('/user/profile', authenticate, async (req, res) => {
        try {
            const user = await getUserById(pool, req.user.id);
            if (!user) return res.status(404).json({ error: 'User not found' });
            res.json({
                id:        user.id,
                username:  user.username,
                fullName:  user.name,
                email:     user.email,
                role:      user.role,
                status:    user.status,
                createdAt: user.createdAt,
                lastLogin: user.lastLoginAt,
                preferences: {
                    theme: 'dark',
                    refreshInterval: 30,
                    emailNotifications: true,
                    slackNotifications: false,
                },
            });
        } catch (err) {
            log('ERROR', 'Failed to fetch own profile', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── PUT /api/user/profile ─────────────────────────────────────────────
       Self-service: update the authenticated user's own name & email.       */
    router.put('/user/profile', authenticate, async (req, res) => {
        try {
            const userId = req.user.id;
            const { fullName, email } = req.body;

            // Validate email format if provided
            if (email) {
                const validation = validateUserInput({ email });
                if (!validation.valid) {
                    return res.status(400).json({ error: validation.error });
                }
                // Check email uniqueness (exclude current user)
                if (await emailExists(pool, email, userId)) {
                    return res.status(409).json({ error: 'Email already in use by another account' });
                }
            }

            const updated = await updateUser(pool, userId, {
                name:  fullName || undefined,
                email: email || undefined,
            });
            if (!updated) return res.status(404).json({ error: 'User not found' });

            // Send response immediately
            log('INFO', 'Profile self-update', { userId, fields: Object.keys(req.body) });
            res.json({ success: true, user: updated });

            // Fire-and-forget audit logging
            writeAudit(pool, {
                actorId:       userId,
                actorUsername: req.user.username,
                action:        'PROFILE_UPDATED',
                resourceType:  'user',
                resourceId:    userId,
                level:         'info',
                detail:        `User updated own profile: ${[fullName && 'name', email && 'email'].filter(Boolean).join(', ')}`,
                ip:            req.ip,
            }).catch(e => log('WARN', 'Audit write failed for PROFILE_UPDATED', { error: e.message }));
        } catch (err) {
            log('ERROR', 'Failed to update own profile', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── GET /api/user/activity-log ────────────────────────────────────────
       Self-service: returns the authenticated user's recent activity.       */
    router.get('/user/activity-log', authenticate, async (req, res) => {
        try {
            const limit = Math.min(parseInt(req.query.limit) || 10, 50);
            const { rows } = await pool.query(
                `SELECT action, detail, ip_address as ip, created_at as "createdAt"
                 FROM pgmonitoringtool.audit_log
                 WHERE actor_id = $1
                 ORDER BY created_at DESC
                 LIMIT $2`,
                [req.user.id, limit]
            );
            res.json({ activities: rows });
        } catch (err) {
            // If audit table doesn't exist, return empty
            log('WARN', 'Activity log query failed', { error: err.message });
            res.json({ activities: [] });
        }
    });

    /* ── GET /api/users ─────────────────────────────────────────────────────
       Returns all active users enriched with login activity + risk score.    */
    router.get('/users', ...guard, async (req, res) => {
        try {
            const users = await listUsers(pool);
            res.json(users);
        } catch (err) {
            log('ERROR', 'Failed to list users', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── GET /api/users/:id ────────────────────────────────────────────────*/
    router.get('/users/:id', ...guard, async (req, res) => {
        try {
            const user = await getUserById(pool, parseInt(req.params.id));
            if (!user) return res.status(404).json({ error: 'User not found' });
            const { password_hash, ...safe } = user;
            res.json(safe);
        } catch (err) {
            log('ERROR', 'Failed to fetch user', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── POST /api/users ───────────────────────────────────────────────────
       Create a new user.                                                      */
    router.post('/users', ...guard, validate({ body: CreateUserSchema }), async (req, res) => {
        try {
            const { username, password, name, email, role } = req.body;

            // Required field validation
            if (!username || !password || !name || !email || !role) {
                return res.status(400).json({ error: 'username, password, name, email and role are required' });
            }

            // Validate user input format
            const validation = validateUserInput(req.body);
            if (!validation.valid) {
                return res.status(400).json({ error: validation.error });
            }

            const pwError = validatePasswordStrength(password);
            if (pwError) return res.status(400).json({ error: pwError });

            // Uniqueness checks
            if (await usernameExists(pool, username)) {
                return res.status(409).json({ error: 'Username already exists' });
            }
            if (await emailExists(pool, email)) {
                return res.status(409).json({ error: 'Email already exists' });
            }

            const newUser = await createUser(pool, req.body);

            log('INFO', 'User created', { by: req.user.username, newUser: newUser.username });
            res.status(201).json(newUser);

            writeAudit(pool, {
                actorId:      req.user.id,
                actorUsername: req.user.username,
                action:       'USER_CREATED',
                resourceType: 'user',
                resourceId:   newUser.id,
                level:        'info',
                detail:       `Created user ${newUser.username} with role ${newUser.role}`,
                ip:           req.ip,
            }).catch(e => log('WARN', 'Audit write failed for USER_CREATED', { error: e.message }));
        } catch (err) {
            // 23505 = unique violation. The pre-flight checks above catch the
            // ordinary cases, so reaching here means a constraint the app does
            // not model — surface it as a 409 rather than a blank 500, which is
            // what a deleted-but-retained username used to produce.
            if (err.code === '23505') {
                const field = /username/.test(err.constraint || '') ? 'Username' : 'Value';
                log('WARN', 'User creation hit a unique constraint', {
                    constraint: err.constraint,
                    detail: err.detail,
                });
                return res.status(409).json({ error: `${field} already exists` });
            }
            log('ERROR', 'Failed to create user', { error: err.message, code: err.code });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── PUT /api/users/:id ────────────────────────────────────────────────
       Update editable fields (partial update, no password here).             */
    router.put('/users/:id', ...guard, validate({ body: UpdateUserSchema }), async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                log('ERROR', 'PUT /users/:id — invalid ID', { raw: req.params.id });
                return res.status(400).json({ error: 'Invalid user ID', received: req.params.id });
            }

            const { email, name } = req.body;

            if (email && await emailExists(pool, email, id)) {
                return res.status(409).json({ error: 'Email already in use' });
            }

            const updated = await updateUser(pool, id, req.body);
            if (!updated) {
                log('WARN', 'User not found for update', { userId: id });
                return res.status(404).json({ error: 'User not found' });
            }

            res.json(updated);

            // Fire-and-forget audit logging
            writeAudit(pool, {
                actorId:       req.user.id,
                actorUsername: req.user.username,
                action:        'USER_UPDATED',
                resourceType:  'user',
                resourceId:    id,
                level:         'info',
                detail:        `Updated fields: ${Object.keys(req.body).join(', ')}`,
                ip:            req.ip,
            }).catch(e => log('WARN', 'Audit write failed for USER_UPDATED', { error: e.message }));
        } catch (err) {
            log('ERROR', 'Failed to update user', { error: err.message, stack: err.stack });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── DELETE /api/users/:id ─────────────────────────────────────────────
       Soft-delete a single user. id=1 (system admin) is protected.          */
    router.delete('/users/:id', ...guard, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            if (id === 1) return res.status(403).json({ error: 'Cannot delete the system administrator' });

            const deleted = await deleteUser(pool, id);
            if (!deleted) return res.status(404).json({ error: 'User not found' });

            log('INFO', 'User deleted', { by: req.user.username, userId: id });
            res.json({ success: true });

            writeAudit(pool, {
                actorId:       req.user.id,
                actorUsername: req.user.username,
                action:        'USER_DELETED',
                resourceType:  'user',
                resourceId:    id,
                level:         'warn',
                detail:        `User ${id} deleted`,
                ip:            req.ip,
            }).catch(e => log('WARN', 'Audit write failed for USER_DELETED', { error: e.message }));
        } catch (err) {
            log('ERROR', 'Failed to delete user', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── POST /api/users/bulk-delete ───────────────────────────────────────*/
    router.post('/users/bulk-delete', ...guard, async (req, res) => {
        try {
            const { ids } = req.body;
            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({ error: 'ids must be a non-empty array' });
            }
            if (ids.includes(1)) {
                return res.status(403).json({ error: 'Cannot delete the system administrator' });
            }

            const count = await bulkDeleteUsers(pool, ids);

            log('INFO', 'Bulk delete', { by: req.user.username, count });
            res.json({ success: true, deleted: count });

            writeAudit(pool, {
                actorId:       req.user.id,
                actorUsername: req.user.username,
                action:        'USERS_BULK_DELETED',
                level:         'warn',
                detail:        `Bulk-deleted ${count} users`,
                metadata:      { ids },
                ip:            req.ip,
            }).catch(e => log('WARN', 'Audit write failed for USERS_BULK_DELETED', { error: e.message }));
        } catch (err) {
            log('ERROR', 'Failed to bulk-delete users', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    /* ── POST /api/users/:id/reset-password ────────────────────────────────*/
    router.post('/users/:id/reset-password', ...guard, pwResetLimiter, validate({ body: ResetPasswordSchema }), async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const { newPassword } = req.body;

            const pwError = validatePasswordStrength(newPassword);
            if (pwError) return res.status(400).json({ error: pwError });

            const ok = await resetUserPassword(pool, id, newPassword);
            if (!ok) return res.status(404).json({ error: 'User not found' });

            log('INFO', 'Password reset', { by: req.user.username, userId: id });
            res.json({ success: true }); // never return the password

            writeAudit(pool, {
                actorId:       req.user.id,
                actorUsername: req.user.username,
                action:        'PASSWORD_RESET',
                resourceType:  'user',
                resourceId:    id,
                level:         'warn',
                detail:        `Password reset by ${req.user.username}`,
                ip:            req.ip,
            }).catch(e => log('WARN', 'Audit write failed for PASSWORD_RESET', { error: e.message }));
        } catch (err) {
            log('ERROR', 'Failed to reset password', { error: err.message });
            res.status(500).json({ error: 'Internal server error', requestId: req.id });
        }
    });

    return router;
}