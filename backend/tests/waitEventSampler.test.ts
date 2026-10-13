/**
 * tests/waitEventSampler.test.js
 *
 * A3 — exercises the wait-event classifier without spinning up Postgres.
 * Integration with pg_stat_activity is covered by the manual smoke test
 * documented in backend/docs/WAIT_EVENTS.md.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { _internal } from '../services/waitEventSampler.js';

const { classify } = _internal;

test('A3 classify: null wait_event_type + active state => CPU', () => {
    assert.equal(classify('active', null), 'CPU');
    assert.equal(classify('active', ''), 'CPU');
    assert.equal(classify('active', undefined), 'CPU');
});

test('A3 classify: null wait_event_type + idle state => Other', () => {
    assert.equal(classify('idle in transaction', null), 'Other');
});

test('A3 classify: standard wait classes pass through', () => {
    for (const cls of ['IO', 'Lock', 'IPC', 'Client', 'BufferPin', 'Activity', 'Timeout']) {
        assert.equal(classify('active', cls), cls);
    }
});

test('A3 classify: LWLock collapses into Lock', () => {
    assert.equal(classify('active', 'LWLock'), 'Lock');
});

test('A3 classify: Extension and unknown become Other', () => {
    assert.equal(classify('active', 'Extension'), 'Other');
    assert.equal(classify('active', 'SomeNewType'), 'Other');
});
