// @ts-nocheck — matches the surrounding service style; typed modules are opt-in.
/**
 * connectionHealthService.ts
 * ──────────────────────────
 * Answers "is my database up?" — which nothing else in this codebase did.
 *
 * WHY THIS EXISTS
 * ---------------
 * EnhancedAlertEngine is constructed as `new EnhancedAlertEngine(pool, …)` where
 * `pool` is the ADMIN pool, so every threshold rule it evaluates is measuring
 * PulseDB's own control-plane database — not the databases a user has connected.
 * And when a probe fails, collectMetrics() catches, returns null, and the caller
 * does `if (!metrics) return []`. The result: an unreachable monitored database
 * produced complete silence.
 *
 * This service polls each row in pulsedb_connections directly and fires on
 * transitions.
 *
 * DESIGN NOTES
 * ------------
 * • Short-lived Client per probe, never the cached getPool() pools. A cached
 *   pool can hand back a socket that looks alive, or sit in a reconnect loop —
 *   either way it hides the outage we are trying to detect.
 *
 * • Fires on TRANSITION, not on every cycle. A database that is down for an
 *   hour produces one alert, not 120. Recovery fires a `resolved` alert so the
 *   Slack thread closes itself out.
 *
 * • `failureThreshold` consecutive failures before alerting, so a single dropped
 *   packet or pooler blip does not page anyone.
 *
 * • Every probe is wrapped in its own timeout. A database that accepts the TCP
 *   connection then never responds is the classic hang, and connectionTimeout
 *   alone does not cover it.
 *
 * • Probes run concurrently via allSettled — one slow database must not delay
 *   the others, and one thrown error must not abort the cycle.
 */

import pg from 'pg';
import { decrypt, isEncrypted } from './encryptionService.js';

const { Client } = pg;

const DEFAULTS = {
    intervalMs: Number(process.env.PULSEDB_HEALTH_INTERVAL_MS) || 60_000,
    timeoutMs: Number(process.env.PULSEDB_HEALTH_TIMEOUT_MS) || 8_000,
    slowMs: Number(process.env.PULSEDB_HEALTH_SLOW_MS) || 2_000,
    failureThreshold: Number(process.env.PULSEDB_HEALTH_FAILURES) || 2,
};

function log(level, msg, meta = {}) {
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg, component: 'connectionHealth', ...meta }));
}

/** Reject if the probe has not settled in time — covers connect-then-hang. */
function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Open a throwaway connection, run SELECT 1, measure round-trip.
 * Returns { ok, latencyMs, error } and never throws.
 */
export async function probeConnection(conn, timeoutMs = DEFAULTS.timeoutMs) {
    const started = Date.now();
    let client;
    try {
        let password = conn.password;
        if (password && isEncrypted(password)) {
            try {
                password = decrypt(password);
            } catch {
                // Encrypted under a different ENCRYPTION_KEY — the credential is
                // unusable, which is worth surfacing as its own failure rather
                // than as a generic auth error.
                return {
                    ok: false,
                    latencyMs: Date.now() - started,
                    error: 'credentials could not be decrypted (ENCRYPTION_KEY changed?)',
                    code: 'DECRYPT_FAILED',
                };
            }
        }

        client = new Client({
            host: conn.host,
            port: conn.port || 5432,
            database: conn.database,
            user: conn.username,
            password,
            ssl: conn.ssl ? { rejectUnauthorized: false } : undefined,
            connectionTimeoutMillis: timeoutMs,
            statement_timeout: timeoutMs,
        });

        await withTimeout(client.connect(), timeoutMs, 'connect');
        await withTimeout(client.query('SELECT 1'), timeoutMs, 'query');

        return { ok: true, latencyMs: Date.now() - started, error: null, code: null };
    } catch (err) {
        return {
            ok: false,
            latencyMs: Date.now() - started,
            error: err.message,
            code: err.code || 'PROBE_FAILED',
        };
    } finally {
        // end() can itself reject on an already-broken socket; ignore.
        if (client) await client.end().catch(() => {});
    }
}

export class ConnectionHealthMonitor {
    /**
     * @param {object} opts
     * @param {import('pg').Pool} opts.pool    — admin pool (reads pulsedb_connections)
     * @param {object} opts.alerts             — the alert engine; needs .fire()
     */
    constructor({ pool, alerts, ...options } = {}) {
        this.pool = pool;
        this.alerts = alerts;
        this.opts = { ...DEFAULTS, ...options };
        // id → { up, consecutiveFailures, since, lastLatency }
        this.state = new Map();
        this.timer = null;
    }

    async _loadConnections() {
        const { rows } = await this.pool.query(
            `SELECT id, name, host, port, db_name, username, password, ssl, db_type
               FROM pgmonitoringtool.pulsedb_connections`,
        );
        return rows
            // Only Postgres for now — probing MySQL/Mongo needs their own drivers.
            .filter((r) => !r.db_type || String(r.db_type).toLowerCase().startsWith('postgres'))
            .map((r) => ({
                id: r.id,
                name: r.name,
                host: r.host,
                port: r.port,
                database: r.db_name,
                username: r.username,
                password: r.password,
                ssl: r.ssl,
            }));
    }

    _fire(severity, message, data) {
        if (!this.alerts?.fire) return;
        // Never let a delivery failure kill the polling loop.
        Promise.resolve(this.alerts.fire(severity, 'availability', message, data)).catch((err) =>
            log('ERROR', 'Failed to fire health alert', { error: err.message }),
        );
    }

    async checkOnce() {
        let connections;
        try {
            connections = await this._loadConnections();
        } catch (err) {
            // The control plane itself is unreachable. Nothing can be persisted
            // or delivered from here — see the note at the end of this file.
            log('ERROR', 'Could not load connections to probe', { error: err.message });
            return [];
        }

        const results = await Promise.allSettled(
            connections.map(async (conn) => {
                const result = await probeConnection(conn, this.opts.timeoutMs);
                this._evaluate(conn, result);
                return { id: conn.id, name: conn.name, ...result };
            }),
        );

        return results.map((r) => (r.status === 'fulfilled' ? r.value : { ok: false, error: r.reason?.message }));
    }

    /** Compare against last known state and alert only on a transition. */
    _evaluate(conn, result) {
        const prev = this.state.get(conn.id) || { up: true, consecutiveFailures: 0, since: Date.now() };
        const base = {
            connectionId: conn.id,
            connectionName: conn.name,
            host: conn.host,
            database: conn.database,
            latencyMs: result.latencyMs,
        };

        if (!result.ok) {
            const failures = prev.consecutiveFailures + 1;
            this.state.set(conn.id, { ...prev, consecutiveFailures: failures, lastLatency: result.latencyMs });

            // Alert once, on the crossing — not on every subsequent cycle.
            if (prev.up && failures >= this.opts.failureThreshold) {
                this.state.set(conn.id, { up: false, consecutiveFailures: failures, since: Date.now() });
                log('ERROR', 'Connection unreachable', { name: conn.name, error: result.error });
                this._fire('critical', `Database "${conn.name}" is unreachable — ${result.error}`, {
                    ...base,
                    rule: 'connection_unreachable',
                    error: result.error,
                    code: result.code,
                    consecutiveFailures: failures,
                });
            }
            return;
        }

        // Recovered.
        if (!prev.up) {
            const downMs = Date.now() - (prev.since || Date.now());
            const mins = Math.max(1, Math.round(downMs / 60000));
            log('INFO', 'Connection recovered', { name: conn.name, downMinutes: mins });
            this._fire('info', `Database "${conn.name}" is reachable again after ~${mins}m`, {
                ...base,
                rule: 'connection_recovered',
                downMinutes: mins,
                resolved: true,
            });
        } else if (result.latencyMs > this.opts.slowMs && (prev.lastLatency ?? 0) <= this.opts.slowMs) {
            // Slow, but only on the crossing — same reasoning as above.
            this._fire('warning', `Database "${conn.name}" is slow to respond (${result.latencyMs}ms)`, {
                ...base,
                rule: 'connection_slow',
                thresholdMs: this.opts.slowMs,
            });
        }

        this.state.set(conn.id, {
            up: true,
            consecutiveFailures: 0,
            since: prev.up ? prev.since : Date.now(),
            lastLatency: result.latencyMs,
        });
    }

    start() {
        if (this.timer) return this;
        log('INFO', 'Connection health monitor started', {
            intervalMs: this.opts.intervalMs,
            timeoutMs: this.opts.timeoutMs,
            slowMs: this.opts.slowMs,
            failureThreshold: this.opts.failureThreshold,
        });
        // Probe immediately so a database that is already down is reported at
        // startup rather than one interval later.
        this.checkOnce().catch((err) => log('ERROR', 'Health cycle failed', { error: err.message }));
        this.timer = setInterval(
            () => this.checkOnce().catch((err) => log('ERROR', 'Health cycle failed', { error: err.message })),
            this.opts.intervalMs,
        );
        this.timer.unref?.();
        return this;
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    /** Current view, for the fleet UI or a health endpoint. */
    snapshot() {
        return [...this.state.entries()].map(([id, s]) => ({
            connectionId: id,
            up: s.up,
            since: new Date(s.since).toISOString(),
            lastLatencyMs: s.lastLatency ?? null,
            consecutiveFailures: s.consecutiveFailures,
        }));
    }
}

export function startConnectionHealthMonitor(opts) {
    return new ConnectionHealthMonitor(opts).start();
}

/* ── The case this still cannot cover ─────────────────────────────────────────
 * If the ADMIN database is down, this service cannot load the connection list,
 * and alertService.fire() cannot persist an alert — and because delivery in
 * fire() sits inside the same try block as the INSERT, Slack is never attempted
 * either. A control-plane outage is therefore still silent.
 *
 * Two things would close that, both deliberately out of scope here:
 *   1. Move delivery in fire() outside the persistence try, so an alert can be
 *      delivered even when it cannot be stored.
 *   2. An external dead-man's switch — a heartbeat this process pushes to a
 *      third party that pages when the heartbeat stops. Nothing running inside
 *      a failed system can reliably report that the system has failed.
 * ──────────────────────────────────────────────────────────────────────────── */
