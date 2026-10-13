// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
// ==========================================================================
//  PulseDB — Enterprise Features Migration  (scripts/migrate-enterprise.js)
//  Run once: npm run migrate:enterprise
//  Or: node scripts/migrate-enterprise.js
// ==========================================================================

import 'dotenv/config';
import { pool } from '../db.js';

const migrations = [

    // ── Organizations table for multi-tenancy ──
    `
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
    )
    `,

    // ── Organization members junction table ──
    `
    CREATE TABLE IF NOT EXISTS pgmonitoringtool.org_members (
        id SERIAL PRIMARY KEY,
        org_id INTEGER NOT NULL REFERENCES pgmonitoringtool.organizations(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES pgmonitoringtool.users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        invited_by INTEGER REFERENCES pgmonitoringtool.users(id),
        UNIQUE(org_id, user_id)
    )
    `,

    // ── Licenses table ──
    `
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
    )
    `,

    // ── IP Whitelist table ──
    `
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
    )
    `,

    // ── IP Whitelist blocked attempts log ──
    `
    CREATE TABLE IF NOT EXISTS pgmonitoringtool.ip_whitelist_blocked_attempts (
        id SERIAL PRIMARY KEY,
        org_id INTEGER NOT NULL REFERENCES pgmonitoringtool.organizations(id) ON DELETE CASCADE,
        ip_address INET NOT NULL,
        user_agent TEXT,
        endpoint VARCHAR(500),
        blocked_at TIMESTAMPTZ DEFAULT NOW()
    )
    `,

    // ── Index on org_members by organization ──
    `CREATE INDEX IF NOT EXISTS idx_org_members_org ON pgmonitoringtool.org_members(org_id)`,

    // ── Index on org_members by user ──
    `CREATE INDEX IF NOT EXISTS idx_org_members_user ON pgmonitoringtool.org_members(user_id)`,

    // ── Index on licenses by organization ──
    `CREATE INDEX IF NOT EXISTS idx_licenses_org ON pgmonitoringtool.licenses(org_id)`,

    // ── Index on licenses by license key ──
    `CREATE INDEX IF NOT EXISTS idx_licenses_key ON pgmonitoringtool.licenses(license_key)`,

    // ── Index on IP whitelist by organization ──
    `CREATE INDEX IF NOT EXISTS idx_ip_whitelist_org ON pgmonitoringtool.ip_whitelist(org_id)`,

    // ── Index on blocked attempts by organization ──
    `CREATE INDEX IF NOT EXISTS idx_ip_blocked_org ON pgmonitoringtool.ip_whitelist_blocked_attempts(org_id)`,

    // ── Index on blocked attempts by time ──
    `CREATE INDEX IF NOT EXISTS idx_ip_blocked_time ON pgmonitoringtool.ip_whitelist_blocked_attempts(blocked_at)`,

];

async function migrateEnterprise() {
    console.log('[migrate-enterprise] Connecting to database...');
    const client = await pool.connect();
    try {
        // Start transaction
        await client.query('BEGIN');
        console.log('[migrate-enterprise] Transaction started');

        for (let i = 0; i < migrations.length; i++) {
            const sql = migrations[i].trim();
            const preview = sql.split('\n')[0].slice(0, 60);
            console.log(`[migrate-enterprise] Running migration ${i + 1}/${migrations.length}: ${preview}...`);
            await client.query(sql);
            console.log(`[migrate-enterprise] ✓ Migration ${i + 1} complete`);
        }

        // Commit transaction
        await client.query('COMMIT');
        console.log('[migrate-enterprise] Transaction committed successfully.');
        console.log('[migrate-enterprise] All enterprise migrations applied successfully.');
        process.exit(0);
    } catch (err) {
        console.error('[migrate-enterprise] ERROR:', err.message);
        console.error('[migrate-enterprise] Rolling back transaction...');
        try {
            await client.query('ROLLBACK');
            console.error('[migrate-enterprise] Transaction rolled back.');
        } catch (rollbackErr) {
            console.error('[migrate-enterprise] Failed to rollback:', rollbackErr.message);
        }
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

migrateEnterprise();
