/**
 * tests/destinationService.test.js
 * ─────────────────────────────────
 * Unit tests for destinationService, covering:
 *   - input validation (per-provider required fields)
 *   - encryption at rest (secret never leaves the DB plaintext)
 *   - buildNotifierFromRow routes to the correct notifier class
 *   - CRUD operations against an in-memory fake pool
 *
 * The fake pool replays scripted responses for known SQL fragments so these
 * tests stay hermetic. They do not require a running Postgres.
 *
 * Run:
 *   ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))") \
 *     node --test tests/destinationService.test.js
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// The destinationService imports encryptionService, which refuses to load
// without ENCRYPTION_KEY. Fill it in for hermetic tests before importing.
if (!process.env.ENCRYPTION_KEY) {
    process.env.ENCRYPTION_KEY =
        'test-key-' + Buffer.from('x'.repeat(40)).toString('base64');
}
if (process.env.JWT_SECRET && process.env.JWT_SECRET === process.env.ENCRYPTION_KEY) {
    // encryptionService refuses ENCRYPTION_KEY === JWT_SECRET.
    process.env.JWT_SECRET = process.env.JWT_SECRET + '-distinct';
}

const ds = await import('../services/destinationService.js');
const enc = await import('../services/encryptionService.js');
const notifiers = await import('../services/notifiers/index.js');

/* ── Fake pg pool that records queries and replays scripted responses ── */

function makeFakePool() {
    const calls = [];
    const scripts = [];
    const pool = {
        query: async (text, params) => {
            calls.push({ text, params });
            const script = scripts.shift();
            if (!script) {
                throw new Error(
                    `unexpected query (no script left): ${text.slice(0, 80)}`
                );
            }
            if (typeof script === 'function') {
                return script({ text, params });
            }
            if (script.err) throw script.err;
            return { rows: script.rows || [], rowCount: script.rowCount ?? (script.rows?.length || 0) };
        },
    };
    return { pool, calls, queue: (resp) => scripts.push(resp), _scripts: scripts };
}

/* ── Validation ──────────────────────────────────────────────────────── */

describe('validateDestinationInput', () => {
    it('rejects missing name / provider on create', () => {
        assert.throws(() => ds.validateDestinationInput({}), /name is required/);
        assert.throws(() => ds.validateDestinationInput({ name: 'x' }), /provider is required/);
    });

    it('rejects unknown providers', () => {
        assert.throws(
            () => ds.validateDestinationInput({ name: 'x', provider: 'sms' }),
            /provider must be one of/
        );
    });

    it('rejects invalid severities', () => {
        assert.throws(
            () => ds.validateDestinationInput({ name: 'x', provider: 'slack', minSeverity: 'loud' }),
            /minSeverity must be one of/
        );
    });

    it('rejects Slack with neither webhookUrl nor channel+secret', () => {
        assert.throws(
            () => ds.validateDestinationInput({
                name: 'x', provider: 'slack', config: {},
            }),
            /slack destinations need/
        );
    });

    it('accepts Slack webhookUrl alone', () => {
        ds.validateDestinationInput({
            name: 'x',
            provider: 'slack',
            config: { webhookUrl: 'https://hooks.slack.com/services/T/B/Z' },
        });
    });

    it('rejects non-hooks.slack.com webhook URLs', () => {
        assert.throws(() => ds.validateDestinationInput({
            name: 'x',
            provider: 'slack',
            config: { webhookUrl: 'https://evil.example/hook' },
        }), /hooks\.slack\.com/);
    });

    it('requires routing key on pagerduty create', () => {
        assert.throws(
            () => ds.validateDestinationInput({ name: 'x', provider: 'pagerduty' }),
            /pagerduty destinations need secret=routingKey/
        );
    });

    it('requires url + secret on webhook', () => {
        assert.throws(
            () => ds.validateDestinationInput({ name: 'x', provider: 'webhook' }),
            /webhook destinations need config\.url/
        );
    });

    it('enforces http(s) scheme on webhook url', () => {
        assert.throws(() => ds.validateDestinationInput({
            name: 'x',
            provider: 'webhook',
            config: { url: 'ftp://example.com/hook' },
            secret: 's',
        }), /http\(s\)/);
    });
});

/* ── Row normaliser ──────────────────────────────────────────────────── */

describe('toClientDestination', () => {
    it('never exposes the encrypted secret itself', () => {
        const row = {
            id: 1, org_id: 10, name: 'ops', provider: 'slack',
            min_severity: 'warning', enabled: true, config: {},
            secret_enc: 'iv:tag:ct', created_by: 1, created_at: new Date(),
            updated_at: new Date(), last_used_at: null,
            last_status: null, last_error: null,
        };
        const out = ds.toClientDestination(row);
        assert.equal(out.hasSecret, true);
        assert.equal('secretEnc' in out, false);
        assert.equal('secret' in out, false);
    });
});

/* ── Encryption round-trip ────────────────────────────────────────────── */

describe('secret encryption at rest', () => {
    it('encrypts secret on write and decrypts on read via buildNotifierFromRow', () => {
        const secret = 'xoxb-SUPER-SECRET-BOT-TOKEN';
        const ciphertext = enc.encrypt(secret);
        assert.notEqual(ciphertext, secret);
        assert.ok(ciphertext.split(':').length === 3);

        const n = ds.buildNotifierFromRow({
            id: 1, org_id: 1, name: 'ops', provider: 'slack',
            min_severity: 'warning', enabled: true,
            config: { channel: 'C42' },
            secret_enc: ciphertext,
        });
        assert.ok(n instanceof notifiers.SlackNotifier);
        assert.equal(n.botToken, secret);
        assert.equal(n.channel, 'C42');
    });
});

/* ── buildNotifierFromRow routing ─────────────────────────────────────── */

describe('buildNotifierFromRow', () => {
    const baseRow = (provider, cfgOverride = {}, secret = 'xoxb-abc') => ({
        id: 1, org_id: 1, name: `n-${provider}`, provider,
        min_severity: 'warning', enabled: true,
        config: cfgOverride,
        secret_enc: secret ? enc.encrypt(secret) : null,
    });

    it('routes slack with webhookUrl to SlackNotifier (no secret required)', () => {
        const n = ds.buildNotifierFromRow({
            ...baseRow('slack', { webhookUrl: 'https://hooks.slack.com/services/T/B/Z' }, null),
        });
        assert.ok(n instanceof notifiers.SlackNotifier);
        assert.equal(n.webhookUrl, 'https://hooks.slack.com/services/T/B/Z');
    });

    it('routes pagerduty to PagerDutyNotifier', () => {
        const n = ds.buildNotifierFromRow(baseRow('pagerduty', {}, 'rk-123'));
        assert.ok(n instanceof notifiers.PagerDutyNotifier);
        assert.equal(n.routingKey, 'rk-123');
    });

    it('routes opsgenie to OpsgenieNotifier and honours region=eu', () => {
        const n = ds.buildNotifierFromRow(baseRow('opsgenie', { region: 'eu' }, 'og-key'));
        assert.ok(n instanceof notifiers.OpsgenieNotifier);
        assert.match(n.urlBase, /api\.eu\.opsgenie/);
    });

    it('routes teams to TeamsNotifier (no secret required)', () => {
        const n = ds.buildNotifierFromRow(baseRow('teams', {
            webhookUrl: 'https://outlook.office.com/webhook/x',
        }, null));
        assert.ok(n instanceof notifiers.TeamsNotifier);
    });

    it('routes webhook to WebhookNotifier', () => {
        const n = ds.buildNotifierFromRow(baseRow('webhook', {
            url: 'https://example.com/fathom',
        }, 'hmac-secret'));
        assert.ok(n instanceof notifiers.WebhookNotifier);
        assert.equal(n.url, 'https://example.com/fathom');
    });

    it('throws on unknown providers', () => {
        assert.throws(() =>
            ds.buildNotifierFromRow({ ...baseRow('slack', {}, 'x'), provider: 'fax' }),
        /unsupported provider/);
    });

    it('throws when a required secret is missing', () => {
        assert.throws(() =>
            ds.buildNotifierFromRow({ ...baseRow('pagerduty', {}, null) }),
        /missing routing key/);
    });
});

/* ── CRUD (fake pool) ─────────────────────────────────────────────────── */

describe('createDestination / listDestinations', () => {
    it('encrypts the secret and passes it through to INSERT', async () => {
        const { pool, calls, queue } = makeFakePool();
        queue({
            rows: [{
                id: 7, org_id: 42, name: 'ops-slack', provider: 'slack',
                min_severity: 'warning', enabled: true,
                config: { channel: 'C1' },
                secret_enc: null, // we don't care — we assert on input
                created_at: new Date(), updated_at: new Date(),
            }],
        });
        const out = await ds.createDestination(pool, 42, {
            name: 'ops-slack',
            provider: 'slack',
            config: { channel: 'C1' },
            secret: 'xoxb-bot-token',
        }, 99);
        assert.equal(out.id, 7);
        assert.equal(out.provider, 'slack');

        // The INSERT secret_enc parameter must be the encrypted form, NOT
        // plaintext, and must be decryptable back to the original.
        const secretEncParam = calls[0].params[6];
        assert.notEqual(secretEncParam, 'xoxb-bot-token');
        assert.equal(enc.decrypt(secretEncParam), 'xoxb-bot-token');
    });

    it('maps 23505 unique violation to a 409 error', async () => {
        const { pool, queue } = makeFakePool();
        const e = new Error('duplicate'); e.code = '23505';
        queue({ err: e });
        await assert.rejects(
            ds.createDestination(pool, 1, {
                name: 'dup',
                provider: 'slack',
                config: { webhookUrl: 'https://hooks.slack.com/services/T/B/Z' },
            }),
            (err) => err.status === 409,
        );
    });
});

describe('updateDestination', () => {
    it('skips the DB when no fields are supplied', async () => {
        const { pool, calls, queue } = makeFakePool();
        queue({ rows: [{
            id: 1, org_id: 1, name: 'n', provider: 'slack',
            min_severity: 'warning', enabled: true, config: {},
            secret_enc: null, created_at: new Date(), updated_at: new Date(),
        }]});
        const out = await ds.updateDestination(pool, 1, 1, {});
        assert.equal(out.id, 1);
        // The only query executed should be the fallback SELECT inside getDestination
        assert.equal(calls.length, 1);
        assert.match(calls[0].text, /SELECT \* FROM/);
    });

    it('preserves existing secret when `secret` key is absent from the patch', async () => {
        const { pool, calls, queue } = makeFakePool();
        queue({ rows: [{
            id: 1, org_id: 1, name: 'n2', provider: 'slack',
            min_severity: 'error', enabled: true, config: {},
            secret_enc: 'unchanged', created_at: new Date(), updated_at: new Date(),
        }]});
        await ds.updateDestination(pool, 1, 1, { name: 'n2', minSeverity: 'error' });
        // No `secret_enc = $N` in the SET clause.
        assert.doesNotMatch(calls[0].text, /secret_enc\s*=\s*\$/);
    });

    it('sets secret_enc=null when caller passes secret: null (clear)', async () => {
        const { pool, calls, queue } = makeFakePool();
        queue({ rows: [{
            id: 1, org_id: 1, name: 'n', provider: 'slack',
            min_severity: 'warning', enabled: true, config: {},
            secret_enc: null, created_at: new Date(), updated_at: new Date(),
        }]});
        await ds.updateDestination(pool, 1, 1, { secret: null });
        // secret_enc appears in the SET clause, with a null param.
        assert.match(calls[0].text, /secret_enc\s*=\s*\$/);
        const secretParam = calls[0].params[0];
        assert.equal(secretParam, null);
    });
});

describe('buildNotifiersForOrg', () => {
    it('skips rows that fail to decrypt/validate instead of throwing', async () => {
        const { pool, queue } = makeFakePool();
        // Two rows: one with a valid encrypted secret, one with corrupt ciphertext.
        queue({ rows: [
            {
                id: 1, org_id: 1, name: 'ok', provider: 'slack',
                min_severity: 'warning', enabled: true,
                config: { webhookUrl: 'https://hooks.slack.com/services/T/B/Z' },
                secret_enc: null,
            },
            {
                id: 2, org_id: 1, name: 'bad', provider: 'pagerduty',
                min_severity: 'warning', enabled: true,
                config: {},
                secret_enc: 'garbage:not:hex',
            },
        ]});
        const entries = await ds.buildNotifiersForOrg(pool, 1);
        // Only the valid row should have survived.
        assert.equal(entries.length, 1);
        assert.equal(entries[0].destId, 1);
        assert.ok(entries[0].notifier instanceof notifiers.SlackNotifier);
    });
});
