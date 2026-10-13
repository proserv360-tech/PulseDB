// @ts-nocheck
/**
 * tests/slackRawBody.test.ts
 * ──────────────────────────
 * End-to-end tests for Slack acknowledgement over HTTP.
 *
 * These drive real requests through the real router with real HMAC signatures,
 * because the bug being guarded against only exists at that seam: everything
 * looks correct in isolation, and breaks when a body parser sits between the
 * socket and the handler.
 *
 * The three `mode` values reproduce what a platform does to a request BEFORE
 * the application sees it. That is the crux — an Express app cannot simulate
 * its own body having been eaten upstream, which is exactly why this failed
 * only on Vercel and never locally.
 *
 *   stream-intact   bodyParser disabled — the stream reaches us untouched
 *   parsed-buffer   runtime read the body but preserved the bytes
 *   parsed-object   runtime read the body and discarded the bytes
 *
 * Run:
 *   npm test -- tests/slackRawBody.test.ts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import express from 'express';

import incidentRoutes from '../routes/incidentRoutes.js';
import { verifySlackSignature } from '../services/slackService.js';
import { needsSlackRawBody, captureSlackRawBody } from '../middleware/slackRawBody.js';

const SIGNING_SECRET = '8f742231b10e8888abcd99yyyzzz85a5';
const KNOWN_INCIDENT = 'INC-REAL-001';

/* ── Fixtures ─────────────────────────────────────────────────────────── */

/** Minimal pool stand-in: acknowledgeIncident is the only thing exercised. */
function fakePool(acknowledged = []) {
    return {
        query: async (sql, params) => {
            if (/UPDATE|update/.test(sql)) {
                acknowledged.push(params);
                return { rows: [{ id: KNOWN_INCIDENT }], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
        },
    };
}

function slackSignature(timestamp, rawBody, secret = SIGNING_SECRET) {
    return 'v0=' + crypto
        .createHmac('sha256', secret)
        .update(`v0:${timestamp}:${rawBody}`)
        .digest('hex');
}

function interactionBody(incidentId) {
    return 'payload=' + encodeURIComponent(JSON.stringify({
        type: 'block_actions',
        user: { id: 'U1', username: 'tester' },
        actions: [{ type: 'button', action_id: `ack_incident:${incidentId}`, value: incidentId }],
    }));
}

/**
 * Build a server that mimics a platform's pre-handler body handling, then
 * delegates through the same capture step api/index.js uses.
 */
function buildServer(mode) {
    const app = express();
    app.use('/api', incidentRoutes(fakePool(), (_q, _s, next) => next(), verifySlackSignature, () => {}));

    const readAll = (req) => new Promise((resolve) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks)));
    });

    return http.createServer(async (req, res) => {
        if (mode === 'parsed-buffer') {
            req.body = await readAll(req);
        } else if (mode === 'parsed-object') {
            const buf = await readAll(req);
            req.body = Object.fromEntries(new URLSearchParams(buf.toString('utf8')));
        }

        if (needsSlackRawBody(req)) {
            const captured = await captureSlackRawBody(req);
            if (!captured.ok) {
                res.statusCode = captured.reason === 'runtime_body_parser' ? 500 : 400;
                res.setHeader('content-type', 'application/json');
                return res.end(JSON.stringify({ error: 'raw body unavailable', cause: captured.reason }));
            }
        }
        return app(req, res);
    });
}

function post(port, body, { tamper = false, skewSeconds = 0, secret = SIGNING_SECRET } = {}) {
    const timestamp = Math.floor(Date.now() / 1000) - skewSeconds;
    const signature = tamper ? 'v0=' + '0'.repeat(64) : slackSignature(timestamp, body, secret);

    return new Promise((resolve, reject) => {
        const req = http.request({
            port,
            method: 'POST',
            path: '/api/slack/interactions',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body),
                'X-Slack-Request-Timestamp': String(timestamp),
                'X-Slack-Signature': signature,
            },
        }, (res) => {
            let out = '';
            res.on('data', (d) => (out += d));
            res.on('end', () => resolve({ status: res.statusCode, body: out }));
        });
        req.on('error', reject);
        // A hang is a real failure mode here: express.raw() waiting on an
        // already-consumed stream never responds. Fail fast instead of stalling
        // the suite — Slack itself gives up after 3 seconds.
        req.setTimeout(4000, () => {
            req.destroy();
            reject(new Error('request hung — no response within 4s'));
        });
        req.end(body);
    });
}

/* ── Tests ────────────────────────────────────────────────────────────── */

describe('Slack interactions endpoint', () => {
    let originalSecret;

    before(() => {
        originalSecret = process.env.SLACK_SIGNING_SECRET;
        process.env.SLACK_SIGNING_SECRET = SIGNING_SECRET;
    });

    after(() => {
        if (originalSecret === undefined) delete process.env.SLACK_SIGNING_SECRET;
        else process.env.SLACK_SIGNING_SECRET = originalSecret;
    });

    const withServer = async (mode, fn) => {
        const server = buildServer(mode);
        await new Promise((r) => server.listen(0, r));
        try {
            await fn(server.address().port);
        } finally {
            await new Promise((r) => server.close(r));
        }
    };

    describe('stream intact (bodyParser disabled)', () => {
        it('accepts a correctly signed interaction', async () => {
            await withServer('stream-intact', async (port) => {
                const res = await post(port, interactionBody(KNOWN_INCIDENT));
                assert.equal(res.status, 200);
            });
        });

        it('accepts an interaction for an unknown incident without erroring', async () => {
            // Slack must still get its 200 — a missing incident is reported in
            // the follow-up message, not by failing the interaction.
            await withServer('stream-intact', async (port) => {
                const res = await post(port, interactionBody('INC-00000000-000'));
                assert.equal(res.status, 200);
            });
        });

        it('rejects a forged signature', async () => {
            await withServer('stream-intact', async (port) => {
                const res = await post(port, interactionBody(KNOWN_INCIDENT), { tamper: true });
                assert.equal(res.status, 403);
            });
        });

        it('rejects a replayed request older than 5 minutes', async () => {
            await withServer('stream-intact', async (port) => {
                const res = await post(port, interactionBody(KNOWN_INCIDENT), { skewSeconds: 400 });
                assert.equal(res.status, 403);
            });
        });

        it('rejects a signature made with a different secret', async () => {
            await withServer('stream-intact', async (port) => {
                const res = await post(port, interactionBody(KNOWN_INCIDENT), { secret: 'wrong-secret' });
                assert.equal(res.status, 403);
            });
        });
    });

    describe('runtime pre-read the body but preserved the bytes', () => {
        it('recovers and accepts a correctly signed interaction', async () => {
            await withServer('parsed-buffer', async (port) => {
                const res = await post(port, interactionBody(KNOWN_INCIDENT));
                assert.equal(res.status, 200);
            });
        });

        it('still rejects a forged signature', async () => {
            // Recovery must not become a bypass.
            await withServer('parsed-buffer', async (port) => {
                const res = await post(port, interactionBody(KNOWN_INCIDENT), { tamper: true });
                assert.equal(res.status, 403);
            });
        });
    });

    describe('runtime discarded the bytes', () => {
        it('fails loudly rather than hanging or returning a misleading 403', async () => {
            await withServer('parsed-object', async (port) => {
                const res = await post(port, interactionBody(KNOWN_INCIDENT));
                assert.equal(res.status, 500);
                assert.equal(JSON.parse(res.body).cause, 'runtime_body_parser');
            });
        });
    });

    describe('signing secret absent', () => {
        it('reports misconfiguration rather than a bad signature', async () => {
            // 503 and 403 send you to completely different places. Conflating
            // them is what turned this into a multi-day investigation.
            const saved = process.env.SLACK_SIGNING_SECRET;
            delete process.env.SLACK_SIGNING_SECRET;
            try {
                await withServer('stream-intact', async (port) => {
                    const res = await post(port, interactionBody(KNOWN_INCIDENT), { secret: saved });
                    assert.equal(res.status, 503);
                });
            } finally {
                process.env.SLACK_SIGNING_SECRET = saved;
            }
        });
    });
});

describe('captureSlackRawBody', () => {
    it('only claims Slack paths', () => {
        assert.equal(needsSlackRawBody({ url: '/api/slack/interactions' }), true);
        assert.equal(needsSlackRawBody({ url: '/api/slack/commands?x=1' }), true);
        assert.equal(needsSlackRawBody({ url: '/api/incidents' }), false);
        assert.equal(needsSlackRawBody({ url: '/api/connections/upload' }), false);
    });

    it('leaves an already-captured rawBody untouched', async () => {
        const req = { url: '/api/slack/x', rawBody: 'original=bytes', body: Buffer.from('different') };
        assert.deepEqual(await captureSlackRawBody(req), { ok: true });
        assert.equal(req.rawBody, 'original=bytes');
    });

    it('sets the _body flag so downstream parsers skip the dead stream', async () => {
        const req = { url: '/api/slack/x', body: Buffer.from('a=1') };
        await captureSlackRawBody(req);
        assert.equal(req._body, true);
        assert.equal(req.rawBody, 'a=1');
    });

    it('refuses to reconstruct a parsed object', async () => {
        const req = { url: '/api/slack/x', body: { payload: '{}' } };
        const result = await captureSlackRawBody(req);
        assert.equal(result.ok, false);
        assert.equal(result.reason, 'runtime_body_parser');
    });
});
