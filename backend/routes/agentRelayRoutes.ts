// @ts-nocheck — new module 2026-10 (see docs/TS_MIGRATION.md)
/**
 * Endpoints the PulseDB Agent calls (agent/pulsedb-agent.mjs). All require the
 * agent's SDK application key in `x-sdk-key`; each call also refreshes the
 * application's last_heartbeat_at, which is how PulseDB knows the agent is up.
 *
 *   POST /api/agent/register          { agent, targets[] } -> connections upserted
 *   POST /api/agent/jobs/claim        { max?, waitMs? }    -> { jobs[] } (long-poll)
 *   POST /api/agent/jobs/:id/result   { ok, result?, error? }
 */
import { Router } from 'express';
import { syncConnectionsCache } from '../core/connectionStore.js';
import { claimJobs, completeJob, registerAgentTargets } from '../services/agentRelay.js';

export default function agentRelayRoutes(pool, authenticateSdkKey, log) {
    const router = Router();

    async function agentApp(req, res) {
        const key = req.headers['x-sdk-key'];
        if (!key) {
            res.status(401).json({ error: 'x-sdk-key required' });
            return null;
        }
        const app = await authenticateSdkKey(pool, key);
        if (!app) {
            res.status(401).json({ error: 'invalid_sdk_key' });
            return null;
        }
        return app;
    }

    router.post('/agent/register', async (req, res) => {
        try {
            const app = await agentApp(req, res);
            if (!app) return;
            const targets = req.body?.targets;
            if (!Array.isArray(targets) || targets.length === 0 || targets.length > 50) {
                return res.status(400).json({ error: 'targets must be a non-empty array (max 50)' });
            }
            // A downloaded agent package ("Connect another PC") is named after the
            // PC it first registers from, so SDK Integration shows which is which.
            const hostname = String(req.body?.agent?.hostname || '').slice(0, 80);
            const cfg = typeof app.config === 'string' ? JSON.parse(app.config || '{}') : app.config || {};
            if (cfg.packaged && !cfg.machine && hostname) {
                await pool.query(
                    `UPDATE pgmonitoringtool.sdk_applications
                        SET name = $2, config = config || jsonb_build_object('machine', $3::text), updated_at = now()
                      WHERE id = $1`,
                    [app.id, `${hostname} agent`, hostname],
                );
                app.name = `${hostname} agent`;
            }
            // Remember what this agent can do and where it runs: findAgentRoute only
            // routes ordinary private-host connections to agents that can relay them.
            const caps = (Array.isArray(req.body?.agent?.capabilities) ? req.body.agent.capabilities : [])
                .map((c) => String(c).slice(0, 20))
                .filter((c) => /^[a-z]+$/.test(c))
                .slice(0, 10);
            await pool.query(
                `UPDATE pgmonitoringtool.sdk_applications
                    SET config = config
                        || jsonb_build_object('pulsedbAgent', true, 'capabilities', $2::jsonb, 'agentVersion', $3::text)
                        || CASE WHEN config ? 'machine' OR $4 = '' THEN '{}'::jsonb
                                ELSE jsonb_build_object('machine', $4::text) END
                  WHERE id = $1`,
                [app.id, JSON.stringify(caps), String(req.body?.agent?.version || '').slice(0, 20), hostname],
            );
            const registered = await registerAgentTargets(app, targets);
            await syncConnectionsCache();
            log('INFO', 'PulseDB Agent registered', {
                appId: app.id,
                agentVersion: req.body?.agent?.version,
                host: req.body?.agent?.hostname,
            });
            res.json({ agent: app.name, registered });
        } catch (e) {
            log('WARN', 'Agent register failed', { error: e.message });
            res.status(e.status || 500).json({ error: e.status ? e.message : 'Agent registration failed' });
        }
    });

    router.post('/agent/jobs/claim', async (req, res) => {
        try {
            const app = await agentApp(req, res);
            if (!app) return;
            const jobs = await claimJobs(app.id, {
                max: Number(req.body?.max) || 8,
                waitMs: req.body?.waitMs === undefined ? 8_000 : Number(req.body.waitMs),
            });
            res.json({ jobs });
        } catch (e) {
            log('WARN', 'Agent claim failed', { error: e.message });
            res.status(500).json({ error: 'claim failed' });
        }
    });

    router.post('/agent/jobs/:id/result', async (req, res) => {
        try {
            const app = await agentApp(req, res);
            if (!app) return;
            if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: 'invalid job id' });
            const { ok, result, error } = req.body || {};
            const accepted = await completeJob(app.id, req.params.id, { ok: !!ok, result, error });
            // 410: the requester already gave up (timeout) or the job is not this agent's.
            res.status(accepted ? 200 : 410).json({ accepted });
        } catch (e) {
            log('WARN', 'Agent result failed', { error: e.message });
            res.status(500).json({ error: 'result failed' });
        }
    });

    return router;
}
