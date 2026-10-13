// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/explainRoutes.js
 * ───────────────────────
 * EXPLAIN plan capture, history, and diff endpoints.
 *
 * Mount with:
 *   app.use(prefix, explainRoutes(
 *       pool, authenticate, getPool, getMysqlPool, getMongoClient, CONNECTIONS
 *   ));
 */

import { Router } from 'express';
import {
    capturePostgresPlan,
    captureMysqlPlan,
    captureMongoPlan,
    storePlan,
    listPlansForFingerprint,
    getPlan,
    fingerprintSql,
    diffPostgresPlans,
    flattenPostgresPlan,
} from '../services/explainService.js';
import { resolveWorkspace, requireWorkspaceRole } from '../middleware/workspaceRbac.js';

export default function explainRoutes(
    pool,
    authenticate,
    getPool,
    getMysqlPool,
    getMongoClient,
    CONNECTIONS
) {
    const router = Router();

    // Translate err.status (set by assertExplainSafe & friends) into an HTTP
    // status so a 400 doesn't surface as a generic 500 via Express's default
    // error handler.
    function handleExplainError(err, res, next) {
        if (err && typeof err.status === 'number') {
            return res.status(err.status).json({ error: err.message });
        }
        return next(err);
    }

    // ── Postgres EXPLAIN capture ─────────────────────────────────────────────
    router.post(
        '/explain/postgres',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const { connectionId, sql, analyze = false } = req.body || {};
                if (!connectionId || !sql) {
                    return res.status(400).json({ error: 'connectionId and sql required' });
                }
                const pgPool = getPool
                    ? getPool(connectionId)
                    : CONNECTIONS?.[connectionId];
                if (!pgPool) return res.status(404).json({ error: 'connection not found' });

                const client = await pgPool.connect();
                try {
                    const { plan, elapsedMs } = await capturePostgresPlan({
                        client, sql, analyze,
                    });
                    const persisted = await storePlan({
                        connectionId,
                        workspaceId: req.workspace?.id,
                        engine: 'postgres',
                        sql,
                        plan,
                        elapsedMs,
                        capturedBy: req.user?.id,
                    });
                    res.json({ ...persisted, plan });
                } finally {
                    client.release();
                }
            } catch (err) { handleExplainError(err, res, next); }
        }
    );

    // ── MySQL EXPLAIN capture ────────────────────────────────────────────────
    router.post(
        '/explain/mysql',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const { connectionId, sql } = req.body || {};
                if (!connectionId || !sql) {
                    return res.status(400).json({ error: 'connectionId and sql required' });
                }
                const mysqlPool = getMysqlPool ? getMysqlPool(connectionId) : null;
                if (!mysqlPool) return res.status(404).json({ error: 'connection not found' });

                const conn = await mysqlPool.getConnection();
                try {
                    const { plan } = await captureMysqlPlan({ connection: conn, sql });
                    const persisted = await storePlan({
                        connectionId,
                        workspaceId: req.workspace?.id,
                        engine: 'mysql',
                        sql,
                        plan,
                        capturedBy: req.user?.id,
                    });
                    res.json({ ...persisted, plan });
                } finally {
                    conn.release();
                }
            } catch (err) { handleExplainError(err, res, next); }
        }
    );

    // ── MongoDB explain capture ──────────────────────────────────────────────
    router.post(
        '/explain/mongo',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const {
                    connectionId, database, collection,
                    operation = 'find', pipeline, filter,
                } = req.body || {};
                if (!connectionId || !database || !collection) {
                    return res.status(400).json({
                        error: 'connectionId, database, collection required'
                    });
                }
                const client = getMongoClient ? getMongoClient(connectionId) : null;
                if (!client) return res.status(404).json({ error: 'connection not found' });

                const { plan } = await captureMongoPlan({
                    db: client.db(database),
                    collection,
                    operation,
                    pipelineOrFilter: operation === 'aggregate' ? pipeline : filter,
                });
                const sql = `${operation}(${JSON.stringify(operation === 'aggregate' ? pipeline : filter)})`;
                const persisted = await storePlan({
                    connectionId,
                    workspaceId: req.workspace?.id,
                    engine: 'mongodb',
                    sql,
                    plan,
                    capturedBy: req.user?.id,
                });
                res.json({ ...persisted, plan });
            } catch (err) { next(err); }
        }
    );

    // ── Read a single plan ───────────────────────────────────────────────────
    router.get('/explain/plans/:id', authenticate, async (req, res, next) => {
        try {
            const row = await getPlan(Number(req.params.id));
            if (!row) return res.status(404).json({ error: 'not found' });
            const flat = row.engine === 'postgres'
                ? flattenPostgresPlan(row.plan_json)
                : null;
            res.json({ ...row, nodes: flat });
        } catch (err) { next(err); }
    });

    // ── History for a fingerprint (or SQL) ───────────────────────────────────
    router.get('/explain/history', authenticate, async (req, res, next) => {
        try {
            const fp = req.query.fingerprint
                || (req.query.sql ? fingerprintSql(String(req.query.sql)) : null);
            if (!fp) return res.status(400).json({ error: 'fingerprint or sql required' });
            const history = await listPlansForFingerprint(
                String(fp), Number(req.query.limit) || 20
            );
            res.json({ fingerprint: fp, history });
        } catch (err) { next(err); }
    });

    // ── Diff two plans (Postgres) ────────────────────────────────────────────
    router.get('/explain/diff', authenticate, async (req, res, next) => {
        try {
            const a = await getPlan(Number(req.query.a));
            const b = await getPlan(Number(req.query.b));
            if (!a || !b) return res.status(404).json({ error: 'plan not found' });
            if (a.engine !== 'postgres' || b.engine !== 'postgres') {
                return res.status(400).json({ error: 'diff currently supports postgres only' });
            }
            const changes = diffPostgresPlans(a.plan_json, b.plan_json);
            res.json({
                a: { id: a.id, capturedAt: a.captured_at, elapsedMs: a.execution_ms },
                b: { id: b.id, capturedAt: b.captured_at, elapsedMs: b.execution_ms },
                changes,
            });
        } catch (err) { next(err); }
    });

    return router;
}
