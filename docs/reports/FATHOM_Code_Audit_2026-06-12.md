# FATHOM — Code Audit

**Date:** 12 June 2026
**Scope:** June 2026 gap-sprint code (agent loop, query advisor, schema tracking,
what-if index, backup executor, query-stats rollup, collector) plus a security
pass over auth, secrets, injection, and multi-tenancy. All findings below were
**fixed in this pass** unless marked otherwise.

## Summary

| ID       | Severity | Area                                                   | Status   |
| -------- | -------- | ------------------------------------------------------ | -------- |
| HIGH-1   | High     | Cross-tenant access (IDOR) on advisor/schema routes    | Fixed    |
| MEDIUM-1 | Medium   | Unbounded query execution (DoS) in benchmark/what-if   | Fixed    |
| LOW-1    | Low      | Read-only SQL guard false positive / comment bypass    | Fixed    |
| LOW-2    | Low      | Backups grow without bound (no retention)              | Fixed    |
| INFO-1   | Info     | 9 moderate npm advisories under optional snowflake-sdk | Accepted |

Scanners: no secrets in tracked source (one placeholder string in
`terraformService.ts`). `spawn()` backup calls use argument arrays, not a shell —
no command injection. Backup artifact names are sanitized — no path traversal.
All SQL in the new services parameterizes user values via `$N` placeholders.

---

## HIGH-1 — Cross-tenant data access (IDOR)

**Where:** `routes/queryAdvisorRoutes.ts`, `routes/schemaTrackingRoutes.ts`.

**Problem:** the new routes read tenant identifiers straight from the query
string — `workspaceId` (`req.query.workspaceId || 'default'`) for the query
advisor, and `connectionId` for the schema timeline — with no ownership check.
An authenticated user in tenant A could pass `?workspaceId=B` to read or sweep
another tenant's query recommendations, or `?connectionId=<other>` to read
another connection's schema-drift history. This is the same class the April
audit flagged for SCIM.

**Fix:** route advisor endpoints through the existing `resolveWorkspace` +
`requireWorkspaceRole` middleware, which derives the workspace from the
authenticated user's membership and ignores any client-supplied id;
`setRecommendationStatus` now also scopes its `UPDATE ... WHERE workspace_id = $`.
The schema timeline read now calls `resolveConnection(connectionId, userId)`,
which throws on a connection the user does not own (fail-closed). The capture
path was already safe because it goes through `reqPool`, which binds the pool to
`req.user.id`.

## MEDIUM-1 — Unbounded query execution (DoS)

**Where:** `services/queryAdvisorService.ts` (`benchmarkRewrite`),
`services/whatIfIndexService.ts` (`whatIfAnalysis`).

**Problem:** both run `EXPLAIN` against a user-supplied statement with no
execution cap. `SELECT pg_sleep(30)` passed the read-only guard and pinned a DB
connection; in `EXPLAIN ANALYZE` mode the statement actually executes. Any
authenticated user could exhaust the connection pool.

**Fix:** `SET LOCAL statement_timeout = '15s'` inside the (already
rolled-back) transaction in both code paths.

## LOW-1 — Read-only SQL guard false positive & comment bypass

**Where:** the local `SELECT_ONLY` / `FORBIDDEN` regexes in the advisor and
what-if services.

**Problem:** keyword matching on raw SQL flagged write keywords appearing inside
string literals (a legitimate `WHERE name = 'delete me'` was rejected) and could
in principle be steered by comments.

**Fix:** new shared `services/sqlReadGuard.ts` with `stripSqlLiterals()` that
removes string, dollar-quoted, and comment spans before the keyword test, plus a
stacked-statement check. Both services now call `isReadOnlySelect()`. Verified by
`tests/sqlReadGuard.test.ts`: allows `'delete me'` literals, blocks
CTE-wrapped `DELETE … RETURNING`, stacked statements, and comment-hidden writes.

## LOW-2 — Backups grow without bound

**Where:** `services/backupExecutor.ts`.

**Problem:** successful backups were never pruned, so artifacts accumulated
indefinitely on the host.

**Fix:** `pruneOldArtifacts(scheduleId)` keeps the newest `BACKUP_KEEP` (default
7, override via `FATHOM_BACKUP_KEEP`) artifacts per schedule and runs after each
successful backup. Best-effort: prune failures never fail the backup.

## INFO-1 — npm advisories

`npm audit` reports 9 moderate advisories, all transitive under the **optional**
`snowflake-sdk` driver (fast-xml-parser, uuid, @azure/core-http chain). They are
not in the default install path and clearing them requires a snowflake-sdk major
bump. Accepted for now; revisit when bumping the Snowflake adapter.

---

## Confirmed safe (no action)

- **Command injection:** backup `spawn(tool, argsArray, …)` never uses a shell.
- **Path traversal:** artifact names sanitize the database name (`[^\w-]` → `_`).
- **SQL injection:** new services use `$N` placeholders; the only interpolated
  SQL (the `EXPLAIN` prefix in benchmark) is now guarded by `isReadOnlySelect`.
- **Connection ownership:** `getPool(connectionId, userId)` scopes DB pools per
  user; reqPool-based routes inherit this.
- **Collector secrets:** the SDK key is read from env, not argv.

## Verification

- `npx tsc --noEmit` (backend): 0 errors.
- New/affected suites: `sqlReadGuard`, `queryAdvisor`, `whatIfIndex`,
  `backupExecutor` — 29/29 pass.
- Full backend suite green prior to this pass (575 tests).

## Recommended follow-ups (not done here)

- Add integration tests asserting a cross-tenant `workspaceId`/`connectionId`
  returns 403/404 (defense-in-depth for HIGH-1).
- Consider a global default `statement_timeout` on the monitored-connection
  pools, so read endpoints beyond the advisor are also bounded.
- Continue the TypeScript `@ts-nocheck` burn-down (155 files remain) to widen
  static coverage over the older route/service layer.
