/**
 * tests/queue.test.js — B1 in-process queue fallback.
 * Real BullMQ + Redis behaviour is covered by the manual smoke test
 * in backend/docs/ARCHITECTURE.md; this exercises only the fallback path
 * which is what dev and single-process deployments hit.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQueue, createWorker, acquireLeaderLock, QUEUE_NAMES } from '../services/queue.js';

test('B1 in-process queue: add() delivers to a registered worker', async () => {
    const received = [];
    const worker = createWorker('test.queue.a', async (job) => {
        received.push(job);
    });
    const q = createQueue('test.queue.a');
    await q.add('hello', { x: 1 });
    await q.add('hello', { x: 2 });
    // Allow the setImmediate / setTimeout(0) inside the in-proc queue to drain.
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(received.length, 2);
    assert.deepEqual(received.map((j) => j.data), [{ x: 1 }, { x: 2 }]);
    assert.equal(received[0].name, 'hello');
    await worker.close();
});

test('B1 in-process queue: multiple workers fan-out independently per queue', async () => {
    const a = [];
    const b = [];
    const wA = createWorker('test.queue.b', (job) => { a.push(job.data); });
    const wB = createWorker('test.queue.b', (job) => { b.push(job.data); });
    const q = createQueue('test.queue.b');
    await q.add('n', 1);
    await new Promise((r) => setTimeout(r, 20));
    // EventEmitter delivers to every listener — both workers see the job.
    assert.deepEqual(a, [1]);
    assert.deepEqual(b, [1]);
    await wA.close();
    await wB.close();
});

test('B1 acquireLeaderLock: single-process mode always returns true', async () => {
    const got = await acquireLeaderLock('test:leader:1', 1000);
    assert.equal(got, true);
});

test('B1 QUEUE_NAMES has the expected queue identifiers', () => {
    for (const k of ['OTLP_INGEST','ALERT_DISPATCH','SYNTHETIC_RUN','WAIT_EVENT_POLL','AUDIT_EXPORT','COPILOT_PURGE']) {
        assert.ok(QUEUE_NAMES[k], `missing ${k}`);
    }
});
