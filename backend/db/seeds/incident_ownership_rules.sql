-- incident_ownership_rules.sql ───────────────────────────────────────────────
-- Who owns what, for incident assignment.
--
-- Without at least one rule here every incident opens with owner NULL and the
-- alert table reads "Unassigned". That is deliberate — an unowned incident is
-- honest — but it means nothing is routed to anyone.
--
-- ── How matching works ──────────────────────────────────────────────────────
-- Patterns are SQL LIKE. '%' means any. The most specific enabled rule wins,
-- scored by `specificity` (a generated column): naming a category is worth 8,
-- a database 4, a schema 2, an object 1. So a category rule beats a schema
-- rule, which beats the catch-all. Ties break on lowest id.
--
-- IDEMPOTENT — safe to re-run. Each block skips if an identical rule exists.
--
--   npm run sql -- db/seeds/incident_ownership_rules.sql

BEGIN;

-- ── Catch-all ────────────────────────────────────────────────────────────────
-- Everything not claimed by a more specific rule below.
INSERT INTO pgmonitoringtool.incident_ownership_rules
    (database_pattern, schema_pattern, object_pattern, owner)
SELECT '%', '%', '%', 'DBA Team'
WHERE NOT EXISTS (
    SELECT 1 FROM pgmonitoringtool.incident_ownership_rules
     WHERE database_pattern = '%' AND schema_pattern = '%'
       AND object_pattern = '%' AND category IS NULL
);

-- ── More specific rules ──────────────────────────────────────────────────────
-- Uncomment and edit. Each follows the same guard so re-running is safe.
--
-- A schema belongs to a different team:
--
-- INSERT INTO pgmonitoringtool.incident_ownership_rules
--     (database_pattern, schema_pattern, object_pattern, owner)
-- SELECT '%', 'audit', '%', 'Data Eng'
-- WHERE NOT EXISTS (
--     SELECT 1 FROM pgmonitoringtool.incident_ownership_rules
--      WHERE database_pattern = '%' AND schema_pattern = 'audit'
--        AND object_pattern = '%' AND category IS NULL
-- );
--
-- One table in one database:
--
-- INSERT INTO pgmonitoringtool.incident_ownership_rules
--     (database_pattern, schema_pattern, object_pattern, owner)
-- SELECT 'MarketTimeDB', 'sales', 'transactions', 'Infra Ops'
-- WHERE NOT EXISTS (
--     SELECT 1 FROM pgmonitoringtool.incident_ownership_rules
--      WHERE database_pattern = 'MarketTimeDB' AND schema_pattern = 'sales'
--        AND object_pattern = 'transactions' AND category IS NULL
-- );
--
-- Every alert of a category, wherever it happens. Outranks the rules above —
-- "all reliability incidents go to Infra Ops" is a routing decision, not a
-- fact about a schema:
--
-- INSERT INTO pgmonitoringtool.incident_ownership_rules
--     (database_pattern, schema_pattern, object_pattern, category, owner)
-- SELECT '%', '%', '%', 'reliability', 'Infra Ops'
-- WHERE NOT EXISTS (
--     SELECT 1 FROM pgmonitoringtool.incident_ownership_rules
--      WHERE database_pattern = '%' AND schema_pattern = '%'
--        AND object_pattern = '%' AND category = 'reliability'
-- );

COMMIT;

-- What this database will now do. Read it back before trusting it — the
-- ordering here is exactly the ordering resolveOwner() uses.
\echo Ownership rules, most specific first
SELECT id, specificity, database_pattern, schema_pattern, object_pattern,
       COALESCE(category, '(any)') AS category, owner, enabled
  FROM pgmonitoringtool.incident_ownership_rules
 ORDER BY specificity DESC, id ASC;
