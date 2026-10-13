-- 0025_slack_alert_destinations.sql ──────────────────────────────────────────
-- Unblocks Slack (and PagerDuty / Opsgenie / Teams / webhook) alert delivery on
-- the org project `sgmttzxltadcqriymvio`, where the data migrated but the schema
-- did not.
--
-- The notifier code is complete and tested — services/notifiers/slackNotifier.ts,
-- destinationService.ts, NotifierManager, and the fan-out call in
-- alertService._fanOutToOrgIntegrations. It fails today only because the table
-- it reads does not exist, and the failure is swallowed by a `.catch(log)` so
-- nothing surfaces in the UI.
--
-- This migration is ADDITIVE and IDEMPOTENT. It creates no destructive changes,
-- drops nothing, and re-running it is a no-op.
--
--   ⚠ DO NOT APPLY VIA `npm run migrate`.
--   `pgmonitoringtool.schema_migrations` does not exist on this database, so the
--   runner would record 0000–0024 as applied without executing them and
--   permanently seal ~60 missing tables. Apply this file directly:
--
--     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 0025_slack_alert_destinations.sql
--
-- Verify first with scripts/inspect-alert-schema.sql — see the note at the end
-- about the two colliding `alerts` tables, which this migration deliberately
-- does not try to resolve.

BEGIN;

CREATE SCHEMA IF NOT EXISTS pgmonitoringtool;

-- ── 1. Alert rules storage ───────────────────────────────────────────────────
-- server.ts:6478 reads `WHERE alert_type = 'rule'` and 6493 inserts
-- (alert_type, severity, message, details, acknowledged). Both are wrapped in a
-- try/catch that returns [] on failure, so the Alert Rules screen currently
-- shows an empty list rather than an error.
ALTER TABLE IF EXISTS pgmonitoringtool.alerts
    ADD COLUMN IF NOT EXISTS alert_type VARCHAR(32),
    ADD COLUMN IF NOT EXISTS details    JSONB;

CREATE INDEX IF NOT EXISTS alerts_alert_type_idx
    ON pgmonitoringtool.alerts (alert_type)
    WHERE alert_type IS NOT NULL;

-- ── 2. Per-org notification destinations ─────────────────────────────────────
-- Mirrors 0005_notification_destinations.sql, which was never applied here.
-- Kept self-contained so this file can be run standalone without first
-- replaying 0000–0024.
--
-- `secret_enc` holds AES-256-GCM output from services/encryptionService.encrypt()
-- as `iv:authTag:ciphertext` hex. Never logged; the API redacts it to `***`.
-- `min_severity` feeds BaseNotifier.accepts(), so an org can route info-level
-- noise to Slack while reserving PagerDuty for criticals.
CREATE TABLE IF NOT EXISTS pgmonitoringtool.notification_destinations (
    id            SERIAL PRIMARY KEY,
    org_id        INTEGER      NOT NULL,
    name          VARCHAR(120) NOT NULL,
    provider      VARCHAR(32)  NOT NULL
        CHECK (provider IN ('slack', 'pagerduty', 'opsgenie', 'teams', 'webhook')),
    min_severity  VARCHAR(16)  NOT NULL DEFAULT 'warning'
        CHECK (min_severity IN ('debug', 'info', 'warning', 'error', 'critical')),
    enabled       BOOLEAN      NOT NULL DEFAULT true,
    config        JSONB        NOT NULL DEFAULT '{}'::jsonb,
    secret_enc    TEXT,
    created_by    INTEGER,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_used_at  TIMESTAMPTZ,
    last_status   VARCHAR(16),
    last_error    TEXT
);

-- Foreign keys are attached only if the parent tables exist. `organizations` is
-- among the ~60 absent tables on this database; without this guard the whole
-- migration would abort and the destinations table would never be created.
DO $$
BEGIN
    IF to_regclass('pgmonitoringtool.organizations') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM pg_constraint
           WHERE conname = 'notification_destinations_org_id_fkey'
       )
    THEN
        ALTER TABLE pgmonitoringtool.notification_destinations
            ADD CONSTRAINT notification_destinations_org_id_fkey
            FOREIGN KEY (org_id)
            REFERENCES pgmonitoringtool.organizations(id) ON DELETE CASCADE;
        RAISE NOTICE 'attached org_id foreign key';
    ELSE
        RAISE NOTICE 'organizations table absent or FK present — org_id left unconstrained';
    END IF;

    IF to_regclass('pgmonitoringtool.users') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM pg_constraint
           WHERE conname = 'notification_destinations_created_by_fkey'
       )
    THEN
        ALTER TABLE pgmonitoringtool.notification_destinations
            ADD CONSTRAINT notification_destinations_created_by_fkey
            FOREIGN KEY (created_by)
            REFERENCES pgmonitoringtool.users(id) ON DELETE SET NULL;
        RAISE NOTICE 'attached created_by foreign key';
    ELSE
        RAISE NOTICE 'users table absent or FK present — created_by left unconstrained';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS notification_destinations_org_idx
    ON pgmonitoringtool.notification_destinations (org_id);

-- Partial index matching buildNotifiersForOrg()'s hot path: enabled rows only.
CREATE INDEX IF NOT EXISTS notification_destinations_enabled_idx
    ON pgmonitoringtool.notification_destinations (org_id, enabled)
    WHERE enabled = true;

CREATE UNIQUE INDEX IF NOT EXISTS notification_destinations_name_per_org
    ON pgmonitoringtool.notification_destinations (org_id, lower(name));

-- ── 3. updated_at trigger ────────────────────────────────────────────────────
-- So destinationService.updateDestination() doesn't have to set it by hand.
CREATE OR REPLACE FUNCTION pgmonitoringtool._touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notification_destinations_touch_updated_at
    ON pgmonitoringtool.notification_destinations;

CREATE TRIGGER notification_destinations_touch_updated_at
    BEFORE UPDATE ON pgmonitoringtool.notification_destinations
    FOR EACH ROW EXECUTE FUNCTION pgmonitoringtool._touch_updated_at();

COMMIT;

-- ── Deliberately NOT handled here ────────────────────────────────────────────
--
-- There are two different `alerts` tables and they are not interchangeable:
--
--   * pgmonitoringtool.alerts — alert *rules*, written by server.ts with
--     (alert_type, details). Fixed above.
--
--   * public.alerts — runtime alert *events*. alertService.ts:203 inserts into
--     an UNQUALIFIED `alerts`, and the admin pool (server.ts:390) sets no
--     search_path, so it resolves to public. That table already holds 7 rows
--     with a different shape (title, fingerprint, source) from what the code
--     writes (id, timestamp, severity, category, message, data, acknowledged).
--
-- Making runtime alerts land reliably is a product decision — pin the pool's
-- search_path, qualify the insert, or consolidate the two tables — not
-- something to guess at in a migration. Until it is resolved, alert *rules*
-- and the destinations fan-out work, but runtime alert events may still not be
-- created, and Slack has nothing to deliver.
--
-- Run scripts/inspect-alert-schema.sql to see the live shape of both tables
-- before choosing.
