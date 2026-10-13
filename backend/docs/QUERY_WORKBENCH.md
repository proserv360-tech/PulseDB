# FATHOM — Query Workbench

The query workbench persists the state of the SQL editor on the server so an
engineer can:

- Keep multiple **tabs** open across sessions and devices.
- Browse their **query history** per connection.
- Save and share **named queries** within a workspace.
- Reference reusable SQL chunks as **snippets** (`$snippet:users_active$`).

All state is scoped to the authenticated workspace — cross-workspace leakage
is impossible through the API.

## Migration

`backend/db/migrations/0008_query_workbench.sql` creates four tables under
`pgmonitoringtool`:

- `saved_queries` — named queries (with tags + favorites).
- `query_history` — every executed query with duration, row count, status.
- `query_snippets` — reusable SQL fragments addressed by a shortcut.
- `query_sessions` — one row per open tab, per (workspace, user).

## Saved queries

```
GET    /workbench/saved-queries[?connectionId=&search=&favoritesOnly=]
POST   /workbench/saved-queries
GET    /workbench/saved-queries/:id
PATCH  /workbench/saved-queries/:id
DELETE /workbench/saved-queries/:id
POST   /workbench/saved-queries/:id/favorite
```

`POST` / `PATCH` body:

```json
{
    "connectionId": "prod-primary",
    "name": "Active users (last 7d)",
    "description": "Logins in the last week.",
    "sql": "SELECT … FROM users WHERE last_login_at > now() - interval '7 days'",
    "tags": ["users", "retention"],
    "isFavorite": false
}
```

- **Read** routes require `viewer`.
- **Write** routes (POST / PATCH / DELETE / favorite toggle) require `editor`.
- `(workspace_id, name, connection_id)` is unique — naming collisions in the
  same connection return `409`.

## Query history

```
GET    /workbench/history[?connectionId=&limit=&before=]
GET    /workbench/history/search?q=<needle>
DELETE /workbench/history?olderThanDays=30
```

- History is keyset-paginated on `executed_at DESC` via `before`.
- Search is ILIKE over the `sql` column.
- `DELETE` requires `admin`.

Queries are logged by the existing execute-query path, not by clients
directly. Callers wire up `workbenchService.logQuery` at the point where a
user-issued SQL statement completes.

## Snippets

```
GET    /workbench/snippets
POST   /workbench/snippets
PATCH  /workbench/snippets/:id
DELETE /workbench/snippets/:id
```

A snippet is addressed by a **shortcut** matching `^[a-z][a-z0-9_]{1,39}$`
(lower-snake, 2-40 chars). To use a snippet in SQL, reference it with
`$snippet:shortcut$`:

```sql
SELECT count(*)
FROM orders
WHERE $snippet:is_paid_status$
```

The `expandSnippets(sql, snippetsById)` pure helper substitutes tokens up
to depth 8 (so snippets can reference other snippets) and throws if a cycle
is detected. Unit-tested without a database.

## Tabs (multi-tab sessions)

Tabs are **per user, per workspace** — each user has their own tab list.

```
GET    /workbench/tabs
PUT    /workbench/tabs/:tabIndex        # upsert tab contents
DELETE /workbench/tabs/:tabIndex
POST   /workbench/tabs/reorder          # body: { order: [oldIndex, …] }
```

`PUT` body:

```json
{
    "connectionId": "prod-primary",
    "title": "Slow queries",
    "sql": "SELECT …",
    "cursorPos": 142,
    "isPinned": false
}
```

Reordering is transactional: the new `tab_index` values are written inside a
single transaction so the UI never sees a temporarily-duplicated index.

## Authorisation summary

| Capability                  | Role   |
| --------------------------- | ------ |
| Read own / workspace data   | viewer |
| Create / edit saved queries | editor |
| Manage snippets             | editor |
| Manage own tabs             | viewer |
| Purge workspace history     | admin  |

All routes gate with `authenticate` + `resolveWorkspace` +
`requireWorkspaceRole(...)`. Every DB query filters on `req.workspace.id` —
no implicit cross-workspace access even for admins.
