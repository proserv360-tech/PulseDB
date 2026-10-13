// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/syntheticRoutes.js
 *
 * CRUD over synthetic_checks + results endpoint. A single on-demand
 * `POST /api/synthetic/checks/:id/run` path lets Vercel Cron (or any
 * external poller) trigger a run without owning the scheduler.
 */

import { Router } from 'express';
import SyntheticMonitor from '../services/syntheticMonitor.js';

export default function syntheticRoutes(pool, authenticate) {
    const router = Router();
    const monitor = new SyntheticMonitor(pool);

    // List
    router.get('/api/synthetic/checks', authenticate, async (_req, res) => {
        const { rows } = await pool.query(
            `SELECT id, name, kind, target, method, expected_status, timeout_ms,
                    interval_sec, enabled, created_at
               FROM pgmonitoringtool.synthetic_checks
              ORDER BY id`,
        );
        res.json({ checks: rows });
    });

    // Create
    router.post('/api/synthetic/checks', authenticate, async (req, res) => {
        const b = req.body || {};
        if (!b.name || !b.target) {
            return res.status(400).json({ error: 'name and target are required' });
        }
        const { rows } = await pool.query(
            `INSERT INTO pgmonitoringtool.synthetic_checks
                 (name, kind, target, method, headers, body, expected_status, timeout_ms, interval_sec, enabled)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING id`,
            [
                b.name, b.kind || 'http', b.target, b.method || 'GET',
                JSON.stringify(b.headers || {}), b.body || null,
                Number(b.expected_status) || 200,
                Number(b.timeout_ms)      || 10_000,
                Number(b.interval_sec)    || 60,
                b.enabled !== false,
            ],
        );
        res.status(201).json({ id: rows[0].id });
    });

    // Update
    router.patch('/api/synthetic/checks/:id', authenticate, async (req, res) => {
        const id = Number(req.params.id);
        const b = req.body || {};
        const fields = [], params = [];
        const add = (col, val) => { params.push(val); fields.push(`${col} = $${params.length}`); };
        if (b.name           !== undefined) add('name',            b.name);
        if (b.target         !== undefined) add('target',          b.target);
        if (b.method         !== undefined) add('method',          b.method);
        if (b.headers        !== undefined) add('headers',         JSON.stringify(b.headers));
        if (b.body           !== undefined) add('body',            b.body);
        if (b.expected_status!== undefined) add('expected_status', Number(b.expected_status));
        if (b.timeout_ms     !== undefined) add('timeout_ms',      Number(b.timeout_ms));
        if (b.interval_sec   !== undefined) add('interval_sec',    Number(b.interval_sec));
        if (b.enabled        !== undefined) add('enabled',         !!b.enabled);
        if (!fields.length) return res.status(400).json({ error: 'no fields to update' });
        params.push(id);
        await pool.query(
            `UPDATE pgmonitoringtool.synthetic_checks SET ${fields.join(', ')}, updated_at = now()
              WHERE id = $${params.length}`,
            params,
        );
        res.json({ ok: true });
    });

    // Delete
    router.delete('/api/synthetic/checks/:id', authenticate, async (req, res) => {
        await pool.query('DELETE FROM pgmonitoringtool.synthetic_checks WHERE id = $1',
                         [Number(req.params.id)]);
        res.status(204).end();
    });

    // On-demand run (also the Vercel-Cron entry point)
    router.post('/api/synthetic/checks/:id/run', authenticate, async (req, res) => {
        const result = await monitor.runCheckById(Number(req.params.id));
        if (!result) return res.status(404).json({ error: 'check not found' });
        res.json(result);
    });

    // Recent results
    router.get('/api/synthetic/checks/:id/results', authenticate, async (req, res) => {
        const id = Number(req.params.id);
        const limit = Math.min(parseInt(req.query.limit || '100', 10), 1000);
        const { rows } = await pool.query(
            `SELECT ts, ok, status_code, latency_ms, error
               FROM pgmonitoringtool.synthetic_results
              WHERE check_id = $1
              ORDER BY ts DESC
              LIMIT $2`,
            [id, limit],
        );
        res.json({ results: rows });
    });

    return router;
}
