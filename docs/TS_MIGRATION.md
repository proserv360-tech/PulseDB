# Backend TypeScript Migration (2026-06-10)

All 207 backend `.js` files were renamed to `.ts`. The codebase now type-checks
clean under the existing strict `tsconfig.json` (`npx tsc --noEmit`).

## How it works

- **Runtime:** `tsx` (moved to `dependencies`) runs `.ts` directly and resolves
  the existing `./module.js` import specifiers to `.ts` files, so no import
  statements needed rewriting. All npm scripts, `Procfile`, `railway.json`,
  `.nixpacks.toml`, and `vercel.json` were updated (`node server.js` → `tsx server.ts`).
- **Type checking:** `tsconfig.json` is unchanged (strict mode). 155 legacy (middleware/ fully typed 2026-06-10, which surfaced and fixed a broken writeAudit call)
  files that did not pass strict checking received a top-of-file
  `// @ts-nocheck` annotation. ~43 files pass fully typed.

## Burn-down

New code is fully strict-checked. To finish the migration, pick a file, delete
its `@ts-nocheck` line, run `npm run type-check`, and fix the errors. Find
remaining files with:

```sh
grep -rl "@ts-nocheck — legacy JS migrated" backend --include="*.ts" | wc -l
```

Suggested order: `middleware/` (small, security-relevant) → `routes/` →
`services/` → `server.ts` (largest, last).

## Gotchas

- Import specifiers still say `.js` (e.g. `import x from './db.js'`). This is
  valid TS resolution and tsx handles it at runtime. Don't "fix" them to `.ts`
  unless `allowImportingTsExtensions` is enabled.
- Tests run via `tsx --test` (see `backend/package.json` scripts).
- `npm install --production` on Railway/Nixpacks now installs `tsx` because it
  is a runtime dependency.
