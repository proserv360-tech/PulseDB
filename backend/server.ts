// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import http from 'http';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { WebSocketServer } from 'ws';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto, { randomUUID } from 'crypto';

import { getStatus, getMetric } from './services/cloudwatchService.js';
import {
    sendSlackAlert,
    sendSlackMessage,
    verifySlackSignature,
    updateAlertMessage,
    postThreadComment,
    resolveSlackUser,
} from './services/slackService.js';
import repoRoutes from './routes/repoRoutes.js';
import EnhancedAlertEngine from './services/alertService.js';
import { startConnectionHealthMonitor } from './services/connectionHealthService.js';
import EmailNotificationService from './services/emailService.js';
import { openTunnel, closeTunnel, getTunnelPort, closeAll as closeAllTunnels } from './services/sshTunnel.js';
import {
    encrypt,
    decrypt,
    isEncrypted,
    getPublicKey,
    unwrapField,
    validateEncryptionConfig,
} from './services/encryptionService.js';
import {
    DiagnosticCodes,
    checkEncryptionConfig,
    runSystemDiagnostics,
    classifyConnectionError,
} from './services/systemDiagnostics.js';

import {
    buildAuthenticate,
    buildEnforcePasswordChange,
    requireScreen,
    requireRole,
    invalidatePasswordChangeCache,
} from './middleware/authenticate.js';
import { setAuthCookie, clearAuthCookie, readAuthCookie } from './services/authCookie.js';
import dbaTaskRoutes from './routes/dbaTaskRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import userRoutes from './routes/userRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import { getUserByUsername, touchLastLogin } from './services/userService.js';
import { createSession, recordLogin, recordFailedLogin, revokeSession } from './services/sessionService.js';
import { writeAudit } from './services/auditService.js';

// Enterprise modules (hidden — uncomment when ready)
// import { mountEnterpriseRoutes } from './enterprise/index.js';

// Gap feature routes
import otelRoutes from './routes/otelRoutes.js';
import retentionRoutes from './routes/retentionRoutes.js';
import aiQueryRoutes from './routes/aiQueryRoutes.js';
import k8sRoutes from './routes/k8sRoutes.js';
import statusPageRoutes from './routes/statusPageRoutes.js';
import terraformRoutes from './routes/terraformRoutes.js';
import aiMonitoringRoutes from './routes/aiMonitoringRoutes.js';
import agentFindingsRoutes from './routes/agentFindingsRoutes.js';
import schemaTrackingRoutes from './routes/schemaTrackingRoutes.js';
import queryAdvisorRoutes from './routes/queryAdvisorRoutes.js';
import backupRoutes from './routes/backupRoutes.js';
import schemaRoutes from './routes/schemaRoutes.js';
import metricsRoutes from './routes/metricsRoutes.js';
import observabilityRoutes from './routes/observabilityRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import mysqlRoutes from './routes/mysqlRoutes.js';
import mongoRoutes from './routes/mongoRoutes.js';
import sdkRoutes from './routes/sdkRoutes.js';
import enterpriseUIRoutes from './routes/enterpriseUIRoutes.js';

// ── Roadmap routes (W1–W3) ────────────────────────────────────────────────────
import samlRoutes from './routes/samlRoutes.js';
import explainRoutes from './routes/explainRoutes.js';
import workbenchRoutes from './routes/workbenchRoutes.js';
import advisorRoutes from './routes/advisorRoutes.js';
import schemaDiffRoutes from './routes/schemaDiffRoutes.js';
import bloatRoutes from './routes/bloatRoutes.js';
import capacityRoutes from './routes/capacityRoutes.js';
import alertDslRoutes from './routes/alertDslRoutes.js';
import anomalyRoutes from './routes/anomalyRoutes.js';
import pluginRoutes from './routes/pluginRoutes.js';
import scimRoutes from './routes/scimRoutes.js';
import governanceRoutes from './routes/governanceRoutes.js';
import copilotRoutes from './routes/copilotRoutes.js';
import cloudInsightsRoutes from './routes/cloudInsightsRoutes.js';
import integrationsRoutes from './routes/integrationsRoutes.js';
import otlpTraceRoutes from './routes/otlpTraceRoutes.js';
import observabilityIngestRoutes from './routes/observabilityIngestRoutes.js';
import autoExplainRoutes from './routes/autoExplainRoutes.js';
import { authenticateSdkKey as sdkKeyAuth } from './services/sdkService.js';
import syntheticRoutes from './routes/syntheticRoutes.js';
import kmsRoutes from './routes/kmsRoutes.js';
import erdRoutes from './routes/erdRoutes.js';
import engineConsoleRoutes from './routes/engineConsoleRoutes.js';
import waitEventsRoutes from './routes/waitEventsRoutes.js';
import storageAdvisorRoutes from './routes/storageAdvisorRoutes.js';
import overviewRoutes from './routes/overviewRoutes.js';
import reliabilityRoutes from './routes/reliabilityRoutes.js';
import performanceRoutes from './routes/performanceRoutes.js';
import alertsManagementRoutes from './routes/alertsManagementRoutes.js';
import incidentRoutes from './routes/incidentRoutes.js';
import cronRoutes from './routes/cronRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

import { getAdapter as getDbAdapter } from './services/dbAdapters/index.js';
import { tenantIsolation } from './middleware/tenantIsolation.js';
import { ipAllowListMiddleware } from './middleware/ipAllowList.js';
import { hipaaMiddleware } from './middleware/hipaaMode.js';
import { rateLimiter as buildRateLimiter } from './middleware/rateLimiter.js';
import { scheduleAuditExport } from './services/auditExport.js';
import {
    renderMetrics as renderPromMetrics,
    requestCounter as promRequestCounter,
    startEventLoopLagMonitor,
} from './services/promScrapeService.js';

// ── Optional DB drivers (graceful fallback if not installed) ──
let mysql2 = null;
let mongodb = null;
try {
    mysql2 = await import('mysql2/promise');
} catch {
    /* mysql2 not installed */
}
try {
    mongodb = await import('mongodb');
} catch {
    /* mongodb not installed */
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const IS_PROD = process.env.NODE_ENV === 'production';

const CONFIG = Object.freeze({
    PORT: Number(process.env.PORT) || 5000,
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
    JWT_SECRET: process.env.JWT_SECRET || null,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
    // SEC-07 (audit): bind tokens to this app & issuer so a JWT minted for
    // some other service (or a different FATHOM deployment) cannot be replayed.
    JWT_AUDIENCE: process.env.JWT_AUDIENCE || 'fathom-api',
    JWT_ISSUER: process.env.JWT_ISSUER || 'fathom-auth',
    CORS_ORIGINS: [
        ...(IS_PROD ? [] : ['http://localhost:5173', 'http://localhost:3000']),
        'https://postgres-tool.vercel.app',
        'https://postgres-tool-frontend.vercel.app',
        process.env.FRONTEND_URL,
        process.env.CORS_ORIGIN,
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    ].filter(Boolean),
    SLOW_QUERY_MIN: Number(process.env.SLOW_QUERY_MINUTES) || 5,
    WS_INTERVAL_MS: Number(process.env.WS_INTERVAL_MS) || 5000,
    REPOSITORY_PATH: process.env.REPOSITORY_PATH || path.join(__dirname, 'repositories'),
    ALERT_MONITORING_INTERVAL: Number(process.env.ALERT_MONITORING_INTERVAL) || 30_000,
    RATE_LIMIT: {
        WINDOW_MS: 60_000,
        MAX_REQUESTS: Number(process.env.RATE_LIMIT_MAX) || 300,
    },
    CACHE_TTL: {
        // PERF: bumped to align with the FE auto-refresh cadence (30s).
        // Anything < refresh cadence means every other render hits the DB.
        STATS: 25_000,
        TRAFFIC: 25_000,
        GROWTH: 60_000,
        INDEXES: 60_000,
        VACUUM: 60_000,
        PERFORMANCE: 25_000,
        CACHE_HIT: 25_000,
        EXTENSIONS: 120_000,
        SEQUENCES: 60_000,
        BLOAT: 120_000,
        WAL: 25_000,
        SETTINGS: 300_000,
        TABLE_STATS: 60_000,
        SCHEMAS: 120_000,
        RESOURCES: 25_000,
        REPLICATION: 25_000,
        SECURITY: 60_000,
        POOL: 25_000,
    },
    ALERT_THRESHOLDS: {
        CONNECTION_USAGE_PCT: 80,
        LONG_QUERY_SEC: 300,
        DEAD_TUPLE_RATIO: 20,
        REPLICATION_LAG_MB: 100,
        CACHE_HIT_RATIO: 90,
        LOCK_COUNT: 5,
    },
    EMAIL: {
        enabled: process.env.EMAIL_ENABLED === 'true',
        provider: process.env.EMAIL_PROVIDER || 'smtp',
        minSeverity: process.env.EMAIL_MIN_SEVERITY || 'warning',
        recipients: process.env.EMAIL_RECIPIENTS?.split(',').map((e) => e.trim()) || [],
        from: process.env.EMAIL_FROM || '"FATHOM Alert System" <alerts@fathom.local>',
        dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:5173',
        databaseName: process.env.PGDATABASE || 'postgres',
        gmail: { user: process.env.GMAIL_USER, appPassword: process.env.GMAIL_APP_PASSWORD },
        sendgrid: { apiKey: process.env.SENDGRID_API_KEY },
        ses: {
            region: process.env.AWS_SES_REGION || 'us-east-1',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
        smtp: {
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            user: process.env.SMTP_USER,
            password: process.env.SMTP_PASSWORD,
            rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false',
        },
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT VALIDATION
// ─────────────────────────────────────────────────────────────────────────────
const HAS_ADMIN_DB = !!(process.env.DATABASE_URL || (process.env.PGHOST && process.env.PGPASSWORD));

(function validateEnv() {
    const errors = [];
    const warnings = [];

    // ── Admin database ──────────────────────────────────────────────────
    if (!HAS_ADMIN_DB) {
        warnings.push(
            'DATABASE_URL (or PGHOST / PGPASSWORD) not set — admin database unavailable. ' +
                'Users must add connections via the UI. Metadata features (saved connections, user management) will be unavailable until a control-plane database is configured.',
        );
    }

    // ── JWT secret ──────────────────────────────────────────────────────
    if (!process.env.JWT_SECRET) {
        if (IS_PROD) {
            errors.push(
                'FATAL: JWT_SECRET environment variable is required in production. ' +
                    'Set a strong (32+ char) secret via the Vercel dashboard → Settings → Environment Variables. ' +
                    'Refusing to start without a configured JWT_SECRET.',
            );
        } else {
            warnings.push('JWT_SECRET not configured. Set a strong secret before deploying to production.');
        }
    } else if (process.env.JWT_SECRET === 'fathom-change-me-in-production') {
        errors.push(
            'FATAL: JWT_SECRET is using the insecure default value. ' +
                'Change it to a strong, random secret in your environment configuration. ' +
                'Refusing to start with default secrets.',
        );
    } else if (process.env.JWT_SECRET.length < 32) {
        errors.push(
            'FATAL: JWT_SECRET is shorter than 32 characters. ' +
                "Generate a longer secret with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64'))\"",
        );
    }

    // ── Required variables in production ────────────────────────────────
    // NOTE: PGHOST / PGPASSWORD are NOT required — FATHOM is a monitoring
    //       tool where users connect their own databases at runtime.
    if (IS_PROD) {
        // At least one CORS origin must be configured
        if (!process.env.CORS_ORIGIN && !process.env.FRONTEND_URL) {
            errors.push('Missing CORS origin in production: set CORS_ORIGIN or FRONTEND_URL.');
        }
    }

    // ── Emit warnings ───────────────────────────────────────────────────
    for (const w of warnings) {
        console.warn(JSON.stringify({ ts: new Date().toISOString(), level: 'WARN', msg: w }));
    }

    // ── Fail-fast on errors in production ───────────────────────────────
    if (errors.length > 0) {
        for (const e of errors) {
            console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'FATAL', msg: e }));
        }
        if (IS_PROD && process.env.VERCEL !== '1') {
            // On traditional servers (Railway, Docker, local), crash immediately
            // so the process supervisor can restart with correct env vars.
            console.error('Aborting startup due to configuration errors.');
            process.exit(1);
        }
        // On Vercel serverless, don't call process.exit() — it kills the
        // cold-start and returns a generic 500. Instead, log the errors and
        // let individual route handlers detect the misconfiguration gracefully.
    }
})();

// ─────────────────────────────────────────────────────────────────────────────
// SENTRY — must be initialised before any other imports that could throw
// ─────────────────────────────────────────────────────────────────────────────
import { initSentry, sentryErrorHandler } from './services/sentry.js';
initSentry();

// ─────────────────────────────────────────────────────────────────────────────
// LOGGER — pino-backed structured logging (services/logger.js)
// ─────────────────────────────────────────────────────────────────────────────
import { log, httpLogger } from './services/logger.js';
import { swallow, swallowWith } from './services/errorHandling.js';

// ─────────────────────────────────────────────────────────────────────────────
// TLS HELPER — SEC-04 (audit)
// ─────────────────────────────────────────────────────────────────────────────
// In production we default to strict TLS certificate validation.
// Set FATHOM_TLS_ALLOW_SELF_SIGNED=true to opt back into the permissive
// behavior (needed for some self-hosted DBs with self-signed certs).
// Set FATHOM_TLS_CA_CERT to a PEM bundle to trust a custom CA.
function buildSslOption(sslEnabled) {
    if (!sslEnabled) return false;
    const isProd = process.env.NODE_ENV === 'production';

    // Managed Postgres poolers (Supabase, Neon, RDS proxy, etc.) terminate TLS
    // with a cert that isn't in Node's default trust store, so strict
    // verification throws "self-signed certificate in certificate chain".
    // Detect those hosts from the connection target and relax verification for
    // them (the connection is still encrypted — we just don't reject the chain).
    const target = `${process.env.DATABASE_URL || ''} ${process.env.PGHOST || ''}`.toLowerCase();
    const isManagedPooler = /supabase\.(co|com)|pooler\.supabase|neon\.tech|rds\.amazonaws/.test(target);
    const ca = process.env.FATHOM_TLS_CA_CERT;

    const allowSelfSigned =
        process.env.FATHOM_TLS_ALLOW_SELF_SIGNED === 'true' ||
        isManagedPooler ||
        // Hosted Postgres (Supabase/Neon/etc.) on a serverless platform presents
        // a cert outside Node's default trust store. When no explicit CA is
        // provided we cannot do strict verification, so relax it rather than
        // hard-fail the whole control plane. Setting FATHOM_TLS_STRICT=true
        // (with FATHOM_TLS_CA_CERT) restores strict verification.
        (!ca && process.env.FATHOM_TLS_STRICT !== 'true') ||
        (!isProd && process.env.FATHOM_TLS_STRICT !== 'true');
    const opt = { rejectUnauthorized: !allowSelfSigned };
    if (ca) opt.ca = ca;
    return opt;
}

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE POOL — admin pool (env-based, for metadata) + per-connection pool map
// ─────────────────────────────────────────────────────────────────────────────

// Admin pool: used ONLY for fathom_connections, users, feedback, etc.
// NOT used for monitoring queries — those must go through user-added connections.
// PRF-05 (audit): admin pool max reduced from 10 to 3 per instance.
// On Vercel each cold-started function instance owns its own pool, so a max
// of 10 fans out to dozens of idle connections against a small Neon free tier
// (default ~100 max). Three is plenty for the metadata workload (control-plane
// reads/writes only), and the per-user query workload runs through dynamic
// pools created by getPool() with their own caps.
//
// On Vercel specifically we default to 1: a single cold-started serverless
// function rarely needs to multiplex control-plane queries, and many cold
// starts × 3 connections each saturates small Neon tiers fast. Long-lived
// hosts (Railway/Fly/Render/Docker) keep the default of 3.
// Override with FATHOM_ADMIN_POOL_MAX if a deployment genuinely needs more.
// Monitored-connection query cap (audit 2026-06-12). Bounds every query run
// against a user's database through the shared pool, not just the advisor.
// Override with FATHOM_STATEMENT_TIMEOUT_MS; 0 disables (not recommended).
// NOTE: must be declared BEFORE the pool so the Pool constructor can reference it.
const STATEMENT_TIMEOUT_MS = Number.isFinite(Number(process.env.FATHOM_STATEMENT_TIMEOUT_MS))
    ? Number(process.env.FATHOM_STATEMENT_TIMEOUT_MS)
    : 30_000;

// Vercel MUST stay at 1: each cold-started serverless instance owns its own
// pool, and Supabase's pooler (free tier) caps TOTAL clients at 15. Just 3
// concurrent Vercel instances × 5 connections = 15 → "max clients reached"
// (EMAXCONNSESSION) and every new connection fails. One connection per instance
// keeps many instances within the cap; the dashboard's parallel /overview/*
// calls are served fast from the session/response caches, not 9 live DB hits.
// Long-lived hosts (Railway/Fly/Render/Docker) run a single instance and can
// safely use a larger pool. Override either via FATHOM_ADMIN_POOL_MAX.
const ADMIN_POOL_DEFAULT = process.env.VERCEL === '1' ? 1 : 5;
const ADMIN_POOL_MAX = Number(process.env.FATHOM_ADMIN_POOL_MAX) || ADMIN_POOL_DEFAULT;
// Keep admin sockets alive between queries. Short on serverless so idle
// instances hand pooler slots back; generous on a long-lived host, where
// re-handshaking to a remote region is the dominant cost of a "slow" query.
const ADMIN_POOL_IDLE_MS =
    Number(process.env.FATHOM_ADMIN_POOL_IDLE_MS) || (process.env.VERCEL === '1' ? 5_000 : 60_000);
const pool = HAS_ADMIN_DB
    ? new Pool(
          process.env.DATABASE_URL
              ? {
                    connectionString: process.env.DATABASE_URL,
                    max: ADMIN_POOL_MAX,
                    // Was 10s. On a long-lived host that meant nearly every
                    // query after a quiet moment paid a fresh TCP + TLS + SCRAM
                    // handshake — ~4-6 round trips, which against a pooler in
                    // another region is most of a second. Serverless still wants
                    // a short timeout so idle instances release pooler slots;
                    // that case is handled by the per-connection pools below.
                    idleTimeoutMillis: ADMIN_POOL_IDLE_MS,
                    connectionTimeoutMillis: 15_000,
                    statement_timeout: STATEMENT_TIMEOUT_MS,
                    // Stop NAT and pooler middleboxes silently dropping an idle
                    // socket, which shows up later as an inexplicably slow query.
                    keepAlive: true,
                    keepAliveInitialDelayMillis: 10_000,
                    ssl: buildSslOption(true),
                }
              : {
                    user: process.env.PGUSER || 'postgres',
                    host: process.env.PGHOST,
                    database: process.env.PGDATABASE || 'postgres',
                    password: process.env.PGPASSWORD,
                    port: Number(process.env.PGPORT) || 5432,
                    max: ADMIN_POOL_MAX,
                    idleTimeoutMillis: ADMIN_POOL_IDLE_MS,
                    connectionTimeoutMillis: 15_000,
                    statement_timeout: STATEMENT_TIMEOUT_MS,
                    keepAlive: true,
                    keepAliveInitialDelayMillis: 10_000,
                    // Managed poolers (Supabase/Neon/RDS) require TLS; force it on for
                    // those hosts even if PGSSL is unset/false, then buildSslOption
                    // relaxes cert verification for them.
                    ssl: buildSslOption(
                        process.env.PGSSL !== 'false' ||
                            /supabase|pooler|neon\.tech|rds\.amazonaws/.test((process.env.PGHOST || '').toLowerCase()),
                    ),
                },
      )
    : null;

if (pool) pool.on('error', (err) => log('ERROR', 'Pool background error', { err: err.message }));

const connectionPools = new Map();
// Map<connectionId, { client: MongoClient, db: Db }> — MongoDB clients
const mongoClients = new Map();
// PRF-01 (audit): in-flight pool/client creations. Two concurrent callers for
// the same connectionId share a single pending Promise instead of racing and
// leaking a duplicate pool/client.
const poolInFlight = new Map(); // Map<connectionId, Promise<pool>>
const mongoInFlight = new Map(); // Map<connectionId, Promise<{client,db}>>
// PRF-02 (audit): per-pool lastUsed timestamps for idle eviction.
const poolLastUsed = new Map(); // Map<connectionId, ms epoch>
const mongoLastUsed = new Map(); // Map<connectionId, ms epoch>
const POOL_IDLE_EVICT_MS = Number(process.env.FATHOM_POOL_IDLE_EVICT_MS) || 30 * 60 * 1000; // 30 min
const POOL_EVICT_SWEEP_MS = Number(process.env.FATHOM_POOL_EVICT_SWEEP_MS) || 5 * 60 * 1000; // 5 min
// Hard cap on simultaneously-live connection pools / Mongo clients across the
// process. When we hit the cap we evict the least-recently-used entry instead
// of throwing — see evictLruPoolIfNeeded() below.
const MAX_LIVE_POOLS = Number(process.env.FATHOM_MAX_LIVE_POOLS) || 20;
const MAX_LIVE_MONGO_CLIENTS = Number(process.env.FATHOM_MAX_LIVE_MONGO_CLIENTS) || 20;

function touchPool(id) {
    poolLastUsed.set(id, Date.now());
}
function touchMongoClient(id) {
    mongoLastUsed.set(id, Date.now());
}

// Per-user active connection map: in-memory cache backed by
// pgmonitoringtool.user_active_connection (migration 0019). Cache is the
// hot path; DB is the source of truth across restarts.
//
// Why a cache at all: every metric request calls getUserActiveConnectionId
// (via reqPool) — adding a DB round-trip per request would re-introduce
// the slow load times we just fixed.
const userActiveConnections = new Map();
let _userActiveLoaded = false;

async function loadUserActiveConnections() {
    if (_userActiveLoaded) return;
    try {
        const r = await pool.query(`SELECT user_id, connection_id FROM pgmonitoringtool.user_active_connection`);
        for (const row of r.rows) {
            userActiveConnections.set(row.user_id, row.connection_id);
        }
        _userActiveLoaded = true;
        log('INFO', `Hydrated ${r.rows.length} user-active-connection rows`);
    } catch (err) {
        // Table may not exist on a fresh DB — that's fine; the in-memory
        // map will populate on first use and persist from there.
        if (!/relation .* does not exist/i.test(err.message)) {
            log('WARN', 'loadUserActiveConnections failed', { error: err.message });
        }
    }
}

/** Get the active connectionId for a specific user (cached + DB-backed) */
function getUserActiveConnectionId(userId) {
    return userId ? (userActiveConnections.get(userId) ?? null) : null;
}

/**
 * Set the active connectionId for a specific user. Write-through: cache
 * updates immediately so the next request sees it; DB write is fire-and-
 * forget so the caller doesn't pay the round-trip on the critical path.
 */
function setUserActiveConnectionId(userId, connectionId) {
    if (!userId) return;
    if (connectionId == null) {
        userActiveConnections.delete(userId);
        pool.query(`DELETE FROM pgmonitoringtool.user_active_connection WHERE user_id = $1`, [userId]).catch((err) => {
            if (!/relation .* does not exist/i.test(err.message)) {
                log('WARN', 'setUserActiveConnectionId DELETE failed', { error: err.message });
            }
        });
        return;
    }
    userActiveConnections.set(userId, connectionId);
    pool.query(
        `INSERT INTO pgmonitoringtool.user_active_connection (user_id, connection_id, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (user_id) DO UPDATE
            SET connection_id = EXCLUDED.connection_id, updated_at = now()`,
        [userId, connectionId],
    ).catch((err) => {
        if (!/relation .* does not exist/i.test(err.message)) {
            log('WARN', 'setUserActiveConnectionId UPSERT failed', { error: err.message });
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE DATABASE OVERRIDE (per user, per connection)
// A connection record points at one database, but a single server usually hosts
// many. Rather than force the user to register a new connection per database, we
// let them pick a different database on the SAME server. Because a PG/MySQL pool
// is bound to one database, "switching" means opening a second pool that reuses
// the connection's host/creds with a different `database`. Mongo is cheaper — one
// client can serve many databases via client.db(name).
// State is memory-first (hot path) and persisted to user_active_database so the
// choice survives restarts, mirroring user_active_connection above.
// ─────────────────────────────────────────────────────────────────────────────
const userActiveDatabase = new Map(); // `${userId}:${connectionId}` -> database
const activeDbKey = (userId, connectionId) => `${userId}:${connectionId}`;

function getUserActiveDatabaseId(userId, connectionId) {
    if (!userId || !connectionId) return null;
    return userActiveDatabase.get(activeDbKey(userId, connectionId)) ?? null;
}

function setUserActiveDatabase(userId, connectionId, database) {
    if (!userId || !connectionId) return;
    const key = activeDbKey(userId, connectionId);
    if (!database) {
        userActiveDatabase.delete(key);
        pool.query(`DELETE FROM pgmonitoringtool.user_active_database WHERE user_id=$1 AND connection_id=$2`, [
            userId,
            connectionId,
        ]).catch((err) => {
            if (!/relation .* does not exist/i.test(err.message)) {
                log('WARN', 'setUserActiveDatabase DELETE failed', { error: err.message });
            }
        });
        return;
    }
    userActiveDatabase.set(key, database);
    pool.query(
        `INSERT INTO pgmonitoringtool.user_active_database (user_id, connection_id, database, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (user_id, connection_id) DO UPDATE
            SET database = EXCLUDED.database, updated_at = now()`,
        [userId, connectionId, database],
    ).catch((err) => {
        if (!/relation .* does not exist/i.test(err.message)) {
            log('WARN', 'setUserActiveDatabase UPSERT failed', { error: err.message });
        }
    });
}

async function loadUserActiveDatabases() {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS pgmonitoringtool.user_active_database (
            user_id       integer     NOT NULL,
            connection_id integer     NOT NULL,
            database      text        NOT NULL,
            updated_at    timestamptz DEFAULT now(),
            PRIMARY KEY (user_id, connection_id)
        )`);
        const r = await pool.query(
            `SELECT user_id, connection_id, database FROM pgmonitoringtool.user_active_database`,
        );
        for (const row of r.rows) {
            userActiveDatabase.set(activeDbKey(row.user_id, row.connection_id), row.database);
        }
        if (r.rows.length) log('INFO', `Hydrated ${r.rows.length} user-active-database rows`);
    } catch (err) {
        if (!/relation .* does not exist/i.test(err.message)) {
            log('WARN', 'loadUserActiveDatabases failed', { error: err.message });
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE SCHEMA OVERRIDE (Postgres only, per user, per connection)
// A database contains many schemas. Selecting one scopes the table-level panels
// (top tables, vacuum, bloat, index advisor) via a schemaname filter and pins
// the SQL console's search_path. Postgres-specific: MySQL "schema" == database
// (already covered by the database switcher) and Mongo has no schemas.
// ─────────────────────────────────────────────────────────────────────────────
const userActiveSchema = new Map(); // `${userId}:${connectionId}` -> schema

function getUserActiveSchema(userId, connectionId) {
    if (!userId || !connectionId) return null;
    return userActiveSchema.get(activeDbKey(userId, connectionId)) ?? null;
}

function setUserActiveSchema(userId, connectionId, schema) {
    if (!userId || !connectionId) return;
    const key = activeDbKey(userId, connectionId);
    if (!schema) {
        userActiveSchema.delete(key);
        pool.query(`DELETE FROM pgmonitoringtool.user_active_schema WHERE user_id=$1 AND connection_id=$2`, [
            userId,
            connectionId,
        ]).catch((err) => {
            if (!/relation .* does not exist/i.test(err.message)) {
                log('WARN', 'setUserActiveSchema DELETE failed', { error: err.message });
            }
        });
        return;
    }
    userActiveSchema.set(key, schema);
    pool.query(
        `INSERT INTO pgmonitoringtool.user_active_schema (user_id, connection_id, schema, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (user_id, connection_id) DO UPDATE
            SET schema = EXCLUDED.schema, updated_at = now()`,
        [userId, connectionId, schema],
    ).catch((err) => {
        if (!/relation .* does not exist/i.test(err.message)) {
            log('WARN', 'setUserActiveSchema UPSERT failed', { error: err.message });
        }
    });
}

async function loadUserActiveSchemas() {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS pgmonitoringtool.user_active_schema (
            user_id       integer     NOT NULL,
            connection_id integer     NOT NULL,
            schema        text        NOT NULL,
            updated_at    timestamptz DEFAULT now(),
            PRIMARY KEY (user_id, connection_id)
        )`);
        const r = await pool.query(`SELECT user_id, connection_id, schema FROM pgmonitoringtool.user_active_schema`);
        for (const row of r.rows) {
            userActiveSchema.set(activeDbKey(row.user_id, row.connection_id), row.schema);
        }
        if (r.rows.length) log('INFO', `Hydrated ${r.rows.length} user-active-schema rows`);
    } catch (err) {
        if (!/relation .* does not exist/i.test(err.message)) {
            log('WARN', 'loadUserActiveSchemas failed', { error: err.message });
        }
    }
}

const isPgLikeEngine = (dbType) => (dbType || 'postgresql').toLowerCase().includes('postgres');

// Engines whose connections are bound to a single database that we can re-target
// at runtime by opening another pool/handle.
const SWITCHABLE_DB_TYPES = new Set(['postgresql', 'postgres', 'mysql', 'mariadb', 'mongodb']);

/**
 * Decide whether a connection can switch databases, and why not if it can't.
 * The main real-world blocker is a transaction-mode pooler (Supabase 6543,
 * pgbouncer), which pins a client to one database and can't be re-targeted.
 */
function isDatabaseSwitchable(conn) {
    const dbType = (conn.dbType || 'postgresql').toLowerCase();
    if (!SWITCHABLE_DB_TYPES.has(dbType)) {
        return { ok: false, reason: `${dbType} connections don't support switching databases in place.` };
    }
    const host = String(conn.host || '').toLowerCase();
    const port = Number(conn.port);
    if (/pooler\.supabase\.com/.test(host) && port === 6543) {
        return {
            ok: false,
            reason: 'This connection uses the Supabase transaction pooler (port 6543), which binds to one database. Add a direct connection (port 5432) to switch databases.',
        };
    }
    return { ok: true, reason: null };
}

// Override pools keyed by `${connectionId}::${database}`. Separate from the main
// connectionPools cache so the existing pool mechanics stay untouched. Capped +
// LRU-evicted so a user browsing many databases can't leak sockets forever.
const overridePools = new Map(); // key -> { pool, dbType, lastUsed }
const OVERRIDE_POOL_MAX = Number(process.env.FATHOM_OVERRIDE_POOL_MAX) || 8;

async function getOverridePool(conn, database, schema = null) {
    // Only Postgres uses the schema part (search_path); ignore it elsewhere.
    const pgLike = isPgLikeEngine(conn.dbType);
    const effSchema = pgLike && schema ? schema : null;
    const key = `${conn.id}::${database}::${effSchema || ''}`;
    const hit = overridePools.get(key);
    if (hit) {
        hit.lastUsed = Date.now();
        return hit.pool;
    }
    if (overridePools.size >= OVERRIDE_POOL_MAX) {
        let victimKey = null;
        let oldest = Infinity;
        for (const [k, v] of overridePools) {
            if (v.lastUsed < oldest) {
                oldest = v.lastUsed;
                victimKey = k;
            }
        }
        if (victimKey) {
            const victim = overridePools.get(victimKey);
            overridePools.delete(victimKey);
            try {
                await victim.pool.end();
            } catch {
                /* ignore */
            }
        }
    }
    const cfg = await resolvePoolConfig(conn);
    const dbType = (conn.dbType || 'postgresql').toLowerCase();
    const isVercel = process.env.VERCEL === '1';
    let newPool;
    if (dbType === 'mysql' || dbType === 'mariadb') {
        newPool = mysql.createPool({
            host: cfg.host,
            port: cfg.port,
            database,
            user: cfg.user,
            password: cfg.password,
            ssl: buildSslOption(conn.ssl) || undefined,
            waitForConnections: true,
            connectionLimit: isVercel ? 2 : 8,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 10000,
            connectTimeout: 8000,
            idleTimeout: 60000,
        });
    } else {
        newPool = new Pool({
            ...cfg,
            database,
            // Pin the SQL console's search_path to the selected schema (falls back
            // to public). Catalog panels filter by schemaname explicitly; this only
            // affects unqualified names in the console/workbench.
            ...(effSchema ? { options: `-c search_path="${effSchema.replace(/"/g, '')}",public` } : {}),
            max: isVercel ? 2 : 8,
            min: isVercel ? 0 : 1,
            idleTimeoutMillis: isVercel ? 5_000 : 60_000,
            connectionTimeoutMillis: 8_000,
            statement_timeout: STATEMENT_TIMEOUT_MS,
            keepAlive: true,
            keepAliveInitialDelayMillis: 10_000,
        });
        newPool.on('error', (err) => log('ERROR', `Override pool [${key}] background error`, { err: err.message }));
    }
    overridePools.set(key, { pool: newPool, dbType, lastUsed: Date.now() });
    log('INFO', `Created override pool ${key}`);
    return newPool;
}

/** Tear down any override pools belonging to a connection (on delete/update). */
async function destroyOverridePools(connectionId) {
    const prefix = `${parseInt(connectionId, 10)}::`;
    for (const [k, v] of [...overridePools]) {
        if (k.startsWith(prefix)) {
            overridePools.delete(k);
            try {
                await v.pool.end();
            } catch {
                /* ignore */
            }
        }
    }
}

/** Apply a Mongo database override without caching a second client. */
function applyMongoOverride(base, overrideDb) {
    if (!base || !overrideDb) return base;
    try {
        if (base.db && base.db.databaseName === overrideDb) return base;
        return { client: base.client, db: base.client.db(overrideDb) };
    } catch {
        return base;
    }
}

/**
 * Resolve a connection object from the cache (or DB refresh).
 * @param {number|string|null} connectionId - explicit connection ID
 * @param {number|null} userId - the authenticated user's ID (for per-user fallback)
 */
async function resolveConnection(connectionId, userId) {
    if (!connectionId) {
        const userDefault = getUserActiveConnectionId(userId);
        if (userDefault) return resolveConnection(userDefault, userId);
        throw new Error('No database connection configured. Please add a connection in the Connection Pool settings.');
    }
    const id = parseInt(connectionId, 10);
    let conn = CONNECTIONS.find((c) => c.id === id);
    if (!conn) {
        await ensureConnectionsTable().catch((err) =>
            log('WARN', 'ensureConnectionsTable failed during resolveConnection', { error: err.message }),
        );
        await syncConnectionsCache().catch((err) =>
            log('WARN', 'syncConnectionsCache failed during resolveConnection', { error: err.message }),
        );
        conn = CONNECTIONS.find((c) => c.id === id);
    }
    if (!conn) throw new Error(`Connection ${id} not found`);
    return conn;
}

/**
 * Return the pool for a given connectionId.
 * Supports PostgreSQL (pg.Pool) and MySQL (mysql2 pool).
 * For MongoDB, use getMongoClient() instead.
 */
async function getPool(connectionId, userId) {
    const conn = await resolveConnection(connectionId, userId);
    const id = conn.id;

    // Hot path: pool already exists.
    if (connectionPools.has(id)) {
        touchPool(id);
        return connectionPools.get(id);
    }

    // PRF-01 (audit): if another async caller is already creating this pool,
    // await their Promise instead of starting a second concurrent creation.
    if (poolInFlight.has(id)) return poolInFlight.get(id);

    // Cap total live pools across the process. When we hit the cap, evict the
    // least-recently-used pool (calling .end() on it) and continue, so a busy
    // tenant doesn't get rejected just because someone else opened a pool an
    // hour ago and never came back.
    await evictLruPoolIfNeeded();

    const dbType = (conn.dbType || 'postgresql').toLowerCase();
    if (dbType === 'mongodb') {
        throw new Error(
            'MongoDB connections must use getMongoClient() — pool-based access is not supported. Use /api/mongodb/* endpoints instead.',
        );
    }

    const creation = (async () => {
        if (dbType === 'mysql' || dbType === 'mariadb') {
            if (!mysql2) throw new Error('MySQL driver (mysql2) not installed on the server. Run: npm install mysql2');
            const cfg = await resolvePoolConfig(conn);
            const mysqlPool = mysql2.createPool({
                host: cfg.host,
                port: cfg.port,
                database: cfg.database,
                user: cfg.user,
                password: cfg.password,
                ssl: buildSslOption(conn.ssl) || undefined,
                waitForConnections: true,
                connectionLimit: 8,
                queueLimit: 0,
                enableKeepAlive: true,
                keepAliveInitialDelay: 10000, // align with PG keep-alive
                connectTimeout: 8000, // was 15s — match wizard
                idleTimeout: 60000, // keep sockets for 1 min idle
                // Cap server-side execution so a runaway monitoring query can't
                // pin a pool connection (audit 2026-06-12 follow-up). MySQL 5.7.8+.
                init: (conn) => conn.query(`SET SESSION max_execution_time = ${STATEMENT_TIMEOUT_MS}`, () => {}),
            });
            connectionPools.set(id, mysqlPool);
            touchPool(id);
            log('INFO', `Created MySQL pool for connection ${id} (${conn.name})`);
            return mysqlPool;
        }
        // PostgreSQL (default)
        // PERF tuning:
        //   max=8                       keep concurrency cap, avoid swamping
        //                               the monitored DB with parallel queries
        //                               from many dashboards.
        //   min=1                       NEW. Keep 1 socket warm so a 30s-cadence
        //                               dashboard never pays a cold reconnect.
        //   idleTimeoutMillis=60_000    NEW (was 10s). 10s was too aggressive
        //                               for an open dashboard that refreshes
        //                               every 30s.
        //   connectionTimeoutMillis=8000 NEW (was 15s). 8s aligns with the
        //                               wizard's test timeout; failing fast on
        //                               a wedged DB is a better UX than
        //                               waiting 15s.
        //   keepAlive=true              NEW. Avoid silent NAT drops that
        //                               manifest as inexplicably slow first
        //                               queries after idle.
        const cfg = await resolvePoolConfig(conn);
        // On Vercel keep this small: many serverless instances × this max can
        // exhaust a pooler's client cap (Supabase free tier = 15). Long-lived
        // single-instance hosts can use the larger pool. min=0 on Vercel so an
        // idle instance frees its sockets back to the pooler.
        const isVercel = process.env.VERCEL === '1';
        const newPool = new Pool({
            ...cfg,
            max: isVercel ? 2 : 8,
            min: isVercel ? 0 : 1,
            // Serverless: release sockets back to the pooler quickly so idle
            // instances don't sit on Supabase's limited client slots.
            idleTimeoutMillis: isVercel ? 5_000 : 60_000,
            connectionTimeoutMillis: 8_000,
            statement_timeout: STATEMENT_TIMEOUT_MS,
            keepAlive: true,
            keepAliveInitialDelayMillis: 10_000,
        });
        newPool.on('error', (err) => log('ERROR', `Pool [conn:${id}] background error`, { err: err.message }));
        connectionPools.set(id, newPool);
        touchPool(id);
        log('INFO', `Created PG pool for connection ${id} (${conn.name})`);
        return newPool;
    })();

    poolInFlight.set(id, creation);
    try {
        return await creation;
    } finally {
        poolInFlight.delete(id);
    }
}

/**
 * Return a MongoDB client + db for a given connectionId.
 */
async function getMongoClient(connectionId, userId) {
    const conn = await resolveConnection(connectionId, userId);
    const id = conn.id;
    // A single Mongo client can serve many databases, so we cache one client per
    // connection and re-point it at the user's selected database on the way out.
    const overrideDb = getUserActiveDatabaseId(userId, id);

    if (mongoClients.has(id)) {
        touchMongoClient(id);
        return applyMongoOverride(mongoClients.get(id), overrideDb);
    }
    // PRF-01 (audit): share in-flight creations to avoid leaking duplicate clients.
    if (mongoInFlight.has(id)) return applyMongoOverride(await mongoInFlight.get(id), overrideDb);

    if (!mongodb) throw new Error('MongoDB driver not installed on the server. Run: npm install mongodb');

    // Cap total live Mongo clients across the process; evict LRU on overflow.
    await evictLruMongoClientIfNeeded();

    const creation = (async () => {
        const cfg = await resolvePoolConfig(conn);
        const userPart = cfg.user ? `${encodeURIComponent(cfg.user)}:${encodeURIComponent(cfg.password || '')}@` : '';
        // SEC: TLS certificate validation. Default to strict in production so
        // a MITM can't swap in a self-signed cert. Operators with self-signed
        // certs on internal Mongo clusters can opt back in via the same env
        // var used for Postgres (FATHOM_TLS_ALLOW_SELF_SIGNED=true). In dev,
        // unless FATHOM_TLS_STRICT=true, we keep the lax behavior so localhost
        // self-signed setups still work out of the box.
        let sslParam = '';
        if (conn.ssl) {
            const allowSelfSigned =
                process.env.FATHOM_TLS_ALLOW_SELF_SIGNED === 'true' ||
                (!IS_PROD && process.env.FATHOM_TLS_STRICT !== 'true');
            sslParam = allowSelfSigned ? '?tls=true&tlsAllowInvalidCertificates=true' : '?tls=true';
        }
        const connStr = `mongodb://${userPart}${cfg.host}:${cfg.port || 27017}/${cfg.database || 'admin'}${sslParam}`;

        const client = new mongodb.MongoClient(connStr, {
            serverSelectionTimeoutMS: 8000,
            connectTimeoutMS: 15000,
        });
        await client.connect();
        const db = client.db(cfg.database || 'admin');

        const entry = { client, db };
        mongoClients.set(id, entry);
        touchMongoClient(id);
        log('INFO', `Created MongoDB client for connection ${id} (${conn.name})`);
        return entry;
    })();

    mongoInFlight.set(id, creation);
    try {
        return applyMongoOverride(await creation, overrideDb);
    } finally {
        mongoInFlight.delete(id);
    }
}

/**
 * Destroy the cached pool/client for a connection (called on delete/update).
 */
async function destroyPool(connectionId) {
    const id = parseInt(connectionId, 10);
    // PG / MySQL pool
    const p = connectionPools.get(id);
    if (p) {
        connectionPools.delete(id);
        poolLastUsed.delete(id);
        await p.end().catch((err) => log('WARN', `Pool end failed for connection ${id}`, { error: err.message }));
        log('INFO', `Destroyed pool for connection ${id}`);
    }
    // MongoDB client
    const m = mongoClients.get(id);
    if (m) {
        mongoClients.delete(id);
        mongoLastUsed.delete(id);
        await m.client
            .close()
            .catch((err) => log('WARN', `MongoDB close failed for connection ${id}`, { error: err.message }));
        log('INFO', `Destroyed MongoDB client for connection ${id}`);
    }
    // Any per-database override pools opened against this connection
    await destroyOverridePools(id);
}

/**
 * Find the connection id whose pool has been least-recently used, ignoring
 * any pool that is currently the in-flight creation target (we'd otherwise
 * evict the pool we're about to return). Returns undefined when the map is
 * empty or every entry is in flight.
 */
function _pickLruId(map, lastUsedMap, inFlightMap) {
    let oldestId;
    let oldestTs = Infinity;
    for (const [id] of map) {
        if (inFlightMap.has(id)) continue;
        const ts = lastUsedMap.get(id) ?? 0;
        if (ts < oldestTs) {
            oldestTs = ts;
            oldestId = id;
        }
    }
    return oldestId;
}

/**
 * If we're at or above the live-pool cap, evict the LRU SQL pool to make room.
 * No-op when under the cap. Safe to call before every pool creation.
 */
async function evictLruPoolIfNeeded() {
    if (connectionPools.size < MAX_LIVE_POOLS) return;
    const victim = _pickLruId(connectionPools, poolLastUsed, poolInFlight);
    if (victim === undefined) {
        // Every pool is being created right now; this should be vanishingly
        // rare. Don't throw — let the caller wait via the in-flight Promise.
        log('WARN', 'Pool cap reached but no eligible LRU victim found', {
            size: connectionPools.size,
            cap: MAX_LIVE_POOLS,
        });
        return;
    }
    const idle = Math.round((Date.now() - (poolLastUsed.get(victim) ?? 0)) / 1000);
    log('INFO', `Evicting LRU pool to make room for new connection`, {
        victimId: victim,
        idleSeconds: idle,
    });
    await destroyPool(victim);
}

/**
 * Same as evictLruPoolIfNeeded but for the Mongo client map.
 */
async function evictLruMongoClientIfNeeded() {
    if (mongoClients.size < MAX_LIVE_MONGO_CLIENTS) return;
    const victim = _pickLruId(mongoClients, mongoLastUsed, mongoInFlight);
    if (victim === undefined) {
        log('WARN', 'Mongo client cap reached but no eligible LRU victim found', {
            size: mongoClients.size,
            cap: MAX_LIVE_MONGO_CLIENTS,
        });
        return;
    }
    const idle = Math.round((Date.now() - (mongoLastUsed.get(victim) ?? 0)) / 1000);
    log('INFO', `Evicting LRU MongoDB client to make room for new connection`, {
        victimId: victim,
        idleSeconds: idle,
    });
    await destroyPool(victim);
}

// PRF-02 (audit): periodically evict pools that have not served a request in
// POOL_IDLE_EVICT_MS. Without this the connectionPools map grows monotonically
// to its 20-entry cap and never shrinks, eventually starving brand-new
// connections.
const _idleSweep = setInterval(async () => {
    const now = Date.now();
    for (const [id] of connectionPools) {
        const lastUsed = poolLastUsed.get(id) ?? 0;
        if (now - lastUsed > POOL_IDLE_EVICT_MS) {
            log('INFO', `Evicting idle pool for connection ${id} (idle for ${Math.round((now - lastUsed) / 1000)}s)`);
            await destroyPool(id);
        }
    }
    for (const [id] of mongoClients) {
        const lastUsed = mongoLastUsed.get(id) ?? 0;
        if (now - lastUsed > POOL_IDLE_EVICT_MS) {
            log(
                'INFO',
                `Evicting idle MongoDB client for connection ${id} (idle for ${Math.round((now - lastUsed) / 1000)}s)`,
            );
            await destroyPool(id);
        }
    }
}, POOL_EVICT_SWEEP_MS);
_idleSweep.unref?.();

/**
 * Shorthand: get the right pool for an Express request.
 * Reads connectionId from query param, falls back to user's active connection.
 */
async function reqPool(req) {
    const userId = req.user?.id ?? null;
    const connId = req.query.connectionId || null;
    // Honor a per-request (?database=) or the user's stored active-database
    // override: if it differs from the connection's own database, serve from a
    // dedicated override pool so dashboards read the selected database.
    const conn = await resolveConnection(connId, userId);
    const dbOverride =
        (req.query.database ? String(req.query.database) : null) || getUserActiveDatabaseId(userId, conn.id);
    if (dbOverride && dbOverride !== conn.database && isDatabaseSwitchable(conn).ok) {
        return getOverridePool(conn, dbOverride);
    }
    return getPool(connId, userId);
}

/**
 * Resolve the dbType for the current request's active connection.
 * Returns 'postgresql', 'mysql', 'mariadb', or 'mongodb'.
 */
async function reqDbType(req) {
    try {
        const userId = req.user?.id ?? null;
        const conn = await resolveConnection(req.query.connectionId || null, userId);
        return (conn.dbType || 'postgresql').toLowerCase();
    } catch {
        return 'postgresql'; // default if no connection
    }
}

/**
 * Execute a query that works for both PG and MySQL pools.
 * PG returns { rows }, MySQL returns [rows, fields].
 * This normalizes to always return { rows }.
 */
async function execQuery(poolOrResult, sql, params) {
    const result = await poolOrResult.query(sql, params);
    // MySQL returns [rows, fields] array; PG returns { rows }
    if (Array.isArray(result)) return { rows: result[0] };
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// CACHE & RATE LIMITER
// ─────────────────────────────────────────────────────────────────────────────
class LRUCache {
    constructor(maxSize = 256) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return undefined;
        }
        return entry.value;
    }
    set(key, value, ttlMs) {
        if (this.cache.size >= this.maxSize) this.cache.delete(this.cache.keys().next().value);
        this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    }
    clear() {
        this.cache.clear();
    }
    stats() {
        return { size: this.cache.size, maxSize: this.maxSize };
    }
}
const cache = new LRUCache(256);

function cached(key, ttl) {
    return (req, res, next) => {
        // Scope cache key by userId AND connectionId so users never share cache entries
        const userId = req.user?.id ?? 'anon';
        const connScope = req.query.connectionId || getUserActiveConnectionId(req.user?.id) || 'default';
        const scopedKey = `${key}:u${userId}:${connScope}`;
        const hit = cache.get(scopedKey);
        if (hit) {
            res.setHeader('X-Cache', 'HIT');
            return res.json(hit);
        }
        res.setHeader('X-Cache', 'MISS');

        // Capture the body on first res.json() call, then restore the original
        // method immediately so any outer middleware that wraps res.json after
        // us isn't fighting our wrapper. We never overwrite the response — the
        // handler's JSON still flows straight through to the client.
        const origJson = res.json.bind(res);
        let captured = false;
        res.json = (body) => {
            if (!captured) {
                captured = true;
                res.json = origJson; // restore before sending
                // Only cache successful responses; never cache an error payload.
                // Handlers can opt out by setting res.locals.noCache = true.
                if (res.statusCode >= 200 && res.statusCode < 300 && !res.locals?.noCache) {
                    try {
                        cache.set(scopedKey, body, ttl);
                    } catch {
                        /* cache full / non-fatal */
                    }
                }
            }
            return origJson(body);
        };
        next();
    };
}

// ── Rate limiting (A1: Redis-backed, in-memory fallback) ────────────────
// The implementation lives in backend/middleware/rateLimiter.js so the
// web tier and the upcoming worker tier share one budget per key when
// REDIS_URL is set. When unset (local dev, Vercel without Upstash), the
// limiter falls back transparently to the prior in-process behaviour.
const rateLimiter = buildRateLimiter({
    windowMs: CONFIG.RATE_LIMIT.WINDOW_MS,
    maxRequests: CONFIG.RATE_LIMIT.MAX_REQUESTS,
    keyFn: (req) => req.ip || 'unknown',
    prefix: 'fathom:rl:global',
});

// strictRateLimiter is a factory used by sensitive endpoints (login,
// password reset). It keys on ip+path so a brute-force attempt against
// /login doesn't share a budget with /forgot-password.
function strictRateLimiter(windowMs = 60_000, maxReqs = 10) {
    return buildRateLimiter({
        windowMs,
        maxRequests: maxReqs,
        keyFn: (req) => `${req.ip || 'unknown'}:${req.path}`,
        prefix: 'fathom:rl:strict',
    });
}

function securityHeaders(_req, res, next) {
    // ── Equivalent to helmet.js defaults + hardened extras ──────────────
    res.removeHeader('X-Powered-By');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '0'); // Modern best-practice: disable legacy XSS filter
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Download-Options', 'noopen'); // IE-specific download guard
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Origin-Agent-Cluster', '?1');

    // Proper Content Security Policy for API backend
    // Disallow all content embedding and enforce strict policies
    const csp = [
        "default-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        'upgrade-insecure-requests',
    ].join('; ');
    res.setHeader('Content-Security-Policy', csp);

    if (IS_PROD) {
        res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), interest-cohort=()');
    next();
}

// ─────────────────────────────────────────────────────────────────────────────
// SQL INJECTION GUARD
// ─────────────────────────────────────────────────────────────────────────────
const DANGEROUS_SQL =
    /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|CREATE|ALTER|GRANT|REVOKE|COPY|EXECUTE|DO\b|CALL|NOTIFY|LISTEN|LOAD|LOCK\s+TABLE|CHECKPOINT|SECURITY\s+LABEL|SET\s+ROLE|RESET\s+ALL)\b/i;

// Additional bypass patterns to detect SQL injection attempts.
//
// Note: the previous /\$\d+/ rule was removed — $1/$2/$N is the standard
// Postgres bind-placeholder syntax, and legitimate users will paste
// parameterized queries (EXACTLY what this tool is supposed to analyze).
// Bind placeholders cannot create an injection by themselves: in EXPLAIN
// they are bound to literal NULL, so they are safe to allow.
const INJECTION_BYPASS_PATTERNS = [
    /\bUNION\b/i, // UNION-based injection
    /\b(AND|OR)\b.*=.*1\b/i, // Tautology injection
    /['"`];?\s*-{2}|['"`];?\s*\/\*/, // Comment-based injection
    /\bEXISTS\b.*\(/i, // EXISTS-based injection
    /\bCASE\b.*\bWHEN\b/i, // CASE-based injection
];

function sanitizeSqlForValidation(sql) {
    // Remove SQL comments
    let cleaned = sql
        .replace(/--[^\n]*/g, ' ') // Single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, ' ') // Multi-line comments
        .replace(/#[^\n]*/g, ' '); // MySQL-style comments

    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
}

function validateExplainQuery(sql) {
    if (!sql || typeof sql !== 'string') return 'Query must be a non-empty string';
    if (sql.length > 8_000) return 'Query too long (max 8,000 characters)';

    const stripped = sanitizeSqlForValidation(sql);

    if (!stripped) return 'Query is empty';
    if (/;/.test(stripped.replace(/;$/, ''))) return 'Multiple SQL statements are not allowed';

    // Check for dangerous operations
    if (DANGEROUS_SQL.test(stripped)) {
        return 'Query contains disallowed SQL operations (only SELECT is allowed here)';
    }

    // Check for injection bypass patterns
    for (const pattern of INJECTION_BYPASS_PATTERNS) {
        if (pattern.test(stripped)) {
            log('WARN', 'Suspicious SQL pattern detected in EXPLAIN query', {
                pattern: pattern.toString(),
                queryLength: sql.length,
            });
            return 'Query contains suspicious patterns that may indicate SQL injection attempts';
        }
    }

    return null;
}

// Blocked for ALL users - these are critical security risks
const CRITICAL_BLOCKED =
    /\b(COPY\s+\S+\s+TO\s+PROGRAM|DROP\s+(DATABASE|SCHEMA)|ALTER\s+SYSTEM|CREATE\s+EXTENSION|pg_execute_server_program|pg_read_file|pg_write_file|pg_read_binary_file|pg_execute)\b/i;

// Additional restrictions for non-super_admin users
const CONSOLE_BLOCKED =
    /\b(DROP\s+(DATABASE|SCHEMA|ROLE|TABLESPACE)|CREATE\s+(DATABASE|ROLE|USER)|ALTER\s+(SYSTEM|ROLE\s+\S+\s+SUPERUSER)|COPY\s+\S+\s+(FROM|TO)\s+(STDIN|STDOUT|'|E')|LOAD\s+'|pg_read_file|pg_write_file|pg_read_binary_file)\b/i;

function validateConsoleQuery(sql, role) {
    if (!sql || typeof sql !== 'string') return 'Query must be a non-empty string';
    if (sql.length > 50_000) return 'Query too long (max 50,000 characters)';

    const stripped = sanitizeSqlForValidation(sql);
    // Also check with all whitespace collapsed to catch obfuscation attempts like DROP/***/DATABASE
    const collapsed = stripped.replace(/\s+/g, ' ');

    // Check critical blocks for ALL users (including super_admin)
    if (CRITICAL_BLOCKED.test(stripped) || CRITICAL_BLOCKED.test(collapsed)) {
        log('ERROR', 'Critical SQL blocked for user', { role, queryLength: sql.length });
        return 'This statement is blocked - it poses a critical security risk and cannot be executed.';
    }

    // Check for injection bypass patterns
    for (const pattern of INJECTION_BYPASS_PATTERNS) {
        if (pattern.test(stripped)) {
            log('WARN', 'Suspicious SQL pattern detected in console query', {
                role,
                pattern: pattern.toString(),
                queryLength: sql.length,
            });
        }
    }

    // Additional role-based restrictions for non-super_admin users
    if (role !== 'super_admin' && CONSOLE_BLOCKED.test(stripped)) {
        return 'This statement is blocked for your role. Contact a super_admin.';
    }

    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN LOCKOUT
// ─────────────────────────────────────────────────────────────────────────────
const loginAttempts = new Map();
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// Cleanup stale login attempt records every 5 minutes (skip on Vercel — stateless)
if (process.env.VERCEL !== '1') {
    setInterval(() => {
        const now = Date.now();
        for (const [key, record] of loginAttempts) {
            if (now - record.windowStart > 30 * 60_000) loginAttempts.delete(key);
        }
    }, 300_000);
}

function recordLoginAttempt(username, success) {
    const now = Date.now();
    const record = loginAttempts.get(username) || { count: 0, windowStart: now };
    if (now - record.windowStart > LOGIN_WINDOW_MS) {
        record.count = 0;
        record.windowStart = now;
    }
    if (success) {
        loginAttempts.delete(username);
        return;
    }
    record.count++;
    trimMapToCap(loginAttempts, 20_000);
    loginAttempts.set(username, record);
}

function isLoginLocked(username) {
    const record = loginAttempts.get(username);
    if (!record) return false;
    if (Date.now() - record.windowStart > LOGIN_WINDOW_MS) {
        loginAttempts.delete(username);
        return false;
    }
    return record.count >= LOGIN_MAX_ATTEMPTS;
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERT ENGINE & EMAIL
// ─────────────────────────────────────────────────────────────────────────────
const emailService = new EmailNotificationService(CONFIG.EMAIL);
let connectionHealth = null;
// Connections already warned about, so the log says it once per outage
// rather than every 30 seconds.
const _credWarned = new Set();

/**
 * Databases the alert engine should monitor: the ones the user connected, not
 * the control plane. Returns { id, name, pool } per connection, skipping any
 * whose pool cannot be opened (bad credentials, host down) — connectionHealth
 * reports those separately, so failing here would double-alert.
 */
async function alertMonitoringTargets() {
    await syncConnectionsCache().catch(() => {});
    const targets = [];
    for (const conn of CONNECTIONS) {
        const dbType = String(conn.dbType || 'postgresql').toLowerCase();
        if (!dbType.startsWith('postgres')) continue; // rules are Postgres-specific

        // rowToConn() nulls the password when decryption fails (usually because
        // ENCRYPTION_KEY changed). getPool() would still succeed — pg creates
        // pools lazily — and every query would then fail with
        // "SASL: client password must be a string" once per cycle, forever.
        // Skip it here instead; connectionHealth reports the real cause once.
        if (!conn.password) {
            if (!_credWarned.has(conn.id)) {
                _credWarned.add(conn.id);
                log('WARN', 'Skipping connection for alert monitoring — credentials unusable', {
                    connection: conn.name,
                    hint: 'Re-enter the password in the UI to re-encrypt it under the current ENCRYPTION_KEY.',
                });
            }
            continue;
        }
        _credWarned.delete(conn.id); // recovered — allow a fresh warning later

        try {
            targets.push({ id: conn.id, name: conn.name, pool: await getPool(conn.id) });
        } catch (err) {
            log('DEBUG', 'Skipping unreachable connection for alert monitoring', {
                connection: conn.name, error: err.message,
            });
        }
    }
    return targets;
}

const _alertEngine = pool
    ? new EnhancedAlertEngine(pool, CONFIG, emailService, alertMonitoringTargets)
    : null;

// Null-safe proxy: if no admin DB, alert methods return empty/noop results
const alerts = _alertEngine || {
    monitoringInterval: null,
    async getRecent() {
        return [];
    },
    async getStatistics() {
        return { total: 0, acknowledged: 0, unacknowledged: 0 };
    },
    async acknowledge() {
        return { success: false, error: 'No admin database configured' };
    },
    async bulkAcknowledge() {
        return [];
    },
    async escalate() {
        return { ok: false, paged: 0, error: 'No admin database configured' };
    },
    async fire() {
        return { id: null };
    },
    async cleanup() {
        return 0;
    },
    async runMonitoring() {},
    async initializeDatabase() {},
    startMonitoring() {},
    stopMonitoring() {},
    addSubscriber() {},
    removeSubscriber() {},
};

// ─────────────────────────────────────────────────────────────────────────────
// QUERY HISTORY
// ─────────────────────────────────────────────────────────────────────────────
const queryHistory = {
    entries: [],
    add(e) {
        this.entries.unshift({ id: uuid(), ts: new Date().toISOString(), favourite: false, ...e });
        if (this.entries.length > 200) this.entries.pop();
    },
    list(limit) {
        return this.entries.slice(0, limit);
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTIONS — persisted in the app database (fathom_connections table)
// Using the DB instead of a JSON file ensures data survives Vercel cold-starts,
// is scoped per-user, and is never accidentally recreated after deletion.
// ─────────────────────────────────────────────────────────────────────────────

/** Ensure the fathom_connections table exists (idempotent) */
async function ensureConnectionsTable() {
    if (!pool) throw new Error('Admin database not configured');
    // 1. Guarantee the schema exists before touching any table inside it.
    await pool.query(`CREATE SCHEMA IF NOT EXISTS pgmonitoringtool`);

    // 2. Create the table with user_id as a plain INTEGER so this succeeds even
    //    when the users table hasn't been provisioned yet.  The FK is added as a
    //    separate best-effort step below so it never blocks table creation.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS pgmonitoringtool.fathom_connections (
            id          SERIAL      PRIMARY KEY,
            user_id     INTEGER,
            name        TEXT        NOT NULL,
            host        TEXT        NOT NULL DEFAULT '',
            port        INTEGER     NOT NULL DEFAULT 5432,
            db_name     TEXT        NOT NULL DEFAULT 'postgres',
            username    TEXT        NOT NULL DEFAULT 'postgres',
            password    TEXT        NOT NULL DEFAULT '',
            ssl         BOOLEAN     NOT NULL DEFAULT false,
            ssh_enabled BOOLEAN     NOT NULL DEFAULT false,
            ssh_host    TEXT        NOT NULL DEFAULT '',
            ssh_port    INTEGER     NOT NULL DEFAULT 22,
            ssh_user    TEXT        NOT NULL DEFAULT '',
            ssh_auth_type   TEXT    NOT NULL DEFAULT 'key',
            ssh_private_key TEXT    NOT NULL DEFAULT '',
            ssh_passphrase  TEXT    NOT NULL DEFAULT '',
            ssh_password    TEXT    NOT NULL DEFAULT '',
            is_default  BOOLEAN     NOT NULL DEFAULT false,
            status      TEXT,
            last_tested TIMESTAMPTZ,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (user_id, name)
        )
    `);

    // 3. Best-effort: attach FK to users only when that table already exists.
    //    A missing users table (fresh DB, different init order) must never
    //    prevent fathom_connections from being usable.
    try {
        await pool.query(`
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'pgmonitoringtool' AND table_name = 'users'
                ) AND NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE table_schema   = 'pgmonitoringtool'
                      AND table_name     = 'fathom_connections'
                      AND constraint_type = 'FOREIGN KEY'
                      AND constraint_name = 'fathom_connections_user_id_fkey'
                ) THEN
                    ALTER TABLE pgmonitoringtool.fathom_connections
                        ADD CONSTRAINT fathom_connections_user_id_fkey
                        FOREIGN KEY (user_id)
                        REFERENCES pgmonitoringtool.users(id)
                        ON DELETE CASCADE;
                END IF;
            END $$
        `);
    } catch {
        /* users table not yet available — FK will be added on next startup */
    }

    // 4. Add db_type column if it doesn't exist (backward compatibility)
    try {
        await pool.query(`
            ALTER TABLE pgmonitoringtool.fathom_connections
            ADD COLUMN IF NOT EXISTS db_type TEXT NOT NULL DEFAULT 'postgresql'
        `);
    } catch {
        /* Column may already exist */
    }
}

/** Convert a DB row → the shape the rest of the code (and frontend) expects */
function rowToConn(row) {
    // Decrypt sensitive fields if they are encrypted; handle backward compatibility
    let password = row.password;
    let sshPrivateKey = row.ssh_private_key;
    let sshPassphrase = row.ssh_passphrase;
    let sshPassword = row.ssh_password;

    try {
        if (password && isEncrypted(password)) {
            password = decrypt(password);
        }
        if (sshPrivateKey && isEncrypted(sshPrivateKey)) {
            sshPrivateKey = decrypt(sshPrivateKey);
        }
        if (sshPassphrase && isEncrypted(sshPassphrase)) {
            sshPassphrase = decrypt(sshPassphrase);
        }
        if (sshPassword && isEncrypted(sshPassword)) {
            sshPassword = decrypt(sshPassword);
        }
    } catch (error) {
        log('WARN', 'Decryption failed for connection, credentials need re-entry', { error: error.message });
        password = null;
        sshPrivateKey = null;
        sshPassphrase = null;
        sshPassword = null;
    }

    return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        host: row.host,
        port: row.port,
        database: row.db_name,
        username: row.username,
        password: password,
        ssl: row.ssl,
        sshEnabled: row.ssh_enabled,
        sshHost: row.ssh_host,
        sshPort: row.ssh_port,
        sshUser: row.ssh_user,
        sshAuthType: row.ssh_auth_type,
        sshPrivateKey: sshPrivateKey,
        sshPassphrase: sshPassphrase,
        sshPassword: sshPassword,
        isDefault: row.is_default,
        status: row.status,
        lastTested: row.last_tested,
        createdAt: row.created_at,
        dbType: row.db_type || 'postgresql',
    };
}

/** Load all connections for a specific user from the database.
 *  Admin / super_admin pass userId=null to load all connections.
 */
async function dbLoadConnections(userId, role) {
    // Always scope to the user's own connections — admins see all connections
    // only through the /api/admin/connections endpoint, not in their personal pool
    const { rows } = await pool.query(
        'SELECT * FROM pgmonitoringtool.fathom_connections WHERE user_id = $1 ORDER BY id',
        [userId],
    );
    return rows.map(rowToConn);
}

/** Admin-only: load ALL connections across all users (for admin panel) */
async function dbLoadAllConnections() {
    const { rows } = await pool.query('SELECT * FROM pgmonitoringtool.fathom_connections ORDER BY id');
    return rows.map(rowToConn);
}

/** Persist a new connection; returns the saved row as a conn object */
async function dbInsertConnection(conn) {
    // Encrypt sensitive fields before storing
    const encryptedPassword = conn.password ? encrypt(conn.password) : null;
    const encryptedSshPrivateKey = conn.sshPrivateKey && conn.sshPrivateKey.trim() ? encrypt(conn.sshPrivateKey) : '';
    const encryptedSshPassphrase = conn.sshPassphrase && conn.sshPassphrase.trim() ? encrypt(conn.sshPassphrase) : '';
    const encryptedSshPassword = conn.sshPassword && conn.sshPassword.trim() ? encrypt(conn.sshPassword) : '';

    const { rows } = await pool.query(
        `
        INSERT INTO pgmonitoringtool.fathom_connections
            (user_id, name, host, port, db_name, username, password, ssl,
             ssh_enabled, ssh_host, ssh_port, ssh_user, ssh_auth_type,
             ssh_private_key, ssh_passphrase, ssh_password, is_default, status, last_tested, db_type)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        RETURNING *
    `,
        [
            conn.userId ?? null,
            conn.name,
            conn.host,
            conn.port,
            conn.database,
            conn.username,
            encryptedPassword,
            conn.ssl,
            conn.sshEnabled,
            conn.sshHost,
            conn.sshPort,
            conn.sshUser,
            conn.sshAuthType,
            encryptedSshPrivateKey,
            encryptedSshPassphrase,
            encryptedSshPassword,
            conn.isDefault,
            conn.status ?? null,
            conn.lastTested ?? null,
            conn.dbType ?? 'postgresql',
        ],
    );
    return rowToConn(rows[0]);
}

/** Update mutable fields of an existing connection */
async function dbUpdateConnection(id, fields) {
    // Encrypt sensitive fields before storing
    const encryptedPassword = fields.password ? encrypt(fields.password) : null;
    const encryptedSshPrivateKey =
        fields.sshPrivateKey && fields.sshPrivateKey.trim() ? encrypt(fields.sshPrivateKey) : null;
    const encryptedSshPassphrase =
        fields.sshPassphrase && fields.sshPassphrase.trim() ? encrypt(fields.sshPassphrase) : null;
    const encryptedSshPassword = fields.sshPassword && fields.sshPassword.trim() ? encrypt(fields.sshPassword) : null;
    // Note: null here is intentional for UPDATE — COALESCE($14, ssh_private_key) preserves existing value

    const { rows } = await pool.query(
        `
        UPDATE pgmonitoringtool.fathom_connections SET
            name        = COALESCE($2, name),
            host        = COALESCE($3, host),
            port        = COALESCE($4, port),
            db_name     = COALESCE($5, db_name),
            username    = COALESCE($6, username),
            password    = COALESCE($7, password),
            ssl         = COALESCE($8, ssl),
            ssh_enabled = COALESCE($9,  ssh_enabled),
            ssh_host    = COALESCE($10, ssh_host),
            ssh_port    = COALESCE($11, ssh_port),
            ssh_user    = COALESCE($12, ssh_user),
            ssh_auth_type    = COALESCE($13, ssh_auth_type),
            ssh_private_key  = COALESCE($14, ssh_private_key),
            ssh_passphrase   = COALESCE($15, ssh_passphrase),
            ssh_password     = COALESCE($16, ssh_password),
            is_default  = COALESCE($17, is_default),
            status      = $18,
            last_tested = $19,
            db_type     = COALESCE($20, db_type)
        WHERE id = $1
        RETURNING *
    `,
        [
            id,
            fields.name ?? null,
            fields.host ?? null,
            fields.port ?? null,
            fields.database ?? null,
            fields.username ?? null,
            encryptedPassword,
            fields.ssl ?? null,
            fields.sshEnabled ?? null,
            fields.sshHost ?? null,
            fields.sshPort ?? null,
            fields.sshUser ?? null,
            fields.sshAuthType ?? null,
            encryptedSshPrivateKey,
            encryptedSshPassphrase,
            encryptedSshPassword,
            fields.isDefault ?? null,
            fields.status ?? null,
            fields.lastTested ?? null,
            fields.dbType ?? null,
        ],
    );
    return rows[0] ? rowToConn(rows[0]) : null;
}

/** Delete a connection by ID */
async function dbDeleteConnection(id, userId) {
    // Safety: always scope delete by user_id to prevent cross-user deletion
    const result = await pool.query(
        'DELETE FROM pgmonitoringtool.fathom_connections WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, userId],
    );
    if (result.rowCount === 0) {
        throw new Error('Connection not found or not owned by user');
    }
}

/** Clear is_default for all connections belonging to a user, then set one */
async function dbSetDefault(userId, role, newDefaultId) {
    // Always scope by user_id — each user manages their own default connection
    await pool.query('UPDATE pgmonitoringtool.fathom_connections SET is_default = (id = $1) WHERE user_id = $2', [
        newDefaultId,
        userId,
    ]);
}

// In-memory cache rebuilt from DB on every request (no more stale global state)
// CONNECTIONS is kept for getPool() lookups — always refreshed from DB before use.
let CONNECTIONS = [];

/** Sync in-memory CONNECTIONS cache from DB for all connections (used by getPool) */
async function syncConnectionsCache() {
    if (!pool) return; // no admin DB — nothing to sync
    try {
        const { rows } = await pool.query('SELECT * FROM pgmonitoringtool.fathom_connections ORDER BY id');
        CONNECTIONS = rows.map(rowToConn);
    } catch {
        /* DB not reachable yet — leave cache as-is */
    }
}

/** Called once at startup to ensure table exists and warm the cache */
async function initConnections() {
    try {
        await ensureConnectionsTable();
        await syncConnectionsCache();
    } catch (e) {
        log('WARN', 'Could not initialise connections table', { error: e.message });
    }
}

// Track whether the table has been created in this process instance.
// On Vercel serverless, startup() is never called so we lazily create the
// table on the first incoming connection-API request instead.
let _connectionsTableReady = false;

// Middleware: ensure table exists (lazy, idempotent) then refresh cache
const ensureConnections = async (req, res, next) => {
    try {
        if (!_connectionsTableReady) {
            await ensureConnectionsTable();
            await syncConnectionsCache();
            _connectionsTableReady = true;
        }
        // Skip redundant sync — dbLoadConnections() queries fresh data anyway,
        // and resolveConnection() falls back to sync when a conn isn't in cache.
        next();
    } catch (err) {
        next(err);
    }
};

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

// ─────────────────────────────────────────────────────────────────────────────
// CSRF Token Storage (in-memory with TTL, for double-submit cookie pattern)
// ─────────────────────────────────────────────────────────────────────────────
// NOTE (audit H-2): this store is per-process and does NOT survive Vercel's
// serverless instances. The CSRF middleware below therefore treats a token
// MISS as "not presented" (falling back to Origin/Referer proof) rather than a
// hard 403, so cross-instance token misses don't lock out legitimate users.
// For strong, store-independent CSRF, back this with Redis or move to a
// stateless signed double-submit token (HMAC of sid+expiry).
const csrfTokens = new Map();
const CSRF_TOKEN_TTL = 1 * 60 * 60 * 1000; // 1 hour
// Hard size cap so an unbounded flood of token requests (or a long-lived
// Vercel instance with no sweep) can't grow this Map without bound. Map
// iteration order is insertion order, so we drop the oldest first.
const CSRF_TOKEN_MAX = 10_000;

/**
 * Drop oldest entries from a Map until its size is at or below `cap`.
 * Safe to call after every insertion as a cheap upper bound — Map iteration
 * is O(n) only in the size of the overflow, not the whole map.
 */
function trimMapToCap(map, cap) {
    if (map.size <= cap) return;
    const toDrop = map.size - cap;
    let i = 0;
    for (const k of map.keys()) {
        if (i >= toDrop) break;
        map.delete(k);
        i++;
    }
}

// Cleanup stale CSRF tokens every 10 minutes
if (process.env.VERCEL !== '1') {
    setInterval(
        () => {
            const now = Date.now();
            for (const [token, metadata] of csrfTokens) {
                if (now - metadata.createdAt > CSRF_TOKEN_TTL) {
                    csrfTokens.delete(token);
                }
            }
        },
        10 * 60 * 1000,
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CSRF Protection for state-changing requests
// ─────────────────────────────────────────────────────────────────────────────
// Threat model (audit H-1/H-2): the API now supports BOTH `Authorization: Bearer`
// and an httpOnly auth cookie. Browsers attach the cookie automatically on
// cross-site requests, so cookie-authenticated state changes need real CSRF
// protection. Bearer-header requests are inherently CSRF-safe because a
// cross-site page cannot set a custom request header (CORS forbids it without a
// preflight the attacker can't satisfy).
//
// Rule for POST/PUT/PATCH/DELETE:
//   1. If an Origin header is present, it MUST be an allowed origin.
//   2. If the request is authenticated by COOKIE (and not by a Bearer header),
//      require proof of same-origin intent: a trusted Origin/Referer OR a valid
//      X-CSRF-Token. Reject when BOTH are absent.
//   3. Bearer-header requests pass (header itself is the anti-CSRF proof).
//
// The CSRF token store is per-process and does not survive Vercel's serverless
// instances, so a token MISS is treated as "not presented" rather than a hard
// failure — Origin/Referer is the reliable signal in that environment. The
// token path still adds defense-in-depth for same-process clients.
const CSRF_SAFE_PATHS = new Set([
    'POST /api/auth/login', // pre-auth; no cookie/session yet
]);

function isTrustedOrigin(value) {
    if (!value) return false;
    try {
        // Origin is a bare origin; Referer is a full URL — normalise both.
        const u = new URL(value);
        const origin = `${u.protocol}//${u.host}`;
        return CONFIG.CORS_ORIGINS.includes(origin);
    } catch {
        return false;
    }
}

app.use((req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    if (CSRF_SAFE_PATHS.has(`${req.method} ${req.path}`)) return next();

    const origin = req.headers.origin;
    // (1) An explicit, disallowed Origin is always rejected.
    if (origin && !CONFIG.CORS_ORIGINS.includes(origin)) {
        return res.status(403).json({ error: 'CSRF: Origin not allowed' });
    }

    const hasBearer = req.headers.authorization?.startsWith('Bearer ');
    const hasAuthCookie = typeof req.headers.cookie === 'string' && req.headers.cookie.includes('fathom_token=');
    const csrfToken = req.headers['x-csrf-token'];

    // (2) Validate the CSRF token if one is supplied (double-submit pattern).
    // A miss is non-fatal on serverless (store isn't shared); see note above.
    let csrfTokenValid = false;
    if (csrfToken) {
        const metadata = csrfTokens.get(csrfToken);
        if (metadata && Date.now() - metadata.createdAt <= CSRF_TOKEN_TTL) {
            csrfTokenValid = true;
            csrfTokens.delete(csrfToken); // single-use
        }
    }

    // (3) Cookie-authenticated (and NOT bearer): require same-origin proof.
    if (hasAuthCookie && !hasBearer) {
        const sameOriginProof = isTrustedOrigin(origin) || isTrustedOrigin(req.headers.referer) || csrfTokenValid;
        if (!sameOriginProof) {
            log('WARN', 'CSRF: cookie-auth state change without same-origin proof', {
                ip: req.ip,
                path: req.path,
                method: req.method,
            });
            return res.status(403).json({
                error: 'CSRF check failed: missing Origin/Referer or CSRF token',
            });
        }
    }

    next();
});

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
app.use(
    ['/api/slack/commands', '/api/slack/events'],
    express.raw({ type: '*/*', limit: '256kb' }),
);

app.use(express.json({ limit: '100kb' }));
app.use(express.text({ limit: '100kb' }));
app.use(rateLimiter);

// ── Structured request logging (pino-http). Replaces the previous
//    dev-only inline logger; logs all environments with level by status.
app.use(httpLogger());

// Build the raw JWT/API-key authenticator, then wrap it so every protected
// route also enforces the "must change password" flag. We expose the wrapped
// version under the name `authenticate` — every existing `app.get(...,
// authenticate, ...)` in this file picks up the password gate for free.
const _rawAuthenticate = buildAuthenticate(pool, CONFIG);
const _enforcePwChange = pool ? buildEnforcePasswordChange(pool) : (_req, _res, next) => next();
const authenticate = function authenticate(req, res, next) {
    _rawAuthenticate(req, res, (err) => {
        if (err) return next(err);
        if (res.headersSent) return; // 401/403 already sent
        _enforcePwChange(req, res, next);
    });
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTH — POST /api/auth/logout
// Revokes the current session (so the JWT can no longer pass the revocation
// check) and clears the httpOnly auth cookie. Safe to call with either cookie
// or header auth.
// ─────────────────────────────────────────────────────────────────────────────
// ── GET /api/auth/me — cookie-based session recovery ─────────────────────────
// Called on page load when localStorage token is absent/expired but the
// httpOnly session cookie may still be valid. Returns fresh user + token.
app.get('/api/auth/me', authenticate, async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT id, username, email, role, allowed_screens FROM pgmonitoringtool.users WHERE id = $1 LIMIT 1',
            [req.user.id],
        );
        if (!rows[0]) return res.status(404).json({ error: 'User not found' });
        const user = rows[0];

        // SEC: this endpoint used to mint its OWN token, and got four things
        // wrong doing it — it signed with `process.env.JWT_SECRET || 'changeme'`
        // (bypassing the startup guard above), omitted the audience/issuer
        // claims that authenticate() verifies, omitted the `sid` claim that the
        // revocation check requires, and wrote the result to a cookie named
        // `fathom_session` which readAuthCookie() never reads. The token it
        // returned could therefore never authenticate a subsequent request.
        //
        // The correct behaviour: this request ALREADY carried a valid, non-
        // revoked token (authenticate ran ahead of us). Echo that same token
        // back and refresh its cookie — do not mint a new one, and do not
        // create a second session row on every page load.
        const header = req.headers.authorization;
        const token = (header?.startsWith('Bearer ') ? header.slice(7) : null) || readAuthCookie(req);

        if (!token) {
            // Reached when the caller authenticated with an X-API-Key rather
            // than a JWT. There is no session token to echo or refresh, so
            // return the profile alone instead of a null credential.
            return res.json({ user, token: null });
        }

        // Refresh the httpOnly cookie so an active user's cookie TTL tracks the
        // JWT's remaining lifetime rather than expiring earlier.
        const remainingMs = req.user?.exp ? req.user.exp * 1000 - Date.now() : undefined;
        setAuthCookie(res, token, Number.isFinite(remainingMs) && remainingMs > 0 ? remainingMs : undefined);

        res.json({ user, token });
    } catch (e) {
        log('ERROR', '/api/auth/me error', { error: e.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/auth/logout', authenticate, async (req, res) => {
    // Server-side revocation is the part that makes logout mean anything: the
    // JWT stays cryptographically valid until it expires, so if the session row
    // is not marked inactive the token keeps working after "logout".
    //
    // This used to be `.catch(() => {})` and still returned `{success: true}`.
    // On the deployed database revokeSession throws 42703 (revoked_at/revoked_by
    // do not exist), so every logout has been silently failing while reporting
    // success. 11 of 12 sessions sit flagged is_active with expiry in the past —
    // the signature of revocation never once running.
    let revoked = false;
    try {
        if (pool && req.user?.sid) {
            revoked = await revokeSession(pool, req.user.sid, req.user.id);
        }
    } catch (err) {
        swallow(err, { component: 'session', op: 'revokeSession', sid: req.user?.sid, userId: req.user?.id });
    } finally {
        // Always clear the cookie: the local credential goes regardless of
        // whether the server-side row could be updated.
        clearAuthCookie(res);
    }

    // Report honestly. The client still treats this as a successful logout —
    // the cookie is gone — but `revoked` tells the caller (and anyone reading
    // logs or tests) whether the session was actually killed server-side.
    res.json({ success: true, revoked });
});

// ─────────────────────────────────────────────────────────────────────────────
// CSRF Token Endpoint
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/csrf-token', authenticate, (req, res) => {
    // Generate a random CSRF token
    trimMapToCap(csrfTokens, CSRF_TOKEN_MAX);
    const token = randomUUID();
    csrfTokens.set(token, { createdAt: Date.now() });
    res.json({ csrfToken: token });
});

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '3.0.0',
        alerts: { monitoring: alerts.monitoringInterval !== null },
    }),
);

// ─────────────────────────────────────────────────────────────────────────────
// AUTH HELPERS — shared by /api/auth/login and future SSO callbacks
// ─────────────────────────────────────────────────────────────────────────────
// Note: a hardcoded NEW_SCREENS union used to be applied here, granting every
// authenticated user implicit access to ~80 admin/demo screens regardless of
// role. That broke requireScreen() RBAC. The list has been removed — a user's
// allowed_screens column is now the sole source of truth. To grant a user
// access to a new screen, update their row in pgmonitoringtool.users (see
// userService.updateUser → allowedScreens).

/**
 * Create a session row, build a JWT payload, sign the JWT, and run the
 * post-login bookkeeping tasks (touchLastLogin, recordLogin, writeAudit).
 * Failures in the bookkeeping tasks are logged but do not fail the login.
 *
 * @param {{
 *   user: any,
 *   req: import('express').Request,
 *   source: 'password' | 'sso',
 *   provider?: string,           // SSO provider name when source === 'sso'
 *   deviceLabelFallback?: string // device label when no UA header is present
 * }} args
 * @returns {Promise<{ token: string, payload: any, sessionId: string }>}
 */
async function issueSession({ user, req, source, provider, deviceLabelFallback }) {
    const sessionId = await createSession(pool, {
        userId: user.id,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        deviceLabel: req.headers['user-agent']?.slice(0, 255) ?? (deviceLabelFallback || 'Unknown'),
        location: null,
    });

    const allowedScreens = [...new Set(user.allowed_screens ?? [])];

    const payload = {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        accessLevel: user.access_level,
        allowedScreens,
        sid: sessionId,
    };

    const token = jwt.sign(payload, CONFIG.JWT_SECRET, {
        expiresIn: CONFIG.JWT_EXPIRES_IN,
        audience: CONFIG.JWT_AUDIENCE,
        issuer: CONFIG.JWT_ISSUER,
    });

    const auditAction = source === 'sso' ? 'SSO_LOGIN_SUCCESS' : 'LOGIN_SUCCESS';
    const auditDetail =
        source === 'sso' ? `Logged in via ${provider || 'unknown'}` : req.headers['user-agent']?.slice(0, 120) || '';

    const postTasks = [
        ['touchLastLogin', touchLastLogin(pool, user.id)],
        ['recordLogin', recordLogin(pool, user.id)],
        [
            'writeAudit',
            writeAudit(pool, {
                actorId: user.id,
                actorUsername: user.username,
                action: auditAction,
                level: 'info',
                detail: auditDetail,
                ip: req.ip,
            }),
        ],
    ];
    const results = await Promise.allSettled(postTasks.map(([, p]) => p));
    results.forEach((r, i) => {
        if (r.status === 'rejected') {
            const [name] = postTasks[i];
            log('WARN', `Post-login task '${name}' failed`, {
                task: name,
                source,
                provider,
                error: r.reason?.message,
                userId: user.id,
            });
        }
    });

    return { token, payload, sessionId };
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH — POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', strictRateLimiter(15 * 60_000, 10), async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'username and password are required' });
    }
    if (typeof username !== 'string' || username.length > 128) {
        return res.status(400).json({ error: 'Invalid username' });
    }
    if (typeof password !== 'string' || password.length > 256) {
        return res.status(400).json({ error: 'Invalid password' });
    }

    // If no admin database pool is available, authentication is impossible
    if (!pool && IS_PROD) {
        return res.status(503).json({
            error: 'Authentication service unavailable',
            detail: 'Admin database is not configured. Set DATABASE_URL in environment variables.',
        });
    }

    if (isLoginLocked(username)) {
        return res.status(429).json({ error: 'Too many failed login attempts. Try again in 15 minutes.' });
    }

    try {
        // SEC-02 (audit): The hardcoded admin/admin123 demo-login fallback was
        // removed. Authentication ALWAYS goes through the admin database; if
        // DATABASE_URL is unset the request returns 503 above.
        const user = await getUserByUsername(pool, username);

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            recordLoginAttempt(username, false);
            if (user) {
                await recordFailedLogin(pool, user.id).catch((err) =>
                    log('WARN', 'recordFailedLogin failed', { userId: user.id, error: err.message }),
                );
                await writeAudit(pool, {
                    actorId: user.id,
                    actorUsername: username,
                    action: 'LOGIN_FAILED',
                    level: 'warn',
                    detail: 'Invalid credentials',
                    ip: req.ip,
                }).catch((err) =>
                    log('WARN', 'writeAudit LOGIN_FAILED failed', { userId: user.id, error: err.message }),
                );
            }
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ error: `Account is ${user.status}` });
        }

        recordLoginAttempt(username, true);
        const { token, payload } = await issueSession({
            user,
            req,
            source: 'password',
        });

        // Also set the JWT as an httpOnly cookie so the frontend can stop
        // storing it in localStorage (XSS-exfiltratable). The token is still
        // returned in the body for backward compatibility during migration.
        setAuthCookie(res, token);

        res.json({
            token,
            user: payload,
            mustChangePassword: user.must_change_password || user.password_changed_at == null || false,
        });
    } catch (err) {
        // The real error (message, stack, pg code) is logged server-side; the
        // response deliberately omits `detail` — this is an UNAUTHENTICATED
        // endpoint and echoing err.message here leaked Postgres internals to any
        // caller (audit 2026-07-02 M-2 / 2026-07-24). requestId lets an operator
        // correlate the client-visible failure with the server log.
        log('ERROR', 'Login error', { error: err.message, stack: err.stack, code: err.code, requestId: req.id });
        res.status(500).json({ error: 'Login failed', requestId: req.id });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// SSO — removed. The legacy /api/auth/sso/:provider* routes and the
// /api/auth/sso/exchange endpoint used to log anyone in as the local `admin`
// user (the callback hardcoded { email: 'admin@company.com' } and did no IdP
// roundtrip). Production SSO lives in routes/samlRoutes.js (mounted at
// /api/saml/...). If you need an OIDC fallback, add a route here that fully
// validates the provider's code/state and never returns a token tied to a
// hardcoded local account.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD MANAGEMENT — Change Password
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/auth/change-password', strictRateLimiter(15 * 60_000, 10), authenticate, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
        return res.status(400).json({ error: 'Password must contain lowercase, uppercase, and numbers' });
    }

    try {
        const user = await getUserByUsername(pool, req.user.username);
        if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // bcrypt cost 12 matches services/userService.js — keep all password
        // hashing across the codebase at the same cost factor.
        const newPasswordHash = await bcrypt.hash(newPassword, 12);
        const result = await pool.query(
            'UPDATE pgmonitoringtool.users SET password_hash = $1, must_change_password = false, password_changed_at = NOW() WHERE id = $2 RETURNING id, username, email',
            [newPasswordHash, userId],
        );
        // The flag this clears is cached per user in enforcePasswordChange;
        // without this the block would persist for up to the TTL after the
        // user has done exactly what it asked.
        invalidatePasswordChangeCache(userId);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        log('INFO', 'Password changed', { userId, username: req.user.username });
        await writeAudit(pool, {
            actorId: userId,
            actorUsername: req.user.username,
            action: 'PASSWORD_CHANGED',
            level: 'info',
            detail: 'User changed their password',
            ip: req.ip,
        }).catch((err) => log('WARN', 'writeAudit PASSWORD_CHANGED failed', { userId, error: err.message }));

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        log('ERROR', 'Change password error', { error: err.message, userId });
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD MANAGEMENT — Forgot Password (Request Reset) — DB-backed tokens
// ─────────────────────────────────────────────────────────────────────────────

// Rate-limit: 5 attempts per 15 minutes per IP+path. Even if an attacker
// rotates user identifiers, they can't grind through a list quickly.
app.post('/api/auth/forgot-password', strictRateLimiter(15 * 60_000, 5), async (req, res) => {
    const { email, username } = req.body || {};

    if (!email && !username) {
        return res.status(400).json({ error: 'Email or username is required' });
    }

    // SEC: equalize response timing between "user exists" (DB insert) and
    // "user does not exist" (no insert) so an attacker can't enumerate
    // accounts by measuring response latency. We always do the DB lookup,
    // and when the user is missing we still wait at least as long as the
    // typical insert path would take before returning.
    const MIN_RESPONSE_MS = 250;
    const startedAt = Date.now();

    const finishWithGenericSuccess = async (devToken) => {
        const elapsed = Date.now() - startedAt;
        if (elapsed < MIN_RESPONSE_MS) {
            await new Promise((r) => setTimeout(r, MIN_RESPONSE_MS - elapsed));
        }
        res.json({
            success: true,
            message: 'If the account exists, a reset link has been sent.',
            // Debug only — never exposed in production. The dev convenience
            // also leaks the existence of the account in non-prod environments;
            // do not log it anywhere else.
            ...(devToken && process.env.NODE_ENV !== 'production' && { resetToken: devToken }),
        });
    };

    try {
        // Find user by email or username
        let user;
        if (email) {
            const result = await pool.query(
                'SELECT id, username, email FROM pgmonitoringtool.users WHERE email = $1 AND status = $2',
                [email, 'active'],
            );
            user = result.rows[0];
        } else {
            user = await getUserByUsername(pool, username);
        }

        if (!user) {
            log('INFO', 'Password reset requested for non-existent account', { email, username });
            return finishWithGenericSuccess(null);
        }

        // Generate reset token and persist to DB
        const token = uuid();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        await pool.query(
            `INSERT INTO pgmonitoringtool.password_reset_tokens (user_id, token, expires_at)
             VALUES ($1, $2, $3)`,
            [user.id, token, expiresAt],
        );

        log('INFO', 'Password reset token generated (DB)', { userId: user.id, username: user.username });

        // In production, send email here with reset link
        return finishWithGenericSuccess(token);
    } catch (err) {
        log('ERROR', 'Forgot password error', { error: err.message });
        res.status(500).json({ error: 'Failed to process reset request' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD MANAGEMENT — Reset Password (Using DB-backed Token)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/auth/reset-password', strictRateLimiter(15 * 60_000, 5), async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ error: 'token and newPassword are required' });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
        return res.status(400).json({ error: 'Password must contain lowercase, uppercase, and numbers' });
    }

    try {
        // Look up token in DB (unused + not expired)
        const tokenResult = await pool.query(
            `SELECT id, user_id, expires_at FROM pgmonitoringtool.password_reset_tokens
             WHERE token = $1 AND used = false`,
            [token],
        );
        const tokenData = tokenResult.rows[0];

        if (!tokenData) {
            log('WARN', 'Invalid password reset token', {});
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        if (new Date() > new Date(tokenData.expires_at)) {
            // Mark as used so it can't be retried
            await pool.query('UPDATE pgmonitoringtool.password_reset_tokens SET used = true WHERE id = $1', [
                tokenData.id,
            ]);
            log('WARN', 'Password reset token expired', { userId: tokenData.user_id });
            return res.status(400).json({ error: 'Reset token has expired' });
        }

        // Update password — bcrypt cost 12 (matches services/userService.js).
        const newPasswordHash = await bcrypt.hash(newPassword, 12);
        const result = await pool.query(
            'UPDATE pgmonitoringtool.users SET password_hash = $1, must_change_password = false, password_changed_at = NOW() WHERE id = $2 RETURNING id, username',
            [newPasswordHash, tokenData.user_id],
        );
        invalidatePasswordChangeCache(tokenData.user_id);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Invalidate token in DB
        await pool.query('UPDATE pgmonitoringtool.password_reset_tokens SET used = true WHERE id = $1', [tokenData.id]);

        log('INFO', 'Password reset completed', { userId: tokenData.user_id, username: result.rows[0].username });
        await writeAudit(pool, {
            actorId: tokenData.user_id,
            actorUsername: result.rows[0].username,
            action: 'PASSWORD_RESET',
            level: 'info',
            detail: 'Password reset via token',
            ip: req.ip,
        }).catch((err) =>
            log('WARN', 'writeAudit PASSWORD_RESET failed', { userId: tokenData.user_id, error: err.message }),
        );

        res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
    } catch (err) {
        log('ERROR', 'Reset password error', { error: err.message });
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

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
    //    Carries its own `X-Fathom-Ingest-Token` gate so SDKs can post
    //    without a user JWT; falls back to authenticate() when unset.
    // auto_explain ingest + Log Insights (recent, summary, plan regressions)
    app.use(prefix, autoExplainRoutes(pool, authenticate, sdkKeyAuth));
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
                    const { runAgentSweep } = await import('./services/agentLoopService.js');
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
            async (connection) => {
                // Returns a CONNECTED adapter instance for the given connection.
                // For the 9 Phase-5 engines the factory handles driver resolution;
                // for mysql/mongo/postgres we just reuse the existing pools via
                // getPool / getMongoClient — callers branch on dbType.
                const cfg = await resolvePoolConfig(connection);
                const adapter = getDbAdapter(connection.dbType, {
                    host: cfg.host,
                    port: cfg.port,
                    database: cfg.database,
                    user: cfg.user,
                    username: cfg.user,
                    password: cfg.password,
                    ssl: cfg.ssl,
                    account: cfg.host, // Snowflake alias
                    projectId: cfg.host, // BigQuery alias
                    region: cfg.host, // DynamoDB alias
                    keyspace: cfg.database,
                    contactPoints: cfg.host ? [cfg.host] : undefined,
                });
                await adapter.connect();
                return adapter;
            },
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
            async (connection) => {
                const cfg = await resolvePoolConfig(connection);
                const adapter = getDbAdapter(connection.dbType, {
                    host: cfg.host,
                    port: cfg.port,
                    database: cfg.database,
                    user: cfg.user,
                    username: cfg.user,
                    password: cfg.password,
                    ssl: cfg.ssl,
                    account: cfg.host,
                    projectId: cfg.host,
                    region: cfg.host,
                    keyspace: cfg.database,
                    contactPoints: cfg.host ? [cfg.host] : undefined,
                });
                await adapter.connect();
                return adapter;
            },
        ),
    );

    // Engine-agnostic reclaimable-storage advisor (MySQL InnoDB data_free;
    // supported:false elsewhere). Same connection + adapter resolution as wait events.
    app.use(
        '/api',
        storageAdvisorRoutes(
            authenticate,
            async (req, connectionId) => resolveConnection(connectionId, req.user?.id),
            async (connection) => {
                const cfg = await resolvePoolConfig(connection);
                const adapter = getDbAdapter(connection.dbType, {
                    host: cfg.host,
                    port: cfg.port,
                    database: cfg.database,
                    user: cfg.user,
                    username: cfg.user,
                    password: cfg.password,
                    ssl: cfg.ssl,
                    account: cfg.host,
                    projectId: cfg.host,
                    region: cfg.host,
                    keyspace: cfg.database,
                    contactPoints: cfg.host ? [cfg.host] : undefined,
                });
                await adapter.connect();
                return adapter;
            },
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
app.use(mysqlRoutes(pool, authenticate, getPool, CONNECTIONS));
app.use(mongoRoutes(pool, authenticate, getMongoClient, CONNECTIONS));
app.use(observabilityIngestRoutes(pool, authenticate));
app.use(syntheticRoutes(pool, authenticate));
app.use(kmsRoutes(pool, authenticate, requireRole));
app.use(erdRoutes(pool, authenticate, reqPool));

// ── Scheduled audit-log export (no-op when AUDIT_EXPORT_BUCKET unset) ────────
if (process.env.AUDIT_EXPORT_ENABLED !== 'false') {
    scheduleAuditExport();
}

// ── A3: Postgres wait-event sampler ─────────────────────────────────────────
// Polls pg_stat_activity at 1 Hz across registered Postgres connections.
// Skipped on Vercel and in tests; moves to the worker tier in B1.
if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'test' && process.env.FATHOM_WAIT_EVENTS !== 'off') {
    (async () => {
        try {
            const { startWaitEventSampler } = await import('./services/waitEventSampler.js');
            startWaitEventSampler({ pool, getPool });
        } catch (err) {
            log('WARN', `Wait-event sampler not started: ${err.message}`);
        }
    })();
}

// ── A5: copilot history retention sweep ─────────────────────────────────────
// Even though saveConversationTurn redacts user input on write (HIGH-4),
// no redactor is perfect. A time-bounded TTL caps exposure of any
// regulated identifier that slipped through. See backend/docs/COPILOT_RETENTION.md.
//
// Runs daily at 04:07 UTC (odd minute avoids top-of-hour stampede with the
// audit-export cron). Skipped on Vercel because we have no long-lived
// process there — once B1 splits the worker tier, this moves to worker.js.
if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'test') {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const scheduleCopilotPurge = async () => {
        try {
            const { purgeOldConversations, COPILOT_HISTORY_MAX_AGE_DAYS } =
                await import('./services/copilotService.js');
            const tick = async () => {
                try {
                    const removed = await purgeOldConversations();
                    if (removed > 0) {
                        log(
                            'INFO',
                            `Copilot retention sweep removed ${removed} turn(s) older than ${COPILOT_HISTORY_MAX_AGE_DAYS}d`,
                        );
                    }
                } catch (err) {
                    log('WARN', `Copilot retention sweep failed: ${err.message}`);
                }
            };
            // Fire once at startup (small lag) then daily after that.
            setTimeout(tick, 30_000).unref?.();
            const handle = setInterval(tick, ONE_DAY_MS);
            handle.unref?.();
        } catch (err) {
            log('WARN', `Copilot retention sweep not scheduled: ${err.message}`);
        }
    };
    scheduleCopilotPurge();
}

// ── Metric rollup + tiered retention sweep (B-3) ─────────────────────────────
// Downsample raw otel_metrics into hourly/daily rollups so long history is kept
// at lower resolution instead of deleted. Rollups run hourly; tier pruning
// (which drops raw past its window, after it's rolled up) runs daily. Skipped on
// Vercel (no long-lived process) and in test.
if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'test') {
    (async () => {
        try {
            const { runMetricRollups, pruneTiers } = await import('./services/metricRollupService.js');
            const rollTick = async () => {
                try {
                    await runMetricRollups(pool);
                } catch (err) {
                    log('WARN', `Metric rollup failed: ${err.message}`);
                }
            };
            const pruneTick = async () => {
                try {
                    const pruned = await pruneTiers(pool);
                    log('INFO', 'Metric tier prune', pruned);
                } catch (err) {
                    log('WARN', `Metric tier prune failed: ${err.message}`);
                }
            };
            setTimeout(rollTick, 45_000).unref?.();
            setInterval(rollTick, 60 * 60 * 1000).unref?.();
            setInterval(pruneTick, 24 * 60 * 60 * 1000).unref?.();
        } catch (err) {
            log('WARN', `Metric rollup sweep not scheduled: ${err.message}`);
        }
    })();
}

// ── Enterprise routes (hidden — uncomment when ready) ────────────────────────
// mountEnterpriseRoutes(app, pool, authenticate, requireRole, requireScreen);

// ─────────────────────────────────────────────────────────────────────────────
// POSTGRES MONITORING ROUTES
//
// These endpoints query PostgreSQL-specific system tables (pg_stat_*, pg_locks,
// pg_settings, pg_extension, etc.).  When the active connection is MySQL or
// MongoDB these queries are meaningless, so we intercept early and return
// sensible empty responses so the frontend degrades gracefully.
// ─────────────────────────────────────────────────────────────────────────────

/** Paths that are PG-specific and should return empty for other DB types */
const PG_ONLY_PREFIXES = [
    '/api/overview/',
    '/api/performance/',
    '/api/reliability/',
    '/api/resources/',
    '/api/bloat/',
    '/api/regression/',
    '/api/logs/',
    '/api/tables/',
    '/api/indexes/',
    '/api/optimizer/',
    '/api/admin/settings',
    '/api/admin/extensions',
    '/api/admin/hba',
    '/api/admin/connections',
    '/api/pool/',
    '/api/replication/',
    '/api/security/',
    '/api/schema/',
    '/api/observability/',
    '/api/checkpoint/',
    '/api/maintenance/',
    '/api/backup/',
    '/api/capacity/',
    '/api/wal/',
    '/api/vacuum/',
];

/**
 * Middleware: for PG-specific endpoints, check the connection dbType.
 * If not PostgreSQL, return an appropriate empty response instead of
 * crashing with PG system-table queries on MySQL/MongoDB.
 */
app.use('/api', async (req, res, next) => {
    // Only guard GET/POST to PG-specific paths
    const path = req.path; // path relative to /api mount = /overview/stats etc.
    const fullPath = '/api' + path;
    const isPgOnly = PG_ONLY_PREFIXES.some((p) => fullPath.startsWith(p));
    if (!isPgOnly) return next();

    try {
        const dbType = await reqDbType(req);
        if (dbType === 'postgresql') return next();
        // Non-PG connection → return empty (matches frontend .catch(() => null) pattern)
        const method = req.method.toUpperCase();
        if (method === 'GET') return res.json([]);
        return res.json({ error: `This endpoint is PostgreSQL-specific. Connected database type: ${dbType}` });
    } catch {
        return next(); // Can't determine type — let the handler try
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ALERTS ROUTES
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// ADMIN / CACHE ROUTES

// ─────────────────────────────────────────────────────────────────────────────
// SQL CONSOLE
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/query', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
    const rawSql = req.body?.sql;
    const validationError = validateConsoleQuery(rawSql, req.user.role);
    if (validationError) return res.status(400).json({ error: validationError });

    const dbType = await reqDbType(req);

    // Engines without SQL surfaces get a structured 400 pointing at the
    // right console for that engine, rather than a cryptic pg error.
    const NON_SQL_ENGINES = {
        mongodb: { hint: 'Use the MongoDB Data Tools tab (db.collection.find(...)).' },
        redis: { hint: 'Redis has no SQL. Use the Redis Commands tab for GET/SET/SCAN/etc.' },
        dynamodb: { hint: 'DynamoDB uses PartiQL. Use the DynamoDB PartiQL tab instead.' },
        cassandra: { hint: 'Cassandra uses CQL. Use the Cassandra CQL tab instead.' },
    };
    if (NON_SQL_ENGINES[dbType]) {
        return res.status(400).json({
            error: `SQL console is not available for ${dbType} connections.`,
            code: 'SQL_NOT_SUPPORTED_FOR_ENGINE',
            hint: NON_SQL_ENGINES[dbType].hint,
        });
    }

    const safeSql = String(rawSql).slice(0, 50_000);
    try {
        const dynPool = await reqPool(req);
        if (dbType === 'mysql' || dbType === 'mariadb') {
            const [rows, fields] = await dynPool.query(safeSql);
            queryHistory.add({ sql: safeSql, success: true, by: req.user.username });
            await writeAudit(pool, {
                actorId: req.user.id,
                actorUsername: req.user.username,
                action: 'SQL_CONSOLE_EXEC',
                resourceType: 'sql_console',
                level: 'warn',
                detail: `Executed SQL (${safeSql.length} chars): ${safeSql.slice(0, 200)}${safeSql.length > 200 ? '…' : ''}`,
                ip: req.ip,
            });
            res.json({
                rows: Array.isArray(rows) ? rows : [],
                rowCount: Array.isArray(rows) ? rows.length : 0,
                fields: (fields || []).map((f) => ({ name: f.name })),
            });
        } else {
            const client = await dynPool.connect();
            const r = await client.query(safeSql);
            client.release();
            queryHistory.add({ sql: safeSql, success: true, by: req.user.username });
            await writeAudit(pool, {
                actorId: req.user.id,
                actorUsername: req.user.username,
                action: 'SQL_CONSOLE_EXEC',
                resourceType: 'sql_console',
                level: 'warn',
                detail: `Executed SQL (${safeSql.length} chars): ${safeSql.slice(0, 200)}${safeSql.length > 200 ? '…' : ''}`,
                ip: req.ip,
            });
            res.json({ rows: r.rows, rowCount: r.rowCount, fields: r.fields.map((f) => ({ name: f.name })) });
        }
    } catch (e) {
        queryHistory.add({ sql: safeSql, success: false, error: e.message, by: req.user.username });
        res.status(400).json({ error: e.message });
    }
});

app.use('/api/repo', authenticate, requireScreen('repository'), repoRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTIONS
// ─────────────────────────────────────────────────────────────────────────────
const SSH_FIELDS = [
    'sshEnabled',
    'sshHost',
    'sshPort',
    'sshUser',
    'sshAuthType',
    'sshPrivateKey',
    'sshPassphrase',
    'sshPassword',
];

// ── Key exchange: frontend encrypts passwords with this RSA public key ──
app.get('/api/connections/handshake', authenticate, (req, res) => {
    try {
        res.json({ publicKey: getPublicKey() });
    } catch (e) {
        res.status(500).json({ error: 'Encryption not configured' });
    }
});

/**
 * Unwrap sensitive fields that may arrive RSA-encrypted from the frontend.
 * Falls back gracefully to plaintext for backward compatibility.
 */
function unwrapSensitiveFields(body) {
    const SENSITIVE = ['password', 'sshPrivateKey', 'sshPassphrase', 'sshPassword'];
    const out = { ...body };
    for (const f of SENSITIVE) {
        if (out[f]) out[f] = unwrapField(out[f]);
    }
    return out;
}

function pickSSH(body) {
    return {
        sshEnabled: body.sshEnabled ?? false,
        sshHost: body.sshHost || '',
        sshPort: parseInt(body.sshPort) || 22,
        sshUser: body.sshUser || '',
        sshAuthType: body.sshAuthType || 'key',
        sshPrivateKey: body.sshPrivateKey || '',
        sshPassphrase: body.sshPassphrase || '',
        sshPassword: body.sshPassword || '',
    };
}

function sanitizeConn(c) {
    const { password, sshPrivateKey, sshPassphrase, sshPassword, ...safe } = c;
    return safe;
}

async function resolvePoolConfig(c) {
    let host = c.host;
    let port = c.port;

    if (c.sshEnabled && c.sshHost) {
        let localPort = getTunnelPort(c.id);
        if (!localPort) {
            localPort = await openTunnel(c.id, {
                sshHost: c.sshHost,
                sshPort: c.sshPort || 22,
                sshUser: c.sshUser,
                sshAuthType: c.sshAuthType || 'key',
                sshPrivateKey: c.sshPrivateKey,
                sshPassphrase: c.sshPassphrase,
                sshPassword: c.sshPassword,
                dbHost: c.host,
                dbPort: c.port,
            });
        }
        host = '127.0.0.1';
        port = localPort;
    }

    return {
        host,
        port,
        database: c.database,
        user: c.username,
        password: c.password,
        ssl: buildSslOption(c.ssl),
    };
}

app.get('/api/connections', authenticate, ensureConnections, async (req, res) => {
    try {
        const conns = await dbLoadConnections(req.user.id, req.user.role);
        res.json(conns.map(sanitizeConn));
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json([]);
    }
});

app.get('/api/connections/:id', authenticate, ensureConnections, async (req, res, next) => {
    // Skip non-numeric IDs so named routes (/active, /health, /count) can match
    if (!/^\d+$/.test(req.params.id)) return next();
    try {
        const id = parseInt(req.params.id, 10);
        const conns = await dbLoadConnections(req.user.id, req.user.role);
        const c = conns.find((c) => c.id === id);
        if (!c) return res.status(404).json({ error: 'Connection not found' });
        res.json(sanitizeConn(c));
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json({});
    }
});

// B6: adapter capability negotiation. FE drives tab visibility from this
// shape instead of switching on dbType strings. Endpoint is cheap — it
// just instantiates the adapter shell (no connect) and asks for caps.
app.get('/api/connections/:id/capabilities', authenticate, ensureConnections, async (req, res, next) => {
    if (!/^\d+$/.test(req.params.id)) return next();
    try {
        const id = parseInt(req.params.id, 10);
        const conns = await dbLoadConnections(req.user.id, req.user.role);
        const c = conns.find((c) => c.id === id);
        if (!c) return res.status(404).json({ error: 'Connection not found' });
        const adapter = getDbAdapter(c.dbType || 'postgresql', {});
        const caps = adapter && typeof adapter.getCapabilities === 'function' ? adapter.getCapabilities() : {};
        res.json({ dbType: c.dbType || 'postgresql', capabilities: caps });
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.status(500).json({ error: e.message });
    }
});

// ── Database switcher: list, read, and switch the active database on a server ──
// A connection targets one database; these endpoints let the operator pick any
// database on the SAME server without registering a new connection. Listing is
// cached briefly (dropdowns re-open often); switching validates reachability
// then records a per-user, per-connection override consumed by reqPool /
// getMongoClient. `switchable` is false for transaction-pooler connections.
const _dbListCache = new Map(); // connectionId -> { at, data }
const DB_LIST_TTL_MS = 30_000;

app.get('/api/connections/:id/databases', authenticate, ensureConnections, async (req, res, next) => {
    if (!/^\d+$/.test(req.params.id)) return next();
    try {
        const id = parseInt(req.params.id, 10);
        const conns = await dbLoadConnections(req.user.id, req.user.role);
        const c = conns.find((x) => x.id === id);
        if (!c) return res.status(404).json({ error: 'Connection not found' });

        const sw = isDatabaseSwitchable(c);
        const active = getUserActiveDatabaseId(req.user.id, id) || c.database || null;
        const meta = { active, current: c.database || null, switchable: sw.ok, reason: sw.reason };

        const fresh = req.query.refresh === '1' || req.query.refresh === 'true';
        const cached = _dbListCache.get(id);
        if (!fresh && cached && Date.now() - cached.at < DB_LIST_TTL_MS) {
            return res.json({ databases: cached.data, ...meta });
        }

        const dbType = (c.dbType || 'postgresql').toLowerCase();
        let databases = [];
        if (dbType === 'mongodb') {
            const { client } = await getMongoClient(id, req.user.id);
            const r = await client.db().admin().listDatabases();
            databases = (r.databases || []).map((d) => ({ name: d.name, sizeBytes: d.sizeOnDisk || null }));
        } else if (dbType === 'mysql' || dbType === 'mariadb') {
            const p = await getPool(id, req.user.id);
            const [rows] = await p.query('SHOW DATABASES');
            databases = rows.map((r) => ({ name: Object.values(r)[0], sizeBytes: null }));
        } else {
            const p = await getPool(id, req.user.id);
            const r = await p.query(
                `SELECT datname AS name,
                        CASE WHEN has_database_privilege(datname, 'CONNECT')
                             THEN pg_database_size(datname) ELSE NULL END AS size_bytes
                 FROM pg_database WHERE datistemplate = false AND datallowconn ORDER BY datname`,
            );
            databases = r.rows.map((x) => ({ name: x.name, sizeBytes: Number(x.size_bytes) || null }));
        }
        _dbListCache.set(id, { at: Date.now(), data: databases });
        res.json({ databases, ...meta });
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        // Degrade gracefully: the dropdown shows the reason instead of a raw 500.
        res.json({ databases: [], error: e.message, switchable: false });
    }
});

app.get('/api/connections/:id/database', authenticate, ensureConnections, async (req, res, next) => {
    if (!/^\d+$/.test(req.params.id)) return next();
    try {
        const id = parseInt(req.params.id, 10);
        const conns = await dbLoadConnections(req.user.id, req.user.role);
        const c = conns.find((x) => x.id === id);
        if (!c) return res.status(404).json({ error: 'Connection not found' });
        res.json({
            active: getUserActiveDatabaseId(req.user.id, id) || c.database || null,
            current: c.database || null,
            switchable: isDatabaseSwitchable(c).ok,
        });
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json({ active: null });
    }
});

app.post('/api/connections/:id/database', authenticate, ensureConnections, async (req, res, next) => {
    if (!/^\d+$/.test(req.params.id)) return next();
    try {
        const id = parseInt(req.params.id, 10);
        const database = req.body && req.body.database ? String(req.body.database).trim() : '';
        if (!database) return res.status(400).json({ error: 'database is required' });

        const conns = await dbLoadConnections(req.user.id, req.user.role);
        const c = conns.find((x) => x.id === id);
        if (!c) return res.status(404).json({ error: 'Connection not found' });

        const sw = isDatabaseSwitchable(c);
        if (!sw.ok) return res.status(400).json({ success: false, error: sw.reason });

        // Reset to the connection's own database: clear the override. Also drop
        // any schema selection — schemas are per-database and won't carry over.
        if (database === c.database) {
            setUserActiveDatabase(req.user.id, id, null);
            setUserActiveSchema(req.user.id, id, null);
            cache.clear();
            return res.json({ success: true, database, connectionId: id });
        }

        // Validate the target is reachable before committing the override.
        try {
            const dbType = (c.dbType || 'postgresql').toLowerCase();
            if (dbType === 'mongodb') {
                const { client } = await getMongoClient(id, req.user.id);
                await client.db(database).command({ ping: 1 });
            } else {
                const p = await getOverridePool({ ...c, database }, database);
                if (dbType === 'mysql' || dbType === 'mariadb') {
                    await p.query('SELECT 1');
                } else {
                    const client = await p.connect();
                    await client.query('SELECT 1');
                    client.release();
                }
            }
        } catch (err) {
            return res.status(400).json({ success: false, error: `Cannot switch to "${database}": ${err.message}` });
        }

        setUserActiveDatabase(req.user.id, id, database);
        // A new database has its own schemas — drop any prior schema selection.
        setUserActiveSchema(req.user.id, id, null);
        cache.clear();
        log('INFO', `Active database switched to "${database}" on connection ${id} for user ${req.user.id}`);
        res.json({ success: true, database, connectionId: id });
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.status(500).json({ error: e.message });
    }
});

// ── Schema switcher: list, read, and switch the active schema ──
// Postgres: scopes table-level panels (they filter by ?schema=) and pins the
// SQL console search_path (via the override pool). SQL Server / Snowflake: the
// schema is applied to the live SQL console (adapter.useSchema) — those engines
// have no backend-fed dashboard panels to scope. Other engines: unsupported.
const _schemaListCache = new Map(); // `${connId}:${db}` -> { at, data }

const SCHEMA_ENGINES = new Set(['postgresql', 'postgres', 'mssql', 'sqlserver', 'snowflake']);
const schemaSupported = (dbType) => SCHEMA_ENGINES.has((dbType || 'postgresql').toLowerCase());
const isAdapterSchemaEngine = (dbType) => {
    const t = (dbType || '').toLowerCase();
    return t === 'mssql' || t === 'sqlserver' || t === 'snowflake';
};

// On-demand schema listing for engines that go through an adapter (not the
// shared pool). Connects, lists, and disconnects — cheap enough for a dropdown
// that's cached for DB_LIST_TTL_MS.
async function listAdapterSchemas(conn) {
    const cfg = await resolvePoolConfig(conn);
    const adapter = getDbAdapter(conn.dbType, {
        host: cfg.host,
        port: cfg.port,
        database: cfg.database,
        user: cfg.user,
        username: cfg.user,
        password: cfg.password,
        ssl: cfg.ssl,
        account: cfg.host,
        projectId: cfg.host,
        region: cfg.host,
        keyspace: cfg.database,
        contactPoints: cfg.host ? [cfg.host] : undefined,
    });
    await adapter.connect();
    try {
        return (await adapter.getSchemas()) || [];
    } finally {
        try {
            await adapter.disconnect();
        } catch {
            /* ignore */
        }
    }
}

app.get('/api/connections/:id/schemas', authenticate, ensureConnections, async (req, res, next) => {
    if (!/^\d+$/.test(req.params.id)) return next();
    try {
        const id = parseInt(req.params.id, 10);
        const conns = await dbLoadConnections(req.user.id, req.user.role);
        const c = conns.find((x) => x.id === id);
        if (!c) return res.status(404).json({ error: 'Connection not found' });

        const supported = schemaSupported(c.dbType);
        const activeDb = getUserActiveDatabaseId(req.user.id, id) || c.database || null;
        const defaultSchema = isPgLikeEngine(c.dbType) ? 'public' : null;
        const active = getUserActiveSchema(req.user.id, id) || defaultSchema;
        // For adapter engines the schema only reaches the SQL console.
        const scope = isPgLikeEngine(c.dbType) ? 'panels' : isAdapterSchemaEngine(c.dbType) ? 'console' : 'none';
        const meta = { active, supported, scope, database: activeDb };
        if (!supported) return res.json({ schemas: [], ...meta });

        const cacheKey = `${id}:${activeDb}`;
        const fresh = req.query.refresh === '1' || req.query.refresh === 'true';
        const cached = _schemaListCache.get(cacheKey);
        if (!fresh && cached && Date.now() - cached.at < DB_LIST_TTL_MS) {
            return res.json({ schemas: cached.data, ...meta });
        }

        let schemas;
        if (isPgLikeEngine(c.dbType)) {
            // The connection id comes from the path (:id), not ?connectionId= —
            // /api/connections/* is intentionally excluded from that query param.
            // Point reqPool at this connection so it resolves + applies overrides.
            req.query.connectionId = req.query.connectionId || String(id);
            const p = await reqPool(req);
            const r = await p.query(
                `SELECT n.nspname AS name,
                        COALESCE(c.tables, 0) AS table_count
                 FROM pg_namespace n
                 LEFT JOIN (
                    SELECT schemaname, count(*) AS tables FROM pg_stat_user_tables GROUP BY schemaname
                 ) c ON c.schemaname = n.nspname
                 WHERE n.nspname NOT IN ('pg_catalog','information_schema','pg_toast')
                   AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast_temp_%'
                 ORDER BY n.nspname`,
            );
            schemas = r.rows.map((x) => ({ name: x.name, tableCount: Number(x.table_count) || 0 }));
        } else {
            schemas = await listAdapterSchemas(c);
        }
        _schemaListCache.set(cacheKey, { at: Date.now(), data: schemas });
        res.json({ schemas, ...meta });
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json({ schemas: [], error: e.message });
    }
});

app.get('/api/connections/:id/schema', authenticate, ensureConnections, async (req, res, next) => {
    if (!/^\d+$/.test(req.params.id)) return next();
    try {
        const id = parseInt(req.params.id, 10);
        const conns = await dbLoadConnections(req.user.id, req.user.role);
        const c = conns.find((x) => x.id === id);
        if (!c) return res.status(404).json({ error: 'Connection not found' });
        res.json({
            active: getUserActiveSchema(req.user.id, id) || (isPgLikeEngine(c.dbType) ? 'public' : null),
            supported: schemaSupported(c.dbType),
            scope: isPgLikeEngine(c.dbType) ? 'panels' : isAdapterSchemaEngine(c.dbType) ? 'console' : 'none',
        });
    } catch (e) {
        res.json({ active: null, supported: false });
    }
});

app.post('/api/connections/:id/schema', authenticate, ensureConnections, async (req, res, next) => {
    if (!/^\d+$/.test(req.params.id)) return next();
    try {
        const id = parseInt(req.params.id, 10);
        const schema = req.body && req.body.schema ? String(req.body.schema).trim() : '';
        if (!schema) return res.status(400).json({ error: 'schema is required' });
        const conns = await dbLoadConnections(req.user.id, req.user.role);
        const c = conns.find((x) => x.id === id);
        if (!c) return res.status(404).json({ error: 'Connection not found' });
        if (!schemaSupported(c.dbType)) {
            return res
                .status(400)
                .json({ success: false, error: 'Schema switching is not available for this engine.' });
        }
        // Postgres 'public' is the default → clears the override. Adapter engines
        // (mssql/snowflake) have no universal default, so any value is stored.
        const clears = isPgLikeEngine(c.dbType) && schema === 'public';
        setUserActiveSchema(req.user.id, id, clears ? null : schema);
        cache.clear();
        log('INFO', `Active schema switched to "${schema}" on connection ${id} for user ${req.user.id}`);
        res.json({ success: true, schema, connectionId: id });
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.status(500).json({ error: e.message });
    }
});

// Engines whose credentials don't match the traditional host/port/user/password/db
// shape. Relax the required-fields guard for these so BigQuery (project ID +
// service account JSON) and DynamoDB (region + access key + secret) can both
// be created via the standard wizard. See ENGINE_HINTS in ConnectionWizard.tsx
// for the field-mapping guidance shown to operators.
const PHASE5_RELAXED_FIELDS = new Set(['bigquery', 'dynamodb', 'snowflake', 'redis', 'cassandra', 'elasticsearch']);

app.post('/api/connections', authenticate, ensureConnections, async (req, res) => {
    try {
        // Unwrap RSA-encrypted sensitive fields from the frontend
        const body = unwrapSensitiveFields(req.body);
        const {
            name,
            host,
            port,
            database,
            username,
            password,
            ssl,
            isDefault,
            dbType: rawDbType,
            type: rawType,
        } = body;
        // Wizard sends `type`, backend historically uses `dbType` — accept either
        const dbType = (rawDbType || rawType || 'postgresql').toLowerCase();
        const relaxed = PHASE5_RELAXED_FIELDS.has(dbType);
        // Classic engines still require host + port + db + user + password. Phase-5
        // engines with non-traditional credential shapes require only name + host
        // (which the wizard maps to project ID / account ID / region).
        if (!name || !host) {
            return res.status(400).json({ error: 'name and host are required' });
        }
        if (!relaxed && (!port || !database || !username || !password)) {
            return res
                .status(400)
                .json({ error: 'host, port, database, username, password are required for this database type' });
        }
        if (isDefault) await dbSetDefault(req.user.id, req.user.role, -1);

        // Auto-deduplicate connection names: if "MyDB" exists, try "MyDB (2)", "MyDB (3)", …
        let finalName = name;
        let attempt = 0;
        let newConn;
        while (true) {
            try {
                newConn = await dbInsertConnection({
                    userId: req.user.id,
                    name: finalName,
                    host,
                    port: parseInt(port),
                    database,
                    username,
                    password,
                    ssl: ssl || false,
                    isDefault: isDefault || false,
                    dbType: dbType || 'postgresql',
                    ...pickSSH(body),
                    status: null,
                    lastTested: null,
                });
                break; // success
            } catch (insertErr) {
                if (insertErr.code === '23505' && attempt < 10) {
                    attempt++;
                    finalName = `${name} (${attempt + 1})`;
                } else {
                    throw insertErr; // re-throw non-duplicate or exhausted retries
                }
            }
        }
        await syncConnectionsCache();

        // Auto-test the new connection so the user gets immediate feedback
        let testResult = null;
        const connDbType = (newConn.dbType || 'postgresql').toLowerCase();
        // Phase-5 engines go through the adapter factory. If the engine's
        // peer driver (snowflake-sdk / ioredis / cassandra-driver / etc.)
        // isn't installed, surface that as a DRIVER_NOT_INSTALLED warning
        // instead of hard-failing the connection creation — the row is
        // still stored so operators can fix the driver and retry.
        const PHASE5_VIA_ADAPTER = new Set([
            'mssql',
            'oracle',
            'snowflake',
            'bigquery',
            'redshift',
            'cassandra',
            'dynamodb',
            'redis',
            'elasticsearch',
        ]);
        try {
            const cfg = await resolvePoolConfig(newConn);
            if (PHASE5_VIA_ADAPTER.has(connDbType)) {
                const { getAdapter } = await import('./services/dbAdapters/index.js');
                const adapter = getAdapter(connDbType, {
                    // Common fields
                    host: cfg.host,
                    port: cfg.port,
                    database: cfg.database,
                    user: cfg.user,
                    username: cfg.user,
                    password: cfg.password,
                    ssl: cfg.ssl,
                    // Per-engine aliases the adapters look for
                    account: cfg.host, // Snowflake account identifier
                    projectId: cfg.host, // BigQuery project ID
                    region: cfg.host, // DynamoDB region
                    keyspace: cfg.database, // Cassandra default keyspace
                    contactPoints: cfg.host ? [cfg.host] : undefined,
                });
                await adapter.connect();
                await adapter.disconnect?.().catch(() => undefined);
            } else if (connDbType === 'mongodb') {
                if (!mongodb) throw new Error('MongoDB driver not installed');
                const userPart = cfg.user
                    ? `${encodeURIComponent(cfg.user)}:${encodeURIComponent(cfg.password || '')}@`
                    : '';
                const sslParam = newConn.ssl ? '?tls=true&tlsAllowInvalidCertificates=true' : '';
                const connStr = `mongodb://${userPart}${cfg.host}:${cfg.port || 27017}/${cfg.database || 'admin'}${sslParam}`;
                const testClient = new mongodb.MongoClient(connStr, { serverSelectionTimeoutMS: 8000 });
                await testClient.connect();
                await testClient.db(cfg.database || 'admin').command({ ping: 1 });
                await testClient.close();
            } else if (connDbType === 'mysql' || connDbType === 'mariadb') {
                if (!mysql2) throw new Error('MySQL driver not installed');
                const testConn = await mysql2.createConnection({
                    host: cfg.host,
                    port: cfg.port,
                    database: cfg.database,
                    user: cfg.user,
                    password: cfg.password,
                    ssl: buildSslOption(newConn.ssl) || undefined,
                    connectTimeout: 8000,
                });
                await testConn.query('SELECT 1');
                await testConn.end();
            } else {
                // Try as-is first; on cert errors, retry with the configured SSL
                // policy (see buildSslOption + FATHOM_TLS_ALLOW_SELF_SIGNED).
                // PRF-03 (audit): always end() the test pool, even on the
                // failure path, so we don't leak open sockets when the connect()
                // succeeds but the followup query throws.
                let pgOk = false;
                for (const sslOverride of [undefined, buildSslOption(true)]) {
                    const poolOpts = { ...cfg, connectionTimeoutMillis: 8000 };
                    if (sslOverride) poolOpts.ssl = sslOverride;
                    const testPool = new Pool(poolOpts);
                    try {
                        const client = await testPool.connect();
                        try {
                            await client.query('SELECT 1');
                        } finally {
                            client.release();
                        }
                        pgOk = true;
                        break;
                    } catch (pgErr) {
                        if (!pgErr.message.includes('certificate') && !pgErr.message.includes('SSL')) {
                            await testPool.end().catch(() => undefined);
                            throw pgErr;
                        }
                    } finally {
                        await testPool.end().catch(() => undefined);
                    }
                }
                if (!pgOk) throw new Error('Connection failed — could not establish SSL connection');
            }
            await dbUpdateConnection(newConn.id, { status: 'success', lastTested: new Date().toISOString() });
            testResult = { success: true, message: 'Connection verified' };
        } catch (testErr) {
            await dbUpdateConnection(newConn.id, { status: 'failed', lastTested: new Date().toISOString() });
            testResult = { success: false, error: testErr.message };
        }
        await syncConnectionsCache();

        res.status(201).json({ success: true, ...sanitizeConn(newConn), connectionId: newConn.id, testResult });
    } catch (e) {
        if (e.code === '23505')
            return res.status(409).json({ error: 'Connection name already exists', code: 'DUPLICATE_NAME' });

        // Map well-known misconfigurations to actionable 503s so the operator
        // isn't staring at an opaque 500. `hint` is safe to surface — it names
        // the env var or migration command, not the stack.
        const classified = classifyConnectionError(e);
        log('ERROR', 'Create connection error', {
            error: e.message,
            stack: e.stack,
            code: e.code,
            diagnostic: classified.code,
        });
        const body = {
            error:
                classified.code === DiagnosticCodes.UNKNOWN
                    ? 'Internal server error'
                    : classified.hint || 'Configuration error',
            code: classified.code,
        };
        if (classified.hint) body.hint = classified.hint;
        if (!IS_PROD) body.details = e.message;
        res.status(classified.status).json(body);
    }
});

app.put('/api/connections/:id', authenticate, ensureConnections, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const conns = await dbLoadConnections(req.user.id, req.user.role);
        const existing = conns.find((c) => c.id === id);
        if (!existing) return res.status(404).json({ error: 'Connection not found' });

        // Unwrap RSA-encrypted sensitive fields from the frontend
        const body = unwrapSensitiveFields(req.body);
        const { name, host, port, database, username, password, ssl } = body;
        const ssh = pickSSH({ ...existing, ...body });

        const sshChanged = SSH_FIELDS.some((f) => req.body[f] !== undefined && req.body[f] !== existing[f]);
        if (sshChanged) await closeTunnel(id);
        await destroyPool(id);
        if (getUserActiveConnectionId(req.user.id) === id) cache.clear();

        const updated = await dbUpdateConnection(id, {
            name: name || existing.name,
            host: host || existing.host,
            port: port ? parseInt(port) : existing.port,
            database: database || existing.database,
            username: username || existing.username,
            password: password || existing.password,
            ssl: ssl !== undefined ? ssl : existing.ssl,
            sshEnabled: ssh.sshEnabled,
            sshHost: ssh.sshHost,
            sshPort: ssh.sshPort,
            sshUser: ssh.sshUser,
            sshAuthType: ssh.sshAuthType,
            sshPrivateKey: ssh.sshPrivateKey,
            sshPassphrase: ssh.sshPassphrase,
            sshPassword: ssh.sshPassword,
            status: null,
            lastTested: null,
        });
        await syncConnectionsCache();
        res.json(sanitizeConn(updated));
    } catch (e) {
        if (e.code === '23505')
            return res.status(409).json({ error: 'Connection name already exists', code: 'DUPLICATE_NAME' });
        const classified = classifyConnectionError(e);
        log('ERROR', 'Update connection error', { error: e.message, stack: e.stack, diagnostic: classified.code });
        const body = {
            error:
                classified.code === DiagnosticCodes.UNKNOWN
                    ? 'Internal server error'
                    : classified.hint || 'Configuration error',
            code: classified.code,
        };
        if (classified.hint) body.hint = classified.hint;
        if (!IS_PROD) body.details = e.message;
        res.status(classified.status).json(body);
    }
});

app.delete('/api/connections/:id', authenticate, ensureConnections, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const conns = await dbLoadConnections(req.user.id, req.user.role);
        const c = conns.find((c) => c.id === id);
        if (!c) return res.status(404).json({ error: 'Connection not found' });

        await closeTunnel(id);
        await destroyPool(id);
        // Clear per-user active connection if this was it
        if (getUserActiveConnectionId(req.user.id) === id) {
            setUserActiveConnectionId(req.user.id, null);
            cache.clear();
        }

        await dbDeleteConnection(id, req.user.id);

        // If it was the default, promote the next connection for this user
        if (c.isDefault) {
            const remaining = conns.filter((x) => x.id !== id);
            if (remaining.length > 0) {
                await dbSetDefault(req.user.id, req.user.role, remaining[0].id);
            }
        }

        await syncConnectionsCache();
        res.json({ success: true });
    } catch (e) {
        const classified = classifyConnectionError(e);
        log('ERROR', 'Delete connection error', { error: e.message, stack: e.stack, diagnostic: classified.code });
        const body = {
            error:
                classified.code === DiagnosticCodes.UNKNOWN
                    ? 'Internal server error'
                    : classified.hint || 'Configuration error',
            code: classified.code,
        };
        if (classified.hint) body.hint = classified.hint;
        if (!IS_PROD) body.details = e.message;
        res.status(classified.status).json(body);
    }
});

app.post('/api/connections/:id/default', authenticate, ensureConnections, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const conns = await dbLoadConnections(req.user.id, req.user.role);
        if (!conns.find((c) => c.id === id)) return res.status(404).json({ error: 'Connection not found' });
        await dbSetDefault(req.user.id, req.user.role, id);
        await syncConnectionsCache();

        // PERF: warm the pool in the background so the very next dashboard
        // request finds a live socket instead of paying TCP+TLS+auth on the
        // critical path. Fire-and-forget — errors are logged but don't
        // delay the response. Skipped on Vercel (no long-lived process).
        if (process.env.VERCEL !== '1') {
            (async () => {
                try {
                    const pool = await getPool(id, req.user?.id);
                    if (pool && typeof pool.query === 'function') {
                        await pool.query('SELECT 1').catch(() => {});
                    }
                } catch (warmErr) {
                    log('INFO', `Pool warm-up failed for connection ${id}`, { error: warmErr.message });
                }
            })();
        }

        res.json({ success: true });
    } catch (e) {
        log('ERROR', 'Set default connection error', { error: e.message, stack: e.stack });
        res.status(500).json({
            error: 'Internal server error',
            ...(IS_PROD ? {} : { details: e.message }),
            code: e.code,
        });
    }
});

// ── SSRF guard (SEC-021 + audit M-1) ────────────────────────────────────────
// Block private/internal targets by literal host string AND by resolved IP, so
// a public hostname that resolves to an internal address (DNS rebinding, a CNAME
// to cloud metadata) can't slip through a name-only blocklist.
function isPrivateIp(ip) {
    const s = String(ip || '').toLowerCase();
    if (!s) return false;
    if (s === '::1' || s.startsWith('fc') || s.startsWith('fd') || s.startsWith('fe80')) return true;
    const m = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
    const v4 = m ? m[1] : /^\d+\.\d+\.\d+\.\d+$/.test(s) ? s : null;
    if (v4) {
        const o = v4.split('.').map(Number);
        if (o[0] === 10 || o[0] === 127 || o[0] === 0) return true;
        if (o[0] === 169 && o[1] === 254) return true;
        if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true;
        if (o[0] === 192 && o[1] === 168) return true;
        if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return true;
    }
    return false;
}

async function assertHostNotPrivate(host) {
    const h = String(host || '').trim();
    if (!h) return { ok: false, reason: 'Host is required' };
    const literal = [
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2\d|3[01])\./,
        /^192\.168\./,
        /^0\./,
        /^169\.254\./,
        /^::1$/,
        /^fc00:/i,
        /^fe80:/i,
        /^localhost$/i,
        /\.local$/i,
        /^metadata\.google\.internal$/i,
    ];
    if (literal.some((p) => p.test(h)) || isPrivateIp(h)) {
        return { ok: false, reason: 'Connections to private/internal networks are not allowed' };
    }
    try {
        const dns = await import('dns/promises');
        const records = await dns.lookup(h, { all: true });
        if (records.some((r) => isPrivateIp(r.address))) {
            return { ok: false, reason: 'Host resolves to a private/internal address; not allowed' };
        }
    } catch {
        // resolution failure: let the actual connection attempt surface the error
    }
    return { ok: true };
}

// ── Test connection with raw credentials (no saved connection required) ──────
app.post('/api/connections/test', authenticate, async (req, res) => {
    try {
        const { type, host, port, username, password, database, ssl } = req.body;
        if (!host) return res.status(400).json({ success: false, error: 'Host is required' });

        // SEC-021 + audit M-1: reject private/internal targets by literal host AND
        // by resolved IP (defeats DNS-based SSRF bypass).
        const ssrf = await assertHostNotPrivate(host);
        if (!ssrf.ok) {
            return res.status(400).json({ success: false, error: ssrf.reason });
        }
        const dbType = (type || 'postgresql').toLowerCase();

        // Phase-5 engines (MSSQL, Oracle, Redis, Elasticsearch, Snowflake,
        // BigQuery, Redshift, Cassandra, DynamoDB) are routed through the
        // shared adapter factory so the wizard's "Test Connection" step
        // succeeds for every engine the backend actually supports — not just
        // the legacy PostgreSQL / MySQL / MongoDB trio.
        const PHASE5_VIA_ADAPTER = new Set([
            'mssql',
            'sqlserver',
            'sql-server',
            'oracle',
            'oracledb',
            'snowflake',
            'bigquery',
            'gbq',
            'redshift',
            'cassandra',
            'scylla',
            'dynamodb',
            'dynamo',
            'redis',
            'elasticsearch',
            'opensearch',
            'elastic',
        ]);

        try {
            if (dbType === 'mongodb') {
                if (!mongodb) throw new Error('MongoDB driver (mongodb) not installed on the server');
                const userPart = username
                    ? `${encodeURIComponent(username)}:${encodeURIComponent(password || '')}@`
                    : '';
                const sslParam = ssl ? '?tls=true&tlsAllowInvalidCertificates=true' : '';
                const connStr = `mongodb://${userPart}${host}:${port || 27017}/${database || 'admin'}${sslParam}`;
                const testClient = new mongodb.MongoClient(connStr, {
                    serverSelectionTimeoutMS: 8000,
                    connectTimeoutMS: 8000,
                });
                await testClient.connect();
                await testClient.db(database || 'admin').command({ ping: 1 });
                await testClient.close();
            } else if (dbType === 'mysql' || dbType === 'mariadb') {
                if (!mysql2) throw new Error('MySQL driver (mysql2) not installed on the server');
                const testConn = await mysql2.createConnection({
                    host,
                    port: port || 3306,
                    database: database || undefined,
                    user: username,
                    password,
                    ssl: buildSslOption(ssl) || undefined,
                    connectTimeout: 8000,
                });
                await testConn.query('SELECT 1');
                await testConn.end();
            } else if (PHASE5_VIA_ADAPTER.has(dbType)) {
                // Route Phase-5 engines through the adapter factory. Each
                // adapter knows its own driver, default port, and credential
                // shape — we pass aliases (account/projectId/region/etc.) so
                // engines with non-traditional credential layouts pick up the
                // right field from the wizard's generic host/port/user form.
                const { getAdapter } = await import('./services/dbAdapters/index.js');
                const adapter = getAdapter(dbType, {
                    host,
                    port,
                    database,
                    user: username,
                    username,
                    password,
                    ssl,
                    // Per-engine aliases (mirrors POST /api/connections):
                    account: host, // Snowflake account identifier
                    projectId: host, // BigQuery project ID
                    region: host, // DynamoDB region
                    keyspace: database, // Cassandra default keyspace
                    contactPoints: host ? [host] : undefined,
                });
                await adapter.connect();
                await adapter.disconnect?.().catch(() => undefined);
            } else {
                // Try with the user's SSL preference first; on cert errors, retry
                // honoring buildSslOption (strict in prod by default).
                // PRF-03 (audit): always end() the test pool, including on the
                // failure path, to avoid leaking open sockets.
                const sslOpt = buildSslOption(ssl) || undefined;
                let lastErr;
                for (const sslAttempt of [sslOpt, sslOpt ? null : buildSslOption(true)]) {
                    const testPool = new Pool({
                        host,
                        port: port || 5432,
                        database: database || 'postgres',
                        user: username,
                        password,
                        ssl: sslAttempt === null ? undefined : sslAttempt,
                        connectionTimeoutMillis: 8000,
                    });
                    try {
                        const client = await testPool.connect();
                        try {
                            await client.query('SELECT 1');
                        } finally {
                            client.release();
                        }
                        lastErr = null;
                        break;
                    } catch (e) {
                        lastErr = e;
                        // Only retry if it's a certificate error
                        if (!e.message.includes('certificate') && !e.message.includes('SSL')) break;
                    } finally {
                        await testPool.end().catch(() => undefined);
                    }
                }
                if (lastErr) throw lastErr;
            }

            res.json({ success: true, message: 'Connection successful' });
        } catch (e) {
            res.json({ success: false, error: e.message });
        }
    } catch (e) {
        log('ERROR', 'Test connection (raw) error', { error: e.message });
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.post('/api/connections/:id/test', authenticate, ensureConnections, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const conns = await dbLoadConnections(req.user.id, req.user.role);
        const c = conns.find((c) => c.id === id);
        if (!c) return res.status(404).json({ error: 'Connection not found' });

        let poolCfg;
        try {
            poolCfg = await resolvePoolConfig(c);
        } catch (tunnelErr) {
            await dbUpdateConnection(id, { status: 'failed', lastTested: new Date().toISOString() });
            await syncConnectionsCache();
            return res.json({ success: false, error: `SSH tunnel error: ${tunnelErr.message}` });
        }

        const dbType = (c.dbType || 'postgresql').toLowerCase();

        // Mirror POST /api/connections + /api/connections/test: re-testing
        // an existing Phase-5 connection should also route through the
        // shared adapter factory, otherwise the user sees a misleading
        // "failed" status for every non-PG/MySQL/Mongo engine.
        const PHASE5_VIA_ADAPTER = new Set([
            'mssql',
            'sqlserver',
            'sql-server',
            'oracle',
            'oracledb',
            'snowflake',
            'bigquery',
            'gbq',
            'redshift',
            'cassandra',
            'scylla',
            'dynamodb',
            'dynamo',
            'redis',
            'elasticsearch',
            'opensearch',
            'elastic',
        ]);

        try {
            if (dbType === 'mongodb') {
                // ── MongoDB test ──
                if (!mongodb) throw new Error('MongoDB driver (mongodb) not installed on the server');
                const userPart = poolCfg.user
                    ? `${encodeURIComponent(poolCfg.user)}:${encodeURIComponent(poolCfg.password || '')}@`
                    : '';
                const sslParam = c.ssl ? '?tls=true&tlsAllowInvalidCertificates=true' : '';
                const connStr = `mongodb://${userPart}${poolCfg.host}:${poolCfg.port || 27017}/${poolCfg.database || 'admin'}${sslParam}`;
                const testClient = new mongodb.MongoClient(connStr, {
                    serverSelectionTimeoutMS: 8000,
                    connectTimeoutMS: 8000,
                });
                await testClient.connect();
                await testClient.db(poolCfg.database || 'admin').command({ ping: 1 });
                await testClient.close();
            } else if (dbType === 'mysql' || dbType === 'mariadb') {
                // ── MySQL / MariaDB test ──
                if (!mysql2) throw new Error('MySQL driver (mysql2) not installed on the server');
                const testConn = await mysql2.createConnection({
                    host: poolCfg.host,
                    port: poolCfg.port,
                    database: poolCfg.database,
                    user: poolCfg.user,
                    password: poolCfg.password,
                    ssl: buildSslOption(c.ssl) || undefined,
                    connectTimeout: 8000,
                });
                await testConn.query('SELECT 1');
                await testConn.end();
            } else if (PHASE5_VIA_ADAPTER.has(dbType)) {
                // ── Phase-5 engines via adapter factory ──
                const { getAdapter } = await import('./services/dbAdapters/index.js');
                const adapter = getAdapter(dbType, {
                    host: poolCfg.host,
                    port: poolCfg.port,
                    database: poolCfg.database,
                    user: poolCfg.user,
                    username: poolCfg.user,
                    password: poolCfg.password,
                    ssl: c.ssl,
                    // Per-engine aliases the adapters look for:
                    account: poolCfg.host, // Snowflake account
                    projectId: poolCfg.host, // BigQuery project
                    region: poolCfg.host, // DynamoDB region
                    keyspace: poolCfg.database, // Cassandra keyspace
                    contactPoints: poolCfg.host ? [poolCfg.host] : undefined,
                });
                await adapter.connect();
                await adapter.disconnect?.().catch(() => undefined);
            } else {
                // ── PostgreSQL test ──
                // PRF-03 (audit): always end() the test pool, even on failure.
                const testPool = new Pool({ ...poolCfg, connectionTimeoutMillis: 8000 });
                try {
                    const client = await testPool.connect();
                    try {
                        await client.query('SELECT 1');
                    } finally {
                        client.release();
                    }
                } finally {
                    await testPool.end().catch(() => undefined);
                }
            }

            await dbUpdateConnection(id, { status: 'success', lastTested: new Date().toISOString() });
            await syncConnectionsCache();
            res.json({
                success: true,
                message: c.sshEnabled ? 'Connection successful via SSH tunnel' : 'Connection successful',
            });
        } catch (e) {
            await dbUpdateConnection(id, { status: 'failed', lastTested: new Date().toISOString() });
            await syncConnectionsCache();
            res.json({ success: false, error: e.message });
        }
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json({});
    }
});

app.post('/api/connections/:id/switch', authenticate, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const conns = await dbLoadConnections(req.user.id, req.user.role);
        const c = conns.find((c) => c.id === id);
        if (!c) return res.status(404).json({ error: 'Connection not found' });

        try {
            const dbType = (c.dbType || 'postgresql').toLowerCase();
            if (dbType === 'mongodb') {
                // Warm-up MongoDB client
                const { db } = await getMongoClient(id, req.user.id);
                await db.command({ ping: 1 });
            } else {
                // Warm-up PG or MySQL pool
                const p = await getPool(id, req.user.id);
                if (dbType === 'mysql' || dbType === 'mariadb') {
                    const [rows] = await p.query('SELECT 1');
                } else {
                    const client = await p.connect();
                    await client.query('SELECT 1');
                    client.release();
                }
            }
        } catch (err) {
            return res.status(400).json({ success: false, error: `Cannot switch: ${err.message}` });
        }

        await dbSetDefault(req.user.id, req.user.role, id);
        setUserActiveConnectionId(req.user.id, id);
        cache.clear(); // Clear cache to ensure fresh data for this connection
        await syncConnectionsCache();
        log('INFO', `Active connection switched to ${id} (${c.name}) for user ${req.user.id}`);
        res.json({ success: true, message: `Switched to "${c.name}"`, connectionId: id });
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json({});
    }
});

app.get('/api/connections/active', authenticate, async (req, res) => {
    try {
        const userActiveId = getUserActiveConnectionId(req.user.id);
        // Fast path: if we already know the user's active connection and it's in
        // the global cache, skip the DB query entirely (saves ~50-200ms per refresh)
        if (userActiveId) {
            const cached = CONNECTIONS.find((c) => c.id === userActiveId);
            if (cached) {
                return res.json({ connectionId: cached.id, connection: sanitizeConn(cached) });
            }
        }
        // Slow path: query DB for the full list
        const conns = await dbLoadConnections(req.user.id, req.user.role);
        const active = conns.find((c) => c.id === userActiveId) || conns.find((c) => c.isDefault) || conns[0] || null;
        // If we resolved a default but the user hasn't explicitly set one, record it
        if (active && !userActiveId) setUserActiveConnectionId(req.user.id, active.id);

        // PERF: kick off a background warm-up so the next metrics call
        // finds a live socket. Skipped on Vercel (no long-lived process).
        if (active && process.env.VERCEL !== '1') {
            (async () => {
                try {
                    const dbType = (active.dbType || 'postgresql').toLowerCase();
                    if (dbType === 'postgresql' || dbType === 'mysql' || dbType === 'mariadb') {
                        const pool = await getPool(active.id, req.user?.id);
                        if (pool && typeof pool.query === 'function') {
                            await pool.query('SELECT 1').catch(() => {});
                        }
                    }
                } catch {
                    /* swallow — warm-up never blocks */
                }
            })();
        }

        res.json({ connectionId: active?.id ?? null, connection: active ? sanitizeConn(active) : null });
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json({});
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2: FLEET HEALTH & MONITORING ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/connections/health
 * Health check all saved connections. Loops through each connection, tests with SELECT 1,
 * measures latency, and returns array of { id, name, dbType, status, latencyMs, lastChecked }
 */
app.get('/api/connections/health', authenticate, async (req, res) => {
    try {
        const conns = await dbLoadConnections(req.user.id, req.user.role);

        // Probe every connection concurrently. This used to be a sequential
        // for-await, so the endpoint took the SUM of all probes — five
        // connections at ~1.5s each meant a 7.5s response.
        const healthResults = await Promise.all(conns.map(async (conn) => {
            const dbType = (conn.dbType || 'postgresql').toLowerCase();
            try {
                // Postgres: reuse the warm pool. Building a fresh Pool per poll
                // measured TCP + TLS + SCRAM handshake rather than the database,
                // which is why "latency" read ~1500ms against a pooler in
                // another region while queries were actually fast. The warm
                // path measures the query round-trip, which is the number
                // someone reading a dashboard thinks they are looking at.
                if (dbType !== 'mongodb' && dbType !== 'mysql' && dbType !== 'mariadb') {
                    const warm = await getPool(conn.id);
                    const t0 = Date.now();
                    await warm.query('SELECT 1');
                    return {
                        id: conn.id,
                        name: conn.name,
                        dbType: conn.dbType || 'postgresql',
                        status: 'ok',
                        latencyMs: Date.now() - t0,
                        probe: 'warm',
                        lastChecked: new Date().toISOString(),
                    };
                }

                const poolCfg = await resolvePoolConfig(conn);
                const startTime = Date.now();

                if (dbType === 'mongodb') {
                    if (!mongodb) throw new Error('MongoDB driver not installed');
                    const userPart = poolCfg.user
                        ? `${encodeURIComponent(poolCfg.user)}:${encodeURIComponent(poolCfg.password || '')}@`
                        : '';
                    const sslParam = conn.ssl ? '?tls=true&tlsAllowInvalidCertificates=true' : '';
                    const connStr = `mongodb://${userPart}${poolCfg.host}:${poolCfg.port || 27017}/${poolCfg.database || 'admin'}${sslParam}`;
                    const testClient = new mongodb.MongoClient(connStr, { serverSelectionTimeoutMS: 5000 });
                    await testClient.connect();
                    await testClient.db(poolCfg.database || 'admin').command({ ping: 1 });
                    await testClient.close();
                } else if (dbType === 'mysql' || dbType === 'mariadb') {
                    if (!mysql2) throw new Error('MySQL driver not installed');
                    const testConn = await mysql2.createConnection({
                        host: poolCfg.host,
                        port: poolCfg.port,
                        database: poolCfg.database,
                        user: poolCfg.user,
                        password: poolCfg.password,
                        ssl: buildSslOption(conn.ssl) || undefined,
                        connectTimeout: 5000,
                    });
                    await testConn.query('SELECT 1');
                    await testConn.end();
                } else {
                    // PRF-03 (audit): always end() the test pool, even on failure.
                    const testPool = new Pool({ ...poolCfg, connectionTimeoutMillis: 5000 });
                    try {
                        const client = await testPool.connect();
                        try {
                            await client.query('SELECT 1');
                        } finally {
                            client.release();
                        }
                    } finally {
                        await testPool.end().catch(() => undefined);
                    }
                }

                // Mongo/MySQL still open a throwaway connection, so this is
                // connect + query. Labelled so the UI can say which it is.
                return {
                    id: conn.id,
                    name: conn.name,
                    dbType: conn.dbType || 'postgresql',
                    status: 'ok',
                    latencyMs: Date.now() - startTime,
                    probe: 'cold',
                    lastChecked: new Date().toISOString(),
                };
            } catch (err) {
                return {
                    id: conn.id,
                    name: conn.name,
                    dbType: conn.dbType || 'postgresql',
                    status: 'error',
                    latencyMs: null,
                    probe: null,
                    lastChecked: new Date().toISOString(),
                    error: err.message,
                };
            }
        }));

        res.json(healthResults);
    } catch (e) {
        log('ERROR', `[/api/connections/health] ${e.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/connections/count
 * Connection count for first-run detection. Returns { count: N }
 */
app.get('/api/connections/count', authenticate, async (req, res) => {
    try {
        const conns = await dbLoadConnections(req.user.id, req.user.role);
        res.json({ count: conns.length });
    } catch (e) {
        log('ERROR', `[/api/connections/count] ${e.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/connections/parse-url
 * Parse connection string (postgresql://, mysql://, mongodb://) into structured fields.
 * Request body: { url: "postgresql://user:pass@host:5432/dbname" }
 */
app.post('/api/connections/parse-url', authenticate, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'url field is required and must be a string' });
        }

        let parsed = {};

        try {
            const urlObj = new URL(url);
            const protocol = urlObj.protocol.replace(':', '');

            // Determine database type from protocol
            let dbType = 'postgresql';
            if (protocol.includes('mysql')) dbType = 'mysql';
            else if (protocol.includes('mongo')) dbType = 'mongodb';

            parsed = {
                dbType,
                host: urlObj.hostname || '',
                port: urlObj.port
                    ? parseInt(urlObj.port)
                    : dbType === 'mysql'
                      ? 3306
                      : dbType === 'mongodb'
                        ? 27017
                        : 5432,
                database: urlObj.pathname.replace(/^\//, '') || 'postgres',
                username: urlObj.username || '',
                password: urlObj.password || '',
            };
        } catch (parseErr) {
            return res.status(400).json({ error: `Invalid connection URL: ${parseErr.message}` });
        }

        res.json(parsed);
    } catch (e) {
        log('ERROR', `[/api/connections/parse-url] ${e.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/health
 * System health check. Returns control plane status, active connection count, uptime, memory usage.
 * Response: { controlPlane: 'ok'|'error', activeConnections: N, uptime: seconds, memoryMB: number }
 */
app.get('/api/health', async (req, res) => {
    try {
        const uptime = process.uptime();
        const memUsage = process.memoryUsage();
        const memoryMB = Math.round(memUsage.heapUsed / 1024 / 1024);

        // By default this is a lightweight liveness ping. The login page (and
        // similar "is the API up?" callers) only read res.ok, so running the
        // full schema/encryption diagnostics on every poll is wasted work and
        // makes the call slow on cold starts. Full diagnostics are opt-in via
        // `?full=1` for operators who want the detailed control-plane probe.
        const full = req.query.full === '1' || req.query.full === 'true';

        if (!full) {
            res.status(200).json({
                controlPlane: 'ok',
                activeConnections: connectionPools.size,
                uptime: Math.round(uptime),
                memoryMB,
                timestamp: new Date().toISOString(),
            });
            return;
        }

        // Operators can probe `/api/health?full=1` to see every config problem
        // at once, instead of having to trigger a 503 to find out what's broken.
        const diagnostics = await runSystemDiagnostics({ pool });
        const status = diagnostics.ok ? 200 : 503;

        res.status(status).json({
            controlPlane: diagnostics.ok ? 'ok' : 'degraded',
            activeConnections: connectionPools.size,
            uptime: Math.round(uptime),
            memoryMB,
            diagnostics: {
                ok: diagnostics.ok,
                encryption: diagnostics.encryption,
                schema: diagnostics.schema,
                provider: diagnostics.provider,
                warnings: diagnostics.warnings || [],
                blockers: diagnostics.blockers,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (e) {
        log('ERROR', `[/api/health] ${e.message}`);
        res.status(500).json({
            controlPlane: 'error',
            error: 'Internal server error',
            timestamp: new Date().toISOString(),
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// FEEDBACK ROUTES
// ─────────────────────────────────────────────────────────────────────────────
// Extracted to routes/feedbackRoutes.js (audit M-3) and mounted with the other
// route modules below.

// ─────────────────────────────────────────────────────────────────────────────
// REPLICATION & WAL
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/replication/status', authenticate, cached('repl:status', CONFIG.CACHE_TTL.WAL), async (req, res) => {
    try {
        const _p = await reqPool(req);
        const [replicas, slots, walReceiver, walSender, walSettings] = await Promise.all([
            _p.query(`
                SELECT pid, usename, application_name, client_addr::text,
                    state, sync_state,
                       sent_lsn::text, write_lsn::text, flush_lsn::text, replay_lsn::text,
                    pg_wal_lsn_diff(sent_lsn,  write_lsn)  AS write_lag_bytes,
                       pg_wal_lsn_diff(write_lsn, flush_lsn)  AS flush_lag_bytes,
                       pg_wal_lsn_diff(flush_lsn, replay_lsn) AS replay_lag_bytes,
                       pg_wal_lsn_diff(sent_lsn,  replay_lsn) AS total_lag_bytes,
                       EXTRACT(EPOCH FROM write_lag)::int       AS write_lag_sec,
                    EXTRACT(EPOCH FROM flush_lag)::int       AS flush_lag_sec,
                    EXTRACT(EPOCH FROM replay_lag)::int      AS replay_lag_sec,
                    reply_time::text
                FROM pg_stat_replication
                ORDER BY total_lag_bytes DESC NULLS LAST
            `),
            _p.query(`
                SELECT slot_name, plugin, slot_type, database, active, active_pid,
                       pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn) AS lag_bytes,
                       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)) AS lag_pretty,
                       wal_status, safe_wal_size, two_phase
                FROM pg_replication_slots
                ORDER BY lag_bytes DESC NULLS LAST
            `),
            _p
                .query(
                    `
                SELECT status, receive_start_lsn::text, received_tli,
                       last_msg_send_time::text, last_msg_receipt_time::text,
                    latest_end_lsn::text, latest_end_time::text,
                    sender_host, sender_port, slot_name, conninfo
                FROM pg_stat_wal_receiver
            `,
                )
                .catch(() => ({ rows: [] })),
            _p.query(`
                SELECT pg_current_wal_lsn()::text                    AS current_lsn,
                    pg_walfile_name(pg_current_wal_lsn())          AS current_wal,
                       pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0')  AS total_bytes_generated,
                       (SELECT count(*) FROM pg_stat_replication)      AS replica_count,
                       pg_is_in_recovery()                            AS in_recovery
            `),
            _p.query(`
                SELECT name, setting, unit
                FROM pg_settings
                WHERE name IN ('wal_level','max_wal_senders','max_replication_slots',
                               'wal_keep_size','synchronous_standby_names','wal_sender_timeout')
                ORDER BY name
            `),
        ]);
        res.json({
            replicas: replicas.rows,
            slots: slots.rows,
            walReceiver: walReceiver.rows[0] || null,
            walSender: walSender.rows[0],
            settings: walSettings.rows,
        });
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json({});
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOAT ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/bloat/tables', authenticate, cached('bloat:tables', CONFIG.CACHE_TTL.BLOAT), async (req, res) => {
    try {
        const r = await (
            await reqPool(req)
        ).query(`
            WITH stats AS (
                SELECT
                    schemaname,
                    relname                                                                              AS tablename,
                    pg_total_relation_size(relid)                                                       AS total_bytes,
                    pg_relation_size(relid)                                                             AS table_bytes,
                    pg_indexes_size(relid)                                                              AS index_bytes,
                    n_dead_tup,
                    n_live_tup,
                    CASE WHEN (n_live_tup + n_dead_tup) > 0
                             THEN round(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2)
                         ELSE 0
                        END                                                                                 AS dead_pct,
                    last_vacuum,
                    last_autovacuum,
                    n_mod_since_analyze
                FROM pg_stat_user_tables
            )
            SELECT
                schemaname,
                tablename,
                total_bytes,
                table_bytes,
                index_bytes,
                n_dead_tup,
                n_live_tup,
                dead_pct,
                last_vacuum,
                last_autovacuum,
                n_mod_since_analyze,
                pg_size_pretty(total_bytes)                                                             AS total_size,
                pg_size_pretty(table_bytes)                                                             AS table_size,
                pg_size_pretty(index_bytes)                                                             AS index_size,
                pg_size_pretty((dead_pct / 100.0 * table_bytes)::bigint)                               AS estimated_bloat_size
            FROM stats
            WHERE total_bytes > 8192
            ORDER BY dead_pct DESC, total_bytes DESC
                LIMIT 100
        `);
        res.json(r.rows);
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json([]);
    }
});

app.get('/api/bloat/indexes', authenticate, cached('bloat:indexes', CONFIG.CACHE_TTL.BLOAT), async (req, res) => {
    try {
        const r = await (
            await reqPool(req)
        ).query(`
            SELECT
                s.schemaname,
                s.relname                                                                               AS tablename,
                s.indexrelname                                                                          AS indexname,
                pg_size_pretty(pg_relation_size(s.indexrelid))                                         AS index_size,
                pg_relation_size(s.indexrelid)                                                         AS index_bytes,
                s.idx_scan,
                s.idx_tup_read,
                s.idx_tup_fetch,
                CASE
                    WHEN s.idx_scan    = 0 THEN 100
                    WHEN s.idx_tup_read = 0 THEN 0
                    ELSE round((1.0 - s.idx_tup_fetch::numeric / s.idx_tup_read) * 100, 1)
                    END                                                                                     AS inefficiency_pct,
                pg_get_indexdef(s.indexrelid)                                                           AS index_def
            FROM pg_stat_user_indexes s
                     JOIN pg_index i ON i.indexrelid = s.indexrelid
            WHERE NOT i.indisprimary
            ORDER BY pg_relation_size(s.indexrelid) DESC
                LIMIT 80
        `);
        res.json(r.rows);
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json([]);
    }
});

app.get('/api/bloat/summary', authenticate, cached('bloat:summary', CONFIG.CACHE_TTL.BLOAT), async (req, res) => {
    try {
        const r = await (
            await reqPool(req)
        ).query(`
            SELECT
                count(*)                                                                                AS total_tables,
                count(*) FILTER (WHERE
                    (n_live_tup + n_dead_tup) > 0
                    AND (100.0 * n_dead_tup / (n_live_tup + n_dead_tup)) > 10
                )                                                                                       AS high_bloat_tables,
                count(*) FILTER (WHERE
                    (n_live_tup + n_dead_tup) > 0
                    AND (100.0 * n_dead_tup / (n_live_tup + n_dead_tup)) > 20
                )                                                                                       AS critical_bloat_tables,
                pg_size_pretty(
                        sum(pg_total_relation_size(relid))
                )                                                                                       AS total_db_size,
                sum(pg_total_relation_size(relid))                                                      AS total_bytes,
                round(
                        avg(
                                CASE WHEN (n_live_tup + n_dead_tup) > 0
                                         THEN 100.0 * n_dead_tup / (n_live_tup + n_dead_tup)
                                     ELSE 0
                                    END
                        ), 2
                )                                                                                       AS avg_dead_pct,
                sum(n_dead_tup)                                                                         AS total_dead_tuples,
                sum(n_live_tup)                                                                         AS total_live_tuples
            FROM pg_stat_user_tables
        `);
        res.json(r.rows[0] || {});
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json({});
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// QUERY PLAN REGRESSION
// ─────────────────────────────────────────────────────────────────────────────
const planBaselines = new Map();
if (process.env.VERCEL !== '1')
    setInterval(() => {
        if (planBaselines.size > 500) planBaselines.clear();
    }, 600_000);

app.post('/api/regression/capture', authenticate, async (req, res) => {
    try {
        const { query, label } = req.body;
        if (!query) return res.status(400).json({ error: 'query required' });
        const validationError = validateExplainQuery(query);
        if (validationError) return res.status(400).json({ error: validationError });
        const dbPool = await reqPool(req);
        // Execute EXPLAIN in a read-only transaction with timeout
        await dbPool.query('BEGIN TRANSACTION READ ONLY');
        try {
            await dbPool.query('SET LOCAL statement_timeout = 5000');
            const result = await dbPool.query(`EXPLAIN (COSTS, FORMAT JSON) ${query}`);
            await dbPool.query('COMMIT');
            const plan = result.rows[0]['QUERY PLAN'][0];
            const cost = plan['Plan']['Total Cost'];
            const fingerprint = Buffer.from(query.trim().toLowerCase()).toString('base64').slice(0, 32);
            const safeLabel = typeof label === 'string' ? label.slice(0, 120) : query.slice(0, 60);
            planBaselines.set(fingerprint, { plan, cost, ts: new Date().toISOString(), query, label: safeLabel });
            res.json({ fingerprint, cost, plan, message: 'Baseline captured' });
        } catch (error) {
            await dbPool.query('ROLLBACK');
            throw error;
        }
    } catch (e) {
        log('ERROR', 'Regression capture error', { error: e.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/regression/compare', authenticate, async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'query required' });
        const validationError = validateExplainQuery(query);
        if (validationError) return res.status(400).json({ error: validationError });
        const fingerprint = Buffer.from(query.trim().toLowerCase()).toString('base64').slice(0, 32);
        const baseline = planBaselines.get(fingerprint);

        const dbPool = await reqPool(req);
        // Execute EXPLAIN in a read-only transaction with timeout
        await dbPool.query('BEGIN TRANSACTION READ ONLY');
        try {
            await dbPool.query('SET LOCAL statement_timeout = 5000');
            const result = await dbPool.query(`EXPLAIN (COSTS, FORMAT JSON) ${query}`);
            await dbPool.query('COMMIT');
            const currentPlan = result.rows[0]['QUERY PLAN'][0];
            const currentCost = currentPlan['Plan']['Total Cost'];

            if (!baseline) {
                return res.json({ status: 'no_baseline', currentCost, currentPlan, fingerprint });
            }

            const costChange = ((currentCost - baseline.cost) / Math.max(baseline.cost, 0.001)) * 100;
            const regression = costChange > 20;
            res.json({
                status: regression ? 'regression' : 'ok',
                fingerprint,
                costChange: Math.round(costChange * 10) / 10,
                baseline: { cost: baseline.cost, plan: baseline.plan, ts: baseline.ts, label: baseline.label },
                current: { cost: currentCost, plan: currentPlan },
                regression,
            });
        } catch (error) {
            await dbPool.query('ROLLBACK');
            throw error;
        }
    } catch (e) {
        log('ERROR', 'Regression compare error', { error: e.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/regression/baselines', authenticate, (req, res) => {
    const list = Array.from(planBaselines.entries()).map(([fp, b]) => ({
        fingerprint: fp,
        label: b.label,
        cost: b.cost,
        ts: b.ts,
        queryPreview: b.query.slice(0, 120),
    }));
    res.json(list);
});

app.delete('/api/regression/baselines/:fp', authenticate, (req, res) => {
    planBaselines.delete(req.params.fp);
    res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// LOG ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/logs/slow-queries', authenticate, cached('logs:slow', CONFIG.CACHE_TTL.PERFORMANCE), async (req, res) => {
    try {
        const threshold = parseInt(req.query.min_ms, 10) || 1000;
        const r = await (
            await reqPool(req)
        ).query(
            `
            SELECT query,
                   calls,
                   round(mean_exec_time::numeric, 2)  AS mean_ms,
                   round(max_exec_time::numeric,  2)  AS max_ms,
                   round(total_exec_time::numeric, 2) AS total_ms,
                   round((shared_blks_hit::numeric / NULLIF(shared_blks_hit + shared_blks_read, 0))*100, 1) AS cache_hit_pct,
                rows
            FROM pg_stat_statements
            WHERE mean_exec_time > $1
            ORDER BY mean_exec_time DESC
                LIMIT 50
        `,
            [threshold],
        );
        res.json(r.rows);
    } catch (e) {
        res.json([]);
    }
});

app.get('/api/logs/error-events', authenticate, cached('logs:errors', 15_000), async (req, res) => {
    try {
        const r = await (
            await reqPool(req)
        ).query(`
            SELECT pid, usename, datname, application_name,
                   state, wait_event_type, wait_event,
                left(query, 200) AS query_preview,
                query_start::text,
                round(EXTRACT(EPOCH FROM (now() - query_start))::numeric, 1) AS duration_sec
            FROM pg_stat_activity
            WHERE state != 'idle'
              AND query NOT LIKE '%pg_stat_activity%'
              AND query_start IS NOT NULL
            ORDER BY query_start ASC
                LIMIT 40
        `);
        res.json(r.rows);
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json([]);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// CLOUDWATCH ROUTES — powered by cloudwatchService.js (no AWS SDK required)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/cloudwatch/status', authenticate, (req, res) => {
    try {
        const { accessKey, secretKey, region, db } = req.query;
        const overrides = accessKey ? { accessKey, secretKey, region, dbId: db } : {};
        res.json(getStatus(overrides));
    } catch (e) {
        res.json({});
    }
});

app.get('/api/cloudwatch/metrics', authenticate, async (req, res) => {
    const { metric, period, accessKey, secretKey, region, db } = req.query;
    if (!metric) return res.status(400).json({ error: 'metric query param required' });
    const periodSec = Number(period) || 3600;
    const overrides = accessKey ? { accessKey, secretKey, region, dbId: db } : {};
    try {
        const datapoints = await getMetric(metric, periodSec, overrides);
        res.json({ metric, datapoints });
    } catch (e) {
        log('ERROR', 'CloudWatch metric fetch failed', { metric, error: e.message });
        res.json({});
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// DBA TASK SCHEDULER
// ─────────────────────────────────────────────────────────────────────────────
// Routes extracted to routes/dbaTaskRoutes.js (audit M-3) and mounted with the
// other route modules below. Backed by Postgres via dbaTaskService.js (M-2).

// ─────────────────────────────────────────────────────────────────────────────
// LOG PATTERN ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/log-patterns/summary', authenticate, cached('log:patterns', 30_000), async (req, res) => {
    try {
        const _p = await reqPool(req);
        const [waitEvents, lockWaits, slowQueries, errorStates, dbActivity, topQueries] = await Promise.all([
            _p.query(`
                SELECT wait_event_type, wait_event, COUNT(*) AS count
                FROM pg_stat_activity
                WHERE wait_event IS NOT NULL AND state != 'idle'
                GROUP BY wait_event_type, wait_event
                ORDER BY count DESC LIMIT 20
            `),
            _p.query(`
                SELECT
                    blocked.pid AS blocked_pid,
                    blocked.usename AS blocked_user,
                    left(blocked.query, 120) AS blocked_query,
                    blocking.pid AS blocking_pid,
                    blocking.usename AS blocking_user,
                    left(blocking.query, 120) AS blocking_query,
                    round(EXTRACT(EPOCH FROM (now() - blocked.query_start))::numeric, 1) AS wait_sec
                FROM pg_stat_activity blocked
                    JOIN pg_stat_activity blocking ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
                WHERE cardinality(pg_blocking_pids(blocked.pid)) > 0
                    LIMIT 20
            `),
            _p
                .query(
                    `
                SELECT
                    left(query, 100) AS query_preview,
                    calls,
                    round(mean_exec_time::numeric, 2) AS mean_ms,
                    round(max_exec_time::numeric, 2) AS max_ms,
                    round(stddev_exec_time::numeric, 2) AS stddev_ms,
                    round(total_exec_time::numeric, 2) AS total_ms,
                    round((100 * total_exec_time / NULLIF(SUM(total_exec_time) OVER (), 0))::numeric, 2) AS pct_total
                FROM pg_stat_statements
                WHERE mean_exec_time > 100
                ORDER BY total_exec_time DESC
                    LIMIT 15
            `,
                )
                .catch(() => ({ rows: [] })),
            _p.query(`
                SELECT state, wait_event_type, COUNT(*) AS count,
                       AVG(EXTRACT(EPOCH FROM (now() - query_start)))::int AS avg_age_sec
                FROM pg_stat_activity
                WHERE state IS NOT NULL
                GROUP BY state, wait_event_type
                ORDER BY count DESC
            `),
            _p.query(`
                SELECT datname,
                       numbackends,
                       xact_commit,
                       xact_rollback,
                       round((100.0 * xact_rollback / NULLIF(xact_commit + xact_rollback, 0))::numeric, 2) AS rollback_pct,
                       blks_read,
                       blks_hit,
                       round((100.0 * blks_hit / NULLIF(blks_read + blks_hit, 0))::numeric, 2) AS cache_hit_pct,
                       deadlocks,
                       temp_files,
                       temp_bytes
                FROM pg_stat_database
                WHERE datname IS NOT NULL
                ORDER BY numbackends DESC
                    LIMIT 10
            `),
            _p
                .query(
                    `
                SELECT left(query, 100) AS query_preview, calls, round(mean_exec_time::numeric,2) AS mean_ms, rows
                FROM pg_stat_statements
                ORDER BY calls DESC LIMIT 10
            `,
                )
                .catch(() => ({ rows: [] })),
        ]);

        res.json({
            waitEvents: waitEvents.rows,
            lockWaits: lockWaits.rows,
            slowQueries: slowQueries.rows,
            errorStates: errorStates.rows,
            dbActivity: dbActivity.rows,
            topQueries: topQueries.rows,
        });
    } catch (e) {
        res.json({});
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ALERT CORRELATION
// ─────────────────────────────────────────────────────────────────────────────
const alertEventStore = [];
const MAX_ALERT_EVENTS = 500;

async function captureAlertSnapshot() {
    if (!pool) return;
    try {
        const [conns, locks, waits, repl, bgwriter] = await Promise.all([
            pool.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER(WHERE state='active') AS active,
                            COUNT(*) FILTER(WHERE wait_event IS NOT NULL) AS waiting
                        FROM pg_stat_activity`),
            pool.query(`SELECT COUNT(*) AS lock_count FROM pg_locks WHERE NOT granted`),
            pool.query(`SELECT wait_event_type, COUNT(*) AS cnt FROM pg_stat_activity
                        WHERE wait_event IS NOT NULL AND state!='idle' GROUP BY wait_event_type`),
            pool
                .query(`SELECT COUNT(*) AS replica_count FROM pg_stat_replication`)
                .catch(() => ({ rows: [{ replica_count: 0 }] })),
            pool
                .query(
                    `
                SELECT
                    COALESCE(
                        (SELECT num_requested  FROM pg_stat_checkpointer LIMIT 1),
                        (SELECT checkpoints_req FROM pg_stat_bgwriter    LIMIT 1),
                        0
                    ) AS checkpoints_req,
                    COALESCE(
                        (SELECT num_timed      FROM pg_stat_checkpointer LIMIT 1),
                        (SELECT checkpoints_timed FROM pg_stat_bgwriter  LIMIT 1),
                        0
                    ) AS checkpoints_timed
            `,
                )
                .catch(() => ({ rows: [{ checkpoints_req: 0, checkpoints_timed: 0 }] })),
        ]);

        const c = conns.rows[0];
        const locks_waiting = Number(locks.rows[0]?.lock_count || 0);
        const waitMap = Object.fromEntries(waits.rows.map((r) => [r.wait_event_type, Number(r.cnt)]));

        const now = new Date().toISOString();
        const events = [];

        if (Number(c.waiting) > 5)
            events.push({
                ts: now,
                type: 'connection',
                severity: Number(c.waiting) > 15 ? 'critical' : 'warning',
                message: `${c.waiting} sessions waiting`,
                metric: 'waiting_sessions',
                value: Number(c.waiting),
            });
        if (locks_waiting > 0)
            events.push({
                ts: now,
                type: 'lock',
                severity: locks_waiting > 3 ? 'critical' : 'warning',
                message: `${locks_waiting} ungranted lock(s)`,
                metric: 'lock_waits',
                value: locks_waiting,
            });
        if (Number(c.total) > 80)
            events.push({
                ts: now,
                type: 'connection',
                severity: 'warning',
                message: `High connection count: ${c.total}`,
                metric: 'total_connections',
                value: Number(c.total),
            });
        if (waitMap['Lock'] > 0)
            events.push({
                ts: now,
                type: 'lock',
                severity: 'warning',
                message: `${waitMap['Lock']} lock-wait sessions`,
                metric: 'lock_wait_sessions',
                value: waitMap['Lock'],
            });
        if (waitMap['IO'] > 3)
            events.push({
                ts: now,
                type: 'io',
                severity: 'warning',
                message: `${waitMap['IO']} IO-wait sessions`,
                metric: 'io_wait_sessions',
                value: waitMap['IO'],
            });

        if (events.length > 0) {
            alertEventStore.push(...events);
            if (alertEventStore.length > MAX_ALERT_EVENTS)
                alertEventStore.splice(0, alertEventStore.length - MAX_ALERT_EVENTS);
        }
    } catch (_) {
        /* silent */
    }
}

// Alert snapshot capture — only on long-lived processes (not Vercel serverless)
if (process.env.VERCEL !== '1') setInterval(captureAlertSnapshot, 30_000);

app.get('/api/alerts/correlation', authenticate, cached('alerts:corr', 15_000), async (req, res) => {
    try {
        const _p = await reqPool(req);
        const [conns, locks, waits, tables, txAge] = await Promise.all([
            _p.query(`
                SELECT state, wait_event_type, wait_event, COUNT(*) AS cnt,
                       MAX(EXTRACT(EPOCH FROM (now()-query_start)))::int AS max_age_sec
                FROM pg_stat_activity WHERE state IS NOT NULL
                GROUP BY state, wait_event_type, wait_event ORDER BY cnt DESC
            `),
            _p.query(
                `SELECT locktype, mode, granted, COUNT(*) AS cnt FROM pg_locks GROUP BY locktype,mode,granted ORDER BY cnt DESC LIMIT 20`,
            ),
            _p.query(`
                SELECT pid, usename, datname, state, wait_event_type, wait_event,
                    left(query,120) AS query, round(EXTRACT(EPOCH FROM (now()-query_start))::numeric,1) AS age_sec
                FROM pg_stat_activity
                WHERE state != 'idle' AND query NOT LIKE '%pg_stat_activity%'
                ORDER BY age_sec DESC NULLS LAST LIMIT 25
            `),
            _p.query(`
                SELECT relname AS table_name,
                       n_dead_tup, n_live_tup,
                       round((n_dead_tup::numeric/NULLIF(n_live_tup+n_dead_tup,0)*100),1) AS dead_pct,
                       last_autovacuum, last_autoanalyze
                FROM pg_stat_user_tables
                WHERE n_dead_tup > 1000
                ORDER BY dead_pct DESC NULLS LAST LIMIT 10
            `),
            _p.query(`
                SELECT pid, usename, datname,
                       age(backend_xid)  AS xid_age,
                       age(backend_xmin) AS xmin_age,
                    left(query,120) AS query,
                    round(EXTRACT(EPOCH FROM (now()-xact_start))::numeric,1) AS xact_age_sec
                FROM pg_stat_activity
                WHERE xact_start IS NOT NULL
                  AND state != 'idle'
                ORDER BY xact_age_sec DESC NULLS LAST LIMIT 10
            `),
        ]);

        const WINDOW_MS = 5 * 60 * 1000;
        const groups = [];
        let remaining = [...alertEventStore];

        while (remaining.length > 0) {
            const anchor = remaining.shift();
            const anchorTs = new Date(anchor.ts).getTime();
            const cluster = [anchor];
            const survivors = [];
            for (const ev of remaining) {
                if (Math.abs(new Date(ev.ts).getTime() - anchorTs) <= WINDOW_MS) {
                    cluster.push(ev);
                } else {
                    survivors.push(ev);
                }
            }
            remaining = survivors;
            groups.push({
                id: `grp-${anchorTs}`,
                startTs: anchor.ts,
                endTs: cluster[cluster.length - 1].ts,
                events: cluster,
                types: [...new Set(cluster.map((e) => e.type))],
                severity: cluster.some((e) => e.severity === 'critical') ? 'critical' : 'warning',
                rootCause: guessRootCause(cluster),
            });
        }

        res.json({
            correlationGroups: groups.slice(-20),
            recentEvents: alertEventStore.slice(-50),
            liveSessions: waits.rows,
            lockSummary: locks.rows,
            sessionStates: conns.rows,
            bloatedTables: tables.rows,
            longTransactions: txAge.rows,
        });
    } catch (e) {
        res.json({});
    }
});

function guessRootCause(events) {
    const types = events.map((e) => e.type);
    const hasLock = types.includes('lock');
    const hasConn = types.includes('connection');
    const hasIO = types.includes('io');
    if (hasLock && hasConn) return 'Lock contention causing connection pile-up — identify and terminate blocking query';
    if (hasLock) return 'Lock contention — a long-running transaction may be blocking others';
    if (hasConn && hasIO) return 'High IO causing slow queries, leading to connection accumulation';
    if (hasConn) return 'Connection spike — check for connection leaks or missing pooler';
    if (hasIO) return 'IO saturation — consider increasing shared_buffers or adding indexes';
    return 'Multiple concurrent anomalies detected — review pg_stat_activity';
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECKPOINT MONITOR
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/checkpoint/stats', authenticate, cached('chk:stats', CONFIG.CACHE_TTL.STATS), async (req, res) => {
    try {
        const _p = await reqPool(req);
        const [bgwriter, walLsn, walSettings] = await Promise.all([
            _p.query(`
                SELECT
                    -- PG 17+ splits checkpoint stats into pg_stat_checkpointer;
                    -- fall back to pg_stat_bgwriter for older versions.
                    COALESCE(
                        (SELECT num_timed    FROM pg_stat_checkpointer LIMIT 1),
                        (SELECT checkpoints_timed FROM pg_stat_bgwriter LIMIT 1), 0
                    ) AS checkpoints_timed,
                    COALESCE(
                        (SELECT num_requested FROM pg_stat_checkpointer LIMIT 1),
                        (SELECT checkpoints_req   FROM pg_stat_bgwriter LIMIT 1), 0
                    ) AS checkpoints_req,
                    COALESCE(
                        (SELECT write_time   FROM pg_stat_checkpointer LIMIT 1),
                        (SELECT checkpoint_write_time FROM pg_stat_bgwriter LIMIT 1), 0
                    )::numeric AS checkpoint_write_ms,
                    COALESCE(
                        (SELECT sync_time    FROM pg_stat_checkpointer LIMIT 1),
                        (SELECT checkpoint_sync_time  FROM pg_stat_bgwriter LIMIT 1), 0
                    )::numeric AS checkpoint_sync_ms,
                    COALESCE(
                        (SELECT buffers_written FROM pg_stat_checkpointer LIMIT 1),
                        (SELECT buffers_checkpoint    FROM pg_stat_bgwriter LIMIT 1), 0
                    ) AS buffers_checkpoint,
                    b.buffers_clean,
                    b.maxwritten_clean,
                    b.buffers_backend,
                    b.buffers_backend_fsync,
                    b.buffers_alloc,
                    b.stats_reset
                FROM pg_stat_bgwriter b
            `),
            _p.query(`
                SELECT pg_current_wal_lsn()::text AS current_lsn,
                    pg_walfile_name(pg_current_wal_lsn()) AS current_wal_file,
                       (SELECT setting::int FROM pg_settings WHERE name = 'checkpoint_completion_target') AS completion_target,
                       (SELECT setting::int FROM pg_settings WHERE name = 'max_wal_size') AS max_wal_mb,
                       (SELECT setting::int FROM pg_settings WHERE name = 'min_wal_size') AS min_wal_mb,
                       (SELECT setting::int FROM pg_settings WHERE name = 'checkpoint_timeout') AS checkpoint_timeout_sec
            `),
            _p.query(`
                SELECT name, setting, unit, short_desc
                FROM pg_settings
                WHERE name IN (
                               'checkpoint_completion_target','checkpoint_timeout',
                               'max_wal_size','min_wal_size','wal_buffers',
                               'bgwriter_delay','bgwriter_lru_maxpages','bgwriter_lru_multiplier'
                    )
                ORDER BY name
            `),
        ]);
        res.json({ bgwriter: bgwriter.rows[0], wal: walLsn.rows[0], settings: walSettings.rows });
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json({});
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// BACKUP & RECOVERY
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/backup/status', authenticate, cached('bk:status', 30_000), async (req, res) => {
    try {
        const _p = await reqPool(req);
        const [archiver, walInfo, recoveryInfo] = await Promise.all([
            _p.query(`
                SELECT archived_count, last_archived_wal, last_archived_time,
                       failed_count, last_failed_wal, last_failed_time, stats_reset
                FROM pg_stat_archiver
            `),
            _p.query(`
                SELECT pg_current_wal_lsn()::text        AS current_lsn,
                       pg_walfile_name(pg_current_wal_lsn()) AS current_wal,
                       pg_is_in_recovery()               AS in_recovery,
                       pg_postmaster_start_time()::text  AS started_at
            `),
            _p.query(`
                SELECT name, setting
                FROM pg_settings
                WHERE name IN ('wal_level','archive_mode','archive_command','restore_command',
                               'recovery_target_timeline','max_wal_senders','wal_keep_size')
                ORDER BY name
            `),
        ]);
        res.json({
            archiver: archiver.rows[0],
            wal: walInfo.rows[0],
            settings: recoveryInfo.rows,
        });
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json({});
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// TABLE ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/tables/stats', authenticate, cached('tables:stats', 30_000), async (req, res) => {
    try {
        const r = await (
            await reqPool(req)
        ).query(`
            SELECT
                schemaname AS schema, 
                relname AS name,
                pg_size_pretty(pg_total_relation_size(relid)) AS size,
                pg_total_relation_size(relid) AS total_bytes,
                seq_scan AS "seqScans", 
                idx_scan AS "idxScans",
                n_tup_ins AS inserts, 
                n_tup_upd AS updates, 
                n_tup_del AS deletes,
                n_tup_hot_upd AS "hotUpdates",
                n_live_tup AS "liveTuples", 
                n_dead_tup AS "deadTuples",
                CASE WHEN (n_live_tup + n_dead_tup) > 0 
                     THEN round((n_dead_tup::numeric / (n_live_tup + n_dead_tup)) * 100, 1) 
                     ELSE 0 END AS "deadPct",
                CASE WHEN n_tup_upd > 0 
                     THEN round((n_tup_hot_upd::numeric / n_tup_upd) * 100, 1) 
                     ELSE 0 END AS "hotPct",
                COALESCE(to_char(last_vacuum, 'YYYY-MM-DD HH24:MI'), 'Never') AS "lastVacuum",
                COALESCE(to_char(last_analyze, 'YYYY-MM-DD HH24:MI'), 'Never') AS "lastAnalyze"
            FROM pg_stat_user_tables
            ORDER BY total_bytes DESC NULLS LAST
            LIMIT 100
        `);
        res.json(r.rows);
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json([]);
    }
});

app.get('/api/tables/columns', authenticate, cached('tables:columns', 60_000), async (req, res) => {
    try {
        const r = await (
            await reqPool(req)
        ).query(`
            SELECT
                schemaname,
                tablename,
                attname                              AS name,
                null_frac * 100                      AS "nullPct",
                n_distinct                           AS distinct,
                CASE
                    WHEN most_common_vals IS NULL THEN ''
                    ELSE trim(both '{}' FROM most_common_vals::text)
            END                                  AS "topValues"
            FROM pg_stats
            WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
            ORDER BY schemaname, tablename, attname
        `);
        res.json(r.rows);
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json([]);
    }
});

app.get('/api/tables/dependencies', authenticate, cached('tables:deps', 60_000), async (req, res) => {
    try {
        const r = await (
            await reqPool(req)
        ).query(`
            SELECT
                cl1.relname::text AS table_name,
                COALESCE(
                        array_agg(DISTINCT cl2.relname::text) FILTER (WHERE cl2.relname IS NOT NULL),
                        ARRAY[]::text[]
                ) AS refs_to
            FROM pg_class cl1
                     LEFT JOIN pg_constraint c ON c.conrelid = cl1.oid AND c.contype = 'f'
                     LEFT JOIN pg_class cl2 ON c.confrelid = cl2.oid
            WHERE cl1.relnamespace::regnamespace::text NOT IN ('pg_catalog', 'information_schema')
              AND cl1.relkind = 'r'
            GROUP BY cl1.relname
        `);

        const tables = r.rows.map((row) => ({
            name: row.table_name,
            refsTo: Array.isArray(row.refs_to) ? row.refs_to.filter(Boolean) : [],
            refsBy: [],
        }));

        tables.forEach((t) => {
            t.refsTo.forEach((targetName) => {
                const target = tables.find((x) => x.name === targetName);
                if (target) target.refsBy.push(t.name);
            });
        });

        res.json(tables);
    } catch (e) {
        console.error('Dependencies error:', e);
        res.json({});
    }
});

app.get('/api/tables/toast', authenticate, cached('tables:toast', 60_000), async (req, res) => {
    try {
        const r = await (
            await reqPool(req)
        ).query(`
            SELECT
                n.nspname AS schema,
                c.relname AS table,
                c.reltoastrelid::regclass::text AS "toastTable",
                pg_size_pretty(pg_relation_size(c.reltoastrelid)) AS "toastSize",
                pg_relation_size(c.reltoastrelid) AS "toastBytes",
                t_stat.n_dead_tup AS "deadChunks",
                CASE WHEN (t_stat.n_live_tup + t_stat.n_dead_tup) > 0 
                     THEN round((t_stat.n_dead_tup::numeric / (t_stat.n_live_tup + t_stat.n_dead_tup)) * 100, 1) 
                     ELSE 0 END AS "deadPct"
            FROM pg_class c
            JOIN pg_namespace n ON c.relnamespace = n.oid
            LEFT JOIN pg_stat_user_tables t_stat ON c.reltoastrelid = t_stat.relid
            WHERE c.relkind = 'r' AND c.reltoastrelid != 0
              AND n.nspname NOT IN ('pg_catalog', 'information_schema')
            ORDER BY "toastBytes" DESC
            LIMIT 50
        `);
        res.json(r.rows);
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json([]);
    }
});

app.get('/api/tables/temp', authenticate, cached('tables:temp', CONFIG.CACHE_TTL.TABLE_STATS), async (req, res) => {
    try {
        const r = await (
            await reqPool(req)
        ).query(`
            SELECT
                n.nspname AS schema_name,
                c.relname AS table_name,
                pg_size_pretty(pg_total_relation_size(c.oid)) AS size,
                pg_total_relation_size(c.oid) AS size_bytes,
                a.pid,
                a.usename AS user,
                a.application_name AS app,
                extract(epoch from (now() - a.backend_start))::int as age_sec
            FROM pg_class c
                JOIN pg_namespace n ON c.relnamespace = n.oid
                LEFT JOIN pg_stat_activity a ON strpos(n.nspname, a.pid::text) > 0
            WHERE c.relpersistence = 't'
        `);
        res.json(r.rows);
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json([]);
    }
});

app.get('/api/tables/indexes', authenticate, cached('tables:indexes', CONFIG.CACHE_TTL.INDEXES), async (req, res) => {
    try {
        const r = await (
            await reqPool(req)
        ).query(`
            SELECT
                ui.schemaname                                           AS schema,
                ui.relname                                              AS "tableName",
                ui.indexrelname                                         AS name,
                ui.idx_scan                                             AS scans,
                ui.idx_tup_read                                         AS "tupRead",
                ui.idx_tup_fetch                                        AS "tupFetch",
                pg_relation_size(ui.indexrelid)                         AS "sizeBytes",
                pg_size_pretty(pg_relation_size(ui.indexrelid))         AS size,
                am.amname                                               AS type,
                ix.indexdef                                             AS definition,
                i.indisunique                                           AS "isUnique",
                i.indisprimary                                          AS "isPrimary",
                CASE
                    WHEN ui.idx_scan     = 0 THEN 100
                    WHEN ui.idx_tup_read = 0 THEN 0
                    ELSE round(
                        (1.0 - ui.idx_tup_fetch::numeric / NULLIF(ui.idx_tup_read, 0)) * 100,
                        1
                    )
            END                                                     AS "inefficiencyPct"
            FROM pg_stat_user_indexes ui
            JOIN pg_indexes ix
              ON  ix.schemaname = ui.schemaname
              AND ix.tablename  = ui.relname
              AND ix.indexname  = ui.indexrelname
            JOIN pg_class c  ON c.oid  = ui.indexrelid
            JOIN pg_am    am ON am.oid = c.relam
            JOIN pg_index  i ON i.indexrelid = ui.indexrelid
            ORDER BY ui.schemaname, ui.relname, ui.idx_scan DESC
        `);
        res.json(r.rows);
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json([]);
    }
});

app.get('/api/tables/sizes', authenticate, cached('tables:sizes', CONFIG.CACHE_TTL.TABLE_STATS), async (req, res) => {
    try {
        const r = await (
            await reqPool(req)
        ).query(`
            SELECT
                n.nspname                                                   AS schema,
                c.relname                                                   AS name,
                pg_table_size(c.oid)                                        AS "heapBytes",
                pg_indexes_size(c.oid)                                      AS "indexBytes",
                COALESCE(pg_relation_size(ct.oid), 0)                       AS "toastBytes",
                pg_total_relation_size(c.oid)                               AS "totalBytes",
                pg_size_pretty(pg_table_size(c.oid))                        AS "heapSize",
                pg_size_pretty(pg_indexes_size(c.oid))                      AS "indexSize",
                pg_size_pretty(COALESCE(pg_relation_size(ct.oid), 0))       AS "toastSize",
                pg_size_pretty(pg_total_relation_size(c.oid))               AS "totalSize",
                CASE
                    WHEN (s.n_live_tup + s.n_dead_tup) > 0
                    THEN ROUND(
                        (s.n_dead_tup::numeric / (s.n_live_tup + s.n_dead_tup)) * 100,
                        1
                    )
                    ELSE 0
            END                                                         AS "bloatPct"
            FROM pg_class c
            JOIN pg_namespace n   ON n.oid = c.relnamespace
            LEFT JOIN pg_class ct  ON ct.oid = c.reltoastrelid
            LEFT JOIN pg_stat_user_tables s
              ON s.schemaname = n.nspname AND s.relname = c.relname
            WHERE c.relkind = 'r'
              AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
            ORDER BY pg_total_relation_size(c.oid) DESC
        `);
        res.json(r.rows);
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json([]);
    }
});

// ── /api/tables/queries ── pg_stat_statements: slow query analysis ────────────
app.get(
    '/api/tables/queries',
    authenticate,
    cached('tables:queries', CONFIG.CACHE_TTL.PERFORMANCE),
    async (req, res) => {
        try {
            const _p = await reqPool(req);
            // Gracefully return [] when pg_stat_statements is not installed
            const extCheck = await _p.query(
                `SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON e.extnamespace = n.oid WHERE e.extname = 'pg_stat_statements'`,
            );
            if (extCheck.rowCount === 0) return res.json([]);
            const schema = extCheck.rows[0].nspname;
            const r = await _p.query(`
            SELECT
                queryid                                                                         AS "queryId",
                LEFT(query, 500)                                                                AS "query",
                calls                                                                           AS "calls",
                ROUND(mean_exec_time::numeric, 2)                                               AS "meanMs",
                ROUND(max_exec_time::numeric, 2)                                                AS "maxMs",
                ROUND(total_exec_time::numeric, 2)                                              AS "totalMs",
                rows                                                                            AS "rows",
                ROUND(stddev_exec_time::numeric, 2)                                             AS "stddevMs",
                shared_blks_hit                                                                 AS "cacheHits",
                shared_blks_read                                                                AS "diskReads",
                CASE
                    WHEN shared_blks_hit + shared_blks_read = 0 THEN 0
                    ELSE ROUND(
                        100.0 * shared_blks_hit /
                        NULLIF(shared_blks_hit + shared_blks_read, 0),
                    1)
                END                                                                             AS "cacheHitPct"
            FROM "${schema}".pg_stat_statements
            WHERE query NOT LIKE '%pg_stat%'
              AND query NOT LIKE '%pg_catalog%'
              AND calls > 0
            ORDER BY total_exec_time DESC
            LIMIT 50
        `);
            res.json(r.rows);
        } catch (e) {
            if (e.message.includes('pg_stat_statements')) return res.json([]);
            res.json([]);
        }
    },
);

// ── /api/tables/locks ── active locks & blocking chains from pg_locks ─────────
app.get('/api/tables/locks', authenticate, cached('tables:locks', CONFIG.CACHE_TTL.STATS), async (req, res) => {
    try {
        const r = await (
            await reqPool(req)
        ).query(`
            SELECT
                l.pid                                                                           AS "pid",
                c.relname                                                                       AS "relation",
                l.locktype                                                                      AS "lockType",
                l.mode                                                                          AS "mode",
                l.granted                                                                       AS "granted",
                NOT l.granted                                                                   AS "blocked",
                NOT l.granted                                                                   AS "waiting",
                a.state                                                                         AS "state",
                a.application_name                                                              AS "appName",
                a.usename                                                                       AS "userName",
                a.wait_event_type                                                               AS "waitEventType",
                a.wait_event                                                                    AS "waitEvent",
                EXTRACT(EPOCH FROM (NOW() - a.query_start))::INT                               AS "queryAgeSec",
                LEFT(a.query, 200)                                                              AS "currentQuery"
            FROM pg_locks l
            LEFT JOIN pg_class         c ON c.oid = l.relation
            LEFT JOIN pg_stat_activity a ON a.pid = l.pid
            WHERE l.pid <> pg_backend_pid()
            ORDER BY l.granted ASC, l.pid ASC
            LIMIT 100
        `);
        res.json(r.rows);
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json([]);
    }
});

// ── /api/tables/autovacuum ── per-table daemon run history & timestamps ────────
app.get(
    '/api/tables/autovacuum',
    authenticate,
    cached('tables:autovacuum', CONFIG.CACHE_TTL.VACUUM),
    async (req, res) => {
        try {
            const r = await (
                await reqPool(req)
            ).query(`
            SELECT
                schemaname                                                                      AS "schema",
                relname                                                                         AS "name",
                last_vacuum                                                                     AS "lastVacuum",
                last_autovacuum                                                                 AS "lastAutovacuum",
                last_analyze                                                                    AS "lastAnalyze",
                last_autoanalyze                                                                AS "lastAutoanalyze",
                vacuum_count                                                                    AS "vacuumCount",
                autovacuum_count                                                                AS "autovacuumCount",
                analyze_count                                                                   AS "analyzeCount",
                autoanalyze_count                                                               AS "autoanalyzeCount",
                n_live_tup                                                                      AS "liveRows",
                n_dead_tup                                                                      AS "deadRows",
                CASE
                    WHEN n_live_tup + n_dead_tup = 0 THEN 0
                    ELSE ROUND(
                        100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0),
                    1)
                END                                                                             AS "deadPct",
                EXTRACT(EPOCH FROM (NOW() - COALESCE(last_autovacuum, last_vacuum)))::INT       AS "secsSinceVacuum",
                EXTRACT(EPOCH FROM (NOW() - COALESCE(last_autoanalyze, last_analyze)))::INT     AS "secsSinceAnalyze"
            FROM pg_stat_user_tables
            ORDER BY
                COALESCE(last_autovacuum, last_vacuum) ASC NULLS FIRST,
                n_dead_tup DESC
        `);
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    },
);

// ── /api/tables/connections ── pg_stat_activity grouped by state/app/user ─────
app.get(
    '/api/tables/connections',
    authenticate,
    cached('tables:connections', CONFIG.CACHE_TTL.STATS),
    async (req, res) => {
        try {
            const r = await (
                await reqPool(req)
            ).query(`
            SELECT
                COALESCE(application_name, 'unknown')                                           AS "appName",
                COALESCE(usename, 'unknown')                                                    AS "useName",
                COALESCE(datname, 'unknown')                                                    AS "datName",
                COALESCE(state, 'unknown')                                                      AS "state",
                wait_event_type                                                                  AS "waitEventType",
                wait_event                                                                       AS "waitEvent",
                COUNT(*)::INT                                                                    AS "count",
                MAX(EXTRACT(EPOCH FROM (NOW() - backend_start))::INT)                           AS "maxAgeSec",
                MAX(EXTRACT(EPOCH FROM (NOW() - state_change))::INT)                            AS "maxStateAgeSec"
            FROM pg_stat_activity
            WHERE pid <> pg_backend_pid()
            GROUP BY
                application_name, usename, datname,
                state, wait_event_type, wait_event
            ORDER BY COUNT(*) DESC
            LIMIT 50
        `);
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    },
);
// ─────────────────────────────────────────────────────────────────────────────
// VACUUM & MAINTENANCE
// ─────────────────────────────────────────────────────────────────────────────
app.get(
    '/api/maintenance/vacuum-stats',
    authenticate,
    cached('maint:vacuum', CONFIG.CACHE_TTL.VACUUM),
    async (req, res) => {
        try {
            const _p = await reqPool(req);
            const [tables, workers, settings] = await Promise.all([
                _p.query(`
                SELECT schemaname, relname,
                       n_dead_tup, n_live_tup,
                       CASE WHEN n_live_tup > 0
                                THEN round((n_dead_tup::numeric / NULLIF(n_live_tup,0)) * 100, 1)
                            ELSE 0 END AS dead_pct,
                       last_vacuum, last_autovacuum,
                       last_analyze, last_autoanalyze,
                       vacuum_count, autovacuum_count,
                       analyze_count, autoanalyze_count,
                       n_mod_since_analyze,
                       pg_size_pretty(pg_total_relation_size(quote_ident(schemaname)||'.'||quote_ident(relname))) AS total_size
                FROM pg_stat_user_tables
                ORDER BY n_dead_tup DESC
                    LIMIT 50
            `),
                _p.query(`
                SELECT pid, datname,
                       regexp_replace(query, '^autovacuum: ', '') AS table_name,
                       state,
                       round(EXTRACT(EPOCH FROM (now() - query_start))::numeric, 0) AS duration_sec,
                       query_start::text AS started_at
                FROM pg_stat_activity
                WHERE query LIKE 'autovacuum:%'
                ORDER BY query_start ASC
            `),
                _p.query(`
                SELECT name, setting, unit, short_desc
                FROM pg_settings
                WHERE name LIKE 'autovacuum%'
                ORDER BY name
            `),
            ]);
            res.json({ tables: tables.rows, workers: workers.rows, settings: settings.rows });
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({});
        }
    },
);

app.post('/api/maintenance/vacuum', authenticate, requireScreen('admin'), async (req, res) => {
    const { table, schema = 'public', analyze = true } = req.body;
    if (!table || !/^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(table))
        return res.status(400).json({ error: 'Invalid table name' });
    if (!schema || !/^[a-zA-Z_][a-zA-Z0-9_$-]*$/.test(schema))
        return res.status(400).json({ error: 'Invalid schema name' });
    try {
        const cmd = `VACUUM${analyze ? ' ANALYZE' : ''} "${schema}"."${table}"`;
        await (await reqPool(req)).query(cmd);
        cache.clear();
        log('INFO', 'Manual VACUUM executed', { schema, table, analyze });
        res.json({ success: true, command: cmd });
    } catch (e) {
        log('ERROR', 'VACUUM command error', { error: e.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// RESOURCES ROUTES
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/resources/growth', authenticate, cached('res:growth', 60_000), async (req, res) => {
    try {
        const _p = await reqPool(req);
        const r = await _p.query(`
            SELECT
                c.relname AS table_name,
                pg_total_relation_size(c.oid) / 1073741824.0 AS total_size_gb,
                pg_relation_size(c.oid) / 1073741824.0 AS table_size_gb,
                pg_indexes_size(c.oid) / 1073741824.0 AS index_size_gb,
                COALESCE(pg_total_relation_size(c.reltoastrelid) / 1073741824.0, 0) AS toast_size_gb,
                s.n_live_tup AS row_count,
                s.seq_scan,
                s.idx_scan,
                CASE WHEN s.n_live_tup > 0
                    THEN round(((s.n_ins_since_vacuum - s.n_tup_del)::numeric / NULLIF(s.n_live_tup, 0) * 100), 1)
                    ELSE 0 END AS growth_rate
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
            WHERE c.relkind = 'r'
              AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
            ORDER BY pg_total_relation_size(c.oid) DESC
            LIMIT 50
        `);
        res.json(
            r.rows.map((row) => ({
                ...row,
                total_size_gb: parseFloat(row.total_size_gb || 0).toFixed(3),
                index_size_gb: parseFloat(row.index_size_gb || 0).toFixed(3),
                toast_size_gb: parseFloat(row.toast_size_gb || 0).toFixed(3),
                row_count: parseInt(row.row_count || 0),
                seq_scan: parseInt(row.seq_scan || 0),
                idx_scan: parseInt(row.idx_scan || 0),
                growth_rate: parseFloat(row.growth_rate || 0).toFixed(1),
            })),
        );
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json({});
    }
});

app.get('/api/resources/disk-io', authenticate, cached('res:diskio', 15_000), async (req, res) => {
    try {
        const _p = await reqPool(req);
        const r = await _p.query(`
            SELECT
                relname AS table_name,
                heap_blks_read,
                heap_blks_hit,
                idx_blks_read,
                idx_blks_hit,
                toast_blks_read,
                toast_blks_hit,
                tidx_blks_read,
                tidx_blks_hit,
                CASE WHEN (heap_blks_read + heap_blks_hit) > 0
                    THEN round(100.0 * heap_blks_hit / (heap_blks_read + heap_blks_hit), 1)
                    ELSE 100 END AS cache_hit_ratio
            FROM pg_statio_user_tables
            ORDER BY (heap_blks_read + idx_blks_read) DESC
            LIMIT 30
        `);
        res.json(r.rows);
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json([]);
    }
});

app.get('/api/resources/growth-trend', authenticate, cached('res:trend', 120_000), async (req, res) => {
    try {
        const _p = await reqPool(req);
        // Use pg_stat_user_tables for live trend approximation
        const r = await _p.query(`
            SELECT
                relname AS table_name,
                n_live_tup AS live_rows,
                n_dead_tup AS dead_rows,
                n_tup_ins AS total_inserts,
                n_tup_upd AS total_updates,
                n_tup_del AS total_deletes,
                n_ins_since_vacuum AS inserts_since_vacuum,
                last_autovacuum,
                last_autoanalyze,
                pg_total_relation_size(relid) / 1048576.0 AS size_mb
            FROM pg_stat_user_tables
            ORDER BY n_live_tup DESC
            LIMIT 20
        `);
        // Build a simulated time-series from current snapshot for each table
        const now = Date.now();
        const trend = r.rows.map((t) => ({
            table_name: t.table_name,
            size_mb: parseFloat(t.size_mb || 0).toFixed(2),
            live_rows: parseInt(t.live_rows || 0),
            dead_rows: parseInt(t.dead_rows || 0),
            total_inserts: parseInt(t.total_inserts || 0),
            total_updates: parseInt(t.total_updates || 0),
            total_deletes: parseInt(t.total_deletes || 0),
            inserts_since_vacuum: parseInt(t.inserts_since_vacuum || 0),
            last_autovacuum: t.last_autovacuum,
            last_autoanalyze: t.last_autoanalyze,
        }));
        res.json(trend);
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json({});
    }
});

app.get('/api/resources/vacuum-status', authenticate, cached('res:vacuum', 30_000), async (req, res) => {
    try {
        const _p = await reqPool(req);
        const r = await _p.query(`
            SELECT
                relname AS table_name,
                n_dead_tup,
                n_live_tup,
                CASE WHEN (n_live_tup + n_dead_tup) > 0
                    THEN round(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2)
                    ELSE 0 END AS bloat_ratio_pct,
                last_autovacuum,
                last_autoanalyze,
                last_vacuum,
                last_analyze,
                autovacuum_count,
                n_ins_since_vacuum
            FROM pg_stat_user_tables
            WHERE n_dead_tup > 0 OR last_autovacuum IS NOT NULL
            ORDER BY bloat_ratio_pct DESC NULLS LAST
            LIMIT 50
        `);
        res.json(r.rows);
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json([]);
    }
});

app.get('/api/resources/maintenance-logs', authenticate, cached('res:maint', 30_000), async (req, res) => {
    try {
        const _p = await reqPool(req);
        // Combine vacuum and analyze history from pg_stat_user_tables
        const r = await _p.query(`
            SELECT
                relname AS "table",
                'AUTOVACUUM' AS action,
                last_autovacuum AS date,
                n_dead_tup AS dead_rows_cleaned,
                autovacuum_count AS run_count
            FROM pg_stat_user_tables
            WHERE last_autovacuum IS NOT NULL
            UNION ALL
            SELECT
                relname AS "table",
                'AUTOANALYZE' AS action,
                last_autoanalyze AS date,
                0 AS dead_rows_cleaned,
                autoanalyze_count AS run_count
            FROM pg_stat_user_tables
            WHERE last_autoanalyze IS NOT NULL
            ORDER BY date DESC NULLS LAST
            LIMIT 50
        `);
        res.json(
            r.rows.map((row, i) => ({
                id: i + 1,
                table: row.table,
                action: row.action,
                date: row.date ? new Date(row.date).toISOString() : null,
                dead_rows_cleaned: parseInt(row.dead_rows_cleaned || 0),
                run_count: parseInt(row.run_count || 0),
                status: 'completed',
            })),
        );
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json({});
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// Schema migrations endpoint
// SEC-10 (audit): the table we read from is restricted to a closed allowlist
// of well-known migration-tracking tables. This eliminates the case where a
// user-created table whose name happens to contain "migration" gets selected.
app.get(
    '/api/schema/migrations',
    authenticate,
    cached('schema:migrations', CONFIG.CACHE_TTL.SCHEMAS),
    async (req, res) => {
        try {
            const pool = await reqPool(req);
            // Closed allowlist of the migration-table names we know how to read.
            const ALLOWED_MIGRATION_TABLES = new Set([
                'flyway_schema_history',
                'schema_migrations',
                'knex_migrations',
                '_prisma_migrations',
                'migrations',
                'schema_version',
            ]);
            const { rows: tables } = await pool.query(
                `
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = ANY($1::text[])
            LIMIT 1
        `,
                [Array.from(ALLOWED_MIGRATION_TABLES)],
            );
            if (tables.length === 0) {
                return res.json({
                    migrations: [],
                    pending: [],
                    message:
                        'No migration tracking table found. Schema versioning data will appear if you use a migration tool (Flyway, Knex, Prisma, etc.).',
                });
            }
            const tableName = tables[0].table_name;
            // Defense in depth: re-validate against the allowlist AND the
            // identifier-shape regex, even though the SQL above already enforced it.
            if (!ALLOWED_MIGRATION_TABLES.has(tableName) || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
                return res.json({ migrations: [], pending: [], message: 'Invalid table name' });
            }
            const { rows } = await pool.query(`SELECT * FROM "public"."${tableName}" ORDER BY 1 DESC LIMIT 50`);
            res.json({ migrations: rows, pending: [], tableName });
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({ migrations: [], pending: [], message: e.message });
        }
    },
);

// Schema browser endpoint
// Schema change (DDL) history endpoint
// Reads from a pgAudit-style DDL log table if one exists in the monitored DB.
// Supported sources (closed allowlist): an event-trigger audit table named
// `ddl_history` / `schema_change_log`, or an `audit.ddl_log` table.
// Returns [] with a hint when no source is available (UI shows the pgAudit note).
app.get(
    '/api/schema/ddl-history',
    authenticate,
    cached('schema:ddl-history', CONFIG.CACHE_TTL.SCHEMAS),
    async (req, res) => {
        try {
            const pool = await reqPool(req);
            const SOURCES = [
                { schema: 'public', table: 'ddl_history' },
                { schema: 'public', table: 'schema_change_log' },
                { schema: 'audit', table: 'ddl_log' },
            ];
            let found = null;
            for (const s of SOURCES) {
                const { rows } = await pool.query(
                    `
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = $1 AND table_name = $2 LIMIT 1
            `,
                    [s.schema, s.table],
                );
                if (rows.length) {
                    found = s;
                    break;
                }
            }
            if (!found) {
                return res.json({
                    events: [],
                    message:
                        'No DDL audit source found. Enable pgAudit or create a ddl_history event-trigger table to track schema changes.',
                });
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(found.schema) || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(found.table)) {
                return res.json({ events: [], message: 'Invalid audit table name' });
            }
            const { rows } = await pool.query(`
            SELECT * FROM "${found.schema}"."${found.table}"
            ORDER BY 1 DESC LIMIT 100
        `);
            const events = rows.map((r) => ({
                type: r.command_tag || r.type || r.action || r.event || 'DDL',
                schema: r.schema_name || r.schema || 'public',
                obj: r.object_name || r.obj || r.table_name || r.relation || '',
                detail: r.statement || r.detail || r.query || r.command || '',
                ts: r.event_time || r.ts || r.created_at || r.logged_at || '',
                risk:
                    r.risk ||
                    (/(DROP|TRUNCATE|ALTER)/i.test(r.command_tag || r.type || '')
                        ? 'high'
                        : /CREATE/i.test(r.command_tag || r.type || '')
                          ? 'medium'
                          : 'low'),
            }));
            res.json({ events, source: `${found.schema}.${found.table}` });
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({ events: [], message: e.message });
        }
    },
);

app.get('/api/schema/browser', authenticate, cached('schema:browser', CONFIG.CACHE_TTL.SCHEMAS), async (req, res) => {
    try {
        const pool = await reqPool(req);
        const { rows } = await pool.query(`
            SELECT t.table_schema, t.table_name, c.column_name, c.data_type, c.is_nullable,
                   c.column_default, c.character_maximum_length
            FROM information_schema.tables t
            JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
            WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema', 'pgmonitoringtool')
            AND t.table_type = 'BASE TABLE'
            ORDER BY t.table_schema, t.table_name, c.ordinal_position
        `);
        // Group by schema.table
        const schemas = {};
        rows.forEach((r) => {
            const key = r.table_schema;
            if (!schemas[key]) schemas[key] = {};
            if (!schemas[key][r.table_name]) schemas[key][r.table_name] = [];
            schemas[key][r.table_name].push({
                name: r.column_name,
                type: r.data_type,
                nullable: r.is_nullable === 'YES',
                default: r.column_default,
            });
        });
        res.json(schemas);
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json({});
    }
});

// Threats endpoint
app.get('/api/security/threats', authenticate, cached('sec:threats', CONFIG.CACHE_TTL.SECURITY), async (req, res) => {
    try {
        const pool = await reqPool(req);
        const { rows } = await pool.query(`
            SELECT pid, usename as user, client_addr as source, query, state,
                   backend_start, query_start,
                   CASE
                       WHEN query ~* 'DROP|TRUNCATE|DELETE FROM.*WHERE 1|UPDATE pg_' THEN 'critical'
                       WHEN query ~* 'GRANT|ALTER ROLE|CREATE ROLE' THEN 'high'
                       WHEN query ~* 'COPY.*TO|pg_dump|information_schema' THEN 'medium'
                       ELSE 'low'
                   END as severity
            FROM pg_stat_activity
            WHERE state != 'idle' AND query != ''
            AND pid != pg_backend_pid()
            ORDER BY query_start DESC LIMIT 20
        `);
        res.json(rows);
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json([]);
    }
});

// Compliance checks endpoint
app.get(
    '/api/security/compliance',
    authenticate,
    cached('sec:compliance', CONFIG.CACHE_TTL.SECURITY),
    async (req, res) => {
        try {
            const pool = await reqPool(req);
            const checks = [];
            // Check SSL
            const ssl = await pool.query("SELECT setting FROM pg_settings WHERE name = 'ssl'");
            checks.push({
                id: 'ssl',
                cat: 'Encryption',
                label: 'SSL Enabled',
                status: ssl.rows[0]?.setting === 'on' ? 'pass' : 'fail',
                standard: 'SOC2',
                score: ssl.rows[0]?.setting === 'on' ? 100 : 0,
            });
            // Check password encryption
            const enc = await pool.query("SELECT setting FROM pg_settings WHERE name = 'password_encryption'");
            checks.push({
                id: 'enc',
                cat: 'Encryption',
                label: 'Password Encryption',
                status: enc.rows[0]?.setting === 'scram-sha-256' ? 'pass' : 'warn',
                standard: 'SOC2',
                score: enc.rows[0]?.setting === 'scram-sha-256' ? 100 : 50,
            });
            // Check log connections
            const logConn = await pool.query("SELECT setting FROM pg_settings WHERE name = 'log_connections'");
            checks.push({
                id: 'logc',
                cat: 'Logging',
                label: 'Connection Logging',
                status: logConn.rows[0]?.setting === 'on' ? 'pass' : 'warn',
                standard: 'SOC2',
                score: logConn.rows[0]?.setting === 'on' ? 100 : 30,
            });
            // Check log disconnections
            const logDisc = await pool.query("SELECT setting FROM pg_settings WHERE name = 'log_disconnections'");
            checks.push({
                id: 'logd',
                cat: 'Logging',
                label: 'Disconnection Logging',
                status: logDisc.rows[0]?.setting === 'on' ? 'pass' : 'warn',
                standard: 'SOC2',
                score: logDisc.rows[0]?.setting === 'on' ? 100 : 30,
            });
            // Check row level security enabled tables
            const rls = await pool.query('SELECT count(*) as cnt FROM pg_class WHERE relrowsecurity = true');
            checks.push({
                id: 'rls',
                cat: 'Access Control',
                label: 'Row Level Security',
                status: parseInt(rls.rows[0]?.cnt) > 0 ? 'pass' : 'warn',
                standard: 'GDPR',
                score: parseInt(rls.rows[0]?.cnt) > 0 ? 100 : 0,
            });
            res.json(checks);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    },
);

// Audit events endpoint
app.get(
    '/api/security/audit-events',
    authenticate,
    cached('sec:audit', CONFIG.CACHE_TTL.SECURITY),
    async (req, res) => {
        try {
            const pool = await reqPool(req);
            // Try to read from audit_log if it exists, or fallback to pg_stat_activity
            const { rows } = await pool.query(`
            SELECT pid, usename as user, application_name as app,
                   query as action, client_addr as source,
                   query_start as ts, state
            FROM pg_stat_activity
            WHERE query != '' AND pid != pg_backend_pid()
            ORDER BY query_start DESC LIMIT 30
        `);
            res.json(rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    },
);

app.get(
    '/api/security/superuser-activity',
    authenticate,
    requireScreen('security'),
    cached('sec:superuser', 15_000),
    async (req, res) => {
        try {
            const _p = await reqPool(req);
            const [active, roles] = await Promise.all([
                _p.query(`
                SELECT
                    pid,
                    usename AS "user",
                    datname AS db,
                    left(query, 200) AS query,
                    round(EXTRACT(EPOCH FROM (now() - query_start))::numeric, 2) AS duration_sec,
                    state,
                    application_name AS app,
                    client_addr,
                    backend_start,
                    xact_start
                FROM pg_stat_activity
                WHERE usesysid IN (SELECT oid FROM pg_roles WHERE rolsuper = true)
                  AND state IS NOT NULL
                ORDER BY query_start DESC NULLS LAST
                LIMIT 50
            `),
                _p.query(`
                SELECT rolname AS role_name, rolsuper, rolcreaterole, rolcreatedb,
                       rolcanlogin, rolreplication
                FROM pg_roles
                WHERE rolsuper = true
                ORDER BY rolname
            `),
            ]);
            const riskMap = (q) => {
                if (!q) return 'low';
                const upper = q.toUpperCase();
                if (/DROP|TRUNCATE|DELETE\s+FROM|ALTER\s+ROLE|GRANT\s+SUPERUSER/i.test(upper)) return 'critical';
                if (/ALTER|CREATE\s+ROLE|REVOKE|UPDATE\s+pg_|INSERT\s+INTO\s+pg_/i.test(upper)) return 'high';
                if (/CREATE|COPY|IMPORT/i.test(upper)) return 'medium';
                return 'low';
            };
            res.json({
                active_sessions: active.rows.map((r) => ({
                    ...r,
                    risk: riskMap(r.query),
                    ts: r.xact_start ? new Date(r.xact_start).toISOString() : new Date().toISOString(),
                })),
                superuser_roles: roles.rows,
            });
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({});
        }
    },
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN HBA + KILL CONNECTION ROUTES
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/admin/hba', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
        const _p = await reqPool(req);
        // pg_hba_file_rules is available in PG 10+; gracefully fallback if not
        const r = await _p
            .query(
                `
            SELECT
                line_num AS id,
                type,
                CASE WHEN array_length(database, 1) = 1 THEN database[1] ELSE array_to_string(database, ',') END AS database,
                CASE WHEN array_length(user_name, 1) = 1 THEN user_name[1] ELSE array_to_string(user_name, ',') END AS "user",
                address,
                auth_method AS method,
                options,
                error
            FROM pg_hba_file_rules
            ORDER BY line_num
        `,
            )
            .catch(() => ({ rows: [] }));
        res.json(r.rows);
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json([]);
    }
});

app.post('/api/admin/hba', authenticate, requireRole('super_admin'), async (req, res) => {
    // HBA file writing requires filesystem access — acknowledge receipt but do not modify
    // in Vercel/serverless environments. Return success so the UI doesn't error.
    try {
        const { rules } = req.body || {};
        if (!Array.isArray(rules)) return res.status(400).json({ error: 'rules must be an array' });
        log('INFO', 'HBA rule update requested', { count: rules.length, user: req.user?.username });
        // In a self-hosted deployment you would write to pg_hba.conf here and reload:
        //   fs.writeFileSync(hbaPath, formatHbaRules(rules));
        //   await pool.query('SELECT pg_reload_conf()');
        res.json({
            success: true,
            message: 'HBA rules acknowledged. Apply manually in self-hosted deployments.',
            rules_count: rules.length,
        });
    } catch (e) {
        log('ERROR', 'HBA rules update error', { error: e.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get(
    '/api/admin/connections',
    authenticate,
    requireRole('admin', 'super_admin'),
    cached('admin:connections', 5_000),
    async (req, res) => {
        try {
            const _p = await reqPool(req);
            const r = await _p.query(`
            SELECT
                pid,
                usename AS "user",
                datname AS db,
                state,
                left(query, 200) AS query,
                application_name AS "appName",
                client_addr AS client,
                client_port,
                round(EXTRACT(EPOCH FROM (now() - query_start))::numeric, 2) AS duration_sec,
                wait_event_type,
                wait_event AS wait,
                backend_type,
                xact_start,
                state_change
            FROM pg_stat_activity
            WHERE pid <> pg_backend_pid()
              AND backend_type = 'client backend'
            ORDER BY duration_sec DESC NULLS LAST
        `);
            res.json(
                r.rows.map((row) => ({
                    ...row,
                    duration: row.duration_sec != null ? `${row.duration_sec}s` : '—',
                    durationMs: Math.round((row.duration_sec || 0) * 1000),
                })),
            );
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({});
        }
    },
);

app.post('/api/admin/connections/kill', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
        const { pid } = req.body || {};
        if (!pid) return res.status(400).json({ error: 'pid is required' });
        const _p = await reqPool(req);
        // Refuse to kill our own connection or system backends
        const check = await _p.query(
            `SELECT pid, usename, application_name, state FROM pg_stat_activity WHERE pid = $1`,
            [pid],
        );
        if (check.rows.length === 0) return res.status(404).json({ error: 'Connection not found' });
        const conn = check.rows[0];
        if (conn.application_name === 'fathom_backend') {
            return res.status(403).json({ error: 'Cannot terminate the monitoring backend connection' });
        }
        const r = await _p.query('SELECT pg_terminate_backend($1) AS killed', [pid]);
        const killed = r.rows[0]?.killed;
        log('INFO', 'Connection terminated', { pid, user: conn.usename, by: req.user?.username });
        res.json({
            success: killed,
            pid,
            message: killed ? `Connection ${pid} terminated` : `Could not terminate ${pid}`,
        });
    } catch (e) {
        log('ERROR', 'Kill connection error', { error: e.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ALERTS RECENT (HTTP polling fallback for WebSocket)
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/alerts/recent', authenticate, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || '10', 10), 100);
        const recent = await alerts.getRecent(limit, false);
        res.json({ alerts: recent, count: recent.length, timestamp: new Date().toISOString() });
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json({ alerts: [], count: 0, timestamp: new Date().toISOString() });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// INDEX INTELLIGENCE — live data for IndexesTab
// ─────────────────────────────────────────────────────────────────────────────

// Health summary: hit ratio, total count, wasted space, seq-scan rate, critical count
app.get('/api/indexes/health', authenticate, cached('idx:health', CONFIG.CACHE_TTL.INDEXES), async (req, res) => {
    try {
        const pool = await reqPool(req);
        const [hitQ, cntQ, unusedQ, seqQ] = await Promise.all([
            // index hit ratio (buffer cache)
            pool.query(`
                SELECT round(
                    100.0 * sum(idx_blks_hit) / NULLIF(sum(idx_blks_hit) + sum(idx_blks_read), 0),
                2) AS hit_ratio
                FROM pg_statio_user_indexes
            `),
            // total index count + total index size
            pool.query(`
                SELECT count(*)::int AS total_indexes,
                       pg_size_pretty(sum(pg_relation_size(indexrelid))) AS total_size,
                       sum(pg_relation_size(indexrelid)) AS total_bytes
                FROM pg_stat_user_indexes
            `),
            // unused indexes → critical count (idx_scan = 0, non-PK)
            pool.query(`
                SELECT count(*)::int AS unused_count
                FROM pg_stat_user_indexes ui
                JOIN pg_index i ON i.indexrelid = ui.indexrelid
                WHERE ui.idx_scan = 0 AND NOT i.indisprimary
            `),
            // seq scan rate: % of total scans that are seq (not index)
            pool.query(`
                SELECT round(
                    100.0 * sum(seq_scan) / NULLIF(sum(seq_scan) + sum(idx_scan), 0),
                1) AS seq_scan_rate
                FROM pg_stat_user_tables
            `),
        ]);
        const h = hitQ.rows[0];
        const c = cntQ.rows[0];
        const u = unusedQ.rows[0];
        const s = seqQ.rows[0];
        res.json({
            hitRatio: parseFloat(h.hit_ratio || 0),
            totalIndexes: c.total_indexes,
            totalSize: c.total_size,
            totalBytes: parseInt(c.total_bytes || 0),
            criticalCount: u.unused_count,
            seqScanRate: parseFloat(s.seq_scan_rate || 0),
        });
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json({ hitRatio: 0, totalIndexes: 0, totalSize: '—', totalBytes: 0, criticalCount: 0, seqScanRate: 0 });
    }
});

// Missing indexes: tables with high seq scans and no covering index
app.get('/api/indexes/missing', authenticate, cached('idx:missing', CONFIG.CACHE_TTL.INDEXES), async (req, res) => {
    try {
        const pool = await reqPool(req);
        const r = await pool.query(
            `
            SELECT
                s.schemaname                                        AS schema,
                s.relname                                           AS "table",
                s.seq_scan,
                s.seq_tup_read,
                s.idx_scan,
                pg_size_pretty(pg_total_relation_size(s.relid))     AS "tableSize",
                pg_total_relation_size(s.relid)                     AS "tableSizeBytes",
                CASE
                    WHEN s.seq_scan > 100000 THEN 'critical'
                    WHEN s.seq_scan > 10000  THEN 'high'
                    WHEN s.seq_scan > 1000   THEN 'medium'
                    ELSE 'low'
                END                                                 AS severity
            FROM pg_stat_user_tables s
            WHERE s.seq_scan > 500
              AND s.schemaname NOT IN ('pg_catalog', 'information_schema')
              ${req.query.schema ? 'AND s.schemaname = $1' : ''}
            ORDER BY s.seq_scan DESC
            LIMIT 20
        `,
            req.query.schema ? [String(req.query.schema)] : [],
        );
        res.json(r.rows);
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json([]);
    }
});

// Unused indexes: never scanned since stats reset, non-primary
app.get('/api/indexes/unused', authenticate, cached('idx:unused', CONFIG.CACHE_TTL.INDEXES), async (req, res) => {
    try {
        const pool = await reqPool(req);
        const r = await pool.query(
            `
            SELECT
                ui.schemaname                                           AS schema,
                ui.relname                                              AS "table",
                ui.indexrelname                                         AS "indexName",
                ui.idx_scan                                             AS scans,
                pg_size_pretty(pg_relation_size(ui.indexrelid))         AS size,
                pg_relation_size(ui.indexrelid)                         AS "sizeBytes",
                pg_get_indexdef(ui.indexrelid)                          AS definition,
                i.indisunique                                           AS "isUnique"
            FROM pg_stat_user_indexes ui
            JOIN pg_index i ON i.indexrelid = ui.indexrelid
            WHERE ui.idx_scan < 5
              AND NOT i.indisprimary
              AND pg_relation_size(ui.indexrelid) > 0
              AND ui.schemaname NOT IN ('pg_catalog', 'information_schema')
              ${req.query.schema ? 'AND ui.schemaname = $1' : ''}
            ORDER BY pg_relation_size(ui.indexrelid) DESC
            LIMIT 30
        `,
            req.query.schema ? [String(req.query.schema)] : [],
        );
        res.json(r.rows);
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json([]);
    }
});

// Duplicate / redundant indexes: indexes whose column sets are subsets of other indexes on the same table
app.get('/api/indexes/duplicates', authenticate, cached('idx:dupes', CONFIG.CACHE_TTL.INDEXES), async (req, res) => {
    try {
        const pool = await reqPool(req);
        const r = await pool.query(
            `
            SELECT
                a.schemaname                                            AS schema,
                a.tablename                                             AS "table",
                a.indexname                                             AS "indexName",
                a.indexdef                                              AS definition,
                b.indexname                                             AS "shadowedBy",
                pg_size_pretty(pg_relation_size(ua.indexrelid))         AS "wastedSpace",
                pg_relation_size(ua.indexrelid)                         AS "wastedBytes",
                us.idx_scan                                             AS writes
            FROM pg_indexes a
            JOIN pg_indexes b
              ON  a.schemaname = b.schemaname
              AND a.tablename  = b.tablename
              AND a.indexname <> b.indexname
              AND position(regexp_replace(a.indexdef, '.* USING \\w+ ', '') IN
                           regexp_replace(b.indexdef, '.* USING \\w+ ', '')) > 0
            JOIN pg_stat_user_indexes ua ON ua.indexrelname = a.indexname AND ua.schemaname = a.schemaname
            JOIN pg_stat_user_indexes us ON us.indexrelname = a.indexname AND us.schemaname = a.schemaname
            WHERE a.schemaname NOT IN ('pg_catalog', 'information_schema')
              ${req.query.schema ? 'AND a.schemaname = $1' : ''}
            ORDER BY pg_relation_size(ua.indexrelid) DESC
            LIMIT 20
        `,
            req.query.schema ? [String(req.query.schema)] : [],
        );
        res.json(r.rows);
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json([]);
    }
});

// Bloated indexes: high inefficiency + large size
app.get('/api/indexes/bloat', authenticate, cached('idx:bloat', CONFIG.CACHE_TTL.BLOAT), async (req, res) => {
    try {
        const pool = await reqPool(req);
        const r = await pool.query(
            `
            SELECT
                s.schemaname                                            AS schema,
                s.relname                                               AS "table",
                s.indexrelname                                          AS "indexName",
                pg_size_pretty(pg_relation_size(s.indexrelid))          AS size,
                pg_relation_size(s.indexrelid)                          AS "sizeBytes",
                s.idx_scan,
                s.idx_tup_read,
                s.idx_tup_fetch,
                CASE
                    WHEN s.idx_scan = 0 THEN 100
                    WHEN s.idx_tup_read = 0 THEN 0
                    ELSE round((1.0 - s.idx_tup_fetch::numeric / NULLIF(s.idx_tup_read,0)) * 100, 1)
                END                                                     AS "bloatPct",
                CASE
                    WHEN s.idx_scan = 0 THEN 'critical'
                    WHEN round((1.0 - s.idx_tup_fetch::numeric / NULLIF(s.idx_tup_read,0)) * 100, 1) > 50 THEN 'high'
                    WHEN round((1.0 - s.idx_tup_fetch::numeric / NULLIF(s.idx_tup_read,0)) * 100, 1) > 20 THEN 'medium'
                    ELSE 'low'
                END                                                     AS severity,
                pg_get_indexdef(s.indexrelid)                           AS definition
            FROM pg_stat_user_indexes s
            JOIN pg_index i ON i.indexrelid = s.indexrelid
            WHERE NOT i.indisprimary
              AND pg_relation_size(s.indexrelid) > 1048576
              AND (
                  s.idx_scan = 0
                  OR (s.idx_tup_read > 0 AND
                      round((1.0 - s.idx_tup_fetch::numeric / NULLIF(s.idx_tup_read,0)) * 100, 1) > 20)
              )
              AND s.schemaname NOT IN ('pg_catalog', 'information_schema')
              ${req.query.schema ? 'AND s.schemaname = $1' : ''}
            ORDER BY pg_relation_size(s.indexrelid) DESC
            LIMIT 30
        `,
            req.query.schema ? [String(req.query.schema)] : [],
        );
        res.json(r.rows);
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json([]);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// AI PROXY (Groq — free tier, OpenAI-compatible, keeps API key server-side)
// Get a free key at https://console.groq.com → API Keys → Create API Key
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/ai/chat', authenticate, async (req, res) => {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
        return res.status(503).json({ error: 'AI features not configured.' });
    }
    try {
        const { messages, system, max_tokens } = req.body || {};
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages array is required' });
        }

        // Groq uses the OpenAI chat format.
        // Prepend system prompt as a system-role message if provided.
        const groqMessages = [];
        if (system) groqMessages.push({ role: 'system', content: system });
        messages.forEach((m) => groqMessages.push({ role: m.role, content: m.content }));

        const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: groqMessages,
                max_tokens: Math.min(max_tokens || 2000, 8000),
            }),
        });
        const data = await upstream.json();
        if (!upstream.ok) {
            return res.status(upstream.status).json({ error: data.error?.message || 'AI request failed' });
        }

        // Normalise to the same shape the frontend already expects: { content: [{ text }] }
        const text = data.choices?.[0]?.message?.content || '';
        res.json({ content: [{ text }] });
    } catch (e) {
        log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
        res.json({});
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1–4 ENDPOINTS — Alert Rules, Pool Metrics, Schema, Observability,
//                        OpenTelemetry, Retention
// ═══════════════════════════════════════════════════════════════════════════════

/* ── Alert Rules CRUD ─────────────────────────────────────────────────────────
 * Rules live in pgmonitoringtool.alert_rules (migration 0026). They previously
 * shared the `alerts` table behind an `alert_type = 'rule'` discriminator,
 * because alert_rules had never been created — which meant rules and runtime
 * alert events competed for one table with two incompatible shapes.
 *
 * The API still speaks `channels: string[]` to the frontend; the table stores
 * notify_email / notify_slack booleans, so the two are mapped at the boundary.
 * ────────────────────────────────────────────────────────────────────────── */

const ruleChannels = (row) => {
    const out: string[] = [];
    if (row.notify_email) out.push('email');
    if (row.notify_slack) out.push('slack');
    return out;
};
const hasChannel = (channels, name) => Array.isArray(channels) && channels.includes(name);

app.get('/api/alerts/rules', authenticate, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT id, name, description, metric, condition, threshold, severity,
                   enabled, cooldown_minutes, notify_email, notify_slack,
                   connection_id, created_at, updated_at
            FROM pgmonitoringtool.alert_rules
            ORDER BY created_at DESC
        `);
        res.json(rows.map((r) => ({ ...r, channels: ruleChannels(r) })));
    } catch (e) {
        // Previously this swallowed the error and returned [], so a missing
        // table was indistinguishable from "no rules configured".
        log('ERROR', `[/api/alerts/rules GET] ${e.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/alerts/rules', authenticate, async (req, res) => {
    try {
        const { name, description, metric, condition, threshold, severity, enabled, channels } = req.body;
        if (!name || !metric || !condition || threshold === undefined || threshold === null) {
            return res.status(400).json({ error: 'name, metric, condition and threshold are required' });
        }
        const { rows } = await pool.query(
            `
            INSERT INTO pgmonitoringtool.alert_rules
                (name, description, metric, condition, threshold, severity,
                 enabled, notify_email, notify_slack, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        `,
            [
                name,
                description || '',
                metric,
                condition,
                Number(threshold),
                severity || 'warning',
                enabled !== false,
                hasChannel(channels, 'email'),
                hasChannel(channels, 'slack'),
                req.user?.id ?? null,
            ],
        );
        res.json({ success: true, id: rows[0].id });
    } catch (e) {
        log('ERROR', `[/api/alerts/rules POST] ${e.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/alerts/rules/:id', authenticate, async (req, res) => {
    try {
        const { name, description, metric, condition, threshold, severity, enabled, channels } = req.body;
        const { rowCount } = await pool.query(
            `
            UPDATE pgmonitoringtool.alert_rules
            SET name         = COALESCE($1, name),
                description  = COALESCE($2, description),
                metric       = COALESCE($3, metric),
                condition    = COALESCE($4, condition),
                threshold    = COALESCE($5, threshold),
                severity     = COALESCE($6, severity),
                enabled      = COALESCE($7, enabled),
                notify_email = $8,
                notify_slack = $9,
                updated_at   = now()
            WHERE id = $10
        `,
            [
                name ?? null,
                description ?? null,
                metric ?? null,
                condition ?? null,
                threshold === undefined || threshold === null ? null : Number(threshold),
                severity ?? null,
                enabled ?? null,
                hasChannel(channels, 'email'),
                hasChannel(channels, 'slack'),
                req.params.id,
            ],
        );
        if (rowCount === 0) return res.status(404).json({ error: 'Rule not found' });
        res.json({ success: true });
    } catch (e) {
        log('ERROR', `[/api/alerts/rules/:id POST] ${e.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/alerts/rules/:id', authenticate, async (req, res) => {
    try {
        // Scoped to alert_rules. The previous version deleted from `alerts` by
        // id with no alert_type guard, so a rule id colliding with an event id
        // would have deleted the event instead.
        const { rowCount } = await pool.query(`DELETE FROM pgmonitoringtool.alert_rules WHERE id = $1`, [
            req.params.id,
        ]);
        if (rowCount === 0) return res.status(404).json({ error: 'Rule not found' });
        res.json({ success: true });
    } catch (e) {
        log('ERROR', `[/api/alerts/rules/:id DELETE] ${e.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/* ── Pool Metrics ─────────────────────────────────────────────────────────── */
app.get('/api/pool/metrics', authenticate, cached('pool:metrics', CONFIG.CACHE_TTL.POOL), async (req, res) => {
    try {
        const p = await reqPool(req);
        const [connStats, poolConf] = await Promise.all([
            p.query(`
                SELECT state, count(*) AS cnt, avg(extract(epoch FROM (now() - state_change)))::numeric(10,2) AS avg_duration
                FROM pg_stat_activity
                WHERE backend_type = 'client backend'
                GROUP BY state
            `),
            p.query(
                `SELECT name, setting FROM pg_settings WHERE name IN ('max_connections','superuser_reserved_connections','idle_in_transaction_session_timeout')`,
            ),
        ]);
        const stateMap = {};
        connStats.rows.forEach((r) => {
            stateMap[r.state || 'null'] = { count: Number(r.cnt), avgDuration: Number(r.avg_duration) };
        });
        const settings = {};
        poolConf.rows.forEach((r) => {
            settings[r.name] = r.setting;
        });
        res.json({
            states: stateMap,
            settings,
            totalConnections: Object.values(stateMap).reduce((a, b) => a + b.count, 0),
            maxConnections: Number(settings.max_connections || 100),
        });
    } catch (e) {
        log('ERROR', `[/api/pool/metrics] ${e.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/* ── Schema routes are provided by schemaRoutes module ──────────────────────
   Endpoints: /api/schema/relationships, /api/schema/dependencies,
   /api/schema/columns/:schema/:table, /api/schema/tree
   ──────────────────────────────────────────────────────────────────────── */

/* ── Observability Hub ────────────────────────────────────────────────────── */
app.get('/api/observability/api-metrics', authenticate, async (req, res) => {
    try {
        const p = await reqPool(req);
        const { rows } = await p.query(`
            SELECT query, calls, mean_exec_time AS avg_ms, total_exec_time AS total_ms
            FROM pg_stat_statements
            ORDER BY total_exec_time DESC LIMIT 20
        `);
        res.json(rows);
    } catch (e) {
        // pg_stat_statements may not be installed
        res.json([]);
    }
});

app.get('/api/observability/exceptions', authenticate, async (req, res) => {
    try {
        const p = await reqPool(req);
        const { rows } = await p.query(`
            SELECT datname, xact_rollback AS rollbacks, conflicts, deadlocks, temp_files
            FROM pg_stat_database WHERE datname = current_database()
        `);
        res.json(rows[0] || {});
    } catch (e) {
        res.json({});
    }
});

app.get('/api/observability/uptime', authenticate, async (req, res) => {
    try {
        const p = await reqPool(req);
        const { rows } = await p.query(`
            SELECT pg_postmaster_start_time() AS start_time,
                   extract(epoch FROM (now() - pg_postmaster_start_time())) AS uptime_seconds
        `);
        res.json(rows[0] || {});
    } catch (e) {
        res.json({});
    }
});

app.get('/api/observability/audit-log', authenticate, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT a.id, COALESCE(u.username, 'system') AS actor_username, a.action,
                   a.details AS raw_details,
                   a.created_at AS timestamp
            FROM pgmonitoringtool.audit_log a
            LEFT JOIN pgmonitoringtool.users u ON u.id = a.user_id
            ORDER BY a.created_at DESC LIMIT 50
        `);
        // Normalize: extract resource_type/level from details if it's JSON
        const normalized = rows.map((r) => {
            let parsed = {};
            try {
                parsed = typeof r.raw_details === 'object' ? r.raw_details : JSON.parse(r.raw_details || '{}');
            } catch {}
            return {
                id: r.id,
                actor_username: r.actor_username,
                action: r.action,
                resource_type: parsed.resource_type || r.action,
                resource_id: parsed.resource_id || null,
                level: parsed.level || 'info',
                timestamp: r.timestamp,
            };
        });
        res.json(normalized);
    } catch (e) {
        res.json([]);
    }
});

app.get('/api/observability/jobs', authenticate, async (_req, res) => {
    // Jobs/scheduled tasks are in-memory — return current task list
    res.json([]);
});

/* ── OpenTelemetry ────────────────────────────────────────────────────────── */
app.get('/api/otel/services', authenticate, async (req, res) => {
    try {
        const p = await reqPool(req);
        const { rows } = await p.query(`
            SELECT application_name AS service, count(*) AS connections
            FROM pg_stat_activity
            WHERE application_name != ''
            GROUP BY application_name
            ORDER BY connections DESC
        `);
        res.json(rows);
    } catch (e) {
        res.json([]);
    }
});

app.get('/api/otel/metrics/names', authenticate, async (req, res) => {
    try {
        const p = await reqPool(req);
        // Return available metric categories from pg_stat views
        const metrics = [
            'pg_stat_activity.connections',
            'pg_stat_database.transactions',
            'pg_stat_database.cache_hit_ratio',
            'pg_stat_user_tables.seq_scans',
            'pg_stat_user_tables.idx_scans',
            'pg_stat_bgwriter.checkpoints',
        ];
        res.json(metrics.map((m) => ({ name: m })));
    } catch (e) {
        res.json([]);
    }
});

app.get('/api/otel/metrics/data', authenticate, async (req, res) => {
    try {
        const p = await reqPool(req);
        const metric = req.query.metric || 'pg_stat_activity.connections';
        let rows = [];
        if (metric.includes('connections')) {
            const r = await p.query(`SELECT state, count(*) AS value FROM pg_stat_activity GROUP BY state`);
            rows = r.rows;
        } else if (metric.includes('transactions')) {
            const r = await p.query(
                `SELECT xact_commit AS commits, xact_rollback AS rollbacks FROM pg_stat_database WHERE datname = current_database()`,
            );
            rows = r.rows;
        } else {
            const r = await p.query(`SELECT 'no_data' AS label, 0 AS value`);
            rows = r.rows;
        }
        res.json(rows);
    } catch (e) {
        res.json([]);
    }
});

/* ── Data Retention ───────────────────────────────────────────────────────── */
app.get('/api/retention/policy', authenticate, async (_req, res) => {
    // Return default retention settings (no table needed)
    res.json({
        metrics_retention_days: 30,
        logs_retention_days: 7,
        alerts_retention_days: 90,
        audit_retention_days: 365,
    });
});

app.get('/api/retention/stats', authenticate, async (_req, res) => {
    try {
        const alertCount = await pool.query(`SELECT count(*) AS cnt FROM pgmonitoringtool.alerts`);
        const auditCount = await pool.query(`SELECT count(*) AS cnt FROM pgmonitoringtool.audit_log`);
        res.json({
            alerts_count: Number(alertCount.rows[0]?.cnt || 0),
            audit_count: Number(auditCount.rows[0]?.cnt || 0),
        });
    } catch (e) {
        res.json({ alerts_count: 0, audit_count: 0 });
    }
});

app.get('/api/retention/growth', authenticate, async (_req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT pg_database_size(current_database()) AS db_size
        `);
        res.json({ db_size_bytes: Number(rows[0]?.db_size || 0) });
    } catch (e) {
        res.json({ db_size_bytes: 0 });
    }
});

app.post('/api/retention/cleanup', authenticate, async (_req, res) => {
    try {
        const r1 = await pool.query(
            `DELETE FROM pgmonitoringtool.alerts WHERE created_at < now() - interval '90 days'`,
        );
        const r2 = await pool.query(
            `DELETE FROM pgmonitoringtool.audit_log WHERE created_at < now() - interval '365 days'`,
        );
        res.json({
            success: true,
            deleted: { alerts: r1.rowCount, audit_logs: r2.rowCount },
        });
    } catch (e) {
        log('ERROR', `[/api/retention/cleanup] ${e.message}`);
        res.json({ success: false, deleted: { alerts: 0, audit_logs: 0 }, error: e.message });
    }
});

// Note: PUT /api/retention/policy is handled by retentionRoutes middleware
// This endpoint persists to the retention_policies table in the database

// ─────────────────────────────────────────────────────────────────────────────
// QUERY OPTIMIZER ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/optimizer/indexes', authenticate, async (req, res) => {
    try {
        const pool = await reqPool(req);
        const { rows } = await pool.query(`
            SELECT schemaname, tablename, indexname,
                   pg_size_pretty(pg_relation_size(indexrelid)) as size,
                   idx_scan, idx_tup_read, idx_tup_fetch
            FROM pg_stat_user_indexes
            JOIN pg_index ON pg_stat_user_indexes.indexrelid = pg_index.indexrelid
            ORDER BY idx_scan ASC LIMIT 50
        `);
        // Normalize to shape frontend expects: { table, column, indexName, type, size, scans, status, impact }
        const normalized = rows.map((r) => ({
            table: `${r.schemaname}.${r.tablename}`,
            column: r.indexname.replace(`${r.tablename}_`, '').replace('_idx', '').replace('_index', ''),
            indexName: r.indexname,
            type: 'btree',
            size: r.size,
            scans: parseInt(r.idx_scan) || 0,
            reads: parseInt(r.idx_tup_read) || 0,
            fetches: parseInt(r.idx_tup_fetch) || 0,
            status: parseInt(r.idx_scan) === 0 ? 'unused' : parseInt(r.idx_scan) < 10 ? 'low-usage' : 'active',
            impact: parseInt(r.idx_scan) === 0 ? 'high' : parseInt(r.idx_scan) < 10 ? 'medium' : 'low',
        }));
        res.json(normalized);
    } catch (e) {
        log('ERROR', `[/api/optimizer/indexes] ${e.message}`);
        res.json([]);
    }
});

app.get('/api/optimizer/table-stats', authenticate, async (req, res) => {
    try {
        const pool = await reqPool(req);
        const { rows } = await pool.query(`
            SELECT schemaname, relname as table_name,
                   n_live_tup, n_dead_tup,
                   seq_scan, seq_tup_read, idx_scan, idx_tup_fetch,
                   n_tup_ins, n_tup_upd, n_tup_del,
                   last_vacuum, last_autovacuum, last_analyze, last_autoanalyze,
                   pg_size_pretty(pg_total_relation_size(relid)) as total_size
            FROM pg_stat_user_tables
            ORDER BY n_dead_tup DESC LIMIT 50
        `);
        // Normalize: frontend expects { table, rows, size, dead_tuples, last_vacuum, seq_scans, idx_scans }
        const fmtAgo = (ts) => {
            if (!ts) return 'never';
            const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
            if (mins < 60) return `${mins}m ago`;
            if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
            return `${Math.round(mins / 1440)}d ago`;
        };
        const normalized = rows.map((r) => ({
            table: `${r.schemaname}.${r.table_name}`,
            rows: parseInt(r.n_live_tup) || 0,
            size: r.total_size || '0 bytes',
            dead_tuples: parseInt(r.n_dead_tup) || 0,
            last_vacuum: fmtAgo(r.last_vacuum || r.last_autovacuum),
            seq_scans: parseInt(r.seq_scan) || 0,
            idx_scans: parseInt(r.idx_scan) || 0,
        }));
        res.json(normalized);
    } catch (e) {
        log('ERROR', `[/api/optimizer/table-stats] ${e.message}`);
        res.json([]);
    }
});

app.get('/api/optimizer/slow-queries', authenticate, async (req, res) => {
    try {
        const pool = await reqPool(req);
        // Check if pg_stat_statements extension exists
        const ext = await pool.query(
            "SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON e.extnamespace=n.oid WHERE e.extname='pg_stat_statements'",
        );
        if (ext.rowCount === 0) {
            return res.json([]);
        }
        const schema = ext.rows[0].nspname;
        const { rows } = await pool.query(`
            SELECT queryid, query, calls, total_exec_time, mean_exec_time,
                   min_exec_time, max_exec_time, stddev_exec_time,
                   rows, shared_blks_hit, shared_blks_read
            FROM "${schema}".pg_stat_statements
            WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
            ORDER BY mean_exec_time DESC LIMIT 30
        `);
        // Normalize: frontend expects { id, query, tags[], db, mean_time, p95_time, p99_time, total_time, calls }
        const inferTags = (q) => {
            const tags = [];
            const ql = (q || '').toLowerCase();
            if (/seq scan|sequential/.test(ql)) tags.push('seq-scan');
            if (/delete\s+from/i.test(ql)) tags.push('bulk-delete');
            if (/group\s+by|sum\(|avg\(|count\(/i.test(ql)) tags.push('aggregation');
            if (/select\s+\*/i.test(ql)) tags.push('wide-select');
            if (tags.length === 0) tags.push('general');
            return tags;
        };
        const dbName = (await pool.query('SELECT current_database() as db')).rows[0]?.db || 'postgres';
        const normalized = rows.map((r) => ({
            id: String(r.queryid),
            query: r.query,
            tags: inferTags(r.query),
            db: dbName,
            mean_time: parseFloat(r.mean_exec_time) || 0,
            p95_time: (parseFloat(r.mean_exec_time) || 0) * 1.8,
            p99_time: parseFloat(r.max_exec_time) || 0,
            total_time: parseFloat(r.total_exec_time) || 0,
            calls: parseInt(r.calls) || 0,
            rows_per_call: parseInt(r.rows) || 0,
        }));
        res.json(normalized);
    } catch (e) {
        log('ERROR', `[/api/optimizer/slow-queries] ${e.message}`);
        res.json([]);
    }
});

app.get('/api/optimizer/locks', authenticate, async (req, res) => {
    try {
        const pool = await reqPool(req);
        const { rows } = await pool.query(`
            SELECT l.pid, l.locktype, l.mode, l.granted, l.waitstart,
                   a.usename, a.application_name, a.client_addr,
                   a.query, a.state, a.wait_event_type, a.wait_event,
                   l.relation::regclass as table_name
            FROM pg_locks l
            JOIN pg_stat_activity a ON l.pid = a.pid
            WHERE NOT l.granted OR l.mode LIKE '%Exclusive%'
            ORDER BY l.waitstart NULLS LAST LIMIT 30
        `);
        // Normalize: frontend expects { pid, locktype, mode, granted, query, state, table_name, blocked_by, blocking[] }
        const waitingPids = rows.filter((r) => !r.granted).map((r) => r.pid);
        const blockingPids = rows.filter((r) => r.granted).map((r) => r.pid);
        const normalized = rows.map((r) => ({
            pid: r.pid,
            locktype: r.locktype,
            mode: r.mode,
            granted: r.granted,
            query: r.query,
            state: r.state,
            table_name: r.table_name,
            usename: r.usename,
            application_name: r.application_name,
            client_addr: r.client_addr,
            wait_event: r.wait_event,
            blocked_by: !r.granted ? blockingPids.find((p) => p !== r.pid) || null : null,
            blocking: r.granted ? waitingPids.filter((p) => p !== r.pid) : [],
        }));
        res.json(normalized);
    } catch (e) {
        log('ERROR', `[/api/optimizer/locks] ${e.message}`);
        res.json([]);
    }
});

app.get('/api/optimizer/maintenance', authenticate, async (req, res) => {
    try {
        const pool = await reqPool(req);
        const { rows } = await pool.query(`
            SELECT schemaname, relname as table_name,
                   n_dead_tup, n_live_tup,
                   CASE WHEN n_live_tup > 0
                        THEN round(100.0 * n_dead_tup / n_live_tup, 1)
                        ELSE 0 END as bloat_pct,
                   last_vacuum, last_autovacuum, last_analyze, last_autoanalyze,
                   vacuum_count, autovacuum_count,
                   pg_size_pretty(pg_total_relation_size(relid)) as size
            FROM pg_stat_user_tables
            WHERE n_dead_tup > 0
            ORDER BY n_dead_tup DESC LIMIT 30
        `);
        // Normalize: frontend expects { table, size, live_tuples, dead_tuples, bloat_pct, last_vacuum, last_analyze, vacuum_count }
        const fmtAgo = (ts) => {
            if (!ts) return 'never';
            const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
            if (mins < 60) return `${mins}m ago`;
            if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
            return `${Math.round(mins / 1440)}d ago`;
        };
        const normalized = rows.map((r) => ({
            table: `${r.schemaname}.${r.table_name}`,
            size: r.size,
            live_tuples: parseInt(r.n_live_tup) || 0,
            dead_tuples: parseInt(r.n_dead_tup) || 0,
            bloat_pct: parseFloat(r.bloat_pct) || 0,
            last_vacuum: fmtAgo(r.last_vacuum || r.last_autovacuum),
            last_analyze: fmtAgo(r.last_analyze || r.last_autoanalyze),
            vacuum_count: (parseInt(r.vacuum_count) || 0) + (parseInt(r.autovacuum_count) || 0),
        }));
        res.json(normalized);
    } catch (e) {
        log('ERROR', `[/api/optimizer/maintenance] ${e.message}`);
        res.json([]);
    }
});

app.get('/api/optimizer/config', authenticate, async (req, res) => {
    try {
        const pool = await reqPool(req);
        const { rows } = await pool.query(`
            SELECT name, setting, unit, category, short_desc,
                   min_val, max_val, boot_val, reset_val, source
            FROM pg_settings
            WHERE category IN (
                'Autovacuum', 'Resource Usage / Memory',
                'Write-Ahead Log', 'Query Tuning / Planner Cost Constants',
                'Query Tuning / Planner Method Configuration',
                'Resource Usage / Disk', 'Connections and Authentication / Connection Settings'
            )
            ORDER BY category, name
        `);
        res.json(rows);
    } catch (e) {
        log('ERROR', `[/api/optimizer/config] ${e.message}`);
        res.json([]);
    }
});

app.get('/api/optimizer/service-attribution', authenticate, async (req, res) => {
    try {
        const pool = await reqPool(req);
        const { rows } = await pool.query(`
            SELECT
                application_name,
                count(*) as call_count,
                round(avg(total_time)::numeric, 2) as avg_time,
                round(max(total_time)::numeric, 2) as max_time,
                round(sum(total_time)::numeric, 2) as total_time,
                round(avg(total_time) * count(*)::numeric, 2) as total_time_ms
            FROM pg_stat_activity
            WHERE state = 'active' OR state = 'idle in transaction'
            GROUP BY application_name
            ORDER BY total_time_ms DESC LIMIT 20
        `);
        res.json(rows);
    } catch (e) {
        log('ERROR', `[/api/optimizer/service-attribution] ${e.message}`);
        res.json([]);
    }
});

app.get('/api/optimizer/param-issues', authenticate, async (req, res) => {
    try {
        const pool = await reqPool(req);
        // Check if pg_stat_statements extension exists
        const ext = await pool.query(
            "SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON e.extnamespace=n.oid WHERE e.extname='pg_stat_statements'",
        );
        if (ext.rowCount === 0) {
            return res.json([]);
        }
        const schema = ext.rows[0].nspname;
        const { rows } = await pool.query(`
            SELECT
                queryid,
                query,
                calls,
                mean_exec_time,
                CASE
                    WHEN query LIKE '%\$%' THEN 'parameterized'
                    WHEN calls > 10 AND mean_exec_time > 100 THEN 'CRITICAL'
                    WHEN calls > 5 THEN 'HIGH'
                    ELSE 'MEDIUM'
                END as risk
            FROM "${schema}".pg_stat_statements
            WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
            AND query NOT LIKE 'SELECT%pg_stat_statements%'
            AND calls > 2
            ORDER BY calls DESC LIMIT 30
        `);
        res.json(rows);
    } catch (e) {
        log('ERROR', `[/api/optimizer/param-issues] ${e.message}`);
        res.json([]);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// WEBSOCKET  (local / traditional server only — not supported on Vercel)
// ─────────────────────────────────────────────────────────────────────────────
if (process.env.VERCEL !== '1') {
    const wss = new WebSocketServer({ server, path: '/ws' });
    wss.on('connection', (ws) => {
        const AUTH_TIMEOUT_MS = 8_000;
        let authenticated = false;

        const authTimeout = setTimeout(() => {
            if (!authenticated) {
                log('WARN', 'WebSocket auth timeout — closing connection');
                ws.close(1008, 'Auth timeout');
            }
        }, AUTH_TIMEOUT_MS);

        ws.once('message', (raw) => {
            clearTimeout(authTimeout);
            try {
                const msg = JSON.parse(raw.toString());
                if (msg?.type !== 'auth' || !msg.token) throw new Error('Expected {type:"auth",token:"..."}');
                jwt.verify(msg.token, CONFIG.JWT_SECRET, {
                    audience: CONFIG.JWT_AUDIENCE,
                    audience: CONFIG.JWT_AUDIENCE,
                    issuer: CONFIG.JWT_ISSUER,
                });
                authenticated = true;
            } catch (err) {
                log('WARN', 'WebSocket auth failed — closing connection', { error: err.message });
                ws.close(1008, 'Unauthorized');
                return;
            }

            log('INFO', 'WebSocket connection established');
            alerts.addSubscriber(ws);
            Promise.race([
                alerts.getRecent(10, false),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
            ])
                .then((recent) => {
                    if (ws.readyState === 1) {
                        ws.send(
                            JSON.stringify({
                                type: 'alert_summary',
                                payload: { count: recent.length, alerts: recent },
                            }),
                        );
                    }
                })
                .catch((err) => log('WARN', 'WS alert_summary send failed', { error: err.message }));

            ws.on('close', () => {
                log('INFO', 'WebSocket closed');
                alerts.removeSubscriber(ws);
            });
            ws.on('error', (e) => log('ERROR', 'WebSocket error', { error: e.message }));
        });

        ws.on('error', (e) => {
            clearTimeout(authTimeout);
            log('ERROR', 'WebSocket pre-auth error', { error: e.message });
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// CENTRALIZED ERROR HANDLING
// ─────────────────────────────────────────────────────────────────────────────

// 404 handler — must come BEFORE the error handler
app.use((req, res) => {
    log('WARN', '404', { path: req.path, method: req.method });
    res.status(404).json({ error: 'Endpoint not found', path: req.path });
});

// Sentry error handler — must come AFTER routes, BEFORE custom error handler
app.use(sentryErrorHandler());

// Global error handler (4-arg signature required by Express)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
    // ── Determine status code ───────────────────────────────────────────
    const status = err.status || err.statusCode || 500;

    // ── Classify via systemDiagnostics so the client sees the same
    //    structured `code` every other handler emits. Lets operators read
    //    a single field in DevTools → Network and know exactly what to fix
    //    (missing env var, missing migration, unreachable DB, etc.).
    const classified = classifyConnectionError(err);

    // ── Structured logging with request context ─────────────────────────
    // Always log full details server-side, never expose them to client
    log('ERROR', 'Unhandled error', {
        error: err.message,
        stack: err.stack,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userId: req.user?.id,
        requestId: req.id,
        diagnostic: classified.code,
    });

    // ── Sanitized response ──────────────────────────────────────────────
    //    We never leak stack traces. We DO leak:
    //      - a stable diagnostic `code` (ENCRYPTION_NOT_CONFIGURED,
    //        SCHEMA_NOT_MIGRATED, DB_UNREACHABLE, etc.) — safe, no secrets.
    //      - a `requestId` the operator can grep for in server logs.
    //      - the actionable `hint` when we recognise the error.
    //    In non-prod we also include `details` so local dev is faster.
    const body = {
        error: status >= 500 ? classified.hint || 'Internal Server Error' : err.message,
        code: classified.code,
        requestId: req.id,
        path: req.path,
    };
    if (classified.hint) body.hint = classified.hint;
    if (!IS_PROD) body.details = err.message;
    res.status(status).json(body);
});

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
                `  FATHOM MISCONFIGURED — ${encCheck.code}\n` +
                `  ${encCheck.hint}\n` +
                '━'.repeat(72);
            if (IS_PROD && process.env.FATHOM_ALLOW_DEGRADED_BOOT !== 'true') {
                console.error(banner);
                log(
                    'ERROR',
                    'Refusing to start in production without ENCRYPTION_KEY. ' +
                        'Set FATHOM_ALLOW_DEGRADED_BOOT=true to override (not recommended).',
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
                if (IS_PROD && process.env.FATHOM_ALLOW_DEGRADED_BOOT !== 'true') process.exit(78);
            }
        }

        // Initialise connections table and warm the in-memory cache
        await initConnections();
        // Per-user active connections are resolved on-demand via getUserActiveConnectionId.
        // No global default needed at startup — each user gets their own active connection
        // resolved from their isDefault connection or first connection on first request.
        log('INFO', `Loaded ${CONNECTIONS.length} connection(s) from database`);

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
            log('INFO', `🚀 FATHOM v3.0.0 running on port ${CONFIG.PORT}`);
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
