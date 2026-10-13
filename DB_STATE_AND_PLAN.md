# New Org Project — Database State & Remediation Plan

Project ref `sgmttzxltadcqriymvio` (ap-northeast-1 pooler), inspected live via the
`DATABASE_URL` in `backend/.env`. The Supabase connector is still authorised only
against the old personal org, so it cannot see this project.

---

## Summary

**The data migrated. The schema did not.** The code references **83** objects in
`pgmonitoringtool`; **20** exist. More seriously, several tables that *do* exist have a
different shape from what the code writes — so a number of writes are failing silently
right now.

| | |
|---|---|
| Rows carried over | 10 users, 55 login-activity, 12 sessions, 5 SDK apps, 2 feedback, 1 connection |
| Tables present | 20 of ~83 referenced |
| Views present | 0 (`v_active_sessions` missing) |
| Foreign keys | 7, all `ON DELETE CASCADE`, **0 orphaned rows** |
| Data exposure | **None** — see Security below |

---

## 1. Writes that are failing silently today

Found by diffing every `INSERT`/`UPDATE` in the codebase against live columns. The row
counts corroborate each one.

| Table | Code writes | Live has | Consequence |
|---|---|---|---|
| `audit_log` | `resource_id`, `metadata`, `ip_address` | none of them | **Every audit write fails.** Table has **0 rows**. Most callers wrap `writeAudit` in `.catch(() => {})`, so there is no error surfaced and no audit trail. |
| `alerts` | `alert_type`, `details` | neither | **Alert creation fails.** Table has **0 rows**. |
| `user_sessions` | `revoked_at`, `revoked_by` | neither | **Logout and session revocation throw.** The logout route swallows it with `.catch(() => {})`. Corroborated: 11 of 12 sessions are flagged `is_active` but already expired — nothing has ever successfully revoked one. |
| `user_api_keys` | whole table | **does not exist** | Every `X-API-Key` request 401s. |

That last one also means the API-key scope enforcement added in the previous pass is
correct but inert until the table exists.

## 2. Structural drift on tables that do exist

This is not a partial migration — it looks like **two different generations of the
schema**. The live database matches the `scripts/migrate.ts` inline arrays and the old
`supabase_backup_tool_monitoring` dump. `db/schema.ts` and `db/migrations/` describe a
newer generation that was never applied anywhere.

| Table | In code, not in DB | In DB, not in code |
|---|---|---|
| `pulsedb_connections` | `password_encrypted`, `color`, `connection_type`, `environment`, `region`, `notes`, `health_status`, `last_health_check`, `updated_at` | `password`, `db_type`, `status`, `last_tested`, `ssh_*` (8 cols) |
| `alerts` | `type`, `status`, `details`, `connection_id`, `resolved_at` | `title`, `fingerprint`, `source`, `acknowledged` |
| `audit_log` | `details`, `timestamp` | `detail`, `ip`, `level`, `actor_id`, `resource_type`, `created_at` |
| `password_reset_tokens` | `used_at` (timestamp) | `used` (boolean) |
| `user_sessions` | `revoked_at`, `revoked_by` | — |

Note `pulsedb_connections.password` vs `password_encrypted` is a **naming** difference
only — the stored value is 90 chars and colon-delimited (IV:ciphertext:tag), and
`server.ts:1618` calls `encrypt()` before writing. The secret is encrypted at rest. The
column is just named as though it weren't.

## 3. Confirmed from the earlier auth review

| Item | Now confirmed |
|---|---|
| 3 — logout silently broken | **Yes**, `revoked_at`/`revoked_by` absent |
| 4 — `v_active_sessions` missing | **Yes**, no views at all |
| 5 — API-key scope | Table absent entirely |
| 8 — role spelling | **Yes** — DB has `super_admin` (2), `admin` (2), `viewer` (6). `workspaceRbac.ts` checks `superadmin`, so that bypass has never fired |
| 6 — MFA | **Yes** — 5 of 10 users flagged `mfa_enabled` with no TOTP anywhere |

**Not a problem here:** `expires_at` defaults to `now() + 24h` and no row is born
expired, so the "sessions expire instantly" failure does not apply to this database.

## 4. Security posture — clean

- `pgmonitoringtool` has **no grants** to `anon` / `authenticated`. It is not reachable
  through PostgREST or the anon key. RLS being off inside it is therefore acceptable —
  the app connects as `postgres`.
- The 8 legacy `pulsedb_*` tables in `public` have RLS **on with zero policies**, which
  denies all non-owner access. `public.alerts` holds 7 rows but is not readable via the
  API roles.
- Supabase's own `auth` schema exists (23 tables, 1 user) and is unused by the
  application — consistent with the earlier conclusion not to adopt GoTrue.

## 5. Leftovers worth cleaning

- 8 `pulsedb_*` tables in `public`, only `public.alerts` non-empty (7 rows). Duplicates
  the app's alerts concept; decide whether to migrate those rows or drop.
- `pgmonitoringtool.vigil_connections` exists but is referenced nowhere in the code.
- 11 stale sessions flagged active but expired.

---

## Recommended plan

### Step 0 — Block the migration runner (do this first)

`schema_migrations` does not exist on this database. The runner added in the previous
pass would treat `0000`–`0023` as baseline — recording them applied **without executing
them** — then run only `0024`. On a 20/83-provisioned database that permanently marks
~60 missing tables as done. **Do not run `npm run migrate` against this project until
the baseline rule keys off actual schema state rather than off the ledger being new.**

### Step 1 — Stop the bleeding (small, high value)

One migration that makes today's silent failures stop:

- `user_sessions`: add `revoked_at`, `revoked_by` → fixes logout and revocation
- `audit_log`: add `resource_id`, `metadata`, `ip_address` → restores the audit trail
- `alerts`: add `alert_type`, `details` → alert creation starts working
- create `user_api_keys` → API-key auth starts working, scope enforcement becomes live
- create `v_active_sessions` → admin Security panel stops throwing
- one-off: expire the 11 stale sessions

This is additive only. No existing column changes, no data rewrite.

### Step 2 — Re-baseline honestly

The committed `0000` describes a schema that has never existed anywhere. Replace it with
a dump of the live DDL as the real baseline, then write forward migrations for the gap.
Until that happens `db/schema.ts`, `db/migrations/`, and reality are three different
answers to the same question.

### Step 3 — Decide the canonical generation

For each drifted table, pick one shape and converge. `pulsedb_connections` and `alerts`
are the two where code and DB genuinely disagree about the design, not just names. This
needs a product decision, not just a migration.

### Step 4 — Provision the missing ~60 tables

SAML SSO, SCIM, workspace RBAC, IP allow-list, dashboards, workbooks, query history,
notification destinations, plugins and the OTLP ingest tables are all absent. Every
feature depending on them is dead on this database. Sequence this after Step 2 so the
migrations are written against a known baseline.

### Also worth doing

- Reconnect the Supabase connector to the org account so this project is reachable
  through tooling rather than a raw connection string.
- Normalise `super_admin` vs `superadmin` and add a CHECK constraint on `users.role`.
- Rename `pulsedb_connections.password` → `password_encrypted` to match what it holds.
