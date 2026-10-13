/**
 * Vercel Serverless Function — wraps the Express app from backend/server.js
 *
 * Vercel sets VERCEL=1 automatically, so server.js skips its own startup()
 * (HTTP listen, WebSocket server, etc.) and just exports the configured Express app.
 *
 * This catch-all handler forwards every /api/* request to Express.
 *
 * ── Why this file is not just `export default app` ──────────────────────────
 *
 * Slack signs its requests as an HMAC over `v0:<timestamp>:<raw body>` — the
 * exact bytes it put on the wire. Verifying that signature therefore requires
 * those exact bytes.
 *
 * Vercel's Node runtime, by default, reads the request stream and parses it
 * into `req.body` before the handler is invoked. By the time Express runs the
 * stream is consumed and the original bytes are gone. `express.raw()` inside
 * routes/incidentRoutes.ts then has nothing to read, and signature
 * verification fails permanently — presenting as a 400 ("raw body
 * unavailable") or, worse, a 403 that looks like a wrong signing secret and
 * sends you off rotating credentials that were never the problem.
 *
 * Two defences, because the first is a platform behaviour we do not own:
 *
 *   1. `config.api.bodyParser = false` asks the runtime to leave the body
 *      alone. When honoured, the stream arrives intact and everything
 *      downstream behaves exactly as it does locally.
 *
 *   2. captureSlackRawBody() takes the body itself for /api/slack/*, recovering
 *      where recovery is sound and failing loudly where it is not.
 *
 * Only Slack paths are buffered. Everything else passes straight through so
 * uploads and streaming responses keep working.
 *
 * The capture logic lives in backend/middleware/slackRawBody.js so it can be
 * tested without importing the whole server — see tests/slackRawBody.test.ts.
 */

import app from '../backend/server.js';
import { needsSlackRawBody, captureSlackRawBody } from '../backend/middleware/slackRawBody.js';

/**
 * Ask Vercel's Node runtime to leave the request body alone.
 * Honoured by @vercel/node; harmless if a future runtime ignores it, because
 * captureSlackRawBody() handles the parsed case too.
 */
export const config = {
    api: {
        bodyParser: false,
    },
};

function fail(res, status, body) {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
    if (!needsSlackRawBody(req)) return app(req, res);

    const captured = await captureSlackRawBody(req);

    if (!captured.ok) {
        if (captured.reason === 'runtime_body_parser') {
            console.error(
                '[slack] Request body was parsed before the handler ran — ' +
                    'raw bytes unavailable, so the Slack signature cannot be verified. ' +
                    'config.api.bodyParser=false was not honoured by the runtime. ' +
                    'See api/index.js and docs/SLACK_ACK_TROUBLESHOOTING.md.',
            );
            return fail(res, 500, {
                error: 'Raw request body unavailable — cannot verify Slack signature',
                cause: 'runtime_body_parser',
            });
        }

        console.error('[slack] Failed to capture raw request body', captured.error);
        return fail(res, 400, { error: 'Could not read request body' });
    }

    return app(req, res);
}
