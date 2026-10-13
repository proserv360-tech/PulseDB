// @ts-nocheck
/**
 * middleware/slackRawBody.ts
 * ──────────────────────────
 * Capture the exact bytes Slack sent, before anything can re-serialise them.
 *
 * Slack signs `v0:<timestamp>:<raw body>`. Verification recomputes that HMAC,
 * so it needs the body byte-for-byte. Any parser that reads the stream and
 * hands on a reconstructed value breaks verification permanently, however
 * correct the signing secret is.
 *
 * Locally that is easy: mount express.raw() ahead of express.json() and the
 * stream is untouched. On a serverless platform it is not — the runtime often
 * reads the body itself before the application is invoked. This module is the
 * platform-side half of the fix, used by api/index.js.
 *
 * It lives apart from api/index.js so it can be tested without importing the
 * whole server (see tests/slackRawBody.test.ts).
 */

/** Slack is the only integration that needs byte-exact bodies. */
export function needsSlackRawBody(req) {
    const path = (req.url || '').split('?')[0];
    return path.startsWith('/api/slack/');
}

/** Collect the request stream into a Buffer. */
export function readStream(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

/**
 * Attach `req.rawBody` (string) and `req.body` (Buffer) from whatever state the
 * platform left the request in.
 *
 * Sets `req._body`, which is body-parser's own "already handled, do not touch
 * the stream" flag. Without it a downstream express.raw() waits on a stream
 * that will never emit again, and the request hangs until Slack's 3s timeout —
 * a failure far more confusing than an error.
 *
 * @returns {Promise<{ok: true} | {ok: false, reason: string, error?: Error}>}
 */
export async function captureSlackRawBody(req) {
    // Already captured — by an earlier call, or by a platform that got it right.
    if (typeof req.rawBody === 'string' && req.rawBody.length > 0) {
        return { ok: true };
    }

    if (Buffer.isBuffer(req.body)) {
        req.rawBody = req.body.toString('utf8');
        req._body = true;
        return { ok: true };
    }

    if (typeof req.body === 'string') {
        req.rawBody = req.body;
        req.body = Buffer.from(req.rawBody, 'utf8');
        req._body = true;
        return { ok: true };
    }

    if (req.body && typeof req.body === 'object') {
        // The runtime parsed the body into an object and discarded the bytes.
        //
        // Re-serialising is NOT safe: form encoding is not canonical — space as
        // `+` versus `%20`, differing escape sets, key order — so a
        // reconstruction that looks identical still yields a different HMAC.
        // That surfaces as a 403 indistinguishable from a wrong secret, which
        // sends people off rotating credentials that were never the problem.
        //
        // Refusing loudly is the more useful failure.
        return { ok: false, reason: 'runtime_body_parser' };
    }

    // The expected path: the stream is intact and ours to read.
    try {
        const buffer = await readStream(req);
        req.rawBody = buffer.toString('utf8');
        req.body = buffer;
        req._body = true;
        return { ok: true };
    } catch (error) {
        return { ok: false, reason: 'read_failed', error };
    }
}
