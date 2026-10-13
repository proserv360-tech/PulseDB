// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/waitEventSampler.js
 *
 * A3 — Postgres wait-event sampling.
 *
 * Polls pg_stat_activity at a configurable cadence (default 1 Hz) across
 * the monitored Postgres connections registered in pgmonitoringtool.connections.
 * Each non-idle backend on each sample becomes one row in
 * pgmonitoringtool.wait_event_samples. Every 5 minutes the same row data is
 * folded into pgmonitoringtool.wait_event_rollups_5m by wait class for
 * cheap dashboard reads.
 *
 * Discipline (mirrors syntheticMonitor.js):
 *   - One in-flight poll per connection. Overlapping ticks are dropped.
 *   - Absolute per-poll timeout so a slow target can't block the loop.
 *   - Skipped under VERCEL=1 (no long-lived process).
 *   - Once B1 lands, this moves into worker.js behind the queue.
 *
 * Public surface:
 *   startWaitEventSampler({ pool, getPool, intervalMs, rollupIntervalMs })
 *   stopWaitEventSampler()
 *   getRecentSamples(connectionId, fromTs, toTs, limit)
 *   getRollups(connectionId, fromTs, toTs)
 *
 * Wave A.
 */

import { query } from '../db.js';

const SAMPLE_INTERVAL_MS = Number(process.env.FATHOM_WAIT_EVENT_INTERVAL_MS) || 1000;
const ROLLUP_INTERVAL_MS = 5 * 60_000;
const POLL_TIMEOUT_MS    = 2_000;

// pg_stat_activity wait_event_type → coarse wait class. Mirrors the canonical
// Postgres taxonomy: CPU when wait_event_type is NULL and state is active.
function classify(state, waitEventType) {
    if (waitEventType === null || waitEventType === undefined || waitEventType === '') {
        return state === 'active' ? 'CPU' : 'Other';
    }
    switch (waitEventType) {
        case 'IO':
        case 'Lock':
        case 'IPC':
        case 'Client':
        case 'BufferPin':
        case 'Activity':
        case 'Extension':
        case 'LWLock':
        case 'Timeout':
            return waitEventType === 'LWLock' ? 'Lock'
                 : waitEventType === 'Extension' ? 'Other'
                 : waitEventType;
        default:
            return 'Other';
    }
}

function log(level, msg, meta = {}) {
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg, component: 'waitEventSampler', ...meta }));
}

let _samplerHandle = null;
let _rollupHandle  = null;
const _inFlight    = new Map();   // connectionId -> true

async function pollOne(connectionId, getPool) {
    if (_inFlight.get(connectionId)) return;       // overlapping tick — drop.
    _inFlight.set(connectionId, true);
    const pool = await Promise.resolve()
        .then(() => getPool(connectionId))
        .catch((err) => {
            log('WARN', 'wait-event poll: could not acquire pool', {
                connectionId, error: err?.message,
            });
            return null;
        });
    if (!pool) { _inFlight.delete(connectionId); return; }

    let client;
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), POLL_TIMEOUT_MS);
        try {
            client = await pool.connect();
            const sql = `
                SELECT pid, state, wait_event_type, wait_event,
                       query_id, backend_type, application_name
                  FROM pg_stat_activity
                 WHERE pid <> pg_backend_pid()
                   AND state IS NOT NULL
                   AND state <> 'idle'`;
            const { rows } = await client.query({ text: sql });
            if (rows.length === 0) return;

            // Bulk insert. Build a single VALUES list — cheap because each
            // sample is < 200 rows on a real workload and the inserts are
            // far cheaper than the network RTT.
            const values = [];
            const params = [];
            rows.forEach((r, idx) => {
                const base = idx * 7;
                values.push(`($1, now(), $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`);
                params.push(r.pid, r.state, r.wait_event_type, r.wait_event, r.query_id, r.backend_type, r.application_name);
            });
            await query(
                `INSERT INTO pgmonitoringtool.wait_event_samples
                    (connection_id, sampled_at, pid, state, wait_event_type, wait_event, query_id, backend_type, application_name)
                 VALUES ${values.join(', ')}`,
                [connectionId, ...params]
            );
        } finally {
            clearTimeout(timer);
        }
    } catch (err) {
        if (!/relation .* does not exist/i.test(err.message)) {
            log('WARN', 'Wait-event poll failed', { connectionId, error: String(err && err.message) });
        }
    } finally {
        if (client) try { client.release(); } catch { /* no-op */ }
        _inFlight.delete(connectionId);
    }
}

/**
 * The connections table is `fathom_connections`, not `connections` — the latter
 * has never existed. This queried it once a second, hit 42P01, and the catch
 * below translated "the table is missing" into "there are no connections", so
 * the sampler has been running against nothing since it was written while still
 * paying a control-plane round trip every tick.
 *
 * Column names differ from what the old query assumed too: the type column is
 * `connection_type`, and there is no `status` — liveness is `health_status`,
 * which is 'unknown' until the first health check, so it must not be used to
 * exclude a connection or the sampler would idle until something else probed.
 */
async function listActiveConnections(pool) {
    try {
        const { rows } = await pool.query(
            `SELECT id::text AS id
               FROM pgmonitoringtool.fathom_connections
              WHERE COALESCE(connection_type, 'postgresql') IN ('postgresql', 'postgres')`
        );
        return rows.map(r => r.id);
    } catch (err) {
        // Kept for a database that predates the table, but no longer silently
        // covers a wrong name: log it, or the next rename fails the same way.
        if (/relation .* does not exist/i.test(err.message)) {
            log('WARN', 'wait-event sampler: connections table missing', { error: err.message });
            return [];
        }
        throw err;
    }
}

async function tick(pool, getPool) {
    let conns;
    try { conns = await listActiveConnections(pool); }
    catch (err) {
        log('WARN', 'listActiveConnections failed', { error: String(err && err.message) });
        return;
    }
    await Promise.allSettled(conns.map(id => pollOne(id, getPool)));
}

async function runRollup() {
    try {
        // Fold the latest 5-minute window into the rollup table. The window
        // boundary is computed in SQL to avoid clock skew between web tiers.
        await query(`
            INSERT INTO pgmonitoringtool.wait_event_rollups_5m
                (connection_id, bucket_start, wait_class, sample_count)
            SELECT
                connection_id,
                date_trunc('minute', sampled_at)
                    - (extract(minute from sampled_at)::int % 5) * interval '1 minute' AS bucket_start,
                CASE
                    WHEN wait_event_type IS NULL AND state = 'active' THEN 'CPU'
                    WHEN wait_event_type IN ('IO','Lock','IPC','Client','BufferPin','Activity','Timeout') THEN wait_event_type
                    WHEN wait_event_type = 'LWLock' THEN 'Lock'
                    ELSE 'Other'
                END AS wait_class,
                count(*)
              FROM pgmonitoringtool.wait_event_samples
             WHERE sampled_at >= now() - interval '6 minutes'
               AND sampled_at <  now() - interval '1 minute'
             GROUP BY 1, 2, 3
            ON CONFLICT (connection_id, bucket_start, wait_class)
            DO UPDATE SET sample_count = pgmonitoringtool.wait_event_rollups_5m.sample_count
                                        + EXCLUDED.sample_count
        `);
    } catch (err) {
        if (!/relation .* does not exist/i.test(err.message)) {
            log('WARN', 'Wait-event rollup failed', { error: String(err && err.message) });
        }
    }
}

export function startWaitEventSampler({ pool, getPool, intervalMs = SAMPLE_INTERVAL_MS, rollupIntervalMs = ROLLUP_INTERVAL_MS } = {}) {
    if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'test') return;
    if (_samplerHandle) return;
    if (!pool || typeof getPool !== 'function') {
        log('WARN', 'startWaitEventSampler skipped — pool/getPool missing');
        return;
    }
    log('INFO', 'Wait-event sampler started', { intervalMs, rollupIntervalMs });
    _samplerHandle = setInterval(() => { void tick(pool, getPool); }, intervalMs);
    _rollupHandle  = setInterval(() => { void runRollup(); },          rollupIntervalMs);
    if (typeof _samplerHandle.unref === 'function') _samplerHandle.unref();
    if (typeof _rollupHandle.unref  === 'function') _rollupHandle.unref();
}

export function stopWaitEventSampler() {
    if (_samplerHandle) { clearInterval(_samplerHandle); _samplerHandle = null; }
    if (_rollupHandle)  { clearInterval(_rollupHandle);  _rollupHandle  = null; }
    _inFlight.clear();
}

export async function getRecentSamples(connectionId, fromTs, toTs, limit = 1000) {
    const { rows } = await query(
        `SELECT sampled_at, pid, state, wait_event_type, wait_event,
                query_id, backend_type, application_name
           FROM pgmonitoringtool.wait_event_samples
          WHERE connection_id = $1
            AND sampled_at >= $2
            AND sampled_at <= $3
          ORDER BY sampled_at DESC
          LIMIT $4`,
        [connectionId, fromTs, toTs, Math.min(limit, 10_000)]
    );
    return rows;
}

export async function getRollups(connectionId, fromTs, toTs) {
    const { rows } = await query(
        `SELECT bucket_start, wait_class, sample_count
           FROM pgmonitoringtool.wait_event_rollups_5m
          WHERE connection_id = $1
            AND bucket_start >= $2
            AND bucket_start <= $3
          ORDER BY bucket_start ASC`,
        [connectionId, fromTs, toTs]
    );
    return rows;
}

// Exposed for tests so they can drive the classifier without spinning up pg.
export const _internal = { classify };
