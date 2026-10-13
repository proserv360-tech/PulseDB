import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchWaitEvents, normalizeEvent } from '../services/waitEventsService.js';

function adapter({ dbType, caps, waitImpl }) {
    const a = { dbType, getCapabilities: () => caps };
    if (waitImpl !== undefined) a.getWaitEvents = waitImpl;
    return a;
}

test('normalizeEvent canonicalizes event name from various keys', () => {
    assert.equal(normalizeEvent({ event: 'IO' }).event, 'IO');
    assert.equal(normalizeEvent({ wait_type: 'PAGEIOLATCH' }).event, 'PAGEIOLATCH');
    assert.equal(normalizeEvent({ name: 'lock' }).event, 'lock');
    assert.equal(normalizeEvent({}).event, 'unknown');
    assert.equal(normalizeEvent(null), null);
});

test('normalizeEvent converts micros to ms', () => {
    const e = normalizeEvent({ event: 'x', micros: 2500 });
    assert.equal(e.ms, 2.5);
});

test('normalizeEvent preserves waiter counts', () => {
    const e = normalizeEvent({ event: 'x', waiters: 7 });
    assert.equal(e.waiters, 7);
});

test('fetchWaitEvents returns supported:false when capability is off', async () => {
    const a = adapter({ dbType: 'bigquery', caps: { waitEvents: false } });
    const out = await fetchWaitEvents(a);
    assert.equal(out.supported, false);
    assert.equal(out.engine, 'bigquery');
    assert.deepEqual(out.events, []);
    assert.match(out.note, /not supported/);
});

test('fetchWaitEvents returns supported:false when impl is missing despite capability', async () => {
    const a = adapter({ dbType: 'weird', caps: { waitEvents: true } }); // no getWaitEvents
    const out = await fetchWaitEvents(a);
    assert.equal(out.supported, false);
    assert.match(out.note, /implements no getWaitEvents/);
});

test('fetchWaitEvents returns + sorts events by ms desc for a capable engine', async () => {
    const a = adapter({
        dbType: 'oracle',
        caps: { waitEvents: true },
        waitImpl: async () => ({
            window: '1h',
            events: [
                { event: 'db file sequential read', ms: 40 },
                { event: 'log file sync', ms: 120 },
                { event: 'CPU', ms: 10 },
            ],
        }),
    });
    const out = await fetchWaitEvents(a);
    assert.equal(out.supported, true);
    assert.equal(out.engine, 'oracle');
    assert.equal(out.window, '1h');
    assert.deepEqual(
        out.events.map((e) => e.event),
        ['log file sync', 'db file sequential read', 'CPU'],
    );
});

test('fetchWaitEvents normalizes mixed micros/ms and passes through notes', async () => {
    const a = adapter({
        dbType: 'mssql',
        caps: { waitEvents: true },
        waitImpl: async () => ({
            window: 'since-startup',
            note: 'cumulative since restart',
            events: [
                { event: 'PAGEIOLATCH_SH', ms: 5 },
                { event: 'micro-wait', micros: 9000 }, // → 9ms, should sort above ms:5
            ],
        }),
    });
    const out = await fetchWaitEvents(a);
    assert.equal(out.note, 'cumulative since restart');
    assert.equal(out.events[0].event, 'micro-wait');
    assert.equal(out.events[0].ms, 9);
});

test('fetchWaitEvents rejects a non-adapter argument', async () => {
    await assert.rejects(() => fetchWaitEvents({}), /requires an adapter/);
    await assert.rejects(() => fetchWaitEvents(null), /requires an adapter/);
});
