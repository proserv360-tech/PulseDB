/**
 * bench/k6/alerts_fire.js — C7
 * Drives the /api/alerts/run-monitoring path with the cron secret.
 * Measures alert engine median dispatch time.
 *
 * Run:
 *   k6 run -e BASE_URL=... -e CRON_SECRET=$FATHOM_CRON_SECRET bench/k6/alerts_fire.js
 *
 * Target: median < 2 s; p95 < 5 s.
 */

import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const CRON_SECRET = __ENV.CRON_SECRET || '';
const SMOKE = __ENV.SMOKE === '1';

export const options = SMOKE
    ? {
        scenarios: { smoke: { executor: 'constant-vus', vus: 1, iterations: 5 } },
        thresholds: { http_req_failed: ['rate<0.05'] },
    }
    : {
        scenarios: {
            steady: {
                executor: 'constant-arrival-rate',
                rate: 1, timeUnit: '30s',
                duration: '5m',
                preAllocatedVUs: 1, maxVUs: 4,
            },
        },
        thresholds: {
            http_req_duration: ['med<2000', 'p(95)<5000'],
            http_req_failed:   ['rate<0.01'],
        },
    };

export default function () {
    const res = http.post(
        `${BASE_URL}/api/alerts/run-monitoring`,
        null,
        { headers: { authorization: `Bearer ${CRON_SECRET}` } },
    );
    check(res, { '2xx': (r) => r.status >= 200 && r.status < 300 });
}
