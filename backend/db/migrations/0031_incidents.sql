-- 0031_incidents.sql ─────────────────────────────────────────────────────────
-- Creates pgmonitoringtool.incidents.
--
-- This table has been referenced but never created. services/statusPageService
-- has read and written it since it was added — getIncidents, createIncident,
-- updateIncident, resolveIncident all name it — and getIncidents catches the
-- error and returns []. So the public status page has always shown "no
-- incidents", not because there were none but because the query failed. Same
-- shape of bug as audit_log before 0027: code correct, table absent, error
-- swallowed.
--
-- ── Status vocabulary ───────────────────────────────────────────────────────
-- Two callers want different words for the same lifecycle. statusPageService
-- speaks the public status-page dialect (investigating → identified →
-- monitoring → resolved); alerting speaks the operational one (open →
-- in_progress → closed). Rather than force one to lie, the CHECK admits both
-- and `status_phase` derives the coarse bucket every consumer can agree on.
-- A dashboard filtering "what's still live" reads status_phase; a status page
-- rendering nuance reads status.
--
-- ── Incident numbers ────────────────────────────────────────────────────────
-- id is human-quotable: INC-2026-00042. People read these aloud in calls and
-- paste them into tickets, so a UUID would be actively worse. The sequence is
-- global rather than per-year — a year-scoped counter needs either a table
-- lock or a per-year sequence, and neither is worth it to keep the number
-- short. The year in the prefix is when it was opened, nothing more.
--
-- ADDITIVE and IDEMPOTENT. No drops, no retypes, safe to re-run.
--
--   ⚠ DO NOT APPLY VIA `npm run migrate` — schema_migrations does not exist,
--     so the runner would mark 0000–0030 applied without executing them.
--
--     npm run sql -- db/migrations/0031_incidents.sql

BEGIN;

CREATE SCHEMA IF NOT EXISTS pgmonitoringtool;

CREATE SEQUENCE IF NOT EXISTS pgmonitoringtool.incident_number_seq;

CREATE TABLE IF NOT EXISTS pgmonitoringtool.incidents (
    id            TEXT PRIMARY KEY
                  DEFAULT 'INC-' || to_char(now(), 'YYYY') || '-' ||
                          lpad(nextval('pgmonitoringtool.incident_number_seq')::text, 5, '0'),

    title         TEXT         NOT NULL,
    description   TEXT,
    severity      VARCHAR(16)  NOT NULL DEFAULT 'warning'
                  CHECK (severity IN ('info', 'warning', 'critical')),

    -- Both dialects. See the note above.
    status        VARCHAR(24)  NOT NULL DEFAULT 'open'
                  CHECK (status IN (
                      'open', 'investigating', 'identified',
                      'in_progress', 'monitoring',
                      'resolved', 'closed'
                  )),

    -- What ties recurring symptoms to one incident. The alert loop re-fires
    -- every cycle while a condition holds; without this, a bloated table would
    -- open a fresh incident every five minutes and the number would be
    -- meaningless. Format: "<category>:<connectionId>:<ruleId>".
    fingerprint   TEXT,

    category      VARCHAR(64),
    connection_id INTEGER,
    org_id        INTEGER,

    -- The alert that opened it. TEXT because 0026 retyped alerts.id from
    -- serial to text (it holds a uuid string). No FK: alerts are subject to
    -- retention sweeps and an incident must outlive the alert that raised it.
    alert_id      TEXT,

    -- The structured payload the notification was rendered from — the findings
    -- table (one row per affected object) and the suggested fixes. Kept so the
    -- incident can be re-rendered later without recomputing, and so a reader
    -- six months on can see what the numbers actually were at the time.
    findings      JSONB        NOT NULL DEFAULT '[]'::jsonb,
    suggestions   JSONB        NOT NULL DEFAULT '[]'::jsonb,

    -- Filled in asynchronously by alertRcaService when the AI narrative lands.
    -- Null is the normal state for a fresh incident, and stays null forever if
    -- no AI is configured — the deterministic suggestions above stand alone.
    ai_analysis   TEXT,

    occurrences   INTEGER      NOT NULL DEFAULT 1,
    acknowledged_by VARCHAR(120),
    acknowledged_at TIMESTAMPTZ,

    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    resolved_at   TIMESTAMPTZ
);

-- Defensive: an earlier hand-rolled version of this table may exist on a
-- database that was patched by hand. Every column the writers name.
ALTER TABLE IF EXISTS pgmonitoringtool.incidents
    ADD COLUMN IF NOT EXISTS fingerprint     TEXT,
    ADD COLUMN IF NOT EXISTS category        VARCHAR(64),
    ADD COLUMN IF NOT EXISTS connection_id   INTEGER,
    ADD COLUMN IF NOT EXISTS org_id          INTEGER,
    ADD COLUMN IF NOT EXISTS alert_id        TEXT,
    ADD COLUMN IF NOT EXISTS findings        JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS suggestions     JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS ai_analysis     TEXT,
    ADD COLUMN IF NOT EXISTS occurrences     INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS acknowledged_by VARCHAR(120),
    ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS resolved_at     TIMESTAMPTZ;

-- The coarse bucket, derived so it can never drift from status.
-- 'active' covers everything that still needs a human.
ALTER TABLE pgmonitoringtool.incidents
    DROP COLUMN IF EXISTS status_phase;
ALTER TABLE pgmonitoringtool.incidents
    ADD COLUMN status_phase TEXT
    GENERATED ALWAYS AS (
        CASE WHEN status IN ('resolved', 'closed') THEN 'done' ELSE 'active' END
    ) STORED;

-- One open incident per fingerprint. This is the constraint that makes the
-- incident number stable across re-fires: the writer does INSERT ... ON
-- CONFLICT DO UPDATE against it, so a recurring condition bumps occurrences
-- and last_seen_at instead of minting a new number. Partial, so the same
-- fingerprint can legitimately recur after the first incident is closed.
CREATE UNIQUE INDEX IF NOT EXISTS incidents_open_fingerprint_uniq
    ON pgmonitoringtool.incidents (fingerprint)
    WHERE fingerprint IS NOT NULL AND status NOT IN ('resolved', 'closed');

CREATE INDEX IF NOT EXISTS incidents_created_idx
    ON pgmonitoringtool.incidents (created_at DESC);

CREATE INDEX IF NOT EXISTS incidents_active_idx
    ON pgmonitoringtool.incidents (status_phase, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS incidents_connection_idx
    ON pgmonitoringtool.incidents (connection_id, created_at DESC)
    WHERE connection_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS incidents_alert_idx
    ON pgmonitoringtool.incidents (alert_id)
    WHERE alert_id IS NOT NULL;

-- Keep updated_at honest without every writer having to remember it.
CREATE OR REPLACE FUNCTION pgmonitoringtool.incidents_touch_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS incidents_touch_updated_at ON pgmonitoringtool.incidents;
CREATE TRIGGER incidents_touch_updated_at
    BEFORE UPDATE ON pgmonitoringtool.incidents
    FOR EACH ROW EXECUTE FUNCTION pgmonitoringtool.incidents_touch_updated_at();

-- Align the sequence with anything already present, so a database that was
-- patched by hand doesn't collide on the first insert after this runs.
--
-- is_called => false so the very first incident is INC-YYYY-00001 rather than
-- 00002. On a populated table the third argument is true, because that value
-- has already been handed out.
--
-- Expect gaps in the numbering. INSERT ... ON CONFLICT evaluates the column
-- default before it detects the conflict, so every re-fire that merely bumps
-- an existing incident still burns a sequence value. That is normal for any
-- ticket system and the alternative — a gapless counter — needs a table lock
-- on every insert. Nobody should read meaning into the distance between two
-- incident numbers.
SELECT setval(
    'pgmonitoringtool.incident_number_seq',
    GREATEST(
        (SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '^INC-\d{4}-', ''), '')::bigint), 0)
           FROM pgmonitoringtool.incidents
          WHERE id ~ '^INC-\d{4}-\d+$'),
        1
    ),
    (SELECT EXISTS (SELECT 1 FROM pgmonitoringtool.incidents WHERE id ~ '^INC-\d{4}-\d+$'))
);

COMMIT;
