-- 0026_alerts_rules_split.sql ────────────────────────────────────────────────
-- Gives alert *rules* and alert *events* separate tables, so runtime alerts can
-- actually be created — without which Slack has nothing to deliver.
--
-- WHAT WENT WRONG
-- ---------------
-- Three incompatible definitions of "alerts" accumulated:
--
--   1. db/migrations/0000 + db/schema.ts
--        alerts(id serial, type, details, status, connection_id, ...)
--        A generation that was never applied to any live database.
--
--   2. services/alertService.ts — the code that actually runs
--        alerts(id uuid TEXT, timestamp, severity, category, message, data,
--               acknowledged, slack_ts)
--        13 queries across alertService, alertsManagementRoutes and
--        overviewRoutes all agree on this shape.
--
--   3. server.ts:6473-6500
--        Stores rules INSIDE alerts using an `alert_type = 'rule'` discriminator,
--        because pgmonitoringtool.alert_rules was never created here.
--
-- Definitions 1 and 2 share only `severity` and `message`. Critically, 1 makes
-- `id` a serial INTEGER while 2 supplies a UUID string — so alertService could
-- never have inserted into the 0000-shaped table at all.
--
-- Note 0025 added alert_type/details to `alerts`, which made the shim in (3)
-- work. That was a workaround; this migration retires it and 0025's columns
-- become vestigial (left in place, harmless, dropped only once you have
-- confirmed nothing reads them).
--
-- THE RESOLUTION
-- --------------
-- Runtime behaviour wins over the never-applied schema:
--   * alert_rules  — real table, from 0000's DDL. Rules move here.
--   * alerts       — events only, reshaped to the runtime contract.
--
-- SAFETY
-- ------
-- Reshaping `alerts.id` to text is only sound while the table is empty. The
-- audit measured 0 rows. This migration RE-CHECKS at run time and ABORTS the
-- whole transaction if that is no longer true, rather than damaging data.
--
--   ⚠ DO NOT APPLY VIA `npm run migrate` — schema_migrations does not exist.
--
--     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 0026_alerts_rules_split.sql
--
-- Note this does NOT touch public.alerts and its 7 rows. Those predate the org
-- migration and duplicate the concept; deciding whether to import or drop them
-- is a separate call. After this migration nothing reads public.alerts.

BEGIN;

CREATE SCHEMA IF NOT EXISTS pgmonitoringtool;

-- ── 1. The real alert_rules table ────────────────────────────────────────────
-- Lifted from 0000_sturdy_sharon_carter.sql. `notify_slack` is part of the
-- original design — per-rule Slack routing, alongside the org-wide destinations
-- created in 0025.
CREATE TABLE IF NOT EXISTS pgmonitoringtool.alert_rules (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(200) NOT NULL,
    description      TEXT         DEFAULT '',
    metric           VARCHAR(100) NOT NULL,
    condition        VARCHAR(10)  NOT NULL,
    threshold        REAL         NOT NULL,
    severity         VARCHAR(20)  NOT NULL DEFAULT 'warning',
    enabled          BOOLEAN      NOT NULL DEFAULT true,
    cooldown_minutes INTEGER      DEFAULT 15,
    notify_email     BOOLEAN      DEFAULT false,
    notify_slack     BOOLEAN      DEFAULT false,
    connection_id    INTEGER,
    created_by       INTEGER,
    created_at       TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP    NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF to_regclass('pgmonitoringtool.users') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint
                       WHERE conname = 'alert_rules_created_by_fkey')
    THEN
        ALTER TABLE pgmonitoringtool.alert_rules
            ADD CONSTRAINT alert_rules_created_by_fkey
            FOREIGN KEY (created_by)
            REFERENCES pgmonitoringtool.users(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS alert_rules_enabled_idx
    ON pgmonitoringtool.alert_rules (enabled) WHERE enabled = true;

-- ── 2. Carry across any rules created through the 0025 shim ──────────────────
-- server.ts wrote rules as alerts rows with alert_type='rule', packing the rule
-- body into `details` as JSON and the rule name into `message`.
DO $$
DECLARE
    moved INTEGER := 0;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'pgmonitoringtool'
                 AND table_name = 'alerts' AND column_name = 'alert_type')
    THEN
        INSERT INTO pgmonitoringtool.alert_rules
            (name, metric, condition, threshold, severity, enabled)
        SELECT
            COALESCE(a.message, 'Untitled rule'),
            COALESCE(a.details->>'metric', 'unknown'),
            COALESCE(a.details->>'condition', '>'),
            COALESCE((a.details->>'threshold')::REAL, 0),
            COALESCE(a.severity, 'warning'),
            COALESCE((a.details->>'enabled')::BOOLEAN, true)
        FROM pgmonitoringtool.alerts a
        WHERE a.alert_type = 'rule';

        GET DIAGNOSTICS moved = ROW_COUNT;

        DELETE FROM pgmonitoringtool.alerts WHERE alert_type = 'rule';
        RAISE NOTICE 'moved % rule row(s) into alert_rules', moved;
    END IF;
END $$;

-- ── 3. Reshape alerts to the runtime event contract ──────────────────────────
-- Aborts loudly rather than mangling data if anything is left in the table.
DO $$
DECLARE
    remaining BIGINT;
    id_type   TEXT;
BEGIN
    SELECT count(*) INTO remaining FROM pgmonitoringtool.alerts;

    SELECT data_type INTO id_type
    FROM information_schema.columns
    WHERE table_schema = 'pgmonitoringtool'
      AND table_name = 'alerts' AND column_name = 'id';

    IF id_type IS DISTINCT FROM 'text' THEN
        IF remaining > 0 THEN
            RAISE EXCEPTION
                'pgmonitoringtool.alerts holds % row(s); refusing to retype id from % to text. Export or clear them, then re-run.',
                remaining, id_type;
        END IF;

        ALTER TABLE pgmonitoringtool.alerts
            ALTER COLUMN id DROP DEFAULT,
            ALTER COLUMN id TYPE TEXT USING id::TEXT;

        RAISE NOTICE 'alerts.id retyped from % to text (table was empty)', id_type;
    ELSE
        RAISE NOTICE 'alerts.id already text — nothing to do';
    END IF;
END $$;

-- Columns the runtime writes. Additive and idempotent; pre-existing ones keep
-- whatever type they already have.
ALTER TABLE pgmonitoringtool.alerts
    ADD COLUMN IF NOT EXISTS timestamp    TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS severity     VARCHAR(20) NOT NULL DEFAULT 'warning',
    ADD COLUMN IF NOT EXISTS category     VARCHAR(64),
    ADD COLUMN IF NOT EXISTS message      TEXT,
    ADD COLUMN IF NOT EXISTS data         JSONB       NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS acknowledged BOOLEAN     NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS org_id       INTEGER,
    -- slack_ts is the Slack message timestamp, stored so the alert can later be
    -- updated in place or replied to in-thread (slackService.updateAlertMessage
    -- and postThreadComment).
    ADD COLUMN IF NOT EXISTS slack_ts     VARCHAR(32),
    ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ NOT NULL DEFAULT now();

-- Matches the runtime access patterns: recent-first listing, unacknowledged
-- filter, slack_ts lookup when a Slack thread reply comes back.
CREATE INDEX IF NOT EXISTS alerts_timestamp_idx
    ON pgmonitoringtool.alerts (timestamp DESC);

CREATE INDEX IF NOT EXISTS alerts_unacked_idx
    ON pgmonitoringtool.alerts (acknowledged, timestamp DESC)
    WHERE acknowledged = false;

CREATE INDEX IF NOT EXISTS alerts_slack_ts_idx
    ON pgmonitoringtool.alerts (slack_ts) WHERE slack_ts IS NOT NULL;

CREATE INDEX IF NOT EXISTS alerts_org_idx
    ON pgmonitoringtool.alerts (org_id) WHERE org_id IS NOT NULL;

COMMIT;

-- ── After applying ───────────────────────────────────────────────────────────
--   1. Re-run scripts/inspect-alert-schema.sql — alerts.id should read text.
--   2. Restart the backend so the pool picks up a clean state.
--   3. Trigger a test alert; it should appear in pgmonitoringtool.alerts and,
--      once a Slack destination is configured in Notifier Settings, in Slack.
--   4. public.alerts is now unreferenced — decide separately whether to import
--      its 7 rows or drop the table.
