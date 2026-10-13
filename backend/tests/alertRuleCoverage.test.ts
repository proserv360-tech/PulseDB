/**
 * tests/alertRuleCoverage.test.ts
 * ───────────────────────────────
 * Every alert rule must produce the structured format — not just bloat.
 *
 * The failure this guards against is silent: a rule with no `objects()` still
 * fires, still reaches Slack, and still looks fine. It just arrives as the old
 * one-line string with no incident number, no owner and no SLA, and nobody
 * notices until someone asks why that alert has no ticket. So the contract is
 * asserted per rule rather than trusted.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { EnhancedAlertEngine } from '../services/alertService.js';
import { mapPriority } from '../services/incidentService.js';

const CONFIG = {
    ALERT_THRESHOLDS: {
        CONNECTION_USAGE_PCT: 80,
        LONG_QUERY_SEC: 30,
        CACHE_HIT_RATIO: 95,
        REPLICATION_LAG_MB: 100,
        LOCK_COUNT: 5,
    },
    MONITORING_INTERVAL_MS: 60_000,
};

/** Metrics that trip every rule at once. */
const BREACHING_METRICS = {
    databaseName: 'MarketTimeDB',
    activeConnections: 97,
    maxConnections: 100,
    cacheHitRatio: '78.0',
    diskUsedGB: 240,
    blockingLocks: 14,
    replicationLag: 900 * 1024 * 1024,
    slowQueries: [
        { queryid: '4471', duration_sec: 412, query: 'SELECT * FROM orders WHERE ...' },
        { queryid: '9902', duration_sec: 44, query: 'UPDATE invoices SET ...' },
    ],
    bloatedTables: [
        { schema_name: 'public', table_name: 'orders', bloat_ratio_pct: 62, dead_tuples: 8_200_000 },
        { schema_name: 'crm', table_name: 'customer_logs', bloat_ratio_pct: 38, dead_tuples: 640_000 },
    ],
    vacuumForecast: {
        summary: { overdue: 1, soon: 3 },
        tables: [
            { schema: 'audit', table: 'access_log', deadPct: 47, urgency: 'overdue' },
            { schema: 'public', table: 'sessions', deadPct: 5, urgency: 'soon' },
        ],
    },
    planRegressions: [{ queryId: 'q-17', slowdownPct: 320, connectionId: 3 }],
    pitrBreaches: [
        { connectionId: 3, lagHours: 9, rpoHours: 1 },
        { connectionId: 4, lagHours: null, reason: 'no base backup' },
    ],
};

function engine() {
    // The pool is never touched: these tests only exercise rule definitions.
    return new EnhancedAlertEngine({ query: async () => ({ rows: [] }) }, CONFIG);
}

describe('every alert rule supports the structured format', () => {
    const rules = engine().alertRules;

    it('has rules to check', () => {
        assert.ok(rules.length >= 9, `expected the full rule set, found ${rules.length}`);
    });

    for (const rule of rules) {
        describe(rule.id, () => {
            it('declares the structured contract', () => {
                assert.equal(typeof rule.objects, 'function', 'missing objects()');
                assert.ok(rule.metricLabel, 'missing metricLabel');
                assert.ok(rule.thresholds, 'missing thresholds');
                assert.ok(rule.objectType, 'missing objectType');
                assert.ok(rule.category, 'missing category');
            });

            it('fires on the breaching metrics', () => {
                assert.equal(rule.condition(BREACHING_METRICS), true);
            });

            it('produces at least one object with a usable measurement', () => {
                const objects = rule.objects(BREACHING_METRICS);
                assert.ok(Array.isArray(objects) && objects.length > 0, 'no objects produced');
                for (const o of objects) {
                    assert.ok(o.object, 'object has no name');
                    assert.ok(
                        Number.isFinite(Number(o.metricValue)),
                        `metricValue is not a finite number: ${o.metricValue}`,
                    );
                    assert.ok(o.metricDisplay, 'object has no display value');
                    assert.ok(o.fixSuggestion, 'object has no fix suggestion');
                }
            });

            it('maps its worst object to a real priority', () => {
                const thresholds = typeof rule.thresholds === 'function' ? rule.thresholds() : rule.thresholds;
                const objects = rule.objects(BREACHING_METRICS);
                const priorities = objects.map((o) => mapPriority(Number(o.metricValue), thresholds));
                // Every threshold set must have bands that the breaching values
                // actually reach — a rule whose worst case is still 'low' has
                // its thresholds wrong.
                assert.ok(
                    priorities.some((p) => p !== 'low'),
                    `all objects mapped to low; thresholds are miscalibrated: ${JSON.stringify(thresholds)}`,
                );
            });

            it('still has a plain-text message as the fallback', () => {
                assert.equal(typeof rule.message, 'function');
                const text = rule.message(BREACHING_METRICS);
                assert.ok(typeof text === 'string' && text.length > 0);
            });
        });
    }
});

describe('rule-specific behaviour', () => {
    const byId = Object.fromEntries(engine().alertRules.map((r) => [r.id, r]));

    it('has no duplicate rule covering connection usage', () => {
        // high_connections absorbed critical_connections. Two rules over one
        // metric meant a database at 96% opened two incidents for one problem.
        const ids = engine().alertRules.map((r) => r.id);
        assert.equal(ids.includes('critical_connections'), false);
        assert.equal(ids.filter((i) => i === 'high_connections').length, 1);
    });

    it('ranks cache hit ratio by miss, so lower is worse', () => {
        const rule = byId.low_cache_hit;
        const [o] = rule.objects(BREACHING_METRICS);
        // 78% hit is a 22% miss — critical, not low.
        assert.equal(Math.round(o.metricValue), 22);
        assert.equal(mapPriority(o.metricValue, rule.thresholds()), 'critical');
    });

    it('treats an infeasible PITR as worse than any measurable lag', () => {
        const rule = byId.pitr_rpo_breach;
        const objects = rule.objects(BREACHING_METRICS);
        const infeasible = objects.find((o) => o.metricDisplay === 'not feasible');
        assert.equal(mapPriority(infeasible.metricValue, rule.thresholds()), 'critical');
    });

    it('keys slow queries on queryid, not the query text', () => {
        // Query text changes with parameters; an incident keyed on it would
        // reopen on every execution.
        const [o] = byId.slow_queries.objects(BREACHING_METRICS);
        assert.match(o.object, /^query 4471$/);
    });

    it('only reports tables that are actually overdue for vacuum', () => {
        const objects = byId.vacuum_overdue.objects(BREACHING_METRICS);
        assert.equal(objects.length, 1);
        assert.equal(objects[0].object, 'access_log');
    });

    it('emits runnable, quoted SQL where a statement makes sense', () => {
        for (const id of ['high_bloat', 'vacuum_overdue']) {
            for (const o of byId[id].objects(BREACHING_METRICS)) {
                assert.ok(o.fixSql, `${id} produced no SQL`);
                assert.match(o.fixSql, /^VACUUM \(/);
                assert.match(o.fixSql, /"/);
                assert.match(o.fixSql, /;$/);
            }
        }
    });

    it('escalates bloat to critical past 60 percent', () => {
        const rule = byId.high_bloat;
        const [worst] = rule.objects(BREACHING_METRICS);
        assert.equal(mapPriority(worst.metricValue, rule.thresholds()), 'critical');
        assert.match(worst.fixSuggestion, /FULL/);
    });
});

describe('quiet metrics fire nothing', () => {
    it('no rule condition holds on a healthy database', () => {
        const healthy = {
            databaseName: 'MarketTimeDB',
            activeConnections: 10, maxConnections: 100,
            cacheHitRatio: '99.4', diskUsedGB: 4, blockingLocks: 0,
            replicationLag: 0, slowQueries: [], bloatedTables: [],
            vacuumForecast: { summary: { overdue: 0, soon: 0 }, tables: [] },
            planRegressions: [], pitrBreaches: [],
        };
        for (const rule of engine().alertRules) {
            assert.equal(rule.condition(healthy), false, `${rule.id} fired on healthy metrics`);
        }
    });
});
