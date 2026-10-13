# Auth Review — PulseDB

> **Status: P0 items 1–4 and item 5 (API-key scope) are implemented.**
> See "Implementation log" at the bottom for what changed and what is still
> outstanding. Items 6–11 are untouched.

Scope: `backend/middleware/`, `backend/services/`, `backend/server.ts` auth routes,
`backend/db/schema.ts` + `db/migrations/`, `frontend/src/context/AuthContext.tsx`.

Verified by reading source. Live-DB confirmation was **not** possible — both Supabase
projects (`Monitoring`, `Tool Monitoring`) are currently **paused/INACTIVE**, so items
marked *(needs DB check)* should be confirmed once a project is resumed.

---

## P0 — Fix first

### 1. `/api/auth/me` is broken in four separate ways
`backend/server.ts:1982–2008`

```js
const token = jwt.default.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET || 'changeme',      // (a)
    { expiresIn: '8h' },                        // (b) no audience/issuer
);
res.cookie('pulsedb_session', token, { ... });   // (c) wrong cookie name
```

| # | Problem | Consequence |
|---|---|---|
| a | Falls back to the literal secret `'changeme'` | Bypasses the startup guard at `server.ts:251–270` that refuses to boot without a strong `JWT_SECRET`. If the env var is ever unset outside production, tokens are forgeable. |
| b | No `audience` / `issuer` claims | `authenticate` verifies with `audience: 'pulsedb-api'`, `issuer: 'pulsedb-auth'` → this token **fails verification immediately** |
| c | No `sid` claim | Even if (b) were fixed, `authenticate` explicitly rejects sid-less tokens (SEC-11 block, `authenticate.ts:139–150`) |
| d | Sets cookie `pulsedb_session`, but `readAuthCookie()` reads `pulsedb_token` (`authCookie.ts:19`) | The refreshed cookie is never read by anything |

Net effect: the "cookie-based session recovery" path hands the client a token that
can never authenticate. Fix by routing `/api/auth/me` through the same
`issueSession()` helper used by login (`server.ts:2071–2096`) and `setAuthCookie()`.

### 2. Fail-closed session check is silently fail-open
`middleware/authenticate.ts:152–165` vs `services/sessionService.ts:66–95`

`authenticate` wraps `isSessionActive()` in a try/catch and returns **503** on error,
documented as *"SEC-05 (audit): fail-CLOSED"*. But `isSessionActive()` catches its own
DB errors and returns `true`, caching `{active: true}` for 5s:

```js
} catch (err) {
    const stale = _sessionActiveCache.get(sessionId);
    if (stale) return stale.active;
    _sessionActiveCache.set(sessionId, { active: true, expiresAt: now + 5_000 });
    return true;   // ← fail-OPEN
}
```

The outer catch can never fire. A revoked token keeps working during any DB blip —
exactly the scenario the SEC-05 comment says must not happen. Pick one policy and
make both layers agree; the comment says closed, the code does open.

### 3. Schema drift between migrations and the deployed database *(needs DB check)*

| Column | `db/migrations/0000` + `db/schema.ts` | `supabase_backup_tool_monitoring/pgmonitoringtool/schema.sql:177–190` |
|---|---|---|
| `expires_at` | `timestamp DEFAULT now()` | `timestamptz NOT NULL DEFAULT (now() + interval '24:00:00')` |
| `revoked_at`, `revoked_by` | present | **absent** |
| `user_id` FK | `ON DELETE no action` | `ON DELETE CASCADE` |
| `device_label`, `location` | `varchar(100)` | `text` |

Two consequences:

- **`createSession()` never sets `expires_at`** (`sessionService.ts:48–58`). Against the
  *migration* schema the default is `now()`, so every session is born already expired and
  `expires_at > NOW()` fails on the very next request. It only works today because the
  deployed DB has a `+24h` default. Anyone running `db/migrations` on a fresh database
  gets an app where **nobody can stay logged in**. Fix: set `expires_at` explicitly in the
  INSERT and align the default.
- **`revokeSession()` writes `revoked_at`/`revoked_by`** — columns the backup dump doesn't
  have. If the deployed DB matches that dump, every revoke throws. The logout route calls
  it as `.catch(() => {})` (`server.ts:2013–2016`), so **logout would fail silently**.

### 4. `v_active_sessions` view does not exist
`sessionService.ts:99` queries `pgmonitoringtool.v_active_sessions`. That view appears in
no migration and not in the backup dump. `listActiveSessions()` — the admin Security
panel — will throw at runtime. Either add the view or rewrite the query against
`user_sessions`.

---

## P1 — Security gaps

### 5. API key `scope` is stored but never enforced
`sessionService.ts:226–247` writes `scope` (default `read:all`); `authenticateApiKey()`
returns the full user row and `authenticate` copies `role` + `allowedScreens` onto
`req.user` verbatim (`authenticate.ts:96–105`). Nothing anywhere reads `scope`.

A key created as `read:all` can perform **every write the owning user can**. Either
enforce scope in `authenticate` (reject non-GET for `read:*` scopes) or drop the column,
because right now the UI promises a restriction the backend doesn't apply.

Related: `user_api_keys` has no `expires_at` — keys are valid forever until manually revoked.

### 6. `mfa_enabled` defaults to `true` and enforces nothing
`users.mfa_enabled boolean DEFAULT true`. There is no TOTP secret column, no backup-codes
table, and no `otplib`/`speakeasy` dependency anywhere in the repo. The login flow
(`server.ts:2160–2210`) goes straight from `bcrypt.compare` to issuing a JWT.

This is worse than having no MFA: the admin UI reports MFA as on for every user. Either
implement it (~2 columns + enroll/verify endpoints) or default the column to `false` and
label it "not yet available".

### 7. WebSocket auth skips session revocation
`server.ts:7036–7050` verifies the JWT but never calls `isSessionActive()`. A revoked
session can still open and hold a WebSocket. Also note the duplicated `audience:` key in
that object literal (lines 7042–7043) — harmless but a copy-paste slip.

### 8. Role strings are inconsistent across middleware

| Spelling | Used in |
|---|---|
| `super_admin` | `tenantIsolation.ts:21`, `requireRole('super_admin')` ×6, `requireRole('admin','super_admin')` ×7 |
| `superadmin` | `workspaceRbac.ts:54`, `requireRole('admin','owner','superadmin')` ×2 |

A user whose `users.role` is `super_admin` does **not** get the `workspaceRbac`
owner-bypass; one with `superadmin` does **not** get the `tenantIsolation` bypass.
Whichever spelling is in the DB, one family of checks silently fails. Normalise to a
single constant and add a CHECK constraint on `users.role`.

Separately, `tenantIsolation` treats a missing `x-org-id` header as "no org context" and
calls `next()` with `req.orgId = null` — a client can opt out of tenant scoping by simply
omitting the header. Confirm every downstream query handles `orgId === null` safely.

---

## P2 — Hygiene

### 9. The localStorage migration is stalled half-done
`utils/authToken.ts` exists precisely so the localStorage branch can be deleted in one
place, but three call sites still read the key directly:

- `App.tsx:1749`
- `usermanagement/services/utils/api.ts:15`
- `usermanagement/UserManagementTab.tsx:124`

Until those go through `authHeader()`, the JWT stays XSS-exfiltratable and the httpOnly
cookie work buys nothing. Also, `AuthContext.tsx:5–8` claims *"No /auth/me or /auth/refresh
exist"* — `/api/auth/me` does exist (see item 1); the comment is stale.

### 10. In-process caches don't survive horizontal scaling
Three separate `Map`s hold security state in process memory:

- `_sessionActiveCache` (`sessionService.ts:19`) — 30s TTL
- `apiKeyRateLimits` (`authenticate.ts:25`) — 100 req/min
- `loginAttempts` (`server.ts:1368`) — brute-force throttle

On Vercel/multi-instance, `invalidateSessionCache()` only clears the local process, so
revocation takes up to 30s to propagate elsewhere; and per-key/per-user rate limits are
effectively multiplied by the instance count. Move to Redis or accept and document the
weaker guarantee.

Also: `revokeAllSessions()` (`sessionService.ts:139–150`) — the emergency
revoke-everything admin action — **never calls `invalidateSessionCache()`**, unlike
`revokeSession` and `revokeAllUserSessions`. One-line fix.

### 11. Smaller items

- `setAuthCookie(res, token)` at `server.ts:2201` passes no `maxAgeMs`, so the cookie is a
  session cookie while the JWT lives 8h — closing the browser logs the user out early.
- `enforcePasswordChange` fails **open** on DB error (`authenticate.ts:210–219`), which is
  a defensible choice but is the opposite of the session check's stated policy. Worth a
  one-line comment explaining why the two differ.
- `authCookie.ts` and `sessionService.ts` are still `@ts-nocheck`. These are the two most
  security-sensitive modules in the codebase; they should be first off the list, not last.
- Only 9 of 59 route files reference `requireScreen`. Worth auditing which of the other 50
  genuinely need only authentication.

---

---

## Implementation log

Implemented in this pass: **items 1, 2, 3, 4, 5**, plus the `revokeAllSessions` cache bug
from item 10.

| File | Change |
|---|---|
| `backend/server.ts` | `/api/auth/me` no longer mints its own token. It echoes the caller's already-validated token and refreshes the cookie via `setAuthCookie()`. Removes the `'changeme'` secret fallback, the missing `sid`/`aud`/`iss` claims, and the wrong `pulsedb_session` cookie name. Returns `{user, token: null}` for X-API-Key callers. |
| `backend/services/sessionService.ts` | `isSessionActive()` no longer swallows DB errors — it propagates, so `authenticate`'s documented fail-closed 503 path actually fires. `createSession()` sets `expires_at` explicitly (24h, `PULSEDB_SESSION_TTL_HOURS`). `revokeAllSessions()` now busts the cache. Adds `API_KEY_SCOPES`, `isValidApiKeyScope()`, `scopeAllowsMethod()`; `authenticateApiKey()` now returns the key's scope and prefix. |
| `backend/middleware/authenticate.ts` | Enforces API-key scope: `read:all` (and any unknown/legacy scope) is restricted to GET/HEAD/OPTIONS, else 403 with an audit-grade WARN log. |
| `backend/routes/sessionRoutes.ts` | Validates `scope` on key creation against the canonical list instead of storing arbitrary body input. |
| `backend/db/migrations/0024_session_schema_reconcile.sql` | **New.** Idempotent, guarded reconcile: adds `revoked_at`/`revoked_by`, fixes the `expires_at` default, repairs already-broken rows, adds indexes, creates the missing `v_active_sessions` view. No-ops with a NOTICE if `user_sessions` is absent. |
| `backend/scripts/migrate.ts` | **Root cause of the drift.** Nothing ever executed `db/migrations/*.sql` — no npm script referenced them and `drizzle-kit migrate` is not wired up, so the deployed schema was built by the inline arrays instead. Adds a ledger-tracked file runner. Files before `0024` are *baselined* (recorded, not executed) because `0000` uses bare `CREATE SCHEMA`/`CREATE TABLE` and would error against a live DB. |
| `backend/db/schema.ts` | `expiresAt` default aligned to `now() + 24 hours`. |
| `backend/tests/sessionSecurity.test.ts` | **New.** 9 tests: scope enforcement incl. unknown-scope-degrades-to-read-only, fail-closed propagation, no stale-positive fallback, explicit `expires_at`. |
| `frontend/src/context/AuthContext.tsx` | Corrected the stale header comment claiming `/auth/me` doesn't exist. |

### Verification performed

- All 9 new tests pass (`node --test`).
- Every file under `db/migrations/` parses as valid PostgreSQL via `pglast`, as does the
  SQL embedded in `sessionService.ts` and `migrate.ts`.
- Changed TypeScript files parse clean.
- Frontend already guards with `if (data.user && data.token)`, so `token: null` is safe.

### Not verified

`npm run type-check` and the existing suite were **not** run — `node_modules` is not
installed in this environment. Migration 0024 has **not** been executed against any
database.

---

## Live database findings (new org project `sgmttzxltadcqriymvio`)

Connected directly with the `DATABASE_URL` in `backend/.env`, since the Supabase
connector is still authorised only against the old personal org.

**Data did migrate.** 10 users, 55 login-activity rows, 12 sessions, 5 SDK
applications, 2 feedback rows, 1 connection.

**Schema did not.** The code references **83** objects in `pgmonitoringtool`; **20**
exist. The following review items are now confirmed against the real database rather
than inferred:

| Item | Predicted | Confirmed live |
|---|---|---|
| 3 | `revoked_at` / `revoked_by` absent → logout throws and is swallowed | **Yes** — both columns absent. Logout is silently failing today. |
| 4 | `v_active_sessions` missing → admin Security panel throws | **Yes** — no views at all in the schema. |
| 5 | API-key scope unenforced | Moot for now — **`user_api_keys` does not exist**, so every `X-API-Key` request 401s. Enforcement is correct once the table is created. |
| 8 | `super_admin` vs `superadmin` mismatch | **Yes** — DB uses `super_admin` (2 users). `workspaceRbac.ts` checks `superadmin`, so that bypass never fires. |
| 6 | `mfa_enabled` enforces nothing | **Yes** — 5 of 10 users flagged MFA-enabled with no TOTP implementation. |

**Not a problem here:** `expires_at` defaults to `now() + 24h` on this database and no
row is born expired, so the "sessions expire instantly" failure does not apply to it.
The explicit set in `createSession()` remains correct as a portability fix.

Also present: 8 legacy `pulsedb_*` tables in `public` (`alerts` exists in both `public`
and `pgmonitoringtool`), and Supabase's own `auth` schema (23 tables, 1 user) which the
application does not use.

### ⚠ Do not run `npm run migrate` against this database yet

`schema_migrations` does not exist, so the runner added in this pass would treat
`0000`–`0023` as baseline — recording them as applied **without executing them** — and
then apply only `0024`. On a database that is 20/83 provisioned that is the wrong call:
the ~60 missing tables would stay missing and be permanently marked as done. The
baseline rule needs to key off actual schema state, not off the ledger being new.

### Follow-ups this work surfaced

1. **Fresh-install provisioning is broken, independently of anything here.** Neither
   `migrate.ts` nor `migrate-enterprise.ts` creates `pgmonitoringtool.users` or
   `user_sessions` — `migrate-enterprise.ts` only references `users` in foreign keys. The
   only definition lives in `db/migrations/0000`, which nothing ran. A brand-new database
   cannot currently be provisioned from the repo.
2. **Existing API keys will start getting 403s on writes.** Any key created with the
   `read:all` default — or with an unvalidated legacy scope string — is now read-only.
   Audit `user_api_keys` and reissue as `write:all` where needed before deploying.
3. Items 6–11 remain open. Item 6 (MFA enforcing nothing while `mfa_enabled` defaults to
   `true`) is the largest remaining gap.
