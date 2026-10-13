# Migrating the FATHOM control plane: Neon → Supabase

The FATHOM control-plane database (users, sessions, connection registry, audit
log, copilot history, cloud credentials, etc.) is plain PostgreSQL, so moving
from Neon to Supabase is a logical dump/restore plus a connection-string swap.
Everything lives in the `pgmonitoringtool` schema and a few `public.fathom_*`
tables.

Scripts referenced below live in `backend/scripts/`:

- `migrate-neon-to-supabase.sh` — dump from Neon, restore into Supabase.
- `verify-migration.sh` — per-table row-count diff between the two.
- `migrate-schema-only.sh` — fresh schema on Supabase (no data copied).

## 0. Prerequisites

- `pg_dump`, `pg_restore`, `psql` **v15+**. If Neon and Supabase report
  different server majors (`SELECT version()`), use the **newer** client.
- Both connection strings:
    - **Neon (source):** `postgresql://USER:PASS@ep-xxx.region.neon.tech/neondb?sslmode=require`
    - **Supabase (target):** Project → Settings → Database → Connection string.
      Use the **direct** connection (port `5432`) for the restore, not the
      transaction pooler (`6543`) — pooled connections don't support all the
      statements `pg_restore` issues.

## 1. Freeze writes (recommended)

Stop the FATHOM backend (or put it in maintenance) so no new rows land in Neon
mid-dump. A few seconds of downtime avoids a row-count mismatch.

## 2. Dry-run dump (optional but smart)

```bash
cd backend/scripts
SOURCE_URL="postgresql://…neon…?sslmode=require" \
TARGET_URL="postgresql://postgres:…@db.xxxx.supabase.co:5432/postgres" \
DRY_RUN=true ./migrate-neon-to-supabase.sh
```

This dumps to `fathom_cp_dump.dump` and stops, so you can inspect the artifact
before touching Supabase.

## 3. Migrate

```bash
SOURCE_URL="postgresql://…neon…?sslmode=require" \
TARGET_URL="postgresql://postgres:…@db.xxxx.supabase.co:5432/postgres" \
./migrate-neon-to-supabase.sh
```

The script:

1. Verifies both endpoints are reachable.
2. **Refuses to run** if Supabase already has a populated `pgmonitoringtool`
   schema (so you can't silently clobber an existing control plane).
3. `pg_dump --format=custom --no-owner --no-acl` from Neon.
4. `pg_restore --no-owner --no-acl` into Supabase (ownership/privileges are
   stripped because Supabase manages roles; objects restore under the
   connecting role).
5. Confirms the schema landed and lists the restored tables.

## 4. Verify

```bash
SOURCE_URL="…neon…" TARGET_URL="…supabase…" ./verify-migration.sh
```

Prints a SOURCE-vs-TARGET row count for every control-plane table and exits
non-zero on any mismatch. Investigate before cutting over.

## 5. Switch the app to Supabase

Set `DATABASE_URL` to the Supabase string and enable TLS:

```
DATABASE_URL=postgresql://postgres:…@db.xxxx.supabase.co:5432/postgres
DB_SSL=true
```

Notes:

- For **serverless / Vercel** functions, use Supabase's **transaction pooler**
  string (port `6543`, host `…pooler.supabase.com`) for the _running app_ to
  avoid exhausting direct connections — but still use the **direct 5432**
  string for the one-time `pg_restore` in step 3.
- Supabase requires TLS. `DB_SSL=true` is enough; the default
  `rejectUnauthorized` is relaxed outside production. In production set a CA via
  `FATHOM_TLS_CA_CERT` or keep `FATHOM_TLS_ALLOW_SELF_SIGNED` unset for strict
  verification.

Restart the backend. Log in and confirm users/connections are present.

## 6. Rollback

Nothing is deleted from Neon by this process, so rollback is just pointing
`DATABASE_URL` back at the Neon string and restarting. Keep Neon alive until
you've verified Supabase in production for at least one full cycle.

## Alternative: fresh schema, no data

If you want a brand-new control plane on Supabase instead of copying Neon's
data (e.g. a new staging environment):

```bash
DATABASE_URL="postgresql://postgres:…@db.xxxx.supabase.co:5432/postgres" \
DB_SSL=true ./migrate-schema-only.sh
```

This runs FATHOM's own migrators (`npm run migrate` [+ `migrate:enterprise`]),
creating the schema and a one-time admin user whose password is printed **once**
to stdout — record it immediately.

## Troubleshooting

- **`pg_restore: error: could not execute query: ERROR: schema "public" already exists`**
  — benign; the script tolerates restore warnings and checks the real outcome
  (tables present in `pgmonitoringtool`).
- **`role "neon_superuser" does not exist`** — you forgot `--no-owner`; the
  script sets it by default (`NO_OWNER=true`).
- **Restore hangs / drops** on the pooler — you used the `6543` pooler string;
  re-run the dump/restore with the **direct 5432** connection.
- **Version mismatch** (`server version mismatch`) — use a `pg_dump` whose major
  version is ≥ the source server.
