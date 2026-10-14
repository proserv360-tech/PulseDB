// @ts-nocheck — new module 2026-10 (see docs/TS_MIGRATION.md)
/**
 * PulseDB Agent relay (db/migrations/0037_agent_relay.sql).
 *
 * A cloud PulseDB cannot open connections to a database on someone's PC or
 * LAN. The PulseDB Agent runs next to that database instead, keeps its
 * credentials locally, and only ever talks to PulseDB outbound:
 *
 *   runAgentJob()  INSERT a job, then poll for its result
 *   claimJobs()    the agent's long-poll: hand out queued jobs
 *   completeJob()  the agent posts a result
 *
 * Postgres is the broker so this works on serverless hosts, where the request
 * that needs data and the request the agent is polling on are different
 * function instances.
 */
import { pool } from '../core/adminPool.js';
import { log } from './logger.js';

const S = 'pgmonitoringtool';

/** Engines the agent can serve (adapter methods all funnel through query()). */
export const AGENT_ENGINES = new Set(['mssql']);

// The agent checks in at least every ~10s (each claim refreshes the SDK app's
// last_heartbeat_at), so a minute of silence means it is not running.
const OFFLINE_AFTER_MS = 60_000;
// A job the agent has not picked up within this window is abandoned: the
// requester has given up and the result would go nowhere.
const JOB_PICKUP_WINDOW = '60 seconds';
const RESULT_POLL_MS = 300;
const CLAIM_POLL_MS = 500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A host only something on the user's own network can reach: a computer name
 * (MYPC, MYPC\SQLEXPRESS), localhost, a private IP, or a *.local-style name.
 */
export function isLocalOnlyHost(host) {
    const h = String(host || '')
        .trim()
        .split('\\')[0]
        .toLowerCase();
    if (!h) return false;
    if (['localhost', '.', '(local)', '::1'].includes(h)) return true;
    if (/^(127|10)\.\d+\.\d+\.\d+$/.test(h) || /^192\.168\.\d+\.\d+$/.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(h)) return true;
    if (/\.(local|lan|internal|home|corp|localdomain)$/.test(h)) return true;
    return !h.includes('.') && !h.includes(':'); // single-label computer name
}

const normEngine = (t) => {
    const s = String(t || '').toLowerCase();
    return s === 'sqlserver' || s === 'sql-server' ? 'mssql' : s;
};

/**
 * On a cloud deployment, which online PulseDB Agent of this user can reach a
 * connection's private/local host? Lets an ordinary connection (host
 * "MYPC\SQLEXPRESS", a SQL login) work from the cloud: the agent dials it with
 * the connection's own credentials. Prefers the agent running on the named
 * machine; otherwise the user's only online agent. Self-hosted installs reach
 * such hosts directly and are not routed (PULSEDB_ROUTE_VIA_AGENT=1 forces it).
 * @returns {Promise<{ id: number, name: string, machine: string|null } | null>}
 */
export async function findAgentRoute({ dbType, host, userId }) {
    if (process.env.VERCEL !== '1' && process.env.PULSEDB_ROUTE_VIA_AGENT !== '1') return null;
    if (!pool || !userId || !AGENT_ENGINES.has(normEngine(dbType)) || !isLocalOnlyHost(host)) return null;
    const { rows } = await pool.query(
        `SELECT id, name, config->>'machine' AS machine
           FROM ${S}.sdk_applications
          WHERE status = 'active' AND created_by = $1
            AND config->>'pulsedbAgent' = 'true'
            AND config->'capabilities' ? 'relay'
            AND last_heartbeat_at > now() - interval '${OFFLINE_AFTER_MS / 1000} seconds'
          ORDER BY last_heartbeat_at DESC`,
        [userId],
    );
    if (!rows.length) return null;
    const machine = String(host).trim().split('\\')[0].toLowerCase();
    return rows.find((r) => (r.machine || '').toLowerCase() === machine) || (rows.length === 1 ? rows[0] : null);
}

/**
 * Run one operation on an agent and wait for its result.
 * @returns {Promise<object>} the agent's result payload
 */
export async function runAgentJob({ appId, target, op, payload = {}, timeoutMs = 25_000 }) {
    const {
        rows: [app],
    } = await pool.query(`SELECT name, last_heartbeat_at FROM ${S}.sdk_applications WHERE id = $1`, [appId]);
    if (!app) throw new Error('The PulseDB Agent for this connection no longer exists.');
    const seenMs = app.last_heartbeat_at ? Date.now() - new Date(app.last_heartbeat_at).getTime() : Infinity;
    if (seenMs > OFFLINE_AFTER_MS) {
        const when = Number.isFinite(seenMs) ? ` (last seen ${Math.round(seenMs / 1000)}s ago)` : '';
        throw new Error(
            `PulseDB Agent "${app.name}" is offline${when}. Start the agent on the machine next to the database.`,
        );
    }

    if (Math.random() < 0.05) purgeStaleJobs().catch(() => {});

    const {
        rows: [job],
    } = await pool.query(
        `INSERT INTO ${S}.agent_jobs (app_id, target, op, payload) VALUES ($1, $2, $3, $4) RETURNING id`,
        [appId, target, op, JSON.stringify(payload)],
    );
    const deadline = Date.now() + timeoutMs;
    try {
        while (Date.now() < deadline) {
            await sleep(RESULT_POLL_MS);
            const {
                rows: [r],
            } = await pool.query(`SELECT status, result, error FROM ${S}.agent_jobs WHERE id = $1`, [job.id]);
            if (!r) throw new Error('The agent job disappeared before it finished.');
            if (r.status === 'done') return r.result ?? {};
            if (r.status === 'error') throw new Error(r.error || 'The agent reported an error.');
        }
        throw new Error(`PulseDB Agent "${app.name}" did not answer within ${Math.round(timeoutMs / 1000)}s.`);
    } finally {
        // Results can contain query data; never leave them behind.
        await pool.query(`DELETE FROM ${S}.agent_jobs WHERE id = $1`, [job.id]).catch(() => {});
    }
}

/**
 * Agent long-poll: atomically hand out up to `max` queued jobs, waiting up to
 * `waitMs` for some to arrive. SKIP LOCKED lets several agent processes share
 * one key without double-claiming.
 */
export async function claimJobs(appId, { max = 8, waitMs = 8_000 } = {}) {
    const deadline = Date.now() + Math.min(Math.max(waitMs, 0), 20_000);
    for (;;) {
        const { rows } = await pool.query(
            `UPDATE ${S}.agent_jobs
                SET status = 'running', claimed_at = now()
              WHERE id IN (
                    SELECT id FROM ${S}.agent_jobs
                     WHERE app_id = $1 AND status = 'queued'
                       AND created_at > now() - interval '${JOB_PICKUP_WINDOW}'
                     ORDER BY created_at
                     LIMIT $2
                     FOR UPDATE SKIP LOCKED)
              RETURNING id, target, op, payload`,
            [appId, Math.min(Math.max(max, 1), 32)],
        );
        if (rows.length || Date.now() >= deadline) return rows;
        await sleep(CLAIM_POLL_MS);
    }
}

/** Record an agent's result. Only the agent that claimed the job can complete it. */
export async function completeJob(appId, jobId, { ok, result, error }) {
    const { rowCount } = await pool.query(
        `UPDATE ${S}.agent_jobs
            SET status = $3, result = $4, error = $5, finished_at = now()
          WHERE id = $1 AND app_id = $2 AND status = 'running'`,
        [
            jobId,
            appId,
            ok ? 'done' : 'error',
            ok ? JSON.stringify(result ?? {}) : null,
            ok ? null : String(error || 'error').slice(0, 2000),
        ],
    );
    return rowCount > 0;
}

export async function purgeStaleJobs() {
    await pool.query(`DELETE FROM ${S}.agent_jobs WHERE created_at < now() - interval '10 minutes'`);
}

/**
 * Upsert one PulseDB connection per target the agent serves, owned by the user
 * who created the agent's SDK application. Credentials stay on the agent: the
 * connection row stores no password.
 * @returns {Promise<Array<{ target: string, connectionId: number, created: boolean }>>}
 */
/**
 * A user deleted a connection the agent registered: remember the target so the
 * agent's periodic re-registration does not bring it back. Running the agent's
 * setup again clears the list (registration with restoreRemoved).
 */
export async function rememberRemovedTarget(appId, target) {
    if (!pool || !appId || !target) return;
    await pool.query(
        `UPDATE ${S}.sdk_applications
            SET config = jsonb_set(config, '{removedTargets}',
                    (SELECT to_jsonb(array(SELECT DISTINCT x FROM unnest(
                         array(SELECT jsonb_array_elements_text(COALESCE(config->'removedTargets', '[]'::jsonb))) || $2::text
                     ) AS x))))
          WHERE id = $1`,
        [appId, String(target).slice(0, 100)],
    );
}

const configOf = (app) => (typeof app.config === 'string' ? JSON.parse(app.config || '{}') : app.config || {});

export async function registerAgentTargets(app, targets) {
    if (!app.created_by)
        throw Object.assign(new Error('This agent key has no owner; create it from the PulseDB UI.'), { status: 400 });
    const removed = new Set(configOf(app).removedTargets || []);
    const out = [];
    for (const t of targets) {
        const target = String(t.name || '')
            .trim()
            .slice(0, 100);
        if (removed.has(target)) {
            // Deleted by the user: keep it deleted (setup.cmd restores it).
            out.push({ target, connectionId: null, skipped: 'removed in PulseDB' });
            continue;
        }
        const engine = String(t.engine || '').toLowerCase();
        if (!target) throw Object.assign(new Error('Every target needs a name.'), { status: 400 });
        if (!AGENT_ENGINES.has(engine)) {
            throw Object.assign(
                new Error(
                    `Target "${target}": engine "${engine}" is not supported by the agent yet (supported: ${[...AGENT_ENGINES].join(', ')}).`,
                ),
                { status: 400 },
            );
        }
        const host = String(t.host || 'localhost').slice(0, 255);
        const port = Number(t.port) || 1433;
        const database = String(t.database || '').slice(0, 255);

        const updated = await pool.query(
            `UPDATE ${S}.pulsedb_connections
                SET db_type = $3, db_name = $4, host = $5, port = $6
              WHERE agent_app_id = $1 AND agent_target = $2
              RETURNING id`,
            [app.id, target, engine, database, host, port],
        );
        if (updated.rows[0]) {
            out.push({ target, connectionId: updated.rows[0].id, created: false });
            continue;
        }

        // The agent's SDK application was deleted and re-created (ON DELETE SET
        // NULL detached its connections): adopt them rather than duplicating.
        const adopted = await pool.query(
            `UPDATE ${S}.pulsedb_connections
                SET agent_app_id = $1, db_type = $4, db_name = $5, host = $6, port = $7
              WHERE id = (SELECT id FROM ${S}.pulsedb_connections
                           WHERE agent_app_id IS NULL AND agent_target = $2 AND user_id = $3
                           ORDER BY id LIMIT 1)
              RETURNING id`,
            [app.id, target, app.created_by, engine, database, host, port],
        );
        if (adopted.rows[0]) {
            out.push({ target, connectionId: adopted.rows[0].id, created: false });
            continue;
        }

        // New target: the display name must be unique per user.
        let name = target;
        for (let attempt = 1; ; attempt++) {
            try {
                const { rows } = await pool.query(
                    `INSERT INTO ${S}.pulsedb_connections
                        (user_id, name, host, port, db_name, username, password, ssl, db_type, agent_app_id, agent_target)
                     VALUES ($1, $2, $3, $4, $5, '', '', false, $6, $7, $8)
                     RETURNING id`,
                    [app.created_by, name, host, port, database, engine, app.id, target],
                );
                out.push({ target, connectionId: rows[0].id, created: true });
                break;
            } catch (e) {
                if (e.code !== '23505' || attempt >= 20) throw e;
                name = `${target} (agent${attempt > 1 ? ` ${attempt}` : ''})`;
            }
        }
    }
    log('INFO', 'Agent registered targets', { appId: app.id, agent: app.name, targets: out.map((o) => o.target) });
    return out;
}
