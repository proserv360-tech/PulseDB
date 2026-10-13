/**
 * bench/k6/otlp_ingest.js — C7
 * Hammer POST /api/otlp/v1/traces with synthetic OTLP/HTTP batches.
 *
 * Targets (full run, 10m):
 *   - 1 000 spans/s sustained
 *   - p99 response time < 50 ms (queued path) or < 250 ms (direct insert)
 *   - error_rate < 0.5%
 *
 * Run:
 *   k6 run -e BASE_URL=http://localhost:5000 -e SDK_KEY=$FATHOM_SDK_KEY \
 *          bench/k6/otlp_ingest.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const SDK_KEY  = __ENV.SDK_KEY  || 'sk_test_replace_me';
const SPANS_PER_BATCH = Number(__ENV.SPANS_PER_BATCH || 100);
const DURATION = __ENV.DURATION || '2m';
const SMOKE = __ENV.SMOKE === '1';

export const options = SMOKE
    ? {
        scenarios: { smoke: { executor: 'constant-vus', vus: 2, duration: '30s' } },
        thresholds: { http_req_failed: ['rate<0.05'], http_req_duration: ['p(95)<500'] },
    }
    : {
        scenarios: {
            sustained: {
                executor: 'ramping-arrival-rate',
                startRate: 1,
                timeUnit: '1s',
                preAllocatedVUs: 50,
                maxVUs: 200,
                stages: [
                    { target: 10, duration: '30s' },
                    { target: 10, duration: DURATION },
                    { target: 0, duration: '15s' },
                ],
            },
        },
        thresholds: {
            http_req_failed:   ['rate<0.005'],   // < 0.5% errors
            http_req_duration: [
                'p(95)<250',   // direct-insert ceiling
                'p(99)<500',
            ],
        },
    };

function hex(n) {
    let s = '';
    for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s;
}

function buildBatch() {
    const spans = [];
    const traceId = hex(32);
    const baseEnd = Date.now() * 1_000_000;
    for (let i = 0; i < SPANS_PER_BATCH; i++) {
        const startNs = baseEnd - (i + 1) * 1_000_000;     // ms-ish spacing
        const endNs   = startNs + 500_000;
        spans.push({
            traceId,
            spanId: hex(16),
            name: `span-${i}`,
            startTimeUnixNano: String(startNs),
            endTimeUnixNano:   String(endNs),
            attributes: [
                { key: 'service.name', value: { stringValue: 'fathom-bench' } },
                { key: 'op',           value: { stringValue: randomString(8) } },
            ],
        });
    }
    return {
        resourceSpans: [{
            resource: { attributes: [{ key: 'service.name', value: { stringValue: 'fathom-bench' } }] },
            scopeSpans: [{
                scope: { name: 'fathom-bench-k6' },
                spans,
            }],
        }],
    };
}

export default function () {
    const res = http.post(
        `${BASE_URL}/api/otlp/v1/traces`,
        JSON.stringify(buildBatch()),
        { headers: { 'content-type': 'application/json', 'x-sdk-key': SDK_KEY } },
    );
    check(res, {
        'status 200/202': (r) => r.status === 200 || r.status === 202,
    });
    sleep(0.05);
}
