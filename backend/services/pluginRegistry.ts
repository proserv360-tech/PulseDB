// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/pluginRegistry.js
 * ──────────────────────────
 * Plugin manifest validation + registry access.
 *
 * Plugins never execute server-side code in the FATHOM host — they contribute
 * declarative dashboards, alert templates, and front-end panel bundles. This
 * makes the supply-chain small and auditable.
 */

import { query } from '../db.js';

// ─────────────────────────────────────────────────────────────────────────────
// Manifest validation (zero deps — mirrors shared/types/plugin.ts)
// ─────────────────────────────────────────────────────────────────────────────
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const VALID_CAPS = new Set(['dashboard', 'panel', 'alert-template', 'metric-source']);

export function validateManifest(m) {
    const errors = [];
    if (!m || typeof m !== 'object') {
        return { ok: false, errors: ['manifest must be an object'] };
    }
    if (!SLUG.test(m.slug || '')) errors.push('slug must be kebab-case, ≤64 chars');
    if (!SEMVER.test(m.version || '')) errors.push('version must be semver');
    if (!m.name) errors.push('name is required');
    if (!m.minFathomApi) errors.push('minFathomApi is required');
    if (!Array.isArray(m.capabilities) || m.capabilities.length === 0) {
        errors.push('capabilities must be a non-empty array');
    } else {
        for (const c of m.capabilities) {
            if (!VALID_CAPS.has(c)) errors.push(`unknown capability: ${c}`);
        }
    }
    if (!Array.isArray(m.contributions)) errors.push('contributions must be an array');
    else m.contributions.forEach((c, i) => validateContribution(c, i, errors));
    return { ok: errors.length === 0, errors };
}

function validateContribution(c, i, errors) {
    if (!c || typeof c !== 'object') { errors.push(`contributions[${i}] must be object`); return; }
    if (!c.type) { errors.push(`contributions[${i}].type missing`); return; }
    if (c.type === 'dashboard') {
        if (!SLUG.test(c.slug || '')) errors.push(`contributions[${i}].slug invalid`);
        if (!c.definition?.layout) errors.push(`contributions[${i}].definition.layout required`);
    } else if (c.type === 'alert-template') {
        if (!c.expression) errors.push(`contributions[${i}].expression required`);
        if (!['info','warning','error','critical'].includes(c.severity))
            errors.push(`contributions[${i}].severity invalid`);
    } else if (c.type === 'panel') {
        if (!SLUG.test(c.slug || '')) errors.push(`contributions[${i}].slug invalid`);
        try {
            const u = new URL(c.entryUrl);
            if (u.protocol !== 'https:') errors.push(`contributions[${i}].entryUrl must be https`);
        } catch { errors.push(`contributions[${i}].entryUrl must be a valid URL`); }
        if (!Array.isArray(c.supportedEngines))
            errors.push(`contributions[${i}].supportedEngines required`);
    } else {
        errors.push(`contributions[${i}].type unknown: ${c.type}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry operations
// ─────────────────────────────────────────────────────────────────────────────
export async function publishPlugin(manifest, publishedBy) {
    const v = validateManifest(manifest);
    if (!v.ok) {
        const err = new Error('invalid manifest');
        err.status = 400;
        err.details = v.errors;
        throw err;
    }
    const { slug, version, name, description = '', author = null } = manifest;
    const { rows } = await query(
        `INSERT INTO pgmonitoringtool.plugins
            (slug, name, description, author, version, manifest, published_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            author = EXCLUDED.author,
            version = EXCLUDED.version,
            manifest = EXCLUDED.manifest,
            updated_at = now()
         RETURNING id, slug, version`,
        [slug, name, description, author, version, manifest, publishedBy || null]
    );
    return rows[0];
}

export async function listPublicPlugins({ search = '', limit = 50 } = {}) {
    const { rows } = await query(
        `SELECT id, slug, name, description, author, version, verified,
                downloads, updated_at
           FROM pgmonitoringtool.plugins
          WHERE ($1 = '' OR name ILIKE $2 OR description ILIKE $2 OR slug ILIKE $2)
          ORDER BY verified DESC, downloads DESC, updated_at DESC
          LIMIT $3`,
        [search || '', `%${search || ''}%`, Math.min(limit, 200)]
    );
    return rows;
}

export async function installPlugin({ workspaceId, pluginSlug, settings = {}, installedBy }) {
    const { rows } = await query(
        `SELECT id, version FROM pgmonitoringtool.plugins WHERE slug = $1`,
        [pluginSlug]
    );
    if (!rows[0]) { const e = new Error('plugin not found'); e.status = 404; throw e; }
    const pluginId = rows[0].id;
    const version = rows[0].version;
    await query(
        `INSERT INTO pgmonitoringtool.workspace_plugins
            (workspace_id, plugin_id, version, settings, installed_by)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (workspace_id, plugin_id) DO UPDATE SET
            version = EXCLUDED.version,
            settings = EXCLUDED.settings,
            enabled = true`,
        [workspaceId, pluginId, version, settings, installedBy || null]
    );
    await query(
        `UPDATE pgmonitoringtool.plugins SET downloads = downloads + 1 WHERE id = $1`,
        [pluginId]
    );
    return { ok: true, pluginId, version };
}

export async function listWorkspacePlugins(workspaceId) {
    const { rows } = await query(
        `SELECT p.slug, p.name, p.version, wp.settings, wp.enabled,
                p.manifest -> 'contributions' AS contributions
           FROM pgmonitoringtool.workspace_plugins wp
           JOIN pgmonitoringtool.plugins p ON p.id = wp.plugin_id
          WHERE wp.workspace_id = $1
          ORDER BY p.name`,
        [workspaceId]
    );
    return rows;
}
