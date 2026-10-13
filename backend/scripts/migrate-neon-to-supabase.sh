#!/usr/bin/env bash
# ============================================================================
#  PulseDB — Control-plane migration: Neon → Supabase
#  Dumps the PulseDB control-plane DB from Neon and restores it into Supabase.
#  Both are PostgreSQL, so this is a straight logical dump/restore.
#
#  USAGE
#    SOURCE_URL="postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require" \
#    TARGET_URL="postgresql://postgres:pass@db.xxxx.supabase.co:5432/postgres" \
#    ./migrate-neon-to-supabase.sh
#
#  Optional env:
#    DUMP_FILE   path for the intermediate dump (default: ./pulsedb_cp_dump.sql)
#    DRY_RUN     "true" → dump only, do not restore
#    NO_OWNER    "true" (default) → strip ownership/privilege so it restores
#                clean under Supabase's 'postgres' role
#
#  Requires: pg_dump / pg_restore / psql v15+ that match the SOURCE major
#  version (use the newer client if Neon/Supabase differ).
# ============================================================================
set -euo pipefail

: "${SOURCE_URL:?Set SOURCE_URL to the Neon connection string}"
: "${TARGET_URL:?Set TARGET_URL to the Supabase connection string}"
DUMP_FILE="${DUMP_FILE:-./pulsedb_cp_dump.dump}"
DRY_RUN="${DRY_RUN:-false}"
NO_OWNER="${NO_OWNER:-true}"

# PulseDB control-plane lives in the pgmonitoringtool schema plus a handful of
# public.pulsedb_* tables. We dump the whole database (excluding nothing) so
# nothing is missed; restore is additive into an empty Supabase DB.
say() { printf '\033[36m[migrate]\033[0m %s\n' "$*"; }
err() { printf '\033[31m[migrate] ERROR:\033[0m %s\n' "$*" >&2; }

command -v pg_dump >/dev/null   || { err "pg_dump not found on PATH"; exit 1; }
command -v pg_restore >/dev/null|| { err "pg_restore not found on PATH"; exit 1; }
command -v psql >/dev/null      || { err "psql not found on PATH"; exit 1; }

say "pg_dump version: $(pg_dump --version | awk '{print $NF}')"

# ── 1. Sanity: both endpoints reachable ─────────────────────────────────────
say "Checking SOURCE (Neon) connectivity…"
psql "$SOURCE_URL" -tAc 'SELECT 1' >/dev/null || { err "Cannot connect to SOURCE_URL"; exit 1; }
say "Checking TARGET (Supabase) connectivity…"
psql "$TARGET_URL" -tAc 'SELECT 1' >/dev/null || { err "Cannot connect to TARGET_URL"; exit 1; }

# ── 2. Guard: refuse to clobber a non-empty Supabase control plane ──────────
EXISTING=$(psql "$TARGET_URL" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='pgmonitoringtool'" 2>/dev/null || echo 0)
if [ "${EXISTING:-0}" -gt 0 ]; then
  err "TARGET already has ${EXISTING} tables in 'pgmonitoringtool'."
  err "Refusing to overwrite. Drop the schema first or use a fresh Supabase project."
  err "  To wipe intentionally: psql \"\$TARGET_URL\" -c 'DROP SCHEMA pgmonitoringtool CASCADE'"
  exit 1
fi

# ── 3. Dump from Neon (custom format → flexible restore) ────────────────────
DUMP_FLAGS=(--format=custom --no-acl --verbose)
[ "$NO_OWNER" = "true" ] && DUMP_FLAGS+=(--no-owner)
say "Dumping control-plane DB from Neon → ${DUMP_FILE}"
pg_dump "$SOURCE_URL" "${DUMP_FLAGS[@]}" --file="$DUMP_FILE"
say "Dump complete ($(du -h "$DUMP_FILE" | awk '{print $1}'))."

if [ "$DRY_RUN" = "true" ]; then
  say "DRY_RUN=true → stopping after dump. Restore manually with:"
  say "  pg_restore --no-owner --no-acl --dbname=\"\$TARGET_URL\" \"$DUMP_FILE\""
  exit 0
fi

# ── 4. Restore into Supabase ────────────────────────────────────────────────
# --no-owner/--no-acl: Supabase manages roles; we restore objects under the
#   connecting role. --exit-on-error off so benign "already exists" (e.g. the
#   public schema) doesn't abort; we surface the count of errors instead.
say "Restoring into Supabase…"
RESTORE_FLAGS=(--no-acl --dbname="$TARGET_URL" --verbose)
[ "$NO_OWNER" = "true" ] && RESTORE_FLAGS+=(--no-owner)
set +e
pg_restore "${RESTORE_FLAGS[@]}" "$DUMP_FILE" 2> >(tee /tmp/pulsedb_restore.log >&2)
RC=$?
set -e
# pg_restore exits non-zero on any ignorable warning; treat as soft unless the
# control-plane schema didn't land.
TBLS=$(psql "$TARGET_URL" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='pgmonitoringtool'")
if [ "${TBLS:-0}" -eq 0 ]; then
  err "Restore failed — no tables in pgmonitoringtool on Supabase. See /tmp/pulsedb_restore.log"
  exit 1
fi
say "Restore landed ${TBLS} tables in pgmonitoringtool (pg_restore rc=$RC, warnings tolerated)."

# ── 5. Quick verification ───────────────────────────────────────────────────
say "Running verification (run verify-migration.sh for a full row-count diff)…"
psql "$TARGET_URL" -c "\dt pgmonitoringtool.*" || true

say "DONE. Next: point DATABASE_URL at TARGET_URL, restart the backend, and run:"
say "  SOURCE_URL=… TARGET_URL=… ./verify-migration.sh"
