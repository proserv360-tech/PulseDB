// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/alertDslRoutes.js
 * ────────────────────────
 * CRUD for expression-based alert rules + validation + dry-run evaluation.
 *
 * Mount with:
 *   app.use(prefix, alertDslRoutes(pool, authenticate, metricsProviderFactory));
 *
 * `metricsProviderFactory(connectionId)` should return a metrics provider
 * object shaped as:
 *     { current(name) -> number, series(name, windowSec) -> Array<{t,v}> }
 *
 * Pass your existing metrics registry here; a null-provider is used for the
 * validate-only and parse endpoints.
 */

import { Router } from 'express';
import { parse, evaluate, validate } from '../services/alertDsl.js';
import { notifySlack, notifyPagerDuty } from '../services/alertNotifiers.js';
import { query } from '../db.js';
import { writeAudit } from '../services/auditService.js';
import { resolveWorkspace, requireWorkspaceRole } from '../middleware/workspaceRbac.js';
import { swallowWith } from '../services/errorHandling.js';

export default function alertDslRoutes(pool, authenticate, metricsProviderFactory) {
    const router = Router();

    // ── Validate an expression without saving ────────────────────────────────
    router.post('/alerts/dsl/validate', authenticate, (req, res) => {
        const { expression } = req.body || {};
        if (!expression) return res.status(400).json({ error: 'expression required' });
        const v = validate(expression);
        res.status(v.ok ? 200 : 400).json(v);
    });

    // ── Parse an expression (returns AST for UI) ─────────────────────────────
    router.post('/alerts/dsl/parse', authenticate, (req, res) => {
        try {
            const ast = parse(req.body.expression);
            res.json({ ast });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // ── Dry-run evaluate against a connection's current metrics ──────────────
    router.post(
        '/alerts/dsl/evaluate',
        authenticate,
        resolveWorkspace,
        async (req, res) => {
            try {
                const { expression, connectionId } = req.body || {};
                const ast = parse(expression);
                const mp = metricsProviderFactory
                    ? metricsProviderFactory(connectionId)
                    : { current: () => 0, series: () => [] };
                const value = evaluate(ast, mp);
                res.json({ value, type: typeof value });
            } catch (err) {
                res.status(400).json({ error: err.message });
            }
        }
    );

    // ── Create / update rules ────────────────────────────────────────────────
    router.post(
        '/alerts/dsl/rules',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                const {
                    id, name, expression, severity = 'warning',
                    connectionId, cooldownMinutes = 15,
                    slackWebhook = null, pagerdutyKey = null, runbookUrl = null,
                    enabled = true,
                } = req.body || {};

                const v = validate(expression || '');
                if (!v.ok) return res.status(400).json(v);

                if (id) {
                    await query(
                        `UPDATE pgmonitoringtool.alert_rules
                            SET name = $2, expression = $3, severity = $4,
                                connection_id = $5, cooldown_minutes = $6,
                                slack_webhook = $7, pagerduty_key = $8,
                                runbook_url = $9, enabled = $10,
                                updated_at = now()
                          WHERE id = $1`,
                        [id, name, expression, severity, connectionId, cooldownMinutes,
                         slackWebhook, pagerdutyKey, runbookUrl, enabled]
                    );
                    await writeAudit({
                        actor_id: req.user?.id,
                        action: 'alert_rule.update',
                        target: `rule:${id}`,
                    }).catch(swallowWith({ component: 'alertDsl', op: 'writeAudit' }));
                    return res.json({ id });
                }

                // Legacy columns must stay NOT NULL — fill with sentinels when
                // using the expression-based path.
                const ins = await query(
                    `INSERT INTO pgmonitoringtool.alert_rules
                        (name, metric, condition, threshold, severity,
                         connection_id, cooldown_minutes, expression,
                         slack_webhook, pagerduty_key, runbook_url,
                         workspace_id, created_by, enabled)
                     VALUES ($1, 'expression', '==', 0, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                     RETURNING id`,
                    [name, severity, connectionId, cooldownMinutes, expression,
                     slackWebhook, pagerdutyKey, runbookUrl,
                     req.workspace?.id, req.user?.id, enabled]
                );
                await writeAudit({
                    actor_id: req.user?.id,
                    action: 'alert_rule.create',
                    target: `rule:${ins.rows[0].id}`,
                }).catch(swallowWith({ component: 'alertDsl', op: 'writeAudit' }));
                res.json({ id: ins.rows[0].id });
            } catch (err) { next(err); }
        }
    );

    router.get(
        '/alerts/dsl/rules',
        authenticate,
        resolveWorkspace,
        async (req, res, next) => {
            try {
                const { rows } = await query(
                    `SELECT id, name, expression, severity, connection_id,
                            cooldown_minutes, slack_webhook, pagerduty_key,
                            runbook_url, enabled, updated_at
                       FROM pgmonitoringtool.alert_rules
                      WHERE expression IS NOT NULL
                        AND ($1::int IS NULL OR workspace_id = $1)
                      ORDER BY updated_at DESC
                      LIMIT 500`,
                    [req.workspace?.id || null]
                );
                res.json({ rules: rows });
            } catch (err) { next(err); }
        }
    );

    router.delete(
        '/alerts/dsl/rules/:id',
        authenticate,
        resolveWorkspace,
        requireWorkspaceRole('editor'),
        async (req, res, next) => {
            try {
                await query(`DELETE FROM pgmonitoringtool.alert_rules WHERE id = $1`,
                    [Number(req.params.id)]);
                await writeAudit({
                    actor_id: req.user?.id,
                    action: 'alert_rule.delete',
                    target: `rule:${req.params.id}`,
                }).catch(swallowWith({ component: 'alertDsl', op: 'writeAudit' }));
                res.json({ ok: true });
            } catch (err) { next(err); }
        }
    );

    // ── Test notification endpoint ───────────────────────────────────────────
    router.post(
        '/alerts/dsl/test-notify',
        authenticate,
        requireWorkspaceRole('admin'),
        async (req, res) => {
            const sample = {
                ruleId: 0,
                ruleName: 'Test alert',
                severity: 'warning',
                message: 'Hello from PulseDB alerting.',
                expression: 'cpu_pct > 90',
                value: 93.1,
                connectionId: req.body?.connectionId,
                workspaceId: req.workspace?.id,
                runbookUrl: req.body?.runbookUrl,
                dashboardUrl: req.body?.dashboardUrl,
            };
            const slack = req.body?.slackWebhook ? await notifySlack(req.body.slackWebhook, sample) : { skipped: true };
            const pd = req.body?.pagerdutyKey ? await notifyPagerDuty(req.body.pagerdutyKey, sample) : { skipped: true };
            res.json({ slack, pagerduty: pd });
        }
    );

    return router;
}
