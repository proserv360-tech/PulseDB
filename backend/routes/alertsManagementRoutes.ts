// @ts-nocheck
import { Router } from 'express';
import crypto from 'crypto';

export default function alertsManagementRoutes(
    pool, authenticate, requireRole, requireScreen,
    alerts, emailService, sendSlackMessage, verifySlackSignature, resolveSlackUser,
    log, runAgentSweep, resolveConnection,
) {
    const router = Router();

    router.get('/alerts', authenticate, async (req, res) => {
        try {
            const limit = parseInt(req.query.limit, 10) || 50;
            const includeAcknowledged = req.query.includeAcknowledged === 'true';
            res.json(await alerts.getRecent(limit, includeAcknowledged));
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({});
        }
    });

    router.get('/alerts/statistics', authenticate, async (req, res) => {
        try {
            res.json(await alerts.getStatistics(req.query.timeRange || '24h'));
        } catch (e) { res.json({}); }
    });

    router.post('/alerts/:id/acknowledge', authenticate, async (req, res) => {
        try {
            const result = await alerts.acknowledge(req.params.id, req.user.id, req.user.username);
            if (!result) return res.status(404).json({ error: 'Alert not found' });
            res.json(result);
        } catch (e) {
            log('ERROR', 'Alert acknowledge error', { error: e.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    router.post('/alerts/bulk-acknowledge', authenticate, async (req, res) => {
        try {
            const { alertIds } = req.body;
            if (!Array.isArray(alertIds) || !alertIds.length) return res.status(400).json({ error: 'Invalid alert IDs' });
            const results = await alerts.bulkAcknowledge(alertIds, req.user.id, req.user.username);
            res.json({ acknowledged: results.length });
        } catch (e) {
            log('ERROR', 'Bulk acknowledge alerts error', { error: e.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    /**
     * Delete several alerts.
     *
     * POST rather than DELETE because the id list goes in the body, and DELETE
     * with a body is inconsistently supported across proxies and fetch
     * implementations. Mirrors /alerts/bulk-acknowledge.
     *
     * Reports `deleted` and `missing` separately: with several people triaging
     * the same list, part of a selection may already be gone, and that is not
     * an error worth failing the whole request over.
     */
    router.post('/alerts/bulk-delete', authenticate, async (req, res) => {
        try {
            const { alertIds } = req.body;
            if (!Array.isArray(alertIds) || !alertIds.length) {
                return res.status(400).json({ error: 'Invalid alert IDs' });
            }
            // Bound it so a malformed client cannot ask for an unbounded delete.
            if (alertIds.length > 500) {
                return res.status(400).json({ error: 'Too many alert IDs — 500 max per request' });
            }
            const deleted = await alerts.bulkRemove(alertIds, req.user.username);
            res.json({ deleted: deleted.length, missing: alertIds.length - deleted.length, ids: deleted });
        } catch (e) {
            log('ERROR', 'Bulk delete alerts error', { error: e.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    router.post('/alerts/manual', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
        try {
            const { severity, category, message, data } = req.body;
            if (!severity || !category || !message) return res.status(400).json({ error: 'Missing required fields' });
            const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
            const VALID_CATEGORIES = ['performance', 'security', 'availability', 'replication', 'storage', 'connection', 'query', 'system', 'custom'];
            if (!VALID_SEVERITIES.includes(String(severity).toLowerCase()))
                return res.status(400).json({ error: `severity must be one of: ${VALID_SEVERITIES.join(', ')}` });
            if (!VALID_CATEGORIES.includes(String(category).toLowerCase()))
                return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
            if (typeof message !== 'string' || message.trim().length === 0 || message.length > 500)
                return res.status(400).json({ error: 'message must be a non-empty string (max 500 chars)' });
            const alert = await alerts.fire(
                String(severity).toLowerCase(), String(category).toLowerCase(),
                message.trim(), { ...data, manual: true, createdBy: req.user.username },
            );
            res.json(alert);
        } catch (e) {
            log('ERROR', 'Manual alert creation error', { error: e.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    router.delete('/alerts/cleanup', authenticate, requireScreen('admin'), async (req, res) => {
        try {
            res.json({ deleted: await alerts.cleanup(parseInt(req.query.days, 10) || 30) });
        } catch (e) {
            log('ERROR', 'Alert cleanup error', { error: e.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    /**
     * Delete one alert.
     *
     * Same gate as acknowledge — any authenticated user. Alerts are derived
     * state that the monitoring loop regenerates, so this is closer to
     * dismissing a notification than to destroying a record. The bulk-by-age
     * `/alerts/cleanup` above stays admin-only because it can remove thousands
     * of rows in one call, including ones the caller never saw.
     *
     * ORDER MATTERS: this must stay below `/alerts/cleanup`. Express matches in
     * registration order and takes the first hit — it does not prefer a literal
     * segment over a parameter. Registered above, `:id` would swallow
     * `DELETE /alerts/cleanup`, treat "cleanup" as an alert id, return 404, and
     * make the admin endpoint unreachable while looking like it still exists.
     */
    router.delete('/alerts/:id', authenticate, async (req, res) => {
        try {
            const deleted = await alerts.remove(req.params.id, req.user.username);
            if (!deleted) return res.status(404).json({ error: 'Alert not found' });
            res.json({ deleted: true, id: req.params.id });
        } catch (e) {
            log('ERROR', 'Alert delete error', { error: e.message, alertId: req.params.id });
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Vercel Cron — protected by CRON_SECRET, fail-closed
    router.post('/alerts/run-monitoring', async (req, res) => {
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
            log('WARN', 'run-monitoring invoked but CRON_SECRET is not configured; refusing');
            return res.status(503).json({ error: 'Cron endpoint disabled: CRON_SECRET is not configured.' });
        }
        const header = req.headers['authorization'];
        const expected = `Bearer ${cronSecret}`;
        const headerBuf = Buffer.from(typeof header === 'string' ? header : '');
        const expectedBuf = Buffer.from(expected);
        const ok = headerBuf.length === expectedBuf.length && crypto.timingSafeEqual(headerBuf, expectedBuf);
        if (!ok) return res.status(401).json({ error: 'Unauthorized' });
        try {
            await alerts.runMonitoring();
            let agent = null;
            try { agent = await runAgentSweep({ pool }); } catch (e) { log('WARN', 'agent sweep failed', { error: e.message }); }
            try {
                const { runDueBackups } = await import('../services/backupExecutor.js');
                const { listSchedules } = await import('../services/backupService.js');
                const schedules = await listSchedules({ workspaceId: 'default' });
                await runDueBackups({ schedules, resolveConn: (cid) => resolveConnection(cid, null) });
            } catch (e) { log('WARN', 'backup sweep failed', { error: e.message }); }
            res.json({ success: true, timestamp: new Date().toISOString(), message: 'Monitoring cycle completed', agent });
        } catch (e) {
            log('ERROR', 'Alert monitoring cycle failed', { error: e.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Email
    router.post('/alerts/email/test', authenticate, requireScreen('admin'), async (req, res) => {
        try {
            const { recipient } = req.body;
            if (!recipient) return res.status(400).json({ error: 'Recipient email required' });
            res.json(await emailService.sendTestEmail(recipient));
        } catch (e) {
            log('ERROR', 'Email test error', { error: e.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    router.get('/alerts/email/config', authenticate, requireScreen('admin'), (req, res) => {
        res.json({
            enabled: emailService.enabled,
            provider: emailService.provider,
            recipients: emailService.recipients,
            minSeverity: emailService.minSeverity,
            from: emailService.from,
        });
    });

    router.post('/alerts/email/digest', authenticate, requireScreen('admin'), async (req, res) => {
        try {
            const { recipients } = req.body;
            const recentAlerts = await alerts.getRecent(50, false);
            res.json(await emailService.sendDigest(recentAlerts, recipients));
        } catch (e) {
            log('ERROR', 'Email digest error', { error: e.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Slack
    router.post('/alerts/slack/test', authenticate, requireScreen('admin'), async (req, res) => {
        try {
            const webhookUrl = process.env.SLACK_WEBHOOK_URL;
            if (!webhookUrl) return res.status(400).json({ error: 'SLACK_WEBHOOK_URL is not configured.' });
            await sendSlackMessage(':white_check_mark: *Fathom Slack integration is working!* This is a test message from your Fathom monitoring platform.', webhookUrl);
            res.json({ success: true, message: 'Test message sent to Slack.' });
        } catch (e) {
            log('ERROR', 'Slack test error', { error: e.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    router.get('/alerts/slack/config', authenticate, requireScreen('admin'), (req, res) => {
        res.json({
            enabled: !!(process.env.SLACK_BOT_TOKEN || process.env.SLACK_WEBHOOK_URL),
            mode: process.env.SLACK_BOT_TOKEN ? 'bot_api' : 'webhook',
            channelId: process.env.SLACK_CHANNEL_ID || 'not set',
            channel: process.env.SLACK_ALERT_CHANNEL || process.env.SLACK_CHANNEL_ID || 'not set',
            botTokenConfigured: !!process.env.SLACK_BOT_TOKEN,
            signingSecretConfigured: !!process.env.SLACK_SIGNING_SECRET,
            webhookConfigured: !!process.env.SLACK_WEBHOOK_URL,
        });
    });

    // Slack Slash Commands (/ack, /escalate)
    router.post('/slack/commands', (req, res, next) => {
        // express.raw() is mounted on this path in server.ts, so req.body is a
        // Buffer of Slack's exact bytes — but nothing turned it into the string
        // verifySlackSignature() reads. Without this, rawBody was undefined and
        // the verifier fell back to JSON.stringify(req.body), which never
        // matches the signature: /ack returned 403 unconditionally.
        //
        // On Vercel, api/index.js has already set rawBody; don't clobber it.
        if (typeof req.rawBody !== 'string' || req.rawBody.length === 0) {
            req.rawBody = Buffer.isBuffer(req.body)
                ? req.body.toString('utf8')
                : typeof req.body === 'string'
                  ? req.body
                  : '';
        }
        if (!verifySlackSignature(req)) return res.status(403).json({ error: 'Invalid Slack signature' });
        const params = new URLSearchParams(req.rawBody || '');
        const command = params.get('command');
        const alertId = (params.get('text') || '').trim();
        const username = params.get('user_name') || 'unknown';
        if (command === '/ack') {
            if (!alertId) return res.json({ text: 'Usage: /ack <incident-id | alert-id>' });

            // Incident IDs are what the alert message now shows, so they are
            // what people will type. Alert UUIDs still work for anything that
            // predates incidents.
            if (/^INC-\d{8}-\d+$/i.test(alertId)) {
                const incidentId = alertId.toUpperCase();
                res.json({ text: `Acknowledging \`${incidentId}\`…` });
                (async () => {
                    const { acknowledgeIncident } = await import('../services/incidentService.js');
                    const result = await acknowledgeIncident(pool, incidentId, username, { via: 'slack' });
                    const summary = !result
                        ? `:warning: \`${incidentId}\` not found.`
                        : result.alreadyAcknowledged
                          ? `:information_source: \`${incidentId}\` was already acknowledged by *${result.by}*.`
                          : `:white_check_mark: \`${incidentId}\` acknowledged by *${username}*.`;
                    const responseUrl = params.get('response_url');
                    if (responseUrl) {
                        await fetch(responseUrl, {
                            method: 'POST',
                            headers: { 'content-type': 'application/json' },
                            body: JSON.stringify({ response_type: 'in_channel', text: summary }),
                        }).catch(() => {});
                    }
                })().catch(err => log('ERROR', 'Slack /ack (incident) failed', { error: err.message, incidentId: alertId }));
                return;
            }

            res.json({ text: `Processing acknowledgement for alert \`${alertId}\`…` });
            alerts.acknowledge(alertId, null, username).catch(err =>
                log('ERROR', 'Slack /ack failed', { error: err.message, alertId }),
            );
            return;
        }
        if (command === '/escalate') {
            if (!alertId) return res.json({ text: 'Usage: /escalate <alert-id>' });
            res.json({ text: `:rotating_light: Escalating alert \`${alertId}\` to on-call…` });
            const responseUrl = params.get('response_url');
            (async () => {
                let summary;
                try {
                    const result = await alerts.escalate(alertId, username);
                    if (result?.reason === 'alert_not_found') summary = `:warning: Alert \`${alertId}\` not found.`;
                    else if (result?.reason === 'no_destinations') summary = `:warning: No on-call destinations configured.`;
                    else if (result?.reason === 'no_org') summary = `:warning: Alert \`${alertId}\` has no org — cannot route.`;
                    else if (result?.ok) summary = `:rotating_light: Alert \`${alertId}\` escalated — paged ${result.paged} destination${result.paged === 1 ? '' : 's'}.`;
                    else summary = `:x: Escalation failed: ${result?.error || 'no destination accepted'}`;
                } catch (err) {
                    summary = `:x: Escalation errored: ${err.message}`;
                    log('ERROR', 'Slack /escalate failed', { error: err.message, alertId });
                }
                if (responseUrl) {
                    try {
                        await fetch(responseUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ response_type: 'in_channel', text: summary }) });
                    } catch (err) { log('WARN', 'Slack /escalate: failed to post follow-up', { error: err.message }); }
                }
            })();
            return;
        }
        res.status(400).json({ text: 'Unknown command.' });
    });

    // Slack Events
    router.post('/slack/events', (req, res) => {
        // Same as /slack/commands: prefer a rawBody captured upstream, and only
        // fall back to stringifying the Buffer. `req.body?.toString?.()` on a
        // parsed object yields '[object Object]', which signs to garbage.
        if (typeof req.rawBody !== 'string' || req.rawBody.length === 0) {
            req.rawBody = Buffer.isBuffer(req.body)
                ? req.body.toString('utf8')
                : typeof req.body === 'string'
                  ? req.body
                  : '';
        }
        let body;
        try { body = JSON.parse(req.rawBody); } catch { return res.status(400).end(); }
        if (body.type === 'url_verification') return res.json({ challenge: body.challenge });
        if (!verifySlackSignature(req)) return res.status(403).end();
        res.status(200).end();
        const event = body.event;
        if (event?.type === 'message' && event.thread_ts && !event.bot_id && event.text) {
            (async () => {
                try {
                    const alertResult = await pool.query(`SELECT * FROM pgmonitoringtool.alerts WHERE slack_ts = $1 LIMIT 1`, [event.thread_ts]);
                    if (alertResult.rows.length > 0) {
                        const alert = alertResult.rows[0];
                        const authorName = await resolveSlackUser(event.user);
                        await pool.query(
                            `UPDATE pgmonitoringtool.alerts SET data = jsonb_set(COALESCE(data,'{}'),'{slack_comments}',COALESCE(data->'slack_comments','[]') || $1::jsonb) WHERE id = $2`,
                            [JSON.stringify([{ author: authorName, text: event.text, timestamp: Date.now() }]), alert.id],
                        );
                    }
                } catch (err) { log('ERROR', 'Failed to sync Slack thread reply', { error: err.message }); }
            })();
        }
    });

    return router;
}
