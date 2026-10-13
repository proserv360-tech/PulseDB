/**
 * tests/alertRcaService.test.js
 * C5 — pure-function tests for the signature/cost-cap logic. DB-touching
 * paths (assembleContext, runRcaJob persistence) are covered by the
 * manual smoke test documented in backend/docs/ARCHITECTURE.md.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { _internal } from '../services/alertRcaService.js';

const { signatureOf, RCA_QUEUE, WINDOW_MIN } = _internal;

test('C5: signature is deterministic across key-insertion order', () => {
    const a = { alertId: 'a', windowFrom: 't0', windowTo: 't1', waitEvents: [], recentTraces: [], recentAudit: [], recentCopilot: [] };
    // Same data, different insertion order:
    const b = { recentCopilot: [], recentAudit: [], recentTraces: [], waitEvents: [], windowTo: 't1', windowFrom: 't0', alertId: 'a' };
    assert.equal(signatureOf(a), signatureOf(b));
});

test('C5: signature changes when payload changes (cost cap key works)', () => {
    const base = { alertId: 'a', waitEvents: [{ wait_class: 'CPU', sample_count: 5 }] };
    const drift = { alertId: 'a', waitEvents: [{ wait_class: 'CPU', sample_count: 6 }] };
    assert.notEqual(signatureOf(base), signatureOf(drift));
});

test('C5: queue name and window constants are stable', () => {
    assert.equal(RCA_QUEUE, 'alerts.rca');
    assert.equal(typeof WINDOW_MIN, 'number');
    assert.ok(WINDOW_MIN >= 1 && WINDOW_MIN <= 60);
});

test('C5: enqueueRca returns boolean without throwing on a missing pool', async () => {
    const { enqueueRca } = await import('../services/alertRcaService.js');
    const ok = await enqueueRca({
        id: 'test-alert-1', timestamp: new Date().toISOString(),
        orgId: 1, data: { connectionId: null },
    });
    assert.equal(typeof ok, 'boolean');
});
