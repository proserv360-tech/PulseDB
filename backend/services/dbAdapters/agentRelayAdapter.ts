// @ts-nocheck — new module 2026-10 (see docs/TS_MIGRATION.md)
/**
 * An engine adapter whose I/O goes through a PulseDB Agent instead of a direct
 * connection (see services/agentRelay.ts).
 *
 * The engine's own adapter class supplies every feature — overview stats,
 * waits, schemas, the console — because those methods all funnel through
 * connect / disconnect / query / executeQuery. Only those four are replaced,
 * so engine-specific SQL stays in one place.
 */
import { getAdapter } from './index.js';
import { runAgentJob } from '../agentRelay.js';

export function createAgentRelayAdapter(connection) {
    const adapter = getAdapter(connection.dbType, {});
    const job = (op, payload, timeoutMs) =>
        runAgentJob({ appId: connection.agentAppId, target: connection.agentTarget, op, payload, timeoutMs });

    adapter.viaAgent = true;

    /** Round trip to the agent, which opens (or reuses) its local connection. */
    adapter.connect = async () => {
        await job('ping', {}, 20_000);
        adapter.connected = true;
    };
    adapter.disconnect = async () => {
        adapter.connected = false;
    };
    adapter.query = async (sql) => {
        const r = await job('query', { sql });
        return { rows: r.rows || [], duration: r.duration ?? 0 };
    };
    /**
     * Run several named queries in one agent round trip (agent 1.1+), e.g. a
     * whole SQL Server screen. Returns { [name]: { rows } | { error } }.
     * Older agents reject the 'batch' op; then each query goes as its own job.
     */
    let batchUnsupported = false;
    adapter.queryMany = async (queries) => {
        if (!batchUnsupported) {
            try {
                const r = await job('batch', { queries });
                return r.results || {};
            } catch (e) {
                if (!/unsupported operation "batch"/.test(e.message)) throw e;
                batchUnsupported = true;
            }
        }
        const out = {};
        await Promise.all(
            Object.entries(queries).map(async ([name, sql]) => {
                try {
                    out[name] = { rows: (await adapter.query(sql)).rows };
                } catch (e) {
                    out[name] = { error: e.message };
                }
            }),
        );
        return out;
    };
    adapter.executeQuery = async (sql) => {
        const r = await job('query', { sql });
        const rows = r.rows || [];
        const fields =
            r.fields || (rows.length ? Object.keys(rows[0]).map((name) => ({ name, type: typeof rows[0][name] })) : []);
        return {
            rows,
            fields,
            rowCount: r.rowCount ?? rows.length,
            duration: r.duration ?? 0,
            truncated: !!r.truncated,
        };
    };
    // Agent connections are always reachable through the agent; nothing to tunnel.
    adapter.connected = true;
    return adapter;
}
