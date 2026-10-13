#!/usr/bin/env bash
#
# scripts/verify-local.sh
# ───────────────────────
# One command to reproduce, on your own machine, the checks that were run to
# verify the 2026-07-24 audit fixes. It mirrors .github/workflows/ci.yml so you
# can catch anything before pushing.
#
# What it runs (in order):
#   1. install         npm install (workspaces)
#   2. typecheck       tsc --noEmit for shared/types, shared/validators,
#                      backend, frontend
#   3. tests           backend `npm test` (all tests/*.test.ts, incl. the new
#                      route + sqlIdent suites) and frontend `vitest --run`
#   4. ratchet         backend silent-failure gate (report:silent --ci)
#   5. audit           production-dependency CVE gate (advisory here — see note)
#
# Expected on a clean tree after the audit fixes:
#   • backend tests …… 702 passing, 0 failing
#   • backend tsc …… clean
#   • ratchet …… swallowed 13 / leaked 62, "No regression against baseline"
#   • audit …… still reports HIGHs (dependency bumps were DEFERRED — see the
#     "Implementation status" section of docs/reports/FATHOM_Code_Audit_2026-07-24.md).
#     Audit is therefore ADVISORY in this script and does not fail the run.
#
# Usage:
#   ./scripts/verify-local.sh              # full run
#   ./scripts/verify-local.sh --no-install # skip npm install (deps already there)
#   ./scripts/verify-local.sh --quick      # typecheck + tests + ratchet, skip audit
#   ./scripts/verify-local.sh --audit-strict  # make the CVE audit a hard failure
#
# Requires Node 22 (same as CI).

set -uo pipefail

# ── locate repo root (this script lives in <root>/scripts) ───────────────────
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ── flags ────────────────────────────────────────────────────────────────────
DO_INSTALL=1
DO_AUDIT=1
AUDIT_STRICT=0
for arg in "$@"; do
  case "$arg" in
    --no-install)   DO_INSTALL=0 ;;
    --quick)        DO_AUDIT=0 ;;
    --audit-strict) AUDIT_STRICT=1 ;;
    -h|--help)      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown flag: $arg (try --help)"; exit 2 ;;
  esac
done

# ── pretty output ────────────────────────────────────────────────────────────
if [ -t 1 ]; then BOLD=$'\e[1m'; RED=$'\e[31m'; GRN=$'\e[32m'; YLW=$'\e[33m'; DIM=$'\e[2m'; RST=$'\e[0m'
else BOLD=""; RED=""; GRN=""; YLW=""; DIM=""; RST=""; fi

PASS=(); FAIL=(); WARN=()

section() { printf '\n%s──────────────────────────────────────────────────────────────%s\n%s%s%s\n' "$DIM" "$RST" "$BOLD" "$1" "$RST"; }

# run_step <label> <required|advisory> <cmd...>
run_step() {
  local label="$1"; local mode="$2"; shift 2
  printf '  %s▸ %s%s\n' "$DIM" "$label" "$RST"
  if "$@"; then
    printf '  %s✓ %s%s\n' "$GRN" "$label" "$RST"; PASS+=("$label")
  else
    if [ "$mode" = "advisory" ]; then
      printf '  %s⚠ %s (advisory — not failing the run)%s\n' "$YLW" "$label" "$RST"; WARN+=("$label")
    else
      printf '  %s✗ %s%s\n' "$RED" "$label" "$RST"; FAIL+=("$label")
    fi
  fi
}

# helpers that cd into a workspace for a single command
in_dir() { ( cd "$1" && shift && "$@" ); }

# ── node version check ───────────────────────────────────────────────────────
section "Environment"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
echo "  node $(node -v 2>/dev/null || echo '??')  (CI uses 22)"
if [ "$NODE_MAJOR" -lt 20 ] 2>/dev/null; then
  printf '  %s⚠ Node %s is older than CI (22); results may differ.%s\n' "$YLW" "$NODE_MAJOR" "$RST"
fi

# ── 1. install ───────────────────────────────────────────────────────────────
if [ "$DO_INSTALL" -eq 1 ]; then
  section "1/5  Install (npm workspaces)"
  run_step "npm install" required npm install --no-audit --no-fund
else
  section "1/5  Install — skipped (--no-install)"
fi

# ── 2. typecheck (mirrors ci type-check job) ─────────────────────────────────
section "2/5  Type-check (tsc --noEmit)"
run_step "shared/types tsc"      required in_dir shared/types      npx tsc --noEmit
run_step "shared/validators tsc" required in_dir shared/validators npx tsc --noEmit
run_step "backend tsc"           required in_dir backend           npx tsc --noEmit
run_step "frontend tsc"          required in_dir frontend          npx tsc --noEmit

# ── 3. tests ─────────────────────────────────────────────────────────────────
section "3/5  Tests"
run_step "backend unit + route tests" required in_dir backend  npm test
run_step "frontend tests"             required in_dir frontend npm test -- --run

# ── 4. silent-failure ratchet ────────────────────────────────────────────────
section "4/5  Silent-failure ratchet (backend)"
run_step "report:silent --ci" required in_dir backend npm run report:silent -- --ci

# ── 5. dependency CVE audit ──────────────────────────────────────────────────
if [ "$DO_AUDIT" -eq 1 ]; then
  section "5/5  Production dependency audit (HIGH+)"
  AUDIT_MODE="advisory"; [ "$AUDIT_STRICT" -eq 1 ] && AUDIT_MODE="required"
  run_step "backend prod audit"  "$AUDIT_MODE" in_dir backend  npm audit --omit=dev --audit-level=high
  run_step "frontend prod audit" "$AUDIT_MODE" in_dir frontend npm audit --omit=dev --audit-level=high
  run_step "sdk prod audit"      "$AUDIT_MODE" in_dir sdk       npm audit --omit=dev --audit-level=high
else
  section "5/5  Audit — skipped (--quick)"
fi

# ── summary ──────────────────────────────────────────────────────────────────
section "Summary"
printf '  %s%d passed%s' "$GRN" "${#PASS[@]}" "$RST"
[ "${#WARN[@]}" -gt 0 ] && printf '   %s%d advisory%s' "$YLW" "${#WARN[@]}" "$RST"
printf '   %s%d failed%s\n' "$RED" "${#FAIL[@]}" "$RST"
if [ "${#WARN[@]}" -gt 0 ]; then
  printf '  %sadvisory:%s %s\n' "$YLW" "$RST" "${WARN[*]}"
  printf '  %s(deferred dependency bumps — see docs/reports/FATHOM_Code_Audit_2026-07-24.md)%s\n' "$DIM" "$RST"
fi
if [ "${#FAIL[@]}" -gt 0 ]; then
  printf '  %sfailed:%s %s\n' "$RED" "$RST" "${FAIL[*]}"
  printf '\n%s✗ verification FAILED%s\n' "$RED$BOLD" "$RST"
  exit 1
fi
printf '\n%s✓ verification PASSED%s\n' "$GRN$BOLD" "$RST"
