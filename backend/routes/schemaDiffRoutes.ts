// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/schemaDiffRoutes.js
 * ──────────────────────────
 * Schema diff and migration SQL generation endpoints.
 *
 * Mount with:
 *   app.use(prefix, schemaDiffRoutes(pool, authenticate, getPool))
 *
 * Routes:
 *   POST /schema/snapshot          — capture a schema snapshot
 *   POST /schema/diff              — compare two connections/schemas
 *   POST /schema/diff/migration    — regenerate migration SQL from diff
 */

import { Router } from 'express';
import {
    snapshotSchema,
    diffSchemas,
    generateMigrationSql,
    compareConnections,
} from '../services/schemaDiffService.js';
import { resolveWorkspace, requireWorkspaceRole } from '../middleware/workspaceRbac.js';

export default function schemaDiffRoutes(pool, authenticate, getPool) {
    const router = Router();

    // ── POST /schema/snapshot ────────────────────────────────────────────
    router.post(
        '/schema/snapshot',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const { connectionId, schema = 'public' } = req.body || {};

                if (!connectionId) {
                    return res.status(400).json({ error: 'connectionId required' });
                }

                const pgPool = getPool ? getPool(connectionId) : null;
                if (!pgPool) {
                    return res.status(404).json({ error: 'connection not found' });
                }

                const client = await pgPool.connect();
                try {
                    const snapshot = await snapshotSchema(client, { schema });
                    res.json({ snapshot });
                } finally {
                    client.release();
                }
            } catch (err) {
                next(err);
            }
        }
    );

    // ── POST /schema/diff ────────────────────────────────────────────────
    router.post(
        '/schema/diff',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const {
                    leftConnectionId,
                    rightConnectionId,
                    leftSchema = 'public',
                    rightSchema = 'public',
                    includeMigrationSql = false,
                } = req.body || {};

                if (!leftConnectionId || !rightConnectionId) {
                    return res.status(400).json({
                        error: 'leftConnectionId and rightConnectionId required',
                    });
                }

                const result = await compareConnections(getPool, {
                    leftConnectionId,
                    rightConnectionId,
                    leftSchema,
                    rightSchema,
                });

                const response = {
                    diff: result.diff,
                    summary: result.summary,
                };

                if (includeMigrationSql) {
                    response.migrationSql = result.migrationSql;
                }

                res.json(response);
            } catch (err) {
                next(err);
            }
        }
    );

    // ── POST /schema/diff/migration ──────────────────────────────────────
    router.post(
        '/schema/diff/migration',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const { diff, direction = 'left-to-right' } = req.body || {};

                if (!diff || typeof diff !== 'object') {
                    return res.status(400).json({
                        error: 'diff object required',
                    });
                }

                const migrationSql = generateMigrationSql(diff, { direction });

                res.json({ migrationSql });
            } catch (err) {
                next(err);
            }
        }
    );

    return router;
}
