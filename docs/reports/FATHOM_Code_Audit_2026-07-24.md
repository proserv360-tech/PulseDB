# FATHOM — Code Audit

Date: 2026-07-24
Scope: full repo (backend ~64.9k LOC / 200 non-test TS files, frontend ~167.6k LOC / 209 files), verified against prior audits (2026-06-09, 2026-06-12, 2026-07-02) and `CODE_IMPROVEMENTS.md`.
Method: this pass does not re-derive findings from scratch — it re-runs the same measurements as the prior reports (plus the repo's own `report-silent-failures.ts` ratchet and a live `npm audit`) to see what moved. No git history is available in this checkout (working tree only, no commits), so changes are inferred from current state vs. the numbers previously recorded, not a diff.

---

## Executive summary

Since the 2026-07-02 audit, three of its concrete fixes hold up under re-verification: the DNS-rebinding SSRF guard, the fail-closed encryption key, and routing `aiQueryService` through the shared read-only guard. A real piece of new infrastructure has also landed: `services/errorHandling.ts` (`swallow()`, `asyncRoute()`) plus `scripts/report-silent-failures.ts`, a CI-ready ratchet that measures swallowed errors and leaked error messages against a baseline. Running it now shows **37 swallowed / 145 leaked — exactly at baseline**, i.e. the regression gate is holding but the burn-down described in `CODE_IMPROVEMENTS.md` hasn't started yet.

Two things got worse, and one long-standing claim doesn't hold on inspection:

1. **Dependency vulnerabilities: 23 (9 high, 13 moderate, 1 low)**, up from 19 (4 high) three weeks ago — `axios`, `ws`, `nodemailer`, `undici`, `form-data`, `fast-uri`, `brace-expansion`, `adm-zip`, `cassandra-driver` all carry high-severity advisories.
2. **`@ts-nocheck` is still concentrated in the two auth-deciding modules named specifically in `CODE_IMPROVEMENTS.md`** — `services/sessionService.ts` and `services/authCookie.ts` — three-plus weeks after being called out by name. `middleware/` did get cleaned up (all 9 files are now type-checked), but `services/` overall is 56/64 files (87.5%) under `@ts-nocheck`, and routes are 56/59 (95%).
3. **Input validation adoption is 0/59 route files**, not "roughly a third" as previously stated. `middleware/validate.ts` and the `@fathom/validators` Zod schemas are fully built and unit-tested, but no route file actually imports and applies `validate()` — `workbookRoutes.ts` only references the schemas in a comment.

Nothing here is a new critical vulnerability — it's the same profile as before: a security-conscious codebase where the gap is between infrastructure that exists and infrastructure that's wired in.

---

## Verified: fixes from the 2026-07-02 audit that hold

- **M-1 (SSRF, DNS rebinding)** — `assertHostNotPrivate()` / `isPrivateIp()` are present in `server.ts` (~3682–3739) and wired into the connection-test path. Confirmed still in place.
- **M-3 (read-only guard)** — `aiQueryService.ts` imports and calls `isReadOnlySelect()` from `sqlReadGuard.ts` rather than a keyword blocklist. Confirmed.
- **L-2 (fail-closed key derivation)** — the hardcoded `'fathom-default-key-do-not-use-in-prod'` fallback is gone; no occurrences anywhere in `backend/`. Confirmed.
- **`middleware/*.ts` typed** — all 9 middleware files (`authenticate.ts`, `tenantIsolation.ts`, `workspaceRbac.ts`, `validate.ts`, etc.) are now free of `@ts-nocheck`. This wasn't itemized before but is real progress on Item 1 of `CODE_IMPROVEMENTS.md`.
- **quoteIdent() divergence** — `indexAdvisor.ts` and `schemaDiffService.ts` still each define their own `quoteIdent()`, but the two implementations are now byte-for-byte identical (both `` `"${String(name).replace(/"/g,'""')}"` `` with `'""'` for empty input). The "differing implementations" risk flagged before is gone; the duplication itself is not — still worth consolidating into one shared util so they can't drift again.

## Still open (re-verified with current numbers)

| Item | Prior figure | Current figure | Status |
|---|---|---|---|
| Backend `@ts-nocheck` | 172/254 files (68%) | 173/200 non-test files (86.5%) | Not improved; denominator differs but ratio is worse by any measure |
| `sessionService.ts` / `authCookie.ts` typed | flagged by name, dated 2026-06-10 | still `@ts-nocheck` | Unresolved — the two files that decide whether a request is authenticated remain untyped |
| Swallowed errors (`.catch(()=>{})` etc.) | 129 (informal count) | 37 (ratchet baseline, exact match) | Infrastructure built (`swallow()`), adoption at baseline — no net reduction since the ratchet was set |
| Leaked `err.message` to client | 133 (informal count) | 145 (ratchet baseline, exact match) | Same — `asyncRoute()`/`failSafe()` exist, not yet applied beyond the baseline cleanup pass |
| `server.ts` size | 7,379 lines / 109 inline routes | 7,398 lines | Unchanged; still the largest single risk to maintainability |
| Routes without a matching test file | 37/59 | 59/59 have no *same-named* test file; real route-level test coverage (by import) is ~5 files (`scimRoutes`, `auditRoutes`, cross-tenant/gap-close suites) | Still the weakest area — admin/user/SAML routes remain untested at the route level |
| `pgmonitoringtool` hardcoded | 665 refs / 101 files | 351 refs (recount, different grep scope) | Still hardcoded, not config-driven; multi-tenant/schema-rename deployments still blocked |
| Frontend inline `style={{}}` | 12,383 | 12,383 | Unchanged |
| Demo/mock code in frontend | ~43,600 lines (26%) | 39,938 lines across `Demo*.tsx` alone | Still a large, likely-shippable chunk; worth confirming it's route-split/lazy-loaded |
| Direct `localStorage.getItem('fathom_token')` bypassing `authToken.ts` | 14 | 14 | Unchanged |
| Raw `fetch()` vs `utils/api` | 46 raw / 78 via util | 18 files with raw `fetch(` / 78 via util | Improved — fewer files using raw fetch directly (though some files may call fetch multiple times, so treat as directionally better, not exact) |

## New finding this pass

- **Input validation is effectively unused, not partially adopted.** `middleware/validate.ts` is a complete, tested, well-documented Zod-based validator (`validate({ body: Schema })`), and `@fathom/validators` (in `shared/validators`) holds the schemas. But grepping every route file for an import of either turns up **zero** route files actually calling `validate()`. The one file that mentions `@fathom/validators` (`workbookRoutes.ts`) does so only in a comment. This is a bigger gap than previously documented — the API-key `scope`-string example already cited in `CODE_IMPROVEMENTS.md` isn't an isolated miss, it's the default state.
- **Dependency posture has regressed, not held steady.** `npm audit --audit-level=high` today reports 23 advisories (9 high) vs. 19 (4 high) three weeks ago. New/changed high-severity entries: `axios` (10 advisories — prototype pollution, DoS, proxy/SSRF-adjacent bypasses), `ws` (memory exhaustion DoS), `brace-expansion` (ReDoS), `fast-uri` (host-confusion via backslash/IDN), `adm-zip` / `cassandra-driver` (zip bomb), plus the previously-known `undici`, `nodemailer`, `form-data`. None of these are used in a way that's obviously reachable by an attacker from a quick read, but they should be triaged the same way H-1 was meant to be three weeks ago — this hasn't happened yet.
- **`child_process.spawn` usage in `backupExecutor.ts` and `sshTunnel.ts` is safe** — both build argv arrays and call `spawn(tool, args, …)` without `shell: true`, so connection-supplied values (host, username, database) can't break out into shell metacharacters even though they flow into the dump/tunnel command. Worth stating explicitly since it's the kind of pattern that looks risky on a keyword grep (`child_process`, string-built args) but isn't, on inspection.
- **No secrets, `eval`, or `new Function` found** in a scan of `backend/services` and `backend/routes`.

---

## Prioritized action list

1. **Type `sessionService.ts` and `authCookie.ts`.** These decide authentication outcomes and have been flagged, by name, across two audits without being fixed. This is the single highest-leverage item left.
2. **Triage the 9 high-severity dependency advisories**, starting with `axios` and `ws` since they have the most advisories/most severe classes (DoS, prototype pollution). Run `npm audit fix` locally with a full build + test pass (the 07-02 attempt was reverted because it couldn't be build-tested in that environment — do this where `npm run build` and the test suite can actually run).
3. **Wire `validate()` into at least the write endpoints that don't currently validate input** — the infrastructure is done; this is now purely an adoption problem. Start with the routes previously called out as untested (`adminRoutes`, `userRoutes`, `samlRoutes`) since unvalidated input and no tests on the same endpoints compounds the risk.
4. **Start spending down the `report-silent-failures.ts` ratchet** rather than just holding the line — lower `BASELINE` as sites are fixed, starting with the highest-file-count offenders the script already lists.
5. **Add route-level integration tests for `adminRoutes`, `userRoutes`, `samlRoutes`.** `tests/integration/` and `test:integration` already exist as a home for these; this is unchanged from the 07-02 recommendation because it hasn't been done.
6. **Consolidate `quoteIdent()`** into one shared util now that the two copies are confirmed identical — cheap, and prevents future drift.
7. Continue the `server.ts` decomposition and the demo-code lazy-loading confirmation — both still deferred, both still valid, unchanged from prior audits.

---

## Notes on method / limitations

- This checkout has no commit history (`git log` fails — "does not have any commits yet"), so "since 07-02" is inferred by comparing current counts to numbers recorded in the prior markdown reports, not a real diff. Treat the comparison table as directionally accurate rather than a precise delta.
- `npm audit` ran without a full local install (no `node_modules`); it resolved against `package-lock.json` and the npm registry, which is the same mechanism `npm audit` normally uses and should be reliable, but a `npm ci && npm audit` in a clean environment is the authoritative version.
- Frontend and `sdk/` dependency trees were not separately audited this pass — only `backend/`.

---

## Implementation status (2026-07-24)

Fixes applied and verified in this pass. Verification environment note: a full `npm install` could not complete within the sandbox, so a standalone TypeScript 5.7 + `tsx` were used to run the backend type-checker and test suite. The **full backend suite passes 702/702** and `tsc --noEmit` on `backend/` is **clean** (the single `prisma.config` "missing declaration" is an artifact of the incomplete install, not a code defect).

**DONE — verified**

- **Consolidated `quoteIdent()`** into `backend/services/sqlIdent.ts` (typed), deleted both divergent-risk copies in `indexAdvisor.ts` / `schemaDiffService.ts`, added `tests/sqlIdent.test.ts`. `indexAdvisor` (34) and `schemaDiffService` (44) tests still pass.
- **Typed the two auth-deciding modules.** Removed `@ts-nocheck` from `services/sessionService.ts` and `services/authCookie.ts` and gave them real signatures; fixed two strict-null holes (`rowCount`) surfaced by typing, plus a genuine strict hole in `middleware/workspaceRbac.ts` (`err.code` on an `unknown` catch). `backend/` type-checks clean.
- **Silent-failure burn-down.** Swallowed errors **37 → 13**, leaked internal error messages **145 → 62**, via `swallow()`/`swallowWith()` on audit-write / RCA-enqueue / metric-probe / pool-acquire sites and generic `{ error, requestId }` responses on the login route and the user/session/sdk/metrics/otel/observability/status/k8s/retention/aiMonitoring/repo handlers. Lowered the ratchet `BASELINE` to `{13, 62}` and **added `report:silent --ci` as a blocking CI step** (`.github/workflows/ci.yml`).
- **Wired `validate()` into 5 write endpoints** — `POST/PUT /users`, `POST /users/:id/reset-password`, `POST /workbench/workbooks`, `POST /workbench/workbooks/:id/variants`. Made `@fathom/validators` resolvable from the backend (added the tsconfig path alias mirroring `@fathom/types`; backend runs on `tsx`, which honours it). **Reconciled a real schema/reality drift**: `CreateUserSchema`'s role enum was missing `developer`, which would have rejected legitimate developer-role creates — added it.
- **Added route-level integration tests** (stub pool + injected guards, no DB): `userRoutes` (8, including the new validation paths), `adminRoutes` (4), `samlRoutes` (4). These also close the "no same-name test" gap for those three routers.
- **Demo lazy-loading.** The 9 bespoke engine demo tabs + `DemoEngineTab` in `DemoSectionView.tsx` are now `React.lazy` + `Suspense`. They are imported nowhere else, so this removes them from the initial bundle; each engine chunk loads on demand.

**DEFERRED — needs a build-testable environment (unchanged stance from prior audits)**

- **Dependency bumps.** Safe, in-range fixes were identified and trialled: `ws → ^8.21.1` (direct, clears the DoS) and the transitive `axios`/`undici`/`form-data`/`fast-uri`/`brace-expansion` patches. But regenerating the lockfile surfaced *new* prisma-ecosystem high advisories (`prisma`, `@prisma/dev`, `find-my-way`) — the same "audit fix pulls in new advisories" churn the 07-02 audit hit — and none of it can be build-tested here. The lockfile and `package.json` were therefore **restored to the known-good state** (verified identical to backup). `nodemailer` (needs major 9.x) and `adm-zip`/`cassandra-driver` (need a major cassandra-driver bump) are breaking and also deferred. Apply locally: `npm audit fix` for the safe set, then the majors one at a time with `npm run build` + tests. The prod-dep audit gate in CI already blocks on HIGH.
- **`server.ts` decomposition.** Still `@ts-nocheck` and 7,403 lines; extracting a route slice can't be type-checked (the file opts out) and the full-server integration tests need env + a database, so a blind extraction has no verification path here. Deferred, as in every prior audit.
