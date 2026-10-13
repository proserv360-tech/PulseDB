// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/samlRoutes.js
 * ────────────────────
 * SAML 2.0 SP-initiated SSO endpoints. Mount with:
 *   app.use(prefix, samlRoutes(pool, authenticate, requireRole, signJwt));
 *
 * Endpoints:
 *   GET  /saml/:workspaceId/metadata   — SP metadata XML
 *   GET  /saml/:workspaceId/login      — begin AuthnRequest, redirect to IdP
 *   POST /saml/:workspaceId/acs        — assertion consumer, mints JWT
 *   GET  /saml/:workspaceId/config     — read config (admin only)
 *   PUT  /saml/:workspaceId/config     — upsert config (admin only)
 */

import { Router } from 'express';
import {
    buildAuthnRequestUrl,
    validateSamlResponse,
    provisionUserFromAssertion,
    upsertSamlConfig,
} from '../services/samlService.js';
import { query } from '../db.js';
import { writeAudit } from '../services/auditService.js';
import { swallowWith } from '../services/errorHandling.js';

export default function samlRoutes(pool, authenticate, requireRole, signJwt) {
    const router = Router();

    function baseUrl(req) {
        const proto = req.get('x-forwarded-proto') || req.protocol;
        const host = req.get('x-forwarded-host') || req.get('host');
        return `${proto}://${host}`;
    }

    // ── Metadata ─────────────────────────────────────────────────────────────
    router.get('/saml/:workspaceId/metadata', async (req, res) => {
        const wsId = Number(req.params.workspaceId);
        const { rows } = await query(
            `SELECT entity_id, sp_cert
               FROM pgmonitoringtool.saml_configs
              WHERE workspace_id = $1`,
            [wsId]
        );
        if (!rows[0]) return res.status(404).send('Not configured');
        const acs = `${baseUrl(req)}/api/saml/${wsId}/acs`;
        const xml = `<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
    entityID="${rows[0].entity_id}">
  <md:SPSSODescriptor AuthnRequestsSigned="true" WantAssertionsSigned="true"
      protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    ${rows[0].sp_cert ? `<md:KeyDescriptor use="signing"><ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:X509Data><ds:X509Certificate>${rows[0].sp_cert.replace(/-----(BEGIN|END) CERTIFICATE-----|\s/g, '')}</ds:X509Certificate></ds:X509Data></ds:KeyInfo></md:KeyDescriptor>` : ''}
    <md:AssertionConsumerService index="0" isDefault="true"
        Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
        Location="${acs}"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
        res.type('application/xml').send(xml);
    });

    // ── Begin AuthnRequest ───────────────────────────────────────────────────
    router.get('/saml/:workspaceId/login', async (req, res, next) => {
        try {
            const wsId = Number(req.params.workspaceId);
            const relayState = req.query.returnTo || '/';
            const url = await buildAuthnRequestUrl(wsId, baseUrl(req), relayState);
            res.redirect(302, url);
        } catch (err) {
            next(err);
        }
    });

    // ── Assertion Consumer Service ───────────────────────────────────────────
    router.post('/saml/:workspaceId/acs', async (req, res, next) => {
        try {
            const wsId = Number(req.params.workspaceId);
            const profile = await validateSamlResponse(wsId, baseUrl(req), req.body);
            const { userId, email, role } = await provisionUserFromAssertion(wsId, profile);

            const token = signJwt({
                sub: userId,
                email,
                workspaceId: wsId,
                workspaceRole: role,
                authMethod: 'saml',
            });

            await writeAudit({
                actor_id: userId,
                action: 'saml.login',
                target: `workspace:${wsId}`,
                details: { email, role },
            }).catch(swallowWith({ component: 'saml', op: 'writeAudit' }));

            const relay = (req.body.RelayState || '/').toString();
            const frontend = process.env.FRONTEND_URL || baseUrl(req);
            const sep = relay.includes('?') ? '&' : '?';
            res.redirect(302, `${frontend}${relay}${sep}sso_token=${encodeURIComponent(token)}`);
        } catch (err) {
            next(err);
        }
    });

    // ── Read SAML config (admin+) ────────────────────────────────────────────
    router.get(
        '/saml/:workspaceId/config',
        authenticate,
        requireRole('admin', 'owner', 'superadmin'),
        async (req, res, next) => {
            try {
                const wsId = Number(req.params.workspaceId);
                const { rows } = await query(
                    `SELECT entity_id, sso_url, slo_url, idp_cert, sp_cert,
                            want_signed_response, want_signed_assertion,
                            name_id_format, default_role, attribute_mapping,
                            enabled, updated_at
                       FROM pgmonitoringtool.saml_configs
                      WHERE workspace_id = $1`,
                    [wsId]
                );
                res.json({ config: rows[0] || null });
            } catch (err) {
                next(err);
            }
        }
    );

    // ── Upsert SAML config (admin+) ──────────────────────────────────────────
    router.put(
        '/saml/:workspaceId/config',
        authenticate,
        requireRole('admin', 'owner', 'superadmin'),
        async (req, res, next) => {
            try {
                const wsId = Number(req.params.workspaceId);
                const result = await upsertSamlConfig(wsId, req.body, req.user?.id);
                await writeAudit({
                    actor_id: req.user?.id,
                    action: 'saml.config.update',
                    target: `workspace:${wsId}`,
                    details: { enabled: !!req.body?.enabled },
                }).catch(swallowWith({ component: 'saml', op: 'writeAudit' }));
                res.json(result);
            } catch (err) {
                next(err);
            }
        }
    );

    return router;
}
