// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/copilotRoutes.js
 * ───────────────────────
 * AI SQL copilot endpoints.
 *
 * Factory signature matches the other DB-aware routes:
 *   app.use('/api', copilotRoutes(pool, authenticate, getPool))
 *     pool       — PulseDB control-plane pool (used for copilot_turns only)
 *     getPool    — (connectionId) => pg Pool for a MONITORED database.
 *                  Same helper already used by mysqlRoutes / explain.
 *
 * Endpoints
 *   POST /api/copilot/sql        NL → SQL with monitored-DB schema context
 *                                (editor role required — LLM cost gate)
 *   POST /api/copilot/explain    Review an EXPLAIN plan
 *   POST /api/copilot/rca        Draft an incident RCA
 *   GET  /api/copilot/history    Recent turns for the workspace
 *   GET  /api/copilot/provider   Current provider info (admin only)
 *   POST /api/copilot/validate-sql   Pure string safety check (no LLM call)
 */

import { Router } from 'express';
import {
    generateSql,
    streamSql,
    streamExplain,
    explainPlan,
    draftIncidentRca,
    saveConversationTurn,
    getProvider,
    isSafeToRun,
    deleteConversationTurn,
    deleteUserConversationHistory,
    COPILOT_HISTORY_MAX_AGE_DAYS,
} from '../services/copilotService.js';
import { resolveWorkspace, requireWorkspaceRole } from '../middleware/workspaceRbac.js';
import { query } from '../db.js';
import { swallowWith } from '../services/errorHandling.js';

export default function copilotRoutes(pool, authenticate, getPool) {
    const router = Router();

    // LOW-1: admin role so the configured provider isn't leaked to every user.
    router.get('/copilot/provider', authenticate, resolveWorkspace, requireWorkspaceRole('admin'), (_req, res) => {
        const p = getProvider();
        res.json({ provider: p.name, model: p.model });
    });

    // MED-1: editor role — LLM endpoints cost money; viewers cannot drive them.
    router.post(
        '/copilot/sql',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const { prompt, schema = 'public', connectionId } = req.body || {};
                if (!prompt || typeof prompt !== 'string') {
                    return res.status(400).json({ error: 'prompt is required' });
                }
                if (!connectionId) {
                    return res.status(400).json({
                        error: 'connectionId is required — schema context is sourced from the monitored database',
                    });
                }
                let monitored = null;
                try {
                    monitored = typeof getPool === 'function' ? await getPool(connectionId, req.user?.id) : null;
                } catch (err) {
                    return res.status(400).json({ error: `unknown connectionId: ${err.message}` });
                }
                if (!monitored) {
                    return res.status(400).json({ error: 'unknown connectionId' });
                }
                const result = await generateSql(monitored, { prompt, schema });
                await saveConversationTurn({
                    workspaceId: req.workspace?.id,
                    userId: req.user?.id,
                    kind: 'sql',
                    input: prompt,
                    output: result.sql,
                });
                res.json(result);
            } catch (err) {
                next(err);
            }
        },
    );

    router.post(
        '/copilot/explain',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const { plan, sql } = req.body || {};
                if (!plan) return res.status(400).json({ error: 'plan is required' });
                const result = await explainPlan(null, { plan, sql });
                await saveConversationTurn({
                    workspaceId: req.workspace?.id,
                    userId: req.user?.id,
                    kind: 'explain',
                    input: sql || '(no sql)',
                    output: result.review,
                });
                res.json(result);
            } catch (err) {
                next(err);
            }
        },
    );

    router.post(
        '/copilot/rca',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const { incident } = req.body || {};
                if (!incident) return res.status(400).json({ error: 'incident is required' });
                const result = await draftIncidentRca(null, { incident });
                await saveConversationTurn({
                    workspaceId: req.workspace?.id,
                    userId: req.user?.id,
                    kind: 'rca',
                    input: JSON.stringify(incident).slice(0, 4000),
                    output: result.rca,
                });
                res.json(result);
            } catch (err) {
                next(err);
            }
        },
    );

    router.get('/copilot/history', authenticate, resolveWorkspace, async (req, res, next) => {
        try {
            const limit = Math.min(Number(req.query.limit) || 50, 200);
            const { rows } = await query(
                `SELECT id, kind, input, output, created_at
                       FROM pgmonitoringtool.copilot_turns
                      WHERE workspace_id = $1
                      ORDER BY created_at DESC LIMIT $2`,
                [req.workspace.id, limit],
            );
            res.json({ turns: rows });
        } catch (err) {
            if (/relation .* does not exist/.test(err.message)) return res.json({ turns: [] });
            next(err);
        }
    });

    router.post('/copilot/validate-sql', authenticate, (req, res) => {
        res.json(isSafeToRun(String(req.body?.sql || '')));
    });

    // ── A5: user-initiated retention ─────────────────────────────────────
    // DELETE /api/copilot/history/:id — remove a single turn the user owns.
    // DELETE /api/copilot/history     — clear the caller's full history in
    //                                   the active workspace.
    // GET    /api/copilot/retention   — expose the configured TTL so the
    //                                   UI can show "auto-purged after Nd".
    router.delete('/copilot/history/:id', authenticate, resolveWorkspace, async (req, res, next) => {
        try {
            const id = Number(req.params.id);
            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({ error: 'Invalid id' });
            }
            const removed = await deleteConversationTurn({
                id,
                workspaceId: req.workspace.id,
                userId: req.user?.id ?? null,
            });
            if (removed === 0) return res.status(404).json({ error: 'Not found' });
            res.json({ removed });
        } catch (err) {
            next(err);
        }
    });

    router.delete('/copilot/history', authenticate, resolveWorkspace, async (req, res, next) => {
        try {
            const removed = await deleteUserConversationHistory({
                workspaceId: req.workspace.id,
                userId: req.user?.id ?? null,
            });
            res.json({ removed });
        } catch (err) {
            next(err);
        }
    });

    router.get('/copilot/retention', authenticate, (_req, res) => {
        res.json({ maxAgeDays: COPILOT_HISTORY_MAX_AGE_DAYS });
    });

    // ── Streaming variants (Server-Sent Events) ─────────────────────────
    // Token-by-token responses so the chat UI can render incrementally.
    // Event shape: `data: {"delta":"..."}` per chunk, then a final
    // `data: {"done":true, ...}` sentinel, then `event: end`.
    function openSse(res) {
        res.set({
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        });
        res.flushHeaders?.();
    }
    const sse = (res, obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    router.post(
        '/copilot/sql/stream',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res) => {
            const { prompt, schema = 'public', connectionId } = req.body || {};
            if (!prompt || !connectionId) {
                return res.status(400).json({ error: 'prompt and connectionId are required' });
            }
            let monitored = null;
            try {
                monitored = typeof getPool === 'function' ? await getPool(connectionId, req.user?.id) : null;
            } catch (err) {
                return res.status(400).json({ error: `unknown connectionId: ${err.message}` });
            }
            if (!monitored) return res.status(400).json({ error: 'unknown connectionId' });

            openSse(res);
            let finalSql = '';
            try {
                for await (const evt of streamSql(monitored, { prompt, schema })) {
                    if (evt.done) finalSql = evt.sql || '';
                    sse(res, evt);
                }
            } catch (err) {
                sse(res, { error: err.message });
            } finally {
                await saveConversationTurn({
                    workspaceId: req.workspace?.id,
                    userId: req.user?.id,
                    kind: 'sql',
                    input: prompt,
                    output: finalSql,
                }).catch(swallowWith({ component: 'copilot', op: 'saveConversationTurn' }));
                res.write('event: end\ndata: {}\n\n');
                res.end();
            }
        },
    );

    router.post(
        '/copilot/explain/stream',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res) => {
            const { plan, sql } = req.body || {};
            if (!plan) return res.status(400).json({ error: 'plan is required' });
            openSse(res);
            let review = '';
            try {
                for await (const evt of streamExplain(null, { plan, sql })) {
                    if (evt.done) review = evt.review || '';
                    sse(res, evt);
                }
            } catch (err) {
                sse(res, { error: err.message });
            } finally {
                await saveConversationTurn({
                    workspaceId: req.workspace?.id,
                    userId: req.user?.id,
                    kind: 'explain',
                    input: sql || '(no sql)',
                    output: review,
                }).catch(swallowWith({ component: 'copilot', op: 'saveConversationTurn' }));
                res.write('event: end\ndata: {}\n\n');
                res.end();
            }
        },
    );

    return router;
}
