-- 0034_declare_runtime_tables.sql ────────────────────────────────────────────
-- Declares the tables that application code creates at boot with
-- CREATE TABLE IF NOT EXISTS, so the migration files finally describe the whole
-- schema.
--
-- Why this matters: pgmonitoringtool.incidents was read and written by
-- statusPageService for months while no migration created it and no code
-- created it either, and getIncidents() caught the error and returned []. The
-- reason nobody noticed is that "some tables are made by migrations and some
-- appear at runtime" makes the migration set useless as an inventory — you
-- cannot tell a table that is created elsewhere from one that is created
-- nowhere.
--
-- The DDL below is copied verbatim from the runtime creators, which are listed
-- above each block. Those creators are deliberately left in place for now: they
-- are idempotent, they run before their first use, and deleting them in the
-- same change that adds this file would mean a deployment that applies the code
-- before the migration has no table at all. Remove them in a follow-up, once
-- this migration has been applied everywhere.
--
-- ADDITIVE and IDEMPOTENT — every statement is IF NOT EXISTS, so on an existing
-- database this is a no-op that simply records what is already there.
--
--     npm run sql -- db/migrations/0034_declare_runtime_tables.sql

BEGIN;

CREATE SCHEMA IF NOT EXISTS pgmonitoringtool;

/* organizations  — from scripts/migrate-enterprise.ts */
CREATE TABLE IF NOT EXISTS pgmonitoringtool.organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    owner_id INTEGER REFERENCES pgmonitoringtool.users(id),
    settings JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

/* org_members  — from scripts/migrate-enterprise.ts */
CREATE TABLE IF NOT EXISTS pgmonitoringtool.org_members (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES pgmonitoringtool.organizations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES pgmonitoringtool.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    invited_by INTEGER REFERENCES pgmonitoringtool.users(id),
    UNIQUE(org_id, user_id)
);

/* licenses  — from scripts/migrate-enterprise.ts */
CREATE TABLE IF NOT EXISTS pgmonitoringtool.licenses (
    id SERIAL PRIMARY KEY,
    license_key TEXT NOT NULL UNIQUE,
    org_id INTEGER REFERENCES pgmonitoringtool.organizations(id),
    tier VARCHAR(20) NOT NULL CHECK (tier IN ('community', 'pro', 'enterprise')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'suspended')),
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    activated_by INTEGER REFERENCES pgmonitoringtool.users(id),
    max_connections INTEGER DEFAULT 2,
    max_users INTEGER DEFAULT 5,
    features JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

/* retention_policies  — from server.ts */
CREATE TABLE IF NOT EXISTS pgmonitoringtool.retention_policies (
    id               SERIAL PRIMARY KEY,
    org_id           INTEGER NOT NULL DEFAULT 1,
    metrics_retention_days  INTEGER NOT NULL DEFAULT 30,
    logs_retention_days     INTEGER NOT NULL DEFAULT 7,
    alerts_retention_days   INTEGER NOT NULL DEFAULT 90,
    audit_retention_days    INTEGER NOT NULL DEFAULT 365,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id)
);

/* user_active_database  — from server.ts */
CREATE TABLE IF NOT EXISTS pgmonitoringtool.user_active_database (
    user_id       integer     NOT NULL,
    connection_id integer     NOT NULL,
    database      text        NOT NULL,
    updated_at    timestamptz DEFAULT now(),
    PRIMARY KEY (user_id, connection_id)
);

/* user_active_schema  — from server.ts */
CREATE TABLE IF NOT EXISTS pgmonitoringtool.user_active_schema (
    user_id       integer     NOT NULL,
    connection_id integer     NOT NULL,
    schema        text        NOT NULL,
    updated_at    timestamptz DEFAULT now(),
    PRIMARY KEY (user_id, connection_id)
);

/* cloud_provider_credentials  — from scripts/migrate.ts */
CREATE TABLE IF NOT EXISTS pgmonitoringtool.cloud_provider_credentials (
    id            BIGSERIAL    PRIMARY KEY,
    workspace_id  INTEGER,
    provider      TEXT         NOT NULL CHECK (provider IN ('aws','atlas')),
    label         TEXT         NOT NULL DEFAULT '',
    -- AWS: region + DB instance identifier; Atlas: project (group) id + cluster/process
    region        TEXT         NOT NULL DEFAULT '',
    resource_id   TEXT         NOT NULL DEFAULT '',
    -- public identifier (AWS access key id, or Atlas public API key)
    access_id     TEXT         NOT NULL DEFAULT '',
    -- encrypted secret (AWS secret access key, or Atlas private API key)
    secret_enc    TEXT,
    extra         JSONB        NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, provider, label)
);

/* fathom_capacity_history  — from services/capacityService.ts */
CREATE TABLE IF NOT EXISTS pgmonitoringtool.fathom_capacity_history (
    id            BIGSERIAL    PRIMARY KEY,
    connection_id TEXT         NOT NULL,
    captured_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    db_size_bytes BIGINT       NOT NULL DEFAULT 0,
    table_name    TEXT,
    table_bytes   BIGINT,
    row_estimate  BIGINT
);

/* schema_migrations  — from scripts/migrate.ts */
CREATE TABLE IF NOT EXISTS pgmonitoringtool.schema_migrations (
    filename    TEXT        PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    baselined   BOOLEAN     NOT NULL DEFAULT false
);

-- Indexes the runtime creators add separately, restated so a database built
-- from migrations alone performs the same as one built by the application.
CREATE INDEX IF NOT EXISTS capacity_history_conn_time_idx
    ON pgmonitoringtool.fathom_capacity_history (connection_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS org_members_user_idx
    ON pgmonitoringtool.org_members (user_id);

CREATE INDEX IF NOT EXISTS licenses_org_idx
    ON pgmonitoringtool.licenses (org_id)
    WHERE status = 'active';

COMMIT;
