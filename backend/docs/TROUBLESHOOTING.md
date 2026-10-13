# FATHOM — Troubleshooting

The backend surfaces structured diagnostic codes on every failure path so you
should almost never have to dig through stack traces. There are three places
to look, in order of convenience.

## 1. `GET /api/health`

Cheap, unauthenticated, returns the same diagnostic the write paths use. If
something is misconfigured the endpoint returns **503** and a JSON body that
names the blocker:

```json
{
  "controlPlane": "degraded",
  "diagnostics": {
    "ok": false,
    "encryption": {
      "ok": false,
      "code": "ENCRYPTION_NOT_CONFIGURED",
      "hint": "Set ENCRYPTION_KEY on the host. Generate with: node -e \"…\""
    },
    "schema": {
      "ok": false,
      "code": "SCHEMA_NOT_MIGRATED",
      "missing": ["fathom_connections"],
      "hint": "Missing tables: fathom_connections. Run migrations: npm run migrate --workspace=backend."
    },
    "blockers": [ … ]
  }
}
```

## 2. `npm run doctor`

Runs the same checks from CI or your terminal and prints a readable table:

```
FATHOM doctor — checking configuration…
------------------------------------------------------------------------
[ OK ]  ENCRYPTION_KEY        OK
[FAIL]  DATABASE_URL          SCHEMA_NOT_MIGRATED
         hint: Missing tables: fathom_connections. Run migrations: …
[FAIL]  Control-plane schema  SCHEMA_NOT_MIGRATED
         missing: fathom_connections
[ OK ]  JWT_SECRET            OK
------------------------------------------------------------------------
1 blocker(s) — fix the items above and re-run `npm run doctor`.
```

Exit code is `0` on clean, `1` on blockers, `2` on unexpected failure — use
it as a post-deploy smoke test.

## 3. Structured error codes from `/api/connections`

Every failure of `POST /api/connections`, `PUT /api/connections/:id`, and
`DELETE /api/connections/:id` now returns a stable `code` field. The frontend
(and operators looking at DevTools → Network) can match on these:

| HTTP | `code`                      | Fix                                                                                  |
| ---- | --------------------------- | ------------------------------------------------------------------------------------ |
| 409  | `DUPLICATE_NAME`            | Pick a different connection name.                                                    |
| 503  | `ENCRYPTION_NOT_CONFIGURED` | `ENCRYPTION_KEY` env var is missing. Generate + set + redeploy.                      |
| 503  | `ENCRYPTION_WEAK`           | `ENCRYPTION_KEY` is shorter than 32 chars. Regenerate with `crypto.randomBytes(48)`. |
| 503  | `ENCRYPTION_COLLIDES`       | `ENCRYPTION_KEY` equals `JWT_SECRET`. Use two distinct random values.                |
| 503  | `SCHEMA_NOT_MIGRATED`       | Run `npm run migrate --workspace=backend`.                                           |
| 503  | `DB_NOT_CONFIGURED`         | `DATABASE_URL` points at a missing database/schema. Check the connection string.     |
| 503  | `DB_UNREACHABLE`            | Network blocked or DB is down. Check egress + DB status.                             |
| 500  | `UNKNOWN`                   | Not a known config problem — inspect server logs.                                    |

## Startup refuses to boot

In production the server **refuses to start** if `ENCRYPTION_KEY` is missing
or invalid. Log output:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  FATHOM MISCONFIGURED — ENCRYPTION_NOT_CONFIGURED
  Set ENCRYPTION_KEY on the host. Generate with: node -e "…"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Exit code `78` (EX_CONFIG). Vercel / Railway / Fly all surface this in their
deployment UI.

To temporarily start a non-prod instance without encryption configured (for
debugging — do not use in production), set
`FATHOM_ALLOW_DEGRADED_BOOT=true`. Write paths will return 503 until the env
is fixed.

## Generating secrets

```
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Run twice — once for `JWT_SECRET`, once for `ENCRYPTION_KEY`. They must be
different.
