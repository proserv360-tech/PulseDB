#!/usr/bin/env bash
#
# One-shot recovery + commit for the uncommitted work sitting in this tree.
#
# Background: a stale .git/index.lock from Jul 22 blocked every git write since,
# and refs/heads/main went missing as a result — which is why `git log` reported
# "no commits yet" while origin/main was perfectly fine at fb09547.
#
# Run from the repo root:  bash scripts/commit-week.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."
echo "==> repo: $(pwd)"

# ---------------------------------------------------------------------------
# 1. Clear stale locks and restore the branch ref
# ---------------------------------------------------------------------------
rm -f .git/index.lock .git/HEAD.lock .git/refs/heads/main.lock
git update-ref refs/heads/main fb095471535d607f1c98aff0c15bde05eb1782a3
git symbolic-ref HEAD refs/heads/main
echo "==> HEAD now at: $(git log --oneline -1)"

# Start from a clean index; the working tree is untouched.
git reset -q

# ---------------------------------------------------------------------------
# 2. chore: repo hygiene
#    - .turbo/ build cache and large binaries were tracked; they're ignored now
#    - .env.example templates were being swallowed by the .env.* ignore rules
# ---------------------------------------------------------------------------
git rm -r --cached -q --ignore-unmatch .turbo
git rm --cached -q --ignore-unmatch \
  'FATHOM_Competitive_Landscape.pptx' \
  'FATHOM_Competitive_Landscape_v2.pptx' \
  'FATHOM_Product_Walkthrough.pptx' \
  'FATHOM_Product_Walkthrough_Detailed.pptx' \
  'Timesheet_Dilip_22-26Jun2026.docx' \
  'Timesheet_Dilip_22-26Jun2026_v2.docx'
git add .gitignore .claude/settings.local.json
git add -f .env.example backend/.env.example

git commit -q -m "chore(repo): untrack build cache and binaries, keep env templates

Removes .turbo/ cache entries and the presentation/timesheet binaries from
version control — all are covered by .gitignore and none belong in history.

Adds negation rules so .env.example and backend/.env.example stay tracked;
the broad .env.* patterns were silently dropping them from the index."

# ---------------------------------------------------------------------------
# 3. Auth, error-handling and validation work
# ---------------------------------------------------------------------------
git add \
  backend/services/sessionService.ts \
  backend/services/authCookie.ts \
  backend/services/sqlIdent.ts \
  backend/services/errorHandling.ts \
  backend/services/alertService.ts \
  backend/services/auditService.ts \
  backend/services/backupExecutor.ts \
  backend/services/indexAdvisor.ts \
  backend/services/schemaDiffService.ts \
  backend/services/waitEventSampler.ts \
  backend/services/workbookService.ts \
  backend/middleware/authenticate.ts \
  backend/middleware/workspaceRbac.ts \
  backend/db/schema.ts \
  backend/db/migrations/0024_session_schema_reconcile.sql \
  backend/routes/ \
  backend/scripts/migrate.ts \
  backend/scripts/report-silent-failures.ts \
  backend/tests/ \
  backend/server.ts \
  backend/package.json \
  backend/tsconfig.json \
  shared/validators/index.ts \
  frontend/src/App.tsx \
  frontend/src/context/AuthContext.tsx \
  frontend/src/components/auth/LoginPage.tsx \
  frontend/src/components/views/analytics/DemoSectionView.tsx \
  .github/workflows/ci.yml \
  .semgrep/fathom-rules.yml \
  scripts/verify-local.sh

git commit -q -m "fix(auth): type the session path, cut silent failures, wire validation

Auth
- sessionService.ts and authCookie.ts are now typed; these are the two modules
  that decide authentication and had been flagged by name in two prior audits
- migration 0024 reconciles the session schema against what the code expects

Error handling
- new services/errorHandling.ts centralises the swallow/leak patterns
- scripts/report-silent-failures.ts measures them; the ratchet baseline is
  lowered and report:silent --ci is now a blocking CI step

Validation
- validate() wired into write endpoints for the first time — it existed but was
  applied in none of the route files
- fixes a real schema drift: CreateUserSchema was missing the developer role

Other
- quoteIdent() consolidated into services/sqlIdent.ts, both copies deleted
- route-level integration tests added for user, admin and SAML routes
- demo engine tabs moved to React.lazy + Suspense, shrinking the initial bundle"

# ---------------------------------------------------------------------------
# 4. Review documents
# ---------------------------------------------------------------------------
git add AUTH_REVIEW.md CODE_IMPROVEMENTS.md DB_STATE_AND_PLAN.md docs/
git commit -q -m "docs: add auth review, database state review and code audit

AUTH_REVIEW.md          — auth findings, with the P0 items marked as landed
DB_STATE_AND_PLAN.md    — live inspection of the new org project: data migrated,
                          schema did not; most expected objects are missing
docs/reports/FATHOM_Code_Audit_2026-07-24.md — full-repo re-measurement"

# ---------------------------------------------------------------------------
# 5. Report — push is deliberately left to you
# ---------------------------------------------------------------------------
echo
echo "==> commits created:"
git log --oneline origin/main..HEAD
echo
echo "==> anything still uncommitted:"
git status --short
echo
echo "Review the above, then push with:"
echo "    git push origin main"
