#!/usr/bin/env bash
# ============================================================================
#  PulseDB — Verify Neon → Supabase migration
#  Compares per-table row counts between SOURCE (Neon) and TARGET (Supabase)
#  for every table in the pgmonitoringtool schema + public.pulsedb_* tables.
#  Exits non-zero if any table's counts differ.
#
#  USAGE
#    SOURCE_URL="postgresql://…neon…" TARGET_URL="postgresql://…supabase…" \
#    ./verify-migration.sh
# ============================================================================
set -euo pipefail
: "${SOURCE_URL:?Set SOURCE_URL}"
: "${TARGET_URL:?Set TARGET_URL}"

say() { printf '\033[36m[verify]\033[0m %s\n' "$*"; }

# Build the list of qualified tables from the SOURCE (authoritative).
LIST_SQL="
  SELECT format('%I.%I', table_schema, table_name)
  FROM information_schema.tables
  WHERE table_type='BASE TABLE'
    AND (table_schema='pgmonitoringtool'
         OR (table_schema='public' AND table_name LIKE 'pulsedb_%'))
  ORDER BY 1;
"
mapfile -t TABLES < <(psql "$SOURCE_URL" -tAc "$LIST_SQL")

if [ "${#TABLES[@]}" -eq 0 ]; then
  say "No control-plane tables found on SOURCE — nothing to verify."
  exit 0
fi

say "Comparing ${#TABLES[@]} tables…"
FAIL=0
printf '%-48s %12s %12s   %s\n' "TABLE" "SOURCE" "TARGET" "STATUS"
printf '%s\n' "--------------------------------------------------------------------------------------"
for tbl in "${TABLES[@]}"; do
  src=$(psql "$SOURCE_URL" -tAc "SELECT count(*) FROM $tbl" 2>/dev/null || echo "ERR")
  tgt=$(psql "$TARGET_URL" -tAc "SELECT count(*) FROM $tbl" 2>/dev/null || echo "MISSING")
  if [ "$src" = "$tgt" ]; then status="✓ ok"; else status="✗ MISMATCH"; FAIL=1; fi
  printf '%-48s %12s %12s   %s\n' "$tbl" "$src" "$tgt" "$status"
done

echo
if [ "$FAIL" -eq 0 ]; then
  say "All tables match. Migration verified."
else
  say "Row-count mismatches detected — investigate before cutting over."
  exit 1
fi
