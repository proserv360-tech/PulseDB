// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/workbenchRoutes.js
 * ─────────────────────────
 * Query workbench endpoints: saved queries, history, snippets, tabs.
 *
 * Mount with:
 *   app.use(prefix, workbenchRoutes(pool, authenticate));
 */

import { Router } from 'express';
import {
    listSavedQueries,
    getSavedQuery,
    createSavedQuery,
    updateSavedQuery,
    deleteSavedQuery,
    toggleFavorite,
    logQuery,
    listHistory,
    searchHistory,
    purgeHistory,
    listSnippets,
    getSnippet,
    createSnippet,
    updateSnippet,
    deleteSnippet,
    expandSnippets,
    getUserTabs,
    upsertTab,
    closeTab,
    reorderTabs,
} from '../services/workbenchService.js';
import { resolveWorkspace, requireWorkspaceRole } from '../middleware/workspaceRbac.js';

export default function workbenchRoutes(pool, authenticate) {
    const router = Router();

    // ── Saved Queries ────────────────────────────────────────────────────────

    /**
     * GET /workbench/saved-queries
     * List saved queries for the workspace.
     * Query params: connectionId, search, favoritesOnly, limit
     */
    router.get(
        '/saved-queries',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const queries = await listSavedQueries(pool, {
                    workspaceId: req.workspace.id,
                    connectionId: req.query.connectionId,
                    search: req.query.search,
                    favoritesOnly: req.query.favoritesOnly === 'true',
                    limit: Number(req.query.limit) || 100,
                });
                res.json({ queries });
            } catch (err) { next(err); }
        }
    );

    /**
     * POST /workbench/saved-queries
     * Create a new saved query.
     * Body: { connectionId, name, description?, sql, tags?, isFavorite? }
     */
    router.post(
        '/saved-queries',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const { connectionId, name, description, sql, tags, isFavorite } = req.body || {};
                if (!connectionId || !name || !sql) {
                    return res.status(400).json({
                        error: 'connectionId, name, sql required'
                    });
                }
                const query = await createSavedQuery(pool, {
                    workspaceId: req.workspace.id,
                    userId: req.user?.id,
                    connectionId,
                    name,
                    description,
                    sql,
                    tags: tags || [],
                    isFavorite: isFavorite || false,
                });
                res.status(201).json({ query });
            } catch (err) { next(err); }
        }
    );

    /**
     * GET /workbench/saved-queries/:id
     * Get a single saved query.
     */
    router.get(
        '/saved-queries/:id',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const query = await getSavedQuery(pool, {
                    workspaceId: req.workspace.id,
                    id: Number(req.params.id),
                });
                if (!query) return res.status(404).json({ error: 'not found' });
                res.json({ query });
            } catch (err) { next(err); }
        }
    );

    /**
     * PATCH /workbench/saved-queries/:id
     * Update a saved query.
     * Body: { name?, description?, sql?, tags?, isFavorite? }
     */
    router.patch(
        '/saved-queries/:id',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const updated = await updateSavedQuery(pool, {
                    workspaceId: req.workspace.id,
                    id: Number(req.params.id),
                    ...req.body,
                });
                if (!updated) return res.status(404).json({ error: 'not found' });
                res.json({ query: updated });
            } catch (err) { next(err); }
        }
    );

    /**
     * DELETE /workbench/saved-queries/:id
     * Delete a saved query.
     */
    router.delete(
        '/saved-queries/:id',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const ok = await deleteSavedQuery(pool, {
                    workspaceId: req.workspace.id,
                    id: Number(req.params.id),
                });
                if (!ok) return res.status(404).json({ error: 'not found' });
                res.json({ ok: true });
            } catch (err) { next(err); }
        }
    );

    /**
     * POST /workbench/saved-queries/:id/favorite
     * Toggle is_favorite on a saved query.
     */
    router.post(
        '/saved-queries/:id/favorite',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const result = await toggleFavorite(pool, {
                    workspaceId: req.workspace.id,
                    id: Number(req.params.id),
                });
                if (!result) return res.status(404).json({ error: 'not found' });
                res.json({ isFavorite: result.is_favorite });
            } catch (err) { next(err); }
        }
    );

    // ── Query History ────────────────────────────────────────────────────────

    /**
     * GET /workbench/history
     * List query history.
     * Query params: userId (self by default, workspace-wide if admin), connectionId, limit, before
     */
    router.get(
        '/history',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                // Non-admins see only their own queries; admins see workspace-wide
                let userId = req.user?.id;
                if (req.workspace.role === 'admin' || req.workspace.role === 'owner') {
                    userId = req.query.userId ? Number(req.query.userId) : undefined;
                }

                const history = await listHistory(pool, {
                    workspaceId: req.workspace.id,
                    userId,
                    connectionId: req.query.connectionId,
                    limit: Number(req.query.limit) || 100,
                    before: req.query.before,
                });
                res.json({ history });
            } catch (err) { next(err); }
        }
    );

    /**
     * GET /workbench/history/search?q=
     * Search query history by SQL text.
     */
    router.get(
        '/history/search',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                if (!req.query.q) {
                    return res.status(400).json({ error: 'q parameter required' });
                }
                const history = await searchHistory(pool, {
                    workspaceId: req.workspace.id,
                    q: String(req.query.q),
                    limit: Number(req.query.limit) || 50,
                });
                res.json({ history });
            } catch (err) { next(err); }
        }
    );

    /**
     * DELETE /workbench/history?olderThanDays=
     * Purge old query history (admin only).
     */
    router.delete(
        '/history',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('admin'),
        async (req, res, next) => {
            try {
                const olderThanDays = Number(req.query.olderThanDays);
                if (!olderThanDays || olderThanDays < 1) {
                    return res.status(400).json({
                        error: 'olderThanDays must be >= 1'
                    });
                }
                const rowCount = await purgeHistory(pool, {
                    workspaceId: req.workspace.id,
                    olderThanDays,
                });
                res.json({ deleted: rowCount });
            } catch (err) { next(err); }
        }
    );

    // ── Query Snippets ───────────────────────────────────────────────────────

    /**
     * GET /workbench/snippets
     * List all snippets for the workspace.
     */
    router.get(
        '/snippets',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const snippets = await listSnippets(pool, {
                    workspaceId: req.workspace.id,
                });
                res.json({ snippets });
            } catch (err) { next(err); }
        }
    );

    /**
     * POST /workbench/snippets
     * Create a new snippet.
     * Body: { shortcut, body, description? }
     */
    router.post(
        '/snippets',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const { shortcut, body, description } = req.body || {};
                if (!shortcut || !body) {
                    return res.status(400).json({
                        error: 'shortcut and body required'
                    });
                }
                const snippet = await createSnippet(pool, {
                    workspaceId: req.workspace.id,
                    shortcut,
                    body,
                    description,
                    userId: req.user?.id,
                });
                res.status(201).json({ snippet });
            } catch (err) { next(err); }
        }
    );

    /**
     * PATCH /workbench/snippets/:id
     * Update a snippet.
     * Body: { shortcut?, body?, description? }
     */
    router.patch(
        '/snippets/:id',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const updated = await updateSnippet(pool, {
                    workspaceId: req.workspace.id,
                    id: Number(req.params.id),
                    ...req.body,
                });
                if (!updated) return res.status(404).json({ error: 'not found' });
                res.json({ snippet: updated });
            } catch (err) { next(err); }
        }
    );

    /**
     * DELETE /workbench/snippets/:id
     * Delete a snippet.
     */
    router.delete(
        '/snippets/:id',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const ok = await deleteSnippet(pool, {
                    workspaceId: req.workspace.id,
                    id: Number(req.params.id),
                });
                if (!ok) return res.status(404).json({ error: 'not found' });
                res.json({ ok: true });
            } catch (err) { next(err); }
        }
    );

    // ── Query Sessions (Tabs) ────────────────────────────────────────────────

    /**
     * GET /workbench/tabs
     * Get all tabs for the current user.
     */
    router.get(
        '/tabs',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const tabs = await getUserTabs(pool, {
                    workspaceId: req.workspace.id,
                    userId: req.user.id,
                });
                res.json({ tabs });
            } catch (err) { next(err); }
        }
    );

    /**
     * PUT /workbench/tabs/:tabIndex
     * Create or update a tab.
     * Body: { connectionId, title?, sql?, cursorPos?, isPinned? }
     */
    router.put(
        '/tabs/:tabIndex',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const { connectionId, title, sql, cursorPos, isPinned } = req.body || {};
                if (!connectionId) {
                    return res.status(400).json({ error: 'connectionId required' });
                }
                const tab = await upsertTab(pool, {
                    workspaceId: req.workspace.id,
                    userId: req.user.id,
                    connectionId,
                    tabIndex: Number(req.params.tabIndex),
                    title,
                    sql,
                    cursorPos,
                    isPinned,
                });
                res.json({ tab });
            } catch (err) { next(err); }
        }
    );

    /**
     * DELETE /workbench/tabs/:tabIndex
     * Close a tab.
     */
    router.delete(
        '/tabs/:tabIndex',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const ok = await closeTab(pool, {
                    workspaceId: req.workspace.id,
                    userId: req.user.id,
                    tabIndex: Number(req.params.tabIndex),
                });
                if (!ok) return res.status(404).json({ error: 'not found' });
                res.json({ ok: true });
            } catch (err) { next(err); }
        }
    );

    /**
     * POST /workbench/tabs/reorder
     * Reorder tabs.
     * Body: { order: [tabIdx...] }
     */
    router.post(
        '/tabs/reorder',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('viewer'),
        async (req, res, next) => {
            try {
                const { order } = req.body || {};
                if (!Array.isArray(order)) {
                    return res.status(400).json({
                        error: 'order must be an array'
                    });
                }
                const tabs = await reorderTabs(pool, {
                    workspaceId: req.workspace.id,
                    userId: req.user.id,
                    order,
                });
                res.json({ tabs });
            } catch (err) { next(err); }
        }
    );

    return router;
}
