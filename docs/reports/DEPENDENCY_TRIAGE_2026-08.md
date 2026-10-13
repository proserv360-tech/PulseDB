# Dependency advisory triage — August 2026

> **Outcome (applied 2 Aug): 31 → 17 advisories, 13 → 4 high.**
> Manifest change is three lines — `ws` `^8.19.0`→`^8.21.1`,
> `nodemailer` `^8.0.1`→`^9.0.3`, `react-router-dom` `^7.13.1`→`^7.18.2`.
> Backend suite 819 passing; frontend build clean.
>
> **Do not run `npm audit fix --force`.** It was tried and reverted. It
> downgraded `react-router-dom` to 7.11.0, taking that package from 1 advisory
> to 14 (XSS via open redirect, RCE via turbo-stream deserialization, CSRF,
> DoS); downgraded `drizzle-kit` 0.31.10 → 0.18.1, which reintroduced an
> esbuild advisory; and added `cassandra-driver` and `nodemailer` to the
> *frontend* manifest and `react-router-dom` to the *backend* one.
>
> **Correction to the analysis below:** this report first suggested 7.18.2
> would clear React Router. It does not — the advisory range is 7.12.0 through
> 8.2.0, so every 7.x at or above 7.12 is affected. 7.18.2 remains the right
> place to sit (7.11.0 is measurably worse) but only react-router 8 clears it.
>
> **The 4 remaining highs are two decisions, not four fixes:**
> 1. `react-router` / `react-router-dom` — needs the v8 major.
> 2. `cassandra-driver` / `adm-zip` — an `optionalDependency` loaded by dynamic
>    `import()` that nothing in the codebase imports. If Cassandra support is
>    not used, removing the dependency closes both outright.


Closes action item 2 of `PULSEDB_Code_Audit_2026-07-24.md`, which asked for the
high-severity advisories to be triaged and noted that the 2 July attempt was
reverted because it could not be build-tested.

**Baseline: 31 advisories — 3 low, 15 moderate, 13 high.** Worse than the 23/9
recorded on 24 July; four packages have become high since (`js-yaml`,
`postcss`, `react-router`, `vite`).

All work below was done on copies of the manifests with
`--package-lock-only`, so nothing touched `node_modules`.

---

## Headline: `npm audit fix` does nothing here

```
npm audit fix --package-lock-only   →  0 changes, 31 advisories remain
npm update  --package-lock-only     →  3 highs closed, 28 remain
```

This is the single most useful finding. The audit recommended `npm audit fix`;
it is a no-op on this tree. Plain `npm update` — which stays inside every
declared semver range and changes no manifest — closes three of them.

Anyone re-running `npm audit fix`, seeing nothing happen and concluding the
advisories are unfixable would be wrong.

---

## Tier 1 — closes with no manifest change

`npm update` only. No range widened, no breaking change, nothing to review.

| Package | Was | Now | Advisory |
| --- | --- | --- | --- |
| `axios` | 1.16.0 | 1.19.0 | Proxy inherited after redirect; form serializer maxDepth bypass |
| `js-yaml` | 4.1.1 | 4.3.1 | Quadratic-complexity DoS via merge keys |
| `postcss` | 8.5.14 | 8.5.25 | Path traversal in source-map auto-loading |

**13 high → 10 high, 31 total → 28.**

---

## Tier 2 — one-line range bump, no breaking change

| Package | Declared | Needs | Why `npm update` misses it |
| --- | --- | --- | --- |
| `ws` | `^8.19.0` | `^8.21.1` | 8.21.1 satisfies the caret, but another dependent pins 8.20.1, so the range has to be raised explicitly |

```
npm install --package-lock-only --workspace=backend ws@^8.21.1
```

**Worth doing first.** `ws` is one of only two advisory packages the
application actually imports (`server.ts:11`, the WebSocket server on `/ws`),
and the advisory is a remote memory-exhaustion DoS reachable by any client that
can open a socket. Everything else on this list is either unreachable or
requires a major upgrade.

After Tier 1 + Tier 2: **27 advisories, 10 high.**

---

## Tier 3 — needs a major version bump; recommend deferring

Each was checked against whether the application actually imports it.

### `nodemailer` — declared `^8.0.1`, fix needs 9.x

Imported by `services/emailService.ts`. **`EMAIL_ENABLED=false`**, so no
transport is constructed at runtime. Neither CVE is reachable regardless: one
requires `jsonTransport`, the other requires user-controlled `List-*` headers,
and the codebase uses neither.

Defer. Revisit before enabling email.

### `vite` — declared `^7.1.5`, fix needs 8.x

Build tooling. The two advisories are `server.fs.deny` bypass and an NTLM hash
disclosure through `launch-editor` — **both affect the dev server on Windows**,
not the production bundle. Nothing ships to users.

Defer. A Vite 7→8 major is a real piece of work and buys nothing here.

### `react-router` / `react-router-dom` — declared `^7.13.1`

The awkward one. Bumping to the latest 7.x (7.18.2) **does not clear it** — the
advisory range is 6.0.0 through 8.2.0. npm's suggested fix is a *downgrade* to
7.11.0, which trades these advisories for older ones. The only forward fix is
**react-router 8.x**, a major with a migration guide.

Defer, but this is the one to plan. The advisories are CSRF via
PUT/PATCH/DELETE document requests and open redirect via backslash in `<Link>`
— genuinely reachable in a browser app, unlike the others here.

### `cassandra-driver` — declared `^4.7.2`, and it drags `adm-zip`

npm's suggested fix is a **downgrade** to 4.2.0, which is why `adm-zip` (zip
bomb, 4 GB allocation) shows up: the older driver depends on a vulnerable
version. Downgrading makes the count look better and the tree worse.

`CassandraAdapter.ts:30` loads it with a **dynamic `import()` inside a
try/catch** — it is an optional engine driver, never loaded unless someone
configures a Cassandra connection. Not reachable on this deployment.

Defer. If Cassandra support is not used, removing the dependency closes two
highs outright.

### `undici`, `form-data`, `fast-uri`, `brace-expansion`

Transitive, pulled by tooling (`jsdom`, `@types/request`, `@eslint/*`). **None
is imported by application source.** They live in the test and lint
toolchains, not the deployed artefact.

Defer; they clear on their own as the tools that pull them release updates.

---

## Reachability summary

Of 13 high-severity packages, application source imports **two**:

| Package | Imported at | Reachable? |
| --- | --- | --- |
| `ws` | `server.ts:11` — WebSocket server | **Yes** — remote DoS. Fix in Tier 2 |
| `nodemailer` | `services/emailService.ts:7` | No — `EMAIL_ENABLED=false`, and neither CVE's precondition is used |

`react-router-dom` is reachable in the browser but has no forward fix short of
a major. The remaining nine are build tooling, test tooling, or an optional
database driver behind a dynamic import.

---

## Recommended action

```bash
cd ~/Desktop/PostgresTool-main

npm update                                                   # Tier 1
npm install --workspace=backend ws@^8.21.1                   # Tier 2

npm test --workspace=backend        # expect 819 passing
npm run build --workspace=frontend  # must pass before committing
npm audit                           # expect 27 total, 10 high
```

Manifest change is one line: `ws` `^8.19.0` → `^8.21.1` in
`backend/package.json`. Everything else is lockfile movement inside existing
ranges.

**Run the build yourself.** The audit recorded that the 2 July attempt was
reverted for want of a build test; this environment cannot build the frontend
either — `lightningcss` and `rollup` need platform-native binaries that are not
present. The backend suite was the only verification available here.

---

## What is left afterwards, and why

27 advisories is not zero, and should not be treated as failure. What remains
is four major-version upgrades and a set of transitive tooling issues, none
reachable from the deployed application. The decisions worth booking:

1. **Plan the react-router 8 migration.** The only remaining item with a
   browser-reachable attack path.
2. **Decide whether Cassandra support is real.** If not, dropping the
   dependency removes two highs and a large optional driver.
3. **Re-check `nodemailer` before enabling email.** It is only unreachable
   because email is off.
