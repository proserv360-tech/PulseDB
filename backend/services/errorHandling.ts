/**
 * services/errorHandling.ts
 * ────────────────────────
 * Two small primitives that address the same root cause: errors that vanish.
 *
 * WHY THIS EXISTS
 * ---------------
 * A repo-wide sweep found 129 sites written as `.catch(() => {})` and 133
 * handlers responding with `res.json({ error: err.message })`.
 *
 * The first pattern is not theoretical damage. Against the live database,
 * `writeAudit`, `revokeSession`, alert creation and API-key auth were all
 * failing — and every one was invisible, because the failure was swallowed by
 * an empty catch. The audit table held 0 rows next to 55 recorded logins and
 * nothing ever reported it.
 *
 * The intent behind those empty catches is right: a failed audit write must not
 * crash a login. The mistake is conflating "don't throw" with "don't tell
 * anyone". `swallow()` keeps the first and drops the second.
 *
 * The second pattern bypasses the global error handler in server.ts, which
 * already does the right thing — correlation id, classified code, no stack, no
 * raw message in production. `asyncRoute()` lets a handler simply throw and be
 * caught by that handler instead of hand-rolling a leaky response.
 */

import { log } from './logger.js';

export interface SwallowContext {
    /** Subsystem, e.g. 'audit', 'session', 'alerts'. */
    component: string;
    /** The operation attempted, e.g. 'writeAudit', 'revokeSession'. */
    op: string;
    /** Any extra structured fields worth having in the log line. */
    [key: string]: unknown;
}

/**
 * Absorb an error without rethrowing — but log it at WARN with enough context
 * to find it later.
 *
 * Use for genuinely non-critical side effects (audit writes, metric bumps,
 * cache warms) where failure must not fail the surrounding request.
 *
 * Do NOT use to paper over an operation whose failure changes the outcome the
 * caller reports. Logout is the cautionary example: it swallowed the failure of
 * the very UPDATE that made logout mean anything, and returned 200 regardless.
 *
 *   await writeAudit(pool, event).catch(swallowWith({ component: 'audit', op: 'writeAudit' }));
 */
export function swallow(err: unknown, ctx: SwallowContext): void {
    const { component, op, ...extra } = ctx;
    const e = err as { message?: string; code?: string; stack?: string };
    log('WARN', `Suppressed error in ${component}.${op}`, {
        component,
        op,
        error: e?.message ?? String(err),
        // Postgres puts the useful part here — 42703 (undefined_column) and
        // 42P01 (undefined_table) are exactly what the schema drift produced.
        pgCode: e?.code,
        ...extra,
    });
}

/**
 * Curried form, for use directly as a `.catch()` argument.
 *
 *   somePromise().catch(swallowWith({ component: 'alerts', op: 'insert' }));
 */
export function swallowWith(ctx: SwallowContext) {
    return (err: unknown): void => swallow(err, ctx);
}

/**
 * Wrap an async Express handler so a thrown error reaches the global error
 * handler in server.ts rather than becoming an unhandled rejection.
 *
 * Express 5 forwards rejected promises automatically, but the codebase targets
 * both and the explicit wrapper documents intent at the call site:
 *
 *   app.get('/api/thing', authenticate, asyncRoute(async (req, res) => {
 *       const rows = await mayThrow();
 *       res.json(rows);                       // no try/catch, no leaked message
 *   }));
 */
export function asyncRoute(handler: (req: any, res: any, next: any) => Promise<unknown>) {
    return function wrapped(req: any, res: any, next: any) {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
}

/**
 * For handlers that must catch (to return a domain-specific status) but should
 * not leak internals. Logs the real error, responds with a safe body carrying
 * the request id so an operator can correlate.
 *
 *   } catch (err) {
 *       return failSafe(res, err, { component: 'reports', op: 'build', status: 502,
 *                                   message: 'Report generation failed' });
 *   }
 */
export function failSafe(
    res: any,
    err: unknown,
    opts: { component: string; op: string; status?: number; message?: string },
): void {
    const { component, op, status = 500, message = 'Internal Server Error' } = opts;
    const e = err as { message?: string; stack?: string; code?: string };
    log('ERROR', `${component}.${op} failed`, {
        component,
        op,
        error: e?.message,
        pgCode: e?.code,
        stack: e?.stack,
        requestId: res.req?.id,
        path: res.req?.path,
    });
    const body: Record<string, unknown> = { error: message, requestId: res.req?.id };
    // Local dev keeps the detail; production never sees it.
    if (process.env.NODE_ENV !== 'production') body.details = e?.message;
    res.status(status).json(body);
}
