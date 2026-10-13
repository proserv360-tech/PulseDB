#!/usr/bin/env node
/**
 * dashboard-latency.js
 * ────────────────────
 * Walks the top-10 GET endpoints that the dashboard hits on page load and
 * measures p50/p95/p99 latency at a configurable concurrency level.
 *
 * Usage:
 *   node scripts/bench/dashboard-latency.js --url http://localhost:4000 \
 *       --token <jwt> --concurrency 50 --duration 30
 */

import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { values } = parseArgs({
    options: {
        url:         { type: 'string', default: 'http://localhost:4000' },
        token:       { type: 'string', default: process.env.FATHOM_JWT || '' },
        concurrency: { type: 'string', default: '25' },
        duration:    { type: 'string', default: '30' },
    },
});

const ENDPOINTS = [
    '/api/connections',
    '/api/metrics/summary',
    '/api/metrics/timeseries?window=300',
    '/api/alerts/active',
    '/api/users/me',
    '/api/schema/tables',
    '/api/audit?limit=50',
    '/api/observability/health',
    '/api/reports/recent',
    '/api/sessions',
];

let autocannon;
try {
    autocannon = require('autocannon');
} catch {
    console.error('Install deps first: cd scripts/bench && npm install autocannon');
    process.exit(1);
}

async function run(path) {
    const r = await autocannon({
        url: values.url + path,
        connections: Number(values.concurrency),
        duration: Number(values.duration),
        headers: values.token ? { authorization: `Bearer ${values.token}` } : {},
    });
    return {
        path,
        rps: r.requests.average,
        p50: r.latency.p50,
        p95: r.latency.p95,
        p99: r.latency.p99,
        errors: r.errors + r.timeouts + r.non2xx,
    };
}

(async () => {
    const results = [];
    for (const p of ENDPOINTS) results.push(await run(p));
    console.log(JSON.stringify({
        url: values.url,
        concurrency: Number(values.concurrency),
        results,
    }, null, 2));
})();
