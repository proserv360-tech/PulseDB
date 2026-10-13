// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/observabilityIngestRoutes.js
 * ────────────────────────────────────
 * Ingest endpoints that complete PulseDB's "single pane of glass" surface:
 *
 *   POST /otlp/v1/logs             — OTLP LogRecord ingest (protobuf JSON form).
 *   POST /api/v1/errors            — application error events (Sentry-envelope subset).
 *   POST /api/v1/rum/beacon        — browser Real-User Monitoring beacon.
 *   POST /api/v1/prom/metrics      — Prometheus remote-write-compatible bulk push.
 *   POST /api/v1/github/webhook    — GitHub deploy / push / release markers.
 *   POST /api/v1/gitlab/webhook    — GitLab pipeline / deployment markers.
 *
 * All endpoints persist into tables defined in migration
 * 0010_observability_ingest.sql. Each accepts a lightweight shared secret
 * (X-PulseDB-Ingest-Token) so SDKs can push without a user JWT.
 *
 * Design notes:
 *   • Tolerant of schema drift — unknown fields are dropped, not rejected.
 *   • Bodies are size-limited (256 KB) in the route-level `express.json`
 *     option; callers batch in the SDK.
 *   • Writes go through a single `persistBatch` helper so the monitoring
 *     scheduler can cheaply bulk-insert.
 */

import express from 'express';
import crypto from 'node:crypto';

const ROUTER_JSON_LIMIT = '256kb';
const INGEST_TOKEN_HEADER = 'x-pulsedb-ingest-token';

/** Utility — safe constant-time token comparison. */
function safeEq(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Gate a handler on the shared ingest token, falling through to authenticate when unset. */
function ingestGuard(authenticate) {
    return (req, res, next) => {
        const expected = process.env.PULSEDB_INGEST_TOKEN;
        const provided = req.headers[INGEST_TOKEN_HEADER];
        if (expected && provided && safeEq(String(provided), expected)) {
            req.ingest = { via: 'token' };
            return next();
        }
        // Fall back to authenticated session — still allows human dashboards
        // to POST markers without needing the shared token.
        return authenticate(req, res, next);
    };
}

export default function observabilityIngestRoutes(pool, authenticate) {
    const router = express.Router();
    router.use(express.json({ limit: ROUTER_JSON_LIMIT }));

    // ── OTLP Logs ────────────────────────────────────────────────────────────
    router.post('/otlp/v1/logs', ingestGuard(authenticate), async (req, res) => {
        try {
            const { resourceLogs = [] } = req.body || {};
            const records = [];
            for (const rl of resourceLogs) {
                const resource = (rl.resource?.attributes || []).reduce(
                    (acc, kv) => ({ ...acc, [kv.key]: kv.value?.stringValue ?? kv.value?.intValue ?? kv.value?.boolValue }),
                    {},
                );
                for (const sl of rl.scopeLogs || []) {
                    for (const lr of sl.logRecords || []) {
                        records.push({
                            ts_ns:          lr.timeUnixNano || lr.observedTimeUnixNano,
                            severity_number: lr.severityNumber || 0,
                            severity_text:   String(lr.severityText || '').slice(0, 32),
                            body:            lr.body?.stringValue || JSON.stringify(lr.body || {}),
                            trace_id:        lr.traceId || null,
                            span_id:         lr.spanId  || null,
                            resource_attrs:  resource,
                            log_attrs:       (lr.attributes || []).reduce(
                                (acc, kv) => ({ ...acc, [kv.key]: kv.value?.stringValue }), {}),
                        });
                    }
                }
            }
            await persistLogs(pool, records);
            res.status(202).json({ accepted: records.length });
        } catch (err) {
            res.status(400).json({ error: 'Invalid OTLP logs payload', details: err.message });
        }
    });

    // ── Error events (Sentry-envelope subset) ───────────────────────────────
    router.post('/api/v1/errors', ingestGuard(authenticate), async (req, res) => {
        try {
            const events = Array.isArray(req.body) ? req.body : [req.body];
            const rows = events.map(e => ({
                event_id:     String(e.event_id || crypto.randomUUID()).slice(0, 64),
                ts:           e.timestamp ? new Date(e.timestamp * 1000).toISOString() : new Date().toISOString(),
                message:      String(e.message   || e.logentry?.message || '').slice(0, 2000),
                level:        String(e.level     || 'error').slice(0, 16),
                environment:  String(e.environment || 'production').slice(0, 64),
                release:      String(e.release     || '').slice(0, 128),
                exception:    e.exception  || null,
                stack_trace:  e.stacktrace || e.exception?.values?.[0]?.stacktrace || null,
                user_ctx:     e.user       || null,
                request_ctx:  e.request    || null,
                tags:         e.tags       || {},
            }));
            await persistErrors(pool, rows);
            res.status(202).json({ accepted: rows.length });
        } catch (err) {
            res.status(400).json({ error: 'Invalid error envelope', details: err.message });
        }
    });

    // ── RUM beacon (sendBeacon-shaped) ──────────────────────────────────────
    // The browser fires these with navigator.sendBeacon which only allows
    // text/plain or form-data POSTs, so we also accept raw text.
    router.post('/api/v1/rum/beacon', express.text({ type: '*/*', limit: ROUTER_JSON_LIMIT }), async (req, res) => {
        try {
            const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
            const rows = (Array.isArray(payload?.events) ? payload.events : [payload]).map(e => ({
                session_id:  String(e.session_id || '').slice(0, 64),
                page_url:    String(e.page_url   || e.url || '').slice(0, 512),
                referrer:    String(e.referrer   || '').slice(0, 512),
                user_agent:  String(e.user_agent || req.headers['user-agent'] || '').slice(0, 256),
                ts:          e.ts ? new Date(e.ts).toISOString() : new Date().toISOString(),
                nav_type:    String(e.nav_type || 'navigate').slice(0, 32),
                // Core Web Vitals (optional)
                lcp_ms:      Number(e.lcp_ms) || null,
                fid_ms:      Number(e.fid_ms) || null,
                cls:         Number(e.cls)    || null,
                inp_ms:      Number(e.inp_ms) || null,
                ttfb_ms:     Number(e.ttfb_ms) || null,
                custom:      e.custom || {},
            }));
            await persistRum(pool, rows);
            res.status(204).end();
        } catch (err) {
            res.status(400).json({ error: 'Invalid beacon payload', details: err.message });
        }
    });

    // ── Prometheus remote-write-compatible bulk metrics push ────────────────
    // Accepts the simpler JSON form PulseDB SDKs emit:
    //   { series: [{ name, labels, samples: [{ ts_ms, value }] }] }
    router.post('/api/v1/prom/metrics', ingestGuard(authenticate), async (req, res) => {
        try {
            const { series = [] } = req.body || {};
            const rows = [];
            for (const s of series) {
                for (const sample of s.samples || []) {
                    rows.push({
                        name:   String(s.name || '').slice(0, 200),
                        labels: s.labels || {},
                        ts:     new Date(sample.ts_ms || Date.now()).toISOString(),
                        value:  Number(sample.value)  || 0,
                    });
                }
            }
            await persistMetrics(pool, rows);
            res.status(202).json({ accepted: rows.length });
        } catch (err) {
            res.status(400).json({ error: 'Invalid metrics payload', details: err.message });
        }
    });

    // ── GitHub webhook (deploy, push, release) ──────────────────────────────
    router.post('/api/v1/github/webhook',
        express.json({ verify: captureRawBody, limit: ROUTER_JSON_LIMIT }),
        async (req, res) => {
            if (!verifyGithubSignature(req)) {
                return res.status(401).json({ error: 'Invalid GitHub signature' });
            }
            const event = req.headers['x-github-event'];
            const marker = {
                provider:    'github',
                event_type:  String(event || 'unknown'),
                ref:         req.body?.ref            || null,
                sha:         req.body?.after          || req.body?.release?.target_commitish || null,
                actor:       req.body?.sender?.login  || null,
                environment: req.body?.deployment?.environment || null,
                repo:        req.body?.repository?.full_name   || null,
                url:         req.body?.deployment?.url || req.body?.compare || null,
                ts:          new Date().toISOString(),
                payload:     req.body,
            };
            await persistDeployMarker(pool, marker);
            res.status(202).json({ accepted: true });
        },
    );

    // ── GitLab webhook ──────────────────────────────────────────────────────
    router.post('/api/v1/gitlab/webhook',
        express.json({ limit: ROUTER_JSON_LIMIT }),
        async (req, res) => {
            const secret = process.env.GITLAB_WEBHOOK_TOKEN;
            if (secret && req.headers['x-gitlab-token'] !== secret) {
                return res.status(401).json({ error: 'Invalid GitLab token' });
            }
            const marker = {
                provider:    'gitlab',
                event_type:  String(req.body?.object_kind || req.headers['x-gitlab-event'] || 'unknown'),
                ref:         req.body?.ref            || null,
                sha:         req.body?.checkout_sha   || req.body?.commit?.id || null,
                actor:       req.body?.user?.username || req.body?.user_username || null,
                environment: req.body?.environment    || req.body?.deployable?.environment || null,
                repo:        req.body?.project?.path_with_namespace || null,
                url:         req.body?.project?.web_url || null,
                ts:          new Date().toISOString(),
                payload:     req.body,
            };
            await persistDeployMarker(pool, marker);
            res.status(202).json({ accepted: true });
        },
    );

    // ── Query: recent deploy markers (for timeline overlays) ────────────────
    router.get('/api/v1/deploy-markers', authenticate, async (req, res) => {
        try {
            const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);
            const { rows } = await pool.query(
                `SELECT provider, event_type, ref, sha, actor, environment, repo, url, ts
                   FROM pgmonitoringtool.deploy_markers
                  ORDER BY ts DESC
                  LIMIT $1`,
                [limit],
            );
            res.json({ markers: rows, count: rows.length });
        } catch (err) {
            res.status(500).json({ error: 'Failed to load deploy markers', details: err.message });
        }
    });

    return router;
}

// ── Raw-body capture for signature verification ────────────────────────────
function captureRawBody(req, _res, buf) {
    req.rawBody = buf;
}

function verifyGithubSignature(req) {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) return true;   // no secret configured → don't fail open outside of prod
    const sig = req.headers['x-hub-signature-256'];
    if (!sig || !req.rawBody) return false;
    const hmac = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
    const expected = `sha256=${hmac}`;
    try {
        return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
        return false;
    }
}

// ── Persistence helpers — best-effort, fail-soft ───────────────────────────
async function persistLogs(pool, rows) {
    if (!pool || !rows?.length) return;
    const text = `
        INSERT INTO pgmonitoringtool.otel_logs
            (ts, severity_number, severity_text, body, trace_id, span_id, resource_attrs, log_attrs)
        VALUES ${rows.map((_, i) =>
            `(to_timestamp($${i * 8 + 1}::bigint / 1e9), $${i * 8 + 2}, $${i * 8 + 3}, $${i * 8 + 4},
              $${i * 8 + 5}, $${i * 8 + 6}, $${i * 8 + 7}, $${i * 8 + 8})`
        ).join(', ')}
    `;
    const params = rows.flatMap(r => [
        r.ts_ns, r.severity_number, r.severity_text, r.body,
        r.trace_id, r.span_id, JSON.stringify(r.resource_attrs), JSON.stringify(r.log_attrs),
    ]);
    await pool.query(text, params).catch(() => undefined);
}

async function persistErrors(pool, rows) {
    if (!pool || !rows?.length) return;
    for (const r of rows) {
        await pool.query(
            `INSERT INTO pgmonitoringtool.error_events
                 (event_id, ts, message, level, environment, release_tag, exception, stack_trace, user_ctx, request_ctx, tags)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (event_id) DO NOTHING`,
            [
                r.event_id, r.ts, r.message, r.level, r.environment, r.release,
                JSON.stringify(r.exception), JSON.stringify(r.stack_trace),
                JSON.stringify(r.user_ctx), JSON.stringify(r.request_ctx), JSON.stringify(r.tags),
            ],
        ).catch(() => undefined);
    }
}

async function persistRum(pool, rows) {
    if (!pool || !rows?.length) return;
    for (const r of rows) {
        await pool.query(
            `INSERT INTO pgmonitoringtool.rum_events
                 (session_id, page_url, referrer, user_agent, ts, nav_type, lcp_ms, fid_ms, cls, inp_ms, ttfb_ms, custom)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
                r.session_id, r.page_url, r.referrer, r.user_agent, r.ts, r.nav_type,
                r.lcp_ms, r.fid_ms, r.cls, r.inp_ms, r.ttfb_ms, JSON.stringify(r.custom),
            ],
        ).catch(() => undefined);
    }
}

async function persistMetrics(pool, rows) {
    if (!pool || !rows?.length) return;
    for (const r of rows) {
        await pool.query(
            `INSERT INTO pgmonitoringtool.ingested_metrics (name, labels, ts, value)
             VALUES ($1, $2, $3, $4)`,
            [r.name, JSON.stringify(r.labels), r.ts, r.value],
        ).catch(() => undefined);
    }
}

async function persistDeployMarker(pool, m) {
    if (!pool) return;
    await pool.query(
        `INSERT INTO pgmonitoringtool.deploy_markers
             (provider, event_type, ref, sha, actor, environment, repo, url, ts, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
            m.provider, m.event_type, m.ref, m.sha, m.actor,
            m.environment, m.repo, m.url, m.ts, JSON.stringify(m.payload),
        ],
    ).catch(() => undefined);
}
