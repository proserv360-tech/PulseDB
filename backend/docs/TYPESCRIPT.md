# Backend TypeScript migration

B4 — incremental setup landed 2026-06-02.

## Where we are

- `tsconfig.json` is strict, `allowJs: true`, `checkJs: false`. Existing
  `.js` files compile but are not type-checked.
- `tsconfig.checkjs.json` is the opt-in strict pass. It uses JSDoc-driven
  type-checking on a curated allow-list of files (the ones that have been
  hardened so they no longer trip on legacy patterns).
- New backend files MUST be `.ts`.

## Day-to-day commands

| Goal                               | Command                                             |
| ---------------------------------- | --------------------------------------------------- |
| Type-check the `.ts` surface       | `npm --workspace=backend run type-check`            |
| Strict-check the curated `.js` set | `npx tsc -p backend/tsconfig.checkjs.json --noEmit` |
| Add a file to the strict-check set | Append its path to `tsconfig.checkjs.json#include`  |

## Conversion order (longest-blast-radius first)

1. `db.js` — touched by every route.
2. `middleware/authenticate.js`
3. `middleware/workspaceRbac.js`
4. `middleware/tenantIsolation.js`
5. `services/encryptionService.js` ✅ JSDoc, included in checkjs pass
6. `services/userService.js`
7. `services/sessionService.js`
8. Route modules — one per PR.

Each conversion lands as: `.js` → `.ts`, no behaviour change, exports
preserved. Imports stay path-compatible (`./foo.js` resolves to `foo.ts`
under bundler module resolution).

## Why incremental

A full big-bang rewrite would block every other PR for the entire
migration window. The opt-in `tsconfig.checkjs.json` lets us tighten the
gate one file at a time: a file is "covered" once its path is in the
include list and `tsc -p tsconfig.checkjs.json` passes. CI gates the
covered set; uncovered files keep working as plain `.js`.

## Shared types

Backend imports `@pulsedb/types` (`shared/types/`) for cross-tier types,
and `@pulsedb/validators` (`shared/validators/`) for Zod schemas that
double as request validators (see `middleware/validate.js`, B5).
