-- 0005_notification_destinations.sql ─────────────────────────────────────────
-- Per-organization alert destinations. Powers the integration fan-out:
-- alertService dispatches to every enabled destination for an org, not just
-- the global SLACK_WEBHOOK_URL env var.
--
-- Each row holds one provider + encrypted credentials. The encryption is done
-- at write time by services/encryptionService.encrypt() (AES-256-GCM); the
-- raw column stores `iv:authTag:ciphertext` hex triples.
--
-- `min_severity` honours the BaseNotifier.accepts() gate so tenants can route
-- info-level noise to Slack and keep PagerDuty pages for criticals only.

CREATE TABLE IF NOT EXISTS pgmonitoringtool.notification_destinations (
    id                SERIAL PRIMARY KEY,
    org_id            INTEGER NOT NULL
        REFERENCES pgmonitoringtool.organizations(id) ON DELETE CASCADE,
    name              VARCHAR(120) NOT NULL,
    provider          VARCHAR(32)  NOT NULL
        CHECK (provider IN ('slack', 'pagerduty', 'opsgenie', 'teams', 'webhook')),
    min_severity      VARCHAR(16)  NOT NULL DEFAULT 'warning'
        CHECK (min_severity IN ('debug', 'info', 'warning', 'error', 'critical')),
    enabled           BOOLEAN      NOT NULL DEFAULT true,
    -- Provider-agnostic public config (e.g. Slack channel, PagerDuty source,
    -- webhook URL). JSON so each provider can add its own fields without a
    -- schema change.
    config            JSONB        NOT NULL DEFAULT '{}'::jsonb,
    -- Provider-specific ENCRYPTED secret (PD routing key, Slack bot token,
    -- Opsgenie API key, webhook HMAC secret, …). Never logged, never
    -- returned by the API — endpoints redact to `***`.
    secret_enc        TEXT,
    created_by        INTEGER
        REFERENCES pgmonitoringtool.users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_used_at      TIMESTAMPTZ,
    last_status       VARCHAR(16),
    last_error        TEXT
);

CREATE INDEX IF NOT EXISTS notification_destinations_org_idx
    ON pgmonitoringtool.notification_destinations(org_id);

CREATE INDEX IF NOT EXISTS notification_destinations_enabled_idx
    ON pgmonitoringtool.notification_destinations(org_id, enabled)
    WHERE enabled = true;

CREATE UNIQUE INDEX IF NOT EXISTS notification_destinations_name_per_org
    ON pgmonitoringtool.notification_destinations(org_id, lower(name));

-- `updated_at` trigger so the service layer doesn't have to set it manually.
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
