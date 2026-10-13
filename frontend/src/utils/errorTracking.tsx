import React from 'react';

export interface ErrorTrackerConfig {
    dsn?: string;
    environment?: string;
    release?: string;
    debug?: boolean;
    sampleRate?: number;
    enabled?: boolean;
}

// ─── Lazy Sentry loader ───────────────────────────────────────────────────────
// @sentry/react is an optional peer dep. When installed (production) this
// resolves to the real SDK; when missing (CI/local without DSN) it falls back
// to the console shim below so the app never fails to boot.
let _sentry: typeof import('@sentry/react') | null = null;

async function getSentry() {
    if (_sentry) return _sentry;
    try {
        _sentry = await import('@sentry/react');
        return _sentry;
    } catch {
        return null;
    }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export async function initErrorTracking(cfg: ErrorTrackerConfig) {
    if (!cfg.enabled || !cfg.dsn) {
        if (cfg.debug) console.log('[PulseDB] Error tracking disabled (no DSN or enabled=false)');
        return;
    }
    const Sentry = await getSentry();
    if (!Sentry) {
        console.warn('[PulseDB] @sentry/react not installed — error tracking using console fallback');
        return;
    }
    Sentry.init({
        dsn: cfg.dsn,
        environment: cfg.environment ?? 'production',
        release: cfg.release ?? '1.0.0',
        tracesSampleRate: cfg.sampleRate ?? 0.1,
        debug: cfg.debug ?? false,
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
        ],
        replaysSessionSampleRate: 0.05,
        replaysOnErrorSampleRate: 1.0,
    });
    if (cfg.debug) console.log('[PulseDB] Sentry initialized', { env: cfg.environment, release: cfg.release });
}

// ─── Capture helpers (fire-and-forget, safe to call before Sentry loads) ─────
export async function captureException(error: Error, context?: Record<string, unknown>) {
    const Sentry = await getSentry();
    if (Sentry) {
        Sentry.withScope((scope) => {
            if (context) scope.setExtras(context);
            Sentry.captureException(error);
        });
    } else {
        console.error('[PULSEDB-ERROR]', error.message, context ?? '');
    }
}

export async function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'error') {
    const Sentry = await getSentry();
    if (Sentry) {
        Sentry.captureMessage(message, level);
    } else {
        const fn = level === 'info' ? 'log' : level === 'warning' ? 'warn' : 'error';
        console[fn]('[PulseDB]', message);
    }
}

export async function setUser(user: { id: string; email?: string; username?: string } | null) {
    const Sentry = await getSentry();
    if (Sentry) Sentry.setUser(user);
}

export async function addBreadcrumb(breadcrumb: { category: string; message: string; level?: string }) {
    const Sentry = await getSentry();
    if (Sentry) Sentry.addBreadcrumb(breadcrumb as Parameters<typeof Sentry.addBreadcrumb>[0]);
}

// ─── ErrorBoundary ────────────────────────────────────────────────────────────
export interface ErrorTrackingBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorTrackingBoundary extends React.Component<ErrorTrackingBoundaryProps, State> {
    constructor(props: ErrorTrackingBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        captureException(error, { componentStack: info.componentStack ?? '' });
    }

    render() {
        if (this.state.hasError) {
            return (
                this.props.fallback ?? (
                    <div style={{ padding: 20, color: 'red' }}>
                        <h2>Something went wrong</h2>
                        <p>{this.state.error?.message}</p>
                    </div>
                )
            );
        }
        return this.props.children;
    }
}

// ─── Legacy compat export (main.tsx calls initErrorTracking synchronously) ───
// main.tsx uses: initErrorTracking({ dsn, environment, release, enabled })
// We fire-and-forget the async init.
export { initErrorTracking as default };
