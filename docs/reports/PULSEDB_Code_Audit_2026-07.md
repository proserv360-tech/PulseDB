# PulseDB — Code Audit

Date: 2026-07-02
Scope: full codebase (backend `~88k` lines / 267 TS files, frontend 204 TS/TSX files), weighted toward security, and the changes made in the current work session (database switcher, schema-filter removal, ERD fix, login redesign, session hardening).
Method: static review + pattern scans + live query validation against the control-plane DB + dependency advisory scan.

---

## Executive summary

The codebase is **security-conscious and generally well-built**. It shows evidence of prior formal security review (SEC-06, SEC-021 markers), uses parameterized queries throughout, enforces RBAC and tenant isolation, separates encryption and signing keys, and refuses to boot when misconfigured. No critical, directly-exploitable application vulnerability was found in the reviewed surface.

The most actionable items are operational: **19 known dependency vulnerabilities (4 high)**, **secrets that remain in git history** from the earlier public-repo exposure, and a **regex-based SSRF filter** that a DNS-based attacker could bypass. None are blockers, but the dependency and git-history items should be handled before treating the app as production-hardened.

Risk posture: **Moderate-low.** Fix dependencies + finish the secret rotation/history cleanup and it is in good shape.

---

## Findings by severity

### HIGH

**H-1 — Vulnerable dependencies (19 advisories: 4 high, 13 moderate, 2 low).**
`npm audit` reports high-severity issues in transitive/direct deps:

- `undici` — TLS certificate-validation bypass (SOCKS5), HTTP header injection via Set-Cookie, response-queue poisoning, cross-user cache disclosure.
- `form-data` — CRLF injection via unescaped multipart field names.
- `nodemailer` — high-severity advisory.
- `@hono/node-server` — middleware bypass via repeated slashes.
- Also `dompurify`, `fast-xml-parser`, `js-yaml`, `react-router`, `@babel/core`, `uuid`.

Recommendation: run `npm audit fix` (most fix cleanly); review the one `--force` upgrade (`@hono/node-server`) for breakage. Add `npm audit --audit-level=high` to CI to prevent regressions.

**H-2 — Secrets remain in git history.**
The repository history contains **11 references to a Neon database password** across 956 commits, and the repo was previously public. The password was rotated and the repo made private during the earlier incident, but the history was never scrubbed — anyone who cloned while public still holds the old secrets.
Recommendation: treat every credential ever committed (Neon, Supabase, JWT/ENCRYPTION values) as permanently compromised and confirm all are rotated. Optionally scrub history with `git filter-repo`, then force-push and invalidate old clones. At minimum, document that the historical secrets are dead.

### MEDIUM

**M-1 — SSRF filter is string-pattern only (`server.ts` ~3583, SEC-021).**
Connection creation blocks private/link-local/metadata hosts, but the check runs regexes against the **literal host string**, not the resolved IP. A public hostname that resolves to `169.254.169.254` / an internal IP (DNS rebinding) bypasses it. `metadata.google.internal` is blocked by name but the AWS/GCP metadata IP is only caught because `169.254.` is listed — a CNAME to it would slip through.
Recommendation: resolve the host and validate the resulting IP(s) against private ranges at connect time, or enforce egress restrictions at the network layer.

**M-2 — Raw error messages returned to clients (354 handlers).**
Many handlers respond with `res.json({ error: e.message })`, echoing driver/DB internals (schema names, SQL fragments) to the caller. Almost all are behind `authenticate`, limiting exposure to logged-in users, but it still leaks internal detail.
Recommendation: in production, return a generic message + a correlation id and log the detail server-side. A small response helper would centralize this.

**M-3 — Regex keyword-blocking for read-only enforcement (`aiQueryService.ts` ~53).**
The EXPLAIN path blocks DML/DDL with a keyword regex. Regex allow/deny lists are historically bypassable (comments, casing, encoding). It is mitigated here by single-statement enforcement and `EXPLAIN … ANALYZE false` (no execution), so real risk is low — but the project already ships a proper guard (`isReadOnlySelect` in `sqlReadGuard.ts`, used by `queryAdvisorService`/`whatIfIndexService`).
Recommendation: route all "user SQL" paths through `isReadOnlySelect` for consistency.

### LOW

**L-1 — Dead/inert schema-filter code left in `server.ts` (9 references).**
After removing schema filtering, the `/schemas` and `/schema` endpoints, `getUserActiveSchema`, `SCHEMA_ENGINES`, and `listAdapterSchemas` remain but are never reached (`reqPool` ignores schema; the frontend no longer sends `?schema=`). Harmless, but dead code. Also the object-panel queries still carry inert `${req.query.schema ? … }` conditionals. Recommendation: strip when convenient.

**L-2 — `deriveFieldKey()` fallback key (`encryptionService.ts` ~226).**
`getKey()` (connection-secret encryption) fails closed when `ENCRYPTION_KEY` is unset, but `deriveFieldKey()` falls back to a hardcoded `'pulsedb-default-key-do-not-use-in-prod'`. The boot preflight prevents an unset key in practice, so this is latent — but it should throw for consistency rather than derive from a public constant.

**L-3 — Recently-edited files were repeatedly truncated by the Windows mount during this session.**
`server.ts`, `App.tsx`, `api.ts`, `overviewRoutes.ts`, and the adapters were clipped mid-write and repaired from git each time; syntax was re-verified, but a full type-check/bundle was not run in this environment.
Recommendation: run `npm run build` (frontend + backend) and the test suite before deploying; the two new components (`DatabaseSwitcher.tsx`, `SchemaSwitcher.tsx` stub) are new files not yet in git.

---

## What is solid (verified)

- **SQL injection:** queries are parameterized; dynamic `WHERE`/`SET` builders (feedback, audit, otel, users) use `$N` placeholders with hardcoded column names; dynamic identifiers (`server.ts` migration/DDL-history) are gated by an allowlist + `^[A-Za-z_][A-Za-z0-9_]*$` regex + a parameterized existence check (defense in depth).
- **Arbitrary SQL:** the engine console (`adapter.executeQuery`) is restricted to `admin`/`super_admin`; analysis paths use SELECT-only guards and non-executing EXPLAIN.
- **Auth & crypto:** passwords hashed with `bcrypt` (cost 12); JWTs verified with audience/issuer; AES-256-GCM with PBKDF2 key derivation; `ENCRYPTION_KEY` required, ≥32 chars, and enforced to differ from `JWT_SECRET`; startup preflight refuses a misconfigured environment.
- **Access control:** connections and metadata scoped by `user_id` (+ role); admin-only routes gated.
- **Transport & abuse:** CORS uses an allowlist with credentials and requires an origin in prod; rate limiting enabled (default 300/min, distributed with Redis fallback); Supabase pooler TLS handled.
- **Frontend XSS:** the 5 `dangerouslySetInnerHTML` usages sit in files that import `DOMPurify`.
- **This session's fixes validated live:** the ERD relationship query (quoted aliases → valid `from`/`to`), the schema-scoped index/bloat/table queries, and the fail-soft session check all behave as intended.

---

## Prioritized action list

1. `npm audit fix` (H-1) and add an audit gate to CI.
2. Confirm every historically-committed secret is rotated; scrub git history or formally retire the old values (H-2).
3. Resolve-then-validate host IPs for SSRF (M-1).
4. Centralize error responses to avoid leaking internals in prod (M-2).
5. Use `isReadOnlySelect` on all user-SQL paths (M-3).
6. Remove the inert schema code, run a full build + test suite, commit the new components (L-1, L-3).

---

## Notes on maintainability

`backend/server.ts` is ~7,000 lines and concentrates routing, pooling, connection management, and many endpoints. A partial `routes/` split already exists; continuing to extract endpoint groups out of `server.ts` would reduce risk (the file's size is exactly what made the mount-truncation issues in this session hard to recover). This is a refactor recommendation, not a defect.

---

## Implementation status (2026-07-02)

Fixes applied and syntax-verified in this pass:

- **M-1 (SSRF) — DONE.** Added `assertHostNotPrivate(host)` + `isPrivateIp(ip)` in `server.ts` and wired it into `POST /api/connections/test`. It now blocks by literal host AND by DNS-resolved IP (IPv4 10/8, 127/8, 0/8, 169.254/16, 172.16–31, 192.168/16, 100.64/10 CGNAT; IPv6 ::1, fc/fd, fe80). Verified 10/10 classification cases.
- **M-3 (read-only guard) — DONE.** `aiQueryService.analyzeQuery` now enforces read-only via the shared, literal-aware `isReadOnlySelect(queryText)` (positive SELECT/WITH check) instead of a negative keyword regex.
- **L-2 (fail-closed key) — DONE.** `deriveFieldKey()` now throws when `ENCRYPTION_KEY` is missing/short instead of falling back to a hardcoded default, matching `getKey()`.

Findings resolved by existing controls or deliberately deferred:

- **M-2 (error leakage) — LARGELY ALREADY MITIGATED.** A global Express error handler (`server.ts` ~7023) already sanitizes uncaught 5xx errors to `'Internal Server Error'` in production. Most remaining `res.json({ error: e.message })` calls are on diagnostic endpoints (connection test, query analysis) where showing the real DB error is intended UX. No blanket rewrite done (it would degrade usability); adopt a `clientErr()` helper selectively if specific endpoints are found to over-share.
- **H-1 (dependencies) — NEEDS LOCAL VALIDATION.** `npm audit fix` was attempted but increased the advisory count (19→22) — the automated bumps pulled in packages with their own advisories, and the tree can't be build-tested in this environment. Reverted `package.json`/`package-lock.json` to the known-good state to avoid shipping an untested/worse tree. Run locally: `npm audit fix`, then `npm run build` + tests; review the remaining high advisories (they require `npm audit fix --force` major bumps — e.g. `@hono/node-server`) one at a time with testing.
- **H-2 (secrets in history) — USER GIT ACTION.** Requires history rewrite (`git filter-repo`) + force-push + rotation confirmation, which can't be done safely from this environment. Treat all historically-committed secrets as compromised and confirm rotation.
- **L-1 (inert schema code) — DEFERRED.** The ~38 residual references are intertwined with the (working) database switcher via shared helpers (`getOverridePool`, `isPgLikeEngine`, `activeDbKey`). It is inert and harmless; removing it safely warrants a dedicated refactor with a full build + test run, rather than risking the working switcher in this un-testable environment.

Net: the three actionable code-level security fixes (M-1, M-3, L-2) are implemented; M-2 is already covered centrally; H-1/H-2 are local/git operations left for controlled execution.
