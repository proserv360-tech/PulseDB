// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/auditRoutes.js
 * ─────────────────────
 * Audit log read + export endpoints.
 *
 * Mount with:
 *   app.use('/api', auditRoutes(pool, authenticate, requireScreen));
 *
 * Endpoints:
 *   GET /api/audit              — paginated audit log (UI)
 *   GET /api/audit/export       — streaming export (SIEM pull)
 */

import { Router } from 'express';
import {
    listAuditEvents,
    streamAuditEvents,
    rowToCsv,
    csvHeader,
} from '../services/auditService.js';

function log(level, message, meta = {}) {
    const fn = level === 'ERROR' ? console.error : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg: message, ...meta }));
}

function parseIsoDate(s, label) {
    if (!s) return undefined;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) {
        const err = new Error(`${label} is not a valid ISO timestamp`);
        err.status = 400;
        throw err;
    }
    return d;
}

export default function auditRoutes(pool, authenticate, requireScreen) {
    const router  = Router();
    const isAdmin = [authenticate, requireScreen('admin')];

    /* ── GET /api/audit ────────────────────────────────────────────────────
       Paginated, filterable audit log.
       Query params: level, action, username, limit, offset               */
    router.get('/audit', ...isAdmin, async (req, res) => {
        try {
            const result = await listAuditEvents(pool, {
                level:    req.query.level,
                action:   req.query.action,
                username: req.query.username,
                limit:    req.query.limit,
                offset:   req.query.offset,
            });
            res.json(result);
        } catch (err) {
            log('ERROR', 'Failed to fetch audit log', { error: err.message });
            res.status(500).json({ error: err.message });
        }
    });

    /* ── GET /api/audit/export ─────────────────────────────────────────────
       Streaming export for SIEM / compliance pulls. Supports JSON
       (newline-delimited) and CSV. Bounded by `maxRows` to protect the DB.

       Query params:
         from=ISO8601    (inclusive, required for non-trivial exports)
         to=ISO8601      (exclusive; default = now)
         format=json|csv (default: json)
         level           filter
         action          ILIKE filter
         username        ILIKE filter
         maxRows         safety cap (default 100_000, max 500_000)

       Admin-only. Streams directly to the socket so memory stays bounded
       regardless of row count.                                         */
    router.get('/audit/export', ...isAdmin, async (req, res) => {
        const startedAt = Date.now();
        let rowCount = 0;
        try {
            const format = (req.query.format || 'json').toLowerCase();
            if (!['json', 'csv'].includes(format)) {
                return res.status(400).json({ error: 'format must be json or csv' });
            }
            const from = parseIsoDate(req.query.from, 'from');
            const to   = parseIsoDate(req.query.to,   'to');
            if (from && to && from >= to) {
                return res.status(400).json({ error: 'from must be earlier than to' });
            }

            const maxRowsRaw = Number(req.query.maxRows);
            const maxRows = Math.min(
                Math.max(Number.isFinite(maxRowsRaw) ? maxRowsRaw : 100_000, 1),
                500_000
            );

            const opts = {
                from,
                to,
                level:    req.query.level    || undefined,
                action:   req.query.action   || undefined,
                username: req.query.username || undefined,
                pageSize: 1000,
                maxRows,
            };

            // Build a filename that encodes the range for easy archival.
            const safeFrom = (from ? from.toISOString() : 'all').replace(/[:.]/g, '-');
            const safeTo   = (to   ? to.toISOString()   : 'now').replace(/[:.]/g, '-');
            const filename = `pulsedb-audit-${safeFrom}_${safeTo}.${format}`;

            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Cache-Control', 'no-store');

            // ── JSON (newline-delimited) ─────────────────────────────────
            if (format === 'json') {
                res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
                for await (const row of streamAuditEvents(pool, opts)) {
                    res.write(JSON.stringify(row) + '\n');
                    rowCount += 1;
                }
                res.end();
                log('INFO', 'audit export ndjson complete', {
                    rows: rowCount, ms: Date.now() - startedAt, actor: req.user?.username,
                });
                return;
            }

            // ── CSV ──────────────────────────────────────────────────────
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.write(csvHeader() + '\n');
            for await (const row of streamAuditEvents(pool, opts)) {
                res.write(rowToCsv(row) + '\n');
                rowCount += 1;
            }
            res.end();
            log('INFO', 'audit export csv complete', {
                rows: rowCount, ms: Date.now() - startedAt, actor: req.user?.username,
            });
        } catch (err) {
            // If we've already started streaming we can't send a clean JSON
            // error body, so the cleanest signal is to kill the connection.
            // The client will see a partial body and retry.
            if (res.headersSent) {
                log('ERROR', 'audit export aborted mid-stream', {
                    error: err.message, rows: rowCount,
                });
                try { res.end(); } catch { /* ignore */ }
                return;
            }
            const status = err.status || 500;
            log('ERROR', 'audit export failed', { error: err.message, status });
            res.status(status).json({ error: err.message });
        }
    });

    return router;
}
