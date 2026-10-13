// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Recent alerts (WebSocket polling fallback) and alert rule CRUD.
// Extracted from server.ts.

import { pool } from '../../core/adminPool.js';
import { alerts } from '../../core/alerting.js';
import { authenticate } from '../../core/auth.js';
import { log } from '../../services/logger.js';

export default function registerAlertRoutes(app) {
    // ─────────────────────────────────────────────────────────────────────────────
    // ALERTS RECENT (HTTP polling fallback for WebSocket)
    // ─────────────────────────────────────────────────────────────────────────────

    app.get('/api/alerts/recent', authenticate, async (req, res) => {
        try {
            const limit = Math.min(parseInt(req.query.limit || '10', 10), 100);
            const recent = await alerts.getRecent(limit, false);
            res.json({ alerts: recent, count: recent.length, timestamp: new Date().toISOString() });
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({ alerts: [], count: 0, timestamp: new Date().toISOString() });
        }
    });

    // ═══════════════════════════════════════════════════════════════════════════════
    // PHASE 1–4 ENDPOINTS — Alert Rules, Pool Metrics, Schema, Observability,
    //                        OpenTelemetry, Retention
    // ═══════════════════════════════════════════════════════════════════════════════

    /* ── Alert Rules CRUD ─────────────────────────────────────────────────────────
     * Rules live in pgmonitoringtool.alert_rules (migration 0026). They previously
     * shared the `alerts` table behind an `alert_type = 'rule'` discriminator,
     * because alert_rules had never been created — which meant rules and runtime
     * alert events competed for one table with two incompatible shapes.
     *
     * The API still speaks `channels: string[]` to the frontend; the table stores
     * notify_email / notify_slack booleans, so the two are mapped at the boundary.
     * ────────────────────────────────────────────────────────────────────────── */

    const ruleChannels = (row) => {
        const out: string[] = [];
        if (row.notify_email) out.push('email');
        if (row.notify_slack) out.push('slack');
        return out;
    };
    const hasChannel = (channels, name) => Array.isArray(channels) && channels.includes(name);

    app.get('/api/alerts/rules', authenticate, async (req, res) => {
        try {
            const { rows } = await pool.query(`
            SELECT id, name, description, metric, condition, threshold, severity,
                   enabled, cooldown_minutes, notify_email, notify_slack,
                   connection_id, created_at, updated_at
            FROM pgmonitoringtool.alert_rules
            ORDER BY created_at DESC
        `);
            res.json(rows.map((r) => ({ ...r, channels: ruleChannels(r) })));
        } catch (e) {
            // Previously this swallowed the error and returned [], so a missing
            // table was indistinguishable from "no rules configured".
            log('ERROR', `[/api/alerts/rules GET] ${e.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.post('/api/alerts/rules', authenticate, async (req, res) => {
        try {
            const { name, description, metric, condition, threshold, severity, enabled, channels } = req.body;
            if (!name || !metric || !condition || threshold === undefined || threshold === null) {
                return res.status(400).json({ error: 'name, metric, condition and threshold are required' });
            }
            const { rows } = await pool.query(
                `
            INSERT INTO pgmonitoringtool.alert_rules
                (name, description, metric, condition, threshold, severity,
                 enabled, notify_email, notify_slack, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        `,
                [
                    name,
                    description || '',
                    metric,
                    condition,
                    Number(threshold),
                    severity || 'warning',
                    enabled !== false,
                    hasChannel(channels, 'email'),
                    hasChannel(channels, 'slack'),
                    req.user?.id ?? null,
                ],
            );
            res.json({ success: true, id: rows[0].id });
        } catch (e) {
            log('ERROR', `[/api/alerts/rules POST] ${e.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.post('/api/alerts/rules/:id', authenticate, async (req, res) => {
        try {
            const { name, description, metric, condition, threshold, severity, enabled, channels } = req.body;
            const { rowCount } = await pool.query(
                `
            UPDATE pgmonitoringtool.alert_rules
            SET name         = COALESCE($1, name),
                description  = COALESCE($2, description),
                metric       = COALESCE($3, metric),
                condition    = COALESCE($4, condition),
                threshold    = COALESCE($5, threshold),
                severity     = COALESCE($6, severity),
                enabled      = COALESCE($7, enabled),
                notify_email = $8,
                notify_slack = $9,
                updated_at   = now()
            WHERE id = $10
        `,
                [
                    name ?? null,
                    description ?? null,
                    metric ?? null,
                    condition ?? null,
                    threshold === undefined || threshold === null ? null : Number(threshold),
                    severity ?? null,
                    enabled ?? null,
                    hasChannel(channels, 'email'),
                    hasChannel(channels, 'slack'),
                    req.params.id,
                ],
            );
            if (rowCount === 0) return res.status(404).json({ error: 'Rule not found' });
            res.json({ success: true });
        } catch (e) {
            log('ERROR', `[/api/alerts/rules/:id POST] ${e.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.delete('/api/alerts/rules/:id', authenticate, async (req, res) => {
        try {
            // Scoped to alert_rules. The previous version deleted from `alerts` by
            // id with no alert_type guard, so a rule id colliding with an event id
            // would have deleted the event instead.
            const { rowCount } = await pool.query(`DELETE FROM pgmonitoringtool.alert_rules WHERE id = $1`, [
                req.params.id,
            ]);
            if (rowCount === 0) return res.status(404).json({ error: 'Rule not found' });
            res.json({ success: true });
        } catch (e) {
            log('ERROR', `[/api/alerts/rules/:id DELETE] ${e.message}`);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
}
