// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/workbookRoutes.js — B3 query-rewrite workbench.
 *
 * Mount:
 *   app.use(prefix, workbookRoutes(pool, authenticate, getPool));
 *
 * RBAC: editor role required for create/add-variant/run; viewer can read.
 * Schemas live in @fathom/validators (CreateWorkbookSchema, AddVariantSchema,
 * RunVariantsParamsSchema).
 */

import { Router } from 'express';
import {
    createWorkbook, addVariant, listWorkbooks, getWorkbook, runVariants,
} from '../services/workbookService.js';
import { resolveWorkspace, requireWorkspaceRole } from '../middleware/workspaceRbac.js';
import { validate } from '../middleware/validate.js';
import { CreateWorkbookSchema, AddVariantSchema } from '../../shared/validators/index.js';

// The variant endpoint takes workbookId from the URL (:id), not the body, so
// the body-only schema drops it. The full AddVariantSchema still governs the
// service-layer shape.
const AddVariantBodySchema = AddVariantSchema.omit({ workbookId: true });

export default function workbookRoutes(pool, authenticate, getPool) {
    const router = Router();

    router.get('/workbench/workbooks',
        authenticate, resolveWorkspace, requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const rows = await listWorkbooks({ workspaceId: req.workspace.id });
                res.json({ workbooks: rows });
            } catch (err) {
                if (/relation .* does not exist/i.test(err.message)) return res.json({ workbooks: [] });
                next(err);
            }
        }
    );

    router.get('/workbench/workbooks/:id',
        authenticate, resolveWorkspace, requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const id = Number(req.params.id);
                if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
                const wb = await getWorkbook({ workbookId: id, workspaceId: req.workspace.id });
                if (!wb) return res.status(404).json({ error: 'Not found' });
                res.json(wb);
            } catch (err) { next(err); }
        }
    );

    router.post('/workbench/workbooks',
        authenticate, resolveWorkspace, requireWorkspaceRole('editor'),
        validate({ body: CreateWorkbookSchema }),
        async (req, res, next) => {
            try {
                const { connectionId, baseQuery, description } = req.body || {};
                const row = await createWorkbook({
                    workspaceId: req.workspace.id,
                    userId: req.user?.id,
                    connectionId, baseQuery, description,
                });
                res.status(201).json(row);
            } catch (err) {
                if (err.code === 'UNSAFE_QUERY') return res.status(400).json({ error: err.message });
                next(err);
            }
        }
    );

    router.post('/workbench/workbooks/:id/variants',
        authenticate, resolveWorkspace, requireWorkspaceRole('editor'),
        validate({ body: AddVariantBodySchema }),
        async (req, res, next) => {
            try {
                const workbookId = Number(req.params.id);
                if (!Number.isInteger(workbookId) || workbookId <= 0) return res.status(400).json({ error: 'Invalid id' });
                const { label, sql } = req.body || {};
                const row = await addVariant({ workbookId, label, sql });
                res.status(201).json(row);
            } catch (err) {
                if (err.code === 'UNSAFE_QUERY') return res.status(400).json({ error: err.message });
                next(err);
            }
        }
    );

    router.post('/workbench/workbooks/:id/run',
        authenticate, resolveWorkspace, requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const workbookId = Number(req.params.id);
                if (!Number.isInteger(workbookId) || workbookId <= 0) return res.status(400).json({ error: 'Invalid id' });
                const summary = await runVariants({
                    workbookId,
                    workspaceId: req.workspace.id,
                    getPool,
                });
                res.json(summary);
            } catch (err) { next(err); }
        }
    );

    return router;
}
