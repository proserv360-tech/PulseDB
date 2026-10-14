// @ts-nocheck
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildAlerts,
    collectSqlServerView,
    parseDeadlock,
    recordPulse,
    SQL_SERVER_VIEWS,
} from '../services/sqlServerMonitor.js';

const BULK = 272696576;
const RAW = 65792;
const FRACTION = 537003264;
const FRACTION_BASE = 1073939712;

const counters = (batch, extra = []) => [
    { obj: 'Buffer Manager', counter_name: 'Buffer cache hit ratio', cntr_value: 45, cntr_type: FRACTION },
    { obj: 'Buffer Manager', counter_name: 'Buffer cache hit ratio base', cntr_value: 50, cntr_type: FRACTION_BASE },
    { obj: 'Buffer Manager', counter_name: 'Page life expectancy', cntr_value: 1234, cntr_type: RAW },
    { obj: 'SQL Statistics', counter_name: 'Batch Requests/sec', cntr_value: batch, cntr_type: BULK },
    ...extra,
];

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

test('exposes the ten screens', () => {
    assert.deepEqual(SQL_SERVER_VIEWS, [
        'overview', 'performance', 'querystore', 'sessions', 'storage', 'memory', 'io', 'backups', 'security', 'alwayson',
    ]);
});

test('pulse: ratio uses its base counter; rates need two samples at least 5 s apart', () => {
    const id = 'unit-pulse';
    const t0 = 1_000_000;
    const first = recordPulse(id, { counters: counters(1000), waits: [], io: [] }, t0);
    assert.equal(first.live.bufferCacheHitPct, 90);
    assert.equal(first.live.pageLifeExpectancy, 1234);
    assert.equal(first.live.batchPerSec, undefined);

    const tooSoon = recordPulse(id, { counters: counters(1100), waits: [], io: [] }, t0 + 1000);
    assert.equal(tooSoon.history.length, 0);

    const second = recordPulse(
        id,
        {
            counters: counters(3000),
            waits: [{ category: 'Lock', wait_ms: 5000, signal_ms: 0 }],
            io: [{ reads: 100, writes: 10, bytes_read: 0, bytes_written: 0, stall_read_ms: 500, stall_write_ms: 20 }],
        },
        t0 + 10_000,
    );
    assert.equal(second.live.batchPerSec, 200); // 2000 batches over 10 s
    assert.equal(second.history.length, 1);

    // A restart resets cumulative counters: no negative rates.
    const restarted = recordPulse(id, { counters: counters(5), waits: [], io: [] }, t0 + 20_000);
    assert.equal(restarted.live.batchPerSec, null);
});

test('one failing panel does not blank the others', async () => {
    const adapter = adapterReturning({
        dm_db_index_physical_stats: new Error('VIEW DATABASE STATE permission denied'),
        'TOP 100 s.name AS schema_name': [{ table_name: 't1' }],
    });
    const r = await collectSqlServerView(adapter, 'storage', 'unit-2');
    assert.match(r.errors.fragmentation, /permission denied/);
    assert.equal(r.data.fragmentation, null);
    assert.equal(r.data.tables.length, 1);
});

test('unknown view is a 404', async () => {
    await assert.rejects(collectSqlServerView(adapterReturning({}), 'nope', 'x'), (e) => e.status === 404);
});

test('deadlock report is turned into processes, victims and wait-for edges', () => {
    const xml = `<deadlock><victim-list><victimProcess id="p2"/></victim-list>
      <process-list>
        <process id="p1" spid="54" loginname="app" hostname="web1" currentdbname="Sales" lockMode="X" waitresource="KEY: 5:1" waittime="1200">
          <executionStack/><inputbuf>UPDATE Orders SET Status = 1 WHERE Id = 7 AND Total &gt; 0</inputbuf></process>
        <process id="p2" spid="64" loginname="app" currentdbname="Sales" lockMode="U">
          <inputbuf>UPDATE OrderLines SET Qty = 2</inputbuf></process>
      </process-list>
      <resource-list>
        <keylock hobtid="1" dbid="5" objectname="Sales.dbo.Orders" indexname="PK_Orders" id="l1" mode="X">
          <owner-list><owner id="p1" mode="X"/></owner-list><waiter-list><waiter id="p2" mode="U" requestType="wait"/></waiter-list>
        </keylock>
        <keylock hobtid="2" dbid="5" objectname="Sales.dbo.OrderLines" indexname="PK_Lines" id="l2" mode="X">
          <owner-list><owner id="p2" mode="X"/></owner-list><waiter-list><waiter id="p1" mode="X" requestType="wait"/></waiter-list>
        </keylock>
      </resource-list></deadlock>`;
    const d = parseDeadlock(xml);
    assert.deepEqual(d.victims, ['p2']);
    assert.equal(d.processes.length, 2);
    assert.equal(d.processes[0].spid, 54);
    assert.equal(d.processes[0].statement, 'UPDATE Orders SET Status = 1 WHERE Id = 7 AND Total > 0');
    assert.equal(d.processes[1].isVictim, true);
    assert.deepEqual(
        d.edges.map((e) => `${e.from}->${e.to}`),
        ['p2->p1', 'p1->p2'],
    );
    assert.equal(d.edges[0].resource, 'Sales.dbo.Orders / PK_Orders');
});

test('alerts: offline database, blocking, stale backups, and no backup guessing without msdb', () => {
    const now = Date.parse('2026-10-14T00:00:00Z');
    const data = {
        databases: [
            { name: 'Sales', state_desc: 'ONLINE', recovery_model_desc: 'FULL', page_verify_option_desc: 'CHECKSUM' },
            { name: 'Old', state_desc: 'SUSPECT' },
        ],
        activity: [{ blocked_requests: 2, longest_block_ms: 9000 }],
        backupAges: [{ database_name: 'Sales', last_full: '2026-09-01T00:00:00Z', last_log: null }],
    };
    const titles = buildAlerts(data, { pageLifeExpectancy: 120 }, now).map((a) => `${a.severity}:${a.title}`);
    assert.equal(titles[0], 'critical:Database Old is SUSPECT');
    assert.ok(titles.includes('warning:2 blocked request(s)'));
    assert.ok(titles.includes('warning:Page life expectancy is 120 s'));
    assert.ok(titles.includes('warning:Sales: last full backup 43 days ago'));
    assert.ok(titles.some((t) => t.startsWith('warning:Sales is in FULL recovery')));

    const noMsdb = buildAlerts({ ...data, backupAges: null }, null, now).map((a) => a.title);
    assert.ok(!noMsdb.some((t) => /backup/.test(t)));
});

test('security config is annotated with the recommended value', async () => {
    const adapter = adapterReturning({
        'FROM sys.configurations': [
            { name: 'xp_cmdshell', value_in_use: 1, configured_value: 1 },
            { name: 'clr strict security', value_in_use: 1, configured_value: 1 },
        ],
    });
    const r = await collectSqlServerView(adapter, 'security', 'unit-sec');
    const byName = Object.fromEntries(r.data.config.map((c) => [c.name, c]));
    assert.equal(byName.xp_cmdshell.at_risk, 1);
    assert.equal(byName['clr strict security'].at_risk, 0);
});

test('agent adapters get the whole screen, pulse included, as one batch', async () => {
    const calls = [];
    const adapter = {
        query: async () => {
            throw new Error('per-query path must not be used when queryMany exists');
        },
        queryMany: async (queries) => {
            calls.push(Object.keys(queries));
            return Object.fromEntries(
                Object.entries(queries).map(([name, sql]) =>
                    sql.includes('dm_db_index_physical_stats')
                        ? [name, { error: 'permission denied' }]
                        : [name, { rows: name === 'tables' ? [{ table_name: 't1' }] : [] }],
                ),
            );
        },
    };
    const r = await collectSqlServerView(adapter, 'storage', 'unit-batch');
    assert.equal(calls.length, 1);
    assert.ok(calls[0].includes('pulse:counters') && calls[0].includes('tables'));
    assert.equal(r.data.tables.length, 1);
    assert.equal(r.data.fragmentation, null);
    assert.match(r.errors.fragmentation, /permission denied/);
    assert.ok(!('pulse:counters' in r.data));
});
