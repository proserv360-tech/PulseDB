-- 0001_saml_sso_rbac.sql
-- Adds SAML SSO configuration per workspace, SCIM tokens, workspace-scoped
-- RBAC, IP allow-lists, and query-plan storage. Idempotent where possible so
-- re-runs on existing databases are safe.

-- ─────────────────────────────────────────────────────────────────────────────
-- Workspaces (lightweight — one row per tenant)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "pgmonitoringtool"."workspaces" (
    "id"            serial PRIMARY KEY,
    "slug"          varchar(64)  UNIQUE NOT NULL,
    "name"          varchar(200) NOT NULL,
    "plan"          varchar(32)  DEFAULT 'free' NOT NULL,
    "created_at"    timestamp    DEFAULT now() NOT NULL,
    "updated_at"    timestamp    DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────────
-- Workspace membership + role. A user can belong to multiple workspaces,
-- each with an independent role. role ∈ (owner, admin, editor, viewer).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "pgmonitoringtool"."workspace_members" (
    "id"            serial PRIMARY KEY,
    "workspace_id"  integer NOT NULL REFERENCES "pgmonitoringtool"."workspaces"("id") ON DELETE CASCADE,
    "user_id"       integer NOT NULL,
    "role"          varchar(20) DEFAULT 'viewer' NOT NULL,
    "invited_by"    integer,
    "created_at"    timestamp DEFAULT now() NOT NULL,
    UNIQUE ("workspace_id", "user_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_workspace_members_user"
    ON "pgmonitoringtool"."workspace_members" ("user_id");
--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────────
-- SAML SSO configuration (one row per workspace). Private key is encrypted
-- with ENCRYPTION_KEY at rest; idp_cert is stored verbatim (it's public).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "pgmonitoringtool"."saml_configs" (
    "id"                    serial PRIMARY KEY,
    "workspace_id"          integer UNIQUE NOT NULL
                            REFERENCES "pgmonitoringtool"."workspaces"("id") ON DELETE CASCADE,
    "entity_id"             text NOT NULL,
    "sso_url"               text NOT NULL,
    "slo_url"               text,
    "idp_cert"              text NOT NULL,
    "sp_private_key_enc"    text,
    "sp_cert"               text,
    "want_signed_response"  boolean DEFAULT true NOT NULL,
    "want_signed_assertion" boolean DEFAULT true NOT NULL,
    "name_id_format"        varchar(128)
                            DEFAULT 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    "default_role"          varchar(20) DEFAULT 'viewer' NOT NULL,
    "attribute_mapping"     jsonb DEFAULT '{}'::jsonb NOT NULL,
    "enabled"               boolean DEFAULT false NOT NULL,
    "created_at"            timestamp DEFAULT now() NOT NULL,
    "updated_at"            timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────────
-- SCIM 2.0 provisioning tokens (one per workspace; rotated by admins).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "pgmonitoringtool"."scim_tokens" (
    "id"            serial PRIMARY KEY,
    "workspace_id"  integer NOT NULL
                    REFERENCES "pgmonitoringtool"."workspaces"("id") ON DELETE CASCADE,
    "token_hash"    varchar(64) UNIQUE NOT NULL,
    "token_prefix"  varchar(16) NOT NULL,
    "created_by"    integer,
    "last_used_at"  timestamp,
    "revoked_at"    timestamp,
    "created_at"    timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────────
-- IP allow-list per workspace. If a workspace has any rows here, every
-- authenticated request must come from an IP within one of the CIDRs.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "pgmonitoringtool"."ip_allowlist" (
    "id"            serial PRIMARY KEY,
    "workspace_id"  integer NOT NULL
                    REFERENCES "pgmonitoringtool"."workspaces"("id") ON DELETE CASCADE,
    "cidr"          varchar(64) NOT NULL,
    "label"         varchar(200),
    "created_by"    integer,
    "created_at"    timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ip_allowlist_workspace"
    ON "pgmonitoringtool"."ip_allowlist" ("workspace_id");
--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────────
-- Captured query plans (Postgres EXPLAIN JSON + MySQL/Mongo equivalents).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "pgmonitoringtool"."query_plans" (
    "id"                serial PRIMARY KEY,
    "connection_id"     integer NOT NULL,
    "workspace_id"      integer,
    "engine"            varchar(20) NOT NULL,     -- postgres | mysql | mongodb
    "sql_fingerprint"   varchar(64) NOT NULL,     -- sha256 of normalized SQL
    "sql_text"          text NOT NULL,
    "plan_json"         jsonb NOT NULL,
    "execution_ms"      double precision,
    "rows_returned"     bigint,
    "captured_by"       integer,
    "captured_at"       timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_query_plans_fp_captured"
    ON "pgmonitoringtool"."query_plans" ("sql_fingerprint", "captured_at" DESC);
--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────────
-- Alert rule DSL expression (new column; old threshold/metric/condition
-- fields remain for backwards compatibility). A rule with expression set
-- takes precedence over the legacy fields when evaluated.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "pgmonitoringtool"."alert_rules"
    ADD COLUMN IF NOT EXISTS "expression"       text,
    ADD COLUMN IF NOT EXISTS "pagerduty_key"    varchar(64),
    ADD COLUMN IF NOT EXISTS "slack_webhook"    text,
    ADD COLUMN IF NOT EXISTS "workspace_id"     integer,
    ADD COLUMN IF NOT EXISTS "runbook_url"      text;
--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: every existing user gets a personal "default" workspace so migration
-- is non-breaking. Idempotent via slug uniqueness.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO "pgmonitoringtool"."workspaces" ("slug", "name", "plan")
    VALUES ('default', 'Default workspace', 'free')
    ON CONFLICT (slug) DO NOTHING;
--> statement-breakpoint
