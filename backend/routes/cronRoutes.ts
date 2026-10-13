// @ts-nocheck
/**
 * routes/cronRoutes.ts
 * ───────────────────
 * The scheduled work, exposed as an endpoint.
 *
 * server.ts guards every setInterval behind `process.env.VERCEL !== '1'`,
 * because a serverless function has nowhere to keep a timer alive — the process
 * ends when the request does. On Vercel that means alert evaluation, incident
 * escalation and auto-close never run. The UI works, alerts do not, and nothing
 * says so.
 *
 * A scheduler outside the process has to drive it instead. Vercel Cron calls
 * this; so can any external scheduler, or `curl` from a laptop.
 *
 * ── Security ────────────────────────────────────────────────────────────────
 * This endpoint fires real work and cannot use session auth, so it takes a
 * shared secret. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; a
 * plain `x-cron-secret` header is accepted for other schedulers. With no secret
 * configured it refuses to run rather than defaulting to open — an unauthenticated
 * endpoint that triggers monitoring against every database is a denial-of-service
 * primitive.
 *
 * ── Overlap ─────────────────────────────────────────────────────────────────
 * A run that outlives its schedule must not stack. The in-process guard below
 * only helps on a long-lived host; on serverless each invocation is a fresh
 * process and cannot see the others, which is why every task called here is
 * itself idempotent — openIncident upserts, escalateOverdue only fires once per
 * SLA window, autoCloseStale is a bounded UPDATE.
 */

import { Router } from 'express';
import crypto from 'node:crypto';
import { autoCloseStale, escalateOverdue } from '../services/incidentService.js';

let _running = false;

/** Constant-time compare so the secret can't be recovered by timing. */
function secretMatches(provided, expected) {
    if (!provided || !expected) return false;
    const a = Buffer.from(String(provided));
    const b = Buffer.from(String(expected));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

export default function cronRoutes(pool, alerts, log = () => {}) {
    const router = Router();

    const authorise = (req, res) => {
        const expected = process.env.CRON_SECRET;
        if (!expected) {
            log('ERROR', 'Cron endpoint called but CRON_SECRET is not set');
            res.status(503).json({ error: 'CRON_SECRET is not configured' });
            return false;
        }
        const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        const header = req.headers['x-cron-secret'];
        if (!secretMatches(bearer, expected) && !secretMatches(header, expected)) {
            log('WARN', 'Cron endpoint rejected: bad secret');
            res.status(403).json({ error: 'Invalid cron secret' });
            return false;
        }
        return true;
    };

    /**
     * One tick of everything the interval-based scheduler would have done.
     *
     * Each task is awaited and reported separately: a failure in escalation
     * must not stop auto-close, and a summary that says which part failed is
     * the difference between a five-minute diagnosis and an hour of guessing.
     */
    router.all('/cron/tick', async (req, res) => {
        if (!authorise(req, res)) return;

        if (_running) {
            // Long-lived host only; see the note above.
            return res.status(202).json({ skipped: true, reason: 'previous tick still running' });
        }
        _running = true;

        const started = Date.now();
        const result = { ok: true, ranAt: new Date().toISOString(), tasks: {} };

        const run = async (name, fn) => {
            const t0 = Date.now();
            try {
                result.tasks[name] = { ok: true, ms: 0, ...(await fn()) };
            } catch (err) {
                result.ok = false;
                result.tasks[name] = { ok: false, error: err.message };
                log('ERROR', `Cron task ${name} failed`, { error: err.message });
            }
            result.tasks[name].ms = Date.now() - t0;
        };

        try {
            // Evaluate the alert rules against every monitored target. This is
            // what the 30s interval does on a long-lived host.
            if (alerts?.runMonitoring) {
                await run('monitoring', async () => {
                    await alerts.runMonitoring();
                    return {};
                });
            }

            // Resolve first, then escalate — an incident fixed during this tick
            // should not be paged about on its way out.
            await run('autoClose', async () => {
                const closed = await autoCloseStale(pool, { staleMinutes: 60 });
                return { resolved: closed.length, ids: closed.map((r) => r.id) };
            });

            await run('escalate', async () => {
                const escalated = await escalateOverdue(pool);
                return { escalated: escalated.length, ids: escalated.map((r) => r.id) };
            });

            result.totalMs = Date.now() - started;
            // 200 even when a task failed: the body says what happened, and a
            // non-2xx makes Vercel retry the whole tick including the parts
            // that succeeded.
            res.json(result);
        } finally {
            _running = false;
        }
    });

    /** Liveness for the scheduler itself — is the secret right, is the DB up. */
    router.get('/cron/health', async (req, res) => {
        if (!authorise(req, res)) return;
        try {
            await pool.query('SELECT 1');
            res.json({ ok: true, scheduler: 'external', timers: process.env.VERCEL === '1' ? 'disabled (serverless)' : 'in-process' });
        } catch (err) {
            res.status(503).json({ ok: false, error: err.message });
        }
    });

    return router;
}
