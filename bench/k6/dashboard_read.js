/**
 * bench/k6/dashboard_read.js — C7
 * Cycles dashboard reads + connection list + wait-event read.
 *
 * Target: p95 < 250 ms across the rotation.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const TOKEN = __ENV.TOKEN || '';
const WORKSPACE_ID = __ENV.WORKSPACE_ID || '1';
const SMOKE = __ENV.SMOKE === '1';

export const options = SMOKE
    ? {
        scenarios: { smoke: { executor: 'constant-vus', vus: 5, duration: '30s' } },
        thresholds: { http_req_failed: ['rate<0.05'], http_req_duration: ['p(95)<800'] },
    }
    : {
        scenarios: {
            browse: {
                executor: 'constant-vus',
                vus: 25, duration: '5m',
            },
        },
        thresholds: {
            http_req_duration: ['p(95)<250', 'p(99)<500'],
            http_req_failed:   ['rate<0.01'],
        },
    };

const endpoints = [
    '/api/connections',
    '/api/connections/active',
    '/api/dashboards',
    '/api/observability/wait-events?connectionId=1&bucket=5m',
];

export default function () {
    const url = `${BASE_URL}${endpoints[Math.floor(Math.random() * endpoints.length)]}`;
    const res = http.get(url, {
        headers: {
            authorization: TOKEN ? `Bearer ${TOKEN}` : undefined,
            'x-workspace-id': WORKSPACE_ID,
        },
    });
    check(res, { '2xx': (r) => r.status >= 200 && r.status < 300 });
    sleep(0.1);
}
