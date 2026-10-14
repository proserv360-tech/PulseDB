// @ts-nocheck
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectSqlServerView, SQL_SERVER_VIEWS } from '../services/sqlServerMonitor.js';

const adapterReturning = (byMarker) => ({
    query: async (sql) => {
        for (const [marker, rows] of Object.entries(byMarker)) {
            if (sql.includes(marker)) {
                if (rows instanceof Error) throw rows;
                return { rows };
            }
        }
        return { rows: [] };
    },
});

test('exposes the four screens', () => {
    assert.deepEqual(SQL_SERVER_VIEWS, ['overview', 'performance', 'sessions', 'storage']);
});

test('overview: hit ratio uses its base counter; per-second rates need two samples', async () => {
    let batch = 1000;
    const adapter = {
        query: async (sql) => {
            if (sql.includes('dm_os_performance_counters')) {
                return {
                    rows: [
                        { counter_name: 'Buffer cache hit ratio', cntr_value: 45 },
                        { counter_name: 'Buffer cache hit ratio base', cntr_value: 50 },
                        { counter_name: 'Page life expectancy', cntr_value: 1234 },
                        { counter_name: 'Batch Requests/sec', cntr_value: (batch += 500) },
                        { counter_name: 'SQL Compilations/sec', cntr_value: 10 },
                    ],
                };
            }
            return { rows: [] };
        },
    };
    const first = await collectSqlServerView(adapter, 'overview', 'unit-1');
    assert.equal(first.data.metrics.bufferCacheHitPct, 90);
    assert.equal(first.data.metrics.pageLifeExpectancySec, 1234);
    assert.equal(first.data.metrics.batchRequestsPerSec, null);
    await new Promise((r) => setTimeout(r, 20));
    const second = await collectSqlServerView(adapter, 'overview', 'unit-1');
    assert.ok(second.data.metrics.batchRequestsPerSec > 0);
});

test('one failing panel does not blank the others', async () => {
    const adapter = adapterReturning({
        dm_db_index_physical_stats: new Error('VIEW DATABASE STATE permission denied'),
        dm_db_partition_stats: [{ table_name: 't1' }],
    });
    const r = await collectSqlServerView(adapter, 'storage', 'unit-2');
    assert.match(r.errors.fragmentation, /permission denied/);
    assert.equal(r.data.fragmentation, null);
    assert.equal(r.data.tables.length, 1);
});

test('unknown view is a 404', async () => {
    await assert.rejects(collectSqlServerView(adapterReturning({}), 'nope', 'x'), (e) => e.status === 404);
});
