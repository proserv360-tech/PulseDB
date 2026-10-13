/**
 * probe-slack-interaction.ts — send a genuine Slack-signed interaction to our
 * own endpoint and report exactly which branch answers.
 *
 * Why this exists
 * ───────────────
 * "The Acknowledge button does nothing" has at least four distinct causes, and
 * from inside Slack they all look identical — the button greys out, nothing
 * happens, no error. This script reproduces precisely what Slack sends (same
 * body encoding, same v0 HMAC over the same base string) so the failure shows
 * up as an HTTP status you can read, instead of a silence you have to guess at.
 *
 * It is safe to run against production. The default incident id does not
 * exist, so acknowledgeIncident() returns null and nothing is mutated, and no
 * `response_url` is sent, so nothing is posted into Slack.
 *
 *   Local (server running via `npm run dev`):
 *     npm run slack:probe
 *
 *   Production:
 *     npm run slack:probe -- --prod
 *
 *   Options:
 *     --url <url>       full endpoint URL (overrides --prod)
 *     --prod            hit https://postgres-tool-frontend.vercel.app
 *     --secret <s>      signing secret (default: SLACK_SIGNING_SECRET from .env)
 *     --id <INC-…>      incident id to acknowledge (default: a nonexistent one)
 *     --commands        probe /api/slack/commands with `/ack` instead
 *     --tamper          send a deliberately wrong signature — MUST return 403
 *     --skew <seconds>  backdate the timestamp — >300 MUST return 403
 *     --raw             print the response body verbatim, no interpretation
 *
 * Reading the result: see the interpretation table printed after each run, and
 * docs/SLACK_ACK_TROUBLESHOOTING.md for what to do about each outcome.
 */

import 'dotenv/config';
import crypto from 'crypto';

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', C = '\x1b[36m',
      D = '\x1b[2m', B = '\x1b[1m', O = '\x1b[0m';

const PROD_ORIGIN = 'https://postgres-tool-frontend.vercel.app';
const DEFAULT_LOCAL = `http://localhost:${process.env.PORT || 5000}`;

/** A deliberately impossible id: the date part is all zeroes. */
const SAFE_ID = 'INC-00000000-000';

function arg(name: string): string | undefined {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

/**
 * Build the v0 signature exactly as Slack does.
 *
 * The base string is `v0:<timestamp>:<raw body>` — note "raw". Slack signs the
 * bytes it put on the wire, so anything that re-serialises the body upstream
 * (a body parser, a serverless platform's request helpers) breaks this even
 * when the secret is perfect. That is the whole reason this probe reports the
 * two failures separately.
 */
function sign(secret: string, timestamp: number, rawBody: string): string {
    return 'v0=' + crypto
        .createHmac('sha256', secret)
        .update(`v0:${timestamp}:${rawBody}`)
        .digest('hex');
}

/** The `block_actions` payload Slack posts when an Ack button is clicked. */
function buildInteractionBody(incidentId: string): string {
    const payload = {
        type: 'block_actions',
        // The handler trusts this for the actor and nothing else.
        user: { id: 'U000PROBE', username: 'probe', name: 'probe' },
        // response_url is deliberately omitted. With it set, a successful run
        // would post a follow-up message into the real channel.
        actions: [
            {
                type: 'button',
                action_id: `ack_incident:${incidentId}`,
                value: incidentId,
                text: { type: 'plain_text', text: 'Ack (probe)' },
            },
        ],
    };
    return 'payload=' + encodeURIComponent(JSON.stringify(payload));
}

/** The form body Slack posts for a `/ack <id>` slash command. */
function buildCommandBody(incidentId: string): string {
    return new URLSearchParams({
        command: '/ack',
        text: incidentId,
        user_name: 'probe',
        user_id: 'U000PROBE',
        channel_id: 'C000PROBE',
        team_id: 'T000PROBE',
        // response_url omitted for the same reason as above.
    }).toString();
}

/* ── Result interpretation ────────────────────────────────────────────────
 * Each outcome maps to exactly one blocker. The point of the probe is that
 * these are distinguishable from the outside; inside Slack they are not.
 * ────────────────────────────────────────────────────────────────────────── */
function interpret(status: number, body: string, tampered: boolean): string {
    const b = body.toLowerCase();

    if (tampered) {
        return status === 403
            ? `${G}CORRECT${O} — a forged signature was rejected, so verification is genuinely running.\n` +
              `  ${D}Now re-run without --tamper. If that also 403s, the secret is wrong.${O}`
            : `${R}SECURITY PROBLEM${O} — a deliberately invalid signature got HTTP ${status}.\n` +
              `  ${R}The endpoint is not verifying signatures. Anyone can acknowledge your incidents.${O}`;
    }

    if (status === 200) {
        return `${G}WORKING${O} — signature verified, handler ran, raw body survived the round trip.\n` +
               `  ${D}Blockers #1 and #2 are both clear. If Slack buttons still do nothing, the${O}\n` +
               `  ${D}Request URL in the Slack app config is wrong or missing — check that next.${O}`;
    }

    if (status === 503 || b.includes('signing secret not configured')) {
        return `${Y}BLOCKER #1 — SLACK_SIGNING_SECRET is not set on the server that answered.${O}\n` +
               `  ${D}Your local .env does not reach Vercel. Add it in Project → Settings →${O}\n` +
               `  ${D}Environment Variables, then redeploy — env changes need a new deployment.${O}`;
    }

    if (status === 400 && (b.includes('raw request body') || b.includes('cannot verify'))) {
        return `${Y}BLOCKER #2 — the request body was parsed before Express saw it.${O}\n` +
               `  ${D}This is the serverless failure mode: the platform's request helpers consume${O}\n` +
               `  ${D}the stream and hand Express an object, so express.raw() never sees Slack's${O}\n` +
               `  ${D}bytes and the signature cannot be recomputed. The secret is irrelevant here —${O}\n` +
               `  ${D}fixing it needs the raw body preserved, not a different key.${O}`;
    }

    if (status === 403) {
        return `${Y}Signature mismatch.${O} Three causes, in order of likelihood:\n` +
               `  ${D}1. The server's SLACK_SIGNING_SECRET differs from the one used here${O}\n` +
               `     ${D}(very common: local .env updated, Vercel env not).${O}\n` +
               `  ${D}2. The raw body was silently altered — an empty rawBody signs to a valid${O}\n` +
               `     ${D}but wrong digest, which is blocker #2 wearing a 403 instead of a 400.${O}\n` +
               `  ${D}3. Server clock more than 5 minutes off (unlikely on managed hosting).${O}\n` +
               `  ${C}Re-run with --tamper: if that ALSO returns 403, verification works and you${O}\n` +
               `  ${C}have cause 1 or 3. If --tamper returns something else, you have cause 2.${O}`;
    }

    if (status === 404) {
        return `${R}Route not found.${O} The endpoint is not mounted at this path on that host.\n` +
               `  ${D}Confirm the deployment is current and that incidentRoutes is mounted at /api.${O}`;
    }

    if (status === 401) {
        return `${R}Unauthorised.${O} Something upstream — auth middleware, an IP allow-list, or\n` +
               `  ${D}Vercel Deployment Protection — is intercepting before the Slack handler.${O}\n` +
               `  ${D}Slack cannot authenticate, so this path must be publicly reachable.${O}`;
    }

    return `${Y}Unexpected status.${O} Check the server logs for this request.`;
}

async function main() {
    const secret = arg('secret') || process.env.SLACK_SIGNING_SECRET;
    const incidentId = arg('id') || SAFE_ID;
    const commandsMode = has('commands');
    const tampered = has('tamper');
    const skew = Number(arg('skew') || 0);

    if (!secret) {
        throw new Error(
            'No signing secret. Set SLACK_SIGNING_SECRET in backend/.env or pass --secret.',
        );
    }

    const origin = arg('url') ? '' : has('prod') ? PROD_ORIGIN : DEFAULT_LOCAL;
    const path = commandsMode ? '/api/slack/commands' : '/api/slack/interactions';
    const url = arg('url') || origin + path;

    const rawBody = commandsMode
        ? buildCommandBody(incidentId)
        : buildInteractionBody(incidentId);

    const timestamp = Math.floor(Date.now() / 1000) - skew;
    const signature = tampered
        ? 'v0=' + '0'.repeat(64)
        : sign(secret, timestamp, rawBody);

    console.log(`\n${B}Slack interaction probe${O}`);
    console.log(`${D}  target      ${O}${url}`);
    console.log(`${D}  mode        ${O}${commandsMode ? 'slash command /ack' : 'block_actions button'}`);
    console.log(`${D}  incident    ${O}${incidentId}${incidentId === SAFE_ID ? `  ${D}(nonexistent — nothing will be mutated)${O}` : `  ${Y}(REAL — this will acknowledge it)${O}`}`);
    console.log(`${D}  secret      ${O}${secret.length} chars, fingerprint ${crypto.createHash('sha256').update(secret).digest('hex').slice(0, 12)}`);
    console.log(`${D}  timestamp   ${O}${timestamp}${skew ? `  ${Y}(backdated ${skew}s)${O}` : ''}`);
    if (tampered) console.log(`  ${Y}signature deliberately invalid — expecting 403${O}`);
    console.log('');

    const started = Date.now();
    let res: Response;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Slack-Request-Timestamp': String(timestamp),
                'X-Slack-Signature': signature,
                'User-Agent': 'Slackbot 1.0 (+https://api.slack.com/robots)',
            },
            body: rawBody,
        });
    } catch (err: any) {
        console.error(`${R}✖ Could not reach ${url}${O}`);
        console.error(`${D}  ${err.message}${O}`);
        console.error(
            `${D}  If probing locally, start the server first: npm run dev${O}\n`,
        );
        process.exit(1);
    }

    const elapsed = Date.now() - started;
    const body = await res.text();
    const colour = res.status === 200 ? G : res.status < 500 ? Y : R;

    console.log(`${B}Response${O}`);
    console.log(`  ${colour}HTTP ${res.status}${O}  ${D}in ${elapsed}ms${O}`);

    // Which deployment actually answered. On a multi-project setup it is easy
    // to add an environment variable to one project and probe another, and the
    // response looks identical either way — these headers are the only external
    // evidence of which build served the request.
    const vercelId = res.headers.get('x-vercel-id');
    const age = res.headers.get('age');
    const server = res.headers.get('server');
    if (vercelId || server) {
        console.log(
            `  ${D}served by: ${server || 'unknown'}${vercelId ? `  ·  x-vercel-id ${vercelId}` : ''}${age ? `  ·  age ${age}s` : ''}${O}`,
        );
    }
    if (elapsed > 3000) {
        console.log(`  ${Y}⚠ Over Slack's 3s budget — Slack would show the user a timeout${O}`);
    }
    console.log(`  ${D}body: ${body ? body.slice(0, 400) : '(empty)'}${O}`);

    if (has('raw')) { console.log(''); return; }

    console.log(`\n${B}Diagnosis${O}`);
    console.log('  ' + interpret(res.status, body, tampered));
    console.log('');
}

main().catch((err) => {
    console.error(`\n${R}✖ ${err.message}${O}\n`);
    process.exit(1);
});
