// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Environment-derived configuration and startup env validation.
// Extracted from server.ts.

import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
export const IS_PROD = process.env.NODE_ENV === 'production';

export const CONFIG = Object.freeze({
    PORT: Number(process.env.PORT) || 5000,
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
    JWT_SECRET: process.env.JWT_SECRET || null,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
    // SEC-07 (audit): bind tokens to this app & issuer so a JWT minted for
    // some other service (or a different PulseDB deployment) cannot be replayed.
    JWT_AUDIENCE: process.env.JWT_AUDIENCE || 'pulsedb-api',
    JWT_ISSUER: process.env.JWT_ISSUER || 'pulsedb-auth',
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
    REPOSITORY_PATH: process.env.REPOSITORY_PATH || path.join(__dirname, '..', 'repositories'),
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
        from: process.env.EMAIL_FROM || '"PulseDB Alert System" <alerts@pulsedb.local>',
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
export const HAS_ADMIN_DB = !!(process.env.DATABASE_URL || (process.env.PGHOST && process.env.PGPASSWORD));

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
    } else if (process.env.JWT_SECRET === 'pulsedb-change-me-in-production') {
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
    // NOTE: PGHOST / PGPASSWORD are NOT required — PulseDB is a monitoring
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
