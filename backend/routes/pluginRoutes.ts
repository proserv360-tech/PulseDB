// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/pluginRoutes.js
 * ──────────────────────
 * Public read-only discovery + admin install/publish for PulseDB plugins
 * and shared dashboards.
 */

import { Router } from 'express';
import { query } from '../db.js';
import {
    validateManifest, publishPlugin, listPublicPlugins,
    installPlugin, listWorkspacePlugins,
} from '../services/pluginRegistry.js';
import { resolveWorkspace, requireWorkspaceRole } from '../middleware/workspaceRbac.js';

export default function pluginRoutes(pool, authenticate) {
    const router = Router();

    // ── Public marketplace browsing (no auth) ────────────────────────────────
    router.get('/marketplace/plugins', async (req, res, next) => {
        try {
            const rows = await listPublicPlugins({
                search: String(req.query.q || ''),
                limit: Number(req.query.limit) || 50,
            });
            res.json({ plugins: rows });
        } catch (err) { next(err); }
    });

    router.get('/marketplace/plugins/:slug', async (req, res, next) => {
        try {
            const { rows } = await query(
                `SELECT slug, name, description, author, version, manifest,
                        verified, downloads, updated_at
                   FROM pgmonitoringtool.plugins WHERE slug = $1`,
                [req.params.slug]
            );
            if (!rows[0]) return res.status(404).json({ error: 'not found' });
            res.json(rows[0]);
        } catch (err) { next(err); }
    });

    // ── Manifest validation only (no persistence) ────────────────────────────
    router.post('/marketplace/plugins/validate', authenticate, (req, res) => {
        res.json(validateManifest(req.body || {}));
    });

    // ── Publish (requires owner role on workspace) ───────────────────────────
    router.post(
        '/marketplace/plugins/publish',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('owner'),
        async (req, res, next) => {
            try {
                const result = await publishPlugin(req.body, req.user?.id);
                res.status(201).json(result);
            } catch (err) {
                if (err.status === 400) return res.status(400).json({
                    error: err.message, details: err.details,
                });
                next(err);
            }
        }
    );

    // ── Install into active workspace ────────────────────────────────────────
    router.post(
        '/marketplace/plugins/:slug/install',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('admin'),
        async (req, res, next) => {
            try {
                const result = await installPlugin({
                    workspaceId: req.workspace.id,
                    pluginSlug: req.params.slug,
                    settings: req.body?.settings || {},
                    installedBy: req.user?.id,
                });
                res.json(result);
            } catch (err) { next(err); }
        }
    );

    router.get(
        '/workspace/plugins',
        authenticate,
        resolveWorkspace,
        async (req, res, next) => {
            try {
                const rows = await listWorkspacePlugins(req.workspace.id);
                res.json({ plugins: rows });
            } catch (err) { next(err); }
        }
    );

    // ── Shared dashboards ────────────────────────────────────────────────────
    router.get('/marketplace/dashboards', async (req, res, next) => {
        try {
            const q = String(req.query.q || '');
            const { rows } = await query(
                `SELECT slug, name, description, tags, downloads, stars,
                        verified, updated_at
                   FROM pgmonitoringtool.shared_dashboards
                  WHERE ($1 = '' OR name ILIKE $2 OR description ILIKE $2)
                  ORDER BY verified DESC, downloads DESC, updated_at DESC
                  LIMIT $3`,
                [q, `%${q}%`, Number(req.query.limit) || 50]
            );
            res.json({ dashboards: rows });
        } catch (err) { next(err); }
    });

    router.post(
        '/marketplace/dashboards',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const { slug, name, description = '', tags = [], definition } = req.body || {};
                if (!slug || !name || !definition) {
                    return res.status(400).json({ error: 'slug, name, definition required' });
                }
                const { rows } = await query(
                    `INSERT INTO pgmonitoringtool.shared_dashboards
                        (slug, name, description, tags, definition, published_by, workspace_id)
                     VALUES ($1,$2,$3,$4,$5,$6,$7)
                     ON CONFLICT (slug) DO UPDATE SET
                        name = EXCLUDED.name,
                        description = EXCLUDED.description,
                        tags = EXCLUDED.tags,
                        definition = EXCLUDED.definition,
                        updated_at = now()
                     RETURNING slug, name`,
                    [slug, name, description, tags, definition, req.user?.id, req.workspace.id]
                );
                res.status(201).json(rows[0]);
            } catch (err) { next(err); }
        }
    );

    return router;
}
