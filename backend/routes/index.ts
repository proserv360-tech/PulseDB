// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Mounts the feature route modules (routes/*Routes.ts) at /api and /api/v1.
// Extracted from server.ts.

import jwt from 'jsonwebtoken';
import { getUserActiveSchema } from '../core/activeSelection.js';
import { pool } from '../core/adminPool.js';
import { alerts, emailService } from '../core/alerting.js';
import { authenticate } from '../core/auth.js';
import { CONFIG } from '../core/config.js';
import { getMongoClient, getPool, openAdapter, reqPool, resolveConnection } from '../core/connectionPools.js';
import { getConnections } from '../core/connectionStore.js';
import { cache, cached } from '../core/responseCache.js';
import { validateExplainQuery } from '../core/sqlGuard.js';
import { requireRole, requireScreen } from '../middleware/authenticate.js';
import { ipAllowListMiddleware } from '../middleware/ipAllowList.js';
import { tenantIsolation } from '../middleware/tenantIsolation.js';
import { log } from '../services/logger.js';
import { renderMetrics as renderPromMetrics } from '../services/promScrapeService.js';
import { authenticateSdkKey as sdkKeyAuth } from '../services/sdkService.js';
import { resolveSlackUser, sendSlackMessage, verifySlackSignature } from '../services/slackService.js';
import adminRoutes from './adminRoutes.js';
import advisorRoutes from './advisorRoutes.js';
import agentFindingsRoutes from './agentFindingsRoutes.js';
import aiMonitoringRoutes from './aiMonitoringRoutes.js';
import aiQueryRoutes from './aiQueryRoutes.js';
import alertDslRoutes from './alertDslRoutes.js';
import alertsManagementRoutes from './alertsManagementRoutes.js';
import anomalyRoutes from './anomalyRoutes.js';
import auditRoutes from './auditRoutes.js';
import agentRelayRoutes from './agentRelayRoutes.js';
import autoExplainRoutes from './autoExplainRoutes.js';
import backupRoutes from './backupRoutes.js';
import bloatRoutes from './bloatRoutes.js';
import capacityRoutes from './capacityRoutes.js';
import cloudInsightsRoutes from './cloudInsightsRoutes.js';
import copilotRoutes from './copilotRoutes.js';
import cronRoutes from './cronRoutes.js';
import dbaTaskRoutes from './dbaTaskRoutes.js';
import engineConsoleRoutes from './engineConsoleRoutes.js';
import enterpriseUIRoutes from './enterpriseUIRoutes.js';
import erdRoutes from './erdRoutes.js';
import explainRoutes from './explainRoutes.js';
import feedbackRoutes from './feedbackRoutes.js';
import governanceRoutes from './governanceRoutes.js';
import incidentRoutes from './incidentRoutes.js';
import integrationsRoutes from './integrationsRoutes.js';
import k8sRoutes from './k8sRoutes.js';
import kmsRoutes from './kmsRoutes.js';
import metricsRoutes from './metricsRoutes.js';
import mongoRoutes from './mongoRoutes.js';
import mysqlRoutes from './mysqlRoutes.js';
import observabilityIngestRoutes from './observabilityIngestRoutes.js';
import observabilityRoutes from './observabilityRoutes.js';
import otelRoutes from './otelRoutes.js';
import otlpTraceRoutes from './otlpTraceRoutes.js';
import overviewRoutes from './overviewRoutes.js';
import performanceRoutes from './performanceRoutes.js';
import pluginRoutes from './pluginRoutes.js';
import queryAdvisorRoutes from './queryAdvisorRoutes.js';
import reliabilityRoutes from './reliabilityRoutes.js';
import reportRoutes from './reportRoutes.js';
import retentionRoutes from './retentionRoutes.js';
import samlRoutes from './samlRoutes.js';
import schemaDiffRoutes from './schemaDiffRoutes.js';
import schemaRoutes from './schemaRoutes.js';
import schemaTrackingRoutes from './schemaTrackingRoutes.js';
import scimRoutes from './scimRoutes.js';
import sdkRoutes from './sdkRoutes.js';
import sessionRoutes from './sessionRoutes.js';
import statusPageRoutes from './statusPageRoutes.js';
import storageAdvisorRoutes from './storageAdvisorRoutes.js';
import syntheticRoutes from './syntheticRoutes.js';
import terraformRoutes from './terraformRoutes.js';
import userRoutes from './userRoutes.js';
import waitEventsRoutes from './waitEventsRoutes.js';
import sqlServerRoutes from './sqlServerRoutes.js';
import agentPackageRoutes from './agentPackageRoutes.js';
import workbenchRoutes from './workbenchRoutes.js';

export default function mountFeatureRoutes(app) {
    // ─────────────────────────────────────────────────────────────────────────────
    // API VERSION HEADER — all responses include the current API version
    // ─────────────────────────────────────────────────────────────────────────────
    app.use('/api', (req, res, next) => {
        res.set('X-API-Version', '1');
        next();
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // MODULAR ROUTES — mounted at both /api and /api/v1 for forward-compatibility
    // ─────────────────────────────────────────────────────────────────────────────
    const modularMounts = ['/api', '/api/v1'];

    // ── IP allow-list gate (runs before every /api route) ───────────────────────
    // Resolves the active workspace id from the request itself (header, query,
    // or default), then fails closed when a CIDR allow-list is configured and
    // the client's IP does not match. See middleware/ipAllowList.js.
    app.use('/api', ipAllowListMiddleware());

    // ── Prometheus scrape endpoint. Public (no auth) by convention — protect
    //    at the network layer (NetworkPolicy, service mesh). Content-Type must
    //    match the Prom text format: `text/plain; version=0.0.4`.
    app.get('/metrics', (_req, res) => {
        res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.send(renderPromMetrics());
    });

    // ── SCIM 2.0 (mounted at /scim/v2, dedicated Bearer-token auth) ──────────────
    app.use(scimRoutes(pool));

    for (const prefix of modularMounts) {
        app.use(prefix, userRoutes(pool, authenticate, requireScreen, requireRole));
        app.use(prefix, sessionRoutes(pool, authenticate, requireScreen, requireRole));
        app.use(prefix, auditRoutes(pool, authenticate, requireScreen));
        app.use(prefix, otelRoutes(pool, authenticate, requireRole));
        app.use(prefix, retentionRoutes(pool, authenticate, requireRole));
        app.use(prefix, aiQueryRoutes(pool, authenticate));
        app.use(prefix, k8sRoutes(pool, authenticate));
        app.use(prefix, statusPageRoutes(pool, authenticate, requireRole));
        app.use(prefix, terraformRoutes(pool, authenticate, requireRole));
        app.use(prefix, dbaTaskRoutes(pool, authenticate, { requireScreen, log }));
        app.use(prefix, feedbackRoutes(pool, authenticate, { requireScreen, log }));
        app.use(prefix, aiMonitoringRoutes(pool, authenticate));
        app.use(prefix, agentFindingsRoutes(pool, authenticate));
        app.use(prefix, schemaTrackingRoutes(pool, authenticate, reqPool, resolveConnection));
        app.use(prefix, queryAdvisorRoutes(pool, authenticate, reqPool));
        app.use(
            prefix,
            backupRoutes(pool, authenticate, (connectionId) => resolveConnection(connectionId, null)),
        );
        app.use(prefix, metricsRoutes(pool, authenticate));
        app.use(prefix, schemaRoutes(pool, authenticate, reqPool));
        app.use(prefix, observabilityRoutes(pool, authenticate, requireScreen));
        app.use(prefix, reportRoutes(pool, authenticate, requireScreen));

        // ── MySQL & MongoDB routes ────────────────────────────────────────────────
        app.use(prefix, sdkRoutes(pool, authenticate, requireScreen));

        // ── Enterprise UI routes (notifiers, redis, elasticsearch, anomaly, trace)
        //    Mounted under /api/enterprise — each handler is feature-gated via
        //    requireFeature(), so unlicensed tenants receive a uniform 403.
        app.use(`${prefix}/enterprise`, enterpriseUIRoutes(pool, authenticate, requireRole));

        // ── Roadmap routes (W1–W3) ────────────────────────────────────────────────
        //    Mounted at the same prefixes so they honour the /api and /api/v1
        //    contract. Each module carries its own RBAC via workspaceRbac.
        // samlRoutes factory signature: (pool, authenticate, requireRole, signJwt).
        // We inline signJwt as a thin wrapper over jsonwebtoken so the SAML ACS
        // endpoint can mint tokens with the same claims/audience/issuer as the
        // password login path above.
        const signJwt = (payload) =>
            jwt.sign(payload, CONFIG.JWT_SECRET, {
                expiresIn: CONFIG.JWT_EXPIRES_IN,
                audience: CONFIG.JWT_AUDIENCE,
                issuer: CONFIG.JWT_ISSUER,
            });
        app.use(prefix, samlRoutes(pool, authenticate, requireRole, signJwt));

        // ── Per-organization notification destinations (integration fan-out) ─
        //    Write operations require owner/admin role inside the org; reads
        //    require any org membership. Secrets are encrypted at rest and
        //    never returned in API responses.
        app.use(prefix, integrationsRoutes(pool, authenticate, tenantIsolation(pool)));

        app.use(prefix, explainRoutes(pool, authenticate));
        app.use(prefix, workbenchRoutes(pool, authenticate));
        app.use(prefix, advisorRoutes(pool, authenticate, getPool));
        app.use(prefix, schemaDiffRoutes(pool, authenticate, getPool));
        app.use(prefix, bloatRoutes(pool, authenticate, getPool));
        app.use(prefix, capacityRoutes(pool, authenticate, getPool));
        app.use(prefix, alertDslRoutes(pool, authenticate));
        app.use(prefix, anomalyRoutes(pool, authenticate));
        app.use(prefix, pluginRoutes(pool, authenticate));
        app.use(prefix, governanceRoutes(pool, authenticate));
        app.use(prefix, copilotRoutes(pool, authenticate, getPool));
        app.use(prefix, cloudInsightsRoutes(authenticate));
        app.use(prefix, otlpTraceRoutes(pool, authenticate));

        // ── Phase-5 gap-close routes ────────────────────────────────────────
        //    Observability ingest (OTLP logs, Sentry-shape errors, RUM beacon,
        //    Prom-compatible metrics push, GitHub/GitLab deploy markers).
        //    Carries its own `X-PulseDB-Ingest-Token` gate so SDKs can post
        //    without a user JWT; falls back to authenticate() when unset.
        // auto_explain ingest + Log Insights (recent, summary, plan regressions)
        app.use(prefix, autoExplainRoutes(pool, authenticate, sdkKeyAuth));
        // PulseDB Agent relay: lets this server reach databases only an agent can (x-sdk-key auth).
        app.use(prefix, agentRelayRoutes(pool, sdkKeyAuth, log));
        // "Connect another PC": downloadable agent with a fresh key (admin only).
        app.use(prefix, agentPackageRoutes(pool, authenticate, requireRole, log));
        //    Synthetic HTTP/TCP checks — CRUD + on-demand run.
        //    BYOK / KMS admin endpoints — provision, rotate, status.
        //    Schema ERD graph for the interactive viewer.

        // Extracted inline route groups
        // Incidents first: /api/slack/interactions mounts express.raw on itself,
        // and must not be shadowed by a later /slack/* handler.
        app.use('/api', incidentRoutes(pool, authenticate, verifySlackSignature, log));
        // Secret-authenticated, not session-authenticated — an external scheduler
        // has no session. See routes/cronRoutes.ts.
        app.use('/api', cronRoutes(pool, alerts, log));
        app.use('/api', overviewRoutes(pool, authenticate, cached, CONFIG, reqPool, log));
        app.use('/api', reliabilityRoutes(authenticate, reqPool, log, validateExplainQuery));
        app.use('/api', performanceRoutes(authenticate, reqPool, log, cached));
        app.use(
            '/api',
            alertsManagementRoutes(
                pool,
                authenticate,
                requireRole,
                requireScreen,
                alerts,
                emailService,
                sendSlackMessage,
                verifySlackSignature,
                resolveSlackUser,
                log,
                async (opts) => {
                    try {
                        const { runAgentSweep } = await import('../services/agentLoopService.js');
                        return runAgentSweep(opts);
                    } catch {
                        return null;
                    }
                },
                resolveConnection,
            ),
        );
        app.use('/api', adminRoutes(authenticate, cached, CONFIG, reqPool, cache, log));

        //    Unified engine command console (Redis / Cassandra CQL / DynamoDB
        //    PartiQL / T-SQL / Oracle / Snowflake / BigQuery / Redshift). Routes
        //    through the adapter factory; the auditService records each call.
        app.use(
            '',
            engineConsoleRoutes(
                pool,
                authenticate,
                requireRole,
                async (req, connectionId) => resolveConnection(connectionId, req.user?.id),
                openAdapter,
                // Active-schema getter: lets the console apply the user's schema
                // selection (Snowflake USE SCHEMA) before running their query.
                (req, connectionId) => getUserActiveSchema(req.user?.id, parseInt(connectionId, 10)),
            ),
        );

        // Engine-agnostic wait events — reuses the same connection + adapter
        // resolution as the engine console; capability gating happens in the service.
        app.use(
            '/api',
            waitEventsRoutes(
                authenticate,
                async (req, connectionId) => resolveConnection(connectionId, req.user?.id),
                openAdapter,
            ),
        );

        // SQL Server monitoring screens. Index fragmentation and buffer-pool
        // scans can take a while on big servers, hence the longer timeout.
        app.use(
            '/api',
            sqlServerRoutes(
                authenticate,
                async (req, connectionId) => resolveConnection(connectionId, req.user?.id),
                (connection) => openAdapter(connection, { requestTimeout: 30_000 }),
            ),
        );

        // Engine-agnostic reclaimable-storage advisor (MySQL InnoDB data_free;
        // supported:false elsewhere). Same connection + adapter resolution as wait events.
        app.use(
            '/api',
            storageAdvisorRoutes(
                authenticate,
                async (req, connectionId) => resolveConnection(connectionId, req.user?.id),
                openAdapter,
            ),
        );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ABSOLUTE-PATH ROUTERS — mounted at the root, deliberately outside the loop
    // ─────────────────────────────────────────────────────────────────────────────
    // These modules declare fully-qualified paths (`/api/mongodb/overview`,
    // `/otlp/v1/logs`) rather than the relative paths the other 49 modules use.
    // Mounting them at `prefix` concatenated a second `/api`, so every one of these
    // endpoints answered on `/api/api/…` and 404'd on the path the clients call —
    // 55 endpoints, including the whole MongoDB and MySQL tabs.
    //
    // They are mounted at '' instead of having their paths rewritten because the
    // absolute form is load-bearing for two of them: `/otlp/v1/logs` is fixed by
    // the OTLP spec and cannot live under /api, and the SDK posts errors to
    // `/api/v1/errors`. tests/gapClose.test.ts mounts these routers at the root and
    // asserts those exact paths, which is the clearest statement of intent.
    //
    // Note what this gives up: no `/api/v1` twin for these endpoints, since the
    // version lives inside their own path strings. Anything moved here needs its
    // versioned alias added by hand if it ever needs one.
    //
    // Middleware is unaffected — `app.use('/api', …)` gates match on the request
    // URL, not on where a router was mounted, so the IP allow-list and the
    // X-API-Version header still apply to every `/api/*` request below.
    app.use(mysqlRoutes(pool, authenticate, getPool, getConnections()));
    app.use(mongoRoutes(pool, authenticate, getMongoClient, getConnections()));
    app.use(observabilityIngestRoutes(pool, authenticate));
    app.use(syntheticRoutes(pool, authenticate));
    app.use(kmsRoutes(pool, authenticate, requireRole));
    app.use(erdRoutes(pool, authenticate, reqPool));
}
