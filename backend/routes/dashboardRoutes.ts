// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/dashboardRoutes.js — B7 user-built dashboards.
 * CRUD over dashboards + panels. Per-workspace scoped. Read = viewer,
 * write = editor.
 */
import { Router } from 'express';
import { query } from '../db.js';
import { resolveWorkspace, requireWorkspaceRole } from '../middleware/workspaceRbac.js';

export default function dashboardRoutes(pool, authenticate) {
    const router = Router();

    router.get('/dashboards',
        authenticate, resolveWorkspace, requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const { rows } = await query(
                    `SELECT id, name, description, created_at, updated_at
                       FROM pgmonitoringtool.dashboards
                      WHERE workspace_id = $1
                      ORDER BY updated_at DESC`,
                    [req.workspace.id]
                );
                res.json({ dashboards: rows });
            } catch (err) {
                if (/relation .* does not exist/i.test(err.message)) return res.json({ dashboards: [] });
                next(err);
            }
        }
    );

    router.get('/dashboards/:id',
        authenticate, resolveWorkspace, requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const id = Number(req.params.id);
                if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
                const dash = await query(
                    `SELECT id, name, description, created_at, updated_at
                       FROM pgmonitoringtool.dashboards
                      WHERE id = $1 AND workspace_id = $2`,
                    [id, req.workspace.id]
                );
                if (dash.rows.length === 0) return res.status(404).json({ error: 'Not found' });
                const panels = await query(
                    `SELECT id, title, position, spec, created_at
                       FROM pgmonitoringtool.dashboard_panels
                      WHERE dashboard_id = $1 ORDER BY id ASC`, [id]
                );
                res.json({ ...dash.rows[0], panels: panels.rows });
            } catch (err) { next(err); }
        }
    );

    router.post('/dashboards',
        authenticate, resolveWorkspace, requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const { name, description } = req.body || {};
                if (!name) return res.status(400).json({ error: 'name required' });
                const { rows } = await query(
                    `INSERT INTO pgmonitoringtool.dashboards
                        (workspace_id, created_by, name, description)
                     VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
                    [req.workspace.id, req.user?.id, name, description ?? null]
                );
                res.status(201).json(rows[0]);
            } catch (err) { next(err); }
        }
    );

    router.delete('/dashboards/:id',
        authenticate, resolveWorkspace, requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const id = Number(req.params.id);
                if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
                const r = await query(
                    `DELETE FROM pgmonitoringtool.dashboards
                      WHERE id = $1 AND workspace_id = $2`,
                    [id, req.workspace.id]
                );
                if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
                res.status(204).end();
            } catch (err) { next(err); }
        }
    );

    router.post('/dashboards/:id/panels',
        authenticate, resolveWorkspace, requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const dashboardId = Number(req.params.id);
                if (!Number.isInteger(dashboardId) || dashboardId <= 0) return res.status(400).json({ error: 'Invalid id' });
                const owns = await query(
                    `SELECT 1 FROM pgmonitoringtool.dashboards
                      WHERE id = $1 AND workspace_id = $2`,
                    [dashboardId, req.workspace.id]
                );
                if (owns.rows.length === 0) return res.status(404).json({ error: 'Not found' });
                const { title, position, spec } = req.body || {};
                if (!title || !position || !spec) return res.status(400).json({ error: 'title, position, spec required' });
                const { rows } = await query(
                    `INSERT INTO pgmonitoringtool.dashboard_panels
                        (dashboard_id, title, position, spec)
                     VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
                    [dashboardId, title, position, spec]
                );
                await query(
                    `UPDATE pgmonitoringtool.dashboards SET updated_at = now() WHERE id = $1`,
                    [dashboardId]
                );
                res.status(201).json(rows[0]);
            } catch (err) { next(err); }
        }
    );

    router.delete('/dashboards/:id/panels/:panelId',
        authenticate, resolveWorkspace, requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const dashboardId = Number(req.params.id);
                const panelId     = Number(req.params.panelId);
                if (![dashboardId, panelId].every(n => Number.isInteger(n) && n > 0)) {
                    return res.status(400).json({ error: 'Invalid id' });
                }
                const owns = await query(
                    `SELECT 1 FROM pgmonitoringtool.dashboards
                      WHERE id = $1 AND workspace_id = $2`,
                    [dashboardId, req.workspace.id]
                );
                if (owns.rows.length === 0) return res.status(404).json({ error: 'Not found' });
                const r = await query(
                    `DELETE FROM pgmonitoringtool.dashboard_panels
                      WHERE id = $1 AND dashboard_id = $2`,
                    [panelId, dashboardId]
                );
                if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
                res.status(204).end();
            } catch (err) { next(err); }
        }
    );

    return router;
}
