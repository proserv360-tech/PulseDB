// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * syntheticMonitor.js
 *
 * Simple synthetic-check scheduler. Each check row in synthetic_checks
 * is polled at its own interval_sec cadence; results are appended to
 * synthetic_results.
 *
 * The scheduler is deliberately conservative:
 *   • One in-flight request per check at a time (overlapping intervals
 *     are dropped, not queued).
 *   • Absolute timeout per check (default 10s) so a slow endpoint can't
 *     back up the loop.
 *   • On Vercel we don't start the loop — serverless functions have no
 *     long-lived process; Vercel Cron or an external poller should hit
 *     `runCheckById()` directly.
 */

import { setTimeout as sleep } from 'node:timers/promises';

const DEFAULT_TIMEOUT_MS = 10_000;

export class SyntheticMonitor {
    constructor(pool, { log = () => {} } = {}) {
        this.pool = pool;
        this.log  = log;
        this.inFlight = new Map();   // check_id → true
        this.stopped  = false;
        this.timer    = null;
    }

    start({ periodMs = 30_000 } = {}) {
        if (this.timer) return;
        this.stopped = false;
        const tick = async () => {
            if (this.stopped) return;
            try { await this._runDueChecks(); }
            catch (err) { this.log('ERROR', 'synthetic tick failed', { err: err.message }); }
            if (!this.stopped) this.timer = setTimeout(tick, periodMs);
        };
        this.timer = setTimeout(tick, periodMs);
        this.timer.unref?.();
    }

    stop() {
        this.stopped = true;
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
    }

    async _runDueChecks() {
        if (!this.pool) return;
        const { rows } = await this.pool.query(
            `SELECT id, name, kind, target, method, headers, body, expected_status, timeout_ms, interval_sec
               FROM pgmonitoringtool.synthetic_checks
              WHERE enabled = TRUE
                AND id NOT IN (
                    SELECT check_id FROM pgmonitoringtool.synthetic_results
                     WHERE ts > now() - (interval_sec * INTERVAL '1 second')
                     GROUP BY check_id
                )`,
        ).catch(() => ({ rows: [] }));
        await Promise.all(rows.map(r => this.runCheck(r)));
    }

    async runCheckById(id) {
        const { rows } = await this.pool.query(
            `SELECT id, name, kind, target, method, headers, body, expected_status, timeout_ms
               FROM pgmonitoringtool.synthetic_checks
              WHERE id = $1`,
            [id],
        );
        if (!rows[0]) return null;
        return this.runCheck(rows[0]);
    }

    async runCheck(check) {
        if (this.inFlight.get(check.id)) return null;  // overlap — skip
        this.inFlight.set(check.id, true);
        const started = Date.now();
        const timeoutMs = check.timeout_ms || DEFAULT_TIMEOUT_MS;
        let result;
        try {
            if (check.kind === 'tcp') {
                result = await this._probeTcp(check.target, timeoutMs);
            } else {
                result = await this._probeHttp(check, timeoutMs);
            }
        } catch (err) {
            result = { ok: false, error: err.message };
        } finally {
            this.inFlight.delete(check.id);
        }
        const latency_ms = Date.now() - started;
        await this._persistResult(check.id, { ...result, latency_ms });
        return { check_id: check.id, latency_ms, ...result };
    }

    async _probeHttp(check, timeoutMs) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const resp = await fetch(check.target, {
                method:  check.method || 'GET',
                headers: check.headers || {},
                body:    check.body   || undefined,
                signal:  controller.signal,
            });
            const text = await resp.text().catch(() => '');
            return {
                ok:           resp.status === (check.expected_status || 200),
                status_code:  resp.status,
                body_excerpt: text.slice(0, 500),
            };
        } finally {
            clearTimeout(timer);
        }
    }

    async _probeTcp(target, timeoutMs) {
        const [host, port] = String(target).split(':');
        const net = await import('node:net');
        return await Promise.race([
            new Promise(resolve => {
                const sock = net.createConnection({ host, port: Number(port) }, () => {
                    sock.end();
                    resolve({ ok: true });
                });
                sock.on('error', err => resolve({ ok: false, error: err.message }));
            }),
            sleep(timeoutMs).then(() => ({ ok: false, error: `TCP connect timeout after ${timeoutMs}ms` })),
        ]);
    }

    async _persistResult(check_id, r) {
        if (!this.pool) return;
        await this.pool.query(
            `INSERT INTO pgmonitoringtool.synthetic_results
                 (check_id, ok, status_code, latency_ms, error, body_excerpt)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [check_id, !!r.ok, r.status_code || null, r.latency_ms || null, r.error || null, r.body_excerpt || null],
        ).catch(() => undefined);
    }
}

export default SyntheticMonitor;
