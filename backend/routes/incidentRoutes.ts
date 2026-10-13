// @ts-nocheck
/**
 * routes/incidentRoutes.ts
 * ───────────────────────
 * Incident read + acknowledgement, over HTTP and from Slack.
 *
 * Two entry points because they have genuinely different trust models:
 *
 *   POST /api/incidents/:id/acknowledge   — session auth, actor is req.user
 *   POST /api/slack/interactions          — Slack signature, actor is the
 *                                           Slack username in the payload
 *
 * The Slack path never trusts a user id supplied in the body; it reads the one
 * Slack signed. Without that, anyone who could reach the endpoint could
 * acknowledge as anybody.
 */

import { Router, raw } from 'express';
import {
    acknowledgeIncident,
    getIncident,
    listIncidents,
    getAuditTrail,
    transitionIncident,
    setFixStatus,
    INCIDENT_STATUS,
    FIX_STATUS,
} from '../services/incidentService.js';

export default function incidentRoutes(pool, authenticate, verifySlackSignature, log = () => {}) {
    const router = Router();

    /* ── Read ────────────────────────────────────────────────────────────── */

    router.get('/incidents', authenticate, async (req, res, next) => {
        try {
            res.json(await listIncidents(pool, {
                limit: req.query.limit,
                phase: req.query.phase,
                priority: req.query.priority,
                owner: req.query.owner,
                overdueOnly: req.query.overdue === 'true',
            }));
        } catch (err) { next(err); }
    });

    router.get('/incidents/:id', authenticate, async (req, res, next) => {
        try {
            const incident = await getIncident(pool, req.params.id);
            if (!incident) return res.status(404).json({ error: 'Incident not found' });
            res.json(incident);
        } catch (err) { next(err); }
    });

    router.get('/incidents/:id/audit', authenticate, async (req, res, next) => {
        try {
            res.json(await getAuditTrail(pool, req.params.id, req.query.limit));
        } catch (err) { next(err); }
    });

    /* ── Acknowledge ─────────────────────────────────────────────────────── */

    router.post('/incidents/:id/acknowledge', authenticate, async (req, res, next) => {
        try {
            const actor = req.user?.username || req.user?.email;
            if (!actor) return res.status(401).json({ error: 'No authenticated user' });

            const result = await acknowledgeIncident(pool, req.params.id, actor, { via: 'ui' });
            if (!result) return res.status(404).json({ error: 'Incident not found' });

            // 200 either way — an incident someone else already took is not a
            // client error, and returning 409 would make the UI show a failure
            // for what is a perfectly normal race.
            res.json({
                id: result.incident.id,
                acknowledgedBy: result.by,
                acknowledgedAt: result.incident.acknowledged_at,
                status: result.incident.status,
                alreadyAcknowledged: result.alreadyAcknowledged,
            });
        } catch (err) { next(err); }
    });

    router.post('/incidents/:id/status', authenticate, async (req, res, next) => {
        try {
            const { status } = req.body || {};
            if (!Object.values(INCIDENT_STATUS).includes(status)) {
                return res.status(400).json({ error: `status must be one of ${Object.values(INCIDENT_STATUS).join(', ')}` });
            }
            const updated = await transitionIncident(pool, req.params.id, status, {
                actor: req.user?.username || 'unknown',
                note: req.body?.note ?? null,
            });
            if (!updated) return res.status(404).json({ error: 'Incident not found' });
            res.json(updated);
        } catch (err) { next(err); }
    });

    router.post('/incidents/:id/fix', authenticate, async (req, res, next) => {
        try {
            const { fixStatus, note, sqlRun } = req.body || {};
            if (!Object.values(FIX_STATUS).includes(fixStatus)) {
                return res.status(400).json({ error: `fixStatus must be one of ${Object.values(FIX_STATUS).join(', ')}` });
            }
            const updated = await setFixStatus(pool, req.params.id, fixStatus, {
                actor: req.user?.username || 'unknown', note, sqlRun,
            });
            if (!updated) return res.status(404).json({ error: 'Incident not found' });
            res.json(updated);
        } catch (err) { next(err); }
    });

    /* ── Slack interactivity ─────────────────────────────────────────────── */

    /**
     * Slack posts button clicks here as application/x-www-form-urlencoded with
     * a single `payload` field of JSON.
     *
     * express.raw is mounted on this route specifically: the signature is
     * computed over the exact bytes Slack sent, and any body parser that has
     * already re-serialised them makes verification impossible. The global
     * express.json() ignores this content type, so raw() gets the real body.
     *
     * Slack expects a 200 within 3 seconds or it shows the user a timeout, so
     * the acknowledgement is awaited but the message update is not.
     */
    router.post('/slack/interactions', raw({ type: '*/*', limit: '256kb' }), async (req, res) => {
        // Signature verification needs the exact bytes Slack sent. Express's
        // raw() gives us those — unless something upstream already consumed the
        // stream, which is the classic serverless failure: some platforms
        // populate req.body before the app sees the request, and a re-serialised
        // body will not match the signature no matter how correct the secret is.
        //
        // Distinguish the two failures explicitly. "Bad signature" and "body was
        // eaten before we saw it" need completely different fixes, and guessing
        // between them costs hours.
        //
        // On Vercel, api/index.js captures the bytes before Express and sets
        // req.rawBody itself — the platform consumes the stream too early for
        // raw() to be any use there. Honour that first: a rawBody already in
        // place is the most trustworthy copy we will get.
        if (typeof req.rawBody === 'string' && req.rawBody.length > 0) {
            // nothing to do — already captured upstream
        } else if (Buffer.isBuffer(req.body)) {
            req.rawBody = req.body.toString('utf8');
        } else if (typeof req.body === 'string') {
            req.rawBody = req.body;
        } else {
            log('ERROR', 'Slack interaction: request body was parsed before this handler', {
                bodyType: typeof req.body,
                hint: 'A body parser ran upstream. Signature verification needs the raw bytes; ' +
                      'see routes/incidentRoutes.ts.',
            });
            return res.status(400).json({
                error: 'Raw request body unavailable — cannot verify Slack signature',
            });
        }

        if (!process.env.SLACK_SIGNING_SECRET) {
            // verifySlackSignature returns false with no secret, which would
            // read as "Slack sent something forged" rather than "you have not
            // finished configuring this".
            log('ERROR', 'Slack interaction rejected: SLACK_SIGNING_SECRET is not set');
            return res.status(503).json({ error: 'Slack signing secret not configured' });
        }

        if (!verifySlackSignature(req)) {
            log('WARN', 'Slack interaction rejected: bad signature', {
                hint: 'Signing secret mismatch, or a clock more than 5 minutes out.',
            });
            return res.status(403).json({ error: 'Invalid Slack signature' });
        }

        let payload;
        try {
            payload = JSON.parse(new URLSearchParams(req.rawBody).get('payload') || '');
        } catch {
            return res.status(400).json({ error: 'Malformed interaction payload' });
        }

        if (payload.type !== 'block_actions') return res.status(200).end();

        // The actor is whoever Slack says clicked. Never a value from the body:
        // action `value` carries the incident id, and nothing else is trusted.
        const actor = payload.user?.username || payload.user?.name || payload.user?.id;
        const action = payload.actions?.[0];
        if (!actor || !action) return res.status(200).end();

        const isAck = action.action_id === 'ack_incidents_bulk' ||
                      String(action.action_id).startsWith('ack_incident:');
        if (!isAck) return res.status(200).end();

        const ids = String(action.value || '').split(',').map((s) => s.trim()).filter(Boolean);

        const results = [];
        for (const id of ids) {
            const r = await acknowledgeIncident(pool, id, actor, { via: 'slack' });
            results.push({ id, ok: Boolean(r), already: r?.alreadyAcknowledged, by: r?.by });
        }

        const lines = results.map((r) =>
            !r.ok ? `:warning: \`${r.id}\` not found`
            : r.already ? `:information_source: \`${r.id}\` was already acknowledged by *${r.by}*`
            : `:white_check_mark: \`${r.id}\` acknowledged by *${actor}*`,
        );

        res.status(200).end();

        // Posted back into the same thread rather than replacing the original.
        // Overwriting would destroy the findings table, and the acknowledgement
        // is an event in the incident's life, not a correction to the alert.
        if (payload.response_url) {
            fetch(payload.response_url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    response_type: 'in_channel',
                    replace_original: false,
                    text: lines.join('\n'),
                }),
            }).catch((err) => log('WARN', 'Slack ack follow-up failed', { error: err.message }));
        }
    });

    return router;
}
