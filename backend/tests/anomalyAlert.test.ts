import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import EnhancedAlertEngine from '../services/alertService.js';
import { anomalyEvaluator } from '../services/anomaly/index.js';
const CONFIG = {
    ALERT_THRESHOLDS: {
        CONNECTION_USAGE_PCT: 80,
        LONG_QUERY_SEC: 30,
        CACHE_HIT_RATIO: 90,
        DEAD_TUPLE_RATIO: 20,
        REPLICATION_LAG_MB: 100,
        LOCK_COUNT: 5,
    },
};
function makeEngine() {
    const engine = new EnhancedAlertEngine({ query: async () => ({ rows: [] }) }, CONFIG);
    const fired = [];
    engine.fire = async (severity, category, message, data) => {
        fired.push({ severity, category, message, data });
    };
    return { engine, fired };
}
beforeEach(() => anomalyEvaluator.resetAll());
test('no-op when mode off', async () => {
    delete process.env.FATHOM_ANOMALY_MODE;
    const { engine, fired } = makeEngine();
    assert.deepEqual(await engine.evaluateAnomalies({ activeConnections: 5 }), []);
    assert.equal(fired.length, 0);
});
test('fires warning on spike in page mode', async () => {
    process.env.FATHOM_ANOMALY_MODE = 'page';
    const { engine, fired } = makeEngine();
    for (let i = 0; i < 40; i++) await engine.evaluateAnomalies({ activeConnections: 10 + (i % 2) });
    const before = fired.length;
    await engine.evaluateAnomalies({ activeConnections: 250 });
    const a = fired
        .slice(before)
        .filter((x) => x.category === 'anomaly' && x.data.metricKey === 'db.active_connections');
    assert.ok(a.length >= 1);
    assert.equal(a[0].severity, 'warning');
    assert.equal(a[0].data.suggestionOnly, false);
    delete process.env.FATHOM_ANOMALY_MODE;
});
test('suggest mode → info + suggestionOnly', async () => {
    process.env.FATHOM_ANOMALY_MODE = 'suggest';
    const { engine, fired } = makeEngine();
    for (let i = 0; i < 40; i++) await engine.evaluateAnomalies({ diskUsedGB: 20 });
    const before = fired.length;
    await engine.evaluateAnomalies({ diskUsedGB: 500 });
    const a = fired.slice(before).filter((x) => x.category === 'anomaly' && x.data.metricKey === 'db.disk_used_gb');
    assert.ok(a.length >= 1);
    assert.equal(a[0].severity, 'info');
    assert.equal(a[0].data.suggestionOnly, true);
    delete process.env.FATHOM_ANOMALY_MODE;
});
test('flat series never fires', async () => {
    process.env.FATHOM_ANOMALY_MODE = 'page';
    const { engine, fired } = makeEngine();
    for (let i = 0; i < 50; i++) await engine.evaluateAnomalies({ blockingLocks: 2 });
    assert.equal(fired.filter((x) => x.category === 'anomaly' && x.data.metricKey === 'db.blocking_locks').length, 0);
    delete process.env.FATHOM_ANOMALY_MODE;
});
