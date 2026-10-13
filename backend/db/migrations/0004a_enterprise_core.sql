-- 0004a_enterprise_core.sql
-- ---------------------------------------------------------------------------
-- Organizations, members, licenses and the IP allow-list. 0005 and 0006 add
-- foreign keys to pgmonitoringtool.organizations, but these tables were only
-- created by scripts/migrate-enterprise.ts, which nothing ran before the file
-- migrations - so a fresh database failed at 0005. Same DDL as that script,
-- all IF NOT EXISTS, so it is a no-op where migrate-enterprise already ran.
-- ---------------------------------------------------------------------------

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
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS pgmonitoringtool.org_members (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES pgmonitoringtool.organizations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES pgmonitoringtool.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    invited_by INTEGER REFERENCES pgmonitoringtool.users(id),
    UNIQUE(org_id, user_id)
);
--> statement-breakpoint

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
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS pgmonitoringtool.ip_whitelist (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES pgmonitoringtool.organizations(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    cidr_mask INTEGER,
    label VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    added_by INTEGER REFERENCES pgmonitoringtool.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, ip_address)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS pgmonitoringtool.ip_whitelist_blocked_attempts (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES pgmonitoringtool.organizations(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    user_agent TEXT,
    endpoint VARCHAR(500),
    blocked_at TIMESTAMPTZ DEFAULT NOW()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_org_members_org ON pgmonitoringtool.org_members(org_id);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_org_members_user ON pgmonitoringtool.org_members(user_id);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_licenses_org ON pgmonitoringtool.licenses(org_id);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_licenses_key ON pgmonitoringtool.licenses(license_key);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_ip_whitelist_org ON pgmonitoringtool.ip_whitelist(org_id);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_ip_blocked_org ON pgmonitoringtool.ip_whitelist_blocked_attempts(org_id);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_ip_blocked_time ON pgmonitoringtool.ip_whitelist_blocked_attempts(blocked_at);
