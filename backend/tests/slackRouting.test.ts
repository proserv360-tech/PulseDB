// @ts-nocheck
/**
 * tests/slackRouting.test.ts
 * ──────────────────────────
 * Tests for _orgHasSlackDestination() — the check that decides whether the
 * legacy global SLACK_WEBHOOK_URL should fire alongside the per-org fan-out.
 *
 * Why it matters: both paths deliver to Slack, and both were firing. With a
 * Slack destination configured AND SLACK_WEBHOOK_URL set — the normal state
 * after following the setup docs — every alert arrived in the channel twice.
 *
 * The failure mode to protect against is not just the duplicate. It is the
 * opposite one: over-suppressing and dropping alerts entirely. So the error
 * path is asserted as carefully as the happy path.
 *
 * Run: npm test -- tests/slackRouting.test.ts
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-at-least-32-chars-long-xx';

const { default: EnhancedAlertEngine } = await import('../services/alertService.js');

const hasSlackDestination = EnhancedAlertEngine.prototype._orgHasSlackDestination;

/** Minimal `this` — the method only touches this.pool and its own cache. */
function context(queryImpl) {
    const calls = [];
    return {
        calls,
        ctx: {
            pool: {
                query: async (sql, params) => {
                    calls.push({ sql, params });
                    return queryImpl(sql, params);
                },
            },
        },
    };
}

const rows = (n) => async () => ({ rows: Array.from({ length: n }, () => ({ '?column?': 1 })) });
const throws = (message) => async () => { throw new Error(message); };

describe('_orgHasSlackDestination', () => {
    let clock;

    beforeEach(() => {
        clock = Date.now;
    });

    it('reports true when the org has an enabled Slack destination', async () => {
        const { ctx } = context(rows(1));
        assert.equal(await hasSlackDestination.call(ctx, 1), true);
    });

    it('reports false when the org has none', async () => {
        const { ctx } = context(rows(0));
        assert.equal(await hasSlackDestination.call(ctx, 1), false);
    });

    it('only counts enabled Slack rows for this org', async () => {
        const { ctx, calls } = context(rows(1));
        await hasSlackDestination.call(ctx, 42);

        const { sql, params } = calls[0];
        assert.match(sql, /provider\s*=\s*'slack'/);
        assert.match(sql, /enabled\s*=\s*true/);
        assert.match(sql, /org_id\s*=\s*\$1/);
        assert.deepEqual(params, [42]);
    });

    it('reports false when the destinations table does not exist', async () => {
        // Databases that never ran migration 0025. This is exactly the
        // single-tenant case the global webhook exists to serve, so false is
        // the correct answer, not merely the safe one.
        const { ctx } = context(throws('relation "pgmonitoringtool.notification_destinations" does not exist'));
        assert.equal(await hasSlackDestination.call(ctx, 1), false);
    });

    it('reports false when the query fails, so alerts still go out', async () => {
        // Prefer a possible duplicate over a dropped alert: a message arriving
        // twice is annoying, one that never arrives is an outage nobody hears.
        const { ctx } = context(throws('connection terminated unexpectedly'));
        assert.equal(await hasSlackDestination.call(ctx, 1), false);
    });

    it('caches within the TTL rather than querying per alert', async () => {
        const { ctx, calls } = context(rows(1));
        await hasSlackDestination.call(ctx, 1);
        await hasSlackDestination.call(ctx, 1);
        await hasSlackDestination.call(ctx, 1);
        assert.equal(calls.length, 1, 'expected one query for three consecutive alerts');
    });

    it('caches per org, not globally', async () => {
        // Multi-tenant: one org having Slack must not suppress another's.
        const { ctx, calls } = context(async (_sql, [orgId]) => ({ rows: orgId === 1 ? [{ x: 1 }] : [] }));
        assert.equal(await hasSlackDestination.call(ctx, 1), true);
        assert.equal(await hasSlackDestination.call(ctx, 2), false);
        assert.equal(calls.length, 2);
    });

    it('re-queries once the TTL expires', async () => {
        const { ctx, calls } = context(rows(1));
        await hasSlackDestination.call(ctx, 1);

        Date.now = () => clock() + 61_000; // TTL is 60s
        try {
            await hasSlackDestination.call(ctx, 1);
        } finally {
            Date.now = clock;
        }

        assert.equal(calls.length, 2, 'expected a refresh after the TTL lapsed');
    });

    it('caches a negative result too', async () => {
        // Otherwise every alert on a single-tenant deployment pays for a query
        // that will keep returning nothing.
        const { ctx, calls } = context(rows(0));
        await hasSlackDestination.call(ctx, 1);
        await hasSlackDestination.call(ctx, 1);
        assert.equal(calls.length, 1);
    });
});
