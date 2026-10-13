// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/agentIngestRoutes.js
 *
 * C1 — endpoints the PulseDB managed agent posts to.
 *
 *   POST /api/agent/wait-events   { samples: [{...}, ...] }
 *   POST /api/agent/query-stats   { stats:   [{...}, ...] }
 *
 * Both require the x-sdk-key header. They share the same SDK key
 * authentication shape as the OTLP route (see otlpTraceRoutes.js).
 *
 * Wait-event payloads are inserted into pgmonitoringtool.wait_event_samples
 * — the same table the in-process sampler (A3) writes to — so the agent
 * and the in-process sampler can coexist on a fleet (the agent for
 * hosts where the backend can't reach the Postgres directly; the
 * in-process path for those it can).
 */

import { Router } from 'express';
import { query } from '../db.js';

function log(level, msg, meta = {}) {
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg, component: 'agentIngest', ...meta }));
}

export default function agentIngestRoutes(pool, authenticateSdkKey) {
    const router = Router();

    async function resolveSdk(req, res) {
        const sdkKey = req.headers['x-sdk-key'];
        if (!sdkKey) {
            res.status(401).json({ error: 'x-sdk-key required' });
            return null;
        }
        const app = typeof authenticateSdkKey === 'function'
            ? await authenticateSdkKey(pool, sdkKey)
            : null;
        if (!app) {
            res.status(401).json({ error: 'invalid_sdk_key' });
            return null;
        }
        return app;
    }

    // ── Wait events ──────────────────────────────────────────────────────
    router.post('/agent/wait-events', async (req, res, next) => {
        try {
            const app = await resolveSdk(req, res);
            if (!app) return;

            const { connectionId, samples } = req.body || {};
            if (!connectionId) return res.status(400).json({ error: 'connectionId required' });
            if (!Array.isArray(samples) || samples.length === 0) {
                return res.status(400).json({ error: 'samples array required' });
            }
            if (samples.length > 5000) {
                return res.status(413).json({ error: 'batch_too_large', limit: 5000 });
            }

            // Bulk insert — same column shape as the in-process sampler.
            const values = [];
            const params = [];
            samples.forEach((s, i) => {
                const base = i * 8;
                values.push(`($1, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`);
                params.push(
                    s.sampled_at || s.sampledAt || new Date(),
                    s.pid,
                    s.state || null,
                    s.wait_event_type || s.waitEventType || null,
                    s.wait_event || s.waitEvent || null,
                    s.query_id || s.queryId || null,
                    s.backend_type || s.backendType || null,
                    s.application_name || s.applicationName || null
                );
            });
            await query(
                `INSERT INTO pgmonitoringtool.wait_event_samples
                    (connection_id, sampled_at, pid, state, wait_event_type, wait_event, query_id, backend_type, application_name)
                 VALUES ${values.join(', ')}`,
                [connectionId, ...params]
            ).catch(err => {
                if (/relation .* does not exist/i.test(err.message)) {
                    log('WARN', 'wait_event_samples table missing — drop ingest');
                    return null;
                }
                throw err;
            });
            res.status(202).json({ accepted: samples.length });
        } catch (err) { next(err); }
    });

    // ── Query stats (pg_stat_statements snapshots) ───────────────────────
    // For C1 we just persist a JSONB blob per (connection, captured_at).
    // The roll-up to "top queries by load" lives in the worker tier and is
    // tracked under future work — keep the surface minimal so we can swap
    // the storage shape without breaking the agent.
    router.post('/agent/query-stats', async (req, res, next) => {
        try {
            const app = await resolveSdk(req, res);
            if (!app) return;

            const { connectionId, stats } = req.body || {};
            if (!connectionId) return res.status(400).json({ error: 'connectionId required' });
            if (!Array.isArray(stats)) return res.status(400).json({ error: 'stats array required' });
            if (stats.length > 2000) return res.status(413).json({ error: 'batch_too_large', limit: 2000 });

            try {
                await query(
                    `INSERT INTO pgmonitoringtool.agent_query_stats
                        (connection_id, captured_at, snapshot)
                     VALUES ($1, now(), $2)`,
                    [connectionId, JSON.stringify(stats)]
                );
            } catch (err) {
                if (/relation .* does not exist/i.test(err.message)) {
                    log('WARN', 'agent_query_stats table missing — drop ingest');
                } else {
                    throw err;
                }
            }
            res.status(202).json({ accepted: stats.length });
        } catch (err) { next(err); }
    });

    return router;
}
