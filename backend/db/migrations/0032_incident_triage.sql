-- 0032_incident_triage.sql ───────────────────────────────────────────────────
-- Turns incidents from "something is wrong" into a work item: one row per
-- affected object, with a priority, an owner, a due time, a fix status and an
-- audit trail.
--
-- ── One incident per object, not per condition ──────────────────────────────
-- 0031 opened one incident per (category, connection, rule). That cannot carry
-- the fields this migration adds: four bloated tables might belong to three
-- teams, be fixed at different times, and need different statements. "Fix
-- Status: Applied" is meaningless on a row covering all four. So the
-- fingerprint now includes the object, and the alert notification groups the
-- per-object incidents rather than being one.
--
-- ── Priority vs severity ────────────────────────────────────────────────────
-- Two scales, deliberately. `severity` (info/warning/critical) is machine
-- routing: notification_destinations.min_severity, BaseNotifier.accepts(),
-- the alerts CHECK constraint and the Prisma model all speak it, and changing
-- it would silently re-route every existing destination. `priority`
-- (critical/high/medium/low) is the human triage scale — it drives the SLA and
-- what a person sees. incidentService derives one from the other; they are
-- never set independently.
--
-- ── Incident ID format ──────────────────────────────────────────────────────
-- INC-20260729-001: date plus a counter that resets daily. The counter lives
-- in a table rather than a sequence because sequences can't reset per day
-- without a scheduled job. The UPSERT on incident_counters is atomic, so
-- concurrent inserts can't collide.
--
-- Numbering still has gaps: INSERT ... ON CONFLICT evaluates the default before
-- it detects the conflict, so a re-fire that merely touches an existing
-- incident consumes a number. Normal for ticket systems; the gapless
-- alternative needs a lock on every insert.
--
-- ADDITIVE and IDEMPOTENT. Requires 0031 to have run first.
--
--   ⚠ DO NOT APPLY VIA `npm run migrate` — schema_migrations does not exist.
--
--     npm run sql -- db/migrations/0032_incident_triage.sql

BEGIN;

-- ── 1. Daily incident counter ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pgmonitoringtool.incident_counters (
    day  DATE    PRIMARY KEY,
    n    INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION pgmonitoringtool.next_incident_id()
RETURNS TEXT AS $$
DECLARE
    seq INTEGER;
BEGIN
    INSERT INTO pgmonitoringtool.incident_counters (day, n)
    VALUES (current_date, 1)
    ON CONFLICT (day) DO UPDATE SET n = pgmonitoringtool.incident_counters.n + 1
    RETURNING n INTO seq;

    -- 3 digits to match the requested format; widens automatically past 999
    -- rather than wrapping or colliding.
    RETURN 'INC-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(seq::text, 3, '0');
END;
$$ LANGUAGE plpgsql;

ALTER TABLE pgmonitoringtool.incidents
    ALTER COLUMN id SET DEFAULT pgmonitoringtool.next_incident_id();

-- ── 2. Triage columns ────────────────────────────────────────────────────────
ALTER TABLE pgmonitoringtool.incidents
    -- Object identity. Denormalised into three columns because the alert table
    -- displays them separately and operators filter on schema far more often
    -- than they filter on a composite key.
    ADD COLUMN IF NOT EXISTS database_name TEXT,
    ADD COLUMN IF NOT EXISTS schema_name   TEXT,
    ADD COLUMN IF NOT EXISTS object_name   TEXT,
    ADD COLUMN IF NOT EXISTS object_type   VARCHAR(32) DEFAULT 'table',

    -- The measurement that triggered it, kept numeric so incidents can be
    -- sorted and trended without parsing a display string. `metric_label` is
    -- what to call it in the table header ('Bloat %', 'Lag (s)', 'Cache hit %').
    ADD COLUMN IF NOT EXISTS metric_value  NUMERIC,
    ADD COLUMN IF NOT EXISTS metric_label  TEXT,
    ADD COLUMN IF NOT EXISTS metric_display TEXT,

    ADD COLUMN IF NOT EXISTS priority      VARCHAR(16) DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS owner         TEXT,
    ADD COLUMN IF NOT EXISTS detected_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS resolution_due_at TIMESTAMPTZ,

    -- Distinct from `status`. Status is the incident lifecycle; fix_status is
    -- what happened to the database. A VACUUM can be applied but not yet
    -- verified, while the incident stays in_progress.
    ADD COLUMN IF NOT EXISTS fix_status    VARCHAR(16) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS fix_sql       TEXT,
    ADD COLUMN IF NOT EXISTS fix_suggestion TEXT,

    -- Where the notification actually went, recorded after dispatch rather than
    -- assumed — a destination can be disabled or fail.
    ADD COLUMN IF NOT EXISTS notified_channels TEXT[] NOT NULL DEFAULT '{}',

    ADD COLUMN IF NOT EXISTS escalation_level  INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS escalated_at      TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incidents_priority_check') THEN
        ALTER TABLE pgmonitoringtool.incidents
            ADD CONSTRAINT incidents_priority_check
            CHECK (priority IN ('critical', 'high', 'medium', 'low'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incidents_fix_status_check') THEN
        ALTER TABLE pgmonitoringtool.incidents
            ADD CONSTRAINT incidents_fix_status_check
            CHECK (fix_status IN ('pending', 'applied', 'verified', 'failed'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS incidents_owner_idx
    ON pgmonitoringtool.incidents (owner, status_phase, resolution_due_at)
    WHERE owner IS NOT NULL;

CREATE INDEX IF NOT EXISTS incidents_overdue_idx
    ON pgmonitoringtool.incidents (resolution_due_at)
    WHERE status NOT IN ('resolved', 'closed');

-- Trend analysis: "has public.orders bloated before?" reads this.
CREATE INDEX IF NOT EXISTS incidents_object_history_idx
    ON pgmonitoringtool.incidents (database_name, schema_name, object_name, detected_at DESC)
    WHERE object_name IS NOT NULL;

-- ── 3. SLA targets ───────────────────────────────────────────────────────────
-- Per-org so a team with real on-call can tighten them; org_id 0 is the
-- built-in default every org falls back to.
CREATE TABLE IF NOT EXISTS pgmonitoringtool.incident_sla (
    org_id         INTEGER NOT NULL DEFAULT 0,
    priority       VARCHAR(16) NOT NULL
                   CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    target_minutes INTEGER NOT NULL CHECK (target_minutes > 0),
    escalate_after_minutes INTEGER,
    PRIMARY KEY (org_id, priority)
);

INSERT INTO pgmonitoringtool.incident_sla (org_id, priority, target_minutes, escalate_after_minutes)
VALUES (0, 'critical',    240,   240),   -- 4 hours
       (0, 'high',       1440,  1440),   -- 24 hours
       (0, 'medium',     4320,  4320),   -- 3 days
       (0, 'low',       10080, 10080)    -- 7 days
ON CONFLICT (org_id, priority) DO NOTHING;

-- ── 4. Ownership rules ───────────────────────────────────────────────────────
-- Pattern match on database / schema / object, most specific wins. Patterns are
-- SQL LIKE, so 'audit%' or plain '%' for "any". Specificity is the count of
-- non-wildcard patterns, so a rule naming a table beats one naming a schema,
-- which beats the catch-all.
CREATE TABLE IF NOT EXISTS pgmonitoringtool.incident_ownership_rules (
    id               SERIAL PRIMARY KEY,
    org_id           INTEGER,
    database_pattern TEXT NOT NULL DEFAULT '%',
    schema_pattern   TEXT NOT NULL DEFAULT '%',
    object_pattern   TEXT NOT NULL DEFAULT '%',
    category         VARCHAR(64),   -- null = any alert category
    owner            TEXT NOT NULL,
    enabled          BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pgmonitoringtool.incident_ownership_rules
    DROP COLUMN IF EXISTS specificity;
ALTER TABLE pgmonitoringtool.incident_ownership_rules
    ADD COLUMN specificity INTEGER
    GENERATED ALWAYS AS (
        (CASE WHEN database_pattern = '%' THEN 0 ELSE 4 END) +
        (CASE WHEN schema_pattern   = '%' THEN 0 ELSE 2 END) +
        (CASE WHEN object_pattern   = '%' THEN 0 ELSE 1 END) +
        (CASE WHEN category IS NULL       THEN 0 ELSE 8 END)
    ) STORED;

CREATE INDEX IF NOT EXISTS ownership_rules_lookup_idx
    ON pgmonitoringtool.incident_ownership_rules (enabled, specificity DESC);

-- ── 5. Audit trail ───────────────────────────────────────────────────────────
-- Append-only. Every state change and every statement run against the incident
-- lands here, so "what did we actually do about INC-20260729-001" has an
-- answer six months later.
CREATE TABLE IF NOT EXISTS pgmonitoringtool.incident_audit_trail (
    id          BIGSERIAL PRIMARY KEY,
    incident_id TEXT NOT NULL REFERENCES pgmonitoringtool.incidents(id) ON DELETE CASCADE,
    at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor       TEXT NOT NULL DEFAULT 'system',
    action      TEXT NOT NULL,
    note        TEXT,
    sql_run     TEXT,
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS incident_audit_incident_idx
    ON pgmonitoringtool.incident_audit_trail (incident_id, at DESC);

-- ── 6. Fingerprint now includes the object ───────────────────────────────────
-- Existing rows keep their fingerprints; new ones are written by
-- incidentService with the object appended. No backfill: the old fingerprints
-- are still unique, they just group more coarsely than new ones will.
COMMENT ON COLUMN pgmonitoringtool.incidents.fingerprint IS
    'category:connectionId:ruleId:objectKey — stable identity for a recurring '
    'condition on one object. See services/incidentService.ts.';

COMMIT;
