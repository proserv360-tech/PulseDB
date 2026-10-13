/**
 * tests/notifiers.test.js
 * ────────────────────────
 * Unit tests for the alert notifier suite.
 *
 * Run: node --test tests/notifiers.test.js
 *
 * The suite exercises:
 *   - severity gating on BaseNotifier
 *   - PagerDuty / Opsgenie / Teams payload shapes
 *   - Webhook HMAC signing + verification round-trip
 *   - NotifierManager: fan-out, dedupe, and retry with exponential backoff
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BaseNotifier, SEVERITY_RANK } from '../services/notifiers/baseNotifier.js';
import { PagerDutyNotifier } from '../services/notifiers/pagerdutyNotifier.js';
import { OpsgenieNotifier } from '../services/notifiers/opsgenieNotifier.js';
import { TeamsNotifier } from '../services/notifiers/teamsNotifier.js';
import { WebhookNotifier, verifyWebhookSignature } from '../services/notifiers/webhookNotifier.js';
import { NotifierManager } from '../services/notifiers/notifierManager.js';

// ── Mock http function that records calls and returns scripted responses ───
function createMockHttp(scripts = [{ status: 202 }]) {
    let callIdx = 0;
    const calls = [];
    const fn = async (req) => {
        calls.push(req);
        const s = scripts[Math.min(callIdx, scripts.length - 1)];
        callIdx += 1;
        if (s.throw) throw s.throw;
        return { status: s.status, headers: {}, body: s.body || '' };
    };
    fn.calls = calls;
    return fn;
}

const mkAlert = (overrides = {}) => ({
    id: 'a-1',
    severity: 'critical',
    title: 'Replication lag exceeded 10s',
    message: 'primary-1 lag=12.3s for 2m',
    source: 'fathom',
    component: 'primary-1',
    metadata: { host: 'primary-1', lag_seconds: 12.3 },
    ...overrides,
});

// ── BaseNotifier ──────────────────────────────────────────────────────────
describe('BaseNotifier', () => {
    it('gates on minSeverity', () => {
        const n = new BaseNotifier({ name: 'test', minSeverity: 'warning' });
        assert.equal(n.accepts({ severity: 'info' }), false);
        assert.equal(n.accepts({ severity: 'warning' }), true);
        assert.equal(n.accepts({ severity: 'critical' }), true);
    });

    it('send() returns skipped result when below threshold', async () => {
        const n = new BaseNotifier({ name: 'test', minSeverity: 'critical' });
        const r = await n.send({ severity: 'info' });
        assert.equal(r.ok, true);
        assert.equal(r.skipped, true);
    });

    it('SEVERITY_RANK orders debug<info<warning<error<critical', () => {
        assert.ok(SEVERITY_RANK.debug < SEVERITY_RANK.info);
        assert.ok(SEVERITY_RANK.info < SEVERITY_RANK.warning);
        assert.ok(SEVERITY_RANK.warning < SEVERITY_RANK.error);
        assert.ok(SEVERITY_RANK.error < SEVERITY_RANK.critical);
    });
});

// ── PagerDuty ─────────────────────────────────────────────────────────────
describe('PagerDutyNotifier', () => {
    it('posts a trigger event with dedup_key=alert.id', async () => {
        const http = createMockHttp([{ status: 202 }]);
        const n = new PagerDutyNotifier({ routingKey: 'rk-xxx', http });
        const r = await n.send(mkAlert());
        assert.equal(r.ok, true);
        assert.equal(http.calls.length, 1);
        const body = JSON.parse(http.calls[0].body);
        assert.equal(body.routing_key, 'rk-xxx');
        assert.equal(body.event_action, 'trigger');
        assert.equal(body.dedup_key, 'a-1');
        assert.equal(body.payload.severity, 'critical');
    });

    it('posts a resolve event when alert.resolved=true', async () => {
        const http = createMockHttp([{ status: 202 }]);
        const n = new PagerDutyNotifier({ routingKey: 'rk-xxx', http });
        await n.send(mkAlert({ resolved: true }));
        const body = JSON.parse(http.calls[0].body);
        assert.equal(body.event_action, 'resolve');
        assert.equal(body.dedup_key, 'a-1');
    });

    it('maps severity debug→info and error→error', async () => {
        const http = createMockHttp([{ status: 202 }, { status: 202 }]);
        const n = new PagerDutyNotifier({
            routingKey: 'rk', minSeverity: 'debug', http,
        });
        await n.send(mkAlert({ severity: 'debug' }));
        await n.send(mkAlert({ id: 'a-2', severity: 'error' }));
        assert.equal(JSON.parse(http.calls[0].body).payload.severity, 'info');
        assert.equal(JSON.parse(http.calls[1].body).payload.severity, 'error');
    });
});

// ── Opsgenie ──────────────────────────────────────────────────────────────
describe('OpsgenieNotifier', () => {
    it('uses GenieKey auth header and maps severity→priority', async () => {
        const http = createMockHttp([{ status: 202 }]);
        const n = new OpsgenieNotifier({ apiKey: 'secret', http });
        await n.send(mkAlert());
        assert.equal(http.calls[0].headers.Authorization, 'GenieKey secret');
        assert.equal(JSON.parse(http.calls[0].body).priority, 'P1');
    });

    it('closes the alert on resolved status', async () => {
        const http = createMockHttp([{ status: 202 }]);
        const n = new OpsgenieNotifier({ apiKey: 'secret', http });
        await n.send(mkAlert({ resolved: true }));
        assert.match(http.calls[0].url, /\/close\?identifierType=alias$/);
    });

    it('routes to EU region when euRegion=true', async () => {
        const http = createMockHttp([{ status: 202 }]);
        const n = new OpsgenieNotifier({ apiKey: 'secret', euRegion: true, http });
        await n.send(mkAlert());
        assert.match(http.calls[0].url, /api\.eu\.opsgenie\.com/);
    });
});

// ── Teams ─────────────────────────────────────────────────────────────────
describe('TeamsNotifier', () => {
    it('sends a MessageCard with facts drawn from metadata', async () => {
        const http = createMockHttp([{ status: 200 }]);
        const n = new TeamsNotifier({ webhookUrl: 'https://outlook/hook', http });
        await n.send(mkAlert());
        const body = JSON.parse(http.calls[0].body);
        assert.equal(body['@type'], 'MessageCard');
        assert.ok(Array.isArray(body.sections));
        const facts = body.sections[0].facts;
        const asObj = Object.fromEntries(facts.map((f) => [f.name, f.value]));
        assert.equal(asObj.Severity, 'CRITICAL');
        assert.equal(asObj.host, 'primary-1');
    });

    it('adds OpenUri action when alert.url is set', async () => {
        const http = createMockHttp([{ status: 200 }]);
        const n = new TeamsNotifier({ webhookUrl: 'https://outlook/hook', http });
        await n.send(mkAlert({ url: 'https://fathom.example.com/alerts/1' }));
        const body = JSON.parse(http.calls[0].body);
        assert.equal(body.potentialAction[0]['@type'], 'OpenUri');
    });
});

// ── Webhook HMAC signing ──────────────────────────────────────────────────
describe('WebhookNotifier', () => {
    it('attaches an HMAC signature and verifies end-to-end', async () => {
        const http = createMockHttp([{ status: 200 }]);
        const n = new WebhookNotifier({
            url: 'https://example.com/hook',
            secret: 'whsec_test',
            http,
        });
        const r = await n.send(mkAlert());
        assert.equal(r.ok, true);

        const sigHeader = http.calls[0].headers['X-FATHOM-Signature'];
        const rawBody = http.calls[0].body;
        // Extract the timestamp the signer used so the test is not clock-bound.
        const ts = Number(sigHeader.split(',')[0].split('=')[1]);
        const ok = verifyWebhookSignature({
            rawBody, header: sigHeader, secret: 'whsec_test',
            nowSeconds: ts, toleranceSeconds: 300,
        });
        assert.equal(ok, true);
    });

    it('rejects a tampered body', () => {
        const ok = verifyWebhookSignature({
            rawBody: '{"mutated":true}',
            header: 't=1700000000,v1=deadbeef',
            secret: 'whsec_test',
            nowSeconds: 1_700_000_000,
        });
        assert.equal(ok, false);
    });

    it('rejects a stale timestamp (replay protection)', async () => {
        const http = createMockHttp([{ status: 200 }]);
        const n = new WebhookNotifier({
            url: 'https://example.com/hook', secret: 'whsec_test', http,
        });
        await n.send(mkAlert());
        const header = http.calls[0].headers['X-FATHOM-Signature'];
        const rawBody = http.calls[0].body;
        const ts = Number(header.split(',')[0].split('=')[1]);
        const ok = verifyWebhookSignature({
            rawBody, header, secret: 'whsec_test',
            nowSeconds: ts + 10_000, toleranceSeconds: 300,
        });
        assert.equal(ok, false);
    });

    it('rejects a malformed header gracefully', () => {
        const ok = verifyWebhookSignature({
            rawBody: '{}', header: 'garbage', secret: 'whsec_test',
            nowSeconds: 1_700_000_000,
        });
        assert.equal(ok, false);
    });
});

// ── NotifierManager ───────────────────────────────────────────────────────
describe('NotifierManager', () => {
    it('fans out to every accepting notifier', async () => {
        const http = createMockHttp([{ status: 202 }, { status: 200 }]);
        const pd = new PagerDutyNotifier({ routingKey: 'rk', http });
        const tm = new TeamsNotifier({ webhookUrl: 'https://teams', http });
        const mgr = new NotifierManager({
            notifiers: [pd, tm], now: () => 0, sleep: async () => {},
        });
        const out = await mgr.dispatch(mkAlert());
        assert.equal(out.length, 2);
        assert.ok(out.every((d) => d.result.ok));
    });

    it('deduplicates within the window', async () => {
        const http = createMockHttp([{ status: 202 }, { status: 202 }]);
        const pd = new PagerDutyNotifier({ routingKey: 'rk', http });
        let t = 0;
        const mgr = new NotifierManager({
            notifiers: [pd], dedupeWindowMs: 5_000,
            now: () => t, sleep: async () => {},
        });
        await mgr.dispatch(mkAlert());
        t = 1_000;
        const second = await mgr.dispatch(mkAlert());
        assert.equal(second[0].result.deduped, true);
        assert.equal(http.calls.length, 1); // second was suppressed
    });

    it('fires again after the dedupe window has elapsed', async () => {
        const http = createMockHttp([{ status: 202 }, { status: 202 }]);
        const pd = new PagerDutyNotifier({ routingKey: 'rk', http });
        let t = 0;
        const mgr = new NotifierManager({
            notifiers: [pd], dedupeWindowMs: 5_000,
            now: () => t, sleep: async () => {},
        });
        await mgr.dispatch(mkAlert());
        t = 10_000; // past window
        const second = await mgr.dispatch(mkAlert());
        assert.equal(second[0].result.deduped, undefined);
        assert.equal(http.calls.length, 2);
    });

    it('retries on 5xx with exponential backoff and eventually succeeds', async () => {
        const http = createMockHttp([{ status: 500 }, { status: 502 }, { status: 202 }]);
        const pd = new PagerDutyNotifier({ routingKey: 'rk', http });
        const sleeps = [];
        const mgr = new NotifierManager({
            notifiers: [pd], maxRetries: 3, baseBackoffMs: 100,
            now: () => 0, sleep: async (ms) => { sleeps.push(ms); },
        });
        const out = await mgr.dispatch(mkAlert());
        assert.equal(out[0].result.ok, true);
        assert.equal(http.calls.length, 3);
        // Backoff doubles: 100, 200
        assert.deepEqual(sleeps, [100, 200]);
    });

    it('does not retry non-retryable 4xx', async () => {
        const http = createMockHttp([{ status: 400 }]);
        const pd = new PagerDutyNotifier({ routingKey: 'rk', http });
        const mgr = new NotifierManager({
            notifiers: [pd], maxRetries: 3,
            now: () => 0, sleep: async () => {},
        });
        const out = await mgr.dispatch(mkAlert());
        assert.equal(out[0].result.ok, false);
        assert.equal(http.calls.length, 1);
    });

    it('retries on 429 (rate limit)', async () => {
        const http = createMockHttp([{ status: 429 }, { status: 202 }]);
        const pd = new PagerDutyNotifier({ routingKey: 'rk', http });
        const mgr = new NotifierManager({
            notifiers: [pd], maxRetries: 3, baseBackoffMs: 10,
            now: () => 0, sleep: async () => {},
        });
        const out = await mgr.dispatch(mkAlert());
        assert.equal(out[0].result.ok, true);
        assert.equal(http.calls.length, 2);
    });

    it('clearDedupe(alertId) allows immediate re-fire', async () => {
        const http = createMockHttp([{ status: 202 }, { status: 202 }]);
        const pd = new PagerDutyNotifier({ routingKey: 'rk', http });
        let t = 0;
        const mgr = new NotifierManager({
            notifiers: [pd], dedupeWindowMs: 5_000,
            now: () => t, sleep: async () => {},
        });
        await mgr.dispatch(mkAlert());
        mgr.clearDedupe('a-1');
        t = 100;
        await mgr.dispatch(mkAlert());
        assert.equal(http.calls.length, 2);
    });
});
