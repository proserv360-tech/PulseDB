#!/usr/bin/env node
/**
 * ingest-load.js
 * ──────────────
 * Measures sustained SDK event-ingest throughput + latency against a
 * running FATHOM backend. Uses autocannon for the load generator and
 * reports autocannon's native latency histogram.
 *
 * Usage:
 *   node scripts/bench/ingest-load.js \
 *       --url http://localhost:4000 --duration 60 --concurrency 200 \
 *       --api-key fathom_live_xxx
 */

import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { values } = parseArgs({
    options: {
        url:         { type: 'string', default: 'http://localhost:4000' },
        duration:    { type: 'string', default: '30' },
        concurrency: { type: 'string', default: '100' },
        pipelining:  { type: 'string', default: '10' },
        'api-key':   { type: 'string', default: process.env.FATHOM_API_KEY || '' },
    },
});

async function main() {
    let autocannon;
    try {
        autocannon = require('autocannon');
    } catch {
        console.error('Install deps first: cd scripts/bench && npm install autocannon');
        process.exit(1);
    }

    const samplePayload = JSON.stringify({
        events: Array.from({ length: 20 }, (_, i) => ({
            type: 'api',
            ts: Date.now(),
            method: 'GET',
            path: `/api/things/${i}`,
            statusCode: 200,
            durationMs: Math.random() * 50,
        })),
    });

    const result = await autocannon({
        url: `${values.url}/api/sdk/events`,
        method: 'POST',
        duration: Number(values.duration),
        connections: Number(values.concurrency),
        pipelining: Number(values.pipelining),
        headers: {
            'content-type': 'application/json',
            ...(values['api-key'] ? { authorization: `Bearer ${values['api-key']}` } : {}),
        },
        body: samplePayload,
    });

    // Each request carries 20 events.
    const eventsPerSec = result.requests.average * 20;

    const summary = {
        url: result.url,
        durationSeconds: Number(values.duration),
        concurrency: Number(values.concurrency),
        requestsPerSec: result.requests.average,
        eventsPerSec,
        latency: {
            p50: result.latency.p50,
            p90: result.latency.p90,
            p99: result.latency.p99,
            max: result.latency.max,
        },
        errors: result.errors,
        non2xx: result.non2xx,
        timeouts: result.timeouts,
    };
    console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
