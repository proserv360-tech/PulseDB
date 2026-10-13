/**
 * autoexplain-lambda.mjs
 *
 * Push-based alternative to the polling shipper. Triggered by a CloudWatch Logs
 * **subscription filter** on the RDS postgresql log group. Near real-time: each
 * batch of log events is delivered to this Lambda as it arrives.
 *
 * Event shape (CloudWatch Logs -> Lambda):
 *   { awslogs: { data: "<base64(gzip(JSON))>" } }
 * where the decoded JSON is:
 *   { messageType, logGroup, logStream, logEvents: [{ id, timestamp, message }] }
 *
 * Runtime: Node.js 20+ (ESM). Uses only built-ins (zlib) + the shared parser.
 * No AWS SDK needed — the platform delivers the payload directly.
 *
 * Required env vars:
 *   PULSEDB_URL            https://postgres-tool.vercel.app
 *   PULSEDB_SDK_KEY        sk_...
 *   PULSEDB_CONNECTION_ID  numeric connection id (e.g. 10)
 *
 * Deploy: zip this file + autoexplain-parser.mjs together (see LAMBDA_SETUP.md).
 */

import { gunzipSync } from 'node:zlib';
import { parseAutoExplainMessage } from './autoexplain-parser.mjs';

const PULSEDB_URL = mustEnv('PULSEDB_URL');
const SDK_KEY = mustEnv('PULSEDB_SDK_KEY');
const CONNECTION_ID = Number(mustEnv('PULSEDB_CONNECTION_ID'));
const BATCH_MAX = 500; // ingest hard cap

function mustEnv(name) {
    const v = process.env[name];
    if (!v) throw new Error(`missing required env var ${name}`);
    return v;
}

function log(level, msg, meta = {}) {
    const fn = level === 'error' ? console.error : console.log;
    fn(JSON.stringify({ level, msg, component: 'autoexplain-lambda', ...meta }));
}

async function post(path, body) {
    const res = await fetch(`${PULSEDB_URL}${path}`, {
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

/**
 * Lambda entrypoint.
 */
export async function handler(event) {
    if (!Number.isInteger(CONNECTION_ID) || CONNECTION_ID <= 0) {
        throw new Error('PULSEDB_CONNECTION_ID must be a positive integer');
    }
    const payload = decodeCloudWatchLogsEvent(event);
    if (!payload) {
        log('log', 'no decodable awslogs payload; skipping');
        return { ok: true, shipped: 0 };
    }

    const logGroup = payload.logGroup || null;
    const events = [];
    for (const le of payload.logEvents || []) {
        const parsed = parseAutoExplainMessage(le.message, le.timestamp, {
            provider: 'rds-cloudwatch-subscription',
            logGroup,
        });
        if (parsed) events.push(parsed);
    }

    if (!events.length) {
        log('log', 'no auto_explain plans in this batch', { logGroup, raw: (payload.logEvents || []).length });
        return { ok: true, shipped: 0 };
    }

    let shipped = 0;
    for (let i = 0; i < events.length; i += BATCH_MAX) {
        const chunk = events.slice(i, i + BATCH_MAX);
        const r = await post('/api/auto-explain/ingest', { connectionId: CONNECTION_ID, events: chunk });
        shipped += chunk.length;
        log('log', `shipped ${chunk.length}`, { accepted: r.accepted, errors: (r.errors || []).length });
    }
    return { ok: true, shipped };
}

/**
 * Decode the gzipped+base64 CloudWatch Logs subscription payload.
 * Returns the parsed JSON, or null if this isn't a logs event (e.g. the
 * one-time CONTROL_MESSAGE used to validate a subscription).
 */
export function decodeCloudWatchLogsEvent(event) {
    const data = event && event.awslogs && event.awslogs.data;
    if (!data) return null;
    let json;
    try {
        json = JSON.parse(gunzipSync(Buffer.from(data, 'base64')).toString('utf8'));
    } catch {
        return null;
    }
    if (json.messageType === 'CONTROL_MESSAGE') return null; // subscription healthcheck
    return json;
}
