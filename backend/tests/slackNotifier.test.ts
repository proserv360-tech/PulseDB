/**
 * tests/slackNotifier.test.js
 * ────────────────────────────
 * Unit tests for the multi-tenant SlackNotifier. Exercises both delivery
 * modes (incoming webhook and Bot API) and the payload builder.
 *
 * Run:
 *   node --test tests/slackNotifier.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SlackNotifier, buildSlackBlocks } from '../services/notifiers/slackNotifier.js';

/* ── Helpers ─────────────────────────────────────────────────────────── */

function createMockHttp(scripts = [{ status: 200, body: '{"ok":true,"ts":"123.456","channel":"C1"}' }]) {
    let idx = 0;
    const calls = [];
    const fn = async (req) => {
        calls.push(req);
        const s = scripts[Math.min(idx, scripts.length - 1)];
        idx += 1;
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
    source: 'pulsedb',
    component: 'primary-1',
    timestamp: '2026-04-22T10:00:00.000Z',
    metadata: { host: 'primary-1', lag_seconds: 12.3 },
    ...overrides,
});

/* ── Construction ────────────────────────────────────────────────────── */

describe('SlackNotifier — construction', () => {
    it('rejects empty credentials', () => {
        assert.throws(() => new SlackNotifier({}), /webhookUrl OR/);
    });

    it('rejects a bot token that does not look like one', () => {
        assert.throws(
            () => new SlackNotifier({ botToken: 'not-a-real-token', channel: 'C1' }),
            /must look like a Slack OAuth token/
        );
    });

    it('accepts a webhookUrl alone', () => {
        const n = new SlackNotifier({ webhookUrl: 'https://hooks.slack.com/services/x/y/z' });
        assert.equal(n.name, 'slack');
        assert.equal(n.webhookUrl, 'https://hooks.slack.com/services/x/y/z');
        assert.equal(n.botToken, null);
    });

    it('accepts botToken + channel', () => {
        const n = new SlackNotifier({ botToken: 'xoxb-abc', channel: 'C123' });
        assert.equal(n.botToken, 'xoxb-abc');
        assert.equal(n.channel, 'C123');
    });
});

/* ── Payload shape ───────────────────────────────────────────────────── */

describe('SlackNotifier — payload', () => {
    it('includes a header, title, and metadata block', () => {
        const body = buildSlackBlocks(mkAlert());
        assert.ok(Array.isArray(body.attachments));
        assert.equal(body.attachments.length, 1);
        const blocks = body.attachments[0].blocks;
        const types = blocks.map(b => b.type);
        assert.ok(types.includes('header'));
        assert.ok(types.includes('section'));
        // Metadata renders as readable markup, not a JSON code fence — the
        // fence was replaced because a raw dump is unreadable on call.
        const md = blocks.find(b => b.text?.text?.includes('lag_seconds'));
        assert.ok(md, 'expected a metadata block mentioning lag_seconds');
        assert.ok(!md.text.text.includes('```'), 'metadata should no longer be a JSON code block');
        assert.match(md.text.text, /\*lag_seconds\*: /, 'expected `*key*: value` formatting');
    });

    it('emits a resolved color when alert.resolved', () => {
        const body = buildSlackBlocks(mkAlert({ resolved: true }));
        assert.equal(body.attachments[0].color, '#22C55E');
    });

    it('renders dashboard + runbook buttons when links are supplied', () => {
        const body = buildSlackBlocks(mkAlert({
            dashboardUrl: 'https://pulsedb.example/d/1',
            runbookUrl: 'https://wiki.example/runbooks/pg',
        }));
        const actionBlock = body.attachments[0].blocks.find(b => b.type === 'actions');
        assert.ok(actionBlock, 'expected an actions block');
        assert.equal(actionBlock.elements.length, 2);
    });

    it('truncates oversized metadata to stay within Slack limits', () => {
        const huge = {};
        for (let i = 0; i < 500; i++) huge[`key${i}`] = 'x'.repeat(10);
        const body = buildSlackBlocks(mkAlert({ metadata: huge }));
        const md = body.attachments[0].blocks.find(b => b.text?.text?.startsWith('*Details*'));
        assert.ok(md, 'expected a Details block');
        // Slack rejects any block over 3000 chars; the renderer caps at 2600
        // and appends a marker so the truncation is visible rather than silent.
        assert.ok(md.text.text.length < 3000, `block was ${md.text.text.length} chars`);
        assert.ok(md.text.text.includes('…truncated'), 'expected a truncation marker');
    });
});

/* ── Webhook path ────────────────────────────────────────────────────── */

describe('SlackNotifier — webhook path', () => {
    it('POSTs JSON to the webhook URL and returns ok on 200', async () => {
        const http = createMockHttp([{ status: 200, body: 'ok' }]);
        const n = new SlackNotifier({
            webhookUrl: 'https://hooks.slack.com/services/T/B/X',
            http,
        });
        const r = await n.send(mkAlert());
        assert.equal(r.ok, true);
        assert.equal(r.status, 200);
        assert.equal(http.calls.length, 1);
        assert.equal(http.calls[0].url, 'https://hooks.slack.com/services/T/B/X');
        assert.equal(http.calls[0].method, 'POST');
        const body = JSON.parse(http.calls[0].body);
        assert.ok(body.attachments, 'expected Block Kit attachments');
    });

    it('returns not-ok on 4xx/5xx from the webhook', async () => {
        const http = createMockHttp([{ status: 500, body: 'boom' }]);
        const n = new SlackNotifier({
            webhookUrl: 'https://hooks.slack.com/services/T/B/X',
            http,
        });
        const r = await n.send(mkAlert());
        assert.equal(r.ok, false);
        assert.equal(r.status, 500);
        assert.match(r.detail, /HTTP 500/);
    });
});

/* ── Bot API path ─────────────────────────────────────────────────────── */

describe('SlackNotifier — bot API path', () => {
    it('sends Authorization: Bearer and interprets {ok:true} as success', async () => {
        const http = createMockHttp([
            { status: 200, body: '{"ok":true,"ts":"123.456","channel":"C999"}' },
        ]);
        const n = new SlackNotifier({
            botToken: 'xoxb-abcdef',
            channel: 'C999',
            http,
        });
        const r = await n.send(mkAlert());
        assert.equal(r.ok, true);
        assert.equal(r.ts, '123.456');
        assert.equal(r.channel, 'C999');
        assert.equal(
            http.calls[0].headers.Authorization,
            'Bearer xoxb-abcdef'
        );
        const sent = JSON.parse(http.calls[0].body);
        assert.equal(sent.channel, 'C999');
    });

    it('interprets {ok:false,error:channel_not_found} as failure', async () => {
        const http = createMockHttp([
            { status: 200, body: '{"ok":false,"error":"channel_not_found"}' },
        ]);
        const n = new SlackNotifier({
            botToken: 'xoxb-abcdef',
            channel: 'C-missing',
            http,
        });
        const r = await n.send(mkAlert());
        assert.equal(r.ok, false);
        assert.equal(r.slackError, 'channel_not_found');
    });

    it('passes thread_ts when configured', async () => {
        const http = createMockHttp([
            { status: 200, body: '{"ok":true,"ts":"2","channel":"C1"}' },
        ]);
        const n = new SlackNotifier({
            botToken: 'xoxb-x',
            channel: 'C1',
            threadTs: '1.234',
            http,
        });
        await n.send(mkAlert());
        const sent = JSON.parse(http.calls[0].body);
        assert.equal(sent.thread_ts, '1.234');
    });
});

/* ── Severity gate ───────────────────────────────────────────────────── */

describe('SlackNotifier — severity gate', () => {
    it('skips alerts below minSeverity', async () => {
        const http = createMockHttp();
        const n = new SlackNotifier({
            webhookUrl: 'https://hooks.slack.com/services/a/b/c',
            minSeverity: 'critical',
            http,
        });
        const r = await n.send(mkAlert({ severity: 'warning' }));
        assert.equal(r.ok, true);
        assert.equal(r.skipped, true);
        assert.equal(http.calls.length, 0);
    });
});
