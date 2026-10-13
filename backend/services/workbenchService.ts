// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/workbenchService.js
 * ────────────────────────────
 * Query workbench: saved queries, history, snippets, and session tabs.
 *
 * Manages:
 *   - Saved queries: team-visible SQL with metadata and favorites
 *   - Query history: audit log of executions with timing/status
 *   - Query snippets: reusable SQL chunks (e.g. "users_by_region")
 *   - Session tabs: multi-tab editor state per user
 */

// ─────────────────────────────────────────────────────────────────────────────
// Saved Queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List saved queries for a workspace, optionally filtered.
 * @param {Pool} pool
 * @param {Object} opts
 *   - workspaceId: required
 *   - connectionId: optional filter by connection
 *   - search: optional substring search on name
 *   - favoritesOnly: if true, only return is_favorite=true
 *   - limit: default 100
 * @returns {Array} saved queries
 */
export async function listSavedQueries(pool, {
    workspaceId,
    connectionId,
    search,
    favoritesOnly = false,
    limit = 100,
}) {
    let sql = `SELECT id, workspace_id, connection_id, name, description, sql, tags,
                      is_favorite, created_by, created_at, updated_at
                 FROM pgmonitoringtool.saved_queries
                WHERE workspace_id = $1`;
    const params = [workspaceId];
    let paramIdx = 2;

    if (connectionId) {
        sql += ` AND connection_id = $${paramIdx}`;
        params.push(connectionId);
        paramIdx++;
    }

    if (favoritesOnly) {
        sql += ` AND is_favorite = true`;
    }

    if (search) {
        sql += ` AND name ILIKE $${paramIdx}`;
        params.push(`%${search}%`);
        paramIdx++;
    }

    sql += ` ORDER BY updated_at DESC LIMIT $${paramIdx}`;
    params.push(limit);

    const { rows } = await pool.query(sql, params);
    return rows;
}

/**
 * Get a single saved query by id.
 * @param {Pool} pool
 * @param {Object} opts
 *   - workspaceId: for scoping
 *   - id: query id
 * @returns {Object|null}
 */
export async function getSavedQuery(pool, { workspaceId, id }) {
    const { rows } = await pool.query(
        `SELECT id, workspace_id, connection_id, name, description, sql, tags,
                is_favorite, created_by, created_at, updated_at
           FROM pgmonitoringtool.saved_queries
          WHERE workspace_id = $1 AND id = $2`,
        [workspaceId, id]
    );
    return rows[0] || null;
}

/**
 * Create a new saved query.
 * @param {Pool} pool
 * @param {Object} opts
 *   - workspaceId
 *   - userId: created_by
 *   - connectionId
 *   - name: required, must be unique per (workspace, connection)
 *   - description: optional
 *   - sql: required
 *   - tags: optional array
 *   - isFavorite: optional boolean
 * @returns {Object} created row with id
 */
export async function createSavedQuery(pool, {
    workspaceId,
    userId,
    connectionId,
    name,
    description,
    sql,
    tags = [],
    isFavorite = false,
}) {
    const { rows } = await pool.query(
        `INSERT INTO pgmonitoringtool.saved_queries
            (workspace_id, connection_id, name, description, sql, tags,
             is_favorite, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
         RETURNING id, workspace_id, connection_id, name, description, sql, tags,
                   is_favorite, created_by, created_at, updated_at`,
        [workspaceId, connectionId, name, description || null, sql, tags, isFavorite, userId || null]
    );
    return rows[0];
}

/**
 * Update fields on a saved query.
 * @param {Pool} pool
 * @param {Object} opts
 *   - workspaceId: for scoping
 *   - id: query id
 *   - ...fields: any fields to update (name, description, sql, tags, is_favorite)
 * @returns {Object|null} updated row
 */
export async function updateSavedQuery(pool, opts) {
    const { workspaceId, id, ...fields } = opts;
    const allowed = ['name', 'description', 'sql', 'tags', 'is_favorite'];
    const updates = [];
    const values = [workspaceId, id];
    let paramIdx = 3;

    for (const key of allowed) {
        if (key in fields) {
            updates.push(`${key} = $${paramIdx}`);
            values.push(fields[key]);
            paramIdx++;
        }
    }

    if (updates.length === 0) return null;

    updates.push(`updated_at = now()`);
    const sql = `UPDATE pgmonitoringtool.saved_queries
                    SET ${updates.join(', ')}
                  WHERE workspace_id = $1 AND id = $2
                  RETURNING id, workspace_id, connection_id, name, description, sql, tags,
                            is_favorite, created_by, created_at, updated_at`;

    const { rows } = await pool.query(sql, values);
    return rows[0] || null;
}

/**
 * Delete a saved query.
 * @param {Pool} pool
 * @param {Object} opts
 *   - workspaceId: for scoping
 *   - id: query id
 * @returns {boolean} true if deleted
 */
export async function deleteSavedQuery(pool, { workspaceId, id }) {
    const { rowCount } = await pool.query(
        `DELETE FROM pgmonitoringtool.saved_queries
          WHERE workspace_id = $1 AND id = $2`,
        [workspaceId, id]
    );
    return rowCount > 0;
}

/**
 * Toggle is_favorite on a saved query.
 * @param {Pool} pool
 * @param {Object} opts
 *   - workspaceId: for scoping
 *   - id: query id
 * @returns {Object|null} updated row
 */
export async function toggleFavorite(pool, { workspaceId, id }) {
    const { rows } = await pool.query(
        `UPDATE pgmonitoringtool.saved_queries
            SET is_favorite = NOT is_favorite, updated_at = now()
          WHERE workspace_id = $1 AND id = $2
          RETURNING is_favorite`,
        [workspaceId, id]
    );
    return rows[0] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Query History
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log a query execution.
 * @param {Pool} pool
 * @param {Object} opts
 *   - workspaceId
 *   - userId: executed_by
 *   - connectionId
 *   - sql
 *   - rowCount: optional
 *   - durationMs: optional
 *   - status: 'ok' or 'error'
 *   - error: optional error message
 * @returns {Object} created row
 */
export async function logQuery(pool, {
    workspaceId,
    userId,
    connectionId,
    sql,
    rowCount,
    durationMs,
    status = 'ok',
    error,
}) {
    const { rows } = await pool.query(
        `INSERT INTO pgmonitoringtool.query_history
            (workspace_id, connection_id, executed_by, sql, row_count,
             duration_ms, status, error, executed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
         RETURNING id, workspace_id, connection_id, executed_by, sql,
                   row_count, duration_ms, status, error, executed_at`,
        [workspaceId, connectionId, userId || null, sql, rowCount || null,
         durationMs || null, status, error || null]
    );
    return rows[0];
}

/**
 * List query history with keyset pagination on executed_at.
 * @param {Pool} pool
 * @param {Object} opts
 *   - workspaceId
 *   - userId: if provided, filter to this user's queries; if null, return all workspace queries
 *   - connectionId: optional filter by connection
 *   - limit: default 100
 *   - before: optional ISO timestamp for keyset pagination (return queries before this time)
 * @returns {Array} history rows
 */
export async function listHistory(pool, {
    workspaceId,
    userId,
    connectionId,
    limit = 100,
    before,
}) {
    let sql = `SELECT id, workspace_id, connection_id, executed_by, sql, row_count,
                      duration_ms, status, error, executed_at
                 FROM pgmonitoringtool.query_history
                WHERE workspace_id = $1`;
    const params = [workspaceId];
    let paramIdx = 2;

    if (userId !== null && userId !== undefined) {
        sql += ` AND executed_by = $${paramIdx}`;
        params.push(userId);
        paramIdx++;
    }

    if (connectionId) {
        sql += ` AND connection_id = $${paramIdx}`;
        params.push(connectionId);
        paramIdx++;
    }

    if (before) {
        sql += ` AND executed_at < $${paramIdx}`;
        params.push(before);
        paramIdx++;
    }

    sql += ` ORDER BY executed_at DESC LIMIT $${paramIdx}`;
    params.push(limit);

    const { rows } = await pool.query(sql, params);
    return rows;
}

/**
 * Search query history by SQL text (ILIKE).
 * @param {Pool} pool
 * @param {Object} opts
 *   - workspaceId
 *   - q: search query string
 *   - limit: default 50
 * @returns {Array} matching history rows
 */
export async function searchHistory(pool, { workspaceId, q, limit = 50 }) {
    const { rows } = await pool.query(
        `SELECT id, workspace_id, connection_id, executed_by, sql, row_count,
                duration_ms, status, error, executed_at
           FROM pgmonitoringtool.query_history
          WHERE workspace_id = $1 AND sql ILIKE $2
          ORDER BY executed_at DESC
          LIMIT $3`,
        [workspaceId, `%${q}%`, limit]
    );
    return rows;
}

/**
 * Purge old query history.
 * @param {Pool} pool
 * @param {Object} opts
 *   - workspaceId
 *   - olderThanDays: delete records older than this many days
 * @returns {number} rows deleted
 */
export async function purgeHistory(pool, { workspaceId, olderThanDays }) {
    const { rowCount } = await pool.query(
        `DELETE FROM pgmonitoringtool.query_history
          WHERE workspace_id = $1
            AND executed_at < now() - interval '${Number(olderThanDays)} days'`,
        [workspaceId]
    );
    return rowCount;
}

// ─────────────────────────────────────────────────────────────────────────────
// Query Snippets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List all snippets for a workspace.
 * @param {Pool} pool
 * @param {Object} opts
 *   - workspaceId
 * @returns {Array}
 */
export async function listSnippets(pool, { workspaceId }) {
    const { rows } = await pool.query(
        `SELECT id, workspace_id, shortcut, body, description, created_by, created_at
           FROM pgmonitoringtool.query_snippets
          WHERE workspace_id = $1
          ORDER BY shortcut ASC`,
        [workspaceId]
    );
    return rows;
}

/**
 * Get a single snippet by id.
 * @param {Pool} pool
 * @param {Object} opts
 *   - workspaceId
 *   - id
 * @returns {Object|null}
 */
export async function getSnippet(pool, { workspaceId, id }) {
    const { rows } = await pool.query(
        `SELECT id, workspace_id, shortcut, body, description, created_by, created_at
           FROM pgmonitoringtool.query_snippets
          WHERE workspace_id = $1 AND id = $2`,
        [workspaceId, id]
    );
    return rows[0] || null;
}

/**
 * Create a new snippet.
 * @param {Pool} pool
 * @param {Object} opts
 *   - workspaceId
 *   - shortcut: e.g. "users_by_region" (unique per workspace)
 *   - body: the SQL snippet text
 *   - description: optional
 *   - userId: created_by
 * @returns {Object} created row
 */
export async function createSnippet(pool, {
    workspaceId,
    shortcut,
    body,
    description,
    userId,
}) {
    const { rows } = await pool.query(
        `INSERT INTO pgmonitoringtool.query_snippets
            (workspace_id, shortcut, body, description, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, now())
         RETURNING id, workspace_id, shortcut, body, description, created_by, created_at`,
        [workspaceId, shortcut, body, description || null, userId || null]
    );
    return rows[0];
}

/**
 * Update a snippet.
 * @param {Pool} pool
 * @param {Object} opts
 *   - workspaceId
 *   - id
 *   - shortcut: optional
 *   - body: optional
 *   - description: optional
 * @returns {Object|null} updated row
 */
export async function updateSnippet(pool, opts) {
    const { workspaceId, id, ...fields } = opts;
    const allowed = ['shortcut', 'body', 'description'];
    const updates = [];
    const values = [workspaceId, id];
    let paramIdx = 3;

    for (const key of allowed) {
        if (key in fields) {
            updates.push(`${key} = $${paramIdx}`);
            values.push(fields[key]);
            paramIdx++;
        }
    }

    if (updates.length === 0) return null;

    const sql = `UPDATE pgmonitoringtool.query_snippets
                    SET ${updates.join(', ')}
                  WHERE workspace_id = $1 AND id = $2
                  RETURNING id, workspace_id, shortcut, body, description, created_by, created_at`;

    const { rows } = await pool.query(sql, values);
    return rows[0] || null;
}

/**
 * Delete a snippet.
 * @param {Pool} pool
 * @param {Object} opts
 *   - workspaceId
 *   - id
 * @returns {boolean}
 */
export async function deleteSnippet(pool, { workspaceId, id }) {
    const { rowCount } = await pool.query(
        `DELETE FROM pgmonitoringtool.query_snippets
          WHERE workspace_id = $1 AND id = $2`,
        [workspaceId, id]
    );
    return rowCount > 0;
}

/**
 * Expand $snippet:name$ tokens in SQL with snippet bodies.
 *
 * PURE HELPER — no side effects, exported for testing.
 *
 * Recursion depth limit is 8. Throws if exceeded (cycle detection).
 * If a snippet is not found, the token is left as-is (safe fallback).
 *
 * @param {string} sql - the SQL string
 * @param {Map<string, string>} snippetsById - map of shortcut → body
 * @param {number} depth - internal: tracks recursion depth
 * @returns {string} expanded SQL
 */
export function expandSnippets(sql, snippetsById, depth = 0) {
    if (!sql) return sql;
    if (!snippetsById) return sql;

    // Recursion depth limit: prevent infinite cycles
    if (depth > 8) {
        throw new Error('Snippet expansion exceeded recursion depth limit (8)');
    }

    // Replace $snippet:name$ tokens with snippet body
    let expanded = sql;
    const tokenRegex = /\$snippet:([a-z][a-z0-9_]{0,39})\$/g;
    let hasMatch = false;

    expanded = expanded.replace(tokenRegex, (match, shortcut) => {
        if (!(shortcut in snippetsById)) {
            // Unknown snippet — leave token as-is
            return match;
        }
        hasMatch = true;
        return snippetsById[shortcut] || '';
    });

    // If we replaced anything, recursively expand (might have nested tokens)
    if (hasMatch) {
        expanded = expandSnippets(expanded, snippetsById, depth + 1);
    }

    return expanded;
}

// ─────────────────────────────────────────────────────────────────────────────
// Query Sessions (Tabs)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all tabs for a user in a workspace.
 * @param {Pool} pool
 * @param {Object} opts
 *   - workspaceId
 *   - userId
 * @returns {Array} tabs sorted by tab_index
 */
export async function getUserTabs(pool, { workspaceId, userId }) {
    const { rows } = await pool.query(
        `SELECT id, workspace_id, user_id, connection_id, tab_index, title, sql,
                cursor_pos, is_pinned, updated_at
           FROM pgmonitoringtool.query_sessions
          WHERE workspace_id = $1 AND user_id = $2
          ORDER BY tab_index ASC`,
        [workspaceId, userId]
    );
    return rows;
}

/**
 * Create or update a tab in the editor.
 * @param {Pool} pool
 * @param {Object} opts
 *   - workspaceId
 *   - userId
 *   - connectionId
 *   - tabIndex: 0-based index
 *   - title: optional
 *   - sql: optional
 *   - cursorPos: optional, default 0
 *   - isPinned: optional boolean
 * @returns {Object} upserted row
 */
export async function upsertTab(pool, {
    workspaceId,
    userId,
    connectionId,
    tabIndex,
    title,
    sql,
    cursorPos,
    isPinned,
}) {
    const { rows } = await pool.query(
        `INSERT INTO pgmonitoringtool.query_sessions
            (workspace_id, user_id, connection_id, tab_index, title, sql,
             cursor_pos, is_pinned, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
         ON CONFLICT (workspace_id, user_id, tab_index)
         DO UPDATE SET
            connection_id = EXCLUDED.connection_id,
            title = EXCLUDED.title,
            sql = EXCLUDED.sql,
            cursor_pos = EXCLUDED.cursor_pos,
            is_pinned = EXCLUDED.is_pinned,
            updated_at = now()
         RETURNING id, workspace_id, user_id, connection_id, tab_index, title, sql,
                   cursor_pos, is_pinned, updated_at`,
        [workspaceId, userId, connectionId, tabIndex, title || null, sql || null,
         cursorPos || 0, isPinned || false]
    );
    return rows[0];
}

/**
 * Close (delete) a tab.
 * @param {Pool} pool
 * @param {Object} opts
 *   - workspaceId
 *   - userId
 *   - tabIndex
 * @returns {boolean} true if deleted
 */
export async function closeTab(pool, { workspaceId, userId, tabIndex }) {
    const { rowCount } = await pool.query(
        `DELETE FROM pgmonitoringtool.query_sessions
          WHERE workspace_id = $1 AND user_id = $2 AND tab_index = $3`,
        [workspaceId, userId, tabIndex]
    );
    return rowCount > 0;
}

/**
 * Reorder tabs by setting new tab_index values.
 *
 * Takes an array of tab indices and renumbers them 0, 1, 2, ... in order.
 *
 * @param {Pool} pool
 * @param {Object} opts
 *   - workspaceId
 *   - userId
 *   - order: array of old tab indices, e.g. [2, 0, 1] means tab 2 becomes 0, tab 0 becomes 1, etc.
 * @returns {Array} updated tabs sorted by new tab_index
 */
export async function reorderTabs(pool, { workspaceId, userId, order = [] }) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Temporary renumber to avoid unique constraint violations
        let idx = 1000;
        for (const oldTabIdx of order) {
            await client.query(
                `UPDATE pgmonitoringtool.query_sessions
                    SET tab_index = $1
                  WHERE workspace_id = $2 AND user_id = $3 AND tab_index = $4`,
                [idx, workspaceId, userId, oldTabIdx]
            );
            idx++;
        }

        // Final renumber: 0, 1, 2, ...
        idx = 0;
        for (const oldTabIdx of order) {
            const newIdx = idx++;
            await client.query(
                `UPDATE pgmonitoringtool.query_sessions
                    SET tab_index = $1, updated_at = now()
                  WHERE workspace_id = $2 AND user_id = $3 AND tab_index = $4`,
                [newIdx, workspaceId, userId, 1000 + (order.indexOf(oldTabIdx))]
            );
        }

        await client.query('COMMIT');

        // Fetch updated tabs
        const { rows } = await client.query(
            `SELECT id, workspace_id, user_id, connection_id, tab_index, title, sql,
                    cursor_pos, is_pinned, updated_at
               FROM pgmonitoringtool.query_sessions
              WHERE workspace_id = $1 AND user_id = $2
              ORDER BY tab_index ASC`,
            [workspaceId, userId]
        );
        return rows;
    } finally {
        client.release();
    }
}
