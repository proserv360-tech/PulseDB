// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/kmsRoutes.js
 *
 * Admin-only endpoints for BYOK management.
 *   POST   /api/kms/provision/:workspaceId   — one-time tenant-key bootstrap.
 *   POST   /api/kms/rotate/:workspaceId      — rotate (new DEK, retire old).
 *   GET    /api/kms/status/:workspaceId      — current backend + version.
 */

import { Router } from 'express';
import {
    getKmsBackend,
    provisionTenantKey,
    rotateTenantKey,
} from '../services/kmsService.js';

export default function kmsRoutes(pool, authenticate, requireRole) {
    const router = Router();
    const adminOnly = requireRole ? requireRole('admin', 'owner') : (_req, _res, next) => next();

    router.post('/api/kms/provision/:workspaceId', authenticate, adminOnly, async (req, res) => {
        try {
            const kms = getKmsBackend();
            const { tenant_key_id } = await provisionTenantKey(pool, req.params.workspaceId, { kms });
            res.status(201).json({ tenant_key_id, backend: kms.describe() });
        } catch (err) {
            res.status(500).json({ error: 'Provision failed', details: err.message });
        }
    });

    router.post('/api/kms/rotate/:workspaceId', authenticate, adminOnly, async (req, res) => {
        try {
            const kms = getKmsBackend();
            const result = await rotateTenantKey(pool, req.params.workspaceId, { kms });
            res.json({ ok: true, ...result });
        } catch (err) {
            res.status(500).json({ error: 'Rotate failed', details: err.message });
        }
    });

    router.get('/api/kms/status/:workspaceId', authenticate, async (req, res) => {
        const { rows } = await pool.query(
            `SELECT kms_backend, kms_key_id, version, created_at, retired_at
               FROM pgmonitoringtool.tenant_keys
              WHERE workspace_id = $1
              ORDER BY version DESC`,
            [req.params.workspaceId],
        );
        res.json({ history: rows, active: rows.find(r => !r.retired_at) || null });
    });

    return router;
}
