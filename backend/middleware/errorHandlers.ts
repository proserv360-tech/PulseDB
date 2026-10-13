// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// 404 and centralized error handling. Must be registered last.
// Extracted from server.ts.

import { IS_PROD } from '../core/config.js';
import { log } from '../services/logger.js';
import { sentryErrorHandler } from '../services/sentry.js';
import { classifyConnectionError } from '../services/systemDiagnostics.js';

export function registerErrorHandlers(app) {
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
}
