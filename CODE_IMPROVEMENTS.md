# Codebase Improvement Review

Whole-repo pass, measured rather than eyeballed. Every number below came from a script
run against the tree.

| Area | Files | Lines |
|---|---|---|
| `backend` | 254 | 64,453 |
| `frontend/src` | 218 | 167,628 |
| `sdk` | 34 | 7,562 |
| `python` | 19 | 4,838 |
| `shared` | 10 | 1,128 |
| `collector` | 5 | 768 |

The engineering here is not sloppy — there's a CI matrix, semgrep rules, gitleaks, a
migration-review GitHub Action, structured logging, encryption-at-rest, CSRF
double-submit, and genuinely thoughtful security comments in the auth middleware. The
problems below are mostly about **guarantees that are declared but not enforced**.

---

## 1. Type safety is switched on in config and off in practice — *highest leverage*

`backend/tsconfig.json` sets `"strict": true`. But:

- **172 of 254 backend files (68%) carry `@ts-nocheck`**
- 541 explicit `: any` annotations across the repo
- CI runs `cd backend && npx tsc --noEmit` — which passes trivially for two-thirds of the code

Frontend is the opposite: 1 of 209 files has `@ts-nocheck`. The problem is backend-only.

The files opted out include `services/sessionService.ts` and `services/authCookie.ts` —
the two modules that decide whether a request is authenticated. Each `@ts-nocheck` header
says *"remove after typing this module"*; they're dated 2026-06-10.

**Do:** burn the list down starting with `services/` and `middleware/`. Add a CI ratchet
that counts `@ts-nocheck` occurrences and fails if the number goes up. That stops the
bleed in one commit and makes the reduction visible.

## 2. Silent failure is the house style — *this already cost you*

**129 sites** matching `.catch(() => {})`, `.catch(() => null)`, or `catch {}`.

This is not hypothetical damage. The database review found that `writeAudit`,
`revokeSession`, alert creation, and API-key auth are all failing against the live
database right now — and every one of them is invisible *because* of this pattern. The
audit table has 0 rows next to 55 recorded logins and nothing ever reported it.

**Do:** replace bare swallows with a shared helper — `swallow(err, { component, op })`
that logs at WARN with a tag. Keep the non-throwing behaviour, lose the silence. Then add
an eslint rule banning the empty form so it can't come back. This is a mechanical change
with an outsized payoff.

## 3. `server.ts` is a 7,379-line god file with 109 inline routes

Eight routers are already mounted from `routes/`, and there are 59 route modules — so the
decomposition pattern exists and is understood. 109 endpoints just never moved. The file
also holds config, CSRF middleware, the CORS allow-list, brute-force throttling, the
WebSocket server, connection pooling, and the login flow.

**Do:** extract by domain into the existing `routes/` convention, a slice at a time.
Auth-related endpoints first, since they're the ones under active change.

## 4. Test coverage is inverted — the risky code is the untested code

55 test files against 59 route modules and 63 service modules. But **37 of 59 route files
have no matching test**, including:

`adminRoutes`, `userRoutes`, `samlRoutes`, `governanceRoutes`, `kmsRoutes`,
`pluginRoutes`, `integrationsRoutes`, `repoRoutes`, `reportRoutes`, `retentionRoutes`

What *is* well tested: pure services — parsers, the alert DSL, SCIM filters, explain
plans. Those are the easy, safe ones. The untested set is where authentication,
authorisation, key management and tenant data live.

**Do:** integration tests for `adminRoutes`, `userRoutes` and `samlRoutes` first. The
`tests/integration/` directory and `test:integration` script already exist.

## 5. 133 endpoints return raw internal error messages to the client

Pattern: `res.status(500).json({ error: err.message })`. The login route is worse — it
returns `{ error: 'Login failed', detail: err.message }`, so a database error surfaces
Postgres internals to an unauthenticated caller.

**Do:** one Express error-handling middleware. Return a correlation id to the client, log
the real message server-side against that id. Roughly a day's work and it deletes 133
information-disclosure paths.

## 6. Frontend has a styling system installed and unused

- **12,383** inline `style={{ ... }}` occurrences
- `tailwind.config.js`, `tailwind-merge` and `tailwind-variants` are all configured
- **216** `React.createElement` calls — `usermanagement/PermissionMatrix/AuditAndSecurity.tsx` is written without JSX entirely
- **26 components exceed 1,500 lines**; the largest is `DemoPostgresTab.tsx` at 9,799

**Do:** a full migration isn't realistic soon. The cheap, high-value move is to stop the
growth: extract the repeated theme object into design tokens, and add an eslint rule
capping new inline styles. Convert the `React.createElement` files opportunistically —
they're the hardest to read and review.

## 7. ~43,600 lines of demo/mock code sits in the frontend tree

26% of `frontend/src` is `Demo*`/mock components — twelve database-engine demo tabs
(Redis, Snowflake, BigQuery, Oracle, Cassandra, DynamoDB, Elastic, MSSQL, Redshift…).

**Do:** confirm whether this is in the production bundle. If so, route-level lazy loading
gives an immediate and large payload win with no behavioural change.

## 8. Two API-access patterns coexist in the frontend

- 46 raw `fetch(` calls alongside 78 files importing `utils/api`
- **14** direct `localStorage.getItem('pulsedb_token')` reads that bypass `utils/authToken.ts`

That second number matters beyond consistency: `authToken.ts` exists specifically so the
localStorage branch can be deleted in one place once the httpOnly cookie migration
finishes. Until those 14 callers move, the JWT stays XSS-exfiltratable and the cookie
work delivers nothing.

**Do:** route the 14 through `authHeader()`, then the 46 raw fetches through the shared
client.

## 9. SQL construction — mostly fine, but the guardrail is duplicated and divergent

114 sites interpolate values into SQL template literals. Sampling the riskiest-looking
ones, they're actually defended: migration table names are checked against an allow-list
*and* an identifier regex; `pg_stat_statements` schema names come from `pg_extension`,
not user input. Credit where due.

The real problem: `quoteIdent()` exists in **both** `services/indexAdvisor.ts` and
`services/schemaDiffService.ts` with **differing implementations**. Two versions of a
security primitive is how one of them ends up subtly wrong.

**Do:** one shared `quoteIdent` in a util module, delete both copies. Then add a semgrep
rule to `.semgrep/pulsedb-rules.yml` (already present) flagging new interpolation into
query strings so this surface stops growing unreviewed.

## 10. Input validation covers 21 of 59 route files

`middleware/validate.ts` and `zod` are both in place; roughly a third of routes use them.

**Do:** schema-validate the write endpoints first. The API-key creation route was a live
example — it stored an arbitrary `scope` string straight from the request body.

## 11. Three competing sources of schema truth

Covered in `DB_STATE_AND_PLAN.md`, restated here because it's a code-health issue too:
`db/schema.ts` (Drizzle), `prisma/schema.prisma`, and `scripts/migrate.ts`'s inline SQL
arrays all describe the schema, and the live database matches none of them. Prisma's own
header comment says Drizzle is the source of truth — but `migrate.ts` is what actually
ran.

**Do:** pick one. Drizzle is the better candidate given the header comment and the
generated migration files. Prisma then becomes generated output, not a parallel
definition.

## 12. Smaller items

- Only 7 `TODO`/`FIXME` markers repo-wide — genuinely low, worth noting as a positive
- `pgmonitoringtool` is hardcoded 665 times across 101 files, never read from config —
  makes multi-tenant or schema-renamed deployments impossible
- `vigil_connections` exists in the database but is referenced nowhere in the code
- Rate limiting is applied at 10 sites in `server.ts`; the per-API-key and brute-force
  limiters are in-process `Map`s, so on multi-instance deploys the effective limit is
  multiplied by instance count
- Dependencies look current (React 19, Express 5, Prisma 7, pg 8.18). `npm audit` could
  not be run here — no `node_modules` in this environment

---

## Suggested sequence

**Week 1 — stop the silence.** Items 2 and 5. The `swallow()` helper plus a central error
middleware are both mechanical, low-risk, and together they'd have surfaced the database
breakage months earlier. Highest value per hour of anything on this list.

**Week 2 — make the type checker mean something.** Item 1, starting with `services/` and
`middleware/`, plus the CI ratchet.

**Week 3 — cover the risky routes.** Item 4: integration tests for admin, user and SAML
routes.

**Ongoing — stop the growth.** Items 6, 8, 9: eslint rules and the shared `quoteIdent`
are small commits that prevent each problem from getting worse while the larger
refactors wait.

**Deferred — the big structural ones.** Items 3 and 7 (`server.ts` decomposition, demo
code splitting) are real wins but need dedicated time and carry more regression risk.
