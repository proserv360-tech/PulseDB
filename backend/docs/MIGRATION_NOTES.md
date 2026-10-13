# FATHOM — Migration Notes

This file collects historical migration notes that used to live next to the
source they described. They are kept here for archaeological reference; the
canonical source of truth is the current code, not these documents.

The originals were:

- `frontend/src/components/views/database/CONVERSION_SUMMARY.md`
- `frontend/src/components/views/database/TYPESCRIPT_MIGRATION.md`
- `frontend/src/components/views/database/MANIFEST.md`

They were folded into this file on 2026-06-02 as part of Wave A code hygiene
(task A7 in `FATHOM_Implementation_Plan_2026-06-02.docx`). If you need the
verbatim history, recover them from git.

## Why move them?

Three reasons:

1. **They drifted.** Each described an in-progress migration that has since
   landed. Leaving them in-tree implied work was still pending in this
   directory.
2. **Documentation belongs in `backend/docs/` or a top-level `docs/` site.**
   Inline `.md` next to `.tsx` files is invisible to anyone reading the docs
   index.
3. **They duplicated each other.** All three referenced the same set of
   conversions with slightly different framings.

## Summary of the conversions they documented

- **TypeScript adoption** across `frontend/src/components/views/database/`:
  the original `.jsx` versions of the 13 database visualization components
  were ported to `.tsx` with typed props and shared `THEME` types.
- **Component manifest** that itemised which `.jsx` files had been replaced
  and which were superseded. The current tree only ships the `.tsx`
  versions; the `.jsx` originals were removed at the time of the migration.
- **`V2` / `V3` variants** of `IndexesTab` and `CapacityPlanningTab`
  existed transiently while design iterations were in flight. As of
  2026-06-02 only the version actually imported by `frontend/src/App.tsx`
  remains in the tree:
    - `IndexesTab.tsx` — original V1 (imported by `App.tsx`).
    - `CapacityPlanningTabV3.tsx` — V3 (imported by `App.tsx`).

The unused variants (`IndexesTabV2`, `IndexesTabV3`, `_indexesV3Helpers`,
`CapacityPlanningTab`, `CapacityPlanningTabV2`) were deleted in the same
hygiene pass.

## Open question — IndexesTab V1 vs V3

`IndexesTabV3` was richer than V1 (Autonomy Console, SLO strip, what-if
simulator, EXPLAIN before/after diff) but was never wired into `App.tsx`.
It was deleted in the hygiene pass on the principle "delete what the
shipping product does not import". If the V3 experience is the target,
the decision to ship it is a product call, not a cleanup task, and the
work should be tracked as its own roadmap item with a clean port from
git history.
