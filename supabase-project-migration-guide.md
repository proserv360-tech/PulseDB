# Migrating a Supabase Project to Another Organization (Manual Method)

Use this when you can't use the built-in **Transfer Project** feature (e.g. you're not yet a member of the target org). This creates a brand-new project in the org account and copies everything over manually.

---

## 0. Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) installed
- [Docker Desktop](https://www.docker.com) installed and running
- `psql` installed (comes with Postgres, or `brew install libpq` / `apt install postgresql-client`)
- Access (as at least a member) to the org account/organization in the Supabase dashboard

---

## 1. Create the new project

1. Log into the org account.
2. Go to [database.new](https://database.new) (or Dashboard → New Project) and create the project inside the **org organization**, on the Pro plan.
3. Pick the same region as your old project if you want similar latency (note: this manual process is your only option to move regions too, since Project Transfer can't).
4. Wait for the project to finish provisioning.

---

## 2. Migrate the database (schema + data)

### 2a. Back up the OLD project

1. Old project dashboard → **Connect** button → copy the **Session pooler** connection string (use direct connection string only if your network supports IPv6 or you have the IPv4 add-on).
2. Get/reset the DB password: **Database → Settings** (reset if you don't remember it).
3. Substitute the password into the connection string, then run:

```bash
supabase db dump --db-url "[OLD_CONNECTION_STRING]" -f roles.sql --role-only
supabase db dump --db-url "[OLD_CONNECTION_STRING]" -f schema.sql
supabase db dump --db-url "[OLD_CONNECTION_STRING]" -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

This produces three files: `roles.sql`, `schema.sql`, `data.sql`.

### 2b. Configure the NEW project before restoring

- If you used **Database Webhooks** on the old project, enable them on the new one first: **Database → Hooks**.
- If you used any non-default **extensions**, enable them: **Database → Extensions**.

### 2c. Restore into the NEW project

1. New project dashboard → **Connect** → copy the Session pooler (or direct) connection string.
2. Get/set the DB password: **Database → Settings**.
3. Run:

```bash
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "[NEW_CONNECTION_STRING]"
```

4. If you used **Realtime replication**, re-enable publications on the relevant tables: **Database → Publications**.

### 2d. Optional: preserve CLI migration history

If you managed migrations with the Supabase CLI and want that history preserved in the new project:

```bash
supabase db dump --db-url "$OLD_DB_URL" -f history_schema.sql --schema supabase_migrations
supabase db dump --db-url "$OLD_DB_URL" -f history_data.sql --use-copy --data-only --schema supabase_migrations
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file history_schema.sql \
  --file history_data.sql \
  --dbname "$NEW_DB_URL"
```

### 2e. Special case: customized `auth` / `storage` schemas

If you added custom triggers or RLS policies to the `auth` or `storage` schemas, diff and reapply them manually:

```bash
supabase link --project-ref "$OLD_PROJECT_REF"
supabase db diff --linked --schema auth,storage > changes.sql
```

Review `changes.sql` and apply the relevant parts to the new project.

### 2f. Common troubleshooting

| Issue                                                                    | Fix                                                                                   |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Permission errors mentioning `supabase_admin`                            | Open `schema.sql`, comment out lines like `ALTER ... OWNER TO "supabase_admin"`       |
| `permission denied to grant role "postgres"` (cli_login_postgres)        | Open `roles.sql`, comment out the `GRANT "postgres" TO "cli_login_postgres" ...` line |
| `role "postgres" is a member of role "cli_login_postgres"` after restore | `DROP ROLE IF EXISTS cli_login_postgres;` then let the CLI recreate it                |
| Custom roles with `LOGIN` don't work                                     | Manually set their password: `ALTER USER "YOUR_USER" WITH PASSWORD 'new_password';`   |

---

## 3. Migrate Edge Functions

**Via CLI:**

```bash
supabase login
supabase functions list --project-ref OLD_PROJECT_REF
supabase functions download FUNCTION_NAME --project-ref OLD_PROJECT_REF
supabase functions deploy --project-ref NEW_PROJECT_REF
```

Note: downloading doesn't include import maps or `deno.json` — re-add those manually if your functions depend on them. Also re-add any function **secrets/env vars** in the new project (Edge Functions → Secrets) — these aren't copied.

**Via Dashboard (alternative):** old project → Edge Functions → Download function as zip → new project → Edge Functions → Deploy new function → Via Editor → drag in the zip → name it → Deploy.

---

## 4. Migrate Storage objects (files + buckets)

Storage files are **not** included in the DB dump — migrate separately with a small Node script.

1. New folder:

```bash
npm init -y
npm install @supabase/supabase-js
```

2. Create `index.js` using the migration script from the [Supabase docs](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore#migrating-storage-objects) — it lists all buckets/files in the old project and copies them into the new one (creating buckets with matching public/size/mime settings).
3. Fill in at the top of the script:

```js
const OLD_PROJECT_URL = 'https://xxx.supabase.co';
const OLD_PROJECT_SERVICE_KEY = 'old-service-role-key';
const NEW_PROJECT_URL = 'https://yyy.supabase.co';
const NEW_PROJECT_SERVICE_KEY = 'new-service-role-key';
```

(Service role keys: **Project Settings → API Keys**, and project URL under **Data API** settings.) 4. Run it:

```bash
node index.js
```

It will prompt you before overwriting anything and print a summary of succeeded/failed files at the end.

---

## 5. Reconfigure everything that doesn't come with the DB dump

- **Auth settings**: providers (Google/GitHub/etc. client IDs & secrets), redirect/site URLs, email templates, SMTP config — re-enter manually under Authentication settings.
- **API keys**: the new project has entirely new `anon` / `service_role` keys and a new project URL — these are NOT the same as the old ones.
- **Custom domain** (if used): reconfigure under Project Settings → Custom Domains.
- **Realtime**: re-check publication settings (see step 2c.4).
- **Log drains / webhooks to external services**: reconfigure if used.
- **Any pg_cron / pg_net scheduled jobs**: verify they came over correctly in the schema dump and aren't accidentally double-firing from both projects during the transition window.

---

## 6. Update your application

- Replace `SUPABASE_URL` and `SUPABASE_ANON_KEY` (and `SERVICE_ROLE_KEY` if used server-side) in all environments: local `.env`, CI/CD secrets, hosting provider (Vercel/Netlify/etc.), mobile app config.
- Redeploy your app pointing at the new project.
- Test thoroughly: auth login/signup, storage upload/download, RLS-protected queries, Edge Function calls, realtime subscriptions.

---

## 7. Cut over and clean up

1. Once verified, point production traffic fully at the new project.
2. Keep the old project around (paused, not deleted) for a few days as a fallback in case you find a gap.
3. Once confident, either downgrade the old personal project to Free (if you want to keep it idle) or delete it: Project Settings → General → Delete Project.

---

## Alternative (simpler, if available to you)

If the old project is on a **Pro plan with Physical Backups/PITR enabled**, check **Database → Backups → Restore to a New Project** — Supabase can auto-clone the database (schema, data, roles, and even `auth.users`) into a new project in a few clicks, still requiring manual redo of storage files, Edge Functions, and Auth/API settings. This saves you the manual `pg_dump`/`psql` steps in section 2, but you'd still need to confirm the new project lands in the org organization.

Otherwise, the cleanest path remains getting added as a member of the org organization and using **Transfer Project** — zero re-configuration required.
