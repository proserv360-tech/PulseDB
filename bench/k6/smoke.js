/**
 * bench/k6/smoke.js — C7 nightly CI smoke variant.
 * Runs each scenario for 30s with relaxed thresholds. The full run
 * happens manually against a staging deployment.
 */
import http from 'k6/http';

export const options = {
    scenarios: {
        ping: { executor: 'constant-vus', vus: 1, duration: '10s' },
    },
    thresholds: {
        http_req_failed: ['rate<0.10'],
        http_req_duration: ['p(95)<1000'],
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

export default function () {
    http.get(`${BASE_URL}/api/health`);
}
