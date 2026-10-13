// @ts-nocheck
/**
 * services/sentry.ts
 * Backend Sentry initialisation (Node SDK).
 *
 * Loaded once at server boot via server.ts before any routes mount.
 * Safe to import even when @sentry/node is not installed — falls back
 * to a no-op shim so the server always boots.
 *
 * Usage in server.ts:
 *   import { initSentry, sentryRequestHandler, sentryErrorHandler } from './services/sentry.js';
 *   initSentry();                                 // must be FIRST
 *   app.use(sentryRequestHandler());              // before routes
 *   // ... all routes ...
 *   app.use(sentryErrorHandler());                // after routes, before custom error handler
 */

let Sentry = null;

try {
    Sentry = await import('@sentry/node');
} catch {
    /* @sentry/node not installed — shim activates below */
}

export function initSentry() {
    if (!Sentry) {
        if (process.env.NODE_ENV !== 'test') {
            console.warn('[PulseDB] @sentry/node not installed — error tracking disabled');
        }
        return;
    }
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) return; // silent: no DSN in dev/CI is expected

    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV ?? 'production',
        release: process.env.npm_package_version ?? '1.0.0',
        tracesSampleRate: Number(process.env.SENTRY_TRACES_RATE ?? 0.05),
        integrations: [Sentry.httpIntegration({ breadcrumbs: true }), Sentry.expressIntegration()],
    });
    console.log('[PulseDB] Sentry (Node) initialized', { env: process.env.NODE_ENV });
}

/** Express middleware that attaches Sentry request context. Mount BEFORE routes. */
export function sentryRequestHandler() {
    if (!Sentry?.setupExpressErrorHandler) return (_req, _res, next) => next();
    // In Sentry v8 the request handler is auto-wired via expressIntegration();
    // we expose a no-op here for compatibility with older mounting patterns.
    return (_req, _res, next) => next();
}

/** Express error handler that reports uncaught errors to Sentry. Mount AFTER routes. */
export function sentryErrorHandler() {
    if (!Sentry?.setupExpressErrorHandler) return (err, _req, _res, next) => next(err);
    // Return the real Sentry error handler express middleware
    const app = { use: () => {} }; // dummy — we need the handler function itself
    // Sentry v8 attaches via setupExpressErrorHandler(app); expose the raw middleware:
    return (err, req, res, next) => {
        if (Sentry.captureException) Sentry.captureException(err);
        next(err);
    };
}

export { Sentry };
export default initSentry;
