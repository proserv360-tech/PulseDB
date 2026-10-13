// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/samlService.js
 * ───────────────────────
 * SAML 2.0 SP-initiated SSO for PulseDB.
 *
 * This module intentionally relies on the battle-tested `@node-saml/node-saml`
 * package rather than hand-rolling XML/crypto. Install with:
 *   npm install @node-saml/node-saml
 *
 * Supports multi-tenant configuration: each workspace can configure its own
 * Identity Provider (Okta, Entra ID / Azure AD, Google Workspace, OneLogin,
 * JumpCloud, …) via the `saml_configs` table.
 *
 * Flow:
 *   1. User hits /api/saml/:workspace/login — we build an AuthnRequest and
 *      redirect to the IdP's SSO URL.
 *   2. IdP posts SAMLResponse back to /api/saml/:workspace/acs.
 *   3. We validate signatures, extract the NameID / email / group claims,
 *      find-or-create the user, upsert workspace membership, mint a JWT,
 *      and 302 to the frontend with the session token.
 */

import crypto from 'node:crypto';
import { query } from '../db.js';
import { encryptSecret, decryptSecret } from './encryptionService.js';

// Lazy-loaded so the dependency is only required when SAML is actually used.
let _SAML = null;
async function getSAML() {
    if (_SAML) return _SAML;
    try {
        const mod = await import('@node-saml/node-saml');
        _SAML = mod.SAML || mod.default?.SAML || mod.default;
        return _SAML;
    } catch (err) {
        throw new Error(
            'SAML support requires @node-saml/node-saml. ' +
                'Install with: npm install @node-saml/node-saml --workspace=backend'
        );
    }
}

/**
 * Build the node-saml options object for a given workspace.
 * Decrypts the SP private key on the fly; never caches it in memory beyond
 * the life of the request.
 */
async function buildSamlOptions(workspaceId, baseUrl) {
    const { rows } = await query(
        `SELECT entity_id, sso_url, slo_url, idp_cert, sp_private_key_enc,
                sp_cert, want_signed_response, want_signed_assertion,
                name_id_format
           FROM pgmonitoringtool.saml_configs
          WHERE workspace_id = $1 AND enabled = true`,
        [workspaceId]
    );
    if (!rows[0]) {
        const err = new Error(`SAML not configured for workspace ${workspaceId}`);
        err.status = 404;
        throw err;
    }
    const cfg = rows[0];
    const privateKey = cfg.sp_private_key_enc
        ? decryptSecret(cfg.sp_private_key_enc)
        : undefined;
    return {
        entryPoint: cfg.sso_url,
        logoutUrl: cfg.slo_url || undefined,
        issuer: cfg.entity_id,
        callbackUrl: `${baseUrl}/api/saml/${workspaceId}/acs`,
        idpCert: cfg.idp_cert,
        privateKey,
        signatureAlgorithm: 'sha256',
        digestAlgorithm: 'sha256',
        wantAuthnResponseSigned: cfg.want_signed_response,
        wantAssertionsSigned: cfg.want_signed_assertion,
        identifierFormat: cfg.name_id_format,
        // The Redis-backed cache that node-saml wants for replay protection
        // is overkill for mid-market tenants. We use the in-memory fallback;
        // swap in a real cache for horizontal scale.
        acceptedClockSkewMs: 60_000,
    };
}

/**
 * Create or update a SAML config. Never returns the decrypted private key.
 */
export async function upsertSamlConfig(workspaceId, input, actingUserId) {
    const {
        entityId,
        ssoUrl,
        sloUrl = null,
        idpCert,
        spPrivateKey = null,
        spCert = null,
        wantSignedResponse = true,
        wantSignedAssertion = true,
        nameIdFormat = 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        defaultRole = 'viewer',
        attributeMapping = {},
        enabled = false,
    } = input || {};

    // Minimal validation — the IdP cert and SSO URL are load-bearing.
    if (!entityId || !ssoUrl || !idpCert) {
        const err = new Error('entityId, ssoUrl, and idpCert are required');
        err.status = 400;
        throw err;
    }
    if (!['owner', 'admin', 'editor', 'viewer'].includes(defaultRole)) {
        const err = new Error(`Invalid defaultRole: ${defaultRole}`);
        err.status = 400;
        throw err;
    }

    const privateKeyEnc = spPrivateKey ? encryptSecret(spPrivateKey) : null;

    await query(
        `INSERT INTO pgmonitoringtool.saml_configs
            (workspace_id, entity_id, sso_url, slo_url, idp_cert,
             sp_private_key_enc, sp_cert, want_signed_response,
             want_signed_assertion, name_id_format, default_role,
             attribute_mapping, enabled, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now())
         ON CONFLICT (workspace_id) DO UPDATE SET
            entity_id             = EXCLUDED.entity_id,
            sso_url               = EXCLUDED.sso_url,
            slo_url               = EXCLUDED.slo_url,
            idp_cert              = EXCLUDED.idp_cert,
            sp_private_key_enc    = COALESCE(EXCLUDED.sp_private_key_enc,
                                             saml_configs.sp_private_key_enc),
            sp_cert               = COALESCE(EXCLUDED.sp_cert, saml_configs.sp_cert),
            want_signed_response  = EXCLUDED.want_signed_response,
            want_signed_assertion = EXCLUDED.want_signed_assertion,
            name_id_format        = EXCLUDED.name_id_format,
            default_role          = EXCLUDED.default_role,
            attribute_mapping     = EXCLUDED.attribute_mapping,
            enabled               = EXCLUDED.enabled,
            updated_at            = now()`,
        [
            workspaceId,
            entityId,
            ssoUrl,
            sloUrl,
            idpCert,
            privateKeyEnc,
            spCert,
            wantSignedResponse,
            wantSignedAssertion,
            nameIdFormat,
            defaultRole,
            attributeMapping,
            enabled,
        ]
    );
    return { ok: true };
}

/**
 * Generate an AuthnRequest URL. The caller redirects the browser there.
 */
export async function buildAuthnRequestUrl(workspaceId, baseUrl, relayState) {
    const SAML = await getSAML();
    const options = await buildSamlOptions(workspaceId, baseUrl);
    const saml = new SAML(options);
    return saml.getAuthorizeUrlAsync(relayState, undefined, {});
}

/**
 * Validate a SAMLResponse posted to the ACS endpoint and return the claims.
 * Throws with status 401 on any signature/timing failure.
 */
export async function validateSamlResponse(workspaceId, baseUrl, body) {
    const SAML = await getSAML();
    const options = await buildSamlOptions(workspaceId, baseUrl);
    const saml = new SAML(options);
    try {
        const { profile } = await saml.validatePostResponseAsync(body);
        return profile;
    } catch (err) {
        const e = new Error(`SAML assertion rejected: ${err.message}`);
        e.status = 401;
        throw e;
    }
}

/**
 * Map the raw SAML profile into our canonical user shape using the workspace
 * attribute mapping, then find-or-create the user, upsert membership, and
 * return { userId, email, role }.
 */
export async function provisionUserFromAssertion(workspaceId, profile) {
    const { rows: cfgRows } = await query(
        `SELECT default_role, attribute_mapping
           FROM pgmonitoringtool.saml_configs
          WHERE workspace_id = $1`,
        [workspaceId]
    );
    const cfg = cfgRows[0] || {};
    const mapping = cfg.attribute_mapping || {};
    const emailKey = mapping.email || 'email';
    const nameKey = mapping.name || 'displayName';
    const groupsKey = mapping.groups || 'groups';

    const email =
        profile[emailKey] ||
        profile.email ||
        profile.nameID ||
        null;
    if (!email) {
        const err = new Error('Assertion did not include an email claim');
        err.status = 400;
        throw err;
    }
    const name = profile[nameKey] || email.split('@')[0];
    const groups = profile[groupsKey];
    const role = resolveRoleFromGroups(groups, cfg.default_role || 'viewer');

    // Find or create the PulseDB user.
    const existing = await query(
        `SELECT id FROM pgmonitoringtool.users WHERE lower(email) = lower($1)`,
        [email]
    );
    let userId;
    if (existing.rows[0]) {
        userId = existing.rows[0].id;
    } else {
        // Random placeholder password — the user will never use password
        // login because they're SSO-only. We still respect the NOT NULL
        // column if it exists.
        const passwordHash = crypto.randomBytes(32).toString('hex');
        const ins = await query(
            `INSERT INTO pgmonitoringtool.users
                (username, email, password_hash, role, status, created_at)
             VALUES ($1, $2, $3, $4, 'active', now())
             RETURNING id`,
            [email, email, passwordHash, role]
        );
        userId = ins.rows[0].id;
    }

    await query(
        `INSERT INTO pgmonitoringtool.workspace_members
            (workspace_id, user_id, role, created_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [workspaceId, userId, role]
    );

    return { userId, email, role };
}

/**
 * Map an IdP-provided group list onto a PulseDB role.
 * Convention:
 *   pulsedb-owner   → owner
 *   pulsedb-admin   → admin
 *   pulsedb-editor  → editor
 *   (anything else / missing) → fallback
 */
function resolveRoleFromGroups(groups, fallback) {
    if (!groups) return fallback;
    const list = Array.isArray(groups) ? groups : [groups];
    const lc = list.map(g => String(g).toLowerCase());
    if (lc.includes('pulsedb-owner')) return 'owner';
    if (lc.includes('pulsedb-admin')) return 'admin';
    if (lc.includes('pulsedb-editor')) return 'editor';
    return fallback;
}
