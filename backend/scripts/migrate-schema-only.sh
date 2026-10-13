#!/usr/bin/env bash
# ============================================================================
#  PulseDB — Schema-only bootstrap on Supabase (no data copied)
#  Use this when you want a FRESH Supabase control plane (e.g. new environment)
#  instead of copying Neon's data. It just runs PulseDB's own migrator against
#  the Supabase DATABASE_URL, which creates the pgmonitoringtool schema, all
#  tables, and the initial admin user.
#
#  USAGE
#    DATABASE_URL="postgresql://postgres:pass@db.xxxx.supabase.co:5432/postgres" \
#    DB_SSL=true ./migrate-schema-only.sh
# ============================================================================
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to the Supabase connection string}"

say() { printf '\033[36m[schema]\033[0m %s\n' "$*"; }
HERE="$(cd "$(dirname "$0")/.." && pwd)"   # backend/

say "Target: ${DATABASE_URL%%@*}@… (Supabase)"
say "Running PulseDB control-plane migrator…"
# Reuse the project's own migrators so the schema always matches the app.
( cd "$HERE" && npm run migrate )
# Enterprise tables (SCIM, licensing, etc.) if present:
if ( cd "$HERE" && npm run | grep -q 'migrate:enterprise' ); then
  say "Running enterprise migrator…"
  ( cd "$HERE" && npm run migrate:enterprise )
fi
say "Schema bootstrap complete. The first run prints a one-time admin password —"
say "record it now (it is not stored anywhere else)."
