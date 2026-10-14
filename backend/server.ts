// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
import 'dotenv/config';
import cors from 'cors';
import { randomUUID } from 'crypto';
import express from 'express';
import fs from 'fs/promises';
import http from 'http';
import { loadUserActiveConnections, loadUserActiveDatabases, loadUserActiveSchemas } from './core/activeSelection.js';
import { pool } from './core/adminPool.js';
import { alerts } from './core/alerting.js';
import { authenticate } from './core/auth.js';
import { startBackgroundJobs } from './core/backgroundJobs.js';
import { CONFIG, IS_PROD } from './core/config.js';
import { connectionPools, mongoClients } from './core/connectionPools.js';
import { getConnections, initConnections } from './core/connectionStore.js';
import { attachWebSocket } from './core/websocket.js';
import { requireScreen } from './middleware/authenticate.js';
import { registerErrorHandlers } from './middleware/errorHandlers.js';
import { hipaaMiddleware } from './middleware/hipaaMode.js';
import { csrfProtection, rateLimiter, securityHeaders } from './middleware/httpSecurity.js';
import { pgOnlyGuard } from './middleware/pgOnlyGuard.js';
import mountFeatureRoutes from './routes/index.js';
import registerAiProxyRoutes from './routes/platform/aiProxyRoutes.js';
import registerAlertRoutes from './routes/platform/alertRoutes.js';
import registerAuthRoutes from './routes/platform/authRoutes.js';
import registerCloudwatchRoutes from './routes/platform/cloudwatchRoutes.js';
import registerConnectionRoutes from './routes/platform/connectionRoutes.js';
import registerFleetHealthRoutes from './routes/platform/fleetHealthRoutes.js';
import registerHealthRoutes from './routes/platform/healthRoutes.js';
import registerSqlConsoleRoutes from './routes/platform/sqlConsoleRoutes.js';
import registerAdminDbRoutes from './routes/postgres/adminDbRoutes.js';
import registerAlertCorrelationRoutes from './routes/postgres/alertCorrelationRoutes.js';
import registerBackupStatusRoutes from './routes/postgres/backupStatusRoutes.js';
import registerBloatAnalysisRoutes from './routes/postgres/bloatAnalysisRoutes.js';
import registerCheckpointRoutes from './routes/postgres/checkpointRoutes.js';
import registerIndexRoutes from './routes/postgres/indexRoutes.js';
import registerLogAnalysisRoutes from './routes/postgres/logAnalysisRoutes.js';
import registerMaintenanceRoutes from './routes/postgres/maintenanceRoutes.js';
import registerObservabilityHubRoutes from './routes/postgres/observabilityHubRoutes.js';
import registerOptimizerRoutes from './routes/postgres/optimizerRoutes.js';
import registerPlanRegressionRoutes from './routes/postgres/planRegressionRoutes.js';
import registerReplicationRoutes from './routes/postgres/replicationRoutes.js';
import registerResourceRoutes from './routes/postgres/resourceRoutes.js';
import registerSecurityRoutes from './routes/postgres/securityRoutes.js';
import registerTableRoutes from './routes/postgres/tableRoutes.js';
import repoRoutes from './routes/repoRoutes.js';
import { startConnectionHealthMonitor } from './services/connectionHealthService.js';
import { validateEncryptionConfig } from './services/encryptionService.js';
import { httpLogger, log } from './services/logger.js';
import { requestCounter as promRequestCounter } from './services/promScrapeService.js';
import { initSentry } from './services/sentry.js';
import { closeAll as closeAllTunnels } from './services/sshTunnel.js';
import { checkEncryptionConfig } from './services/systemDiagnostics.js';

// ─────────────────────────────────────────────────────────────────────────────
// PulseDB API server — bootstrap only.
//
// Shared state and helpers live in core/ (config, pools, connection store,
// auth, alerting); HTTP middleware in middleware/; route handlers in
// routes/platform (control plane), routes/postgres (Postgres monitoring) and
// the feature modules mounted by routes/index.ts.
//
// Registration ORDER matters: Express matches in the order handlers are added,
// and the /api middlewares (version header, IP allow-list, pgOnlyGuard) only
// apply to routes registered after them. Keep new routes in the right slot.
// ─────────────────────────────────────────────────────────────────────────────
initSentry();

// ─────────────────────────────────────────────────────────────────────────────
// EXPRESS APP
// ─────────────────────────────────────────────────────────────────────────────
const app = express();
// On Vercel serverless, Express is invoked directly — no need for an HTTP server.
// Only create the raw server for local/Docker/Railway where we need WebSocket + listen().
const server = process.env.VERCEL !== '1' ? http.createServer(app) : null;

app.use(
    cors({
        origin: (origin, cb) => {
            if (!origin) return cb(null, true);
            if (CONFIG.CORS_ORIGINS.includes(origin)) return cb(null, true);
            cb(new Error(`CORS: origin '${origin}' not allowed`));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Org-Id'],
        exposedHeaders: ['X-Cache', 'X-Request-Id'],
    }),
);
app.use(securityHeaders);

app.use(csrfProtection);

app.use((req, res, next) => {
    req.id = req.headers['x-request-id'] || randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
});

// ── Prometheus request counter — counts every finished response by
//    method + status. Feeds the /metrics scrape endpoint below.
app.use(promRequestCounter());

// ── HIPAA mode middleware — activated only when HIPAA_MODE=true.
//    When inactive, returns a no-op with zero per-request cost.
app.use(hipaaMiddleware({ log }));

// ── Slack routes need the raw bytes, and must be mounted BEFORE express.json.
//    Slack signs `v0:<timestamp>:<raw body>`. Any parser that reads the stream
//    and re-serialises it changes those bytes, and the signature can never be
//    reproduced afterwards — no matter how correct the signing secret is.
//
//    /api/slack/interactions mounts its own express.raw() inside
//    routes/incidentRoutes.ts, so it is deliberately not listed here. These two
//    had no raw parser at all: /slack/commands assumed one was mounted here and
//    /slack/events expects req.body to be a Buffer, so both fell back to
//    JSON.stringify(req.body) and failed verification every time.
//
//    On Vercel, api/index.js has usually already attached req.rawBody and set
//    req._body, in which case express.raw() sees the flag and skips — mounting
//    it twice is harmless.
app.use(['/api/slack/commands', '/api/slack/events'], express.raw({ type: '*/*', limit: '256kb' }));

// PulseDB Agent job results carry query rows; the agent caps them below this
// (Vercel's request body limit is 4.5 MB). Parsed here, the global parser skips them.
app.use(['/api/agent/jobs', '/api/v1/agent/jobs'], express.json({ limit: '4mb' }));
app.use(express.json({ limit: '100kb' }));
app.use(express.text({ limit: '100kb' }));
app.use(rateLimiter);

// ── Structured request logging (pino-http). Replaces the previous
//    dev-only inline logger; logs all environments with level by status.
app.use(httpLogger());

// Auth and /health are registered before the /api middlewares in
// mountFeatureRoutes, so the IP allow-list and X-API-Version header do not
// apply to them (same as before the split).
registerAuthRoutes(app);
registerHealthRoutes(app);

mountFeatureRoutes(app);
startBackgroundJobs();

// ── Postgres-only endpoints below return empty results for other engines ────
app.use('/api', pgOnlyGuard);

registerSqlConsoleRoutes(app);
app.use('/api/repo', authenticate, requireScreen('repository'), repoRoutes);
registerConnectionRoutes(app);
registerFleetHealthRoutes(app);
registerReplicationRoutes(app);
registerBloatAnalysisRoutes(app);
registerPlanRegressionRoutes(app);
registerLogAnalysisRoutes(app);
registerCloudwatchRoutes(app);
registerAlertCorrelationRoutes(app);
registerCheckpointRoutes(app);
registerBackupStatusRoutes(app);
registerTableRoutes(app);
registerMaintenanceRoutes(app);
registerResourceRoutes(app);
registerSecurityRoutes(app);
registerAdminDbRoutes(app);
registerAlertRoutes(app);
registerIndexRoutes(app);
registerAiProxyRoutes(app);
registerObservabilityHubRoutes(app);
registerOptimizerRoutes(app);

if (server) attachWebSocket(server);
registerErrorHandlers(app);

// Assigned in startup(); kept for parity with the alert engine's lifecycle.
let connectionHealth = null;

// ─────────────────────────────────────────────────────────────────────────────
// STARTUP
// ─────────────────────────────────────────────────────────────────────────────
async function startup() {
    try {
        // ── Preflight: refuse to boot with a misconfigured environment ─────
        // Previously, a missing ENCRYPTION_KEY produced a quiet WARN at
        // startup and then every POST /api/connections threw an opaque 500.
        // Fail loudly and early instead so the operator sees the real issue
        // on boot, not hours later from a user-facing error report.
        const encCheck = checkEncryptionConfig();
        if (!encCheck.ok) {
            const banner =
                '\n' +
                '━'.repeat(72) +
                '\n' +
                `  PulseDB MISCONFIGURED — ${encCheck.code}\n` +
                `  ${encCheck.hint}\n` +
                '━'.repeat(72);
            if (IS_PROD && process.env.PULSEDB_ALLOW_DEGRADED_BOOT !== 'true') {
                console.error(banner);
                log(
                    'ERROR',
                    'Refusing to start in production without ENCRYPTION_KEY. ' +
                        'Set PULSEDB_ALLOW_DEGRADED_BOOT=true to override (not recommended).',
                );
                process.exit(78); // EX_CONFIG
            }
            console.warn(banner);
            log('WARN', 'Booting in degraded mode — connection CRUD will return 503 until resolved.', {
                code: encCheck.code,
            });
        } else {
            try {
                validateEncryptionConfig();
                log('INFO', 'Encryption self-test passed (AES-256-GCM)');
            } catch (encErr) {
                log('ERROR', 'Encryption self-test failed despite config present: ' + encErr.message);
                if (IS_PROD && process.env.PULSEDB_ALLOW_DEGRADED_BOOT !== 'true') process.exit(78);
            }
        }

        // Initialise connections table and warm the in-memory cache
        await initConnections();
        // Per-user active connections are resolved on-demand via getUserActiveConnectionId.
        // No global default needed at startup — each user gets their own active connection
        // resolved from their isDefault connection or first connection on first request.
        log('INFO', `Loaded ${getConnections().length} connection(s) from database`);

        // ── Ensure additional schema objects exist ────────────────────────
        if (pool) {
            // 1. retention_policies table (used by retentionService)
            try {
                await pool.query(`
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
                    )
                `);
                // Seed a default policy row if none exists
                await pool.query(`
                    INSERT INTO pgmonitoringtool.retention_policies (org_id)
                    VALUES (1)
                    ON CONFLICT (org_id) DO NOTHING
                `);
                log('INFO', 'retention_policies table ready');
            } catch (e) {
                log('WARN', 'Could not ensure retention_policies table', { error: e.message });
            }

            // 2. resource_type column on audit_log (used by auditService)
            try {
                await pool.query(`
                    ALTER TABLE pgmonitoringtool.audit_log
                    ADD COLUMN IF NOT EXISTS resource_type TEXT DEFAULT NULL
                `);
                log('INFO', 'audit_log.resource_type column ready');
            } catch (e) {
                log('WARN', 'Could not add resource_type to audit_log', { error: e.message });
            }
        }

        fs.mkdir(CONFIG.REPOSITORY_PATH, { recursive: true })
            .then(() => log('INFO', 'Repository directory ready'))
            .catch((e) => log('WARN', 'Could not create repository directory', { error: e.message }));

        server.on('error', async (err) => {
            if (err.code === 'EADDRINUSE') {
                log('ERROR', `Port ${CONFIG.PORT} is already in use. Is another instance running?`, {
                    error: err.message,
                });
            } else {
                log('ERROR', 'Server listen error', { error: err.message });
            }
            await closeAllTunnels().catch((err) =>
                log('WARN', 'closeAllTunnels on listen-error failed', { error: err.message }),
            );
            process.exit(1);
        });

        server.listen(CONFIG.PORT, '0.0.0.0', () => {
            log('INFO', `🚀 PulseDB v3.0.0 running on port ${CONFIG.PORT}`);
        });

        if (pool) {
            pool.connect()
                .then(async (client) => {
                    await client.query('SELECT 1');
                    client.release();
                    log('INFO', 'Admin database connection successful');
                })
                .catch((e) =>
                    log('WARN', 'Admin database unreachable at startup — will retry on requests', { error: e.message }),
                );
        } else {
            log('INFO', 'No admin database configured — running in user-connection-only mode');
        }

        if (alerts) {
            alerts
                .initializeDatabase()
                .then(() => {
                    alerts.startMonitoring(CONFIG.ALERT_MONITORING_INTERVAL);
                    log('INFO', 'Alert monitoring started', { interval: CONFIG.ALERT_MONITORING_INTERVAL });
                })
                .catch((e) => log('WARN', 'Alert system could not initialize', { error: e.message }));
        }

        // ── Connection health ────────────────────────────────────────────────
        // The alert engine above is constructed with the ADMIN pool, so its
        // threshold rules measure the control-plane database. This is what
        // actually probes the databases the user connected, and it is the only
        // thing that answers "is my database up?".
        if (pool && alerts) {
            connectionHealth = startConnectionHealthMonitor({ pool, alerts });
        }

        // Hydrate the per-user active-connection map from
        // pgmonitoringtool.user_active_connection so a Railway redeploy
        // or Vercel cold start doesn't leave users stuck on "Connecting…"
        // after re-login (migration 0019).
        loadUserActiveConnections().catch((err) =>
            log('WARN', 'Could not hydrate user active connections', { error: err.message }),
        );
        loadUserActiveDatabases().catch((err) =>
            log('WARN', 'Could not hydrate user active databases', { error: err.message }),
        );
        loadUserActiveSchemas().catch((err) =>
            log('WARN', 'Could not hydrate user active schemas', { error: err.message }),
        );
    } catch (e) {
        log('ERROR', 'Startup failed', { error: e.message });
        process.exit(1);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────────────────────────────────────
async function shutdown(signal) {
    log('INFO', `${signal} — shutting down`);
    const forceExit = setTimeout(() => {
        log('WARN', 'Forced shutdown after timeout');
        process.exit(1);
    }, 30_000);
    forceExit.unref();
    try {
        if (alerts) alerts.stopMonitoring();
        // Close all MongoDB clients
        for (const [id, m] of mongoClients) {
            await m.client
                .close()
                .catch((err) => log('WARN', `MongoDB shutdown close failed for ${id}`, { error: err.message }));
        }
        mongoClients.clear();
        // Close all PG/MySQL pools
        for (const [id, p] of connectionPools) {
            await p.end().catch((err) => log('WARN', `Pool shutdown end failed for ${id}`, { error: err.message }));
        }
        connectionPools.clear();
        await closeAllTunnels().catch((err) =>
            log('WARN', 'closeAllTunnels on shutdown failed', { error: err.message }),
        );
        server.close(() => (pool ? pool.end(() => process.exit(0)) : process.exit(0)));
    } catch (err) {
        log('ERROR', 'Shutdown error', { error: err.message });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESS SIGNAL HANDLERS & CLEANUP
// ─────────────────────────────────────────────────────────────────────────────

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    log('ERROR', 'Unhandled Promise Rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        promise: String(promise),
    });
    // Do not exit — allow the process to continue but log the failure
});

// Audit M-1: log uncaught synchronous exceptions (previously only async
// rejections were handled). Log with full context, then continue on Vercel
// (where exit kills the function) but fail-fast elsewhere so an orchestrator
// can restart a process left in an unknown state.

process.on('uncaughtException', (err) => {
    log('ERROR', 'Uncaught Exception', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
    });
    if (process.env.VERCEL !== '1' && process.env.NODE_ENV === 'production') {
        setTimeout(() => process.exit(1), 100);
    }
});

// Export the Express app for environments that import this module
// (e.g. Vercel serverless, tests).
export default app;

// Start the server when running directly (Railway, local dev, Docker, etc.).
// Skip startup only when imported by Vercel's serverless runtime.
if (process.env.VERCEL !== '1') {
    startup();
}
