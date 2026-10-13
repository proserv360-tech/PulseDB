# Repo cleanup audit

Scan for dead code, stray files, unused dependencies and leftover debug
statements. Nothing here has been deleted — every item below is a judgement
call for someone who knows the roadmap.

Good news first: no `.env` is tracked, no build output or `node_modules` is
committed, no `debugger` statements, no `.only`/`.skip` left in tests, no
backup or `.orig` files, and only 7 `TODO`s with zero `FIXME`/`HACK`/`XXX`.
The two credential-shaped strings found are deliberate test fixtures
(`autoExplainService.test.ts`, `destinationService.test.ts`) checking that
secrets get redacted — they are fake.

---

## 1. Five route modules that are never mounted

18 endpoints exist as code and are reachable at no URL.

| Module | Endpoints | Called by frontend? |
|---|---|---|
| `dashboardRoutes.ts` | 6 | no |
| `workbookRoutes.ts` | 5 | no |
| `traceRoutes.ts` | 3 | no (see API_ROUTE_AUDIT §1) |
| `agentIngestRoutes.ts` | 2 | no |
| `alertRcaRoutes.ts` | 2 | no |

None is imported by `server.ts`. The only references to `agentIngestRoutes`
anywhere are two comments in `migrate.ts` and `queryStatsRollup.ts` mentioning
it by name — not imports.

Each is one of: a feature abandoned mid-build, a feature whose UI was never
written, or a module someone forgot to mount. They are not interchangeable
outcomes, and the fix differs:

- **Forgot to mount** → mount it, and check auth is applied.
- **Never finished** → delete it. Dead routes accumulate audit surface and
  read as live to anyone grepping the codebase.

`workbookRoutes.ts` is worth a closer look before deleting: it imports
`@fathom/validators`, which suggests it was written to the current standard
rather than abandoned early.

## 2. Unused dependencies

### Frontend — 7 of 17 declared dependencies unused

`@codemirror/lang-sql`, `@uiw/react-codemirror`, `@xyflow/react`, `date-fns`,
`react-is`, `tailwind-variants`, `zod`.

Zero import sites for each. `@uiw/react-codemirror` plus `@codemirror/lang-sql`
and `@xyflow/react` are heavy — a SQL editor and a node-graph library — so
these are probably the residue of features that were replaced with hand-rolled
equivalents. Removing them is the single biggest available cut to install time
and bundle risk.

### Backend — 4 genuinely unused

| Package | Verdict |
|---|---|
| `@aws-sdk/client-cloudwatch` | No import site. `cloudwatchService.ts` signs its own AWS requests by hand with HMAC, so the SDK is genuinely redundant. |
| `@prisma/client` | No import site, despite `prisma` also being declared. Drizzle is what the codebase actually uses. |
| `helmet` | No import site. `server.ts:1253` says "equivalent to helmet.js defaults" and implements the headers by hand. |
| `node-cron` | No import site. Scheduling goes through `cronRoutes.ts` driven by the Vercel cron in `vercel.json`. |

`dotenv` and `tsx` show up in a naive scan as unused but are not: `dotenv` is
loaded via the side-effect form `import 'dotenv/config'`, and `tsx` is the
runtime for all 17 npm scripts.

### Backend — one dependency used but not declared

`@aws-sdk/client-s3` is imported in `backend/services/auditExport.ts:42` and
appears in neither `dependencies` nor `optionalDependencies`.

It is a lazy `await import()` inside a try/catch, so it degrades rather than
crashing — audit export to S3 silently does nothing when the package is absent.
That is worse than a hard failure: the feature looks configured and produces no
exports. Either declare it as an optional dependency or make the failure loud.

## 3. Two zero-byte files at the repo root

```
del    0 bytes
git    0 bytes
```

Both committed in `f107300 "demo layout changes"` — almost certainly typos
where a command ran ahead of its filename (`git` and `del` are the command
names themselves). Safe to delete.

Other empty files found are legitimate: `__init__.py` package markers,
`.gitkeep`, `py.typed`, and Go build artefacts.

## 4. Sixteen orphaned frontend components

Never imported, including via lazy `import()`:

```
components/Copilot.tsx                    components/layout/Sidebar.tsx
components/ExplainVisualizer.tsx          components/layout/ProfileModal.tsx
components/auth/ProtectedRoute.tsx        components/layout/SchemaSwitcher.tsx
components/layout/AppStyles.tsx           components/layout/NotificationCenter.tsx
components/layout/ConnectionSelector.tsx  components/shared/SkeletonLoader.tsx
components/views/admin/UserProfileTab.tsx components/views/analytics/DemoSectionView.tsx
components/views/monitoring/WaitEventsChart.tsx  pages/SsoSettings.tsx
usermanagement/shared/components/GlobalStyles.tsx  utils/themecomponents.tsx
```

Some are significant — `Sidebar.tsx`, `ProtectedRoute.tsx` and `SsoSettings.tsx`
are the kind of thing a working app usually needs, which suggests they were
superseded by inline implementations in `App.tsx` rather than being unfinished.

`Copilot.tsx` connects to a live backend route (`POST /api/copilot/:mode`) but
is not rendered anywhere, so that feature is currently unreachable from the UI.

Worth confirming with a bundle analysis before deleting — a component reached
through a dynamic path expression rather than a literal specifier would not be
detected by this scan.

## 5. Debug logging

`console.log`/`console.debug` outside scripts and tests:

- **backend: 56** — these bypass the `log()` helper and therefore the
  structured pino output, so they are invisible to log aggregation and cannot
  be filtered by level in production.
- **frontend: 2** — both in `utils/errorTracking.tsx`, plausibly deliberate.

The backend count is the one worth acting on, ideally as a lint rule
(`no-console` with an allowance for `console.error`) so it does not creep back.

---

## Suggested order

1. Delete `del` and `git` — zero risk.
2. Drop the 7 unused frontend dependencies — measurable, reversible.
3. Declare `@aws-sdk/client-s3` or make its absence loud — silent data loss.
4. Decide mount-or-delete on the 5 route modules — needs product context.
5. Confirm and remove orphaned components — needs a bundle check first.
6. Convert backend `console.log` calls to `log()` and add the lint rule.
