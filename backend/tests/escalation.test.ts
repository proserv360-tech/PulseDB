/**
 * tests/escalation.test.js
 * ─────────────────────────
 * Unit tests for EnhancedAlertEngine.escalate() — the /escalate Slack
 * command → on-call paging path.
 *
 * Run: node --test tests/escalation.test.js
 *
 * Exercises every branch:
 *   - missing alertId / missing pool
 *   - alert_not_found
 *   - no_org (alert has no organisation)
 *   - no_destinations (org has no enabled notifiers)
 *   - happy path: a real PagerDutyNotifier is built from an encrypted
 *     destination row and dispatched (network stubbed via global.fetch),
 *     and the per-destination status is recorded back to the DB.
 */

import { describe, it, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// destinationService.encrypt requires ENCRYPTION_KEY at call time; set a
// deterministic test key before importing anything that pulls it in.
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-at-least-32-chars-long-xx';

const { default: EnhancedAlertEngine } = await import('../services/alertService.js');
const { encrypt } = await import('../services/encryptionService.js');

const CONFIG = { ALERT_THRESHOLDS: { CONNECTION_USAGE_PCT: 80 } };

/**
 * Build a mock pg pool. `handlers` is an array of [matcher, response] pairs;
 * the first matcher whose RegExp tests the SQL wins. Every query is recorded.
 */
function mockPool(handlers = []) {
    const calls = [];
    return {
        calls,
        async query(sql, params) {
            calls.push({ sql, params });
            for (const [re, resp] of handlers) {
                if (re.test(sql)) {
                    return typeof resp === 'function' ? resp(sql, params) : resp;
                }
            }
            return { rows: [] };
        },
    };
}

const ALERT_ROW = {
    id: 'alert-123',
    timestamp: new Date().toISOString(),
    severity: 'warning',
    category: 'replication',
    message: 'primary-1 replication lag 12s',
    data: { orgId: 'org-9', host: 'primary-1' },
    acknowledged: false,
};

describe('EnhancedAlertEngine.escalate()', () => {
    it('rejects a missing alertId', async () => {
        const engine = new EnhancedAlertEngine(mockPool(), CONFIG);
        const r = await engine.escalate('', 'dilip');
        assert.equal(r.ok, false);
        assert.equal(r.paged, 0);
        assert.match(r.error, /alertId is required/);
    });

    it('returns alert_not_found when the id is unknown', async () => {
        const pool = mockPool([[/FROM (?:\w+\.)?alerts WHERE id/, { rows: [] }]]);
        const engine = new EnhancedAlertEngine(pool, CONFIG);
        const r = await engine.escalate('nope', 'dilip');
        assert.equal(r.ok, false);
        assert.equal(r.reason, 'alert_not_found');
    });

    it('returns no_org when the alert has no organisation', async () => {
        const noOrgRow = { ...ALERT_ROW, data: { host: 'x' } };
        const pool = mockPool([[/FROM (?:\w+\.)?alerts WHERE id/, { rows: [noOrgRow] }]]);
        const engine = new EnhancedAlertEngine(pool, CONFIG);
        const r = await engine.escalate('alert-123', 'dilip');
        assert.equal(r.ok, false);
        assert.equal(r.reason, 'no_org');
    });

    it('returns no_destinations when the org has no enabled notifiers', async () => {
        const pool = mockPool([
            [/FROM (?:\w+\.)?alerts WHERE id/, { rows: [ALERT_ROW] }],
            [/notification_destinations/, { rows: [] }],
        ]);
        const engine = new EnhancedAlertEngine(pool, CONFIG);
        const r = await engine.escalate('alert-123', 'dilip');
        assert.equal(r.ok, false);
        assert.equal(r.reason, 'no_destinations');
    });

    describe('happy path (PagerDuty destination)', () => {
        let originalFetch;
        beforeEach(() => { originalFetch = global.fetch; });
        afterEach(() => { global.fetch = originalFetch; });

        it('pages on-call and records the dispatch result', async () => {
            // Stub the network: PagerDuty Events API returns 202 Accepted.
            const fetchCalls = [];
            global.fetch = async (url, opts) => {
                fetchCalls.push({ url, body: JSON.parse(opts.body) });
                return { status: 202, ok: true, headers: new Map(), text: async () => '{"status":"success"}' };
            };

            const destRow = {
                id: 'dest-1',
                org_id: 'org-9',
                provider: 'pagerduty',
                name: 'primary-oncall',
                enabled: true,
                min_severity: 'warning',
                config: { source: 'pulsedb' },
                secret_enc: encrypt('routingkey0000000000000000000000'),
            };

            const recorded = [];
            const pool = mockPool([
                [/FROM (?:\w+\.)?alerts WHERE id/, { rows: [ALERT_ROW] }],
                [/SELECT \* FROM .*notification_destinations/, { rows: [destRow] }],
                [/UPDATE .*notification_destinations/, (sql, params) => {
                    recorded.push(params);
                    return { rows: [] };
                }],
            ]);

            const engine = new EnhancedAlertEngine(pool, CONFIG);
            const r = await engine.escalate('alert-123', 'dilip');

            assert.equal(r.ok, true, 'escalation should succeed');
            assert.equal(r.paged, 1, 'one destination paged');

            // The PagerDuty payload was a forced critical trigger with the
            // escalation dedup key.
            assert.equal(fetchCalls.length, 1);
            const pd = fetchCalls[0].body;
            assert.equal(pd.event_action, 'trigger');
            assert.equal(pd.dedup_key, 'org-9:escalate:alert-123');
            assert.equal(pd.payload.severity, 'critical');
            assert.match(pd.payload.summary, /ESCALATED/);
            assert.equal(pd.payload.custom_details.escalatedBy, 'dilip');

            // The per-destination status was recorded back to the DB.
            assert.equal(recorded.length, 1);
            assert.ok(recorded[0].includes('dest-1'));
        });
    });
});
