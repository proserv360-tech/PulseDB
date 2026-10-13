/**
 * tests/integration/health.int.test.js
 * Supertest integration tests — boots the real Express app (no listen())
 * and exercises HTTP endpoints end-to-end through the middleware stack.
 *
 * Run: npm run test:integration
 * (uses --test-force-exit because server.js schedules cron timers)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const { default: app } = await import('../../server.js');

test('GET /api/health returns a structured health payload', async () => {
    const res = await request(app).get('/api/health');
    assert.ok([200, 503].includes(res.status), `unexpected status ${res.status}`);
    assert.match(res.headers['content-type'], /json/);
    assert.ok(['ok', 'degraded', 'error'].includes(res.body.controlPlane));
    assert.equal(typeof res.body.uptime, 'number');
    assert.equal(typeof res.body.memoryMB, 'number');
    assert.ok(res.body.timestamp);
});

test('unauthenticated request to a protected route is rejected', async () => {
    const res = await request(app).get('/api/users');
    assert.ok([401, 403, 404].includes(res.status), `unexpected status ${res.status}`);
});

test('login endpoint rejects missing credentials with 4xx', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    assert.ok(res.status >= 400 && res.status < 500, `unexpected status ${res.status}`);
});

test('rate-limit headers are present on API responses', async () => {
    const res = await request(app).get('/api/health');
    assert.ok(res.headers['x-ratelimit-limit'], 'missing X-RateLimit-Limit');
    assert.ok(res.headers['x-ratelimit-remaining'], 'missing X-RateLimit-Remaining');
});
