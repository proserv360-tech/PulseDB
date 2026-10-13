#!/usr/bin/env node
/**
 * fathom-autoexplain-shipper.mjs
 *
 * Ships RDS PostgreSQL `auto_explain` plan events into FATHOM's APM tab.
 *
 * WHY this exists:
 *   On AWS RDS you cannot read the Postgres log file from the host. RDS instead
 *   publishes the postgresql log to **CloudWatch Logs**. This shipper polls that
 *   CloudWatch log group, finds `auto_explain` JSON plan entries, parses them,
 *   and POSTs batches to FATHOM's ingest API:
 *
 *       RDS (auto_explain, log_format=json)
 *         -> CloudWatch Logs  (/aws/rds/instance/<db>/postgresql)
 *         -> this shipper      (parse + batch)
 *         -> POST /api/auto-explain/ingest   (x-sdk-key)
 *
 * REQUIREMENTS on the RDS side (see RDS_AUTO_EXPLAIN_SETUP.md):
 *   - auto_explain in shared_preload_libraries
 *   - auto_explain.log_min_duration >= 0
 *   - auto_explain.log_format = 'json'
 *   - auto_explain.log_analyze = on
 *   - PostgreSQL log exported to CloudWatch Logs
 *
 * AWS auth: uses the standard AWS SDK credential chain (env vars, shared
 * config, or the instance/Lambda IAM role). The principal needs
 * logs:FilterLogEvents on the target log group.
 *
 * Single dependency beyond Node 18+: @aws-sdk/client-cloudwatch-logs
 *   npm install @aws-sdk/client-cloudwatch-logs
 */

import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { parseAutoExplainMessage } from './autoexplain-parser.mjs';

// ── config ───────────────────────────────────────────────────────────────────
const FATHOM_URL = req('FATHOM_URL');                 // e.g. https://postgres-tool.vercel.app
const SDK_KEY = req('FATHOM_SDK_KEY');                 // sk_... from Admin -> SDK Integration
const CONNECTION_ID = Number(req('FATHOM_CONNECTION_ID')); // NUMERIC connection id (e.g. 10)
const LOG_GROUP = req('CW_LOG_GROUP');                 // /aws/rds/instance/<db>/postgresql
const REGION = process.env.AWS_REGION || 'us-east-1';
const POLL_MS = Number(process.env.SHIPPER_POLL_MS || 30_000);
const BATCH_MAX = Math.min(Number(process.env.SHIPPER_BATCH_MAX || 200), 500); // ingest caps at 500
const LOOKBACK_MS = Number(process.env.SHIPPER_LOOKBACK_MS || 5 * 60_000);     // first poll window

if (!Number.isInteger(CONNECTION_ID) || CONNECTION_ID <= 0) {
    fatal('FATHOM_CONNECTION_ID must be the NUMERIC connection id (a positive integer), e.g. 10');
}

const cw = new CloudWatchLogsClient({ region: REGION });

// ── small helpers ─────────────────────────────────────────────────────────────
function req(name) {
    const v = process.env[name];
    if (!v) fatal(`missing required env var ${name}`);
    return v;
}
function fatal(msg) {
    log('error', msg);
    process.exit(1);
}
function log(level, msg, meta = {}) {
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg, component: 'autoexplain-shipper', ...meta }));
}

// Parsing lives in the shared module (autoexplain-parser.mjs), imported above.

// ── shipping ────────────────────────────────────────────────────────────────────
async function post(path, body) {
    const res = await fetch(`${FATHOM_URL}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-sdk-key': SDK_KEY },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok && res.status !== 202) {
        const text = await res.text().catch(() => '');
        throw new Error(`${path} -> ${res.status} ${text.slice(0, 200)}`);
    }
    return res.json().catch(() => ({}));
}

async function shipBatch(events) {
    // ingest caps at 500 events; chunk to be safe.
    for (let i = 0; i < events.length; i += BATCH_MAX) {
        const chunk = events.slice(i, i + BATCH_MAX);
        const r = await post('/api/auto-explain/ingest', { connectionId: CONNECTION_ID, events: chunk });
        log('log', `shipped ${chunk.length} events`, { accepted: r.accepted, errors: (r.errors || []).length });
    }
}

// ── poll loop ────────────────────────────────────────────────────────────────────
let nextStartTime = Date.now() - LOOKBACK_MS;
let stopped = false;

async function pollOnce() {
    const startTime = nextStartTime;
    const endTime = Date.now();
    let nextToken;
    const events = [];

    do {
        const out = await cw.send(
            new FilterLogEventsCommand({
                logGroupName: LOG_GROUP,
                startTime,
                endTime,
                nextToken,
                limit: 1000,
            })
        );
        for (const ev of out.events || []) {
            const parsed = parseAutoExplainMessage(ev.message, ev.timestamp, {
                provider: 'rds-cloudwatch',
                logGroup: LOG_GROUP,
            });
            if (parsed) events.push(parsed);
        }
        nextToken = out.nextToken;
    } while (nextToken && !stopped);

    if (events.length) {
        await shipBatch(events);
    } else {
        log('log', 'no auto_explain events in window', { from: new Date(startTime).toISOString() });
    }
    // advance the window; +1ms to avoid re-reading the boundary event
    nextStartTime = endTime + 1;
}

async function runLoop() {
    log('log', 'auto_explain shipper starting', {
        url: FATHOM_URL,
        connectionId: CONNECTION_ID,
        logGroup: LOG_GROUP,
        region: REGION,
        pollMs: POLL_MS,
    });
    while (!stopped) {
        try {
            await pollOnce();
        } catch (e) {
            log('error', 'poll failed', { error: e.message });
        }
        await sleep(POLL_MS);
    }
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function shutdown(sig) {
    if (stopped) return;
    stopped = true;
    log('log', `${sig} received — stopping`);
    process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Only run the loop when invoked directly (so the parser can be unit-tested).
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) runLoop();
